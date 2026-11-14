// Sky map (Dev A) – for computers and phones without motion sensors.
// Drag with the mouse/finger, or use the arrow keys, to look around the REAL sky.
// The centre of the view is the "aim": it is sent to the same onAim() as the phone antenna,
// so signal strength, lock-on and story opening work exactly the same way.
//
// Usage (in main.js):
//   initSkyMap($('skymap'), { getTargets, isFound, onAim });
//   getTargets() → [{ target: 'moon', pos: { az, alt }, label: 'Moon' }, ...]
//   isFound(target) → true when every robot of that target has been found

export function initSkyMap(canvas, { getTargets, isFound, onAim }) {
  const ctx = canvas.getContext('2d');
  const view = { az: 180, alt: 20 }; // start looking South, a bit above the horizon
  const FOV = 90;                    // degrees shown across the canvas width
  let dpr = window.devicePixelRatio || 1;
  let drag = null;
  let lastEmit = 0;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }
  const scale = () => canvas.width / FOV;                 // pixels per degree
  const wrap = d => ((d + 540) % 360) - 180;              // -180..180
  const toScreen = p => ({
    x: canvas.width / 2 + wrap(p.az - view.az) * scale(),
    y: canvas.height / 2 - (p.alt - view.alt) * scale(),
  });

  function emit() {
    if (canvas.offsetParent === null) return; // hidden: the phone antenna is in charge
    onAim({ az: (view.az + 360) % 360, alt: view.alt });
  }

  // ---- mouse / finger ----
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = scale() / dpr; // CSS pixels per degree
    view.az = (view.az - (e.clientX - drag.x) / s + 360) % 360;
    view.alt = Math.max(-30, Math.min(85, view.alt + (e.clientY - drag.y) / s));
    drag = { x: e.clientX, y: e.clientY };
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---- keyboard (accessibility) ----
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', e => {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === 'ArrowLeft') view.az = (view.az - step + 360) % 360;
    else if (e.key === 'ArrowRight') view.az = (view.az + step) % 360;
    else if (e.key === 'ArrowUp') view.alt = Math.min(85, view.alt + step);
    else if (e.key === 'ArrowDown') view.alt = Math.max(-30, view.alt - step);
    else return;
    e.preventDefault();
  });

  // ---- drawing ----
  const CARDINALS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];

  function draw(t) {
    if (canvas.clientWidth && Math.round(canvas.clientWidth * dpr) !== canvas.width) resize();
    const W = canvas.width, H = canvas.height;
    const hy = toScreen({ az: view.az, alt: 0 }).y; // horizon height on screen

    // sky and ground
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05070d');
    g.addColorStop(1, '#0d1424');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, hy, W, Math.max(0, H - hy));
    ctx.strokeStyle = '#8a94a8';
    ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();

    // cardinal points
    ctx.font = `${12 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a94a8';
    for (const [label, az] of CARDINALS) {
      const p = toScreen({ az, alt: 0 });
      if (p.x > -30 && p.x < W + 30) ctx.fillText(label, p.x, hy + 16 * dpr);
    }

    // targets
    for (const tg of getTargets()) {
      const p = toScreen(tg.pos);
      if (p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) continue;
      const found = isFound(tg.target);
      if (tg.target === 'moon') {               // the Moon is visible in the real sky: always drawn
        ctx.fillStyle = '#c9d3e6';
        ctx.beginPath(); ctx.arc(p.x, p.y, 9 * dpr, 0, Math.PI * 2); ctx.fill();
      } else if (found) {
        ctx.fillStyle = '#5dffb0';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 * dpr, 0, Math.PI * 2); ctx.fill();
      } else {                                   // unknown signal: a soft pulsing ring
        const r = (7 + 3 * Math.sin(t / 350)) * dpr;
        ctx.strokeStyle = 'rgba(93, 255, 176, 0.6)';
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      }
      if (found || tg.target === 'moon') {
        ctx.fillStyle = '#e8ecf4';
        ctx.fillText(tg.label, p.x, p.y - 14 * dpr);
      }
    }

    // reticle in the centre = where we aim
    ctx.strokeStyle = '#5dffb0';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 16 * dpr, 0, Math.PI * 2); ctx.stroke();

    // send the aim ~10 times per second (needed for the "hold still" lock-on)
    if (t - lastEmit > 100) { lastEmit = t; emit(); }
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);

  return {
    lookAt(az, alt) { view.az = az; view.alt = alt; },
  };
}
