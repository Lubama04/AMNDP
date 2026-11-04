#!/usr/bin/env node
/**
 * Génère les pages statiques du blog AMNDP à partir des fichiers Markdown
 * de blog-content/. Voir README_BLOG.md pour l'usage.
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'blog-content');
const OUT_DIR = path.join(ROOT, 'blog');
const SITE_URL = 'https://www.mndp-tchad.org';
const PER_PAGE = 9;

const CATEGORIES = {
  'science-sante': 'Science et santé',
  'reflexions-litterature': 'Réflexions et littérature',
  'savoirs-pratiques': 'Savoirs et pratiques',
};

marked.use({ headerIds: false, mangle: false });

function slugifyId(text) {
  return text.toLowerCase()
    .replace(/^\d+\.\s*/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function countWords(markdownBody) {
  const plain = markdownBody.replace(/^#+\s.*$/gm, '').replace(/[#*_`]/g, '');
  return (plain.match(/\S+/g) || []).length;
}

function readingTimeFromWords(words) {
  return Math.max(1, Math.round(words / 200));
}

/** Découpe le corps Markdown en sections sur les titres `## `. */
function splitSections(body) {
  const lines = body.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      current = { title: m[1].trim(), id: slugifyId(m[1].trim()), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections.map(s => ({ title: s.title, id: s.id, html: marked.parse(s.lines.join('\n')) }));
}

function loadArticles() {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const articles = files.map(f => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8');
    const { data, content } = matter(raw);
    const words = countWords(content);
    return {
      ...data,
      categoryLabel: CATEGORIES[data.category] || data.category,
      readingTime: readingTimeFromWords(words),
      sections: splitSections(content),
      wordCount: words,
    };
  });
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  return articles;
}

/* ---------------- Gabarits de en-tête / pied de page du site ---------------- */

function siteHeader(activeIsBlog) {
  return `<header>
  <div class="nav-wrap">
    <a href="/" class="brand">
      <img src="../assets/images/logo-mndp.png" alt="Logo de l'AMNDP">
      <span>AMNDP<span class="brand-full">Association Maison Notre-Dame de la Paix</span></span>
    </a>
    <button class="menu-toggle" id="menuToggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="navMenu">☰</button>
    <nav id="navMenu" aria-label="Navigation principale">
      <ul>
        <li><a href="/">Accueil</a></li>
        <li><a href="../a-propos.html">À propos</a></li>
        <li><a href="../services.html">Nos Services</a></li>
        <li><a href="../centres.html">Nos Centres</a></li>
        <li><a href="../actualites.html">Actualités</a></li>
        <li><a href="../blog/index.html"${activeIsBlog ? ' class="active" aria-current="page"' : ''}>Blog</a></li>
        <li><a href="../soutenir.html">Soutenir le centre</a></li>
        <li><a href="../contact.html">Contact</a></li>
      </ul>
    </nav>
    <a href="../soutenir.html" class="btn btn-primary header-cta">Faire un don</a>
  </div>
</header>`;
}

function siteFooter() {
  return `<footer>
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="brand" style="color:#fff;margin-bottom:12px;">
          <img src="../assets/images/logo-mndp.png" alt="Logo de l'AMNDP">
          AMNDP
        </div>
        <p style="max-width:34ch;margin-bottom:12px;">Association Maison Notre-Dame de la Paix, depuis 1979, au service de la mobilité, de la dignité et de l'autonomie des personnes handicapées au Tchad.</p>
        <p style="max-width:34ch;font-size:.85rem;">Avenue Négor, BP 155, Moundou, Tchad<br><a href="tel:+23566033992">+235 66 03 39 92</a> · <a href="tel:+23599721454">+235 99 72 14 54</a><br><a href="mailto:associationmndptchad@gmail.com">associationmndptchad@gmail.com</a></p>
      </div>
      <div>
        <h4>Liens utiles</h4>
        <ul>
          <li><a href="/">Accueil</a></li>
          <li><a href="../a-propos.html">À propos</a></li>
          <li><a href="../services.html">Nos Services</a></li>
          <li><a href="../actualites.html">Actualités</a></li>
          <li><a href="../blog/index.html">Blog</a></li>
          <li><a href="../soutenir.html">Soutenir le centre</a></li>
          <li><a href="../contact.html">Contact</a></li>
          <li><a href="../mentions-legales.html">Mentions légales</a></li>
          <li><a href="../confidentialite.html">Confidentialité</a></li>
        </ul>
      </div>
      <div>
        <h4>Nos centres</h4>
        <ul>
          <li><a href="../centres.html#moundou">Moundou</a></li>
          <li><a href="../centres.html#doba">Doba</a></li>
          <li><a href="../centres.html#lai">Laï</a></li>
          <li><a href="../centres.html#pala">Pala</a></li>
        </ul>
      </div>
      <div>
        <h4>Nos services</h4>
        <ul>
          <li><a href="../services.html#kinesitherapie">Kinésithérapie &amp; rééducation</a></li>
          <li><a href="../services.html#appareillage">Appareillage orthopédique</a></li>
          <li><a href="../services.html#missions">Missions chirurgicales</a></li>
          <li><a href="../services.html#reinsertion">Réinsertion &amp; formation</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© AMNDP 2026 : Tous droits réservés. ONG nationale tchadienne, arrêté N°0128/PCMT/PMT/MEPDCI/SE/SPONGAH/2021.</span>
      <div class="social-row">
        <a href="https://www.facebook.com/profile.php?id=61572390633558" target="_blank" rel="noopener noreferrer" aria-label="AMNDP sur Facebook">Facebook</a>
        <a href="https://youtube.com/@associationmndptchad" target="_blank" rel="noopener noreferrer" aria-label="AMNDP sur YouTube">YouTube</a>
        <a href="https://x.com/MndpTchad52525" target="_blank" rel="noopener noreferrer" aria-label="AMNDP sur X">X</a>
        <!-- TODO-CLIENT: ajouter le lien Instagram (absent du dépôt, lien retiré pour éviter un lien mort) -->
        <!-- TODO-CLIENT: ajouter le lien TikTok (le lien fourni, https://www.tiktok.com/@associationmndptc, renvoie "Ce compte est introuvable" au 2026-11-04 ; vérifier l'identifiant exact avant publication) -->
      </div>
    </div>
  </div>
</footer>`;
}

function htmlShell({ title, description, canonical, ogImage, bodyClass, head, body }) {
  const finalOgImage = ogImage || `${SITE_URL}/assets/images/logo-mndp.png`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${finalOgImage}">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="AMNDP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${finalOgImage}">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/images/icon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#4F86E5">
<link rel="preload" href="/assets/fonts/open-sans-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../assets/style.css">
<link rel="stylesheet" href="../assets/blog.css">
${head || ''}
</head>
<body class="${bodyClass || ''}">
<a href="#main" class="skip-link">Aller au contenu principal</a>
${body}
<script src="../assets/main.js"></script>
<script src="../assets/blog.js"></script>
</body>
</html>`;
}

function cardHtml(a) {
  const imgBlock = a.coverImage ? `<div class="blog-card-img-wrap">
      <img src="../${a.coverImage}" alt="${escapeHtml(a.coverAlt)}" loading="lazy" width="800" height="500">
    </div>` : '';
  return `<li class="blog-card${a.coverImage ? '' : ' no-image'}" data-category="${a.category}">
  <a class="blog-card-link" href="${a.slug}.html">
    ${imgBlock}
    <div class="blog-card-body">
      <span class="blog-cat-badge">${escapeHtml(a.categoryLabel)}</span>
      <h3>${escapeHtml(a.title)}</h3>
      <p class="blog-excerpt">${escapeHtml(a.excerpt)}</p>
      <div class="blog-card-meta">
        <time datetime="${a.date}">${escapeHtml(a.dateDisplay)}</time>
        <span class="sep">·</span>
        <span>${a.readingTime} min de lecture</span>
      </div>
    </div>
  </a>
</li>`;
}

function buildListPages(articles) {
  const totalPages = Math.max(1, Math.ceil(articles.length / PER_PAGE));
  const filterBar = `<div class="blog-filters" role="group" aria-label="Filtrer par catégorie">
    <a href="index.html" class="blog-filter is-active" data-filter="all">Tous les articles</a>
    ${Object.entries(CATEGORIES).map(([slug, label]) =>
      `<button type="button" class="blog-filter" data-filter="${slug}">${escapeHtml(label)}</button>`).join('\n    ')}
  </div>`;

  for (let page = 1; page <= totalPages; page++) {
    const slice = articles.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const pageSuffix = page === 1 ? 'index.html' : `page-${page}.html`;
    const canonical = `${SITE_URL}/blog/${pageSuffix}`;

    const pagination = totalPages > 1 ? `<nav class="blog-pagination" aria-label="Pagination du blog">
      ${Array.from({ length: totalPages }, (_, i) => {
        const n = i + 1;
        const href = n === 1 ? 'index.html' : `page-${n}.html`;
        return n === page
          ? `<span class="is-current" aria-current="page">${n}</span>`
          : `<a href="${href}">${n}</a>`;
      }).join('\n      ')}
    </nav>` : '';

    const body = `${siteHeader(true)}
<main id="main">
  <section class="blog-hero">
    <div class="blog-main-container blog-shell">
      <span class="blog-eyebrow">Blog de l'AMNDP</span>
      <h1>Savoirs, soins et réflexions depuis Moundou</h1>
      <p>Des articles de fond sur la réadaptation, l'appareillage orthopédique, la réinsertion et la vie de la Maison Notre-Dame de la Paix, écrits par la rédaction de l'AMNDP.</p>
    </div>
  </section>
  <section>
    <div class="blog-main-container blog-shell">
      ${filterBar}
      <ul class="blog-grid" id="blogGrid">
        ${slice.map(cardHtml).join('\n        ')}
      </ul>
      ${pagination}
    </div>
  </section>
</main>
${siteFooter()}`;

    const html = htmlShell({
      title: page === 1 ? 'Blog de l\'AMNDP : articles sur la réadaptation à Moundou' : `Blog de l'AMNDP (page ${page}) | AMNDP Moundou`,
      description: 'Articles de fond de l\'AMNDP sur la réadaptation fonctionnelle, l\'appareillage orthopédique et la réinsertion des personnes en situation de handicap à Moundou, Tchad.',
      canonical,
      bodyClass: 'blog-shell',
      body,
      head: page === 1 ? listJsonLd(articles) : '',
    });
    fs.writeFileSync(path.join(OUT_DIR, pageSuffix), html);
    console.log('  →', `blog/${pageSuffix}`);
  }
}

function listJsonLd(articles) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog de l\'AMNDP',
    url: `${SITE_URL}/blog/index.html`,
    publisher: organizationJsonLd(),
    blogPost: articles.map(a => ({
      '@type': 'BlogPosting',
      headline: a.title,
      url: `${SITE_URL}/blog/${a.slug}.html`,
      datePublished: a.date,
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function organizationJsonLd() {
  return {
    '@type': 'NGO',
    name: "Association Maison Notre-Dame de la Paix (AMNDP)",
    alternateName: 'AMNDP',
    url: SITE_URL,
    logo: `${SITE_URL}/assets/images/logo-mndp.png`,
    foundingDate: '1979',
    slogan: "M'ndigi Dja Tar : Je veux marcher debout",
    description: "Centre de rééducation fonctionnelle, d'appareillage orthopédique et de réinsertion socio-économique des personnes en situation de handicap physique, à Moundou, Tchad. Fondée en 1979.",
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Avenue Négor, BP 155',
      addressLocality: 'Moundou',
      addressCountry: 'TD',
    },
    sameAs: [
      'https://www.facebook.com/profile.php?id=61572390633558',
      'https://youtube.com/@associationmndptchad',
      'https://x.com/MndpTchad52525',
    ],
  };
}

function articleJsonLd(a) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title,
    description: a.metaDescription || a.excerpt,
    ...(a.coverImage ? { image: `${SITE_URL}/${a.coverImage}` } : {}),
    datePublished: a.date,
    dateModified: a.date,
    author: { '@type': 'Organization', name: a.author || 'Rédaction AMNDP' },
    publisher: organizationJsonLd(),
    mainEntityOfPage: `${SITE_URL}/blog/${a.slug}.html`,
    about: a.keywords || [],
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog/index.html` },
      { '@type': 'ListItem', position: 3, name: a.title, item: `${SITE_URL}/blog/${a.slug}.html` },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>\n<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`;
}

function buildArticlePages(articles) {
  articles.forEach((a, idx) => {
    const toc = `<nav class="blog-toc" aria-label="Sommaire de l'article" id="blogToc">
      <h2>Sommaire</h2>
      <ol>
        ${a.sections.map(s => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join('\n        ')}
      </ol>
    </nav>`;

    // Place inline images after the 2nd and (n-2)th sections, when enough sections exist.
    const total = a.sections.length;
    const img1After = Math.min(1, total - 1);
    const img2After = total >= 5 ? total - 2 : Math.min(3, total - 1);
    const images = a.images || [];

    const sectionsHtml = a.sections.map((s, i) => {
      let out = `<h2 id="${s.id}">${escapeHtml(s.title)}</h2>\n${s.html}`;
      if (images[0] && i === img1After) {
        out += figureHtml(images[0]);
      }
      if (images[1] && i === img2After && img2After !== img1After) {
        out += figureHtml(images[1]);
      }
      return out;
    }).join('\n');

    const furtherBox = (a.sources && a.sources.length) ? `<aside class="blog-further">
      <h2>Pour aller plus loin</h2>
      <ul>
        ${a.sources.map(s => `<li>${escapeHtml(s)}</li>`).join('\n        ')}
      </ul>
    </aside>` : '';

    const shareUrl = `${SITE_URL}/blog/${a.slug}.html`;
    const shareBox = `<div class="blog-share">
      <span>Partager :</span>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Partager sur Facebook">f</a>
      <a href="https://wa.me/?text=${encodeURIComponent(a.title + ' — ' + shareUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Partager sur WhatsApp">w</a>
      <a href="https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(a.title)}" target="_blank" rel="noopener noreferrer" aria-label="Partager sur X">x</a>
      <a href="mailto:?subject=${encodeURIComponent(a.title)}&body=${encodeURIComponent(shareUrl)}" aria-label="Partager par e-mail">@</a>
    </div>`;

    const related = articles.filter(o => o.slug !== a.slug && o.category === a.category).slice(0, 3);
    const relatedFallback = related.length ? related : articles.filter(o => o.slug !== a.slug).slice(0, 3);

    const relatedSection = `<section class="blog-related">
      <div class="blog-main-container blog-shell">
        <h2>À lire aussi</h2>
        <ul class="blog-grid">
          ${relatedFallback.map(cardHtml).join('\n          ')}
        </ul>
      </div>
    </section>`;

    const body = `${siteHeader(true)}
<main id="main">
  <div class="blog-article-header">
    <div class="blog-main-container blog-shell">
      <div class="blog-breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a> / <a href="index.html">Blog</a> / <span aria-current="page">${escapeHtml(a.categoryLabel)}</span></div>
      <span class="blog-cat-badge">${escapeHtml(a.categoryLabel)}</span>
      <h1>${escapeHtml(a.title)}</h1>
      <p class="blog-chapeau">${escapeHtml(a.excerpt)}</p>
      <div class="blog-article-meta">
        <span>${escapeHtml(a.author || 'Rédaction AMNDP')}</span>
        <span>·</span>
        <time datetime="${a.date}">${escapeHtml(a.dateDisplay)}</time>
        <span>·</span>
        <span>${a.readingTime} min de lecture</span>
      </div>
    </div>
  </div>
  <article class="blog-shell">
    <div class="blog-main-container">
      ${a.coverImage ? `<figure class="blog-article-cover">
        <img src="../${a.coverImage}" alt="${escapeHtml(a.coverAlt)}" width="1200" height="480">
      </figure>
      <p class="blog-figure-credit">${escapeHtml(a.coverCredit || 'Illustration')}</p>` : ''}
      <div class="blog-article-layout">
        ${toc}
        <div class="blog-article-body">
          ${sectionsHtml}
          ${furtherBox}
          <div class="blog-cta-box">
            <p>Chaque don finance un appareillage, une séance de rééducation, un pas vers l'autonomie.</p>
            <a class="blog-btn" href="../soutenir.html">Faire un don</a>
          </div>
          ${shareBox}
        </div>
      </div>
    </div>
  </article>
  ${relatedSection}
</main>
${siteFooter()}`;

    const html = htmlShell({
      title: `${a.title} | Blog AMNDP`,
      description: a.metaDescription || a.excerpt,
      canonical: shareUrl,
      ogImage: a.coverImage ? `${SITE_URL}/${a.coverImage}` : `${SITE_URL}/assets/images/logo-mndp.png`,
      bodyClass: 'blog-shell',
      body,
      head: articleJsonLd(a),
    });
    fs.writeFileSync(path.join(OUT_DIR, `${a.slug}.html`), html);
    console.log('  →', `blog/${a.slug}.html`);
  });
}

function figureHtml(img) {
  return `\n<figure>
  <img src="../${img.src}" alt="${escapeHtml(img.alt)}" loading="lazy" width="900" height="560">
  <figcaption>${escapeHtml(img.credit || 'Illustration')}</figcaption>
</figure>\n`;
}

function updateSitemap(articles) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(sitemapPath, 'utf8');
  const closeTag = '</urlset>';
  if (!xml.includes(closeTag)) return;
  const entries = [`  <url>\n    <loc>${SITE_URL}/blog/index.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`]
    .concat(articles.map(a => `  <url>\n    <loc>${SITE_URL}/blog/${a.slug}.html</loc>\n    <lastmod>${a.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`));
  // Remove any previously generated blog entries, then re-insert fresh ones.
  xml = xml.replace(/\n?\s*<!-- BLOG:START -->[\s\S]*?<!-- BLOG:END -->\n?/,'\n');
  const block = `\n  <!-- BLOG:START -->\n${entries.join('\n')}\n  <!-- BLOG:END -->\n`;
  xml = xml.replace(closeTag, `${block}${closeTag}`);
  fs.writeFileSync(sitemapPath, xml);
  console.log('  → sitemap.xml mis à jour');
}

function cleanOutDir() {
  if (!fs.existsSync(OUT_DIR)) return;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.html')) fs.unlinkSync(path.join(OUT_DIR, f));
  }
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  cleanOutDir();
  const articles = loadArticles();
  console.log(`Blog AMNDP : ${articles.length} article(s) trouvé(s) dans blog-content/`);
  buildListPages(articles);
  buildArticlePages(articles);
  updateSitemap(articles);
  console.log('Terminé.');
}

main();
