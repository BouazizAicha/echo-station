// Transition static → story (Dev B).
// ~1.8 s: radio noise that clears up, a "lock" chirp, then the robot's name.
// Soft, no strobe (no flashing more than 3 times a second). Short fade if reduced motion.
import { getAudioContext } from './radio.js';

const $ = id => document.getElementById(id);

function chirp() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(1250, t + 0.35);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.65);
}

export function playTransition(robot) {
  const overlay = $('transition');
  const canvas = $('transition-noise');
  const name = $('transition-name');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DURATION = reduced ? 500 : 1800;

  name.textContent = '';
  $('transition-body').textContent = `${robot.body.toUpperCase()} · ${robot.site}`;
  overlay.hidden = false;
  overlay.classList.remove('done');
  chirp();

  const ctx2d = canvas.getContext('2d');
  canvas.width = 160;            // low resolution noise, scaled up by CSS = cheap and soft
  canvas.height = 90;
  const img = ctx2d.createImageData(canvas.width, canvas.height);

  return new Promise(resolve => {
    const start = performance.now();
    const frame = now => {
      const p = Math.min(1, (now - start) / DURATION);    // 0 → 1
      if (!reduced) {
        const strength = 1 - p;                            // the noise clears up
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 255 * strength * 0.55;
          img.data[i] = v * 0.6; img.data[i + 1] = v; img.data[i + 2] = v * 0.8; img.data[i + 3] = 255;
        }
        ctx2d.putImageData(img, 0, 0);
      }
      const letters = Math.floor(Math.max(0, (p - 0.35) / 0.45) * robot.name.length);
      name.textContent = robot.name.slice(0, letters);
      if (p < 1) return requestAnimationFrame(frame);
      name.textContent = robot.name;
      overlay.classList.add('done');                       // CSS fade-out
      setTimeout(() => { overlay.hidden = true; resolve(); }, 300);
    };
    requestAnimationFrame(frame);
  });
}
