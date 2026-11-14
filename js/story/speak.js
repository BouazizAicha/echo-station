// Audio guide (Dev B): reads important text aloud with the browser's voice, only when the
// "Audio guide" setting is on and the sound is not muted. Screen-reader users already hear the
// same text through the live regions, so the guide is off by default.
import { settings, onSettingsChange } from './settings.js';
import { isMuted } from './radio.js';

let lastText = '';
let lastAt = 0;
let voice = null;

function pickVoice() {
  if (voice) return voice;
  const voices = window.speechSynthesis?.getVoices() || [];
  const en = voices.filter(v => /^en(-|_|$)/i.test(v.lang));
  voice = en.find(v => /Google US English|Samantha|Karen|Daniel|Microsoft (Aria|Jenny|Guy)/i.test(v.name)) || en[0] || null;
  return voice;
}

export function guideOn() {
  return settings.audioGuide && !isMuted() && 'speechSynthesis' in window;
}

/**
 * @param {string} text
 * @param {{ interrupt?: boolean, minGap?: number }} opts
 *   interrupt: stop what is being said (new card, important event)
 *   minGap: ms to wait since the last sentence before saying a non-urgent one
 */
export function speak(text, { interrupt = false, minGap = 0 } = {}) {
  if (!text || !guideOn()) return;
  const now = performance.now();
  if (!interrupt && text === lastText && now - lastAt < 4000) return;
  if (!interrupt && now - lastAt < minGap) return;
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();
  else if (synth.speaking && minGap) return;            // don't pile up directions
  const u = new SpeechSynthesisUtterance(text.replace(/[▲▼◀▶➜→←↓↑]/g, ''));
  u.lang = 'en-US';
  u.rate = 1;
  const v = pickVoice();
  if (v) u.voice = v;
  synth.speak(u);
  lastText = text;
  lastAt = now;
}

let wasOn = settings.audioGuide;
onSettingsChange(s => {
  if (s.audioGuide && !wasOn) speak('Audio guide on. I will read the stories and directions aloud.', { interrupt: true });
  if (!s.audioGuide && wasOn) stopSpeaking();
  wasOn = s.audioGuide;
});

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch (e) { /* ignore */ }
}
