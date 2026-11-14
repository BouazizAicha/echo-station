// ===== js/engine/antenna.js – smoothing + raw values for the debug panel =====
// 1) Add these lines near the top of antenna.js (under `let current = null;`):

let sv = null;          // smoothed direction (unit vector)
const SMOOTH = 0.2;     // 0 = frozen, 1 = no smoothing. 0.15–0.3 feels good.

function smoothDir(p) {
  const r = Math.PI / 180;
  const v = [Math.cos(p.alt * r) * Math.sin(p.az * r),   // East
             Math.cos(p.alt * r) * Math.cos(p.az * r),   // North
             Math.sin(p.alt * r)];                       // Up
  sv = sv ? sv.map((c, i) => c + SMOOTH * (v[i] - c)) : v;  // smooth the VECTOR, not the angles (no 359°→0° jump)
  const n = Math.hypot(sv[0], sv[1], sv[2]);
  return {
    az: (Math.atan2(sv[0], sv[1]) / r + 360) % 360,
    alt: Math.asin(sv[2] / n) / r,
  };
}

// 2) Replace the whole onOrientation function by this one:

function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  let alpha = e.alpha ?? 0;
  const ios = typeof e.webkitCompassHeading === 'number';
  if (ios) alpha = 360 - e.webkitCompassHeading;   // if East shows ~270° on iPhone, use: alpha = e.webkitCompassHeading;

  const p = smoothDir(pointing(alpha, e.beta, e.gamma));
  current = {
    az: (p.az + offsetAz + 360) % 360,
    alt: p.alt,
    rawAz: p.az,
    raw: { type: e.type, absolute: e.absolute, alpha: e.alpha, beta: e.beta, gamma: e.gamma,
           heading: e.webkitCompassHeading, accuracy: e.webkitCompassAccuracy, offset: offsetAz },
  };
  listeners.forEach(fn => fn(current));
}
