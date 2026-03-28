document.addEventListener('DOMContentLoaded', () => {
      const runAfterPaint = callback => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(callback);
        });
      };

      const scheduleNonCriticalWork = callback => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => runAfterPaint(callback), { timeout: 1600 });
          return;
        }

        if (document.readyState === 'complete') {
          window.setTimeout(() => runAfterPaint(callback), 240);
          return;
        }

        window.addEventListener('load', () => {
          window.setTimeout(() => runAfterPaint(callback), 240);
        }, { once: true });
      };

      const body = document.body;
      const loader = document.querySelector('[data-loader]');
      const loaderStatus = document.querySelector('[data-loader-status]');
      const loaderIndicator = document.querySelector('[data-loader-indicator]');
      const loaderLab = document.querySelector('[data-loader-lab]');
      const loaderSelectButtons = Array.from(document.querySelectorAll('[data-loader-select]'));
      const loaderReplayButton = document.querySelector('[data-loader-replay]');
      const heroTerminalName = document.querySelector('[data-terminal-name]');
      const heroTerminalCursor = document.querySelector('[data-terminal-cursor]');
      const heroTerminalFullName = heroTerminalName
        ? (heroTerminalName.dataset.terminalFull || heroTerminalName.textContent || '').trim()
        : '';
      const reducedLoaderMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const loaderStyleStorageKey = 'portfolio_loader_style_preview';
      const loaderStyleQueryParam = 'loaderStyle';
      const loaderSeenStorageKey = 'portfolio_loader_seen';
      const loaderStyles = {
        boot: {
          label: 'Cyber Screenshot Boot',
          statuses: [
            'Initializing portfolio workspace...',
            'Mounting deployment snapshots...',
            'Syncing observability surfaces...',
            'Opening secure interface...'
          ],
          checkpoints: [50, 180, 390, 640],
          progress: [0.16, 0.44, 0.74, 0.9],
          duration: 980,
          finalStatus: 'Cyber screenshot boot ready.'
        },
        hud: {
          label: 'Terminal + HUD Loader',
          statuses: [
            'Booting terminal surface...',
            'Loading secure session traces...',
            'Aligning HUD vectors...',
            'Command layer online...'
          ],
          checkpoints: [50, 170, 360, 610],
          progress: [0.18, 0.46, 0.74, 0.9],
          duration: 940,
          finalStatus: 'Terminal HUD synchronized.'
        },
        reveal: {
          label: 'Name Scan Reveal',
          statuses: [
            'Preparing identity signature...',
            'Sweeping name scanline...',
            'Locking visual signal...',
            'Revealing portfolio...'
          ],
          checkpoints: [50, 150, 320, 560],
          progress: [0.18, 0.48, 0.76, 0.9],
          duration: 900,
          finalStatus: 'Name reveal complete.'
        }
      };

      let activeLoaderStyle = 'boot';
      let loaderRunToken = 0;
      let loaderTimerHandles = [];
      let heroTerminalRunToken = 0;
      let heroTerminalTimerHandles = [];
      let hasSeenLoader = false;

      try {
        hasSeenLoader = window.sessionStorage.getItem(loaderSeenStorageKey) === 'true';
      } catch {
        hasSeenLoader = false;
      }

      const clearLoaderTimers = () => {
        loaderTimerHandles.forEach(handle => window.clearTimeout(handle));
        loaderTimerHandles = [];
      };

      const clearHeroTerminalTimers = () => {
        heroTerminalTimerHandles.forEach(handle => window.clearTimeout(handle));
        heroTerminalTimerHandles = [];
      };

      const startHeroTerminalTyping = () => {
        if (!heroTerminalName) {
          return;
        }

        heroTerminalRunToken += 1;
        const runToken = heroTerminalRunToken;

        clearHeroTerminalTimers();

        if (reducedLoaderMotion || !heroTerminalFullName) {
          heroTerminalName.textContent = heroTerminalFullName;
          return;
        }

        const characters = Array.from(heroTerminalFullName);
        heroTerminalName.textContent = '';

        characters.forEach((_, index) => {
          heroTerminalTimerHandles.push(window.setTimeout(() => {
            if (runToken !== heroTerminalRunToken) {
              return;
            }

            heroTerminalName.textContent = characters.slice(0, index + 1).join('');
          }, 40 + index * 52));
        });
      };

      const syncLoaderStyleUrl = style => {
        if (!window.history || typeof window.history.replaceState !== 'function') {
          return;
        }

        try {
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set(loaderStyleQueryParam, style);
          window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
        } catch {
          // Ignore malformed URLs or browser limitations.
        }
      };

      const resolveLoaderStyle = style => (Object.prototype.hasOwnProperty.call(loaderStyles, style) ? style : 'boot');

      const setLoaderProgress = progress => {
        if (!loader) {
          return;
        }

        loader.style.setProperty('--loader-progress', String(progress));
      };

      const setLoaderStatus = text => {
        if (loaderStatus) {
          loaderStatus.textContent = text;
        }
      };

      const applyLoaderStyle = (style, { persist = true, syncUrl = true } = {}) => {
        const nextStyle = resolveLoaderStyle(style);
        activeLoaderStyle = nextStyle;

        if (loader) {
          loader.dataset.loaderStyle = nextStyle;
        }

        if (loaderIndicator) {
          loaderIndicator.textContent = loaderStyles[nextStyle].label;
        }

        loaderSelectButtons.forEach(button => {
          const isActive = button.dataset.loaderSelect === nextStyle;
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        if (persist) {
          try {
            window.localStorage.setItem(loaderStyleStorageKey, nextStyle);
          } catch {
            // Ignore private mode or storage issues.
          }
        }

        if (syncUrl) {
          syncLoaderStyleUrl(nextStyle);
        }

        return nextStyle;
      };

      const restartLoaderAnimations = () => {
        if (!loader) {
          return;
        }

        loader.classList.remove('is-running');
        void loader.offsetWidth;
        loader.classList.add('is-running');
      };

      const finishLoaderRun = runToken => {
        if (runToken !== loaderRunToken) {
          return;
        }

        clearLoaderTimers();

        if (loader) {
          loader.classList.remove('is-running');
          loader.setAttribute('aria-hidden', 'true');
        }

        if (body) {
          body.classList.remove('loader-active');
        }

        try {
          window.sessionStorage.setItem(loaderSeenStorageKey, 'true');
          hasSeenLoader = true;
        } catch {
          hasSeenLoader = true;
        }

        startHeroTerminalTyping();
      };

      const startLoaderRun = (style, { persist = true, syncUrl = true, mode = 'auto' } = {}) => {
        if (!loader || !body) {
          if (body) {
            body.classList.remove('loader-active');
          }
          return;
        }

        const nextStyle = applyLoaderStyle(style, { persist, syncUrl });
        const config = loaderStyles[nextStyle];

        loaderRunToken += 1;
        const runToken = loaderRunToken;

        clearLoaderTimers();
        body.classList.add('loader-active');
        loader.setAttribute('aria-hidden', 'false');
        setLoaderProgress(0.02);
        setLoaderStatus(config.statuses[0]);
        restartLoaderAnimations();

        const useQuickPath = mode === 'auto' && hasSeenLoader;

        if (reducedLoaderMotion || useQuickPath) {
          setLoaderProgress(1);
          setLoaderStatus(config.finalStatus);
          loaderTimerHandles.push(window.setTimeout(() => finishLoaderRun(runToken), useQuickPath ? 120 : 260));
          return;
        }

        config.statuses.forEach((status, index) => {
          const checkpoint = config.checkpoints[index];
          const progress = config.progress[index];

          loaderTimerHandles.push(window.setTimeout(() => {
            if (runToken !== loaderRunToken) {
              return;
            }

            setLoaderStatus(status);
            setLoaderProgress(progress);
          }, checkpoint));
        });

        loaderTimerHandles.push(window.setTimeout(() => {
          if (runToken !== loaderRunToken) {
            return;
          }

          setLoaderProgress(1);
          setLoaderStatus(config.finalStatus);
        }, Math.max(0, config.duration - 180)));

        loaderTimerHandles.push(window.setTimeout(() => finishLoaderRun(runToken), config.duration));
      };

      const getInitialLoaderStyle = () => {
        try {
          const queryStyle = new URLSearchParams(window.location.search).get(loaderStyleQueryParam);
          const savedStyle = window.localStorage.getItem(loaderStyleStorageKey);

          if (queryStyle) {
            return resolveLoaderStyle(queryStyle);
          }

          if (savedStyle) {
            return resolveLoaderStyle(savedStyle);
          }
        } catch {
          // Ignore URL or storage failures and use the default style.
        }

        return 'boot';
      };

      if (loader) {
        const initialLoaderStyle = getInitialLoaderStyle();
        startLoaderRun(initialLoaderStyle, { persist: false, syncUrl: false, mode: 'auto' });

        loaderSelectButtons.forEach(button => {
          button.addEventListener('click', () => {
            startLoaderRun(button.dataset.loaderSelect, { mode: 'full' });
          });
        });

        if (loaderReplayButton) {
          loaderReplayButton.addEventListener('click', () => {
            startLoaderRun(activeLoaderStyle, { mode: 'full' });
          });
        }
      } else if (body) {
        body.classList.remove('loader-active');
        startHeroTerminalTyping();
      }

      scheduleNonCriticalWork(() => {
      const enableLegacyHeroAnimation = false;

      if (enableLegacyHeroAnimation) {
      const heroName = document.querySelector('.hero-name');
      const heroNameSvg = document.getElementById('heroNameSvg');
      const heroVariantButtons = Array.from(document.querySelectorAll('[data-hero-variant-value]'));
      const heroNameSolidParts = Array.from(document.querySelectorAll('[data-hero-name-solid]'));
      const heroNameHighlightParts = Array.from(document.querySelectorAll('[data-hero-name-highlight]'));
      const heroNamePrimarySweeps = Array.from(document.querySelectorAll('[data-hero-name-sweep="primary"]'));
      const heroNameSecondarySweeps = Array.from(document.querySelectorAll('[data-hero-name-sweep="secondary"]'));
      const heroNamePrimarySignals = Array.from(document.querySelectorAll('[data-hero-name-signal="primary"]'));
      const heroNameSecondarySignals = Array.from(document.querySelectorAll('[data-hero-name-signal="secondary"]'));
      const heroNameAura = document.getElementById('heroNameAura');
      const heroNameHud = document.getElementById('heroNameHud');
      const heroCircularBand = document.getElementById('heroCircularBand');
      const heroCircularRails = document.getElementById('heroCircularRails');
      const heroCircularFrame = document.getElementById('heroCircularFrame');
      const heroCircularHud = document.getElementById('heroCircularHud');
      const heroCircularHalo = document.getElementById('heroCircularHalo');
      const heroCircularOuterDots = document.getElementById('heroCircularOuterDots');
      const heroCircularOuterRing = document.getElementById('heroCircularOuterRing');
      const heroCircularRotorOuter = document.getElementById('heroCircularRotorOuter');
      const heroCircularRotorInner = document.getElementById('heroCircularRotorInner');
      const heroCircularCore = document.getElementById('heroCircularCore');
      const heroCircularCoreOutline = document.getElementById('heroCircularCoreOutline');
      const heroCircularScanLine = document.getElementById('heroCircularScanLine');
      const heroCircularScanGlow = document.getElementById('heroCircularScanGlow');
      const heroNameLightBand = document.getElementById('heroNameLightBand');
      const heroNameRails = document.getElementById('heroNameRails');
      const heroNameFrame = document.getElementById('heroNameFrame');
      const heroCenterHud = document.getElementById('heroCenterHud');
      const heroCenterHalo = document.getElementById('heroCenterHalo');
      const heroCenterOuter = document.getElementById('heroCenterOuter');
      const heroCenterTicks = document.getElementById('heroCenterTicks');
      const heroCenterRotorPrimary = document.getElementById('heroCenterRotorPrimary');
      const heroCenterRotorSecondary = document.getElementById('heroCenterRotorSecondary');
      const heroCenterCore = document.getElementById('heroCenterCore');
      const heroCenterCoreOutline = document.getElementById('heroCenterCoreOutline');
      const heroCenterScanLine = document.getElementById('heroCenterScanLine');
      const heroCenterScanGlow = document.getElementById('heroCenterScanGlow');
      const heroSciFiBand = document.getElementById('heroSciFiBand');
      const heroSciFiRails = document.getElementById('heroSciFiRails');
      const heroSciFiFrame = document.getElementById('heroSciFiFrame');
      const heroSciFiCore = document.getElementById('heroSciFiCore');
      const heroSciFiHalo = document.getElementById('heroSciFiHalo');
      const heroSciFiOuter = document.getElementById('heroSciFiOuter');
      const heroSciFiOuterTicks = document.getElementById('heroSciFiOuterTicks');
      const heroSciFiRotorPrimary = document.getElementById('heroSciFiRotorPrimary');
      const heroSciFiRotorSecondary = document.getElementById('heroSciFiRotorSecondary');
      const heroSciFiHex = document.getElementById('heroSciFiHex');
      const heroSciFiScanLine = document.getElementById('heroSciFiScanLine');
      const heroSciFiScanGlow = document.getElementById('heroSciFiScanGlow');
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
      const lerp = (start, end, progress) => start + (end - start) * progress;
      const scaleAround = (centerX, centerY, scaleValue) => (
        `translate(${centerX} ${centerY}) scale(${scaleValue.toFixed(3)}) translate(${-centerX} ${-centerY})`
      );
      const heroVariantStorageKey = 'portfolio_hero_name_variant_preview';
      const heroVariantQueryParam = 'heroVariant';
      const validHeroVariants = new Set(['circular', 'premium', 'scifi']);
      const syncHeroVariantUrl = nextVariant => {
        if (!window.history || typeof window.history.replaceState !== 'function') {
          return;
        }

        try {
          const nextUrl = new URL(window.location.href);
          if (nextUrl.searchParams.get(heroVariantQueryParam) === nextVariant) {
            return;
          }
          nextUrl.searchParams.set(heroVariantQueryParam, nextVariant);
          window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
        } catch {
          // Ignore malformed URLs or browser limitations.
        }
      };
      const setHeroVariant = (variant, { syncUrl = true } = {}) => {
        const nextVariant = validHeroVariants.has(variant) ? variant : 'circular';
        if (heroName) {
          heroName.dataset.heroVariant = nextVariant;
        }
        heroVariantButtons.forEach(button => {
          const isActive = button.dataset.heroVariantValue === nextVariant;
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        try {
          window.localStorage.setItem(heroVariantStorageKey, nextVariant);
        } catch {
          // Ignore storage issues in private browsing or restricted contexts.
        }
        if (syncUrl) {
          syncHeroVariantUrl(nextVariant);
        }
      };
      const getHeroVariant = () => {
        if (heroName && validHeroVariants.has(heroName.dataset.heroVariant)) {
          return heroName.dataset.heroVariant;
        }
        return 'circular';
      };
      let initialHeroVariant = 'circular';
      try {
        const queryVariant = new URLSearchParams(window.location.search).get(heroVariantQueryParam);
        const savedVariant = window.localStorage.getItem(heroVariantStorageKey);
        if (queryVariant && validHeroVariants.has(queryVariant)) {
          initialHeroVariant = queryVariant;
        } else if (savedVariant && validHeroVariants.has(savedVariant)) {
          initialHeroVariant = savedVariant;
        } else if (heroName && validHeroVariants.has(heroName.dataset.heroVariant)) {
          initialHeroVariant = heroName.dataset.heroVariant;
        }
      } catch {
        const queryVariant = new URLSearchParams(window.location.search).get(heroVariantQueryParam);
        if (queryVariant && validHeroVariants.has(queryVariant)) {
          initialHeroVariant = queryVariant;
        } else if (heroName && validHeroVariants.has(heroName.dataset.heroVariant)) {
          initialHeroVariant = heroName.dataset.heroVariant;
        }
      }
      setHeroVariant(initialHeroVariant);
      heroVariantButtons.forEach(button => {
        button.addEventListener('click', () => {
          setHeroVariant(button.dataset.heroVariantValue);
        });
      });
      if (heroName && heroNameSvg && heroNameSolidParts.length && !reducedMotion) {
        const hudCenter = { x: 380, y: 108 };
        const motion = {
          targetX: 0,
          targetY: 0,
          currentX: 0,
          currentY: 0,
          targetIntensity: 0,
          currentIntensity: 0,
          pulse: 0,
          lastPulseAt: 0
        };

        const triggerPulse = (timestamp = performance.now()) => {
          motion.pulse = 1;
          motion.lastPulseAt = timestamp;
        };

        const handlePointer = event => {
          const bounds = heroName.getBoundingClientRect();
          if (!bounds.width || !bounds.height) {
            return;
          }
          const normalizedX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
          const normalizedY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
          motion.targetX = clamp(normalizedX, -1, 1);
          motion.targetY = clamp(normalizedY, -1, 1);
          motion.targetIntensity = clamp(Math.hypot(normalizedX, normalizedY), 0, 1);
          if ((performance.now() - motion.lastPulseAt) > 140) {
            triggerPulse();
          }
          heroName.classList.add('is-interacting');
        };

        const resetPointer = () => {
          motion.targetX = 0;
          motion.targetY = 0;
          motion.targetIntensity = 0;
          heroName.classList.remove('is-interacting');
        };

        let previousTimestamp = 0;
        const animateHeroHud = timestamp => {
          const time = timestamp * 0.001;
          const frameDeltaMs = previousTimestamp ? Math.min(40, timestamp - previousTimestamp) : 16.7;
          previousTimestamp = timestamp;

          motion.currentX += (motion.targetX - motion.currentX) * 0.1;
          motion.currentY += (motion.targetY - motion.currentY) * 0.1;
          motion.currentIntensity += (motion.targetIntensity - motion.currentIntensity) * 0.08;
          motion.pulse *= Math.pow(0.9, frameDeltaMs / 16.7);
          if (motion.pulse < 0.01) {
            motion.pulse = 0;
          }

          const ambientFloat = Math.sin(time * 0.86) * 2.8 + Math.cos(time * 0.46) * 1.2;
          const glowPulse = (Math.sin(time * 1.34) + 1) * 0.5;
          const currentVariant = getHeroVariant();
          const railShiftX = motion.currentX * 5.5;
          const railShiftY = motion.currentY * 2.4;
          const hudShiftX = motion.currentX * 7;
          const hudShiftY = motion.currentY * 3.5 + ambientFloat * 0.2;

          const tiltX = -motion.currentY * 4.4 + Math.cos(time * 0.72) * 0.5;
          const tiltY = motion.currentX * 6.8 + Math.sin(time * 0.84) * 0.7;
          const depth = 3.2 + motion.currentIntensity * 4.2 + motion.pulse * 1.8;
          heroName.style.setProperty('--name-float-y', `${ambientFloat.toFixed(2)}px`);
          heroName.style.setProperty('--name-rotate-x', `${tiltX.toFixed(2)}deg`);
          heroName.style.setProperty('--name-rotate-y', `${tiltY.toFixed(2)}deg`);
          heroName.style.setProperty('--name-depth', `${depth.toFixed(2)}px`);

          if (heroNameAura) {
            const auraRx = currentVariant === 'circular'
              ? 296 + glowPulse * 18 + motion.currentIntensity * 24 + motion.pulse * 18
              : currentVariant === 'scifi'
                ? 304 + glowPulse * 20 + motion.currentIntensity * 28 + motion.pulse * 22
                : 286 + glowPulse * 14 + motion.currentIntensity * 18 + motion.pulse * 14;
            const auraRy = currentVariant === 'circular'
              ? 50 + glowPulse * 4 + motion.currentIntensity * 7
              : currentVariant === 'scifi'
                ? 54 + glowPulse * 5 + motion.currentIntensity * 9
                : 46 + glowPulse * 3 + motion.currentIntensity * 6;
            const auraOpacity = currentVariant === 'circular'
              ? 0.08 + glowPulse * 0.08 + motion.currentIntensity * 0.09 + motion.pulse * 0.14
              : currentVariant === 'scifi'
                ? 0.1 + glowPulse * 0.1 + motion.currentIntensity * 0.1 + motion.pulse * 0.16
                : 0.06 + glowPulse * 0.07 + motion.currentIntensity * 0.08 + motion.pulse * 0.12;
            heroNameAura.setAttribute('rx', auraRx.toFixed(2));
            heroNameAura.setAttribute('ry', auraRy.toFixed(2));
            heroNameAura.style.opacity = auraOpacity.toFixed(3);
          }

          if (heroNameHud) {
            heroNameHud.setAttribute('transform', `translate(${hudShiftX.toFixed(2)} ${hudShiftY.toFixed(2)})`);
            heroNameHud.style.opacity = (0.74 + motion.currentIntensity * 0.1 + motion.pulse * 0.08).toFixed(3);
          }

          if (heroCircularBand) {
            const bandScale = 1 + glowPulse * 0.016 + motion.pulse * 0.05;
            heroCircularBand.style.opacity = (0.03 + glowPulse * 0.02 + motion.currentIntensity * 0.018).toFixed(3);
            heroCircularBand.setAttribute(
              'transform',
              `${scaleAround(hudCenter.x, hudCenter.y, bandScale)} translate(${(motion.currentX * 2.6).toFixed(2)} ${(motion.currentY * 1.2).toFixed(2)})`
            );
          }

          if (heroCircularRails) {
            heroCircularRails.setAttribute('transform', `translate(${(motion.currentX * 3.8).toFixed(2)} ${(motion.currentY * 1.8).toFixed(2)})`);
            heroCircularRails.style.opacity = (0.52 + glowPulse * 0.12 + motion.currentIntensity * 0.08).toFixed(3);
          }

          if (heroCircularFrame) {
            heroCircularFrame.setAttribute('transform', `translate(${(motion.currentX * 2.8).toFixed(2)} 0)`);
            heroCircularFrame.style.opacity = (0.36 + glowPulse * 0.1 + motion.currentIntensity * 0.08).toFixed(3);
          }

          if (heroCircularHud) {
            const circularScale = 1 + glowPulse * 0.024 + motion.currentIntensity * 0.014 + motion.pulse * 0.08;
            heroCircularHud.setAttribute(
              'transform',
              `rotate(${(Math.sin(time * 0.36) * 1.2 + motion.currentX * 2.2).toFixed(2)} ${hudCenter.x} ${hudCenter.y}) ${scaleAround(hudCenter.x, hudCenter.y, circularScale)}`
            );
          }

          if (heroCircularHalo) {
            heroCircularHalo.setAttribute('r', `${(96 + glowPulse * 8 + motion.currentIntensity * 8 + motion.pulse * 10).toFixed(2)}`);
            heroCircularHalo.style.opacity = (0.1 + glowPulse * 0.1 + motion.currentIntensity * 0.07 + motion.pulse * 0.14).toFixed(3);
          }

          if (heroCircularOuterRing) {
            heroCircularOuterRing.style.opacity = (0.36 + glowPulse * 0.12 + motion.currentIntensity * 0.1).toFixed(3);
          }

          if (heroCircularOuterDots) {
            heroCircularOuterDots.setAttribute(
              'transform',
              `rotate(${(-time * 8 - motion.pulse * 16).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
            heroCircularOuterDots.style.opacity = (0.5 + glowPulse * 0.18 + motion.currentIntensity * 0.1).toFixed(3);
          }

          if (heroCircularRotorOuter) {
            heroCircularRotorOuter.setAttribute(
              'transform',
              `rotate(${(time * 18 + motion.currentX * 8 + motion.pulse * 18).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
          }

          if (heroCircularRotorInner) {
            heroCircularRotorInner.setAttribute(
              'transform',
              `rotate(${(-time * 24 - motion.currentY * 8 - motion.pulse * 20).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
          }

          if (heroCircularCore) {
            heroCircularCore.setAttribute('r', `${(20 + glowPulse * 1.3 + motion.pulse * 2.4).toFixed(2)}`);
            heroCircularCore.style.opacity = (0.7 + glowPulse * 0.1 + motion.pulse * 0.08).toFixed(3);
          }

          if (heroCircularCoreOutline) {
            heroCircularCoreOutline.setAttribute('r', `${(20 + glowPulse * 0.8 + motion.pulse * 1.6).toFixed(2)}`);
            heroCircularCoreOutline.style.opacity = (0.68 + glowPulse * 0.12 + motion.pulse * 0.1).toFixed(3);
          }

          if (heroCircularScanLine) {
            const scanY = 82 + ((Math.sin(time * 1.92) + 1) * 0.5) * 12 + motion.pulse * 1.2;
            heroCircularScanLine.setAttribute('y', scanY.toFixed(2));
            heroCircularScanLine.style.opacity = (0.36 + glowPulse * 0.16 + motion.pulse * 0.12).toFixed(3);
          }

          if (heroCircularScanGlow) {
            const glowY = 74 + ((Math.sin(time * 1.92) + 1) * 0.5) * 12 + motion.pulse * 1.2;
            heroCircularScanGlow.setAttribute('y', glowY.toFixed(2));
            heroCircularScanGlow.style.opacity = (0.14 + glowPulse * 0.1 + motion.pulse * 0.1).toFixed(3);
          }

          if (heroNameLightBand) {
            const bandOpacity = 0.035 + glowPulse * 0.024 + motion.currentIntensity * 0.018;
            const bandScale = 1 + motion.currentIntensity * 0.01 + motion.pulse * 0.03;
            heroNameLightBand.style.opacity = bandOpacity.toFixed(3);
            heroNameLightBand.setAttribute(
              'transform',
              `${scaleAround(hudCenter.x, hudCenter.y, bandScale)} translate(${(motion.currentX * 3).toFixed(2)} ${(motion.currentY * 1.5).toFixed(2)})`
            );
          }

          if (heroNameRails) {
            heroNameRails.setAttribute('transform', `translate(${railShiftX.toFixed(2)} ${railShiftY.toFixed(2)})`);
            heroNameRails.style.opacity = (0.6 + glowPulse * 0.12 + motion.currentIntensity * 0.08).toFixed(3);
          }

          if (heroNameFrame) {
            const frameShiftX = motion.currentX * 3.5 + Math.sin(time * 0.9) * 0.6;
            heroNameFrame.setAttribute('transform', `translate(${frameShiftX.toFixed(2)} 0)`);
            heroNameFrame.style.opacity = (0.42 + glowPulse * 0.08 + motion.currentIntensity * 0.06).toFixed(3);
          }

          if (heroCenterHud) {
            const centerScale = 1 + glowPulse * 0.02 + motion.currentIntensity * 0.015 + motion.pulse * 0.08;
            const centerRotate = Math.sin(time * 0.42) * 1.2 + motion.currentX * 2.6;
            const centerTranslateX = motion.currentX * 2.8;
            const centerTranslateY = motion.currentY * 1.6;
            heroCenterHud.setAttribute(
              'transform',
              `translate(${centerTranslateX.toFixed(2)} ${centerTranslateY.toFixed(2)}) rotate(${centerRotate.toFixed(2)} ${hudCenter.x} ${hudCenter.y}) ${scaleAround(hudCenter.x, hudCenter.y, centerScale)}`
            );
          }

          if (heroCenterHalo) {
            heroCenterHalo.setAttribute('r', `${(76 + glowPulse * 6 + motion.pulse * 8 + motion.currentIntensity * 5).toFixed(2)}`);
            heroCenterHalo.style.opacity = (0.08 + glowPulse * 0.08 + motion.currentIntensity * 0.06 + motion.pulse * 0.12).toFixed(3);
          }

          if (heroCenterOuter) {
            heroCenterOuter.style.opacity = (0.34 + glowPulse * 0.12 + motion.currentIntensity * 0.1).toFixed(3);
          }

          if (heroCenterTicks) {
            heroCenterTicks.setAttribute(
              'transform',
              `rotate(${(-time * 10 - motion.pulse * 18).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
            heroCenterTicks.style.opacity = (0.44 + glowPulse * 0.18 + motion.currentIntensity * 0.1).toFixed(3);
          }

          if (heroCenterRotorPrimary) {
            heroCenterRotorPrimary.setAttribute(
              'transform',
              `rotate(${(time * 26 + motion.currentX * 10 + motion.pulse * 16).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
          }

          if (heroCenterRotorSecondary) {
            heroCenterRotorSecondary.setAttribute(
              'transform',
              `rotate(${(-time * 34 - motion.currentY * 10 - motion.pulse * 22).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
          }

          if (heroCenterCore) {
            heroCenterCore.setAttribute('r', `${(22 + glowPulse * 1.5 + motion.pulse * 2.6).toFixed(2)}`);
            heroCenterCore.style.opacity = (0.68 + glowPulse * 0.12 + motion.pulse * 0.08).toFixed(3);
          }

          if (heroCenterCoreOutline) {
            heroCenterCoreOutline.setAttribute('r', `${(22 + glowPulse * 1 + motion.pulse * 1.8).toFixed(2)}`);
            heroCenterCoreOutline.style.opacity = (0.6 + glowPulse * 0.12 + motion.pulse * 0.08).toFixed(3);
          }

          if (heroCenterScanLine) {
            const scanY = 82 + ((Math.sin(time * 2.4) + 1) * 0.5) * 12 + motion.pulse * 1.4;
            heroCenterScanLine.setAttribute('y', scanY.toFixed(2));
            heroCenterScanLine.style.opacity = (0.34 + glowPulse * 0.14 + motion.pulse * 0.12).toFixed(3);
          }

          if (heroCenterScanGlow) {
            const glowY = 74 + ((Math.sin(time * 2.4) + 1) * 0.5) * 12 + motion.pulse * 1.4;
            heroCenterScanGlow.setAttribute('y', glowY.toFixed(2));
            heroCenterScanGlow.style.opacity = (0.12 + glowPulse * 0.08 + motion.pulse * 0.1).toFixed(3);
          }

          if (heroSciFiBand) {
            const bandScale = 1 + glowPulse * 0.02 + motion.currentIntensity * 0.015 + motion.pulse * 0.05;
            heroSciFiBand.style.opacity = (0.04 + glowPulse * 0.026 + motion.currentIntensity * 0.02 + motion.pulse * 0.02).toFixed(3);
            heroSciFiBand.setAttribute(
              'transform',
              `${scaleAround(hudCenter.x, hudCenter.y, bandScale)} translate(${(motion.currentX * 4).toFixed(2)} ${(motion.currentY * 1.8).toFixed(2)})`
            );
          }

          if (heroSciFiRails) {
            heroSciFiRails.setAttribute('transform', `translate(${(motion.currentX * 6.2).toFixed(2)} ${(motion.currentY * 2.6).toFixed(2)})`);
            heroSciFiRails.style.opacity = (0.64 + glowPulse * 0.12 + motion.currentIntensity * 0.1).toFixed(3);
          }

          if (heroSciFiFrame) {
            const frameScale = 1 + motion.currentIntensity * 0.01 + motion.pulse * 0.03;
            heroSciFiFrame.setAttribute(
              'transform',
              `${scaleAround(hudCenter.x, hudCenter.y, frameScale)} translate(${(motion.currentX * 4.2).toFixed(2)} 0)`
            );
            heroSciFiFrame.style.opacity = (0.5 + glowPulse * 0.1 + motion.currentIntensity * 0.08 + motion.pulse * 0.08).toFixed(3);
          }

          if (heroSciFiCore) {
            const coreScale = 1 + glowPulse * 0.026 + motion.currentIntensity * 0.02 + motion.pulse * 0.09;
            heroSciFiCore.setAttribute(
              'transform',
              `rotate(${(Math.sin(time * 0.52) * 2.4 + motion.currentX * 4.2).toFixed(2)} ${hudCenter.x} ${hudCenter.y}) ${scaleAround(hudCenter.x, hudCenter.y, coreScale)}`
            );
          }

          if (heroSciFiHalo) {
            heroSciFiHalo.setAttribute('r', `${(78 + glowPulse * 8 + motion.currentIntensity * 10 + motion.pulse * 12).toFixed(2)}`);
            heroSciFiHalo.style.opacity = (0.12 + glowPulse * 0.1 + motion.currentIntensity * 0.08 + motion.pulse * 0.14).toFixed(3);
          }

          if (heroSciFiOuter) {
            heroSciFiOuter.style.opacity = (0.4 + glowPulse * 0.14 + motion.currentIntensity * 0.1).toFixed(3);
          }

          if (heroSciFiOuterTicks) {
            heroSciFiOuterTicks.setAttribute(
              'transform',
              `rotate(${(-time * 18 - motion.pulse * 30).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
            heroSciFiOuterTicks.style.opacity = (0.54 + glowPulse * 0.18 + motion.currentIntensity * 0.12).toFixed(3);
          }

          if (heroSciFiRotorPrimary) {
            heroSciFiRotorPrimary.setAttribute(
              'transform',
              `rotate(${(time * 34 + motion.currentX * 14 + motion.pulse * 26).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
          }

          if (heroSciFiRotorSecondary) {
            heroSciFiRotorSecondary.setAttribute(
              'transform',
              `rotate(${(-time * 46 - motion.currentY * 14 - motion.pulse * 30).toFixed(2)} ${hudCenter.x} ${hudCenter.y})`
            );
          }

          if (heroSciFiHex) {
            heroSciFiHex.style.opacity = (0.34 + glowPulse * 0.12 + motion.currentIntensity * 0.08 + motion.pulse * 0.12).toFixed(3);
          }

          if (heroSciFiScanLine) {
            const scanY = 84 + ((Math.sin(time * 3.4) + 1) * 0.5) * 8 + motion.pulse * 1.8;
            heroSciFiScanLine.setAttribute('y', scanY.toFixed(2));
            heroSciFiScanLine.style.opacity = (0.42 + glowPulse * 0.16 + motion.pulse * 0.14).toFixed(3);
          }

          if (heroSciFiScanGlow) {
            const glowY = 76 + ((Math.sin(time * 3.4) + 1) * 0.5) * 8 + motion.pulse * 1.8;
            heroSciFiScanGlow.setAttribute('y', glowY.toFixed(2));
            heroSciFiScanGlow.style.opacity = (0.16 + glowPulse * 0.12 + motion.pulse * 0.12).toFixed(3);
          }

          heroNamePrimarySweeps.forEach((sweep, sweepIndex) => {
            const isRightSide = sweep.dataset.sweepSide === 'right';
            const sweepPhase = (time * 0.14 + motion.currentIntensity * 0.04 + (isRightSide ? 0.12 : 0)) % 1;
            const sweepX = isRightSide
              ? lerp(300, 772, sweepPhase)
              : lerp(-228, 248, sweepPhase);
            const sweepY = 8 + Math.sin(time * 0.92 + (isRightSide ? 0.45 : 0)) * 3 - motion.currentY * 3;
            const sweepWidth = currentVariant === 'scifi'
              ? 170 + glowPulse * 18 + motion.pulse * 16
              : currentVariant === 'circular'
                ? 134 + glowPulse * 14 + motion.pulse * 10
                : 146 + glowPulse * 16 + motion.pulse * 12;
            const sweepRotate = (Math.sin(time * 0.52 + sweepIndex * 0.4) * 2.6 + motion.currentX * (isRightSide ? 4.2 : -4.2)).toFixed(2);
            sweep.setAttribute('x', sweepX.toFixed(2));
            sweep.setAttribute('y', sweepY.toFixed(2));
            sweep.setAttribute('width', sweepWidth.toFixed(2));
            sweep.setAttribute('transform', `rotate(${sweepRotate} ${hudCenter.x} ${hudCenter.y})`);
            const sweepOpacity = currentVariant === 'scifi'
              ? 0.18 + glowPulse * 0.1 + motion.currentIntensity * 0.08
              : currentVariant === 'circular'
                ? 0.09 + glowPulse * 0.06 + motion.currentIntensity * 0.04
                : 0.13 + glowPulse * 0.08 + motion.currentIntensity * 0.06;
            sweep.style.opacity = sweepOpacity.toFixed(3);
          });

          heroNameSecondarySweeps.forEach((sweep, sweepIndex) => {
            const isRightSide = sweep.dataset.sweepSide === 'right';
            const sweepPhase = (time * 0.18 + 0.24 + motion.currentIntensity * 0.03 + (isRightSide ? 0.16 : 0)) % 1;
            const sweepX = isRightSide
              ? lerp(332, 804, sweepPhase)
              : lerp(-276, 204, sweepPhase);
            const sweepY = -6 + Math.cos(time * 0.74 + (isRightSide ? 0.3 : 0)) * 4.5 + motion.currentY * 2;
            const sweepWidth = currentVariant === 'scifi'
              ? 138 + glowPulse * 16 + motion.pulse * 14
              : currentVariant === 'circular'
                ? 108 + glowPulse * 10 + motion.pulse * 8
                : 118 + glowPulse * 12 + motion.pulse * 10;
            const sweepRotate = (-4 + Math.sin(time * 0.66 + sweepIndex * 0.3) * 3 - motion.currentY * (isRightSide ? 3.2 : -3.2)).toFixed(2);
            sweep.setAttribute('x', sweepX.toFixed(2));
            sweep.setAttribute('y', sweepY.toFixed(2));
            sweep.setAttribute('width', sweepWidth.toFixed(2));
            sweep.setAttribute('transform', `rotate(${sweepRotate} ${hudCenter.x} ${hudCenter.y})`);
            const sweepOpacity = currentVariant === 'scifi'
              ? 0.12 + glowPulse * 0.06 + motion.pulse * 0.08
              : currentVariant === 'circular'
                ? 0.05 + glowPulse * 0.04 + motion.pulse * 0.04
                : 0.08 + glowPulse * 0.05 + motion.pulse * 0.06;
            sweep.style.opacity = sweepOpacity.toFixed(3);
          });

          heroNamePrimarySignals.forEach(signal => {
            const isRightSide = signal.dataset.signalSide === 'right';
            const signalShiftX = (Math.sin(time * 0.6 + (isRightSide ? 0.24 : 0)) * 6) + motion.currentX * (isRightSide ? 6 : -6);
            const signalShiftY = motion.currentY * 1.3;
            signal.setAttribute('transform', `translate(${signalShiftX.toFixed(2)} ${signalShiftY.toFixed(2)})`);
            const signalOpacity = currentVariant === 'scifi'
              ? 0.28 + glowPulse * 0.1 + motion.currentIntensity * 0.08
              : currentVariant === 'circular'
                ? 0.1 + glowPulse * 0.06 + motion.currentIntensity * 0.03
                : 0.18 + glowPulse * 0.08 + motion.currentIntensity * 0.05;
            signal.style.opacity = signalOpacity.toFixed(3);
          });

          heroNameSecondarySignals.forEach(signal => {
            const isRightSide = signal.dataset.signalSide === 'right';
            const signalShiftX = (-Math.sin(time * 0.52 + (isRightSide ? 0.2 : 0)) * 4.5) - motion.currentX * (isRightSide ? 4.2 : -4.2);
            const signalShiftY = -motion.currentY * 1.1;
            signal.setAttribute('transform', `translate(${signalShiftX.toFixed(2)} ${signalShiftY.toFixed(2)})`);
            const signalOpacity = currentVariant === 'scifi'
              ? 0.2 + glowPulse * 0.08 + motion.currentIntensity * 0.06
              : currentVariant === 'circular'
                ? 0.06 + glowPulse * 0.04 + motion.currentIntensity * 0.03
                : 0.12 + glowPulse * 0.06 + motion.currentIntensity * 0.04;
            signal.style.opacity = signalOpacity.toFixed(3);
          });

          const textGlowBlur = currentVariant === 'scifi'
            ? 9 + glowPulse * 5 + motion.currentIntensity * 6 + motion.pulse * 7
            : currentVariant === 'circular'
              ? 6 + glowPulse * 3 + motion.currentIntensity * 4 + motion.pulse * 5
              : 7 + glowPulse * 4 + motion.currentIntensity * 4 + motion.pulse * 5;
          const textGlowOpacity = currentVariant === 'scifi'
            ? 0.14 + motion.currentIntensity * 0.08 + motion.pulse * 0.1
            : currentVariant === 'circular'
              ? 0.08 + motion.currentIntensity * 0.06 + motion.pulse * 0.08
              : 0.1 + motion.currentIntensity * 0.06 + motion.pulse * 0.08;
          heroNameSolidParts.forEach(part => {
            part.style.opacity = '1';
            part.style.filter = `drop-shadow(0 0 ${textGlowBlur.toFixed(2)}px rgba(177, 242, 255, ${textGlowOpacity.toFixed(3)}))`;
          });
          heroNameHighlightParts.forEach(part => {
            const sideDirection = part.dataset.nameSide === 'right' ? 1 : -1;
            const reflectX = sideDirection * (1.8 + motion.currentX * 3) + Math.sin(time * 1.08 + (sideDirection > 0 ? 0.35 : 0)) * 2;
            const reflectY = motion.currentY * 2.2 + Math.cos(time * 1.26 + (sideDirection > 0 ? 0.2 : 0)) * 0.8 - 0.8;
            const reflectOpacity = currentVariant === 'scifi'
              ? 0.12 + glowPulse * 0.06 + motion.currentIntensity * 0.04 + motion.pulse * 0.06
              : currentVariant === 'circular'
                ? 0.06 + glowPulse * 0.04 + motion.currentIntensity * 0.03 + motion.pulse * 0.05
                : 0.08 + glowPulse * 0.05 + motion.currentIntensity * 0.03 + motion.pulse * 0.05;
            part.setAttribute('transform', `translate(${reflectX.toFixed(2)} ${reflectY.toFixed(2)})`);
            part.style.opacity = reflectOpacity.toFixed(3);
          });

          requestAnimationFrame(animateHeroHud);
        };

        heroName.addEventListener('pointerenter', event => {
          triggerPulse();
          handlePointer(event);
        });
        heroName.addEventListener('pointermove', handlePointer);
        heroName.addEventListener('pointerleave', resetPointer);
        requestAnimationFrame(animateHeroHud);
      } else {
        heroNameSolidParts.forEach(part => {
          part.style.opacity = '1';
        });
        heroNameHighlightParts.forEach(part => {
          part.style.opacity = '0.16';
        });
        if (heroCenterScanLine) {
          heroCenterScanLine.setAttribute('y', '88');
        }
      }
      }

      const heroTileTargets = Array.from(document.querySelectorAll('.hero-greeting, .hero-role, .hero-summary'));
      heroTileTargets.forEach((target, lineIndex) => {
        if (target.dataset.tilesApplied) {
          return;
        }
        const rawText = target.textContent.replace(/\s+/g, ' ').trim();
        if (!rawText) {
          return;
        }
        const words = rawText.split(' ');
        const displayWords = [];
        for (let wordCursor = 0; wordCursor < words.length; wordCursor += 1) {
          const currentWord = words[wordCursor];
          const nextWord = words[wordCursor + 1];
          const shouldMerge = /^[A-Za-z]$/.test(currentWord) && Boolean(nextWord);
          if (shouldMerge) {
            displayWords.push(`${currentWord} ${nextWord}`);
            wordCursor += 1;
            continue;
          }
          displayWords.push(currentWord);
        }
        target.textContent = '';
        displayWords.forEach((word, wordIndex) => {
          const tile = document.createElement('span');
          tile.className = 'hero-word-tile';
          tile.textContent = word;
          tile.style.setProperty('--tile-index', lineIndex * 20 + wordIndex);
          target.appendChild(tile);
          if (wordIndex < displayWords.length - 1) {
            target.appendChild(document.createTextNode(' '));
          }
        });
        target.dataset.tilesApplied = 'true';
      });
      });

      const flipCards = Array.from(document.querySelectorAll('[data-flip-card]'));
      const isCompactViewport = () => window.matchMedia('(max-width: 768px)').matches;

      const measureFaceHeight = face => {
        const sectionContent = face.querySelector('.section-content');
        const baseHeight = sectionContent ? sectionContent.scrollHeight : face.scrollHeight;
        const faceStyles = window.getComputedStyle(face);
        const paddingY = parseFloat(faceStyles.paddingTop) + parseFloat(faceStyles.paddingBottom);
        return Math.ceil(baseHeight + paddingY + 12);
      };

      const syncFlipCardHeight = card => {
        const inner = card.querySelector('.book-card-inner');
        if (!inner) {
          return;
        }
        if (isCompactViewport()) {
          card.style.height = '';
          inner.style.height = '';
          return;
        }
        const faces = Array.from(inner.querySelectorAll('.book-card-face'));
        if (!faces.length) {
          return;
        }
        const targetHeight = Math.max(...faces.map(measureFaceHeight), 420);
        card.style.height = `${targetHeight}px`;
        inner.style.height = `${targetHeight}px`;
      };

      const syncAllFlipCardHeights = () => {
        flipCards.forEach(syncFlipCardHeight);
      };

      syncAllFlipCardHeights();
      window.addEventListener('resize', syncAllFlipCardHeights);
      window.addEventListener('load', syncAllFlipCardHeights, { once: true });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(syncAllFlipCardHeights).catch(() => {});
      }

      flipCards.forEach((card, index) => {
        const section = card.closest('section');
        const sectionId = section && section.id ? section.id : `section_${index + 1}`;
        const sectionTitle = section && section.querySelector('h2')
          ? section.querySelector('h2').textContent.trim()
          : `Section ${index + 1}`;
        const controlsRow = document.createElement('div');
        controlsRow.className = 'card-control-row';
        const cardToggle = document.createElement('button');
        cardToggle.type = 'button';
        cardToggle.className = 'btn btn-outline-light card-flip-toggle';
        cardToggle.setAttribute('aria-pressed', 'false');
        cardToggle.setAttribute('aria-label', `${sectionTitle} flip toggle`);
        controlsRow.appendChild(cardToggle);
        if (card.parentNode) {
          card.parentNode.insertBefore(controlsRow, card);
        }

        const storageKey = `portfolio_flip_side_${sectionId}`;
        let showingBack = false;
        try {
          const savedSide = localStorage.getItem(storageKey);
          if (savedSide === 'back') {
            showingBack = true;
          }
        } catch {}

        const applyFlipState = showBack => {
          card.classList.toggle('is-flipped', showBack);
          cardToggle.textContent = showBack ? 'Show Front' : 'Show Back';
          cardToggle.setAttribute('aria-pressed', showBack ? 'true' : 'false');
          cardToggle.setAttribute('aria-label', `${sectionTitle} ${showBack ? 'show front' : 'show back'}`);
          cardToggle.classList.toggle('is-on', showBack);
          card.setAttribute('aria-expanded', showBack ? 'true' : 'false');
        };

        applyFlipState(showingBack);
        cardToggle.addEventListener('click', () => {
          showingBack = !showingBack;
          applyFlipState(showingBack);
          try {
            localStorage.setItem(storageKey, showingBack ? 'back' : 'front');
          } catch {}
        });
      });
    });
