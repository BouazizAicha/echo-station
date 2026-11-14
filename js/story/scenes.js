// Animated backgrounds for Story mode (Dev B): Moon, Mars, Ceres, deep space.
// One <canvas> fixed behind the story cards. Soft motion only (twinkling stars, drifting dust),
// nothing flashes. With prefers-reduced-motion, the scene is drawn once and stays still.

const TAU = Math.PI * 2;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Deterministic random numbers, so a scene looks the same every time
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function makeStars(count, seed = 7) {
  const r = rng(seed);
  return Array.from({ length: count }, () => ({
    x: r(), y: r(), size: r() < 0.12 ? 1.6 + r() : 0.5 + r() * 0.9, phase: r() * TAU, speed: 0.4 + r() * 1.2,
  }));
}

export function drawStars(ctx, w, h, stars, t, { maxY = 1, alpha = 1, driftX = 0 } = {}) {
  for (const s of stars) {
    if (s.y > maxY) continue;
    const x = ((s.x + driftX * t * 0.002 * s.size) % 1 + 1) % 1 * w;
    const tw = 0.65 + 0.35 * Math.sin(t * s.speed + s.phase);
    ctx.globalAlpha = alpha * tw * (s.size > 1.5 ? 1 : 0.75);
    ctx.fillStyle = s.size > 1.5 ? '#ffffff' : '#c9d3e6';
    ctx.beginPath();
    ctx.arc(x, s.y * h, s.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function vertical(ctx, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

const STARS = makeStars(190, 11);
const DUST = makeStars(60, 23);
const CRATERS = (() => {
  const r = rng(5);
  return Array.from({ length: 14 }, () => ({ x: r(), y: r(), s: 0.3 + r() * 0.9 }));
})();
const ROCKS = (() => {
  const r = rng(9);
  return Array.from({ length: 22 }, () => ({ x: r(), y: r(), s: 0.4 + r() * 1.2 }));
})();

// The horizon sits behind the robot (top part of the screen); the cards float over the ground.
// It slides up a little when a card needs more room (setHorizon).
let HZ = 0.34, HZ_TARGET = 0.34;
const horizonY = h => Math.round(h * HZ);

function moon(ctx, w, h, t) {
  ctx.fillStyle = vertical(ctx, h, [[0, '#04030c'], [HZ, '#0b0a1f'], [1, '#0b0a1f']]);
  ctx.fillRect(0, 0, w, h);
  drawStars(ctx, w, h, STARS, t, { maxY: HZ });

  // Earth, high in the black sky
  const er = Math.max(16, Math.min(w, h) * 0.055);
  const ex = w * 0.8, ey = h * 0.11;
  glow(ctx, ex, ey, er * 3, 'rgba(93,160,255,.35)');
  const eg = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, er * 0.2, ex, ey, er);
  eg.addColorStop(0, '#7fb8ff'); eg.addColorStop(1, '#1f4fa8');
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(ex - er * 0.2, ey - er * 0.15, er * 0.45, er * 0.14, -0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(4,3,12,.6)';
  ctx.beginPath(); ctx.arc(ex + er * 0.55, ey + er * 0.1, er, 0, TAU); ctx.fill();

  // Grey ground with craters
  const hy = horizonY(h);
  ctx.fillStyle = vertical(ctx, h, [[hy / h, '#9aa1b3'], [(hy / h) + 0.18, '#5d6273'], [1, '#262838']]);
  ctx.beginPath();
  ctx.moveTo(0, hy + 8);
  ctx.quadraticCurveTo(w * 0.5, hy - 10, w, hy + 6);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  for (const c of CRATERS) {
    const y = hy + 14 + c.y * (h - hy) * 0.9;
    const depth = (y - hy) / (h - hy);
    const rx = (10 + 34 * c.s) * (0.5 + depth), ry = rx * (0.22 + 0.2 * depth);
    ctx.fillStyle = 'rgba(30,32,45,.35)';
    ctx.beginPath(); ctx.ellipse(c.x * w, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(220,226,240,.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(c.x * w, y + ry * 0.15, rx, ry, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  }
}

function mars(ctx, w, h, t) {
  const hy = horizonY(h);
  ctx.fillStyle = vertical(ctx, h, [[0, '#0d0a24'], [HZ * 0.47, '#2b1838'], [hy / h, '#b0583c'], [1, '#3a160f']]);
  ctx.fillRect(0, 0, w, h);
  drawStars(ctx, w, h, STARS, t, { maxY: HZ * 0.47, alpha: 0.7 });

  // Small, pale Sun near the horizon (Mars is farther from the Sun than Earth)
  const sx = w * 0.22, sy = hy - h * 0.05;
  glow(ctx, sx, sy, h * 0.09, 'rgba(170,205,255,.45)');
  ctx.fillStyle = '#f4f1e8';
  ctx.beginPath(); ctx.arc(sx, sy, Math.max(4, h * 0.009), 0, TAU); ctx.fill();

  // Far hills, then the ground
  ctx.fillStyle = '#7d3a2b';
  ctx.beginPath(); ctx.moveTo(0, hy);
  for (let x = 0; x <= w; x += w / 12) ctx.lineTo(x, hy - 10 - 14 * Math.abs(Math.sin(x / w * 7.3)));
  ctx.lineTo(w, hy + 20); ctx.lineTo(0, hy + 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = vertical(ctx, h, [[hy / h, '#b9583a'], [(hy / h) + 0.2, '#8a3a26'], [1, '#3a160f']]);
  ctx.beginPath(); ctx.moveTo(0, hy + 6);
  ctx.quadraticCurveTo(w * 0.6, hy - 4, w, hy + 10);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  for (const r of ROCKS) {
    const y = hy + 12 + r.y * (h - hy);
    const depth = (y - hy) / (h - hy);
    const s = (3 + 9 * r.s) * (0.5 + depth * 1.5);
    ctx.fillStyle = 'rgba(40,14,8,.45)';
    ctx.beginPath(); ctx.ellipse(r.x * w, y, s * 1.4, s * 0.7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(220,130,90,.25)';
    ctx.beginPath(); ctx.ellipse(r.x * w - s * 0.3, y - s * 0.25, s * 0.7, s * 0.3, 0, 0, TAU); ctx.fill();
  }

  // Dust drifting in the wind
  for (const d of DUST) {
    const x = ((d.x + t * 0.012 * d.speed) % 1) * w;
    const y = hy - 30 + d.y * (h - hy + 30) + Math.sin(t * d.speed + d.phase) * 6;
    ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t + d.phase);
    ctx.fillStyle = '#ffc9a8';
    ctx.beginPath(); ctx.arc(x, y, d.size * 1.2, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function space(ctx, w, h, t, { sun = 0.06 } = {}) {
  ctx.fillStyle = vertical(ctx, h, [[0, '#06051a'], [0.6, '#0b0a1f'], [1, '#140f36']]);
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * 0.7, h * 0.25, Math.max(w, h) * 0.45, 'rgba(180,155,255,.16)');
  glow(ctx, w * 0.2, h * 0.7, Math.max(w, h) * 0.4, 'rgba(255,155,213,.08)');
  drawStars(ctx, w, h, STARS, t, { driftX: -1 });
  // A tiny Sun, very far away
  const sx = w * 0.1, sy = h * 0.16;
  glow(ctx, sx, sy, Math.min(w, h) * sun * 3, 'rgba(255,230,170,.5)');
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, Math.min(w, h) * sun * 0.25), 0, TAU); ctx.fill();
}

function ceres(ctx, w, h, t) {
  space(ctx, w, h, t, { sun: 0.05 });
  // Ceres, a dark round dwarf planet, with the bright spots of Occator Crater
  const r = Math.max(w, h) * 0.55;
  const cx = w * 0.5, cy = horizonY(h) + r * 0.92;
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.5, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#8d8a8a'); g.addColorStop(0.6, '#4a4848'); g.addColorStop(1, '#1d1c22');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  for (const c of CRATERS) {
    const a = -Math.PI / 2 + (c.x - 0.5) * 1.6;
    const d = r * (0.25 + 0.7 * c.y);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    if (y < cy - r || Math.hypot(x - cx, y - cy) > r - 10) continue;
    ctx.fillStyle = 'rgba(20,20,26,.3)';
    ctx.beginPath(); ctx.ellipse(x, y, 14 * c.s + 6, (14 * c.s + 6) * 0.55, 0, 0, TAU); ctx.fill();
  }
  const ox = cx + r * 0.12, oy = cy - r * 0.86;
  ctx.strokeStyle = 'rgba(30,30,36,.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(ox, oy, 26, 9, 0, 0, TAU); ctx.stroke();
  glow(ctx, ox, oy, 14, 'rgba(255,255,255,.9)', 0.8 + 0.2 * Math.sin(t * 0.8));
  glow(ctx, ox + 12, oy + 2, 7, 'rgba(255,255,255,.8)');
}

function deep(ctx, w, h, t) {
  space(ctx, w, h, t, { sun: 0.025 });
  // The Milky Way: a soft band across the sky
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.5);
  const band = ctx.createLinearGradient(0, -h * 0.18, 0, h * 0.18);
  band.addColorStop(0, 'rgba(201,211,230,0)');
  band.addColorStop(0.5, 'rgba(201,211,230,.07)');
  band.addColorStop(1, 'rgba(201,211,230,0)');
  ctx.fillStyle = band;
  ctx.fillRect(-w * 1.5, -h * 0.18, w * 3, h * 0.36);
  ctx.restore();
}

const SCENES = { moon, mars, ceres, deep };

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

export function createScene(canvas) {
  const ctx = canvas.getContext('2d');
  let name = 'deep';
  let raf = 0;
  let running = false;
  let w = 0, h = 0;
  const start = performance.now();

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }

  let lastDraw = performance.now();
  function draw(now) {
    if (!w) return;
    const t = (now - start) / 1000;
    const dt = Math.min(0.1, Math.max(0, (now - lastDraw) / 1000));
    lastDraw = now;
    HZ = reducedMotion() ? HZ_TARGET : HZ + (HZ_TARGET - HZ) * Math.min(1, dt * 4);
    (SCENES[name] || deep)(ctx, w, h, reducedMotion() ? 0 : t);
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { if (running) resize(); });

  return {
    setHorizon(fraction) {
      HZ_TARGET = fraction;
      if (reducedMotion() || !running) { HZ = fraction; if (running) draw(performance.now()); }
    },
    set(next) {
      name = SCENES[next] ? next : 'deep';
      if (running) draw(performance.now());
    },
    start() {
      if (running) return;
      running = true;
      resize();
      if (!reducedMotion()) raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
