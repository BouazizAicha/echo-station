// Story mode extras (Dev B), keyed by robot id.
// Content (C) can override any of these from the robot JSON:
//   "beat":       { "title": "...", "how": "...", "result": "..." }   → the Discovery moment
//   "successors": [ { "year": 2012, "name": "Curiosity", "note": "..." } ]  → the Who took over timeline
//   "proof_focus": { "x": 32, "y": 53 }   → where the robot is in proof_image, in % (orbital zoom)
// Every fact here was checked against the sources listed in the robot JSON.

export const WORLD = {
  moon: { scene: 'moon', label: 'Moon' },
  mars: { scene: 'mars', label: 'Mars' },
  ceres: { scene: 'ceres', label: 'Ceres' },
  space: { scene: 'deep', label: 'Deep space' },
};

export function worldOf(robot) {
  return WORLD[robot.body] || WORLD.space;
}

const EXTRAS = {
  'apollo11-eagle': {
    beat: {
      title: 'Footsteps on the Moon',
      how: 'Tap the grey dust to walk like Neil and Buzz. Watch the seismometer!',
      result: 'The astronauts set up a seismometer, an instrument that feels the ground shake. It was so sensitive that it felt their footsteps!',
    },
    successors: [
      { year: 1969, name: 'Apollo 12', note: 'Next crew on the Moon' },
      { year: 1972, name: 'Apollo 17', note: 'Last crew to walk there' },
      { year: 2009, name: 'Lunar Reconnaissance Orbiter', note: 'Photographed me from orbit' },
      { year: 2026, name: 'Artemis II', note: 'Astronauts flew around the Moon' },
    ],
    where: { mode: 'zoom', label: 'EAGLE IS HERE' },
    belu: {
      who: 'Four legs! I have zero legs… only flippers.',
      why: 'You carried the first people to walk on the Moon? Wow.',
    },
  },
  spirit: {
    beat: {
      title: 'A broken wheel found a secret',
      how: 'One wheel is stuck. Drag Spirit backward to scrape away the dust.',
      result: 'Silica! On Earth, silica like this forms near hot springs or steam vents. Mars once had hot water here.',
    },
    successors: [
      { year: 2004, name: 'Opportunity', note: 'My twin, on the other side of Mars' },
      { year: 2012, name: 'Curiosity', note: 'A rover as big as a car' },
      { year: 2021, name: 'Perseverance', note: 'Collects rock samples' },
    ],
    where: { mode: 'zoom', label: 'SPIRIT IS HERE' },
    belu: {
      who: 'You have wheels. I have flippers. We are both explorers!',
      why: 'Three months? Like one school term? That is short!',
    },
  },
  opportunity: {
    beat: {
      title: 'Tiny "blueberries" on Mars',
      how: 'Tap the 5 little blue-grey balls hidden in the rock.',
      result: 'Blueberries! These little balls are rich in hematite, a mineral that formed when water soaked these rocks long ago.',
    },
    successors: [
      { year: 2012, name: 'Curiosity', note: 'Still climbing Mount Sharp' },
      { year: 2021, name: 'Perseverance', note: 'Looks for signs of ancient life' },
      { year: 2021, name: 'Ingenuity', note: 'The first helicopter on Mars' },
    ],
    where: { mode: 'zoom', label: 'OPPY IS HERE', focus: { x: 32, y: 53 } },
    belu: {
      who: 'Spirit\'s twin! Do you two look exactly the same?',
      why: 'Looking for old water… I live in water! I can help.',
    },
  },
  ingenuity: {
    beat: {
      title: 'Can anything fly in air this thin?',
      how: 'Press and hold to spin my blades. Let go and they slow down!',
      result: 'Lift-off! Mars air is about 100 times thinner than Earth\'s, so my blades had to spin about 2,400 times a minute.',
    },
    successors: [
      { year: 2024, name: 'My last flight', note: 'Flight 72, in January' },
      { year: 2028, name: 'Dragonfly', note: 'A flying lander for Titan (planned launch)' },
    ],
    where: { mode: 'zoom', label: 'INGENUITY IS HERE' },
    belu: {
      who: 'You can fly? I can only swim… and jump a little.',
      why: 'A test pilot on another planet. That is so brave!',
    },
  },
  dawn: {
    beat: {
      title: 'Bright spots on a dark world',
      how: 'Tap the bright spots inside Occator Crater.',
      result: 'Salt! These bright spots are mostly salt, left behind when salty water came up from below and dried.',
    },
    successors: [
      { year: 2021, name: 'Lucy', note: 'Visits asteroids near Jupiter' },
      { year: 2023, name: 'Psyche', note: 'On its way to a metal asteroid' },
    ],
    where: { mode: 'zoom', label: 'CERES · DAWN CIRCLES ABOVE' },
    belu: {
      who: 'Your solar panels look like big wings!',
      why: 'Leftovers from the beginning of everything? Like a time machine!',
    },
  },
  pioneer10: {
    beat: {
      title: 'A message for whoever finds me',
      how: 'Rub the plate with your finger to reveal my message.',
      result: 'My plaque shows who sent me and where Earth is: a little line leaves the third planet from the Sun.',
    },
    successors: [
      { year: 1973, name: 'Pioneer 11', note: 'Followed my trail' },
      { year: 1977, name: 'Voyager 1 & 2', note: 'Now the farthest robots' },
      { year: 1989, name: 'Galileo', note: 'Orbited Jupiter' },
    ],
    where: { mode: 'distance' },
    belu: {
      who: 'Your antenna looks like a giant ear. I listen with my head!',
      why: 'The first one to cross the asteroid belt? Nobody knew if it was safe!',
    },
  },
};

// Belu's lines when the robot has no specific one (by robot type)
const BY_TYPE = {
  rover: 'You have wheels. I have flippers!',
  helicopter: 'You can fly? I can only swim!',
  lander: 'Four legs! I have zero legs.',
  orbiter: 'You go round and round, like me in a big pool!',
  probe: 'You are so far away… I can barely hear you.',
  'deep space probe': 'You are so far away… I can barely hear you.',
};

// Years and notes for the missions C lists by name in "successors" (["Curiosity", ...])
const KNOWN = {
  'Apollo 12': [1969, 'Second crew on the Moon'], 'Apollo 14': [1971, 'Explored the Fra Mauro highlands'],
  'Apollo 15': [1971, 'First lunar rover drive'], 'Apollo 16': [1972, 'Explored the lunar highlands'],
  'Apollo 17': [1972, 'Last crew to walk on the Moon'], Artemis: [2026, 'Artemis II flew astronauts around the Moon'],
  'Artemis II': [2026, 'Astronauts flew around the Moon'],
  'Lunar Reconnaissance Orbiter': [2009, 'Photographed me from orbit'],
  Opportunity: [2004, 'My twin, on the other side of Mars'], Curiosity: [2012, 'A rover as big as a car'],
  Perseverance: [2021, 'Collects rock samples'], Ingenuity: [2021, 'The first helicopter on Mars'],
  'Future Mars helicopters': ['next', 'Bigger helicopters being designed'], Dragonfly: [2028, 'A flying lander for Titan (planned launch)'],
  Lucy: [2021, 'Visits asteroids near Jupiter'], Psyche: [2023, 'On its way to a metal asteroid'],
  'Pioneer 11': [1973, 'Followed my trail'], 'Voyager 1': [1977, 'Now the farthest robot from Earth'],
  'Voyager 2': [1977, 'Visited all four giant planets'], 'Voyager 1 & 2': [1977, 'Now the farthest robots'],
  'New Horizons': [2006, 'Flew past Pluto in 2015'], Galileo: [1989, 'Orbited Jupiter'],
};

function normaliseSuccessors(list, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback || [];
  return list.map(item => {
    if (item && typeof item === 'object') return { year: item.year ?? '', name: item.name || '', note: item.note || '' };
    const known = KNOWN[item] || (fallback || []).find(s => s.name === item);
    if (Array.isArray(known)) return { year: known[0], name: item, note: known[1] };
    return { year: known?.year ?? '', name: String(item), note: known?.note || '' };
  });
}

export function extrasFor(robot) {
  const base = EXTRAS[robot.id] || {};
  // C may give "beat" as one sentence (the discovery in a nutshell) or as { title, how, result }
  const own = robot.beat && typeof robot.beat === 'object' ? robot.beat : {};
  const beat = Object.assign({
    title: 'What I discovered',
    how: '',
    result: '',
    headline: typeof robot.beat === 'string' ? robot.beat : '',
  }, base.beat || {}, own);
  const successors = normaliseSuccessors(robot.successors, base.successors);
  const where = Object.assign({ mode: 'zoom', label: `${robot.name.toUpperCase()} IS HERE` }, base.where || {});
  if (robot.proof_focus) where.focus = robot.proof_focus;
  const short = robot.name.replace(/\s*\([^)]*\)/g, '').trim();   // "Eagle (Apollo 11)" → "Eagle"
  const belu = Object.assign({
    arrival: `I found you, ${short}!`,
    who: BY_TYPE[robot.type] || `Nice to meet you, ${short}!`,
    why: 'Wow… that is a big mission.',
    discovery: 'Amazing!',
    where: 'Oh… you are all alone out there.',
    legacy: 'So your friends kept exploring for you!',
    friend: 'Will you be my friend?',
    friendYes: 'Best friends forever!',
  }, base.belu || {});
  return { beat, successors, where, belu };
}

// Years shown in the prologue and on the cards
export function yearOf(date) {
  return date ? String(date).slice(0, 4) : '';
}
