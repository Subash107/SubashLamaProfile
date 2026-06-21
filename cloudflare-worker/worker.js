/**
 * Cloudflare Worker — Resume Download Tracker v2
 *
 * Features:
 *   - Real IP + geo from Cloudflare headers (no external API)
 *   - Hot Lead Detector (scores by company tier)
 *   - Repeat Visitor Alert (Workers KV tracks per-IP history)
 *   - Tor / VPN / Proxy Detection (via cf.threat + AbuseIPDB flags)
 *   - Skips owner's own downloads silently
 *
 * Secrets: GITHUB_PAT
 * KV Binding: DOWNLOAD_KV (for repeat visitor tracking)
 *
 * Deploy: cd cloudflare-worker && npx wrangler deploy worker.js
 */

const GITHUB_REPO = "Subash107/SubashLamaProfile";

const ALLOWED_ORIGINS = [
  "https://subashlamaprofile.pages.dev",
  "https://subash107.github.io",
];

/* Skip own downloads */
const OWNER_ORGS = ["VIA NET COMMUNICATION LTD", "VIA NET"];

/* Hot Lead scoring — match against org name */
const HOT_LEADS = [
  "Microsoft", "Google", "Amazon", "Apple", "Meta", "Netflix", "Cisco",
  "IBM", "Oracle", "Salesforce", "Adobe", "Intel", "Nvidia", "Palo Alto",
  "CrowdStrike", "SentinelOne", "Splunk", "Fortinet", "Check Point",
  "Deloitte", "KPMG", "PwC", "Ernst", "Accenture", "Infosys", "Wipro",
  "TCS", "HCL", "Capgemini", "Cognizant", "ManTech", "Booz Allen",
  "Leidos", "SAIC", "Raytheon", "Lockheed", "Northrop", "BAE Systems",
  "Emirates", "Etisalat", "du Telecom", "Qatar Airways", "Saudi Aramco",
];

const WARM_LEADS = [
  "Bank", "Finance", "Insurance", "Healthcare", "Hospital", "University",
  "Government", "Ministry", "Department", "Security", "Defence", "Defense",
  "Telecom", "Communications", "Networks", "Technology", "Solutions",
];

/* Known Tor/VPN/proxy ASNs */
const TOR_VPN_ASNS = [
  "AS60729", "AS396507", "AS205100", "AS9009", "AS20473",
  "AS14061", "AS16509", "AS15169", "Tor", "VPN", "Proxy",
  "Hosting", "Data Center", "Datacenter", "Cloud",
];

/* Known datacenter/cloud orgs — visits from these are likely bots */
const DATACENTER_KEYWORDS = [
  "microsoft azure", "amazon", "google cloud", "digitalocean", "linode",
  "vultr", "ovh", "hetzner", "cloudflare", "akamai", "fastly", "rackspace",
  "leaseweb", "choopa", "psychz", "server", "hosting", "datacenter",
  "data center", "colocation", "colo", "cdn", "content delivery",
];

const BOT_UA_KEYWORDS = [
  "bot", "crawler", "spider", "slurp", "googlebot", "bingbot", "yahoo",
  "duckduck", "baidu", "yandex", "semrush", "ahrefs", "moz", "pingdom",
  "uptimerobot", "monitor", "curl", "python", "java/", "go-http", "wget",
];

function detectBot(org, ua, cf) {
  const orgLow = (org || "").toLowerCase();
  const uaLow  = (ua  || "").toLowerCase();
  const botScore = cf.botManagement?.score;

  if (BOT_UA_KEYWORDS.some(k => uaLow.includes(k))) return "BOT (suspicious user-agent)";
  if (botScore !== undefined && botScore < 30) return `BOT (CF bot score: ${botScore})`;
  if (DATACENTER_KEYWORDS.some(k => orgLow.includes(k))) return "BOT (datacenter IP)";
  return null;
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
    "Vary": "Origin",
  };
}

function scoreLead(org) {
  const orgUp = org.toUpperCase();
  if (HOT_LEADS.some(h => orgUp.includes(h.toUpperCase()))) return "🔥 HOT LEAD";
  if (WARM_LEADS.some(w => orgUp.includes(w.toUpperCase()))) return "⭐ WARM LEAD";
  return "📥 Download";
}

function detectTorVPN(org, cf) {
  const orgUp = org.toUpperCase();
  const isTorVPN = TOR_VPN_ASNS.some(t => orgUp.includes(t.toUpperCase()));
  const isThreat = cf.botManagement?.score < 30 || false;
  if (isTorVPN || isThreat) return "🧅 TOR/VPN/PROXY";
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url    = new URL(request.url);

    /* ── Tracked redirect links (embed these in your PDF) ── */
    /* Works in ALL PDF readers — fires when recruiter clicks any link    */
    const REDIRECT_MAP = {
      "/go/linkedin": "https://www.linkedin.com/in/subash-lama-b319a016b/",
      "/go/github":   "https://github.com/Subash107",
      "/go/email":    "https://subashlamaprofile.pages.dev/#contact",
      "/go/phone":    "https://subashlamaprofile.pages.dev/#contact",
      "/go/portfolio":"https://subashlamaprofile.pages.dev/",
    };

    if (REDIRECT_MAP[url.pathname]) {
      const dest      = REDIRECT_MAP[url.pathname];
      const linkName  = url.pathname.replace("/go/", "").toUpperCase();
      const ip        = request.headers.get("CF-Connecting-IP") || "unknown";
      const cf        = request.cf || {};
      const city      = cf.city           || "";
      const country   = cf.country        || "";
      const org       = cf.asOrganization || "unknown";
      const location  = [city, country].filter(Boolean).join(", ") || "unknown";
      const leadScore = scoreLead(org);

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🔗 PDF LINK CLICKED — ${linkName}!\n\n${leadScore}\n📍 Location : ${location}\n🏢 Company  : ${org}\n🌐 IP       : ${ip}\n🕐 Time     : ${new Date().toISOString()}\n\n💡 They clicked your resume link — actively reading it!`,
        }),
      }).catch(() => {});

      return Response.redirect(dest, 302);
    }

    /* ── Honeypot reference page ── */
    /* Add "References: lingering-surf-6d77.lamasubash107.workers.dev/ref" to PDF */
    /* High-intent signal — only serious recruiters click this              */
    if (url.pathname === "/ref") {
      const ip       = request.headers.get("CF-Connecting-IP") || "unknown";
      const cf       = request.cf || {};
      const city     = cf.city           || "";
      const country  = cf.country        || "";
      const org      = cf.asOrganization || "unknown";
      const location = [city, country].filter(Boolean).join(", ") || "unknown";
      const leadScore= scoreLead(org);

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🎯 HIGH INTENT SIGNAL!\n\nSomeone clicked your REFERENCE link in your resume!\n\n${leadScore}\n📍 Location : ${location}\n🏢 Company  : ${org}\n🌐 IP       : ${ip}\n🕐 Time     : ${new Date().toISOString()}\n\n🔥 This is a SERIOUS recruiter — they want references!`,
        }),
      }).catch(() => {});

      return new Response(`<!DOCTYPE html><html><head><title>Subash Lama — References</title><meta charset="UTF-8"><style>body{font-family:sans-serif;max-width:600px;margin:80px auto;padding:20px;background:#07111c;color:#e0e0e0}h1{color:#00ff88}p{color:#aaa}.btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#00ff88;color:#000;text-decoration:none;border-radius:6px;font-weight:bold}</style></head><body><h1>Subash Lama</h1><p>Thank you for your interest in Subash's profile.</p><p>Professional references are available upon request for serious opportunities.</p><p>Please reach out directly:</p><p>📧 lamasubash107@gmail.com<br>📱 +977 9840005771</p><a href="https://subashlamaprofile.pages.dev/#contact" class="btn">Contact Subash</a></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }

    /* ── Behavior tracking endpoint ── */
    if (url.pathname === "/behavior" && request.method === "POST") {
      try {
        const body       = await request.json();
        const payload    = body.client_payload || {};
        const totalTime  = payload.total_time  || "?";
        const sections   = payload.top_sections|| "none";
        const ref        = payload.ref_source  || "direct";
        const ip         = request.headers.get("CF-Connecting-IP") || "unknown";
        const ua         = request.headers.get("User-Agent") || "";
        const cf         = request.cf || {};
        const org        = cf.asOrganization || "unknown";
        const country    = cf.country        || "";
        const city       = cf.city           || "";
        const location   = [city, country].filter(Boolean).join(", ") || "unknown";

        /* Deduplicate — only send one alert per IP per 2 minutes */
        if (env.DOWNLOAD_KV && ip !== "unknown") {
          const dedupKey = `behavior_${ip.replace(/[:/]/g, "_")}`;
          const lastSent = await env.DOWNLOAD_KV.get(dedupKey);
          if (lastSent && Date.now() - parseInt(lastSent) < 120000) {
            return new Response("OK", { status: 200, headers: corsHeaders(origin) });
          }
          await env.DOWNLOAD_KV.put(dedupKey, Date.now().toString(), { expirationTtl: 120 });
        }

        /* Bot detection */
        const botReason = detectBot(org, ua, cf);
        const visitorType = botReason ? `🤖 BOT — ${botReason}` : "✅ HUMAN VISITOR";

        if (parseInt(totalTime) >= 15) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              text: `👁️ PORTFOLIO VISIT REPORT\n\n${visitorType}\n\n📍 Location   : ${location}\n🏢 Company    : ${org}\n⏱️ Time spent : ${totalTime}\n📖 Read most  : ${sections}\n📌 Source     : ${ref}\n🌐 IP         : ${ip}\n🕐 Time       : ${payload.timestamp || new Date().toISOString()}`,
            }),
          }).catch(() => {});
        }
        return new Response("OK", { status: 200, headers: corsHeaders(origin) });
      } catch { return new Response("OK", { status: 200 }); }
    }

    /* ── Canary Token endpoint ── */
    if (url.pathname === "/canary") {
      const ip        = request.headers.get("CF-Connecting-IP") || "unknown";
      const cf        = request.cf || {};
      const city      = cf.city           || "";
      const country   = cf.country        || "";
      const org       = cf.asOrganization || "unknown";
      const location  = [city, country].filter(Boolean).join(", ") || "unknown";
      const ua        = request.headers.get("User-Agent") || "unknown";
      const ts        = new Date().toISOString();

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🕵️ CANARY TOKEN FIRED!\n\nYour resume PDF was OPENED!\n\n📍 Location : ${location}\n🏢 Org      : ${org}\n🌐 IP       : ${ip}\n🖥️ App      : ${ua.slice(0,80)}\n🕐 Time     : ${ts}\n\n⚠️ This may be someone who received your resume by email or file share.`,
        }),
      }).catch(() => {});

      /* Return a transparent 1x1 pixel GIF */
      const pixel = new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,0,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);
      return new Response(pixel, {
        status: 200,
        headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const body = await request.json();

      const ip     = request.headers.get("CF-Connecting-IP") || "unknown";
      const cf     = request.cf || {};
      const city   = cf.city           || "";
      const region = cf.region         || "";
      const country= cf.country        || "";
      const org    = cf.asOrganization || "unknown";
      const location = [city, region, country].filter(Boolean).join(", ") || "unknown";

      /* Skip own downloads */
      const isOwn = OWNER_ORGS.some(o => org.toUpperCase().includes(o.toUpperCase()));
      if (isOwn) {
        return new Response("OK", { status: 200, headers: corsHeaders(origin) });
      }

      /* ── Hot Lead Detection ── */
      const leadScore = scoreLead(org);

      /* ── Tor/VPN Detection ── */
      const anonFlag = detectTorVPN(org, cf);

      /* ── Repeat Visitor Detection (KV) ── */
      let repeatFlag = null;
      if (env.DOWNLOAD_KV && ip !== "unknown") {
        const ipKey = `dl_${ip.replace(/[:/]/g, "_")}`;
        const lastSeen = await env.DOWNLOAD_KV.get(ipKey);
        if (lastSeen) {
          const hoursSince = (Date.now() - parseInt(lastSeen)) / 3600000;
          if (hoursSince < 168) { // within 7 days
            const daysAgo = Math.round(hoursSince / 24);
            repeatFlag = daysAgo === 0 ? "today" : `${daysAgo}d ago`;
          }
        }
        await env.DOWNLOAD_KV.put(ipKey, Date.now().toString(), { expirationTtl: 604800 });
      }

      /* Enrich payload */
      if (body.client_payload) {
        body.client_payload.ip         = ip;
        body.client_payload.location   = location;
        body.client_payload.org        = org;
        body.client_payload.lead_score = leadScore;
        body.client_payload.anon_flag  = anonFlag || "none";
        body.client_payload.repeat     = repeatFlag || "new";
      }

      const ghRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
        {
          method: "POST",
          headers: {
            "Authorization":        `Bearer ${env.GITHUB_PAT}`,
            "Accept":               "application/vnd.github+json",
            "Content-Type":         "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent":           "Resume-Download-Tracker/2.0",
          },
          body: JSON.stringify(body),
        }
      );

      return new Response(ghRes.ok ? "OK" : "GitHub error", {
        status:  ghRes.ok ? 200 : 502,
        headers: corsHeaders(origin),
      });

    } catch {
      return new Response("Worker error", {
        status:  500,
        headers: corsHeaders(origin),
      });
    }
  },
};
