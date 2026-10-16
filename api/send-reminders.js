'use strict';
// Sends DNY reminder pushes to phones.
// The Supabase scheduler calls this once a minute with the subscriptions that are due.
// No dependencies. VAPID signing (RFC 8292) and payload encryption (RFC 8291) use Node's crypto.
//
// Environment variables (set in Vercel, never in the repo):
//   VAPID_PUBLIC   public key, 65 bytes, base64url
//   VAPID_PRIVATE  private key, 32 bytes, base64url
//   CRON_SECRET    shared secret the scheduler sends as a Bearer token
//   VAPID_SUBJECT  optional, a mailto: or https: address for this sender

const crypto = require('crypto');

const MESSAGES = {
  morning: {title: 'Morning check-in', body: 'Your habits for today are ready.', tag: 'dny-morning'},
  evening: {title: 'Evening reflection', body: 'Take a few minutes to reflect on your day.', tag: 'dny-evening'}
};

// Only real browser push services are allowed as targets.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/
];

const b64u = {
  enc: b => Buffer.from(b).toString('base64url'),
  dec: s => Buffer.from(String(s), 'base64url')
};

function hostAllowed(endpoint) {
  let u;
  try { u = new URL(endpoint); } catch (e) { return false; }
  return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some(re => re.test(u.hostname));
}

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function hkdf(salt, ikm, info, len) {
  return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
}

// RFC 8291 aes128gcm. `test` lets the test suite fix the salt and sender key.
function encrypt(payload, p256dh, auth, test) {
  const uaPub = b64u.dec(p256dh);
  const authSecret = b64u.dec(auth);
  if (uaPub.length !== 65 || uaPub[0] !== 4) throw new Error('bad p256dh');
  if (authSecret.length !== 16) throw new Error('bad auth');
  const as = crypto.createECDH('prime256v1');
  if (test && test.asPrivate) as.setPrivateKey(b64u.dec(test.asPrivate));
  else as.generateKeys();
  const asPub = as.getPublicKey();
  const secret = as.computeSecret(uaPub);
  const salt = test && test.salt ? b64u.dec(test.salt) : crypto.randomBytes(16);
  const ikm = hkdf(authSecret, secret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const record = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.concat([salt, Buffer.from([0, 0, 0x10, 0]), Buffer.from([asPub.length]), asPub]);
  return Buffer.concat([header, record]);
}

let KEY_CACHE = null;
function signingKey() {
  const pub = b64u.dec(process.env.VAPID_PUBLIC || '');
  const d = process.env.VAPID_PRIVATE || '';
  if (pub.length !== 65 || !d) throw new Error('VAPID keys missing');
  if (!KEY_CACHE || KEY_CACHE.d !== d || KEY_CACHE.pub !== process.env.VAPID_PUBLIC) {
    KEY_CACHE = {
      d, pub: process.env.VAPID_PUBLIC,
      key: crypto.createPrivateKey({key: {kty: 'EC', crv: 'P-256', x: b64u.enc(pub.subarray(1, 33)), y: b64u.enc(pub.subarray(33)), d}, format: 'jwk'})
    };
  }
  return KEY_CACHE.key;
}

// RFC 8292 header. The token lasts 12 hours, under the 24 hour limit.
function vapidAuth(endpoint, nowSec) {
  const now = nowSec || Math.floor(Date.now() / 1000);
  const head = b64u.enc(JSON.stringify({typ: 'JWT', alg: 'ES256'}));
  const claims = b64u.enc(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: now + 12 * 3600,
    sub: process.env.VAPID_SUBJECT || 'https://dnyapp.vercel.app'
  }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + claims), {key: signingKey(), dsaEncoding: 'ieee-p1363'});
  return 'vapid t=' + head + '.' + claims + '.' + b64u.enc(sig) + ', k=' + process.env.VAPID_PUBLIC;
}

// Habit and prayer reminders carry their own text. Clip it so one bad row cannot send a huge payload.
function customMessage(item) {
  const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  const title = clip(item.title, 80);
  if (!title) return null;
  return {title, body: clip(item.body, 160), tag: clip(item.tag, 64) || 'dny-habit'};
}

async function sendOne(item) {
  const id = item && item.id != null ? String(item.id).slice(0, 64) : null;
  try {
    if (!item || typeof item.endpoint !== 'string' || !hostAllowed(item.endpoint)) return {id, status: 0, error: 'endpoint not allowed'};
    const msg = item.kind === 'custom' ? customMessage(item) : MESSAGES[item.kind];
    if (!msg) return {id, status: 0, error: 'unknown kind'};
    const body = encrypt(Buffer.from(JSON.stringify({title: msg.title, body: msg.body, tag: msg.tag, url: './'})), item.p256dh, item.auth);
    const res = await fetch(item.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuth(item.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '3600',
        Urgency: 'normal'
      },
      body,
      signal: AbortSignal.timeout(8000)
    });
    return {id, status: res.status};
  } catch (e) {
    return {id, status: 0, error: String(e && e.message || e).slice(0, 80)};
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({error: 'method'}); return; }
  const secret = process.env.CRON_SECRET || '';
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(got, secret)) { res.status(401).json({error: 'unauthorized'}); return; }
  const items = req.body && Array.isArray(req.body.items) ? req.body.items : null;
  if (!items || items.length > 500) { res.status(400).json({error: 'items'}); return; }
  try { signingKey(); } catch (e) { res.status(500).json({error: 'server not set up'}); return; }
  const results = [];
  for (let i = 0; i < items.length; i += 20) {
    results.push(...await Promise.all(items.slice(i, i + 20).map(sendOne)));
  }
  const sent = results.filter(r => r.status >= 200 && r.status < 300).length;
  const gone = results.filter(r => r.status === 404 || r.status === 410).map(r => r.id);
  console.log('reminders: ' + sent + ' sent, ' + (results.length - sent) + ' not sent, ' + gone.length + ' expired');
  res.status(200).json({sent, failed: results.length - sent, gone, results});
}

module.exports = handler;
module.exports._test = {encrypt, vapidAuth, hostAllowed, MESSAGES, customMessage};
