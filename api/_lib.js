import { Resend } from 'resend';

const MAX_BODY_BYTES = 20_000; // largement suffisant pour un formulaire de contact/don

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante dans les variables d\'environnement.');
  }
  return new Resend(apiKey);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Retire les retours à la ligne d'une valeur insérée dans un sujet d'e-mail,
 *  pour empêcher toute tentative d'injection d'en-tête. */
export function stripNewlines(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** true si le champ piège anti-spam (honeypot) a été rempli par un bot. */
export function isHoneypotFilled(body) {
  return Boolean(body && typeof body.website === 'string' && body.website.trim() !== '');
}

class BodyTooLargeError extends Error {}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) throw new BodyTooLargeError('Corps de requête trop volumineux.');
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new BodyTooLargeError('Corps de requête trop volumineux.'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export { BodyTooLargeError };

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquante dans les variables d'environnement.`);
  return value;
}
