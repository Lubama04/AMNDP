#!/usr/bin/env node
/**
 * Vérifie que les URL propres (sans .html) sont utilisées partout :
 *  - aucun href interne, canonical, og:url ou champ JSON-LD (url/@id/item/
 *    mainEntityOfPage) ne contient plus ".html" en référence à une page du
 *    site (les fichiers externes, comme l'iframe OpenStreetMap, sont ignorés) ;
 *  - chaque <loc> de sitemap.xml correspond à un fichier .html réel sur le
 *    disque et ne contient pas ".html".
 * Usage : node scripts/check-clean-urls.mjs (appelé par `npm run check`)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_HOSTS = new Set(['mndp-tchad.org', 'www.mndp-tchad.org']);

function listHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function cleanUrlToFsPath(absHrefPath) {
  const segments = absHrefPath.replace(/^\//, '').split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  const hasExt = last.includes('.');
  if (hasExt) return path.join(ROOT, ...segments);
  if (segments.length === 1 && segments[0] === 'blog') return path.join(ROOT, 'blog', 'index.html');
  return path.join(ROOT, ...segments) + '.html';
}

let errors = [];
let checked = 0;

/* ---- 1. Aucun .html dans les href internes / canonical / og:url / JSON-LD ---- */

const files = listHtmlFiles(ROOT);

function flagIfInternalHtml(rel, label, value, errors) {
  if (!value) return;
  if (/^(mailto:|tel:|javascript:|data:|#)/.test(value)) return;
  let pathPart = value;
  if (/^https?:\/\//i.test(value)) {
    let u;
    try { u = new URL(value); } catch { return; }
    if (!SITE_HOSTS.has(u.hostname)) return; // lien externe (ex. OpenStreetMap, réseaux sociaux)
    pathPart = u.pathname;
  }
  if (/\.html(#|\?|$)/.test(pathPart)) {
    errors.push(`${rel}: ${label} contient encore ".html" → "${value}"`);
  }
}

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  const hrefRe = /href="([^"]*)"/g;
  let m;
  while ((m = hrefRe.exec(html))) { checked++; flagIfInternalHtml(rel, 'href', m[1], errors); }

  const contentRe = /property="og:url"\s+content="([^"]*)"/g;
  while ((m = contentRe.exec(html))) { checked++; flagIfInternalHtml(rel, 'og:url', m[1], errors); }

  // Champs JSON-LD référençant une page du site.
  const ldFieldRe = /"(?:url|@id|item|mainEntityOfPage)":"([^"]*)"/g;
  while ((m = ldFieldRe.exec(html))) { checked++; flagIfInternalHtml(rel, 'JSON-LD', m[1], errors); }
}

/* ---- 2. sitemap.xml : chaque <loc> existe sur le disque, sans .html ---- */

const sitemapPath = path.join(ROOT, 'sitemap.xml');
const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
const locRe = /<loc>([^<]*)<\/loc>/g;
let m;
while ((m = locRe.exec(sitemapXml))) {
  checked++;
  const loc = m[1];
  if (/\.html(#|\?|$)/.test(loc)) {
    errors.push(`sitemap.xml: URL contient encore ".html" → "${loc}"`);
    continue;
  }
  let u;
  try { u = new URL(loc); } catch { errors.push(`sitemap.xml: URL invalide → "${loc}"`); continue; }
  if (!SITE_HOSTS.has(u.hostname)) { errors.push(`sitemap.xml: hôte inattendu → "${loc}"`); continue; }
  const fsPath = u.pathname === '/' ? path.join(ROOT, 'index.html') : cleanUrlToFsPath(u.pathname);
  if (!fs.existsSync(fsPath)) {
    errors.push(`sitemap.xml: "${loc}" ne correspond à aucune page (attendu : ${path.relative(ROOT, fsPath)})`);
  }
}

console.log(`URL propres vérifiées : ${checked} référence(s) (hrefs, og:url, JSON-LD, sitemap).`);
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('Aucune URL interne en ".html" ; sitemap.xml cohérent avec le disque. ✔');
