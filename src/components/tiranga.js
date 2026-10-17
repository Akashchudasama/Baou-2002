// The national flag, shown with respect:
//  • every day — a slim saffron-white-green ribbon under the masthead with the
//    Ashoka Chakra (navy blue, 24 spokes) at its centre;
//  • on Republic Day (26 Jan) and Independence Day (15 Aug), India time — a
//    gently waving flag with a greeting on the Home page.
// Colours and proportions follow the Flag Code of India (ratio 3:2; saffron
// on top; chakra navy blue, 24 spokes). Preview with ?nationalday=republic|independence.

import { h, s } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { istToday } from './homeExtras.js';

const SAFFRON = '#FF9933';
const WHITE = '#FFFFFF';
const GREEN = '#138808';
const NAVY = '#000080';

function chakra(cx, cy, r) {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI * 2) / 24;
    return s('line', { x1: String(cx), y1: String(cy), x2: (cx + r * Math.cos(a)).toFixed(3), y2: (cy + r * Math.sin(a)).toFixed(3), stroke: NAVY, 'stroke-width': String(r * 0.06) });
  });
  return s('g', {},
    s('circle', { cx: String(cx), cy: String(cy), r: String(r), fill: 'none', stroke: NAVY, 'stroke-width': String(r * 0.12) }),
    s('circle', { cx: String(cx), cy: String(cy), r: String(r * 0.18), fill: NAVY }),
    spokes);
}

/** Full flag, 3:2, as SVG (viewBox 0 0 300 200). */
export function flagSvg(cls = 'flag-svg') {
  return s('svg', { viewBox: '0 0 300 200', class: cls, role: 'img', 'aria-label': 'National Flag of India' },
    s('rect', { x: '0', y: '0', width: '300', height: '66.667', fill: SAFFRON }),
    s('rect', { x: '0', y: '66.667', width: '300', height: '66.667', fill: WHITE }),
    s('rect', { x: '0', y: '133.333', width: '300', height: '66.667', fill: GREEN }),
    chakra(150, 100, 25));
}

export function tirangaRibbon() {
  return h('div', { class: 'tiranga', role: 'presentation' },
    h('span', { class: 'tr-band tr-s' }), h('span', { class: 'tr-band tr-w' }), h('span', { class: 'tr-band tr-g' }),
    s('svg', { viewBox: '0 0 40 40', class: 'tr-chakra', 'aria-hidden': 'true' }, chakra(20, 20, 16)));
}

export function nationalDay() {
  const param = new URLSearchParams(location.search).get('nationalday');
  const md = istToday().md;
  const kind = param === 'republic' || md === '01-26' ? 'republic' : param === 'independence' || md === '08-15' ? 'independence' : null;
  if (!kind) return null;
  const motion = document.documentElement.dataset.fx !== 'saver' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const strips = 14;
  const flag = motion
    ? h('div', { class: 'wave-flag', 'aria-label': 'National Flag of India', role: 'img' },
        Array.from({ length: strips }, (_, i) => h('span', { class: 'wave-strip', style: { '--i': String(i), '--n': String(strips) } }, flagSvg('wave-svg'))))
    : flagSvg('flag-still');
  return h('section', { class: 'national-day' },
    h('div', { class: 'flag-mast' }, flag),
    h('div', {},
      h('p', { class: 'kicker' }, kind === 'republic' ? '26 January' : '15 August'),
      h('h2', { class: 'nd-title' }, t(kind === 'republic' ? 'Happy Republic Day' : 'Happy Independence Day')),
      h('p', { class: 'muted' }, kind === 'republic'
        ? 'With respect to the Constitution of India and to all who serve the nation.'
        : 'With gratitude to all who strove for India’s freedom.')));
}
