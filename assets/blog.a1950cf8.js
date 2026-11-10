document.addEventListener('DOMContentLoaded', () => {
  /* ---- Filtre de catégorie (page liste du blog) ---- */
  const grid = document.getElementById('blogGrid');
  const filters = document.querySelectorAll('.blog-filter');
  if (grid && filters.length) {
    const applyFilter = (key) => {
      const cards = grid.querySelectorAll('.blog-card');
      let visible = 0;
      cards.forEach(card => {
        const show = key === 'all' || card.getAttribute('data-category') === key;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      filters.forEach(f => f.classList.toggle('is-active', f.getAttribute('data-filter') === key));
      let empty = grid.parentElement.querySelector('.blog-empty');
      if (visible === 0) {
        if (!empty) {
          empty = document.createElement('p');
          empty.className = 'blog-empty';
          empty.textContent = 'Aucun article dans cette catégorie pour le moment.';
          grid.insertAdjacentElement('afterend', empty);
        }
      } else if (empty) {
        empty.remove();
      }
    };

    filters.forEach(f => {
      f.addEventListener('click', (e) => {
        const key = f.getAttribute('data-filter');
        if (key === 'all') return; // lien normal vers index.html
        e.preventDefault();
        applyFilter(key);
        history.replaceState(null, '', '#' + key);
      });
    });

    const hash = window.location.hash.replace('#', '');
    if (hash && document.querySelector(`.blog-filter[data-filter="${hash}"]`)) {
      applyFilter(hash);
    }
  }

  /* ---- Sommaire actif au défilement (page article) ---- */
  const toc = document.getElementById('blogToc');
  if (toc) {
    const links = Array.from(toc.querySelectorAll('a'));
    const targets = links
      .map(a => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);
    if (targets.length && 'IntersectionObserver' in window) {
      const setActive = (id) => {
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
      };
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      }, { rootMargin: '-20% 0px -70% 0px' });
      targets.forEach(t => observer.observe(t));
    }
  }

  /* ---- Partage natif sur mobile si disponible ---- */
  const shareBox = document.querySelector('.blog-share');
  if (shareBox && navigator.share) {
    const nativeBtn = document.createElement('button');
    nativeBtn.type = 'button';
    nativeBtn.className = 'blog-btn';
    nativeBtn.textContent = 'Partager…';
    nativeBtn.addEventListener('click', () => {
      navigator.share({ title: document.title, url: window.location.href }).catch(() => {});
    });
    shareBox.appendChild(nativeBtn);
  }
});
