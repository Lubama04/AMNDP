#!/usr/bin/env node
/**
 * Audit de contraste WCAG 2.2 AA exhaustif : charge chaque page dans
 * Chromium (Playwright) et calcule, pour CHAQUE élément de texte
 * effectivement visible, le contraste réel entre sa couleur de texte et
 * son arrière-plan effectif (en remontant les ancêtres), puis échoue sous
 * le seuil (4.5:1, ou 3:1 pour un texte ≥24px ou ≥18.66px en gras).
 * Complète scripts/check-contrast.mjs (liste de paires maintenue à la
 * main) en ne laissant passer aucune combinaison oubliée.
 * Usage : node scripts/check-contrast-playwright.mjs (appelé par `npm run check`)
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Cette machine a un Chromium "complet" dont le side-by-side est cassé,
// mais la variante headless-shell (même build Playwright) fonctionne.
// Si le lancement standard échoue, on retombe dessus sans rien réinstaller.
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

function listHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Fonction évaluée dans la page : retourne la liste des violations.
function scanPageForContrastIssues() {
  function parseRgb(str) {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(s => parseFloat(s.trim()));
    const [r, g, b, a = 1] = parts;
    return { r, g, b, a };
  }
  function relLuminance({ r, g, b }) {
    const toLin = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  }
  function contrastRatio(c1, c2) {
    const l1 = relLuminance(c1);
    const l2 = relLuminance(c2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  function blend(fg, bg) {
    if (fg.a >= 1) return fg;
    const a = fg.a;
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1,
    };
  }
  function effectiveBackground(el) {
    let node = el;
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const chain = [];
    while (node) {
      const cs = getComputedStyle(node);
      const c = parseRgb(cs.backgroundColor);
      if (c && c.a > 0) chain.unshift(c);
      node = node.parentElement;
    }
    for (const c of chain) bg = blend(c, bg);
    return bg;
  }
  function isVisuallyHidden(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 && rect.height <= 1) return true; // motif .sr-only
    if (cs.clipPath === 'inset(50%)' || /rect\(/.test(cs.clip || '')) return true;
    if (el.closest('[aria-hidden="true"]')) return true;
    return false;
  }

  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (isVisuallyHidden(el)) continue;
    const cs = getComputedStyle(el);
    const fg = parseRgb(cs.color);
    if (!fg) continue;
    const bg = effectiveBackground(el);
    const fgBlended = blend(fg, bg);
    const ratio = contrastRatio(fgBlended, bg);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const threshold = isLarge ? 3.0 : 4.5;
    if (ratio < threshold - 0.005) {
      results.push({
        text: n.nodeValue.trim().slice(0, 40),
        tag: el.tagName.toLowerCase(),
        className: el.className && typeof el.className === 'string' ? el.className : '',
        ratio: Math.round(ratio * 100) / 100,
        threshold,
        fontSize: Math.round(fontSize),
        fontWeight,
        color: cs.color,
        background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      });
    }
  }
  return results;
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const browser = await launchChromium();
  const page = await browser.newPage();

  const files = listHtmlFiles(ROOT).filter(f => path.basename(f) !== '404.html' || true);
  let totalChecked = 0;
  const errors = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const urlPath = rel === 'index.html' ? '/' : '/' + rel;
    await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'load' });
    const issues = await page.evaluate(scanPageForContrastIssues);
    totalChecked++;
    for (const issue of issues) {
      errors.push(`${rel}: "${issue.text}" (<${issue.tag} class="${issue.className}">) → ${issue.ratio}:1 (seuil ${issue.threshold}:1, ${issue.fontSize}px/${issue.fontWeight}) [${issue.color} sur ${issue.background}]`);
    }
  }

  await browser.close();
  server.close();

  console.log(`Contraste (Playwright) vérifié sur ${totalChecked} page(s), tous les éléments de texte visibles.`);
  if (errors.length) {
    console.error(`\n${errors.length} erreur(s) :`);
    errors.forEach(e => console.error(' - ' + e));
    process.exit(1);
  }
  console.log('Aucun texte visible sous le seuil WCAG 2.2 AA. ✔');
}

main().catch(e => { console.error(e); process.exit(1); });
