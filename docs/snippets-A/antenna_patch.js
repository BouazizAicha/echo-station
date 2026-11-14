/**
 * PARTIE 3 — antenna_patch.js
 * À recopier dans js/engine/antenna.js (le fichier complet est déjà en place).
 *
 * Lissage du vecteur de direction + valeurs brutes pour ?debug.
 * On lisse le vecteur, pas les angles : 359° -> 0° ne fait pas un tour.
 */

let sv = null; // smoothed direction (unit vector)
const SMOOTH = 0.2; // 0 = frozen, 1 = no smoothing. 0.15–0.3 feels good, 0.1 if shaky

function smoothDir(p) {
  const r = Math.PI / 180;
  const v = [
    Math.cos(p.alt * r) * Math.sin(p.az * r), // East
    Math.cos(p.alt * r) * Math.cos(p.az * r), // North
    Math.sin(p.alt * r), // Up
  ];
  sv = sv ? sv.map((component, index) => component + SMOOTH * (v[index] - component)) : v;
  const n = Math.hypot(sv[0], sv[1], sv[2]);
  return {
    az: (Math.atan2(sv[0], sv[1]) / r + 360) % 360,
    alt: Math.asin(sv[2] / n) / r,
  };
}

function onOrientation(event) {
  // iPhone: webkitCompassHeading is already a true heading.
  // Do NOT use 360 - webkitCompassHeading: East would read 270.
  const heading = Number.isFinite(event.webkitCompassHeading)
    ? event.webkitCompassHeading
    : (360 - event.alpha + 360) % 360; // Android alpha turns counter-clockwise

  // Phone upright: beta = 90 -> horizon; beta = 135 -> 45° up.
  const alt = Math.max(-89.9, Math.min(89.9, event.beta - 90));

  const smoothed = smoothDir({ az: heading, alt });
  pointing.az = (smoothed.az + pointing.offsetAz + 360) % 360;
  pointing.alt = Math.max(-89.9, Math.min(89.9, smoothed.alt + pointing.offsetAlt));

  // Raw values are kept for the ?debug line only.
  pointing.raw = {
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
    webkitCompassHeading: event.webkitCompassHeading ?? null,
    absolute: Boolean(event.absolute),
  };
  pointing.accuracy = Number.isFinite(event.webkitCompassAccuracy)
    ? event.webkitCompassAccuracy
    : null;

  if (onDirection) onDirection(pointing);
}

/*
 * Rappels de test (brief, partie 2)
 * - Nord : téléphone debout, caméra arrière vers l'horizon -> aim az ≈ 0°, alt ≈ 0°.
 * - Est  : tourne de 90° -> aim az ≈ 90°. Si l'iPhone affiche 270°, tu es resté
 *          sur 360 - webkitCompassHeading : utilise la valeur directe ci-dessus.
 * - Hauteur : lève la caméra de 45° -> aim alt ≈ 45°.
 * - Stabilité : immobile 5 s, az doit varier de moins de 3°. Sinon SMOOTH = 0.1.
 * - Lune : vise la Lune, compare aim et moon, puis Calibrate -> aim ≈ moon.
 */
