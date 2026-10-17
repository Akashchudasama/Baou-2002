/* Runs before first paint (external file, so the strict CSP still holds):
   applies the visitor's saved colour theme, text size and language, and switches on data-saver mode
   early enough that no web fonts are requested on weak connections. */
(function () {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem('baou-eng-theme') || localStorage.getItem('baou-eng-theme-default');
    if (t && /^[a-z]{2,20}$/.test(t)) d.setAttribute('data-theme', t);
    var m = /[?&]fx=(full|lite|saver)\b/.exec(location.search);
    var fx = m ? m[1] : localStorage.getItem('baou-eng-fx');
    var c = navigator.connection || {};
    if (!fx && (c.saveData || c.effectiveType === '2g' || c.effectiveType === 'slow-2g')) fx = 'saver';
    if (fx === 'saver') d.setAttribute('data-fx', 'saver');
    var size = localStorage.getItem('baou-eng-textsize');
    if (size === '112.5' || size === '125') d.style.fontSize = size + '%';
    if (localStorage.getItem('baou-eng-lang') === 'gu') d.setAttribute('lang', 'gu');
  } catch (e) { /* storage blocked: defaults apply */ }
})();
