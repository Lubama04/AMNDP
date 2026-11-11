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
| `check:clean-urls` | Aucun `href`/canonical/og:url/JSON-LD interne ne contient `.html` ; `sitemap.xml` cohérent avec le disque |
| `check:sitemap` | Chaque URL de `sitemap.xml` correspond à un fichier existant ; chaque page indexable (hors 404 et pages `noindex`) est présente dans `sitemap.xml` |
| `check:headings` | Aucune page ne saute de niveau de titre (ex. h1 → h3 sans h2) |
| `check:html` | Validité HTML (`html-validate`, config `.htmlvalidate.json`) |
| `check:contrast` | Contraste WCAG 2.2 AA des principales paires texte/fond du CSS (liste maintenue à la main) |
| `check:contrast-playwright` | Contraste WCAG 2.2 AA calculé par Chromium (Playwright) sur **chaque** élément de texte visible de **chaque** page — filet de sécurité qui ne dépend d'aucune liste à maintenir |
| `check:meta` | Chaque page a un title/description/canonical uniques ; description de 120 à 160 caractères |
| `check:images` | Chaque image WebP < 100 Ko (illustration d'accueil < 120 Ko en taille standard) |
| `check:headers` | `vercel.json` déclare bien tous les en-têtes de sécurité attendus (y compris CORS/CORP/Permissions-Policy et le bloc `/api/*`) |
| `check:security-txt` | `.well-known/security.txt` présent, bien formé, non expiré (< 30 jours) |
| `check:csp` | Les empreintes SHA-256 des blocs JSON-LD sont à jour dans la CSP de `vercel.json` |
| `test:api` | Logique des handlers `api/contact.js`/`api/donate.js` (méthode, Content-Type, validation, honeypot, taille du corps) — faux req/res, aucun e-mail réel envoyé |

Si `check:csp` échoue après une modification de contenu JSON-LD (nouvel
article, changement d'une page), lancer `node scripts/update-csp.mjs` et
committer le `vercel.json` mis à jour.

**Règles de `.htmlvalidate.json` désactivées, et pourquoi :**
- `no-inline-style` : le site utilise de nombreux attributs `style=""`
  existants ; les déplacer tous en classes CSS est hors périmètre.
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

## Référencement

- Données structurées (JSON-LD) : NGO + WebSite sur l'accueil, `BreadcrumbList`
  sur chaque page intérieure, `ContactPage` sur `contact.html`, une entité
  `MedicalClinic` par centre sur `centres.html`, `BlogPosting` sur chaque
  article. Toujours minifiées sur une seule ligne (voir `check:csp` plus haut)
  et jamais de donnée inventée (horaires, coordonnées GPS, etc. omis tant
  qu'ils ne sont pas fournis).
- `sitemap.xml` : `<lastmod>` des pages statiques régénéré automatiquement
  par `npm run build:blog` (`scripts/update-sitemap.mjs`) à partir de la date
  du dernier commit Git qui modifie chaque fichier ; le bloc blog reste géré
  par `scripts/build-blog.cjs`.
- `robots.txt` : `Allow: /` et `Disallow: /api/` (les routes serverless ne
  sont pas des pages à indexer). Aucun robot d'IA n'est bloqué
  (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.).
- `llms.txt` : résumé factuel du site pour les assistants IA (mission,
  centres, services, contacts, réseaux sociaux). À tenir à jour en même
  temps que les pages qu'il résume.

### Google Search Console / Bing

La propriété est vérifiée par enregistrement DNS TXT chez l'hébergeur de
domaine (LWS), hors du contrôle du code versionné — aucune balise
`google-site-verification` n'est nécessaire dans le HTML.

Le sitemap a été soumis :
1. Google Search Console → Sitemaps → `https://www.mndp-tchad.org/sitemap.xml`.
2. Bing Webmaster Tools → Sitemaps → la même URL (import possible depuis
   Google Search Console via l'option de connexion proposée par Bing).

## Sécurité

- CSP stricte, HSTS, COOP : voir `vercel.json`.
- `Access-Control-Allow-Origin` restreint à `https://www.mndp-tchad.org`
  (plus de `*`, qui était injecté par défaut par Vercel).
- `Cross-Origin-Resource-Policy: same-site`.
- **Pas de `Cross-Origin-Embedder-Policy`** : volontairement absent, car il
  bloquerait l'iframe OpenStreetMap de la page Contact (qui n'envoie pas
  les en-têtes `Cross-Origin-Resource-Policy`/`Cross-Origin-Embedder-Policy`
  nécessaires côté OpenStreetMap). Un COEP strict casserait cette carte.
- `Permissions-Policy` étendue (géolocalisation, caméra, micro, paiement,
  USB, capteurs, `interest-cohort` pour désactiver FLoC/Topics).
- `/api/*` : `Cache-Control: no-store`, pas de CORS ouvert, pas de mise en
  cache d'une réponse pouvant contenir une confirmation d'envoi.
- `/api/contact` et `/api/donate` : validation stricte, honeypot
  anti-spam, limite de taille de requête.
- `.well-known/security.txt` (RFC 9116) pour le signalement responsable de
  failles ; `npm run check` échoue si le fichier est absent, mal formé ou
  expire dans moins de 30 jours.

### TODO-CLIENT : activer la limitation de débit (rate limiting)

Pas de limitation de débit en place sur `/api/contact` et `/api/donate`.
Le Vercel Firewall (WAF) ne se configure pas depuis `vercel.json` — c'est un
réglage de projet séparé, appliqué par API/tableau de bord, donc **hors
contrôle du code versionné** et impossible à limiter à une seule branche
par un fichier du dépôt. Une règle de ce type modifie une ressource
partagée (elle s'appliquerait potentiellement à tous les environnements) ;
ce n'est donc pas quelque chose à activer automatiquement depuis cet audit.

**Procédure pas à pas** (Project → Firewall, dans le tableau de bord Vercel) :
1. Aller sur `vercel.com/<équipe>/amndp/firewall` → onglet **Rules**.
2. « Add Rule » → nommer par ex. « Rate limit contact/donate ».
3. Conditions : `Path` → **Prefix** → `/api/contact` ; ajouter un groupe
   « OR » avec `Path` → **Prefix** → `/api/donate`.
   Pour ne pas toucher la production, ajouter `Environment` → **Equals** →
   `Preview` dans chaque groupe (à retirer une fois testé et validé).
4. Action : **Rate Limit** → algorithme *Fixed Window*, fenêtre **10 minutes**,
   limite **5 requêtes**, clé **IP Address**, action au dépassement :
   **Deny** (renvoie 429).
5. Enregistrer, puis tester avec une rafale de requêtes invalides (corps
   vide, par exemple) vers `/api/contact` : la 6ᵉ requête dans les 10
   minutes doit renvoyer **429**.
6. Si le plan Vercel du projet ne propose pas l'action « Rate Limit »
   (fonctionnalité Pro et plus), les deux alternatives sont : passer au
   plan Pro, ou mettre en place un compteur dans Upstash Redis / Vercel KV
   directement dans `api/_lib.js` (nécessite de provisionner la base et
   d'ajouter ses variables d'environnement).

Le champ piège (honeypot) déjà en place sur les deux formulaires reste une
protection indépendante contre les robots, quel que soit le choix retenu
ci-dessus.
