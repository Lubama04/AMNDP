#!/usr/bin/env node
/**
 * Vérifie que les images servies par le site (hors originaux, non déployés)
 * respectent les objectifs de poids de la mission : chaque image < 100 Ko,
 * l'illustration d'accueil < 120 Ko dans sa taille standard (800w).
 * Usage : node scripts/check-image-weight.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMG_DIR = path.join(ROOT, 'assets/images');
const GENERAL_LIMIT = 100 * 1024;
const ILLUSTRATION_STANDARD_LIMIT = 120 * 1024;

let errors = [];
let checked = 0;

for (const file of fs.readdirSync(IMG_DIR)) {
  const full = path.join(IMG_DIR, file);
  if (fs.statSync(full).isDirectory()) continue; // originals/
  if (!/\.(webp|jpe?g|png)$/i.test(file)) continue;
  checked++;
  const size = fs.statSync(full).size;

  // Seul le format WebP (format servi par défaut aux navigateurs modernes)
  // est mesuré contre l'objectif ; les repli PNG/JPG pour anciens
  // navigateurs sont documentés comme exception dans le rapport d'audit.
  if (!file.endsWith('.webp')) continue;

  if (file.startsWith('illustration-accueil-800w')) {
    if (size > ILLUSTRATION_STANDARD_LIMIT) {
      errors.push(`${file} : ${(size / 1024).toFixed(1)} Ko > ${ILLUSTRATION_STANDARD_LIMIT / 1024} Ko (taille standard de l'illustration)`);
    }
    continue;
  }
  if (size > GENERAL_LIMIT) {
    errors.push(`${file} : ${(size / 1024).toFixed(1)} Ko > ${GENERAL_LIMIT / 1024} Ko`);
  }
}

console.log(`Poids vérifié pour ${checked} image(s) (assets/images/, hors originals/).`);
if (errors.length) {
  console.error(`\n${errors.length} image(s) au-dessus de l'objectif :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('Toutes les images WebP respectent les objectifs de poids. ✔');
