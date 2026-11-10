#!/usr/bin/env node
/**
 * Recalcule les empreintes SHA-256 des blocs JSON-LD et les réinjecte dans
 * la directive script-src de vercel.json. À relancer après toute
 * modification de contenu JSON-LD (nouvel article, nouvelle page...).
 * Usage : node scripts/update-csp.mjs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VERCEL_JSON = path.join(ROOT, 'vercel.json');

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
    // Normalise CRLF -> LF : Vercel sert toujours le fichier tel que committé
    // dans Git (LF), quel que soit le style de fin de ligne du checkout local
    // (CRLF sur Windows). Sans cette normalisation, un bloc JSON-LD multi-
    // ligne calculerait ici une empreinte différente de celle réellement
    // servie, et la CSP bloquerait le script en production.
    const normalized = m[1].replace(/\r\n/g, '\n');
    const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('base64');
    hashes.add(`'sha256-${hash}'`);
  }
}
const sorted = Array.from(hashes).sort();

const json = fs.readFileSync(VERCEL_JSON, 'utf8');
const data = JSON.parse(json);
const cspHeader = data.headers[0].headers.find(h => h.key === 'Content-Security-Policy');
if (!cspHeader) { console.error('En-tête CSP introuvable dans vercel.json'); process.exit(1); }

cspHeader.value = cspHeader.value.replace(
  /script-src 'self'[^;]*;/,
  `script-src 'self' ${sorted.join(' ')};`
);

fs.writeFileSync(VERCEL_JSON, JSON.stringify(data, null, 2) + '\n');
console.log(`vercel.json mis à jour avec ${sorted.length} empreinte(s) JSON-LD.`);
