// Colour-theme picker: same design, different palette. Choice is remembered
// on the device; the department sets the default and the allowed list in
// Admin › Site Settings.

import { h, s } from '../lib/dom.js';
import { THEMES, applyTheme, storedTheme } from '../lib/themes.js';
import { t } from '../lib/i18n.js';

function swatch(t) {
  return s('svg', { viewBox: '0 0 36 20', class: 'swatch', 'aria-hidden': 'true' },
    s('circle', { cx: '10', cy: '10', r: '8.5', fill: t.paper, stroke: t.brass, 'stroke-width': '1.5' }),
    s('circle', { cx: '18', cy: '10', r: '8.5', fill: t.accent, stroke: t.paper, 'stroke-width': '1.5' }),
    s('circle', { cx: '26', cy: '10', r: '8.5', fill: t.brass, stroke: t.paper, 'stroke-width': '1.5' }));
}

export function initialTheme(content) {
  const enabled = allowedThemes(content);
  const def = content?.settings?.default_theme;
  const defId = enabled.some((t) => t.id === def) ? def : enabled[0].id;
  try {
    localStorage.setItem('baou-eng-theme-default', defId);
  } catch { /* ignore */ }
  const saved = storedTheme();
  return enabled.some((t) => t.id === saved) ? saved : defId;
}

function allowedThemes(content) {
  const list = content?.settings?.enabled_themes;
  const ids = Array.isArray(list) ? list.map((x) => String(x).trim()) : [];
  const enabled = THEMES.filter((t) => ids.includes(t.id));
  return enabled.length ? enabled : THEMES;
}

export function mountThemePicker(container, content) {
  const themes = allowedThemes(content);
  if (themes.length < 2) return null;
  const current = () => document.documentElement.dataset.theme;

  const panel = h('div', { class: 'theme-panel', id: 'theme-panel', role: 'dialog', 'aria-label': 'Colour themes', hidden: true });
  const fieldset = h('fieldset', {}, h('legend', { class: 'mini' }, t('Colour theme')));
  themes.forEach((t) => {
    const id = `theme-${t.id}`;
    const input = h('input', { type: 'radio', name: 'theme', id, value: t.id });
    input.checked = t.id === current();
    input.addEventListener('change', () => applyTheme(t.id, { persist: true }));
    fieldset.append(h('label', { for: id, class: 'theme-option' }, input, swatch(t),
      h('span', {}, h('strong', {}, t.name), h('small', {}, t.tagline))));
  });
  panel.append(fieldset, h('p', { class: 'theme-note' }, t('Your choice is remembered on this device.')));

  const button = h('button', { class: 'theme-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'theme-panel', title: 'Change colour theme' },
    swatch(themes.find((t) => t.id === current()) || themes[0]), h('span', {}, 'Theme'));

  const close = () => {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };
  button.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('input:checked')?.focus();
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) close();
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      button.focus();
    }
  });
  window.addEventListener('themechange', (e) => {
    button.firstChild.replaceWith(swatch(e.detail));
  });

  container.append(h('div', { class: 'theme-picker' }, button, panel));
  return { close };
}
