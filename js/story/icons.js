// One set of simple line icons for the whole interface (Dev B), drawn the same on every phone
// (emoji look different on Android, iPhone and Windows). 24×24, they follow the text colour.
const wrap = (paths, label) =>
  `<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${paths}</svg>`;

export const ICONS = {
  soundOn: wrap('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>'),
  soundQuiet: wrap('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  soundOff: wrap('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  settings: wrap('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  back: wrap('<path d="M15 5l-7 7 7 7"/>'),
  phone: wrap('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  map: wrap('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/>'),
  help: wrap('<circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6"/><path d="M12 17.3h0"/>'),
  story: wrap('<path d="M12 3l2.3 4.8 5.2.7-3.8 3.7.9 5.2L12 15l-4.6 2.4.9-5.2L4.5 8.5l5.2-.7L12 3z"/>'),
  telescope: wrap('<path d="M3.5 13.5l13-6.5 2 4-13 6.5z"/><path d="M16.5 7l1.5-.7 2 4-1.5.7"/><path d="M10 15.5L7.5 21M11.5 14.8L14 21"/>'),
};
