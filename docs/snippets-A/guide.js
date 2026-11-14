// Guidance arrow (Dev A) – tells the user where to move the phone.
// dir and target are { az, alt } in degrees (az: 0 = North, 90 = East).
// Returns the CSS rotation for an arrow that points RIGHT at 0°, a hint text, and the distance in degrees.
export function computeGuide(dir, target) {
  const dAz = ((target.az - dir.az + 540) % 360) - 180;      // -180..180, positive = to the right
  const dAlt = target.alt - dir.alt;                          // positive = higher
  const horiz = dAz * Math.cos(dir.alt * Math.PI / 180);      // sideways angle shrinks near the zenith
  const rotateDeg = Math.atan2(-dAlt, horiz) * 180 / Math.PI; // CSS: 0 = right, -90 = up, 90 = down
  const dist = Math.hypot(horiz, dAlt);

  let text;
  if (dist < 6) text = "You're on it! Hold still.";
  else if (Math.abs(horiz) >= Math.abs(dAlt)) text = horiz > 0 ? 'Turn right' : 'Turn left';
  else text = dAlt > 0 ? 'Aim higher' : 'Aim lower';
  if (target.alt < 0 && dist >= 6) text += ' (it is below the horizon: aim through the Earth!)';

  return { rotateDeg, text, dist };
}
