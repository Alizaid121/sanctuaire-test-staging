/* Sanctuaire Test 1 version 2: the rules step.  Bergamot translates, and this file repairs what the engine often gets wrong.
   - preEdit(text, lang)       runs BEFORE translating: idioms and slang are replaced by plain wording of the same language.
   - postEdit(text, lang, ctx) runs AFTER translating: French "vous" becomes "tu" (with the verbs, pronouns and possessives that go with it),
                               literal translations seen in the tests are repaired, and adjectives follow the gender of the people
                               (ctx.reader / ctx.writer: 'man' or 'woman'; this app is for one man and one woman).
   Instant, private, nothing is downloaded. The word lists are in rules-data.js: add to them when a test shows a new mistake. */
import { EN_PRE, FR_PRE, FR_POST, EN_POST, FEM_NOUNS, FEM_ENDINGS, MASC_EXCEPT, ADJ } from './rules-data.js';

const LET = '\\p{L}\\p{M}';
const mk = (src) => new RegExp(`(?<![${LET}\\p{N}])(?:${src})(?![${LET}\\p{N}])`, 'giu');
const isUpper = (s) => s.length > 1 && /\p{L}/u.test(s) && s === s.toUpperCase() && s !== s.toLowerCase();
function keepCase(orig, repl) {
  if (!repl) return repl;
  if (isUpper(orig)) return repl.toUpperCase();
  if (/^\p{Lu}/u.test(orig) && /^\p{L}/u.test(repl)) return repl.charAt(0).toUpperCase() + repl.slice(1);
  return repl;
}
const expand = (r, groups) => r.replace(/\$(\d)/g, (_, n) => groups[Number(n) - 1] ?? '');

// applies one table, returns the new text and the labels that fired
function applyTable(text, table, hits) {
  let out = text;
  for (const [label, src, repl] of table) {
    const re = mk(src);
    out = out.replace(re, (...a) => {
      const m = a[0];
      let groups = a.slice(1, -2);
      if (typeof groups[groups.length - 1] === 'object' && groups[groups.length - 1] !== null) groups = groups.slice(0, -1);   // named-groups object
      const r = typeof repl === 'function' ? repl(m, ...groups) : expand(repl, groups);
      hits.push(label);
      return keepCase(m, r);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// French: "vous" -> "tu"
// ---------------------------------------------------------------------------------------------------------------------------
const pairs = (s) => Object.fromEntries(s.trim().split(/\s+/).map((p) => p.split(':')));
// 2nd person plural present (also used for the imperative unless IMP_IRR says otherwise) -> 2nd person singular
const IRR = pairs(`êtes:es avez:as allez:vas faites:fais refaites:refais satisfaites:satisfais dites:dis redites:redis contredisez:contredis prédisez:prédis
  pouvez:peux voulez:veux devez:dois savez:sais venez:viens revenez:reviens devenez:deviens obtenez:obtiens retenez:retiens maintenez:maintiens
  appartenez:appartiens soutenez:soutiens tenez:tiens contenez:contiens parvenez:parviens souvenez:souviens voyez:vois croyez:crois prenez:prends
  comprenez:comprends apprenez:apprends surprenez:surprends reprenez:reprends entreprenez:entreprends mettez:mets permettez:permets promettez:promets
  admettez:admets remettez:remets soumettez:soumets commettez:commets transmettez:transmets émettez:émets battez:bats combattez:combats partez:pars
  sortez:sors dormez:dors endormez:endors sentez:sens ressentez:ressens consentez:consens servez:sers suivez:suis vivez:vis écrivez:écris décrivez:décris
  lisez:lis riez:ris souriez:souris buvez:bois recevez:reçois apercevez:aperçois connaissez:connais reconnaissez:reconnais paraissez:parais
  apparaissez:apparais disparaissez:disparais naissez:nais vaincrez:vaincras valez:vaux résolvez:résous suffisez:suffis fuyez:fuis asseyez:assieds
  rejoignez:rejoins joignez:joins craignez:crains plaignez:plains éteignez:éteins peignez:peins atteignez:atteins conduisez:conduis produisez:produis
  traduisez:traduis construisez:construis détruisez:détruis réduisez:réduis séduisez:séduis introduisez:introduis cuisez:cuis nuisez:nuis instruisez:instruis
  appelez:appelles rappelez:rappelles épelez:épelles jetez:jettes rejetez:rejettes achetez:achètes levez:lèves relevez:relèves élevez:élèves soulevez:soulèves
  enlevez:enlèves promenez:promènes amenez:amènes emmenez:emmènes ramenez:ramènes pesez:pèses gelez:gèles harcelez:harcèles
  payez:paies essayez:essaies balayez:balaies envoyez:envoies renvoyez:renvoies nettoyez:nettoies employez:emploies appuyez:appuies essuyez:essuies ennuyez:ennuies`);
// -er verbs with a spelling change: their imperative loses the final s (appelles -> appelle)
const ER_IRR = new Set('appelez rappelez épelez jetez rejetez achetez levez relevez élevez soulevez enlevez promenez amenez emmenez ramenez pesez gelez harcelez payez essayez balayez envoyez renvoyez nettoyez employez appuyez essuyez ennuyez'.split(' '));
const IMP_IRR = pairs('êtes:sois soyez:sois ayez:aie sachez:sache veuillez:veuille allez:va');
const SUBJ_IRR = pairs('soyez:sois ayez:aies fassiez:fasses puissiez:puisses sachiez:saches alliez:ailles veniez:viennes vouliez:veuilles deviez:doives voyiez:voies teniez:tiennes preniez:prennes');
// verbs in -ier whose present ends in -iez (otherwise -iez is the imperfect or the conditional)
const IER = new Set('étudiez oubliez remerciez copiez appréciez criez vérifiez confiez publiez variez balbutiez maniez envisagez? plaisantez? initiez associez négociez différenciez signifiez justifiez modifiez spécifiez simplifiez clarifiez rectifiez notifiez planifiez'.split(' ').filter((w) => !w.endsWith('?')));
// -rer verbs written -rez in the present (otherwise -rez is the future)
const PRES_REZ = new Set(`respirez inspirez expirez soupirez aspirez tirez retirez admirez désirez virez conspirez transpirez entrez rentrez montrez démontrez concentrez
  rencontrez contrez illustrez enregistrez administrez ouvrez couvrez découvrez recouvrez livrez délivrez offrez souffrez vibrez calibrez sacrez massacrez consacrez`.split(/\s+/));
const DRE = new Set('attendez entendez perdez répondez vendez rendez descendez défendez tendez prétendez suspendez confondez correspondez dépendez étendez détendez fondez mordez tordez pondez'.split(' '));
const TTRE = new Set('mettez permettez promettez admettez remettez soumettez commettez transmettez émettez battez combattez abattez omettez'.split(' '));
const IGNRE = new Set('craignez joignez rejoignez éteignez atteignez plaignez peignez'.split(' '));
const NOT_VERB = new Set('chez assez nez rez rodriguez lopez perez hernandez gonzalez martinez sanchez gomez fernandez suarez alvarez ramirez jimenez'.split(' '));
const EXC_ISSEZ = new Set('laissez baissez froissez glissez hissez plissez lissez tissez vissez bissez délaissez rabaissez abaissez'.split(' '));
const EXC_UISEZ = new Set('épuisez puisez'.split(' '));

// returns the 2nd person singular of a 2nd person plural verb form, or null when the word is not one
function conv(raw, mode) {
  const f = raw.toLowerCase();
  if (NOT_VERB.has(f) || !(IRR[f] || IMP_IRR[f] || /ez$/.test(f))) return null;
  if (mode === 'imp' && IMP_IRR[f]) return IMP_IRR[f];
  if (mode === 'subj' && SUBJ_IRR[f]) return SUBJ_IRR[f];
  if (IRR[f]) return mode === 'imp' && ER_IRR.has(f) ? IRR[f].slice(0, -1) : IRR[f];
  if (f.endsWith('iez')) {
    if (IER.has(f)) return f.slice(0, -3) + (mode === 'imp' ? 'ie' : 'ies');
    if (mode === 'subj') return f.slice(0, -3) + 'es';
    return f.slice(0, -3) + 'ais';                                  // imperfect and conditional
  }
  const er = (stem) => stem + (mode === 'imp' ? 'e' : 'es');
  const base = f.slice(0, -2);
  if (/rez$/.test(f)) {
    const present = PRES_REZ.has(f) || /érez$/.test(f) || (/[aou]rez$/.test(f) && !/aurez$/.test(f) && !/rrez$/.test(f));
    if (!present) return base + 'as';                               // future
  }
  if (DRE.has(f)) return base + 's';
  if (TTRE.has(f)) return f.slice(0, -4) + 'ts';
  if (IGNRE.has(f)) return f.slice(0, -4) + 'ns';
  if (/uisez$/.test(f) && !EXC_UISEZ.has(f)) return f.slice(0, -3) + 's';
  if (/issez$/.test(f) && !EXC_ISSEZ.has(f) && !/(?:a|o)issez$/.test(f)) return f.slice(0, -4) + 's';
  if (/yez$/.test(f)) return f.slice(0, -3) + (mode === 'imp' ? 'ie' : 'ies');
  const acc = /^(.*)é([^aeiouyéèêàùîôûâïëü\s]{1,2})ez$/.exec(f);
  if (acc) return er(`${acc[1]}è${acc[2]}`);
  return er(base);
}

// verbs that are really used as a reflexive imperative with -vous (Rassurez-vous, Souvenez-vous): -toi; the others are questions: -tu
const IMP_REFL = new Set('rassurez souvenez dites asseyez détendez reposez calmez levez couchez préparez habillez dépêchez excusez méfiez rappelez laissez mettez relaxez amusez régalez concentrez imaginez figurez tenez réveillez lavez occupez soignez protégez ménagez accordez autorisez permettez offrez donnez faites félicitez pardonnez fiez sentez'.split(' '));
const SUBJ_TRIGGER = /(?:il faut|faut que|pour que|afin que|bien que|avant que|jusqu['’]à ce que|sans que|(?:veux|veut|souhaite|souhaites|aimerais|voudrais|voudrait|aimerait|préfère|préfères|exige|attends|demande|désire|souhaiterais|aime) que|il vaut mieux que|à condition que|quoique|pourvu que|(?:peur|crains|doute|doutes|regrette|regrettes|content|heureux|désolé|ravi|important|possible|normal|essentiel|nécessaire|dommage|étonnant) que|il se peut que|quoi que|qui que)/i;
function isSubjCtx(text, idx) {
  const left = text.slice(0, idx), k = Math.max(left.lastIndexOf('.'), left.lastIndexOf('!'), left.lastIndexOf('?'), left.lastIndexOf(';'));
  return SUBJ_TRIGGER.test(left.slice(k + 1));
}
const endsWithQuestion = (text, from) => { const m = /[.!?…]/.exec(text.slice(from)); return !!m && m[0] === '?'; };
const PREPS = new Set('à avec pour sans chez de d par sur sous devant derrière contre vers entre près loin grâce auprès parmi selon malgré depuis dans comme et ou ni même aussi c ce voici voilà merci plus que qu moins autant'.split(' '));
const SUBJ_CONJ = new Set('et mais ou que qu si quand lorsque puisque comme où alors donc'.split(' '));
const STRESS_NEXT = new Set('aussi même seul seule non plus tous toutes mêmes'.split(' '));
const ELIDE_VOWEL = /^[aeiouyâàäéèêëîïôöûüœh]/i;

function tutoie(text, hits) {
  let t = text;
  const count = (n = 1) => { for (let i = 0; i < n; i++) hits.push('tu'); };
  // 1. "vous-même"
  t = t.replace(mk('vous-mêmes?'), (m) => { count(); return keepCase(m, 'toi-même'); });
  // 2. inversion and reflexive imperative written with a hyphen: Saviez-vous / Rassurez-vous / Dites-vous
  t = t.replace(new RegExp(`(?<![${LET}])([${LET}]+)-vous(?![${LET}-])`, 'giu'), (m, v, off, str) => {
    if (/^rendez$/i.test(v)) return m;                                  // the noun "rendez-vous"
    const imperative = !endsWithQuestion(str, off + m.length) && IMP_REFL.has(v.toLowerCase());
    const q = !imperative;
    const c = conv(v, q ? 'pres' : 'imp');
    if (!c) return m;
    count();
    return `${keepCase(v, c)}-${q ? 'tu' : 'toi'}`;
  });
  // 3. imperative with a pronoun after it: Dites-moi / Allez-y / Laissez-moi
  t = t.replace(new RegExp(`(?<![${LET}])([${LET}]+)-(moi|le|la|les|lui|leur|nous|y|en)(?![${LET}-])`, 'giu'), (m, v, p) => {
    let c = conv(v, 'imp'); if (!c) return m;
    if (/^(y|en)$/i.test(p) && /[ea]$/.test(c) && !/^(?:es|ai|as)$/.test(c)) c = c === 'va' ? 'vas' : c + 's';
    count(); return `${keepCase(v, c)}-${p}`;
  });
  // 4. negative imperative: "ne vous inquiétez pas" -> "ne t'inquiète pas"
  t = t.replace(new RegExp(`(?<![${LET}])(ne\\s+|n['’])vous\\s+((?:(?:en|y|le|la|les|me|lui|leur|nous)\\s+)*)([${LET}]+)`, 'giu'), (m, ne, cl, v) => {
    const c = conv(v, 'imp'); if (!c) return m;
    count(); return `${ne}te ${cl}${keepCase(v, c)}`;
  });
  // 4b. negative imperative without a pronoun: "Ne soyez pas si fort", "n'oubliez jamais" (the subject forms were already changed in step 5 below, so run after it)
  // 5. subject: "vous êtes", "vous ne savez pas", "vous vous sentirez"
  t = t.replace(new RegExp(`(?<![${LET}])(vous)\\s+((?:(?:ne|vous|me|le|la|les|y|en|lui|leur|nous|se)\\s+|(?:n|m|l|s)['’]){0,4})([${LET}]+)`, 'giu'), (m, v, cl, verb, off, str) => {
    const prev = /([\p{L}’']+)\s*$/u.exec(str.slice(0, off));
    const afterQue = prev && /^(que|qu['’]?)$/i.test(prev[1]);
    const mode = afterQue && isSubjCtx(str, off) ? 'subj' : 'pres';
    const c = conv(verb, mode); if (!c) return m;
    count();
    return `${keepCase(v, 'tu')} ${cl.replace(/(?<![\p{L}])vous(?![\p{L}])/giu, 'te')}${keepCase(verb, c)}`.replace('  ', ' ');
  });
  t = t.replace(new RegExp(`(?<![${LET}])(ne\\s+|n['’])([${LET}]+)(?=\\s+(?:pas|jamais|plus|rien|point|guère)(?![${LET}]))`, 'giu'), (m, ne, v) => {
    const c = conv(v, 'imp'); if (!c) return m;
    count(); return `${ne}${keepCase(v, c)}`;
  });
  // 6. imperative at the start of a clause: "Prenez le temps", "Venez vous blottir"
  t = t.replace(new RegExp(`(^|\\n|[.!?;:,—(«"“]\\s*|(?<![${LET}])(?:et|mais|puis|alors|donc|ou)\\s+)([${LET}]+)(?=[\\s,.!?;:]|$)`, 'giu'), (m, lead, w, off, str) => {
    const low = w.toLowerCase();
    if (low === 'allez' && /^\s*,/.test(str.slice(off + m.length))) return m;     // "Allez, ..." stays as it is
    const c = conv(w, 'imp'); if (!c) return m;
    count(); return `${lead}${keepCase(w, c)}`;
  });
  // 7. possessives
  t = t.replace(new RegExp(`(?<![${LET}])votre\\s+([${LET}’']+)`, 'giu'), (m, n) => {
    const w = n.toLowerCase();
    const fem = ELIDE_VOWEL.test(w) ? false : (FEM_NOUNS.has(w) || Object.values(ADJ).includes(w) || (FEM_ENDINGS.test(w) && !MASC_EXCEPT.has(w)));
    count(); return `${keepCase(m, fem ? 'ta' : 'ton')} ${n}`;
  });
  t = t.replace(mk('vos'), (m) => { count(); return keepCase(m, 'tes'); });
  t = t.replace(mk('la vôtre'), (m) => { count(); return keepCase(m, 'la tienne'); });
  t = t.replace(mk('le vôtre'), (m) => { count(); return keepCase(m, 'le tien'); });
  t = t.replace(mk('les vôtres'), (m) => { count(); return keepCase(m, 'les tiens'); });
  // 8. every "vous" that is left: object (te), stressed (toi) or subject (tu)
  t = t.replace(new RegExp(`(?<![${LET}-])vous(?![${LET}-])`, 'giu'), (m, off, str) => {
    const left = str.slice(0, off), right = str.slice(off + m.length);
    const prev = (/([\p{L}]+)['’]?\s*$/u.exec(left) || [])[1];
    const pw = prev ? prev.toLowerCase() : '';
    const next = (/^\s*([\p{L}]+)/u.exec(right) || [])[1];
    const nw = next ? next.toLowerCase() : '';
    const punctNext = /^\s*(?:[.,!?;:)…»"”]|$)/.test(right);
    const startOfClause = !prev || /[.!?;:(«"“]\s*$/.test(left);
    let r;
    if (startOfClause) r = punctNext ? 'toi' : 'tu';
    else if (PREPS.has(pw) && !SUBJ_CONJ.has(pw)) r = /^[\p{L}]{2,}(?:er|ir|re|oir)$/u.test(nw) ? 'te' : 'toi';
    else if (punctNext || STRESS_NEXT.has(nw)) r = 'toi';
    else if (SUBJ_CONJ.has(pw) && next && !/^[\p{L}]+(?:er|ir|re|oir)$/u.test(nw) && /ez$|s$|t$/.test(nw)) r = 'tu';
    else r = 'te';
    count(); return keepCase(m, r);
  });
  // 9. elision: "te inquiètes" -> "t'inquiètes"
  t = t.replace(new RegExp(`(?<![${LET}])([Tt])e\\s+(?=[aeiouyâàäéèêëîïôöûüœ]|h[aeiouyâàäéèêëîïôöûüœ])`, 'gu'), "$1'");
  return t;
}

// ---------------------------------------------------------------------------------------------------------------------------
// French: gender of the adjectives that describe the reader ("tu es occupé" -> "tu es occupée") or the writer ("je suis fatigué")
// ---------------------------------------------------------------------------------------------------------------------------
const ADV = '(?:très|si|trop|vraiment|bien|toujours|déjà|encore|tellement|complètement|un peu|aussi|plus|moins|assez|totalement|tout à fait)';
const adjForms = (() => {
  const m = new Map();
  for (const [masc, fem] of Object.entries(ADJ)) { m.set(masc, fem); if (!/[sx]$/.test(masc)) m.set(`${masc}s`, fem); }
  return m;
})();
const ADJ_ALT = [...adjForms.keys()].sort((a, b) => b.length - a.length).join('|');
function genderFix(text, ctx, hits) {
  let t = text;
  const fix = (adj) => { const f = adjForms.get(adj.toLowerCase()); return f ? keepCase(adj, f) : adj; };
  const feminize = (re, groupAdj) => {
    t = t.replace(re, (...a) => {
      const m = a[0], adj = a[groupAdj];
      const f = fix(adj);
      if (f.toLowerCase() === adj.toLowerCase()) return m;
      hits.push('gender');
      return m.slice(0, m.length - adj.length) + f;
    });
  };
  const VR = '(?:es|étais|seras|serais|restes|resteras|restais|deviens|deviendras|parais|sembles|te sens|te sentais|te sentiras|te sentirais|te rends|te réveilles|te réveillais|te réveilleras|te réveillerais|te lèves|te lèveras|dormiras|as l[\'’]air|auras l[\'’]air|as été|avais été)';
  if (ctx.reader === 'woman') {
    feminize(new RegExp(`(?<![${LET}])tu\\s+${VR}\\s+(?:${ADV}\\s+)*(${ADJ_ALT})(?![${LET}])`, 'giu'), 1);
    feminize(new RegExp(`(?<![${LET}])tu\\s+(?:ne\\s+)?(?:devrais|dois|peux|pourrais|veux|voudrais|vas|dois|devras|pourras)\\s+(?:pas\\s+)?(?:être|te sentir|rester)\\s+(?:${ADV}\\s+)*(${ADJ_ALT})(?![${LET}])`, 'giu'), 1);
    feminize(new RegExp(`(?<![${LET}])${VR}-tu\\s+(?:${ADV}\\s+)*(${ADJ_ALT})(?![${LET}])`, 'giu'), 1);
    feminize(new RegExp(`(?<![${LET}])(?:sois|reste|deviens|sens-toi)(?:\\s+pas)?\\s+(?:${ADV}\\s+)*(${ADJ_ALT})(?![${LET}])`, 'giu'), 1);          // imperatives: "sois content"
    feminize(new RegExp(`(?<![${LET}])(?:ne\\s+(?:te\\s+)?)(?:sois|reste)\\s+pas\\s+(?:${ADV}\\s+)*(${ADJ_ALT})(?![${LET}])`, 'giu'), 1);     // "ne sois pas si fort"`
  }
  if (ctx.writer === 'woman') {
    feminize(new RegExp(`(?<![${LET}])(?:je|j['’])\\s*(?:suis|étais|serai|serais|me sens|me sentais|me sentirai|reste|restais|resterai|deviens|ai été|avais été)\\s+(?:${ADV}\\s+)*(${ADJ_ALT})(?![${LET}])`, 'giu'), 1);
  }
  return t;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Words that must come through untouched (greetings and affectionate words from the two people's own languages and culture).
// Bergamot does not know them and sometimes invents a word (it turned "Oklm" into "Royaume"). They are swapped for common first names,
// which every translation engine copies, and swapped back afterwards. If a name does not come back, the translation is redone without it.
// ---------------------------------------------------------------------------------------------------------------------------
const PROTECT = mk(["assalam(?:u|o)?\\s*(?:o|u|w)?\\s*(?:alaikum|alaykum|aelaikum|alaikom)", "as-salamu alaykum", "wa\\s*(?:alaikum|alaykum)\\s*(?:us)?\\s*salam", "walaikum\\s*(?:us)?salam", "salam alaikum", "salam",
  "in\\s*sha\\s*allah", "insha['’]?allah", "inshallah", "masha['’]?allah", "mashallah", "alhamdulillah", "subhanallah", "astaghfirullah", "jazak(?:a)?\\s*allah(?:\\s*khair)?", "barakallah(?:\\s*feek)?",
  "bismillah", "wallahi", "ya allah", "ameen", "habibi", "habibti", "ya\\s*habib[it]+", "ya\\s*n[ou]+r\\s*[ae]yni", "ya\\s*r[ou]+hi", "ya\\s*albi", "ya\\s*qalbi", "sakina", "iftar", "suhoor", "eid mubarak", "jumu['’]?ah mubarak", "ramadan (?:kareem|mubarak)", "shukran"].join('|'));
const NAME_POOL = ['Clara', 'Bruno', 'Alice', 'David', 'Elena', 'Franck', 'Gloria', 'Hugo'];
export function protect(text) {
  const taken = new Set(NAME_POOL.filter((n) => new RegExp(`(?<![${LET}])${n}(?![${LET}])`, 'i').test(text)));
  const pool = NAME_POOL.filter((n) => !taken.has(n));
  const map = [], byWord = new Map();
  const out = text.replace(PROTECT, (m) => {
    const key = m.toLowerCase().replace(/\s+/g, ' ');
    if (byWord.has(key)) return byWord.get(key);
    const name = pool[map.length];
    if (!name) return m;                                   // more terms than names: leave the rest as they are
    map.push({ name, original: m }); byWord.set(key, name); return name;
  });
  return { text: out, map };
}
const countOf = (s, w) => (s.match(new RegExp(`(?<![${LET}])${w}(?![${LET}])`, 'g')) || []).length;
const hasAll = (out, map) => map.every((x) => countOf(out, x.name) >= 1);
const restore = (out, map) => map.reduce((t, x) => t.replace(new RegExp(`(?<![${LET}])${x.name}(?![${LET}])`, 'g'), x.original), out);

// French typography: a space before ? ! ; when it is missing ("Pourquoi?" -> "Pourquoi ?")
function frSpacing(text, hits) {
  const t = text.replace(new RegExp(`([${LET}\\)”»])([?!;])(?=\\s|$)`, 'gu'), (m, a, p) => { hits.push('spacing'); return `${a} ${p}`; });
  return t;
}

export function preEdit(text, lang) {
  const hits = [];
  try {
    let out = applyTable(text, lang === 'fr' ? FR_PRE : EN_PRE, hits);
    if (hits.length && lang === 'fr') out = out.replace(/(?<![\p{L}])([Dd])e (?=[aeiouyéèêàâîôû])/gu, "$1'");
    return { text: out, hits, changed: out !== text };
  } catch (e) { return { text, hits: [], changed: false, error: String(e && e.message) }; }
}
export function postEdit(text, lang, ctx = {}) {
  const hits = [];
  try {
    let out = text;
    if (lang === 'fr') {
      out = tutoie(out, hits);
      out = applyTable(out, FR_POST, hits);
      out = genderFix(out, ctx, hits);
      out = frSpacing(out, hits);
    } else {
      out = applyTable(out, EN_POST, hits);
    }
    return { text: out, hits, changed: out !== text };
  } catch (e) { return { text, hits: [], changed: false, error: String(e && e.message) }; }
}
// "tu×4 · idiom: hit the nail on the head"
export function summarize(hits) {
  const n = new Map();
  for (const h of hits) n.set(h, (n.get(h) || 0) + 1);
  return [...n].map(([h, c]) => (c > 1 ? `${h}×${c}` : h)).join(' · ');
}

// The whole step for one message. run(text, from, to) -> Promise<{ text, ms }> is Bergamot.
// Returns { draft, text, msBergamot, msRules, hits, changed }: draft = Bergamot on the sender's own text (what version 1 gives).
// If anything in the rules fails, the draft is returned and the failure is noted: the rules can never break a translation.
export async function translateWithRules(run, text, from, to, ctx = {}) {
  const d0 = await run(text, from, to);
  let ms = d0.ms || 0;
  const hits = [];
  try {
    const r0 = performance.now();
    const pre = preEdit(text, from); hits.push(...pre.hits);
    const prot = protect(pre.text);
    let d = d0;
    if (pre.changed || prot.map.length) {
      d = await run(prot.text, from, to); ms += d.ms || 0;
      if (!hasAll(d.text, prot.map)) {                       // a protected word did not survive: translate again without protecting it
        hits.push('protect: fallback');
        d = pre.changed ? await run(pre.text, from, to) : d0;
        if (pre.changed) ms += d.ms || 0;
        prot.map.length = 0;
      } else if (prot.map.length) hits.push(`protected×${prot.map.length}`);
    }
    const post = postEdit(d.text, to, ctx); hits.push(...post.hits);
    const final = restore(post.text, prot.map);
    const msRules = Math.max(1, Math.round(performance.now() - r0 - (ms - (d0.ms || 0))));
    return { draft: d0.text, text: final, msBergamot: ms, msRules, hits, changed: final !== d0.text };
  } catch (e) {
    return { draft: d0.text, text: d0.text, msBergamot: ms, msRules: 1, hits: ['rules error: ' + String(e && e.message).slice(0, 80)], changed: false };
  }
}
export const __test = { conv, tutoie, genderFix, protect, restore };
