// Programmes folio: a shelf of books (B.A., M.A., Diploma, Certificate, PhD).
// Pick a book → (pick a programme, if the shelf holds several) → the book
// opens and its pages turn one idea at a time:
//   At a glance → What you'll study → Our learners → Where it can lead.
// Useful links stay pinned at the top of the open book on every page.

import { linksFor, setting } from '../lib/content.js';
import { clear, h, paragraphs, safeUrl } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

const GROUPS = [
  { id: 'ba', label: 'B.A.', name: 'Bachelor of Arts' },
  { id: 'ma', label: 'M.A.', name: 'Master of Arts' },
  { id: 'diploma', label: 'Diploma', name: 'Diploma programmes' },
  { id: 'certificate', label: 'Certificate', name: 'Certificate programmes' },
  { id: 'phd', label: 'PhD', name: 'Doctoral research' },
];
const PAGES = [
  { id: 'glance', title: t('At a glance') },
  { id: 'study', title: t('What you’ll study') },
  { id: 'learners', title: t('Our learners') },
  { id: 'scope', title: t('Where it can lead') },
];

const motion = () => document.documentElement.dataset.fx !== 'saver' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

function quickLinks(c, prog) {
  const links = linksFor(c, 'programme', prog.code);
  const items = [
    ...links.map((l) => ({ label: l.label, url: safeUrl(l.url), external: true })),
    { label: t('SLM & study material'), url: '#/slm' },
    { label: t('Results'), url: '#/results' },
  ].filter((l) => l.url);
  return h('nav', { class: 'quick-strip', 'aria-label': `Useful links for ${prog.title}` },
    h('span', { class: 'mini' }, t('Useful links')),
    items.map((l) => h('a', { class: 'chip', href: l.url, ...(l.external ? { target: '_blank', rel: 'noopener' } : {}) }, l.label)));
}

// ---------- the four pages -------------------------------------------------
function pageGlance(prog) {
  return [
    prog.status ? h('p', { class: 'status-pill' }, prog.status) : null,
    h('dl', { class: 'facts big' },
      [[t('Level'), prog.level], [t('Duration'), prog.duration], [t('Medium'), prog.medium], [t('Eligibility'), prog.eligibility], [t('Fees'), prog.fees_note]]
        .filter(([, v]) => v).map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
    h('div', { class: 'prose' }, paragraphs(prog.description)),
    prog.highlights?.length ? h('ul', { class: 'ticks' }, prog.highlights.map((x) => h('li', {}, x))) : null,
  ];
}

function pageStudy(c, prog) {
  const courses = c.program_courses.filter((x) => x.program_code === prog.code);
  const sems = [...new Set(courses.map((x) => x.semester))].sort((a, b) => a - b);
  if (!sems.length) return h('p', { class: 'empty' }, 'The course list for this programme will be published soon.');
  const list = h('div', { class: 'course-list', 'aria-live': 'polite' });
  const show = (sem) => {
    ribbons.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.sem) === sem)));
    list.replaceChildren(h('ol', { class: 'courses' }, courses.filter((x) => x.semester === sem).map((x) =>
      h('li', {},
        x.course_code ? h('span', { class: 'badge' }, x.course_code) : null,
        h('span', { class: 'course-title' }, x.title),
        [x.course_type, x.credits ? `${x.credits} credits` : null].filter(Boolean).length
          ? h('small', {}, [x.course_type, x.credits ? `${x.credits} credits` : null].filter(Boolean).join(' · ')) : null))));
  };
  const ribbons = h('div', { class: 'sem-ribbons', role: 'toolbar', 'aria-label': 'Semesters' },
    sems.map((s) => h('button', { type: 'button', class: 'sem-ribbon', dataset: { sem: String(s) }, onclick: () => show(s) }, `${t('Semester')} ${s}`)));
  show(sems[0]);
  return [ribbons, list];
}

function pageLearners(c, prog) {
  const rows = c.enrolments.filter((x) => x.program_code === prog.code);
  const years = [...new Set(rows.map((x) => x.academic_year))].sort().reverse();
  if (!years.length) return h('p', { class: 'empty' }, 'Enrolment figures for this programme will be published soon.');
  const out = h('div', { 'aria-live': 'polite' });
  const draw = (year) => {
    const r = rows.filter((x) => x.academic_year === year).sort((a, b) => a.semester - b.semester);
    const sum = (k) => r.reduce((n, x) => n + (Number(x[k]) || 0), 0);
    const total = sum('male') + sum('female') + sum('transgender');
    const max = Math.max(...r.map((x) => x.male + x.female + x.transgender), 1);
    const fmt = (n) => Number(n).toLocaleString('en-IN');
    out.replaceChildren(
      h('div', { class: 'tiles' },
        [[t('All learners'), total], [t('Female'), sum('female')], [t('Male'), sum('male')], [t('Transgender'), sum('transgender')]]
          .filter(([k, v]) => k !== t('Transgender') || v > 0)
          .map(([k, v]) => h('div', { class: 'tile' }, h('strong', {}, fmt(v)), h('span', {}, k)))),
      h('ul', { class: 'stack-bars', 'aria-label': `Learners by semester, ${year}` }, r.map((x) => {
        const tot = x.male + x.female + x.transgender;
        return h('li', {},
          h('span', { class: 'bar-label' }, `Sem ${x.semester}`),
          h('span', { class: 'stack-track', style: { '--w': `${(tot / max) * 100}%` } },
            h('span', { class: 'seg-f', style: { flexGrow: String(x.female) }, title: `Female ${fmt(x.female)}` }),
            h('span', { class: 'seg-m', style: { flexGrow: String(x.male) }, title: `Male ${fmt(x.male)}` }),
            x.transgender ? h('span', { class: 'seg-t', style: { flexGrow: String(x.transgender) }, title: `Transgender ${fmt(x.transgender)}` }) : null),
          h('span', { class: 'bar-value' }, fmt(tot)));
      })),
      h('p', { class: 'legend' }, h('span', { class: 'key seg-f' }), `${t('Female')} `, h('span', { class: 'key seg-m' }), t('Male'),
        r.some((x) => x.transgender) ? [h('span', { class: 'key seg-t' }), t('Transgender')] : null));
  };
  const select = h('select', { 'aria-label': 'Academic year', class: 'year-select' }, years.map((y) => h('option', { value: y }, y)));
  select.addEventListener('change', () => draw(select.value));
  draw(years[0]);
  return [h('div', { class: 'row-between' }, h('span', { class: 'meta' }, setting(c, 'enrolment_note')), select), out];
}

function pageScope(prog) {
  return prog.future_scope?.length
    ? [h('ul', { class: 'scope-list' }, prog.future_scope.map((x) => h('li', {}, x))),
       h('p', { class: 'meta' }, t('General pathways. Eligibility for each depends on the norms of the respective body or employer.'))]
    : h('p', { class: 'empty' }, 'Career pathways for this programme will be published soon.');
}

// ---------- views ---------------------------------------------------------
export function renderProgrammes(section, c) {
  const root = h('div', { class: 'prog-root' });
  const byGroup = GROUPS.map((g) => ({ ...g, programs: c.programs.filter((p) => (p.level_group || 'ma') === g.id) })).filter((g) => g.programs.length);

  function shelf(focusId) {
    clear(root).append(
      h('div', { class: 'shelf', role: 'list' },
        byGroup.map((g, i) => {
          const b = h('button', { class: `pbook pbook-${i % 5}`, type: 'button', role: 'listitem', dataset: { group: g.id },
            'aria-label': `${g.name}: ${g.programs.length} programme${g.programs.length > 1 ? 's' : ''}` },
            h('span', { class: 'pbook-band' }),
            h('span', { class: 'pbook-label' }, g.label),
            h('span', { class: 'pbook-count' }, `${g.programs.length}`),
            h('span', { class: 'pbook-band bottom' }));
          b.addEventListener('click', () => pull(b, () => (g.programs.length === 1 ? book(g, g.programs[0]) : picker(g))));
          return b;
        })),
      h('div', { class: 'shelf-board', 'aria-hidden': 'true' }),
      h('p', { class: 'shelf-hint' }, t('Choose a book to open it.')));
    if (focusId) root.querySelector(`[data-group="${focusId}"]`)?.focus();
  }

  function pull(btn, then) {
    if (!motion()) return then();
    btn.classList.add('pulling');
    setTimeout(then, 380);
  }

  function picker(g) {
    clear(root).append(
      h('button', { class: 'linkish back', type: 'button', onclick: () => shelf(g.id) }, t('← Back to the shelf')),
      h('h2', { class: 'section-title' }, g.name),
      h('div', { class: 'mini-books' }, g.programs.map((p) =>
        h('button', { class: 'mini-book', type: 'button', onclick: () => book(g, p) },
          h('span', { class: 'badge' }, p.code), h('strong', {}, p.title), p.status ? h('small', {}, p.status) : null))));
    root.querySelector('.mini-book')?.focus();
  }

  function book(g, prog) {
    let idx = 0;
    const leaf = h('article', { class: 'book-leaf', tabindex: '-1', 'aria-live': 'polite' });
    const dots = h('div', { class: 'page-dots', role: 'tablist', 'aria-label': 'Pages' });
    const prev = h('button', { class: 'btn', type: 'button' }, t('← Previous'));
    const next = h('button', { class: 'btn btn-ink', type: 'button' }, t('Next →'));

    const draw = (dir) => {
      const p = PAGES[idx];
      const body = { glance: () => pageGlance(prog), study: () => pageStudy(c, prog), learners: () => pageLearners(c, prog), scope: () => pageScope(prog) }[p.id]();
      leaf.className = 'book-leaf';
      if (motion() && dir) {
        void leaf.offsetWidth;
        leaf.classList.add(dir > 0 ? 'flip-next' : 'flip-prev');
      }
      clear(leaf).append(h('p', { class: 'kicker' }, `${t('Page')} ${idx + 1} / ${PAGES.length}`), h('h3', { class: 'leaf-title' }, p.title), h('div', { class: 'leaf-body' }, body));
      dots.replaceChildren(...PAGES.map((pp, i) => h('button', {
        type: 'button', role: 'tab', class: 'dot', 'aria-selected': String(i === idx), 'aria-label': pp.title, title: pp.title,
        onclick: () => go(i),
      })));
      prev.disabled = idx === 0;
      next.textContent = idx === PAGES.length - 1 ? t('Close the book') : t('Next →');
    };
    const go = (i) => {
      const dir = i - idx;
      idx = Math.max(0, Math.min(PAGES.length - 1, i));
      draw(dir);
      leaf.focus({ preventScroll: true });
    };
    prev.addEventListener('click', () => go(idx - 1));
    next.addEventListener('click', () => (idx === PAGES.length - 1 ? shelf(g.id) : go(idx + 1)));

    const wrap = h('div', { class: `open-book${motion() ? ' opening' : ''}` },
      h('div', { class: 'book-top' },
        h('button', { class: 'linkish back', type: 'button', onclick: () => shelf(g.id) }, t('← Back to the shelf')),
        h('div', { class: 'book-heading' }, h('span', { class: 'badge' }, prog.code), h('h2', { class: 'book-title' }, prog.title))),
      quickLinks(c, prog),
      h('div', { class: 'book-body' }, leaf),
      h('div', { class: 'book-nav' }, prev, dots, next));
    wrap.addEventListener('keydown', (e) => {
      if (e.target.closest('select, input, textarea')) return;
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
    });
    clear(root).append(wrap);
    draw(0);
    leaf.focus({ preventScroll: true });
    // on small screens, bring the opened book into view
    if (wrap.getBoundingClientRect().top > innerHeight * 0.45) wrap.scrollIntoView({ block: 'start', behavior: motion() ? 'smooth' : 'auto' });
  }

  if (!byGroup.length) root.append(h('p', { class: 'empty' }, 'Programme details will be published soon.'));
  else {
    shelf();
    // deep link, e.g. #/programmes/ma from the Home quiz, opens that book
    const want = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/')[1];
    const g = byGroup.find((x) => x.id === want);
    if (g) setTimeout(() => (g.programs.length === 1 ? book(g, g.programs[0]) : picker(g)), 0);
  }
  return root;
}
