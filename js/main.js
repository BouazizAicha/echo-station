// Echo Station – main flow: intro → Belu listens (antenna / sky map) → story → friends, mini-game, finale.
import { startRadio, setSignal, muteRadio } from './story/radio.js';
import { enableAntenna, onPointing, calibrate } from './engine/antenna.js';
import { loadSkyTables, getHorizontal, angularDistance } from './engine/sky.js';
import { showStory, stopStory, skipTyping } from './story/story.js';
import { playTransition } from './story/transition.js';
import { startMinigame } from './story/minigames/index.js';
import { openFinale } from './story/finale.js';
import { renderFriends, countFriends } from './story/friends.js';

const TOLERANCE_DEG = 15;   // how close you must aim to start hearing a signal
const LOCK_LEVEL = 0.85;    // signal strength needed to lock on
const LOCK_TIME_MS = 1500;  // hold still this long to lock on
const FINALE_AT = 3;        // robots to find before the laser finale unlocks (judges are in a hurry!)


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
  updateBelu(strength);

  if (strength >= LOCK_LEVEL) {
    $('radio-status').textContent = 'An echo! Hold still…';
    state.lockStart ??= Date.now();
    if (Date.now() - state.lockStart > LOCK_TIME_MS) {
      state.lockStart = null;
      lockOn(best.target);
    }
  } else {
    state.lockStart = null;
    $('radio-status').textContent = strength > 0.3 ? 'Belu hears something…' : 'Only static… keep looking.';
  }
}

// Belu's echo rings speed up with the signal, and he smiles when he hears a friend
let beluState = '';
function updateBelu(strength) {
  const dur = (1.8 - 1.4 * strength).toFixed(1);
  const mood = strength >= LOCK_LEVEL ? 'happy' : 'neutral';
  const key = dur + mood;
  if (key === beluState) return;
  beluState = key;
  $('belu-radio').style.setProperty('--echo-dur', `${dur}s`);
  $('belu-radio-img').src = `assets/images/belu-${mood}.svg`;
}

function lockOn(target) {
  const candidates = state.robots.filter(r => r.sky_target === target);
  const robot = candidates.find(r => !state.found.has(r.id)) || candidates[0];
  if (robot) tuneTo(robot);
}

// Static → transition → story (used by the antenna, the sky map and the list)
let transitioning = false;
async function tuneTo(robot) {
  if (transitioning) return;
  transitioning = true;
  muteRadio();
  await playTransition(robot);
  transitioning = false;
  openStory(robot);
}

function renderRobotList() {
  const list = $('robot-list');
  list.innerHTML = '';
  for (const robot of state.robots) {
    const b = document.createElement('button');
    b.textContent = `${robot.name} · ${robot.body}`;
    b.addEventListener('click', () => tuneTo(robot));
    list.appendChild(b);
  }
}

// ---------- Story ----------
function openStory(robot) {
  state.found.add(robot.id);
  muteRadio();
  show('screen-story');
  updateFinaleButton();
  showStory(robot, { onMinigame: openMinigame, onFriend: updateFriendsButton });
}

// ---------- Belu's friends ----------
function updateFriendsButton() {
  $('btn-friends').textContent = `Belu's friends · ${countFriends(state.robots)}/${state.robots.length}`;
}

function openFriends() {
  stopStory();
  muteRadio();
  const n = countFriends(state.robots);
  $('friends-count').textContent = `${n} of ${state.robots.length} friends found`;
  renderFriends($('friends-grid'), state.robots, { onOpen: robot => openStory(robot) });
  show('screen-friends');
}

// ---------- Mini-game ----------
function openMinigame(robot) {
  stopStory();
  show('screen-minigame');
  $('mg-title').textContent = `Help ${robot.name}`;
  $('mg-intro').textContent = robot.minigame?.intro || '';
  if (state.game) state.game.stop();
  state.game = startMinigame(robot, {
    canvas: $('mg-canvas'), hud: $('mg-hud'), controls: $('mg-controls'),
    result: $('mg-result'), resultTitle: $('mg-result-title'), resultText: $('mg-result-text'),
    retryButton: $('btn-mg-retry'),
  });
  if (location.search.includes('debug')) window.__game = state.game;   // for testing
}

function closeMinigame() {
  if (state.game) state.game.stop();
  state.game = null;
  show('screen-story');
}

// ---------- Finale ----------
function updateFinaleButton() {
  $('btn-finale').hidden = state.found.size < Math.min(FINALE_AT, state.robots.length);
}

function goFinale() {
  muteRadio();
  show('screen-finale');
  openFinale({ onExit: () => { setSignal(0); show('screen-radio'); } });
}

// ---------- Buttons ----------
$('btn-start').addEventListener('click', () => {
  startRadio();
  setSignal(0);
  locateUser();
  show('screen-radio');
  if (new URLSearchParams(location.search).has('finale')) goFinale();   // shortcut for filming the video
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
  stopStory();
  setSignal(0);
  show('screen-radio');
});

$('btn-skip').addEventListener('click', skipTyping);
$('btn-mg-back').addEventListener('click', closeMinigame);
$('btn-mg-done').addEventListener('click', closeMinigame);
$('btn-finale').addEventListener('click', goFinale);
$('btn-friends').addEventListener('click', openFriends);
$('btn-friends-back').addEventListener('click', () => { setSignal(0); show('screen-radio'); });

onPointing(onAim);

loadRobots()
  .then(() => { renderRobotList(); updateFriendsButton(); })
  .catch(err => {
    console.error(err);
    $('robot-list').textContent = 'Could not load robots. Run a local server (see README).';
  });
