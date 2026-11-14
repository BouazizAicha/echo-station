// Laser finale (Dev B).
// The kid "fires a laser" at the Apollo 11 mirror. The waiting time is the REAL round trip
// computed from today's Earth–Moon distance (about 2.5 s). Then the facts appear.
import { getAudioContext } from './radio.js';

const $ = id => document.getElementById(id);
const C_KM_S = 299792.458;
const AU_KM = 149597870.7;

function roundTripSeconds(date = new Date()) {
  const km = Astronomy.GeoVector(Astronomy.Body.Moon, date, true).Length() * AU_KM;
  return (2 * km) / C_KM_S;
}

function tone(freq, duration, type = 'sine', volume = 0.15, endFreq = null) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + duration + 0.05);
}

export function openFinale({ onExit } = {}) {
  const btn = $('btn-fire');
  const timer = $('finale-timer');
  const pulse = $('finale-pulse');
  const lines = [...document.querySelectorAll('#finale-result [data-step]')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reset
  btn.hidden = false;
  btn.disabled = false;
  timer.textContent = '';
  pulse.style.opacity = 0;
  lines.forEach(l => { l.hidden = true; });
  $('btn-finale-back').onclick = () => { if (onExit) onExit(); };

  btn.onclick = () => {
    btn.disabled = true;
    const rt = roundTripSeconds();
    tone(1400, 0.25, 'sine', 0.12, 2400);                      // "pew"
    const start = performance.now();
    const step = now => {
      const t = (now - start) / 1000;
      const p = Math.min(1, t / rt);
      timer.textContent = `${Math.min(t, rt).toFixed(2)} s`;
      if (!reduced) {                                          // the pulse goes up, then comes back
        const y = p < 0.5 ? p * 2 : 2 - p * 2;                 // 0 → 1 → 0
        pulse.style.opacity = 1;
        pulse.style.bottom = `${y * 100}%`;
      }
      if (p < 1) return requestAnimationFrame(step);
      pulse.style.opacity = 0;
      tone(880, 0.9, 'triangle', 0.18);                        // the echo
      timer.textContent = `${rt.toFixed(2)} s`;
      $('finale-rt').textContent = rt.toFixed(2);
      btn.hidden = true;
      lines.forEach((l, i) => setTimeout(() => { l.hidden = false; }, reduced ? 0 : 600 + i * 1400));
    };
    requestAnimationFrame(step);
  };
}
