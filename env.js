/* Sanctuaire Test: environment layer. IDENTICAL in every environment (live, staging).
   Load order on every page:  config.js  ->  env.js  ->  hub-bar.js  (config.js is the only file that differs).
   It (1) checks that config.js belongs to this site, (2) keeps staging and live browser storage apart,
   (3) refuses any request to a database that is not the configured one, (4) exposes window.SENV. */
(function () {
  var C = window.SANCTUAIRE || {};
  var first = (location.pathname.split('/')[1] || '');
  var pathIsStaging = /-staging$/.test(first);                   // the staging repo's name must end with -staging
  var envOk = C.env === 'live' || C.env === 'staging';
  var bad = !envOk || !C.supabaseUrl || !C.supabaseKey || ((C.env === 'staging') !== pathIsStaging);
  var host = ''; try { host = new URL(C.supabaseUrl).origin; } catch (e) { bad = true; }
  var staging = C.env === 'staging';
  window.SENV = { env: C.env, staging: staging, ok: !bad, sb: bad ? '' : C.supabaseUrl, key: bad ? '' : C.supabaseKey };

  // (2) separate browser storage: on this web address both sites share one storage, so staging gets its own names
  if (pathIsStaging) {                                           // decided by the web address, even when config.js is wrong
    var P = 'stg:', S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem;
    S.getItem = function (k) { return g.call(this, P + k); };
    S.setItem = function (k, v) { return s.call(this, P + k, v); };
    S.removeItem = function (k) { return r.call(this, P + k); };
    if (window.IDBFactory) {
      var o = IDBFactory.prototype.open, d = IDBFactory.prototype.deleteDatabase;
      IDBFactory.prototype.open = function (n, v) { return arguments.length > 1 ? o.call(this, P + n, v) : o.call(this, P + n); };
      IDBFactory.prototype.deleteDatabase = function (n) { return d.call(this, P + n); };
    }
  }

  // (3) never talk to a database other than the configured one (catches leftovers and wrong config.js)
  var f = window.fetch;
  window.fetch = function (u) {
    var url = typeof u === 'string' ? u : (u && u.url) || String(u || '');
    if (/\.supabase\.co/i.test(url) && (bad || url.indexOf(host + '/') !== 0)) return Promise.reject(new Error('Blocked: this database does not belong to this environment'));
    return f.apply(this, arguments);
  };

  // (1) wrong config: stop with a clear message instead of touching any data
  if (bad) {
    var box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:#A63D2F;color:#fff;font:18px/1.5 system-ui,sans-serif;padding:28px;overflow:auto');
    box.innerHTML = '<h2 style="margin:0 0 10px">Wrong environment · Mauvais environnement</h2>' +
      '<p>This page and its <b>config.js</b> do not match (staging or live). Nothing was loaded and no data was touched. Upload the correct config.js for this site.</p>' +
      '<p>Cette page et son fichier <b>config.js</b> ne correspondent pas (staging ou live). Rien n’a été chargé. Envoie le bon config.js pour ce site.</p>';
    (document.body || document.documentElement).appendChild(box);
  }
})();
