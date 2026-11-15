// Story mode prologue (Dev B): about 55 seconds, skippable.
//   1. Deep in the ocean, Belu sees with sound (clicks → echoes bounce back from a rock).
//   2. He swims up to the surface and looks at the night sky.
//   3. His friends light up one by one: the robots on the Moon, on Mars and beyond.
//   4. One by one they go silent (real last-signal years).
//   5. Belu calls… no answer. "Help Belu find his friends."
// The scene is drawn on a canvas; Belu himself is an <img>, so D's drawings replace him automatically.
// With prefers-reduced-motion: no movement, the parts advance with a Next button.
import { getAudioContext, isMuted } from './radio.js';
import { makeStars, drawStars } from './scenes.js';
import { speak } from './speak.js';

const TAU = Math.PI * 2;
const BELU = mood => `assets/images/belu-${mood}.svg`;
const SWIM = 'assets/images/belu-swim.svg';       // side view, under water (drawings by Oumayma)
const SWIM_RATIO = 424 / 980, FRONT_RATIO = 417 / 306;

const PHASES = [
  { at: 0, text: 'Deep in the ocean lives Belu, a young beluga whale.' },
  { at: 7, text: 'Belu sees with sound. He sends clicks… and listens to the echoes that bounce back.' },
  { at: 15, text: 'One night, Belu swam up to the surface… and heard tiny voices in the sky.' },
  { at: 24, text: 'Robots! NASA sent them to explore the Moon, Mars and beyond. They became Belu\'s friends.' },
  { at: 36, text: 'But one by one, their voices went quiet.' },
  { at: 47, text: 'Belu misses them. Maybe, if he listens very carefully, he can find them again…' },
];
const END = 54;

// The worlds in the sky. Each world has one tidy name tag beside it that lists its robots,
// so names never sit on top of a planet or of each other.
const WORLDS = {
  deep: { name: 'Deep space', color: '#a78bfa' },
  moon: { name: 'The Moon', color: '#c9d3e6' },
  mars: { name: 'Mars', color: '#e0703a' },
  ceres: { name: 'Ceres', color: '#a78bfa' },
};
// Where each world sits (fractions of the screen) and on which side its tag goes
const LAYOUTS = {
  wide: { deep: { x: 0.12, y: 0.2, side: 'right' }, moon: { x: 0.7, y: 0.2, side: 'right' }, mars: { x: 0.32, y: 0.32, side: 'right' }, ceres: { x: 0.85, y: 0.47, side: 'left' } },
  tall: { deep: { x: 0.1, y: 0.22, side: 'right' }, moon: { x: 0.8, y: 0.12, side: 'left' }, mars: { x: 0.2, y: 0.36, side: 'right' }, ceres: { x: 0.8, y: 0.5, side: 'left' } },
};
// Robots on a planet: little lights on its face (fractions of the radius)
const ON_DISK = { 1: [[0.2, -0.15]], 2: [[-0.35, -0.15], [0.3, 0.25]], 3: [[-0.42, -0.3], [0.4, -0.08], [-0.06, 0.45]] };
const worldOf = robot => (robot.sky_target === 'pioneer10' ? 'deep' : robot.sky_target);
const shortName = name => String(name || '').replace(/\s*\([^)]*\)/g, '').trim();
const FALLBACK_ROBOTS = [
  { id: 'apollo11-eagle', name: 'Eagle', sky_target: 'moon', landed: '1969' },
  { id: 'pioneer10', name: 'Pioneer 10', sky_target: 'pioneer10', launched: '1972', last_signal: '2003' },
  { id: 'spirit', name: 'Spirit', sky_target: 'mars', landed: '2004', last_signal: '2010' },
  { id: 'opportunity', name: 'Opportunity', sky_target: 'mars', landed: '2004', last_signal: '2018' },
  { id: 'dawn', name: 'Dawn', sky_target: 'ceres', launched: '2007', last_signal: '2018' },
  { id: 'ingenuity', name: 'Ingenuity', sky_target: 'mars', landed: '2021', last_signal: '2024' },
];

const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;
const year = d => (d ? String(d).slice(0, 4) : '');

/* ------------------------------------------------------------------ */
/* Sound: soft clicks, pings when a friend appears, low tones when it goes quiet */
/* ------------------------------------------------------------------ */

function blip(freq, duration = 0.25, volume = 0.08, type = 'sine', endFreq = null) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended' && !isMuted()) ctx.resume();
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + duration + 0.05);
}
const click = () => blip(2600, 0.04, 0.12, 'square', 1800);
const echo = () => blip(1900, 0.06, 0.05, 'square', 1400);

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

function buildDom() {
  let root = document.getElementById('prologue');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'prologue';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Belu\'s story');
  root.innerHTML = `
    <canvas class="pro-back" aria-hidden="true"></canvas>
    <img class="pro-belu" alt="" src="${SWIM}">
    <canvas class="pro-front" aria-hidden="true"></canvas>
    <div class="pro-labels" aria-hidden="true"></div>
    <div class="pro-bar" aria-hidden="true"><span></span></div>
    <button class="pro-skip link" type="button">Skip ▸</button>
    <div class="pro-caption"><p aria-live="polite"></p><button class="pro-next" type="button" hidden>Next ▸</button></div>
    <div class="pro-end" hidden>
      <p class="mono pro-eyebrow">YOUR MISSION</p>
      <h2 tabindex="-1">Help Belu find his friends</h2>
      <p>Move your phone across the sky, or drag the sky map. When Belu hears a friend, his clicks get faster. Hold still… and listen!</p>
      <button class="big pro-go" type="button">Start listening</button>
      <p class="hint">Belu is a fictional character. Every fact about the robots is real.</p>
    </div>`;
  document.body.appendChild(root);
  return root;
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

export function playPrologue({ robots = [], onDone } = {}) {
  const root = buildDom();
  const back = root.querySelector('.pro-back');
  const front = root.querySelector('.pro-front');
  const belu = root.querySelector('.pro-belu');
  const setBelu = src => { if (belu.dataset.src !== src) { belu.src = src; belu.dataset.src = src; } };
  const labels = root.querySelector('.pro-labels');
  const caption = root.querySelector('.pro-caption p');
  const nextButton = root.querySelector('.pro-next');
  const skipButton = root.querySelector('.pro-skip');
  const bar = root.querySelector('.pro-bar span');
  const endCard = root.querySelector('.pro-end');
  const bctx = back.getContext('2d');
  const fctx = front.getContext('2d');
  const reduced = (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('a11y-calm'));

  const friends = (robots.length ? robots : FALLBACK_ROBOTS)
    .filter(r => WORLDS[worldOf(r)])
    .map((r, i) => ({ robot: r, i, world: worldOf(r) }));
  // One tag per world, one row per robot
  labels.innerHTML = '';
  const tags = {};
  for (const f of friends) {
    if (!tags[f.world]) {
      const tag = document.createElement('div');
      tag.className = 'pro-tag';
      tag.dataset.world = f.world;
      tag.innerHTML = '<p class="pro-tag-world mono"></p><ul></ul>';
      tag.querySelector('p').textContent = WORLDS[f.world].name.toUpperCase();
      labels.appendChild(tag);
      tags[f.world] = { el: tag, list: [], x: 0, y: 0 };
    }
    const row = document.createElement('li');
    row.className = 'pro-bot';
    row.innerHTML = '<i></i><span><b></b><small class="mono"></small></span>';
    row.querySelector('b').textContent = shortName(f.robot.name);
    f.row = row;
    f.status = row.querySelector('small');
    f.n = tags[f.world].list.length;
    tags[f.world].list.push(f);
    tags[f.world].el.querySelector('ul').appendChild(row);
    f.appear = 25 + f.i * 1.5;
  }
  const statusOf = (f, quiet) => (quiet
    ? `quiet since ${year(f.robot.last_signal) || year(f.robot.landed)}`
    : f.robot.landed ? `landed ${year(f.robot.landed)}` : `launched ${year(f.robot.launched)}`);
  for (const f of friends) f.status.textContent = statusOf(f, false);
  // They go quiet in the order of their real last signal
  [...friends]
    .sort((a, b) => (year(a.robot.last_signal) || year(a.robot.landed) || '0').localeCompare(year(b.robot.last_signal) || year(b.robot.landed) || '0'))
    .forEach((f, k) => { f.fade = 37 + k * 1.5; });

  const stars = makeStars(170, 3);
  const bubbles = makeStars(40, 17);
  let w = 0, h = 0, raf = 0, t = 0, startAt = 0, phase = -1, done = false;
  let lastClick = -1, lastPing = new Set(), lastFade = new Set();

  // Places the worlds, the robots' lights and the tags (in sky coordinates, camera at the surface)
  let worlds = {};
  function layout() {
    const spots = LAYOUTS[w >= h ? 'wide' : 'tall'];
    const m = Math.min(w, h);
    worlds = {};
    for (const [id, spot] of Object.entries(spots)) {
      const r = id === 'moon' ? Math.max(28, m * 0.055) : id === 'mars' ? Math.max(24, m * 0.035) : id === 'ceres' ? Math.max(9, m * 0.016) : 0;
      worlds[id] = { ...spot, cx: spot.x * w, cy: spot.y * h, r, reach: id === 'ceres' ? r * 2.6 + 10 : id === 'deep' ? 14 : r + 4 };
    }
    for (const f of friends) {
      const wd = worlds[f.world];
      const count = tags[f.world].list.length;
      if (f.world === 'moon' || f.world === 'mars') {
        const [dx, dy] = (ON_DISK[count] || ON_DISK[3])[f.n % 3];
        f.x = wd.cx + dx * wd.r; f.y = wd.cy + dy * wd.r;
      } else if (f.world === 'ceres') {
        const a = -0.7 + f.n * 1.2;
        f.x = wd.cx + Math.cos(a) * wd.r * 2.6; f.y = wd.cy + Math.sin(a) * wd.r * 2.6;
      } else { f.x = wd.cx; f.y = wd.cy + f.n * 22; }
    }
    // Tags beside their world, kept on screen and never on top of each other
    const boxes = [];
    for (const [id, tag] of Object.entries(tags)) {
      const wd = worlds[id];
      const tw = tag.el.offsetWidth, th = tag.el.offsetHeight;
      let x = wd.side === 'left' ? wd.cx - wd.reach - 12 - tw : wd.cx + wd.reach + 12;
      if (x + tw > w - 8) x = wd.cx - wd.reach - 12 - tw;      // no room on that side: the other side
      if (x < 8) x = Math.min(wd.cx + wd.reach + 12, w - tw - 8);
      boxes.push({ tag, x, y: wd.cy - th / 2, tw, th });
    }
    const top = 64;
    boxes.sort((a, b) => a.y - b.y);
    for (let k = 0; k < boxes.length; k++) {
      const b = boxes[k];
      b.y = Math.max(b.y, top);
      for (let j = 0; j < k; j++) {
        const o = boxes[j];
        const overlapX = b.x < o.x + o.tw + 10 && o.x < b.x + b.tw + 10;
        if (overlapX && b.y < o.y + o.th + 10) b.y = o.y + o.th + 10;
      }
    }
    for (const b of boxes) { b.tag.x = Math.round(b.x); b.tag.y = Math.round(b.y); }
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    for (const [c, x] of [[back, bctx], [front, fctx]]) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    layout();
  }

  // Camera: 0 = deep under water, 1 = looking at the sky from the surface
  const camAt = time => ease((time - 15) / 6);

  function beluBox(time) {
    const cam = camAt(time);
    const surface = lerp(-0.15 * h, 0.8 * h, cam);
    if (cam > 0.85) {                                    // at the surface Belu turns to us, half out of the water
      const fw = Math.min(w * 0.26, h * 0.2, 150), fh = fw * FRONT_RATIO;
      const fbob = reduced ? 0 : Math.sin(time * 1.4) * 4;
      const fx = Math.max(12, w * 0.15 - fw / 2), fy = surface - fh * 0.6 + fbob;
      return { x: fx, y: fy, bw: fw, bh: fh, surface, cam, front: true, head: { x: fx + fw / 2, y: fy + fh * 0.3 } };
    }
    const bw = Math.min(w * 0.46, 280), bh = bw * SWIM_RATIO;
    const swimIn = ease(time / 5);
    const x = lerp(lerp(-bw, w * 0.24, swimIn), w * 0.06, cam);
    const bob = reduced ? 0 : Math.sin(time * 1.4) * (cam > 0.9 ? 4 : 9);
    const y = surface + lerp(0.55 * h, -bh * 0.55, cam) + bob;
    return { x, y, bw, bh, surface, cam, head: { x: x + bw * 0.97, y: y + bh * 0.45 } };
  }

  function drawFrame(time) {
    const b = beluBox(time);
    const { surface, cam } = b;
    bctx.clearRect(0, 0, w, h);

    // Night sky above the water
    if (surface > 0) {
      const g = bctx.createLinearGradient(0, surface - h, 0, surface);
      g.addColorStop(0, '#05041a'); g.addColorStop(0.7, '#0f0c33'); g.addColorStop(1, '#1d1648');
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, w, surface);
      bctx.save();
      bctx.translate(0, surface - 0.8 * h);
      drawStars(bctx, w, h * 0.8, stars, reduced ? 0 : time, { alpha: cam });
      bctx.restore();
    }

    // Ocean
    const og = bctx.createLinearGradient(0, surface, 0, surface + 1.3 * h);
    og.addColorStop(0, '#145a72'); og.addColorStop(0.35, '#0e3550'); og.addColorStop(1, '#05070d');
    bctx.fillStyle = og;
    bctx.fillRect(0, Math.max(0, surface), w, h);
    // Light rays from the surface
    bctx.save();
    bctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const sway = reduced ? 0 : Math.sin(time * 0.3 + i * 1.7) * 30;
      const x0 = w * (0.1 + i * 0.22) + sway;
      const ray = bctx.createLinearGradient(0, surface, 0, surface + h * 0.9);
      ray.addColorStop(0, 'rgba(93,255,176,.10)'); ray.addColorStop(1, 'rgba(93,255,176,0)');
      bctx.fillStyle = ray;
      bctx.beginPath();
      bctx.moveTo(x0, surface); bctx.lineTo(x0 + 50, surface);
      bctx.lineTo(x0 + 130 + sway, surface + h * 0.9); bctx.lineTo(x0 + 10 + sway, surface + h * 0.9);
      bctx.closePath(); bctx.fill();
    }
    bctx.restore();
    // Bubbles
    for (const p of bubbles) {
      const span = 1.3 * h;
      const y = surface + span - ((p.y * span + (reduced ? 0 : time * 30 * p.speed)) % span);
      if (y < surface + 4) continue;
      bctx.strokeStyle = 'rgba(200,240,255,.35)'; bctx.lineWidth = 1;
      bctx.beginPath(); bctx.arc(p.x * w + Math.sin(time + p.phase) * 6, y, 1.5 + p.size * 2, 0, TAU); bctx.stroke();
    }
    // The rock that sends Belu's echoes back
    const rock = { x: w * 0.82, y: surface + 0.95 * h };
    if (rock.y < h + 60) {
      bctx.fillStyle = '#123b52';
      bctx.strokeStyle = 'rgba(93,255,176,.35)';
      bctx.lineWidth = 2;
      bctx.beginPath();
      bctx.moveTo(rock.x - 70, rock.y + 60); bctx.lineTo(rock.x - 40, rock.y - 30); bctx.lineTo(rock.x + 10, rock.y - 50);
      bctx.lineTo(rock.x + 60, rock.y - 10); bctx.lineTo(rock.x + 80, rock.y + 60); bctx.closePath(); bctx.fill(); bctx.stroke();
    }

    // Echolocation: clicks go out, echoes come back from the rock (phases 1-2)
    if (time >= 3 && time < 17) {
      const period = 1.6, speed = Math.max(w, h) * 0.45;
      const dist = Math.hypot(rock.x - b.head.x, rock.y - b.head.y);
      const dir = Math.atan2(rock.y - b.head.y, rock.x - b.head.x);
      for (let k = Math.floor((time - 3) / period); k >= 0 && k >= Math.floor((time - 3) / period) - 2; k--) {
        const age = time - 3 - k * period;
        const r = age * speed;
        if (r < dist) {
          bctx.strokeStyle = `rgba(93,255,176,${0.9 * (1 - r / dist) + 0.1})`; bctx.lineWidth = 4;
          bctx.beginPath(); bctx.arc(b.head.x, b.head.y, r, dir - 0.5, dir + 0.5); bctx.stroke();
        } else if (time >= 7 && r < dist * 2) {
          const rr = r - dist;
          bctx.strokeStyle = `rgba(255,179,71,${0.8 * (1 - rr / dist) + 0.1})`; bctx.lineWidth = 3;
          bctx.beginPath(); bctx.arc(rock.x, rock.y, rr, dir + Math.PI - 0.4, dir + Math.PI + 0.4); bctx.stroke();
        }
      }
    }

    // Planets and friends in the sky
    const lift = surface - 0.8 * h;                      // the sky moves with the camera
    if (cam > 0.6) {
      const a = ease((cam - 0.6) / 0.4);
      bctx.globalAlpha = a;
      for (const [id, wd] of Object.entries(worlds)) {
        if (!wd.r) continue;
        const x = wd.cx, y = wd.cy + lift, r = wd.r;
        if (id === 'ceres') {                              // Dawn's orbit
          bctx.strokeStyle = 'rgba(167,139,250,.22)'; bctx.lineWidth = 1; bctx.setLineDash([3, 5]);
          bctx.beginPath(); bctx.arc(x, y, r * 2.6, 0, TAU); bctx.stroke(); bctx.setLineDash([]);
        }
        const pg = bctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.25, WORLDS[id].color); pg.addColorStop(1, '#2a2038');
        bctx.fillStyle = pg;
        bctx.beginPath(); bctx.arc(x, y, r, 0, TAU); bctx.fill();
      }
      bctx.globalAlpha = 1;
    }
    let relayout = false;
    for (const [id, tag] of Object.entries(tags)) {
      let shown = 0;
      for (const f of tag.list) {
        const on = ease((time - f.appear) / 0.8);
        const off = ease((time - f.fade) / 1.2);
        shown = Math.max(shown, on);
        const quiet = off > 0.5;
        f.row.classList.toggle('on', on > 0.5 && !quiet);
        f.row.classList.toggle('quiet', quiet);
        const text = statusOf(f, quiet);
        if (f.status.textContent !== text) { f.status.textContent = text; relayout = true; }
        if (on <= 0) continue;
        const x = f.x, y = f.y + lift;
        if (id === 'deep') {                               // Pioneer 10 heads out of the solar system
          bctx.strokeStyle = `rgba(167,139,250,${0.35 * on})`; bctx.lineWidth = 1.5; bctx.setLineDash([2, 5]);
          bctx.beginPath(); bctx.moveTo(x + 46, y + 22); bctx.lineTo(x + 8, y + 4); bctx.stroke(); bctx.setLineDash([]);
        }
        const lit = on * (1 - off);
        const pulse = reduced ? 0.5 : (time * 0.9 + f.i * 0.3) % 1;
        if (lit > 0.05) {
          bctx.strokeStyle = `rgba(93,255,176,${0.55 * lit * (1 - pulse)})`; bctx.lineWidth = 1.5;
          bctx.beginPath(); bctx.arc(x, y, 4 + pulse * 12, 0, TAU); bctx.stroke();
        }
        const gl = bctx.createRadialGradient(x, y, 0, x, y, 9);
        gl.addColorStop(0, lit > 0.05 ? `rgba(93,255,176,${lit})` : 'rgba(154,156,196,.55)');
        gl.addColorStop(1, 'rgba(93,255,176,0)');
        bctx.fillStyle = gl;
        bctx.beginPath(); bctx.arc(x, y, 9, 0, TAU); bctx.fill();
        bctx.fillStyle = lit > 0.05 ? '#eafff5' : '#8a8cb0';
        bctx.beginPath(); bctx.arc(x, y, 2.6, 0, TAU); bctx.fill();
      }
      tag.el.style.opacity = String(shown);
    }
    if (relayout) layout();                              // "quiet since…" is longer: place the tags again
    for (const tag of Object.values(tags)) tag.el.style.transform = `translate(${tag.x}px, ${Math.round(tag.y + lift)}px)`;

    // Belu calls into the silent sky (phase 5): rings go up, nothing comes back
    if (time >= 48 && time < END && !done) {
      for (let k = 0; k < 3; k++) {
        const age = (time - 48 - k * 1.8);
        if (age < 0) continue;
        const r = (age % 5.4) * h * 0.25;
        bctx.strokeStyle = `rgba(93,255,176,${0.6 * Math.max(0, 1 - r / (h * 0.9))})`; bctx.lineWidth = 2.5;
        bctx.beginPath(); bctx.arc(b.head.x, b.head.y, r, -Math.PI * 0.85, -Math.PI * 0.15); bctx.stroke();
      }
    }

    // Belu
    belu.style.width = `${b.bw}px`;
    belu.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`;
    const mood = time >= 37 && time < END ? 'sad' : time >= 25 && time < 37 ? 'happy' : 'neutral';
    setBelu(b.front ? BELU(mood) : SWIM);

    // Water in front of Belu near the surface (he looks half under water)
    fctx.clearRect(0, 0, w, h);
    if (surface > -0.3 * h && surface < h) {
      const fg = fctx.createLinearGradient(0, surface, 0, surface + h * 0.22);
      fg.addColorStop(0, 'rgba(20,90,114,.75)'); fg.addColorStop(1, 'rgba(20,90,114,0)');
      fctx.fillStyle = fg;
      fctx.fillRect(0, surface, w, h * 0.22);
      fctx.strokeStyle = 'rgba(200,240,255,.55)'; fctx.lineWidth = 2;
      fctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = surface + Math.sin(x / 34 + (reduced ? 0 : time * 2)) * 3;
        x ? fctx.lineTo(x, y) : fctx.moveTo(x, y);
      }
      fctx.stroke();
    }
  }

  function sounds(time) {
    // clicks and echoes (phases 1-2)
    if (time >= 3 && time < 17) {
      const k = Math.floor((time - 3) / 1.6);
      if (k !== lastClick) { lastClick = k; click(); if (time >= 7) setTimeout(echo, 650); }
    }
    for (const f of friends) {
      if (time >= f.appear && !lastPing.has(f.i)) { lastPing.add(f.i); blip(660 + f.i * 110, 0.5, 0.06, 'triangle'); }
      if (time >= f.fade && !lastFade.has(f.i)) { lastFade.add(f.i); blip(330 - f.i * 18, 0.9, 0.05, 'sine', 200); }
    }
  }

  function setPhase(i) {
    if (i === phase) return;
    phase = i;
    caption.textContent = PHASES[i].text;
    speak(PHASES[i].text, { interrupt: true });
    caption.parentElement.classList.remove('in');
    void caption.offsetWidth;                 // restart the fade-in
    caption.parentElement.classList.add('in');
  }

  function showEnd() {
    done = true;
    cancelAnimationFrame(raf);
    t = END;
    drawFrame(47.5);                                     // every friend is quiet, Belu waits
    setBelu(BELU('neutral'));
    root.querySelector('.pro-caption').hidden = true;
    skipButton.hidden = true;
    bar.style.width = '100%';
    endCard.hidden = false;
    endCard.querySelector('h2').focus();
    speak(`${endCard.querySelector('h2').textContent}. ${endCard.querySelector('h2 + p').textContent}`, { interrupt: true });
  }

  function tick(now) {
    t = (now - startAt) / 1000;
    if (t >= END) return showEnd();
    let i = 0;
    while (i + 1 < PHASES.length && t >= PHASES[i + 1].at) i++;
    setPhase(i);
    drawFrame(t);
    sounds(t);
    bar.style.width = `${(t / END) * 100}%`;
    raf = requestAnimationFrame(tick);
  }

  // Reduced motion: still pictures, one per part, with a Next button
  function showStill(i) {
    if (i >= PHASES.length) return showEnd();
    setPhase(i);
    const at = PHASES[i + 1] ? PHASES[i + 1].at - 0.5 : END - 1;
    drawFrame(at);
    bar.style.width = `${((i + 1) / PHASES.length) * 100}%`;
  }

  function finish() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    root.hidden = true;
    document.documentElement.classList.remove('prologue-open');
    if (onDone) onDone();
  }

  const onResize = () => { resize(); if (done) drawFrame(47.5); else if (reduced) drawFrame(Math.min(t, END - 0.01)); };
  const onKey = e => { if (e.key === 'Escape' && !done) showEnd(); };

  // reset
  root.querySelector('.pro-caption').hidden = false;
  document.documentElement.classList.add('prologue-open');   // the page behind does not scroll
  endCard.hidden = true;
  skipButton.hidden = false;
  root.hidden = false;
  resize();
  document.fonts?.ready.then(() => { if (!root.hidden) layout(); });
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);
  skipButton.onclick = showEnd;
  root.querySelector('.pro-go').onclick = finish;

  if (reduced) {
    let i = 0;
    nextButton.hidden = false;
    nextButton.onclick = () => showStill(++i);
    showStill(0);
    nextButton.focus();
  } else {
    nextButton.hidden = true;
    startAt = performance.now();
    raf = requestAnimationFrame(tick);
    skipButton.focus();
  }
  return { skip: showEnd, finish };
}
