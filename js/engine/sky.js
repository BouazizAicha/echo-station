/**
 * sky.js — where the robots really are.
 *
 * Moon and Mars  : computed live by astronomy-engine.
 * Ceres, Pioneer 10 : interpolated from NASA/JPL Horizons tables in data/sky/.
 *
 * All directions returned here are horizontal coordinates for the current
 * observer (Tunis by default, replaced by geolocation when allowed),
 * corrected for atmospheric refraction.
 */

import * as Astronomy from '../lib/astronomy.browser.min.js';

/** Seconds of light travel per astronomical unit. */
export const AU_LIGHT_SECONDS = 499.004783836;

export const TARGET_LABELS = {
  moon: 'Moon',
  mars: 'Mars',
  ceres: 'Ceres',
  pioneer10: 'Pioneer 10',
};

export const TARGET_IDS = ['moon', 'mars', 'ceres', 'pioneer10'];

const BODIES = {
  moon: Astronomy.Body.Moon,
  mars: Astronomy.Body.Mars,
};

export const DEFAULT_OBSERVER = {
  name: 'Tunis',
  latitude: 36.8065,
  longitude: 10.1815,
  elevation: 10,
};

let observer = new Astronomy.Observer(
  DEFAULT_OBSERVER.latitude,
  DEFAULT_OBSERVER.longitude,
  DEFAULT_OBSERVER.elevation,
);

let observerName = DEFAULT_OBSERVER.name;

/** Used only when a Horizons file is missing (values from the brief). */
const FALLBACK = {
  ceres: { ra: 7.7198, dec: 24.6814, dist_au: 2.02, source: 'fallback' },
  pioneer10: { ra: 5.318056, dec: 26.116667, dist_au: 141.0, source: 'fallback' },
};

/** @type {{ceres: object|null, pioneer10: object|null}} */
const tables = { ceres: null, pioneer10: null };

/**
 * Change the observer (called by main.js after geolocation).
 * @param {{latitude:number, longitude:number, elevation?:number, name?:string}} next
 */
export function setObserver(next) {
  const latitude = Number(next.latitude);
  const longitude = Number(next.longitude);
  const elevation = Number.isFinite(Number(next.elevation)) ? Number(next.elevation) : 10;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  observer = new Astronomy.Observer(latitude, longitude, elevation);
  observerName = next.name || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

export function getObserver() {
  return {
    name: observerName,
    latitude: observer.latitude,
    longitude: observer.longitude,
    elevation: observer.height,
  };
}

function prepareTable(name, documentObject) {
  if (!documentObject || typeof documentObject !== 'object') return null;

  if (documentObject.static && Number.isFinite(Number(documentObject.ra))) {
    return {
      name,
      source: documentObject.source || 'static fallback',
      static: true,
      ra: Number(documentObject.ra),
      dec: Number(documentObject.dec),
      dist_au: Number(documentObject.dist_au),
    };
  }

  const points = Array.isArray(documentObject.points) ? documentObject.points : [];
  const parsed = points
    .map((point) => ({
      t: Date.parse(point.t),
      ra: Number(point.ra),
      dec: Number(point.dec),
      dist_au: Number(point.dist_au),
    }))
    .filter((point) => (
      Number.isFinite(point.t)
      && Number.isFinite(point.ra)
      && Number.isFinite(point.dec)
      && Number.isFinite(point.dist_au)
    ))
    .sort((a, b) => a.t - b.t);

  if (!parsed.length) return null;
  return {
    name,
    source: documentObject.source || 'NASA/JPL Horizons',
    static: false,
    points: parsed,
  };
}

/**
 * Load the two Horizons tables. Safe to call more than once.
 * @param {string} [baseUrl] defaults to document.baseURI
 */
export async function loadSkyTables(baseUrl) {
  const root = baseUrl || (typeof document !== 'undefined' ? document.baseURI : undefined);
  if (!root) throw new Error('loadSkyTables needs a baseUrl outside the browser.');

  await Promise.all(['ceres', 'pioneer10'].map(async (name) => {
    if (tables[name]) return;
    try {
      const response = await fetch(new URL(`data/sky/${name}.json`, root), { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const prepared = prepareTable(name, json);
      if (!prepared) throw new Error('no usable points');
      tables[name] = prepared;
    } catch (error) {
      console.warn(`[sky] ${name}: using fallback (${error.message}).`);
      tables[name] = { name, static: true, ...FALLBACK[name] };
    }
  }));
}

/** Linear interpolation with RA wrap-around (359° -> 0°). */
function sampleTable(table, date) {
  if (!table) return null;
  if (table.static) {
    return { ra: table.ra, dec: table.dec, dist_au: table.dist_au };
  }

  const points = table.points;
  const now = date.getTime();
  if (now <= points[0].t) return points[0];
  if (now >= points[points.length - 1].t) return points[points.length - 1];

  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle].t <= now) low = middle;
    else high = middle;
  }

  const a = points[low];
  const b = points[high];
  const fraction = (now - a.t) / ((b.t - a.t) || 1);
  const raDelta = ((b.ra - a.ra + 540) % 360) - 180;
  return {
    ra: (a.ra + raDelta * fraction + 360) % 360,
    dec: a.dec + (b.dec - a.dec) * fraction,
    dist_au: a.dist_au + (b.dist_au - a.dist_au) * fraction,
  };
}

/** J2000 RA/Dec -> horizontal coordinates of date (with refraction). */
export function directionFromRaDec(raHours, decDegrees, distanceAu, date = new Date()) {
  const time = Astronomy.MakeTime(date);
  const sphere = new Astronomy.Spherical(decDegrees, raHours * 15, Math.max(distanceAu, 0.000001));
  const vector = Astronomy.VectorFromSphere(sphere, time);
  const equatorialOfDate = Astronomy.EquatorFromVector(
    Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(time), vector),
  );
  const horizontal = Astronomy.Horizon(
    time,
    observer,
    equatorialOfDate.ra,
    equatorialOfDate.dec,
    'normal',
  );
  return {
    az: (horizontal.azimuth + 360) % 360,
    alt: horizontal.altitude,
  };
}

/**
 * Where a target is right now.
 * @param {'moon'|'mars'|'ceres'|'pioneer10'} targetId
 * @param {Date} [date]
 * @returns {{id:string,label:string,az:number,alt:number,ra:number,dec:number,dist_au:number,source:string}}
 */
export function getHorizontal(targetId, date = new Date()) {
  const label = TARGET_LABELS[targetId];
  if (!label) throw new Error(`Unknown sky target: ${targetId}`);

  if (BODIES[targetId] !== undefined) {
    const equatorial = Astronomy.Equator(BODIES[targetId], date, observer, true, true);
    const horizontal = Astronomy.Horizon(
      date,
      observer,
      equatorial.ra,
      equatorial.dec,
      'normal',
    );
    return {
      id: targetId,
      label,
      az: (horizontal.azimuth + 360) % 360,
      alt: horizontal.altitude,
      ra: equatorial.ra,
      dec: equatorial.dec,
      dist_au: equatorial.dist,
      source: 'astronomy-engine',
    };
  }

  const table = tables[targetId];
  const sample = sampleTable(table, date) || FALLBACK[targetId];
  const horizontal = directionFromRaDec(sample.ra, sample.dec, sample.dist_au, date);
  return {
    id: targetId,
    label,
    ...horizontal,
    ra: sample.ra,
    dec: sample.dec,
    dist_au: sample.dist_au,
    source: table ? table.source : 'fallback',
  };
}

/** All four targets for the current instant. */
export function getSkyTargets(date = new Date()) {
  return TARGET_IDS.map((id) => getHorizontal(id, date));
}

/** Light travel time in seconds from the observer to a target. */
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

/** Shortest signed difference, in (-180, +180]. Positive = clockwise. */
export function normalize180(degrees) {
  return ((degrees + 540) % 360) - 180;
}

/** Great-circle angle between two horizontal directions, in degrees. */
export function angularDistance(a, b) {
  const radians = Math.PI / 180;
  const dAz = normalize180(b.az - a.az) * radians;
  const dAlt = (b.alt - a.alt) * radians;
  const x = Math.cos(a.alt * radians) * Math.sin(b.alt * radians)
    - Math.sin(a.alt * radians) * Math.cos(b.alt * radians) * Math.cos(dAz);
  const y = Math.cos(b.alt * radians) * Math.sin(dAz);
  const z = Math.sin(a.alt * radians) * Math.sin(b.alt * radians)
    + Math.cos(a.alt * radians) * Math.cos(b.alt * radians) * Math.cos(dAz);
  return Math.atan2(Math.hypot(x, y), z) / radians;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Compass label for an azimuth: 198 -> "S". */
export function compassPoint(azimuth) {
  const index = Math.round((((azimuth % 360) + 360) % 360) / 45) % 8;
  return COMPASS[index];
}

/** Moon phase angle in degrees (0 = new, 180 = full). */
export function getMoonPhase(date = new Date()) {
  return Astronomy.MoonPhase(date);
}

/** Distance to the Moon in AU, used by the finale's real round-trip time. */
export function getMoonDistanceAu(date = new Date()) {
  return getHorizontal('moon', date).dist_au;
}
