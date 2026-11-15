// Voice player (Dev B).
// Plays assets/audio/<robot-id>.mp3 through the Web Audio context that was unlocked
// by the "Start listening" tap, so it also works on iPhone without another tap.
// If the file does not exist, nothing happens (the story still works with text only).
import { getAudioContext, isMuted } from './radio.js';

let current = null;

export async function playVoice(url, { onTime, onEnd } = {}) {
  stopVoice();
  const ctx = getAudioContext();
  if (!ctx) return null;

  let buffer;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;                       // no voice recorded yet
    buffer = await ctx.decodeAudioData(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
  if (ctx.state === 'suspended' && !isMuted()) await ctx.resume();

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  const start = ctx.currentTime + 0.05;
  src.start(start);

  const me = { src, raf: 0, duration: buffer.duration };
  const tick = () => {
    const t = ctx.currentTime - start;
    if (onTime) onTime(Math.max(0, t), buffer.duration);
    if (t < buffer.duration && current === me) me.raf = requestAnimationFrame(tick);
  };
  me.raf = requestAnimationFrame(tick);
  src.onended = () => {
    cancelAnimationFrame(me.raf);
    if (current === me) current = null;
    if (onEnd) onEnd();
  };
  current = me;
  return me;
}

export function stopVoice() {
  if (!current) return;
  const c = current;
  current = null;
  cancelAnimationFrame(c.raf);
  try { c.src.stop(); } catch (e) { /* already stopped */ }
}

// Subtitles without a timing file: the recorded text (voice_text in the robot JSON)
// is cut into sentences, and each sentence gets a share of the audio duration
// proportional to its length. Good enough for a 45-60 s voice.
export function buildCues(text, duration) {
  const parts = [];
  // A new sentence starts after . ! ? or … only when the next word starts with a capital
  // ("Hello Belu… you found me!" stays together).
  for (const sentence of text.split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/)) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length <= 90) { parts.push(s); continue; }
    let chunk = '';                                  // long sentence: cut at commas
    for (const piece of s.split(/(?<=,)\s+/)) {
      if ((chunk + ' ' + piece).trim().length > 90 && chunk) { parts.push(chunk.trim()); chunk = piece; }
      else chunk = (chunk + ' ' + piece).trim();
    }
    if (chunk) parts.push(chunk.trim());
  }
  const total = parts.reduce((n, p) => n + p.length, 0) || 1;
  let t = 0;
  return parts.map(p => {
    const d = duration * p.length / total;
    const cue = { start: t, end: t + d, text: p };
    t += d;
    return cue;
  });
}
