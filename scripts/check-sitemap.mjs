#!/usr/bin/env node
/**
 * Vérifie la cohérence de sitemap.xml :
 *  - chaque <loc> correspond à un fichier .html existant sur le disque ;
 *  - chaque page indexable du site (hors 404.html et toute page marquée
 *    <meta name="robots" content="noindex">) apparaît dans le sitemap.
 * Usage : node scripts/check-sitemap.mjs (appelé par `npm run check`)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_URL = 'https://www.mndp-tchad.org';

function listHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function urlToFsPath(loc) {
  const u = new URL(loc);
  if (u.pathname === '/') return path.join(ROOT, 'index.html');
  const segments = decodeURIComponent(u.pathname).replace(/^\//, '').split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  if (last.includes('.')) return path.join(ROOT, ...segments);
  if (segments.length === 1 && segments[0] === 'blog') return path.join(ROOT, 'blog', 'index.html');
  return path.join(ROOT, ...segments) + '.html';
}

function fsPathToUrl(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (rel === 'index.html') return `${SITE_URL}/`;
  if (rel === 'blog/index.html') return `${SITE_URL}/blog`;
  return `${SITE_URL}/${rel.replace(/\.html$/, '')}`;
}

let errors = [];
let checked = 0;

const sitemapPath = path.join(ROOT, 'sitemap.xml');
const xml = fs.readFileSync(sitemapPath, 'utf8');
const locs = new Set();
const locRe = /<loc>([^<]*)<\/loc>/g;
let m;
while ((m = locRe.exec(xml))) {
  checked++;
  const loc = m[1];
  locs.add(loc);
  let fsPath;
  try { fsPath = urlToFsPath(loc); } catch { errors.push(`sitemap.xml: URL invalide → "${loc}"`); continue; }
  if (!fs.existsSync(fsPath)) {
    errors.push(`sitemap.xml: "${loc}" ne correspond à aucun fichier (attendu : ${path.relative(ROOT, fsPath)})`);
  }
}

const SKIP_BASENAMES = new Set(['404.html']);
const files = listHtmlFiles(ROOT).filter(f => !SKIP_BASENAMES.has(path.basename(f)));
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  if (/<meta name="robots" content="[^"]*noindex[^"]*">/.test(html)) continue;
  checked++;
  const url = fsPathToUrl(file);
  if (!locs.has(url)) {
    errors.push(`${path.relative(ROOT, file)}: page indexable absente de sitemap.xml (attendu : "${url}")`);
  }
}

console.log(`Sitemap vérifié : ${checked} correspondance(s) (URL ↔ fichiers, pages indexables ↔ sitemap).`);
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('sitemap.xml cohérent avec le disque et complet. ✔');
