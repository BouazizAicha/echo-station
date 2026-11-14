// ===== js/main.js – what to add (Dev A) =====

// ---- 1. Imports (top of the file) ----
import { computeGuide } from './engine/guide.js';
import { initSkyMap } from './engine/skymap.js';
import { getLightTime, formatLightTime } from './engine/sky.js';   // after pasting lighttime.js into sky.js

// ---- 2. Debug mode: open the site with ?debug at the end of the URL ----
const DEBUG = new URLSearchParams(location.search).has('debug');

// ---- 3. Names shown on the sky map ----
const TARGET_NAMES = { moon: 'Moon', mars: 'Mars', ceres: 'Ceres', pioneer10: 'Pioneer 10' };

// ---- 4. Antenna events go through this wrapper (the sky map calls onAim directly) ----
function onAntenna(dir) {
  if (!state.gotOrientation) $('skymap').hidden = true;   // the real antenna takes over from the map
  state.gotOrientation = true;
  onAim(dir);
  if (DEBUG) showDebug(dir);
}
// …and at the bottom of main.js, replace  onPointing(onAim);  by:
onPointing(onAntenna);
// …and REMOVE the line  state.gotOrientation = true;  from onAim().

// ---- 5. Guidance arrow: call this at the end of onAim(dir) ----
function updateGuide(dir) {
  const positions = targetPositions();
  const unfound = new Set(state.robots.filter(r => !state.found.has(r.id)).map(r => r.sky_target));
  const candidates = Object.entries(positions)
    .filter(([target]) => !unfound.size || unfound.has(target));   // guide towards robots not found yet
  const visible = candidates.filter(([, pos]) => pos.alt > 0);      // prefer targets above the horizon
  let best = null;
  for (const [target, pos] of (visible.length ? visible : candidates)) {
    const d = angularDistance(dir, pos);
    if (!best || d < best.d) best = { target, pos, d };
  }
  if (!best) { $('guide').hidden = true; return; }
  const { rotateDeg, text } = computeGuide(dir, best.pos);
  $('guide').hidden = false;
  $('guide-arrow').style.transform = `rotate(${rotateDeg}deg)`;
  if ($('guide-text').textContent !== text) $('guide-text').textContent = text; // no screen-reader spam
}

// ---- 6. Debug panel ----
function showDebug(dir) {
  const moon = targetPositions().moon;
  const r = dir.raw || {};
  $('debug').textContent =
    `aim az ${dir.az.toFixed(1)} alt ${dir.alt.toFixed(1)} | ` +
    `moon az ${moon ? moon.az.toFixed(1) : '?'} alt ${moon ? moon.alt.toFixed(1) : '?'} | ` +
    `${r.type} abs=${r.absolute} a=${r.alpha?.toFixed(0)} b=${r.beta?.toFixed(0)} g=${r.gamma?.toFixed(0)} ` +
    `head=${r.heading?.toFixed?.(0)} acc=${r.accuracy} off=${r.offset?.toFixed(1)} | ` +
    `lat ${state.observer.lat.toFixed(2)} lon ${state.observer.lon.toFixed(2)}`;
}

// ---- 7. Counter "Moon 0/1 · Mars 1/3 · Far 0/2" ----
const GROUPS = { moon: 'Moon', mars: 'Mars' };            // anything else = 'Far'
function renderCounter() {
  const counts = {};
  for (const r of state.robots) {
    const g = GROUPS[r.body] || 'Far';
    counts[g] ??= { found: 0, total: 0 };
    counts[g].total += 1;
    if (state.found.has(r.id)) counts[g].found += 1;
  }
  $('counter').textContent = Object.entries(counts).map(([g, c]) => `${g} ${c.found}/${c.total}`).join('  ·  ');
}
// Call renderCounter() after loadRobots() (in the .then) and inside openStory().

// ---- 8. Sky map: call once, after loadRobots() ----
function startSkyMap() {
  state.skymap = initSkyMap($('skymap'), {
    getTargets: () => Object.entries(targetPositions())
      .map(([target, pos]) => ({ target, pos, label: TARGET_NAMES[target] || target })),
    isFound: target => state.robots.filter(r => r.sky_target === target).every(r => state.found.has(r.id)),
    onAim,
  });
  // Start with the Moon visible on screen, but not in the centre (otherwise Eagle locks at once)
  const moon = targetPositions().moon;
  if (moon && moon.alt > 0) state.skymap.lookAt((moon.az + 25) % 360, Math.max(10, moon.alt - 5));
}

// ---- 9. Light-time badge (give this to B for the story screen) ----
// $('story-light').textContent = 'Light-time: ' + formatLightTime(getLightTime(robot.sky_target));
