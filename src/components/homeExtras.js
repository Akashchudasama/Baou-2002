// Home page extras: Word of the Day, Today in Literature, the exam countdown
// ribbon and the "Which programme suits me?" quiz. Everything comes from the
// data layer; daily items are scheduled and approved in the admin console.

import { setting } from '../lib/content.js';
import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

/** Today's date in India Standard Time as { iso: 'YYYY-MM-DD', md: 'MM-DD', dayNo }. */
export function istToday() {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return { iso, md: iso.slice(5), dayNo: Math.floor(Date.parse(`${iso}T00:00:00Z`) / 864e5) };
}

const put = (el, ...nodes) => el.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
const pickReserve = (list, dayNo, salt = 0) => (list.length ? list[(dayNo + salt) % list.length] : null);

export function todaysItems(c, day = istToday()) {
  const daily = c.daily || [];
  const words = daily.filter((x) => x.kind === 'word');
  const alm = daily.filter((x) => x.kind === 'almanac');
  const word = words.find((x) => x.show_on === day.iso) || pickReserve(words.filter((x) => x.is_reserve), day.dayNo);
  let almanac = alm.filter((x) => x.month_day === day.md || x.show_on === day.iso);
  let fromReserve = false;
  if (!almanac.length) {
    const r = pickReserve(alm.filter((x) => x.is_reserve), day.dayNo, 3);
    almanac = r ? [r] : [];
    fromReserve = true;
  }
  return { word, almanac: almanac.slice(0, 2), fromReserve };
}

export function dailyCards(c) {
  const { word, almanac, fromReserve } = todaysItems(c);
  if (!word && !almanac.length) return null;
  return h('div', { class: 'daily-row' },
    word ? h('article', { class: 'card daily word-card' },
      h('p', { class: 'kicker' }, t('Word of the Day')),
      h('h3', { class: 'daily-word' }, word.title),
      word.meaning ? h('p', {}, word.meaning) : null,
      h('dl', { class: 'daily-langs' },
        word.gujarati ? [h('dt', {}, t('Gujarati')), h('dd', { lang: 'gu' }, word.gujarati)] : null,
        word.hindi ? [h('dt', {}, t('Hindi')), h('dd', { lang: 'hi' }, word.hindi)] : null),
      word.example ? h('p', { class: 'daily-example' }, h('span', { class: 'mini' }, `${t('Example')} · `), word.example) : null) : null,
    almanac.length ? h('article', { class: 'card daily almanac-card' },
      h('p', { class: 'kicker' }, fromReserve ? t('From the reading room') : t('Today in Literature')),
      almanac.map((a) => h('div', { class: 'almanac-item' },
        h('h3', { class: 'card-title small' }, a.title),
        a.meaning ? h('p', {}, a.meaning) : null,
        a.source ? h('small', { class: 'meta' }, a.source) : null))) : null);
}

export function countdown(c) {
  if (setting(c, 'countdown_enabled', false) !== true) return null;
  const date = String(setting(c, 'countdown_date', ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${istToday().iso}T00:00:00Z`)) / 864e5);
  if (days < 0) return null;
  const when = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return h('div', { class: 'countdown', role: 'status' },
    h('span', { class: 'countdown-text' }, setting(c, 'countdown_title', 'Examinations begin in')),
    h('strong', { class: 'countdown-num' }, days === 0 ? '0' : String(days)),
    h('span', { class: 'countdown-unit' }, days === 1 ? t('day') : t('days')),
    h('span', { class: 'countdown-date' }, when));
}

export function programmeQuiz(c) {
  const quiz = setting(c, 'programme_quiz', null);
  if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) return null;
  const groups = new Map();
  c.programs.forEach((p) => {
    const g = p.level_group || 'ma';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  });
  const NAMES = { ba: 'B.A.', ma: 'M.A.', diploma: 'Diploma', certificate: 'Certificate', phd: 'PhD' };
  const box = h('div', { class: 'quiz-body', 'aria-live': 'polite' });
  const answers = [];

  const intro = () => {
    answers.length = 0;
    put(box, 
      quiz.intro ? h('p', {}, quiz.intro) : null,
      h('button', { class: 'btn btn-ink', type: 'button', onclick: () => ask(0) }, t('Start the quiz')));
  };
  const ask = (i) => {
    const q = quiz.questions[i];
    put(box, 
      h('p', { class: 'kicker' }, `${t('Question')} ${i + 1} ${t('of')} ${quiz.questions.length}`),
      h('h4', { class: 'quiz-q' }, q.q),
      h('div', { class: 'quiz-options' }, (q.options || []).map((o, j) =>
        h('button', { class: 'quiz-option', type: 'button', onclick: () => { answers[i] = j; i + 1 < quiz.questions.length ? ask(i + 1) : result(); } }, o.label))),
      i > 0 ? h('button', { class: 'linkish', type: 'button', onclick: () => ask(i - 1) }, `← ${t('Back')}`) : null);
    box.querySelector('.quiz-option')?.focus();
  };
  const result = () => {
    const score = {};
    answers.forEach((j, i) => Object.entries(quiz.questions[i].options[j]?.scores || {}).forEach(([g, n]) => { score[g] = (score[g] || 0) + Number(n || 0); }));
    const ranked = Object.entries(score).filter(([g]) => groups.has(g)).sort((a, b) => b[1] - a[1]);
    const top = ranked.filter(([, n]) => ranked.length && n === ranked[0][1]).map(([g]) => g).slice(0, 2);
    put(box, 
      h('p', { class: 'kicker' }, t('You might begin with')),
      top.length ? top.map((g) => h('div', { class: 'quiz-result' },
        h('strong', {}, NAMES[g] || g),
        h('ul', {}, groups.get(g).map((p) => h('li', {}, p.title))),
        h('a', { class: 'btn btn-ink', href: `#/programmes/${g}` }, t('Open on the shelf'))))
        : h('p', {}, 'Please look through the programme shelf to find your fit.'),
      h('p', { class: 'meta' }, 'A suggestion only — always check the eligibility on the programme’s page.'),
      h('button', { class: 'linkish', type: 'button', onclick: intro }, t('Start again')));
  };
  intro();
  return h('section', { class: 'card quiz' }, h('h3', { class: 'card-title' }, t('Which programme suits me?')), box);
}
