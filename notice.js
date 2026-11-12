/* Sanctuaire Test: update notice engine. IDENTICAL in every environment. Spec: "Update notice system" doc.
   Load order: config.js, env.js, version.js, notice.js, hub-bar.js.
   It polls update-notice.json, shows a blocking pop-up while an update is uploaded, saves unsent work (drafts),
   and after the update refreshes the changed files and restores the work. It never blocks people when the file cannot be read. */
(function () {
  'use strict';
  var POLL = 20000, GATE = 1500, DAY = 864e5;
  var me = document.currentScript, ROOT = new URL('./', me ? me.src : location.href).href;
  var NOTICE = ROOT + 'update-notice.json';
  var loaded = window.SANCTUAIRE_VERSION || '';
  var staging = !!(window.SENV && SENV.staging);
  var skip = /[?&]skipnotice=1/.test(location.search) || sget(sessionStorage, 'snotice-skip') === '1';
  if (skip) { try { sessionStorage.setItem('snotice-skip', '1'); } catch (e) { /* ignore */ } }
  var T = {
    en: { upT: 'Update {v} in progress', upB: 'We are improving the app. Your work is saved. Please wait, you can keep this window open.', eta: 'Expected to finish around {t}', left: 'about {n} min left', late: 'Taking a little longer than expected. Thank you for your patience.',
      doneT: 'Update {v} is complete', doneB: 'Thank you for your patience. Here is what is new:', awayB: 'The app was updated while you were away. Here is what is new:', head: 'What’s new', btn: 'Continue', kept: 'Your unsent text was kept and will be back.', busy: 'Refreshing…',
      lostT: 'We kept your unsent text', lostB: 'It could not be put back automatically. Copy what you need:', copy: 'Copy', close: 'Close' },
    fr: { upT: 'Mise à jour {v} en cours', upB: 'Nous améliorons l’app. Ton travail est enregistré. Patiente un instant, tu peux laisser cette fenêtre ouverte.', eta: 'Fin prévue vers {t}', left: 'encore environ {n} min', late: 'Cela prend un peu plus de temps que prévu. Merci de ta patience.',
      doneT: 'La mise à jour {v} est terminée', doneB: 'Merci de ta patience. Voici les nouveautés :', awayB: 'L’app a été mise à jour pendant ton absence. Voici les nouveautés :', head: 'Nouveautés', btn: 'Continuer', kept: 'Ton texte non envoyé est gardé et sera restauré.', busy: 'Actualisation…',
      lostT: 'Ton texte non envoyé est gardé', lostB: 'Il n’a pas pu être remis automatiquement. Copie ce dont tu as besoin :', copy: 'Copier', close: 'Fermer' }
  };
  function sget(s, k) { try { return s.getItem(k); } catch (e) { return null; } }
  function sset(s, k, v) { try { s.setItem(k, v); } catch (e) { /* ignore */ } }
  function who() { try { var h = JSON.parse(localStorage.getItem('sanctuaire-hub-v1') || 'null'); if (h && h.role && h.at && Date.now() - h.at < 11 * 36e5) return h.role; } catch (e) { /* ignore */ } return null; }
  function seenKey() { return 'snotice-seen:' + who(); }                 // one "seen" per account on this device
  function lang() { try { var h = JSON.parse(localStorage.getItem('sanctuaire-hub-v1') || 'null'); if (h && h.lang) return h.lang; } catch (e) { /* ignore */ } return /^fr/i.test(navigator.language || '') ? 'fr' : 'en'; }
  function tx(k, o) { var s = T[lang()][k] || k; for (var p in (o || {})) s = s.replace('{' + p + '}', o[p]); return s; }

  // ---------- drafts ----------
  var hooks = {}, restored = {};
  function dkey(n) { return 'sdraft:' + n; }
  function saveDrafts() {
    var any = false;                                  // true when there is unsent text (hooks return { text, ui })
    for (var n in hooks) {
      try { var d = hooks[n].collect(); sset(localStorage, dkey(n), JSON.stringify({ at: Date.now(), v: loaded, y: window.scrollY, data: d })); if (strings(d && d.text, []).length) any = true; } catch (e) { /* ignore */ }
    }
    return any;
  }
  var tmr = null; function later() { clearTimeout(tmr); tmr = setTimeout(saveDrafts, 1000); }
  ['input', 'change', 'toggle'].forEach(function (e) { document.addEventListener(e, later, true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveDrafts(); });
  function strings(o, out) { if (typeof o === 'string') { if (o.trim()) out.push(o); } else if (o && typeof o === 'object') { for (var k in o) strings(o[k], out); } return out; }
  function pageReady(name) {                       // the page calls this once its interface exists
    var raw = sget(localStorage, dkey(name)); if (!raw || restored[name]) return; restored[name] = 1;
    var d; try { d = JSON.parse(raw); } catch (e) { return; }
    var marker = sget(localStorage, 'snotice-restore') === '1';
    if (!d || Date.now() - d.at > DAY || !(marker || (d.v && loaded && d.v !== loaded))) return;   // restore only around an update
    var ok = false;
    try { if (hooks[name] && hooks[name].restore) { hooks[name].restore(d.data); ok = true; if (d.y) setTimeout(function () { window.scrollTo(0, d.y); }, 50); } } catch (e) { ok = false; }
    try { localStorage.removeItem('snotice-restore'); localStorage.removeItem(dkey(name)); } catch (e) { /* ignore */ }
    if (!ok) { var s = strings(d.data && d.data.text, []); if (s.length) lostPanel(s.join('\n\n')); }
  }
  function lostPanel(text) {
    var p = document.createElement('div'); p.setAttribute('role', 'dialog');
    p.setAttribute('style', 'position:fixed;left:12px;right:12px;bottom:84px;z-index:100000;background:#FFFBF3;color:#1F2A24;border:1px solid #DDD2BF;border-radius:16px;padding:14px;box-shadow:0 8px 30px #0004;font:16px/1.4 Inter,system-ui,sans-serif');
    p.innerHTML = '<b></b><p style="margin:.3em 0"></p><textarea readonly style="width:100%;min-height:90px;border-radius:10px;border:1px solid #DDD2BF;padding:8px"></textarea><div style="margin-top:8px;display:flex;gap:8px"><button type="button" data-c style="min-height:44px;padding:0 14px"></button><button type="button" data-x style="min-height:44px;padding:0 14px"></button></div>';
    p.querySelector('b').textContent = tx('lostT'); p.querySelector('p').textContent = tx('lostB'); p.querySelector('textarea').value = text;
    p.querySelector('[data-c]').textContent = tx('copy'); p.querySelector('[data-x]').textContent = tx('close');
    p.querySelector('[data-c]').onclick = function () { var t = p.querySelector('textarea'); t.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } };
    p.querySelector('[data-x]').onclick = function () { p.remove(); };
    document.body.appendChild(p);
  }

  // ---------- pop-up ----------
  var box = null, els = {}, mode = null, cur = null, etaTimer = null, savedAny = false, lock = null, refreshing = false;
  var CSS = '#snotice{visibility:visible;position:fixed;inset:0;z-index:100001;display:grid;place-items:center;padding:20px;background:rgba(20,30,25,.86);color:#1F2A24;font:17px/1.5 Inter,system-ui,sans-serif}' +
    '@supports ((backdrop-filter:blur(8px)) or (-webkit-backdrop-filter:blur(8px))){#snotice{background:rgba(20,30,25,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}}' +
    '#snotice .c{background:#FFFBF3;border-radius:20px;max-width:440px;width:100%;max-height:88vh;overflow:auto;padding:24px;box-shadow:0 12px 40px #0006;animation:snin .2s ease-out;outline:0}' +
    '@keyframes snin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){#snotice .c{animation:none}}' +
    '#snotice h2{font:600 1.35rem/1.25 Fraunces,Georgia,serif;margin:0 0 .5em}#snotice h3{font:600 1rem Inter,system-ui,sans-serif;color:#8A5B1E;margin:1em 0 .2em}' +
    '#snotice p{margin:.4em 0}#snotice ul{margin:.2em 0 .4em;padding-left:1.2em}#snotice li{margin:.25em 0}#snotice .eta{color:#5E5A50;font-size:.95rem}' +
    '#snotice .tag{display:inline-block;background:#8A5B1E;color:#fff;border-radius:99px;padding:2px 10px;font-size:.8rem;margin-bottom:.5em}' +
    '#snotice button{margin-top:14px;width:100%;min-height:48px;border-radius:12px;border:1px solid #26362D;background:#26362D;color:#fff;font:600 1rem Inter,system-ui,sans-serif;cursor:pointer}#snotice button:disabled{opacity:.6}';
  function build() {
    if (box) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    box = document.createElement('div'); box.id = 'snotice'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'sn-t');
    box.innerHTML = '<div class="c" tabindex="-1">' + (staging ? '<span class="tag">STAGING</span>' : '') + '<h2 id="sn-t"></h2><p id="sn-b"></p><p class="eta" id="sn-e"></p><h3 id="sn-h"></h3><ul id="sn-l"></ul><p id="sn-k" class="eta"></p><button type="button" id="sn-x"></button></div>';
    els = { c: box.firstChild, t: box.querySelector('#sn-t'), b: box.querySelector('#sn-b'), e: box.querySelector('#sn-e'), h: box.querySelector('#sn-h'), l: box.querySelector('#sn-l'), k: box.querySelector('#sn-k'), x: box.querySelector('#sn-x') };
    els.x.onclick = onContinue;
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Tab') { ev.preventDefault(); (mode === 'updating' ? els.c : els.x).focus(); } });
    document.documentElement.appendChild(box);
    lock = [document.documentElement.style.overflow, ''];
    document.documentElement.style.overflow = 'hidden';                                                      // the page behind cannot scroll
    var stop = function (ev) { if (!els.c.contains(ev.target)) ev.preventDefault(); };
    box.addEventListener('wheel', stop, { passive: false }); box.addEventListener('touchmove', stop, { passive: false });
    bodyLock(); document.addEventListener('DOMContentLoaded', bodyLock);
  }
  function bodyLock() {
    if (!box || !document.body || document.body.hasAttribute('inert')) return;
    if (lock) lock[1] = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; document.body.setAttribute('inert', ''); document.body.setAttribute('aria-hidden', 'true');
  }
  function fmtEnd(n) {
    var d = new Date(n.estimatedEndAt); if (isNaN(d)) return null;
    var same = d.toDateString() === new Date().toDateString(), loc = lang() === 'fr' ? 'fr-FR' : 'en-GB';
    return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) + (same ? '' : ' (' + d.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) + ')');
  }
  function paintEta() {
    if (mode !== 'updating' || !cur) { els.e.textContent = ''; return; }
    var end = new Date(cur.estimatedEndAt), f = fmtEnd(cur); if (!f) { els.e.textContent = ''; return; }
    var left = Math.ceil((end - Date.now()) / 60000);
    els.e.textContent = left > 0 ? tx('eta', { t: f }) + ' · ' + tx('left', { n: left }) : tx('late');   // never a negative countdown
  }
  function paint() {                                  // updates the same elements in place: no re-render, no flicker
    if (!box || !cur) return;
    var v = cur.version || '', cl = (cur.changelog || {})[lang()] || (cur.changelog || {}).en || [];
    els.t.textContent = tx(mode === 'updating' ? 'upT' : 'doneT', { v: v });
    els.b.textContent = mode === 'updating' ? tx('upB') : tx(mode === 'away' ? 'awayB' : 'doneB');
    els.h.textContent = cl.length ? tx('head') : '';
    while (els.l.firstChild) els.l.removeChild(els.l.firstChild);
    cl.forEach(function (s) { var li = document.createElement('li'); li.textContent = s; els.l.appendChild(li); });
    els.k.textContent = savedAny && mode !== 'away' ? tx('kept') : '';
    els.x.style.display = mode === 'updating' ? 'none' : '';              // (the hidden attribute loses against page CSS)
    els.x.textContent = refreshing ? tx('busy') : tx('btn'); els.x.disabled = refreshing;
    paintEta();
  }
  function show(m) {
    build(); var first = mode === null; mode = m; paint();
    clearInterval(etaTimer); if (m === 'updating') etaTimer = setInterval(paintEta, 1000);
    if (first || !els.c.contains(document.activeElement)) (m === 'updating' ? els.c : els.x).focus();
  }
  function hide() { clearInterval(etaTimer); if (box) { box.remove(); box = null; if (lock) { document.documentElement.style.overflow = lock[0]; if (document.body) document.body.style.overflow = lock[1]; lock = null; } } mode = null; if (document.body) { document.body.removeAttribute('inert'); document.body.removeAttribute('aria-hidden'); } }
  window.addEventListener('sanctuaire-lang', function () { paint(); });

  // ---------- update logic ----------
  function stale(n) { return !!(loaded && n && n.version && loaded !== n.version); }
  function refreshFiles(n) {                          // refresh the changed files (and this page) so the reload loads fresh code
    var urls = (n.files || []).map(function (f) { return ROOT + f; });
    urls.push(ROOT + 'version.js'); urls.push(location.href.split('#')[0]);
    return Promise.all(urls.map(function (u) { return fetch(u, { cache: 'reload' }).catch(function () { return 0; }); }));
  }
  function reload() { if (SN._reload) SN._reload(); else location.reload(); }
  function readReturn() {                              // where the person was when the update started (kept for 3 hours, same site only)
    try { var r = JSON.parse(localStorage.getItem('snotice-return') || 'null'); localStorage.removeItem('snotice-return');
      if (r && r.u && Date.now() - r.at < 3 * 36e5 && r.u.indexOf(new URL(ROOT).pathname) === 0) return r.u; } catch (e) { /* ignore */ } return null;
  }
  function here() { return location.pathname + location.search + location.hash; }
  function go(u) { if (SN._go) SN._go(u); else location.assign(location.origin + u); }
  function autoRefresh(n) {                            // DONE and this page runs old code: refresh the files and reload, behind the pop-up
    if (refreshing) return;
    var tk = 'snotice-tries:' + n.id, tries = parseInt(sget(sessionStorage, tk) || '0', 10);
    if (tries >= 2) return;                            // loop guard: after two tries the person can still press Continue to refresh by hand
    refreshing = true; sset(sessionStorage, tk, String(tries + 1)); paint();
    sset(localStorage, 'snotice-restore', '1'); sset(sessionStorage, 'snotice-pending', JSON.stringify(n));   // the pop-up is rebuilt at once after the reload
    refreshFiles(n).then(reload, reload);
  }
  function onContinue() {
    var n = cur; if (!n || (mode !== 'done' && mode !== 'away')) return;           // never while the update is still running
    sset(localStorage, seenKey(), n.id);
    var back = readReturn(), away = back && back !== here();
    if (stale(n)) { els.x.disabled = true; els.x.textContent = tx('busy'); sset(localStorage, 'snotice-restore', '1'); refreshFiles(n).then(function () { away ? go(back) : reload(); }, reload); }
    else { hide(); if (away) { sset(localStorage, 'snotice-restore', '1'); go(back); } }
  }
  function apply(n, first) {
    if (!n || !n.id || ['idle', 'updating', 'done'].indexOf(n.state) < 0) return false;
    if (!who()) return false;                                                     // not signed in: no pop-up, the login stays usable
    cur = n;
    if (n.state === 'updating') {
      if (skip) return false;
      if (mode !== 'updating') { savedAny = saveDrafts(); sset(localStorage, 'snotice-restore', '1'); sset(localStorage, 'snotice-return', JSON.stringify({ u: here(), at: Date.now() })); }
      show('updating'); if (first) { try { window.stop(); } catch (e) { /* ignore */ } }
      return true;
    }
    if (n.state === 'done') {
      if (mode === 'updating') { show('done'); if (stale(n)) autoRefresh(n); return true; }   // same pop-up, changed in place
      if (skip || sget(localStorage, seenKey()) === n.id) return false;
      if (!mode) show(stale(n) ? 'done' : 'away');
      if (stale(n)) autoRefresh(n);
      return true;
    }
    if (mode === 'updating') hide();                                             // idle: released
    return false;
  }
  function fetchNotice() {
    return fetch(NOTICE + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('notice ' + r.status); return r.json(); });
  }
  function check(first) {
    return fetchNotice().then(function (n) { return apply(n, first); }).catch(function () { return false; });   // an unreadable file never blocks anyone
  }

  // ---------- start ----------
  var root = document.documentElement, gated = false, instant = false;
  var pend = sget(sessionStorage, 'snotice-pending');   // we just reloaded to finish an update: show the pop-up from the first paint
  if (pend) {
    try { sessionStorage.removeItem('snotice-pending'); } catch (e) { /* ignore */ }
    try { var pn = JSON.parse(pend); if (!skip && who() && pn && pn.id && sget(localStorage, seenKey()) !== pn.id) { cur = pn; show('done'); instant = true; } } catch (e) { /* ignore */ }
  }
  if (!skip && who() && !instant) { root.style.visibility = 'hidden'; gated = true; }
  function ungate() { if (gated) { gated = false; root.style.visibility = ''; } }
  setTimeout(ungate, GATE);
  check(true).then(ungate);
  var timer = setInterval(function () { if (!document.hidden) check(false); }, POLL);
  function now() { if (!document.hidden) check(false); }
  document.addEventListener('visibilitychange', now); window.addEventListener('focus', now); window.addEventListener('online', now);

  var SN = window.SNotice = { registerDraft: function (n, h) { hooks[n] = h; }, pageReady: pageReady, recheck: function () { return check(false); }, _check: check, _reload: null, _go: null };
  void timer;
})();
