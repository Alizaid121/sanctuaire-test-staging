// Sanctuaire Test: PDF reports, built in the hub (admin only). ES module, loaded on demand.
// Test 1 and Test 2 use their own report builders; the phone check has a builder here.
const V1 = 'sanctuaire-test1/vendor/';

function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('load ' + src)); document.head.appendChild(s); }); }
async function b64(url) {
  const r = await fetch(url); if (!r.ok) throw new Error('font');
  const u = new Uint8Array(await r.arrayBuffer()); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
async function pdfTools() {
  if (!window.jspdf) await loadScript(V1 + 'jspdf.umd.min.js');
  const [regular, bold] = await Promise.all([b64(V1 + 'fonts/DejaVuSans.ttf'), b64(V1 + 'fonts/DejaVuSans-Bold.ttf')]);
  return { JsPDF: window.jspdf.jsPDF, regular, bold };
}

// ---- phone check report (one person) ----
const CT = {
  en: { title: 'Sanctuaire Test · Phone check', who: { admin: 'English speaker', partner: 'French speaker' }, version: 'Test version', made: 'Created', summary: 'Summary',
    checks: { basic: 'Basic check', speed: 'Speed test', mem: 'Memory test' }, done: 'done', notDone: 'not done', none: 'No result has been saved for this person yet.',
    facts: 'Key values', mem: 'Device memory reported by the browser', bw: 'Memory bandwidth (GB/s)', ok: 'Graphics memory reserved (MB)', failed: 'Memory test failed', yes: 'yes', no: 'no', n: 'n/a',
    note: 'Measurement labels come from the check page and are in English.', locale: 'en-GB' },
  fr: { title: 'Sanctuaire Test · Vérification du téléphone', who: { admin: 'Anglophone', partner: 'Francophone' }, version: 'Version du test', made: 'Créé le', summary: 'Résumé',
    checks: { basic: 'Vérification de base', speed: 'Test de vitesse', mem: 'Test de mémoire' }, done: 'fait', notDone: 'non fait', none: 'Aucun résultat n’a encore été enregistré pour cette personne.',
    facts: 'Valeurs clés', mem: 'Mémoire de l’appareil indiquée par le navigateur', bw: 'Bande passante mémoire (Go/s)', ok: 'Mémoire graphique réservée (Mo)', failed: 'Échec du test de mémoire', yes: 'oui', no: 'non', n: 'n/d',
    note: 'Les libellés des mesures viennent de la page de vérification et sont en anglais.', locale: 'fr-FR' }
};
const MARK = { ok: '✓', warn: '!', bad: '✗', info: '' };
const COL = { ok: [47, 107, 82], warn: [138, 91, 30], bad: [166, 61, 47], info: [31, 42, 36] };

function capPdf(tools, data, role, version, lang) {
  const T = CT[lang], { JsPDF, regular, bold } = tools;
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('DejaVuSans.ttf', regular); doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', bold); doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
  const W = 210, M = 16, CW = W - 2 * M; let y = 20;
  const ink = () => doc.setTextColor(31, 42, 36);
  const room = (h) => { if (y + h > 280) { doc.addPage(); y = 20; } };
  const text = (s, size, style, color, x = M, w = CW) => {
    doc.setFont('DejaVu', style); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(s), w); room(lines.length * size * 0.45 + 1);
    doc.text(lines, x, y); y += lines.length * size * 0.45 + 1.5;
  };
  text(T.title, 18, 'bold', [38, 54, 45]);
  text(`${T.who[role]} · ${T.version} ${version} · ${T.made} ${new Date().toLocaleDateString(T.locale)}`, 10, 'normal', [94, 90, 80]);
  y += 3; text(T.summary, 13, 'bold', [138, 91, 30]);
  ['basic', 'speed', 'mem'].forEach((k) => text(`${T.checks[k]}: ${data[k + '_done'] ? T.done : T.notDone}`, 11, 'normal', data[k + '_done'] ? COL.ok : COL.bad));
  if (!data.basic_done && !data.speed_done && !data.mem_done) text(T.none, 11, 'normal', COL.info);
  const f = (v, d) => (v == null ? T.n : d ? d(v) : v);
  y += 2; text(T.facts, 13, 'bold', [138, 91, 30]);
  text(`${T.mem}: ${f(data.deviceMemory, (v) => v + ' GB')}`, 10.5, 'normal', COL.info);
  text(`${T.bw}: ${f(data.bandwidthGBps, (v) => Number(v).toFixed(1))}`, 10.5, 'normal', COL.info);
  text(`${T.ok}: ${f(data.memOkMB)}`, 10.5, 'normal', COL.info);
  if (data.mem_done) text(`${T.failed}: ${data.memFailed ? T.yes : T.no}`, 10.5, 'normal', COL.info);
  [['basic', 'basic'], ['speed', 'speed'], ['mem', 'mem']].forEach(([k]) => {
    const rows = Array.isArray(data[k]) ? data[k] : []; if (!rows.length) return;
    y += 3; text(T.checks[k], 13, 'bold', [138, 91, 30]);
    rows.forEach((r) => {
      const left = String(r.k), right = `${MARK[r.s] || ''} ${r.v}`.trim();
      const rl = doc.splitTextToSize(right, CW * 0.55), ll = doc.splitTextToSize(left, CW * 0.4), h = Math.max(rl.length, ll.length) * 4.6 + 1.2;
      room(h); doc.setFont('DejaVu', 'normal'); doc.setFontSize(10);
      doc.setTextColor(94, 90, 80); doc.text(ll, M, y); doc.setTextColor(...(COL[r.s] || COL.info)); doc.text(rl, M + CW * 0.42, y);
      y += h; doc.setDrawColor(221, 210, 191); doc.line(M, y - 3.2, M + CW, y - 3.2);
    });
  });
  y += 4; text(T.note, 9, 'normal', [94, 90, 80]); ink();
  return doc;
}

// ---- entry point ----
// opts: { test: '1'|'2'|'cap', lang, version, data }  (data = what the server returned for this report)
export async function makeReport(opts) {
  const { test, lang, version, data } = opts, tools = await pdfTools(), day = new Date().toISOString().slice(0, 10);
  let doc, name;
  if (test === '1') {
    const mod = await import('./sanctuaire-test1/report.js');
    doc = mod.buildReport(tools.JsPDF, { regular: tools.regular, bold: tools.bold }, { categories: data.categories, items: data.items, exportedAt: new Date().toISOString(), exporterRole: 'admin' }, { lang });
    name = `sanctuaire-test1-v${version}-${day}-${lang}.pdf`;
  } else if (test === '2') {
    if (!window.buildT2Report) await loadScript('sanctuaire-test2/report.js');
    if (!(window.T2 && T2.STRINGS)) await loadScript('sanctuaire-test2/strings.js');
    const items = {}, events = {};
    for (const i of data.items) items[i.sid] = i;
    for (const e of data.events) (events[e.sid] = events[e.sid] || []).push(e);
    doc = window.buildT2Report(tools.JsPDF, { reg: tools.regular, bold: tools.bold }, { T2: window.T2, items, events, now: new Date(), lang });
    name = `sanctuaire-test2-v${version}-${day}-${lang}.pdf`;
  } else {
    doc = capPdf(tools, data.data || {}, data.role, version, lang);
    name = `sanctuaire-phone-check-${data.role === 'admin' ? 'english-speaker' : 'french-speaker'}-v${version}-${day}-${lang}.pdf`;
  }
  doc.save(name);
  return name;
}
