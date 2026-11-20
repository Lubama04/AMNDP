#!/usr/bin/env node
/**
 * Vérifie qu'une liste de chemins internes/dev ne sont jamais servis
 * publiquement sur un déploiement donné (preview ou production).
 * Usage : node scripts/check-forbidden-paths.mjs <https://deploiement.example>
 * Invocable en CI en lui passant l'URL du déploiement à vérifier.
 */
const base = process.argv[2];
if (!base) {
  console.error('Usage : node scripts/check-forbidden-paths.mjs <url-de-deploiement>');
  process.exit(1);
}

// /api/contact.js et /api/donate.js : chemins avec extension .js qui, sur
// Vercel, invoquent la fonction serverless elle-même plutôt que de servir un
// fichier statique (confirmé sur l'aperçu : 405 "Méthode non autorisée" en
// JSON, jamais le code source). On accepte donc 404, une redirection, ou un
// 4xx renvoyé par la fonction (ex. 405) — seul un 200 avec du JS/texte brut
// serait une fuite de code source.
const FORBIDDEN = [
  '/.github/workflows/check.yml',
  '/.htmlvalidate.json',
  '/SOURCES_IMAGES.md',
  '/package.json',
  '/package-lock.json',
  '/vercel.json',
  '/README.md',
  '/README_BLOG.md',
  '/.env.example',
  '/.git/config',
  '/.gitignore',
  '/scripts/build-blog.cjs',
  '/blog-content/appareillage-orthopedique-appareils-pour-chacun.md',
  '/api/contact.js',
  '/api/donate.js',
];

const API_SOURCE_PATHS = new Set(['/api/contact.js', '/api/donate.js']);

let failures = [];

for (const p of FORBIDDEN) {
  const url = new URL(p, base).toString();
  let status, contentType;
  try {
    const res = await fetch(url, { redirect: 'manual' });
    status = res.status;
    contentType = res.headers.get('content-type') || '';
  } catch (e) {
    failures.push(`${p} : erreur réseau (${e.message})`);
    continue;
  }

  let ok;
  if (API_SOURCE_PATHS.has(p)) {
    // Jamais de code source brut servi : un 200 n'est acceptable que si ce
    // n'est manifestement pas du JS/texte (ex. JSON renvoyé par la fonction).
    const looksLikeSource = contentType.includes('javascript') || contentType.includes('text/plain');
    ok = status !== 200 ? true : !looksLikeSource;
  } else {
    ok = status === 404;
  }

  if (!ok) {
    failures.push(`${p} → HTTP ${status} (${contentType}) — code source potentiellement exposé`);
  } else {
    console.log(`${p} → ${status} ✔`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} chemin(s) interne(s) exposé(s) sur ${base} :`);
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log(`\nAucun chemin interne exposé sur ${base}. ✔`);
