/**
 * main.js — Dev A integration (sky, antenna, guide, sky map, counter).
 *
 * The story screen, voices, radio static, transition and finale belong to
 * Dev B. This harness stops at the lock panel so the antenna can be tested
 * on real phones tonight; B replaces `openLockPanel()` with the story.
 *
 * Signal: strength = 1 - distance / TOLERANCE_DEG.
 * Lock: strength stays >= LOCK_LEVEL for LOCK_TIME_MS.
 * With 20 / 0.7 / 1500 that is about 6° held for 1.5 s.
 */

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
  enableAntenna,
  disableAntenna,
  onPointing,
  pointing,
} from './engine/antenna.js';
import { computeGuide, guideMessage } from './engine/guide.js';
import { initSkyMap } from './engine/skymap.js';
import { pickTarget } from './engine/targeting.js';

const TOLERANCE_DEG = 20;
const LOCK_LEVEL = 0.7;
const LOCK_TIME_MS = 1500;
const SKY_REFRESH_MS = 10000;
const STORAGE_KEY = 'echo-station-found-v1';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const START_ON_MAP = params.has('map');

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
  gotOrientation: false,
  antennaActive: false,
  lastUiAt: 0,
  lastGuideText: '',
  skyRefreshTimer: 0,
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

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

async function loadRobots() {
  const response = await fetch(new URL('data/robots/index.json', document.baseURI), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`robots index: HTTP ${response.status}`);
  const documentObject = await response.json();
  const entries = Array.isArray(documentObject) ? documentObject : (documentObject.robots || []);

  const robots = [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      try {
        const robotResponse = await fetch(new URL(`data/robots/${entry}.json`, document.baseURI));
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

function loadFound() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) stored.forEach((id) => state.found.add(id));
  } catch {
    // Private mode, quota, corrupted value: start fresh.
  }
}

function saveFound() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.found]));
  } catch {
    // Not essential.
  }
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

function show(screenName) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.classList.toggle('is-active', screen.id === `screen-${screenName}`);
  }
  state.screen = screenName;
  document.body.dataset.screen = screenName;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function toast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('is-visible'), 3200);
}

function setStatus(message, kind = '') {
  const element = $('antenna-status');
  if (!element) return;
  element.textContent = message;
  element.dataset.kind = kind;
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
    const item = document.createElement('span');
    item.className = 'counter-item';
    item.textContent = `${group.label} ${found}/${total}`;
    item.dataset.complete = found === total && total > 0 ? 'true' : 'false';
    container.append(item);
  }
}

function renderRobotList() {
  const container = $('target-list');
  if (!container) return;
  container.innerHTML = '';

  for (const target of state.targets) {
    const robots = state.robots.filter((robot) => robot.sky_target === target.id);
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
      map.start();
      map.lookAt(target.id);
      toast(`Sky map centred on ${target.label}.`);
    });

    item.append(info, count, button);
    container.append(item);
  }
}

/* ------------------------------------------------------------------ */
/* Sky, signal, guide                                                  */
/* ------------------------------------------------------------------ */

function refreshSky() {
  state.targets = getSkyTargets();
  const observerElement = $('observer-name');
  if (observerElement) {
    const observer = getObserver();
    observerElement.textContent = `${observer.name} · ${observer.latitude.toFixed(2)}°, ${observer.longitude.toFixed(2)}°`;
  }
  renderRobotList();
  if (map) map.refresh();
}

function chooseNearest(aim) {
  return pickTarget(aim, state.targets, state.robots, state.found);
}

/**
 * The single entry point for both the antenna and the sky map.
 * @param {{az:number, alt:number, raw?:object}} direction
 * @param {'antenna'|'map'} source
 */
function onAim(direction, source = 'map') {
  state.aiming = { az: direction.az, alt: direction.alt };
  if (state.screen !== 'radio') return;

  const nearest = chooseNearest(state.aiming);
  if (!nearest) return;
  state.nearest = nearest;

  const level = clamp(1 - nearest.distance / TOLERANCE_DEG, 0, 1);
  state.level = level;

  const now = performance.now();
  if (level >= LOCK_LEVEL && now >= state.suppressUntil) {
    if (state.lockStart === null) state.lockStart = now;
    const held = now - state.lockStart;
    state.lockProgress = clamp(held / LOCK_TIME_MS, 0, 1);
    if (held >= LOCK_TIME_MS) {
      state.lockStart = null;
      state.lockProgress = 0;
      lockRobot(nearest.target);
      return;
    }
  } else {
    state.lockStart = null;
    state.lockProgress = 0;
  }

  // UI at ~12 Hz; sensors can fire at 60 Hz.
  if (now - state.lastUiAt >= 80) {
    state.lastUiAt = now;
    updateSignalUi();
    updateGuide();
    if (DEBUG) showDebug(direction, source);
  }
}

function updateSignalUi() {
  const fill = $('signal-fill');
  const text = $('signal-text');
  const targetName = $('target-name');
  const targetCoords = $('target-coords');
  const reticle = $('guide');

  if (fill) fill.style.transform = `scaleX(${state.level.toFixed(3)})`;
  if (reticle) reticle.style.setProperty('--lock', state.lockProgress.toFixed(3));

  const locked = state.lockProgress > 0;
  if (text) {
    if (locked) text.textContent = "You're on it! Hold still.";
    else if (state.level > 0) text.textContent = `Signal ${Math.round(state.level * 100)}%`;
    else text.textContent = 'Searching — follow the arrow';
  }

  const nearest = state.nearest;
  if (nearest) {
    if (targetName) targetName.textContent = nearest.target.label;
    if (targetCoords) {
      targetCoords.textContent = `AZ ${nearest.target.az.toFixed(1)}° ${compassPoint(nearest.target.az)} · ALT ${nearest.target.alt.toFixed(1)}° · ${nearest.distance.toFixed(1)}° away`;
    }
  }

  const source = $('data-source');
  if (source) {
    const ceres = state.targets.find((target) => target.id === 'ceres');
    const pioneer = state.targets.find((target) => target.id === 'pioneer10');
    source.textContent = `Moon/Mars: astronomy-engine · Ceres: ${ceres?.source || '—'} · Pioneer 10: ${pioneer?.source || '—'}`;
  }
}

function updateGuide() {
  const arrow = $('guide-arrow');
  const text = $('guide-text');
  if (!state.nearest || !arrow || !text) return;

  const guide = computeGuide(state.aiming, state.nearest.target);
  const below = state.nearest.target.alt < 0;

  // Below the horizon: translucent ground, message, arrow dimmed but rotatable
  arrow.style.transform = `rotate(${guide.rotateDeg.toFixed(1)}deg)`;
  arrow.dataset.belowHorizon = below ? 'true' : 'false';

  const message = state.lockProgress > 0
    ? "You're on it! Hold still."
    : below
      ? "Below the horizon: Belu hears it through the Earth!"
      : guideMessage(guide, state.nearest.target);

  // Only touch the DOM when the sentence changes: a screen reader would
  // otherwise re-read it 12 times a second.
  if (message !== state.lastGuideText) {
    state.lastGuideText = message;
    text.textContent = message;
  }
}

/* ------------------------------------------------------------------ */
/* Lock                                                                */
/* ------------------------------------------------------------------ */

function lockRobot(target) {
  const robot = state.robots.find(
    (candidate) => candidate.sky_target === target.id && !state.found.has(candidate.id),
  );
  if (!robot) {
    toast(`All robots on ${target.label} are already found.`);
    state.suppressUntil = performance.now() + 1800;
    return;
  }

  state.found.add(robot.id);
  saveFound();
  renderCounter();
  renderRobotList();
  state.suppressUntil = performance.now() + 2200;
  state.lockStart = null;
  state.lockProgress = 0;

  openLockPanel(robot, target);
}

/**
 * Dev A stops here. Dev B replaces this panel with the real story screen.
 */
function openLockPanel(robot, target) {
  const name = $('lock-name');
  const light = $('lock-light');
  const coords = $('lock-coords');
  if (name) name.textContent = robot.name;
  if (light) {
    try {
      light.textContent = `Light-time from ${target.label}: ${formatLightTime(getLightTime(target.id))}`;
    } catch {
      light.textContent = 'Light-time: —';
    }
  }
  if (coords) {
    coords.textContent = `AZ ${target.az.toFixed(1)}° ${compassPoint(target.az)} · ALT ${target.alt.toFixed(1)}°`;
  }
  map?.stop();
  show('lock');
}

function closeLockPanel() {
  show('radio');
  if (!state.antennaActive) map?.start();
  else map?.stop();
}

/* ------------------------------------------------------------------ */
/* Antenna                                                             */
/* ------------------------------------------------------------------ */

/**
 * Called by antenna.js for every smoothed sensor reading.
 * First reading: the real antenna takes over from the sky map.
 */
function onAntenna(direction) {
  if (!state.gotOrientation) {
    const canvas = $('skymap');
    if (canvas) canvas.hidden = true;
    $('skymap-wrap')?.classList.add('is-antenna');
    state.gotOrientation = true;
    state.antennaActive = true;
    map?.stop();
    setStatus('Antenna live — point the back camera at the Moon, then calibrate.', 'ok');
  }
  onAim(direction, 'antenna');
}

async function startAntenna() {
  setStatus('Requesting motion access…');
  try {
    await enableAntenna();
    state.antennaActive = true;
    const canvas = $('skymap');
    if (canvas) canvas.hidden = true;
    $('skymap-wrap')?.classList.add('is-antenna');
    map?.stop();
    state.gotOrientation = true;
    setStatus('Antenna live — point the back camera at the Moon, then calibrate.', 'ok');
    toast('Motion sensors active. Aim at the Moon and tap Calibrate.');
  } catch (error) {
    state.antennaActive = false;
    setStatus(error.message || 'Motion sensors unavailable. Use the sky map.', 'error');
    toast('Antenna unavailable. The sky map still works.');
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
  map?.start();
  setStatus('Sky map live — drag, use the arrow keys, or Shift + arrows.', 'ok');
}

function calibrateMoon() {
  if (!pointing.active) {
    toast('Start the phone antenna before calibrating.');
    return;
  }
  try {
    const result = calibrate('moon');
    toast(`Calibrated: ${signed(result.dAz)}° azimuth, ${signed(result.dAlt)}° altitude.`);
    setStatus(`Calibrated on the Moon (${signed(result.dAz)}° az).`, 'ok');
  } catch (error) {
    toast(error.message);
  }
}

/* ------------------------------------------------------------------ */
/* Debug                                                               */
/* ------------------------------------------------------------------ */

function showDebug(direction, source) {
  const element = $('debug');
  if (!element) return;
  const moon = state.targets.find((target) => target.id === 'moon');
  const raw = direction.raw || {};
  const calibration = pointing;
  element.textContent = [
    `src ${source}`,
    `aim ${state.aiming.az.toFixed(1)}/${state.aiming.alt.toFixed(1)}`,
    `moon ${moon ? `${moon.az.toFixed(1)}/${moon.alt.toFixed(1)}` : '—'}`,
    `raw α ${raw.alpha != null ? Number(raw.alpha).toFixed(1) : '—'} β ${raw.beta != null ? Number(raw.beta).toFixed(1) : '—'} γ ${raw.gamma != null ? Number(raw.gamma).toFixed(1) : '—'}`,
    `acc ${pointing.accuracy != null ? `${Number(pointing.accuracy).toFixed(0)}°` : '—'}`,
    `cal ${signed(calibration.offsetAz)}/${signed(calibration.offsetAlt)}`,
    `nearest ${state.nearest ? `${state.nearest.target.label} ${state.nearest.distance.toFixed(1)}°` : '—'}`,
    `level ${Math.round(state.level * 100)}%`,
  ].join(' · ');
}

/* ------------------------------------------------------------------ */
/* Geolocation                                                         */
/* ------------------------------------------------------------------ */

function locate() {
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
      toast('Using your location for the sky.');
    },
    () => {
      // Tunis default is fine; the brief is written for Tunis.
    },
    { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 },
  );
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function boot() {
  if (DEBUG) {
    document.body.classList.add('is-debug');
    $('debug')?.removeAttribute('hidden');
  }
  loadFound();

  $('start-button')?.addEventListener('click', () => {
    show('radio');
    map?.start();
    refreshSky();
    locate();
    if (START_ON_MAP) useSkyMap();
  });

  $('radio-back')?.addEventListener('click', () => show('intro'));
  $('btn-antenna')?.addEventListener('click', startAntenna);
  $('btn-map')?.addEventListener('click', useSkyMap);
  $('btn-calibrate')?.addEventListener('click', calibrateMoon);
  $('lock-continue')?.addEventListener('click', closeLockPanel);

  try {
    const [robots] = await Promise.all([loadRobots(), loadSkyTables()]);
    state.robots = robots;
  } catch (error) {
    console.error(error);
    setStatus('Could not load the robot list. Check data/robots/index.json.', 'error');
  }

  state.targets = getSkyTargets();
  renderCounter();
  renderRobotList();

  map = initSkyMap({
    canvas: $('skymap'),
    onAim: (aim) => onAim(aim, 'map'),
    getTargets: () => state.targets,
    getRobots: () => state.robots,
    isFound: (robot) => state.found.has(robot.id),
  });

  onPointing(onAntenna);

  state.skyRefreshTimer = window.setInterval(() => {
    refreshSky();
    if (state.screen === 'radio' && state.nearest) {
      updateSignalUi();
      updateGuide();
    }
  }, SKY_REFRESH_MS);

  const counter = $('counter');
  if (counter && counter.childElementCount === 0) renderCounter();

  // Handy for the phone debug session and for tests.
  window.EchoStation = { state, get pointing() { return pointing; }, map };
}

boot().catch((error) => {
  console.error('[Echo Station] boot failed:', error);
  setStatus('Startup failed. Open the console for details.', 'error');
});
