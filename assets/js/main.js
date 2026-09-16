(function () {
  'use strict';

  /* ---------------- Hero watermark parallax ---------------- */
  // Drifting the dove at a fraction of scroll speed reads as depth.
  var parallaxEl = document.querySelector('[data-parallax]');
  var parallaxHero = parallaxEl && parallaxEl.closest('.hero');
  if (parallaxHero) {
    var parallaxTicking = false;

    var updateParallax = function () {
      parallaxTicking = false;
      // Once the hero is off screen the transform is clipped away, so stop paying for it.
      if (parallaxHero.getBoundingClientRect().bottom <= 0) return;
      parallaxEl.style.setProperty('--parallax-y', (window.scrollY * 0.22).toFixed(1) + 'px');
    };

    var queueParallax = function () {
      if (parallaxTicking) return;
      parallaxTicking = true;
      requestAnimationFrame(updateParallax);
    };

    updateParallax();
    window.addEventListener('scroll', queueParallax, { passive: true });
  }

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
      // Read the fade length off the CSS rather than repeating it here — hiding the
      // panel early would cut the fade-out dead.
      menuCloseTimer = setTimeout(function () {
        mobileMenu.hidden = true;
        menuCloseTimer = null;
      }, (parseFloat(getComputedStyle(mobileMenu).transitionDuration) || 0) * 1000);
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

  if ('IntersectionObserver' in window) {
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
    var originals = Array.prototype.slice.call(carousel.children);
    var count = originals.length;
    // A duplicate run after the last card means the wrap to the first is a one-card
    // step into the copy followed by an invisible jump home, not a scroll all the
    // way back across the track.
    originals.forEach(function (card) {
      var clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      carousel.appendChild(clone);
    });
    var cards = Array.prototype.slice.call(carousel.children);
    var dots = Array.prototype.slice.call(document.querySelectorAll('[data-carousel-dot]'));
    var prevBtn = document.querySelector('[data-carousel-prev]');
    var nextBtn = document.querySelector('[data-carousel-next]');
    var region = carousel.closest('section') || carousel;
    var quoteIndex = 0;
    var raf = null;
    var autoplayTimeout = null;
    var slideRaf = null;
    var autoplayPaused = false;
    var AUTOPLAY_MS = 5000;
    var SLIDE_MS = 620;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var ignoreScrollUntil = 0;

    var setActive = function (i) {
      quoteIndex = i;
      var active = i % count;
      dots.forEach(function (d, di) {
        d.classList.toggle('is-active', di === active);
        if (di === active) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    };

    var stopAutoplay = function () {
      if (autoplayTimeout) { clearTimeout(autoplayTimeout); autoplayTimeout = null; }
    };

    // WCAG 2.2.2 requires a pause mechanism for content that moves on its own.
    var resetAutoplay = function () {
      stopAutoplay();
      if (autoplayPaused || document.hidden || count < 2) return;
      autoplayTimeout = setTimeout(function () {
        goToQuote(quoteIndex + 1);
      }, AUTOPLAY_MS);
    };

    // Our own scrolling emits scroll events the whole way. Left unguarded, the handler
    // below reads a half-finished position, flips the dot to the nearest card and
    // restarts the interval mid-transition.
    // offsetLeft is measured from the nearest positioned ancestor, not the track, so it
    // carries the page gutter with it. Subtracting the first card's own offset gives the
    // distance the track has to travel.
    var offsetOf = function (i) { return cards[i].offsetLeft - cards[0].offsetLeft; };

    var jumpTo = function (i) {
      if (slideRaf) { cancelAnimationFrame(slideRaf); slideRaf = null; carousel.style.scrollSnapType = ''; }
      ignoreScrollUntil = Date.now() + 200;
      carousel.scrollLeft = offsetOf(i);
    };

    // scroll-behavior:smooth hands the easing to the browser, and under mandatory
    // snapping some of them drop the animation and snap outright. Driving it here
    // keeps the ease-out consistent everywhere.
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

    var slideTo = function (i, done) {
      var target = offsetOf(i);
      var start = carousel.scrollLeft;
      var delta = target - start;
      if (slideRaf) { cancelAnimationFrame(slideRaf); slideRaf = null; }
      if (!delta || reduceMotion.matches) {
        carousel.style.scrollSnapType = '';
        ignoreScrollUntil = Date.now() + 200;
        carousel.scrollLeft = target;
        if (done) done();
        return;
      }
      // Snapping fights a scripted tween frame by frame, so lift it for the duration.
      carousel.style.scrollSnapType = 'none';
      var t0 = performance.now();
      var step = function (now) {
        var t = Math.min(1, (now - t0) / SLIDE_MS);
        ignoreScrollUntil = Date.now() + 200;
        carousel.scrollLeft = start + delta * easeOut(t);
        if (t < 1) { slideRaf = requestAnimationFrame(step); return; }
        slideRaf = null;
        carousel.style.scrollSnapType = '';
        if (done) done();
      };
      slideRaf = requestAnimationFrame(step);
    };

    var goToQuote = function (i) {
      // A wrap cut short mid-slide can leave the track sitting in the copied run.
      // Bring it home first so the index can never climb off the end of the track.
      if (quoteIndex >= count) {
        jumpTo(quoteIndex - count);
        setActive(quoteIndex - count);
        i -= count;
      }
      if (i < 0) {
        // Enter the copied run at the matching card first, so stepping back from the
        // first quote travels one card rather than the length of the track.
        jumpTo(count);
        i = count - 1;
      }
      setActive(i);
      slideTo(i, function () {
        // Once the slide has landed on the copy, swap to the identical-looking original
        // so the track always has cards ahead of it.
        if (i >= count) { jumpTo(i - count); setActive(i - count); }
      });
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
      if (raf || Date.now() < ignoreScrollUntil) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var closest = 0, min = Infinity;
        for (var i = 0; i < cards.length; i++) {
          var d = Math.abs(offsetOf(i) - carousel.scrollLeft);
          if (d < min) { min = d; closest = i; }
        }
        // A swipe that lands on a new card earns a fresh interval, not the tail of the old one.
        if (closest === quoteIndex) return;
        // A swipe that carries into the copied run gets pulled back to its original, or
        // the track would eventually scroll off its own end.
        if (closest >= count) { jumpTo(closest - count); closest -= count; }
        setActive(closest);
        resetAutoplay();
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
    var GA_ID = 'G-QL5EXM8TCN';
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

  // Reading the stored choice sits outside the banner wiring below: the legal pages
  // carry no banner markup, and an acceptance already given has to be honoured there
  // too or analytics would only ever run on the home page.
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved.analytics === 'boolean') {
      consentAnalytics = saved.analytics;
      if (consentAnalytics) loadAnalytics();
    } else {
      showBanner(true);
    }
  } catch (e) {
    showBanner(true);
  }

  if (banner || panel) {

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
