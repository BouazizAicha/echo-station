// "Survive the dust storm" (Opportunity) — Dev B.
// A dust storm darkens the sky: less sunlight for the solar panels, and dust piles up on them.
// Each night the heaters must keep the electronics warm. Science earns points but uses power.
// Dust devils (little whirlwinds) clean the panels when they pass over the rover: that really
// happened many times to Spirit and Opportunity.
// Real story: Opportunity survived a huge storm in 2007 with almost everything switched off.
// In June 2018 a storm covered the whole planet; Opportunity's last message came on June 10, 2018.
import {
  TAU, clamp, setupCanvas, setupControls, tone, burst, hum, vibrate, announcer,
  gameLoop, showResult, makeHandle, bar, panel, seeded, reducedMotion,
} from './kit.js';

const W = 360, H = 480, SOL = 8, SOLS = 8, GROUND = 360;
const SUN = 30, HEATER = 3.5, BASE = 0.5, SCIENCE_COST = 4, SCIENCE_PTS = 2, DRIVE_COST = 1.5;

const tauAt = sol => 0.5 + 4.6 * Math.exp(-((sol - 4.4) ** 2) / (2 * 1.1 ** 2));   // storm peaks around sol 4

export function start(robot, ui) {
  const mg = robot.minigame || {};
  return makeHandle(robot, ui, () => run(mg, ui));
}

function run(mg, ui) {
  const ctx = setupCanvas(ui.canvas, W, H);
  const say = announcer(ui);
  const controls = setupControls(ui, {
    left: { label: '◀', aria: 'Drive left' },
    up: { label: '▲ Science', aria: 'Science on or off' },
    right: { label: '▶', aria: 'Drive right' },
  }, { hint: '▲ switches science on/off. Hold ◀ ▶ to drive into dust devils. Keyboard: arrows.' });
  const keys = controls.keys;
  const upButton = ui.controls.querySelector('[data-key="up"]');
  const wind = hum({ freq: 500 });

  const rnd = seeded(11);
  const pebbles = Array.from({ length: 50 }, () => ({ x: rnd() * W, y: GROUND + 6 + rnd() * 110, r: 1 + rnd() * 3 }));
  const flakes = Array.from({ length: 90 }, () => ({ x: rnd() * W, y: rnd() * GROUND, s: 0.5 + rnd() }));
  let battery = 80, clean = 1, science = true, points = 0, t = 0, state = 'play';
  let rover = W / 2, devils = [], nextDevil = 5, upWas = false, lastSol = -1, lowWarned = false;

  const setScience = on => {
    science = on;
    upButton.textContent = `▲ Science ${on ? 'ON' : 'OFF'}`;
    upButton.classList.toggle('science-on', on);
    tone(on ? 880 : 440, 0.1, { type: 'triangle', vol: 0.08 });
    say.say(on ? 'Science on: earning points, using power.' : 'Science off: saving power.', { force: true });
  };
  setScience(true);
  say.say('Survive the dust storm for 8 Martian days. Science earns points but uses power. Drive into dust devils to clean your solar panels.', { force: true });

  function update(dt) {
    t += dt;
    const sol = t / SOL;
    const phase = (t % SOL) / SOL;
    const day = Math.max(0, Math.sin(phase * TAU));
    const tau = tauAt(sol);
    const light = day * Math.exp(-tau / 2.5);

    if (keys.up && !upWas) setScience(!science);
    upWas = keys.up;

    const drive = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    rover = clamp(rover + drive * 32 * dt, 30, W - 30);

    battery += SUN * light * clean * dt;
    battery -= (BASE + (day === 0 ? HEATER : 0) + (science ? SCIENCE_COST : 0) + (drive ? DRIVE_COST : 0)) * dt;
    battery = Math.min(100, battery);
    if (science) points += SCIENCE_PTS * dt;
    clean = Math.max(0.2, clean - 0.012 * (1 + tau / 2) * dt);

    // dust devils: only when the air is clear enough
    nextDevil -= dt;
    if (nextDevil <= 0 && tau < 3) {
      const from = Math.random() < 0.5 ? -1 : 1;
      devils.push({ x: from < 0 ? -30 : W + 30, dir: -from, cleaned: false });
      nextDevil = 6 + Math.random() * 4;
      burst(1.5, { vol: 0.08, freq: 700, pan: from });
      say.say(`A dust devil is coming from the ${from < 0 ? 'left' : 'right'}! Drive into it to clean your panels.`, { force: true });
    }
    for (const d of devils) {
      d.x += d.dir * 42 * dt;
      if (!d.cleaned && Math.abs(d.x - rover) < 22) {
        d.cleaned = true;
        clean = Math.min(1, clean + 0.45);
        tone(660, 0.12, { type: 'triangle' }); tone(990, 0.2, { type: 'triangle', delay: 0.1 }); vibrate(60);
        say.say('Whoosh! The wind cleaned your solar panels!', { force: true });
      }
    }
    devils = devils.filter(d => d.x > -60 && d.x < W + 60);
    wind.set({ vol: 0.02 + tau * 0.02, freq: 400 + tau * 60 });

    // the story of the storm, day by day
    const s = Math.floor(sol);
    if (s !== lastSol) {
      lastSol = s;
      const words = { 1: 'A dust storm is coming…', 3: 'The storm is getting darker!', 4: 'The storm covers the sky. Save power!', 6: 'The sky is clearing up…' };
      say.say(`Sol ${s + 1} of ${SOLS}. ${words[s] || ''} Battery ${Math.round(battery)} percent.`, { force: true });
    }
    if (battery < 20 && !lowWarned) { lowWarned = true; tone(300, 0.2, { vol: 0.1 }); tone(300, 0.2, { vol: 0.1, delay: 0.3 }); vibrate([80, 80, 80]); say.say('Battery low! Switch science off!', { force: true }); }
    if (battery > 30) lowWarned = false;

    if (battery <= 0) {
      battery = 0; state = 'lost';
      showResult(ui, {
        won: false, title: 'Too dark, too cold…',
        text: mg.hint || 'My battery ran out. Tip: switch science off (▲) when the storm gets dark, and drive into dust devils (◀ ▶) to clean your panels. In June 2018, a storm covered the whole planet and this is really what happened to me.',
      });
      say.clear();
    } else if (sol >= SOLS) {
      state = 'won';
      const stars = points >= 55 ? 3 : points >= 30 ? 2 : 1;
      showResult(ui, {
        won: true, stars, title: 'You survived the storm!',
        text: (mg.success || 'In 2007, a huge dust storm darkened my sky for weeks. My team switched off almost everything, and I made it! Wind gusts also cleaned my solar panels many times. But in June 2018, a storm covered the whole planet; my panels got almost no light, and my last message reached Earth on June 10, 2018.')
          + ` Science points: ${Math.round(points)}.`,
      });
      say.clear();
    }
    return { day, tau, light, phase };
  }

  let env = { day: 1, tau: 0.5, light: 1, phase: 0.25 };
  function draw() {
    const { day, tau, phase } = env;
    const dim = Math.exp(-tau / 3);
    // sky: from night blue to butterscotch, browner in the storm
    const k = day * dim;
    const top = `rgb(${Math.round(20 + 120 * k)},${Math.round(14 + 70 * k)},${Math.round(40 + 40 * k)})`;
    const low = `rgb(${Math.round(40 + 170 * k * (0.6 + 0.4 * dim))},${Math.round(20 + 90 * k)},${Math.round(30 + 40 * k)})`;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, top); g.addColorStop(1, low);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
    if (day > 0) {
      const sx = 30 + phase * 2 * (W - 60), sy = GROUND - Math.sin(phase * TAU) * 260;
      ctx.globalAlpha = clamp(dim * 1.2, 0.08, 1);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40);
      sg.addColorStop(0, 'rgba(255,250,235,1)'); sg.addColorStop(0.2, 'rgba(255,240,200,.6)'); sg.addColorStop(1, 'rgba(255,220,170,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 40, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // blowing dust
    for (const f of flakes) {
      if (!reducedMotion()) f.x = (f.x + (20 + tau * 25) * f.s * 0.016) % W;
      ctx.fillStyle = `rgba(230,170,120,${clamp(tau / 6, 0.05, 0.6)})`;
      ctx.fillRect(f.x, f.y, 2 * f.s, 1);
    }
    // ground
    ctx.fillStyle = '#7a3424'; ctx.fillRect(0, GROUND, W, H - GROUND);
    for (const p of pebbles) { ctx.fillStyle = 'rgba(40,14,8,.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - k)})`; ctx.fillRect(0, 0, W, H);
    // dust devils
    for (const d of devils) {
      for (let i = 0; i < 7; i++) {
        const y = GROUND - i * 22;
        const r = 8 + i * 5;
        const wob = reducedMotion() ? 0 : Math.sin(t * 6 + i) * 4;
        ctx.fillStyle = `rgba(220,160,110,${0.18 - i * 0.015})`;
        ctx.beginPath(); ctx.ellipse(d.x + wob, y, r, 6, 0, 0, TAU); ctx.fill();
      }
    }
    // the rover (side view), with dust on the solar panels
    const x = rover, y = GROUND - 12;
    ctx.fillStyle = '#1d2a5a'; ctx.strokeStyle = '#5de4ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x - 34, y - 26, 68, 8, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(180,110,70,${0.85 * (1 - clean)})`; ctx.fillRect(x - 34, y - 26, 68, 8);
    ctx.fillStyle = '#c9d3e6'; ctx.fillRect(x - 18, y - 18, 36, 12);
    ctx.strokeStyle = '#c9d3e6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 10, y - 26); ctx.lineTo(x + 10, y - 44); ctx.stroke();
    ctx.fillStyle = '#2a2660'; ctx.fillRect(x + 4, y - 50, 12, 7);
    ctx.fillStyle = science ? '#5de4ff' : '#4b4f6c'; ctx.beginPath(); ctx.arc(x + 10, y - 46, 2, 0, TAU); ctx.fill();
    for (const wx of [-24, 0, 24]) { ctx.fillStyle = '#1b2436'; ctx.beginPath(); ctx.arc(x + wx, y + 4, 7, 0, TAU); ctx.fill(); }

    // gauges
    bar(ctx, 12, 12, 140, 14, battery / 100, battery < 20 ? '#ff9bd5' : '#5de4ff', `BATTERY ${Math.round(battery)}%`);
    bar(ctx, 12, 30, 140, 14, clean, '#b49bff', `CLEAN PANELS ${Math.round(clean * 100)}%`);
    panel(ctx, 210, 12, 138, 32);
    ctx.textAlign = 'left'; ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#eef0ff'; ctx.fillText(`SOL ${Math.min(SOLS, Math.floor(t / SOL) + 1)}/${SOLS}`, 218, 25);
    ctx.fillStyle = science ? '#5de4ff' : '#9a9cc4'; ctx.fillText(`SCIENCE ${Math.round(points)}`, 218, 38);
    ctx.fillStyle = '#eef0ff'; ctx.textAlign = 'right';
    ctx.fillText(day > 0 ? (tau > 3 ? 'STORM' : 'DAY') : 'NIGHT', 342, 25);
    ui.hud.textContent = `Sol ${Math.min(SOLS, Math.floor(t / SOL) + 1)}/${SOLS} · Battery ${Math.round(battery)}% · Panels ${Math.round(clean * 100)}% clean · Science ${Math.round(points)}`;
  }

  const stopLoop = gameLoop(dt => { if (state === 'play') env = update(dt) || env; draw(); });
  return () => {
    stopLoop(); wind.stop(); controls.dispose(); say.clear();
    upButton.classList.remove('science-on');
  };
}
