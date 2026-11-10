#!/usr/bin/env node
/**
 * Vérifie que vercel.json déclare les en-têtes de sécurité et de cache
 * attendus. Contrôle statique du fichier de config (pas une requête HTTP :
 * voir la vérification finale en local avec `vercel dev` / le serveur de
 * prévisualisation pour une vérification en conditions réelles).
 * Usage : node scripts/check-headers.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REQUIRED_KEYS = [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
  'Cross-Origin-Opener-Policy',
  'Content-Security-Policy',
];

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const globalBlock = (data.headers || []).find(h => h.source === '/(.*)');
let errors = [];

if (!globalBlock) {
  errors.push(`Aucun bloc "headers" avec source "/(.*)" dans vercel.json`);
} else {
  const keys = new Set(globalBlock.headers.map(h => h.key));
  for (const required of REQUIRED_KEYS) {
    if (!keys.has(required)) errors.push(`En-tête manquant sur "/(.*)" : ${required}`);
  }
  const csp = globalBlock.headers.find(h => h.key === 'Content-Security-Policy');
  if (csp && !csp.value.includes("object-src 'none'")) {
    errors.push(`CSP : object-src 'none' manquant`);
  }
  if (csp && !csp.value.includes("frame-ancestors 'none'")) {
    errors.push(`CSP : frame-ancestors 'none' manquant`);
  }
}

const assetsBlock = (data.headers || []).find(h => h.source === '/assets/(.*)');
if (!assetsBlock || !assetsBlock.headers.some(h => h.key === 'Cache-Control' && /immutable/.test(h.value))) {
  errors.push(`Cache-Control immutable manquant pour /assets/(.*)`);
}

console.log('En-têtes vérifiés dans vercel.json.');
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('Tous les en-têtes requis sont présents. ✔');
