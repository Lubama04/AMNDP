#!/usr/bin/env node
// Génère assets/images/og-image.jpg (1200×630, < 300 Ko) à partir de
// l'illustration d'accueil (recadrée) + le logo, pour og:image/twitter:image.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ILLUSTRATION = path.join(ROOT, 'assets/images/originals/illustration-accueil.png');
const LOGO = path.join(ROOT, 'assets/images/originals/logo-mndp.png');
const OUT = path.join(ROOT, 'assets/images/og-image.jpg');

async function main() {
  const W = 1200, H = 630;
  const background = await sharp(ILLUSTRATION)
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .toBuffer();

  // Carte blanche arrondie en bas à gauche portant le logo, pour la lisibilité
  // quelle que soit la photo en fond.
  const cardW = 220, cardH = 110, margin = 36;
  const cardSvg = Buffer.from(
    `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${cardW}" height="${cardH}" rx="16" fill="#FFFFFF" fill-opacity="0.94"/>
    </svg>`
  );
  const logoBuf = await sharp(LOGO).resize({ height: 72 }).toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();

  await sharp(background)
    .composite([
      { input: cardSvg, left: margin, top: H - margin - cardH },
      { input: logoBuf, left: margin + Math.round((cardW - logoMeta.width) / 2), top: H - margin - cardH + Math.round((cardH - logoMeta.height) / 2) },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(OUT);

  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`→ assets/images/og-image.jpg (${W}×${H}, ${kb} Ko)`);
}

main();
