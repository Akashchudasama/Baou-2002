// SLM & Study Material folio: LMS entry, useful links, then two clearly
// separated shelves — SLM & study material, and assignments — filtered by
// programme, semester and search, revealed in batches.

import { linksFor, setting } from '../lib/content.js';
import { h, safeUrl } from '../lib/dom.js';
import { batchedList, docLink } from './docs.js';
import { t } from '../lib/i18n.js';

const STUDY = ['slm', 'study-material', 'syllabus', 'other'];

export function renderLibrary(section, c) {
  const docs = c.documents;
  const lms = safeUrl(setting(c, 'lms_url'), { allow: ['https:'] });
  const links = linksFor(c, 'slm');

  const programmes = c.programs.filter((p) => docs.some((d) => d.program_code === p.code));
  const progSel = h('select', { 'aria-label': 'Programme' },
    h('option', { value: '' }, t('All programmes')), programmes.map((p) => h('option', { value: p.code }, `${p.code} — ${p.title}`)));
  const semSel = h('select', { 'aria-label': 'Semester' }, h('option', { value: '' }, t('All semesters')));
  const search = h('input', { type: 'search', placeholder: t('Search by title or course code'), 'aria-label': 'Search study material' });

  const fillSemesters = () => {
    const sems = [...new Set(docs.filter((d) => !progSel.value || d.program_code === progSel.value).map((d) => d.semester).filter(Boolean))].sort((a, b) => a - b);
    const keep = semSel.value;
    semSel.replaceChildren(h('option', { value: '' }, t('All semesters')), ...sems.map((s) => h('option', { value: String(s) }, `${t('Semester')} ${s}`)));
    if (sems.map(String).includes(keep)) semSel.value = keep;
  };

  const studyBox = h('div');
  const assignBox = h('div');
  const apply = () => {
    const q = search.value.trim().toLowerCase();
    const ok = (d) => (!progSel.value || d.program_code === progSel.value || !d.program_code)
      && (!semSel.value || String(d.semester) === semSel.value)
      && (!q || `${d.title} ${d.course_code || ''} ${d.description || ''}`.toLowerCase().includes(q));
    studyBox.replaceChildren(batchedList(docs.filter((d) => STUDY.includes(d.category) && ok(d)), docLink, { emptyText: 'No study material matches these filters yet.' }));
    assignBox.replaceChildren(batchedList(docs.filter((d) => d.category === 'assignment' && ok(d)), docLink, { emptyText: 'No assignments match these filters yet.' }));
  };
  progSel.addEventListener('change', () => { fillSemesters(); apply(); });
  semSel.addEventListener('change', apply);
  let debounce;
  search.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(apply, 180); });
  fillSemesters();
  apply();

  return [
    lms || links.length
      ? h('div', { class: 'lms-bar' },
          lms ? h('a', { class: 'btn btn-ink lms-btn', href: lms, target: '_blank', rel: 'noopener' }, t('Go to the LMS')) : null,
          links.map((l) => h('a', { class: 'chip', href: safeUrl(l.url), target: '_blank', rel: 'noopener' }, l.label)))
      : null,
    h('div', { class: 'filters', role: 'search' }, progSel, semSel, search),
    h('section', { class: 'shelf-section', 'aria-labelledby': 'slm-h' },
      h('h2', { class: 'section-title', id: 'slm-h' }, t('SLM & study material')), studyBox),
    h('section', { class: 'shelf-section', 'aria-labelledby': 'asg-h' },
      h('h2', { class: 'section-title', id: 'asg-h' }, t('Assignments')), assignBox),
  ];
}
