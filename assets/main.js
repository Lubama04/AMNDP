document.addEventListener('DOMContentLoaded', () => {
  /* ---- Mobile menu ---- */
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('navMenu');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
    document.querySelectorAll('#navMenu a').forEach(a =>
      a.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      })
    );
  }

  /* ---- FAQ accordion (accessible) ---- */
  document.querySelectorAll('.faq-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        const t = i.querySelector('.faq-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---- Animated counters (Accueil) ---- */
  const counters = document.querySelectorAll('.stat-num[data-count]');
  if (counters.length) {
    const animate = (el) => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(target * eased);
        el.textContent = prefix + value.toLocaleString('fr-FR') + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if ('IntersectionObserver' in window && !prefersReducedMotion) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      counters.forEach(el => observer.observe(el));
    } else {
      counters.forEach(el => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';
        el.textContent = prefix + target.toLocaleString('fr-FR') + suffix;
      });
    }
  }

  /* ---- Generic form submit helper (Vercel serverless functions) ---- */
  const setStatus = (el, message, type) => {
    if (!el) return;
    el.textContent = message;
    el.className = 'form-status visible ' + type;
  };

  const submitForm = async (form, endpoint, statusEl, onSuccess) => {
    const btn = form.querySelector('button[type="submit"]');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }
    setStatus(statusEl, '', '');
    statusEl && statusEl.classList.remove('visible');

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      onSuccess();
    } catch (err) {
      setStatus(
        statusEl,
        "Une erreur est survenue lors de l'envoi. Merci de réessayer, ou de nous contacter directement par téléphone.",
        'error'
      );
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
    }
  };

  /* ---- Contact form ---- */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    const statusEl = document.getElementById('contactFormStatus');
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForm(contactForm, '/api/contact', statusEl, () => {
        setStatus(statusEl, 'Merci, votre message a bien été envoyé. La direction de l’AMNDP vous répondra rapidement.', 'success');
        contactForm.reset();
      });
    });
  }

  /* ---- Donation modal ---- */
  const modal = document.getElementById('donationModal');
  const openBtns = document.querySelectorAll('[data-open-donation]');
  const closeBtns = document.querySelectorAll('[data-close-donation]');
  const donationForm = document.getElementById('donationForm');
  const donationFormWrap = document.getElementById('donationFormWrap');
  const donationConfirm = document.getElementById('donationConfirm');
  let lastFocused = null;

  const openModal = () => {
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const firstField = modal.querySelector('input, select, textarea');
    if (firstField) firstField.focus();
  };
  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  };

  openBtns.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  }));
  closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });
  }

  if (donationForm) {
    const statusEl = document.getElementById('donationFormStatus');
    donationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForm(donationForm, '/api/donate', statusEl, () => {
        if (donationFormWrap && donationConfirm) {
          donationFormWrap.style.display = 'none';
          donationConfirm.style.display = 'block';
        }
        donationForm.reset();
      });
    });
  }
});
