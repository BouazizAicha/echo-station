// Radio sound engine (Dev 2).
// Static noise that fades out and a tone that fades in as the signal gets stronger.
// Must be started from a user gesture (tap/click), otherwise browsers block audio.

let ctx = null;
let noiseGain, toneGain, osc;

// Belu's echolocation clicks: faster and louder when the signal gets stronger
let strengthNow = 0;
let clicksOn = false;
let nextClick = 0;
let clickBuffer = null;

// Sound settings (set by sound.js): muted = everything off; staticOn = the radio crackle
let muted = false;
let staticOn = true;
export const isMuted = () => muted;
export function setMuted(value) {
  muted = Boolean(value);
  if (!ctx) return;
  if (muted) ctx.suspend(); else ctx.resume();
}
export function setStaticEnabled(value) {
  staticOn = Boolean(value);
  if (noiseGain && ctx) noiseGain.gain.setTargetAtTime(staticOn && clicksOn ? 0.18 * (1 - strengthNow) + 0.02 : 0, ctx.currentTime, 0.1);
}

export function startRadio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  // White noise buffer, looped
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  // Band-pass filter = "radio" sounding static
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.6;

  noiseGain = ctx.createGain();
  noiseGain.gain.value = staticOn ? 0.18 : 0;
  noise.connect(filter).connect(noiseGain).connect(ctx.destination);
  noise.start();

  // Carrier tone that appears when we get close to a target
  osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 300;
  toneGain = ctx.createGain();
  toneGain.gain.value = 0;
  osc.connect(toneGain).connect(ctx.destination);
  osc.start();

  // a very short noise burst = one click
  clickBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.015), ctx.sampleRate);
  const c = clickBuffer.getChannelData(0);
  for (let i = 0; i < c.length; i++) c[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.length / 6));
  setInterval(scheduleClicks, 50);
  if (muted) ctx.suspend();
}

function scheduleClicks() {
  if (!ctx || !clicksOn) return;
  const now = ctx.currentTime;
  if (nextClick < now) nextClick = now + 0.02;
  while (nextClick < now + 0.2) {
    const src = ctx.createBufferSource();
    src.buffer = clickBuffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 3200 + 1800 * strengthNow;
    band.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = 0.35 + 0.6 * strengthNow;
    src.connect(band).connect(g).connect(ctx.destination);
    src.start(nextClick);
    nextClick += 0.9 - 0.75 * strengthNow;      // 0.9 s between clicks → 0.15 s when locked on
  }
}

// strength: 0 (nothing) → 1 (locked on)
export function setSignal(strength) {
  if (!ctx) return;
  const s = Math.max(0, Math.min(1, strength));
  strengthNow = s;
  clicksOn = true;
  const t = ctx.currentTime;
  noiseGain.gain.setTargetAtTime(staticOn ? 0.18 * (1 - s) + 0.02 : 0, t, 0.1);
  toneGain.gain.setTargetAtTime(0.12 * s * s, t, 0.1);
  osc.frequency.setTargetAtTime(300 + 300 * s, t, 0.1);
}

export function muteRadio() {
  setSignal(0);
  clicksOn = false;
  if (noiseGain) noiseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}

// Shared audio context (used by the voice player, the transition and the finale)
export function getAudioContext() {
  return ctx;
}
