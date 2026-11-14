// Belu's friends (Dev B): the robots the player has added as friends.
// Saved in the browser (localStorage) so the collection survives a page reload.
// Add ?reset to the URL to start over.

import { robotPicture } from './silhouettes.js';

const KEY = 'echo-station-friends';
let friends = new Set();
try {
  if (new URLSearchParams(location.search).has('reset')) localStorage.removeItem(KEY);
  friends = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
} catch (e) { /* private mode: keep it in memory only */ }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify([...friends])); } catch (e) { /* ignore */ }
}

export const isFriend = id => friends.has(id);
export function addFriend(id) { friends.add(id); save(); }
export function countFriends(robots) { return robots.filter(r => friends.has(r.id)).length; }
export function resetFriends() { friends.clear(); save(); }

const PLACES = { moon: 'on the Moon', mars: 'on Mars', ceres: 'around Ceres' };
const place = r => PLACES[r.body] || 'far away in space';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Draws the album: found friends as stickers (tap to read their story again),
// the others as dark shadows with a hint of where to look.
export function renderFriends(grid, robots, { onOpen } = {}) {
  grid.innerHTML = '';
  const found = robots.filter(r => friends.has(r.id)).length;
  const bar = el('div', 'album-progress');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', String(robots.length));
  bar.setAttribute('aria-valuenow', String(found));
  bar.setAttribute('aria-label', `${found} of ${robots.length} friends found`);
  const fill = el('span');
  fill.style.width = `${robots.length ? (found / robots.length) * 100 : 0}%`;
  bar.appendChild(fill);
  grid.parentElement?.querySelectorAll('.album-progress').forEach(b => b.remove());
  grid.before(bar);
  for (const r of robots) {
    const world = r.body === 'moon' ? 'moon' : r.body === 'mars' ? 'mars' : 'far';
    if (friends.has(r.id)) {
      const card = el('button', `friend-card world-${world}`);
      card.type = 'button';
      const pic = el('div', 'friend-pic');
      pic.appendChild(robotPicture(r));
      card.append(pic, el('strong', null, r.name), el('span', 'friend-place', place(r)),
        el('span', 'friend-date mono', r.last_signal ? `quiet since ${String(r.last_signal).slice(0, 4)}` : 'still standing there'));
      card.setAttribute('aria-label', `${r.name}, ${place(r)}. Read the story again.`);
      card.addEventListener('click', () => onOpen && onOpen(r));
      grid.appendChild(card);
    } else {
      const card = el('div', `friend-card unknown world-${world}`);
      const pic = el('div', 'friend-pic');
      pic.appendChild(robotPicture(r));
      pic.appendChild(el('span', 'friend-q', '?'));
      card.append(pic, el('strong', null, 'Not found yet'), el('span', 'friend-place', `Somewhere ${place(r)}`));
      grid.appendChild(card);
    }
  }
}
