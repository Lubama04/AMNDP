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

function mockReq({ method = 'POST', body = {}, contentType = 'application/json', contentLength }) {
  const bodyStr = JSON.stringify(body);
  return {
    method,
    headers: {
      'content-type': contentType,
      'content-length': String(contentLength ?? Buffer.byteLength(bodyStr, 'utf8')),
    },
    body: bodyStr,
  };
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
async function expect(label, handlerPath, reqOpts, expectedStatus) {
  const { default: handler } = await import(`file:///${ROOT}/api/${handlerPath}?t=${Date.now()}-${Math.random()}`);
  const req = mockReq(reqOpts);
  const res = mockRes();
  await handler(req, res);
  const pass = res.statusCode === expectedStatus;
  if (!pass) failures++;
  console.log(`${pass ? 'OK  ' : 'FAIL'}  ${label.padEnd(55)} attendu ${expectedStatus}, obtenu ${res.statusCode} ${JSON.stringify(res.jsonBody)}`);
}

console.log('=== api/contact.js ===');
await expect('GET non autorisé', 'contact.js', { method: 'GET' }, 405);
await expect('Content-Type invalide', 'contact.js', { body: { name: 'x' }, contentType: 'text/plain' }, 415);
await expect('Champs manquants', 'contact.js', { body: {} }, 400);
await expect('Email invalide', 'contact.js', { body: { name: 'A', email: 'pasunemail', message: 'salut' } }, 400);
await expect('Honeypot rempli (silencieux)', 'contact.js', { body: { name: 'Bot', email: 'a@a.com', message: 'spam', website: 'http://spam.example' } }, 200);
await expect('Content-Length > 20 Ko (en-tête)', 'contact.js', { body: { name: 'x', email: 'a@a.com', message: 'x' }, contentLength: 30000 }, 413);
await expect('Corps réel > 20 Ko malgré un Content-Length mensonger (repli sur req.body analysé)', 'contact.js', { body: { name: 'x', email: 'a@a.com', message: 'A'.repeat(25000) }, contentLength: 10 }, 413);
await expect('Valide (échoue à l\'envoi réel, clé Resend factice — normal)', 'contact.js', { body: { name: 'Alice', email: 'alice@example.com', message: 'Bonjour' } }, 502);

console.log('\n=== api/donate.js ===');
await expect('Champs manquants', 'donate.js', { body: {} }, 400);
await expect('Purpose invalide', 'donate.js', { body: { fullName: 'A', email: 'a@a.com', country: 'Tchad', purpose: 'Hack' } }, 400);
await expect('Consentement manquant', 'donate.js', { body: { fullName: 'A', email: 'a@a.com', country: 'Tchad', purpose: 'Soutien général' } }, 400);
await expect('Honeypot rempli (silencieux)', 'donate.js', { body: { fullName: 'Bot', email: 'a@a.com', country: 'XX', purpose: 'Autre', website: 'spam' } }, 200);
await expect('Content-Length > 20 Ko (en-tête)', 'donate.js', { body: { fullName: 'x' }, contentLength: 30000 }, 413);
await expect('Corps réel > 20 Ko malgré un Content-Length mensonger (repli sur req.body analysé)', 'donate.js', { body: { fullName: 'x', email: 'a@a.com', country: 'Tchad', purpose: 'Autre', message: 'A'.repeat(25000) }, contentLength: 10 }, 413);
await expect('Valide avec consentement (échoue à l\'envoi réel — normal)', 'donate.js', { body: { fullName: 'Alice', email: 'alice@example.com', country: 'Tchad', purpose: 'Soutien général', consent: 'on' } }, 502);

console.log(`\n${failures === 0 ? 'Tous les tests passent. ✔' : failures + ' test(s) en échec.'}`);
process.exit(failures === 0 ? 0 : 1);
