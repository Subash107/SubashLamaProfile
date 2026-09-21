/**
 * Cloudflare Pages Function — GET /api/tor-check
 *
 * Same-origin replacement for calling check.torproject.org directly from the
 * browser — that API sends no CORS headers, so the fetch always failed.
 * Reuses the same anonymised-visitor heuristic as cloudflare-worker/worker.js's
 * detectTorVPN(): known Tor/VPN/hosting ASN org-name matches, plus Cloudflare's
 * own bot-management threat score.
 */

const TOR_VPN_ASNS = [
  "AS60729", "AS396507", "AS205100", "AS9009", "AS20473",
  "AS14061", "AS16509", "AS15169", "Tor", "VPN", "Proxy",
];

export async function onRequestGet(context) {
  const { request } = context;
  const org = request.cf?.asOrganization || "";
  const orgUp = org.toUpperCase();

  const isTorVPN = TOR_VPN_ASNS.some(t => orgUp.includes(t.toUpperCase()));
  const isThreat = (request.cf?.botManagement?.score ?? 100) < 30;

  return new Response(JSON.stringify({ IsTor: isTorVPN || isThreat }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': 'https://subashlamaprofile.pages.dev',
    },
  });
}
