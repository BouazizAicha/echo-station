// Prints the positions computed by the app's own code (js/engine/sky.js) as JSON.
// Usage: node tools/app_positions.mjs 2026-11-15T18:00:00Z 2026-11-15T22:00:00Z ...
// Observer: the app default (Tunis). Used by tools/accuracy_check.py.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sky = await import(pathToFileURL(path.join(root, 'js/engine/sky.js')).href);

// loadSkyTables() uses fetch(): serve the local JSON files instead
globalThis.fetch = async (url) => {
  const name = String(url).match(/data\/sky\/(\w+)\.json/)[1];
  const body = readFileSync(path.join(root, 'data/sky', `${name}.json`), 'utf8');
  return { ok: true, json: async () => JSON.parse(body) };
};
await sky.loadSkyTables(pathToFileURL(root + path.sep).href);

const out = [];
for (const t of process.argv.slice(2)) {
  for (const id of ['moon', 'mars', 'ceres', 'pioneer10']) {
    const h = sky.getHorizontal(id, new Date(t));
    out.push({ t, id, az: h.az, alt: h.alt, ra: h.ra, dec: h.dec, dist_au: h.dist_au, source: h.source });
  }
}
console.log(JSON.stringify(out));
