#!/usr/bin/env node
/**
 * Génère les variantes responsives (WebP + repli JPG/PNG) des images du site
 * à partir des originaux conservés dans assets/images/originals/.
 * Usage : node scripts/generate-images.mjs  (alias npm run images)
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORIG = path.join(ROOT, 'assets/images/originals');
const OUT = path.join(ROOT, 'assets/images');

const JOBS = [
  // Logo : fond transparent → WebP + PNG, 'contain' pour garder le ratio exact.
  { src: 'logo-mndp.png', widths: [80, 160], alpha: true, formats: ['webp', 'png'], prefix: 'logo-mndp' },
  // Photo du fondateur : avatar (founder-card, 76px affiché) + usages blog (carte/couverture).
  { src: 'fondateur-michel-guimbaud.jpg', widths: [160, 320], alpha: false, formats: ['webp', 'jpg'], prefix: 'fondateur-michel-guimbaud' },
  { src: 'fondateur-michel-guimbaud.jpg', widths: [800, 1200], alpha: false, formats: ['webp', 'jpg'], prefix: 'fondateur-michel-guimbaud' },
  // Illustration d'accueil : a un canal alpha réel (collage détouré) → WebP + PNG.
  { src: 'illustration-accueil.png', widths: [480, 800, 1200], alpha: true, formats: ['webp', 'png'], prefix: 'illustration-accueil' },
];

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  let report = [];

  for (const job of JOBS) {
    const srcPath = path.join(ORIG, job.src);
    if (!fs.existsSync(srcPath)) { console.error('Original manquant :', srcPath); continue; }

    for (const width of job.widths) {
      for (const format of job.formats) {
        const outName = `${job.prefix}-${width}w.${format}`;
        const outPath = path.join(OUT, outName);
        const isIllustration = job.prefix === 'illustration-accueil';
        let pipeline = sharp(srcPath).resize({ width, withoutEnlargement: true });
        if (format === 'webp') pipeline = pipeline.webp({ quality: isIllustration ? 72 : 82 });
        else if (format === 'png') pipeline = pipeline.png({ quality: isIllustration ? 72 : 82, compressionLevel: 9 });
        else if (format === 'jpg') pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
        await pipeline.toFile(outPath);
        const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
        report.push({ file: outName, kb: Number(kb) });
        console.log(`  → ${outName} (${kb} Ko)`);
      }
    }
  }

  console.log('\nRécapitulatif des poids :');
  const over100 = report.filter(r => r.kb >= 100);
  report.forEach(r => console.log(`  ${r.kb.toString().padStart(7)} Ko  ${r.file}`));
  if (over100.length) {
    console.warn(`\n⚠ ${over100.length} fichier(s) ≥ 100 Ko :`, over100.map(r => r.file).join(', '));
  } else {
    console.log('\nToutes les images générées sont < 100 Ko. ✔');
  }
}

run();
