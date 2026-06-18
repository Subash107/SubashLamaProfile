/**
 * Cloudflare Pages Function — POST /api/contact
 *
 * Handles portfolio contact form submissions server-side.
 * - Validates required fields and email format
 * - Checks honeypot to block bots
 * - Rate-limits by IP using KV (if CONTACT_KV is bound)
 * - Stores submission in KV (if CONTACT_KV is bound)
 * - Returns JSON { ok, message } for the client to handle
 *
 * To bind KV: Cloudflare Pages → Settings → Functions → KV namespace bindings
 *   Variable name: CONTACT_KV  →  select or create a KV namespace
 */

const ALLOWED_ORIGINS = [
  'https://subashlamaprofile.pages.dev',
  'http://localhost:8080',
];

const RATE_LIMIT_WINDOW = 3600;  // 1 hour in seconds
const RATE_LIMIT_MAX    = 3;     // max submissions per IP per window

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS — only allow from the portfolio itself
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400);
  }

  const { name = '', email = '', subject = 'General Inquiry', message = '', honey = '' } = body;

  // Honeypot — silent success for bots (they think it worked)
  if (honey) {
    return json({ ok: true, message: 'Message received' });
  }

  // Validate required fields
  const nameT    = name.trim();
  const emailT   = email.trim();
  const messageT = message.trim();

  if (!nameT)    return json({ ok: false, error: 'Name is required' }, 400);
  if (!emailT)   return json({ ok: false, error: 'Email is required' }, 400);
  if (!messageT) return json({ ok: false, error: 'Message is required' }, 400);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailT)) {
    return json({ ok: false, error: 'Enter a valid email address' }, 400);
  }
  if (messageT.length > 5000) {
    return json({ ok: false, error: 'Message too long (max 5000 characters)' }, 400);
  }

  const ip      = request.headers.get('CF-Connecting-IP') || 'unknown';
  const country = request.headers.get('CF-IPCountry')     || 'unknown';

  // Rate limiting via KV (if bound)
  if (env.CONTACT_KV) {
    const rateKey   = `ratelimit:contact:${ip}`;
    const rateRaw   = await env.CONTACT_KV.get(rateKey);
    const rateCount = rateRaw ? parseInt(rateRaw, 10) : 0;

    if (rateCount >= RATE_LIMIT_MAX) {
      return json({ ok: false, error: 'Too many submissions — please try again later' }, 429);
    }

    await env.CONTACT_KV.put(rateKey, String(rateCount + 1), {
      expirationTtl: RATE_LIMIT_WINDOW,
    });
  }

  // Store submission in KV (if bound)
  if (env.CONTACT_KV) {
    const submissionKey = `contact:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;
    await env.CONTACT_KV.put(submissionKey, JSON.stringify({
      name:      nameT,
      email:     emailT,
      subject,
      message:   messageT,
      ip,
      country,
      timestamp: new Date().toISOString(),
    }), {
      expirationTtl: 7776000, // 90 days
    });
  }

  // Log to Cloudflare Workers runtime logs (visible in dashboard)
  console.log(`[contact] New submission from ${nameT} <${emailT}> — ${country}`);

  return json({ ok: true, message: 'Message received — thank you!' });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
