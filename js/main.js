// Echo Station – main flow: intro → radio/antenna → story.
import { startRadio, setSignal, muteRadio } from './story/radio.js';
import { enableAntenna, onPointing, calibrate } from './engine/antenna.js';
import { loadSkyTables, getHorizontal, angularDistance } from './engine/sky.js';

const TOLERANCE_DEG = 15;   // how close you must aim to start hearing a signal
const LOCK_LEVEL = 0.85;    // signal strength needed to lock on
const LOCK_TIME_MS = 1500;  // hold still this long to lock on

const STORY_PARTS = [
  ['who_i_am', 'Who I am'],
  ['why_sent', 'Why I was sent'],
  ['discoveries', 'What I discovered'],
  ['where_now', 'Where I am now'],
  ['legacy', 'Who took over'],
];

const state = {
  robots: [],
  found: new Set(),
  observer: { lat: 36.8065, lon: 10.1815, height: 0 }, // default: Tunis
  lockStart: null,
  gotOrientation: false,
};

const $ = id => document.getElementById(id);

function show(id) {
  document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; });
  window.scrollTo(0, 0);
}

// ---------- Data ----------
async function loadRobots() {
  const ids = await fetch('data/robots/index.json').then(r => r.json());
  state.robots = await Promise.all(ids.map(id => fetch(`data/robots/${id}.json`).then(r => r.json())));
  await loadSkyTables([...new Set(state.robots.map(r => r.sky_target))]);
}

function locateUser() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.observer.lat = pos.coords.latitude;
      state.observer.lon = pos.coords.longitude;
      cache.time = 0; // recompute sky positions
    },
    () => { /* keep default location */ },
    { timeout: 10000 }
  );
}

// Sky positions are recomputed every 10 s (orientation events fire ~60×/s).
let cache = { time: 0, positions: {} };
function targetPositions() {
  const now = Date.now();
  if (now - cache.time > 10000) {
    cache = { time: now, positions: {} };
    for (const t of new Set(state.robots.map(r => r.sky_target))) {
      const p = getHorizontal(t, new Date(now), state.observer);
      if (p) cache.positions[t] = p;
    }
  }
  return cache.positions;
}

// ---------- Radio / antenna ----------
function onAim(dir) {
  state.gotOrientation = true;
  if ($('screen-radio').hidden) return;

  $('pointing').textContent = `Aiming: azimuth ${dir.az.toFixed(0)}°, altitude ${dir.alt.toFixed(0)}°`;

  let best = null;
  for (const [target, pos] of Object.entries(targetPositions())) {
    const d = angularDistance(dir, pos);
    if (!best || d < best.d) best = { target, d };
  }

  const strength = best ? Math.max(0, 1 - best.d / TOLERANCE_DEG) : 0;
  setSignal(strength);
  $('signal-bar').style.width = `${Math.round(strength * 100)}%`;

  if (strength >= LOCK_LEVEL) {
    $('radio-status').textContent = 'Signal detected… hold still.';
    state.lockStart ??= Date.now();
    if (Date.now() - state.lockStart > LOCK_TIME_MS) {
      state.lockStart = null;
      lockOn(best.target);
    }
  } else {
    state.lockStart = null;
    $('radio-status').textContent = strength > 0.3 ? 'Something is out there…' : 'Static only.';
  }
}

function lockOn(target) {
  const candidates = state.robots.filter(r => r.sky_target === target);
  const robot = candidates.find(r => !state.found.has(r.id)) || candidates[0];
  if (robot) openStory(robot);
}

function renderRobotList() {
  const list = $('robot-list');
  list.innerHTML = '';
  for (const robot of state.robots) {
    const b = document.createElement('button');
    b.textContent = `${robot.name} · ${robot.body}`;
    b.addEventListener('click', () => openStory(robot));
    list.appendChild(b);
  }
}

// ---------- Story ----------
function openStory(robot) {
  state.found.add(robot.id);
  muteRadio();

  $('story-meta').textContent =
    `${robot.body.toUpperCase()} · ${robot.site} · last signal: ${robot.last_signal || 'still active'}`;
  $('story-name').textContent = robot.name;

  const sections = $('story-sections');
  sections.innerHTML = '';
  for (const [key, label] of STORY_PARTS) {
    if (!robot.story?.[key]) continue;
    const div = document.createElement('div');
    div.className = 'story-part';
    const h = document.createElement('h4');
    h.textContent = label;
    const p = document.createElement('p');
    p.textContent = robot.story[key];
    div.append(h, p);
    sections.appendChild(div);
  }

  const fig = $('story-proof');
  if (robot.proof_image?.file) {
    const img = $('proof-img');
    img.onerror = () => { fig.hidden = true; };
    img.src = robot.proof_image.file;
    img.alt = robot.proof_image.caption || '';
    $('proof-caption').textContent =
      `${robot.proof_image.caption || ''} — Credit: ${robot.proof_image.credit || ''}`;
    fig.hidden = false;
  } else {
    fig.hidden = true;
  }

  $('story-human').textContent = robot.human_touch || '';
  $('story-human').hidden = !robot.human_touch;

  const qs = $('story-questions');
  qs.innerHTML = '';
  for (const { q, a } of robot.questions || []) {
    const wrap = document.createElement('div');
    wrap.className = 'qa';
    const b = document.createElement('button');
    b.textContent = q;
    const ans = document.createElement('p');
    ans.className = 'answer';
    ans.textContent = a;
    ans.hidden = true;
    b.addEventListener('click', () => { ans.hidden = !ans.hidden; });
    wrap.append(b, ans);
    qs.appendChild(wrap);
  }

  const mg = $('btn-minigame');
  mg.hidden = !robot.minigame;
  mg.textContent = 'Live my mission';
  mg.onclick = () => {
    // TODO Dev 2: load the mini-game matching robot.minigame.type with robot.minigame.settings
    mg.textContent = 'Mini-game coming soon';
  };

  const sl = $('sources-list');
  sl.innerHTML = '';
  for (const s of robot.sources || []) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = s.url;
    a.textContent = s.title;
    a.target = '_blank';
    a.rel = 'noopener';
    li.appendChild(a);
    sl.appendChild(li);
  }

  show('screen-story');
}

// ---------- Buttons ----------
$('btn-start').addEventListener('click', () => {
  startRadio();
  setSignal(0);
  locateUser();
  show('screen-radio');
});

$('btn-antenna').addEventListener('click', async () => {
  const ok = await enableAntenna();
  if (!ok) {
    $('radio-status').textContent = 'No motion sensors here: use manual tuning below.';
    return;
  }
  $('radio-status').textContent = 'Antenna on. Point at the Moon and calibrate, then sweep the sky.';
  $('btn-antenna').hidden = true;
  $('btn-calibrate').hidden = false;
  // Desktop browsers "accept" but never send orientation events.
  setTimeout(() => {
    if (!state.gotOrientation) {
      $('radio-status').textContent = 'No motion sensors detected: use manual tuning below.';
      $('btn-calibrate').hidden = true;
    }
  }, 2000);
});

$('btn-calibrate').addEventListener('click', () => {
  const moon = getHorizontal('moon', new Date(), state.observer);
  if (moon && moon.alt > 0 && calibrate(moon.az)) {
    $('radio-status').textContent = 'Calibrated on the Moon. Now sweep the sky.';
  } else {
    $('radio-status').textContent = 'The Moon is below the horizon right now, calibration skipped.';
  }
});

$('btn-back').addEventListener('click', () => {
  setSignal(0);
  show('screen-radio');
});

onPointing(onAim);

loadRobots()
  .then(renderRobotList)
  .catch(err => {
    console.error(err);
    $('robot-list').textContent = 'Could not load robots. Run a local server (see README).';
  });
