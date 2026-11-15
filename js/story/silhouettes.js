// Simple robot drawings used until D's illustrations exist (Dev B).
// D: put the final drawing in assets/images/robots/<robot-id>.svg (or .png) and it replaces these automatically.
// These are code-drawn placeholders (made with AI help): replace them before the final submission.

const S = 'stroke="#c9d3e6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const PANEL = 'fill="#1d2a5a" stroke="#5dffb0" stroke-width="2"';
const BODY = 'fill="#2a2660"';

const DRAWINGS = {
  rover: `
    <rect x="38" y="62" width="124" height="10" rx="3" ${PANEL}/>
    <rect x="62" y="72" width="76" height="24" rx="5" ${BODY} ${S}/>
    <path d="M100 62 V36 M92 36 h16" ${S} fill="none"/>
    <rect x="88" y="22" width="24" height="14" rx="3" ${BODY} ${S}/>
    <circle cx="94" cy="29" r="3" fill="#5dffb0"/><circle cx="106" cy="29" r="3" fill="#5dffb0"/>
    <path d="M66 96 L52 108 M100 96 V108 M134 96 L148 108" ${S} fill="none"/>
    <circle cx="48" cy="114" r="10" ${BODY} ${S}/><circle cx="100" cy="114" r="10" ${BODY} ${S}/><circle cx="152" cy="114" r="10" ${BODY} ${S}/>
    <path d="M138 70 L162 52 L170 58" ${S} fill="none"/>`,
  helicopter: `
    <path d="M40 30 H160 M40 44 H160" ${S} fill="none"/>
    <path d="M100 22 V70" ${S}/>
    <rect x="70" y="50" width="60" height="12" rx="2" ${PANEL}/>
    <rect x="80" y="64" width="40" height="30" rx="6" ${BODY} ${S}/>
    <circle cx="100" cy="79" r="4" fill="#5dffb0"/>
    <path d="M84 94 L64 122 M116 94 L136 122 M90 94 L82 122 M110 94 L118 122" ${S} fill="none"/>`,
  lander: `
    <path d="M70 52 L130 52 L142 84 L58 84 Z" fill="#b8a15a" stroke="#c9d3e6" stroke-width="3" stroke-linejoin="round"/>
    <path d="M58 84 L36 120 M142 84 L164 120 M78 84 L70 120 M122 84 L130 120" ${S} fill="none"/>
    <path d="M28 120 h16 M156 120 h16 M62 120 h16 M122 120 h16" ${S}/>
    <path d="M86 52 V40 H114 V52" ${S} fill="none"/>
    <path d="M92 68 h16" stroke="#5dffb0" stroke-width="3" stroke-linecap="round"/>`,
  orbiter: `
    <rect x="8" y="58" width="66" height="22" rx="2" ${PANEL}/>
    <rect x="126" y="58" width="66" height="22" rx="2" ${PANEL}/>
    <path d="M30 58 V80 M52 58 V80 M148 58 V80 M170 58 V80" stroke="#5dffb0" stroke-width="1.5" opacity=".6"/>
    <path d="M74 69 H84 M116 69 H126" ${S}/>
    <rect x="84" y="50" width="32" height="38" rx="4" ${BODY} ${S}/>
    <path d="M100 50 V36" ${S}/><path d="M88 36 Q100 26 112 36" ${S} fill="none"/>
    <circle cx="100" cy="70" r="4" fill="#5dffb0"/>`,
  probe: `
    <path d="M40 54 Q100 18 160 54 Z" fill="#2a2660" stroke="#c9d3e6" stroke-width="3" stroke-linejoin="round"/>
    <path d="M100 54 V30" ${S}/><circle cx="100" cy="28" r="4" fill="#5dffb0"/>
    <rect x="84" y="54" width="32" height="26" rx="3" ${BODY} ${S}/>
    <path d="M84 70 L48 104 M116 70 L152 104 M100 80 V118" ${S} fill="none"/>
    <circle cx="46" cy="106" r="6" ${BODY} ${S}/><circle cx="154" cy="106" r="6" ${BODY} ${S}/>
    <rect x="94" y="62" width="12" height="9" rx="1" fill="#b8a15a"/>`,
};

const TYPE_TO_DRAWING = {
  rover: 'rover',
  helicopter: 'helicopter',
  lander: 'lander',
  'moon lander': 'lander',
  orbiter: 'orbiter',
  'deep space probe': 'probe',
  probe: 'probe',
};

export function silhouetteSvg(robot) {
  const key = TYPE_TO_DRAWING[robot.type] || 'probe';
  return `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Drawing of ${robot.name}">${DRAWINGS[key]}</svg>`;
}

// <img> with D's drawing if it exists, otherwise the placeholder drawing
export function robotPicture(robot) {
  const wrap = document.createElement('div');
  wrap.className = 'robot-pic';
  const img = document.createElement('img');
  img.alt = `Drawing of ${robot.name}`;
  img.decoding = 'async';
  img.onerror = () => { wrap.innerHTML = silhouetteSvg(robot); };
  img.src = `assets/images/robots/${robot.id}.svg`;
  wrap.appendChild(img);
  return wrap;
}
