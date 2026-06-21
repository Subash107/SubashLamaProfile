/**
 * Cloudflare Pages Function — Telegram Bot Webhook
 * URL: https://subashlamaprofile.pages.dev/api/bot
 *
 * Handles /stats /latest /log /week /help commands.
 * Uses pages.dev domain which Telegram can resolve (unlike workers.dev).
 *
 * Secrets (set in Cloudflare Pages dashboard → Settings → Environment variables):
 *   TELEGRAM_BOT_TOKEN
 *   GITHUB_READ_TOKEN  (optional — increases GitHub API rate limit)
 */

const GITHUB_REPO = "Subash107/SubashLamaProfile";
const LOG_PATH    = "download-logs/resume-downloads.txt";

export async function onRequestPost(context) {
  const env = context.env;
  try {
    const update = await context.request.json();
    const msg    = update.message || update.edited_message;
    if (!msg?.text) return new Response("OK");

    const chatId  = msg.chat.id;
    const text    = msg.text.trim().split(" ")[0].toLowerCase();
    let reply     = "";

    switch (text) {
      case "/start":
      case "/help":
        reply = "Resume Tracker Bot\n\n/stats  - Total downloads and top countries\n/latest - Most recent download\n/log    - Last 5 downloads\n/week   - This week's count\n/help   - Show this menu";
        break;
      case "/stats":  reply = await getStats(env);  break;
      case "/latest": reply = await getLatest(env); break;
      case "/log":    reply = await getLog(env);    break;
      case "/week":   reply = await getWeek(env);   break;
      default:        reply = "Unknown command. Send /help to see available commands.";
    }

    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, reply);
    return new Response("OK");
  } catch {
    return new Response("OK");
  }
}

export async function onRequestGet(context) {
  return new Response("Telegram Bot Webhook — OK", { status: 200 });
}

async function fetchLog(env) {
  const headers = {};
  if (env.GITHUB_READ_TOKEN) headers["Authorization"] = "Bearer " + env.GITHUB_READ_TOKEN;
  headers["User-Agent"] = "ResumeTrackerBot/1.0";

  const res = await fetch(
    "https://api.github.com/repos/" + GITHUB_REPO + "/contents/" + LOG_PATH,
    { headers }
  );
  if (!res.ok) return [];
  const data    = await res.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return content.split("\n").filter(line => /^\d{4}-\d{2}-\d{2}/.test(line));
}

function parseLine(line) {
  const p = line.split("|").map(s => s.trim());
  return { timestamp: p[0]||"", ip: p[1]||"", location: p[2]||"", org: p[3]||"", os: p[4]||"", browser: p[5]||"", device: p[6]||"" };
}

async function getStats(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet.";
  const countries = {}, companies = {};
  lines.forEach(l => {
    const d = parseLine(l);
    const c = d.location.split(",").pop().trim() || "Unknown";
    countries[c] = (countries[c]||0) + 1;
    companies[d.org||"Unknown"] = (companies[d.org||"Unknown"]||0) + 1;
  });
  const topC = Object.entries(countries).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>"  "+k+": "+v).join("\n");
  const topO = Object.entries(companies).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>"  "+k+": "+v).join("\n");
  return "Resume Download Stats\n\nTotal: " + lines.length + " downloads\n\nTop Countries:\n" + topC + "\n\nTop Companies:\n" + topO;
}

async function getLatest(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet.";
  const d = parseLine(lines[lines.length - 1]);
  return "Latest Download\n\nLocation: " + d.location + "\nCompany:  " + d.org + "\nDevice:   " + d.device + " / " + d.os + " / " + d.browser + "\nIP:       " + d.ip + "\nTime:     " + d.timestamp;
}

async function getLog(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet.";
  return "Last " + Math.min(5, lines.length) + " Downloads\n\n" +
    lines.slice(-5).reverse().map((l, i) => {
      const d = parseLine(l);
      return (i+1) + ". " + d.location + " - " + d.org + "\n   " + d.timestamp;
    }).join("\n\n");
}

async function getWeek(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet.";
  const weekAgo = new Date(Date.now() - 7*864e5).toISOString().slice(0,10);
  const week    = lines.filter(l => parseLine(l).timestamp >= weekAgo);
  return "This Week: " + week.length + " download(s)\n\n" +
    week.reverse().slice(0,5).map(l => {
      const d = parseLine(l);
      return "- " + d.location + " (" + d.timestamp.slice(0,10) + ")";
    }).join("\n");
}

async function sendMessage(token, chatId, text) {
  await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text }),
  });
}
