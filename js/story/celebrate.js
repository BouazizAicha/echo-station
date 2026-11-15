// The end of the adventure (Dev B): when the last robot becomes Belu's friend, Belu and all his
// friends celebrate together. "Keep exploring" closes it; "Start over" erases the progress so
// someone new can live the whole story from the beginning.
import { robotPicture } from './silhouettes.js';
import { speak } from './speak.js';
import { startOver } from './progress.js';

const reducedMotion = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('a11y-calm'));

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Confetti, balloons and bubbles falling or rising behind Belu and his friends
function party(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0, h = 0, raf = 0;
  const resize = () => {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const colors = ['#5de4ff', '#ff9bd5', '#b49bff', '#ffd166', '#eef0ff'];
  const pick = () => colors[Math.floor(Math.random() * colors.length)];
  const confetti = Array.from({ length: 90 }, () => ({
    x: Math.random(), y: -Math.random(), v: 0.08 + Math.random() * 0.12, s: 4 + Math.random() * 5,
    r: Math.random() * 6, spin: (Math.random() - 0.5) * 6, c: pick(),
  }));
  const balloons = Array.from({ length: 9 }, (_, i) => ({
    x: (i + 0.5) / 9 + (Math.random() - 0.5) * 0.05, y: 1.1 + Math.random() * 0.6, v: 0.05 + Math.random() * 0.04,
    r: 14 + Math.random() * 10, c: pick(), sway: Math.random() * 6,
  }));
  const start = performance.now();
  const draw = now => {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, w, h);
    for (const b of balloons) {
      const y = ((b.y - b.v * t) % 1.8 + 1.8) % 1.8 * h - 0.3 * h;
      const x = b.x * w + Math.sin(t + b.sway) * 10;
      ctx.strokeStyle = 'rgba(238,240,255,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + b.r * 1.2); ctx.quadraticCurveTo(x + 6, y + b.r * 2.2, x, y + b.r * 3.2); ctx.stroke();
      ctx.fillStyle = b.c; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(x, y, b.r, b.r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.ellipse(x - b.r * 0.35, y - b.r * 0.4, b.r * 0.2, b.r * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const p of confetti) {
      const y = ((p.y + p.v * t) % 1.15) * h;
      const x = p.x * w + Math.sin(t * 2 + p.r) * 14;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.r + t * p.spin);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  };
  if (reducedMotion()) draw(start + 1500); else raf = requestAnimationFrame(draw);
  window.addEventListener('resize', resize);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}

/**
 * Shows the celebration. robots: all of Belu's friends.
 * opts.onKeepExploring(): called when the player closes it.
 */
export function celebrate(robots, { onKeepExploring } = {}) {
  if (document.getElementById('celebrate')) return;
  const root = el('div', 'celebrate');
  root.id = 'celebrate';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'celebrate-title');
  const canvas = el('canvas', 'celebrate-party');
  canvas.setAttribute('aria-hidden', 'true');
  const box = el('div', 'celebrate-box');
  const crew = el('div', 'celebrate-crew');
  const belu = el('img', 'celebrate-belu');
  belu.src = 'assets/images/belu-happy.svg';
  belu.alt = 'Belu the beluga, very happy';
  const ring = el('ul', 'celebrate-friends');
  ring.setAttribute('aria-label', 'Belu\'s friends');
  robots.forEach((robot, i) => {
    const li = el('li', 'celebrate-friend');
    li.style.setProperty('--i', i);
    // friends on an arc above Belu
    const a = Math.PI * (1.08 + (0.84 * i) / Math.max(1, robots.length - 1));
    li.style.left = `${50 + 40 * Math.cos(a)}%`;
    li.style.top = `${70 + 58 * Math.sin(a)}%`;
    li.appendChild(robotPicture(robot));
    li.appendChild(el('span', 'celebrate-name', robot.name.replace(/\s*\([^)]*\)/g, '')));
    ring.appendChild(li);
  });
  crew.append(ring, belu);
  const title = el('h2', 'celebrate-title', 'Belu found all his friends!');
  title.id = 'celebrate-title';
  title.tabIndex = -1;
  const text = el('p', 'celebrate-text',
    'Thanks to you, the six robots NASA sent across the solar system are Belu\'s friends again. They are quiet now, but what they discovered still speaks to us.');
  const row = el('div', 'celebrate-actions');
  const keep = el('button', 'big celebrate-keep', 'Keep exploring');
  keep.type = 'button';
  const again = el('button', 'celebrate-again', 'Start over');
  again.type = 'button';
  row.append(keep, again);
  box.append(el('p', 'mono celebrate-eyebrow', 'MISSION COMPLETE'), crew, title, text, row);
  root.append(canvas, box);
  document.body.appendChild(root);
  document.documentElement.classList.add('prologue-open');   // the page behind does not scroll
  const stop = party(canvas);
  title.focus();
  speak(`${title.textContent} ${text.textContent}`, { interrupt: true });

  const close = () => {
    stop();
    root.remove();
    document.documentElement.classList.remove('prologue-open');
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape') { close(); onKeepExploring?.(); } };
  document.addEventListener('keydown', onKey);
  keep.addEventListener('click', () => { close(); onKeepExploring?.(); });
  again.addEventListener('click', startOver);
}
