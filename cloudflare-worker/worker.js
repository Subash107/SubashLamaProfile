/**
 * Cloudflare Worker — Resume Download Tracker
 *
 * Receives click event from the portfolio, enriches it with the real visitor IP
 * and geolocation from Cloudflare's built-in request.cf object (no external API
 * needed), then forwards to GitHub Actions via repository_dispatch.
 *
 * Secrets (set via: npx wrangler secret put <NAME> --name lingering-surf-6d77):
 *   GITHUB_PAT  — Fine-grained GitHub PAT with repo dispatch permission
 *
 * Deploy:
 *   cd cloudflare-worker && npx wrangler deploy worker.js
 */

const GITHUB_REPO = "Subash107/SubashLamaProfile";

const ALLOWED_ORIGINS = [
  "https://subashlamaprofile.pages.dev",
  "https://subash107.github.io",
];

/* Your own ISP/org — downloads from these are silently skipped */
const OWNER_ORGS = [
  "VIA NET COMMUNICATION LTD",
  "VIA NET",
];

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    /* CORS preflight */
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    /* Block requests from unknown origins */
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const body = await request.json();

      /* ── Server-side enrichment ── */

      const ip     = request.headers.get("CF-Connecting-IP") || "unknown";
      const cf     = request.cf || {};
      const city   = cf.city           || "";
      const region = cf.region         || "";
      const country= cf.country        || "";
      const org    = cf.asOrganization || "unknown";

      const location = [city, region, country].filter(Boolean).join(", ") || "unknown";

      /* Skip owner's own downloads to avoid false notifications */
      const isOwn = OWNER_ORGS.some(o => org.toUpperCase().includes(o.toUpperCase()));
      if (isOwn) {
        return new Response("OK", { status: 200, headers: corsHeaders(origin) });
      }

      if (body.client_payload) {
        body.client_payload.ip       = ip;
        body.client_payload.location = location;
        body.client_payload.org      = org;
      }

      /* Forward to GitHub Actions via repository_dispatch */
      const ghRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
        {
          method: "POST",
          headers: {
            "Authorization":        `Bearer ${env.GITHUB_PAT}`,
            "Accept":               "application/vnd.github+json",
            "Content-Type":         "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent":           "Resume-Download-Tracker/1.0",
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
