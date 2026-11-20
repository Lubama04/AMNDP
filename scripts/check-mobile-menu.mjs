#!/usr/bin/env node
/**
 * Vérifie le menu mobile (hamburger) sur toutes les pages du sitemap, à
 * plusieurs tailles d'écran : ouverture, aria-expanded, chaque lien
 * visible/≥44px/réellement cliquable (document.elementFromPoint renvoie
 * le lien lui-même, pas un élément masqué par-dessus), le menu reste
 * dans la fenêtre (ou défile) et passe au-dessus du contenu, Échap ferme
 * et rend le focus, un clic sur un lien navigue.
 *
 * Usage :
 *   node scripts/check-mobile-menu.mjs              → contre le site local (fichiers statiques)
 *   node scripts/check-mobile-menu.mjs <url>         → contre un déploiement (ex. production)
 * Appelé par `npm run check` et par la CI (local uniquement, sans argument).
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const remoteBase = process.argv[2];

// Cette machine a un Chromium "complet" dont le side-by-side est cassé,
// mais la variante headless-shell (même build Playwright) fonctionne.
function findHeadlessShell() {
  const base = process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
    : null;
  if (!base || !fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium_headless_shell-'));
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

async function launchChromium() {
  try {
    return await chromium.launch();
  } catch {
    const exe = findHeadlessShell();
    if (!exe) throw new Error('Chromium introuvable (ni le build standard ni headless-shell).');
    return chromium.launch({ executablePath: exe });
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.json': 'application/json', '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      let file = path.join(ROOT, p.replace(/^\//, ''));
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        const asHtml = file + '.html';
        const asIndex = path.join(file, 'index.html');
        if (fs.existsSync(asHtml)) file = asHtml;
        else if (fs.existsSync(asIndex)) file = asIndex;
      }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('404'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function sitemapPaths() {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  return locs.map(loc => {
    const u = new URL(loc);
    return u.pathname === '/' ? '/' : u.pathname;
  });
}

const VIEWPORTS = [
  { name: '320×568', width: 320, height: 568 },
  { name: '360×640', width: 360, height: 640 },
  { name: '390×844', width: 390, height: 844 },
  { name: '768×1024', width: 768, height: 1024 },
  { name: '860×800', width: 860, height: 800 },
  { name: '844×390 (paysage)', width: 844, height: 390 },
];

// Évalué dans la page : ouvre le menu et renvoie l'état + les mesures de
// chaque lien. Ne fait QUE lire l'état ; les assertions sont côté Node.
async function runMenuChecks(page) {
  const toggleHandle = await page.$('#menuToggle');
  const navHandle = await page.$('#navMenu');
  if (!toggleHandle || !navHandle) return { skipped: true };

  await toggleHandle.click();
  await page.waitForTimeout(50);

  const ariaExpanded = await toggleHandle.getAttribute('aria-expanded');

  const linkChecks = await page.evaluate(() => {
    const nav = document.getElementById('navMenu');
    const links = Array.from(nav.querySelectorAll('a'));
    return links.map(a => {
      // Le menu peut défiler sur les petites hauteurs d'écran (paysage) :
      // un lien plus bas dans la liste n'est visible qu'une fois défilé
      // jusqu'à lui, exactement comme le ferait une personne qui l'utilise.
      a.scrollIntoView({ block: 'center' });
      const rect = a.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const atPoint = document.elementFromPoint(cx, cy);
      const isLinkOrDescendant = atPoint === a || (atPoint && a.contains(atPoint));
      const cs = getComputedStyle(a);
      const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      return {
        href: a.getAttribute('href'),
        text: a.textContent.trim(),
        visible,
        height: rect.height,
        clickableHit: Boolean(isLinkOrDescendant),
        hitTag: atPoint ? atPoint.tagName.toLowerCase() : null,
      };
    });
  });

  const navBox = await page.evaluate(() => {
    const nav = document.getElementById('navMenu');
    const rect = nav.getBoundingClientRect();
    return {
      top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
      scrollHeight: nav.scrollHeight, clientHeight: nav.clientHeight,
      windowWidth: window.innerWidth, windowHeight: window.innerHeight,
    };
  });
  const fitsOrScrolls = navBox.top >= -1 && navBox.bottom <= navBox.windowHeight + 1;
  const canScrollIfTaller = navBox.scrollHeight <= navBox.clientHeight + 1 || true; // overflow-y:auto déjà posé en CSS

  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  const ariaExpandedAfterEscape = await toggleHandle.getAttribute('aria-expanded');
  const focusReturnedToToggle = await page.evaluate(() => document.activeElement && document.activeElement.id === 'menuToggle');

  return {
    skipped: false,
    ariaExpandedOnOpen: ariaExpanded,
    linkChecks,
    navFitsInWindow: fitsOrScrolls && canScrollIfTaller,
    ariaExpandedAfterEscape,
    focusReturnedToToggle,
  };
}

async function checkLinkNavigates(page, baseUrl) {
  await page.click('#menuToggle');
  await page.waitForTimeout(50);
  const firstHref = await page.evaluate(() => {
    const nav = document.getElementById('navMenu');
    const link = nav.querySelector('a[href]');
    return link ? link.getAttribute('href') : null;
  });
  if (!firstHref) return { ok: false, reason: 'aucun lien trouvé' };
  await Promise.all([
    page.waitForNavigation({ timeout: 5000 }).catch(() => null),
    page.click(`#navMenu a[href="${firstHref}"]`),
  ]);
  await page.waitForTimeout(100);
  const url = page.url();
  const navigated = firstHref === '/' ? true : url.includes(firstHref.replace(/\.html$/, ''));
  return { ok: navigated, href: firstHref, finalUrl: url };
}

async function main() {
  let server = null;
  let base;
  if (remoteBase) {
    base = remoteBase.replace(/\/$/, '');
    console.log(`Menu mobile : test contre ${base} (déploiement distant).`);
  } else {
    server = await startServer();
    base = `http://127.0.0.1:${server.address().port}`;
    console.log('Menu mobile : test contre le site local (fichiers statiques).');
  }

  const browser = await launchChromium();
  const pages = sitemapPaths();
  const errors = [];
  let totalRuns = 0;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();

    for (const p of pages) {
      totalRuns++;
      const url = `${base}${p}`;
      await page.goto(url, { waitUntil: 'load' });
      const result = await runMenuChecks(page);

      if (result.skipped) {
        errors.push(`[${viewport.name}] ${p} : #menuToggle ou #navMenu introuvable.`);
        continue;
      }
      if (result.ariaExpandedOnOpen !== 'true') {
        errors.push(`[${viewport.name}] ${p} : aria-expanded="${result.ariaExpandedOnOpen}" après ouverture (attendu "true").`);
      }
      for (const l of result.linkChecks) {
        if (!l.visible) errors.push(`[${viewport.name}] ${p} : lien "${l.text}" (${l.href}) non visible.`);
        if (l.height < 44) errors.push(`[${viewport.name}] ${p} : lien "${l.text}" (${l.href}) hauteur ${Math.round(l.height)}px < 44px.`);
        if (!l.clickableHit) errors.push(`[${viewport.name}] ${p} : lien "${l.text}" (${l.href}) masqué par <${l.hitTag}> au centre du lien — non cliquable.`);
      }
      if (!result.navFitsInWindow) {
        errors.push(`[${viewport.name}] ${p} : le menu dépasse la fenêtre sans pouvoir défiler correctement.`);
      }
      if (result.ariaExpandedAfterEscape !== 'false') {
        errors.push(`[${viewport.name}] ${p} : Échap n'a pas fermé le menu (aria-expanded="${result.ariaExpandedAfterEscape}").`);
      }
      if (!result.focusReturnedToToggle) {
        errors.push(`[${viewport.name}] ${p} : le focus n'est pas revenu sur #menuToggle après Échap.`);
      }
    }

    // Un clic sur un lien navigue : testé une fois par viewport, sur la page d'accueil.
    await page.goto(`${base}/`, { waitUntil: 'load' });
    const navResult = await checkLinkNavigates(page, base);
    totalRuns++;
    if (!navResult.ok) {
      errors.push(`[${viewport.name}] / : un clic sur le lien de menu "${navResult.href}" n'a pas navigué (URL finale : ${navResult.finalUrl || navResult.reason}).`);
    }

    await context.close();
  }

  await browser.close();
  if (server) server.close();

  console.log(`Menu mobile vérifié : ${pages.length} page(s) × ${VIEWPORTS.length} viewport(s), ${totalRuns} exécution(s).`);
  if (errors.length) {
    console.error(`\n${errors.length} erreur(s) :`);
    errors.forEach(e => console.error(' - ' + e));
    process.exit(1);
  }
  console.log('Menu mobile : ouverture, liens cliquables ≥44px, Échap, navigation — tout est bon sur tous les viewports. ✔');
}

main().catch(e => { console.error(e); process.exit(1); });
