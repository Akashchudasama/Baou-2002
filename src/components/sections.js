// Section renderers. Each receives the section row and the full content
// bundle and returns a DOM fragment. All text comes from the data layer.

import { storageUrl } from '../config.js';
import { linkList, linksFor, setting } from '../lib/content.js';
import { fmtDate, h, paragraphs, s, safeUrl } from '../lib/dom.js';
import { documentUrl } from './docs.js';
import { renderHelpdesk } from './helpdesk.js';
import { renderLibrary } from './library.js';
import { renderFaculty, renderResearch } from './people.js';
import { renderProgrammes } from './programmes.js';
import { medallion } from './medallion.js';
import { renderPantheon } from './pantheon.js';
import { countdown, dailyCards, programmeQuiz } from './homeExtras.js';
import { nationalDay } from './tiranga.js';
import { renderAlumni, renderGallery } from './community.js';
import { localized } from '../lib/i18n.js';
import { t } from '../lib/i18n.js';

const ornament = () =>
  s('svg', { class: 'ornament', viewBox: '0 0 240 16', 'aria-hidden': 'true' },
    s('path', { d: 'M0 8 H96 M144 8 H240', stroke: 'currentColor', 'stroke-width': '0.8' }),
    s('path', { d: 'M104 8 q8 -8 16 0 q8 8 16 0', fill: 'none', stroke: 'currentColor', 'stroke-width': '1' }),
    s('circle', { cx: '120', cy: '8', r: '2.2', fill: 'currentColor' }));

function header(section) {
  return h('header', { class: 'folio-head' },
    section.kicker ? h('p', { class: 'kicker' }, section.kicker) : null,
    h('h1', { class: 'folio-title', tabindex: '-1', id: 'folio-title' }, localized(section, 'title')),
    ornament(),
    localized(section, 'intro') ? h('p', { class: 'folio-intro' }, localized(section, 'intro')) : null);
}

function empty(text) {
  return h('p', { class: 'empty' }, text);
}

// ---------- Home ------------------------------------------------------------
/** Vector open-book illustration: the hero visual on light/saver devices and
 *  the placeholder the 3D scene fades in over. No download, themed by CSS. */
function bookIllustration() {
  const lines = (x0, x1, y0, n) => Array.from({ length: n }, (_, i) =>
    s('line', { x1: String(x0), x2: String(x1 - (i % 3 === 2 ? 22 : 0)), y1: String(y0 + i * 9), y2: String(y0 + i * 9 + (x0 < 200 ? 1.5 : -1.5)), class: 'hb-text' }));
  return s('svg', { viewBox: '0 0 400 260', class: 'hero-book-svg', 'aria-hidden': 'true' },
    s('ellipse', { cx: '200', cy: '232', rx: '170', ry: '14', class: 'hb-shadow' }),
    s('path', { d: 'M28 60 Q110 40 200 64 L200 228 Q110 204 28 222 Z', class: 'hb-cover' }),
    s('path', { d: 'M372 60 Q290 40 200 64 L200 228 Q290 204 372 222 Z', class: 'hb-cover' }),
    s('path', { d: 'M38 56 Q115 36 200 60 L200 220 Q115 198 38 214 Z', class: 'hb-page' }),
    s('path', { d: 'M362 56 Q285 36 200 60 L200 220 Q285 198 362 214 Z', class: 'hb-page' }),
    s('path', { d: 'M200 60 Q250 20 330 44 Q290 120 300 196 Q250 178 200 212 Z', class: 'hb-leaf' }),
    lines(62, 182, 82, 13), lines(222, 290, 86, 9),
    s('line', { x1: '200', y1: '60', x2: '200', y2: '222', class: 'hb-spine' }),
    s('path', { d: 'M318 18 L282 96 Q296 80 302 64 Q312 40 318 18 Z', class: 'hb-quill' }));
}

function leaderMessages(c) {
  return (c.messages || []).map((m, i) => {
    const paras = paragraphs(m.body);
    const lead = paras.slice(0, 2);
    const rest = paras.slice(2);
    return h('section', { class: 'leader-msg card', 'aria-labelledby': `leader-${i}` },
      h('div', { class: 'leader-portrait' },
        medallion(m.author_name, storageUrl('media', m.photo_path), 'medallion sepia large'),
        h('span', { class: 'leader-seal', 'aria-hidden': 'true' }, '❦')),
      h('div', { class: 'leader-body' },
        h('p', { class: 'kicker' }, m.heading),
        h('h2', { class: 'leader-name', id: `leader-${i}` }, m.author_name),
        m.designation ? h('p', { class: 'byline' }, m.designation) : null,
        h('div', { class: 'prose drop-cap leader-text' }, lead,
          rest.length ? h('details', { class: 'more' }, h('summary', {}, t('Read the full message')), rest) : null),
        m.signature ? h('p', { class: 'signature' }, m.signature) : null));
  });
}

function home(section, c, ctx) {
  const links = linkList(setting(c, 'quick_links', []));
  const epigraph = setting(c, 'epigraph');
  return [
    nationalDay(),
    h('section', { class: 'hero' },
      h('div', { class: 'hero-text' },
        h('p', { class: 'kicker' }, setting(c, 'hero_kicker')),
        h('h1', { class: 'hero-title folio-title', tabindex: '-1', id: 'folio-title' }, setting(c, 'hero_title', section.title)),
        ornament(),
        h('p', { class: 'hero-sub' }, setting(c, 'hero_subtitle')),
        epigraph ? h('blockquote', { class: 'epigraph' }, h('p', {}, epigraph), h('cite', {}, setting(c, 'epigraph_source'))) : null,
        links.length ? h('nav', { class: 'quick-links', 'aria-label': 'Quick links' },
          links.map((l) => h('a', { class: 'btn btn-ink', href: l.url, target: '_blank', rel: 'noopener' }, l.label))) : null),
      h('div', { class: 'hero-visual', 'aria-hidden': 'true' },
        bookIllustration(),
        h('span', { class: 'daylight-chip', id: 'daylight-chip' }))),
    countdown(c),
    leaderMessages(c),
    dailyCards(c),
    h('div', { class: 'two-col' },
      h('div', { class: 'prose drop-cap' }, paragraphs(setting(c, 'overview_body', []))),
      h('aside', { class: 'card notice-board' },
        h('h2', { class: 'card-title' }, t('Notice Board')),
        c.announcements.length
          ? h('ul', { class: 'notices' }, c.announcements.slice(0, 6).map((a) => {
              const url = safeUrl(a.link_url);
              return h('li', {},
                url ? h('a', { href: url, target: '_blank', rel: 'noopener' }, a.title) : h('span', {}, a.title),
                a.body ? h('small', {}, a.body) : null);
            }))
          : empty(t('No notices at present.')))),
    programmeQuiz(c),
    c.pantheon.length ? renderPantheon(c.pantheon, ctx) : null,
    section.body?.length ? h('div', { class: 'prose' }, paragraphs(section.body)) : null,
  ];
}

// ---------- Results: top achievers + links ------------------------------------
function results(section, c) {
  const portal = safeUrl(setting(c, 'results_portal_url'));
  const links = linksFor(c, 'results');
  const byId = new Map(c.documents.map((d) => [d.id, d]));
  const notices = c.result_notices.map((r) => {
    const doc = r.document_id ? byId.get(r.document_id) : null;
    const url = safeUrl(r.link_url) || (doc ? documentUrl(doc) : null);
    return h('li', { class: 'result' },
      h('time', {}, r.published_on ? fmtDate(r.published_on) : ''),
      h('div', {},
        url ? h('a', { href: url, target: '_blank', rel: 'noopener' }, r.title) : h('span', {}, r.title),
        r.exam_session ? h('small', {}, r.exam_session) : null));
  });

  const years = [...new Set(c.toppers.map((t) => t.academic_year))].sort().reverse();
  const board = h('div', { class: 'grid grid-2', 'aria-live': 'polite' });
  const progName = (code) => c.programs.find((p) => p.code === code)?.title || code;
  const draw = (year) => {
    const rows = c.toppers.filter((t) => t.academic_year === year);
    const codes = [...new Set(rows.map((t) => t.program_code))];
    board.replaceChildren(...codes.map((code) => {
      const list = rows.filter((t) => t.program_code === code).sort((a, b) => a.rank - b.rank);
      return h('section', { class: 'card toppers' },
        h('h3', { class: 'card-title small' }, progName(code)),
        h('ol', { class: 'podium' }, list.map((t) =>
          h('li', { class: `rank-${t.rank}` },
            h('span', { class: 'rank-medal', 'aria-hidden': 'true' }, String(t.rank)),
            h('span', { class: 'rank-name' }, t.student_name),
            h('span', { class: 'rank-score' }, `${Number(t.percentage).toFixed(2)}%`)))));
    }));
  };
  let yearSel = null;
  if (years.length) {
    yearSel = h('select', { 'aria-label': 'Academic year' }, years.map((y) => h('option', { value: y }, y)));
    yearSel.addEventListener('change', () => draw(yearSel.value));
    draw(years[0]);
  }

  return [
    portal || links.length ? h('div', { class: 'lms-bar' },
      portal ? h('a', { class: 'btn btn-ink', href: portal, target: '_blank', rel: 'noopener' }, t('Open the results portal')) : null,
      links.map((l) => h('a', { class: 'chip', href: safeUrl(l.url), target: '_blank', rel: 'noopener' }, l.label))) : null,
    h('section', { class: 'shelf-section' },
      h('div', { class: 'row-between' }, h('h2', { class: 'section-title' }, t('Top achievers')), yearSel),
      years.length ? [h('p', { class: 'muted' }, t('The top five learners of each programme, published with their consent.')), board]
        : h('p', { class: 'empty' }, 'Top achievers will be announced here after the results.')),
    notices.length ? h('section', { class: 'shelf-section' }, h('h2', { class: 'section-title' }, t('Result notices')), h('ul', { class: 'results' }, notices)) : null,
  ];
}

// ---------- Generic text section -------------------------------------------------
function text(section) {
  return section.body?.length ? h('div', { class: 'prose drop-cap' }, paragraphs(section.body)) : h('p', { class: 'empty' }, 'This section is being prepared.');
}

const RENDERERS = {
  home, overview: home,
  programs: renderProgrammes,
  slm: renderLibrary,
  faculty: renderFaculty,
  research: renderResearch,
  results,
  helpdesk: (s, c) => renderHelpdesk(c),
  gallery: renderGallery,
  alumni: renderAlumni,
  text,
};

export function renderSection(section, content, ctx) {
  const body = (RENDERERS[section.renderer] || text)(section, content, ctx);
  const showHeader = section.renderer !== 'home' && section.renderer !== 'overview';
  return [showHeader ? header(section) : null, h('div', { class: 'folio-body' }, body)];
}
