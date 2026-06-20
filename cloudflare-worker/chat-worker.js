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

const CLAUDE_MODEL  = "claude-haiku-4-5-20251001";
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
- Never make up information about Subash that isn't listed above`;

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
  const ipMatch = msg.match(/\b(\d{1,3}\.){3}\d{1,3}\b/);
  const cveMatch = msg.match(/CVE-\d{4}-\d+/i);

  if (ipMatch)                                          return { type: "ip",      data: ipMatch[0] };
  if (cveMatch)                                         return { type: "cve",     data: cveMatch[0] };
  if (/weather|forecast|temperature|rain|sunny|cloudy|humidity/.test(m))
                                                        return { type: "weather", data: extractCity(msg) };
  if (/cricket|football|soccer|match|prediction|win|score|team|league|ipl|npl/.test(m))
                                                        return { type: "sports",  data: msg };
  if (/cve|vulnerability|exploit|malware|threat|hack|breach|zero.?day|ransomware/.test(m))
                                                        return { type: "threats", data: msg };
  return { type: "general", data: null };
}

function extractCity(msg) {
  const m = msg.replace(/weather|in|of|at|for|the|today|tomorrow|forecast|temperature/gi, " ").trim();
  return m.replace(/\s+/g, " ").trim() || "Kathmandu";
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

/* ── Claude API call ──────────────────────────────────────────── */

async function askClaude(apiKey, userMessage, contextData = null) {
  const content = contextData
    ? `${contextData}\n\nUser question: ${userMessage}`
    : userMessage;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 300,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "I couldn't generate a response. Please try again.";
}

/* ── Main handler ─────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

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
      }

      const reply = await askClaude(env.ANTHROPIC_API_KEY, message, contextData);

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
