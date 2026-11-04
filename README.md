# Site institutionnel de l'AMNDP

Site statique (HTML/CSS/JS, sans framework) de l'Association Maison
Notre-Dame de la Paix (AMNDP) — Moundou, Tchad — hébergé sur [Vercel](https://vercel.com),
avec deux fonctions serverless pour les formulaires de contact et de don.

Site en production : https://www.mndp-tchad.org/

## Structure du dépôt

```
.
├── index.html, a-propos.html, services.html, centres.html,  pages statiques
│   actualites.html, soutenir.html, contact.html,            (HTML autonome,
│   mentions-legales.html, confidentialite.html, 404.html     pas de templating)
├── blog/                   pages du blog, générées — ne pas éditer à la main
├── blog-content/           source du blog : un fichier Markdown par article
├── assets/
│   ├── style.css, main.js          styles et scripts du site
│   ├── blog.css, blog.js           styles et scripts propres au blog
│   ├── fonts/                      police Open Sans auto-hébergée (woff2)
│   └── images/
│       ├── originals/              photos sources haute résolution
│       │                           (jamais déployées, voir .vercelignore)
│       └── *-{80,160,320,480,800,1200}w.{webp,jpg,png}
│                                   variantes générées par `npm run images`
├── api/                    fonctions serverless Vercel (/api/contact, /api/donate)
├── scripts/                 scripts Node de build et de contrôle (voir plus bas)
├── sitemap.xml, robots.txt, rss.xml, site.webmanifest, favicon.ico
├── .well-known/security.txt
└── vercel.json              redirections, en-têtes de sécurité et de cache
```

## Installation

Prérequis : Node.js 20+ et npm.

```bash
npm install
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance le site en local avec `vercel dev` (API comprises) |
| `npm run build:blog` | Régénère `blog/*.html`, `sitemap.xml` et `rss.xml` à partir de `blog-content/*.md` |
| `npm run images` | Génère les variantes WebP/JPG/PNG responsives à partir de `assets/images/originals/` |
| `npm run icons` | Régénère favicon.ico, apple-touch-icon.png, icon-192/512.png à partir du logo |
| `npm run og-image` | Régénère `assets/images/og-image.jpg` (1200×630) à partir de l'illustration + du logo |
| `npm run check` | Lance tous les contrôles qualité (voir ci-dessous) — utilisé en CI |

### `npm run check` en détail

| Sous-commande | Contrôle |
|---|---|
| `check:links` | Tous les liens internes (`href`, `src`, `srcset`) et ancres résolvent vers un fichier/une ancre existante |
| `check:html` | Validité HTML (`html-validate`, config `.htmlvalidate.json`) |
| `check:contrast` | Contraste WCAG 2.2 AA des principales paires texte/fond du CSS |
| `check:meta` | Chaque page a un title/description/canonical uniques ; description de 120 à 160 caractères |
| `check:images` | Chaque image WebP < 100 Ko (illustration d'accueil < 120 Ko en taille standard) |
| `check:headers` | `vercel.json` déclare bien tous les en-têtes de sécurité attendus |
| `check:csp` | Les empreintes SHA-256 des blocs JSON-LD sont à jour dans la CSP de `vercel.json` |

Si `check:csp` échoue après une modification de contenu JSON-LD (nouvel
article, changement d'une page), lancer `node scripts/update-csp.mjs` et
committer le `vercel.json` mis à jour.

**Règles de `.htmlvalidate.json` désactivées, et pourquoi :**
- `no-inline-style` : le site utilise de nombreux attributs `style=""`
  existants ; les déplacer tous en classes CSS est hors périmètre.
- `aria-label-misuse` : `aria-label` est posé volontairement sur les
  compteurs animés (`.stat-num`) pour garder un nom accessible stable
  pendant l'animation JS — fonctionne dans tous les lecteurs d'écran
  malgré l'avertissement du linter.
- `long-title` : les titres des pages d'articles de blog sont
  volontairement descriptifs et peuvent dépasser 70 caractères.
- `tel-non-breaking` : la correction (espaces insécables) a été faite à
  la main partout où un numéro de téléphone est affiché en texte ; la
  règle du linter signale aussi, à tort, les boutons dont le texte est
  un intitulé (« Appeler le secrétariat ») et non le numéro lui-même.
- `hidden-focusable` : signalé sur la fenêtre modale de don
  (`aria-hidden="true"` par défaut, contenant des champs de formulaire).
  Le CSS (`visibility:hidden` tant que la modale est fermée) neutralise
  réellement le problème que la règle détecte ; un linter statique ne
  peut pas le vérifier.

## Déploiement

Le dépôt est lié au projet Vercel `amndp-tchad-site`. Un `git push` sur la
branche par défaut déclenche un déploiement de production. Les domaines
`mndp-tchad.org` et `www.mndp-tchad.org` sont tous deux rattachés au
projet ; `vercel.json` redirige l'apex vers `www` en 308.

## Variables d'environnement

Voir `.env.example`. Nécessaires pour que `/api/contact` et `/api/donate`
envoient réellement un e-mail (via [Resend](https://resend.com)) :

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CONTACT_TO_EMAIL`
- `DONATION_TO_EMAIL`

À définir dans le tableau de bord Vercel (Project → Settings →
Environment Variables), jamais committées.

## Publier un article de blog

Voir [README_BLOG.md](README_BLOG.md) — workflow complet en 5 étapes
(copier un fichier Markdown, remplir l'en-tête, écrire le corps,
optimiser une éventuelle photo, lancer `npm run build:blog`).

## Publier une actualité

La page `actualites.html` n'a pas de pipeline Markdown comme le blog :
chaque actualité est une carte HTML dans `.news-grid`.

1. Dans `actualites.html`, dupliquer le bloc gabarit en commentaire
   juste avant `<div class="news-grid">` (catégorie, titre, date).
2. Ajouter la même entrée dans le tableau `ACTUALITES` de
   `scripts/generate-rss.mjs`, pour qu'elle apparaisse aussi dans
   `rss.xml`.
3. Lancer `npm run build:blog` (régénère `rss.xml`) puis `npm run check`.
4. Ne jamais inventer de contenu : si l'actualité mérite un article
   complet plutôt qu'une simple carte, utiliser le blog à la place.

## Sécurité

- CSP stricte, HSTS, COOP : voir `vercel.json`.
- `/api/contact` et `/api/donate` : validation stricte, honeypot
  anti-spam, limite de taille de requête. Pas de limitation de débit
  (rate limiting) en place — voir `.env.example` pour les options.
- `.well-known/security.txt` pour le signalement responsable de failles.
