// "Discovery" moments for Story mode (Dev B): one tiny hands-on interaction per robot.
//   spirit         drag the stuck wheel backward → a white silica stripe appears
//   ingenuity      hold to spin the blades to ~2,400 rpm → lift-off
//   opportunity    tap the 5 "blueberries" in the rock
//   apollo11-eagle tap to make footprints → the seismometer feels each step
//   dawn           tap the bright salt spots in Occator Crater
//   pioneer10      rub the plate to reveal the plaque → the signal fades
// Every interaction works with touch, mouse AND keyboard (real <button>s), and never flashes.
// mountDiscovery(container, robot, { onDone }) → cleanup()

const TAU = Math.PI * 2;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// A canvas drawn in "logical" pixels (W×H), sharp on retina screens, scaled by CSS
function stage(container, W, H, label) {
  const wrap = el('div', 'disc-stage');
  wrap.style.aspectRatio = `${W} / ${H}`;
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wrap.appendChild(canvas);
  container.appendChild(wrap);
  const toLocal = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  };
  return { wrap, canvas, ctx, toLocal };
}

function status(container, text) {
  const p = el('p', 'disc-status mono', text);
  p.setAttribute('aria-live', 'polite');
  container.appendChild(p);
  return p;
}

function loop(fn) {
  let raf = 0, last = performance.now(), alive = true;
  const step = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fn(dt, now / 1000);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { alive = false; cancelAnimationFrame(raf); };
}

// Press-and-hold that works with touch, mouse and keyboard (Space / Enter)
function holdButton(button, onChange) {
  const on = e => { e.preventDefault(); onChange(true); button.classList.add('held'); };
  const off = () => { onChange(false); button.classList.remove('held'); };
  button.addEventListener('pointerdown', on);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) button.addEventListener(ev, off);
  button.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) on(e); });
  button.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') off(); });
  button.addEventListener('contextmenu', e => e.preventDefault());
}

function speckles(ctx, W, H, color, n, seed = 1) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.4;
    ctx.beginPath(); ctx.arc(r() * W, r() * H, 0.6 + r() * 2.2, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Spirit: drag the stuck wheel backward                               */
/* ------------------------------------------------------------------ */

function spirit(container, robot, done) {
  const W = 340, H = 170;
  const { canvas, ctx, toLocal } = stage(container, W, H, 'Spirit\'s stuck wheel on red Martian soil');
  const msg = status(container, 'Drag the wheel to the left, or hold the button.');
  const button = el('button', 'disc-hold', '◀ Drive backward');
  button.type = 'button';
  container.appendChild(button);

  const START = 292, END = 48, Y = 104;
  let x = START, best = START, dragging = false, holding = false, finished = false, angle = 0;
  const soil = document.createElement('canvas');
  soil.width = W; soil.height = H;
  const s = soil.getContext('2d');
  const g = s.createLinearGradient(0, 70, 0, H);
  g.addColorStop(0, '#b9583a'); g.addColorStop(1, '#6e2a1a');
  s.fillStyle = '#2b1838'; s.fillRect(0, 0, W, 70);
  s.fillStyle = g; s.fillRect(0, 70, W, H - 70);
  speckles(s, W, H, '#3a160f', 160, 3);
  speckles(s, W, H, '#ffb08a', 60, 9);

  function draw(t) {
    ctx.drawImage(soil, 0, 0);
    // the silica groove: everywhere the dragged wheel has been
    const grad = ctx.createLinearGradient(best, 0, START, 0);
    grad.addColorStop(0, 'rgba(244,241,232,.95)'); grad.addColorStop(1, 'rgba(244,241,232,.75)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(best, Y + 14, START - best + 10, 14, 7); ctx.fill();
    if (finished) {
      for (let i = 0; i < 9; i++) {
        const sx = END + (i / 8) * (START - END);
        const a = reducedMotion() ? 0.7 : 0.4 + 0.4 * Math.sin(t * 2 + i);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(sx, Y + 21, 2, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#0b0a1f'; ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText('SILICA', (END + START) / 2 - 20, Y + 25);
    }
    // a piece of the rover above the wheel
    ctx.strokeStyle = '#c9d3e6'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, Y); ctx.lineTo(x + 34, Y - 40); ctx.lineTo(x + 120, Y - 40); ctx.stroke();
    ctx.fillStyle = '#1d2a5a'; ctx.strokeStyle = '#5de4ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x + 30, Y - 54, 110, 10, 3); ctx.fill(); ctx.stroke();
    // the stuck wheel (it does not turn: it is dragged!)
    ctx.save();
    ctx.translate(x, Y);
    ctx.rotate(angle);
    ctx.fillStyle = '#2a2660'; ctx.strokeStyle = '#c9d3e6'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * TAU / 6) * 18, Math.sin(i * TAU / 6) * 18); ctx.stroke(); }
    ctx.restore();
    if (!finished && !dragging && !holding) {
      ctx.fillStyle = 'rgba(93,228,255,.9)'; ctx.font = '700 22px Inter, sans-serif';
      const bounce = reducedMotion() ? 0 : Math.sin(t * 4) * 4;
      ctx.fillText('◀', x - 52 + bounce, Y + 8);
    }
  }

  function moveTo(nx) {
    if (finished) return;
    x = Math.max(END, Math.min(START, nx));
    if (x < best) best = x;
    angle = (x - START) * 0.002;             // only wobbles: the wheel is stuck
    const p = (START - best) / (START - END);
    msg.textContent = p < 0.3 ? 'Keep going… the wheel scrapes the dust.' : p < 0.8 ? 'Something bright is appearing!' : 'Almost there…';
    if (best <= END + 2) {
      finished = true;
      msg.textContent = 'You uncovered bright white soil: silica!';
      button.disabled = true;
      done();
    }
  }

  canvas.addEventListener('pointerdown', e => { dragging = true; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (dragging) moveTo(toLocal(e).x); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.style.touchAction = 'none';
  holdButton(button, v => { holding = v; });

  const stop = loop((dt, t) => {
    if (holding) moveTo(x - 90 * dt);
    draw(t);
  });
  return stop;
}

/* ------------------------------------------------------------------ */
/* Ingenuity: hold to spin the blades                                  */
/* ------------------------------------------------------------------ */

function ingenuity(container, robot, done) {
  const W = 340, H = 200, GOAL = 2400;
  const { ctx } = stage(container, W, H, 'Ingenuity on the ground of Mars, blades ready to spin');
  const msg = status(container, '0 rpm');
  const button = el('button', 'disc-hold', 'Hold to spin');
  button.type = 'button';
  container.appendChild(button);

  let rpm = 0, holding = false, angle = 0, lift = 0, finished = false;
  holdButton(button, v => { holding = v; });

  function draw(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b1838'); g.addColorStop(0.62, '#b0583c'); g.addColorStop(1, '#5a2419');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8a3a26'; ctx.fillRect(0, 160, W, 40);

    // dust kicked up by the blades
    if (rpm > 1200) {
      const k = (rpm - 1200) / 1200;
      for (let i = 0; i < 14; i++) {
        const dx = (i - 7) * 14 + (reducedMotion() ? 0 : Math.sin(t * 3 + i) * 4);
        ctx.fillStyle = `rgba(255,201,168,${0.25 * k})`;
        ctx.beginPath(); ctx.arc(W / 2 + dx, 162 - Math.abs(dx) * 0.15, 6 + k * 6, 0, TAU); ctx.fill();
      }
    }
    const y = 128 - lift * 90;
    // legs and body
    ctx.strokeStyle = '#c9d3e6'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 10, y + 18); ctx.lineTo(W / 2 - 34, y + 36);
    ctx.moveTo(W / 2 + 10, y + 18); ctx.lineTo(W / 2 + 34, y + 36);
    ctx.stroke();
    ctx.fillStyle = '#2a2660';
    ctx.beginPath(); ctx.roundRect(W / 2 - 18, y - 2, 36, 22, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5de4ff'; ctx.beginPath(); ctx.arc(W / 2, y + 9, 3.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W / 2, y - 2); ctx.lineTo(W / 2, y - 34); ctx.stroke();
    ctx.fillStyle = '#1d2a5a'; ctx.strokeStyle = '#5de4ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(W / 2 - 22, y - 40, 44, 6, 2); ctx.fill(); ctx.stroke();
    // two rotors, spinning in opposite directions. Fast = a soft disc (no flicker)
    for (const [dy, dir] of [[-26, 1], [-16, -1]]) {
      const blur = Math.min(1, rpm / 700);
      if (blur > 0.05) {
        ctx.fillStyle = `rgba(201,211,230,${0.18 * blur})`;
        ctx.beginPath(); ctx.ellipse(W / 2, y + dy, 70, 6, 0, 0, TAU); ctx.fill();
      }
      if (blur < 0.95) {
        const a = angle * dir;
        ctx.strokeStyle = `rgba(201,211,230,${1 - blur})`; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(W / 2 - Math.cos(a) * 70, y + dy - Math.sin(a) * 4);
        ctx.lineTo(W / 2 + Math.cos(a) * 70, y + dy + Math.sin(a) * 4);
        ctx.stroke();
      }
    }
    // rpm gauge
    const p = Math.min(1, rpm / GOAL);
    ctx.fillStyle = 'rgba(11,10,31,.65)'; ctx.beginPath(); ctx.roundRect(12, 12, 116, 14, 7); ctx.fill();
    ctx.fillStyle = p >= 1 ? '#ff9bd5' : '#5de4ff'; ctx.beginPath(); ctx.roundRect(12, 12, Math.max(14, 116 * p), 14, 7); ctx.fill();
  }

  const stop = loop((dt, t) => {
    if (!finished) {
      rpm += holding ? 950 * dt : -800 * dt;
      rpm = Math.max(0, Math.min(GOAL, rpm));
      msg.textContent = `${Math.round(rpm / 10) * 10} rpm${rpm >= GOAL ? '' : holding ? ' · keep holding…' : ''}`;
      if (rpm >= GOAL) {
        finished = true;
        button.disabled = true;
        button.classList.remove('held');
        msg.textContent = '2,400 rpm · lift-off!';
        done();
      }
    } else {
      lift = Math.min(1, lift + dt * 0.6);
    }
    angle += (rpm / 60) * TAU * dt * 0.02;  // drawn slowly on purpose: the real blades are a blur
    draw(t);
  });
  return stop;
}

/* ------------------------------------------------------------------ */
/* Tap-the-targets engine (Opportunity, Dawn)                          */
/* ------------------------------------------------------------------ */

function tapTargets(container, { W, H, label, background, targets, word, onFound, finalText }, done) {
  const { wrap, ctx } = stage(container, W, H, label);
  const msg = status(container, `0 / ${targets.length} ${word}`);
  let found = 0;
  const stop = loop((dt, t) => background(ctx, W, H, t, targets));
  targets.forEach((tg, i) => {
    const b = el('button', 'disc-target');
    b.type = 'button';
    b.style.left = `${(tg.x / W) * 100}%`;
    b.style.top = `${(tg.y / H) * 100}%`;
    b.setAttribute('aria-label', `${tg.name || word} ${i + 1}`);
    b.addEventListener('click', () => {
      if (tg.found) return;
      tg.found = true;
      b.classList.add('found');
      b.setAttribute('aria-pressed', 'true');
      found++;
      if (onFound) onFound(tg, found);
      msg.textContent = found < targets.length ? `${found} / ${targets.length} ${word}` : finalText;
      if (found === targets.length) done();
    });
    wrap.appendChild(b);
  });
  return stop;
}

function opportunity(container, robot, done) {
  const berries = [
    { x: 64, y: 120 }, { x: 132, y: 78 }, { x: 196, y: 140 }, { x: 250, y: 92 }, { x: 300, y: 148 },
  ].map(b => ({ ...b, name: 'Blueberry' }));
  return tapTargets(container, {
    W: 340, H: 190, label: 'A layered Martian rock with small round pebbles', word: 'blueberries', targets: berries,
    finalText: '5 / 5 blueberries!',
    background(ctx, W, H, t, targets) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#d79a6a'); g.addColorStop(1, '#8a4a2c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // rock layers
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = `rgba(80,35,20,${0.18 + (i % 2) * 0.1})`; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 10) {
          const y = 20 + i * 26 + Math.sin(x / 40 + i) * 3;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      speckles(ctx, W, H, '#5a2a18', 120, 5);
      // look-alike pebbles (not blueberries!)
      ctx.fillStyle = '#b06a44';
      for (const [x, y, r] of [[30, 50, 5], [96, 40, 4], [170, 30, 6], [220, 170, 5], [280, 40, 4], [320, 100, 5], [110, 160, 6]]) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
      // the blueberries: small blue-grey spheres
      for (const b of targets) {
        const gr = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, 7);
        gr.addColorStop(0, b.found ? '#e9fbff' : '#9fb3d6'); gr.addColorStop(1, b.found ? '#5de4ff' : '#4b5a7c');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(b.x, b.y, 6.5, 0, TAU); ctx.fill();
        if (b.found) {
          ctx.strokeStyle = 'rgba(93,228,255,.8)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, 12 + (reducedMotion() ? 0 : Math.sin(t * 3) * 2), 0, TAU); ctx.stroke();
        }
      }
    },
  }, done);
}

function dawn(container, robot, done) {
  const spots = [
    { x: 170, y: 104, r: 11, name: 'Bright spot (Cerealia Facula)' },
    { x: 214, y: 92, r: 6, name: 'Bright spot (Vinalia Faculae)' },
    { x: 226, y: 112, r: 5, name: 'Bright spot (Vinalia Faculae)' },
  ];
  return tapTargets(container, {
    W: 340, H: 200, label: 'Occator Crater on Ceres, seen from above', word: 'bright spots', targets: spots,
    finalText: 'All 3 found: salt!',
    background(ctx, W, H, t, targets) {
      ctx.fillStyle = '#3d3b40'; ctx.fillRect(0, 0, W, H);
      speckles(ctx, W, H, '#1f1e22', 200, 7);
      speckles(ctx, W, H, '#7c7a80', 80, 11);
      // the crater: a big ring with a shadowed rim
      ctx.fillStyle = '#353338';
      ctx.beginPath(); ctx.ellipse(180, 104, 120, 78, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,158,166,.55)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(180, 104, 120, 78, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.strokeStyle = 'rgba(15,15,18,.6)';
      ctx.beginPath(); ctx.ellipse(180, 104, 120, 78, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
      for (const s of targets) {
        const glowR = s.r * (s.found ? 2.4 : 1.6);
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(240,240,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, glowR, 0, TAU); ctx.fill();
        if (s.found) {
          ctx.fillStyle = '#ff9bd5'; ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.fillText('SALT', s.x - 12, s.y - s.r - 10);
        }
      }
    },
  }, done);
}

/* ------------------------------------------------------------------ */
/* Eagle: footprints and the seismometer                               */
/* ------------------------------------------------------------------ */

function eagle(container, robot, done) {
  const W = 340, H = 210, GOAL = 6, SEIS_Y = 172;
  const { wrap, ctx, toLocal } = stage(container, W, H, 'Grey Moon dust next to the lander, and a seismometer line');
  const msg = status(container, `Steps: 0 / ${GOAL}`);
  const walk = el('button', 'disc-cover');
  walk.type = 'button';
  walk.setAttribute('aria-label', 'Take a step on the Moon');
  wrap.appendChild(walk);

  const prints = [];
  const wave = new Float32Array(170);
  let shake = 0, finished = false;

  walk.addEventListener('click', e => {
    if (finished && prints.length >= GOAL + 6) return;
    let p;
    if (e.detail === 0 || e.clientX === 0) {           // keyboard: walk along a path
      const k = prints.length;
      p = { x: 40 + k * 40, y: 92 + (k % 2 ? 16 : 0) };
    } else {
      p = toLocal(e);
    }
    p.y = Math.min(p.y, SEIS_Y - 30);
    prints.push({ x: p.x, y: p.y, left: prints.length % 2 === 0 });
    shake = 1;
    msg.textContent = prints.length < GOAL ? `Steps: ${prints.length} / ${GOAL} · the seismometer felt it!` : 'Steps: 6 / 6 · the seismometer felt every one!';
    if (!finished && prints.length >= GOAL) { finished = true; done(); }
  });

  function bootprint(x, y, left) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(left ? -0.15 : 0.15);
    ctx.fillStyle = 'rgba(40,42,56,.55)';
    ctx.beginPath(); ctx.roundRect(-7, -15, 14, 30, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(200,205,220,.25)'; ctx.lineWidth = 1;
    for (let i = -10; i <= 10; i += 4) { ctx.beginPath(); ctx.moveTo(-6, i); ctx.lineTo(6, i); ctx.stroke(); }
    ctx.restore();
  }

  const stop = loop((dt, t) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#9aa1b3'); g.addColorStop(1, '#5d6273');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, SEIS_Y - 14);
    speckles(ctx, W, SEIS_Y, '#3b3f4d', 150, 13);
    // the lander's foot pad at the edge
    ctx.fillStyle = '#b8a15a'; ctx.strokeStyle = '#c9d3e6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(300, 0); ctx.lineTo(318, 54); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(318, 60, 18, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // the seismometer (a little box with solar panels)
    ctx.fillStyle = '#1d2a5a'; ctx.strokeStyle = '#5de4ff';
    ctx.beginPath(); ctx.roundRect(254, 112, 30, 8, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9d3e6'; ctx.beginPath(); ctx.roundRect(264, 118, 10, 12, 2); ctx.fill();
    for (const p of prints) bootprint(p.x, p.y, p.left);

    // seismometer trace: scrolls, and jumps at every step
    wave.copyWithin(0, 1);
    shake *= reducedMotion() ? 0.5 : 0.9;
    wave[wave.length - 1] = (Math.random() - 0.5) * 2 + Math.sin(t * 40) * 14 * shake;
    ctx.fillStyle = '#0b0a1f'; ctx.fillRect(0, SEIS_Y - 14, W, H - SEIS_Y + 14);
    ctx.fillStyle = '#9a9cc4'; ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText('SEISMOMETER', 8, SEIS_Y - 2);
    ctx.strokeStyle = '#5de4ff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < wave.length; i++) {
      const x = (i / (wave.length - 1)) * W, y = SEIS_Y + 18 + wave[i];
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  return stop;
}

/* ------------------------------------------------------------------ */
/* Pioneer 10: rub the plate, then the signal fades                    */
/* ------------------------------------------------------------------ */

function drawPlaque(c, W, H) {
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#e9c46a'); g.addColorStop(0.5, '#f4dc94'); g.addColorStop(1, '#c79a3a');
  c.fillStyle = g;
  c.beginPath(); c.roundRect(4, 4, W - 8, H - 8, 10); c.fill();
  c.strokeStyle = '#5a4210'; c.lineWidth = 1.6; c.lineCap = 'round';
  // hydrogen (two little circles joined by a line)
  c.beginPath(); c.arc(30, 30, 7, 0, TAU); c.moveTo(66, 30); c.arc(59, 30, 7, 0, TAU); c.stroke();
  c.beginPath(); c.moveTo(37, 30); c.lineTo(52, 30); c.stroke();
  // pulsar map: lines from one point (where the Sun is)
  const px = 78, py = 92;
  for (let i = 0; i < 14; i++) {
    const a = i * TAU / 14 + 0.2, len = 26 + (i * 37) % 44;
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); c.stroke();
  }
  // two people, waving hello (simplified)
  for (const [x, s] of [[236, 1], [262, 0.92]]) {
    c.beginPath(); c.arc(x, 44 * s + 6, 7 * s, 0, TAU);
    c.moveTo(x, 52 * s + 6); c.lineTo(x, 92 * s + 6);
    c.moveTo(x, 92 * s + 6); c.lineTo(x - 7 * s, 124 * s + 6);
    c.moveTo(x, 92 * s + 6); c.lineTo(x + 7 * s, 124 * s + 6);
    c.moveTo(x, 62 * s + 6); c.lineTo(x - 12 * s, 84 * s + 6);
    c.stroke();
  }
  c.beginPath(); c.moveTo(236, 62); c.lineTo(250, 46); c.stroke();      // the wave
  // the Solar System, and my path leaving the third planet
  const sy = H - 26;
  c.beginPath(); c.arc(30, sy, 7, 0, TAU); c.stroke();
  const sizes = [2, 2.5, 2.6, 2, 5, 4.4, 3.4, 3.4, 1.5];
  sizes.forEach((r, i) => { c.beginPath(); c.arc(52 + i * 26, sy, r, 0, TAU); c.stroke(); });
  c.strokeStyle = '#8a2a10'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(104, sy); c.quadraticCurveTo(170, sy - 4, 190, sy - 22); c.lineTo(300, sy - 34); c.stroke();
  c.beginPath(); c.moveTo(300, sy - 34); c.lineTo(292, sy - 37); c.moveTo(300, sy - 34); c.lineTo(293, sy - 29); c.stroke();
}

function pioneer10(container, robot, done) {
  const W = 340, H = 200;
  const { canvas, ctx, toLocal } = stage(container, W, H, 'A golden plate covered in space dust');
  const msg = status(container, 'Rub the plate with your finger (or press the button).');
  const button = el('button', 'disc-hold', 'Wipe the dust');
  button.type = 'button';
  container.appendChild(button);
  const fade = el('div', 'disc-fade');
  fade.hidden = true;
  fade.innerHTML = '<p class="mono">SIGNAL FROM PIONEER 10</p><div class="disc-fade-bar"><span></span></div><p class="disc-fade-text"></p>';
  container.appendChild(fade);

  const plaque = document.createElement('canvas');
  plaque.width = W; plaque.height = H;
  drawPlaque(plaque.getContext('2d'), W, H);
  const dust = document.createElement('canvas');
  dust.width = W; dust.height = H;
  const d = dust.getContext('2d');
  d.fillStyle = '#3a3550'; d.fillRect(0, 0, W, H);
  speckles(d, W, H, '#6f6a8c', 260, 21);
  let finished = false, rubbing = false, sweep = 0;

  function revealed() {
    const data = d.getImageData(0, 0, W, H).data;
    let clear = 0, n = 0;
    for (let y = 4; y < H; y += 12) for (let x = 4; x < W; x += 12) { n++; if (data[(y * W + x) * 4 + 3] < 40) clear++; }
    return clear / n;
  }
  function rub(x, y, r = 22) {
    d.globalCompositeOperation = 'destination-out';
    d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
    d.globalCompositeOperation = 'source-over';
  }
  let checks = 0;
  function check() {
    if (finished || ++checks % 6) return;
    const p = revealed();
    if (p > 0.15 && p < 0.65) msg.textContent = 'Something is drawn on it…';
    if (p >= 0.65) finish();
  }
  function finish() {
    finished = true;
    d.clearRect(0, 0, W, H);
    button.disabled = true;
    msg.textContent = 'A message from Earth: who sent me, and where we live.';
    fade.hidden = false;
    const bar = fade.querySelector('span');
    const text = fade.querySelector('.disc-fade-text');
    const years = [[1972, 'Launch: loud and clear'], [1983, 'Past Neptune\'s orbit'], [1997, 'Mission ends, still whispering'], [2003, 'Last faint signal: January 23, 2003']];
    let i = 0;
    const next = () => {
      if (i >= years.length) { done(); return; }
      bar.style.width = `${100 - i * 31}%`;
      text.textContent = `${years[i][0]} · ${years[i][1]}`;
      i++;
      setTimeout(next, reducedMotion() ? 0 : 1100);
    };
    next();
  }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => { rubbing = true; canvas.setPointerCapture(e.pointerId); const p = toLocal(e); rub(p.x, p.y); });
  canvas.addEventListener('pointermove', e => { if (!rubbing || finished) return; const p = toLocal(e); rub(p.x, p.y); check(); });
  canvas.addEventListener('pointerup', () => { rubbing = false; check(); });
  button.addEventListener('click', () => {           // keyboard / one-tap: wipe one band at a time
    if (finished) return;
    for (let x = 0; x <= W; x += 14) rub(x, sweep * 40 + 20, 26);
    sweep++;
    if (sweep >= 5) finish(); else msg.textContent = 'Keep wiping…';
  });

  return loop(() => {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(plaque, 0, 0);
    ctx.drawImage(dust, 0, 0);
  });
}

/* ------------------------------------------------------------------ */

const MOMENTS = { spirit, ingenuity, opportunity, dawn, 'apollo11-eagle': eagle, pioneer10 };

export function hasDiscovery(robot) {
  return Boolean(MOMENTS[robot.id]);
}

export function mountDiscovery(container, robot, { onDone } = {}) {
  container.innerHTML = '';
  const moment = MOMENTS[robot.id];
  if (!moment) return () => {};
  let fired = false;
  const done = () => { if (!fired) { fired = true; if (onDone) onDone(); } };
  return moment(container, robot, done) || (() => {});
}
