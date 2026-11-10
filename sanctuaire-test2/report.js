/* Sanctuaire · Test 2 · PDF report (admin). Uses the jsPDF and DejaVu fonts already in the Test 1 folder. */
(function (root) {
  const TXT = {
    en: {
      title: 'Sanctuaire · Test 2 · French translation review', sub: 'Report for Claude: the final French to use in the French screens.',
      made: 'Created', summary: 'Summary', total: 'Texts to review', agreedOrig: 'Agreed, original French kept', agreedNew: 'Agreed, French changed',
      open: 'Not agreed yet', p_pending: 'To review', p_suggested: 'Change suggested, waiting for the English speaker', p_rejected: 'Rejected, waiting for the French speaker', p_countered: 'Reply sent, waiting for the English speaker',
      openTitle: 'Still open', none: 'Nothing is open. Every text is agreed.', finalTitle: 'Final French, by category', legendKept: 'kept', legendChanged: 'changed', legendOpen: 'open (proposed French shown)',
      was: 'Original was', histTitle: 'Discussion history', histNone: 'No discussion: every text was approved as proposed.',
      colId: 'ID', colEn: 'English', colFr: 'French', suggestion: 'Her suggestion', reason: 'Reason', status: 'Status', page: 'Page',
      ev: { approve: 'approved the proposed French', suggest: 'suggested', counter: 'replied', accept: 'kept the original French', admin_approve: 'approved her version', admin_reject: 'rejected her change', admin_keep: 'kept the original French', admin_reopen: 'reopened this text' },
      by: { admin: 'English speaker', partner: 'French speaker' },
      r: { long: 'Too long for the layout', unnatural: 'Sounds unnatural', meaning: 'Wrong meaning', register: 'Too formal or not “tu”', grammar: 'Grammar or spelling', gender: 'Masculine / feminine form', other: 'Other' },
      locale: 'en-GB'
    },
    fr: {
      title: 'Sanctuaire · Test 2 · Relecture des traductions', sub: 'Rapport pour Claude : le français final à utiliser dans les écrans en français.',
      made: 'Créé le', summary: 'Résumé', total: 'Textes à relire', agreedOrig: 'Validés, français d’origine gardé', agreedNew: 'Validés, français modifié',
      open: 'Pas encore validés', p_pending: 'À relire', p_suggested: 'Modification proposée, en attente de l’anglophone', p_rejected: 'Refusée, en attente de la francophone', p_countered: 'Réponse envoyée, en attente de l’anglophone',
      openTitle: 'Encore ouverts', none: 'Rien n’est ouvert. Tous les textes sont validés.', finalTitle: 'Français final, par catégorie', legendKept: 'gardé', legendChanged: 'modifié', legendOpen: 'ouvert (français proposé affiché)',
      was: 'L’original était', histTitle: 'Historique des échanges', histNone: 'Aucun échange : tous les textes ont été approuvés tels quels.',
      colId: 'ID', colEn: 'Anglais', colFr: 'Français', suggestion: 'Sa suggestion', reason: 'Raison', status: 'État', page: 'Page',
      ev: { approve: 'a approuvé le français proposé', suggest: 'a proposé', counter: 'a répondu', accept: 'a gardé le français d’origine', admin_approve: 'a approuvé sa version', admin_reject: 'a refusé sa modification', admin_keep: 'a gardé le français d’origine', admin_reopen: 'a rouvert ce texte' },
      by: { admin: 'L’anglophone', partner: 'La francophone' },
      r: { long: 'Trop long pour l’écran', unnatural: 'Ça sonne faux', meaning: 'Sens incorrect', register: 'Trop formel ou pas en « tu »', grammar: 'Grammaire ou orthographe', gender: 'Forme masculin / féminin', other: 'Autre' },
      locale: 'fr-FR'
    }
  };

  function buildT2Report(JsPDF, fonts, data) {
    const L = TXT[data.lang === 'fr' ? 'fr' : 'en'];
    const { T2, items, events } = data;
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    doc.addFileToVFS('DejaVuSans.ttf', fonts.reg); doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
    doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold); doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
    const M = 14, W = 182, BOTTOM = 284;
    let y = 16;
    const fmt = (x) => new Date(x).toLocaleString(L.locale, { dateStyle: 'short', timeStyle: 'short' });
    const stOf = (s) => (items[s.id] ? items[s.id].status : 'pending');
    const font = (size, bold, gray) => { doc.setFont('DejaVu', bold ? 'bold' : 'normal'); doc.setFontSize(size); const g = gray ? 95 : 20; doc.setTextColor(g, g, g); };
    const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 16; } };
    const lh = (size) => size * 0.43;

    function para(str, o) {
      o = o || {}; const size = o.size || 9.5, x = o.x == null ? M : o.x, w = o.w || W - (x - M);
      font(size, o.bold, o.gray);
      const lines = doc.splitTextToSize(String(str), w);
      for (const ln of lines) { ensure(lh(size) + 0.8); doc.text(ln, x, y + lh(size)); y += lh(size) + 0.8; }
      y += o.after == null ? 1 : o.after;
    }
    function heading(str, size) { ensure(12); y += 3; para(str, { size: size || 13, bold: true, after: 2 }); doc.setDrawColor(200); doc.line(M, y - 1, M + W, y - 1); y += 1.5; }
    function row(cols, widths, o) {
      o = o || {}; const size = 9; font(size, false);
      const wrapped = cols.map((c, i) => doc.splitTextToSize(String(c.text == null ? c : c.text), widths[i] - 2));
      const n = Math.max(...wrapped.map((w) => w.length)); const h = n * (lh(size) + 0.8) + 2;
      ensure(Math.min(h, 40));
      let x = M;
      wrapped.forEach((lines, i) => {
        const c = cols[i]; font(size, c.bold, c.gray);
        lines.forEach((ln, k) => { if (y + (k + 1) * (lh(size) + 0.8) > BOTTOM + 1) return; doc.text(ln, x + 1, y + 1 + (k + 1) * (lh(size) + 0.8) - 0.8); });
        x += widths[i];
      });
      y += h; doc.setDrawColor(225); doc.line(M, y, M + W, y);
    }

    // ---------- title and summary ----------
    font(17, true); doc.text(L.title, M, y + 6); y += 10;
    para(L.sub, { size: 10, gray: true, after: 1 });
    para(`${L.made}: ${fmt(data.now)}`, { size: 9, gray: true, after: 3 });
    const all = T2.STRINGS; const cnt = { pending: 0, suggested: 0, rejected: 0, countered: 0, orig: 0, changed: 0 };
    for (const s of all) { const st = stOf(s); if (st === 'agreed') cnt[items[s.id].final_kind === 'original' ? 'orig' : 'changed']++; else cnt[st]++; }
    const openN = cnt.pending + cnt.suggested + cnt.rejected + cnt.countered;
    heading(L.summary);
    const sw = [140, 42];
    row([L.total, { text: String(all.length), bold: true }], sw);
    row([L.agreedOrig, { text: String(cnt.orig), bold: true }], sw);
    row([L.agreedNew, { text: String(cnt.changed), bold: true }], sw);
    row([L.open, { text: String(openN), bold: true }], sw);
    for (const k of ['pending', 'suggested', 'rejected', 'countered']) if (cnt[k]) row([{ text: '   ' + L['p_' + k], gray: true }, { text: String(cnt[k]), gray: true }], sw);

    // ---------- still open ----------
    heading(L.openTitle);
    const openList = all.filter((s) => stOf(s) !== 'agreed');
    if (!openList.length) para(L.none);
    for (const s of openList) {
      const it = items[s.id]; const evs = events[s.id] || [];
      ensure(24);
      para(`${s.id} · ${L['p_' + stOf(s)]}`, { size: 8.5, gray: true, after: 0 });
      para(s.en, { bold: true, after: 0 });
      para(`${L.colFr}: ${s.fr}`, { after: 0 });
      if (it && it.sug_fr) para(`${L.suggestion}: ${it.sug_fr}${it.sug_reason ? ' · ' + L.r[it.sug_reason] : ''}`, { after: 0 });
      const last = evs.filter((e) => e.note).slice(-2);
      for (const e of last) para(`${L.by[e.actor]}: “${e.note}”`, { size: 8.5, gray: true, x: M + 4, after: 0 });
      y += 2.5;
    }

    // ---------- final French ----------
    heading(L.finalTitle);
    para(`✓ ${L.legendKept}   ✎ ${L.legendChanged}   … ${L.legendOpen}`, { size: 8.5, gray: true });
    const cw = [40, 64, 78];
    for (const cat of T2.CATEGORIES) {
      const list = all.filter((s) => s.cat === cat.id); if (!list.length) continue;
      ensure(24); y += 2; para(cat[data.lang === 'fr' ? 'fr' : 'en'], { size: 11, bold: true, after: 1 });
      row([{ text: L.colId, bold: true, gray: true }, { text: L.colEn, bold: true, gray: true }, { text: L.colFr, bold: true, gray: true }], cw);
      for (const s of list) {
        const it = items[s.id]; const st = stOf(s);
        let fr, mark;
        if (st === 'agreed') { fr = it.final_fr; mark = it.final_kind === 'original' ? '✓' : '✎'; } else { fr = s.fr; mark = '…'; }
        const cell = { text: `${mark} ${fr}${st === 'agreed' && it.final_kind === 'suggestion' ? `\n(${L.was}: ${s.fr})` : ''}` };
        row([{ text: s.id, gray: true }, s.en, cell], cw);
      }
    }

    // ---------- discussion history ----------
    heading(L.histTitle);
    const disc = all.filter((s) => (events[s.id] || []).some((e) => e.kind !== 'approve'));
    if (!disc.length) para(L.histNone);
    for (const s of disc) {
      ensure(20); para(`${s.id} · ${s.en}`, { bold: true, after: 0 });
      para(`${L.colFr}: ${s.fr}`, { size: 8.5, gray: true, after: 0.5 });
      for (const e of events[s.id]) {
        let line = `${fmt(e.at)} · ${L.by[e.actor]} ${L.ev[e.kind]}`;
        if (e.fr_text && ['suggest', 'counter'].includes(e.kind)) line += `: ${e.fr_text}`;
        if (e.reason) line += ` [${L.r[e.reason]}]`;
        if (e.note) line += ` — “${e.note}”`;
        para(line, { size: 8.5, x: M + 4, after: 0.3 });
      }
      y += 2.5;
    }

    // ---------- page numbers ----------
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) { doc.setPage(p); font(8, false, true); doc.text(`${L.page} ${p}/${pages}`, M + W, 291, { align: 'right' }); doc.text('Sanctuaire · Test 2', M, 291); }
    return doc;
  }
  root.buildT2Report = buildT2Report;
  if (typeof module !== 'undefined') module.exports = { buildT2Report };
})(typeof window !== 'undefined' ? window : globalThis);
