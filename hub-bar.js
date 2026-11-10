/* Sanctuaire Test: shared app bars (v2.1.0).
   Top bar: "Sanctuaire Test" left, EN/FR button right. Bottom bar: Home, Tests, Guides, Profile.
   Used by the hub (window.SBAR_HUB = 1 set before loading) and by every test page (loaded right after <body>).
   On a test page without a hub session the visitor goes back to the hub login. */
(function () {
  var HUB = 'sanctuaire-hub-v1';
  var T = { en: { home: 'Home', tests: 'Tests', guides: 'Guides', profile: 'Profile' }, fr: { home: 'Accueil', tests: 'Tests', guides: 'Guides', profile: 'Profil' } };
  var ICON = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    tests: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/>',
    guides: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'
  };
  var ORDER = ['home', 'tests', 'guides', 'profile'];
  var CSS =
    '.sbar-top{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:12px;' +
    'min-height:56px;padding:env(safe-area-inset-top,0px) 14px 0;background:#26362D;color:#fff}' +
    '.sbar-brand{font:600 20px/1.2 Fraunces,Georgia,serif;white-space:nowrap}' +
    '.sbar-lang{min-width:48px;min-height:44px;padding:0 12px;border:1px solid rgba(255,255,255,.55);border-radius:12px;background:none;color:#fff;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}' +
    '.sbar-tabs{position:fixed;left:0;right:0;bottom:0;z-index:100;display:grid;grid-template-columns:repeat(4,1fr);background:#FFFBF3;border-top:1px solid #DDD2BF;' +
    'padding-bottom:env(safe-area-inset-bottom,0px)}' +
    '.sbar-tabs a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:64px;color:#5E5A50;text-decoration:none;font:400 13px/1.2 Inter,system-ui,sans-serif;border-top:3px solid transparent}' +
    '.sbar-tabs a svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
    '.sbar-tabs a.on{color:#26362D;font-weight:600;border-top-color:#8A5B1E}';

  function mount(o) {
    var base = o.base || '', lang = o.lang || 'en', guideHref = o.guideId ? '#/guide/' + o.guideId : '#/guides';
    if (!document.getElementById('sbar-css')) { var st = document.createElement('style'); st.id = 'sbar-css'; st.textContent = CSS; document.head.appendChild(st); }
    var stg = window.SENV && SENV.staging;
    var top = document.createElement('header'); top.className = 'sbar-top';
    if (stg) top.style.background = '#8A5B1E';                    // staging is brass, live is green
    top.innerHTML = '<span class="sbar-brand">Sanctuaire Test' + (stg ? ' · STAGING' : '') + '</span><button type="button" class="sbar-lang" aria-label="Language / Langue"></button>';
    var tabs = document.createElement('nav'); tabs.className = 'sbar-tabs'; tabs.setAttribute('aria-label', 'Sanctuaire Test');
    tabs.innerHTML = ORDER.map(function (k) {
      var h = k === 'guides' ? guideHref : '#/' + k;
      return '<a href="' + base + h + '" data-k="' + k + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg><span></span></a>';
    }).join('');
    var btn = top.querySelector('button');
    function paint() {
      btn.textContent = lang === 'en' ? 'FR' : 'EN';
      [].forEach.call(tabs.querySelectorAll('a'), function (a) { a.lastChild.textContent = T[lang][a.getAttribute('data-k')]; });
    }
    btn.onclick = function () { lang = lang === 'en' ? 'fr' : 'en'; paint(); if (o.onLang) o.onLang(lang); };
    document.body.insertBefore(top, document.body.firstChild); document.body.appendChild(tabs); paint();
    return {
      setActive: function (k) { [].forEach.call(tabs.querySelectorAll('a'), function (a) { a.classList.toggle('on', a.getAttribute('data-k') === k); }); },
      setLang: function (l) { lang = l; paint(); },
      destroy: function () { top.remove(); tabs.remove(); }
    };
  }
  var K = { '1': 'sanctuaire-t1-session-v1', '2': 'sanctuaire-test2-session-v1' };
  var root = new URL('../', location.href).href;
  function hubLang() { try { return (JSON.parse(localStorage.getItem(HUB) || 'null') || {}).lang || 'en'; } catch (e) { return 'en'; } }
  // clear every session and go back to the hub login (used when a session is missing or ended)
  function toHub() {
    [HUB, K['1'], K['2']].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    document.documentElement.style.display = 'none';
    location.replace(root + '#/login');
  }
  window.SBar = { mount: mount, lang: hubLang, toHub: toHub };
  if (window.SBAR_HUB) return;

  // ---- test pages ----
  var s = null; try { s = JSON.parse(localStorage.getItem(HUB) || 'null'); } catch (e) { /* ignore */ }
  if (!s || !s.at || Date.now() - s.at > 11 * 3600 * 1000) { toHub(); return; }
  var p = location.pathname;
  var id = p.indexOf('sanctuaire-test1') > -1 ? '1' : p.indexOf('sanctuaire-test2') > -1 ? '2' : 'cap';
  var sk = K[id] || (id === 'cap' ? K['2'] : null);   // the phone check saves with the Test 2 sign-in
  if (sk) {                                     // the test's own server session must exist too
    var ts = null; try { ts = JSON.parse(localStorage.getItem(sk) || 'null'); } catch (e) { /* ignore */ }
    if (!ts || !ts.token || Date.now() - ts.at > 11 * 3600 * 1000) { toHub(); return; }
  }
  mount({ base: root, lang: s.lang, guideId: id, onLang: function (l) { s.lang = l; try { localStorage.setItem(HUB, JSON.stringify(s)); } catch (e) { /* ignore */ } window.dispatchEvent(new CustomEvent('sanctuaire-lang', { detail: l })); } }).setActive('tests');
})();
