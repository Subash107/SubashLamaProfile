/**
 * Cloudflare Worker — Portfolio Uptime Monitor
 *
 * Runs every 5 minutes via Cron Trigger.
 * Checks if the portfolio site is reachable.
 * Sends Telegram alert when status changes (up→down or down→up).
 * Uses Workers KV to persist last known status between runs.
 *
 * Secrets:
 *   TELEGRAM_BOT_TOKEN — bot token
 *   TELEGRAM_CHAT_ID   — your Telegram user ID
 *
 * KV Binding: UPTIME_KV (namespace for storing status state)
 *
 * Deploy:
 *   npx wrangler deploy uptime-worker.js --config uptime-wrangler.toml
 */

const SITES = [
  { name: "Portfolio",  url: "https://subashlamaprofile.pages.dev" },
  { name: "GitHub",     url: "https://github.com/Subash107"        },
];

const TIMEOUT_MS = 10000;

async function checkSite(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method:  "HEAD",
      signal:  controller.signal,
      headers: { "User-Agent": "UptimeBot/1.0" },
    });
    clearTimeout(timer);
    return { up: res.ok || res.status < 500, status: res.status };
  } catch {
    clearTimeout(timer);
    return { up: false, status: 0 };
  }
}

async function sendTelegram(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text }),
  });
}

export default {
  async scheduled(event, env) {
    const now = new Date().toISOString();

    for (const site of SITES) {
      const { up, status } = await checkSite(site.url);
      const kvKey         = `uptime_${site.name}`;
      const lastStatus    = await env.UPTIME_KV.get(kvKey);
      const wasUp         = lastStatus !== "down";

      /* Only alert on status change */
      if (up && !wasUp) {
        await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID,
          `✅ ${site.name} is BACK ONLINE\n🕐 Time: ${now}\n🔗 ${site.url}`
        );
        await env.UPTIME_KV.put(kvKey, "up");
      } else if (!up && wasUp) {
        await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID,
          `🚨 ${site.name} is DOWN!\n🕐 Time: ${now}\n🔗 ${site.url}\nStatus: ${status || "Timeout"}`
        );
        await env.UPTIME_KV.put(kvKey, "down");
      }
    }
  },

  /* Manual test via GET request */
  async fetch(request, env) {
    const results = await Promise.all(
      SITES.map(async site => {
        const { up, status } = await checkSite(site.url);
        return `${site.name}: ${up ? "✅ UP" : "❌ DOWN"} (${status})`;
      })
    );
    return new Response(results.join("\n"), { status: 200 });
  },
};
