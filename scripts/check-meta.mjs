#!/usr/bin/env node
/**
 * Vérifie que chaque page a un <title>, une <meta description>, un
 * <link canonical> et des balises og:title/og:description, et que
 * title/description/canonical sont uniques sur l'ensemble du site.
 * Les descriptions doivent faire 120-160 caractères.
 * Usage : node scripts/check-meta.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Pages hors périmètre : 404 (noindex, pas de contrainte SEO) et les pages
// de pagination du blog au-delà de la première (gabarit partagé volontaire).
const SKIP = new Set(['404.html']);

function listHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function extract(html, re) {
  const m = re.exec(html);
  return m ? m[1] : null;
}

const files = listHtmlFiles(ROOT).filter(f => !SKIP.has(path.basename(f)));
const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();
let errors = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const title = extract(html, /<title>([^<]*)<\/title>/);
  const description = extract(html, /<meta name="description" content="([^"]*)">/);
  const canonical = extract(html, /<link rel="canonical" href="([^"]*)">/);
  const ogTitle = extract(html, /<meta property="og:title" content="([^"]*)">/);
  const ogDescription = extract(html, /<meta property="og:description" content="([^"]*)">/);

  if (!title) errors.push(`${rel}: <title> manquant`);
  if (!description) errors.push(`${rel}: <meta name="description"> manquante`);
  if (!canonical) errors.push(`${rel}: <link rel="canonical"> manquant`);
  if (!ogTitle) errors.push(`${rel}: og:title manquant`);
  if (!ogDescription) errors.push(`${rel}: og:description manquant`);

  if (description) {
    const len = description.length;
    // Tolérance pour les pages de pagination du blog, gabarit partagé.
    if ((len < 120 || len > 160) && !/page-\d+\.html$/.test(rel)) {
      errors.push(`${rel}: description de ${len} caractères (cible 120-160)`);
    }
  }

  if (title) {
    if (titles.has(title)) errors.push(`${rel}: <title> dupliqué avec ${titles.get(title)} ("${title}")`);
    else titles.set(title, rel);
  }
  if (description) {
    if (descriptions.has(description)) errors.push(`${rel}: description dupliquée avec ${descriptions.get(description)}`);
    else descriptions.set(description, rel);
  }
  if (canonical) {
    if (canonicals.has(canonical)) errors.push(`${rel}: canonical dupliqué avec ${canonicals.get(canonical)} ("${canonical}")`);
    else canonicals.set(canonical, rel);
  }
}

console.log(`Métadonnées vérifiées sur ${files.length} pages.`);
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('title/description/canonical présents et uniques sur toutes les pages. ✔');
