// Story mode ending: "Why it matters" (Dev B).
// After the laser echo, the camera zooms out from Earth to the whole Solar System while the
// friends Belu found light up where they are. Then: "Explore the sky with Belu".
// The planet positions are illustrative (same distances from the Sun, angles chosen for clarity).

import { speak } from './speak.js';

const TAU = Math.PI * 2;
const reducedMotion = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('a11y-calm'));
const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

const LINES = [
  { at: 0, text: 'Belu found his friends by listening to echoes.' },
  { at: 4.5, text: 'Robots go where people cannot go yet: too far, too cold, too dangerous.' },
  { at: 9, text: 'They showed us that Mars once had water, and that even little Ceres hides salty water.' },
  { at: 13.5, text: 'When one goes silent, the next explorers carry on with what it learned.' },
  { at: 18, text: 'And some still answer: observatories still bounce lasers off the mirror on the Moon today.' },
];
const END = 23;

// Distance from the Sun in AU, illustrative angle
const BODIES = {
  earth: { au: 1, angle: 0, r: 5, color: '#5d9bff' },
  moon: { au: 1, angle: 0, offset: 0.00257, r: 2, color: '#c9d3e6' },
  mars: { au: 1.52, angle: 2.3, r: 4, color: '#ff8a5c' },
  ceres: { au: 2.77, angle: -2.2, r: 2.5, color: '#b49bff' },
  jupiter: { au: 5.2, angle: 1.0, r: 8, color: '#d9b38c' },
};
const HOME = { moon: 'moon', mars: 'mars', ceres: 'ceres', pioneer10: 'pioneer' };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function buildDom() {
  let section = document.getElementById('screen-why');
  if (section) return section;
  section = el('section', 'screen why');
  section.id = 'screen-why';
  section.hidden = true;
  section.setAttribute('aria-label', 'Why it matters');
  section.innerHTML = `
    <canvas class="why-canvas" aria-hidden="true"></canvas>
    <div class="why-text">
      <p class="mono why-eyebrow">WHY IT MATTERS</p>
      <p class="why-line" aria-live="polite"></p>
      <button class="link why-skip" type="button">Skip ▸</button>
    </div>
    <div class="why-end" hidden>
      <p class="mono why-eyebrow">WHY IT MATTERS</p>
      <h2 tabindex="-1">One day, maybe you will build the next explorer.</h2>
      <ul class="why-list"></ul>
      <button class="big why-explore" type="button">Explore the sky with Belu</button>
      <button class="why-science" type="button">See the real data in Scientist mode</button>
      <p class="hint">Belu is a fictional character. Every fact about the robots is real.</p>
    </div>`;
  const anchor = document.getElementById('subtitles');
  document.body.insertBefore(section, anchor || null);
  return section;
}
buildDom();

export function showWhy({ robots = [], isFound = () => false, onExplore, onScience } = {}) {
  const section = buildDom();
  const canvas = section.querySelector('.why-canvas');
  const ctx = canvas.getContext('2d');
  const line = section.querySelector('.why-line');
  const end = section.querySelector('.why-end');
  const text = section.querySelector('.why-text');
  const list = section.querySelector('.why-list');
  let w = 0, h = 0, raf = 0, start = 0, lineIndex = -1;

  const found = robots.filter(isFound);
  list.innerHTML = '';
  for (const r of found) {
    const li = el('li');
    li.append(el('b', null, r.name), el('span', null, ` · ${r.story?.discoveries?.split('. ')[0] || ''}.`));
    list.appendChild(li);
  }
  if (!found.length) list.hidden = true; else list.hidden = false;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    const p = ease(Math.min(1, t / 11));          // zoom done by line 3, then the Solar System stays
    const m = Math.min(w, h);
    // px per AU: from "Earth and Moon fill the screen" to "the planets out to Jupiter"
    const s0 = (m * 0.32) / 0.00257, s1 = (m * 0.44) / 3.2;
    const s = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * p);
    // camera: follows Earth while zoomed in, then slides to the Sun once the orbit fits on screen
    const d = 0.3 * w * ease(p * 2);                 // Earth drifts right of centre
    const c = Math.max(0, Math.min(1, 1 - d / s));
    const cx = w / 2 - c * s, cy = h * 0.42;
    const pos = (au, angle, offset = 0) => ({
      x: cx + Math.cos(angle) * au * s + offset * s,
      y: cy + Math.sin(angle) * au * s * 0.92,
    });

    ctx.fillStyle = '#0b0a1f';
    ctx.fillRect(0, 0, w, h);
    // stars (fixed)
    for (let i = 0; i < 140; i++) {
      const x = (i * 97.13) % w, y = (i * 53.71 + (i % 7) * 31) % h;
      ctx.globalAlpha = 0.25 + ((i * 13) % 10) / 20;
      ctx.fillStyle = '#c9d3e6';
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;

    // orbits
    ctx.lineWidth = 1;
    for (const b of [BODIES.earth, BODIES.mars, BODIES.ceres, BODIES.jupiter]) {
      ctx.strokeStyle = 'rgba(154,156,196,.22)';
      ctx.beginPath(); ctx.ellipse(cx, cy, b.au * s, b.au * s * 0.92, 0, 0, TAU); ctx.stroke();
    }
    // the Sun
    const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    sun.addColorStop(0, '#fff6dc'); sun.addColorStop(0.35, 'rgba(255,220,150,.65)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, TAU); ctx.fill();

    const places = {};
    for (const [id, b] of Object.entries(BODIES)) {
      const q = pos(b.au, b.angle, b.offset || 0);
      places[id] = q;
      // Earth and Moon drawn 6× bigger than true scale while zoomed in, so they read as worlds
      const r = id === 'earth' ? Math.max(b.r, 0.0000426 * s * 6) : id === 'moon' ? Math.max(b.r, 0.0000116 * s * 6) : b.r;
      if (id === 'moon' && b.offset * s < 14) continue;      // too close to Earth to show
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.min(r, m * 0.2), 0, TAU); ctx.fill();
      if (p > 0.55 || id === 'earth' || id === 'moon') {
        ctx.fillStyle = 'rgba(238,240,255,.75)';
        ctx.font = '11px "JetBrains Mono", monospace';
        const label = id.toUpperCase();
        const lw = ctx.measureText(label).width, gap = Math.min(r, m * 0.2) + 6;
        ctx.fillText(label, q.x + gap + lw > w - 4 ? q.x - gap - lw : q.x + gap, q.y + 4);
      }
    }
    // Pioneer 10 left long ago: an arrow off the edge
    const dir = 1.75;
    const px = cx + Math.cos(dir) * 7 * s, py = cy + Math.sin(dir) * 7 * s;
    places.pioneer = { x: Math.max(16, Math.min(w - 16, px)), y: Math.max(16, Math.min(h - 16, py)) };

    // the friends Belu found glow at home
    const pulse = reducedMotion() ? 0.5 : (t % 1.6) / 1.6;
    const done = new Set();
    for (const r of found) {
      const home = HOME[r.sky_target];
      if (!home || !places[home] || done.has(home)) continue;
      done.add(home);
      const q = places[home];
      ctx.strokeStyle = `rgba(93,228,255,${0.8 * (1 - pulse)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.x, q.y, 10 + pulse * 18, 0, TAU); ctx.stroke();
    }
    if (p > 0.7) {
      ctx.fillStyle = 'rgba(167,139,250,.85)';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('→ PIONEER 10, FAR BEYOND', Math.min(places.pioneer.x, w - 190), places.pioneer.y - 8);
    }
  }

  function setLine(i) {
    if (i === lineIndex) return;
    lineIndex = i;
    line.textContent = LINES[i].text;
    speak(LINES[i].text, { interrupt: true });
    line.classList.remove('in'); void line.offsetWidth; line.classList.add('in');
  }

  function finish() {
    cancelAnimationFrame(raf);
    draw(END);
    text.hidden = true;
    end.hidden = false;
    end.querySelector('h2').focus();
  }

  function tick(now) {
    const t = (now - start) / 1000;
    if (t >= END) return finish();
    let i = 0;
    while (i + 1 < LINES.length && t >= LINES[i + 1].at) i++;
    setLine(i);
    draw(t);
    raf = requestAnimationFrame(tick);
  }

  const onResize = () => { resize(); draw(end.hidden ? 0 : END); };
  window.addEventListener('resize', onResize);
  section.querySelector('.why-skip').onclick = finish;
  section.querySelector('.why-explore').onclick = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); onExplore && onExplore(); };
  section.querySelector('.why-science').onclick = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); onScience && onScience(); };

  text.hidden = false;
  end.hidden = true;
  lineIndex = -1;
  resize();
  if (reducedMotion()) {
    line.textContent = LINES.map(l => l.text).join(' ');
    finish();
    return;
  }
  start = performance.now();
  raf = requestAnimationFrame(tick);
}
