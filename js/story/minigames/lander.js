// "Land the Eagle" (Apollo 11, July 20, 1969) — Dev B.
// The computer was steering Eagle toward a crater full of boulders. Neil Armstrong took manual
// control, flew past it and landed on flat ground with very little fuel left. Two program alarms
// (1202, 1201) went off during the descent: Mission Control said "We're GO on that alarm".
// Blind-friendly: an altitude beeper (faster = closer to the ground, higher = falling too fast),
// panned toward the flat ground; spoken status every few seconds. Deaf-friendly: everything is drawn
// and written (gauges, callouts, captions).
import {
  TAU, clamp, setupCanvas, setupControls, tone, burst, hum, vibrate, announcer,
  gameLoop, showResult, makeHandle, starfield, bar, panel, seeded, reducedMotion,
  goalBanner, warning,
} from './kit.js';

const W = 360, H = 480;
const G = 9, THRUST = 21, SIDE = 9;           // px/s² (scaled Moon gravity)
const SAFE_DOWN = 14, SAFE_SIDE = 10;         // px/s
const FUEL_START = 25;                        // game seconds of engine time
const SHOW = 4;                               // shown as mission seconds (the game is a fast-forward)
const ZONE = { a: 250, b: 334 };              // flat ground
const BOULDERS = { a: 110, b: 236 };          // "West crater" boulder field

function groundY(x) {
  if (x >= ZONE.a && x <= ZONE.b) return 430;
  return 430 + Math.sin(x / 23) * 4 + Math.sin(x / 9) * 2;
}

export function start(robot, ui) {
  const mg = robot.minigame || {};
  return makeHandle(robot, ui, () => run(mg, ui));
}

function run(mg, ui) {
  const ctx = setupCanvas(ui.canvas, W, H);
  const say = announcer(ui);
  const controls = setupControls(ui, {
    left: { label: '◀', aria: 'Push left' },
    up: { label: '▲ Thrust', aria: 'Main engine: slow down' },
    right: { label: '▶', aria: 'Push right' },
  }, { hint: 'Hold ▲ to slow down, ◀ ▶ to move sideways. Keyboard: arrows or Space.' });
  const keys = controls.keys;
  const engine = hum({ freq: 260 });

  const rnd = seeded(42);
  const boulders = Array.from({ length: 16 }, () => ({ x: BOULDERS.a + rnd() * (BOULDERS.b - BOULDERS.a), r: 3 + rnd() * 6 }));
  const lm = { x: 70, y: 50, vx: 17, vy: 8 };
  let fuel = FUEL_START, t = 0, state = 'fly', beepAt = 0, alarm = 0, said = new Set(), dust = [];


  function update(dt) {
    t += dt;
    const thrust = keys.up && fuel > 0;
    const side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    lm.vy += (G - (thrust ? THRUST : 0)) * dt;
    if (side && fuel > 0) lm.vx += side * SIDE * dt;
    fuel = Math.max(0, fuel - dt * ((thrust ? 1 : 0) + (side ? 0.4 : 0)));
    lm.x += lm.vx * dt;
    lm.y += lm.vy * dt;
    if (lm.x < 16) { lm.x = 16; lm.vx = Math.abs(lm.vx) * 0.3; }
    if (lm.x > W - 16) { lm.x = W - 16; lm.vx = -Math.abs(lm.vx) * 0.3; }
    if (lm.y < 20) { lm.y = 20; lm.vy = Math.max(0, lm.vy); }

    const alt = groundY(lm.x) - (lm.y + 18);
    engine.set({ vol: thrust ? 0.16 : side && fuel > 0 ? 0.05 : 0, pan: (lm.x - W / 2) / (W / 2) });
    if (thrust && alt < 60) dust.push({ x: lm.x + (Math.random() - 0.5) * 50, y: groundY(lm.x) - 2, life: 1 });

    // Real events of the descent
    if (t > 5 && !said.has('1202')) { said.add('1202'); alarm = 3.5; tone(880, 0.12, { type: 'square', vol: 0.06 }); tone(880, 0.12, { type: 'square', vol: 0.06, delay: 0.25 }); say.say('Program alarm 1202. Houston: we are GO on that alarm!', { force: true }); }
    if (t > 13 && !said.has('1201')) { said.add('1201'); alarm = 3; tone(880, 0.12, { type: 'square', vol: 0.06 }); say.say('Program alarm 1201. Still GO!', { force: true }); }
    for (const mark of [60, 30]) {
      if (fuel * SHOW <= mark && !said.has(mark)) { said.add(mark); tone(660, 0.25, { type: 'triangle' }); vibrate(80); say.say(`${mark} seconds of fuel left!`, { force: true }); }
    }
    alarm = Math.max(0, alarm - dt);

    // Altitude beeper (sound guide)
    beepAt -= dt;
    if (beepAt <= 0 && alt > 0) {
      const fast = lm.vy > SAFE_DOWN;
      const zoneMid = (ZONE.a + ZONE.b) / 2;
      tone(fast ? 1200 : 700, 0.05, { type: 'sine', vol: 0.07, pan: clamp((zoneMid - lm.x) / 150, -1, 1) });
      beepAt = clamp(alt / 260, 0.12, 1);
    }
    if (Math.floor(t) % 4 === 0 && Math.floor(t - dt) % 4 !== 0 && t > 2) {
      const where = lm.x < ZONE.a ? 'Flat ground is to your right.' : lm.x > ZONE.b ? 'Flat ground is to your left.' : 'You are above flat ground!';
      say.say(`Altitude ${Math.round(alt / 2)} meters, ${lm.vy > SAFE_DOWN ? 'falling too fast' : 'speed OK'}. ${where}`);
    }

    // Touchdown
    if (alt <= 0) {
      lm.y = groundY(lm.x) - 18;
      const onZone = lm.x >= ZONE.a + 8 && lm.x <= ZONE.b - 8;
      const onBoulders = lm.x >= BOULDERS.a - 8 && lm.x <= BOULDERS.b + 8;
      const soft = lm.vy <= SAFE_DOWN && Math.abs(lm.vx) <= SAFE_SIDE;
      engine.set({ vol: 0 });
      if (soft && onZone) {
        state = 'landed';
        burst(0.4, { vol: 0.12, freq: 300 });
        const left = Math.round(fuel * SHOW);
        const stars = left >= 40 ? 3 : left >= 20 ? 2 : 1;
        showResult(ui, {
          won: true, stars, title: 'The Eagle has landed!',
          text: (mg.success || 'Contact light! On July 20, 1969, Neil Armstrong really flew past a crater full of boulders and set Eagle down on flat ground with only seconds of fuel to spare. The place became Tranquility Base.')
            + ` You landed with ${left} seconds of fuel left.`,
        });
      } else {
        state = 'crashed';
        burst(0.7, { vol: 0.25, freq: 500 });
        vibrate([100, 50, 200]);
        const why = !soft ? (lm.vy > SAFE_DOWN ? 'You touched down too fast.' : 'You were sliding sideways too fast.')
          : onBoulders ? 'You landed among the boulders!' : 'The ground there is too bumpy.';
        showResult(ui, {
          won: false, title: 'Hard landing!',
          text: `${why} ${mg.hint || 'Tip: keep the engine on (▲) to stay in the air longer, and glide right past the boulders to the flat ground. Touch down slowly.'}`,
        });
      }
      say.clear();
    }
  }

  function drawLM(x, y, flame) {
    ctx.save();
    ctx.translate(x, y);
    if (flame) {
      const f = reducedMotion() ? 1 : 0.85 + 0.15 * Math.sin(t * 40);
      const g = ctx.createLinearGradient(0, 14, 0, 14 + 26 * f);
      g.addColorStop(0, 'rgba(255,255,230,.95)'); g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(6, 14); ctx.lineTo(0, 14 + 28 * f); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#c9d3e6'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, 8); ctx.lineTo(-17, 18); ctx.moveTo(10, 8); ctx.lineTo(17, 18);
    ctx.moveTo(-21, 18); ctx.lineTo(-13, 18); ctx.moveTo(13, 18); ctx.lineTo(21, 18);
    ctx.stroke();
    ctx.fillStyle = '#d9b44a';                         // gold descent stage
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(14, 10); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b7bcc8';                         // ascent stage
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-7, -12); ctx.lineTo(7, -12); ctx.lineTo(10, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b2436'; ctx.fillRect(-3, -9, 6, 4);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#04030c'; ctx.fillRect(0, 0, W, H);
    starfield(ctx, W, 400, 90, 7);
    // Earth in the sky
    ctx.fillStyle = '#5d9bff'; ctx.beginPath(); ctx.arc(300, 60, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(4,3,12,.65)'; ctx.beginPath(); ctx.arc(306, 58, 14, 0, TAU); ctx.fill();
    // ground
    ctx.fillStyle = '#7d8394';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, groundY(x));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    const gg = ctx.createLinearGradient(0, 430, 0, H); gg.addColorStop(0, 'rgba(255,255,255,.12)'); gg.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = gg; ctx.fillRect(0, 425, W, H - 425);
    // boulders and flat zone markers
    for (const b of boulders) {
      ctx.fillStyle = '#4b4f5c'; ctx.beginPath(); ctx.ellipse(b.x, groundY(b.x) - b.r * 0.4, b.r * 1.3, b.r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(220,226,240,.25)'; ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.3, groundY(b.x) - b.r * 0.8, b.r * 0.5, b.r * 0.3, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,155,213,.9)'; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('BOULDERS', (BOULDERS.a + BOULDERS.b) / 2, 456);
    ctx.fillStyle = '#5de4ff'; ctx.fillText(state === 'landed' ? 'TRANQUILITY BASE' : 'FLAT GROUND', (ZONE.a + ZONE.b) / 2, 456);
    ctx.strokeStyle = 'rgba(93,228,255,.7)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(ZONE.a, 432); ctx.lineTo(ZONE.b, 432); ctx.stroke(); ctx.setLineDash([]);
    // dust
    for (const d of dust) {
      d.life -= 0.03; d.y -= 0.4; d.x += (d.x - lm.x) * 0.02;
      ctx.fillStyle = `rgba(200,205,220,${Math.max(0, d.life) * 0.35})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, 4 + (1 - d.life) * 8, 0, TAU); ctx.fill();
    }
    dust = dust.filter(d => d.life > 0);
    // shadow + lander
    const gy = groundY(lm.x);
    const altNow = gy - (lm.y + 18);
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.5 - altNow / 600, 0.1, 0.5)})`;
    ctx.beginPath(); ctx.ellipse(lm.x, gy + 1, 18, 3, 0, 0, TAU); ctx.fill();
    drawLM(lm.x, lm.y, state === 'fly' && keys.up && fuel > 0);

    // gauges
    bar(ctx, 12, 12, 120, 14, fuel / FUEL_START, fuel * SHOW < 30 ? '#ff9bd5' : '#5de4ff', `FUEL ${Math.round(fuel * SHOW)} s`);
    const fast = lm.vy > SAFE_DOWN;
    panel(ctx, 12, 32, 120, 30);
    ctx.textAlign = 'left'; ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = fast ? '#ff9bd5' : '#5de4ff';
    ctx.fillText(`DOWN ${Math.max(0, lm.vy / 2).toFixed(1)} m/s`, 18, 45);
    ctx.fillStyle = Math.abs(lm.vx) > SAFE_SIDE ? '#ff9bd5' : '#9a9cc4';
    ctx.fillText(`SIDE ${(lm.vx / 2).toFixed(1)} m/s`, 18, 57);
    if (alarm > 0) {
      panel(ctx, 150, 12, 198, 34);
      ctx.fillStyle = '#ffd166'; ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(said.has('1201') ? '1201 PROGRAM ALARM' : '1202 PROGRAM ALARM', 158, 27);
      ctx.fillStyle = '#eef0ff'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Houston: "We\'re GO on that alarm!"', 158, 40);
    }
    // the goal, in words, and a sign on the landing spot
    const overZone = lm.x >= ZONE.a && lm.x <= ZONE.b;
    goalBanner(ctx, W, 70, state === 'landed' ? 'Landed!' : overZone ? 'Now land slowly ↓' : lm.x < ZONE.a ? 'Fly to the FLAT GROUND →' : '← Fly back to the FLAT GROUND', overZone ? '#5de4ff' : '#eef0ff');
    const bounce = reducedMotion() ? 0 : Math.sin(t * 3) * 4;
    ctx.fillStyle = '#5de4ff'; ctx.textAlign = 'center'; ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText('LAND HERE', (ZONE.a + ZONE.b) / 2, 392 + bounce);
    ctx.font = '700 16px Inter, sans-serif'; ctx.fillText('↓', (ZONE.a + ZONE.b) / 2, 410 + bounce);
    if (state === 'fly' && altNow < 150 && lm.vy > SAFE_DOWN) warning(ctx, clamp(lm.x, 70, W - 70), lm.y - 26, 'TOO FAST! Hold ▲');
    ui.hud.textContent = `Fuel ${Math.round(fuel * SHOW)} s · Altitude ${Math.max(0, Math.round(altNow / 2))} m · Down ${Math.max(0, lm.vy / 2).toFixed(1)} m/s`;
  }

  const stopLoop = gameLoop(dt => { if (state === 'fly') update(dt); draw(); });
  return () => { stopLoop(); engine.stop(); controls.dispose(); say.clear(); };
}
