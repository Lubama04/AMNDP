#!/usr/bin/env node
/**
 * Passe le validateur HTML officiel W3C/WHATWG (Nu Html Checker, vnu-jar)
 * sur toutes les pages HTML (racine, 404, blog), erreurs ET avertissements
 * confondus (--Werror). Nécessite Java 11+ dans le PATH.
 * Usage : node scripts/check-vnu.mjs (appelé par `npm run check:vnu`)
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vnuJarPath = fileURLToPath(new URL('../node_modules/vnu-jar/build/dist/vnu.jar', import.meta.url));

function listHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = listHtmlFiles(ROOT);
console.log(`Validateur Nu : ${files.length} page(s) HTML.`);

// --exit-zero-always : code de sortie 0 côté vnu.jar, on décide nous-mêmes
// de l'échec en relisant le JSON ; --Werror y marque les avertissements
// comme "error". Quand il n'y a rien à signaler, vnu.jar n'écrit rien du
// tout sur stdout (pas même "{\"messages\":[]}") : un stdout vide équivaut
// donc à zéro message — MAIS seulement si le process a réellement tourné
// (exit 0). Un java qui plante avant même de lancer vnu (ex. JVM trop
// ancienne, UnsupportedClassVersionError) produit AUSSI un stdout vide,
// avec sa trace sur stderr : ce cas ne doit jamais être confondu avec un
// "0 message" silencieux, sous peine de masquer un vrai échec de l'outil.
let stdout, launchFailed = false, stderr = '';
try {
  stdout = execFileSync('java', ['-jar', vnuJarPath, '--Werror', '--exit-zero-always', '--format', 'json', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  if (e.code === 'ENOENT') {
    console.error('Java introuvable dans le PATH — impossible de lancer le validateur Nu (nécessite Java 11+).');
    process.exit(1);
  }
  launchFailed = true;
  stdout = e.stdout ? e.stdout.toString() : '';
  stderr = e.stderr ? e.stderr.toString() : '';
}

const trimmed = (stdout || '').trim();
let report = { messages: [] };
if (trimmed) {
  try {
    report = JSON.parse(trimmed);
  } catch {
    console.error('Sortie inattendue du validateur Nu (ni vide, ni JSON valide) :');
    console.error(stderr || trimmed);
    process.exit(1);
  }
} else if (launchFailed) {
  console.error('Le validateur Nu (java -jar vnu.jar) a échoué au lancement (voir ci-dessous).');
  console.error("Nécessite Java 11+ : si la version locale est trop ancienne, la CI fait foi.");
  console.error(stderr.trim() || '(aucune sortie)');
  process.exit(1);
}

if (report.messages && report.messages.length) {
  console.error(`\n${report.messages.length} message(s) du validateur Nu :`);
  for (const m of report.messages) {
    console.error(` - [${m.type}] ${m.url ? path.relative(ROOT, decodeURIComponent(m.url.replace(/^file:/, ''))) : ''}:${m.lastLine || '?'} ${m.message}`);
  }
  process.exit(1);
}
console.log('Validateur Nu : 0 erreur, 0 avertissement. ✔');
