// Echo Station – integrated flow: intro → Belu listens (antenna / sky map) → story → friends, mini-game, finale.
// Role A (sky, antenna, guide, sky map, counter, light-time) with role B's story untouched.
import { startRadio, setSignal, muteRadio } from './story/radio.js';
import { showStory, stopStory, skipTyping } from './story/story.js';
import { playTransition } from './story/transition.js';
import { startMinigame, hasMinigame, minigameOf } from './story/minigames/index.js';
import { openFinale } from './story/finale.js';
import { renderFriends, countFriends } from './story/friends.js';
// Story mode (Dev B): mode choice, prologue, cinematic stories, "Why it matters"
import { isStory, setMode, onModeChange, updateAppBar } from './story/mode.js';
import { playPrologue } from './story/prologue.js';
import { showCinema, stopCinema, resumeCinema } from './story/cinema.js';
import { showWhy } from './story/why.js';
import { celebrate } from './story/celebrate.js';
import { createSonar, starsFor } from './story/sonar.js';
import { applySound } from './story/sound.js';
import './story/settings.js';
import { speak } from './story/speak.js';
import { vibrate } from './story/minigames/kit.js';

import {
  angularDistance,
  normalize180,
  compassPoint,
  formatLightTime,
  getLightTime,
  getObserver,
  getSkyTargets,
  loadSkyTables,
  setObserver,
} from './engine/sky.js';
import {
  calibrate,
  disableAntenna,
  enableAntenna,
  onPointing,
  pointing,
} from './engine/antenna.js';
import { computeGuide, guideMessage } from './engine/guide.js';
import { initSkyMap } from './engine/skymap.js';
import { pickTarget, activeTargets } from './engine/targeting.js';

try { sessionStorage.removeItem('echo-reload'); } catch (e) { /* every file arrived */ }

const TOLERANCE_DEG = 20;   // signal reaches 0 at 20° from the target
const LOCK_LEVEL = 0.7;     // 70% of that = about 6° away
const LOCK_TIME_MS = 1500;  // hold still this long to lock on
const FINALE_AT = 3;        // robots to find before the finale unlocks
const SKY_REFRESH_MS = 10000;
const BELOW_HORIZON_LEAD = 35; // nudge the map after a story so it does not re-lock

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const state = {
  pinned: null,          // Story mode: the friend Belu heard with Click! (the arrow keeps guiding to it)
  screen: 'intro',
  robots: [],
  targets: [],
  found: new Set(),
  aiming: { az: 0, alt: 0 },
  nearest: null,
  level: 0,
  lockStart: null,
  lockProgress: 0,
  suppressUntil: 0,
  antennaActive: false,
  gotOrientation: false,
  lastUiAt: 0,
  lastGuideText: '',
  lastRobot: null,
};

let map = null;

const $ = (id) => document.getElementById(id);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function signed(value, digits = 1) {
  const rounded = Number(value).toFixed(digits);
  return Number(value) >= 0 ? `+${rounded}` : rounded;
}

function show(id) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.hidden = screen.id !== id;
  }
  state.screen = id.replace('screen-', '');
  document.body.dataset.screen = state.screen;
  updateAppBar();
  window.scrollTo(0, 0);
}

function setRadioStatus(message, kind = '') {
  const element = $('radio-status');
  if (!element) return;
  element.textContent = message;
  element.dataset.kind = kind;
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

// index.json is either a list of robot ids (role B) or a list of objects.
async function loadRobots() {
  const response = await fetch('data/robots/index.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`robots index: HTTP ${response.status}`);
  const documentObject = await response.json();
  const entries = Array.isArray(documentObject) ? documentObject : (documentObject.robots || []);

  const robots = [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      try {
        const robotResponse = await fetch(`data/robots/${entry}.json`, { cache: 'no-cache' });
        if (robotResponse.ok) robots.push(await robotResponse.json());
      } catch (error) {
        console.warn(`[robots] ${entry}:`, error);
      }
    } else {
      robots.push(entry);
    }
  }
  return robots.filter((robot) => robot && robot.id && robot.sky_target);
}

/* ------------------------------------------------------------------ */
/* Sky positions                                                       */
/* ------------------------------------------------------------------ */

function refreshSky() {
  state.targets = getSkyTargets();
  renderRobotList();
  renderSkyTable();
  renderCounter();
  map?.refresh();
  updateDataSource();
}

function targetFor(skyTarget) {
  return state.targets.find((target) => target.id === skyTarget) || null;
}

function targetLabel(skyTarget) {
  return targetFor(skyTarget)?.label || skyTarget;
}

/* ------------------------------------------------------------------ */
/* Counter and list view                                               */
/* ------------------------------------------------------------------ */

const GROUPS = [
  { id: 'moon', label: 'Moon', targets: ['moon'] },
  { id: 'mars', label: 'Mars', targets: ['mars'] },
  { id: 'far', label: 'Far', targets: ['ceres', 'pioneer10'] },
];

function groupStats(targetIds) {
  const robots = state.robots.filter((robot) => targetIds.includes(robot.sky_target));
  return {
    total: robots.length,
    found: robots.filter((robot) => state.found.has(robot.id)).length,
  };
}

function renderCounter() {
  const container = $('counter');
  if (!container) return;
  container.innerHTML = '';
  for (const group of GROUPS) {
    const { found, total } = groupStats(group.targets);
    if (!total) continue;
    const item = document.createElement('span');
    item.className = 'counter-item';
    item.textContent = `${group.label} ${found}/${total}`;
    item.dataset.complete = found === total ? 'true' : 'false';
    container.append(item);
  }
}

function renderRobotList() {
  const container = $('target-list');
  if (!container) return;
  container.innerHTML = '';

  for (const target of state.targets) {
    const robots = state.robots.filter((robot) => robot.sky_target === target.id);
    if (!robots.length) continue; // no robot to find there (e.g. Ceres tonight)
    const found = robots.filter((robot) => state.found.has(robot.id)).length;

    const item = document.createElement('li');
    const info = document.createElement('span');
    info.className = 'target-info';
    info.textContent = `${target.label} · ${target.az.toFixed(0)}° ${compassPoint(target.az)} / ${target.alt.toFixed(0)}°${target.alt < 0 ? ' (below horizon)' : ''}`;

    const count = document.createElement('span');
    count.className = 'target-count';
    count.textContent = `${found}/${robots.length}`;

    // Look: centre the sky map on it (works under the horizon too)
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-button';
    button.textContent = 'Look';
    button.setAttribute('aria-label', `Look at ${target.label} on the sky map`);
    button.addEventListener('click', () => {
      if (!map) return;
      if (state.antennaActive) useSkyMap();
      map.start();
      map.lookAt(target.id);
      setRadioStatus(`Sky map centred on ${target.label}.`, 'ok');
    });

    // Tune in: go straight to the next robot there (cloudy sky, no sensors, accessibility)
    const tune = document.createElement('button');
    tune.type = 'button';
    tune.className = 'link-button tune-button';
    tune.textContent = 'Tune in';
    tune.setAttribute('aria-label', `Tune in to ${target.label}`);
    tune.addEventListener('click', () => lockTarget(target));

    item.append(info, count, button, tune);
    container.append(item);
  }
}

// Scientist mode: a live table of the four targets (refreshed every 10 s)
const AU_KM = 149597870.7;
function raText(hours) {
  const h = Math.floor(hours), m = Math.round((hours - h) * 60);
  return `${h}h ${String(m === 60 ? 59 : m).padStart(2, '0')}m`;
}
function decText(deg) {
  const sign = deg < 0 ? '−' : '+';
  const a = Math.abs(deg), d = Math.floor(a), m = Math.round((a - d) * 60);
  return `${sign}${d}° ${String(m === 60 ? 59 : m).padStart(2, '0')}′`;
}
function distanceText(au) {
  if (!Number.isFinite(au)) return '—';
  if (au < 0.01) return `${Math.round(au * AU_KM).toLocaleString('en-US')} km`;
  return `${au < 10 ? au.toFixed(2) : au.toFixed(1)} AU`;
}
function renderSkyTable() {
  const hud = document.querySelector('#screen-radio .hud');
  if (!hud) return;
  let box = $('sky-data');
  if (!box) {
    box = document.createElement('details');
    box.id = 'sky-data';
    box.className = 'panel sky-data';
    box.open = true;
    box.innerHTML = `<summary>Live sky data <span class="summary-note">updates every 10 s</span></summary>
      <div class="sky-table-wrap"><table class="sky-table">
        <thead><tr><th scope="col">Target</th><th scope="col">Az / Alt</th><th scope="col">RA / Dec</th><th scope="col">Distance</th><th scope="col">Light</th></tr></thead>
        <tbody></tbody></table></div>`;
    ($('list-view') || hud.lastElementChild).before(box);
  }
  const body = box.querySelector('tbody');
  body.innerHTML = '';
  for (const t of state.targets) {
    const tr = document.createElement('tr');
    if (t.alt < 0) tr.className = 'below';
    const cells = [
      t.label,
      `${t.az.toFixed(1)}° ${compassPoint(t.az)} / ${t.alt >= 0 ? '+' : '−'}${Math.abs(t.alt).toFixed(1)}°${t.alt < 0 ? ' ↓' : ''}`,
      `${raText(t.ra)} / ${decText(t.dec)}`,
      distanceText(t.dist_au),
      formatLightTime(t.dist_au * 499.004783836),
    ];
    cells.forEach((text, i) => {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.scope = 'row';
      cell.textContent = text;
      tr.appendChild(cell);
    });
    body.appendChild(tr);
  }
}

/* ------------------------------------------------------------------ */
/* Signal, guide, lock                                                 */
/* ------------------------------------------------------------------ */

/**
 * The single entry point for both the antenna and the sky map.
 * @param {{az:number, alt:number, raw?:object}} direction
 * @param {'antenna'|'map'} source
 */
function onAim(direction, source = 'map') {
  state.aiming = { az: direction.az, alt: direction.alt };
  if (state.screen !== 'radio') return;

  let nearest = pickTarget(state.aiming, state.targets, state.robots, state.found);
  if (!nearest) return;
  // Click! (optional) chose a friend: the arrow keeps guiding to that one until it is found
  // (but if you are already pointing close to another friend, that one wins and becomes the guided one)
  const pinned = state.pinned && activeTargets(state.targets.filter((t) => t.id === state.pinned), state.robots, state.found)[0];
  if (!pinned) state.pinned = null;
  else if (pinned.id !== nearest.target.id && nearest.distance <= 10) state.pinned = nearest.target.id;
  else if (pinned.id !== nearest.target.id) nearest = { target: pinned, distance: angularDistance(state.aiming, pinned) };
  // Stay on the current target unless another one is clearly closer: otherwise, with the Moon and
  // Mars close together in the sky, the arrow flips from one to the other and goes crazy.
  const current = state.nearest && state.targets.find((target) => target.id === state.nearest.target.id);
  if (current && nearest.target.id !== current.id
      && activeTargets([current], state.robots, state.found).length) {
    const currentDistance = angularDistance(state.aiming, current);
    if (nearest.distance > 7 && nearest.distance > currentDistance - 8) {
      nearest = { target: current, distance: currentDistance };
    }
  }
  state.nearest = nearest;
  state.level = clamp(1 - nearest.distance / TOLERANCE_DEG, 0, 1);

  const now = performance.now();
  if (state.level >= LOCK_LEVEL && now >= state.suppressUntil) {
    if (state.lockStart === null) state.lockStart = now;
    const held = now - state.lockStart;
    state.lockProgress = clamp(held / LOCK_TIME_MS, 0, 1);
    if (held >= LOCK_TIME_MS) {
      state.lockStart = null;
      state.lockProgress = 0;
      lockTarget(nearest.target);
      return;
    }
  } else {
    state.lockStart = null;
    state.lockProgress = 0;
  }

  // UI at ~12 Hz; the map sends at 10 Hz and sensors can fire at 60 Hz.
  if (now - state.lastUiAt >= 80) {
    state.lastUiAt = now;
    updateSignalUi();
    updateGuide();
    if (isStory()) sonar.update();
    if (DEBUG) showDebug(direction, source);
  }
}

// Belu's echo rings speed up with the signal, and he smiles when he hears a friend.
let beluState = '';
function updateBelu(strength) {
  const duration = (1.8 - 1.4 * strength).toFixed(1);
  const mood = strength >= LOCK_LEVEL ? 'happy' : 'neutral';
  const key = `${duration}${mood}`;
  if (key === beluState) return;
  beluState = key;
  $('belu-radio')?.style.setProperty('--echo-dur', `${duration}s`);
  const image = $('belu-radio-img');
  if (image) image.src = `assets/images/belu-${mood}.svg`;
}

function updateSignalUi() {
  const level = state.level;
  setSignal(level);
  updateBelu(level);

  const bar = $('signal-bar');
  if (bar) bar.style.width = `${Math.round(level * 100)}%`;
  const meter = bar?.parentElement;
  const pct = Math.round(level * 20) * 5;
  if (meter && meter.getAttribute('aria-valuenow') !== String(pct)) meter.setAttribute('aria-valuenow', String(pct));

  // Vibration: the closer the friend, the more often the phone buzzes (helps without sound or sight)
  const nowMs = performance.now();
  const every = state.lockProgress > 0 ? 350 : 1200 - 800 * level;
  if (level > 0.25 && nowMs - (state.lastBuzz || 0) > every) {
    vibrate(state.lockProgress > 0 ? 25 : Math.round(15 + 45 * level));
    state.lastBuzz = nowMs;
  }

  const guide = $('guide');
  if (guide) guide.style.setProperty('--lock', state.lockProgress.toFixed(3));

  if (state.lockProgress > 0) {
    setRadioStatus("You're on it! Hold still…");
  } else if (isStory()) {
    // Story mode: words instead of percentages (warm / warmer / very close)
    setRadioStatus(level >= 0.5 ? 'Very close! Look around this spot…'
      : level >= 0.25 ? 'Getting closer!'
        : level > 0 ? 'Belu hears something far away…'
          : 'Only static… press Click! to listen for echoes.');
  } else if (level > 0) {
    setRadioStatus(`Belu hears something… signal ${Math.round(level * 100)}%`);
  } else {
    setRadioStatus('Only static… keep looking.');
  }

  const readout = $('target-readout');
  const nearest = state.nearest;
  if (readout && nearest) {
    readout.textContent = `${nearest.target.label} · ${nearest.target.az.toFixed(0)}° ${compassPoint(nearest.target.az)} / ${nearest.target.alt.toFixed(0)}° · ${nearest.distance.toFixed(1)}° away`;
  }

  const pointingLine = $('pointing');
  if (pointingLine) {
    pointingLine.textContent = `Aiming: azimuth ${state.aiming.az.toFixed(0)}°, altitude ${state.aiming.alt.toFixed(0)}°`;
  }
}

function updateGuide() {
  const arrow = $('guide-arrow');
  const text = $('guide-text');
  if (!state.nearest || !arrow || !text) return;

  const guide = computeGuide(state.aiming, state.nearest.target);
  const below = state.nearest.target.alt < 0;

  // Smooth arrow: it turns gently toward the target instead of jumping with every sensor wobble.
  // Very close: no arrow (it would spin), a target sign instead.
  const onIt = guide.dist <= 6;
  state.arrowDeg = state.arrowDeg == null
    ? guide.rotateDeg
    : state.arrowDeg + normalize180(guide.rotateDeg - state.arrowDeg) * 0.3;
  arrow.textContent = onIt ? '◎' : '➜';
  arrow.style.transform = onIt ? 'none' : `rotate(${state.arrowDeg.toFixed(1)}deg)`;
  arrow.dataset.belowHorizon = below ? 'true' : 'false';

  const label = state.nearest.target.label;
  const message = state.lockProgress > 0
    ? "You're on it! Hold still."
    : below
      ? guide.dist <= 6
        ? `${label} is under the horizon, and Belu hears it through the Earth! Hold still.`
        : `${label} is below the horizon. Follow the arrow down: Belu hears it through the Earth!`
      : guideMessage(guide, state.nearest.target);

  // Only touch the DOM when the sentence changes, and not more than every 0.8 s
  // (degrees change all the time: a screen reader would re-read it constantly).
  const now = performance.now();
  const urgent = state.lockProgress > 0 || onIt;
  if (message !== state.lastGuideText && (urgent || now - (state.lastGuideAt || 0) > 800)) {
    state.lastGuideText = message;
    state.lastGuideAt = now;
    text.textContent = message;
    if (!isStory()) speak(message, { minGap: urgent ? 0 : 3500 });
  }
}

function updateDataSource() {
  const element = $('data-source');
  if (!element) return;
  const ceres = targetFor('ceres');
  const pioneer = targetFor('pioneer10');
  const observer = getObserver();
  element.textContent = `Data: Moon/Mars astronomy-engine · Ceres ${ceres?.source || '—'} · Pioneer 10 ${pioneer?.source || '—'} · observer ${observer.name}`;
}

/* ------------------------------------------------------------------ */
/* Lock → transition → story                                           */
/* ------------------------------------------------------------------ */

function lockTarget(target) {
  state.pinned = null;
  const candidates = state.robots.filter((robot) => robot.sky_target === target.id);
  const robot = candidates.find((candidate) => !state.found.has(candidate.id)) || candidates[0];
  if (!robot) {
    state.suppressUntil = performance.now() + 1800;
    setRadioStatus(`No robot is listening on ${target.label}.`, 'error');
    return;
  }

  state.suppressUntil = performance.now() + 2600;
  state.lockStart = null;
  state.lockProgress = 0;
  map?.stop();
  vibrate([90, 60, 160]);
  // Story mode: how many sonar clicks it took (stars on the first card)
  state.pendingFind = isStory() && !state.found.has(robot.id) ? { clicks: sonar.clicks } : null;
  sonar.reset();
  tuneTo(robot);
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

function openStory(robot) {
  state.lastRobot = robot;
  state.found.add(robot.id);
  muteRadio();

  // Story mode: the same robot, told as animated cards
  if (isStory()) {
    stopStory();
    let light = '';
    try { light = formatLightTime(getLightTime(robot.sky_target)); } catch { light = ''; }
    renderCounter();
    renderRobotList();
    map?.refresh();
    show('screen-cinema');
    updateFinaleButton();
    const find = state.pendingFind;
    state.pendingFind = null;
    showCinema(robot, {
      light,
      found: find ? { clicks: find.clicks, stars: starsFor(find.clicks) } : null,
      onMinigame: openMinigame,
      onFriend: friendAdded,
      onExit: backToRadio,
      canPlay: hasMinigame,
    });
    return;
  }
  stopCinema();

  const target = targetFor(robot.sky_target);
  const light = $('story-light');
  if (light) {
    try {
      light.textContent = target
        ? `Light-time from ${target.label}: ${formatLightTime(getLightTime(robot.sky_target))}`
        : '';
    } catch {
      light.textContent = '';
    }
  }

  renderCounter();
  renderRobotList();
  map?.refresh();
  show('screen-story');
  updateFinaleButton();
  showStory(robot, { onMinigame: openMinigame, onFriend: friendAdded });
}

function backToRadio() {
  stopStory();
  stopCinema();
  setSignal(0);
  state.suppressUntil = performance.now() + 1200;
  state.lockStart = null;
  state.lockProgress = 0;

  if (!state.antennaActive && map) {
    // Move the crosshair off the target, otherwise it locks again instantly.
    if (state.lastRobot) map.lookAt(state.lastRobot.sky_target, BELOW_HORIZON_LEAD);
    map.start();
  }

  refreshSky();
  show('screen-radio');
  setRadioStatus('Only static… keep looking.');
}

/* ------------------------------------------------------------------ */
/* Belu's friends                                                      */
/* ------------------------------------------------------------------ */

function updateFriendsButton() {
  $('btn-friends').textContent = `Belu's friends · ${countFriends(state.robots)}/${state.robots.length}`;
}

function openFriends() {
  stopStory();
  stopCinema();
  muteRadio();
  const n = countFriends(state.robots);
  $('friends-count').textContent = `${n} of ${state.robots.length} friends found`;
  renderFriends($('friends-grid'), state.robots, { onOpen: (robot) => openStory(robot) });
  show('screen-friends');
}

/* ------------------------------------------------------------------ */
/* Mini-game                                                           */
/* ------------------------------------------------------------------ */

function openMinigame(robot) {
  stopStory();
  stopCinema();
  show('screen-minigame');
  const game = minigameOf(robot);
  $('mg-title').textContent = game?.title || `Help ${robot.name}`;
  $('mg-intro').textContent = game?.intro || '';
  if (state.game) state.game.stop();
  state.game = startMinigame(robot, {
    canvas: $('mg-canvas'), hud: $('mg-hud'), controls: $('mg-controls'),
    result: $('mg-result'), resultTitle: $('mg-result-title'), resultText: $('mg-result-text'),
    retryButton: $('btn-mg-retry'),
  });
  if (DEBUG) window.__game = state.game;   // for testing
}

function closeMinigame() {
  if (state.game) state.game.stop();
  state.game = null;
  if (isStory()) {
    show('screen-cinema');
    resumeCinema();
  } else {
    show('screen-story');
  }
}

/* ------------------------------------------------------------------ */
/* Finale                                                              */
/* ------------------------------------------------------------------ */

function updateFinaleButton() {
  $('btn-finale').hidden = state.found.size < Math.min(FINALE_AT, state.robots.length);
}

function goFinale() {
  muteRadio();
  show('screen-finale');
  $('btn-finale-back').textContent = isStory() ? 'Why it matters ▸' : 'Back to Belu';
  openFinale({ onExit: () => (isStory() ? goWhy() : returnToSky()) });
}

function returnToSky() {
  setSignal(0);
  refreshSky();
  show('screen-radio');
  map?.start();
}

// Story mode ending: zoom out over the Solar System, then back to the sky
function goWhy() {
  show('screen-why');
  showWhy({
    robots: state.robots,
    isFound: (robot) => state.found.has(robot.id),
    onExplore: returnToSky,
    onScience: () => { setMode('science'); returnToSky(); },
  });
}

/* ------------------------------------------------------------------ */
/* Antenna and sky map                                                 */
/* ------------------------------------------------------------------ */

function onAntenna(direction) {
  if (!state.gotOrientation) {
    const canvas = $('skymap');
    if (canvas) canvas.hidden = true;
    $('skymap-wrap')?.classList.add('is-antenna');
    state.gotOrientation = true;
    state.antennaActive = true;
    map?.stop();
    setRadioStatus('Antenna live — point the back camera at the Moon, then calibrate.', 'ok');
  }
  onAim(direction, 'antenna');
}

async function startAntenna() {
  setRadioStatus('Requesting motion access…');
  try {
    await enableAntenna();
    state.antennaActive = true;
    state.gotOrientation = true;
    const canvas = $('skymap');
    if (canvas) canvas.hidden = true;
    $('skymap-wrap')?.classList.add('is-antenna');
    map?.stop();
    setAimButtons('antenna');
    $('btn-calibrate').hidden = false;
    setRadioStatus('Antenna live — point the back camera at the Moon, then calibrate.', 'ok');
  } catch (error) {
    state.antennaActive = false;
    $('btn-calibrate').hidden = true;
    setRadioStatus(error.message || 'Motion sensors unavailable. Use the sky map.', 'error');
    map?.start();
  }
}

// The two ways to aim, shown as one switch: the active one is highlighted
function setAimButtons(active) {
  for (const [id, name] of [['btn-antenna', 'antenna'], ['btn-map', 'map']]) {
    const button = $(id);
    if (!button) continue;
    button.classList.toggle('active', active === name);
    button.setAttribute('aria-pressed', String(active === name));
  }
}

function useSkyMap() {
  setAimButtons('map');
  disableAntenna();
  state.antennaActive = false;
  state.gotOrientation = false;
  const canvas = $('skymap');
  if (canvas) canvas.hidden = false;
  $('skymap-wrap')?.classList.remove('is-antenna');
  $('btn-calibrate').hidden = true;
  map?.start();
  setRadioStatus('Sky map live — drag it, or use the arrow keys.', 'ok');
}

function calibrateMoon() {
  if (!pointing.active) {
    setRadioStatus('Start the phone antenna before calibrating.', 'error');
    return;
  }
  const moon = targetFor('moon');
  if (!moon || moon.alt < 0) {
    setRadioStatus('The Moon is below the horizon right now: calibration skipped.', 'error');
    return;
  }
  try {
    const result = calibrate('moon');
    setRadioStatus(`Calibrated on the Moon (${signed(result.dAz)}° az, ${signed(result.dAlt)}° alt).`, 'ok');
  } catch (error) {
    setRadioStatus(error.message, 'error');
  }
}

/* ------------------------------------------------------------------ */
/* Debug                                                               */
/* ------------------------------------------------------------------ */

function showDebug(direction, source) {
  const element = $('debug');
  if (!element) return;
  const moon = targetFor('moon');
  const raw = direction.raw || {};
  element.textContent = [
    `src ${source}`,
    `aim ${state.aiming.az.toFixed(1)}/${state.aiming.alt.toFixed(1)}`,
    `moon ${moon ? `${moon.az.toFixed(1)}/${moon.alt.toFixed(1)}` : '—'}`,
    `raw α ${raw.alpha != null ? Number(raw.alpha).toFixed(1) : '—'} β ${raw.beta != null ? Number(raw.beta).toFixed(1) : '—'} γ ${raw.gamma != null ? Number(raw.gamma).toFixed(1) : '—'}`,
    `acc ${pointing.accuracy != null ? `${Number(pointing.accuracy).toFixed(0)}°` : '—'}`,
    `cal ${signed(pointing.offsetAz)}/${signed(pointing.offsetAlt)}`,
    `nearest ${state.nearest ? `${state.nearest.target.label} ${state.nearest.distance.toFixed(1)}°` : '—'}`,
    `level ${Math.round(state.level * 100)}%`,
  ].join(' · ');
}

/* ------------------------------------------------------------------ */
/* Geolocation                                                         */
/* ------------------------------------------------------------------ */

function locateUser() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setObserver({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        elevation: position.coords.altitude || 10,
        name: 'your location',
      });
      refreshSky();
      map?.centerOnMoon();
      setRadioStatus(`Sky for ${getObserver().name}.`, 'ok');
    },
    () => {
      // Tunis default is fine: the brief is written for Tunis.
    },
    { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 },
  );
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

// "How to find Belu's friends": shown the first time in each mode, and with the ? button
const COACH = {
  story: {
    goal: 'Find Belu\'s friends hidden in the sky!',
    steps: [
      ['👆', 'Drag the sky, or use your phone as an antenna'],
      ['🔊', 'Press Click! A friend answers with an echo'],
      ['➜', 'Follow the pink arrow'],
      ['◎', 'Hold still on the spot until Belu smiles'],
    ],
    start: 'Let\'s go!',
  },
  science: {
    goal: 'Point at the real sky to tune in to NASA\'s robots.',
    steps: [
      ['👆', 'Drag the sky map, or use your phone (calibrate on the Moon)'],
      ['➜', 'Follow the blue arrow to the nearest target'],
      ['◎', 'Keep the crosshair on it for 1.5 seconds'],
      ['📋', 'Open the list for every target and its coordinates'],
    ],
    start: 'Start',
  },
};

function showCoach(force = false) {
  const mode = isStory() ? 'story' : 'science';
  const key = `echo-station-coach-${mode}`;
  try { if (!force && localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { /* ignore */ }
  document.querySelector('dialog.coach')?.remove();
  const c = COACH[mode];
  const card = document.createElement('dialog');
  card.className = 'coach';
  card.setAttribute('aria-label', 'How to play');
  card.innerHTML = '<p class="mono coach-eyebrow">HOW TO PLAY</p><h3 class="coach-goal" tabindex="-1"></h3><ol class="coach-steps"></ol><button type="button" class="big coach-go"></button>';
  card.querySelector('.coach-goal').textContent = c.goal;
  for (const [icon, text] of c.steps) {
    const li = document.createElement('li');
    const i = document.createElement('span'); i.className = 'coach-icon'; i.setAttribute('aria-hidden', 'true'); i.textContent = icon;
    const t = document.createElement('span'); t.textContent = text;
    li.append(i, t);
    card.querySelector('.coach-steps').appendChild(li);
  }
  const go = card.querySelector('.coach-go');
  go.textContent = c.start;
  const close = () => { card.close(); card.remove(); $(isStory() ? 'btn-click' : 'skymap')?.focus({ preventScroll: true }); };
  go.addEventListener('click', close);
  card.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  document.body.appendChild(card);
  if (typeof card.showModal === 'function') card.showModal(); else card.setAttribute('open', '');
  card.querySelector('.coach-goal').focus({ preventScroll: true });
  speak(`How to play. ${c.goal} ${c.steps.map((s) => s[1]).join('. ')}.`, { interrupt: true });
}

function startListening() {
  startRadio();
  applySound();
  setSignal(0);
  locateUser();
  show('screen-radio');
  setTimeout(() => showCoach(), 300);
  refreshSky();
  map?.start();
  if (params.has('finale')) goFinale();   // shortcut for filming the video
}

// Belu's sonar (Story mode): the robots are hidden, echoes reveal them
const sonar = createSonar({
  getAim: () => state.aiming,
  getTargets: () => {
    const active = activeTargets(state.targets, state.robots, state.found);
    return active.length ? active : [];
  },
  mount: document.querySelector('#screen-radio .hud'),
});
document.addEventListener('keydown', (event) => {
  if (state.screen !== 'radio' || !isStory()) return;
  if ((event.key === 'c' || event.key === 'C') && !event.target.closest('input, textarea')) { sonar.ping(); pinNearest(); }
});
// The last friend: Belu and all his friends celebrate (Start over / Keep exploring)
function friendAdded() {
  updateFriendsButton();
  if (!state.celebrated && state.robots.length && countFriends(state.robots) === state.robots.length) {
    state.celebrated = true;
    window.setTimeout(() => celebrate(state.robots), isStory() ? 2600 : 700);
  }
}

// Story mode: the moving arrow comes first; Click! is optional and makes the arrow follow the friend heard
function pinNearest() {
  if (state.nearest) state.pinned = state.nearest.target.id;
}
$('btn-click')?.addEventListener('click', pinNearest);
{
  const guidePanel = $('guide'), sonarPanel = $('sonar');
  if (guidePanel && sonarPanel) guidePanel.after(sonarPanel);
}

// Scientist mode: straight to the sky
$('btn-start').addEventListener('click', () => {
  setMode('science');
  startListening();
});

// Story with Belu: the prologue first (the tap also unlocks the sound on iPhone)
$('btn-story')?.addEventListener('click', () => {
  setMode('story');
  startRadio();
  applySound();
  muteRadio();
  if (params.has('finale') || params.has('noprologue')) { startListening(); return; }
  playPrologue({ robots: state.robots, onDone: startListening });
});

// Switching mode in the middle of a story re-opens it in the other style
onModeChange(() => {
  if ((state.screen === 'story' || state.screen === 'cinema') && state.lastRobot) openStory(state.lastRobot);
  if (state.screen === 'radio') { map?.refresh(); showCoach(); }
});

$('btn-antenna')?.addEventListener('click', startAntenna);
{
  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'map-help';
  help.textContent = '?';
  help.setAttribute('aria-label', 'How to play');
  help.addEventListener('click', () => showCoach(true));
  $('antenna-controls')?.appendChild(help);
}
setAimButtons('map');
$('btn-map')?.addEventListener('click', useSkyMap);
$('btn-calibrate')?.addEventListener('click', calibrateMoon);
$('btn-back')?.addEventListener('click', backToRadio);
$('btn-skip')?.addEventListener('click', skipTyping);
$('btn-mg-back')?.addEventListener('click', closeMinigame);
$('btn-mg-done')?.addEventListener('click', closeMinigame);
$('btn-finale')?.addEventListener('click', goFinale);
$('btn-friends')?.addEventListener('click', openFriends);
$('btn-friends-back')?.addEventListener('click', () => { setSignal(0); refreshSky(); show('screen-radio'); map?.start(); });

if (DEBUG) $('debug')?.removeAttribute('hidden');

onPointing(onAntenna);

Promise.all([loadRobots(), loadSkyTables()])
  .then(([robots]) => {
    state.robots = robots;
    refreshSky();
    updateFriendsButton();
    updateFinaleButton();
    initMap();
    window.setInterval(() => {
      refreshSky();
      if (state.screen === 'radio' && state.nearest) {
        updateSignalUi();
        updateGuide();
      }
    }, SKY_REFRESH_MS);
  })
  .catch((error) => {
    console.error(error);
    setRadioStatus('Could not load the sky data. Run a local server (see README).', 'error');
    const list = $('target-list');
    if (list) list.textContent = 'Could not load the sky data.';
  });

// Drawn on top of the sky map, in both modes: the same signs everywhere
//   pink arrow  = the last echo (Story mode)       ring filling up = "hold still, locking on"
//   hint at the bottom until the player has moved the map once
function drawMapOverlay(context, info) {
  const { width, height } = info;
  if (isStory()) sonar.draw(context, info);
  const cx = width / 2, cy = height / 2;
  if (state.lockProgress > 0) {
    context.strokeStyle = 'rgba(93, 228, 255, 0.25)';
    context.lineWidth = 5;
    context.beginPath(); context.arc(cx, cy, 30, 0, Math.PI * 2); context.stroke();
    context.strokeStyle = '#5de4ff';
    context.beginPath(); context.arc(cx, cy, 30, -Math.PI / 2, -Math.PI / 2 + state.lockProgress * Math.PI * 2); context.stroke();
    if (isStory()) {
      context.fillStyle = '#eef0ff'; context.font = '700 13px Inter, sans-serif'; context.textAlign = 'center';
      context.fillText('Hold still…', cx, cy + 52);
    }
  }
  if (!state.dragged && !state.antennaActive) {
    const text = '👆 Drag the sky to look around';
    context.font = '600 13px Inter, sans-serif';
    const w = context.measureText(text).width + 24;
    context.fillStyle = 'rgba(11,10,31, 0.8)';
    context.beginPath(); context.roundRect(cx - w / 2, height - 44, w, 28, 14); context.fill();
    context.fillStyle = '#eef0ff'; context.textAlign = 'center';
    context.fillText(text, cx, height - 25);
  }
}

// A target whose robots are all found stays visible in Story mode
function targetDone(target) {
  const robots = state.robots.filter((robot) => robot.sky_target === target.id);
  return robots.length > 0 && robots.every((robot) => state.found.has(robot.id));
}

function initMap() {
  const canvas = $('skymap');
  if (!canvas) return;
  map = initSkyMap({
    canvas,
    onAim: (aim) => onAim(aim, 'map'),
    getTargets: () => state.targets,
    getRobots: () => state.robots,
    isFound: (robot) => state.found.has(robot.id),
    isHidden: (target) => isStory() && !targetDone(target),
    showGuide: () => !isStory(),
    simple: () => isStory(),
    overlay: drawMapOverlay,
  });
  canvas.addEventListener('pointerdown', () => { state.dragged = true; });
  canvas.addEventListener('keydown', () => { state.dragged = true; });

  // Handy for the phone debug session and for tests.
  window.EchoStation = { state, get pointing() { return pointing; }, map };
}
