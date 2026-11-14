/* Sanctuaire Test: shared UI kit (v2.2.0). IDENTICAL in every environment.
   Load order on every page that needs it:  config.js, env.js, version.js, notice.js, ui-kit.js, hub-bar.js.
   1. SUI.confirm / SUI.dialog  : our own pop-ups instead of the browser's confirm().
   2. SUI.save(button)          : save buttons are grey with nothing to save, green only when there are changes.
   3. SUI.guard(source)         : leaving a page with unsaved changes (back button, bottom bar, links) asks first.
   4. SUI.recover(page)         : after the app was closed with unsaved changes, asks once what to do with the draft.
   Nothing here stores or sends anything on its own: the drafts themselves are kept by notice.js (key sdraft:<page>). */
(function () {
  'use strict';
  var ROOT = (function () { try { return new URL('.', document.currentScript.src).href; } catch (e) { return location.origin + '/'; } })();
  var HUB = 'sanctuaire-hub-v1';
  function lang() { try { var h = JSON.parse(localStorage.getItem(HUB) || 'null'); if (h && h.lang) return h.lang === 'fr' ? 'fr' : 'en'; } catch (e) { /* ignore */ } return 'en'; }
  var T = {
    en: {
      ok: 'OK', cancel: 'Cancel',
      leaveTitle: 'Leave this page?', leaveText: 'You have changes that are not saved.',
      saveLeave: 'Save and leave', stay: 'Stay on this page', leaveNo: 'Leave without saving',
      saveFail: 'The changes could not be saved, so you are still on the page.',
      recTitle: 'Unsaved changes', recText: 'The app was closed while you had changes that were not saved in {page}. They were kept as a draft.',
      recSave: 'Save the changes', recOpen: 'Open the page', recDrop: 'Continue without saving',
      recHint: 'Open the page: your draft comes back there, unsaved. Continue without saving: the draft is deleted.',
      signoutTitle: 'Sign out?', signoutText: 'You have unsaved changes in {page}. If you sign out now they are deleted.',
      signoutNo: 'Sign out without saving'
    },
    fr: {
      ok: 'OK', cancel: 'Annuler',
      leaveTitle: 'Quitter cette page ?', leaveText: 'Tu as des modifications qui ne sont pas enregistrées.',
      saveLeave: 'Enregistrer et quitter', stay: 'Rester sur la page', leaveNo: 'Quitter sans enregistrer',
      saveFail: 'Les modifications n’ont pas pu être enregistrées : tu restes sur la page.',
      recTitle: 'Modifications non enregistrées', recText: 'L’app a été fermée alors que tu avais des modifications non enregistrées dans {page}. Elles ont été gardées comme brouillon.',
      recSave: 'Enregistrer les modifications', recOpen: 'Ouvrir la page', recDrop: 'Continuer sans enregistrer',
      recHint: 'Ouvrir la page : ton brouillon y revient, non enregistré. Continuer sans enregistrer : le brouillon est supprimé.',
      signoutTitle: 'Se déconnecter ?', signoutText: 'Tu as des modifications non enregistrées dans {page}. Si tu te déconnectes maintenant, elles sont supprimées.',
      signoutNo: 'Se déconnecter sans enregistrer'
    }
  };
  function tx(k, o) { var s = (T[lang()] || T.en)[k] || T.en[k] || k; for (var p in (o || {})) s = s.replace('{' + p + '}', o[p]); return s; }

  // ---------- 1. pop-ups ----------
  var CSS =
    '.sui-ov{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(20,28,24,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}' +
    '.sui-box{width:100%;max-width:25rem;max-height:90vh;overflow:auto;background:#FFFBF3;color:#1F2A24;border:1px solid #DDD2BF;border-radius:18px;padding:20px 20px 16px;box-shadow:0 12px 40px rgba(0,0,0,.28);font:16px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.sui-box h2{margin:0 0 8px;font:600 20px/1.25 Fraunces,Georgia,serif}' +
    '.sui-box p{margin:6px 0;white-space:pre-line}.sui-box p.sui-hint{font-size:14px;color:#5E5A50}' +
    '.sui-btns{display:flex;flex-direction:column;gap:10px;margin-top:16px}' +
    '.sui-btns.row{flex-direction:row-reverse}.sui-btns.row .sui-b{flex:1}' +
    '.sui-b{min-height:48px;padding:10px 16px;border-radius:12px;border:1.5px solid #26362D;background:transparent;color:#26362D;font:600 16px/1.2 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer}' +
    '.sui-b.primary{background:#26362D;color:#fff}.sui-b.good{background:#2F7D5B;border-color:#2F7D5B;color:#fff}' +
    '.sui-b.danger{background:#A63D2F;border-color:#A63D2F;color:#fff}.sui-b.quiet{border-color:#DDD2BF;color:#5E5A50}' +
    '.sui-b:focus-visible{outline:3px solid #4F6F86;outline-offset:2px}' +
    'button.sui-save{transition:background .15s,color .15s}' +
    'button.sui-save.is-clean{background:#C9CDD2 !important;border-color:#C9CDD2 !important;color:#6B7280 !important;cursor:default}' +
    'button.sui-save.is-dirty{background:#2F7D5B !important;border-color:#2F7D5B !important;color:#fff !important}' +
    '@media (prefers-reduced-motion:reduce){button.sui-save{transition:none}}';
  function css() { if (document.getElementById('sui-css')) return; var s = document.createElement('style'); s.id = 'sui-css'; s.textContent = CSS; document.head.appendChild(s); }

  var openDialogs = 0;
  // opts: { title, text, hint, buttons: [{ id, label, kind }], cancelId, row }.  Resolves with the id of the pressed button.
  function dialog(o) {
    css();
    return new Promise(function (resolve) {
      var prev = document.activeElement, ov = document.createElement('div'), box = document.createElement('div'), btns = document.createElement('div');
      ov.className = 'sui-ov'; box.className = 'sui-box'; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-modal', 'true');
      var h = document.createElement('h2'); h.id = 'sui-t' + Date.now(); h.textContent = o.title || ''; box.setAttribute('aria-labelledby', h.id); box.appendChild(h);
      if (o.text) { var p = document.createElement('p'); p.textContent = o.text; box.appendChild(p); }
      if (o.hint) { var q = document.createElement('p'); q.className = 'sui-hint'; q.textContent = o.hint; box.appendChild(q); }
      btns.className = 'sui-btns' + (o.row ? ' row' : '');
      var list = [];
      o.buttons.forEach(function (b) {
        var e = document.createElement('button'); e.type = 'button'; e.className = 'sui-b ' + (b.kind || ''); e.textContent = b.label;
        e.onclick = function () { done(b.id); }; btns.appendChild(e); list.push(e);
      });
      box.appendChild(btns); ov.appendChild(box); document.body.appendChild(ov); openDialogs++;
      var lock = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
      var first = list[o.focus != null ? o.focus : list.length - 1] || list[0]; if (first) first.focus();
      function done(id) {
        ov.remove(); openDialogs--; document.removeEventListener('keydown', key, true); document.documentElement.style.overflow = lock;
        if (prev && prev.focus) { try { prev.focus(); } catch (e) { /* ignore */ } } resolve(id);
      }
      function key(ev) {
        if (ev.key === 'Escape' && o.cancelId != null) { ev.preventDefault(); done(o.cancelId); }
        else if (ev.key === 'Tab' && list.length) {
          var i = list.indexOf(document.activeElement); ev.preventDefault();
          list[(i + (ev.shiftKey ? -1 : 1) + list.length) % list.length].focus();
        }
      }
      document.addEventListener('keydown', key, true);
    });
  }
  // opts: { title, text, ok, cancel, danger }.  Resolves true or false.
  function confirmBox(o) {
    return dialog({
      title: o.title || '', text: o.text, row: true, cancelId: 'no', focus: 1,
      buttons: [{ id: 'yes', label: o.ok || tx('ok'), kind: o.danger ? 'danger' : 'primary' }, { id: 'no', label: o.cancel || tx('cancel'), kind: '' }]
    }).then(function (id) { return id === 'yes'; });
  }

  // ---------- 2. save buttons ----------
  // SUI.save(button) returns { set(dirty) }. Grey and not pressable with nothing to save, green when there are changes.
  function save(btn) {
    css(); btn.classList.add('sui-save');
    var c = { dirty: null, set: function (d) {
      d = !!d; if (c.dirty === d) return; c.dirty = d;
      btn.classList.toggle('is-dirty', d); btn.classList.toggle('is-clean', !d);
      if (d) { btn.removeAttribute('aria-disabled'); btn.removeAttribute('disabled'); } else { btn.setAttribute('aria-disabled', 'true'); }
    } };
    btn.addEventListener('click', function (ev) { if (btn.getAttribute('aria-disabled') === 'true') { ev.preventDefault(); ev.stopImmediatePropagation(); } }, true);
    c.set(false); return c;
  }

  // ---------- 3. leave guard ----------
  // SUI.guard({ isDirty(): boolean, saveAll(): Promise<boolean>, discard(): void }) - one per page.
  var G = null, installed = false, bypass = false;
  function guard(src) { G = src; if (!installed) install(); }
  function dirty() { try { return !!(G && G.isDirty()); } catch (e) { return false; } }
  // A page can also register a "blocker" for something that must not be cut off by leaving, such as a download.
  // fn() returns null when nothing is running, or { title, text, buttons: [{ id, label, kind }], stayId, onChoose(id) -> Promise<boolean> } (true = leave).
  var blockers = [];
  function block(fn) { blockers.push(fn); if (!installed) install(); }
  function activeBlock() { for (var i = 0; i < blockers.length; i++) { try { var b = blockers[i](); if (b) return b; } catch (e) { /* ignore */ } } return null; }
  function needAsk() { return dirty() || !!activeBlock(); }
  function askAll() {
    var b = activeBlock();
    var first = b
      ? dialog({ title: b.title, text: b.text, hint: b.hint, cancelId: b.stayId, focus: 0, buttons: b.buttons }).then(function (id) { return Promise.resolve(b.onChoose(id)); })
      : Promise.resolve(true);
    return first.then(function (ok) { if (!ok) return false; return dirty() ? askLeave() : true; });
  }
  function askLeave() {
    return dialog({ title: tx('leaveTitle'), text: tx('leaveText'), cancelId: 'stay', focus: 1,
      buttons: [{ id: 'save', label: tx('saveLeave'), kind: 'good' }, { id: 'stay', label: tx('stay'), kind: 'primary' }, { id: 'drop', label: tx('leaveNo'), kind: 'quiet' }] })
      .then(function (id) {
        if (id === 'stay') return false;
        if (id === 'drop') { try { G.discard(); } catch (e) { /* ignore */ } return true; }
        return Promise.resolve().then(function () { return G.saveAll(); }).then(function (ok) {
          if (ok) return true;
          return dialog({ title: tx('leaveTitle'), text: tx('saveFail'), buttons: [{ id: 'ok', label: tx('ok'), kind: 'primary' }], cancelId: 'ok' }).then(function () { return false; });
        }, function () { return false; });
      });
  }
  var asking = false;
  function install() {
    installed = true;
    try { history.pushState({ sui: 1 }, '', location.href); } catch (e) { /* ignore */ }   // one extra entry: the first "back" lands on this same page
    window.addEventListener('popstate', function () {
      if (bypass || asking) return;
      if (!needAsk()) { bypass = true; history.back(); return; }
      asking = true;
      askAll().then(function (leave) {
        asking = false;
        if (leave) { bypass = true; history.back(); }
        else { try { history.pushState({ sui: 1 }, '', location.href); } catch (e) { /* ignore */ } }
      });
    });
    document.addEventListener('click', function (ev) {
      if (bypass || asking || !needAsk() || ev.defaultPrevented) return;
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null; if (!a) return;
      var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
      if (u.origin === location.origin && u.pathname === location.pathname && u.search === location.search) return;   // same page
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      ev.preventDefault(); ev.stopPropagation(); asking = true;
      askAll().then(function (leave) { asking = false; if (leave) { bypass = true; location.href = u.href; } });
    }, true);
    window.addEventListener('beforeunload', function (ev) {   // best effort: browsers on phones usually ignore it, which is why drafts exist
      if (!bypass && needAsk()) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }
  // for a page's own "leave" code (for example a sign-out button): resolves true when it is fine to go on
  function canLeave() { if (!needAsk()) return Promise.resolve(true); return askAll().then(function (ok) { if (ok) bypass = true; return ok; }); }

  // ---------- 4. unsaved draft after the app was closed ----------
  var PAGES = { test1: { path: 'sanctuaire-test1/sheet.html', name: 'Test 1' }, test2: { path: 'sanctuaire-test2/index.html', name: 'Test 2' } };
  function draftOf(p) {
    try {
      var d = JSON.parse(localStorage.getItem('sdraft:' + p) || 'null');
      if (d && d.data && d.data.dirty === true && Date.now() - d.at < 7 * 864e5) return d;
    } catch (e) { /* ignore */ }
    return null;
  }
  function pendingPages() { return Object.keys(PAGES).filter(function (p) { return !!draftOf(p); }); }
  function clearDraft(p) { try { localStorage.removeItem('sdraft:' + p); } catch (e) { /* ignore */ } }
  function signedIn() { try { var h = JSON.parse(localStorage.getItem(HUB) || 'null'); return !!(h && h.at && Date.now() - h.at < 11 * 36e5); } catch (e) { return false; } }
  var recovering = false;
  // Call once the person is signed in and the page is ready. `here` = the page name when called from a test page.
  function recover(here) {
    if (recovering || !signedIn()) return;
    var list = pendingPages(); if (!list.length) return;
    recovering = true;
    var tries = 0;
    (function wait() {                                           // the update pop-up always comes first
      if (document.getElementById('snotice') && tries++ < 600) { setTimeout(wait, 500); return; }
      next(list.slice());
    })();
    function next(rest) {
      var p = rest.shift(); if (!p) { recovering = false; return; }
      if (!draftOf(p)) { next(rest); return; }
      dialog({ title: tx('recTitle'), text: tx('recText', { page: PAGES[p].name }), hint: tx('recHint'), cancelId: null, focus: 0,
        buttons: [{ id: 'save', label: tx('recSave'), kind: 'good' }, { id: 'open', label: tx('recOpen'), kind: 'primary' }, { id: 'drop', label: tx('recDrop'), kind: 'quiet' }] })
        .then(function (id) {
          if (id === 'drop') { clearDraft(p); next(rest); return; }
          try { localStorage.setItem('snotice-restore', '1'); if (id === 'save') sessionStorage.setItem('sui-autosave', p); } catch (e) { /* ignore */ }
          recovering = false;
          if (here === p) location.reload(); else location.assign(ROOT + PAGES[p].path);
        });
    }
  }
  // A test page calls this right after SNotice.pageReady(name): when the person chose "Save the changes", save them now.
  function autosave(p) {
    var want = null; try { want = sessionStorage.getItem('sui-autosave'); } catch (e) { /* ignore */ }
    if (want !== p) return Promise.resolve(false);
    try { sessionStorage.removeItem('sui-autosave'); } catch (e) { /* ignore */ }
    if (!G || !dirty()) return Promise.resolve(false);
    return Promise.resolve(G.saveAll()).catch(function () { return false; });
  }
  // The hub's sign-out: with unsaved drafts, ask first. Resolves true when signing out may go on (drafts are deleted then).
  function confirmSignOut() {
    var list = pendingPages(); if (!list.length) return Promise.resolve(true);
    var p = list[0];
    return dialog({ title: tx('signoutTitle'), text: tx('signoutText', { page: PAGES[p].name }), cancelId: 'stay', focus: 1,
      buttons: [{ id: 'open', label: tx('recSave'), kind: 'good' }, { id: 'stay', label: tx('stay'), kind: 'primary' }, { id: 'drop', label: tx('signoutNo'), kind: 'quiet' }] })
      .then(function (id) {
        if (id === 'drop') { list.forEach(clearDraft); return true; }
        if (id === 'open') { try { localStorage.setItem('snotice-restore', '1'); sessionStorage.setItem('sui-autosave', p); } catch (e) { /* ignore */ } location.assign(ROOT + PAGES[p].path); }
        return false;
      });
  }

  window.SUI = { dialog: dialog, confirm: confirmBox, save: save, guard: guard, block: block, canLeave: canLeave, recover: recover, autosave: autosave, confirmSignOut: confirmSignOut, pendingPages: pendingPages, clearDraft: clearDraft, tx: tx };
})();
