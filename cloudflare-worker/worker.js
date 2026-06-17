/**
 * Cloudflare Worker — Resume Download Tracker
 * Receives device info from the portfolio and forwards to GitHub Actions.
 * The GitHub PAT is stored as a Cloudflare Secret (env.GITHUB_PAT) — never in browser code.
 *
 * Setup:
 *   1. Deploy this file to Cloudflare Workers (workers.cloudflare.com)
 *   2. Add secret: wrangler secret put GITHUB_PAT  → paste your Fine-Grained PAT
 *   3. Copy the Worker URL → paste into site.js TRACKER_URL
 */

const GITHUB_REPO = "Subash107/SubashLamaProfile";
const ALLOWED_ORIGIN = "https://subash107.github.io";

export default {
  async fetch(request, env) {

    /* CORS preflight */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();

      /* Forward to GitHub Actions via repository_dispatch */
      const ghRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.GITHUB_PAT}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Resume-Download-Tracker/1.0"
          },
          body: JSON.stringify(body)
        }
      );

      return new Response(ghRes.ok ? "OK" : "GitHub error", {
        status: ghRes.ok ? 200 : 502,
        headers: { "Access-Control-Allow-Origin": "*" }
      });

    } catch (err) {
      return new Response("Worker error", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
