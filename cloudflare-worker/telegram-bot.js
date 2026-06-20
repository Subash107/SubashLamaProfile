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

const GITHUB_REPO  = "Subash107/SubashLamaProfile";
const LOG_PATH     = "download-logs/resume-downloads.txt";
const VERSION      = "1.0.1";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
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
