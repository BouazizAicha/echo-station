// Belu's friends (Dev B): the robots the player has added as friends.
// Saved in the browser (localStorage) so the collection survives a page reload.
// Add ?reset to the URL to start over.

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

// Draws the friend cards. Robots not found yet are shown as silhouettes with a hint.
export function renderFriends(grid, robots, { onOpen } = {}) {
  grid.innerHTML = '';
  for (const r of robots) {
    if (friends.has(r.id)) {
      const card = el('button', 'friend-card');
      const pic = el('div', 'friend-pic');
      if (r.proof_image?.file) {
        const img = el('img');
        img.src = r.proof_image.file;
        img.alt = '';
        img.onerror = () => img.remove();
        pic.appendChild(img);
      }
      card.append(pic, el('strong', null, r.name), el('span', 'friend-place', place(r)),
        el('span', 'friend-date mono', r.last_signal ? `last signal ${r.last_signal}` : 'still answering'));
      card.addEventListener('click', () => onOpen && onOpen(r));
      grid.appendChild(card);
    } else {
      const card = el('div', 'friend-card unknown');
      card.append(el('div', 'friend-pic', '?'), el('strong', null, 'Not found yet'), el('span', 'friend-place', `Somewhere ${place(r)}`));
      grid.appendChild(card);
    }
  }
}
