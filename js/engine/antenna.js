// Phone-as-antenna (Dev 1).
// Converts the phone orientation into the direction the BACK CAMERA is pointing:
// azimuth (0 = North, 90 = East) and altitude (0 = horizon, 90 = straight up).
//
// Phone compasses are imprecise (10–20°). The fix: the user points at the Moon
// (which they can see) and taps "Calibrate". We store the offset and apply it everywhere.
//
// ⚠️ Needs HTTPS (GitHub Pages is fine). Test on a real Android AND a real iPhone.

const listeners = [];
let offsetAz = 0;
let current = null;

export function hasSensors() {
  return typeof window.DeviceOrientationEvent !== 'undefined';
}

// Must be called from a tap (iOS asks for permission).
export async function enableAntenna() {
  if (!hasSensors()) return false;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') return false;
    } catch (e) {
      return false;
    }
  }
  // Android Chrome: absolute (north-referenced) orientation
  const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(evt, onOrientation, true);
  return true;
}

function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  let alpha = e.alpha ?? 0;
  // iOS gives a real compass heading separately. TODO: verify on a real iPhone.
  if (typeof e.webkitCompassHeading === 'number') alpha = 360 - e.webkitCompassHeading;

  const p = pointing(alpha, e.beta, e.gamma);
  current = { az: (p.az + offsetAz + 360) % 360, alt: p.alt, rawAz: p.az };
  listeners.forEach(fn => fn(current));
}

// W3C device orientation (alpha, beta, gamma in degrees) → back-camera direction.
// World frame: x = East, y = North, z = Up. Rotation R = Rz(alpha)·Rx(beta)·Ry(gamma).
export function pointing(alpha, beta, gamma) {
  const r = Math.PI / 180;
  const ca = Math.cos(alpha * r), sa = Math.sin(alpha * r);
  const cb = Math.cos(beta * r),  sb = Math.sin(beta * r);
  const cg = Math.cos(gamma * r), sg = Math.sin(gamma * r);
  // Back camera = -Z axis of the device
  const x = -(ca * sg + sa * sb * cg);
  const y = -(sa * sg - ca * sb * cg);
  const z = -(cb * cg);
  const alt = Math.asin(Math.max(-1, Math.min(1, z))) / r;
  const az = (Math.atan2(x, y) / r + 360) % 360;
  return { az, alt };
}

export function onPointing(fn) {
  listeners.push(fn);
}

// trueAz = real azimuth of the Moon right now (from sky.js)
export function calibrate(trueAz) {
  if (!current) return false;
  offsetAz = trueAz - current.rawAz;
  return true;
}
