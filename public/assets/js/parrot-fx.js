/* ============================================================
   Parrot-OS Visual FX  —  parrot-fx.js   (complete rewrite)
   Self-contained IIFE, safe before/after DOM ready.
   Gates on prefers-reduced-motion and .motion-ok.
   ============================================================ */
(() => {
  'use strict';

  /* ── helpers ───────────────────────────────────────────── */
  const reduced = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  })();

  const touch = (() => {
    try {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
      );
    } catch { return false; }
  })();

  const motionOk = () =>
    document.documentElement.classList.contains('motion-ok');

  /* Wait for body.loader-active to be removed, then call fn. */
  function onLoaderDone(fn) {
    if (!document.body.classList.contains('loader-active')) {
      window.setTimeout(fn, 0);
      return;
    }
    const obs = new MutationObserver(() => {
      if (!document.body.classList.contains('loader-active')) {
        obs.disconnect();
        fn();
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* Resolve after `ms` milliseconds. */
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  /* Type `text` into `el.textContent` one character at a time. */
  function typeInto(el, text, baseMs) {
    return new Promise(resolve => {
      let i = 0;
      function next() {
        if (i >= text.length) { resolve(); return; }
        el.textContent += text[i];
        i++;
        window.setTimeout(next, baseMs + (Math.random() * baseMs * 0.45 | 0));
      }
      next();
    });
  }

  /* ══════════════════════════════════════════════════════════
     1.  CLI Terminal Name Animation
         After loader exits, injects a Parrot OS terminal window
         into .hero-content and types out:
           root@parrot:~/subashParrotVM# whoami
           Subash Lama              ← large, glowing
           root@parrot:~/subashParrotVM# █  (blinking cursor)
         The existing h1.hero-name is sr-only'ed via CSS class.
  ══════════════════════════════════════════════════════════ */
  function initCliTerminal() {
    const heroContent = document.querySelector('.hero-content');
    const heroSection = document.querySelector('.hero-section');
    if (!heroContent || !heroSection) return;

    /* ── Build the terminal DOM ─────────────────────────── */
    const terminal = document.createElement('div');
    terminal.className = 'parrot-cli-terminal';
    terminal.setAttribute('aria-hidden', 'true');

    terminal.innerHTML = [
      '<div class="parrot-cli-header">',
      '  <span class="parrot-cli-dot parrot-cli-dot--red"></span>',
      '  <span class="parrot-cli-dot parrot-cli-dot--yellow"></span>',
      '  <span class="parrot-cli-dot parrot-cli-dot--green"></span>',
      '  <span class="parrot-cli-title">root@parrot \u2014 ~/subashParrotVM</span>',
      '</div>',
      '<div class="parrot-cli-body">',

      /* First prompt + command line */
      '  <div>',
      '    <span class="parrot-cli-ps1" id="pcPs1a">',
      '\u250c\u2500\u2500(root\u2625parrot)-[~/subashParrotVM]\n',
      '\u2514\u2500# </span>',
      '  </div>',
      '  <div class="parrot-cli-cmd-row">',
      '    <span class="parrot-cli-cmd-text" id="pcCmd"></span>',
      '    <span class="parrot-cli-cursor" id="pcCursor1"></span>',
      '  </div>',

      /* Name output — hidden until typed */
      '  <div class="parrot-cli-name-output" id="pcName"></div>',

      /* Second idle prompt */
      '  <div class="parrot-cli-idle-row" id="pcIdle" style="display:none">',
      '    <span class="parrot-cli-ps1">',
      '\u250c\u2500\u2500(root\u2625parrot)-[~/subashParrotVM]\n',
      '\u2514\u2500# </span>',
      '    <span class="parrot-cli-cursor is-blinking"></span>',
      '  </div>',

      '</div>'
    ].join('');

    /* Insert before the h1, then sr-only the h1 */
    heroContent.insertBefore(terminal, heroContent.firstChild);
    heroSection.classList.add('parrot-cli-mode');

    const cmdEl    = terminal.querySelector('#pcCmd');
    const cursor1  = terminal.querySelector('#pcCursor1');
    const nameOut  = terminal.querySelector('#pcName');
    const idleRow  = terminal.querySelector('#pcIdle');

    /* ── Animation sequence (runs after loader exits) ───── */
    async function run() {
      await wait(280);

      /* Slide terminal in */
      terminal.classList.add('is-visible');
      await wait(560);

      /* Type the command */
      await typeInto(cmdEl, 'whoami', 68);
      await wait(320);

      /* Hide typing cursor */
      cursor1.style.display = 'none';

      /* Reveal the name */
      nameOut.textContent = 'Subash Lama';
      nameOut.classList.add('is-shown');
      await wait(160);

      /* Scan sweep through the name */
      nameOut.classList.add('scan-active');
      await wait(820);

      /* Show idle prompt with blinking cursor */
      idleRow.style.display = '';
    }

    onLoaderDone(run);
  }

  /* ══════════════════════════════════════════════════════════
     2.  Page HUD  —  corner brackets + periodic sweep line
         Four fixed corner brackets pulse continuously.
         A cyan scan line sweeps the full page height on load
         and then every 16–28 seconds.
  ══════════════════════════════════════════════════════════ */
  function initPageHud() {
    if (reduced) return;

    /* Corner brackets */
    const corners = document.createElement('div');
    corners.className = 'parrot-hud-corners';
    corners.setAttribute('aria-hidden', 'true');
    corners.innerHTML = [
      '<span class="parrot-hud-corner parrot-hud-corner--tl"></span>',
      '<span class="parrot-hud-corner parrot-hud-corner--tr"></span>',
      '<span class="parrot-hud-corner parrot-hud-corner--bl"></span>',
      '<span class="parrot-hud-corner parrot-hud-corner--br"></span>'
    ].join('');
    document.body.appendChild(corners);

    /* Sweep line */
    const sweep = document.createElement('div');
    sweep.className = 'parrot-page-scan';
    sweep.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sweep);

    let sweepHandle;

    function triggerSweep() {
      sweep.classList.remove('is-sweeping');
      void sweep.offsetWidth;          /* force reflow to restart animation */
      sweep.classList.add('is-sweeping');

      const interval = 16000 + Math.random() * 12000;
      sweepHandle = window.setTimeout(triggerSweep, interval);
    }

    onLoaderDone(() => window.setTimeout(triggerSweep, 1400));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.clearTimeout(sweepHandle);
      } else {
        triggerSweep();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     3.  Matrix Rain Canvas
         Background canvas with DevOps / security characters
         in Parrot green (#50fa7b) and cyan (#8be9fd).
         Fade in after loader, capped at 18 fps to save CPU.
  ══════════════════════════════════════════════════════════ */
  function initMatrixRain() {
    if (reduced || touch) return;

    const canvas = document.getElementById('parrot-rain');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* Character set: hex, terminal symbols, DevOps glyphs */
    const CHARS = '0123456789ABCDEFabcdef/\\|[]{}:;.,!@#$%*_=+-~$#>01KNSRV'.split('');
    const FONT  = 13;
    const FPS   = 18;

    let cols, drops, colTheme;
    let animId, lastTs = 0;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      cols     = Math.floor(canvas.width / FONT);
      drops    = Array.from({ length: cols }, () =>
        Math.floor(Math.random() * -(canvas.height / FONT) * 2)
      );
      colTheme = Array.from({ length: cols }, () =>
        Math.random() > 0.38 ? 'g' : 'c'   /* g = green, c = cyan */
      );
    }

    function draw(ts) {
      if (document.hidden) { animId = requestAnimationFrame(draw); return; }
      if (ts - lastTs < 1000 / FPS) { animId = requestAnimationFrame(draw); return; }
      lastTs = ts;

      /* Faint dark trail → tail fade illusion */
      ctx.fillStyle = 'rgba(1, 5, 12, 0.13)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = FONT + 'px monospace';

      for (let i = 0; i < cols; i++) {
        const y = drops[i] * FONT;
        if (y < -FONT || y > canvas.height + FONT) { drops[i]++; continue; }

        const char = CHARS[Math.random() * CHARS.length | 0];
        const x    = i * FONT;

        /* Leading character: bright near-white flash */
        if (drops[i] % 22 === 0) {
          ctx.fillStyle = 'rgba(230, 255, 245, 1)';
        } else if (colTheme[i] === 'g') {
          const a = 0.48 + Math.random() * 0.52;
          ctx.fillStyle = `rgba(80,250,123,${a.toFixed(2)})`;
        } else {
          const a = 0.42 + Math.random() * 0.48;
          ctx.fillStyle = `rgba(139,233,253,${a.toFixed(2)})`;
        }

        ctx.fillText(char, x, y);

        /* Randomly reset column at bottom */
        if (y > canvas.height && Math.random() > 0.974) {
          drops[i]    = 0;
          colTheme[i] = Math.random() > 0.38 ? 'g' : 'c';
        }
        drops[i]++;
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !animId) animId = requestAnimationFrame(draw);
    });

    onLoaderDone(() => {
      window.setTimeout(() => {
        canvas.classList.add('is-ready');
        animId = requestAnimationFrame(draw);
      }, 1100);
    });
  }

  /* ══════════════════════════════════════════════════════════
     4.  Section Title Glitch  (h2 on scroll reveal)
         Each glass-card h2 gets a chromatic-aberration glitch
         burst the first time it scrolls into view.
  ══════════════════════════════════════════════════════════ */
  function initTitleGlitch() {
    if (reduced || !motionOk()) return;
    if (!('IntersectionObserver' in window)) return;

    document.querySelectorAll('.glass-card h2').forEach(h2 => {
      h2.classList.add('section-h2');
      h2.setAttribute('data-text', h2.textContent.trim());
    });

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const h2 = entry.target.querySelector('.section-h2');
        if (!h2 || h2.dataset.glitchDone) return;

        window.setTimeout(() => {
          h2.classList.add('glitch-active');
          h2.dataset.glitchDone = 'true';
          window.setTimeout(() => h2.classList.remove('glitch-active'), 720);
        }, 200);

        obs.unobserve(entry.target);
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.glass-card').forEach(s => obs.observe(s));
  }

  /* ══════════════════════════════════════════════════════════
     5.  Card Scan Lines
         Injected <span> (no ::before conflict with motion.css).
         Fires on: (a) first scroll-into-view, (b) every hover.
  ══════════════════════════════════════════════════════════ */
  function initCardScans() {
    if (reduced || touch || !motionOk()) return;

    /* Inject one scanline span per card */
    document.querySelectorAll('.glass-card').forEach(card => {
      if (window.getComputedStyle(card).position === 'static') {
        card.style.position = 'relative';
      }
      const span = document.createElement('span');
      span.className = 'parrot-scanline';
      span.setAttribute('aria-hidden', 'true');
      card.insertBefore(span, card.firstChild);

      function fire() {
        span.classList.remove('is-scanning');
        void span.offsetWidth;
        span.classList.add('is-scanning');
      }

      /* Hover retrigger */
      card.addEventListener('mouseenter', fire, { passive: true });
    });

    /* Scroll-into-view trigger (fires once) */
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const span = entry.target.querySelector('.parrot-scanline');
        if (!span || span.dataset.entryFired) return;
        span.dataset.entryFired = 'true';
        window.setTimeout(() => {
          span.classList.remove('is-scanning');
          void span.offsetWidth;
          span.classList.add('is-scanning');
        }, 280);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.glass-card').forEach(s => obs.observe(s));
  }

  /* ══════════════════════════════════════════════════════════
     6.  Skill Pill Stagger
         Sets CSS custom property --pill-i per pill so the
         CSS transition-delay cascade in parrot-fx.css works.
  ══════════════════════════════════════════════════════════ */
  function initPillStagger() {
    document.querySelectorAll('.skill-pills').forEach(group => {
      group.querySelectorAll('.skill-pill').forEach((pill, i) => {
        pill.style.setProperty('--pill-i', i);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     7.  Tagline Cursor
         Appends a blinking _ to .hero-tagline.
  ══════════════════════════════════════════════════════════ */
  function initTaglineCursor() {
    const tagline = document.querySelector('.hero-tagline');
    if (!tagline) return;
    const cur = document.createElement('span');
    cur.className = 'hero-tagline-cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.textContent = '_';
    tagline.appendChild(cur);
  }

  /* ══════════════════════════════════════════════════════════
     Bootstrap
  ══════════════════════════════════════════════════════════ */
  function init() {
    initCliTerminal();    /* star effect — CLI name + Parrot prompt */
    initPageHud();        /* corner brackets + periodic page sweep  */
    initMatrixRain();     /* background canvas rain                 */
    initTitleGlitch();    /* h2 glitch on scroll reveal             */
    initCardScans();      /* card entry + hover scan lines          */
    initPillStagger();    /* skill pill CSS setup                   */
    initTaglineCursor();  /* blinking _ on tagline                  */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
