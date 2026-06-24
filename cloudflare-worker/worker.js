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

/* Link preview bots — someone shared your portfolio on this platform */
const LINK_PREVIEW_UAS = [
  { ua: "linkedinbot",         platform: "LinkedIn"        },
  { ua: "whatsapp",            platform: "WhatsApp"        },
  { ua: "slackbot",            platform: "Slack"           },
  { ua: "telegrambot",         platform: "Telegram"        },
  { ua: "twitterbot",          platform: "Twitter/X"       },
  { ua: "facebookexternalhit", platform: "Facebook"        },
  { ua: "discordbot",          platform: "Discord"         },
  { ua: "applebot",            platform: "Apple iMessage"  },
  { ua: "skype",               platform: "Skype"           },
  { ua: "viber",               platform: "Viber"           },
  { ua: "microsoft teams",     platform: "Microsoft Teams" },
];

/* Good crawlers — suppress Telegram alerts, they help you get indexed */
const GOOD_CRAWLER_UAS = [
  "googlebot", "bingbot", "yandexbot", "duckduckbot", "baiduspider",
  "semrushbot", "ahrefsbot", "mj12bot", "dotbot", "rogerbot",
  "exabot", "sistrix", "screaming frog", "seokicks", "linkdexbot",
  "uptimerobot", "pingdom", "statuscake", "hetrixtools", "freshping",
];

/* Security scanners — alert with warning */
const SECURITY_SCANNER_UAS = [
  "shodan", "censys", "masscan", "zgrab", "nuclei", "nikto",
  "sqlmap", "dirbuster", "gobuster", "wfuzz", "nessus", "openvas",
];

/* Generic unknown bots */
const GENERIC_BOT_UAS = [
  "crawler", "spider", "slurp", "curl", "python-requests",
  "python/", "java/", "go-http", "wget", "libwww", "httpie",
  "axios", "got/", "node-fetch", "scrapy", "phantomjs", "headless",
];

/* Classify every visitor into a category */
function classifyVisitor(org, ua, cf) {
  const uaLow    = (ua  || "").toLowerCase();
  const orgLow   = (org || "").toLowerCase();
  const botScore = cf.botManagement?.score;

  const shareMatch = LINK_PREVIEW_UAS.find(b => uaLow.includes(b.ua));
  if (shareMatch)
    return { type: "link-preview",     platform: shareMatch.platform, suppress: false, isBot: true  };

  if (SECURITY_SCANNER_UAS.some(k => uaLow.includes(k)))
    return { type: "security-scanner", label: "Security Scanner",     suppress: false, isBot: true  };

  if (GOOD_CRAWLER_UAS.some(k => uaLow.includes(k)))
    return { type: "good-crawler",     label: "Search/SEO Crawler",   suppress: true,  isBot: true  };

  if (botScore !== undefined && botScore < 30)
    return { type: "generic-bot",      label: `CF score ${botScore}/100`, suppress: false, isBot: true };

  if (GENERIC_BOT_UAS.some(k => uaLow.includes(k)))
    return { type: "generic-bot",      label: "Suspicious user-agent",suppress: false, isBot: true  };

  if (DATACENTER_KEYWORDS.some(k => orgLow.includes(k)))
    return { type: "generic-bot",      label: "Datacenter IP",        suppress: false, isBot: true  };

  return { type: "human", suppress: false, isBot: false };
}

/* Backward-compat wrapper used by /behavior endpoint */
function detectBot(org, ua, cf) {
  const v = classifyVisitor(org, ua, cf);
  if (!v.isBot) return null;
  if (v.type === "link-preview") return `Link preview (${v.platform})`;
  return v.label || "BOT";
}

/* Recruiter Intent Score 0-100 */
function calcIntentScore(totalTime, sections, visitCount) {
  let score = 0;
  const secs = parseInt(totalTime) || 0;
  const sectionList = (sections || "").split(",").filter(Boolean);

  if (secs >= 120) score += 35;
  else if (secs >= 60) score += 25;
  else if (secs >= 30) score += 15;
  else if (secs >= 15) score += 5;

  score += Math.min(sectionList.length * 8, 30);

  if (visitCount >= 3) score += 25;
  else if (visitCount === 2) score += 15;
  else score += 5;

  score = Math.min(score, 100);
  if (score >= 75) return { score, label: "HIGH INTENT" };
  if (score >= 45) return { score, label: "MEDIUM INTENT" };
  return { score, label: "LOW INTENT" };
}

/* Achievement checker */
async function checkAchievements(env, totalDownloads, org, countries) {
  if (!env.DOWNLOAD_KV) return [];
  const badges = [];
  const earned = JSON.parse(await env.DOWNLOAD_KV.get("achievements") || "{}");

  const checks = [
    { key: "first_download",  label: "First Resume Download!",          cond: totalDownloads >= 1 },
    { key: "ten_downloads",   label: "10 Total Downloads Milestone!",   cond: totalDownloads >= 10 },
    { key: "fifty_downloads", label: "50 Total Downloads Milestone!",   cond: totalDownloads >= 50 },
    { key: "hundred_dl",      label: "100 Downloads — You're on fire!", cond: totalDownloads >= 100 },
    { key: "first_hot_lead",  label: "First HOT LEAD Download!",        cond: HOT_LEADS.some(h => (org||"").toUpperCase().includes(h.toUpperCase())) },
    { key: "ten_countries",   label: "Resume reached 10 Countries!",    cond: countries >= 10 },
  ];

  for (const c of checks) {
    if (c.cond && !earned[c.key]) {
      earned[c.key] = new Date().toISOString();
      badges.push(c.label);
    }
  }

  if (badges.length) await env.DOWNLOAD_KV.put("achievements", JSON.stringify(earned));
  return badges;
}

/* Download Streak tracker */
async function updateStreak(env) {
  if (!env.DOWNLOAD_KV) return null;
  const today = new Date().toISOString().slice(0, 10);
  const lastDate  = await env.DOWNLOAD_KV.get("streak_last_date");
  const streakRaw = await env.DOWNLOAD_KV.get("streak_count");
  let streak = parseInt(streakRaw) || 0;

  if (lastDate === today) return streak;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastDate === yesterday) {
    streak += 1;
  } else if (lastDate && lastDate < yesterday) {
    streak = 1;
  } else {
    streak = 1;
  }

  await env.DOWNLOAD_KV.put("streak_last_date", today);
  await env.DOWNLOAD_KV.put("streak_count", streak.toString());
  return streak;
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

/* ── MITRE ATT&CK technique map for probe/trap paths ── */
const MITRE_MAP = {
  "/admin":        { id: "T1190",     name: "Exploit Public-Facing Application" },
  "/login":        { id: "T1078",     name: "Valid Accounts — Probe"             },
  "/wp-admin":     { id: "T1190",     name: "Exploit Public-Facing Application" },
  "/wp-login.php": { id: "T1078",     name: "Valid Accounts — WP Probe"          },
  "/.env":         { id: "T1552.001", name: "Credentials In Files"               },
  "/config":       { id: "T1083",     name: "File and Directory Discovery"       },
};

/* ── CIA impact profiles per event type ── */
const CIA_PROFILES = {
  credential_probe: { C: "HIGH",   I: "NONE", A: "LOW",    risk: "HIGH",   cls: "Credential Enumeration"       },
  admin_probe:      { C: "HIGH",   I: "NONE", A: "LOW",    risk: "HIGH",   cls: "Admin Panel Discovery"        },
  config_probe:     { C: "HIGH",   I: "NONE", A: "LOW",    risk: "HIGH",   cls: "Configuration Discovery"      },
  honeypot:         { C: "HIGH",   I: "NONE", A: "LOW",    risk: "HIGH",   cls: "Unauthorized Reconnaissance"  },
  aggressive_bot:   { C: "LOW",    I: "NONE", A: "MEDIUM", risk: "MEDIUM", cls: "Availability Attack Attempt"  },
  security_scanner: { C: "MEDIUM", I: "NONE", A: "LOW",    risk: "MEDIUM", cls: "Active Reconnaissance"        },
  canary:           { C: "HIGH",   I: "NONE", A: "NONE",   risk: "HIGH",   cls: "Document Exfiltration Signal" },
  tor_vpn:          { C: "MEDIUM", I: "NONE", A: "NONE",   risk: "MEDIUM", cls: "Identity Concealment"         },
};

function getCiaTriage(eventType) {
  return CIA_PROFILES[eventType] || { C: "LOW", I: "NONE", A: "NONE", risk: "LOW", cls: "Unknown Event" };
}

function formatCiaBlock(cia, mitre) {
  const parts = [
    `\n\n🛡️ CIA TRIAGE`,
    `C — Confidentiality : ${cia.C}`,
    `I — Integrity       : ${cia.I}  (static site — no write surface)`,
    `A — Availability    : ${cia.A}`,
    `Risk Level          : ${cia.risk}`,
    `Classification      : ${cia.cls}`,
  ];
  if (mitre) parts.push(`MITRE ATT&CK         : ${mitre.id} — ${mitre.name}`);
  return parts.join("\n");
}

function calcSeverity(ciaRisk, isHotLead) {
  if (isHotLead)            return "🔴 P1 — HOT LEAD";
  if (ciaRisk === "HIGH")   return "🟠 P2 — HIGH RISK";
  if (ciaRisk === "MEDIUM") return "🟡 P3 — MEDIUM RISK";
  return "🔵 P4 — LOW / INFO";
}

function getWeekKey() {
  const now  = new Date();
  const year = now.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

async function trackCiaWeekly(env, cia, eventType, loc) {
  if (!env.DOWNLOAD_KV) return;
  const week = getWeekKey();
  const riskKey = `cia_${cia.risk.toLowerCase()}_${week}`;
  const prev    = parseInt(await env.DOWNLOAD_KV.get(riskKey) || "0") + 1;
  await env.DOWNLOAD_KV.put(riskKey, prev.toString(), { expirationTtl: 1209600 });
  const evtKey = `sec_events_${week}`;
  let events   = [];
  try { events = JSON.parse(await env.DOWNLOAD_KV.get(evtKey) || "[]"); } catch {}
  events.push({ type: eventType, risk: cia.risk, cls: cia.cls, loc, ts: new Date().toISOString() });
  if (events.length > 30) events = events.slice(-30);
  await env.DOWNLOAD_KV.put(evtKey, JSON.stringify(events), { expirationTtl: 1209600 });
  await env.DOWNLOAD_KV.put("last_sec_event", JSON.stringify({ type: eventType, risk: cia.risk, cls: cia.cls, loc, ts: new Date().toISOString() }));
}

function buildThreatKeyboard(ip) {
  return {
    inline_keyboard: [[
      { text: "🔍 AbuseIPDB", url: `https://www.abuseipdb.com/check/${ip}` },
      { text: "🔭 Shodan",    url: `https://www.shodan.io/host/${ip}` },
    ]],
  };
}

function buildHotLeadKeyboard(ip, org) {
  return {
    inline_keyboard: [[
      { text: "🔍 AbuseIPDB", url: `https://www.abuseipdb.com/check/${ip}` },
      { text: "🔭 Shodan",    url: `https://www.shodan.io/host/${ip}` },
    ],[
      { text: "🌐 IP Whois",  url: `https://who.is/whois-ip/ip-address/${ip}` },
      { text: "💼 LinkedIn",  url: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(org)}` },
    ]],
  };
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

    /* ── Instant arrival notification ── */
    if (url.pathname === "/visit" && request.method === "POST") {
      try {
        const ip       = request.headers.get("CF-Connecting-IP") || "unknown";
        const ua       = request.headers.get("User-Agent") || "";
        const cf       = request.cf || {};
        const city     = cf.city           || "";
        const country  = cf.country        || "";
        const org      = cf.asOrganization || "unknown";
        const location = [city, country].filter(Boolean).join(", ") || "unknown";

        let body = {};
        try { body = await request.json(); } catch {}
        const payload   = body.client_payload || {};
        const refSource = payload.ref_source  || "direct";
        const ts        = new Date().toISOString();
        const today     = ts.slice(0, 10);

        const visitor = classifyVisitor(org, ua, cf);

        /* ── Rate limiting — block aggressive bots (10+ hits in 5 min) ── */
        if (env.DOWNLOAD_KV && ip !== "unknown") {
          const rateKey   = `rate_${ip.replace(/[:/]/g, "_")}`;
          const rateCount = parseInt(await env.DOWNLOAD_KV.get(rateKey) || "0") + 1;
          await env.DOWNLOAD_KV.put(rateKey, rateCount.toString(), { expirationTtl: 300 });
          if (rateCount > 10) {
            if (rateCount === 11) {
              const cia  = getCiaTriage("aggressive_bot");
              const sev  = calcSeverity(cia.risk, false);
              const ciaB = formatCiaBlock(cia, { id: "T1498", name: "Network Denial of Service" });
              await trackCiaWeekly(env, cia, "aggressive_bot", location);
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: env.TELEGRAM_CHAT_ID,
                  text: `🚨 AGGRESSIVE BOT BLOCKED\n\n${sev}\nIP hit your site ${rateCount}x in 5 min — silently blocked.\n\n🌐 IP      : ${ip}\n🏢 Org     : ${org}\n📍 Location: ${location}\n🕐 Time    : ${ts}${ciaB}`,
                  reply_markup: buildThreatKeyboard(ip),
                }),
              }).catch(() => {});
            }
            return new Response("OK", { status: 200, headers: corsHeaders(origin) });
          }
        }

        /* ── Track daily + weekly bot/human counts in KV ── */
        if (env.DOWNLOAD_KV) {
          const countKey = visitor.isBot ? `bot_count_${today}` : `human_count_${today}`;
          const prev     = parseInt(await env.DOWNLOAD_KV.get(countKey) || "0") + 1;
          await env.DOWNLOAD_KV.put(countKey, prev.toString(), { expirationTtl: 86400 });
          const week    = getWeekKey();
          const weekKey = visitor.isBot ? `week_bot_${week}` : `week_human_${week}`;
          const weekPrev= parseInt(await env.DOWNLOAD_KV.get(weekKey) || "0") + 1;
          await env.DOWNLOAD_KV.put(weekKey, weekPrev.toString(), { expirationTtl: 1209600 });
        }

        /* ── Link preview bot — someone SHARED your portfolio ── */
        if (visitor.type === "link-preview") {
          if (env.DOWNLOAD_KV) {
            const shareKey = `share_count_${today}`;
            const shareCount = parseInt(await env.DOWNLOAD_KV.get(shareKey) || "0") + 1;
            await env.DOWNLOAD_KV.put(shareKey, shareCount.toString(), { expirationTtl: 86400 });
          }
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID,
              text: `📤 PORTFOLIO SHARED ON ${visitor.platform}!\n\nSomeone just shared your portfolio link — a real person is about to view it!\n\n📍 Location : ${location}\n🌐 IP       : ${ip}\n🕐 Time     : ${ts}` }),
          }).catch(() => {});
          return new Response("OK", { status: 200, headers: corsHeaders(origin) });
        }

        /* ── Security scanner — alert separately ── */
        if (visitor.type === "security-scanner") {
          const cia  = getCiaTriage("security_scanner");
          const sev  = calcSeverity(cia.risk, false);
          const ciaB = formatCiaBlock(cia, { id: "T1595", name: "Active Scanning" });
          await trackCiaWeekly(env, cia, "security_scanner", location);
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              text: `🔍 SECURITY SCANNER DETECTED\n\n${sev}\n${visitor.label} is probing your portfolio.\n\n🌐 IP       : ${ip}\n🏢 Org      : ${org}\n📍 Location : ${location}\n🕐 Time     : ${ts}${ciaB}`,
              reply_markup: buildThreatKeyboard(ip),
            }),
          }).catch(() => {});
          return new Response("OK", { status: 200, headers: corsHeaders(origin) });
        }

        /* ── Good crawlers — silent, no Telegram alert ── */
        if (visitor.suppress) {
          return new Response("OK", { status: 200, headers: corsHeaders(origin) });
        }

        /* ── Deduplicate — one alert per IP per 10 minutes ── */
        if (env.DOWNLOAD_KV && ip !== "unknown") {
          const dedupKey = `visit_${ip.replace(/[:/]/g, "_")}`;
          const lastSent = await env.DOWNLOAD_KV.get(dedupKey);
          if (lastSent && Date.now() - parseInt(lastSent) < 600000) {
            return new Response("OK", { status: 200, headers: corsHeaders(origin) });
          }
          await env.DOWNLOAD_KV.put(dedupKey, Date.now().toString(), { expirationTtl: 600 });
        }

        const visitorLabel = visitor.isBot ? `🤖 BOT — ${visitor.label}` : "✅ HUMAN VISITOR";
        const leadScore    = scoreLead(org);
        const anonFlag     = detectTorVPN(org, cf);

        /* ── Extra intelligence signals (humans only) ── */
        const extras = [];
        if (env.DOWNLOAD_KV && !visitor.isBot) {

          /* Company repeat visit */
          const companyKey   = `company_${org.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}`;
          const companyCount = parseInt(await env.DOWNLOAD_KV.get(companyKey) || "0") + 1;
          await env.DOWNLOAD_KV.put(companyKey, companyCount.toString(), { expirationTtl: 604800 });
          if (companyCount === 2) extras.push(`🔁 2nd visit from ${org} this week`);
          if (companyCount === 3) extras.push(`🔥 3rd visit from ${org} — HIGH INTEREST! Check LinkedIn.`);
          if (companyCount > 3)  extras.push(`⚡ Visit #${companyCount} from ${org} this week`);

          /* First-ever country */
          if (country) {
            let seen = [];
            try { seen = JSON.parse(await env.DOWNLOAD_KV.get("seen_countries") || "[]"); } catch {}
            if (!seen.includes(country)) {
              seen.push(country);
              await env.DOWNLOAD_KV.put("seen_countries", JSON.stringify(seen));
              extras.push(`🌍 FIRST-EVER visit from ${country}!`);
            }
          }

          /* Daily repeat visitor */
          if (ip !== "unknown") {
            const dailyKey   = `daily_${ip.replace(/[:/]/g, "_")}_${today}`;
            const dailyCount = parseInt(await env.DOWNLOAD_KV.get(dailyKey) || "0") + 1;
            await env.DOWNLOAD_KV.put(dailyKey, dailyCount.toString(), { expirationTtl: 86400 });
            if (dailyCount === 2) extras.push(`👁️ Returned today — checking you out again`);
            if (dailyCount >= 3)  extras.push(`👁️ Visit #${dailyCount} today — very interested!`);
          }

          /* Traffic spike per source */
          if (refSource && refSource !== "direct") {
            const hour      = ts.slice(0, 13).replace("T", "_");
            const spikeKey  = `spike_${refSource.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}_${hour}`;
            const spikeCount= parseInt(await env.DOWNLOAD_KV.get(spikeKey) || "0") + 1;
            await env.DOWNLOAD_KV.put(spikeKey, spikeCount.toString(), { expirationTtl: 3600 });
            if (spikeCount === 5)  extras.push(`📈 TRAFFIC SPIKE — 5 visitors from ${refSource} this hour!`);
            if (spikeCount === 10) extras.push(`🚀 VIRAL — 10 visitors from ${refSource} this hour!`);
          }
        }

        const lines = [
          `👁️ PORTFOLIO OPENED!`,
          ``,
          visitorLabel,
          leadScore,
          anonFlag ? anonFlag : null,
          extras.length ? `\n${extras.join("\n")}` : null,
          ``,
          `📍 Location : ${location}`,
          `🏢 Company  : ${org}`,
          `🌐 IP       : ${ip}`,
          `📌 Source   : ${refSource}`,
          `🕐 Time     : ${ts}`,
        ].filter(l => l !== null);

        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: lines.join("\n").replace(/\n{3,}/g, "\n\n") }),
        }).catch(() => {});

        return new Response("OK", { status: 200, headers: corsHeaders(origin) });
      } catch {
        return new Response("OK", { status: 200 });
      }
    }

    /* ── Honeypot trap — hidden link only bots follow ── */
    if (url.pathname === "/bot-trap") {
      const ip  = request.headers.get("CF-Connecting-IP") || "unknown";
      const ua  = request.headers.get("User-Agent") || "unknown";
      const cf  = request.cf || {};
      const org = cf.asOrganization || "unknown";
      const loc = [cf.city, cf.country].filter(Boolean).join(", ") || "unknown";
      const cia  = getCiaTriage("honeypot");
      const sev  = calcSeverity(cia.risk, false);
      const ciaB = formatCiaBlock(cia, { id: "T1595.002", name: "Active Scanning: Vulnerability Scanning" });
      await trackCiaWeekly(env, cia, "honeypot", loc);
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🕵️ HONEYPOT TRIGGERED!\n\n${sev}\nA bot followed a hidden link humans cannot see.\n\n🌐 IP       : ${ip}\n🏢 Org      : ${org}\n📍 Location : ${loc}\n🖥️ Agent    : ${ua.slice(0, 100)}\n🕐 Time     : ${new Date().toISOString()}${ciaB}`,
          reply_markup: buildThreatKeyboard(ip),
        }),
      }).catch(() => {});
      return new Response("Not found", { status: 404 });
    }

    /* ── Fake admin/login traps — common bot probe paths ── */
    const TRAP_PATHS = ["/admin", "/login", "/wp-admin", "/wp-login.php", "/.env", "/config"];
    if (TRAP_PATHS.includes(url.pathname)) {
      const ip  = request.headers.get("CF-Connecting-IP") || "unknown";
      const ua  = request.headers.get("User-Agent") || "unknown";
      const cf  = request.cf || {};
      const org = cf.asOrganization || "unknown";
      const loc = [cf.city, cf.country].filter(Boolean).join(", ") || "unknown";
      const mitre    = MITRE_MAP[url.pathname];
      const ciaType  = (url.pathname === "/.env")  ? "credential_probe"
                     : (url.pathname === "/config") ? "config_probe"
                     : "admin_probe";
      const cia  = getCiaTriage(ciaType);
      const sev  = calcSeverity(cia.risk, false);
      const ciaB = formatCiaBlock(cia, mitre);
      await trackCiaWeekly(env, cia, ciaType, loc);
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🚨 BOT PROBING YOUR SITE\n\n${sev}\nPath    : ${url.pathname}\nNote    : Trap page — only bots hit this\n\n🌐 IP       : ${ip}\n🏢 Org      : ${org}\n📍 Location : ${loc}\n🖥️ Agent    : ${ua.slice(0, 100)}\n🕐 Time     : ${new Date().toISOString()}${ciaB}`,
          reply_markup: buildThreatKeyboard(ip),
        }),
      }).catch(() => {});
      return new Response(
        `<!DOCTYPE html><html><head><title>Login</title></head><body><form><input type="text" placeholder="Username"><input type="password" placeholder="Password"><button>Login</button></form></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }

    /* ── Daily stats endpoint — queried by GitHub Actions digest ── */
    if (url.pathname === "/daily-stats" && request.method === "GET") {
      const today      = new Date().toISOString().slice(0, 10);
      const humanCount = parseInt(await env.DOWNLOAD_KV?.get(`human_count_${today}`) || "0");
      const botCount   = parseInt(await env.DOWNLOAD_KV?.get(`bot_count_${today}`)   || "0");
      const shareCount = parseInt(await env.DOWNLOAD_KV?.get(`share_count_${today}`) || "0");
      return new Response(JSON.stringify({ humanCount, botCount, shareCount, date: today }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
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

        /* Deduplicate — only send one alert per IP per 5 minutes (fixes duplicate on tab close) */
        if (env.DOWNLOAD_KV && ip !== "unknown") {
          const dedupKey = `behavior_${ip.replace(/[:/]/g, "_")}`;
          const lastSent = await env.DOWNLOAD_KV.get(dedupKey);
          if (lastSent && Date.now() - parseInt(lastSent) < 300000) {
            return new Response("OK", { status: 200, headers: corsHeaders(origin) });
          }
          await env.DOWNLOAD_KV.put(dedupKey, Date.now().toString(), { expirationTtl: 300 });
        }

        /* Bot detection — suppress behavior reports for good crawlers */
        const botReason = detectBot(org, ua, cf);
        const visitorClass = classifyVisitor(org, ua, cf);
        if (visitorClass.suppress) {
          return new Response("OK", { status: 200, headers: corsHeaders(origin) });
        }
        const visitorType = botReason ? `🤖 BOT — ${botReason}` : "✅ HUMAN VISITOR";

        /* Recruiter Intent Score */
        let visitCount = 1;
        if (env.DOWNLOAD_KV && ip !== "unknown") {
          const visitKey = `visits_${ip.replace(/[:/]/g, "_")}`;
          visitCount = parseInt(await env.DOWNLOAD_KV.get(visitKey) || "0") + 1;
          await env.DOWNLOAD_KV.put(visitKey, visitCount.toString(), { expirationTtl: 2592000 });
        }
        const intent = calcIntentScore(totalTime, sections, visitCount);

        /* Track bounce rate — count all visits including short ones */
        if (env.DOWNLOAD_KV) {
          const totalVisits = parseInt(await env.DOWNLOAD_KV.get("total_visits") || "0") + 1;
          await env.DOWNLOAD_KV.put("total_visits", totalVisits.toString());
          if (parseInt(totalTime) >= 15) {
            const engagedVisits = parseInt(await env.DOWNLOAD_KV.get("engaged_visits") || "0") + 1;
            await env.DOWNLOAD_KV.put("engaged_visits", engagedVisits.toString());
          }
        }

        const timeNum     = parseInt(totalTime) || 0;
        const scrollDepth = payload.scroll_depth || "?";
        const clicks      = payload.clicks       || "none";
        const isLongSession = timeNum >= 300;

        if (timeNum >= 15) {
          const isHotVisit   = HOT_LEADS.some(h => org.toUpperCase().includes(h.toUpperCase()));
          const visitSev     = calcSeverity(intent.score >= 75 ? "HIGH" : intent.score >= 45 ? "MEDIUM" : "LOW", isHotVisit);
          const sessionLabel = isLongSession
            ? `🔥 LONG SESSION — ${Math.round(timeNum / 60)} min — HIGH INTEREST!`
            : `👁️ PORTFOLIO VISIT REPORT`;

          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              text: `${sessionLabel}\n\n${visitorType}\n${visitSev}\n🎯 Intent Score: ${intent.score}/100 — ${intent.label}\n👀 Visit #${visitCount} from this IP\n\n📍 Location   : ${location}\n🏢 Company    : ${org}\n⏱️ Time spent : ${totalTime}\n📜 Scroll     : ${scrollDepth}\n📖 Read most  : ${sections}\n🖱️ Clicked    : ${clicks}\n📌 Source     : ${ref}\n🌐 IP         : ${ip}\n🕐 Time       : ${payload.timestamp || new Date().toISOString()}`,
              reply_markup: (isHotVisit || intent.score >= 60) ? buildHotLeadKeyboard(ip, org) : undefined,
            }),
          }).catch(() => {});
        }
        return new Response("OK", { status: 200, headers: corsHeaders(origin) });
      } catch { return new Response("OK", { status: 200 }); }
    }

    /* ── Follow-up Check endpoint (called by GitHub Actions daily) ── */
    if (url.pathname === "/followup-check" && request.method === "GET") {
      if (!env.DOWNLOAD_KV) return new Response("OK");
      try {
        const list = await env.DOWNLOAD_KV.list({ prefix: "hotlead_" });
        const now  = Date.now();
        const alerts = [];
        for (const key of list.keys) {
          const raw  = await env.DOWNLOAD_KV.get(key.name);
          if (!raw) continue;
          const data = JSON.parse(raw);
          const ageDays = (now - data.ts) / 86400000;
          if (ageDays >= 3 && ageDays < 4) {
            alerts.push(`${data.org} (${data.location}) downloaded ${Math.floor(ageDays)}d ago`);
          }
        }
        if (alerts.length) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              text: `FOLLOW-UP REMINDER!\n\nThese HOT LEADS downloaded your resume 3 days ago — consider reaching out on LinkedIn!\n\n${alerts.map((a, i) => `${i+1}. ${a}`).join("\n")}`,
            }),
          }).catch(() => {});
        }
        return new Response("OK");
      } catch { return new Response("OK"); }
    }

    /* ── Weekly SOC Digest — called by GitHub Actions every Monday ── */
    if (url.pathname === "/weekly-report" && request.method === "GET") {
      const auth = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!env.REPORT_SECRET || auth !== env.REPORT_SECRET.trim()) {
        return new Response("Forbidden", { status: 403 });
      }
      if (!env.DOWNLOAD_KV) return new Response("No KV binding", { status: 500 });
      try {
        const week = getWeekKey();
        const [ weekHuman, weekBot, ciaHigh, ciaMedium, ciaLow, totalDl, streak, eventsRaw ] = await Promise.all([
          env.DOWNLOAD_KV.get(`week_human_${week}`),
          env.DOWNLOAD_KV.get(`week_bot_${week}`),
          env.DOWNLOAD_KV.get(`cia_high_${week}`),
          env.DOWNLOAD_KV.get(`cia_medium_${week}`),
          env.DOWNLOAD_KV.get(`cia_low_${week}`),
          env.DOWNLOAD_KV.get("total_dl_count"),
          env.DOWNLOAD_KV.get("streak_count"),
          env.DOWNLOAD_KV.get(`sec_events_${week}`),
        ]);
        let events = [];
        try { events = JSON.parse(eventsRaw || "[]"); } catch {}
        const eventCounts = {};
        for (const e of events) { eventCounts[e.cls] = (eventCounts[e.cls] || 0) + 1; }
        const topEvents = Object.entries(eventCounts)
          .sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([cls, n]) => `  ${cls}: ${n}x`).join("\n") || "  None recorded";
        const ciaH = parseInt(ciaHigh   || "0");
        const ciaM = parseInt(ciaMedium || "0");
        const ciaL = parseInt(ciaLow    || "0");
        const posture = ciaH > 5 ? "ELEVATED" : ciaH > 0 || ciaM > 3 ? "LOW-MEDIUM" : "LOW";
        const report = [
          `📊 WEEKLY SOC DIGEST — ${week}`,
          ``,
          `👥 TRAFFIC`,
          `  Human visitors : ${parseInt(weekHuman || "0")}`,
          `  Bot events     : ${parseInt(weekBot   || "0")}`,
          `  Resume DLs     : ${totalDl || "0"} (all time)`,
          `  DL streak      : ${streak  || "0"} days`,
          ``,
          `🛡️ CIA IMPACT SUMMARY`,
          `  HIGH   : ${ciaH} events  (C or A impact)`,
          `  MEDIUM : ${ciaM} events`,
          `  LOW    : ${ciaL} events`,
          `  Integrity — ALL NONE ✓ (static read-only surface)`,
          ``,
          `🔍 TOP SECURITY EVENTS THIS WEEK`,
          topEvents,
          ``,
          `📋 GRC RISK REGISTER`,
          `  Unauthorized scanning  : Honeypot + rate limiter ACTIVE`,
          `  Document exfiltration  : Canary token ACTIVE`,
          `  Bot detection          : CF bot score + UA match ACTIVE`,
          `  CIA triage             : Automated per-event ACTIVE`,
          ``,
          `Overall posture : ${posture}`,
          ``,
          `🎯 JOB HUNT — send /funnel for application stats`,
        ].join("\n");
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: report }),
        }).catch(() => {});
        return new Response("OK");
      } catch { return new Response("OK"); }
    }

    /* ── CIA data endpoint — used by Telegram bot /cia command ── */
    if (url.pathname === "/cia-data" && request.method === "GET") {
      if (!env.DOWNLOAD_KV) return new Response(
        JSON.stringify({ week: getWeekKey(), ciaHigh: 0, ciaMedium: 0, ciaLow: 0, events: [] }),
        { headers: { "Content-Type": "application/json" } }
      );
      const week = getWeekKey();
      const [ ciaHigh, ciaMedium, ciaLow, eventsRaw ] = await Promise.all([
        env.DOWNLOAD_KV.get(`cia_high_${week}`),
        env.DOWNLOAD_KV.get(`cia_medium_${week}`),
        env.DOWNLOAD_KV.get(`cia_low_${week}`),
        env.DOWNLOAD_KV.get(`sec_events_${week}`),
      ]);
      let events = [];
      try { events = JSON.parse(eventsRaw || "[]"); } catch {}
      return new Response(
        JSON.stringify({ week, ciaHigh: parseInt(ciaHigh || "0"), ciaMedium: parseInt(ciaMedium || "0"), ciaLow: parseInt(ciaLow || "0"), events }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    /* ── Last security incident — used by Telegram bot /incident command ── */
    if (url.pathname === "/last-incident" && request.method === "GET") {
      if (!env.DOWNLOAD_KV) return new Response("{}", { headers: { "Content-Type": "application/json" } });
      const raw = await env.DOWNLOAD_KV.get("last_sec_event");
      return new Response(raw || "{}", {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
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

      const ciaCanary  = getCiaTriage("canary");
      const sevCanary  = calcSeverity(ciaCanary.risk, false);
      const ciaBCanary = formatCiaBlock(ciaCanary, { id: "T1567", name: "Exfiltration Over Web Service" });
      await trackCiaWeekly(env, ciaCanary, "canary", location);
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🕵️ CANARY TOKEN FIRED!\n\n${sevCanary}\nYour resume PDF was OPENED outside tracked channels!\n\n📍 Location : ${location}\n🏢 Org      : ${org}\n🌐 IP       : ${ip}\n🖥️ App      : ${ua.slice(0,80)}\n🕐 Time     : ${ts}\n\n⚠️ May be: email forward, ATS scan, or recruiter share${ciaBCanary}`,
          reply_markup: buildThreatKeyboard(ip),
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
          if (hoursSince < 168) {
            const daysAgo = Math.round(hoursSince / 24);
            repeatFlag = daysAgo === 0 ? "today" : `${daysAgo}d ago`;
          }
        }
        await env.DOWNLOAD_KV.put(ipKey, Date.now().toString(), { expirationTtl: 604800 });
      }

      /* ── HOT LEAD follow-up storage ── */
      const isHotLead = HOT_LEADS.some(h => org.toUpperCase().includes(h.toUpperCase()));
      if (isHotLead && env.DOWNLOAD_KV && ip !== "unknown") {
        const flKey = `hotlead_${ip.replace(/[:/]/g, "_")}_${Date.now()}`;
        await env.DOWNLOAD_KV.put(flKey, JSON.stringify({ org, location, ts: Date.now() }), { expirationTtl: 604800 });
      }

      /* ── Download Streak ── */
      const streak = await updateStreak(env);

      /* ── Achievement System ── */
      const totalDl = parseInt(await env.DOWNLOAD_KV?.get("total_dl_count") || "0") + 1;
      if (env.DOWNLOAD_KV) await env.DOWNLOAD_KV.put("total_dl_count", totalDl.toString());
      const badges = await checkAchievements(env, totalDl, org, 0);
      if (badges.length) {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `ACHIEVEMENT UNLOCKED!\n\n${badges.map(b => `🏆 ${b}`).join("\n")}`,
          }),
        }).catch(() => {});
      }

      /* ── Streak alert on milestones ── */
      if (streak && [3, 7, 14, 30].includes(streak)) {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `DOWNLOAD STREAK: ${streak} days in a row!\n\nYour resume has been downloaded every day for ${streak} consecutive days. Keep up the momentum!`,
          }),
        }).catch(() => {});
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
