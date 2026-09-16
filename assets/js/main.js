(function () {
  'use strict';

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Smooth anchor scrolling ---------------- */
  // CSS scroll-behavior:smooth isn't reliably honoured by every browser (notably
  // older Safari), so drive same-page anchor jumps from JS to guarantee the animation.
  document.querySelectorAll('a[href^="#"]:not([href="#"]):not(.skip-link)').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      if (window.history && window.history.pushState) window.history.pushState(null, '', link.getAttribute('href'));
    });
  });

  /* ---------------- Sticky nav: scroll + hide-near-footer state ---------------- */
  var nav = document.querySelector('[data-nav]');
  var navLogo = document.querySelector('[data-nav-logo]');
  var footer = document.querySelector('[data-footer]');

  if (nav) {
    var navLogoReversed = navLogo ? navLogo.getAttribute('data-src-reversed') : null;
    var navLogoGold = navLogo ? navLogo.getAttribute('data-src-gold') : null;
    var navScrolled = false;
    var navHidden = false;
    var navTicking = false;

    var updateNav = function () {
      navTicking = false;
      var scrolled = window.scrollY > 40;
      if (scrolled !== navScrolled) {
        navScrolled = scrolled;
        nav.classList.toggle('is-scrolled', navScrolled);
        if (navLogo) navLogo.src = navScrolled ? navLogoGold : navLogoReversed;
      }
      // Retreat as the footer enters the viewport, not a fifth of a screen before it.
      var hidden = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      if (hidden !== navHidden) {
        navHidden = hidden;
        nav.classList.toggle('is-hidden', navHidden);
      }
    };

    var queueNavUpdate = function () {
      if (navTicking) return;
      navTicking = true;
      requestAnimationFrame(updateNav);
    };

    updateNav();
    window.addEventListener('scroll', queueNavUpdate, { passive: true });
    window.addEventListener('resize', queueNavUpdate);
  }

  /* ---------------- Mobile menu ---------------- */
  var menuOpenBtn = document.querySelector('[data-menu-open]');
  var menuCloseBtn = document.querySelector('[data-menu-close]');
  var mobileMenu = document.querySelector('[data-mobile-menu]');

  if (menuOpenBtn && mobileMenu) {
    var menuCloseTimer = null;
    var menuIsOpen = function () { return !mobileMenu.hidden; };

    var openMenu = function () {
      if (menuCloseTimer) { clearTimeout(menuCloseTimer); menuCloseTimer = null; }
      mobileMenu.hidden = false;
      document.body.style.overflow = 'hidden';
      // The panel must paint once at opacity 0 before the class lands, or the fade is skipped.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { mobileMenu.classList.add('is-open'); });
      });
      if (menuCloseBtn) menuCloseBtn.focus();
    };

    var closeMenu = function () {
      if (!menuIsOpen()) return;
      mobileMenu.classList.remove('is-open');
      document.body.style.overflow = '';
      menuCloseTimer = setTimeout(function () {
        mobileMenu.hidden = true;
        menuCloseTimer = null;
      }, reducedMotion ? 0 : 280);
      menuOpenBtn.focus();
    };

    menuOpenBtn.addEventListener('click', openMenu);
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900 && menuIsOpen()) closeMenu();
    });

    // aria-modal="true" promises containment, so Escape and a tab loop have to honour it.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuIsOpen()) closeMenu();
    });

    mobileMenu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusable = mobileMenu.querySelectorAll('a[href], button:not([disabled])');
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------------- Scroll-reveal ---------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var reveal = function (el) { el.classList.add('is-visible'); };

  if (!reducedMotion && 'IntersectionObserver' in window) {
    var observerReported = false;
    var io = new IntersectionObserver(function (entries) {
      observerReported = true;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { reveal(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) reveal(el);
      else io.observe(el);
    });
    // Only fires if the observer never reported at all. Revealing unconditionally would
    // uncover the whole page up front and leave scroll-reveal doing nothing thereafter.
    setTimeout(function () {
      if (!observerReported) revealEls.forEach(reveal);
    }, 1200);
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
    var region = carousel.closest('section') || carousel;
    var quoteIndex = 0;
    var raf = null;
    var autoplayTimeout = null;
    var autoplayPaused = false;
    var AUTOPLAY_MS = 7000;

    var setActive = function (i) {
      quoteIndex = i;
      dots.forEach(function (d, di) {
        d.classList.toggle('is-active', di === i);
        if (di === i) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    };

    var stopAutoplay = function () {
      if (autoplayTimeout) { clearTimeout(autoplayTimeout); autoplayTimeout = null; }
    };

    // WCAG 2.2.2 requires a pause mechanism for content that moves on its own; reduced-motion
    // users opt out of the movement altogether.
    var resetAutoplay = function () {
      stopAutoplay();
      if (reducedMotion || autoplayPaused || document.hidden || cards.length < 2) return;
      autoplayTimeout = setTimeout(function () {
        goToQuote((quoteIndex + 1) % cards.length);
      }, AUTOPLAY_MS);
    };

    var goToQuote = function (i) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      setActive(i);
      var card = cards[i];
      if (card) carousel.scrollTo({ left: card.offsetLeft, behavior: reducedMotion ? 'auto' : 'smooth' });
      resetAutoplay();
    };

    var pauseAutoplay = function () { autoplayPaused = true; stopAutoplay(); };
    var resumeAutoplay = function () {
      if (region.matches(':hover') || region.contains(document.activeElement)) return;
      autoplayPaused = false;
      resetAutoplay();
    };

    region.addEventListener('mouseenter', pauseAutoplay);
    region.addEventListener('mouseleave', resumeAutoplay);
    region.addEventListener('focusin', pauseAutoplay);
    region.addEventListener('focusout', resumeAutoplay);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAutoplay(); else resetAutoplay();
    });

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
        // A swipe that lands on a new card earns a fresh interval, not the tail of the old one.
        if (closest !== quoteIndex) { setActive(closest); resetAutoplay(); }
      });
    }, { passive: true });

    carousel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goToQuote(quoteIndex + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToQuote(quoteIndex - 1); }
    });

    setActive(0);
    resetAutoplay();
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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel && !panel.hidden) showPanel(false);
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
