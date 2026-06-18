/**
 * Cloudflare Pages Function — POST /api/csp-report
 *
 * Receives Content Security Policy violation reports from browsers.
 * Violations are logged to Workers runtime logs and optionally stored in KV.
 *
 * To bind KV: Cloudflare Pages → Settings → Functions → KV namespace bindings
 *   Variable name: CONTACT_KV  →  reuse same KV namespace
 *
 * Update your CSP report-to endpoint to point here instead of the Worker:
 *   Reporting-Endpoints: csp-endpoint="/api/csp-report"
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  let report;
  try {
    const body = await request.json();
    report = body['csp-report'] || body;
  } catch {
    return new Response(null, { status: 204 });
  }

  const enriched = {
    ...report,
    timestamp:   new Date().toISOString(),
    ip:          request.headers.get('CF-Connecting-IP') || 'unknown',
    country:     request.headers.get('CF-IPCountry')     || 'unknown',
    userAgent:   request.headers.get('User-Agent')       || 'unknown',
  };

  // Log to Cloudflare dashboard → Workers → Logs
  const blockedUri = report['blocked-uri'] || report.blockedURI || 'unknown';
  const docUri     = report['document-uri'] || report.documentURI || '';
  console.log(`[csp-violation] ${blockedUri} blocked on ${docUri}`);

  // Store in KV for trend analysis (if bound, expires after 30 days)
  if (env.CONTACT_KV) {
    const key = `csp:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    await env.CONTACT_KV.put(key, JSON.stringify(enriched), {
      expirationTtl: 2592000,
    }).catch(() => {});
  }

  return new Response(null, { status: 204 });
}
