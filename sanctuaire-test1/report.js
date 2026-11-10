// Builds the PDF report of the shared Test 1 sheet.
// A pure function: it gets the PDF library, the fonts and the sheet data, and returns a finished PDF document.
// It does not touch the network or the page.

const PAGE = { w: 210, h: 297 };
const MARGIN = { l: 16, r: 16, t: 17, b: 18 };
const C = {
  ink: [27, 36, 48], muted: [91, 102, 118], line: [213, 219, 227], accent: [47, 111, 143],
  good: [47, 125, 91], warn: [168, 107, 18], bad: [180, 69, 47], panel: [243, 246, 249], white: [255, 255, 255],
};
const RATING_COLOR = { good: C.good, awkward: C.warn, wrong: C.bad, kept: C.good, changed: C.bad };

const TEXT = {
  en: {
    title: 'Sanctuaire Test 1',
    subtitle: 'On-device translation: results report',
    exported: (d) => `Exported ${d}`,
    by: (r) => `by ${r}`,
    whoBy: { admin: 'the English speaker', partner: 'the French speaker' },
    sectionSummary: 'Summary',
    sectionAttention: 'Needs attention',
    sectionResults: 'All results by sentence type',
    sectionSetup: 'Engine and devices',
    progress: 'Progress',
    written: 'Sentences written', tested: 'Translated and back-translated', reviewed: 'Translation rated by the other person', done: 'Fully done (both ratings)',
    ofTotal: (n, t) => `${n} of ${t}`,
    dirTable: ['Direction', 'Tested', 'Good', 'Awkward', 'Wrong', 'Meaning kept', 'Meaning changed', 'Median', 'Slowest'],
    dirEnFr: 'English → French', dirFrEn: 'French → English',
    dirCaption: 'English → French is judged by the French speaker; French → English by the English speaker.',
    noneWritten: 'No sentences written yet',
    total: 'Total',
    ms: (n) => `${n} ms`,
    attentionIntro: 'Sentences whose translation was rated Awkward or Wrong, or whose back-translation changed the meaning.',
    none: 'None.',
    notWritten: 'Not written yet',
    slot: (n) => `Sentence ${n}`,
    speaker: { admin: 'English speaker', partner: 'French speaker' },
    langName: { en: 'English', fr: 'French' },
    source: (l) => `Sentence (${l})`, note: 'Note from the author', translation: (l) => `Translation (${l})`, back: (l) => `Back-translation (${l})`,
    ratingTranslation: (who) => `Translation rated by ${who}`,
    ratingBack: (who) => `Back-translation checked by ${who}`,
    notRated: 'Not rated yet', notTested: 'Not tested yet',
    status: { written: 'Written', tested: 'Tested', reviewed: 'Reviewed', done: 'Done' },
    rating: { good: 'Good', awkward: 'Awkward', wrong: 'Wrong', kept: 'Meaning kept', changed: 'Meaning changed' },
    timing: (a, b, v) => `${a} ms + ${b} ms · version ${v}`,
    engines: 'Translation engine settings used', devices: 'Devices used',
    footer: 'Sanctuaire Test 1 · report', page: (i, n) => `Page ${i} of ${n}`,
    privacy: 'Test data only. Sentences were stored as readable text in the test database.',
  },
  fr: {
    title: 'Sanctuaire Test 1',
    subtitle: 'Traduction sur le téléphone : rapport des résultats',
    exported: (d) => `Exporté le ${d}`,
    by: (r) => `par ${r}`,
    whoBy: { admin: 'la personne anglophone', partner: 'la personne francophone' },
    sectionSummary: 'Résumé',
    sectionAttention: 'À surveiller',
    sectionResults: 'Tous les résultats par type de phrases',
    sectionSetup: 'Moteur et appareils',
    progress: 'Avancement',
    written: 'Phrases écrites', tested: 'Traduites et retraduites', reviewed: 'Traduction notée par l\'autre personne', done: 'Terminées (les deux notes)',
    ofTotal: (n, t) => `${n} sur ${t}`,
    dirTable: ['Sens', 'Testées', 'Bonnes', 'Maladroites', 'Fausses', 'Sens conservé', 'Sens changé', 'Médiane', 'Plus lente'],
    dirEnFr: 'Anglais → français', dirFrEn: 'Français → anglais',
    dirCaption: 'Anglais → français est jugé par la personne francophone ; français → anglais par la personne anglophone.',
    noneWritten: 'Aucune phrase écrite pour l\'instant',
    total: 'Total',
    ms: (n) => `${n} ms`,
    attentionIntro: 'Phrases dont la traduction a été notée Maladroite ou Fausse, ou dont la traduction retour a changé le sens.',
    none: 'Aucune.',
    notWritten: 'Pas encore écrites',
    slot: (n) => `Phrase ${n}`,
    speaker: { admin: 'anglophone', partner: 'francophone' },
    langName: { en: 'anglais', fr: 'français' },
    source: (l) => `Phrase (${l})`, note: 'Note de l\'auteur', translation: (l) => `Traduction (${l})`, back: (l) => `Traduction retour (${l})`,
    ratingTranslation: (who) => `Traduction notée par ${who}`,
    ratingBack: (who) => `Traduction retour vérifiée par ${who}`,
    notRated: 'Pas encore notée', notTested: 'Pas encore testée',
    status: { written: 'Écrite', tested: 'Testée', reviewed: 'Évaluée', done: 'Terminée' },
    rating: { good: 'Bonne', awkward: 'Maladroite', wrong: 'Fausse', kept: 'Sens conservé', changed: 'Sens changé' },
    timing: (a, b, v) => `${a} ms + ${b} ms · version ${v}`,
    engines: 'Réglages du moteur de traduction utilisés', devices: 'Appareils utilisés',
    footer: 'Sanctuaire Test 1 · rapport', page: (i, n) => `Page ${i} sur ${n}`,
    privacy: 'Données de test uniquement. Les phrases étaient enregistrées en texte lisible dans la base de données du test.',
  },
};

const mm = (pt) => pt * 0.3528;
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const pct = (n, t) => (t ? `${Math.round((n / t) * 100)}%` : '–');

export function buildReport(JsPDF, fonts, data, opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en';
  const T = TEXT[lang];
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('DejaVuSans.ttf', fonts.regular);
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
  doc.setProperties({ title: `${T.title}: ${T.subtitle}`, subject: T.subtitle, author: 'Sanctuaire Test 1', creator: 'Sanctuaire Test 1' });

  const W = PAGE.w - MARGIN.l - MARGIN.r;
  const bottom = PAGE.h - MARGIN.b;
  let y = MARGIN.t;

  const setFont = (style, size, color) => { doc.setFont('DejaVu', style); doc.setFontSize(size); doc.setTextColor(...color); };
  const lineH = (size) => mm(size) * 1.42;
  const wrap = (text, width, style, size) => { setFont(style, size, C.ink); return doc.splitTextToSize(String(text ?? ''), width); };
  const newPage = () => { doc.addPage(); y = MARGIN.t; };
  const ensure = (h) => { if (y + h > bottom) newPage(); };
  const rule = (color = C.line, w = 0.25) => { doc.setDrawColor(...color); doc.setLineWidth(w); doc.line(MARGIN.l, y, PAGE.w - MARGIN.r, y); };

  // one wrapped paragraph that may flow across pages
  function para(text, { size = 9.5, style = 'normal', color = C.ink, x = MARGIN.l, width = W, gap = 1.2 } = {}) {
    setFont(style, size, color);
    for (const l of doc.splitTextToSize(String(text ?? ''), width)) {
      ensure(lineH(size));
      setFont(style, size, color);
      doc.text(l, x, y, { baseline: 'top' });
      y += lineH(size);
    }
    y += gap;
  }
  function heading(text, { size = 13, color = C.accent, before = 5, after = 2.2 } = {}) {
    ensure(before + lineH(size) + after + 12);   // keep a heading with the text that follows
    y += before;
    setFont('bold', size, color);
    doc.text(text, MARGIN.l, y, { baseline: 'top' });
    y += lineH(size) + after;
  }

  // ---------- data ----------
  const cats = [...data.categories].sort((a, b) => a.sort - b.sort);
  const items = data.items;
  const catName = (c) => (lang === 'fr' ? c.name_fr : c.name_en);
  const catHint = (c) => (lang === 'fr' ? c.hint_fr : c.hint_en);
  const totalSlots = cats.length * 3 * 2;
  const written = items.length;
  const tested = items.filter((i) => i.translation).length;
  const reviewed = items.filter((i) => i.translation_rating).length;
  const done = items.filter((i) => i.status === 'done').length;
  const dirItems = { admin: items.filter((i) => i.author === 'admin'), partner: items.filter((i) => i.author === 'partner') };
  const srcLang = { admin: 'en', partner: 'fr' };
  const dstLang = { admin: 'fr', partner: 'en' };
  const other = { admin: 'partner', partner: 'admin' };

  // ---------- first page: title ----------
  setFont('bold', 22, C.accent);
  doc.text(T.title, MARGIN.l, y, { baseline: 'top' });
  y += lineH(22);
  setFont('normal', 12, C.ink);
  doc.text(T.subtitle, MARGIN.l, y, { baseline: 'top' });
  y += lineH(12) + 1;
  setFont('normal', 9, C.muted);
  const exportedAt = new Date(data.exportedAt || Date.now());
  const when = exportedAt.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' });
  doc.text(`${T.exported(when)}${data.exporterRole ? ' ' + T.by(T.whoBy[data.exporterRole]) : ''}`, MARGIN.l, y, { baseline: 'top' });
  y += lineH(9) + 2;
  rule(C.accent, 0.6);
  y += 1;

  // ---------- summary ----------
  heading(T.sectionSummary, { before: 3 });
  const progressRows = [
    [T.written, T.ofTotal(written, totalSlots)],
    [T.tested, T.ofTotal(tested, totalSlots)],
    [T.reviewed, T.ofTotal(reviewed, totalSlots)],
    [T.done, T.ofTotal(done, totalSlots)],
  ];
  setFont('bold', 9.5, C.ink); doc.text(T.progress, MARGIN.l, y, { baseline: 'top' }); y += lineH(9.5) + 0.8;
  for (const [label, value] of progressRows) {
    ensure(lineH(9.5));
    setFont('normal', 9.5, C.muted); doc.text(label, MARGIN.l + 2, y, { baseline: 'top' });
    setFont('bold', 9.5, C.ink); doc.text(value, MARGIN.l + 92, y, { baseline: 'top' });
    y += lineH(9.5);
  }
  y += 3;

  // direction table
  const cols = [30, 16, 18, 22, 18, 18, 18, 19, 19];   // sums to 178
  const colX = cols.reduce((acc, w, i) => { acc.push(i ? acc[i - 1] + cols[i - 1] : MARGIN.l); return acc; }, []);
  const statRow = (label, list, reviewerKey) => {
    const t = list.filter((i) => i.translation);
    const ms = t.map((i) => i.ms_out).filter((v) => v != null);
    const cnt = (k, v) => list.filter((i) => i[k] === v).length;
    const rated = list.filter((i) => i.translation_rating).length;
    const back = list.filter((i) => i.back_rating).length;
    return [
      label, String(t.length),
      `${cnt('translation_rating', 'good')} (${pct(cnt('translation_rating', 'good'), rated)})`,
      `${cnt('translation_rating', 'awkward')} (${pct(cnt('translation_rating', 'awkward'), rated)})`,
      `${cnt('translation_rating', 'wrong')} (${pct(cnt('translation_rating', 'wrong'), rated)})`,
      `${cnt('back_rating', 'kept')} (${pct(cnt('back_rating', 'kept'), back)})`,
      `${cnt('back_rating', 'changed')} (${pct(cnt('back_rating', 'changed'), back)})`,
      ms.length ? T.ms(median(ms)) : '–', ms.length ? T.ms(Math.max(...ms)) : '–',
    ];
  };
  const tableRows = [
    statRow(T.dirEnFr, dirItems.admin),
    statRow(T.dirFrEn, dirItems.partner),
    statRow(T.total, items),
  ];
  // header
  const headerLines = T.dirTable.map((h, i) => wrap(h, cols[i] - 2, 'bold', 7.5));
  const headerH = Math.max(...headerLines.map((l) => l.length)) * lineH(7.5) + 3;
  ensure(headerH + 3 * 14);
  doc.setFillColor(...C.panel); doc.rect(MARGIN.l, y, W, headerH, 'F');
  headerLines.forEach((ls, i) => { setFont('bold', 7.5, C.muted); ls.forEach((l, k) => doc.text(l, colX[i] + 1, y + 1.5 + k * lineH(7.5), { baseline: 'top' })); });
  y += headerH;
  for (const row of tableRows) {
    const cellLines = row.map((c, i) => wrap(c, cols[i] - 2, i === 0 ? 'normal' : 'normal', 8));
    const rh = Math.max(...cellLines.map((l) => l.length)) * lineH(8) + 3;
    ensure(rh);
    rule();
    cellLines.forEach((ls, i) => { setFont(row[0] === T.total ? 'bold' : 'normal', 8, C.ink); ls.forEach((l, k) => doc.text(l, colX[i] + 1, y + 1.5 + k * lineH(8), { baseline: 'top' })); });
    y += rh;
  }
  rule();
  y += 1.5;
  para(T.dirCaption, { size: 7.5, color: C.muted, gap: 2 });

  // ---------- needs attention ----------
  heading(T.sectionAttention);
  para(T.attentionIntro, { size: 8.5, color: C.muted, gap: 2 });
  const flagged = [];
  for (const c of cats) for (const a of ['admin', 'partner']) for (let n = 1; n <= 3; n++) {
    const i = items.find((x) => x.category_id === c.id && x.author === a && x.slot === n);
    if (i && (i.translation_rating === 'awkward' || i.translation_rating === 'wrong' || i.back_rating === 'changed')) flagged.push({ c, i });
  }
  if (!flagged.length) para(T.none, { color: C.muted });
  for (const { c, i } of flagged) {
    const tags = [];
    if (i.translation_rating === 'awkward' || i.translation_rating === 'wrong') tags.push([T.rating[i.translation_rating], RATING_COLOR[i.translation_rating]]);
    if (i.back_rating === 'changed') tags.push([T.rating.changed, C.bad]);
    const body = [
      `${i.source_text}`, `→ ${i.translation ?? ''}`,
      ...(i.translation_remark ? [`${cap(T.speaker[other[i.author]])}: ${i.translation_remark}`] : []),
      ...(i.back_remark ? [`${cap(T.speaker[i.author])}: ${i.back_remark}`] : []),
    ];
    const bodyLines = body.flatMap((b) => wrap(b, W - 4, 'normal', 8.5));
    const h = lineH(9) + bodyLines.length * lineH(8.5) + 3.5;
    ensure(h);
    setFont('bold', 9, C.ink);
    doc.text(`${catName(c)} · ${cap(T.speaker[i.author])} · ${T.slot(i.slot)}`, MARGIN.l, y, { baseline: 'top' });
    let tx = PAGE.w - MARGIN.r;
    for (const [label, color] of [...tags].reverse()) { setFont('bold', 8.5, color); const wd = doc.getTextWidth(label); tx -= wd; doc.text(label, tx, y, { baseline: 'top' }); tx -= 4; }
    y += lineH(9);
    setFont('normal', 8.5, C.ink);
    for (const l of bodyLines) { doc.text(l, MARGIN.l + 2, y, { baseline: 'top' }); y += lineH(8.5); }
    y += 2.5;
  }

  // ---------- engine and devices ----------
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const engines = uniq(items.map((i) => i.engine));
  const devices = uniq(items.map((i) => i.device));
  heading(T.sectionSetup);
  setFont('bold', 9, C.ink); ensure(lineH(9)); doc.text(T.engines, MARGIN.l, y, { baseline: 'top' }); y += lineH(9);
  if (!engines.length) para('–', { color: C.muted });
  engines.forEach((e) => para(e, { size: 8.5, x: MARGIN.l + 2, width: W - 2, gap: 0.6 }));
  y += 1.5;
  setFont('bold', 9, C.ink); ensure(lineH(9)); doc.text(T.devices, MARGIN.l, y, { baseline: 'top' }); y += lineH(9);
  if (!devices.length) para('–', { color: C.muted });
  devices.forEach((d) => para(d, { size: 8, x: MARGIN.l + 2, width: W - 2, gap: 0.6, color: C.muted }));

  // ---------- all results ----------
  newPage();
  setFont('bold', 15, C.accent);
  doc.text(T.sectionResults, MARGIN.l, y, { baseline: 'top' });
  y += lineH(15) + 1;

  for (const c of cats) {
    ensure(lineH(12) + lineH(8.5) + 30);
    y += 3;
    setFont('bold', 12, C.accent);
    doc.text(`${c.sort}. ${catName(c)}`, MARGIN.l, y, { baseline: 'top' });
    y += lineH(12);
    para(catHint(c), { size: 8.5, color: C.muted, gap: 1.5 });
    rule(); y += 2;

    const missing = [];
    for (const a of ['admin', 'partner']) {
      for (let n = 1; n <= 3; n++) {
        const i = items.find((x) => x.category_id === c.id && x.author === a && x.slot === n);
        if (!i) { missing.push(`${cap(T.speaker[a])} · ${T.slot(n)}`); continue; }
        drawEntry(i, a);
      }
    }
    if (missing.length === 6) para(T.noneWritten, { size: 8.5, color: C.muted, gap: 3 });
    else if (missing.length) para(`${T.notWritten}: ${missing.join('; ')}`, { size: 8.5, color: C.muted, gap: 3 });
  }

  function drawEntry(i, a) {
    const pad = 2.6;
    const inner = W - 2 * pad;
    const blocks = [];   // {label, text, color, style}
    const add = (label, text, opt = {}) => blocks.push({ label, text, ...opt });
    add(T.source(T.langName[srcLang[a]]), i.source_text);
    if (i.author_note) add(T.note, i.author_note, { color: C.muted });
    if (i.translation) {
      add(T.translation(T.langName[dstLang[a]]), i.translation);
      add(T.back(T.langName[srcLang[a]]), i.back_translation || '');
    } else {
      add(T.translation(T.langName[dstLang[a]]), T.notTested, { color: C.muted });
    }
    const colW = (inner - 5) / 2;
    const rt = i.translation_rating, rb = i.back_rating;
    const colA = { label: T.ratingTranslation(T.whoBy[other[a]]), word: rt ? T.rating[rt] : T.notRated, color: rt ? RATING_COLOR[rt] : C.muted, remark: i.translation_remark };
    const colB = { label: T.ratingBack(T.whoBy[a]), word: rb ? T.rating[rb] : T.notRated, color: rb ? RATING_COLOR[rb] : C.muted, remark: i.back_remark };
    const colLines = (col) => [wrap(col.label, colW, 'normal', 7.5), wrap(col.remark || '', colW, 'normal', 8.5)];
    const [aL, aR] = colLines(colA), [bL, bR] = colLines(colB);
    const colH = (L, R, col) => L.length * lineH(7.5) + lineH(9.5) + (col.remark ? R.length * lineH(8.5) : 0);

    let h = pad * 2 + lineH(9.5) + 1;                                  // header line
    const blockLines = blocks.map((b) => ({ ...b, lines: wrap(b.text, inner, 'normal', 9.5) }));
    for (const b of blockLines) h += lineH(7.5) + b.lines.length * lineH(9.5) + 1;
    h += Math.max(colH(aL, aR, colA), colH(bL, bR, colB)) + 1 + lineH(7.5);

    const fits = h < bottom - MARGIN.t;
    if (fits) ensure(h + 2); else ensure(30);
    const top = y;
    if (fits) { doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.roundedRect(MARGIN.l, top, W, h, 1.2, 1.2, 'S'); }
    y += pad;
    const x = MARGIN.l + pad;

    // header: who, sentence number, direction, status
    setFont('bold', 9.5, C.ink);
    doc.text(`${cap(T.speaker[a])} · ${T.slot(i.slot)}`, x, y, { baseline: 'top' });
    setFont('normal', 8.5, C.muted);
    doc.text(a === 'admin' ? 'EN → FR' : 'FR → EN', x + 62, y + 0.3, { baseline: 'top' });
    const statusLabel = T.status[i.status] || i.status;
    const statusColor = i.status === 'done' ? C.good : i.status === 'written' ? C.muted : i.status === 'reviewed' ? C.warn : C.accent;
    setFont('bold', 9, statusColor);
    doc.text(statusLabel, PAGE.w - MARGIN.r - pad - doc.getTextWidth(statusLabel), y + 0.2, { baseline: 'top' });
    y += lineH(9.5) + 1;

    for (const b of blockLines) {
      setFont('normal', 7.5, C.muted); if (!fits) ensure(lineH(7.5) + lineH(9.5));
      doc.text(b.label, x, y, { baseline: 'top' }); y += lineH(7.5);
      for (const l of b.lines) {
        if (!fits) ensure(lineH(9.5));
        setFont('normal', 9.5, b.color || C.ink);
        doc.text(l, x, y, { baseline: 'top' }); y += lineH(9.5);
      }
      y += 1;
    }

    // two rating columns
    if (!fits) ensure(30);
    const yCols = y;
    const drawCol = (col, L, R, cx) => {
      let cy = yCols;
      setFont('normal', 7.5, C.muted); L.forEach((l) => { doc.text(l, cx, cy, { baseline: 'top' }); cy += lineH(7.5); });
      setFont('bold', 9.5, col.color); doc.text(col.word, cx, cy, { baseline: 'top' }); cy += lineH(9.5);
      if (col.remark) { setFont('normal', 8.5, C.ink); R.forEach((l) => { doc.text(l, cx, cy, { baseline: 'top' }); cy += lineH(8.5); }); }
      return cy;
    };
    const ya = drawCol(colA, aL, aR, x);
    const yb = drawCol(colB, bL, bR, x + colW + 5);
    y = Math.max(ya, yb) + 1;
    if (i.translation) {
      setFont('normal', 7.5, C.muted);
      doc.text(T.timing(i.ms_out ?? '–', i.ms_back ?? '–', i.attempt || 1), x, y, { baseline: 'top' });
    }
    y = fits ? top + h + 2.5 : y + lineH(7.5) + pad + 2.5;
  }

  // ---------- footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.25);
    doc.line(MARGIN.l, PAGE.h - 13, PAGE.w - MARGIN.r, PAGE.h - 13);
    setFont('normal', 7.5, C.muted);
    doc.text(`${T.footer} · ${T.privacy}`, MARGIN.l, PAGE.h - 11, { baseline: 'top', maxWidth: W - 28 });
    const pg = T.page(p, pages);
    doc.text(pg, PAGE.w - MARGIN.r - doc.getTextWidth(pg), PAGE.h - 11, { baseline: 'top' });
  }
  return doc;
}
