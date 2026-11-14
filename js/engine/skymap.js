/**
 * skymap.js — the sky map for computers, classrooms and phones without sensors.
 *
 * A 90° wide view of the real sky: azimuth horizontally, altitude vertically.
 * The green reticle at the centre is the aim, sent to main.js every 100 ms
 * exactly like the antenna. Signal, lock-on and stories are therefore identical.
 */

import { angularDistance, getMoonPhase, normalize180, compassPoint } from './sky.js';
import { computeGuide } from './guide.js';

const RADIANS = Math.PI / 180;
const FOV_WIDTH_DEG = 90;
const AIM_INTERVAL_MS = 100;
const MIN_ALT = -85;   // the map can look under the horizon: Belu hears through the Earth
const MAX_ALT = 87;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   onAim: (aim: {az:number, alt:number}) => void,
 *   getTargets: () => Array<{id:string,label:string,az:number,alt:number,color?:string}>,
 *   getRobots: () => Array<{id:string,sky_target:string,name:string}>,
 *   isFound: (robot: object) => boolean,
 * }} options
 */
export function initSkyMap({
  canvas, onAim, getTargets, getRobots, isFound,
  isHidden = () => false,      // Story mode: hidden targets (Belu's sonar reveals them)
  showGuide = () => true,      // Story mode: no arrow, the sonar is the guide
  overlay = null,              // extra drawing on top of the sky (sonar rings and echoes)
}) {
  const context = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia !== 'undefined'
    ? matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const view = { az: 180, alt: 45 };
  let running = false;
  let initialized = false;
  let frame = 0;
  let aimTimer = 0;
  let scale = 8; // pixels per degree
  let dragging = null;
  let lastAim = { az: 0, alt: 0 };

  const stars = [];
  {
    const random = seededRandom(20261114);
    for (let index = 0; index < 260; index += 1) {
      stars.push({
        az: random() * 360,
        alt: Math.asin(random()) / RADIANS * 0.98 + 1,
        size: 0.5 + random() * 1.5,
        alpha: 0.25 + random() * 0.7,
      });
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = (rect.width / 2) / (FOV_WIDTH_DEG / 2);
  }

  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(resize)
    : null;
  observer?.observe(canvas);
  window.addEventListener('resize', resize);

  function project(azimuth, altitude) {
    const rect = canvas.getBoundingClientRect();
    const dAz = normalize180(azimuth - view.az);
    return {
      x: rect.width / 2 + dAz * scale,
      y: rect.height / 2 - (altitude - view.alt) * scale,
    };
  }

  function targetsWithRobots() {
    const robots = getRobots();
    return getTargets().map((target) => {
      const related = robots.filter((robot) => robot.sky_target === target.id);
      const found = related.filter((robot) => isFound(robot));
      return { ...target, robots: related, found: found.length, total: related.length };
    });
  }

  function nearestUnfoundTarget(targets) {
    const candidates = targets.filter((target) => target.total === 0 || target.found < target.total);
    const pool = candidates.length ? candidates : targets;
    let best = null;
    for (const target of pool) {
      const distance = angularDistance(view, target);
      const score = target.alt < 0 ? distance + 15 : distance;   // same rule as targeting.js
      if (!best || score < best.score) best = { target, distance, score };
    }
    return best;
  }

  function drawBackground(width, height) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0b0a1f');
    gradient.addColorStop(0.55, '#120e33');
    gradient.addColorStop(1, '#1d1648');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    // A soft Milky Way band for depth.
    const band = context.createLinearGradient(width * 0.1, height, width * 0.9, 0);
    band.addColorStop(0, 'rgba(80, 120, 200, 0)');
    band.addColorStop(0.45, 'rgba(110, 150, 230, 0.07)');
    band.addColorStop(1, 'rgba(180, 140, 220, 0)');
    context.fillStyle = band;
    context.fillRect(0, 0, width, height);
  }

  function drawStars(width, height) {
    for (const star of stars) {
      const point = project(star.az, star.alt);
      if (point.x < -2 || point.x > width + 2 || point.y < -2 || point.y > height + 2) continue;
      context.globalAlpha = star.alpha;
      context.fillStyle = star.size > 1.6 ? '#dce8ff' : '#aebfe0';
      context.beginPath();
      context.arc(point.x, point.y, star.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // Under the horizon: Belu's ocean, translucent, so buried targets still show through.
  function drawGround(width, height) {
    const horizonY = height / 2 + view.alt * scale;
    if (horizonY >= height) return;
    const top = Math.max(0, horizonY);
    const gradient = context.createLinearGradient(0, horizonY, 0, horizonY + 90 * scale);
    gradient.addColorStop(0, 'rgba(20, 90, 114, 0.55)');
    gradient.addColorStop(1, 'rgba(11, 10, 31, 0.9)');
    context.fillStyle = gradient;
    context.fillRect(0, top, width, height - top);
    context.fillStyle = 'rgba(160, 225, 255, 0.75)';
    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'left';
    const labelY = Math.max(horizonY + 20, 20);
    if (labelY < height - 24) context.fillText('BELOW THE HORIZON · BELU HEARS THROUGH THE EARTH', 10, labelY);
  }

  function drawGrid(width, height) {
    context.strokeStyle = 'rgba(120, 160, 220, 0.13)';
    context.fillStyle = 'rgba(150, 180, 220, 0.55)';
    context.lineWidth = 1;
    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'left';

    // Altitude lines every 15°.
    for (let altitude = -90; altitude <= 90; altitude += 15) {
      const y = height / 2 - (altitude - view.alt) * scale;
      if (y < -20 || y > height + 20) continue;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
      if (y > 14 && y < height - 6) {
        context.fillText(`${altitude}°`, 8, y - 4);
      }
    }

    // Azimuth lines every 30°.
    const halfView = FOV_WIDTH_DEG / 2;
    const startAz = Math.ceil((view.az - halfView) / 30) * 30;
    for (let azimuth = startAz; azimuth <= view.az + halfView; azimuth += 30) {
      const x = width / 2 + normalize180(azimuth - view.az) * scale;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    // Horizon.
    const horizonY = height / 2 + view.alt * scale;
    if (horizonY >= 0 && horizonY <= height) {
      context.strokeStyle = 'rgba(93, 228, 255, 0.35)';
      context.setLineDash([6, 6]);
      context.beginPath();
      context.moveTo(0, horizonY);
      context.lineTo(width, horizonY);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = 'rgba(130, 225, 255, 0.8)';
      context.fillText('HORIZON', 10, horizonY - 6);
    }

    // Cardinal points.
    context.textAlign = 'center';
    context.fillStyle = 'rgba(200, 220, 255, 0.75)';
    context.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (let azimuth = 0; azimuth < 360; azimuth += 45) {
      const label = compassPoint(azimuth);
      const point = project(azimuth, 1);
      if (point.x < 12 || point.x > width - 12) continue;
      const y = clamp(height / 2 + view.alt * scale - 10, 14, height - 8);
      context.fillText(label, point.x, y);
    }
  }

  function drawMoon(point, radius, phase) {
    const glow = context.createRadialGradient(point.x, point.y, radius * 0.4, point.x, point.y, radius * 3.4);
    glow.addColorStop(0, 'rgba(244, 231, 184, 0.35)');
    glow.addColorStop(1, 'rgba(244, 231, 184, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(point.x, point.y, radius * 3.4, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#f4e7b8';
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();

    // Shadowed part: an offset dark disc clipped inside the Moon.
    const illuminated = (1 - Math.cos(phase * RADIANS)) / 2;
    context.save();
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#0b0a1f';
    context.beginPath();
    context.arc(point.x + 2 * radius * illuminated, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.strokeStyle = 'rgba(244, 231, 184, 0.6)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.stroke();
  }

  function drawTarget(target, time) {
    if (isHidden(target)) return;
    const point = project(target.az, target.alt);
    const rect = canvas.getBoundingClientRect();
    if (point.x < -40 || point.x > rect.width + 40 || point.y < -40 || point.y > rect.height + 40) return;
    // Under the horizon: drawn faded, "through the Earth"
    const below = target.alt < 0;
    context.save();
    if (below) context.globalAlpha = 0.6;

    const color = target.color || '#9ad7ff';
    const foundAll = target.total > 0 && target.found >= target.total;
    const radius = target.id === 'moon' ? 14 : target.id === 'mars' ? 6 : 5;

    if (target.id === 'moon') {
      drawMoon(point, radius, getMoonPhase());
    } else {
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    }

    // Unknown signal: a pulsing ring, as described in the brief.
    if (!foundAll && target.total > 0) {
      const pulse = reduceMotion ? 0.5 : (Math.sin(time / 450) + 1) / 2;
      context.strokeStyle = `rgba(255, 255, 255, ${0.18 + pulse * 0.35})`;
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(point.x, point.y, radius + 7 + pulse * 5, 0, Math.PI * 2);
      context.stroke();
    }

    if (foundAll) {
      context.strokeStyle = '#5de4ff';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(point.x, point.y, radius + 6, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#5de4ff';
      context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      context.textAlign = 'center';
      context.fillText('✓', point.x, point.y - radius - 10);
    }

    context.fillStyle = 'rgba(220, 235, 255, 0.9)';
    context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'center';
    const suffix = target.total > 0 ? ` ${target.found}/${target.total}` : '';
    context.fillText(`${target.label}${suffix}${below ? ' ↓' : ''}`, point.x, point.y + radius + 17);
    context.restore();
  }

  function drawGuide(time) {
    const targets = targetsWithRobots();
    const nearest = nearestUnfoundTarget(targets);
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const near = nearest && nearest.distance < 6;

    if (nearest && showGuide()) {
      const guide = computeGuide(view, nearest.target);
      context.save();
      context.translate(centerX, centerY);
      context.rotate(guide.rotateDeg * RADIANS);
      context.fillStyle = near ? '#5de4ff' : 'rgba(93, 228, 255, 0.9)';
      context.shadowColor = '#5de4ff';
      context.shadowBlur = near ? 18 : 8;
      context.beginPath();
      context.moveTo(48, 0);
      context.lineTo(30, -8);
      context.lineTo(33, 0);
      context.lineTo(30, 8);
      context.closePath();
      context.fill();
      context.shadowBlur = 0;
      context.restore();

      context.fillStyle = 'rgba(180, 240, 255, 0.85)';
      context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      context.textAlign = 'center';
      context.fillText(
        near ? "YOU'RE ON IT" : `${Math.round(guide.dist)}° → ${nearest.target.label}`,
        centerX,
        centerY + 44,
      );
    }

    // Reticle.
    const pulse = near && !reduceMotion ? 0.6 + 0.4 * Math.sin(time / 160) : 0.7;
    context.strokeStyle = `rgba(93, 228, 255, ${pulse})`;
    context.lineWidth = 1.4;
    context.beginPath();
    context.arc(centerX, centerY, near ? 20 : 16, 0, Math.PI * 2);
    context.stroke();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      context.beginPath();
      context.moveTo(centerX + dx * 22, centerY + dy * 22);
      context.lineTo(centerX + dx * 30, centerY + dy * 30);
      context.stroke();
    }
    context.fillStyle = 'rgba(93, 228, 255, 0.9)';
    context.beginPath();
    context.arc(centerX, centerY, 1.8, 0, Math.PI * 2);
    context.fill();
  }

  function drawHud(width, height) {
    context.textAlign = 'left';
    context.fillStyle = 'rgba(150, 175, 210, 0.85)';
    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(
      `AZ ${view.az.toFixed(1)}° ${compassPoint(view.az)}  ·  ALT ${view.alt.toFixed(1)}°`,
      10,
      height - 10,
    );
    context.textAlign = 'right';
    context.fillText('DRAG · ARROWS · 90° FIELD', width - 10, height - 10);
  }

  function draw(time = 0) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = rect.width;
    const height = rect.height;

    drawBackground(width, height);
    drawStars(width, height);
    drawGround(width, height);
    drawGrid(width, height);
    for (const target of targetsWithRobots()) drawTarget(target, time);
    drawGuide(time);
    overlay?.(context, { project, width, height, time, scale, view });
    drawHud(width, height);
  }

  function tick(time) {
    if (!running) return;
    draw(time);
    frame = requestAnimationFrame(tick);
  }

  function sendAim() {
    lastAim = { az: (view.az + 360) % 360, alt: view.alt };
    onAim(lastAim);
  }

  function clampView() {
    view.az = ((view.az % 360) + 360) % 360;
    view.alt = clamp(view.alt, MIN_ALT, MAX_ALT);
  }

  function lookAt(targetId, offsetDegrees = 0) {
    const target = getTargets().find((item) => item.id === targetId);
    if (!target) return;
    view.az = target.az + offsetDegrees;
    view.alt = clamp(target.alt, MIN_ALT, MAX_ALT);
    clampView();
    sendAim();
    draw(performance.now());
  }

  function centerOnMoon() {
    const target = getTargets().find((item) => item.id === 'moon');
    if (!target) {
      view.az = 180;
      view.alt = 45;
      return;
    }
    // The brief wants the Moon slightly off-centre: an easy first signal.
    view.az = target.az + 15;
    view.alt = target.alt >= MIN_ALT && target.alt <= MAX_ALT ? target.alt : 45;
    clampView();
  }

  function start() {
    if (running) return;
    resize();
    if (!initialized) {
      centerOnMoon();
      initialized = true;
    }
    running = true;
    frame = requestAnimationFrame(tick);
    aimTimer = window.setInterval(sendAim, AIM_INTERVAL_MS);
    sendAim();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
    clearInterval(aimTimer);
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    canvas.setPointerCapture?.(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY, az: view.az, alt: view.alt };
    canvas.focus({ preventScroll: true });
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    view.az = dragging.az - dx / scale;
    view.alt = dragging.alt + dy / scale;
    clampView();
    sendAim();
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = null;
    canvas.releasePointerCapture?.(event.pointerId);
  }

  function onKeyDown(event) {
    const step = event.shiftKey ? 8 : 2;
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft': view.az -= step; break;
      case 'ArrowRight': view.az += step; break;
      case 'ArrowUp': view.alt += step; break;
      case 'ArrowDown': view.alt -= step; break;
      case 'Home': centerOnMoon(); break;
      default: handled = false;
    }
    if (!handled) return;
    event.preventDefault();
    clampView();
    sendAim();
    draw(performance.now());
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('keydown', onKeyDown);

  return {
    start,
    stop,
    lookAt,
    centerOnMoon,
    refresh: () => draw(performance.now()),
    getAim: () => lastAim,
    getView: () => ({ ...view }),
    destroy() {
      stop();
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('keydown', onKeyDown);
    },
  };
}
