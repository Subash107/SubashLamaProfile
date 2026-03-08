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

      scheduleNonCriticalWork(() => {
      const heroName = document.querySelector('.hero-name');
      const heroNameSvg = document.getElementById('heroNameSvg');
      const heroNameDefs = document.getElementById('heroNameDefs');
      const heroNameShards = document.getElementById('heroNameShards');
      const heroNameSolid = document.getElementById('heroNameSolid');
      const heroNameHighlight = document.getElementById('heroNameHighlight');
      const heroNameAura = document.getElementById('heroNameAura');
      const heroNameSweep = document.getElementById('heroNameSweep');
      const heroGlassNoise = document.getElementById('heroGlassNoise');
      const heroGlassDisplace = document.getElementById('heroGlassDisplace');
      const heroGlassLight = document.getElementById('heroGlassLight');
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
      const lerp = (start, end, progress) => start + (end - start) * progress;
      const easeOutCubic = progress => 1 - Math.pow(1 - progress, 3);
      const easeInOutCubic = progress => (
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2
      );
      const remap01 = (value, start, end) => clamp((value - start) / (end - start), 0, 1);
      const seededNoise = seed => {
        const x = Math.sin(seed * 91.137 + 17.913) * 43758.5453123;
        return x - Math.floor(x);
      };

      if (heroName && heroNameSvg && heroNameDefs && heroNameShards && heroNameSolid && heroGlassNoise && heroGlassDisplace && heroGlassLight && !reducedMotion) {
        const shardItems = [];
        const shardRows = 4;
        const shardCols = 8;
        const viewBox = heroNameSvg.viewBox && heroNameSvg.viewBox.baseVal
          ? heroNameSvg.viewBox.baseVal
          : { x: 0, y: 0, width: 760, height: 170 };
        let shardArea = { x: 96, y: 24, width: 568, height: 126 };

        try {
          const textBounds = heroNameSolid.getBBox();
          const padX = 28;
          const padY = 20;
          const minX = Math.max(viewBox.x, textBounds.x - padX);
          const minY = Math.max(viewBox.y, textBounds.y - padY);
          const maxX = Math.min(viewBox.x + viewBox.width, textBounds.x + textBounds.width + padX);
          const maxY = Math.min(viewBox.y + viewBox.height, textBounds.y + textBounds.height + padY);
          shardArea = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          };
        } catch {
          // Fallback keeps the original effect working if SVG bounds are unavailable.
        }

        for (let row = 0; row < shardRows; row += 1) {
          for (let col = 0; col < shardCols; col += 1) {
            const shardIndex = row * shardCols + col;
            const cellX0 = shardArea.x + (col / shardCols) * shardArea.width;
            const cellX1 = shardArea.x + ((col + 1) / shardCols) * shardArea.width;
            const cellY0 = shardArea.y + (row / shardRows) * shardArea.height;
            const cellY1 = shardArea.y + ((row + 1) / shardRows) * shardArea.height;
            const jitter = 8;
            const topLeftX = cellX0 + (seededNoise(shardIndex + 1.2) - 0.5) * jitter;
            const topLeftY = cellY0 + (seededNoise(shardIndex + 2.3) - 0.5) * jitter;
            const topRightX = cellX1 + (seededNoise(shardIndex + 3.4) - 0.5) * jitter;
            const topRightY = cellY0 + (seededNoise(shardIndex + 4.5) - 0.5) * jitter;
            const bottomRightX = cellX1 + (seededNoise(shardIndex + 5.6) - 0.5) * jitter;
            const bottomRightY = cellY1 + (seededNoise(shardIndex + 6.7) - 0.5) * jitter;
            const bottomLeftX = cellX0 + (seededNoise(shardIndex + 7.8) - 0.5) * jitter;
            const bottomLeftY = cellY1 + (seededNoise(shardIndex + 8.9) - 0.5) * jitter;

            const clipId = `heroShardClip${shardIndex}`;
            const clipPath = document.createElementNS(SVG_NS, 'clipPath');
            clipPath.setAttribute('id', clipId);
            const polygon = document.createElementNS(SVG_NS, 'polygon');
            polygon.setAttribute('points', `${topLeftX},${topLeftY} ${topRightX},${topRightY} ${bottomRightX},${bottomRightY} ${bottomLeftX},${bottomLeftY}`);
            clipPath.appendChild(polygon);
            heroNameDefs.appendChild(clipPath);

            const shardGroup = document.createElementNS(SVG_NS, 'g');
            shardGroup.setAttribute('class', 'hero-name-shard');
            shardGroup.setAttribute('clip-path', `url(#${clipId})`);
            const shardText = document.createElementNS(SVG_NS, 'text');
            shardText.setAttribute('class', 'hero-name-text hero-name-shard-text');
            shardText.setAttribute('x', '380');
            shardText.setAttribute('y', '86');
            shardText.textContent = 'Subash Lama';
            shardGroup.appendChild(shardText);
            heroNameShards.appendChild(shardGroup);

            const startX = -220 - seededNoise(shardIndex + 10) * 240;
            const startY = (seededNoise(shardIndex + 11) - 0.5) * 150;
            const startZ = -55 - seededNoise(shardIndex + 12) * 70;
            const startRotation = (seededNoise(shardIndex + 13) - 0.5) * 90;
            const endX = 130 + seededNoise(shardIndex + 14) * 220;
            const endY = (seededNoise(shardIndex + 15) - 0.5) * 130;
            const endZ = -45 - seededNoise(shardIndex + 16) * 65;
            const endRotation = (seededNoise(shardIndex + 17) - 0.5) * 95;
            const startScale = 0.72 + seededNoise(shardIndex + 18) * 0.18;
            const endScale = 0.74 + seededNoise(shardIndex + 19) * 0.2;

            shardItems.push({
              element: shardGroup,
              startX,
              startY,
              startZ,
              startRotation,
              endX,
              endY,
              endZ,
              endRotation,
              startScale,
              endScale
            });
          }
        }

        const motion = {
          targetX: 0,
          targetY: 0,
          currentX: 0,
          currentY: 0,
          targetIntensity: 0,
          currentIntensity: 0
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
          heroName.classList.add('is-interacting');
        };

        const resetPointer = () => {
          motion.targetX = 0;
          motion.targetY = 0;
          motion.targetIntensity = 0;
          heroName.classList.remove('is-interacting');
        };

        const animateHeroGlass = timestamp => {
          const time = timestamp * 0.001;
          motion.currentX += (motion.targetX - motion.currentX) * 0.11;
          motion.currentY += (motion.targetY - motion.currentY) * 0.11;
          motion.currentIntensity += (motion.targetIntensity - motion.currentIntensity) * 0.08;

          const cycleDuration = 12000;
          const cycleProgress = (timestamp % cycleDuration) / cycleDuration;
          const holdStart = 0.52;
          const holdEnd = 0.6;
          const assembleProgress = easeOutCubic(remap01(cycleProgress, 0, 0.44));
          const scatterProgress = easeInOutCubic(remap01(cycleProgress, holdEnd, 1));
          const assemblyAlignProgress = easeInOutCubic(remap01(assembleProgress, 0.86, 1));
          const isHolding = cycleProgress >= holdStart && cycleProgress < holdEnd;
          const coreVisibility = isHolding ? 1 : 0;
          const travelVisibility = Math.max(
            Math.pow(assemblyAlignProgress, 2) * 0.2,
            cycleProgress >= holdEnd ? (1 - scatterProgress) * 0.22 : 0
          );
          const ambientFloat = Math.sin(time * 1.14) * 5.6 + Math.cos(time * 0.48) * 2.4;
          const auraPulse = (Math.sin(time * 1.82) + 1) * 0.5;

          const distortionPower = 0.18 + motion.currentIntensity * 1.05 + Math.sin(time * 0.62) * 0.04;
          const displacementScale = 4.8 + distortionPower * 11.8;
          heroGlassDisplace.setAttribute('scale', displacementScale.toFixed(2));

          const frequencyX = 0.011 + motion.currentIntensity * 0.0035 + Math.sin(time * 0.55) * 0.0007;
          const frequencyY = 0.079 + motion.currentIntensity * 0.019 + Math.cos(time * 0.63) * 0.0015;
          heroGlassNoise.setAttribute('baseFrequency', `${frequencyX.toFixed(4)} ${frequencyY.toFixed(4)}`);
          heroGlassLight.setAttribute('x', `${380 + motion.currentX * 150}`);
          heroGlassLight.setAttribute('y', `${74 + motion.currentY * 74}`);
          heroGlassLight.setAttribute('z', `${148 + motion.currentIntensity * 52}`);

          const tiltX = -motion.currentY * 8 + Math.cos(time * 0.9) * 1.1;
          const tiltY = motion.currentX * 13 + Math.sin(time * 1.1) * 1.5;
          const depth = 6 + motion.currentIntensity * 9;
          heroName.style.setProperty('--name-float-y', `${ambientFloat.toFixed(2)}px`);
          heroName.style.setProperty('--name-rotate-x', `${tiltX.toFixed(2)}deg`);
          heroName.style.setProperty('--name-rotate-y', `${tiltY.toFixed(2)}deg`);
          heroName.style.setProperty('--name-depth', `${depth.toFixed(2)}px`);

          if (heroNameAura) {
            const auraRx = 272 + auraPulse * 24 + motion.currentIntensity * 32;
            const auraRy = 64 + auraPulse * 10 + motion.currentIntensity * 14;
            const auraOpacity = 0.14 + auraPulse * 0.14 + travelVisibility + motion.currentIntensity * 0.16 + (isHolding ? 0.18 : 0);
            heroNameAura.setAttribute('rx', auraRx.toFixed(2));
            heroNameAura.setAttribute('ry', auraRy.toFixed(2));
            heroNameAura.setAttribute('cy', `${84 + ambientFloat * 0.16}`);
            heroNameAura.setAttribute(
              'transform',
              `rotate(${(Math.sin(time * 0.36) * 1.2).toFixed(2)} 380 84)`
            );
            heroNameAura.style.opacity = auraOpacity.toFixed(3);
          }

          if (heroNameSweep) {
            const sweepPhase = (time * 0.18 + motion.currentIntensity * 0.06) % 1;
            const sweepX = lerp(-300, 840, sweepPhase);
            const sweepOpacity = 0.08 + auraPulse * 0.08 + travelVisibility + motion.currentIntensity * 0.14 + (isHolding ? 0.2 : 0);
            heroNameSweep.setAttribute('x', sweepX.toFixed(2));
            heroNameSweep.style.opacity = sweepOpacity.toFixed(3);
          }

          shardItems.forEach((shard, shardIndex) => {
            const entryX = lerp(shard.startX, 0, assemblyAlignProgress);
            const entryY = lerp(shard.startY, 0, assemblyAlignProgress);
            const entryZ = lerp(shard.startZ, 0, assemblyAlignProgress);
            const entryRot = lerp(shard.startRotation, 0, assemblyAlignProgress);
            const exitX = lerp(0, shard.endX, scatterProgress);
            const exitY = lerp(0, shard.endY, scatterProgress);
            const exitZ = lerp(0, shard.endZ, scatterProgress);
            const exitRot = lerp(0, shard.endRotation, scatterProgress);
            const translateX = entryX + exitX;
            const translateY = entryY + exitY;
            const depthOffset = entryZ + exitZ;
            const rotation = entryRot + exitRot;
            const entryScale = lerp(shard.startScale, 1, assemblyAlignProgress);
            const exitScale = lerp(1, shard.endScale, scatterProgress);
            const scale = entryScale * exitScale * (1 + (-depthOffset / 520));
            const preHoldVisibility = Math.pow(assemblyAlignProgress, 3) * 0.16;
            const postHoldVisibility = cycleProgress >= holdEnd ? (1 - scatterProgress) * 0.58 : 0;
            const movingOpacity = Math.max(preHoldVisibility, postHoldVisibility);
            const opacity = isHolding ? 1 : movingOpacity;
            const blur = (1 - assemblyAlignProgress) * 3 + scatterProgress * 2.1 + (shardIndex % 3) * 0.05 + Math.abs(depthOffset) * 0.005 + (1 - coreVisibility) * 1.25 + (isHolding ? 0 : 1.35);
            shard.element.setAttribute(
              'transform',
              `translate(${translateX.toFixed(2)} ${translateY.toFixed(2)}) rotate(${rotation.toFixed(2)} 380 86) scale(${scale.toFixed(3)})`
            );
            shard.element.style.opacity = opacity.toFixed(3);
            shard.element.style.filter = `blur(${blur.toFixed(2)}px)`;
          });

          heroNameSolid.style.opacity = coreVisibility.toFixed(3);
          heroNameSolid.style.filter = `drop-shadow(0 0 ${(10 + auraPulse * 8 + motion.currentIntensity * 12).toFixed(2)}px rgba(186, 241, 255, ${(0.18 + motion.currentIntensity * 0.18).toFixed(3)}))`;
          if (heroNameHighlight) {
            const reflectX = motion.currentX * 10 + Math.sin(time * 1.38) * 4.4;
            const reflectY = motion.currentY * 6 + Math.cos(time * 1.7) * 1.8 - 1.2;
            const reflectOpacity = Math.max(0.16, coreVisibility * 0.48 + travelVisibility + auraPulse * 0.06 + motion.currentIntensity * 0.12);
            heroNameHighlight.setAttribute('transform', `translate(${reflectX.toFixed(2)} ${reflectY.toFixed(2)})`);
            heroNameHighlight.style.opacity = reflectOpacity.toFixed(3);
          }

          requestAnimationFrame(animateHeroGlass);
        };

        heroName.addEventListener('pointerenter', handlePointer);
        heroName.addEventListener('pointermove', handlePointer);
        heroName.addEventListener('pointerleave', resetPointer);
        requestAnimationFrame(animateHeroGlass);
      } else if (heroGlassDisplace) {
        heroGlassDisplace.setAttribute('scale', '3.4');
        if (heroNameSolid) {
          heroNameSolid.style.opacity = '1';
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
