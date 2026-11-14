/**
 * main_integration.js — les morceaux à ajouter dans js/main.js.
 * La version complète et testée est déjà dans js/main.js.
 *
 * Correspondance avec le brief :
 *   PARTIE 2  DEBUG, onAntenna(), showDebug()
 *   PARTIE 4  la flèche (guide.js) + les nouveaux seuils
 *   PARTIE 5  updateGuide()
 *   PARTIE 6  signal, verrouillage, délai lumière
 *   PARTIE 7  renderCounter()
 *   PARTIE 8  startSkyMap()
 *
 * Rappels de branchement :
 *   - remplacer onPointing(onAim) par onPointing(onAntenna) ;
 *   - supprimer state.gotOrientation = true au début de onAim()
 *     (il est maintenant dans onAntenna, car la carte appelle aussi onAim) ;
 *   - ajouter <p id="debug" class="mono"></p> dans l'écran radio ;
 *   - ajouter <canvas id="skymap"> et #guide / #counter (index_additions.html).
 */

/* ------------------------------------------------------------------ */
/* PARTIE 2 — DEBUG + onAntenna                                        */
/* ------------------------------------------------------------------ */

const DEBUG = new URLSearchParams(location.search).has('debug');

function onAntenna(direction) {
  if (!state.gotOrientation) {
    $('skymap').hidden = true; // the real antenna takes over from the map
    state.gotOrientation = true;
  }
  onAim(direction);
  if (DEBUG) showDebug(direction, 'antenna');
}

function showDebug(direction, source) {
  const moon = state.targets.find((target) => target.id === 'moon');
  const raw = direction.raw || {};
  $('debug').textContent = [
    `src ${source}`,
    `aim ${state.aiming.az.toFixed(1)}/${state.aiming.alt.toFixed(1)}`,
    `moon ${moon ? `${moon.az.toFixed(1)}/${moon.alt.toFixed(1)}` : '—'}`,
    `raw α ${raw.alpha?.toFixed?.(1) ?? '—'} β ${raw.beta?.toFixed?.(1) ?? '—'} γ ${raw.gamma?.toFixed?.(1) ?? '—'}`,
    `acc ${direction.accuracy != null ? `${direction.accuracy.toFixed(0)}°` : '—'}`,
    `cal ${pointing.offsetAz.toFixed(1)}/${pointing.offsetAlt.toFixed(1)}`,
    `nearest ${state.nearest ? `${state.nearest.target.label} ${state.nearest.distance.toFixed(1)}°` : '—'}`,
    `level ${Math.round(state.level * 100)}%`,
  ].join(' · ');
}

// Au démarrage :
// if (DEBUG) document.body.classList.add('is-debug');

/* ------------------------------------------------------------------ */
/* PARTIE 4 — seuils + flèche                                          */
/* ------------------------------------------------------------------ */

const TOLERANCE_DEG = 20; // before 15
const LOCK_LEVEL = 0.7; // before 0.85 -> lock within ~6° instead of 2.25°
const LOCK_TIME_MS = 1500; // unchanged

// import { computeGuide, guideMessage } from './engine/guide.js';
// import { initSkyMap } from './engine/skymap.js';

/* ------------------------------------------------------------------ */
/* PARTIE 5 — updateGuide                                              */
/* ------------------------------------------------------------------ */

function updateGuide() {
  if (!state.nearest) return;
  const guide = computeGuide(state.aiming, state.nearest.target);
  const below = state.nearest.target.alt < 0;
  // No arrow toward a target under the horizon: dim it instead.
  $('guide-arrow').style.transform = `rotate(${below ? 0 : guide.rotateDeg.toFixed(1)}deg)`;
  $('guide-arrow').dataset.belowHorizon = below ? 'true' : 'false';

  const message = state.lockProgress > 0
    ? "You're on it! Hold still."
    : guideMessage(guide, state.nearest.target);

  // Only write if the text changed: a screen reader would otherwise
  // re-read it 60 times per second.
  if (message !== state.lastGuideText) {
    state.lastGuideText = message;
    $('guide-text').textContent = message;
  }
}

/* ------------------------------------------------------------------ */
/* PARTIE 6 — signal, verrouillage, délai lumière                      */
/* ------------------------------------------------------------------ */

/*
 * strength = 1 - angularDistance(aim, target) / TOLERANCE_DEG
 * Lock when strength >= LOCK_LEVEL for LOCK_TIME_MS.
 * 0.7 with TOLERANCE 20 is exactly 6°, the same threshold as the arrow's
 * "You're on it! Hold still." message.
 */

function onAim(direction, source = 'map') {
  state.aiming = { az: direction.az, alt: direction.alt };
  if (state.screen !== 'radio') return;

  const nearest = chooseNearest(state.aiming);
  if (!nearest) return;
  state.nearest = nearest;
  state.level = Math.max(0, Math.min(1, 1 - nearest.distance / TOLERANCE_DEG));

  const now = performance.now();
  if (state.level >= LOCK_LEVEL && now >= state.suppressUntil) {
    if (state.lockStart === null) state.lockStart = now;
    const held = now - state.lockStart;
    state.lockProgress = Math.min(1, held / LOCK_TIME_MS);
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

  if (now - state.lastUiAt >= 80) {
    state.lastUiAt = now;
    updateSignalUi();
    updateGuide();
    if (DEBUG) showDebug(direction, source);
  }
}

function lockRobot(target) {
  const robot = state.robots.find(
    (candidate) => candidate.sky_target === target.id && !state.found.has(candidate.id),
  );
  if (!robot) {
    state.suppressUntil = performance.now() + 1800;
    return;
  }
  state.found.add(robot.id);
  saveFound();
  renderCounter();
  renderRobotList();
  state.suppressUntil = performance.now() + 2200;
  openLockPanel(robot, target); // B replaces this with the story
}

// Light-time badge (see lighttime.js):
// $('story-light').textContent =
//   'Light-time: ' + formatLightTime(getLightTime(robot.sky_target));

/* ------------------------------------------------------------------ */
/* PARTIE 7 — compteur                                                 */
/* ------------------------------------------------------------------ */

const GROUPS = [
  { id: 'moon', label: 'Moon', targets: ['moon'] },
  { id: 'mars', label: 'Mars', targets: ['mars'] },
  { id: 'far', label: 'Far', targets: ['ceres', 'pioneer10'] },
];

function renderCounter() {
  const container = $('counter');
  container.innerHTML = '';
  for (const group of GROUPS) {
    const robots = state.robots.filter((robot) => group.targets.includes(robot.sky_target));
    const found = robots.filter((robot) => state.found.has(robot.id)).length;
    const item = document.createElement('span');
    item.className = 'counter-item';
    item.textContent = `${group.label} ${found}/${robots.length}`;
    item.dataset.complete = found === robots.length && robots.length > 0 ? 'true' : 'false';
    container.append(item);
  }
}

// Appeler renderCounter() après le chargement des robots et après chaque
// openStory(). Résultat attendu : Moon 0/1 · Mars 1/3 · Far 0/2.

/* ------------------------------------------------------------------ */
/* PARTIE 8 — la carte du ciel                                         */
/* ------------------------------------------------------------------ */

let map = null;

function startSkyMap() {
  map = initSkyMap({
    canvas: $('skymap'),
    onAim: (aim) => onAim(aim, 'map'),
    getTargets: () => state.targets,
    getRobots: () => state.robots,
    isFound: (robot) => state.found.has(robot.id),
  });
  map.start();
}

// Dans initSkyTable().then(() => { renderRobotList(); renderCounter(); startSkyMap(); });

/*
 * Détails indispensables (brief 6.1) :
 *   - #skymap[hidden] { display: none; } sinon la carte ne se cache pas
 *     quand l'antenne prend le relais ;
 *   - la carte envoie son centre à la même fonction onAim() toutes les 100 ms ;
 *   - la Lune est toujours dessinée, les cibles inconnues sont des anneaux
 *     qui pulsent, un robot trouvé devient un point vert avec son nom ;
 *   - au démarrage la vue est décalée de 15° pour que la Lune soit à gauche.
 */
