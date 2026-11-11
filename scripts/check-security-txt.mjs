#!/usr/bin/env node
/**
 * Vérifie que .well-known/security.txt (RFC 9116) est présent, bien formé
 * et non expiré (échoue si Expires est dans le passé ou à moins de 30
 * jours, pour laisser le temps de le renouveler).
 * Usage : node scripts/check-security-txt.mjs (appelé par `npm run check`)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, '.well-known', 'security.txt');

let errors = [];

if (!fs.existsSync(FILE)) {
  console.error('.well-known/security.txt introuvable.');
  process.exit(1);
}

const content = fs.readFileSync(FILE, 'utf8');

const contact = content.match(/^Contact:\s*(.+)$/m);
const expires = content.match(/^Expires:\s*(.+)$/m);
const canonical = content.match(/^Canonical:\s*(.+)$/m);
const langs = content.match(/^Preferred-Languages:\s*(.+)$/m);

if (!contact) errors.push('Champ "Contact" manquant.');
if (!canonical) errors.push('Champ "Canonical" manquant.');
if (!langs) errors.push('Champ "Preferred-Languages" manquant.');

if (!expires) {
  errors.push('Champ "Expires" manquant.');
} else {
  const date = new Date(expires[1].trim());
  if (isNaN(date.getTime())) {
    errors.push(`"Expires" n'est pas une date ISO 8601 valide : "${expires[1].trim()}"`);
  } else {
    const daysLeft = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 0) {
      errors.push(`security.txt est expiré depuis ${Math.abs(Math.round(daysLeft))} jour(s) (Expires: ${expires[1].trim()}).`);
    } else if (daysLeft < 30) {
      errors.push(`security.txt expire dans moins de 30 jours (${Math.round(daysLeft)} j.) — à renouveler (Expires: ${expires[1].trim()}).`);
    }
  }
}

console.log('.well-known/security.txt vérifié.');
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) :`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('Présent, bien formé, non expiré. ✔');
