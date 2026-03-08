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

  document.addEventListener("DOMContentLoaded", () => {
    initResumeDownload();
    initBackgroundVideo();
    initAudioToggle();
    initScrollReveal();
  });
})();
