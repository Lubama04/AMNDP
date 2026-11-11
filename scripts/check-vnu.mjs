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

try {
  const out = execFileSync('java', ['-jar', vnuJarPath, '--Werror', '--exit-zero-always', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  console.log(out);
} catch (e) {
  // java introuvable / erreur de lancement (pas une erreur de validation)
  if (e.code === 'ENOENT') {
    console.error('Java introuvable dans le PATH — impossible de lancer le validateur Nu (nécessite Java 11+).');
    process.exit(1);
  }
  // execFileSync met stdout/stderr dans e.stdout/e.stderr quand le process sort en erreur
  const stdout = e.stdout ? e.stdout.toString() : '';
  const stderr = e.stderr ? e.stderr.toString() : '';
  console.log(stdout);
  if (stderr) console.error(stderr);
}

// --exit-zero-always force un code de sortie 0 côté vnu.jar ; on relit sa
// sortie pour décider nous-mêmes de l'échec, --Werror y marque tout en "error".
try {
  const out2 = execFileSync('java', ['-jar', vnuJarPath, '--Werror', '--format', 'json', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const report = JSON.parse(out2);
  if (report.messages && report.messages.length) {
    console.error(`\n${report.messages.length} message(s) du validateur Nu :`);
    for (const m of report.messages) {
      console.error(` - [${m.type}] ${m.url ? path.relative(ROOT, decodeURIComponent(m.url.replace(/^file:/, ''))) : ''}:${m.lastLine || '?'} ${m.message}`);
    }
    process.exit(1);
  }
  console.log('Validateur Nu : 0 erreur, 0 avertissement. ✔');
} catch (e) {
  if (e.code === 'ENOENT') {
    console.error('Java introuvable dans le PATH — impossible de lancer le validateur Nu (nécessite Java 11+).');
    process.exit(1);
  }
  const stdout = e.stdout ? e.stdout.toString() : '';
  let report;
  try { report = JSON.parse(stdout); } catch { report = null; }
  if (report && report.messages && report.messages.length) {
    console.error(`\n${report.messages.length} message(s) du validateur Nu :`);
    for (const m of report.messages) {
      console.error(` - [${m.type}] ${m.url ? path.relative(ROOT, decodeURIComponent(m.url.replace(/^file:/, ''))) : ''}:${m.lastLine || '?'} ${m.message}`);
    }
  } else {
    console.error(e.stderr ? e.stderr.toString() : e.message);
  }
  process.exit(1);
}
