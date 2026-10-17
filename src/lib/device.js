// Chooses the experience tier:
//   full  — WebGL ink, 3D page turns, 3D hero (capable devices, good network)
//   lite  — 2D transitions, vector illustrations, web fonts (modest devices / 3G)
//   saver — for 2G / Data Saver / very slow links (e.g. remote border districts):
//           system fonts, no thumbnails, no motion, offline cache
// Visitors can override from the footer; ?fx=full|lite|saver works too.

const KEY = 'baou-eng-fx';
export const TIERS = ['full', 'lite', 'saver'];

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function detectTier() {
  const param = new URLSearchParams(location.search).get('fx');
  if (TIERS.includes(param)) return param;
  try {
    const saved = localStorage.getItem(KEY);
    if (TIERS.includes(saved)) return saved;
  } catch { /* storage unavailable */ }

  const conn = navigator.connection || {};
  if (conn.saveData) return 'saver';
  if (['slow-2g', '2g'].includes(conn.effectiveType)) return 'saver';
  if (typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < 0.4) return 'saver';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'lite';
  if (conn.effectiveType === '3g') return 'lite';
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return 'lite';
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return 'lite';
  if (matchMedia('(pointer: coarse)').matches && innerWidth < 820) return 'lite';
  if (!webglAvailable()) return 'lite';
  return 'full';
}

export function saveTier(tier) {
  try {
    if (TIERS.includes(tier)) localStorage.setItem(KEY, tier);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function savedTier() {
  try {
    const t = localStorage.getItem(KEY);
    return TIERS.includes(t) ? t : null;
  } catch {
    return null;
  }
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
