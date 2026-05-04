/**
 * clubTheme — Dynamisches Theme-System basierend auf Vereinsfarben
 * Speichert in localStorage, wendet CSS-Variablen an
 */

const DEFAULT_THEME = {
  '--primary': '142 76% 48%',
  '--primary-foreground': '220 20% 6%',
  '--accent': '142 60% 35%',
  '--ring': '142 76% 48%',
  '--sidebar-primary': '142 76% 48%',
  '--sidebar-ring': '142 76% 48%',
};

const STORAGE_KEY = 'tactiq_club_theme';

/** Hex-Farbe (#RRGGBB) → HSL-String "H S% L%" für CSS-Variablen */
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Prüft ob eine Farbe "hell" ist (für Kontrast-Entscheidungen) */
export function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/** Vereinsfarben auf das Theme anwenden */
export function applyClubTheme(primaryHex, secondaryHex, accentHex) {
  if (!primaryHex) return;

  const primaryHsl = hexToHsl(primaryHex);
  const isLight = isLightColor(primaryHex);
  const fgHsl = isLight ? '220 20% 6%' : '210 20% 95%';

  const vars = {
    '--primary': primaryHsl,
    '--primary-foreground': fgHsl,
    '--ring': primaryHsl,
    '--sidebar-primary': primaryHsl,
    '--sidebar-ring': primaryHsl,
  };

  if (accentHex) {
    vars['--accent'] = hexToHsl(accentHex);
    vars['--accent-foreground'] = isLightColor(accentHex) ? '220 20% 6%' : '210 20% 95%';
  } else if (secondaryHex) {
    vars['--accent'] = hexToHsl(secondaryHex);
  }

  // CSS-Variablen auf :root setzen
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });

  // In localStorage sichern
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ vars, primaryHex, secondaryHex, accentHex }));
}

/** Theme zurücksetzen auf Standard */
export function resetTheme() {
  const root = document.documentElement;
  Object.entries(DEFAULT_THEME).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  localStorage.removeItem(STORAGE_KEY);
}

/** Gespeichertes Theme beim App-Start wiederherstellen */
export function restoreTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const { vars } = JSON.parse(saved);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
  } catch {
    // ignore
  }
}

/** Aktuell gespeichertes Theme laden */
export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}