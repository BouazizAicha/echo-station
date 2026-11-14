import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), 'utf8'));
}

test('Ceres table has 366 usable points', async () => {
  const documentObject = await readJson('data/sky/ceres.json');
  assert.equal(documentObject.target, 'ceres');
  assert.equal(documentObject.points.length, 366);
  for (const point of documentObject.points) {
    assert.ok(!Number.isNaN(Date.parse(point.t)), point.t);
    assert.ok(point.ra >= 0 && point.ra < 24, `ra ${point.ra}`);
    assert.ok(point.dec >= -90 && point.dec <= 90, `dec ${point.dec}`);
    assert.ok(point.dist_au > 1.5 && point.dist_au < 4, `dist ${point.dist_au}`);
  }
});

test('Pioneer 10 table covers the event year at about 140 AU', async () => {
  const documentObject = await readJson('data/sky/pioneer10.json');
  assert.equal(documentObject.target, 'pioneer10');
  assert.ok(documentObject.points.length >= 300);
  const first = documentObject.points[0];
  const last = documentObject.points[documentObject.points.length - 1];
  assert.ok(first.dist_au > 138 && first.dist_au < 142);
  assert.ok(last.dist_au > 140 && last.dist_au < 143);
  assert.ok(last.dist_au > first.dist_au, 'Pioneer 10 moves away from Earth');
});

test('robot index lists real robots whose sky targets exist', async () => {
  const ids = await readJson('data/robots/index.json');
  assert.ok(Array.isArray(ids), 'index.json is a list of robot ids');
  assert.ok(ids.length >= 3);

  const allowed = new Set(['moon', 'mars', 'ceres', 'pioneer10']);
  const seen = new Set();
  for (const id of ids) {
    assert.ok(!seen.has(id), `duplicate id ${id}`);
    seen.add(id);

    const robot = await readJson(`data/robots/${id}.json`);
    assert.equal(robot.id, id);
    assert.ok(robot.name, `${id} has a name`);
    assert.ok(allowed.has(robot.sky_target), `${id}: ${robot.sky_target}`);
  }
});
