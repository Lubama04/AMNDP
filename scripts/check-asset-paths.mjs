#!/usr/bin/env node
/**
 * Vérifie que tous les chemins d'assets locaux (href/src/srcset) sont
 * absolus depuis la racine (/assets/...), sur toutes les pages (racine,
 * 404, blog). Échoue sur tout "assets/..." ou "../assets/..." relatif.
 * Usage : node scripts/check-asset-paths.mjs (appelé par `npm run check`)
 */
import fs from 'fs';
import path from 'path';
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

let errors = [];
let checked = 0;

for (const file of listHtmlFiles(ROOT)) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');

  const hrefSrcRe = /(href|src)="((?:\.\.\/)?assets\/[^"]*)"/g;
  let m;
  while ((m = hrefSrcRe.exec(html))) {
    checked++;
    errors.push(`${rel}: ${m[1]} relatif vers un asset local → "${m[2]}" (attendu : /${m[2].replace(/^(\.\.\/)?/, '')})`);
  }

  const srcsetRe = /srcset="([^"]*)"/g;
  while ((m = srcsetRe.exec(html))) {
    for (const candidate of m[1].split(',')) {
      const p = candidate.trim().split(/\s+/)[0];
      checked++;
      if (/^(\.\.\/)?assets\//.test(p)) {
        errors.push(`${rel}: srcset relatif vers un asset local → "${p}" (attendu : /${p.replace(/^(\.\.\/)?/, '')})`);
      }
    }
  }
}

console.log(`Chemins d'assets vérifiés : ${checked} référence(s).`);
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('Tous les chemins d\'assets locaux sont absolus. ✔');
