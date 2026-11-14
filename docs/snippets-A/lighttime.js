// Light-time (Dev A) – PASTE THESE FUNCTIONS AT THE END OF js/engine/sky.js
// (they need the private `tables` and `LIVE_BODIES` of sky.js).

const AU_LIGHT_SECONDS = 499.004784; // light needs ~499 s to travel 1 AU

// Distance Earth → target in AU (null if unknown)
export function getDistanceAU(target, date = new Date()) {
  if (LIVE_BODIES[target]) {
    return Astronomy.GeoVector(LIVE_BODIES[target](), date, true).Length();
  }
  const pts = tables[target]?.points;
  if (!pts || pts.length === 0 || pts[0].dist_au == null) return null;
  if (pts.length === 1) return pts[0].dist_au;
  const time = date.getTime();
  let i = pts.findIndex(p => new Date(p.t).getTime() > time);
  if (i === -1) i = pts.length - 1;
  if (i === 0) i = 1;
  const a = pts[i - 1], b = pts[i];
  const ta = new Date(a.t).getTime(), tb = new Date(b.t).getTime();
  const f = Math.max(0, Math.min(1, (time - ta) / (tb - ta)));
  return a.dist_au + f * (b.dist_au - a.dist_au);
}

// One-way light-time in seconds (null if unknown)
export function getLightTime(target, date = new Date()) {
  const au = getDistanceAU(target, date);
  return au == null ? null : au * AU_LIGHT_SECONDS;
}

// 1.35 → "1.4 s" · 658 → "11 min" · 70541 → "19 h 36 min"
export function formatLightTime(s) {
  if (s == null) return '';
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  let h = Math.floor(s / 3600);
  let m = Math.round((s % 3600) / 60);
  if (m === 60) { h += 1; m = 0; }
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
