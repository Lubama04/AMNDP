#!/usr/bin/env node
/**
 * Vérifie le contraste WCAG 2.2 AA des principales paires texte/fond
 * utilisées par assets/style.css et assets/blog.css.
 * Seuils : 4.5:1 texte normal, 3:1 grand texte (≥24px, ou ≥18.66px gras) et UI.
 * Usage : node scripts/check-contrast.mjs
 */

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hex1, hex2) {
  const L1 = luminance(hexToRgb(hex1));
  const L2 = luminance(hexToRgb(hex2));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

// Paires réellement utilisées dans le CSS (fg, bg, seuil requis, description)
const PAIRS = [
  ['#000000', '#FFFFFF', 4.5, 'texte courant (body) noir sur blanc'],
  ['#1F4FA8', '#FFFFFF', 4.5, 'liens (--blue-deep) sur blanc'],
  ['#4F86E5', '#FFFFFF', 3.0, 'grands titres h1/h2/.stat-num (--blue, ≥18.66px gras) sur blanc'],
  ['#000000', '#4F86E5', 4.5, 'texte des boutons .btn-primary (noir sur --blue)'],
  ['#595959', '#FFFFFF', 4.5, 'texte secondaire (--gray) sur blanc'],
  ['#595959', '#F5F8FF', 4.5, 'texte secondaire (--gray) sur fond doux (--bg-soft)'],
  ['#1F4FA8', '#F5F8FF', 4.5, 'eyebrow/liens (--blue-deep) sur fond doux'],
  ['#F2D34B', '#000000', 4.5, 'liens réseaux sociaux (--yellow, .78rem texte) sur pied de page noir'],
  ['#CFCFCF', '#000000', 4.5, 'texte du pied de page (#CFCFCF) sur noir'],
  ['#9A9A9A', '#000000', 4.5, 'mentions légales du pied de page (.footer-bottom, #9a9a9a) sur noir'],
  ['#B3273E', '#FBE7EB', 4.5, 'message d\'erreur de formulaire (--error) sur fond --error clair'],
  ['#2F6B4F', '#E7F0EA', 4.5, 'message de succès de formulaire (--green) sur fond --green clair'],
  ['#B3273E', '#F3C3CC', 3.0, 'bordure/texte "closed" centre fermé (--error) sur fond associé'],
  // Paires corrigées lors de cet audit (texte/bouton blanc sur --blue → --blue-deep)
  ['#1F4FA8', '#FFFFFF', 4.5, 'titres de cartes (pillar/service/teaser/news, --blue-deep) sur blanc'],
  ['#FFFFFF', '#1F4FA8', 4.5, 'texte des boutons/badges blancs sur --blue-deep (ex. .blog-btn-primary, .news-card .tag)'],
  ['#000000', '#F2D34B', 4.5, 'badge de catégorie du blog (--b-black) sur --b-yellow'],
];

let failures = 0;
console.log('Contrôle de contraste WCAG 2.2 AA\n');
for (const [fg, bg, min, desc] of PAIRS) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= min;
  if (!pass) failures++;
  console.log(`${pass ? 'OK  ' : 'FAIL'}  ${ratio.toFixed(2)}:1 (seuil ${min}:1)  — ${desc} [${fg} / ${bg}]`);
}

console.log(`\n${PAIRS.length - failures}/${PAIRS.length} paires conformes.`);
if (failures) {
  console.error(`${failures} paire(s) en échec.`);
  process.exit(1);
}
