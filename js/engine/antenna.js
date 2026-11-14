/**
 * antenna.js — the phone becomes a radio antenna.
 *
 * DeviceOrientation gives three angles. We turn them into the direction of
 * the back camera (azimuth 0 = North, altitude 0 = horizon), smooth the
 * direction as a 3D vector (so 359° -> 0° never jumps), then apply the
 * one-time Moon calibration offset.
 */

import { getHorizontal, normalize180 } from './sky.js';

const params = typeof location !== 'undefined'
  ? new URLSearchParams(location.search)
  : new URLSearchParams();

const RADIANS = Math.PI / 180;

/** 0 = frozen, 1 = no smoothing. 0.15–0.3 feels good; use 0.1 if shaky. */
let smoothing = 0.15;

/** Live state, also useful to the debug line. */
export const pointing = {
  az: 0,
  alt: 0,
  raw: null,
  accuracy: null,
  active: false,
  screenAngle: 0,
  calibrated: false,
  offsetAz: 0,
  offsetAlt: 0,
};

let smoothedVector = null;
let uncalibrated = { az: 0, alt: 0 };
let listener = null;
let running = false;
let usingAbsolute = false;
let firstEventResolve = null;
let firstEventTimer = null;

function emit() {
  if (!listener) return;
  listener({
    az: pointing.az,
    alt: pointing.alt,
    raw: pointing.raw,
    accuracy: pointing.accuracy,
    uncalibrated: { ...uncalibrated },
  });
}

/** The brief's smoothing: average unit vectors, never angles. */
export function smoothDir(direction) {
  const v = [
    Math.cos(direction.alt * RADIANS) * Math.sin(direction.az * RADIANS), // East
    Math.cos(direction.alt * RADIANS) * Math.cos(direction.az * RADIANS), // North
    Math.sin(direction.alt * RADIANS), // Up
  ];
  smoothedVector = smoothedVector
    ? smoothedVector.map((component, index) => component + smoothing * (v[index] - component))
    : v;
  const length = Math.hypot(...smoothedVector);
  return {
    az: (Math.atan2(smoothedVector[0], smoothedVector[1]) / RADIANS + 360) % 360,
    alt: Math.asin(smoothedVector[2] / length) / RADIANS,
  };
}

export function setSmoothing(value) {
  const next = Number(value);
  if (Number.isFinite(next) && next >= 0 && next <= 1) smoothing = next;
}

/** Register the one aim callback used by main.js. */
export function onPointing(callback) {
  listener = callback;
}

function headingFrom(event) {
  // iPhone: webkitCompassHeading is already a true compass heading.
  // (Do NOT do 360 - webkitCompassHeading: that mirrors East to 270.)
  if (Number.isFinite(event.webkitCompassHeading)) {
    return event.webkitCompassHeading;
  }
  if (!Number.isFinite(event.alpha)) return null;

  // Android: alpha turns counter-clockwise, so heading = 360 - alpha.
  // Override with ?heading=alpha if a device reports the other convention.
  if (params.get('heading') === 'alpha') return ((event.alpha % 360) + 360) % 360;
  return ((360 - event.alpha) % 360 + 360) % 360;
}

/**
 * Direction of the BACK CAMERA from the full rotation (alpha, beta, gamma), W3C convention:
 * R = Rz(alpha)·Rx(beta)·Ry(gamma), Earth frame x = East, y = North, z = Up.
 * The camera looks along the device's -Z axis, so its direction is minus R's third column.
 * Unlike "heading = 360 - alpha, altitude = beta - 90", this stays stable when the phone is
 * upright or tilted up toward the Moon (no gimbal lock, gamma is taken into account).
 */
export function cameraDirection(alpha, beta, gamma) {
  const a = alpha * RADIANS, b = beta * RADIANS, g = gamma * RADIANS;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  const east = -(cG * sA * sB + cA * sG);
  const north = -(sA * sG - cA * cG * sB);
  const up = -(cB * cG);
  return {
    az: ((Math.atan2(east, north) / RADIANS) + 360) % 360,
    alt: Math.asin(Math.max(-1, Math.min(1, up))) / RADIANS,
  };
}

function handleOrientation(event, absolute) {
  const heading = headingFrom(event);
  if (heading === null) return;

  // Prefer the absolute event on Android; keep the relative one for iPhone,
  // where webkitCompassHeading only appears on deviceorientation.
  if (absolute) usingAbsolute = true;
  else if (usingAbsolute && !Number.isFinite(event.webkitCompassHeading)) return;

  const beta = Number.isFinite(event.beta) ? event.beta : 90;
  const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;

  let rawDirection;
  if (Number.isFinite(event.webkitCompassHeading)) {
    // iPhone: the compass heading is already tilt-compensated (this path works, keep it).
    // Portrait, phone upright: beta = 90 -> horizon; beta = 135 -> 45° up.
    rawDirection = { az: heading % 360, alt: Math.max(-89.9, Math.min(89.9, beta - 90)) };
  } else {
    // Android: full 3D rotation → the real direction of the back camera.
    const alpha = params.get('heading') === 'alpha' ? 360 - event.alpha : event.alpha;
    rawDirection = cameraDirection(alpha, beta, gamma);
  }
  if (params.get('mirror') === '1') rawDirection.az = 360 - rawDirection.az;
  rawDirection.az = (rawDirection.az + 360) % 360;

  uncalibrated = smoothDir(rawDirection);
  pointing.az = (uncalibrated.az + pointing.offsetAz + 360) % 360;
  pointing.alt = Math.max(-89.9, Math.min(89.9, uncalibrated.alt + pointing.offsetAlt));
  pointing.raw = {
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
    webkitCompassHeading: event.webkitCompassHeading ?? null,
    absolute: Boolean(absolute || event.absolute),
  };
  pointing.accuracy = Number.isFinite(event.webkitCompassAccuracy)
    ? event.webkitCompassAccuracy
    : null;
  pointing.screenAngle = typeof screen !== 'undefined' && screen.orientation
    ? screen.orientation.angle || 0
    : 0;

  emit();

  if (firstEventResolve) {
    firstEventResolve();
    firstEventResolve = null;
    clearTimeout(firstEventTimer);
  }
}

function orientationHandler(event) {
  handleOrientation(event, false);
}

function absoluteHandler(event) {
  handleOrientation(event, true);
}

function attachListeners() {
  window.addEventListener('deviceorientationabsolute', absoluteHandler, true);
  window.addEventListener('deviceorientation', orientationHandler, true);
}

function detachListeners() {
  window.removeEventListener('deviceorientationabsolute', absoluteHandler, true);
  window.removeEventListener('deviceorientation', orientationHandler, true);
}

/**
 * Ask for permission (iOS) and start listening.
 * Must be called from a user gesture (button tap).
 * @returns {Promise<void>} resolves after the first orientation event
 */
export async function enableAntenna() {
  if (running) return;

  if (typeof DeviceOrientationEvent === 'undefined') {
    throw new Error('This device has no motion sensor. Use the sky map instead.');
  }

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const permission = await DeviceOrientationEvent.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Motion access was refused. Use the sky map, or allow it in Settings.');
    }
  }

  // Best effort; Safari ignores this.
  try {
    await screen.orientation?.lock?.('portrait');
  } catch {
    // Portrait lock is a nicety, not a requirement.
  }

  running = true;
  pointing.active = true;
  attachListeners();

  await new Promise((resolve, reject) => {
    firstEventResolve = resolve;
    firstEventTimer = setTimeout(() => {
      running = false;
      pointing.active = false;
      detachListeners();
      firstEventResolve = null;
      reject(new Error('No orientation data arrived. Use the sky map instead.'));
    }, 2500);
  });
}

export function disableAntenna() {
  running = false;
  pointing.active = false;
  detachListeners();
}

/**
 * Aim at the Moon, measure the error once, and apply the correction to
 * every target. Returns the measured offsets in degrees.
 * @param {'moon'|'mars'|'ceres'|'pioneer10'} targetId
 */
export function calibrate(targetId = 'moon') {
  if (!pointing.active) {
    throw new Error('Start the antenna before calibrating.');
  }
  const target = getHorizontal(targetId);
  const offsetAz = normalize180(target.az - uncalibrated.az);
  const offsetAlt = target.alt - uncalibrated.alt;

  pointing.offsetAz = offsetAz;
  pointing.offsetAlt = offsetAlt;
  pointing.calibrated = true;

  // Apply immediately so the UI does not wait for the next sensor event.
  pointing.az = (uncalibrated.az + offsetAz + 360) % 360;
  pointing.alt = Math.max(-89.9, Math.min(89.9, uncalibrated.alt + offsetAlt));
  emit();

  return {
    dAz: offsetAz,
    dAlt: offsetAlt,
    target,
  };
}

export function resetCalibration() {
  pointing.offsetAz = 0;
  pointing.offsetAlt = 0;
  pointing.calibrated = false;
}

export function getCalibration() {
  return {
    az: pointing.offsetAz,
    alt: pointing.offsetAlt,
    calibrated: pointing.calibrated,
  };
}
