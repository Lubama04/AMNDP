#!/usr/bin/env node
/**
 * Met à jour les <lastmod> des pages statiques (hors bloc blog, géré par
 * build-blog.cjs) dans sitemap.xml avec la date réelle du dernier commit qui
 * modifie chaque fichier (ou la date du jour si le fichier a des
 * modifications non commitées, puisqu'il sera commité avec cette date).
 * changefreq/priority restent ceux déjà définis dans sitemap.xml.
 * Usage : node scripts/update-sitemap.mjs (appelé par `npm run build:blog`)
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// URL sitemap (hors bloc blog) -> fichier sur le disque.
const PAGES = [
  ['https://www.mndp-tchad.org/', 'index.html'],
  ['https://www.mndp-tchad.org/a-propos', 'a-propos.html'],
  ['https://www.mndp-tchad.org/services', 'services.html'],
  ['https://www.mndp-tchad.org/centres', 'centres.html'],
  ['https://www.mndp-tchad.org/actualites', 'actualites.html'],
  ['https://www.mndp-tchad.org/soutenir', 'soutenir.html'],
  ['https://www.mndp-tchad.org/contact', 'contact.html'],
  ['https://www.mndp-tchad.org/mentions-legales', 'mentions-legales.html'],
  ['https://www.mndp-tchad.org/confidentialite', 'confidentialite.html'],
];

function isDirty(file) {
  try {
    const out = execSync(`git status --porcelain -- "${file}"`, { cwd: ROOT, encoding: 'utf8' });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function lastCommitDate(file) {
  try {
    const out = execSync(`git log -1 --format=%cd --date=short -- "${file}"`, { cwd: ROOT, encoding: 'utf8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function lastmodFor(file) {
  if (isDirty(file)) return todayIso();
  return lastCommitDate(file) || todayIso();
}

function main() {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(sitemapPath, 'utf8');

  for (const [loc, file] of PAGES) {
    const lastmod = lastmodFor(file);
    const urlBlockRe = new RegExp(`(<url>\\s*<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>\\s*<lastmod>)([^<]*)(</lastmod>)`);
    if (urlBlockRe.test(xml)) {
      xml = xml.replace(urlBlockRe, `$1${lastmod}$3`);
    } else {
      console.warn(`  ! URL non trouvée dans sitemap.xml : ${loc}`);
    }
  }

  fs.writeFileSync(sitemapPath, xml);
  console.log('  → sitemap.xml : lastmod des pages statiques mis à jour');
}

main();
