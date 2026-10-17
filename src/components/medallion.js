// Portrait medallion: uploaded photo (sepia-toned by CSS) or an engraved monogram.
import { h, initials, s } from '../lib/dom.js';

export function medallion(name, photoUrl, cls = 'medallion') {
  const wrap = h('div', { class: cls });
  if (photoUrl) {
    wrap.append(h('img', { src: photoUrl, alt: '', loading: 'lazy', decoding: 'async' }));
  } else {
    wrap.append(s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      s('defs', {}, s('pattern', { id: `hatch-${initials(name)}`, width: '4', height: '4', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        s('line', { x1: '0', y1: '0', x2: '0', y2: '4', stroke: 'currentColor', 'stroke-width': '0.6', opacity: '0.25' }))),
      s('circle', { cx: '50', cy: '50', r: '47', fill: `url(#hatch-${initials(name)})` }),
      s('circle', { cx: '50', cy: '50', r: '47', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }),
      s('circle', { cx: '50', cy: '50', r: '42', fill: 'none', stroke: 'currentColor', 'stroke-width': '0.5' }),
      s('text', { x: '50', y: '58', 'text-anchor': 'middle', class: 'medallion-text' }, initials(name))));
  }
  return wrap;
}
