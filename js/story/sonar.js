// Belu's sonar (Story mode, Dev B): the search becomes real echolocation.
// The robots are hidden on the sky map. Press "Click!": Belu sends a sound, a ring spreads across
// the sky, and every friend it touches sends an echo back. The farther the friend, the later the echo
// (like a real sonar). You hear it from its side (stereo), higher if it is above, lower if below;
// you see a flash where it is (or an arrow at the edge of the map); the phone vibrates; and a caption
// says it in words. Fewer clicks = more stars.
import { angularDistance } from '../engine/sky.js';
import { computeGuide } from '../engine/guide.js';
import { tone, burst, vibrate, clamp } from './minigames/kit.js';
import { speak } from './speak.js';

const SPEED = 90;           // degrees per second (the ring's speed across the sky)
const RING_MAX = 2.4;       // seconds a ring is drawn
const FLASH = 1.8;          // seconds an echo flash stays visible
const COOLDOWN = 600;       // ms between two clicks

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function words(guide, target) {
  const side = Math.abs(guide.dAz) < 8 ? 'straight ahead'
    : `${Math.abs(guide.dAz) > 60 ? 'far to the' : 'to the'} ${guide.dAz > 0 ? 'right' : 'left'}`;
  const height = Math.abs(guide.dAlt) < 8 ? '' : guide.dAlt > 0 ? ', higher up' : ', lower down';
  const near = guide.dist < 10 ? ' Very close!' : guide.dist < 30 ? ' Close!' : guide.dist > 90 ? ' Far away…' : '';
  const under = target.alt < 0 ? ' (under the horizon)' : '';
  return `A friend answers! Echo ${side}${height}${under}.${near}`;
}

export function createSonar({ getAim, getTargets, mount }) {
  const pings = [];        // { t0, echoes: [{ target, tHit, tBack, guide, strength }] }
  let clicks = 0, lastPing = 0, longFlash = false;
  let heard = null;        // id of the friend heard last: the orange arrow keeps pointing to it

  // ---- panel (shown only in Story mode, by CSS) ----
  const panel = el('section', 'sonar');
  panel.id = 'sonar';
  panel.setAttribute('aria-label', 'Belu\'s sonar');
  const button = el('button', 'sonar-click');
  button.type = 'button';
  button.id = 'btn-click';
  button.innerHTML = '<span class="sonar-click-ring" aria-hidden="true"></span><strong>Click!</strong><span class="sonar-click-sub">Belu sends a sound</span>';
  const compass = el('div', 'sonar-compass');
  compass.setAttribute('aria-hidden', 'true');
  const arrow = el('span', 'sonar-arrow', '?');
  compass.appendChild(arrow);
  const text = el('p', 'sonar-text', 'Press Click! to hear your friends answer.');
  text.id = 'sonar-text';
  text.setAttribute('aria-live', 'polite');
  button.setAttribute('aria-describedby', 'sonar-text');
  const count = el('p', 'sonar-count mono', 'Clicks: 0');
  const row = el('div', 'sonar-row');
  const wordsBox = el('div', 'sonar-words');
  wordsBox.append(text, count);
  row.append(button, wordsBox, compass);
  panel.append(row);
  if (mount) mount.prepend(panel);

  function ping() {
    const now = performance.now();
    if (now - lastPing < COOLDOWN) return;
    lastPing = now;
    clicks++;
    count.textContent = `Clicks: ${clicks}`;
    if (clicks >= 6) longFlash = true;
    const aim = getAim();
    // Belu's click
    burst(0.05, { vol: 0.35, freq: 5000 });
    tone(2400, 0.04, { type: 'square', vol: 0.06, endFreq: 1600 });
    button.classList.remove('pinged'); void button.offsetWidth; button.classList.add('pinged');

    const echoes = getTargets().map(target => {
      const d = angularDistance(aim, target);
      const guide = computeGuide(aim, target);
      const strength = clamp(1 - d / 180, 0.08, 1);
      return { target, d, guide, strength, tHit: d / SPEED, tBack: (2 * d) / SPEED };
    }).sort((a, b) => a.d - b.d);
    pings.push({ t0: now / 1000, echoes });

    for (const e of echoes) {
      const pan = clamp(e.guide.dAz / 60, -1, 1);
      const freq = 900 + clamp(e.guide.dAlt, -60, 60) * 7;
      tone(freq, 0.12, { type: 'sine', vol: 0.04 + 0.14 * e.strength, pan, delay: e.tBack });
      tone(freq * 0.98, 0.1, { type: 'sine', vol: (0.04 + 0.14 * e.strength) * 0.35, pan, delay: e.tBack + 0.13 });
    }
    const best = echoes[0];
    if (best) {
      setTimeout(() => {
        vibrate(Math.round(30 + 120 * best.strength));
        text.textContent = `${words(best.guide, best.target)} Follow the orange arrow!`;
        speak(text.textContent, { interrupt: true });
        heard = best.target.id;
        compass.classList.add('show');
        update(getAim());
      }, best.tBack * 1000);
    } else {
      text.textContent = 'Silence… every friend has been found!';
    }
  }

  // Drawn by the sky map, on top of the sky (story mode only)
  function draw(context, { project, width, height, scale }) {
    const now = performance.now() / 1000;
    const cx = width / 2, cy = height / 2;
    for (let i = pings.length - 1; i >= 0; i--) {
      const p = pings[i];
      const age = now - p.t0;
      const last = p.echoes.length ? p.echoes[p.echoes.length - 1].tBack + (longFlash ? 6 : FLASH) : RING_MAX;
      if (age > Math.max(RING_MAX, last)) { pings.splice(i, 1); continue; }
      // the outgoing ring
      if (age < RING_MAX) {
        context.strokeStyle = `rgba(93, 228, 255, ${0.7 * (1 - age / RING_MAX)})`;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(cx, cy, age * SPEED * scale, 0, Math.PI * 2);
        context.stroke();
      }
      // echoes: a flash where each friend is, once the ring has touched it
      for (const e of p.echoes) {
        const since = age - e.tHit;
        const keep = longFlash ? 6 : FLASH;
        if (since < 0 || since > keep + e.tHit) continue;
        const fade = clamp(1 - since / (keep + e.tHit), 0, 1);
        const point = project(e.target.az, e.target.alt);
        const inside = point.x > 10 && point.x < width - 10 && point.y > 10 && point.y < height - 10;
        if (inside) {
          const r = 10 + 22 * clamp(since / 0.6, 0, 1);
          context.strokeStyle = `rgba(255, 155, 213, ${0.9 * fade})`;
          context.lineWidth = 2.5;
          context.beginPath(); context.arc(point.x, point.y, r, 0, Math.PI * 2); context.stroke();
          const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 16);
          glow.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
          glow.addColorStop(1, 'rgba(255, 155, 213, 0)');
          context.fillStyle = glow;
          context.beginPath(); context.arc(point.x, point.y, 16, 0, Math.PI * 2); context.fill();
          context.fillStyle = `rgba(255, 220, 240, ${fade})`;
          context.font = '700 11px ui-monospace, Menlo, monospace';
          context.textAlign = 'center';
          context.fillText('?', point.x, point.y + 4);
        } else {
          // off the map: an arrow on the edge, pointing to the friend
          const dx = point.x - cx, dy = point.y - cy;
          const k = Math.min((width / 2 - 20) / Math.abs(dx || 1e-6), (height / 2 - 20) / Math.abs(dy || 1e-6));
          const ex = cx + dx * k, ey = cy + dy * k;
          context.save();
          context.translate(ex, ey);
          context.rotate(Math.atan2(dy, dx));
          context.fillStyle = `rgba(255, 155, 213, ${0.95 * fade})`;
          context.beginPath(); context.moveTo(12, 0); context.lineTo(-8, -9); context.lineTo(-4, 0); context.lineTo(-8, 9); context.closePath(); context.fill();
          context.restore();
        }
      }
    }
  }

  // The orange arrow: from where you aim to the friend heard last (map and sonar panel)
  function pointer() {
    if (!heard) return null;
    const target = getTargets().find(t => t.id === heard);
    if (!target) { heard = null; compass.classList.remove('show'); arrow.textContent = '?'; return null; }
    return { target, guide: computeGuide(getAim(), target) };
  }

  let shownDeg = null;
  function update() {
    const p = pointer();
    if (!p) return;
    const onIt = p.guide.dist <= 6;
    shownDeg = shownDeg == null ? p.guide.rotateDeg : shownDeg + (((p.guide.rotateDeg - shownDeg + 540) % 360) - 180) * 0.35;
    arrow.textContent = onIt ? '◎' : '➜';
    arrow.style.transform = onIt ? 'none' : `rotate(${shownDeg.toFixed(0)}deg)`;
    compass.dataset.near = p.guide.dist < 20 ? 'true' : 'false';
  }

  function drawPointer(context, { width, height }) {
    const p = pointer();
    if (!p || p.guide.dist <= 6) return;
    const cx = width / 2, cy = height / 2;
    context.save();
    context.translate(cx, cy);
    context.rotate((shownDeg ?? p.guide.rotateDeg) * Math.PI / 180);
    context.fillStyle = '#ff9bd5';
    context.shadowColor = '#ff9bd5'; context.shadowBlur = 10;
    context.beginPath(); context.moveTo(58, 0); context.lineTo(36, -11); context.lineTo(40, 0); context.lineTo(36, 11); context.closePath(); context.fill();
    context.restore();
  }

  button.addEventListener('click', ping);

  return {
    ping,
    draw(context, info) { draw(context, info); drawPointer(context, info); },
    update,
    get hasHeard() { return Boolean(heard); },
    get clicks() { return clicks; },
    reset() {
      clicks = 0; longFlash = false; heard = null; shownDeg = null;
      count.textContent = 'Clicks: 0';
      text.textContent = 'Press Click! Who else is out there?';
      compass.classList.remove('show');
      arrow.textContent = '?';
      arrow.style.transform = 'none';
    },
  };
}

export function starsFor(clicks) {
  return clicks <= 3 ? 3 : clicks <= 6 ? 2 : 1;
}
