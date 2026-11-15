// Start over (Dev B): erases Belu's friends and the first-time tips, then reloads at the very
// beginning (intro, then the prologue), so someone new can live the whole story.
// Sound, text size and other settings are kept.
const KEYS = ['echo-station-friends', 'echo-station-coach-story', 'echo-station-coach-science'];

export function startOver() {
  try { for (const key of KEYS) localStorage.removeItem(key); } catch (e) { /* private mode */ }
  location.href = location.pathname;
}
