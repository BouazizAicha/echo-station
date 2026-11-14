// "Catch the last signal" (Pioneer 10) — Dev B.
// You steer a giant radio dish of NASA's Deep Space Network and keep it on Pioneer 10's signal while
// the years go by: 1972 → 2003. Each year the spacecraft is farther away and its signal fainter.
// Real milestones: Jupiter flyby (December 1973), crossing Neptune's orbit (1983), end of the
// official mission (1997), last faint signal (January 23, 2003).
// Blind-friendly: the signal is a tone, louder when the dish is on it, coming from its side
// (stereo), higher when it is above. Deaf-friendly: spectrum, meters and written captions.
import {
  TAU, clamp, setupCanvas, setupControls, tone, hum, vibrate, announcer,
  gameLoop, showResult, makeHandle, bar, panel, seeded, reducedMotion,
  goalBanner,
} from './kit.js';
import { getAudioContext } from '../radio.js';

const W = 360, H = 480, VIEW_H = 330, DURATION = 52;
const START_YEAR = 1972, END_YEAR = 2003;
const MILESTONES = [
  { year: 1973.9, text: 'December 1973: Pioneer 10 flies past Jupiter. First close-up pictures!' },
  { year: 1983.4, text: '1983: Pioneer 10 crosses Neptune\'s orbit, leaving the planets behind.' },
  { year: 1997.2, text: '1997: the official mission ends, but scientists keep listening.' },
  { year: 2002.9, text: 'The signal is almost gone… listen very carefully.' },
];

export function start(robot, ui) {
  const mg = robot.minigame || {};
  return makeHandle(robot, ui, () => run(mg, ui));
}

// A soft sine "carrier" whose volume, pitch and side follow the alignment
function carrier() {
  const ctx = getAudioContext();
  if (!ctx) return { set() {}, stop() {} };
  const o = ctx.createOscillator(), g = ctx.createGain();
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  o.type = 'sine'; o.frequency.value = 520; g.gain.value = 0;
  o.connect(g);
  if (p) { g.connect(p); p.connect(ctx.destination); } else g.connect(ctx.destination);
  o.start();
  return {
    set({ vol, freq, pan }) {
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(vol, t, 0.08);
      o.frequency.setTargetAtTime(freq, t, 0.08);
      if (p) p.pan.setTargetAtTime(clamp(pan, -1, 1), t, 0.08);
    },
    stop() { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); o.stop(ctx.currentTime + 0.3); } catch (e) { /* done */ } },
  };
}

function run(mg, ui) {
  const ctx = setupCanvas(ui.canvas, W, H);
  const say = announcer(ui);
  const controls = setupControls(ui, {
    left: { label: '◀', aria: 'Turn the dish left' },
    up: { label: '▲', aria: 'Turn the dish up' },
    down: { label: '▼', aria: 'Turn the dish down' },
    right: { label: '▶', aria: 'Turn the dish right' },
  }, { hint: 'Hold the arrows to keep the dish (the circle) on the faint signal. Keyboard: arrows.' });
  const keys = controls.keys;
  const tone1 = carrier();
  const static1 = hum({ freq: 2500, type: 'bandpass' });

  const rnd = seeded(5);
  const stars = Array.from({ length: 70 }, () => ({ x: rnd() * W, y: rnd() * VIEW_H, a: 0.2 + rnd() * 0.6 }));
  const dish = { x: W / 2, y: VIEW_H / 2 };
  let t = 0, state = 'play', data = 0, maxData = 0, next = 0, lostFor = 0, hintAt = 0;
  const spectrum = new Float32Array(120);
  let sig = { x: W / 2 + 40, y: VIEW_H / 2 - 30 };


  function update(dt) {
    t += dt;
    const p = t / DURATION;
    const year = START_YEAR + p * (END_YEAR - START_YEAR + 0.06);
    const strength = Math.max(0.06, Math.pow(1 - p, 1.4));              // fainter every year
    const radius = 34 - 18 * p;                                          // smaller target
    const wander = 30 + 70 * p;
    sig = {
      x: W / 2 + Math.sin(t * 0.37) * wander + Math.sin(t * 0.91) * wander * 0.35,
      y: VIEW_H / 2 + Math.cos(t * 0.29) * wander * 0.6 + Math.sin(t * 0.73) * wander * 0.25,
    };
    dish.x = clamp(dish.x + ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * 95 * dt, 20, W - 20);
    dish.y = clamp(dish.y + ((keys.down ? 1 : 0) - (keys.up ? 1 : 0)) * 95 * dt, 20, VIEW_H - 20);

    const dx = sig.x - dish.x, dy = sig.y - dish.y;
    const dist = Math.hypot(dx, dy);
    const align = clamp(1 - dist / (radius * 3), 0, 1);
    const locked = dist < radius;
    maxData += dt;
    if (locked) { data += dt; lostFor = 0; } else lostFor += dt;

    tone1.set({ vol: 0.12 * align * (0.35 + 0.65 * strength), freq: 480 + (-dy / VIEW_H) * 300 + align * 80, pan: dx / 120 });
    static1.set({ vol: 0.02 + 0.05 * (1 - align) + 0.04 * p });

    // spectrum: noise everywhere, a peak in the middle when the dish is on the signal
    for (let i = 0; i < spectrum.length; i++) {
      const centre = Math.exp(-((i - 60) ** 2) / 18);
      spectrum[i] = (reducedMotion() ? 0.3 : Math.random()) * (0.25 + 0.3 * p) + centre * align * strength * 2.2;
    }

    if (next < MILESTONES.length && year >= MILESTONES[next].year) {
      say.say(MILESTONES[next].text, { force: true });
      tone(740, 0.2, { type: 'triangle', vol: 0.07 });
      next++;
    }
    if (lostFor > 3 && t - hintAt > 4) {
      hintAt = t;
      say.say(`Signal ${Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'to your right' : 'to your left') : (dy > 0 ? 'below you' : 'above you')}.`, { force: true });
    }
    if (locked && Math.floor(data) !== Math.floor(data - dt)) vibrate(15);

    if (t >= DURATION) {
      state = 'done';
      tone1.set({ vol: 0, freq: 300, pan: 0 });
      const share = data / maxData;
      const stars = share >= 0.7 ? 3 : share >= 0.4 ? 2 : 1;
      showResult(ui, {
        won: true, stars, title: 'January 23, 2003: last signal received',
        text: (mg.success || 'You listened like the Deep Space Network! Pioneer 10\'s last faint signal reached Earth on January 23, 2003, from about 12 billion kilometers away. After that, its power was too weak to be heard. It still travels on, carrying its plaque.')
          + ` You caught ${Math.round(share * 100)}% of its data.`,
      });
      say.clear();
    }
    return { year, strength, radius, locked, align };
  }

  let view = { year: START_YEAR, strength: 1, radius: 34, locked: false, align: 0 };
  function draw() {
    // the dish's view of the sky
    ctx.fillStyle = '#05041a'; ctx.fillRect(0, 0, W, VIEW_H);
    for (const s of stars) { ctx.globalAlpha = s.a; ctx.fillStyle = '#c9d3e6'; ctx.fillRect(s.x, s.y, 1.2, 1.2); }
    ctx.globalAlpha = 1;
    // noise speckles, more as the years pass
    const noise = 40 + Math.round((view.year - START_YEAR) * 6);
    for (let i = 0; i < noise; i++) {
      ctx.fillStyle = `rgba(93,228,255,${0.05 + Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * W, Math.random() * VIEW_H, 2, 2);
    }
    // Pioneer's signal: a faint violet glow
    const glowR = 10 + 10 * view.strength;
    const sg = ctx.createRadialGradient(sig.x, sig.y, 0, sig.x, sig.y, glowR);
    sg.addColorStop(0, `rgba(180,155,255,${0.25 + 0.75 * view.strength})`); sg.addColorStop(1, 'rgba(180,155,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sig.x, sig.y, glowR, 0, TAU); ctx.fill();
    // the dish's aim
    ctx.strokeStyle = view.locked ? '#5de4ff' : 'rgba(238,240,255,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(dish.x, dish.y, view.radius, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dish.x - view.radius - 8, dish.y); ctx.lineTo(dish.x - view.radius + 4, dish.y);
    ctx.moveTo(dish.x + view.radius - 4, dish.y); ctx.lineTo(dish.x + view.radius + 8, dish.y);
    ctx.moveTo(dish.x, dish.y - view.radius - 8); ctx.lineTo(dish.x, dish.y - view.radius + 4);
    ctx.moveTo(dish.x, dish.y + view.radius - 4); ctx.lineTo(dish.x, dish.y + view.radius + 8); ctx.stroke();
    if (view.locked) { ctx.fillStyle = '#5de4ff'; ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('LOCKED', dish.x, dish.y + view.radius + 20); }

    // lower panel: spectrum + dish drawing
    ctx.fillStyle = '#0b0a1f'; ctx.fillRect(0, VIEW_H, W, H - VIEW_H);
    ctx.strokeStyle = '#2c2860'; ctx.beginPath(); ctx.moveTo(0, VIEW_H); ctx.lineTo(W, VIEW_H); ctx.stroke();
    ctx.fillStyle = '#9a9cc4'; ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillText('SPECTRUM · 2.29 GHz', 12, VIEW_H + 16);
    ctx.strokeStyle = '#b49bff'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < spectrum.length; i++) {
      const x = 12 + (i / (spectrum.length - 1)) * 220;
      const y = VIEW_H + 110 - spectrum[i] * 38;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    // a little DSN dish
    const bx = 300, by = VIEW_H + 100;
    ctx.strokeStyle = '#c9d3e6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx - 10, by + 22); ctx.lineTo(bx, by); ctx.lineTo(bx + 10, by + 22); ctx.stroke();
    ctx.fillStyle = '#2a2660';
    ctx.beginPath(); ctx.ellipse(bx, by - 8, 34, 14, -0.5, Math.PI * 0.05, Math.PI * 1.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9a9cc4'; ctx.textAlign = 'center'; ctx.fillText('DSN 70 m', bx, VIEW_H + 140);

    bar(ctx, 12, 12, 120, 14, view.strength, '#b49bff', 'SIGNAL');
    bar(ctx, 12, 30, 120, 14, maxData ? data / maxData : 0, '#5de4ff', `DATA ${Math.round(maxData ? data / maxData * 100 : 0)}%`);
    panel(ctx, 276, 12, 72, 32);
    ctx.fillStyle = '#eef0ff'; ctx.font = '700 16px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.min(END_YEAR, Math.floor(view.year))), 312, 34);
    // the goal, in words, and a small arrow from the circle toward the glow
    goalBanner(ctx, W, 52, view.locked ? 'Great! Stay on the glow' : 'Move the circle onto the purple glow', view.locked ? '#5de4ff' : '#eef0ff');
    if (!view.locked) {
      const a = Math.atan2(sig.y - dish.y, sig.x - dish.x);
      const r = view.radius + 14;
      ctx.save(); ctx.translate(dish.x + Math.cos(a) * r, dish.y + Math.sin(a) * r); ctx.rotate(a);
      ctx.fillStyle = 'rgba(180,155,255,.9)';
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -7); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ui.hud.textContent = `Year ${Math.min(END_YEAR, Math.floor(view.year))} · Signal ${Math.round(view.strength * 100)}% · ${view.locked ? 'LOCKED' : 'searching'} · Data ${Math.round(maxData ? data / maxData * 100 : 0)}%`;
  }

  const stopLoop = gameLoop(dt => { if (state === 'play') view = update(dt) || view; draw(); });
  return () => { stopLoop(); tone1.stop(); static1.stop(); controls.dispose(); say.clear(); };
}
