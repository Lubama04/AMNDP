# Blog AMNDP : guide d'ajout d'un article

Le blog est entièrement statique : chaque article est un simple fichier Markdown
dans `blog-content/`. Aucune base de données, aucun accès au code n'est nécessaire
pour publier un nouvel article.

## Ajouter un article, étape par étape

1. Copier un fichier existant de `blog-content/` (par exemple
   `blog-content/maison-notre-dame-de-la-paix-quarante-ans-mobilite.md`) et le
   renommer avec le futur slug de l'article (minuscules, tirets, sans accent),
   par exemple `blog-content/mon-nouvel-article.md`.
2. Remplir l'en-tête (le bloc entre `---`) :

   ```yaml
   ---
   title: "Titre de l'article"
   slug: "mon-nouvel-article"          # doit correspondre au nom du fichier
   category: "savoirs-pratiques"        # ou "science-sante" / "reflexions-litterature"
   date: "2026-11-15"                   # format AAAA-MM-JJ, sert au tri et au sitemap
   dateDisplay: "15 novembre 2026"      # date en toutes lettres, affichée sur le site
   excerpt: "Le chapeau de l'article, deux phrases qui résument."
   metaDescription: "Résumé de 150 caractères maximum pour les moteurs de recherche."
   author: "Rédaction AMNDP"
   coverImage: "assets/images/mon-image.jpg"   # voir étape 4 pour l'optimiser
   coverAlt: "Texte alternatif décrivant l'image à la une."
   coverCredit: "Illustration"          # ou le crédit réel si photo AMNDP
   images:
     - src: "assets/images/mon-image-2.jpg"
       alt: "Texte alternatif de la première image dans le texte."
       credit: "Illustration"
   keywords: ["mot-clé 1", "mot-clé 2"]
   sources:
     - "Référence pour l'encadré Pour aller plus loin, s'il y en a une."
   ---
   ```

3. Écrire le corps de l'article en Markdown, avec un titre de section `## ` pour
   chaque partie (ces titres deviennent le sommaire cliquable de la page) :

   ```markdown
   ## 1. Premier titre de section

   Texte du premier paragraphe...

   ## 2. Deuxième titre de section

   Texte du deuxième paragraphe...
   ```

4. Image à la une (facultative) :
   - Déposer la photo originale (haute résolution) dans
     `assets/images/originals/mon-image.jpg` (voir `SOURCES_IMAGES.md` pour
     choisir et noter une image libre de droit si l'AMNDP n'a pas encore de
     photo pour ce sujet).
   - Ajouter une entrée pour ce fichier dans le tableau `JOBS` de
     `scripts/generate-images.mjs` (copier la ligne `fondateur-michel-guimbaud`
     en exemple), puis lancer :

     ```bash
     npm run images
     ```

     Cela génère `assets/images/mon-image-800w.webp` et `-1200w.webp` (+ repli
     `.jpg`), servis automatiquement en `<picture>` responsive par le script
     de construction du blog.
   - Si cette étape est sautée, renseigner quand même `coverImage` avec le
     chemin d'une image déjà présente dans `assets/images/` (pas dans
     `originals/`, qui n'est jamais déployé) : l'article s'affichera avec
     cette image brute, non optimisée, en attendant.
   - Sans image du tout, laisser `coverImage` vide (`""`) : l'article
     s'affiche sans photo, sans casser la mise en page.
5. Générer les pages du site :

   ```bash
   npm run build:blog
   ```

   Cette commande régénère automatiquement :
   - `blog/index.html` (et `blog/page-2.html`, etc. s'il y a plus de 9 articles) ;
   - `blog/<slug>.html` pour chaque article ;
   - la liste des pages du blog dans `sitemap.xml`.

6. Vérifier le rendu en local (voir plus bas), puis déployer comme d'habitude
   (`git add`, `git commit`, `git push` : Vercel republie automatiquement).

## Catégories disponibles

Les trois catégories sont fixées par la charte éditoriale et codées dans
`scripts/build-blog.cjs` (constante `CATEGORIES`) :

| Valeur dans `category` | Libellé affiché |
|---|---|
| `science-sante` | Science et santé |
| `reflexions-litterature` | Réflexions et littérature |
| `savoirs-pratiques` | Savoirs et pratiques |

Pour ajouter une quatrième catégorie, l'ajouter dans cet objet `CATEGORIES` du
script, puis relancer `npm run build:blog`.

## Vérifier en local avant de publier

```bash
npm run build:blog   # régénère les pages blog/
npm run dev           # lance le site en local (vercel dev)
```

Ouvrir ensuite `http://localhost:3000/blog/index.html` (le port exact est
affiché par `vercel dev`).

## Règles à respecter (charte AMNDP)

- Français uniquement, sigle **AMNDP**, aucun tiret cadratin (utiliser deux-points,
  virgule ou parenthèses).
- Jamais de personne présentée comme patiente de l'AMNDP sur une image libre :
  légender ces images « Illustration » et les référencer dans `SOURCES_IMAGES.md`.
- Vocabulaire du handicap : « personne en situation de handicap », jamais
  « handicapé » employé comme nom, jamais de pitié ni de misérabilisme.
- Toute image a un texte alternatif (`alt`) descriptif.
- Un chiffre publié doit toujours être sourcé et daté.

## Supprimer ou dépublier un article

Supprimer le fichier `blog-content/<slug>.md`, puis relancer `npm run build:blog` :
le script vide et régénère entièrement le dossier `blog/` à chaque exécution,
il ne laisse donc aucune page orpheline.
