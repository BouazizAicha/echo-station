// Real sky positions (Dev 1).
// - Moon and Mars: computed live with astronomy-engine (global `Astronomy`).
// - Ceres (Dawn), Eros (NEAR), Pioneer 10/11, Kepler: precomputed RA/Dec tables
//   exported from NASA JPL Horizons into data/sky/<target>.json (see tools/horizons_to_json.py).

const tables = {};

const LIVE_BODIES = {
  moon: () => Astronomy.Body.Moon,
  mars: () => Astronomy.Body.Mars,
};

export async function loadSkyTables(targets) {
  for (const t of targets) {
    if (LIVE_BODIES[t] || tables[t]) continue;
    try {
      const res = await fetch(`data/sky/${t}.json`);
      if (res.ok) tables[t] = await res.json();
    } catch (e) {
      console.warn(`No sky table for ${t}`, e);
    }
  }
}

// Returns { az, alt } in degrees for an observer { lat, lon, height }, or null if unknown.
export function getHorizontal(target, date, obs) {
  const observer = new Astronomy.Observer(obs.lat, obs.lon, obs.height || 0);
  let ra, dec; // ra in hours, dec in degrees

  if (LIVE_BODIES[target]) {
    const eq = Astronomy.Equator(LIVE_BODIES[target](), date, observer, true, true);
    ra = eq.ra;
    dec = eq.dec;
  } else if (tables[target]) {
    ({ ra, dec } = interpolate(tables[target].points, date));
  } else {
    return null;
  }

  const hor = Astronomy.Horizon(date, observer, ra, dec, 'normal');
  return { az: hor.azimuth, alt: hor.altitude };
}

// Linear interpolation in a table of { t: ISO date, ra: hours, dec: degrees }
function interpolate(points, date) {
  const time = date.getTime();
  let i = points.findIndex(p => new Date(p.t).getTime() > time);
  if (i === -1) i = points.length - 1;
  if (i === 0) i = 1;
  const a = points[i - 1], b = points[i];
  const ta = new Date(a.t).getTime(), tb = new Date(b.t).getTime();
  const f = Math.max(0, Math.min(1, (time - ta) / (tb - ta)));
  let dra = b.ra - a.ra;
  if (dra > 12) dra -= 24;   // wrap around 0h/24h
  if (dra < -12) dra += 24;
  return { ra: (a.ra + f * dra + 24) % 24, dec: a.dec + f * (b.dec - a.dec) };
}

// Angle in degrees between two { az, alt } directions
export function angularDistance(a, b) {
  const r = Math.PI / 180;
  const c = Math.sin(a.alt * r) * Math.sin(b.alt * r) +
            Math.cos(a.alt * r) * Math.cos(b.alt * r) * Math.cos((a.az - b.az) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) / r;
}
