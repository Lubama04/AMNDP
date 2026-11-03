# Sources des images du blog

## Recherche effectuée sur l'ancien site

Avant de choisir des images, une recherche a été menée sur les deux versions
antérieures du site de l'AMNDP, via le site public et les archives de la
Wayback Machine (web.archive.org) :

1. **Version WordPress (2017-2022)**, hébergée chez LWS. Pages consultées :
   accueil, présentation, à propos, nos missions, nos services. Quatre photos
   réelles y étaient référencées (`Apareillage-centre.jpg`, `enfant-opere.jpg`,
   `blog1.jpg`, la photo du fondateur) ainsi que des logos de partenaires.
2. **Version Lovable (2026)**, celle que ce projet remplace. Page d'accueil
   consultée. Elle utilisait majoritairement des images de gabarit génériques
   (avatars, illustrations « features »), et une seule photo réelle : celle du
   fondateur.

**Résultat de la recherche** : la Wayback Machine a bien archivé les pages HTML
de ces deux versions, mais **pas les fichiers image eux-mêmes** (vérifié un par
un via l'API CDX : aucune capture disponible pour les photos en taille réelle,
seule une vignette 150 x 150 pixels de la photo du fondateur existe, inutilisable
pour le web). Aucune de ces anciennes photos n'a donc pu être récupérée.

## Décision

Conformément à la consigne reçue, toutes les images libres de banque d'images
(Wikimedia Commons) utilisées précédemment dans les articles ont été retirées.

- **Un seul article** utilise une image : « Maison Notre-Dame de la Paix : plus
  de quarante ans au service de la mobilité » reprend la photo du Père Michel
  Guimbaud déjà présente dans ce projet (`assets/images/fondateur-michel-guimbaud.jpg`),
  la même que celle utilisée sur les pages Accueil et À propos du site. C'est
  une photo réelle de l'AMNDP, pas une image libre ni générée.
- **Les quatre autres articles n'ont aucune image** (ni à la une, ni dans le
  texte), faute de photo réelle disponible correspondant à leur sujet.

## Pour ajouter une vraie photo plus tard

Dès que l'AMNDP dispose de photographies réelles (atelier d'appareillage,
séance de rééducation, vie des centres, équipe au travail, dans le respect du
consentement prévu à la section 13 de la charte graphique), les déposer dans
`assets/images/blog/`, puis renseigner les champs `coverImage`, `coverAlt`,
`coverCredit` et `images` du fichier Markdown concerné (voir `README_BLOG.md`).
Le crédit à utiliser est alors le nom du photographe ou « Association Maison
Notre-Dame de la Paix », jamais « Illustration » (réservé aux images libres
externes, qu'il faudrait alors aussi consigner ici avec leur licence).
