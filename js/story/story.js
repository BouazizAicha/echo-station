// Scientist mode: the robot's "mission file" (Dev B).
// Photo first, then a Mission data panel (dates, catalog ID, mass, distance, landing site… each
// with its source), the five parts of the story (shown at once: no typing effect), questions,
// mini-game and all sources. The voice plays with subtitles when assets/audio/<id>.mp3 exists.
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
const WORLD = { moon: 'Moon', mars: 'Mars', ceres: 'Ceres' };
const $ = id => document.getElementById(id);

let run = 0;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function date(value) {
  if (!value) return '';
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function coord(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const lonE = ((lon % 360) + 360) % 360;
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${lonE.toFixed(2)}° E`;
}

function sourceLink(url) {
  if (!url) return null;
  const a = el('a', 'md-src', '↗');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  a.setAttribute('aria-label', 'Source');
  a.title = 'Source';
  return a;
}

// Moves the static parts of the screen into the "mission file" order (done once)
function layout() {
  const screen = $('screen-story');
  if (screen.dataset.layout) return;
  screen.dataset.layout = '1';
  const fig = $('story-proof');
  const greeting = screen.querySelector('.belu-line');
  greeting.before(fig);                                // the photo comes first, under the title
  const panel = el('section', 'mission-data');
  panel.id = 'mission-data';
  panel.setAttribute('aria-label', 'Mission data');
  greeting.after(panel);
  $('btn-skip').hidden = true;
}

function missionData(robot) {
  const panel = $('mission-data');
  panel.innerHTML = '';
  panel.append(el('h3', 'md-title', 'Mission data'));
  const dl = el('dl', 'md-grid');
  const md = robot.mission_data || {};
  const add = (label, value, { note, src } = {}) => {
    if (value == null || value === '') return;
    const dt = el('dt', null, label);
    const dd = el('dd');
    dd.append(el('span', 'md-value', String(value)));
    const link = sourceLink(src);
    if (link) dd.append(' ', link);
    if (note) dd.append(el('span', 'md-note', note));
    dl.append(dt, dd);
  };
  add('Type', robot.type ? robot.type.charAt(0).toUpperCase() + robot.type.slice(1) : '');
  add('Where', `${WORLD[robot.body] || 'Deep space'} · ${robot.site || ''}`);
  add('Launched', date(robot.launched));
  add('Landed', date(robot.landed));
  add('Last signal', robot.last_signal ? date(robot.last_signal) : (robot.status === 'silent' ? 'No radio after the mission' : 'Still active'),
    { note: md.last_signal_note, src: md.last_signal_source_url });
  add('NSSDCA ID', md.nssdca_id || (md.parent_nssdca_id ? `${md.parent_nssdca_id} (carried by)` : ''),
    { src: md.nssdca_source_url || md.parent_nssdca_source_url });
  if (md.mass_kg != null) add('Mass', `${md.mass_kg} kg`, { note: md.mass_scope, src: md.mass_source_url });
  if (md.distance_traveled_km != null) {
    add('Distance', `${md.distance_approximate ? '≈ ' : ''}${md.distance_traveled_km} km`, { note: md.distance_kind, src: md.distance_source_url });
  }
  if (md.flights != null) add('Flights', md.flights, { src: md.flights_source_url });
  const site = md.site_coordinates;
  if (site && Number.isFinite(site.latitude_deg)) {
    add('Landing site', `${site.approximate ? '≈ ' : ''}${coord(site.latitude_deg, site.longitude_deg)}`, { note: site.scope, src: site.source_url });
  }
  const light = $('story-light')?.textContent;
  if (light) add('Signal time', light.replace(/^Light-time from [^:]+:\s*/, ''), { note: 'Light travel time from its world to you, right now' });
  if (md.verified_on) add('Checked', date(md.verified_on));
  panel.append(dl);
  panel.hidden = !dl.children.length;
}

export async function showStory(robot, { onMinigame, onFriend } = {}) {
  const myRun = ++run;
  stopVoice();
  layout();

  $('story-meta').textContent = `MISSION FILE · ${(WORLD[robot.body] || 'DEEP SPACE').toUpperCase()}`;
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

  missionData(robot);

  // The story, all at once (faster to read and to compare)
  const sections = $('story-sections');
  sections.innerHTML = '';
  for (const [key, label] of PARTS) {
    const text = robot.story?.[key];
    if (!text) continue;
    const part = el('div', 'story-part');
    part.append(el('h4', null, label), el('p', null, text));
    sections.appendChild(part);
  }

  // Human touch, questions, mini-game, sources
  $('story-human').textContent = robot.human_touch || '';
  $('story-human').hidden = !robot.human_touch;

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

  const mg = $('btn-minigame');
  mg.hidden = !hasMinigame(robot);
  mg.textContent = `▶ Play: ${minigameOf(robot)?.title || `Help ${robot.name}`}`;
  mg.onclick = () => { if (onMinigame) onMinigame(robot); };

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
  const summary = $('story-sources').querySelector('summary');
  if (summary) summary.textContent = `Sources (${(robot.sources || []).length})`;
  $('btn-skip').hidden = true;
  $('story-after').hidden = false;

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
}

export function skipTyping() { /* the text is shown at once: nothing to skip */ }

export function stopStory() {
  run++;
  stopVoice();
  $('subtitles').hidden = true;
}
