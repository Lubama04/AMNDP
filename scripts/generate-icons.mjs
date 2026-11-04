#!/usr/bin/env node
// Génère favicon.ico, apple-touch-icon.png et les icônes PWA à partir du logo.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'assets/images/logo-mndp.png');
const OUT = path.join(ROOT, 'assets/images');

// Le logo source a un fond transparent attendu ; sharp conserve l'alpha si présent.
async function png(size, outPath) {
  await sharp(SRC).resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toFile(outPath);
  console.log('  →', path.relative(ROOT, outPath));
}

// Encode un .ico minimal contenant une seule image PNG 32x32 (format "PNG-in-ICO",
// supporté par tous les navigateurs modernes et Windows Vista+).
function buildIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type: icon
  header.writeUInt16LE(1, 4);      // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);  // width (0 = 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1);  // height
  entry.writeUInt8(0, 2);          // color palette
  entry.writeUInt8(0, 3);          // reserved
  entry.writeUInt16LE(1, 4);       // color planes
  entry.writeUInt16LE(32, 6);      // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);  // image data size
  entry.writeUInt32LE(6 + 16, 12); // offset to image data

  return Buffer.concat([header, entry, pngBuffer]);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Logo source introuvable :', SRC);
    process.exit(1);
  }
  await png(180, path.join(OUT, 'apple-touch-icon.png'));
  await png(192, path.join(OUT, 'icon-192.png'));
  await png(512, path.join(OUT, 'icon-512.png'));

  const favPng = await sharp(SRC).resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  fs.writeFileSync(path.join(ROOT, 'favicon.ico'), buildIco(favPng, 32));
  console.log('  → favicon.ico');

  console.log('Terminé. (favicon.svg non généré : le logo source est une image matricielle, pas un vecteur — TODO-CLIENT si une version vectorielle existe.)');
}

main();
