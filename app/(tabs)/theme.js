// lib/theme.js
// AquaSense UJ — Light theme, derived from the marketing team's logo palette.
// Import C from here instead of redefining it per-screen.

export const C = {
  // Backgrounds
  bg0: '#f4fafd',   // page background
  bg1: '#ffffff',   // header / hero background
  bg2: '#ffffff',   // card background
  bg3: '#eaf6fc',   // secondary tile / pill background (metric grids, chips)

  // Brand
  navy: '#0d2f5f',      // primary heading / logo-navy text
  deepBlue: '#075085',  // secondary brand accent
  blue: '#0fa0df',      // primary accent — buttons, active states, links
  blueLight: '#5ec3ef', // lighter accent — chips, secondary highlights

  // Status (deeper/more saturated than the old dark-theme neons, since
  // pale neon reads as low-contrast/garish against white)
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  purple: '#7c3aed',
  cyan: '#0f8fbf',   // temperature/secondary metric accent

  // Text
  text0: '#0d2f5f',  // primary text (was near-white on dark; now navy on light)
  text1: '#3b5872',  // secondary text
  text2: '#64748b',  // muted text / labels

  border: '#dbe7f0',
};

// Status badge backgrounds — pale tint + deep text from the SAME family,
// per the "text on colored bg uses the darkest shade from that family"
// rule (avoids washed-out pastel-on-pastel or plain-black-on-tint).
export const STATUS = {
  SAFE:    { bg: '#e6f8ee', color: '#16693f' },
  CAUTION: { bg: '#fdf1e0', color: '#92450a' },
  UNSAFE:  { bg: '#fbe8e8', color: '#a32d2d' },
  OFFLINE: { bg: '#eef2f6', color: '#475569' },
};
