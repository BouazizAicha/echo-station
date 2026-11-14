// Story mode: a robot's story told as 7 animated cards over its world (Dev B).
//   1 Arrival      the robot answers Belu · Listen button (voice + subtitles)
//   2 Who I am     drawing of the robot + key dates
//   3 Why sent     the mission · Belu reacts
//   4 Discovery    a hands-on moment (discoveries.js)
//   5 Where now    zoom on the real photo taken from orbit, or the light-time distance
//   6 Who took over  timeline of the missions that came after
//   7 Friends      add as a friend (bubble party) · secret fact · questions · mini-game · sources
// Same robot JSON as Scientist mode; story-only extras come from storydata.js.
import { playVoice, stopVoice, buildCues } from './voice.js';
import { getAudioContext, isMuted } from './radio.js';
import { isFriend, addFriend } from './friends.js';
import { createScene } from './scenes.js';
import { extrasFor, worldOf, yearOf } from './storydata.js';
import { robotPicture } from './silhouettes.js';
import { mountDiscovery, hasDiscovery } from './discoveries.js';
import { minigameOf } from './minigames/index.js';
import { speak, guideOn, stopSpeaking } from './speak.js';

const CARDS = ['arrival', 'who', 'why', 'discovery', 'where', 'legacy', 'friend'];
const CHARS_PER_SECOND = 45;
const reducedMotion = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('a11y-calm'));
const BELU = mood => `assets/images/belu-${mood}.svg`;

let dom = null;
let scene = null;
let current = null;     // { robot, ex, opts, index, cleanup, token }
let token = 0;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* ------------------------------------------------------------------ */
/* DOM (built once, so index.html stays small and conflict-free)       */
/* ------------------------------------------------------------------ */

function buildDom() {
  if (dom) return dom;
  const section = el('section', 'screen cinema');
  section.id = 'screen-cinema';
  section.hidden = true;
  section.setAttribute('aria-label', 'Robot story');
  section.innerHTML = `
    <canvas class="cine-scene" aria-hidden="true"></canvas>
    <header class="cine-top">
      <button class="link cine-back" type="button" aria-label="Back to Belu">← <span class="cine-back-text">Back to Belu</span></button>
      <ol class="cine-dots" aria-hidden="true">${CARDS.map(() => '<li></li>').join('')}</ol>
      <button class="link cine-skip" type="button">Skip ▸</button>
    </header>
    <div class="cine-stage">
      <div class="cine-robot"></div>
      <div class="cine-belu">
        <div class="cine-porthole" aria-hidden="true">
          <div class="cine-window"><img alt="" src="${BELU('happy')}"></div>
          <span class="ring"></span><span class="ring r2"></span><span class="ring r3"></span>
        </div>
        <p class="cine-bubble"></p>
      </div>
    </div>
    <article class="cine-card" aria-live="off"></article>
    <canvas class="cine-party" aria-hidden="true"></canvas>`;
  // Insert before the subtitles so the screens stay together in the page
  const anchor = document.getElementById('subtitles');
  document.body.insertBefore(section, anchor || null);
  dom = {
    section,
    canvas: section.querySelector('.cine-scene'),
    back: section.querySelector('.cine-back'),
    skip: section.querySelector('.cine-skip'),
    dots: [...section.querySelectorAll('.cine-dots li')],
    stage: section.querySelector('.cine-stage'),
    robot: section.querySelector('.cine-robot'),
    beluImg: section.querySelector('.cine-porthole img'),
    porthole: section.querySelector('.cine-porthole'),
    bubble: section.querySelector('.cine-bubble'),
    card: section.querySelector('.cine-card'),
    party: section.querySelector('.cine-party'),
  };
  scene = createScene(dom.canvas);
  dom.skip.addEventListener('click', () => go(CARDS.length - 1));
  section.addEventListener('keydown', e => {
    if (!current || e.target.closest('.disc-stage, .disc-hold, input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current.index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current.index - 1); }
  });
  return dom;
}
buildDom();

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

// Typewriter text; screen readers get the full sentence at once. Tap the text to finish it.
function typed(text, myToken) {
  const p = el('p', 'cine-text');
  const sr = el('span', 'sr-only', text);
  const vis = el('span', 'typed');
  vis.setAttribute('aria-hidden', 'true');
  p.append(sr, vis);
  if (reducedMotion()) { vis.textContent = text; return p; }
  let finished = false;
  const start = performance.now();
  vis.classList.add('typing');
  const finish = () => { finished = true; vis.textContent = text; vis.classList.remove('typing'); };
  p.addEventListener('click', finish);
  const step = now => {
    if (finished || myToken !== token) return;
    const n = Math.min(text.length, Math.floor((now - start) / 1000 * CHARS_PER_SECOND));
    vis.textContent = text.slice(0, n);
    if (n >= text.length) return finish();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return p;
}

function say(text, mood = 'happy') {
  dom.bubble.textContent = text;
  dom.bubble.classList.remove('pop');
  void dom.bubble.offsetWidth;
  dom.bubble.classList.add('pop');
  dom.beluImg.src = BELU(mood);
  dom.porthole.style.setProperty('--echo-dur', mood === 'sad' ? '3s' : mood === 'happy' ? '1.2s' : '1.8s');
}

function chime(notes = [660, 880, 1320]) {
  const ctx = getAudioContext();
  if (!ctx) return;
  notes.forEach((f, i) => {
    const t = ctx.currentTime + i * 0.12;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.55);
  });
}

function nav(index, robot, opts) {
  const n = el('nav', 'cine-nav');
  const prev = el('button', 'cine-prev', '◂');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous');
  prev.disabled = index === 0;
  prev.addEventListener('click', () => go(index - 1));
  n.appendChild(prev);
  if (index < CARDS.length - 1) {
    const next = el('button', 'big cine-next', 'Next ▸');
    next.type = 'button';
    next.addEventListener('click', () => go(index + 1));
    n.appendChild(next);
  } else {
    const out = el('button', 'big cine-next', 'Find the next friend ▸');
    out.type = 'button';
    out.addEventListener('click', () => opts.onExit && opts.onExit());
    n.appendChild(out);
  }
  return n;
}

function chip(text) {
  return el('span', 'cine-chip mono', text);
}

/* ------------------------------------------------------------------ */
/* Voice: the recorded mp3 if it exists, otherwise the browser voice   */
/* ------------------------------------------------------------------ */

let speaking = null;

function subtitles(text) {
  const subs = document.getElementById('subtitles');
  if (!subs) return;
  subs.hidden = !text;
  if (text && subs.textContent !== text) subs.textContent = text;
}

function stopListening() {
  if (!speaking) return;
  const s = speaking;
  speaking = null;
  stopVoice();
  try { window.speechSynthesis?.cancel(); } catch (e) { /* ignore */ }
  clearInterval(s.timer);
  subtitles('');
  if (s.button?.isConnected) s.button.innerHTML = s.label;
}

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  const en = voices.filter(v => /^en(-|_|$)/i.test(v.lang));
  return en.find(v => /Google US English|Samantha|Karen|Daniel|Microsoft (Aria|Jenny|Guy)/i.test(v.name)) || en[0] || null;
}

function speakWithBrowser(robot, session) {
  if (!('speechSynthesis' in window) || !robot.voice_text) return false;
  const text = robot.voice_text;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.95;
  u.pitch = 1.1;
  const voice = pickVoice();
  if (voice) u.voice = voice;
  // Subtitles: follow the voice word by word if the browser tells us where it is, else estimate
  const estimate = text.split(/\s+/).length / 2.5;
  const cues = buildCues(text, estimate);
  let offset = 0;
  const offsets = cues.map(c => { const at = text.indexOf(c.text, offset); offset = at + c.text.length; return { at, text: c.text }; });
  let usedBoundary = false;
  u.onboundary = e => {
    usedBoundary = true;
    const cue = [...offsets].reverse().find(c => c.at <= e.charIndex);
    if (cue && speaking === session) subtitles(cue.text);
  };
  const started = performance.now();
  session.timer = setInterval(() => {
    if (usedBoundary || speaking !== session) return;
    const t = (performance.now() - started) / 1000;
    const cue = cues.find(c => t >= c.start && t < c.end);
    subtitles(cue ? cue.text : '');
  }, 200);
  u.onend = u.onerror = () => { if (speaking === session) stopListening(); };
  window.speechSynthesis.cancel();
  if (isMuted()) {
    // Sound off: read-along subtitles only
    setTimeout(() => { if (speaking === session) stopListening(); }, estimate * 1000 + 500);
    return true;
  }
  window.speechSynthesis.speak(u);
  return true;
}

async function listen(robot, button) {
  if (speaking) { stopListening(); return; }
  const session = { button, label: button.innerHTML, timer: 0 };
  speaking = session;
  button.innerHTML = '<span aria-hidden="true">■</span> Stop';
  let cues = null;
  const me = isMuted() ? null : await playVoice(`assets/audio/${robot.id}.mp3`, {
    onTime: (t, duration) => {
      if (speaking !== session || !robot.voice_text) return;
      cues ??= buildCues(robot.voice_text, duration);
      const cue = cues.find(c => t >= c.start && t < c.end);
      subtitles(cue ? cue.text : '');
    },
    onEnd: () => { if (speaking === session) stopListening(); },
  });
  if (speaking !== session) { stopVoice(); return; }
  if (!me && !speakWithBrowser(robot, session)) stopListening();
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function cardArrival(card, { robot, ex, opts }, myToken) {
  const world = worldOf(robot);
  card.append(
    el('p', 'cine-eyebrow mono', `ECHO RECEIVED · ${world.label.toUpperCase()}`),
    el('h2', 'cine-title', robot.name),
    typed(robot.greeting || 'Hello Belu… you found me!', myToken),
  );
  const row = el('div', 'cine-row');
  if (robot.voice_text) {
    const b = el('button', 'cine-listen');
    b.type = 'button';
    b.innerHTML = `<span aria-hidden="true">🔊</span> Listen to ${robot.name}`;
    b.addEventListener('click', () => listen(robot, b));
    row.appendChild(b);
  }
  if (opts.found) row.appendChild(chip(`Found in ${opts.found.clicks} click${opts.found.clicks === 1 ? '' : 's'} ${'★'.repeat(opts.found.stars)}${'☆'.repeat(3 - opts.found.stars)}`));
  if (opts.light) row.appendChild(chip(`Signal time to Earth: ${opts.light}`));
  card.appendChild(row);
  say(ex.belu.arrival, 'happy');
}

function cardWho(card, { robot, ex }, myToken) {
  card.append(el('p', 'cine-eyebrow mono', 'WHO I AM'), el('h2', 'cine-title', `I'm ${robot.name}`));
  card.appendChild(typed(robot.story?.who_i_am || '', myToken));
  const row = el('div', 'cine-row');
  if (robot.launched) row.appendChild(chip(`Launched ${yearOf(robot.launched)}`));
  if (robot.landed) row.appendChild(chip(`Landed ${yearOf(robot.landed)}`));
  row.appendChild(chip(robot.last_signal ? `Last signal ${yearOf(robot.last_signal)}` : 'No radio since 1969'));
  card.appendChild(row);
  say(ex.belu.who, 'neutral');
}

function cardWhy(card, { robot, ex }, myToken) {
  card.append(el('p', 'cine-eyebrow mono', 'WHY I WAS SENT'), el('h2', 'cine-title', 'My mission'));
  card.appendChild(typed(robot.story?.why_sent || '', myToken));
  say(ex.belu.why, 'happy');
}

function cardDiscovery(card, state, myToken) {
  const { robot, ex } = state;
  card.append(el('p', 'cine-eyebrow mono', 'WHAT I DISCOVERED'), el('h2', 'cine-title', ex.beat.title));
  const result = el('div', 'cine-result');
  result.hidden = true;
  result.append(el('p', 'cine-result-title mono', 'DISCOVERY!'), el('p', 'cine-result-text', ex.beat.result || ''));
  const more = el('p', 'cine-text cine-more', robot.story?.discoveries || '');
  more.hidden = true;
  let skip = null;
  const reveal = () => {
    if (!more.hidden) return;
    result.hidden = !ex.beat.result;
    more.hidden = false;
    skip?.remove();
    // Robots shown with the distance (no orbital photo): their archive photo appears here
    if (ex.where.mode === 'distance' && robot.proof_image?.file) {
      const fig = el('figure', 'cine-photo');
      const img = el('img');
      img.alt = robot.proof_image.caption || '';
      img.onerror = () => fig.remove();
      img.src = robot.proof_image.file;
      fig.append(img, el('figcaption', null, `${robot.proof_image.caption || ''} Credit: ${robot.proof_image.credit || ''}`));
      result.after(fig);
    }
    say(ex.belu.discovery, 'happy');
    speak(`Discovery! ${ex.beat.result || ''} ${robot.story?.discoveries || ''}`, { interrupt: true });
    chime();
    dom.section.querySelector('.cine-next')?.classList.add('ready');
  };
  if (hasDiscovery(robot)) {
    if (ex.beat.how) card.appendChild(el('p', 'cine-how', ex.beat.how));
    const box = el('div', 'disc');
    card.appendChild(box);
    const cleanupMoment = mountDiscovery(box, robot, { onDone: reveal });
    // Audio guide: read the little status line of the discovery moment when it changes
    const watcher = new MutationObserver(() => {
      const line = box.querySelector('.disc-status')?.textContent;
      if (line) speak(line, { minGap: 1200 });
    });
    watcher.observe(box, { subtree: true, childList: true, characterData: true });
    state.cleanup = () => { watcher.disconnect(); cleanupMoment(); };
    skip = el('button', 'link cine-skip-game', 'Skip the game');
    skip.type = 'button';
    skip.addEventListener('click', reveal);
    card.appendChild(skip);
    say('Can you help me look?', 'neutral');
  } else {
    more.hidden = false;
    say(ex.belu.discovery, 'happy');
  }
  card.append(result, more);
  void myToken;
}

function orbitZoom(robot, ex) {
  const proof = robot.proof_image;
  const fig = el('figure', 'orbit-zoom');
  const focus = ex.where.focus || { x: 50, y: 50 };
  fig.innerHTML = `
    <div class="oz-frame">
      <div class="oz-img"><img alt=""></div>
      <span class="oz-scan" aria-hidden="true"></span>
      <span class="oz-marker" aria-hidden="true"></span>
      <span class="oz-label mono"></span>
    </div>
    <figcaption></figcaption>`;
  const img = fig.querySelector('img');
  const zoomBox = fig.querySelector('.oz-img');
  zoomBox.style.transformOrigin = `${focus.x}% ${focus.y}%`;
  const marker = fig.querySelector('.oz-marker');
  marker.style.left = `${focus.x}%`;
  marker.style.top = `${focus.y}%`;
  fig.querySelector('.oz-label').textContent = ex.where.label;
  fig.querySelector('figcaption').textContent = `${proof.caption || ''} Credit: ${proof.credit || ''}`;
  img.alt = proof.caption || '';
  img.src = proof.file;
  const play = () => {
    // the frame takes the photo's own shape, so the focus point (in %) stays exact
    if (img.naturalWidth && img.naturalHeight) {
      fig.querySelector('.oz-frame').style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    }
    if (reducedMotion()) { fig.classList.add('zoomed'); return; }
    fig.classList.add('scanning');
    setTimeout(() => fig.classList.add('zoomed'), 1500);
  };
  img.addEventListener('load', play, { once: true });
  return { fig, img };
}

function distanceView(robot, opts) {
  const box = el('div', 'distance');
  box.innerHTML = `
    <div class="dist-line" aria-hidden="true"><span class="dist-earth"></span><span class="dist-path"><i></i></span><span class="dist-robot"></span></div>
    <div class="dist-labels mono" aria-hidden="true"><span>EARTH</span><span></span></div>
    <p class="dist-big mono"></p>
    <p class="dist-note"></p>`;
  box.querySelector('.dist-labels span:last-child').textContent = robot.name.toUpperCase();
  box.querySelector('.dist-big').textContent = opts.light || '';
  box.querySelector('.dist-note').textContent = opts.light
    ? `If ${robot.name} could still talk, its message would need that long to reach Earth, traveling at the speed of light.`
    : '';
  return box;
}

function cardWhere(card, { robot, ex, opts }, myToken) {
  const place = (robot.site || '').split(',')[0].replace(/\s*\(.*\)\s*$/, '');
  card.append(el('p', 'cine-eyebrow mono', 'WHERE I AM NOW'), el('h2', 'cine-title', place || 'Where I am now'));
  const visual = el('div', 'cine-visual');
  if (ex.where.mode === 'zoom' && robot.proof_image?.file) {
    const { fig, img } = orbitZoom(robot, ex);
    img.addEventListener('error', () => { fig.replaceWith(distanceView(robot, opts)); }, { once: true });
    visual.appendChild(fig);
  } else {
    visual.appendChild(distanceView(robot, opts));
  }
  card.append(visual, typed(robot.story?.where_now || '', myToken));
  dom.robot.classList.add('silent');
  say(ex.belu.where, 'sad');
}

function cardLegacy(card, { robot, ex }, myToken) {
  card.append(el('p', 'cine-eyebrow mono', 'WHO TOOK OVER'), el('h2', 'cine-title', 'My friends kept exploring'));
  if (ex.successors.length) {
    const list = el('ol', 'timeline');
    const me = el('li', 'tl-item tl-me');
    me.append(el('span', 'tl-year mono', yearOf(robot.landed || robot.launched)), el('b', null, robot.name), el('span', 'tl-note', robot.last_signal ? `quiet since ${yearOf(robot.last_signal)}` : 'still standing there'));
    list.appendChild(me);
    ex.successors.forEach((s, i) => {
      const li = el('li', 'tl-item');
      li.style.setProperty('--i', i + 1);
      li.append(el('span', 'tl-year mono', String(s.year)), el('b', null, s.name), el('span', 'tl-note', s.note || ''));
      list.appendChild(li);
    });
    const now = el('li', 'tl-item tl-now');
    now.style.setProperty('--i', ex.successors.length + 1);
    now.append(el('span', 'tl-year mono', String(new Date().getFullYear())), el('b', null, 'You!'), el('span', 'tl-note', 'listening with Belu'));
    list.appendChild(now);
    card.appendChild(list);
  }
  card.appendChild(typed(robot.story?.legacy || '', myToken));
  dom.robot.classList.remove('silent');
  say(ex.belu.legacy, 'happy');
}

function cardFriend(card, { robot, ex, opts }) {
  card.append(el('p', 'cine-eyebrow mono', 'FRIENDS'));
  const title = el('h2', 'cine-title');
  const button = el('button', 'big cine-add');
  button.type = 'button';
  const refresh = () => {
    const f = isFriend(robot.id);
    title.textContent = f ? `${robot.name} is Belu's friend!` : `Will you be Belu's friend, ${robot.name}?`;
    button.textContent = f ? 'Friends forever ✓' : `Add ${robot.name} as a friend`;
    button.disabled = f;
    dom.robot.classList.toggle('friend', f);
  };
  button.addEventListener('click', () => {
    addFriend(robot.id);
    refresh();
    party();
    chime([523, 659, 784, 1047]);
    say(ex.belu.friendYes, 'happy');
    speak(`${robot.name} is Belu's friend! ${ex.belu.friendYes}`, { interrupt: true });
    if (opts.onFriend) opts.onFriend(robot);
  });
  refresh();
  card.append(title, button);

  if (robot.human_touch) {
    const secret = el('div', 'cine-secret');
    secret.append(el('p', 'mono', 'SECRET FACT'), el('p', null, robot.human_touch));
    card.appendChild(secret);
  }
  if (opts.canPlay?.(robot)) {
    const game = minigameOf(robot);
    const help = el('button', 'cine-help', `▶ Play: ${game?.title || `Help ${robot.name}`}`);
    help.type = 'button';
    help.addEventListener('click', () => opts.onMinigame && opts.onMinigame(robot));
    card.appendChild(help);
  }
  if (robot.questions?.length) {
    card.appendChild(el('h3', 'cine-h3', `Ask ${robot.name} something`));
    for (const { q, a } of robot.questions) {
      const wrap = el('div', 'qa');
      const b = el('button', 'cine-q', q);
      b.type = 'button';
      const ans = el('p', 'answer', a);
      ans.hidden = true;
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', () => {
        ans.hidden = !ans.hidden;
        b.setAttribute('aria-expanded', String(!ans.hidden));
      });
      wrap.append(b, ans);
      card.appendChild(wrap);
    }
  }
  if (robot.sources?.length) {
    const d = el('details', 'cine-sources');
    d.append(el('summary', null, `Sources (${robot.sources.length})`));
    const ul = el('ul');
    for (const s of robot.sources) {
      const li = el('li');
      const a = el('a', null, s.title);
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
      li.appendChild(a);
      ul.appendChild(li);
    }
    d.appendChild(ul);
    card.appendChild(d);
  }
  if (!isFriend(robot.id)) say(ex.belu.friend, 'happy');
  else say(ex.belu.friendYes, 'happy');
}

const RENDER = { arrival: cardArrival, who: cardWho, why: cardWhy, discovery: cardDiscovery, where: cardWhere, legacy: cardLegacy, friend: cardFriend };

/* ------------------------------------------------------------------ */
/* Bubble party when a robot becomes Belu's friend                     */
/* ------------------------------------------------------------------ */

function party() {
  if (reducedMotion()) return;
  const c = dom.party;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#5de4ff', '#ff9bd5', '#b49bff', '#eef0ff'];
  const bubbles = Array.from({ length: 46 }, () => ({
    x: Math.random() * w, y: h + Math.random() * h * 0.4, r: 4 + Math.random() * 16,
    v: 120 + Math.random() * 220, wob: Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  c.hidden = false;
  const frame = now => {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, w, h);
    for (const b of bubbles) {
      const y = b.y - b.v * t;
      const x = b.x + Math.sin(t * 3 + b.wob) * 12;
      ctx.globalAlpha = Math.max(0, Math.min(1, 2.6 - t));
      ctx.strokeStyle = b.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (t < 2.8) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, w, h); c.hidden = true; }
  };
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

function go(index) {
  if (!current) return;
  const i = Math.max(0, Math.min(CARDS.length - 1, index));
  if (current.cleanup) { current.cleanup(); current.cleanup = null; }
  stopListening();
  current.index = i;
  const myToken = ++token;

  dom.dots.forEach((d, k) => { d.classList.toggle('done', k < i); d.classList.toggle('on', k === i); });
  dom.skip.hidden = i === CARDS.length - 1;
  dom.section.dataset.card = CARDS[i];      // later cards get a shorter stage (more room for the card)
  scene.setHorizon(i >= 3 ? 0.22 : 0.34);

  const card = dom.card;
  card.innerHTML = '';
  card.dataset.card = CARDS[i];
  card.classList.remove('enter');
  void card.offsetWidth;
  card.classList.add('enter');
  card.appendChild(el('p', 'sr-only', `Part ${i + 1} of ${CARDS.length}`));
  RENDER[CARDS[i]](card, current, myToken);
  card.appendChild(nav(i, current.robot, current.opts));

  // Audio guide: read the card (title, text, instructions, what Belu says)
  if (guideOn()) {
    const parts = [
      card.querySelector('.cine-title')?.textContent,
      card.querySelector('.cine-text .sr-only')?.textContent,
      card.querySelector('.cine-how')?.textContent,
      dom.bubble.textContent ? `Belu says: ${dom.bubble.textContent}` : '',
    ];
    speak(parts.filter(Boolean).map(t => t.trim().replace(/[.…]+$/, '')).join('. '), { interrupt: true });
  }

  // Move focus to the new title (keyboard and screen reader users follow the story)
  const title = card.querySelector('.cine-title');
  if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  if (i > 0) dom.section.scrollIntoView?.({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/**
 * Opens the story-mode version of a robot's story.
 * opts: { light, onMinigame(robot), onFriend(robot), onExit(), canPlay(robot) }
 */
export function showCinema(robot, opts = {}) {
  buildDom();
  stopCinema();
  const ex = extrasFor(robot);
  current = { robot, ex, opts, index: 0, cleanup: null };
  dom.section.dataset.world = worldOf(robot).scene;
  dom.section.dataset.type = robot.type || '';
  dom.back.onclick = () => opts.onExit && opts.onExit();

  dom.robot.innerHTML = '';
  dom.robot.className = 'cine-robot arrive';
  dom.robot.appendChild(robotPicture(robot));
  for (const r of ['', 'r2']) dom.robot.appendChild(el('span', `ping ${r}`));

  scene.set(worldOf(robot).scene);
  scene.start();
  go(0);
}

// Re-opens the current card (used when coming back from the mini-game)
export function resumeCinema() {
  if (!current) return;
  scene.start();
}

export function stopCinema() {
  token++;
  stopListening();
  stopSpeaking();
  if (current?.cleanup) current.cleanup();
  if (current) current.cleanup = null;
  scene?.stop();
}
