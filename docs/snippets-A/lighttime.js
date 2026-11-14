/**
 * PARTIE 6.2 — lighttime.js
 * À coller à la fin de js/engine/sky.js (le fichier complet est déjà en place).
 *
 * 1 UA = 499.004783836 secondes de lumière.
 * Lune 1,4 s · Mars 11 min · Pioneer 10 19 h 36 min.
 */

export const AU_LIGHT_SECONDS = 499.004783836;

/** Temps de parcours de la lumière, en secondes, vers une cible. */
export function getLightTime(targetId, date = new Date()) {
  return getHorizontal(targetId, date).dist_au * AU_LIGHT_SECONDS;
}

/** "1.4 s" · "11 min" · "19 h 36 min" */
export function formatLightTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

/*
 * Pour le badge de l'écran Histoire (avec B) :
 *
 *   $('story-light').textContent =
 *     'Light-time: ' + formatLightTime(getLightTime(robot.sky_target));
 *
 * Lune et Mars sont calculées en direct ; Cérès et Pioneer 10 utilisent
 * dist_au du script Horizons.
 */
