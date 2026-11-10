#!/usr/bin/env node
/**
 * Génère rss.xml (flux Atom/RSS 2.0) à partir des articles du blog
 * (blog-content/*.md) et des actualités (liste manuelle ci-dessous, à
 * tenir à jour en même temps que actualites.html — voir README.md).
 * Usage : node scripts/generate-rss.mjs  (appelé par npm run build:blog)
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_URL = 'https://www.mndp-tchad.org';

const CATEGORIES = {
  'science-sante': 'Science et santé',
  'reflexions-litterature': 'Réflexions et littérature',
  'savoirs-pratiques': 'Savoirs et pratiques',
};

// Tenue à jour manuellement : une entrée par carte de la page Actualités.
// (La page n'a pas de pipeline Markdown comme le blog — voir README.md
// « Publier une actualité ».) Aucune actualité publiée pour le moment.
const ACTUALITES = [];

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function loadBlogItems() {
  const dir = path.join(ROOT, 'blog-content');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const { data } = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
    return {
      title: data.title,
      link: `${SITE_URL}/blog/${data.slug}`,
      description: data.excerpt,
      date: data.date,
      category: CATEGORIES[data.category] || data.category,
    };
  });
}

function loadActualitesItems() {
  return ACTUALITES.map(a => ({
    title: a.title,
    link: `${SITE_URL}/actualites`,
    description: a.description,
    date: a.date,
    category: 'Actualités',
  }));
}

function rfc822(dateStr) {
  return new Date(`${dateStr}T08:00:00Z`).toUTCString();
}

function main() {
  const items = [...loadBlogItems(), ...loadActualitesItems()]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const itemsXml = items.map(it => `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(it.link)}</link>
      <guid>${escapeXml(it.link)}</guid>
      <description>${escapeXml(it.description || '')}</description>
      <category>${escapeXml(it.category || '')}</category>
      <pubDate>${rfc822(it.date)}</pubDate>
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AMNDP : Blog et actualités</title>
    <link>${SITE_URL}/</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Articles du blog et actualités de l'Association Maison Notre-Dame de la Paix (AMNDP), Moundou, Tchad.</description>
    <language>fr-FR</language>
    <lastBuildDate>${rfc822(items[0].date)}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;

  fs.writeFileSync(path.join(ROOT, 'rss.xml'), xml);
  console.log(`  → rss.xml (${items.length} entrée(s))`);
}

main();
