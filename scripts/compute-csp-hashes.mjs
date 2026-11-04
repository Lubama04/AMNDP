#!/usr/bin/env node
/**
 * Calcule les empreintes SHA-256 de tous les blocs <script type="application/ld+json">
 * du site, pour les ajouter à la directive script-src de la CSP (vercel.json).
 * Nécessaire car le site n'utilise pas de nonce (pages 100% statiques) : la CSP
 * autorise donc chaque bloc JSON-LD par son hash exact plutôt que par 'unsafe-inline'.
 *
 * Usage : node scripts/compute-csp-hashes.mjs
 * → à relancer et à reporter dans vercel.json (script-src) si un contenu
 *   JSON-LD change (texte d'un article, nouvel article, etc.).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function listHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const scriptRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const hashes = new Set();

for (const file of listHtmlFiles(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = scriptRe.exec(html))) {
    const content = m[1];
    const hash = crypto.createHash('sha256').update(content, 'utf8').digest('base64');
    hashes.add(`'sha256-${hash}'`);
  }
}

const sorted = Array.from(hashes).sort();

if (process.argv.includes('--verify')) {
  const vercelJson = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
  const missing = sorted.filter(h => !vercelJson.includes(h));
  if (missing.length) {
    console.error(`${missing.length} empreinte(s) JSON-LD absente(s) de vercel.json (contenu modifié depuis la dernière mise à jour de la CSP) :`);
    missing.forEach(h => console.error(' - ' + h));
    console.error('\nLancer : node scripts/update-csp.mjs');
    process.exit(1);
  }
  console.log(`CSP à jour : les ${sorted.length} empreintes JSON-LD sont toutes présentes dans vercel.json. ✔`);
  process.exit(0);
}

console.log(`${sorted.length} empreinte(s) JSON-LD unique(s) trouvée(s) :\n`);
console.log(sorted.join(' '));
