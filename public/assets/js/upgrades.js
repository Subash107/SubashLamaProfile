/* ==========================================================
   UPGRADES.JS — Parrot Boot Sequence + DEFCON Meter
   ========================================================== */

(function () {
  'use strict';

  /* ── 1. PARROT OS BOOT SEQUENCE ──────────────────────── */
  const BOOT_SEEN_KEY = 'portfolio_parrot_boot_seen';
  const bootEl = document.getElementById('parrot-boot');

  const BOOT_LINES = [
    { t: '[    0.000000] Booting Linux 6.1.0-parrot1-amd64 #1 SMP Parrot GNU/Linux', c: 'pb-ts', d: 60 },
    { t: '[    0.000512] Command line: BOOT_IMAGE=/vmlinuz-parrot quiet splash loglevel=3', c: 'pb-ts', d: 40 },
    { t: '[    0.012784] AppArmor: AppArmor Framework initialized', c: 'pb-ts', d: 50 },
    { t: '[    0.034219] NET: Registered PF_INET6 protocol family', c: 'pb-ts', d: 45 },
    { t: '[    0.078341] random: crng init done', c: 'pb-ts', d: 40 },
    { t: '[  OK  ] Started Journal Service.', c: 'pb-ok', d: 80 },
    { t: '[  OK  ] Started D-Bus System Message Bus.', c: 'pb-ok', d: 60 },
    { t: '[  OK  ] Reached target Network.', c: 'pb-ok', d: 70 },
    { t: '         Starting Wazuh SIEM Agent...', c: 'pb-svc', d: 90 },
    { t: '[  OK  ] Started Wazuh SIEM Agent.', c: 'pb-ok', d: 60 },
    { t: '         Starting Suricata IDS/IPS Engine...', c: 'pb-svc', d: 90 },
    { t: '[  OK  ] Started Suricata IDS/IPS Engine.', c: 'pb-ok', d: 70 },
    { t: '         Starting Sysmon Endpoint Telemetry...', c: 'pb-svc', d: 80 },
    { t: '[  OK  ] Started Sysmon Endpoint Telemetry.', c: 'pb-ok', d: 60 },
    { t: '         Mounting portfolio filesystem...', c: 'pb-svc', d: 70 },
    { t: '[  OK  ] Mounted /srv/portfolio.', c: 'pb-ok', d: 55 },
    { t: '[  OK  ] Started SOC Dashboard Services.', c: 'pb-ok', d: 65 },
    { t: '[  OK  ] All security systems operational.', c: 'pb-ok', d: 80 },
    { t: '', c: 'pb-ts', d: 120 },
    { t: 'Parrot Security OS 6.2 Rolling — SOC Portfolio', c: 'pb-ok', d: 100 },
    { t: 'subash@parrot-soc:~$ ', c: 'pb-ok', d: 0, cursor: true },
  ];

  function runBoot() {
    if (!bootEl) return;

    const alreadySeen = (() => {
      try { return sessionStorage.getItem(BOOT_SEEN_KEY) === '1'; } catch { return false; }
    })();

    if (alreadySeen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bootEl.classList.add('boot-hidden');
      return;
    }

    const logEl    = document.getElementById('parrotBootLog');
    const barEl    = document.getElementById('parrotBootBar');
    const statusEl = document.getElementById('parrotBootStatus');

    if (!logEl) { bootEl.classList.add('boot-hidden'); return; }

    document.body.style.overflow = 'hidden';
    bootEl.removeAttribute('aria-hidden');

    let idx = 0;
    const total = BOOT_LINES.length;

    function nextLine() {
      if (idx >= total) {
        // Done — wait a moment then fade out
        setTimeout(() => {
          try { sessionStorage.setItem(BOOT_SEEN_KEY, '1'); } catch {}
          bootEl.classList.add('boot-done');
          document.body.style.overflow = '';
          setTimeout(() => bootEl.classList.add('boot-hidden'), 750);
        }, 900);
        return;
      }

      const item = BOOT_LINES[idx];
      const pct  = Math.round((idx / (total - 1)) * 100);

      // Update progress
      if (barEl) barEl.style.width = pct + '%';
      if (statusEl && item.t) statusEl.textContent = item.t.replace(/\[.*?\]\s*/, '').trim() || 'Loading...';

      // Create line element
      const line = document.createElement('span');
      line.className = 'pb-line ' + (item.c || '');
      line.style.animationDelay = '0ms';

      if (item.cursor) {
        line.textContent = item.t;
        const cur = document.createElement('span');
        cur.className = 'pb-cursor';
        line.appendChild(cur);
      } else {
        line.textContent = item.t;
      }

      logEl.appendChild(line);

      // Keep only last 16 lines visible
      while (logEl.children.length > 16) {
        logEl.removeChild(logEl.firstChild);
      }

      idx++;
      if (item.d > 0) {
        setTimeout(nextLine, item.d);
      } else {
        nextLine();
      }
    }

    nextLine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runBoot);
  } else {
    runBoot();
  }


  /* ── 4. DEFCON THREAT LEVEL METER ────────────────────── */
  const DEFCON_DATA = {
    5: { label: 'DEFCON 5', desc: 'Normal — Routine monitoring', color: '#00ff88', glow: 'rgba(0,255,136,0.06)' },
    4: { label: 'DEFCON 4', desc: 'Increased — Watching for threats', color: '#00aaff', glow: 'rgba(0,170,255,0.06)' },
    3: { label: 'DEFCON 3', desc: 'Elevated — Active threat hunting', color: '#ffdd00', glow: 'rgba(255,221,0,0.07)' },
    2: { label: 'DEFCON 2', desc: 'High — Incident response ready', color: '#ff8800', glow: 'rgba(255,136,0,0.08)' },
    1: { label: 'DEFCON 1', desc: 'Maximum — All systems engaged', color: '#ff1133', glow: 'rgba(255,17,51,0.1)' },
  };

  function getDefconLevel() {
    // DEFCON 3 during work hours (8-18 UTC), 4 at night, briefly 2 on Mondays
    const h = new Date().getUTCHours();
    const d = new Date().getUTCDay();
    if (d === 1 && h < 4) return 2;
    if (h >= 8 && h < 18) return 3;
    return 4;
  }

  function initDefcon() {
    const meter = document.getElementById('defcon-meter');
    if (!meter) return;

    const level    = getDefconLevel();
    const data     = DEFCON_DATA[level];
    const dots     = meter.querySelectorAll('.defcon-dot');
    const levelEl  = meter.querySelector('.defcon-level');
    const descEl   = meter.querySelector('.defcon-desc');
    const pulseEl  = meter.querySelector('.defcon-pulse');

    // Light up dots from 5 down to current level
    dots.forEach((dot, i) => {
      const dotLevel = 5 - i;
      if (dotLevel >= level) {
        dot.classList.add('lit-' + dotLevel);
      }
    });

    if (levelEl) {
      levelEl.textContent  = data.label;
      levelEl.className    = 'defcon-level dc-' + level;
    }
    if (descEl)   descEl.textContent  = data.desc;
    if (pulseEl)  pulseEl.style.color = data.color;
    meter.style.setProperty('--defcon-glow', data.glow);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDefcon);
  } else {
    initDefcon();
  }

})();
