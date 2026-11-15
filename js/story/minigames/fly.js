// "Scout for Perseverance" (Ingenuity, Mars 2021–2024) — Dev B.
// Fly over Jezero Crater, take photos of 3 places for the rover, and land on the next airfield
// before the battery runs out. Wind gusts push you. Over smooth sand the navigation camera sees no
// features and the helicopter drifts: that is really what led to Ingenuity's last, hard landing
// (flight 72, January 2024).
// Blind-friendly: altitude beeper + beeps panned toward the next goal, spoken status.
// Deaf-friendly: mini-map, gauges and written captions for every sound event.
import {
  TAU, clamp, setupCanvas, setupControls, tone, burst, hum, vibrate, announcer,
  gameLoop, showResult, makeHandle, bar, panel, seeded,
  goalBanner, warning, edgeArrow,
} from './kit.js';

const W = 360, H = 480, WORLD = 1100;
const G = 7, LIFT = 16, PUSH = 22;
const SAFE_DOWN = 18, SAFE_SIDE = 12;
const BATTERY = 75;
const PAD_A = { a: 40, b: 120 };
const PAD_B = { a: 980, b: 1060 };
const SAND = { a: 600, b: 800 };
const SPOTS = [
  { x: 300, name: 'a rocky ridge' },
  { x: 500, name: 'an ancient river delta' },
  { x: 880, name: 'a field of boulders' },
];

function groundY(x) {
  if ((x >= PAD_A.a && x <= PAD_A.b) || (x >= PAD_B.a && x <= PAD_B.b)) return 420;
  if (x >= SAND.a && x <= SAND.b) return 420 + Math.sin(x / 60) * 6;
  return 420 + Math.sin(x / 31) * 9 + Math.sin(x / 11) * 4 - (Math.abs(x - 500) < 80 ? 26 * Math.cos((x - 500) / 80 * Math.PI / 2) : 0);
}

export function start(robot, ui) {
  const mg = robot.minigame || {};
  return makeHandle(robot, ui, () => run(mg, ui));
}

function run(mg, ui) {
  const ctx = setupCanvas(ui.canvas, W, H);
  const say = announcer(ui);
  const controls = setupControls(ui, {
    left: { label: '◀', aria: 'Fly left' },
    up: { label: '▲ Up', aria: 'Climb' },
    down: { label: '▼', aria: 'Go down' },
    right: { label: '▶', aria: 'Fly right' },
  }, { hint: 'Hold ▲ to climb, ◀ ▶ to fly, ▼ to go down. Keyboard: arrows.' });
  const keys = controls.keys;
  const rotor = hum({ freq: 900, type: 'bandpass' });

  const rnd = seeded(8);
  const rocks = Array.from({ length: 70 }, () => {
    let x = rnd() * WORLD;
    while ((x > SAND.a && x < SAND.b) || (x > PAD_A.a && x < PAD_A.b) || (x > PAD_B.a && x < PAD_B.b)) x = rnd() * WORLD;
    return { x, r: 2 + rnd() * 6 };
  });
  const heli = { x: 80, y: 420 - 22, vx: 0, vy: 0, flying: false };
  const photos = new Set();
  let battery = BATTERY, t = 0, state = 'play', beepAt = 0, gust = 0, gustDir = 0, nextGust = 7;
  let hoverAt = null, flash = 0, sandWarned = false, emptyWarned = false;


  const nextGoal = () => {
    const spot = SPOTS.find(s => !photos.has(s.x));
    return spot ? { x: spot.x, label: 'next photo spot' } : { x: (PAD_B.a + PAD_B.b) / 2, label: 'airfield B' };
  };

  function update(dt) {
    t += dt;
    const ground = groundY(heli.x);
    const alt = ground - (heli.y + 22);
    if (!heli.flying && keys.up && battery > 0) {
      heli.flying = true;
      tone(400, 0.6, { endFreq: 1100, vol: 0.08 });
      say.say('Lift-off! 2,400 rpm.', { force: true });
    }
    if (heli.flying) {
      const lift = keys.up && battery > 0 ? LIFT : 0;
      const sink = keys.down ? 8 : 0;
      heli.vy += (G - lift + sink) * dt;
      const side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      heli.vx += side * PUSH * dt;
      // wind gusts
      nextGust -= dt;
      if (nextGust <= 0) {
        gust = 2; gustDir = Math.random() < 0.5 ? -1 : 1; nextGust = 6 + Math.random() * 5;
        burst(1.2, { vol: 0.12, freq: 600, pan: -gustDir });
        say.say(`Gust of wind from the ${gustDir > 0 ? 'left' : 'right'}!`, { force: true });
      }
      if (gust > 0) { gust -= dt; heli.vx += gustDir * 20 * dt; }
      // smooth sand: the navigation camera loses track → drift
      const overSand = heli.x > SAND.a && heli.x < SAND.b && alt < 200;
      if (overSand) {
        heli.vx += Math.sin(t * 2.3) * 22 * dt;
        heli.vy += Math.cos(t * 1.7) * 10 * dt;
        if (!sandWarned) { sandWarned = true; say.say('Smooth sand: my navigation camera cannot see any features. I am drifting!', { force: true }); }
      }
      heli.vx *= 1 - 0.7 * dt;
      heli.vy = clamp(heli.vy, -60, 90);
      heli.x = clamp(heli.x + heli.vx * dt, 12, WORLD - 12);
      heli.y = Math.max(40, heli.y + heli.vy * dt);
      battery = Math.max(0, battery - dt * (1 + (keys.up ? 0.4 : 0)));
      if (battery <= 0 && !emptyWarned) { emptyWarned = true; say.say('Battery empty! Land now!', { force: true }); }
      rotor.set({ vol: 0.05 + (keys.up ? 0.04 : 0), freq: keys.up ? 1100 : 900, pan: 0 });

      // photos: hover low above a spot
      const spot = SPOTS.find(s => !photos.has(s.x) && Math.abs(heli.x - s.x) < 30 && alt < 120);
      if (spot) {
        hoverAt ??= t;
        if (t - hoverAt > 0.6) {
          photos.add(spot.x); hoverAt = null; flash = 1;
          tone(1800, 0.05, { vol: 0.1 }); burst(0.08, { vol: 0.1, freq: 4000 }); vibrate(40);
          say.say(`Photo taken: ${spot.name}! ${photos.size} of 3.`, { force: true });
        }
      } else hoverAt = null;

      // beeper toward the next goal
      beepAt -= dt;
      if (beepAt <= 0) {
        const goal = nextGoal();
        tone(heli.vy > SAFE_DOWN && alt < 120 ? 1300 : 760, 0.05, { vol: 0.06, pan: clamp((goal.x - heli.x) / 250, -1, 1) });
        beepAt = clamp(alt / 300, 0.15, 0.9);
      }
      if (Math.floor(t) % 5 === 0 && Math.floor(t - dt) % 5 !== 0) {
        const goal = nextGoal();
        const d = Math.round(Math.abs(goal.x - heli.x) / 4);
        say.say(`Battery ${Math.round(battery / BATTERY * 100)} percent. ${goal.label} ${d < 5 ? 'right below you' : `${d} meters to your ${goal.x > heli.x ? 'right' : 'left'}`}.`);
      }

      // touching the ground
      if (heli.y + 22 >= groundY(heli.x)) {
        heli.y = groundY(heli.x) - 22;
        const soft = heli.vy <= SAFE_DOWN && Math.abs(heli.vx) <= SAFE_SIDE;
        heli.flying = false;
        rotor.set({ vol: 0 });
        if (!soft) return crash(heli.vy > SAFE_DOWN ? 'You came down too fast.' : 'You hit the ground while sliding sideways.');
        heli.vx = 0; heli.vy = 0;
        tone(300, 0.15, { vol: 0.08 });
        if (heli.x >= PAD_B.a && heli.x <= PAD_B.b) return win();
        if (battery <= 0) return crash('The battery ran out before airfield B.');
        say.say('Landed safely. Take off again with up: airfield B is to the right.', { force: true });
      }
    } else if (battery <= 0 && state === 'play') {
      crash('The battery ran out before airfield B.');
    }
    flash = Math.max(0, flash - dt * 3);
  }

  function win() {
    state = 'won';
    showResult(ui, {
      won: true, stars: Math.max(1, photos.size), title: 'Perfect landing on airfield B!',
      text: (mg.success || 'You flew like me! I made 72 flights on Mars, far more than the 5 planned, and scouted routes for Perseverance. On my last flight in January 2024, the ground was smooth sand with almost no features, my navigation got confused, and my blades broke in a hard landing.')
        + ` You took ${photos.size} of 3 photos.`,
    });
    say.clear();
  }
  function crash(why) {
    state = 'lost';
    burst(0.6, { vol: 0.2, freq: 500 });
    showResult(ui, {
      won: false, title: 'Hard landing!',
      text: `${why} ${mg.hint || 'Tip: tap ▲ gently to hover, fly low over each camera mark, and come down slowly on airfield B. Watch out for gusts and the smooth sand!'}`,
    });
    say.clear();
  }

  function draw() {
    const camX = clamp(heli.x - W * 0.4, 0, WORLD - W);
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b1838'); g.addColorStop(0.6, '#b0583c'); g.addColorStop(1, '#5a2419');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // far hills (parallax)
    ctx.fillStyle = 'rgba(110,50,35,.7)';
    ctx.beginPath(); ctx.moveTo(0, 380);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, 360 - 18 * Math.abs(Math.sin((x + camX * 0.3) / 70)));
    ctx.lineTo(W, 420); ctx.lineTo(0, 420); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(-camX, 0);
    // smooth sand zone
    ctx.fillStyle = 'rgba(226,170,120,.35)'; ctx.fillRect(SAND.a, 380, SAND.b - SAND.a, 100);
    // ground
    ctx.fillStyle = '#8a3a26';
    ctx.beginPath(); ctx.moveTo(camX, H);
    for (let x = camX; x <= camX + W; x += 4) ctx.lineTo(x, groundY(x));
    ctx.lineTo(camX + W, H); ctx.closePath(); ctx.fill();
    for (const r of rocks) {
      if (r.x < camX - 10 || r.x > camX + W + 10) continue;
      ctx.fillStyle = '#4a1d12'; ctx.beginPath(); ctx.ellipse(r.x, groundY(r.x) - r.r * 0.3, r.r * 1.4, r.r * 0.8, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#c9d3e6'; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('SMOOTH SAND', (SAND.a + SAND.b) / 2, 448);
    // airfields
    for (const [pad, name] of [[PAD_A, 'AIRFIELD A'], [PAD_B, 'AIRFIELD B']]) {
      ctx.strokeStyle = '#5de4ff'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(pad.a, 421); ctx.lineTo(pad.b, 421); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#5de4ff'; ctx.fillText(name, (pad.a + pad.b) / 2, 440);
    }
    // photo spots
    for (const s of SPOTS) {
      const done = photos.has(s.x);
      const y = groundY(s.x) - 70;
      ctx.strokeStyle = done ? 'rgba(93,228,255,.9)' : 'rgba(255,155,213,.9)'; ctx.lineWidth = 2;
      ctx.setLineDash(done ? [] : [4, 3]);
      ctx.strokeRect(s.x - 24, y - 16, 48, 32); ctx.setLineDash([]);
      ctx.fillStyle = done ? '#5de4ff' : '#ff9bd5';
      ctx.fillText(done ? '✓ PHOTO' : 'CAMERA', s.x, y + 4);
    }
    // helicopter
    const { x, y } = heli;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x, groundY(x) + 1, 16, 3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c9d3e6'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 6, y + 10); ctx.lineTo(x - 16, y + 22); ctx.moveTo(x + 6, y + 10); ctx.lineTo(x + 16, y + 22); ctx.stroke();
    ctx.fillStyle = '#2a2660'; ctx.beginPath(); ctx.roundRect(x - 9, y - 2, 18, 13, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5de4ff'; ctx.beginPath(); ctx.arc(x, y + 4, 2.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y - 16); ctx.stroke();
    ctx.fillStyle = '#1d2a5a'; ctx.fillRect(x - 11, y - 20, 22, 3);
    for (const dy of [-12, -7]) {
      if (heli.flying) {
        ctx.fillStyle = 'rgba(201,211,230,.28)'; ctx.beginPath(); ctx.ellipse(x, y + dy, 34, 3, 0, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = '#c9d3e6'; ctx.beginPath(); ctx.moveTo(x - 32, y + dy); ctx.lineTo(x + 32, y + dy); ctx.stroke();
      }
    }
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }

    // gauges + mini-map
    bar(ctx, 12, 12, 120, 14, battery / BATTERY, battery < 15 ? '#ff9bd5' : '#5de4ff', `BATTERY ${Math.round(battery / BATTERY * 100)}%`);
    panel(ctx, 12, 32, 120, 16);
    ctx.fillStyle = '#eef0ff'; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillText(`PHOTOS ${photos.size}/3`, 18, 44);
    panel(ctx, 146, 12, 202, 26);
    const mx = v => 152 + (v / WORLD) * 190;
    ctx.fillStyle = 'rgba(226,170,120,.5)'; ctx.fillRect(mx(SAND.a), 22, mx(SAND.b) - mx(SAND.a), 8);
    ctx.fillStyle = '#5de4ff'; ctx.fillRect(mx(PAD_A.a), 28, mx(PAD_A.b) - mx(PAD_A.a), 3); ctx.fillRect(mx(PAD_B.a), 28, mx(PAD_B.b) - mx(PAD_B.a), 3);
    for (const s of SPOTS) { ctx.fillStyle = photos.has(s.x) ? '#5de4ff' : '#ff9bd5'; ctx.fillRect(mx(s.x) - 2, 18, 4, 4); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(mx(heli.x), 25, 3, 0, TAU); ctx.fill();

    // the goal, in words, and an arrow when it is off screen
    const goal = nextGoal();
    let words = photos.size < 3 ? `Photo ${photos.size + 1} of 3: fly to the orange CAMERA box` : 'Now land on AIRFIELD B';
    if (!heli.flying && state === 'play') words = battery > 0 ? 'Hold ▲ to take off' : words;
    if (hoverAt != null) words = 'Stay low and still… 📷';
    goalBanner(ctx, W, 52, words, hoverAt != null ? '#5de4ff' : '#eef0ff');
    const gx = goal.x - camX;
    if (gx < 0) edgeArrow(ctx, 18, 250, Math.PI);
    if (gx > W) edgeArrow(ctx, W - 18, 250, 0);
    const above = groundY(heli.x) - (heli.y + 22);
    if (heli.flying && above < 90 && heli.vy > SAFE_DOWN) warning(ctx, clamp(heli.x - camX, 70, W - 70), heli.y - 30, 'TOO FAST! Hold ▲');
    const alt = Math.max(0, Math.round((groundY(heli.x) - (heli.y + 22)) / 4));
    ui.hud.textContent = `Battery ${Math.round(battery / BATTERY * 100)}% · Height ${alt} m · Photos ${photos.size}/3`;
  }

  const stopLoop = gameLoop(dt => { if (state === 'play') update(dt); draw(); });
  return () => { stopLoop(); rotor.stop(); controls.dispose(); say.clear(); };
}
