#!/usr/bin/env node
/**
 * Vérifie qu'aucune page ne saute de niveau de titre (ex. h1 suivi
 * directement d'un h3 sans h2 intermédiaire). Les commentaires HTML sont
 * ignorés. Usage : node scripts/check-headings.mjs (appelé par `npm run check`)
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
  const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));
  checked++;
  let prev = 0;
  for (const level of levels) {
    if (prev !== 0 && level > prev + 1) {
      errors.push(`${rel}: saut de niveau de titre h${prev} → h${level} (séquence : ${levels.join(',')})`);
    }
    prev = level;
  }
}

console.log(`Hiérarchie des titres vérifiée sur ${checked} page(s).`);
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('Aucun saut de niveau de titre détecté. ✔');
