// Echo Station – integrated flow: intro → Belu listens (antenna / sky map) → story → friends, mini-game, finale.
// Role A (sky, antenna, guide, sky map, counter, light-time) with role B's story untouched.
import { startRadio, setSignal, muteRadio } from './story/radio.js';
import { showStory, stopStory, skipTyping } from './story/story.js';
import { playTransition } from './story/transition.js';
import { startMinigame, hasMinigame } from './story/minigames/index.js';
import { openFinale } from './story/finale.js';
import { renderFriends, countFriends } from './story/friends.js';
// Story mode (Dev B): mode choice, prologue, cinematic stories, "Why it matters"
import { isStory, setMode, onModeChange } from './story/mode.js';
import { playPrologue } from './story/prologue.js';
import { showCinema, stopCinema, resumeCinema } from './story/cinema.js';
import { showWhy } from './story/why.js';

import {
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
import { pickTarget } from './engine/targeting.js';

const TOLERANCE_DEG = 20;   // signal reaches 0 at 20° from the target
const LOCK_LEVEL = 0.7;     // 70% of that = about 6° away
const LOCK_TIME_MS = 1500;  // hold still this long to lock on
const FINALE_AT = 3;        // robots to find before the finale unlocks
const SKY_REFRESH_MS = 10000;
const BELOW_HORIZON_LEAD = 35; // nudge the map after a story so it does not re-lock

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const state = {
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

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-button';
    button.textContent = 'Look';
    button.disabled = target.alt < 0;
    button.addEventListener('click', () => {
      if (!map) return;
      if (state.antennaActive) useSkyMap();
      map.start();
      map.lookAt(target.id);
      setRadioStatus(`Sky map centred on ${target.label}.`, 'ok');
    });

    item.append(info, count, button);
    container.append(item);
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

  const nearest = pickTarget(state.aiming, state.targets, state.robots, state.found);
  if (!nearest) return;
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

  const guide = $('guide');
  if (guide) guide.style.setProperty('--lock', state.lockProgress.toFixed(3));

  if (state.lockProgress > 0) {
    setRadioStatus("You're on it! Hold still…");
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

  // No arrow toward a target under the horizon: dim it and stop spinning.
  arrow.style.transform = `rotate(${below ? 0 : guide.rotateDeg.toFixed(1)}deg)`;
  arrow.dataset.belowHorizon = below ? 'true' : 'false';

  const message = state.lockProgress > 0
    ? "You're on it! Hold still."
    : guideMessage(guide, state.nearest.target);

  // Only touch the DOM when the sentence changes: a screen reader would
  // otherwise re-read it 12 times a second.
  if (message !== state.lastGuideText) {
    state.lastGuideText = message;
    text.textContent = message;
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
    showCinema(robot, {
      light,
      onMinigame: openMinigame,
      onFriend: updateFriendsButton,
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
  showStory(robot, { onMinigame: openMinigame, onFriend: updateFriendsButton });
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
  $('mg-title').textContent = `Help ${robot.name}`;
  $('mg-intro').textContent = robot.minigame?.intro || '';
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
    $('btn-antenna').hidden = true;
    $('btn-calibrate').hidden = false;
    setRadioStatus('Antenna live — point the back camera at the Moon, then calibrate.', 'ok');
  } catch (error) {
    state.antennaActive = false;
    $('btn-calibrate').hidden = true;
    setRadioStatus(error.message || 'Motion sensors unavailable. Use the sky map.', 'error');
    map?.start();
  }
}

function useSkyMap() {
  disableAntenna();
  state.antennaActive = false;
  state.gotOrientation = false;
  const canvas = $('skymap');
  if (canvas) canvas.hidden = false;
  $('skymap-wrap')?.classList.remove('is-antenna');
  $('btn-antenna').hidden = false;
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

function startListening() {
  startRadio();
  setSignal(0);
  locateUser();
  show('screen-radio');
  refreshSky();
  map?.start();
  if (params.has('finale')) goFinale();   // shortcut for filming the video
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
  muteRadio();
  if (params.has('finale') || params.has('noprologue')) { startListening(); return; }
  playPrologue({ robots: state.robots, onDone: startListening });
});

// Switching mode in the middle of a story re-opens it in the other style
onModeChange(() => {
  if ((state.screen === 'story' || state.screen === 'cinema') && state.lastRobot) openStory(state.lastRobot);
});

$('btn-antenna')?.addEventListener('click', startAntenna);
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

function initMap() {
  const canvas = $('skymap');
  if (!canvas) return;
  map = initSkyMap({
    canvas,
    onAim: (aim) => onAim(aim, 'map'),
    getTargets: () => state.targets,
    getRobots: () => state.robots,
    isFound: (robot) => state.found.has(robot.id),
  });

  // Handy for the phone debug session and for tests.
  window.EchoStation = { state, get pointing() { return pointing; }, map };
}
