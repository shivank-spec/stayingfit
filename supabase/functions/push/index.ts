// Stayingfit notification sender (Supabase Edge Function "push").
// The database calls this after a new chat message or photo comment. It asks the database who should be told,
// then sends a standard Web Push (RFC 8030, 8291, 8292) to each of their phones. No outside libraries.
const SUBJECT = 'https://shivank-spec.github.io/stayingfit/';
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const hkdf = async (salt, ikm, info, len) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info },
  await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));

// a fresh signing key pair for this app; the private half is stored only in the database
export async function makeVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { publicKey: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
}

// "Authorization" header that proves to the push service which app is sending
export async function vapidAuth(endpoint, publicKey, privateJwk, subject = SUBJECT) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y, d: privateJwk.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + publicKey;
}

// encrypt the message so only that one phone can read it (aes128gcm)
export async function encryptPayload(payload, p256dh, auth) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []) }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const text = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(payload, new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic, text);
}

export async function sendOne(sub, payload, publicKey, privateJwk) {
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: await vapidAuth(sub.endpoint, publicKey, privateJwk), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' },
      body: await encryptPayload(payload, sub.p256dh, sub.auth)
    });
    return res.status;
  } catch (_e) { return 0; }
}

// the database only answers this function's own keys; projects differ in which kind of key they issue
let goodKey = null;
function keys() {
  const out = [], legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), fresh = (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/g) || [];
  if (goodKey) out.push(goodKey);
  for (const k of [...fresh, legacy]) if (k && out.indexOf(k) < 0) out.push(k);
  return out;
}
async function rpc(name, args) {
  let last = 0;
  for (const key of keys()) {
    const res = await fetch(Deno.env.get('SUPABASE_URL') + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (res.ok) { goodKey = key; return await res.json(); }
    last = res.status; await res.body?.cancel();
    if (last !== 401 && last !== 403) break;
  }
  throw new Error(name + ' ' + last);
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function handle(req) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const secret = req.headers.get('x-hook-secret') || '';
  let b; try { b = await req.json(); } catch (_e) { return json({ error: 'bad request' }, 400); }
  try {
    if (b.init) {
      let pub = await rpc('push_set_vapid', { p_secret: secret, p_public: null, p_private: null });
      if (!pub) { const k = await makeVapidKeys(); pub = await rpc('push_set_vapid', { p_secret: secret, p_public: k.publicKey, p_private: k.privateJwk }); }
      return json({ ok: true, ready: !!pub });
    }
    const job = await rpc('push_job', { p_secret: secret, p_kind: String(b.kind || ''), p_id: b.id });
    const subs = job.subs || [];
    if (!subs.length || !job.vapid_public || !job.vapid_private) return json({ ok: true, sent: 0, phones: subs.length });
    const payload = enc.encode(JSON.stringify({ title: job.title, body: job.body, url: job.url, tag: job.tag }));
    const codes = await Promise.all(subs.map((s) => sendOne(s, payload, job.vapid_public, job.vapid_private)));
    const gone = subs.filter((_s, i) => codes[i] === 404 || codes[i] === 410).map((s) => s.endpoint);
    if (gone.length) await rpc('push_gone', { p_secret: secret, p_endpoints: gone });
    return json({ ok: true, sent: codes.filter((c) => c >= 200 && c < 300).length, phones: subs.length, codes });
  } catch (e) {
    return json({ error: 'not allowed', step: String((e && e.message) || '').slice(0, 40) }, 403);
  }
}
if (typeof Deno !== 'undefined') Deno.serve(handle);
