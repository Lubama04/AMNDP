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

const ALLOWED_ORIGIN = 'https://www.mndp-tchad.org';

/** true si l'en-tête Origin est présent ET différent du site officiel. */
export function isForbiddenOrigin(req) {
  const origin = req.headers?.origin;
  return Boolean(origin) && origin !== ALLOWED_ORIGIN;
}

/** true si le champ piège anti-spam (honeypot) a été rempli par un bot. */
export function isHoneypotFilled(body) {
  return Boolean(body && typeof body.website === 'string' && body.website.trim() !== '');
}

class BodyTooLargeError extends Error {}

/**
 * Rejette une requête trop volumineuse AVANT de lire son corps.
 * Sur le runtime Node de Vercel, `req.body` est déjà analysé en objet par la
 * plateforme avant que le handler ne s'exécute : le comptage en flux
 * (`req.on('data', ...)`) ci-dessous n'est alors jamais atteint, et cette
 * garde reposant sur l'en-tête Content-Length devient la seule protection
 * qui s'exécute réellement en production. On vérifie donc :
 *  1. L'en-tête Content-Length, le plus tôt possible (avant toute lecture) ;
 *  2. En repli, la taille réelle de `req.body` une fois déjà analysé par la
 *     plateforme (cas où Content-Length serait absent ou inexact).
 */
export function enforceBodySizeLimit(req) {
  const contentLength = Number(req.headers?.['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new BodyTooLargeError('Corps de requête trop volumineux.');
  }
  if (req.body && typeof req.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_BODY_BYTES) {
      throw new BodyTooLargeError('Corps de requête trop volumineux.');
    }
  } else if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) {
      throw new BodyTooLargeError('Corps de requête trop volumineux.');
    }
  }
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
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
