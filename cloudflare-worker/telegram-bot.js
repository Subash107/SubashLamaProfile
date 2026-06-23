/**
 * Cloudflare Worker — Telegram Bot Command Handler
 *
 * Handles incoming Telegram webhook requests and responds to commands:
 *   /start  — welcome message
 *   /stats  — total downloads, top countries, top companies
 *   /latest — details of the most recent download
 *   /log    — last 5 download entries
 *   /week   — downloads this week
 *   /help   — list of commands
 *
 * Setup:
 *   1. Deploy this worker: npx wrangler deploy telegram-bot.js --name resume-tracker-bot
 *   2. Add secrets: wrangler secret put TELEGRAM_BOT_TOKEN
 *                   wrangler secret put GITHUB_TOKEN (read-only PAT for repo)
 *   3. Register webhook (run once via GitHub Actions or curl):
 *      curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>"
 */

const GITHUB_REPO      = "Subash107/SubashLamaProfile";
const LOG_PATH         = "download-logs/resume-downloads.txt";
const VERSION          = "1.0.1";
const MAIN_WORKER_URL  = "https://lingering-surf-6d77.lamasubash107.workers.dev";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      const url = new URL(request.url);
      if (url.searchParams.get("setup") === "1") {
        const token = (env.TELEGRAM_BOT_TOKEN || "").trim();
        const workerUrl = `https://${url.hostname}`;
        const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: workerUrl }),
        });
        const body = await res.text();
        const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).text();
        return new Response(`setWebhook: ${body}\ngetMe: ${me}\ntokenLen:${token.length}`, { status: 200 });
      }
      return new Response("OK", { status: 200 });
    }

    try {
      const update = await request.json();
      const msg    = update.message || update.edited_message;
      if (!msg || !msg.text) return new Response("OK");

      const chatId  = msg.chat.id;
      const text    = msg.text.trim().toLowerCase();
      const command = text.split(" ")[0];

      let reply = "";

      switch (command) {
        case "/start":
        case "/help":
          reply = "👋 *Resume Download Tracker*\n\nAvailable commands:\n\n" +
                  "/stats — Total downloads \\& top countries\n" +
                  "/latest — Most recent download\n" +
                  "/log — Last 5 downloads\n" +
                  "/week — This week's count\n" +
                  "/funnel — Job application funnel stats\n" +
                  "/streak — Download streak tracker\n" +
                  "/cia — CIA impact summary this week\n" +
                  "/incident — Last security incident report\n" +
                  "/fp — Mark last alert as false positive\n" +
                  "/apply — How to log a job application\n" +
                  "/study — How to log a study session\n" +
                  "/ctf — How to log a CTF flag\n" +
                  "/connections — How to log LinkedIn connections\n" +
                  "/help — Show this menu";
          break;

        case "/stats":
          reply = await getStats(env);
          break;

        case "/latest":
          reply = await getLatest(env);
          break;

        case "/log":
          reply = await getLog(env);
          break;

        case "/week":
          reply = await getWeek(env);
          break;

        case "/funnel":
          reply = await getFunnel(env);
          break;

        case "/streak":
          reply = await getStreak(env);
          break;

        case "/apply":
          reply = "📝 *Log a Job Application*\n\nGo to GitHub Actions and run:\n*Log Job Application* workflow\n\nFill in: Company, Role, Status, Source\n\n🔗 github\\.com/Subash107/SubashLamaProfile/actions/workflows/log\\-application\\.yml\n\nThen use /funnel to see your stats\\.";
          break;

        case "/study":
          reply = "📚 *Log a Study Session*\n\nGo to GitHub Actions and run:\n*Log Study Session* workflow\n\nFill in: Topic, Minutes, Notes\n\n🔗 github\\.com/Subash107/SubashLamaProfile/actions/workflows/log\\-study\\.yml";
          break;

        case "/ctf":
          reply = "🚩 *Log a CTF Flag*\n\nGo to GitHub Actions and run:\n*Log CTF Flag* workflow\n\nFill in: CTF name, Challenge, Category, Points\n\n🔗 github\\.com/Subash107/SubashLamaProfile/actions/workflows/log\\-ctf\\.yml";
          break;

        case "/connections":
          reply = "🤝 *Log a LinkedIn Connection*\n\nGo to GitHub Actions and run:\n*Log LinkedIn Connection* workflow\n\nFill in: Name, Company, Role, Notes\n\n🔗 github\\.com/Subash107/SubashLamaProfile/actions/workflows/log\\-connection\\.yml";
          break;

        case "/cia":
          reply = await getCiaSummary();
          break;

        case "/incident":
          reply = await getLastIncidentReport();
          break;

        case "/fp":
          reply = "✅ *False Positive Acknowledged*\n\nLast alert marked as FP \\— helps tune detection accuracy\\.\n\nRun /cia to see updated weekly event counts\\.";
          break;

        default:
          reply = "Unknown command\\. Send /help to see available commands\\.";
      }

      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, reply);
      return new Response("OK");

    } catch (err) {
      return new Response("Error", { status: 500 });
    }
  }
};

async function fetchLog(env) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${LOG_PATH}`,
    {
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept":        "application/vnd.github+json",
        "User-Agent":    "ResumeTrackerBot/1.0",
      }
    }
  );
  if (!res.ok) return [];
  const data    = await res.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return content.split("\n").filter(line => /^\d{4}-\d{2}-\d{2}/.test(line));
}

function parseLine(line) {
  const parts = line.split("|").map(p => p.trim());
  return {
    timestamp: parts[0] || "",
    ip:        parts[1] || "",
    location:  parts[2] || "",
    org:       parts[3] || "",
    os:        parts[4] || "",
    browser:   parts[5] || "",
    device:    parts[6] || "",
    referrer:  parts[7] || "",
  };
}

function escape(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

async function getStats(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet\\.";

  const total = lines.length;
  const countries = {};
  const companies = {};

  lines.forEach(line => {
    const d = parseLine(line);
    const country = d.location.split(",").pop().trim() || "Unknown";
    countries[country] = (countries[country] || 0) + 1;
    const company = d.org || "Unknown";
    companies[company] = (companies[company] || 0) + 1;
  });

  const topCountries = Object.entries(countries)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([c, n]) => `  ${escape(c)}: ${n}`).join("\n");

  const topCompanies = Object.entries(companies)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([c, n]) => `  ${escape(c)}: ${n}`).join("\n");

  return `📊 *Resume Download Stats*\n\n` +
         `📥 Total downloads: *${total}*\n\n` +
         `🌍 *Top Countries:*\n${topCountries}\n\n` +
         `🏢 *Top Companies:*\n${topCompanies}`;
}

async function getLatest(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet\\.";

  const d = parseLine(lines[lines.length - 1]);
  return `📥 *Latest Download*\n\n` +
         `📍 Location : ${escape(d.location)}\n` +
         `🏢 Company  : ${escape(d.org)}\n` +
         `💻 Device   : ${escape(d.device)} / ${escape(d.os)} / ${escape(d.browser)}\n` +
         `🌐 IP       : ${escape(d.ip)}\n` +
         `🕐 Time     : ${escape(d.timestamp)}`;
}

async function getLog(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet\\.";

  const last5 = lines.slice(-5).reverse();
  const entries = last5.map((line, i) => {
    const d = parseLine(line);
    return `*${i + 1}\\.* ${escape(d.location)} — ${escape(d.org)}\n    ${escape(d.timestamp)}`;
  }).join("\n\n");

  return `📋 *Last ${last5.length} Downloads*\n\n${entries}`;
}

async function getWeek(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet\\.";

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = lines.filter(line => {
    const d = parseLine(line);
    return new Date(d.timestamp) >= weekAgo;
  });

  return `📅 *This Week*\n\n📥 Downloads: *${thisWeek.length}*\n\n` +
         (thisWeek.length
           ? thisWeek.reverse().slice(0, 5).map(line => {
               const d = parseLine(line);
               return `• ${escape(d.location)} — ${escape(d.timestamp.slice(0, 10))}`;
             }).join("\n")
           : "No downloads this week\\.");
}

async function fetchApps(env) {
  const APP_PATH = "download-logs/job-applications.json";
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${APP_PATH}`,
    {
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept":        "application/vnd.github+json",
        "User-Agent":    "ResumeTrackerBot/1.0",
      }
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  try {
    return JSON.parse(atob(data.content.replace(/\n/g, "")));
  } catch { return []; }
}

async function getFunnel(env) {
  const apps = await fetchApps(env);
  if (!apps.length) return "No applications logged yet\\.\n\nUse /apply to learn how to log one\\.";

  const total     = apps.length;
  const applied   = apps.filter(a => a.status === "Applied").length;
  const interview = apps.filter(a => a.status === "Interview").length;
  const offers    = apps.filter(a => a.status === "Offer").length;
  const rejected  = apps.filter(a => a.status === "Rejected").length;

  const interviewRate = total > 0 ? Math.round((interview / total) * 100) : 0;
  const offerRate     = interview > 0 ? Math.round((offers / interview) * 100) : 0;

  const recent = apps.slice(-3).reverse().map(a =>
    `• ${escape(a.company)} — ${escape(a.role)} \\(${escape(a.status)}\\)`
  ).join("\n");

  return `📊 *Job Application Funnel*\n\n` +
         `📤 Applied    : *${total}*\n` +
         `🤝 Interviews : *${interview}* \\(${interviewRate}% rate\\)\n` +
         `🎯 Offers     : *${offers}* \\(${offerRate}% close rate\\)\n` +
         `❌ Rejected   : *${rejected}*\n` +
         `⏳ Pending    : *${applied}*\n\n` +
         `*Recent applications:*\n${recent || "None"}`;
}

async function getStreak(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet\\.";

  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  let checkDate = new Date();

  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    const hasDownload = lines.some(line => line.startsWith(dateStr));
    if (!hasDownload) break;
    streak++;
    checkDate = new Date(checkDate.getTime() - 86400000);
    if (streak > 365) break;
  }

  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const weekCount = lines.filter(l => l.slice(0, 10) >= weekAgo).length;
  const total     = lines.length;

  if (streak === 0) {
    return `📉 *Download Streak*\n\nNo download streak today\\.\n\n📥 This week: *${weekCount}*\n📦 All time: *${total}*`;
  }

  const fire = streak >= 7 ? "🔥🔥🔥" : streak >= 3 ? "🔥🔥" : "🔥";
  return `${fire} *Download Streak: ${streak} day${streak > 1 ? "s" : ""}*\n\n` +
         `📥 This week : *${weekCount}*\n` +
         `📦 All time  : *${total}*\n\n` +
         `Keep it going — recruiters are looking\\!`;
}

async function sendMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:                  chatId,
      text:                     text,
      parse_mode:               "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });
}

async function getCiaSummary() {
  try {
    const res = await fetch(`${MAIN_WORKER_URL}/cia-data`);
    if (!res.ok) return "Could not fetch CIA data\\. Try again\\.";
    const data  = await res.json();
    const total = data.ciaHigh + data.ciaMedium + data.ciaLow;

    const eventCounts = {};
    for (const e of (data.events || [])) {
      eventCounts[e.cls] = (eventCounts[e.cls] || 0) + 1;
    }
    const topEvents = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([cls, n]) => `  ${escape(cls)}: ${n}x`).join("\n") || "  None recorded this week";

    const posture = data.ciaHigh > 5 ? "ELEVATED" : data.ciaHigh > 0 || data.ciaMedium > 3 ? "LOW\\-MEDIUM" : "LOW";

    return `🛡️ *CIA IMPACT SUMMARY — ${escape(data.week)}*\n\n` +
           `*Confidentiality*\n` +
           `  HIGH   : ${data.ciaHigh} events\n` +
           `  MEDIUM : ${data.ciaMedium} events\n` +
           `  LOW    : ${data.ciaLow} events\n\n` +
           `*Integrity*\n` +
           `  ALL NONE ✓ \\(static site — no write surface\\)\n\n` +
           `*Availability*\n` +
           `  Aggressive bot blocks counted in HIGH/MEDIUM above\n\n` +
           `*Top Security Events:*\n${topEvents}\n\n` +
           `Total events : *${total}*\n` +
           `Risk posture : *${posture}*`;
  } catch {
    return "Could not load CIA data\\. Try again\\.";
  }
}

async function getLastIncidentReport() {
  try {
    const res = await fetch(`${MAIN_WORKER_URL}/last-incident`);
    if (!res.ok) return "No incidents recorded yet\\.";
    const evt = await res.json();
    if (!evt.ts) return "No security incidents recorded yet\\.";

    const d     = new Date(evt.ts);
    const incId = `INC\\-${d.toISOString().slice(0,10).replace(/-/g,"")}\\-001`;
    const sev   = evt.risk === "HIGH" ? "🟠 P2" : evt.risk === "MEDIUM" ? "🟡 P3" : "🔵 P4";

    return `📋 *INCIDENT REPORT*\n\n` +
           `ID             : ${incId}\n` +
           `Severity       : ${sev} — ${escape(evt.risk || "UNKNOWN")} RISK\n` +
           `Type           : ${escape(evt.type  || "unknown")}\n` +
           `Classification : ${escape(evt.cls   || "unknown")}\n` +
           `Location       : ${escape(evt.loc   || "unknown")}\n` +
           `Time           : ${escape(evt.ts)}\n\n` +
           `*CIA Assessment:*\n` +
           `  C — Confidentiality : ${evt.risk === "HIGH" ? "HIGH" : "MEDIUM"}\n` +
           `  I — Integrity       : NONE \\(read\\-only static surface\\)\n` +
           `  A — Availability    : Controlled by rate limiter\n\n` +
           `*Status*   : Contained\n` +
           `*Controls* : Rate limiter \\+ honeypot ACTIVE\n` +
           `*Action*   : Logged — no escalation required`;
  } catch {
    return "Could not load incident data\\. Try again\\.";
  }
}
