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

// /api/donate.js : redirection ou 404 acceptés, mais jamais 200 (code source brut).
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

let failures = [];

for (const p of FORBIDDEN) {
  const url = new URL(p, base).toString();
  let status;
  try {
    const res = await fetch(url, { redirect: 'manual' });
    status = res.status;
  } catch (e) {
    failures.push(`${p} : erreur réseau (${e.message})`);
    continue;
  }

  const isRedirect = status >= 300 && status < 400;
  const isNotFound = status === 404;
  const ok = p === '/api/donate.js' ? (isNotFound || isRedirect) : isNotFound;

  if (!ok) {
    failures.push(`${p} → HTTP ${status} (attendu 404${p === '/api/donate.js' ? ' ou redirection' : ''})`);
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
