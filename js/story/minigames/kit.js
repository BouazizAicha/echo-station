// Shared toolkit for the mini-games (Dev B).
// Canvas, controls (touch + keyboard), sound with left/right panning, vibration, announcements
// for screen readers, star results. Every game is playable without seeing the screen (sound +
// announcements) and without hearing it (everything is also shown and written).
import { getAudioContext, isMuted } from '../radio.js';
import { settings } from '../settings.js';
import { speak } from '../speak.js';

export const TAU = Math.PI * 2;
export const reducedMotion = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('a11y-calm'));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- canvas ---------- */
export function setupCanvas(canvas, W, H) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/* ---------- controls ---------- */
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'up',
};

/**
 * layout: { left: {label, aria}, up: {...}, down: {...}, right: {...} } — missing keys are hidden.
 * mode 'hold' (default) or 'tap' (each press calls onTap(key)).
 */
export function setupControls(ui, layout, { onTap, wide = false, hint } = {}) {
  const keys = { up: false, down: false, left: false, right: false };
  const cleanups = [];
  ui.controls.classList.toggle('wide', wide);
  const hintEl = ui.controls.nextElementSibling;
  if (hintEl && hintEl.classList.contains('hint')) {
    hintEl.dataset.original ??= hintEl.textContent;
    hintEl.textContent = hint || hintEl.dataset.original;
  }
  for (const btn of ui.controls.querySelectorAll('[data-key]')) {
    const k = btn.dataset.key;
    const conf = layout[k];
    btn.dataset.originalLabel ??= btn.textContent;
    btn.dataset.originalAria ??= btn.getAttribute('aria-label') || '';
    btn.hidden = !conf;
    btn.classList.remove('on');
    if (!conf) continue;
    btn.textContent = conf.label;
    btn.setAttribute('aria-label', conf.aria || conf.label);
    if (onTap) {
      const tap = e => { e.preventDefault(); onTap(k, btn); };
      btn.addEventListener('click', tap);
      cleanups.push(() => btn.removeEventListener('click', tap));
    } else {
      const on = e => { e.preventDefault(); keys[k] = true; btn.classList.add('on'); };
      const off = () => { keys[k] = false; btn.classList.remove('on'); };
      for (const ev of ['pointerdown']) btn.addEventListener(ev, on);
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, off);
      btn.addEventListener('contextmenu', e => e.preventDefault());
      cleanups.push(() => {
        btn.removeEventListener('pointerdown', on);
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.removeEventListener(ev, off);
      });
    }
  }
  const kd = e => {
    const k = KEYMAP[e.code];
    if (!k || !layout[k] || e.target.closest?.('#mg-result')) return;
    e.preventDefault();
    if (onTap) { if (!e.repeat) onTap(k, ui.controls.querySelector(`[data-key="${k}"]`)); }
    else keys[k] = true;
  };
  const ku = e => { const k = KEYMAP[e.code]; if (k && !onTap) keys[k] = false; };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  cleanups.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

  return {
    keys,
    dispose() {
      cleanups.forEach(f => f());
      ui.controls.classList.remove('wide');
      for (const btn of ui.controls.querySelectorAll('[data-key]')) {
        btn.hidden = false;
        btn.classList.remove('on');
        if (btn.dataset.originalLabel) btn.textContent = btn.dataset.originalLabel;
        if (btn.dataset.originalAria) btn.setAttribute('aria-label', btn.dataset.originalAria);
      }
      if (hintEl?.dataset.original) hintEl.textContent = hintEl.dataset.original;
    },
  };
}

/* ---------- sound ---------- */
function ctxOrNull() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended' && !isMuted()) ctx.resume();
  return ctx;
}

function out(ctx, pan = 0) {
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(ctx.destination);
    return p;
  }
  return ctx.destination;
}

export function tone(freq, dur = 0.15, { type = 'sine', vol = 0.12, pan = 0, endFreq = null, delay = 0 } = {}) {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out(ctx, pan));
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuffer = null;
function noise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

export function burst(dur = 0.3, { vol = 0.15, freq = 800, pan = 0 } = {}) {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noise(ctx);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out(ctx, pan));
  s.start(t); s.stop(t + dur + 0.05);
}

// A continuous filtered noise (engine, wind) whose volume, pitch and side can change
export function hum({ freq = 300, type = 'lowpass' } = {}) {
  const ctx = ctxOrNull();
  if (!ctx) return { set() {}, stop() {} };
  const s = ctx.createBufferSource(); s.buffer = noise(ctx); s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = 0;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  s.connect(f).connect(g);
  if (p) { g.connect(p); p.connect(ctx.destination); } else g.connect(ctx.destination);
  s.start();
  return {
    set({ vol, freq: fr, pan } = {}) {
      const t = ctx.currentTime;
      if (vol != null) g.gain.setTargetAtTime(vol, t, 0.05);
      if (fr != null) f.frequency.setTargetAtTime(fr, t, 0.05);
      if (pan != null && p) p.pan.setTargetAtTime(clamp(pan, -1, 1), t, 0.05);
    },
    stop() { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); s.stop(ctx.currentTime + 0.3); } catch (e) { /* done */ } },
  };
}

export function vibrate(pattern) {
  if (!settings.vibration) return;
  try { navigator.vibrate?.(pattern); } catch (e) { /* not supported (iPhone) */ }
}

/* ---------- words for screen readers (and a visible caption) ---------- */
export function announcer(ui) {
  let live = document.getElementById('mg-live');
  if (!live) {
    live = document.createElement('p');
    live.id = 'mg-live';
    live.className = 'mg-caption';
    live.setAttribute('aria-live', 'polite');
    ui.hud.after(live);
  }
  live.textContent = '';
  let last = 0, timer = 0;
  return {
    say(text, { force = false } = {}) {
      const now = performance.now();
      if (!force && now - last < 1200) return;      // never flood the screen reader
      last = now;
      live.textContent = text;
      speak(text, { minGap: force ? 0 : 1500 });
      clearTimeout(timer);
      timer = setTimeout(() => { if (live.textContent === text) live.textContent = ''; }, 4500);
    },
    clear() { clearTimeout(timer); live.textContent = ''; },
  };
}

/* ---------- "How to play" card (shown before the game, and with the ? button) ---------- */
let paused = false;
export const isPaused = () => paused;

function stageOf(ui) {
  let stage = ui.canvas.parentElement;
  if (!stage.classList.contains('mg-stage')) {
    stage = document.createElement('div');
    stage.className = 'mg-stage';
    ui.canvas.replaceWith(stage);
    stage.appendChild(ui.canvas);
  }
  return stage;
}

/**
 * how = { goal, steps: [{ icon, text }], warn, startLabel }
 * Resolves when the player presses Start. The game is paused while the card is open.
 */
export function howTo(ui, how) {
  document.querySelector('dialog.mg-howto')?.remove();
  // A real dialog over the game (same look as the sky screen's "How to play"): never squeezed into the game area
  const card = document.createElement('dialog');
  card.className = 'mg-howto';
  card.setAttribute('aria-label', 'How to play');
  card.innerHTML = `
    <p class="mono mg-howto-eyebrow">HOW TO PLAY</p>
    <h3 class="mg-howto-goal" tabindex="-1"></h3>
    <ol class="mg-howto-steps"></ol>
    <p class="mg-howto-warn"></p>
    <button type="button" class="big mg-howto-start"></button>`;
  card.querySelector('.mg-howto-goal').textContent = how.goal;
  const list = card.querySelector('.mg-howto-steps');
  for (const step of how.steps || []) {
    const li = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'mg-howto-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = step.icon;
    const text = document.createElement('span');
    text.textContent = step.text;
    li.append(icon, text);
    list.appendChild(li);
  }
  const warn = card.querySelector('.mg-howto-warn');
  warn.textContent = how.warn ? `⚠ ${how.warn}` : '';
  warn.hidden = !how.warn;
  const start = card.querySelector('.mg-howto-start');
  start.textContent = how.startLabel || 'Start';
  document.body.appendChild(card);
  if (typeof card.showModal === 'function') card.showModal(); else card.setAttribute('open', '');
  speak(`How to play. ${how.goal} ${(how.steps || []).map(s => s.text).join('. ')}. ${how.warn || ''}`, { interrupt: true });
  paused = true;
  ui.controls.style.visibility = 'hidden';            // one thing at a time: first the rules
  card.querySelector('.mg-howto-goal').focus({ preventScroll: true });
  return new Promise(resolve => {
    const go = () => {
      if (!card.isConnected) return;
      card.close?.(); card.remove();
      paused = false; ui.controls.style.visibility = '';
      resolve();
    };
    start.addEventListener('click', go, { once: true });
    card.addEventListener('cancel', e => { e.preventDefault(); go(); });   // Esc = start / continue
  });
}

// The small "?" button on the game, to read the rules again (pauses the game)
export function helpButton(ui, how) {
  ui.controls.querySelector('.mg-help')?.remove();
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mg-help';
  b.textContent = '?';
  b.setAttribute('aria-label', 'How to play (pauses the game)');
  b.addEventListener('click', () => { howTo(ui, { ...how, startLabel: 'Continue' }); });
  ui.controls.appendChild(b);
  return () => b.remove();
}

export function closeHowTo(ui) {
  const card = document.querySelector('dialog.mg-howto');
  if (card) { card.close?.(); card.remove(); }
  ui.controls.style.visibility = '';
  paused = false;
}

/* ---------- loop and results ---------- */
export function gameLoop(update) {
  let raf = 0, last = performance.now(), running = true;
  const step = now => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) update(dt, now / 1000);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { running = false; cancelAnimationFrame(raf); };
}

export function starText(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export function showResult(ui, { won, title, text, stars = 0 }) {
  ui.resultTitle.textContent = won ? `${title}  ${starText(stars)}` : title;
  ui.resultTitle.setAttribute('aria-label', won ? `${title}. ${stars} star${stars === 1 ? '' : 's'} out of 3.` : title);
  ui.resultText.textContent = text;
  ui.retryButton.hidden = false;
  ui.retryButton.textContent = won ? 'Play again' : 'Try again';
  ui.result.hidden = false;
  ui.result.dataset.won = won ? 'true' : 'false';
  speak(`${won ? `${title}. ${stars} star${stars === 1 ? '' : 's'}.` : title} ${text}`, { interrupt: true });
  if (won) {
    tone(523, 0.18, { type: 'triangle' }); tone(659, 0.18, { type: 'triangle', delay: 0.12 });
    tone(784, 0.18, { type: 'triangle', delay: 0.24 }); tone(1047, 0.35, { type: 'triangle', delay: 0.36 });
    vibrate([60, 60, 120]);
  } else {
    tone(300, 0.4, { type: 'sine', endFreq: 160 });
    vibrate(250);
  }
  ui.resultTitle.tabIndex = -1;
  ui.resultTitle.focus({ preventScroll: false });
}

// Standard "start" for a game module: wires retry, returns a handle main.js can stop
export function makeHandle(robot, ui, run) {
  let stopCurrent = null;
  const begin = () => {
    stopCurrent?.();
    ui.result.hidden = true;
    stopCurrent = run();
  };
  ui.retryButton.onclick = begin;
  begin();
  return { stop: () => { stopCurrent?.(); stopCurrent = null; } };
}

/* ---------- drawing helpers ---------- */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function starfield(ctx, W, H, n = 80, seed = 3, alpha = 1) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.3 + r() * 0.7);
    ctx.fillStyle = '#dce8ff';
    ctx.fillRect(r() * W, r() * H, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

// The goal, always visible at the top of the game, in plain words
export function goalBanner(ctx, W, y, text, color = '#e8ecf4') {
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  const w = Math.min(W - 16, ctx.measureText(text).width + 24);
  ctx.fillStyle = 'rgba(5,7,13,.82)';
  ctx.beginPath(); ctx.roundRect((W - w) / 2, y, w, 26, 13); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, y + 17.5, W - 30);
}

// A big orange warning next to something (e.g. "TOO FAST!")
export function warning(ctx, x, y, text) {
  ctx.font = '800 14px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(5,7,13,.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffb347';
  ctx.fillText(text, x, y);
}

// An arrow on the edge of the game pointing to something off screen
export function edgeArrow(ctx, x, y, angle, color = '#ffb347') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function panel(ctx, x, y, w, h, r = 8) {
  ctx.fillStyle = 'rgba(5,7,13,.72)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

export function bar(ctx, x, y, w, h, value, color, label) {
  panel(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * clamp(value, 0, 1)), h, h / 2); ctx.fill();
  if (label) {
    ctx.fillStyle = '#e8ecf4'; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillText(label, x + 6, y + h - 3);
  }
}
