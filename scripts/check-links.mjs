#!/usr/bin/env node
/**
 * Vérifie les liens internes et les ancres de toutes les pages HTML du site.
 * Usage : node scripts/check-links.mjs  (appelé par `npm run check`)
 * Sort avec un code non nul si un lien interne ou une ancre est cassé.
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

function extractAttr(html, attr) {
  const re = new RegExp(`${attr}="([^"]*)"`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function hasAnchor(html, anchor) {
  if (!anchor) return true;
  const idRe = new RegExp(`\\bid="${anchor}"`);
  const nameRe = new RegExp(`\\bname="${anchor}"`);
  return idRe.test(html) || nameRe.test(html);
}

/** Une URL propre (sans extension) correspond à <path>.html sur le disque,
 *  sauf "/blog" qui correspond à blog/index.html. Les chemins avec extension
 *  (assets, etc.) sont résolus tels quels. */
function cleanUrlToFsPath(absHrefPath) {
  const segments = absHrefPath.replace(/^\//, '').split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  const hasExt = last.includes('.');
  if (hasExt) return path.join(ROOT, ...segments);
  if (segments.length === 1 && segments[0] === 'blog') return path.join(ROOT, 'blog', 'index.html');
  return path.join(ROOT, ...segments) + '.html';
}

function resolveInternalPath(fromFile, hrefPath) {
  if (hrefPath === '' || hrefPath === '/') return path.join(ROOT, 'index.html');
  if (hrefPath.startsWith('/')) return cleanUrlToFsPath(hrefPath);
  return path.resolve(path.dirname(fromFile), hrefPath);
}

const files = listHtmlFiles(ROOT);
const htmlCache = new Map();
const readHtml = (f) => {
  if (!htmlCache.has(f)) htmlCache.set(f, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
  return htmlCache.get(f);
};

function checkLocalFile(rel, file, rawPath, label, errors) {
  if (!rawPath || rawPath.startsWith('data:') || /^https?:\/\//i.test(rawPath)) return;
  const resolved = resolveInternalPath(file, rawPath);
  if (!fs.existsSync(resolved)) {
    errors.push(`${rel}: ${label} cassé → "${rawPath}" (fichier introuvable : ${path.relative(ROOT, resolved)})`);
  }
}

let errors = [];
let checked = 0;

for (const file of files) {
  const html = readHtml(file);
  const rel = path.relative(ROOT, file);
  const hrefs = extractAttr(html, 'href');

  for (const src of extractAttr(html, 'src')) {
    checked++;
    checkLocalFile(rel, file, src, 'src', errors);
  }
  for (const srcset of extractAttr(html, 'srcset')) {
    for (const candidate of srcset.split(',')) {
      const p = candidate.trim().split(/\s+/)[0];
      checked++;
      checkLocalFile(rel, file, p, 'srcset', errors);
    }
  }

  for (const href of hrefs) {
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }
    if (href === '#') {
      errors.push(`${rel}: lien mort href="#" (sans ancre ni data-filter)`);
      continue;
    }

    let targetUrl = href;
    let isSiteAbsolute = false;
    try {
      if (/^https?:\/\//i.test(href)) {
        const u = new URL(href);
        if (!SITE_HOSTS.has(u.hostname)) continue; // lien externe : non vérifié ici
        targetUrl = u.pathname + (u.hash || '');
        isSiteAbsolute = true;
      }
    } catch { continue; }

    if (targetUrl.startsWith('#')) {
      checked++;
      if (!hasAnchor(html, targetUrl.slice(1))) errors.push(`${rel}: ancre manquante "${targetUrl}" dans la même page`);
      continue;
    }

    const [rawPath, anchor] = targetUrl.split('#');
    const fromFile = isSiteAbsolute ? path.join(ROOT, 'index.html') : file;
    const resolved = resolveInternalPath(fromFile, rawPath);
    checked++;
    const targetHtml = readHtml(resolved);
    if (targetHtml === null) {
      errors.push(`${rel}: lien interne cassé → "${href}" (fichier introuvable : ${path.relative(ROOT, resolved)})`);
      continue;
    }
    if (anchor && !hasAnchor(targetHtml, anchor)) {
      errors.push(`${rel}: ancre "#${anchor}" introuvable dans ${path.relative(ROOT, resolved)} (lien "${href}")`);
    }
  }
}

console.log(`Liens internes vérifiés : ${checked} (sur ${files.length} pages HTML)`);
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('Aucun lien interne cassé. ✔');
