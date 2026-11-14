// Radio sound engine (Dev 2).
// Static noise that fades out and a tone that fades in as the signal gets stronger.
// Must be started from a user gesture (tap/click), otherwise browsers block audio.

let ctx = null;
let noiseGain, toneGain, osc;

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
  noiseGain.gain.value = 0.25;
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
}

// strength: 0 (nothing) → 1 (locked on)
export function setSignal(strength) {
  if (!ctx) return;
  const s = Math.max(0, Math.min(1, strength));
  const t = ctx.currentTime;
  noiseGain.gain.setTargetAtTime(0.25 * (1 - s) + 0.02, t, 0.1);
  toneGain.gain.setTargetAtTime(0.12 * s * s, t, 0.1);
  osc.frequency.setTargetAtTime(300 + 300 * s, t, 0.1);
}

export function muteRadio() {
  setSignal(0);
  if (noiseGain) noiseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}
