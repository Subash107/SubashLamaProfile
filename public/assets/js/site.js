/* Trusted Types default policy — allows controlled innerHTML usage.
   Prevents untrusted strings from reaching DOM sinks.
   User input must go through textContent (never innerHTML). */
if (typeof window !== "undefined" && window.trustedTypes && window.trustedTypes.createPolicy) {
  try {
    window.trustedTypes.createPolicy("default", {
      createHTML:      (s) => s,
      createScript:    (s) => s,
      createScriptURL: (s) => s,
    });
  } catch { /* policy already defined */ }
}

(() => {
  function prefersReducedMotion() {
    try {
      return !!(
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch {
      return false;
    }
  }

  function isTouchDevice() {
    try {
      return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        (window.matchMedia && window.matchMedia("(max-width: 768px)").matches)
      );
    } catch {
      return false;
    }
  }

  function getBackgroundVideoPolicy() {
    try {
      if (prefersReducedMotion()) return { load: false, variant: "mobile" };

      const connection =
        navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const effectiveType = String(
        connection && connection.effectiveType ? connection.effectiveType : ""
      );

      const isMobileViewport =
        window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
      const isSlowish = effectiveType === "3g";
      const variant = isMobileViewport || isSlowish ? "mobile" : "desktop";

      if (isMobileViewport) return { load: false, variant: "mobile" };

      if (!connection) return { load: true, variant };

      if (connection.saveData) return { load: false, variant };

      if (effectiveType === "slow-2g" || effectiveType === "2g") {
        return { load: false, variant };
      }

      return { load: true, variant };
    } catch {
      return { load: true, variant: "desktop" };
    }
  }

  function scheduleDeferredTask(callback, { timeout = 1500, delay = 0 } = {}) {
    const run = () => {
      if (delay > 0) {
        window.setTimeout(callback, delay);
        return;
      }
      callback();
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout });
      return;
    }

    window.setTimeout(run, delay || 180);
  }

  function initBackgroundVideo() {
    const policy = getBackgroundVideoPolicy();

    document.querySelectorAll("video[data-bg-video]").forEach((video) => {
      const sources = video.querySelectorAll("source[data-src]");
      if (!sources.length) return;

      if (!policy.load) {
        sources.forEach((source) => source.removeAttribute("src"));
        return;
      }

      sources.forEach((source) => {
        const dataSrc =
          policy.variant === "mobile"
            ? source.getAttribute("data-src-mobile") || source.getAttribute("data-src")
            : source.getAttribute("data-src");
        if (dataSrc && !source.getAttribute("src")) {
          source.setAttribute("src", dataSrc);
        }
      });

      try {
        video.load();
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      } catch {
        // Poster stays as fallback.
      }
    });
  }

  function initAudioToggle() {
    const toggle = document.querySelector("[data-audio-toggle]");
    const audio = document.querySelector("audio[data-bg-audio]");
    if (!toggle || !audio) return;

    const source = audio.querySelector("source[data-src]");
    const key =
      toggle.getAttribute("data-audio-storage-key") || "portfolio_audio_enabled";

    const labelOn = toggle.getAttribute("data-audio-label-on") || "Sound: On";
    const labelOff =
      toggle.getAttribute("data-audio-label-off") || "Sound: Off";

    let wantAudio = false;
    try {
      wantAudio = localStorage.getItem(key) === "true";
    } catch {
      wantAudio = false;
    }

    function setUi(on) {
      toggle.textContent = on ? labelOn : labelOff;
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      toggle.classList.toggle("is-on", on);
    }

    function ensureAudioLoaded() {
      if (!source) return;
      if (!source.getAttribute("src")) {
        source.setAttribute("src", source.getAttribute("data-src") || "");
        audio.load();
      }
    }

    async function tryPlay() {
      ensureAudioLoaded();
      try {
        await audio.play();
        return true;
      } catch {
        return false;
      }
    }

    function persist(on) {
      try {
        localStorage.setItem(key, on ? "true" : "false");
      } catch {
        // Ignore persistence failures.
      }
    }

    async function setWantAudio(on) {
      wantAudio = on;
      persist(on);
      setUi(on);

      if (!on) {
        try {
          audio.pause();
        } catch {
          // Ignore.
        }
        return;
      }

      const ok = await tryPlay();
      if (!ok) {
        wantAudio = false;
        persist(false);
        setUi(false);
      }
    }

    setUi(wantAudio);
    if (wantAudio) {
      ensureAudioLoaded();
      const resumeOnGesture = async () => {
        const ok = await tryPlay();
        if (!ok) {
          wantAudio = false;
          persist(false);
          setUi(false);
        }
      };
      document.addEventListener("pointerdown", resumeOnGesture, { once: true });
      document.addEventListener("keydown", resumeOnGesture, { once: true });
    }

    toggle.addEventListener("click", () => {
      setWantAudio(!wantAudio);
    });
  }

  async function initResumeDownload() {
    const resumeLink = document.querySelector("[data-resume-download]");
    if (!resumeLink || typeof window.fetch !== "function") return;

    const manifestPath = resumeLink.getAttribute("data-resume-manifest");
    if (!manifestPath) return;

    try {
      const response = await fetch(manifestPath, { cache: "no-store" });
      if (!response.ok) return;

      const manifest = await response.json();
      if (!manifest || !manifest.publicPath) return;

      const versionSuffix = manifest.version
        ? `?v=${encodeURIComponent(manifest.version)}`
        : "";

      resumeLink.setAttribute("href", `${manifest.publicPath}${versionSuffix}`);

      if (manifest.downloadFileName) {
        resumeLink.setAttribute("download", manifest.downloadFileName);
      }
    } catch {
      // Keep the fallback href already in the markup.
    }
  }

  function initScrollReveal() {
    if (prefersReducedMotion()) return;

    const revealElements = new Set();

    const mark = (element, variant, delayMs) => {
      if (!element || element.nodeType !== 1) return;
      if (element.hasAttribute("data-reveal")) return;

      element.setAttribute("data-reveal", variant);
      if (delayMs) {
        element.style.setProperty("--reveal-delay", `${delayMs}ms`);
      }
      revealElements.add(element);
    };

    document.querySelectorAll("section.glass-card").forEach((section, index) => {
      mark(section, "fade", Math.min(index, 8) * 90);
    });

    document.querySelectorAll(".project-list").forEach((list) => {
      Array.from(list.querySelectorAll(".project-card")).forEach((card, index) => {
        mark(card, "lift", index * 85);
      });
    });

    document.querySelectorAll(".skill-groups").forEach((grid) => {
      Array.from(grid.querySelectorAll(".skill-group")).forEach((group, index) => {
        mark(group, "lift", index * 90);
      });
    });

    document.querySelectorAll(".why-hire-list").forEach((list) => {
      Array.from(list.querySelectorAll("li")).forEach((item, index) => {
        mark(item, "pop", index * 70);
      });
    });

    document.querySelectorAll(".contact-details").forEach((details) => {
      Array.from(details.children).forEach((line, index) => {
        mark(line, "pop", index * 70);
      });
    });

    document.querySelectorAll(".footer").forEach((footer) => {
      mark(footer, "fade", 120);
    });

    document.querySelectorAll(".project-category").forEach((category, index) => {
      mark(category, "fade", Math.min(index, 8) * 110);
      Array.from(category.querySelectorAll(".project-card")).forEach(
        (card, cardIndex) => {
          mark(card, "lift", cardIndex * 85);
        }
      );
    });

    const elements = Array.from(revealElements);
    if (!elements.length) return;

    const show = (element) => element.classList.add("is-visible");

    if (!("IntersectionObserver" in window)) {
      elements.forEach(show);
      return;
    }

    const inView = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    };

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          show(entry.target);
          obs.unobserve(entry.target);
        });
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -12% 0px",
      }
    );

    elements.forEach((element) => {
      if (inView(element)) {
        show(element);
        return;
      }
      observer.observe(element);
    });
  }

  if (!prefersReducedMotion()) {
    document.documentElement.classList.add("motion-ok");
  }

  function initSectionReveal() {
    if (prefersReducedMotion()) return;
    const sections = document.querySelectorAll("[data-reveal]");
    if (!sections.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
    sections.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) { el.classList.add("is-revealed"); return; }
      observer.observe(el);
    });
  }

  function initBackToTop() {
    const btn = document.getElementById("backToTop");
    if (!btn) return;
    const onScroll = () => btn.classList.toggle("is-visible", window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function initScrollProgress() {
    const bar = document.getElementById("scrollProgress");
    if (!bar) return;
    const update = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
      bar.style.setProperty("--scroll-pct", `${pct}%`);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initStickyNav() {
    const nav = document.getElementById("stickyNav");
    const hero = document.querySelector(".hero-section");
    if (!nav || !hero) return;

    const stickyLinks = nav.querySelectorAll("a[href^='#']");

    const onScroll = () => {
      const heroGone = hero.getBoundingClientRect().bottom < 0;
      nav.classList.toggle("is-visible", heroGone);

      if (!heroGone) return;
      stickyLinks.forEach((link) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        const rect = target.getBoundingClientRect();
        link.classList.toggle("is-active", rect.top <= 64 && rect.bottom > 64);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initNavHighlight() {
    const navLinks = document.querySelectorAll(".button-group a[href^='#']");
    if (!navLinks.length || !("IntersectionObserver" in window)) return;

    const sections = Array.from(navLinks)
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);
    if (!sections.length) return;

    const setActive = (id) => {
      navLinks.forEach((link) => {
        link.classList.toggle("nav-active", link.getAttribute("href") === `#${id}`);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { threshold: 0.3, rootMargin: "-10% 0px -45% 0px" }
    );

    sections.forEach((s) => observer.observe(s));
  }

  function initCountUp() {
    if (prefersReducedMotion()) return;
    const elements = document.querySelectorAll(".count-up[data-target]");
    if (!elements.length || !("IntersectionObserver" in window)) return;

    const animate = (el) => {
      const target = parseInt(el.getAttribute("data-target"), 10);
      const suffix = el.getAttribute("data-suffix") || "";
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animate(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    elements.forEach((el) => observer.observe(el));
  }

  function initContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const nameEl    = form.querySelector("#contact-name");
    const emailEl   = form.querySelector("#contact-email");
    const subjectEl = form.querySelector("#contact-subject");
    const msgEl     = form.querySelector("#contact-message");
    const btn       = form.querySelector(".contact-form-submit");
    const honey     = form.querySelector("#contact-honey");

    function setError(el, msg) {
      const wrap = el.closest(".contact-form-field");
      if (!wrap) return;
      el.classList.add("cf-invalid");
      let err = wrap.querySelector(".cf-error");
      if (!err) {
        err = document.createElement("span");
        err.className = "cf-error";
        err.setAttribute("role", "alert");
        wrap.appendChild(err);
      }
      err.textContent = msg;
    }

    function clearError(el) {
      el.classList.remove("cf-invalid");
      const err = el.closest(".contact-form-field")?.querySelector(".cf-error");
      if (err) err.remove();
    }

    function validateEmail(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    }

    [nameEl, emailEl, msgEl].forEach(el => {
      if (!el) return;
      el.addEventListener("input", () => clearError(el));
      el.addEventListener("blur", () => {
        if (!el.value.trim()) setError(el, "This field is required");
        else if (el === emailEl && !validateEmail(el.value.trim())) setError(el, "Enter a valid email address");
        else clearError(el);
      });
    });

    function showSuccess(serverSide) {
      const wrap  = document.createElement("div");
      wrap.className = "cf-success";

      const icon  = document.createElement("span");
      icon.className = "cf-success-icon";
      icon.textContent = "✓";

      const title = document.createElement("strong");
      title.textContent = serverSide ? "Message sent!" : "Gmail opened!";

      const sub   = document.createElement("span");
      sub.textContent = serverSide
        ? "Your message was received — I'll get back to you soon."
        : "Your message is pre-filled — just hit Send in Gmail.";

      wrap.appendChild(icon);
      wrap.appendChild(title);
      wrap.appendChild(sub);

      form.style.display = "none";
      form.parentNode.insertBefore(wrap, form.nextSibling);
      setTimeout(() => { wrap.remove(); form.style.display = ""; }, 6000);
    }

    function gmailFallback(name, email, subject, message) {
      const body = [
        `Hi Subash,`, ``, message, ``,
        `---`, `From: ${name}`, `Reply-To: ${email}`,
        `Subject: ${subject}`, `Sent via: subashlamaprofile.pages.dev`
      ].join("\n");
      const url =
        `https://mail.google.com/mail/?view=cm` +
        `&to=lamasubash107%40gmail.com` +
        `&su=${encodeURIComponent(`[${subject}] from ${name}`)}` +
        `&body=${encodeURIComponent(body)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (honey && honey.value) return;

      const name    = (nameEl?.value    || "").trim();
      const email   = (emailEl?.value   || "").trim();
      const subject = (subjectEl?.value || "General Inquiry").trim();
      const message = (msgEl?.value     || "").trim();

      let valid = true;
      if (!name)                      { setError(nameEl,  "Please enter your name");      valid = false; }
      if (!email)                     { setError(emailEl, "Please enter your email");      valid = false; }
      else if (!validateEmail(email)) { setError(emailEl, "Enter a valid email address");  valid = false; }
      if (!message)                   { setError(msgEl,   "Please write a message");       valid = false; }
      if (!valid) return;

      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

      let serverSuccess = false;
      try {
        const res = await fetch("/api/contact", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name, email, subject, message, honey: "" }),
          signal:  AbortSignal.timeout(6000),
        });
        const data = await res.json();
        serverSuccess = !!data.ok;
      } catch { /* Pages Function unavailable — fall through to Gmail */ }

      form.reset();
      if (btn) { btn.disabled = false; btn.textContent = "✉ Send via Gmail"; }

      if (serverSuccess) {
        showSuccess(true);
      } else {
        gmailFallback(name, email, subject, message);
        showSuccess(false);
      }
    });
  }

  function initCommandPalette() {
    const palette = document.getElementById("commandPalette");
    const toggle  = document.getElementById("cmdToggle");
    if (!palette || !toggle) return;

    const open  = () => { palette.removeAttribute("hidden"); palette.dispatchEvent(new Event("show")); palette.querySelector(".cmd-panel").focus(); };
    const close = () => palette.setAttribute("hidden", "");

    toggle.addEventListener("click", () => {
      palette.hasAttribute("hidden") ? open() : close();
    });

    palette.addEventListener("click", (e) => {
      if (e.target === palette) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        palette.hasAttribute("hidden") ? open() : close();
        return;
      }
      if (!palette.hasAttribute("hidden")) {
        if (e.key === "Escape") { close(); return; }
        const nav = {
          g: () => window.open("https://github.com/Subash107", "_blank", "noopener"),
          l: () => window.open("https://www.linkedin.com/in/subash-lama-b319a016b/", "_blank", "noopener"),
          r: () => { const a = document.querySelector(".btn-resume"); if (a) a.click(); },
          c: () => { const s = document.querySelector("#contact"); if (s) s.scrollIntoView({ behavior: "smooth" }); },
        };
        const fn = nav[e.key.toLowerCase()];
        if (fn) { close(); fn(); }
      }
    });
  }

  function initPageTransitions() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[href]");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (link.target === "_blank") return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && !url.hash) return;
        e.preventDefault();
        document.body.style.opacity = "0";
        document.body.style.transition = "opacity 0.25s ease";
        setTimeout(() => { window.location.href = href; }, 260);
      } catch { /* malformed href — let browser handle */ }
    });
  }

  function initTypingAnimation() {
    const el = document.getElementById("typingRoles");
    if (!el || prefersReducedMotion()) return;
    const roles = [
      "Cybersecurity Analyst",
      "SOC Analyst L1 / L2",
      "Detection Engineer",
      "Threat Intelligence Analyst",
      "IAM Specialist",
      "GRC Analyst",
      "Security Operations Engineer",
      "Blue Team Operator",
    ];
    let roleIdx = 0, charIdx = roles[0].length, deleting = false;
    const spd = { type: 62, del: 32, pauseFull: 2400, pauseEmpty: 420 };
    function tick() {
      const cur = roles[roleIdx];
      if (!deleting) {
        charIdx++;
        el.textContent = cur.slice(0, charIdx);
        if (charIdx === cur.length) { deleting = true; setTimeout(tick, spd.pauseFull); return; }
        setTimeout(tick, spd.type);
      } else {
        charIdx--;
        el.textContent = cur.slice(0, charIdx);
        if (charIdx === 0) {
          deleting = false;
          roleIdx = (roleIdx + 1) % roles.length;
          setTimeout(tick, spd.pauseEmpty);
          return;
        }
        setTimeout(tick, spd.del);
      }
    }
    setTimeout(tick, 1600);
  }

  function initNepalTime() {
    const el = document.getElementById("nepalTimeLive");
    if (!el) return;
    const update = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const npt = new Date(utc + 5.75 * 3600000);
      el.textContent = String(npt.getHours()).padStart(2, "0") + ":" + String(npt.getMinutes()).padStart(2, "0");
    };
    update();
    setInterval(update, 30000);
  }

  function initEasterTerminal() {
    const term    = document.getElementById("easterTerminal");
    const closeEl = document.getElementById("etClose");
    const backdrop= document.getElementById("etBackdrop");
    const body    = document.getElementById("etBody");
    const input   = document.getElementById("etInput");
    if (!term || !body || !input) return;

    const open = () => {
      term.removeAttribute("hidden");
      body.innerHTML = "";
      addLine("out", 'Welcome to <span style="color:#8ae8ff">subash@portfolio</span>. Type <span style="color:#50fa7b">help</span> to see commands.');
      setTimeout(() => input.focus(), 60);
    };
    const close = () => term.setAttribute("hidden", "");

    closeEl  && closeEl.addEventListener("click", close);
    backdrop && backdrop.addEventListener("click", close);

    document.addEventListener("keydown", (e) => {
      if (e.key === "`" && !e.ctrlKey && !e.metaKey &&
          !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        term.hasAttribute("hidden") ? open() : close();
      }
      if (!term.hasAttribute("hidden") && e.key === "Escape") close();
    });

    const cmds = {
      help:    () => "whoami · skills · certs · contact · labs · clear · exit",
      whoami:  () => "Subash Lama — Cybersecurity Analyst\n12+ years IT · SOC · GRC · IAM · Kathmandu, Nepal",
      skills:  () => "Core: Endpoint Security, Active Directory, Linux, Network Monitoring\nSecurity: Wazuh, Suricata, Sysmon, Ethical Hacking, SIEM\nAutomation: Docker, GitHub Actions, Terraform, Python, Bash",
      certs:   () => "Cisco — Endpoint Security (Jun 2026)\nCisco — Ethical Hacker (Apr 2026)\nCisco — Intro to Cybersecurity (Mar 2026)\nIBM   — Cybersecurity Fundamentals (Mar 2026)\nIBM   — Python for Data Science (Mar 2026)\nIBM   — Data Analysis with Python (Mar 2026)",
      contact: () => "Email:    lamasubash107@gmail.com\nGitHub:   github.com/Subash107\nLinkedIn: linkedin.com/in/subash-lama-b319a016b/\nTimezone: UTC+5:45 (Kathmandu, Nepal)",
      labs:    () => "SOC Lab: Wazuh + Suricata + Sysmon\nObs stack: Prometheus + Grafana\nCI/CD lab: Docker + GitHub Actions\nIn progress: Kubernetes security + OpenTelemetry",
      music:   () => "🎵 You found a secret!\nWhen not hunting threats, Subash produces Post Rock instrumentals.\n→ soundcloud.com/subash-lama-408609351",
      clear:   () => { body.innerHTML = ""; return null; },
      exit:    () => { close(); return null; },
    };

    function addLine(type, html) {
      const p = document.createElement("p");
      p.className = "et-line et-" + type;
      p.innerHTML = html.replace(/\n/g, "<br>");
      body.appendChild(p);
      body.scrollTop = body.scrollHeight;
    }

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const raw = input.value.trim();
      const cmd = raw.toLowerCase();
      input.value = "";
      addLine("prompt", '<span style="color:#8ae8ff">subash@portfolio:~$</span> ' + raw);
      if (!cmd) return;
      const fn = cmds[cmd];
      if (fn) {
        const out = fn();
        if (out != null) addLine("out", out);
      } else {
        addLine("err", "bash: " + cmd + ": command not found. Type 'help'.");
      }
    });
  }

  function initCopyEmail() {
    document.querySelectorAll("[data-copy-email]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const email = el.getAttribute("data-copy-email");
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(email).then(() => {
          el.setAttribute("data-copy-tip", "✓ Copied!");
          setTimeout(() => el.removeAttribute("data-copy-tip"), 2200);
        }).catch(() => {});
      });
    });
  }

  /* ── Particle network canvas ── */
  function initParticleNetwork() {
    if (prefersReducedMotion() || isTouchDevice()) return;
    const canvas = document.getElementById("particleNet");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, particles = [];
    const COUNT = 55, MAX_DIST = 130;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.6
      });
    }

    function loop() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(138,232,255,0.55)";
        ctx.fill();
        for (let j = i + 1; j < COUNT; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(138,232,255,${0.12 * (1 - dist / MAX_DIST)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(loop);
    }
    loop();
  }

  /* ── Cursor particle trail ── */
  function initCursorTrail() {
    if (prefersReducedMotion() || isTouchDevice()) return;
    const container = document.getElementById("cursorTrailCanvas");
    if (!container) return;
    const COLORS = ["#50fa7b", "#8ae8ff", "#72efff", "#ffffff"];
    document.addEventListener("mousemove", (e) => {
      if (Math.random() > 0.4) return;
      const dot = document.createElement("div");
      dot.className = "trail-dot";
      dot.style.left = e.clientX + "px";
      dot.style.top  = e.clientY + "px";
      dot.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      dot.style.width = dot.style.height = (Math.random() * 4 + 3) + "px";
      container.appendChild(dot);
      setTimeout(() => dot.remove(), 650);
    });
  }

  /* ── Text scramble decode on headings ── */
  function initScrambleHeadings() {
    if (prefersReducedMotion()) return;
    const CHARS = "!@#$%?ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|[]";
    const heads = document.querySelectorAll("[data-scramble]");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        scramble(entry.target);
      });
    }, { threshold: 0.5 });
    heads.forEach((h) => observer.observe(h));

    function scramble(el) {
      const original = el.textContent;
      let frame = 0;
      const total = 18;
      el.classList.add("scrambling");
      const id = setInterval(() => {
        el.textContent = original.split("").map((ch, i) => {
          if (ch === " ") return " ";
          return frame / total > i / original.length
            ? ch
            : CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join("");
        if (++frame > total) {
          clearInterval(id);
          el.textContent = original;
          el.classList.remove("scrambling");
        }
      }, 45);
    }
  }

  /* ── Achievement unlock toasts ── */
  function initAchievementToasts() {
    const toast = document.getElementById("achieveToast");
    if (!toast) return;
    toast.hidden = false;
    const ACHIEVEMENTS = [
      { snd: "about",          icon: "🕵️", title: "Intel Acquired",   body: "Subash's background unlocked" },
      { snd: "experience",     icon: "⚡", title: "10 Years Deployed", body: "Enterprise timeline revealed" },
      { snd: "projects",       icon: "🛡️", title: "Lab Access Granted", body: "SOC lab projects loaded"       },
      { snd: "skills",         icon: "🎯", title: "Skill Set Scanned",  body: "Threat analysis competency confirmed" },
      { snd: "certifications", icon: "🏅", title: "Badges Verified",    body: "Cisco · IBM · Google certs confirmed" },
      { snd: "contact",        icon: "📡", title: "Channel Open",       body: "Secure comms established"       },
    ];
    const shown = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        if (shown.has(id)) return;
        shown.add(id);
        const ach = ACHIEVEMENTS.find((a) => a.snd === id);
        if (!ach) return;
        const item = document.createElement("div");
        item.className = "achieve-item";
        item.innerHTML = `<div class="achieve-title">${ach.icon} ${ach.title}</div><div>${ach.body}</div>`;
        toast.appendChild(item);
        setTimeout(() => item.remove(), 4400);
      });
    }, { threshold: 0.4 });
    document.querySelectorAll("section[id]").forEach((s) => observer.observe(s));
  }

  /* ── Konami code → Matrix rain ── */
  function initKonamiCode() {
    const SEQUENCE = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let idx = 0;
    document.addEventListener("keydown", (e) => {
      if (e.key === SEQUENCE[idx]) { idx++; } else { idx = e.key === SEQUENCE[0] ? 1 : 0; }
      if (idx === SEQUENCE.length) { idx = 0; fireKonami(); }
    });

    function fireKonami() {
      const canvas = document.getElementById("konamiRain");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.classList.add("active");
      const cols = Math.floor(canvas.width / 16);
      const drops = Array(cols).fill(1);
      const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF";
      let raf;
      function draw() {
        ctx.fillStyle = "rgba(0,0,0,0.04)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#50fa7b";
        ctx.font = "14px monospace";
        drops.forEach((y, i) => {
          const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx.fillText(ch, i * 16, y * 16);
          if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        });
        raf = requestAnimationFrame(draw);
      }
      draw();
      setTimeout(() => {
        cancelAnimationFrame(raf);
        canvas.classList.remove("active");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 4000);
    }
  }

  /* ── Live threat feed — real data from URLhaus (abuse.ch) ── */
  async function initThreatFeed() {
    const el = document.getElementById("threatFeedText");
    if (!el) return;
    el.style.transition = "opacity 0.3s ease";

    const FALLBACK = [
      "URLhaus: malware delivery URL blocked",
      "abuse.ch: phishing kit infrastructure detected",
      "Threat intel: C2 callback domain flagged",
      "URLhaus: Emotet dropper URL added to blocklist",
      "Threat feed: new botnet C2 endpoint reported",
    ];

    function rotate(feed) {
      let i = 0;
      el.textContent = feed[0];
      setInterval(() => {
        i = (i + 1) % feed.length;
        el.style.opacity = "0";
        setTimeout(() => { el.textContent = feed[i]; el.style.opacity = "1"; }, 300);
      }, 6000);
    }

    function timeAgo(dateStr) {
      const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
      if (diff < 60) return `${diff}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      return `${Math.floor(diff / 1440)}d ago`;
    }

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch("https://urlhaus-api.abuse.ch/v1/urls/recent/limit/10/", {
        method: "POST",
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const urls = (data.urls || []).filter(u => u.url_status !== "offline");
      if (!urls.length) throw new Error();

      const feed = urls.slice(0, 8).map(u => {
        const tags = Array.isArray(u.tags) && u.tags.length ? u.tags.slice(0, 2).join(", ") : (u.threat || "malware");
        let host = "";
        try { host = new URL(u.url).hostname; } catch { host = "unknown host"; }
        return `URLhaus · ${tags} · ${host} · ${timeAgo(u.date_added)}`;
      });
      rotate(feed);
    } catch {
      rotate(FALLBACK);
    }
  }

  /* ── Side section navigation dots ── */
  function initSideNavDots() {
    const dots = document.querySelectorAll(".snd");
    if (!dots.length) return;
    const sections = Array.from(dots).map((d) => document.getElementById(d.getAttribute("data-snd")));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        const dot = document.querySelector(`.snd[data-snd="${id}"]`);
        if (dot) dot.classList.toggle("active", entry.isIntersecting);
      });
    }, { threshold: 0.4 });
    sections.forEach((s) => { if (s) observer.observe(s); });
  }

  /* ── 1. Back-to-top scroll ring ── */
  function initBackToTopRing() {
    const fill = document.getElementById("bttRingFill");
    if (!fill) return;
    const CIRCUM = 2 * Math.PI * 14;
    fill.style.strokeDasharray  = CIRCUM;
    fill.style.strokeDashoffset = CIRCUM;
    window.addEventListener("scroll", () => {
      const max = document.body.scrollHeight - window.innerHeight;
      const pct = max > 0 ? window.scrollY / max : 0;
      fill.style.strokeDashoffset = CIRCUM * (1 - pct);
    }, { passive: true });
  }

  /* ── 2. Confetti burst ── */
  function initConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let particles = [], raf;
    const COLORS = ["#50fa7b","#8ae8ff","#bd93f9","#ff79c6","#ffb86c","#f1fa8c"];

    function burst(ox, oy) {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      for (let i = 0; i < 72; i++) {
        const angle = (Math.PI * 2 * i) / 72 + (Math.random() - 0.5) * 0.4;
        const speed = Math.random() * 6 + 2;
        particles.push({
          x: ox, y: oy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - Math.random() * 3,
          r: Math.random() * 4 + 2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          life: 1, decay: Math.random() * 0.018 + 0.012,
          rot: Math.random() * Math.PI * 2,
          rspeed: (Math.random() - 0.5) * 0.2,
        });
      }
      cancelAnimationFrame(raf);
      loop();
    }

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles = particles.filter((p) => p.life > 0);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.18;
        p.vx *= 0.98; p.life -= p.decay; p.rot += p.rspeed;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        ctx.restore();
      });
      if (particles.length) raf = requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function triggerAt(el) {
      const r = el?.getBoundingClientRect();
      const x = r ? r.left + r.width / 2  : window.innerWidth  / 2;
      const y = r ? r.top  + r.height / 2 : window.innerHeight / 2;
      burst(x, y);
    }

    document.querySelector(".btn-resume")?.addEventListener("click", (e) => triggerAt(e.currentTarget));
    document.getElementById("contactForm")?.addEventListener("submit", (e) => triggerAt(e.currentTarget));
    document.getElementById("vcardBtn")?.addEventListener("click",  (e) => triggerAt(e.currentTarget));
  }

  /* ── 3. Skill pill hover tooltips ── */
  function initSkillTooltips() {
    const TIPS = {
      "SOC Operations":       "Daily triage, alert investigation & incident response",
      "GRC":                  "Governance, Risk & Compliance — policy writing & risk assessments",
      "IAM":                  "Active Directory, RBAC, MFA & SSO across enterprise environments",
      "Wazuh":                "Personal SOC lab — HIDS monitoring & alert correlation",
      "Suricata":             "Network IDS — rule-based threat detection & PCAP analysis",
      "Sysmon":               "Windows endpoint telemetry — process, network & file events",
      "SIEM":                 "Log aggregation, correlation rules & threat visibility dashboards",
      "Ethical Hacking":      "Cisco-certified — pen testing fundamentals & vulnerability assessment",
      "Endpoint Security":    "Cisco-certified — hardening, AV/EDR policy & threat response",
      "Docker":               "Lab automation — containerised security tools & CI/CD pipelines",
      "GitHub Actions":       "CI/CD pipelines for automated deployment & security checks",
      "Terraform":            "IaC for repeatable, auditable cloud environments",
      "Python":               "Security scripting — log parsing & automation (IBM-certified)",
      "Bash":                 "Shell scripting for system admin & security automation",
      "PowerShell":           "Windows administration & endpoint security automation",
      "Active Directory":     "Administered AD for 200+ users at State Bank of India",
      "Linux Administration": "99%+ uptime across client Linux servers at Green IT Solutions",
      "Cisco Networking":     "Designed Cisco topology for Unilever Nepal distribution facilities",
      "Detection Engineering":"Writing & tuning detection rules — reducing false positives",
      "Log Analysis":         "Parsing & correlating logs across endpoints, network & cloud",
    };
    document.querySelectorAll(".skill-pill").forEach((pill) => {
      const key = Object.keys(TIPS).find((k) => pill.textContent.trim().includes(k));
      if (!key) return;
      const tip = document.createElement("span");
      tip.className = "pill-tip";
      tip.textContent = TIPS[key];
      pill.appendChild(tip);
    });
  }

  /* ── 4. Section reading time ── */
  function initReadingTime() {
    document.querySelectorAll(".glass-card").forEach((card) => {
      const h2 = card.querySelector("h2");
      if (!h2) return;
      const words = (card.querySelector(".section-content")?.textContent || "").trim().split(/\s+/).length;
      const mins  = Math.max(1, Math.round(words / 200));
      const badge = document.createElement("span");
      badge.className = "read-time-badge";
      badge.innerHTML = `&#128336; ~${mins} min read`;
      h2.appendChild(badge);
    });
  }

  /* ── 5. Testimonials auto-slider ── */
  function initTestimonialsSlider() {
    const list  = document.querySelector(".testimonial-list");
    const cards = list ? Array.from(list.querySelectorAll(".testimonial-card")) : [];
    if (cards.length < 2) return;
    let cur = 0, timer;

    cards.forEach((c, i) => { if (i > 0) c.classList.add("ts-hidden"); });

    const dots = document.createElement("div");
    dots.className = "ts-dots";
    const nav = document.createElement("div");
    nav.className = "ts-nav";
    nav.innerHTML = '<button class="ts-btn" id="tsPrev">&#8592; Prev</button><button class="ts-btn" id="tsNext">Next &#8594;</button>';

    cards.forEach((_, i) => {
      const d = document.createElement("button");
      d.className = "ts-dot" + (i === 0 ? " active" : "");
      d.setAttribute("aria-label", `Testimonial ${i + 1}`);
      d.addEventListener("click", () => { go(i); resetTimer(); });
      dots.appendChild(d);
    });

    list.after(dots, nav);

    function go(idx) {
      cards[cur].classList.add("ts-hidden");
      dots.children[cur].classList.remove("active");
      cur = (idx + cards.length) % cards.length;
      cards[cur].classList.remove("ts-hidden");
      dots.children[cur].classList.add("active");
    }

    function resetTimer() { clearInterval(timer); timer = setInterval(() => go(cur + 1), 5000); }

    document.getElementById("tsPrev")?.addEventListener("click", () => { go(cur - 1); resetTimer(); });
    document.getElementById("tsNext")?.addEventListener("click", () => { go(cur + 1); resetTimer(); });
    resetTimer();
  }

  /* ── 6. Focus / reading mode ── */
  function initFocusMode() {
    document.querySelectorAll("[data-scramble]").forEach((h) => {
      h.addEventListener("click", () => {
        const card = h.closest(".glass-card");
        if (!card) return;
        const already = card.classList.contains("focus-active");
        document.querySelectorAll(".glass-card").forEach((c) => c.classList.remove("focus-active"));
        document.body.classList.toggle("focus-mode", !already);
        if (!already) card.classList.add("focus-active");
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.body.classList.remove("focus-mode");
        document.querySelectorAll(".glass-card").forEach((c) => c.classList.remove("focus-active"));
      }
    });
  }

  /* ── 7. Copy profile URL ── */
  function initCopyProfileUrl() {
    const btn = document.getElementById("copyProfileUrl");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const url = "https://subashlamaprofile.pages.dev/";
      navigator.clipboard?.writeText(url).then(() => {
        btn.textContent = "✓ Copied!";
        setTimeout(() => { btn.innerHTML = "&#128279; Copy Link"; }, 2200);
      }).catch(() => {
        btn.textContent = url;
        setTimeout(() => { btn.innerHTML = "&#128279; Copy Link"; }, 3000);
      });
    });
  }

  /* ── 8. Hacker score ── */
  function initHackerScore() {
    const hud    = document.getElementById("hackerScore");
    const valEl  = document.getElementById("hsValue");
    const deltaEl= document.getElementById("hsDelta");
    if (!hud || !valEl) return;
    const LS = "portfolio_hacker_score";
    let score = parseInt(localStorage.getItem(LS) || "0", 10);
    const scored = new Set(JSON.parse(localStorage.getItem(LS + "_done") || "[]"));

    function award(pts, label) {
      score += pts;
      localStorage.setItem(LS, score);
      valEl.textContent = score;
      hud.classList.add("visible");
      deltaEl.textContent = `+${pts}`;
      deltaEl.classList.add("show");
      setTimeout(() => deltaEl.classList.remove("show"), 1400);
    }

    if (score > 0) { valEl.textContent = score; hud.classList.add("visible"); }

    const sections = document.querySelectorAll("section.glass-card");
    const sObs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        if (!scored.has(id)) { scored.add(id); localStorage.setItem(LS + "_done", JSON.stringify([...scored])); award(10); }
      });
    }, { threshold: 0.5 });
    sections.forEach((s) => sObs.observe(s));

    document.querySelector(".btn-resume")?.addEventListener("click", () => { if (!scored.has("resume")) { scored.add("resume"); award(25); } });
    document.getElementById("vcardBtn")?.addEventListener("click",  () => { if (!scored.has("vcard"))  { scored.add("vcard");  award(20); } });
    document.querySelector("[data-copy-email]")?.addEventListener("click", () => { if (!scored.has("email")) { scored.add("email"); award(15); } });
    document.getElementById("easterTerminal") && new MutationObserver(() => {
      if (!document.getElementById("easterTerminal").hasAttribute("hidden") && !scored.has("terminal")) { scored.add("terminal"); award(50); }
    }).observe(document.getElementById("easterTerminal"), { attributes: true });
    new MutationObserver(() => {
      if (document.getElementById("konamiRain")?.classList.contains("active") && !scored.has("konami")) { scored.add("konami"); award(100); }
    }).observe(document.getElementById("konamiRain") || document.body, { attributes: true, attributeFilter: ["class"] });
  }

  /* ── 9. Bookmark pins ── */
  function initBookmarkPins() {
    const panel   = document.getElementById("bookmarkPanel");
    const toggle  = document.getElementById("bkmToggle");
    const listEl  = document.getElementById("bkmList");
    const emptyEl = document.getElementById("bkmEmpty");
    const closeBtn= document.getElementById("bkmClose");
    if (!panel || !toggle) return;
    const LS = "portfolio_bookmarks";
    let bookmarks = JSON.parse(localStorage.getItem(LS) || "[]");

    toggle.addEventListener("click",  () => panel.toggleAttribute("hidden"));
    closeBtn?.addEventListener("click", () => panel.setAttribute("hidden", ""));

    function renderPanel() {
      listEl.innerHTML = "";
      emptyEl.style.display = bookmarks.length ? "none" : "";
      bookmarks.forEach((bm) => {
        const li  = document.createElement("li");
        li.className = "bkm-item";
        li.innerHTML = `<a href="#${bm.id}">${bm.label}</a><button type="button" title="Remove">&#10005;</button>`;
        li.querySelector("button").addEventListener("click", () => removeBookmark(bm.id));
        li.querySelector("a").addEventListener("click",   () => panel.setAttribute("hidden",""));
        listEl.appendChild(li);
      });
    }

    function removeBookmark(id) {
      bookmarks = bookmarks.filter((b) => b.id !== id);
      localStorage.setItem(LS, JSON.stringify(bookmarks));
      document.querySelector(`.section-pin[data-section="${id}"]`)?.classList.remove("pinned");
      renderPanel();
    }

    document.querySelectorAll("section.glass-card[id]").forEach((sec) => {
      const label = sec.querySelector("h2")?.textContent.replace(/\s*\d+\s*\/\s*\d+/, "").replace(/~\d+\s*min\s*read/,"").trim() || sec.id;
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "section-pin";
      pin.setAttribute("data-section", sec.id);
      pin.setAttribute("aria-label", `Bookmark ${label}`);
      pin.setAttribute("title", `Bookmark ${label}`);
      pin.textContent = "📌";
      if (bookmarks.find((b) => b.id === sec.id)) pin.classList.add("pinned");
      pin.addEventListener("click", () => {
        const exists = bookmarks.find((b) => b.id === sec.id);
        if (exists) {
          removeBookmark(sec.id);
        } else {
          bookmarks.push({ id: sec.id, label });
          localStorage.setItem(LS, JSON.stringify(bookmarks));
          pin.classList.add("pinned");
          renderPanel();
        }
      });
      sec.appendChild(pin);
    });

    renderPanel();
  }

  /* ── Custom cursor — disabled ── */
  function initCustomCursor() {}

  /* ── Film grain overlay ── */
  function initFilmGrain() {
    if (prefersReducedMotion() || isTouchDevice()) return;
    const canvas = document.getElementById("filmGrain");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, frame = 0;
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    function draw() {
      if (++frame % 3 !== 0) { requestAnimationFrame(draw); return; }
      const img = ctx.createImageData(W, H);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = Math.random() > 0.55 ? 18 : 0;
      }
      ctx.putImageData(img, 0, 0);
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ── Parallax orbs on mouse move ── */
  function initParallaxOrbs() {
    if (prefersReducedMotion() || isTouchDevice()) return;
    const orbs = document.querySelectorAll(".bg-orb");
    if (!orbs.length) return;
    const FACTORS = [0.018, -0.012, 0.022];
    let tx = 0, ty = 0, cx = 0, cy = 0;
    document.addEventListener("mousemove", (e) => {
      tx = (e.clientX - window.innerWidth  / 2);
      ty = (e.clientY - window.innerHeight / 2);
    });
    function tick() {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      orbs.forEach((orb, i) => {
        const f = FACTORS[i % FACTORS.length];
        orb.style.transform = `translate(${cx * f}px, ${cy * f}px)`;
      });
      requestAnimationFrame(tick);
    }
    tick();
  }

  /* ── vCard download ── */
  function initVCardDownload() {
    function download() {
      const vcf = [
        "BEGIN:VCARD", "VERSION:3.0",
        "FN:Subash Lama",
        "N:Lama;Subash;;;",
        "TITLE:Cybersecurity Analyst",
        "EMAIL;TYPE=INTERNET:lamasubash107@gmail.com",
        "URL:https://github.com/Subash107",
        "URL:https://www.linkedin.com/in/subash-lama-b319a016b/",
        "ADR;TYPE=HOME:;;Kathmandu;;;NP",
        "NOTE:SOC · GRC · IAM · Detection Engineering · 12+ years in IT",
        "END:VCARD"
      ].join("\r\n");
      const blob = new Blob([vcf], { type: "text/vcard" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "Subash-Lama.vcf"; a.click();
      URL.revokeObjectURL(url);
    }
    const btn = document.getElementById("vcardBtn");
    if (btn) {
      btn.addEventListener("click", () => { download(); btn.textContent = "✓ Saved!"; setTimeout(() => { btn.innerHTML = "&#128100; Save Contact (vCard)"; }, 2000); });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() !== "v" || e.ctrlKey || e.metaKey || ["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
      download();
    });
  }

  /* ── Relative experience dates ── */
  function initRelativeDates() {
    document.querySelectorAll(".exp-duration").forEach((el) => {
      const text = el.textContent;
      const endMatch = text.match(/(\w{3})\s(\d{4})\s*[–-]/);
      if (!endMatch) return;
      const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
      const m = months[endMatch[1]]; const y = parseInt(endMatch[2]);
      if (m === undefined || isNaN(y)) return;
      const end = new Date(y, m, 1);
      const now = new Date();
      const yrs = ((now - end) / (365.25 * 24 * 3600 * 1000));
      if (yrs < 0.1) return;
      const label = yrs < 1 ? "recently" : `${Math.round(yrs)} yr${Math.round(yrs) > 1 ? "s" : ""} ago`;
      const span = document.createElement("span");
      span.className = "exp-rel-date";
      span.textContent = `(${label})`;
      el.appendChild(span);
    });
  }

  /* ── Recruiter cheat sheet modal ── */
  function initRecruiterModal() {
    const modal   = document.getElementById("recruiterModal");
    const closeBtn = document.getElementById("rcmClose");
    const backdrop = document.getElementById("rcmBackdrop");
    if (!modal) return;
    const open  = () => modal.removeAttribute("hidden");
    const close = () => modal.setAttribute("hidden", "");
    closeBtn?.addEventListener("click", close);
    backdrop?.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "i" && !e.ctrlKey && !e.metaKey && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
        modal.hasAttribute("hidden") ? open() : close();
      }
      if (e.key === "Escape" && !modal.hasAttribute("hidden")) close();
    });
  }

  /* ── Project tag filtering ── */
  function initProjectTagFilter() {
    const btns  = document.querySelectorAll(".ptf-btn");
    const cards = document.querySelectorAll(".project-card");
    if (!btns.length || !cards.length) return;
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btns.forEach((b) => b.classList.remove("ptf-active"));
        btn.classList.add("ptf-active");
        const tag = btn.getAttribute("data-tag");
        cards.forEach((card) => {
          const tech = card.querySelector(".project-tech")?.textContent || "";
          if (tag === "all" || tech.includes(tag)) {
            card.classList.remove("ptf-hidden");
            card.classList.add("ptf-match");
          } else {
            card.classList.add("ptf-hidden");
            card.classList.remove("ptf-match");
          }
        });
        if (tag === "all") cards.forEach((c) => c.classList.remove("ptf-match"));
      });
    });
  }

  /* ── Scroll-velocity blur ── */
  function initScrollBlur() {
    if (prefersReducedMotion() || isTouchDevice()) return;
    const content = document.querySelector(".content");
    if (!content) return;
    let last = 0, ticking = false, timer;
    const clear = () => { content.style.filter = ""; };
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      const vel = Math.abs(y - last);
      last = y;
      const blur = Math.min(vel * 0.025, 1.5);
      if (!ticking) {
        requestAnimationFrame(() => {
          content.style.filter = blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : "";
          ticking = false;
        });
        ticking = true;
      }
      clearTimeout(timer);
      timer = setTimeout(clear, 80);
    }, { passive: true });
    window.addEventListener("load", clear);
    document.addEventListener("visibilitychange", clear);
  }

  /* ── Audio EQ visualizer ── */
  function initEQVisualizer() {
    const btn = document.querySelector("[data-audio-toggle]");
    if (!btn) return;
    const eq = document.createElement("span");
    eq.className = "eq-bars";
    eq.innerHTML = '<span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span>';
    btn.appendChild(eq);
    const obs = new MutationObserver(() => {
      btn.classList.toggle("eq-active", btn.getAttribute("aria-pressed") === "true");
    });
    obs.observe(btn, { attributes: true, attributeFilter: ["aria-pressed"] });
  }

  /* ── Hue shift accent on scroll ── */
  function initHueShift() {
    const layer = document.getElementById("hueShiftLayer");
    if (!layer) return;
    const STOPS = [
      { pct: 0,   h: 142, s: 90,  l: 55 },
      { pct: 0.35, h: 188, s: 85,  l: 60 },
      { pct: 0.65, h: 220, s: 80,  l: 62 },
      { pct: 1,   h: 270, s: 70,  l: 60 },
    ];
    function lerp(a, b, t) { return a + (b - a) * t; }
    function getColor(pct) {
      for (let i = 0; i < STOPS.length - 1; i++) {
        const a = STOPS[i], b = STOPS[i + 1];
        if (pct >= a.pct && pct <= b.pct) {
          const t = (pct - a.pct) / (b.pct - a.pct);
          return `hsl(${lerp(a.h,b.h,t).toFixed(0)},${lerp(a.s,b.s,t).toFixed(0)}%,${lerp(a.l,b.l,t).toFixed(0)}%)`;
        }
      }
      return `hsl(270,70%,60%)`;
    }
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.body.scrollHeight - window.innerHeight;
        const pct = max > 0 ? window.scrollY / max : 0;
        if (pct > 0.05) {
          layer.style.background = getColor(pct);
          layer.style.opacity    = (pct * 0.07).toFixed(3);
        } else {
          layer.style.opacity = "0";
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ── Circuit board canvas ── */
  function initCircuitBoard() {
    if (prefersReducedMotion() || isTouchDevice()) return;
    const canvas = document.getElementById("circuitBoard");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H;
    const GRID = 60, COLOR = "rgba(80,250,123,1)";
    let nodes = [], traces = [];

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      buildCircuit();
    }

    function buildCircuit() {
      nodes = []; traces = [];
      const cols = Math.floor(W / GRID) + 1;
      const rows = Math.floor(H / GRID) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.82) nodes.push({ x: c * GRID, y: r * GRID, lit: false });
        }
      }
      nodes.forEach((n) => {
        const right = nodes.find((m) => m.y === n.y && m.x === n.x + GRID);
        const down  = nodes.find((m) => m.x === n.x && m.y === n.y + GRID);
        if (right && Math.random() > 0.45) traces.push({ x1: n.x, y1: n.y, x2: right.x, y2: right.y, prog: 0, speed: Math.random() * 0.012 + 0.004 });
        if (down  && Math.random() > 0.45) traces.push({ x1: n.x, y1: n.y, x2: n.x,    y2: down.y,   prog: 0, speed: Math.random() * 0.012 + 0.004 });
      });
    }

    resize();
    window.addEventListener("resize", () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 300); });

    function loop() {
      ctx.clearRect(0, 0, W, H);
      traces.forEach((t) => {
        if (t.prog < 1) t.prog = Math.min(1, t.prog + t.speed);
        const ex = t.x1 + (t.x2 - t.x1) * t.prog;
        const ey = t.y1 + (t.y2 - t.y1) * t.prog;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = COLOR;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
      nodes.forEach((n) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(138,232,255,0.7)";
        ctx.fill();
      });
      requestAnimationFrame(loop);
    }
    loop();
  }

  /* ── Security readiness ring ── */
  function initSecurityRing() {
    const ring = document.getElementById("secRingFill");
    const pctEl = document.getElementById("secRingPct");
    if (!ring || !pctEl) return;
    const TARGET = 84;
    const CIRCUM = 2 * Math.PI * 48;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      ring.style.strokeDashoffset = CIRCUM * (1 - TARGET / 100);
      let cur = 0;
      const id = setInterval(() => {
        cur = Math.min(TARGET, cur + 2);
        pctEl.textContent = cur + "%";
        if (cur >= TARGET) clearInterval(id);
      }, 30);
    }, { threshold: 0.5 });
    observer.observe(ring);
  }

  /* ── Hire me floating card ── */
  function initHireMeFloat() {
    const card = document.getElementById("hireMeFloat");
    const contact = document.getElementById("contact");
    if (!card) return;
    let shown = false;
    const heroH = document.querySelector(".hero-section")?.offsetHeight || 600;
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      const nearContact = contact && (contact.getBoundingClientRect().top < window.innerHeight * 0.6);
      if (y > heroH && !nearContact) {
        if (!shown) { card.classList.add("visible"); card.classList.remove("hidden"); shown = true; }
      } else {
        if (shown) { card.classList.remove("visible"); card.classList.add("hidden"); shown = false; }
      }
    }, { passive: true });
  }

  /* ── Staggered content reveal ── */
  function initStaggeredReveal() {
    if (prefersReducedMotion()) return;
    const targets = document.querySelectorAll(".exp-card, .cert-card, .project-card, .testimonial-card, .why-hire-list li, .working-list li");
    targets.forEach((el) => el.classList.add("stagger-item"));
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry, idx) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const siblings = Array.from(el.parentElement?.children || [el]);
        const i = siblings.indexOf(el);
        setTimeout(() => el.classList.add("stagger-in"), i * 90);
        obs.unobserve(el);
      });
    }, { threshold: 0.15 });
    targets.forEach((el) => obs.observe(el));
  }

  /* ── Browser tab typing ── */
  function initTabTyping() {
    const TITLES = [
      "Subash Lama — Cybersecurity Analyst",
      "Subash Lama — SOC Analyst",
      "Subash Lama — GRC Specialist",
      "Subash Lama — IAM Analyst",
      "Subash Lama — Available for Hire ✓",
    ];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % TITLES.length;
      document.title = TITLES[i];
    }, 3500);
  }

  /* ── Currently studying widget ── */
  function initCurrentlyStudying() {
    const STUDIES = [
      { text: "MITRE ATT&CK Framework", pct: 68 },
      { text: "GRC Certification Prep", pct: 45 },
      { text: "Elastic Stack (ELK)", pct: 35 },
      { text: "Kubernetes Security", pct: 28 },
    ];
    const textEl = document.getElementById("studyingText");
    const barEl  = document.getElementById("studyingBar");
    if (!textEl || !barEl) return;
    let idx = 0;
    function update() {
      idx = (idx + 1) % STUDIES.length;
      textEl.style.opacity = "0";
      setTimeout(() => {
        textEl.textContent = STUDIES[idx].text;
        barEl.style.width  = STUDIES[idx].pct + "%";
        textEl.style.opacity = "1";
      }, 280);
    }
    textEl.style.transition = "opacity 0.28s ease";
    setInterval(update, 5000);
  }

  /* ── Hex skill toggle ── */
  function initHexSkillToggle() {
    document.querySelectorAll(".skill-group").forEach((group) => {
      const pills = group.querySelector(".skill-pills");
      if (!pills) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skill-hex-toggle";
      btn.textContent = "⬡ Hex view";
      btn.addEventListener("click", () => {
        const on = pills.classList.toggle("hex-mode");
        btn.textContent = on ? "▤ List view" : "⬡ Hex view";
      });
      group.insertBefore(btn, pills);
    });
  }

  /* ── Cert view toggle (grid ↔ timeline) ── */
  function initCertToggle() {
    const list = document.getElementById("certList");
    if (!list) return;
    document.querySelectorAll(".cvt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".cvt-btn").forEach((b) => b.classList.remove("cvt-active"));
        btn.classList.add("cvt-active");
        const view = btn.getAttribute("data-view");
        list.classList.toggle("timeline-view", view === "timeline");
      });
    });
  }

  /* ── Command palette search ── */
  function initCommandSearch() {
    const search = document.getElementById("cmdSearch");
    const list   = document.getElementById("cmdList");
    if (!search || !list) return;
    const SECTIONS = [
      { label: "About Me",          id: "about"          },
      { label: "Experience",        id: "experience"     },
      { label: "Projects",          id: "projects"       },
      { label: "Skills",            id: "skills"         },
      { label: "Certifications",    id: "certifications" },
      { label: "Education",         id: "education"      },
      { label: "Contact",           id: "contact"        },
    ];
    function buildDynamic(q) {
      document.querySelectorAll(".cmd-dynamic").forEach((el) => el.remove());
      if (!q) return;
      SECTIONS.filter((s) => s.label.toLowerCase().includes(q)).forEach((s) => {
        const li = document.createElement("li");
        li.className = "cmd-dynamic";
        li.innerHTML = `<kbd class="cmd-key">↵</kbd><span>Go to ${s.label}</span>`;
        li.style.cursor = "pointer";
        li.addEventListener("click", () => {
          document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
          document.getElementById("commandPalette").setAttribute("hidden", "");
        });
        list.appendChild(li);
      });
    }
    search.addEventListener("input", () => {
      const q = search.value.toLowerCase().trim();
      list.querySelectorAll("li:not(.cmd-dynamic)").forEach((li) => {
        const text = li.textContent.toLowerCase();
        li.hidden = q && !text.includes(q);
      });
      buildDynamic(q);
    });
    document.getElementById("commandPalette")?.addEventListener("show", () => {
      search.value = "";
      list.querySelectorAll("li").forEach((li) => { li.hidden = false; });
      document.querySelectorAll(".cmd-dynamic").forEach((el) => el.remove());
      setTimeout(() => search.focus(), 80);
    });
  }

  /* ── Magnetic buttons ── */
  function initMagneticButtons() {
    if (prefersReducedMotion()) return;
    document.querySelectorAll(".btn-resume, .btn-cta-secondary").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width  * 12;
        const dy = (e.clientY - cy) / rect.height * 8;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
    });
  }

  /* ── Section counters ── */
  function initSectionCounters() {
    const sections = document.querySelectorAll("section.glass-card");
    const total = sections.length;
    sections.forEach((sec, i) => {
      const badge = document.createElement("span");
      badge.className = "section-counter";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      sec.appendChild(badge);
    });
  }

  /* ── Visitor counter (localStorage) ── */
  function initVisitorCounter() {
    const el = document.getElementById("visitorBadge");
    if (!el) return;
    try {
      const key = "portfolio_views";
      const count = (parseInt(localStorage.getItem(key) || "0", 10)) + 1;
      localStorage.setItem(key, count);
      el.textContent = `👁 ${count} visit${count === 1 ? "" : "s"} on this device`;
    } catch {}
  }

  /* ── Skills radar chart ── */
  function initSkillRadar() {
    const canvas = document.getElementById("skillRadar");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2 + 10;
    const R = Math.min(W, H) / 2 - 32;
    const LABELS = ["Endpoint\n& IAM", "Network", "SOC\n& SIEM", "Scripting", "GRC", "Ethical\nHacking"];
    const VALUES = [0.90, 0.88, 0.75, 0.72, 0.65, 0.78];
    const N = LABELS.length;

    function angle(i) { return (Math.PI * 2 * i) / N - Math.PI / 2; }
    function pt(i, r) { return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))]; }

    ctx.clearRect(0, 0, W, H);

    // Grid rings
    [0.25, 0.5, 0.75, 1].forEach((frac) => {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const [x, y] = pt(i, R * frac);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(138,232,255,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Spokes
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const [x, y] = pt(i, R);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "rgba(138,232,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Data polygon fill
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad.addColorStop(0, "rgba(80,250,123,0.35)");
    grad.addColorStop(1, "rgba(138,232,255,0.08)");
    ctx.beginPath();
    VALUES.forEach((v, i) => {
      const [x, y] = pt(i, R * v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(80,250,123,0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Data points
    VALUES.forEach((v, i) => {
      const [x, y] = pt(i, R * v);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#50fa7b";
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    LABELS.forEach((lbl, i) => {
      const [x, y] = pt(i, R + 22);
      const lines = lbl.split("\n");
      lines.forEach((line, li) => ctx.fillText(line, x, y + li * 11 - (lines.length - 1) * 5.5));
    });
  }

  /* ── Light mode toggle ── */
  function initLightMode() {
    const btn = document.getElementById("lightModeToggle");
    if (!btn) return;
    const LS = "portfolio_light_mode";
    if (localStorage.getItem(LS) === "1") { document.body.classList.add("light-mode"); btn.textContent = "☾"; }
    btn.addEventListener("click", () => {
      const on = document.body.classList.toggle("light-mode");
      btn.textContent = on ? "☾" : "☀";
      localStorage.setItem(LS, on ? "1" : "0");
    });
  }

  /* ── Print shortcut (P key) ── */
  function initPrintShortcut() {
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() !== "p" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
      e.preventDefault();
      window.print();
    });
  }

  /* ── Card mouse tilt ── */
  function initCardTilt() {
    if (prefersReducedMotion()) return;
    document.querySelectorAll(".glass-card").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 4}deg) translateY(-5px)`;
        card.style.transition = "transform 0.1s ease";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) translateY(0px)";
        card.style.transition = "transform 0.45s ease";
      });
    });
  }

  /* ── Spotlight cursor glow ── */
  function initSpotlight() {
    if (prefersReducedMotion()) return;
    const spot = document.getElementById("spotlight");
    if (!spot) return;
    let raf;
    let tx = -290, ty = -290;
    document.addEventListener("mousemove", (e) => {
      tx = e.clientX - 290;
      ty = e.clientY - 290;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        spot.style.left = tx + "px";
        spot.style.top  = ty + "px";
      });
    });
  }

  /* ── Animated skill bars ── */
  function initSkillBars() {
    const fills = document.querySelectorAll(".skill-bar-fill");
    if (!fills.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const fill = entry.target;
        const pct = fill.getAttribute("data-pct") || "0";
        fill.style.width = pct + "%";
        observer.unobserve(fill);
      });
    }, { threshold: 0.25 });
    fills.forEach((f) => observer.observe(f));
  }

  /* ── Cyberpunk theme switcher ── */
  function initThemeSwitcher() {
    const THEMES = ["", "theme-dracula", "theme-matrix", "theme-nord"];
    const LS_KEY = "portfolio-theme";
    const saved  = localStorage.getItem(LS_KEY) || "";
    applyTheme(saved);

    document.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.getAttribute("data-theme") || "";
        applyTheme(t);
        localStorage.setItem(LS_KEY, t);
      });
    });

    function applyTheme(t) {
      THEMES.forEach((cls) => { if (cls) document.body.classList.remove(cls); });
      if (t) document.body.classList.add(t);
      document.querySelectorAll(".theme-btn").forEach((b) => {
        const active = (b.getAttribute("data-theme") || "") === t;
        b.classList.toggle("theme-btn-active", active);
      });
    }
  }

  /* ══════════════════════════════════════════════════
     PACK 9 FUNCTIONS
  ══════════════════════════════════════════════════ */

  function initRecruiterScoreCard() {
    const card   = document.getElementById("recruiterScoreCard");
    const closeBtn = document.getElementById("rscClose");
    const dial   = document.getElementById("rscDialFill");
    const scoreEl = document.getElementById("rscScore");
    if (!card) return;
    const TARGET = 92;
    const C = 2 * Math.PI * 32;

    const show = () => {
      card.removeAttribute("hidden");
      let cur = 0;
      const step = () => {
        cur = Math.min(cur + 1, TARGET);
        if (scoreEl) scoreEl.textContent = cur;
        if (dial) dial.style.strokeDashoffset = C * (1 - cur / 100);
        if (cur < TARGET) requestAnimationFrame(step);
      };
      setTimeout(() => requestAnimationFrame(step), 300);
    };

    setTimeout(show, 30000);
    if (closeBtn) closeBtn.addEventListener("click", () => card.setAttribute("hidden", ""));
  }

  function initGithubFeed() {
    const list = document.getElementById("ghFeedList");
    if (!list) return;

    const FALLBACK = [
      { icon: "&#128190;", msg: "Pushed to <strong>wazuh-soc-lab</strong>",            ago: "recently" },
      { icon: "&#128260;", msg: "Opened PR in <strong>ci-cd-pipeline</strong>",         ago: "recently" },
      { icon: "&#128204;", msg: "Closed issue: Suricata rule false positive",            ago: "recently" },
      { icon: "&#11088;",  msg: "Starred <strong>SigmaHQ/sigma</strong>",               ago: "recently" },
      { icon: "&#128190;", msg: "Commit: fix Wazuh decoder regex",                       ago: "recently" },
    ];

    function timeAgo(dateStr) {
      const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
      if (diff < 60)   return diff + "s ago";
      if (diff < 3600) return Math.floor(diff / 60) + "m ago";
      if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
      return Math.floor(diff / 86400) + "d ago";
    }

    function iconFor(type) {
      return { PushEvent: "&#128190;", PullRequestEvent: "&#128260;",
               IssuesEvent: "&#128204;", WatchEvent: "&#11088;",
               CreateEvent: "&#10133;", ForkEvent: "&#127860;" }[type] || "&#128190;";
    }

    function msgFor(ev) {
      const repo = `<strong>${ev.repo.name.replace(/^Subash107\//, "")}</strong>`;
      if (ev.type === "PushEvent")       return `Pushed to ${repo}`;
      if (ev.type === "PullRequestEvent") return `${ev.payload.action === "opened" ? "Opened PR" : "Updated PR"} in ${repo}`;
      if (ev.type === "IssuesEvent")     return `${ev.payload.action} issue in ${repo}`;
      if (ev.type === "WatchEvent")      return `Starred ${repo}`;
      if (ev.type === "CreateEvent")     return `Created ${ev.payload.ref_type} in ${repo}`;
      if (ev.type === "ForkEvent")       return `Forked ${repo}`;
      return `Activity in ${repo}`;
    }

    function render(events) {
      events.slice(0, 6).forEach((ev, i) => setTimeout(() => {
        const li   = document.createElement("li");
        li.className = "gh-feed-item";
        li.style.animationDelay = (i * 80) + "ms";

        const icon = document.createElement("span");
        icon.className = "gh-type";
        icon.textContent = ev.icon;

        const msg = document.createElement("span");
        msg.className = "gh-msg";
        msg.textContent = ev.msg;

        const time = document.createElement("span");
        time.className = "gh-time";
        time.textContent = ev.ago;

        li.appendChild(icon);
        li.appendChild(msg);
        li.appendChild(time);
        list.appendChild(li);
      }, i * 150));
    }

    function showSkeletons() {
      for (let i = 0; i < 5; i++) {
        const li = document.createElement("li");
        li.className = "gh-skeleton";
        list.appendChild(li);
      }
    }

    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      showSkeletons();
      const ctrl = new AbortController();
      const ghTimeout = setTimeout(() => ctrl.abort(), 5000);
      fetch("https://api.github.com/users/Subash107/events/public", {
        headers: { Accept: "application/vnd.github+json" },
        signal: ctrl.signal
      })
      .then(r => { clearTimeout(ghTimeout); return r.ok ? r.json() : Promise.reject(); })
      .then(data => {
        list.innerHTML = "";
        const mapped = data.slice(0, 6).map(ev => ({
          icon: iconFor(ev.type), msg: msgFor(ev), ago: timeAgo(ev.created_at)
        }));
        render(mapped);
      })
      .catch(() => { clearTimeout(ghTimeout); list.innerHTML = ""; render(FALLBACK); });
    }, { threshold: 0.3 });
    io.observe(list);
  }

  function initContactHeatmap() {
    const fields = document.querySelectorAll(".contact-form-field input, .contact-form-field textarea");
    const heat = new Map();
    fields.forEach(f => {
      heat.set(f, 0);
      f.addEventListener("input", () => {
        heat.set(f, (heat.get(f) || 0) + 1);
        const max = Math.max(...heat.values(), 1);
        fields.forEach(ff => {
          const score = heat.get(ff) / max;
          ff.classList.toggle("hm-hot",  score > 0.6);
          ff.classList.toggle("hm-warm", score > 0.2 && score <= 0.6);
        });
      });
    });
  }

  function initChatWidget() {
    const toggleBtn = document.getElementById("chatToggleBtn");
    const panel     = document.getElementById("chatPanel");
    const closeBtn  = document.getElementById("chatClose");
    const input     = document.getElementById("chatInput");
    const sendBtn   = document.getElementById("chatSend");
    const messages  = document.getElementById("chatMessages");
    const quickBtns = document.querySelectorAll(".chat-q");
    if (!toggleBtn || !panel) return;

    const CHAT_API = "https://portfolio-chat-api.lamasubash107.workers.dev";

    const addMsg = (text, isUser) => {
      const div = document.createElement("div");
      div.className = "chat-msg " + (isUser ? "chat-user" : "chat-bot");
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    };

    const showTyping = () => {
      const t = document.createElement("div");
      t.className = "chat-typing";
      t.innerHTML = "<span></span><span></span><span></span>";
      messages.appendChild(t);
      messages.scrollTop = messages.scrollHeight;
      return t;
    };

    const ask = async text => {
      if (!text.trim()) return;
      addMsg(text, true);
      if (input) input.value = "";
      const typing = showTyping();

      try {
        const res = await fetch(CHAT_API, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ message: text }),
        });
        const data = await res.json();
        typing.remove();
        addMsg(data.reply || "Sorry, I couldn't get a response. Try again!", false);
      } catch {
        typing.remove();
        addMsg("I'm having connection issues. Please try again in a moment.", false);
      }
    };

    toggleBtn.addEventListener("click", () => { panel.toggleAttribute("hidden"); if (!panel.hasAttribute("hidden")) input?.focus(); });
    if (closeBtn) closeBtn.addEventListener("click", () => panel.setAttribute("hidden", ""));
    if (sendBtn)  sendBtn.addEventListener("click", () => ask(input?.value || ""));
    if (input)    input.addEventListener("keydown", e => { if (e.key === "Enter") ask(input.value); });
    quickBtns.forEach(btn => btn.addEventListener("click", () => { ask(btn.textContent); btn.closest(".chat-quick")?.remove(); }));
  }

  function initNeonSignature() {
    const path = document.getElementById("neonSigPath");
    if (!path) return;
    const svg = document.getElementById("neonSig");
    if (!svg) return;
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      setTimeout(() => path.classList.add("drawn"), 400);
    }, { threshold: 0.3 });
    io.observe(svg);
  }

  function initSOCDashboard() {
    /* Values are set in HTML; no dynamic incrementing — numbers are real home lab stats */
  }

  function initDraggableSkills() {
    const pills = document.querySelectorAll(".skill-pill");
    if (!pills.length) return;
    let dragged = null;
    pills.forEach(pill => {
      pill.setAttribute("draggable", "true");
      pill.addEventListener("dragstart", e => {
        dragged = pill;
        pill.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      pill.addEventListener("dragend",  () => { dragged = null; pill.classList.remove("dragging"); });
      pill.addEventListener("dragover",  e => { e.preventDefault(); pill.classList.add("drag-over"); });
      pill.addEventListener("dragleave", () => pill.classList.remove("drag-over"));
      pill.addEventListener("drop", e => {
        e.preventDefault();
        pill.classList.remove("drag-over");
        if (!dragged || dragged === pill) return;
        const parent = pill.parentNode;
        const pills2 = [...parent.children];
        const idxDrag = pills2.indexOf(dragged);
        const idxDrop = pills2.indexOf(pill);
        if (idxDrag < idxDrop) parent.insertBefore(dragged, pill.nextSibling);
        else parent.insertBefore(dragged, pill);
      });
    });
  }

  function initMouseTrailParticles() {
    if (isTouchDevice()) return;
    const canvas = document.getElementById("mouseTrailCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener("resize", () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

    const particles = [];
    const COLORS = ["rgba(80,250,123,", "rgba(138,232,255,", "rgba(189,147,249,"];

    document.addEventListener("mousemove", e => {
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: e.clientX, y: e.clientY,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2 - 0.4,
          r: Math.random() * 2.5 + 0.8,
          life: 1,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
      }
    }, { passive: true });

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.life.toFixed(2) + ")";
        ctx.fill();
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  function initSpeedBadge() {
    const badge = document.getElementById("speedBadge");
    if (!badge) return;
    const perf = window.performance;
    const onLoad = () => {
      const nav = performance.getEntriesByType("navigation")[0];
      const ms = nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0;
      if (ms <= 0) { setTimeout(onLoad, 200); return; }
      const sec = (ms / 1000).toFixed(2);
      badge.textContent = `&#9889; Loaded in ${sec}s`;
      badge.innerHTML = `&#9889; Loaded in ${sec}s`;
      badge.removeAttribute("hidden");
      setTimeout(() => { badge.style.transition = "opacity 0.8s ease"; badge.style.opacity = "0"; setTimeout(() => badge.setAttribute("hidden",""), 900); }, 5000);
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }

  function initStickyHeaders() {
    const sections = document.querySelectorAll("section[id]");
    sections.forEach(sec => {
      const h2 = sec.querySelector("h2");
      if (!h2) return;
      const sticky = document.createElement("div");
      sticky.className = "sticky-sec-header";
      sticky.textContent = h2.textContent;
      sec.insertBefore(sticky, sec.firstChild);
    });

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const sec = e.target;
        const h2  = sec.querySelector("h2");
        if (!h2) return;
        const h2Rect    = h2.getBoundingClientRect();
        const navHeight = 70;
        sec.classList.toggle("is-scrolling", h2Rect.bottom < navHeight && e.isIntersecting);
      });
    }, { threshold: [0, 0.1, 0.5, 1], rootMargin: "-60px 0px 0px 0px" });

    sections.forEach(s => io.observe(s));
  }

  /* ══════════════════════════════════════════════════
     PACK 8 FUNCTIONS
  ══════════════════════════════════════════════════ */

  function initStatsTicker() {
    const items = document.querySelectorAll(".st-num[data-target]");
    if (!items.length) return;
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      items.forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        const dur = 1800;
        const step = 16;
        const inc = target / (dur / step);
        let cur = 0;
        const tick = () => {
          cur = Math.min(cur + inc, target);
          el.textContent = Math.floor(cur) + (target >= 100 ? "+" : "");
          if (cur < target) setTimeout(tick, step);
        };
        tick();
      });
    }, { threshold: 0.4 });
    io.observe(items[0]);
  }

  function initHomelabDiagram() {
    const svg = document.getElementById("homelabSvg");
    if (!svg) return;
    const tooltip = document.getElementById("hlTooltip");
    const tipText = document.getElementById("hlTipText");
    const tipBg   = tooltip ? tooltip.querySelector(".hl-tip-bg") : null;
    const lines   = svg.querySelectorAll(".hl-line");

    lines.forEach((l, i) => setTimeout(() => l.classList.add("hl-active"), i * 120));

    svg.querySelectorAll(".hl-node").forEach(node => {
      node.addEventListener("mouseenter", e => {
        const tip = node.dataset.tip;
        if (!tip || !tooltip || !tipText || !tipBg) return;
        tipText.textContent = tip;
        const bbox = tipText.getBBox ? tipText.getBBox() : { width: 120, height: 10 };
        const pad = 10;
        const svgRect = svg.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const cx = (nodeRect.left + nodeRect.width / 2 - svgRect.left) * (540 / svgRect.width);
        const cy = parseFloat(node.getAttribute("transform")?.match(/translate\([^,]+,([^)]+)\)/)?.[1] || 0);
        const tw = bbox.width + pad * 2;
        const th = bbox.height + pad;
        tipBg.setAttribute("x",  cx - tw / 2);
        tipBg.setAttribute("y",  cy - 44);
        tipBg.setAttribute("width",  tw);
        tipBg.setAttribute("height", th + 4);
        tipText.setAttribute("x", cx);
        tipText.setAttribute("y", cy - 44 + th / 2 + 3);
        tooltip.style.display = "block";
      });
      node.addEventListener("mouseleave", () => { if (tooltip) tooltip.style.display = "none"; });
    });
  }

  function initSkillTreeDiagram() {
    const svg = document.getElementById("skillTreeSvg");
    if (!svg) return;
    const tooltip = document.getElementById("stTooltip");
    const tipText = document.getElementById("stTipText");
    const tipBg   = tooltip ? tooltip.querySelector(".hl-tip-bg") : null;

    svg.querySelectorAll(".st-edge").forEach((e, i) => setTimeout(() => e.classList.add("st-active"), i * 150));

    svg.querySelectorAll(".st-node").forEach(node => {
      node.addEventListener("mouseenter", () => {
        const tip = node.dataset.tip;
        if (!tip || !tooltip || !tipText || !tipBg) return;
        const circle = node.querySelector("circle");
        const cx = parseFloat(circle?.getAttribute("cx") || 0);
        const cy = parseFloat(circle?.getAttribute("cy") || 0);
        tipText.textContent = tip;
        const tw = Math.min(tip.length * 5.5 + 20, 260);
        tipBg.setAttribute("x",  cx - tw / 2);
        tipBg.setAttribute("y",  cy - 38);
        tipBg.setAttribute("width", tw);
        tipBg.setAttribute("height", 18);
        tipText.setAttribute("x", cx);
        tipText.setAttribute("y", cy - 26);
        tooltip.style.display = "block";
      });
      node.addEventListener("mouseleave", () => { if (tooltip) tooltip.style.display = "none"; });
    });
  }

  function initDarkWebScan() {
    /* Replaced with real threat intel links in HTML — function is a no-op */
  }

  function initNeonSpotlight() {
    const el = document.getElementById("neonSpotlight");
    if (!el) return;
    let ticking = false;
    document.addEventListener("mousemove", e => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        el.style.background = `radial-gradient(circle 160px at ${e.clientX}px ${e.clientY}px, rgba(80,250,123,0.04) 0%, rgba(80,250,123,0) 70%)`;
        ticking = false;
      });
    }, { passive: true });
  }

  function initCertStamp() {
    const cards = document.querySelectorAll(".cert-card");
    if (!cards.length) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("stamp-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });
    cards.forEach((c, i) => {
      c.style.animationDelay = (i * 80) + "ms";
      io.observe(c);
    });
  }

  function initIdleScreensaver() {
    const canvas = document.getElementById("screensaverCanvas");
    if (!canvas) return;
    let hint = null;
    let animId = null;
    let idleTimer = null;
    const IDLE_MS = 120000;

    const CHARS = "01アイウエオカキクケコWAZUHSIEMSOCNETSECSYSMON";

    const show = () => {
      canvas.removeAttribute("hidden");
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d");
      const cols = Math.floor(canvas.width / 16);
      const drops = Array(cols).fill(1);

      hint = document.createElement("div");
      hint.className = "screensaver-hint";
      hint.textContent = "Move mouse or press any key to continue";
      document.body.appendChild(hint);

      const draw = () => {
        ctx.fillStyle = "rgba(0,0,0,0.04)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#50fa7b";
        ctx.font = "14px monospace";
        drops.forEach((y, i) => {
          const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx.fillText(ch, i * 16, y * 16);
          if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        });
        animId = requestAnimationFrame(draw);
      };
      draw();
    };

    const hide = () => {
      cancelAnimationFrame(animId);
      canvas.setAttribute("hidden", "");
      if (hint) { hint.remove(); hint = null; }
      resetTimer();
    };

    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(show, IDLE_MS);
    };

    ["mousemove","keydown","click","touchstart","scroll"].forEach(ev => {
      document.addEventListener(ev, () => { if (!canvas.hasAttribute("hidden")) hide(); else resetTimer(); }, { passive: true });
    });

    resetTimer();
  }

  function initSoundPack() {
    const btn = document.getElementById("soundToggle");
    if (!btn) return;
    let enabled = false;
    let ctx = null;

    const getCtx = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };

    const playClick = () => {
      if (!enabled) return;
      try {
        const ac = getCtx();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.frequency.setValueAtTime(800, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.06);
        gain.gain.setValueAtTime(0.08, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
        osc.start(); osc.stop(ac.currentTime + 0.08);
      } catch(e) {}
    };

    const playType = () => {
      if (!enabled) return;
      try {
        const ac = getCtx();
        const buf = ac.createBuffer(1, ac.sampleRate * 0.04, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.015));
        const src = ac.createBufferSource();
        const gain = ac.createGain();
        src.buffer = buf; src.connect(gain); gain.connect(ac.destination);
        gain.gain.value = 0.06;
        src.start();
      } catch(e) {}
    };

    btn.addEventListener("click", () => {
      enabled = !enabled;
      btn.classList.toggle("sound-on", enabled);
      btn.title = enabled ? "Sound ON — click to disable" : "Sound OFF — click to enable";
      if (enabled) playClick();
    });

    document.addEventListener("click", e => {
      if (e.target.matches("button, a, .skill-pill, .cert-card, .tsg-item")) playClick();
    });

    const pitchOutput = document.getElementById("etBody");
    if (pitchOutput) {
      new MutationObserver(() => playType()).observe(pitchOutput, { childList: true, characterData: true, subtree: true });
    }

    window._playSoundClick = playClick;
  }

  function initCipherDecode() {
    const CIPHER = "X9@#!$%&*?=+~^<>[]{}|";
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const el = entry.target;
        const original = el.textContent;
        el.innerHTML = original.split("").map(c => `<span class="cipher-char">${c}</span>`).join("");
        const spans = el.querySelectorAll(".cipher-char");
        spans.forEach((span, i) => {
          const orig = span.textContent;
          if (orig.trim() === "") return;
          let iters = 0;
          const maxIters = 6 + Math.floor(Math.random() * 6);
          const delay = i * 35;
          setTimeout(() => {
            const scramble = setInterval(() => {
              span.classList.add("decoding");
              span.textContent = CIPHER[Math.floor(Math.random() * CIPHER.length)];
              iters++;
              if (iters >= maxIters) {
                clearInterval(scramble);
                span.textContent = orig;
                span.classList.remove("decoding");
                span.classList.add("decoded");
              }
            }, 55);
          }, delay);
        });
      });
    }, { threshold: 0.5 });

    document.querySelectorAll("h4.homelab-title, .soc-d-title, .gh-feed-title").forEach(el => {
      el.setAttribute("data-cipher", "");
      io.observe(el);
    });
  }

  function initSectionProgressRings() {
    const dots = document.querySelectorAll(".snd");
    if (!dots.length) return;
    const C = 2 * Math.PI * 4;

    dots.forEach(dot => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 16 16");
      const bg   = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const fill = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      [bg, fill].forEach(c => { c.setAttribute("cx","8"); c.setAttribute("cy","8"); c.setAttribute("r","4"); });
      bg.setAttribute("class",   "snd-ring-bg");
      fill.setAttribute("class", "snd-ring-fill");
      fill.setAttribute("stroke-dasharray", C);
      fill.setAttribute("stroke-dashoffset", C);
      svg.appendChild(bg); svg.appendChild(fill);
      dot.appendChild(svg);
      dot._ring = fill;
      dot._ringC = C;
    });

    const sections = Array.from(document.querySelectorAll("section[id]"));
    const update = () => {
      sections.forEach((sec, i) => {
        const dot = dots[i];
        if (!dot) return;
        const rect = sec.getBoundingClientRect();
        const vh = window.innerHeight;
        const visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
        const pct = visible / vh;
        if (dot._ring) dot._ring.setAttribute("stroke-dashoffset", dot._ringC * (1 - pct));
        dot.classList.toggle("active", pct > 0.3);
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ══════════════════════════════════════════════════
     PACK 7 FUNCTIONS
  ══════════════════════════════════════════════════ */

  function initProfileStrength() {
    const bar = document.getElementById("psBarFill");
    const pct = document.getElementById("psPct");
    if (!bar || !pct) return;
    const TARGET = 94;
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      let cur = 0;
      const step = () => {
        cur = Math.min(cur + 1, TARGET);
        bar.style.width = cur + "%";
        pct.textContent = cur + "%";
        if (cur < TARGET) requestAnimationFrame(step);
      };
      setTimeout(() => requestAnimationFrame(step), 300);
    }, { threshold: 0.3 });
    io.observe(bar);
  }

  function initPitchAutoPlay() {
    const btn = document.getElementById("pitchBtn");
    const terminal = document.getElementById("easterTerminal");
    const output   = terminal ? (terminal.querySelector("#etBody") || terminal.querySelector(".et-body")) : null;
    if (!btn) return;
    const PITCH = [
      "Hi! I'm Subash Lama — Cybersecurity Analyst based in Kathmandu, Nepal.",
      "12+ years in enterprise IT across banking, FMCG, hospitality, and consulting.",
      "I run a personal SOC lab: Wazuh SIEM, Suricata IDS, Sysmon — real detection engineering.",
      "Cisco-certified in Ethical Hacking & Endpoint Security. IBM-certified in Cybersecurity.",
      "I research security data normalisation and sensor correlation for threat detection.",
      "Active bug bounty researcher on HackerOne, Intigriti, and Bugcrowd.",
      "Open to SOC Analyst, Detection Engineer, GRC, and IAM roles — remote or on-site.",
      "— Let's talk. Type 'contact' or scroll down to reach me directly."
    ];
    let running = false;
    btn.addEventListener("click", () => {
      if (running) return;
      running = true;
      btn.classList.add("pitching");
      btn.textContent = "⏸ Playing…";
      if (terminal) {
        terminal.removeAttribute("hidden");
        if (output) output.innerHTML = "";
      }
      let lineIdx = 0;
      const writeLine = () => {
        if (lineIdx >= PITCH.length) {
          btn.classList.remove("pitching");
          btn.textContent = "▶ 30-sec Pitch";
          running = false;
          return;
        }
        const line = PITCH[lineIdx++];
        if (!output) { setTimeout(writeLine, 600); return; }
        const span = document.createElement("div");
        span.style.cssText = "color:#8ae8ff;font-size:0.82rem;margin-bottom:4px;";
        output.appendChild(span);
        let charIdx = 0;
        const typeChar = () => {
          if (charIdx < line.length) {
            span.textContent += line[charIdx++];
            output.scrollTop = output.scrollHeight;
            setTimeout(typeChar, 28);
          } else {
            setTimeout(writeLine, 480);
          }
        };
        typeChar();
      };
      writeLine();
    });
  }

  function initHorizontalTimeline() {
    const toggleBtns = document.querySelectorAll("[data-expview]");
    const listView   = document.getElementById("expList");
    const horizView  = document.getElementById("expHorizontal");
    if (!toggleBtns.length || !listView || !horizView) return;

    const buildHorizontal = () => {
      if (horizView.children.length) return;
      const cards = listView.querySelectorAll(".exp-card");
      cards.forEach(card => {
        const title = card.querySelector("h4, h5, .card-title, strong");
        const company = card.querySelector(".company, small, .text-muted, em");
        const date = card.querySelector(".date, time, .exp-date");
        const item = document.createElement("div");
        item.className = "exp-h-item";
        item.innerHTML = `
          <div class="exp-h-dot"></div>
          <div class="exp-h-year">${date ? date.textContent.trim().split(" ").pop() : ""}</div>
          <div class="exp-h-title">${title ? title.textContent.trim() : "Role"}</div>
          <div class="exp-h-co">${company ? company.textContent.trim() : ""}</div>`;
        horizView.appendChild(item);
      });
    };

    toggleBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.expview;
        toggleBtns.forEach(b => b.classList.toggle("cvt-active", b === btn));
        if (view === "horizontal") {
          buildHorizontal();
          listView.setAttribute("hidden", "");
          horizView.removeAttribute("hidden");
        } else {
          horizView.setAttribute("hidden", "");
          listView.removeAttribute("hidden");
        }
      });
    });
  }

  function initEmailSignature() {
    const sigBtn     = document.getElementById("sigBtn");
    const sigModal   = document.getElementById("sigModal");
    const sigClose   = document.getElementById("sigClose");
    const sigBackdrop= document.getElementById("sigBackdrop");
    const sigPreview = document.getElementById("sigPreview");
    const sigCopy    = document.getElementById("sigCopy");
    if (!sigBtn || !sigModal) return;

    const SIG_HTML = `
      <table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;font-size:13px;color:#222;">
        <tr>
          <td style="padding-right:14px;border-right:2px solid #50fa7b;vertical-align:middle;">
            <div style="font-weight:900;font-size:15px;color:#07111c;">Subash Lama</div>
            <div style="color:#555;font-size:12px;">Cybersecurity Analyst</div>
          </td>
          <td style="padding-left:14px;vertical-align:middle;line-height:1.6;">
            <div>&#128231; <a href="mailto:lamasubash107@gmail.com" style="color:#1a73e8;">lamasubash107@gmail.com</a></div>
            <div>&#128279; <a href="https://www.linkedin.com/in/subash-lama" style="color:#1a73e8;">linkedin.com/in/subash-lama</a></div>
            <div>&#128296; Cisco Certified &bull; SOC &bull; Wazuh &bull; SIEM</div>
          </td>
        </tr>
      </table>`;

    const open = () => {
      if (sigPreview) sigPreview.innerHTML = SIG_HTML;
      sigModal.removeAttribute("hidden");
    };
    const close = () => sigModal.setAttribute("hidden", "");

    sigBtn.addEventListener("click", open);
    if (sigClose)    sigClose.addEventListener("click", close);
    if (sigBackdrop) sigBackdrop.addEventListener("click", close);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !sigModal.hasAttribute("hidden")) close(); });

    if (sigCopy) {
      sigCopy.addEventListener("click", () => {
        navigator.clipboard.writeText(SIG_HTML).then(() => {
          sigCopy.textContent = "Copied!";
          sigCopy.classList.add("copied");
          setTimeout(() => { sigCopy.textContent = "Copy Signature"; sigCopy.classList.remove("copied"); }, 2000);
        });
      });
    }
  }

  function initFullPageSearch() {
    const overlay  = document.getElementById("searchOverlay");
    const backdrop = document.getElementById("soBackdrop");
    const input    = document.getElementById("soInput");
    const results  = document.getElementById("soResults");
    const closeBtn = document.getElementById("soClose");
    if (!overlay || !input) return;

    const SECTIONS = Array.from(document.querySelectorAll("section[id], div[id]"))
      .filter(el => el.offsetParent !== null)
      .map(el => ({
        id: el.id,
        label: (el.querySelector("h2, h3") || {}).textContent || el.id,
        texts: Array.from(el.querySelectorAll("p, li, span, h3, h4, .card-title, .card-text, .skill-pill"))
                 .map(n => n.textContent.trim()).filter(t => t.length > 3)
      }));

    const open  = () => { overlay.removeAttribute("hidden"); input.value = ""; results.innerHTML = ""; input.focus(); };
    const close = () => overlay.setAttribute("hidden", "");

    document.addEventListener("keydown", e => {
      if (e.key === "/" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName) && overlay.hasAttribute("hidden")) {
        e.preventDefault(); open();
      }
      if (e.key === "Escape" && !overlay.hasAttribute("hidden")) close();
    });

    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.innerHTML = ""; return; }
      const hits = [];
      SECTIONS.forEach(sec => {
        sec.texts.forEach(txt => {
          if (txt.toLowerCase().includes(q)) {
            const safe = txt.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
            const hi = safe.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`, "gi"), "<mark>$1</mark>");
            hits.push({ section: sec.label, id: sec.id, text: hi });
          }
        });
      });
      if (!hits.length) {
        const empty = document.createElement("div");
        empty.className = "so-empty";
        empty.textContent = `No results for "${q}"`;
        results.innerHTML = "";
        results.appendChild(empty);
        return;
      }
      results.innerHTML = hits.slice(0, 20).map(h =>
        `<a class="so-result" href="#${h.id}">
          <span class="so-result-section">${h.section}</span>
          <span class="so-result-text">${h.text}</span>
         </a>`
      ).join("");
      results.querySelectorAll(".so-result").forEach(a => a.addEventListener("click", close));
    });
  }

  function initAnalyticsPanel() {
    const panel     = document.getElementById("analyticsPanel");
    const backdrop  = document.getElementById("apBackdrop");
    const closeBtn  = document.getElementById("apClose");
    if (!panel) return;

    const startTime = Date.now();
    let interactions = 0;
    const seenSections = new Set();
    const totalSections = document.querySelectorAll("section[id]").length || 1;

    document.addEventListener("click", () => interactions++);

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) seenSections.add(e.target.id); });
    }, { threshold: 0.3 });
    document.querySelectorAll("section[id]").forEach(s => io.observe(s));

    const fmt = ms => { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; };

    const open = () => {
      const elapsed = Date.now() - startTime;
      const score = parseInt(document.getElementById("hsValue")?.textContent || "0", 10);
      const bookmarks = JSON.parse(localStorage.getItem("pinned_sections") || "[]").length;
      const visits = parseInt(localStorage.getItem("visit_count") || "0", 10);
      const expl = Math.round((seenSections.size / totalSections) * 100);

      document.getElementById("apTime").textContent       = fmt(elapsed);
      document.getElementById("apSections").textContent   = seenSections.size;
      document.getElementById("apScore").textContent      = score;
      document.getElementById("apBookmarks").textContent  = bookmarks;
      document.getElementById("apViews").textContent      = visits;
      document.getElementById("apInteractions").textContent = interactions;
      const bar = document.getElementById("apExplBar");
      const pct = document.getElementById("apExplPct");
      if (bar) { bar.style.width = expl + "%"; }
      if (pct)   pct.textContent = expl + "%";
      panel.removeAttribute("hidden");
    };
    const close = () => panel.setAttribute("hidden", "");

    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", e => {
      if (e.key === "a" || e.key === "A") {
        if (["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) return;
        if (!panel.hasAttribute("hidden")) { close(); return; }
        open();
      }
      if (e.key === "Escape" && !panel.hasAttribute("hidden")) close();
    });

    const cmdPalette = document.getElementById("commandPalette");
    if (cmdPalette) {
      cmdPalette.addEventListener("show", () => {
        cmdPalette.querySelectorAll(".cmd-key").forEach(k => {
          if (k.textContent.trim() === "A") {
            k.closest("li")?.addEventListener("click", open, { once: true });
          }
        });
      });
    }
  }

  function initGuidedTour() {
    const overlay = document.getElementById("tourOverlay");
    const stepEl  = document.getElementById("toStep");
    const titleEl = document.getElementById("toTitle");
    const tipEl   = document.getElementById("toTip");
    const prevBtn = document.getElementById("toPrev");
    const nextBtn = document.getElementById("toNext");
    const skipBtn = document.getElementById("toSkip");
    const closeBtn= document.getElementById("toClose");
    if (!overlay) return;

    const STOPS = [
      { section: "#hero",           title: "Hero",             tip: "Your headline. Recruiters see this first — it shows role, availability badge, and quick contact." },
      { section: "#about",          title: "About Me",         tip: "Scroll down for the full professional summary and the key credentials at a glance." },
      { section: "#experience",     title: "Experience",       tip: "Toggle between List and Timeline views. Each card has a Copy Markdown button." },
      { section: "#skills",         title: "Skills",           tip: "Radar chart + security ring + tech stack grid. Hover a skill pill for a tooltip." },
      { section: "#certifications", title: "Certifications",   tip: "Grid and Timeline views available. Hover a cert card for an animated glow." },
      { section: "#projects",       title: "Projects",         tip: "Filter by tag. Each card links to GitHub. Stars track engagement." },
      { section: "#contact",        title: "Contact",          tip: "All links open Gmail directly. You can also generate an email signature from here." },
    ];

    let idx = 0;

    const render = () => {
      if (stepEl)  stepEl.textContent  = `${idx + 1} / ${STOPS.length}`;
      if (titleEl) titleEl.textContent = STOPS[idx].title;
      if (tipEl)   tipEl.textContent   = STOPS[idx].tip;
      if (prevBtn) prevBtn.disabled    = idx === 0;
      if (nextBtn) nextBtn.textContent = idx === STOPS.length - 1 ? "Finish" : "Next →";
      const target = document.querySelector(STOPS[idx].section);
      if (target)  target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const open  = () => { idx = 0; render(); overlay.removeAttribute("hidden"); };
    const close = () => overlay.setAttribute("hidden", "");

    if (nextBtn) nextBtn.addEventListener("click", () => { if (idx < STOPS.length - 1) { idx++; render(); } else close(); });
    if (prevBtn) prevBtn.addEventListener("click", () => { if (idx > 0) { idx--; render(); } });
    if (skipBtn) skipBtn.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);

    document.addEventListener("keydown", e => {
      if ((e.key === "t" || e.key === "T") && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) {
        overlay.hasAttribute("hidden") ? open() : close();
      }
    });
  }

  function initPresentationMode() {
    let active = false;
    let indicator = null;

    const toggle = () => {
      active = !active;
      document.body.classList.toggle("presentation-mode", active);
      if (active) {
        indicator = document.createElement("div");
        indicator.className = "pres-indicator";
        indicator.textContent = "Presentation Mode — Press F to exit";
        document.body.appendChild(indicator);
      } else if (indicator) {
        indicator.remove(); indicator = null;
      }
    };

    document.addEventListener("keydown", e => {
      if ((e.key === "f" || e.key === "F") && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) toggle();
    });
  }

  function initCopyAsMarkdown() {
    document.querySelectorAll(".exp-card").forEach(card => {
      const section = card.closest("section");
      if (!section || !section.id.includes("exp")) return;

      const wrap = document.createElement("div");
      wrap.className = "exp-card-wrap";
      card.parentNode.insertBefore(wrap, card);
      wrap.appendChild(card);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "exp-md-btn";
      btn.title = "Copy as Markdown";
      btn.textContent = "⎘ MD";
      wrap.appendChild(btn);

      btn.addEventListener("click", () => {
        const title   = card.querySelector("h4, h5, .card-title, strong")?.textContent.trim() || "";
        const company = card.querySelector(".company, small, .text-muted, em")?.textContent.trim() || "";
        const date    = card.querySelector(".date, time, .exp-date")?.textContent.trim() || "";
        const bullets = Array.from(card.querySelectorAll("li")).map(li => `- ${li.textContent.trim()}`).join("\n");
        const md = `### ${title}\n**${company}** | ${date}\n\n${bullets}`;
        navigator.clipboard.writeText(md).then(() => {
          btn.textContent = "✓ Copied";
          btn.classList.add("md-copied");
          setTimeout(() => { btn.textContent = "⎘ MD"; btn.classList.remove("md-copied"); }, 1800);
        });
      });
    });
  }

  /* ── Tor visitor detection ── */
  async function initTorDetection() {
    const badge = document.getElementById("torBadge");
    const closeBtn = document.getElementById("torBadgeClose");
    if (!badge) return;

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch("https://check.torproject.org/api/ip", {
        cache: "no-store",
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.IsTor) return;

      badge.removeAttribute("hidden");
      setTimeout(() => badge.classList.add("tor-badge--visible"), 80);

      const autoDismiss = setTimeout(() => hideBadge(), 12000);

      function hideBadge() {
        clearTimeout(autoDismiss);
        badge.classList.remove("tor-badge--visible");
        setTimeout(() => badge.setAttribute("hidden", ""), 400);
      }

      if (closeBtn) closeBtn.addEventListener("click", hideBadge, { once: true });
    } catch {
      /* silent — Tor check is non-critical */
    }
  }

  /* ── Resume download tracker ── */
  /* PAT is stored securely in Cloudflare Worker — never exposed here */
  function initResumeTracking() {
    const btn = document.querySelector("[data-resume-download]");
    if (!btn) return;

    /* After deploying the Cloudflare Worker, replace this URL with your Worker URL */
    const TRACKER_URL = "https://lingering-surf-6d77.lamasubash107.workers.dev";

    btn.addEventListener("click", () => {

      const ua = navigator.userAgent;
      const getOS = () => {
        if (/Windows NT 1[01]/.test(ua)) return "Windows 11/10";
        if (/Windows/.test(ua)) return "Windows";
        if (/Mac OS X/.test(ua)) return "macOS";
        if (/iPhone/.test(ua)) return "iOS (iPhone)";
        if (/iPad/.test(ua)) return "iOS (iPad)";
        if (/Android/.test(ua)) return "Android";
        if (/Linux/.test(ua)) return "Linux";
        return "Unknown";
      };
      const getBrowser = () => {
        if (/Edg\//.test(ua)) return "Edge";
        if (/OPR\//.test(ua)) return "Opera";
        if (/Chrome\//.test(ua)) return "Chrome";
        if (/Firefox\//.test(ua)) return "Firefox";
        if (/Safari\//.test(ua)) return "Safari";
        return "Unknown";
      };
      const payload = {
        event_type: "resume-download",
        client_payload: {
          timestamp: new Date().toISOString(),
          os:        getOS(),
          browser:   getBrowser(),
          device:    /Mobi|Android|iPhone|iPad/.test(ua) ? "Mobile" : "Desktop",
          referrer:  document.referrer || "direct",
          tz:        Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
          lang:      navigator.language || "unknown",
          utm_source: new URLSearchParams(window.location.search).get("utm_source") || "direct",
          utm_medium: new URLSearchParams(window.location.search).get("utm_medium") || "none"
          /* ip, location, org are enriched server-side by the Cloudflare Worker */
        }
      };

      const dispatch = () => {
        fetch(TRACKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => {});
      };

      dispatch();
    });
  }

  function initDynamicDates() {
    const startYear = 2014;
    const now = new Date();
    const currentYear = now.getFullYear();
    const yearsIT = currentYear - startYear;

    const footerYear = document.getElementById("footerYear");
    if (footerYear) footerYear.textContent = currentYear;

    const workingDate = document.getElementById("workingOnDate");
    if (workingDate) {
      workingDate.textContent = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    }

    const heroStatYears = document.getElementById("heroStatYears");
    if (heroStatYears) heroStatYears.textContent = yearsIT + "+";

    const countUp = document.getElementById("itYearsCountUp");
    if (countUp) countUp.setAttribute("data-target", yearsIT);
  }

  function initArrivalPing() {
    const TRACKER_URL = "https://lingering-surf-6d77.lamasubash107.workers.dev";
    const refSource   = new URLSearchParams(window.location.search).get("ref")
                        || document.referrer
                        || "direct";

    const payload = {
      event_type: "page-visit",
      client_payload: {
        ref_source: refSource,
        timestamp:  new Date().toISOString(),
      },
    };

    fetch(TRACKER_URL + "/visit", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    }).catch(() => {});
  }

  function initBehaviorTracking() {
    const TRACKER_URL = "https://lingering-surf-6d77.lamasubash107.workers.dev";
    const startTime   = Date.now();
    const sections    = {};
    const clicks      = new Set();
    const pageSource  = new URLSearchParams(window.location.search).get("ref")
                        || new URLSearchParams(window.location.search).get("utm_source")
                        || document.referrer
                        || "direct";

    /* Track which sections are viewed and for how long */
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const id = e.target.id || e.target.className.split(" ")[0];
        if (!id) return;
        if (e.isIntersecting) {
          sections[id] = sections[id] || { start: Date.now(), total: 0 };
          sections[id].start = Date.now();
        } else if (sections[id]?.start) {
          sections[id].total = (sections[id].total || 0) + (Date.now() - sections[id].start);
          sections[id].start = null;
        }
      });
    }, { threshold: 0.3 });

    document.querySelectorAll("section[id], div[id]").forEach(el => observer.observe(el));

    /* Track scroll depth */
    let maxScroll = 0;
    window.addEventListener("scroll", () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0) {
        const pct = Math.round((window.scrollY / total) * 100);
        if (pct > maxScroll) maxScroll = pct;
      }
    }, { passive: true });

    /* Track key element clicks */
    const CLICK_TARGETS = [
      { sel: "[data-resume-download]",   label: "resume" },
      { sel: "a[href*='linkedin']",       label: "linkedin" },
      { sel: "a[href*='github.com']",     label: "github" },
      { sel: "[data-copy-email]",         label: "email" },
      { sel: "#vcardBtn",                 label: "vcard" },
      { sel: "a[href*='mailto']",         label: "mailto" },
      { sel: "#contactForm button[type='submit']", label: "contact-form" },
    ];
    CLICK_TARGETS.forEach(({ sel, label }) => {
      document.querySelectorAll(sel).forEach(el => {
        el.addEventListener("click", () => clicks.add(label), { passive: true });
      });
    });

    /* Send behavior report when visitor leaves */
    const sendReport = () => {
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      if (totalTime < 5) return;

      const topSections = Object.entries(sections)
        .filter(([, v]) => v.total > 2000)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 4)
        .map(([k, v]) => `${k}(${Math.round(v.total / 1000)}s)`)
        .join(", ");

      const payload = {
        event_type: "behavior-track",
        client_payload: {
          total_time:   totalTime + "s",
          top_sections: topSections || "none",
          scroll_depth: maxScroll + "%",
          clicks:       clicks.size ? Array.from(clicks).join(",") : "none",
          ref_source:   pageSource,
          timestamp:    new Date().toISOString(),
        },
      };

      navigator.sendBeacon
        ? navigator.sendBeacon(TRACKER_URL + "/behavior", JSON.stringify(payload))
        : fetch(TRACKER_URL + "/behavior", { method: "POST", body: JSON.stringify(payload), keepalive: true }).catch(() => {});
    };

    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sendReport(); });
    window.addEventListener("pagehide", sendReport);
  }

  function initDownloadCounter() {
    const badge = document.getElementById("resumeDownloadCount");
    if (!badge) return;
    fetch("https://raw.githubusercontent.com/Subash107/SubashLamaProfile/main/download-logs/resume-downloads.txt")
      .then(r => r.text())
      .then(text => {
        const count = (text.match(/^\d{4}/gm) || []).length;
        if (count > 0) badge.textContent = "(" + count + " downloads)";
      })
      .catch(() => {});
  }

  document.addEventListener("DOMContentLoaded", () => {
    initArrivalPing();
    initResumeTracking();
    initDownloadCounter();
    initBehaviorTracking();
    initDynamicDates();
    initAudioToggle();
    initScrollReveal();
    initBackToTop();
    initScrollProgress();
    initStickyNav();
    initNavHighlight();
    initCountUp();
    initContactForm();
    initCommandPalette();
    initPageTransitions();
    initTypingAnimation();
    initNepalTime();
    initEasterTerminal();
    initCopyEmail();
    initCardTilt();
    initSpotlight();
    initSkillBars();
    initThemeSwitcher();
    initParticleNetwork();
    initCursorTrail();
    initScrambleHeadings();
    initAchievementToasts();
    initKonamiCode();
    initThreatFeed();
    initSideNavDots();
    initSectionCounters();
    initVisitorCounter();
    initSkillRadar();
    initLightMode();
    initPrintShortcut();
    initCircuitBoard();
    initSecurityRing();
    initHireMeFloat();
    initStaggeredReveal();
    initTabTyping();
    initCurrentlyStudying();
    initHexSkillToggle();
    initCertToggle();
    initCommandSearch();
    initMagneticButtons();
    initBackToTopRing();
    initConfetti();
    initSkillTooltips();
    initTestimonialsSlider();
    initFocusMode();
    initCopyProfileUrl();
    /* initHackerScore — removed: gamification HUD hidden for professional presentation */
    initBookmarkPins();
    initCustomCursor();
    initFilmGrain();
    initParallaxOrbs();
    initVCardDownload();
    initRelativeDates();
    initRecruiterModal();
    initProjectTagFilter();
    initScrollBlur();
    initEQVisualizer();
    initHueShift();
    /* initRecruiterScoreCard — removed: presumptuous framing removed */
    initGithubFeed();
    initContactHeatmap();
    initChatWidget();
    initNeonSignature();
    initSOCDashboard();
    initDraggableSkills();
    initMouseTrailParticles();
    initSpeedBadge();
    initStickyHeaders();
    initStatsTicker();
    initHomelabDiagram();
    initSkillTreeDiagram();
    /* initDarkWebScan — replaced with real threat intel links in HTML */
    initNeonSpotlight();
    initCertStamp();
    initIdleScreensaver();
    initSoundPack();
    initCipherDecode();
    initSectionProgressRings();
    initProfileStrength();
    initPitchAutoPlay();
    initHorizontalTimeline();
    initEmailSignature();
    initFullPageSearch();
    initAnalyticsPanel();
    initGuidedTour();
    initPresentationMode();
    initCopyAsMarkdown();

    const scheduleNonCriticalStartup = () => {
      scheduleDeferredTask(initResumeDownload, { timeout: 1200 });
      scheduleDeferredTask(initBackgroundVideo, { timeout: 2200, delay: 220 });
      scheduleDeferredTask(initTorDetection,   { timeout: 3000, delay: 1500 });
    };

    if (document.readyState === "complete") {
      scheduleNonCriticalStartup();
      return;
    }

    window.addEventListener("load", scheduleNonCriticalStartup, { once: true });
  });
})();
