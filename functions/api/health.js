/**
 * Cloudflare Pages Function — GET /api/health
 *
 * Returns real-time site health information including:
 * - Cloudflare data centre (PoP) serving the request
 * - Request country and IP
 * - Current timestamp
 *
 * Used by the portfolio's security analytics section.
 * Also useful for uptime monitors.
 */

export async function onRequestGet(context) {
  const { request } = context;

  const cfRay     = request.headers.get('CF-Ray')          || '';
  const country   = request.headers.get('CF-IPCountry')    || 'unknown';
  const ip        = request.headers.get('CF-Connecting-IP')|| 'unknown';
  const datacenter = cfRay.split('-')[1] || 'unknown';

  return new Response(JSON.stringify({
    ok:          true,
    site:        'subashlamaprofile.pages.dev',
    timestamp:   new Date().toISOString(),
    datacenter,
    country,
    ip,
    cfRay,
    tls:         request.cf?.tlsVersion || 'unknown',
    httpVersion: request.cf?.httpProtocol || 'unknown',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': 'https://subashlamaprofile.pages.dev',
    },
  });
}
