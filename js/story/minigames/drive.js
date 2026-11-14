// "Drive" mini-game template (Dev B) – first used for Spirit.
// The rover has a stuck wheel: driving forward is slow, drains the battery and pulls to one side.
// Driving in reverse (what Spirit really did) works much better, and the dragged wheel digs a groove
// that reveals what is hidden under the dust (for Spirit: white silica).
//
// settings (all optional):
//   stuck_wheel: "front_right" | "front_left" | null
//   reverse: true          → reverse is the efficient way to drive
//   reveal_label: "silica" → what the groove uncovers
//   reveal_color: "#f4f1e8"
//   reveal_goal: 20        → patches to uncover to win
//   zone_label: "Home Plate"
//
// ui = { canvas, hud, result, resultTitle, resultText, retryButton, controls, onWin(), onExit() }

import { goalBanner, bar } from './kit.js';

const W = 360, H = 480;   // world size in "game pixels"

export function start(robot, ui) {
  const mg = robot.minigame || {};
  const S = Object.assign({
    stuck_wheel: 'front_right', reverse: true, reveal_label: 'silica',
    reveal_color: '#f4f1e8', reveal_goal: 18, zone_label: 'Home Plate',
  }, mg.settings || {});

  const canvas = ui.canvas;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;

  // ---- layers ----
  const layer = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const ground = layer(), tracks = layer(), reveal = layer();
  drawGround(ground.getContext('2d'));

  // hidden patches inside the target zone (cells of 10 px)
  const zone = { x: W / 2, y: 115, r: 65 };
  const CELL = 10;
  const hidden = new Set();
  for (let cx = 0; cx < W / CELL; cx++) for (let cy = 0; cy < H / CELL; cy++) {
    const px = cx * CELL + 5, py = cy * CELL + 5;
    const d = Math.hypot(px - zone.x, py - zone.y);
    if (d < zone.r && Math.random() < 0.7) hidden.add(cx + ',' + cy);
  }
  let found = 0;

  // ---- rover ----
  const rover = { x: W / 2, y: 420, a: -Math.PI / 2, v: 0 };  // a = heading (canvas angle), facing up
  let battery = 1;
  let state = 'play';
  const keys = { up: false, down: false, left: false, right: false };

  // ---- input: keyboard ----
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const onKey = down => e => {
    const k = KEYMAP[e.code];
    if (!k || state !== 'play') return;
    keys[k] = down;
    e.preventDefault();
  };
  const kd = onKey(true), ku = onKey(false);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  // ---- input: touch buttons (hold) ----
  const cleanups = [];
  for (const btn of ui.controls.querySelectorAll('[data-key]')) {
    const k = btn.dataset.key;
    const on = e => { e.preventDefault(); keys[k] = true; };
    const off = () => { keys[k] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('pointercancel', off);
    cleanups.push(() => {
      btn.removeEventListener('pointerdown', on); btn.removeEventListener('pointerup', off);
      btn.removeEventListener('pointerleave', off); btn.removeEventListener('pointercancel', off);
    });
  }

  ui.result.hidden = true;
  ui.retryButton.onclick = () => { stop(); handle.stop = start(robot, ui).stop; };

  // ---- physics ----
  const stuck = S.stuck_wheel;
  const side = stuck === 'front_left' ? -1 : 1;   // pull direction when driving forward

  function wheel(fx, sx) {                          // fx: +front/-back, sx: +right/-left (game px)
    const f = [Math.cos(rover.a), Math.sin(rover.a)];
    const r = [-Math.sin(rover.a), Math.cos(rover.a)];
    return [rover.x + f[0] * fx + r[0] * sx, rover.y + f[1] * fx + r[1] * sx];
  }

  function update(dt) {
    const throttle = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    const fwd = throttle > 0;
    const maxSpeed = stuck ? (fwd ? 22 : (S.reverse ? 55 : 30)) : 50;
    const target = throttle * maxSpeed;
    rover.v += (target - rover.v) * Math.min(1, dt * 4);

    const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    rover.a += steer * 1.8 * dt;
    if (stuck && rover.v > 1) rover.a += side * 0.9 * dt;          // forward: the stuck wheel pulls
    if (stuck && rover.v < -1) rover.a += side * 0.06 * dt;        // reverse: only a small pull

    const before = { fr: wheel(10, 9 * side) };
    rover.x = Math.max(12, Math.min(W - 12, rover.x + Math.cos(rover.a) * rover.v * dt));
    rover.y = Math.max(12, Math.min(H - 12, rover.y + Math.sin(rover.a) * rover.v * dt));

    const speed = Math.abs(rover.v);
    if (speed > 0.5) {
      battery -= dt * (speed / 55) * (stuck && rover.v > 0 ? 0.28 : 0.03);
      drawTracks(before.fr);
    }
    if (battery <= 0) { battery = 0; lose(); }
  }

  function drawTracks(prevStuck) {
    const t = tracks.getContext('2d');
    t.lineCap = 'round';
    // normal wheels: thin dark tracks
    t.strokeStyle = 'rgba(60, 25, 10, 0.35)';
    t.lineWidth = 2;
    for (const [fx, sx] of [[10, -9 * side], [0, 9], [0, -9], [-10, 9], [-10, -9]]) {
      const [x, y] = wheel(fx, sx);
      t.beginPath(); t.arc(x, y, 1, 0, Math.PI * 2); t.stroke();
    }
    if (!stuck) return;
    // stuck wheel: a deep groove
    const [x, y] = wheel(10, 9 * side);
    t.strokeStyle = 'rgba(90, 40, 20, 0.6)';
    t.lineWidth = 6;
    t.beginPath(); t.moveTo(prevStuck[0], prevStuck[1]); t.lineTo(x, y); t.stroke();
    // reveal what is under the groove
    const key = Math.floor(x / CELL) + ',' + Math.floor(y / CELL);
    if (hidden.has(key)) {
      hidden.delete(key);
      found += 1;
      const r = reveal.getContext('2d');
      r.fillStyle = S.reveal_color;
      r.beginPath(); r.arc(x, y, 6 + Math.random() * 3, 0, Math.PI * 2); r.fill();
      if (found >= S.reveal_goal) win();
    }
  }

  // ---- drawing ----
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(ground, 0, 0);
    ctx.drawImage(tracks, 0, 0);
    ctx.drawImage(reveal, 0, 0);

    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(S.zone_label, zone.x, zone.y - zone.r - 8);

    // rover body + wheels
    ctx.save();
    ctx.translate(rover.x, rover.y);
    ctx.rotate(rover.a);
    ctx.fillStyle = '#d9dde6';
    ctx.fillRect(-12, -8, 24, 16);                     // body (front = +x)
    ctx.fillStyle = '#5de4ff';
    ctx.fillRect(8, -3, 4, 6);                         // front marker
    for (const [fx, sx] of [[10, 9], [10, -9], [0, 9], [0, -9], [-10, 9], [-10, -9]]) {
      const isStuck = stuck && fx === 10 && sx === 9 * side;
      ctx.fillStyle = isStuck ? '#ff6b4a' : '#1b2436';
      ctx.fillRect(fx - 3, sx - 2, 6, 4);
    }
    ctx.restore();

    const inZone = Math.hypot(rover.x - zone.x, rover.y - zone.y) < zone.r;
    goalBanner(ctx, W, 12, inZone ? `Scrape the ground: ${found}/${S.reveal_goal} bright spots` : `Drive to ${S.zone_label} (dashed circle)`, inZone ? '#5de4ff' : '#eef0ff');
    const dir = rover.v < -1 ? 'REVERSE' : rover.v > 1 ? 'FORWARD' : 'STOPPED';
    bar(ctx, 12, H - 26, 130, 14, battery, battery < 0.25 ? '#ff9bd5' : '#5de4ff', `BATTERY ${Math.round(battery * 100)}%`);
    ctx.fillStyle = 'rgba(11,10,31,.75)'; ctx.beginPath(); ctx.roundRect(W - 98, H - 26, 86, 14, 7); ctx.fill();
    ctx.fillStyle = '#eef0ff'; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(dir, W - 55, H - 15.5);
    ui.hud.textContent = `Battery ${Math.round(battery * 100)}%  ·  ${S.reveal_label} found ${found}/${S.reveal_goal}  ·  ${dir}`;
  }

  // ---- end states ----
  function win() {
    if (state !== 'play') return;
    state = 'won';
    ui.resultTitle.textContent = `You found ${S.reveal_label}!`;
    ui.resultText.textContent = mg.success || '';
    ui.retryButton.hidden = true;
    ui.result.hidden = false;
    if (ui.onWin) ui.onWin();
  }
  function lose() {
    if (state !== 'play') return;
    state = 'lost';
    ui.resultTitle.textContent = 'Battery empty!';
    ui.resultText.textContent = mg.hint || 'Driving forward with a stuck wheel uses a lot of power. Try something else…';
    ui.retryButton.hidden = false;
    ui.result.hidden = false;
  }

  // ---- loop ----
  let last = performance.now(), raf = 0, running = true;
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    cleanups.forEach(f => f());
  }
  const handle = { stop, peek: () => ({ x: rover.x, y: rover.y, a: rover.a, found, battery, state }) };
  return handle;
}

function drawGround(g) {
  g.fillStyle = '#9c4a26';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {                       // dust and pebbles
    const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 2.2;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(70, 30, 15, 0.35)' : 'rgba(210, 120, 70, 0.25)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 14; i++) {                        // rocks
    const x = Math.random() * W, y = 200 + Math.random() * (H - 260), r = 4 + Math.random() * 7;
    g.fillStyle = 'rgba(60, 28, 14, 0.7)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}
