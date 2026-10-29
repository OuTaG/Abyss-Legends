// Icones vectorielles simples (formes pleines, contour sombre), en SVG inline.
const svg = (corps: string, vb = '0 0 24 24'): string => `<svg viewBox="${vb}" aria-hidden="true">${corps}</svg>`;

export const ICONES = {
  boutique: svg('<path d="M5 8h14l-1.2 12H6.2z" fill="#c9a24a" stroke="#1a1206" stroke-width="1.4"/><path d="M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9" fill="none" stroke="#1a1206" stroke-width="1.6"/><circle cx="12" cy="14" r="2" fill="#1a1206"/>'),
  heros: svg('<circle cx="12" cy="8" r="4.2" fill="#8a5a36" stroke="#1a1206" stroke-width="1.3"/><path d="M4.5 21c.6-4.6 3.6-7 7.5-7s6.9 2.4 7.5 7z" fill="#2b5566" stroke="#1a1206" stroke-width="1.3"/><rect x="15.5" y="12" width="3" height="7" rx="1.4" fill="#c9a24a" stroke="#1a1206" stroke-width="1"/>'),
  recif: svg('<path d="M7 21c-.4-4 .2-8-2-12M12 21c0-5 0-9 .5-15M17 21c.3-4-.4-7 2.2-11" fill="none" stroke="#ff7a9a" stroke-width="3" stroke-linecap="round"/><path d="M7 21c-.4-4 .2-8-2-12M12 21c0-5 0-9 .5-15M17 21c.3-4-.4-7 2.2-11" fill="none" stroke="#1a0a10" stroke-width="0.8" stroke-linecap="round" opacity=".5"/>'),
  evenements: svg('<path d="M12 22V7M7 4v5a5 5 0 0 0 10 0V4M12 3v4" fill="none" stroke="#e8c870" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="15" r="2.2" fill="#3ad7e0" stroke="#1a1206" stroke-width="1"/>'),
  pets: svg('<path d="M12 3c4 0 7 6 7 10.5A7 7 0 0 1 5 13.5C5 9 8 3 12 3z" fill="#d8e6e8" stroke="#1a1206" stroke-width="1.3"/><circle cx="10" cy="11" r="1.6" fill="#2aa8b8"/><circle cx="14.5" cy="15" r="2" fill="#2aa8b8"/><circle cx="9.5" cy="17" r="1.2" fill="#2aa8b8"/>'),
  or: svg('<circle cx="12" cy="12" r="9" fill="#c8a040" stroke="#3a2a08" stroke-width="1.5"/><circle cx="12" cy="12" r="5.8" fill="none" stroke="#7a5a18" stroke-width="1.4"/><path d="M12 8.5v7M8.5 12h7" stroke="#7a5a18" stroke-width="1.6"/>'),
  gemmes: svg('<path d="M7 4h10l4 5-9 12L3 9z" fill="#1aa8a0" stroke="#062a28" stroke-width="1.4"/><path d="M3 9h18M9 4l3 17 3-17" fill="none" stroke="#7ef0e6" stroke-width="1" opacity=".7"/>'),
  energie: svg('<path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6z" fill="#ffb040" stroke="#3a1a04" stroke-width="1.3" stroke-linejoin="round"/>'),
  reglages: svg('<circle cx="12" cy="12" r="3.2" fill="none" stroke="#e8f0f4" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="#e8f0f4" stroke-width="2" stroke-linecap="round"/>'),
  crane: svg('<path d="M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4 2.5 5v3h9v-3c1.3-1 2.5-2.5 2.5-5a7 7 0 0 0-7-7z" fill="#e8e2d6" stroke="#1a1206" stroke-width="1.3"/><circle cx="9.3" cy="11" r="1.8" fill="#1a1206"/><circle cx="14.7" cy="11" r="1.8" fill="#1a1206"/><path d="M10 18v2M12 18v2M14 18v2" stroke="#1a1206" stroke-width="1.2"/>'),
  couronne: svg('<path d="M3 18 4.5 7l4.5 4.5L12 5l3 6.5L19.5 7 21 18z" fill="#d8a838" stroke="#3a2406" stroke-width="1.3" stroke-linejoin="round"/><circle cx="12" cy="14" r="1.6" fill="#c3142d"/>'),
  gauche: svg('<path d="M16 4 6 12l10 8z" fill="#f0dca0" stroke="#3a2a10" stroke-width="1.2"/>'),
  devant: svg('<path d="M4 17 12 6l8 11z" fill="#f0dca0" stroke="#3a2a10" stroke-width="1.2"/>'),
  droite: svg('<path d="M8 4l10 8-10 8z" fill="#f0dca0" stroke="#3a2a10" stroke-width="1.2"/>'),
  coffre: svg('<rect x="3" y="10" width="18" height="10" rx="1.5" fill="#7a4a26" stroke="#1a0a02" stroke-width="1.3"/><path d="M3 10a9 5 0 0 1 18 0z" fill="#8f5a30" stroke="#1a0a02" stroke-width="1.3"/><rect x="10.5" y="11" width="3" height="4" fill="#c9a24a" stroke="#1a0a02" stroke-width=".8"/>'),
  arme: svg('<path d="M4 20 16 8M14 4l6 0 0 6" fill="none" stroke="#d8e0e4" stroke-width="2.2" stroke-linecap="round"/><path d="M4 20l3-1-2-2z" fill="#7a4a26"/>'),
} as const;
