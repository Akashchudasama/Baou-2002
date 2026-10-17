// Theme catalogue shared by the portal picker and the admin console.
// The palettes themselves live in src/styles/themes.css.
export const THEMES = [
  {
    id: 'parchment',
    name: 'Parchment & Ink',
    tagline: 'Oxblood ink, antique brass',
    accent: '#3A0810',
    brass: '#C5A059',
    paper: '#F4EEDD'
  },
  {
    id: 'peacock',
    name: 'Peacock & Saffron',
    tagline: 'Deep peacock teal, saffron gold',
    accent: '#0E3B43',
    brass: '#D08C2B',
    paper: '#ECF0E8'
  },
  {
    id: 'indigo',
    name: 'Indigo Manuscript',
    tagline: 'Indigo dye, old gold',
    accent: '#1F2A5A',
    brass: '#B89A4E',
    paper: '#ECEEF4'
  },
  {
    id: 'kesar',
    name: 'Kesar & Sandalwood',
    tagline: 'Burnt saffron, sandalwood',
    accent: '#7A2E0E',
    brass: '#D6A227',
    paper: '#F5EBDD'
  },
  {
    id: 'neem',
    name: 'Neem & Ivory',
    tagline: 'Neem-leaf green, pale brass',
    accent: '#2F4A2A',
    brass: '#B8975A',
    paper: '#EEF0E2'
  },
  {
    id: 'lotus',
    name: 'Lotus & Bronze',
    tagline: 'Lotus plum, warm bronze',
    accent: '#5B1B3A',
    brass: '#B08D57',
    paper: '#F4E9EA'
  },
  {
    id: 'monsoon',
    name: 'Monsoon Slate',
    tagline: 'Rain-cloud slate, soft brass',
    accent: '#2E3A46',
    brass: '#A88B5A',
    paper: '#E9ECEE'
  },
  {
    id: 'patola',
    name: 'Patola',
    tagline: 'Patan silk green, ruby and gold',
    accent: '#1F5130',
    brass: '#C9A33A',
    paper: '#F3EFE2'
  },
  {
    id: 'ajrakh',
    name: 'Ajrakh',
    tagline: 'Kutch indigo and madder red',
    accent: '#1E2A55',
    brass: '#A23B2A',
    paper: '#EFEAE0'
  },
  {
    id: 'rann',
    name: 'Rann',
    tagline: 'Salt-white desert, deep indigo',
    accent: '#23356E',
    brass: '#B7A57E',
    paper: '#F5F4EF'
  },
  {
    id: 'sabarmati',
    name: 'Sabarmati',
    tagline: 'River blue-grey and copper',
    accent: '#2E4E5C',
    brass: '#B5763C',
    paper: '#E7ECEB'
  },
  {
    id: 'bandhani',
    name: 'Bandhani',
    tagline: 'Tie-dye crimson and saffron',
    accent: '#8E1B2C',
    brass: '#E39B2D',
    paper: '#F7EBDD'
  }
];

export const THEME_IDS = THEMES.map((t) => t.id);
const KEY = 'baou-eng-theme';

export function storedTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return THEME_IDS.includes(t) ? t : null;
  } catch {
    return null;
  }
}

export function applyTheme(id, { persist = false } = {}) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.accent);
  if (persist) {
    try {
      localStorage.setItem(KEY, theme.id);
    } catch { /* storage unavailable */ }
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  return theme;
}

/** Reads a resolved CSS colour token, e.g. cssColor('--ink-core'). */
export function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
