/**
 * Cloudflare Worker — Portfolio AI Chat API
 *
 * Handles chatbot requests for Subash Lama's portfolio.
 * Routes questions to the right service:
 *   - Weather questions    → Open-Meteo API (free, no key)
 *   - CVE/threat intel     → NVD API (free, no key)
 *   - IP reputation        → AbuseIPDB API (free key required)
 *   - Sports predictions   → Claude's knowledge + TheSportsDB
 *   - Everything else      → Claude (Haiku) with Subash's profile
 *
 * Secrets (set via wrangler secret put):
 *   ANTHROPIC_API_KEY  — sk-ant-api03-...
 *   ABUSEIPDB_API_KEY  — from abuseipdb.com (free)
 *
 * Deploy:
 *   npx wrangler deploy chat-worker.js --name portfolio-chat-api
 */

const CF_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const ALLOWED_ORIGINS = [
  "https://subashlamaprofile.pages.dev",
  "https://subash107.github.io",
];

const SYSTEM_PROMPT = `You are SubashBot, a smart AI assistant on Subash Lama's cybersecurity portfolio website. You help recruiters and visitors learn about Subash and answer general questions.

ABOUT SUBASH LAMA:
- Role: Information Security Analyst | SOC Analyst | IAM Analyst | GRC Analyst
- Location: Kathmandu, Nepal (UTC+5:45) — open to remote, hybrid, or on-site
- Experience: 12+ years in enterprise IT, focused on cybersecurity
- Contact: lamasubash107@gmail.com | +977 9840005771
- GitHub: github.com/Subash107
- LinkedIn: linkedin.com/in/subash-lama-b319a016b/

SKILLS & TOOLS:
- SIEM: Wazuh (self-built SOC lab with custom detection rules)
- Network IDS/IPS: Suricata (custom rules, alert correlation)
- Endpoint telemetry: Sysmon (Windows event monitoring)
- IAM: Active Directory, RBAC, Group Policy, MFA, SSO, PAM
- Cloud/DevOps: Docker, GitHub Actions CI/CD, Terraform, Ansible, AWS
- Languages: Python, Bash, PowerShell
- Frameworks: MITRE ATT&CK, NIST 800-53, NIST 800-61, ISO 27001, CIS Controls
- Bug bounty: HackerOne, Intigriti, Bugcrowd

CERTIFICATIONS:
Cisco Endpoint Security, Cisco Ethical Hacker, Cisco Intro to Cybersecurity,
IBM Cybersecurity Fundamentals, IBM Python for Data Science, Google Ads Video

EDUCATION:
Bachelor of Business Administration — Tribhuvan University (2010–2014)

WORK HISTORY:
- Independent Cybersecurity Researcher (Mar 2025–Present): Built personal SOC lab, 20+ custom MITRE ATT&CK detection rules, bug bounty research
- IT & Network Admin at Primuson (2020–2025): 150+ endpoints, IAM, firewall, network monitoring
- IT Systems Admin at Unilever Nepal (2018–2020): FMCG enterprise IT
- IT Officer at SBI Bank Nepal (2014–2018): Banking IT, AD for 200+ staff

RESPONSE RULES:
- Keep answers short and clear (2–4 sentences for general questions)
- Be friendly, professional, and confident
- When weather/sports/threat data is provided, use it to give a specific answer
- For hiring/contact: direct to lamasubash107@gmail.com
- Never make up information about Subash that isn't listed above
- For SPORTS_PREDICTION_REQUEST or SPORTS_DATA: You MUST give a real prediction with winner, probability, and reasoning. Never refuse sports questions. Use your training knowledge about teams, rankings, and recent form.`;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

/* ── Intent detection ─────────────────────────────────────────── */

function detectIntent(msg) {
  const m = msg.toLowerCase();
  const ipMatch     = msg.match(/\b(\d{1,3}\.){3}\d{1,3}\b/);
  const cveMatch    = msg.match(/CVE-\d{4}-\d+/i);
  const urlMatch    = msg.match(/https?:\/\/[^\s]+|(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/);
  const domainMatch = msg.match(/(?:ip|dns|lookup|resolve|check|whois|host)\s+(?:of\s+|for\s+)?([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/i);

  if (ipMatch)     return { type: "ip",      data: ipMatch[0] };
  if (cveMatch)    return { type: "cve",     data: cveMatch[0] };
  if (/wayback|archive|archived|history|web\.archive|snapshot/.test(m) && urlMatch)
                   return { type: "wayback", data: extractDomain(urlMatch[0]) };
  if (domainMatch) return { type: "dns",     data: domainMatch[1] };
  if (/\b(?:ip|dns|lookup|resolve|whois)\b/.test(m) && urlMatch)
                   return { type: "dns",     data: extractDomain(urlMatch[0]) };
  if (/weather|forecast|temperature|rain|sunny|cloudy|humidity/.test(m))
                   return { type: "weather", data: extractCity(msg) };
  if (/cricket|football|soccer|match|prediction|win|score|team|league|ipl|npl/.test(m))
                   return { type: "sports",  data: msg };
  if (/cve|vulnerability|exploit|malware|threat|hack|breach|zero.?day|ransomware/.test(m))
                   return { type: "threats", data: msg };
  return { type: "general", data: null };
}

function extractDomain(url) {
  try {
    const u = url.startsWith("http") ? new URL(url) : new URL("https://" + url);
    return u.hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function extractCity(msg) {
  const patterns = [
    /(?:weather|forecast|temperature)\s+(?:in|for|at|of)\s+([a-zA-Z\s]+?)(?:\s*(?:today|tomorrow|now|\?|$))/i,
    /(?:in|for|at)\s+([a-zA-Z\s]+?)(?:\s*(?:today|tomorrow|now|\?|$))/i,
  ];
  for (const p of patterns) {
    const match = msg.match(p);
    if (match) return match[1].trim();
  }
  return "Kathmandu";
}

/* ── External API calls ───────────────────────────────────────── */

async function getWeather(city) {
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    ).then(r => r.json());

    if (!geo.results?.length) return `Could not find weather for "${city}".`;

    const { latitude, longitude, name, country } = geo.results[0];
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`
    ).then(r => r.json());

    const c = wx.current;
    const d = wx.daily;
    const wDesc = weatherCodeDesc(c.weather_code);

    return `WEATHER_DATA for ${name}, ${country}:
Current: ${c.temperature_2m}°C, ${wDesc}, Humidity: ${c.relative_humidity_2m}%, Wind: ${c.wind_speed_10m} km/h
Tomorrow: ${d.temperature_2m_min[1]}°C – ${d.temperature_2m_max[1]}°C, ${weatherCodeDesc(d.weather_code[1])}
Day after: ${d.temperature_2m_min[2]}°C – ${d.temperature_2m_max[2]}°C, ${weatherCodeDesc(d.weather_code[2])}`;
  } catch {
    return "Weather data temporarily unavailable.";
  }
}

function weatherCodeDesc(code) {
  const codes = {
    0:"Clear sky", 1:"Mainly clear", 2:"Partly cloudy", 3:"Overcast",
    45:"Foggy", 48:"Icy fog", 51:"Light drizzle", 53:"Moderate drizzle",
    61:"Slight rain", 63:"Moderate rain", 65:"Heavy rain",
    71:"Slight snow", 73:"Moderate snow", 75:"Heavy snow",
    80:"Slight showers", 81:"Moderate showers", 82:"Violent showers",
    95:"Thunderstorm", 99:"Thunderstorm with hail"
  };
  return codes[code] || "Unknown conditions";
}

async function resolveDomain(domain) {
  try {
    /* Resolve via Cloudflare DNS over HTTPS */
    const [ipv4Res, ipv6Res] = await Promise.all([
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, { headers: { Accept: "application/dns-json" } }).then(r => r.json()),
      fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=AAAA`, { headers: { Accept: "application/dns-json" } }).then(r => r.json()),
    ]);

    const ipv4 = (ipv4Res.Answer || []).filter(a => a.type === 1).map(a => a.data);
    const ipv6 = (ipv6Res.Answer || []).filter(a => a.type === 28).map(a => a.data);
    const allIPs = [...ipv4, ...ipv6];

    if (!allIPs.length) return `DNS_DATA: No records found for ${domain}.`;

    /* Get geolocation for first IPv4 */
    let geoInfo = "";
    if (ipv4.length) {
      const geo = await fetch(`https://ipapi.co/${ipv4[0]}/json/`).then(r => r.json()).catch(() => ({}));
      if (geo.city) geoInfo = ` — ${geo.city}, ${geo.country_name} (${geo.org || "Unknown org"})`;
    }

    return `DNS_DATA for ${domain}:\nIPv4: ${ipv4.join(", ") || "None"}\nIPv6: ${ipv6.slice(0,2).join(", ") || "None"}${geoInfo}`;
  } catch (e) {
    return `DNS_DATA: Could not resolve ${domain}: ${e.message}`;
  }
}

async function checkWayback(domain) {
  try {
    const res = await fetch(
      `https://archive.org/wayback/available?url=${domain}`
    ).then(r => r.json());

    const snap = res.archived_snapshots?.closest;

    /* Also get first ever snapshot */
    const cdx = await fetch(
      `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&limit=1&fl=timestamp,statuscode&from=19900101&to=20991231&fastLatest=false`
    ).then(r => r.json()).catch(() => []);

    const firstSnap = cdx.length > 1 ? cdx[1] : null;
    const firstDate = firstSnap ? `${firstSnap[0].slice(0,4)}-${firstSnap[0].slice(4,6)}-${firstSnap[0].slice(6,8)}` : "Unknown";

    if (!snap) return `WAYBACK_DATA for ${domain}: Not found in Wayback Machine archive.`;

    const latestDate = snap.timestamp
      ? `${snap.timestamp.slice(0,4)}-${snap.timestamp.slice(4,6)}-${snap.timestamp.slice(6,8)}`
      : "Unknown";

    return `WAYBACK_DATA for ${domain}:\nFirst archived: ${firstDate}\nLatest snapshot: ${latestDate} (HTTP ${snap.status})\nURL: ${snap.url}\nAge: Site has been online since at least ${firstDate}`;
  } catch {
    return `WAYBACK_DATA: Could not check archive for ${domain}.`;
  }
}

async function checkIP(ip, apiKey) {
  if (!apiKey) return `IP_DATA: No AbuseIPDB key configured. IP ${ip} lookup unavailable.`;
  try {
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`,
      { headers: { "Key": apiKey, "Accept": "application/json" } }
    ).then(r => r.json());
    const d = res.data;
    return `IP_DATA for ${ip}: Abuse score: ${d.abuseConfidenceScore}%, Reports: ${d.totalReports}, ` +
           `Country: ${d.countryCode}, ISP: ${d.isp}, Domain: ${d.domain || "N/A"}, ` +
           `Threat: ${d.abuseConfidenceScore > 50 ? "HIGH RISK" : d.abuseConfidenceScore > 20 ? "MEDIUM RISK" : "LOW RISK"}`;
  } catch {
    return `IP_DATA: Could not check reputation for ${ip}.`;
  }
}

async function getSportsPrediction(msg) {
  try {
    /* Simple split on "vs" */
    const lower = msg.toLowerCase();
    const vsIdx = lower.search(/\bvs\.?\b|\bversus\b|\bagainst\b/);
    if (vsIdx === -1) {
      return `SPORTS_PREDICTION_REQUEST: "${msg}"\nProvide a detailed sports prediction using your training knowledge. Include: likely winner, win probability %, key factors, recent form, head-to-head history, and match conditions. Be specific and confident.`;
    }

    const before = msg.slice(0, vsIdx).replace(/^.*?((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)|(?:[a-z]+(?:\s+[a-z]+)*))[\s]*$/i, "$1").trim();
    const afterPart = msg.slice(vsIdx).replace(/^(?:vs\.?|versus|against)\s*/i, "");
    const after  = afterPart.replace(/\s*(?:cricket|football|soccer|match|game|prediction|ipl|npl|t20|odi|test)?[\s?!.]*$/i, "").trim();

    const team1 = before || "Team 1";
    const team2 = after  || "Team 2";

    /* Search both teams on TheSportsDB (free, no key) */
    const [t1Res, t2Res] = await Promise.all([
      fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team1)}`).then(r => r.json()),
      fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team2)}`).then(r => r.json()),
    ]);

    const t1 = t1Res.teams?.[0];
    const t2 = t2Res.teams?.[0];

    let data = `SPORTS_DATA for ${team1} vs ${team2}:\n`;

    if (t1) {
      /* Get last 5 events for team 1 */
      const e1 = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventslast5.php?id=${t1.idTeam}`).then(r => r.json());
      const results1 = (e1.results || []).slice(0, 5).map(e => {
        const won = (e.idHomeTeam === t1.idTeam && e.intHomeScore > e.intAwayScore) ||
                    (e.idAwayTeam === t1.idTeam && e.intAwayScore > e.intHomeScore);
        return won ? "W" : "L";
      });
      const wins1 = results1.filter(r => r === "W").length;
      data += `\n${team1}: Sport=${t1.strSport}, Country=${t1.strCountry}`;
      data += `\n  Last ${results1.length} matches: ${results1.join(" ")} (${wins1}/${results1.length} wins)`;
      data += `\n  Stadium: ${t1.strStadium || "N/A"}, Founded: ${t1.intFormedYear || "N/A"}`;
    } else {
      data += `\n${team1}: Not found in database (using AI knowledge)`;
    }

    if (t2) {
      const e2 = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventslast5.php?id=${t2.idTeam}`).then(r => r.json());
      const results2 = (e2.results || []).slice(0, 5).map(e => {
        const won = (e.idHomeTeam === t2.idTeam && e.intHomeScore > e.intAwayScore) ||
                    (e.idAwayTeam === t2.idTeam && e.intAwayScore > e.intHomeScore);
        return won ? "W" : "L";
      });
      const wins2 = results2.filter(r => r === "W").length;
      data += `\n${team2}: Sport=${t2.strSport}, Country=${t2.strCountry}`;
      data += `\n  Last ${results2.length} matches: ${results2.join(" ")} (${wins2}/${results2.length} wins)`;
      data += `\n  Stadium: ${t2.strStadium || "N/A"}, Founded: ${t2.intFormedYear || "N/A"}`;
    } else {
      data += `\n${team2}: Not found in database (using AI knowledge)`;
    }

    data += `\n\nBased on this data, provide a match prediction with win probabilities and key factors.`;
    return data;
  } catch {
    return null;
  }
}

async function getCVE(cveId) {
  try {
    const res = await fetch(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`
    ).then(r => r.json());
    const vuln = res.vulnerabilities?.[0]?.cve;
    if (!vuln) return `CVE_DATA: ${cveId} not found in NVD.`;
    const desc = vuln.descriptions?.find(d => d.lang === "en")?.value || "No description";
    const cvss = vuln.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
                 vuln.metrics?.cvssMetricV3?.[0]?.cvssData?.baseScore || "N/A";
    const severity = vuln.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity ||
                     vuln.metrics?.cvssMetricV3?.[0]?.cvssData?.baseSeverity || "N/A";
    return `CVE_DATA for ${cveId}: CVSS Score: ${cvss} (${severity}). ${desc.slice(0, 300)}`;
  } catch {
    return `CVE_DATA: Could not fetch data for ${cveId}.`;
  }
}

/* ── Cloudflare AI call (free tier) ───────────────────────────── */

async function askAI(ai, userMessage, contextData = null) {
  const userContent = contextData
    ? `${contextData}\n\nUser question: ${userMessage}`
    : userMessage;

  const response = await ai.run(CF_AI_MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userContent   },
    ],
    max_tokens: 350,
  });

  return response.response || "I couldn't generate a response. Please try again.";
}

/* ── Main handler ─────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      const url = new URL(request.url);
      if (url.searchParams.get("digest") === "1") {
        const token  = env.TELEGRAM_BOT_TOKEN;
        const chatId = env.TELEGRAM_CHAT_ID;
        const logRes = await fetch("https://raw.githubusercontent.com/Subash107/SubashLamaProfile/main/download-logs/resume-downloads.txt");
        const log    = await logRes.text();
        const lines  = log.split("\n").filter(l => /^\d{4}-\d{2}-\d{2}/.test(l));
        const total  = lines.length;
        const today  = new Date().toISOString().slice(0,10);
        const todayCount = lines.filter(l => l.startsWith(today)).length;
        const last3  = lines.slice(-3).reverse().map(l => {
          const p = l.split("|");
          return "  - " + (p[2]||"").trim() + " / " + (p[3]||"").trim();
        }).join("\n");
        const msg = "📊 Daily Resume Digest - " + today + "\n\nToday    : " + todayCount + " download(s)\nAll time : " + total + " downloads\n\nRecent:\n" + last3 + "\n\n📋 Full log: https://github.com/Subash107/SubashLamaProfile/blob/main/download-logs/resume-downloads.txt";
        await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({chat_id: chatId, text: msg})
        });
        return new Response("Digest sent!", { status: 200 });
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const { message } = await request.json();
      if (!message?.trim()) {
        return new Response(JSON.stringify({ reply: "Please ask me something!" }), {
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      const intent = detectIntent(message);
      let contextData = null;

      /* Fetch external data based on intent */
      if (intent.type === "weather") {
        contextData = await getWeather(intent.data);
      } else if (intent.type === "ip") {
        contextData = await checkIP(intent.data, env.ABUSEIPDB_API_KEY);
      } else if (intent.type === "cve") {
        contextData = await getCVE(intent.data);
      } else if (intent.type === "dns") {
        contextData = await resolveDomain(intent.data);
      } else if (intent.type === "wayback") {
        contextData = await checkWayback(intent.data);
      } else if (intent.type === "sports") {
        contextData = await getSportsPrediction(intent.data);
      }

      const reply = await askAI(env.AI, message, contextData);

      return new Response(JSON.stringify({ reply, intent: intent.type }), {
        status: 200,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ reply: "Sorry, I'm having trouble right now. Please try again shortly." }),
        { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }
  },
};
