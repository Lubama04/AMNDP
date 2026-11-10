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

/** Lit largeur/hauteur d'un JPEG sans dépendance externe (en-têtes SOF). */
function sizeOfJpeg(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 2; // skip SOI (0xFFD8)
  while (offset < buf.length) {
    if (buf[offset] !== 0xFF) { offset++; continue; }
    const marker = buf[offset + 1];
    const isSOF = (marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isSOF) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return { width: 1200, height: 630 }; // repli si non trouvé
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Construit un <picture> WebP + repli JPG à partir d'une image de couverture,
 * en réutilisant les variantes responsives générées par `npm run images`
 * (ex. assets/images/fondateur-michel-guimbaud-800w.webp). Si ces variantes
 * n'existent pas encore pour une nouvelle photo, retombe sur l'image brute.
 */
function responsivePicture({ coverImage, alt, widths, sizes, cssWidth, cssHeight, lazy }) {
  const dir = path.posix.dirname(coverImage);
  const base = path.basename(coverImage, path.extname(coverImage));
  const have = widths.filter(w =>
    fs.existsSync(path.join(ROOT, dir, `${base}-${w}w.webp`)) &&
    fs.existsSync(path.join(ROOT, dir, `${base}-${w}w.jpg`))
  );
  const lazyAttr = lazy ? ' loading="lazy"' : '';
  if (have.length === 0) {
    return `<img src="../${coverImage}" alt="${escapeHtml(alt)}" width="${cssWidth}" height="${cssHeight}"${lazyAttr} decoding="async">`;
  }
  const webpSrcset = have.map(w => `../${dir}/${base}-${w}w.webp ${w}w`).join(', ');
  const jpgSrcset = have.map(w => `../${dir}/${base}-${w}w.jpg ${w}w`).join(', ');
  const fallback = have[have.length - 1];
  return `<picture>
      <source type="image/webp" srcset="${webpSrcset}" sizes="${sizes}">
      <img src="../${dir}/${base}-${fallback}w.jpg" srcset="${jpgSrcset}" sizes="${sizes}" alt="${escapeHtml(alt)}" width="${cssWidth}" height="${cssHeight}"${lazyAttr} decoding="async">
    </picture>`;
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
      <picture>
        <source type="image/webp" srcset="../assets/images/logo-mndp-80w.webp 80w, ../assets/images/logo-mndp-160w.webp 160w" sizes="40px">
        <img src="../assets/images/logo-mndp-160w.png" alt="Logo de l'AMNDP" width="40" height="40" decoding="async">
      </picture>
      <span>AMNDP<span class="brand-full">Association Maison Notre-Dame de la Paix</span></span>
    </a>
    <button type="button" class="menu-toggle" id="menuToggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="navMenu">☰</button>
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
          <picture>
            <source type="image/webp" srcset="../assets/images/logo-mndp-80w.webp 80w, ../assets/images/logo-mndp-160w.webp 160w" sizes="40px">
            <img src="../assets/images/logo-mndp-160w.png" alt="Logo de l'AMNDP" width="40" height="40" loading="lazy" decoding="async">
          </picture>
          AMNDP
        </div>
        <p style="max-width:34ch;margin-bottom:12px;">Association Maison Notre-Dame de la Paix, depuis 1979, au service de la mobilité, de la dignité et de l'autonomie des personnes handicapées au Tchad.</p>
        <p style="max-width:34ch;font-size:.85rem;">Avenue Négor, BP 155, Moundou, Tchad<br><a href="tel:+23566033992">+235&nbsp;66&nbsp;03&nbsp;39&nbsp;92</a> · <a href="tel:+23599721454">+235&nbsp;99&nbsp;72&nbsp;14&nbsp;54</a><br><a href="mailto:associationmndptchad@gmail.com">associationmndptchad@gmail.com</a></p>
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
      <span>© 2026 AMNDP. Tous droits réservés. ONG nationale tchadienne, arrêté N°0128/PCMT/PMT/MEPDCI/SE/SPONGAH/2021.</span>
      <div class="social-row">
        <a href="https://www.facebook.com/profile.php?id=61572390633558" target="_blank" rel="noopener noreferrer" aria-label="AMNDP sur Facebook (nouvelle fenêtre)"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg><span class="sr-only">Facebook</span></a>
        <a href="https://www.youtube.com/@AssociationMNDPTCHAD" target="_blank" rel="noopener noreferrer" aria-label="AMNDP sur YouTube (nouvelle fenêtre)"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg><span class="sr-only">YouTube</span></a>
        <a href="https://x.com/MndpTchad52525" target="_blank" rel="noopener noreferrer" aria-label="AMNDP sur X (nouvelle fenêtre)"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg><span class="sr-only">X</span></a>
        <a href="https://www.instagram.com/ong_mndp/" target="_blank" rel="noopener noreferrer" aria-label="AMNDP sur Instagram (nouvelle fenêtre)"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg><span class="sr-only">Instagram</span></a>
        <a href="https://www.tiktok.com/@amndp.moundou" target="_blank" rel="noopener noreferrer" aria-label="AMNDP sur TikTok (nouvelle fenêtre)"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg><span class="sr-only">TikTok</span></a>
      </div>
    </div>
  </div>
</footer>`;
}

function htmlShell({ title, description, canonical, ogImage, ogImageWidth, ogImageHeight, bodyClass, head, body }) {
  const finalOgImage = ogImage || `${SITE_URL}/assets/images/og-image.jpg`;
  const finalW = ogImageWidth || 1200;
  const finalH = ogImageHeight || 630;
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" type="application/rss+xml" title="AMNDP : Blog et actualités" href="/rss.xml">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${finalOgImage}">
<meta property="og:image:width" content="${finalW}">
<meta property="og:image:height" content="${finalH}">
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
<link rel="stylesheet" href="../assets/style.51bc0a96.css">
<link rel="stylesheet" href="../assets/blog.a999e3b8.css">
${head || ''}
</head>
<body class="${bodyClass || ''}">
<a href="#main" class="skip-link">Aller au contenu principal</a>
${body}
<script src="../assets/main.5e3de901.js"></script>
<script src="../assets/blog.a1950cf8.js"></script>
</body>
</html>`;
  // Lignes vides laissées par les blocs conditionnels (${'${...}'} → '').
  return html.split('\n').map(line => line.trimEnd()).join('\n');
}

function cardHtml(a) {
  const imgBlock = a.coverImage ? `<div class="blog-card-img-wrap">
      ${responsivePicture({
        coverImage: a.coverImage, alt: a.coverAlt, widths: [800, 1200],
        sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px',
        cssWidth: 800, cssHeight: 500, lazy: true,
      })}
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
      description: 'Articles de fond de l\'AMNDP sur la réadaptation, l\'appareillage orthopédique et la réinsertion des personnes en situation de handicap à Moundou, Tchad.',
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
    alternateName: ['AMNDP', 'Maison Notre-Dame de la Paix'],
    url: SITE_URL,
    logo: `${SITE_URL}/assets/images/logo-mndp-160w.png`,
    image: `${SITE_URL}/assets/images/og-image.jpg`,
    foundingDate: '1979-05-01',
    founder: { '@type': 'Person', name: 'Père Michel Guimbaud' },
    slogan: "M'ndigi Dja Tar : Je veux marcher debout",
    description: "Centre de rééducation fonctionnelle, d'appareillage orthopédique et de réinsertion socio-économique des personnes en situation de handicap physique, à Moundou, Tchad. Fondée en 1979.",
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Avenue Négor, BP 155',
      addressLocality: 'Moundou',
      addressCountry: 'TD',
    },
    areaServed: [
      { '@type': 'Place', name: 'Moundou' },
      { '@type': 'Place', name: 'Doba' },
      { '@type': 'Place', name: 'Laï' },
      { '@type': 'Place', name: 'Pala' },
      { '@type': 'Country', name: 'Tchad' },
    ],
    telephone: ['+235 66 03 39 92', '+235 99 72 14 54'],
    email: 'associationmndptchad@gmail.com',
    knowsAbout: ['Rééducation fonctionnelle', 'Appareillage orthopédique', 'Kinésithérapie', 'Réinsertion sociale'],
    sameAs: [
      'https://www.facebook.com/profile.php?id=61572390633558',
      'https://www.youtube.com/@AssociationMNDPTCHAD',
      'https://x.com/MndpTchad52525',
      'https://www.instagram.com/ong_mndp/',
      'https://www.tiktok.com/@amndp.moundou',
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
        ${responsivePicture({
          coverImage: a.coverImage, alt: a.coverAlt, widths: [800, 1200],
          sizes: '(max-width: 1024px) 100vw, 1160px',
          cssWidth: 1200, cssHeight: 480, lazy: false,
        })}
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

    // Pour une couverture réelle, on réutilise la variante 1200w générée par
    // `npm run images` si elle existe (hauteur calculée depuis son ratio réel),
    // sinon l'image sociale générique 1200×630.
    let ogImage, ogImageWidth, ogImageHeight;
    if (a.coverImage) {
      const dir = path.posix.dirname(a.coverImage);
      const base = path.basename(a.coverImage, path.extname(a.coverImage));
      const variant1200 = path.join(ROOT, dir, `${base}-1200w.jpg`);
      if (fs.existsSync(variant1200)) {
        const dims = sizeOfJpeg(variant1200);
        ogImage = `${SITE_URL}/${dir}/${base}-1200w.jpg`;
        ogImageWidth = dims.width;
        ogImageHeight = dims.height;
      } else {
        ogImage = `${SITE_URL}/${a.coverImage}`;
      }
    } else {
      ogImage = `${SITE_URL}/assets/images/og-image.jpg`;
      ogImageWidth = 1200;
      ogImageHeight = 630;
    }

    const html = htmlShell({
      title: `${a.title} | Blog AMNDP`,
      description: a.metaDescription || a.excerpt,
      canonical: shareUrl,
      ogImage, ogImageWidth, ogImageHeight,
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
  const latestDate = articles.length ? articles[0].date : new Date().toISOString().slice(0, 10);
  const entries = [`  <url>\n    <loc>${SITE_URL}/blog/index.html</loc>\n    <lastmod>${latestDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`]
    .concat(articles.map(a => `  <url>\n    <loc>${SITE_URL}/blog/${a.slug}.html</loc>\n    <lastmod>${a.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`));
  // Remove any previously generated blog entries, then re-insert fresh ones.
  xml = xml.replace(/\n?\s*<!-- BLOG:START -->[\s\S]*?<!-- BLOG:END -->\n?/,'\n');
  const block = `\n  <!-- BLOG:START -->\n${entries.join('\n')}\n  <!-- BLOG:END -->\n`;
  xml = xml.replace(closeTag, `${block}${closeTag}`);
  // Idempotence : quel que soit le nombre de lignes vides déjà présentes
  // avant le bloc (selon l'état de départ du fichier), n'en garder qu'une.
  xml = xml.replace(/\n{2,}(\s*<!-- BLOG:START -->)/, '\n$1');
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
