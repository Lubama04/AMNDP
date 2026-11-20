#!/usr/bin/env node
/**
 * Teste la logique des handlers api/contact.js et api/donate.js en direct
 * (sans vercel dev, qui est bloqué par une invocation récursive dans cet
 * environnement — voir README.md), avec un faux req/res et des variables
 * d'environnement factices. Ne contacte jamais le vrai Resend (clé fausse).
 * Usage : node scripts/test-api.mjs  (ou npm run test:api)
 */
process.env.RESEND_API_KEY = 're_fake_local_test_key';
process.env.RESEND_FROM_EMAIL = 'onboarding@resend.dev';
process.env.CONTACT_TO_EMAIL = 'test@example.com';
process.env.DONATION_TO_EMAIL = 'test@example.com';

import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function mockReq({ method = 'POST', body = {}, contentType = 'application/json', contentLength, origin }) {
  const bodyStr = JSON.stringify(body);
  const headers = {
    'content-type': contentType,
    'content-length': String(contentLength ?? Buffer.byteLength(bodyStr, 'utf8')),
  };
  if (origin !== undefined) headers.origin = origin;
  return { method, headers, body: bodyStr };
}

function mockRes() {
  const res = {
    statusCode: null,
    jsonBody: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.jsonBody = obj; return this; },
  };
  return res;
}

let failures = 0;
async function expect(label, handlerPath, reqOpts, expectedStatus, expected = {}) {
  const { default: handler } = await import(`file:///${ROOT}/api/${handlerPath}?t=${Date.now()}-${Math.random()}`);
  const req = mockReq(reqOpts);
  const res = mockRes();
  await handler(req, res);
  let pass = res.statusCode === expectedStatus;
  if (pass && expected.error !== undefined) pass = res.jsonBody?.error === expected.error;
  if (pass && expected.field !== undefined) pass = res.jsonBody?.field === expected.field;
  if (!pass) failures++;
  console.log(`${pass ? 'OK  ' : 'FAIL'}  ${label.padEnd(55)} attendu ${expectedStatus}, obtenu ${res.statusCode} ${JSON.stringify(res.jsonBody)}`);
}

console.log('=== api/contact.js ===');
await expect('GET non autorisé', 'contact.js', { method: 'GET' }, 405);
await expect('Origine interdite', 'contact.js', { body: { name: 'A', email: 'a@a.com', message: 'x' }, origin: 'https://evil.example' }, 403, { error: 'Origine non autorisée.' });
await expect('Origine autorisée (même site)', 'contact.js', { body: {}, origin: 'https://www.mndp-tchad.org' }, 400, { field: 'name' });
await expect('Content-Type invalide', 'contact.js', { body: { name: 'x' }, contentType: 'text/plain' }, 415);
await expect('Nom manquant', 'contact.js', { body: {} }, 400, { error: 'Veuillez indiquer votre nom.', field: 'name' });
await expect('Email manquant', 'contact.js', { body: { name: 'Alice' } }, 400, { error: 'Veuillez indiquer votre adresse e-mail.', field: 'email' });
await expect('Message manquant', 'contact.js', { body: { name: 'Alice', email: 'a@a.com' } }, 400, { error: 'Veuillez écrire votre message.', field: 'message' });
await expect('Email invalide', 'contact.js', { body: { name: 'A', email: 'pasunemail', message: 'salut' } }, 400, { error: "L'adresse e-mail saisie n'est pas valide. Exemple : nom@exemple.com.", field: 'email' });
await expect('Honeypot rempli (silencieux)', 'contact.js', { body: { name: 'Bot', email: 'a@a.com', message: 'spam', website: 'http://spam.example' } }, 200);
await expect('Content-Length > 20 Ko (en-tête)', 'contact.js', { body: { name: 'x', email: 'a@a.com', message: 'x' }, contentLength: 30000 }, 413);
await expect('Corps réel > 20 Ko malgré un Content-Length mensonger (repli sur req.body analysé)', 'contact.js', { body: { name: 'x', email: 'a@a.com', message: 'A'.repeat(25000) }, contentLength: 10 }, 413);
await expect('Valide (échoue à l\'envoi réel, clé Resend factice — normal)', 'contact.js', { body: { name: 'Alice', email: 'alice@example.com', message: 'Bonjour' } }, 502, { error: "Votre message n'a pas pu être envoyé. Merci de réessayer ou de nous écrire à contact@mndp-tchad.org." });

console.log('\n=== api/donate.js ===');
await expect('Origine interdite', 'donate.js', { body: { fullName: 'A', email: 'a@a.com', country: 'Tchad', purpose: 'Autre' }, origin: 'https://evil.example' }, 403, { error: 'Origine non autorisée.' });
await expect('Nom manquant', 'donate.js', { body: {} }, 400, { error: 'Veuillez indiquer votre nom.', field: 'fullName' });
await expect('Email manquant', 'donate.js', { body: { fullName: 'Alice' } }, 400, { error: 'Veuillez indiquer votre adresse e-mail.', field: 'email' });
await expect('Pays manquant', 'donate.js', { body: { fullName: 'Alice', email: 'a@a.com' } }, 400, { error: 'Veuillez indiquer votre pays.', field: 'country' });
await expect('Objet du don manquant', 'donate.js', { body: { fullName: 'Alice', email: 'a@a.com', country: 'Tchad' } }, 400, { error: "Veuillez préciser l'objet de votre don.", field: 'purpose' });
await expect('Email invalide', 'donate.js', { body: { fullName: 'Alice', email: 'pasunemail', country: 'Tchad', purpose: 'Autre' } }, 400, { error: "L'adresse e-mail saisie n'est pas valide. Exemple : nom@exemple.com.", field: 'email' });
await expect('Purpose invalide', 'donate.js', { body: { fullName: 'A', email: 'a@a.com', country: 'Tchad', purpose: 'Hack' } }, 400, { field: 'purpose' });
await expect('Consentement manquant', 'donate.js', { body: { fullName: 'A', email: 'a@a.com', country: 'Tchad', purpose: 'Soutien général' } }, 400, { field: 'consent' });
await expect('Honeypot rempli (silencieux)', 'donate.js', { body: { fullName: 'Bot', email: 'a@a.com', country: 'XX', purpose: 'Autre', website: 'spam' } }, 200);
await expect('Content-Length > 20 Ko (en-tête)', 'donate.js', { body: { fullName: 'x' }, contentLength: 30000 }, 413);
await expect('Corps réel > 20 Ko malgré un Content-Length mensonger (repli sur req.body analysé)', 'donate.js', { body: { fullName: 'x', email: 'a@a.com', country: 'Tchad', purpose: 'Autre', message: 'A'.repeat(25000) }, contentLength: 10 }, 413);
await expect('Valide avec consentement (échoue à l\'envoi réel — normal)', 'donate.js', { body: { fullName: 'Alice', email: 'alice@example.com', country: 'Tchad', purpose: 'Soutien général', consent: 'on' } }, 502, { error: "Votre message n'a pas pu être envoyé. Merci de réessayer ou de nous écrire à contact@mndp-tchad.org." });

console.log(`\n${failures === 0 ? 'Tous les tests passent. ✔' : failures + ' test(s) en échec.'}`);
process.exit(failures === 0 ? 0 : 1);
