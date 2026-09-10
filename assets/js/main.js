(function () {
  'use strict';

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Sticky nav: scroll + hide-near-footer state ---------------- */
  var nav = document.querySelector('[data-nav]');
  var navLogo = document.querySelector('[data-nav-logo]');
  var footer = document.querySelector('[data-footer]');

  if (nav) {
    var navLogoReversed = navLogo ? navLogo.getAttribute('data-src-reversed') : null;
    var navLogoGold = navLogo ? navLogo.getAttribute('data-src-gold') : null;
    var navScrolled = false;
    var navHidden = false;

    var updateNav = function () {
      var scrolled = window.scrollY > 40;
      if (scrolled !== navScrolled) {
        navScrolled = scrolled;
        nav.classList.toggle('is-scrolled', navScrolled);
        if (navLogo) navLogo.src = navScrolled ? navLogoGold : navLogoReversed;
      }
      var hidden = false;
      if (footer) {
        var r = footer.getBoundingClientRect();
        hidden = r.top < window.innerHeight + window.innerHeight * 0.2;
      }
      if (hidden !== navHidden) {
        navHidden = hidden;
        nav.classList.toggle('is-hidden', navHidden);
      }
    };

    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('resize', updateNav);
  }

  /* ---------------- Mobile menu ---------------- */
  var menuOpenBtn = document.querySelector('[data-menu-open]');
  var menuCloseBtn = document.querySelector('[data-menu-close]');
  var mobileMenu = document.querySelector('[data-mobile-menu]');

  if (menuOpenBtn && mobileMenu) {
    var openMenu = function () {
      mobileMenu.hidden = false;
      document.body.style.overflow = 'hidden';
    };
    var closeMenu = function () {
      mobileMenu.hidden = true;
      document.body.style.overflow = '';
    };
    menuOpenBtn.addEventListener('click', openMenu);
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) closeMenu();
    });
  }

  /* ---------------- Scroll-reveal ---------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var reveal = function (el) { el.classList.add('is-visible'); };

  if (!reducedMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { reveal(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) reveal(el);
      else io.observe(el);
    });
    // Safety net: guarantee nothing stays hidden if observation ever fails.
    setTimeout(function () { revealEls.forEach(reveal); }, 2500);
  } else {
    revealEls.forEach(reveal);
  }

  /* ---------------- Testimonial carousel ---------------- */
  var carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    var cards = Array.prototype.slice.call(carousel.children);
    var dots = Array.prototype.slice.call(document.querySelectorAll('[data-carousel-dot]'));
    var prevBtn = document.querySelector('[data-carousel-prev]');
    var nextBtn = document.querySelector('[data-carousel-next]');
    var quoteIndex = 0;
    var raf = null;

    var setActive = function (i) {
      quoteIndex = i;
      dots.forEach(function (d, di) { d.classList.toggle('is-active', di === i); });
    };

    var goToQuote = function (i) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      setActive(i);
      var card = cards[i];
      if (card) carousel.scrollTo({ left: card.offsetLeft, behavior: reducedMotion ? 'auto' : 'smooth' });
    };

    dots.forEach(function (dot, i) { dot.addEventListener('click', function () { goToQuote(i); }); });
    if (prevBtn) prevBtn.addEventListener('click', function () { goToQuote(quoteIndex - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goToQuote(quoteIndex + 1); });

    carousel.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var closest = 0, min = Infinity;
        cards.forEach(function (c, i) {
          var d = Math.abs(c.offsetLeft - carousel.scrollLeft);
          if (d < min) { min = d; closest = i; }
        });
        if (closest !== quoteIndex) setActive(closest);
      });
    }, { passive: true });

    carousel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goToQuote(quoteIndex + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToQuote(quoteIndex - 1); }
    });

    setActive(0);
  }

  /* ---------------- Contact form ---------------- */
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    var errorEl = document.querySelector('[data-form-error]');
    var confirmEl = document.querySelector('[data-form-confirm]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements['name'].value.trim();
      var email = form.elements['email'].value.trim();
      var message = form.elements['message'].value.trim();
      var consent = form.elements['consent'].checked;

      if (!name || !email || !message || !consent) {
        if (errorEl) {
          errorEl.textContent = 'Please complete every field and confirm the privacy notice.';
          errorEl.hidden = false;
        }
        return;
      }

      if (errorEl) errorEl.hidden = true;
      form.hidden = true;
      if (confirmEl) confirmEl.hidden = false;
    });
  }

  /* ---------------- Cookie consent ---------------- */
  var STORAGE_KEY = 'ph_cookie_consent';
  var banner = document.querySelector('[data-cookie-banner]');
  var panel = document.querySelector('[data-cookie-panel]');
  var analyticsToggle = document.querySelector('[data-cookie-analytics-toggle]');
  var cookieSettingsLinks = document.querySelectorAll('[data-cookie-settings]');
  var gaLoaded = false;

  var loadAnalytics = function () {
    if (gaLoaded) return;
    gaLoaded = true;
    var GA_ID = 'G-XXXXXXXXXX'; // placeholder — replace with the real Measurement ID
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  };

  var saveConsent = function (analytics) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ necessary: true, analytics: analytics, date: new Date().toISOString() }));
    } catch (e) {}
  };

  var showBanner = function (show) { if (banner) banner.hidden = !show; };
  var showPanel = function (show) { if (panel) panel.hidden = !show; };

  var openPanel = function (currentAnalyticsConsent) {
    if (analyticsToggle) analyticsToggle.checked = currentAnalyticsConsent;
    showBanner(false);
    showPanel(true);
  };

  var consentAnalytics = false;

  if (banner || panel) {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved.analytics === 'boolean') {
        consentAnalytics = saved.analytics;
        if (saved.analytics) loadAnalytics();
      } else {
        showBanner(true);
      }
    } catch (e) {
      showBanner(true);
    }

    document.querySelectorAll('[data-cookie-accept]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveConsent(true);
        loadAnalytics();
        consentAnalytics = true;
        showBanner(false);
        showPanel(false);
      });
    });

    document.querySelectorAll('[data-cookie-reject]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveConsent(false);
        consentAnalytics = false;
        showBanner(false);
        showPanel(false);
      });
    });

    document.querySelectorAll('[data-cookie-manage]').forEach(function (btn) {
      btn.addEventListener('click', function () { openPanel(consentAnalytics); });
    });

    cookieSettingsLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        openPanel(consentAnalytics);
      });
    });

    document.querySelectorAll('[data-cookie-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { showPanel(false); });
    });

    document.querySelectorAll('[data-cookie-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var analytics = analyticsToggle ? analyticsToggle.checked : false;
        saveConsent(analytics);
        if (analytics) loadAnalytics();
        consentAnalytics = analytics;
        showPanel(false);
      });
    });

    if (window.location.hash === '#cookie-settings') openPanel(consentAnalytics);
  }
})();
