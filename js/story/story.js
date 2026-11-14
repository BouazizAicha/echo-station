// Story screen (Dev B): typed text, voice, subtitles, photo, questions, sources, "add as a friend".
import { playVoice, stopVoice, buildCues } from './voice.js';
import { isFriend, addFriend } from './friends.js';
import { hasMinigame, minigameOf } from './minigames/index.js';

const BELU = { neutral: 'assets/images/belu-neutral.svg', happy: 'assets/images/belu-happy.svg' };

const PARTS = [
  ['who_i_am', 'Who I am'],
  ['why_sent', 'Why I was sent'],
  ['discoveries', 'What I discovered'],
  ['where_now', 'Where I am now'],
  ['legacy', 'Who took over'],
];
const CHARS_PER_SECOND = 40;
const reducedMotion = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('a11y-calm'));
const $ = id => document.getElementById(id);

let run = 0;          // increases each time a story opens → cancels the previous typing
let skip = false;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Types `text` into `target`, letter by letter. Screen readers get the full text at once (sr-only copy).
async function typeInto(target, text, myRun) {
  const sr = el('span', 'sr-only', text);
  const vis = el('span', 'typed');
  vis.setAttribute('aria-hidden', 'true');
  target.append(sr, vis);
  if (reducedMotion() || skip) { vis.textContent = text; return; }
  vis.classList.add('typing');
  const start = performance.now();
  await new Promise(resolve => {
    const step = now => {
      if (myRun !== run) return resolve();
      if (skip) { vis.textContent = text; return resolve(); }
      const n = Math.min(text.length, Math.floor((now - start) / 1000 * CHARS_PER_SECOND));
      vis.textContent = text.slice(0, n);
      if (n >= text.length) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  vis.classList.remove('typing');
}

const wait = ms => new Promise(r => setTimeout(r, ms));

export async function showStory(robot, { onMinigame, onFriend } = {}) {
  const myRun = ++run;
  skip = false;
  stopVoice();

  $('story-meta').textContent =
    `${robot.body.toUpperCase()} · ${robot.site} · last signal: ${robot.last_signal || 'still active'}`;
  $('story-name').textContent = robot.name;
  $('story-greeting').textContent = robot.greeting || 'Hello Belu… you found me!';

  // "Add as a friend" (Belu smiles when the robot becomes his friend)
  const fb = $('btn-friend');
  const setFriendUI = () => {
    const f = isFriend(robot.id);
    fb.textContent = f ? `${robot.name} is Belu's friend!` : `Add ${robot.name} as a friend`;
    fb.disabled = f;
    $('belu-story').src = f ? BELU.happy : BELU.neutral;
  };
  setFriendUI();
  fb.onclick = () => { addFriend(robot.id); setFriendUI(); if (onFriend) onFriend(robot); };

  // Everything below the story is hidden until the typing is done (or skipped)
  const after = $('story-after');
  after.hidden = true;
  $('btn-skip').hidden = false;

  // Photo
  const fig = $('story-proof');
  if (robot.proof_image?.file) {
    const img = $('proof-img');
    img.onerror = () => { fig.hidden = true; };
    img.src = robot.proof_image.file;
    img.alt = robot.proof_image.caption || '';
    $('proof-caption').textContent = `${robot.proof_image.caption || ''} — Credit: ${robot.proof_image.credit || ''}`;
    fig.hidden = false;
  } else {
    fig.hidden = true;
  }

  // Human touch
  $('story-human').textContent = robot.human_touch || '';
  $('story-human').hidden = !robot.human_touch;

  // Questions
  const qs = $('story-questions');
  qs.innerHTML = '';
  for (const { q, a } of robot.questions || []) {
    const wrap = el('div', 'qa');
    const b = el('button', null, q);
    const ans = el('p', 'answer', a);
    ans.hidden = true;
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => {
      ans.hidden = !ans.hidden;
      b.setAttribute('aria-expanded', String(!ans.hidden));
    });
    wrap.append(b, ans);
    qs.appendChild(wrap);
  }

  // Mini-game button
  const mg = $('btn-minigame');
  mg.hidden = !hasMinigame(robot);
  mg.textContent = `▶ Play: ${minigameOf(robot)?.title || `Help ${robot.name}`}`;
  mg.onclick = () => { if (onMinigame) onMinigame(robot); };

  // Sources
  const sl = $('sources-list');
  sl.innerHTML = '';
  for (const s of robot.sources || []) {
    const li = el('li');
    const a = el('a', null, s.title);
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    li.appendChild(a);
    sl.appendChild(li);
  }

  // Voice + subtitles (if assets/audio/<id>.mp3 exists)
  const subs = $('subtitles');
  subs.hidden = true;
  playVoice(`assets/audio/${robot.id}.mp3`, {
    onTime: (t, duration) => {
      if (myRun !== run || !robot.voice_text) return;
      robot._cues ??= buildCues(robot.voice_text, duration);
      const cue = robot._cues.find(c => t >= c.start && t < c.end);
      subs.hidden = !cue;
      if (cue && subs.textContent !== cue.text) subs.textContent = cue.text;
    },
    onEnd: () => { if (myRun === run) subs.hidden = true; },
  });

  // Typed story, part after part
  const sections = $('story-sections');
  sections.innerHTML = '';
  for (const [key, label] of PARTS) {
    const text = robot.story?.[key];
    if (!text) continue;
    const part = el('div', 'story-part');
    part.append(el('h4', null, label));
    const p = el('p');
    part.appendChild(p);
    sections.appendChild(part);
    await typeInto(p, text, myRun);
    if (myRun !== run) return;
    if (!skip && !reducedMotion()) await wait(350);
  }
  if (myRun !== run) return;
  $('btn-skip').hidden = true;
  after.hidden = false;
}

export function skipTyping() {
  skip = true;
}

export function stopStory() {
  run++;
  stopVoice();
  $('subtitles').hidden = true;
}
