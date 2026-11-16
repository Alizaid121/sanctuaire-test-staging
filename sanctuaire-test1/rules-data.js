/* Sanctuaire Test 1 version 2: the word lists of the rules step. EXTEND THIS FILE from the test results (Awkward / Wrong sentences).
   Every entry: [ label, pattern (regular expression source, case-insensitive), replacement ].
   The replacement may use $1, $2 ... for the parts of the pattern in brackets.
   PRE lists run on the sender's text BEFORE Bergamot translates: an idiom or a slang word is replaced by plain wording of the same
   language, so that the engine translates the meaning and not the words (the sender's own text is never changed).
   POST lists run on Bergamot's output: they repair literal translations that were seen in the tests. */

// ---------- English text, before translating into French ----------
export const EN_PRE = [
  // spelling slips and texting words
  ['typo: everytime', 'everytime', 'every time'],
  ['typo: agree anymore', "couldn['’]?t agree (?:any ?more|anymore)", "couldn't agree more"],
  ['typo: alot', 'alot', 'a lot'],
  ['text: u', 'u', 'you'],
  ['text: pls', 'plz|pls|plse', 'please'],
  ['text: thx', 'thx|thnx', 'thanks'],
  ['text: ty', 'ty', 'thank you'],
  ['text: np', 'np', 'no problem'],
  ['text: idk', 'idk', "I don't know"],
  ['text: btw', 'btw', 'by the way'],
  ['text: imo', 'imo', 'in my opinion'],
  ['text: tbh', 'tbh', 'to be honest'],
  ['text: brb', 'brb', 'I will be right back'],
  ['text: omg', 'omg', 'oh my goodness'],
  ['text: gn', 'gn', 'good night'],
  ['text: gm', 'gm', 'good morning'],
  ['text: ily', 'ily', 'I love you'],
  ['text: lol', 'lol', 'haha'],
  // idioms and sayings, replaced by plain wording
  ['idiom: hit the nail on the head', "(you|he|she|they|we|i)(?:['’]ve| have| had)? hit(?:s)? the nail on the head", (m, who) => `${who} ${/^(he|she)$/i.test(who) ? 'is' : /^i$/i.test(who) ? 'am' : 'are'} exactly right`],
  ['idiom: hit the nail on the head', 'hit(?:s|ting)? the nail on the head', 'be exactly right'],
  ['idiom: two birds with one stone', '(kill|hit)(s|ed|ting|ing)? two birds with (?:one|a) stone', (m, v, f) => ({ s: 'solves two problems with one action', ed: 'solved two problems with one action', ing: 'solving two problems with one action', ting: 'solving two problems with one action' })[(f || '').toLowerCase()] || (/^hit$/i.test(v) ? 'solved two problems with one action' : 'solve two problems with one action')],
  ['idiom: piece of cake', "(?:a )?piece of cake", 'very easy'],
  ['idiom: under the weather', 'under the weather', 'slightly ill'],
  ['idiom: break the ice', 'break(?:ing)? the ice', 'start a conversation'],
  ['idiom: spill the beans', 'spill(?:ed|ing|s)? the beans', 'reveal the secret'],
  ['idiom: let the cat out of the bag', 'let(?:ting|s)? the cat out of the bag', 'reveal the secret'],
  ['idiom: once in a blue moon', 'once in a blue moon', 'very rarely'],
  ['idiom: arm and a leg', 'an arm and a leg', 'a lot of money'],
  ['idiom: beat around the bush', 'beat(?:ing|s)? around the bush', 'avoid the main point'],
  ['idiom: on cloud nine', 'on cloud (?:nine|9)', 'extremely happy'],
  ['idiom: over the moon', 'over the moon', 'extremely happy'],
  ['idiom: head over heels', 'head over heels', 'completely in love'],
  ['idiom: butterflies in my stomach', 'butterflies in (?:my|your|the) stomach', 'nervous excitement'],
  ['idiom: apple of my eye', 'the apple of my eye', 'the person I cherish most'],
  ['idiom: pull your leg', 'pull(?:ing|s|ed)? (?:your|his|her|my) leg', 'tease you'],
  ['idiom: cold feet', '(?:get|got|getting|have|had) cold feet', 'become afraid at the last moment'],
  ['idiom: bite the bullet', 'bite(?:s)? the bullet', 'accept something unpleasant'],
  ['idiom: not rocket science', "(?:it|that)(?:['’]s| is) not rocket science", 'it is not difficult'],
  ['idiom: same boat', 'in the same boat', 'in the same situation'],
  ['idiom: same page', 'on the same page', 'in agreement'],
  ['idiom: call it a day', 'call(?:ing)? it a day', 'stop for today'],
  ['idiom: hit the sack', 'hit(?:ting)? the (?:sack|hay)', 'go to bed'],
  ['idiom: cut me some slack', 'cut me some slack', 'be patient with me'],
  ['idiom: take it easy', 'take it easy', 'relax'],
  ['idiom: hang in there', 'hang in there', 'do not give up'],
  ['idiom: chin up', 'chin up', 'cheer up'],
  ['idiom: all ears', "i['’]?m all ears", 'I am listening carefully'],
  ['idiom: made my day', 'made my day', 'made me very happy'],
  ['idiom: dying to', "(?:i['’]?m|i am) dying to", 'I really want to'],
  ['idiom: means the world', '(?:feels?|is) like (?:the )?world to me', 'means the world to me'],
  ['wording: take rest', 'take (?:a )?rest', 'get some rest'],
];

// ---------- French text, before translating into English ----------
export const FR_PRE = [
  // texting and slang
  ['slang: tkt', 'tkt|tqt', "ne t'inquiète pas"],
  ['slang: oklm', 'oklm', 'tout va bien, je me détends'],
  ['slang: mdr', 'mdr', 'haha'],
  ['slang: ptdr', 'ptdr', 'hahaha'],
  ['slang: jsp', 'jsp', 'je ne sais pas'],
  ['slang: jpp', 'jpp', "je n'en peux plus"],
  ['slang: stp', 'stp', "s'il te plaît"],
  ['slang: svp', 'svp', "s'il vous plaît"],
  ['slang: bcp', 'bcp', 'beaucoup'],
  ['slang: pk', 'pk|pq', 'pourquoi'],
  ['slang: qd', 'qd', 'quand'],
  ['slang: tjs', 'tjs|tjr', 'toujours'],
  ['slang: bjr', 'bjr', 'bonjour'],
  ['slang: bsr', 'bsr', 'bonsoir'],
  ['slang: slt', 'slt', 'salut'],
  ['slang: cc', 'cc', 'coucou'],
  ['slang: jtm', 'jtm', "je t'aime"],
  ['slang: nn', 'nn', 'non'],
  ['slang: dsl', 'dsl', 'désolé'],
  ['slang: rdv', 'rdv', 'rendez-vous'],
  ['slang: mtn', 'mtn|mnt', 'maintenant'],
  ['slang: vrmt', 'vrmt', 'vraiment'],
  ['slang: dmn', 'dmn', 'demain'],
  ['slang: tfk', 'tfk', "qu'est-ce que tu fais"],
  ['slang: koi', 'koi', 'quoi'],
  ['slang: ptn', 'ptn(?: de)?', 'zut'],
  ['slang: kiffer', 'je kiff(?:e|é)', "j'adore"],
  ['slang: kiffer', 'tu kiff(?:es)', 'tu adores'],
  ['slang: kiffer', 'kiffer', 'adorer'],
  ['slang: ouf', "c['’]est ouf", "c'est incroyable"],
  ['slang: la flemme', "j['’]ai la flemme", "je n'ai pas envie"],
  ['slang: la flemme', "tu as la flemme", "tu n'as pas envie"],
  ['slang: la flemme', "avoir la flemme", "ne pas avoir envie"],
  ['slang: la pêche', "(j['’]ai|tu as|il a|elle a) la pêche", '$1 beaucoup d’énergie'],
  ['slang: la banane', "(j['’]ai|tu as|il a|elle a) la banane", '$1 le sourire'],
  ['slang: crevé', 'crevé(e?s?)', 'très fatigué$1'],
  ['slang: claqué', 'claqué(e?s?)', 'très fatigué$1'],
  ['slang: bosser', 'boss(?:er)', 'travailler'],
  ['slang: bouquin', 'bouquin(s?)', 'livre$1'],
  ['slang: fric', 'fric', 'argent'],
  ['slang: galérer', 'je galère', "j'ai des difficultés"],
  ['slang: galérer', 'tu galères', 'tu as des difficultés'],
  // typo seen in the tests
  ['typo: rigoter', 'rigoter', 'rigoler'],
  // idioms and sayings, replaced by plain French
  ['idiom: n’importe quoi', "^(\\s*)n['’]importe quoi(\\s*[!?.]*\\s*)$", "$1C'est absurde$2"],
  ['idiom: c’est n’importe quoi', "c['’]est n['’]importe quoi", "c'est absurde"],
  ['idiom: un chat dans la gorge', "(avoir|ai|as|a|avons|avez|ont|avait|avais|aurai|aura|aurais|aurait) un chat dans la gorge", '$1 la voix enrouée'],
  ['idiom: tomber dans les pommes', "(?:tomber) dans les pommes", "perdre connaissance"],
  ['idiom: tomber dans les pommes', "(je|tu|il|elle|on) tomb(?:e|es) dans les pommes", (m, who) => `${who} ${({ je: 'perds', tu: 'perds', il: 'perd', elle: 'perd', on: 'perd' })[who.toLowerCase()]} connaissance`],
  ['idiom: tomber dans les pommes', "(je|tu|il|elle|on|nous) (?:suis|es|est|sommes) tombé(?:e|s|es)? dans les pommes", (m, who) => ({ je: "j'ai", tu: 'tu as', il: 'il a', elle: 'elle a', on: 'on a', nous: 'nous avons' })[who.toLowerCase()] + ' perdu connaissance'],
  ['idiom: chercher des noises', '(cherch(?:er|e|es|ent|ais|ait|aient|ez|ons))(?: des)? noises', '$1 querelle'],
  ['idiom: faire son malin', 'faire (ton|son|mon|notre|leur|votre) malin', (m, p) => `${({ ton: 'te', son: 'se', mon: 'me', notre: 'nous', leur: 'se', votre: 'vous' })[p.toLowerCase()]} vanter`],
  ['idiom: faire le malin', 'fai(s|t|sons|tes|sent) (?:ton|son|mon|notre|leur|votre) malin', (m, f) => ({ s: 'te vantes', t: 'se vante', sons: 'nous vantons', tes: 'vous vantez', sent: 'se vantent' })[f.toLowerCase()]],
  ['idiom: tourner autour du pot', "(de |d['’])?tourn(er|e|es|ent|ons|ez) autour du pot", (m, de, f) => { const v = ({ er: 'éviter', e: 'évite', es: 'évites', ent: 'évitent', ons: 'évitons', ez: 'évitez' })[f.toLowerCase()]; return `${de ? (f.toLowerCase() === 'er' ? "d'" : de) : ''}${v} le sujet principal`; }],
  ['idiom: redescendre sur terre', 'redescend(s|re|ez)? sur terre', (m, f) => (f && f.toLowerCase() === 're' ? 'redevenir réaliste' : f && f.toLowerCase() === 'ez' ? 'soyez réaliste' : 'sois réaliste')],
  ['idiom: se prendre la tête', "(te|me|se|nous|vous) prend(?:s|ons|ez)? ((?:beaucoup |trop |bien |tellement |vraiment |encore )*)la tête", (m, p, adv) => `${p} ${({ te: 'tracasses', me: 'tracasse', se: 'tracasse', nous: 'tracassons', vous: 'tracassez' })[p.toLowerCase()]} ${adv}`.trim()],
  ['idiom: se prendre la tête', "(te|me|se|nous|vous) prendre ((?:beaucoup |trop |bien |tellement |vraiment )*)la tête", (m, p, adv) => `${p} tracasser ${adv}`.trim()],
  ['idiom: casser les pieds', "(me|te|nous|lui|leur) cass(e|es|ent|ons|ez|ais|ait|aient) les pieds", (m, p, f) => { const v = ({ e: 'ennuie', es: 'ennuies', ent: 'ennuient', ons: 'ennuyons', ez: 'ennuyez', ais: 'ennuyais', ait: 'ennuyait', aient: 'ennuyaient' })[f.toLowerCase()]; return /^(me|te)$/i.test(p) ? `${p[0]}'${v}` : `${p} ${v}`; }],
  ['idiom: poser un lapin', 'pos(?:er|e|es|é|ée)? un lapin', "ne pas venir au rendez-vous"],
  ['idiom: avoir le cafard', "(avoir|ai|as|a|avons|avez|ont) le cafard", '$1 de la tristesse'],
  ['idiom: ça roule', 'ça roule', 'ça va bien'],
  ['idiom: du gâteau', "c['’]est du gâteau", "c'est très facile"],
  ['idiom: être dans la lune', "(?:suis|es|est|être) dans la lune", 'suis distrait'],
  ['idiom: ras-le-bol', "ras[- ]le[- ]bol", "j'en ai assez"],
];

// ---------- French text produced by Bergamot, repairs of literal translations ----------
export const FR_POST = [
  ['literal: ma fille folle', 'ma fille folle', 'ma petite folle'],
  ['literal: fille folle', 'fille folle', 'folle'],
  ['literal: clou sur la tête', '(ai|as|a|avons|avez|ont) frappé le clou sur la tête', '$1 vu juste'],
  ['literal: deux oiseaux', '(ai|as|a|avons|avez|ont) frappé deux oiseaux avec une pierre', "$1 fait d'une pierre deux coups"],
  ['literal: câlin chaud', "(?:un|le) câlin chaud", 'un câlin chaleureux'],
  ['literal: le monde', 'signifie le monde pour', 'représente tout pour'],
  ['literal: me ressemble à du monde', "ressemble à du monde", 'représente tout'],
  ['literal: prendre le repos', 'prendre le repos', 'te reposer'],
];

// ---------- English text produced by Bergamot, repairs ----------
export const EN_POST = [
  ['literal: Anything! Anything!', '^\\s*anything!\\s*anything!\\s*$', "That's absurd!"],
  ['literal: cat in the throat', 'a cat in (?:your|my|his|her) throat', 'a hoarse voice'],
  ['literal: falling into the apples', 'falling into the apples', 'passing out'],
];

// ---------- French words used to fix the grammatical gender ----------
// Feminine nouns (for "ton / ta"): the list is not complete, the endings below it cover most of the rest.
export const FEM_NOUNS = new Set(('famille journée vie tête fatigue énergie présence voix main force patience peine douleur peur joie tristesse colère' +
  ' paix tranquillité proximité distance nuit matinée soirée semaine fille femme amie sœur mère maison chambre porte table chose idée pensée parole' +
  ' réponse question histoire vérité confiance chance santé forme humeur envie faim soif respiration maladie guérison classe école étude révision' +
  ' tâche journée équipe affaire décision situation solution mission carte lettre photo musique chanson voiture route ville rue pièce place ' +
  'lumière étoile lune terre mer eau pluie tempête vague force fierté bonté douceur gentillesse beauté sagesse foi prière âme mémoire peau main jambe épaule' +
  ' bouche oreille joue lèvre dent barbe vue vitesse attention amitié affection attente absence réaction réflexion vigueur ardeur odeur chaleur' +
  ' compagnie solitude liberté sécurité sûreté habitude tendresse ' + 'peine fatigue').split(/\s+/));
export const FEM_ENDINGS = /(?:tion|sion|té|tié|ée|ie|ure|ance|ence|ette|ine|ise|esse|ude|ade|aine|ière|eur(?=s$)|ique|ose|ague|ille|elle|ole|ule)$/i;
export const MASC_EXCEPT = new Set('musée lycée trophée mausolée squelette pétrole été café thé comité côté carnet bonté'.split(' ').filter((w) => w !== 'bonté'));

// Adjectives and participles that change with the gender of the person they describe (masculine singular -> feminine singular).
export const ADJ = {
  occupé: 'occupée', fatigué: 'fatiguée', content: 'contente', heureux: 'heureuse', prêt: 'prête', détendu: 'détendue', reposé: 'reposée',
  inquiet: 'inquiète', seul: 'seule', fier: 'fière', stressé: 'stressée', perdu: 'perdue', épuisé: 'épuisée', soulagé: 'soulagée', rassuré: 'rassurée',
  ému: 'émue', touché: 'touchée', gêné: 'gênée', désolé: 'désolée', surpris: 'surprise', sûr: 'sûre', serein: 'sereine', bienvenu: 'bienvenue',
  courageux: 'courageuse', fort: 'forte', jaloux: 'jalouse', amoureux: 'amoureuse', ravi: 'ravie', étonné: 'étonnée', fâché: 'fâchée', vexé: 'vexée',
  tombé: 'tombée', parti: 'partie', venu: 'venue', arrivé: 'arrivée', rentré: 'rentrée', resté: 'restée', sorti: 'sortie', né: 'née', allé: 'allée',
  énervé: 'énervée', excité: 'excitée', motivé: 'motivée', déçu: 'déçue', blessé: 'blessée', malheureux: 'malheureuse', paresseux: 'paresseuse',
  nerveux: 'nerveuse', anxieux: 'anxieuse', curieux: 'curieuse', sérieux: 'sérieuse', délicieux: 'délicieuse', adorable: 'adorable', habillé: 'habillée',
  levé: 'levée', couché: 'couchée', réveillé: 'réveillée', endormi: 'endormie', mort: 'morte', petit: 'petite', grand: 'grande', gentil: 'gentille',
  bon: 'bonne', beau: 'belle', nouveau: 'nouvelle', vieux: 'vieille', fou: 'folle', patient: 'patiente', intelligent: 'intelligente', charmant: 'charmante',
  épatant: 'épatante', brillant: 'brillante', confiant: 'confiante', méchant: 'méchante', "rassurant": 'rassurante', fidèle: 'fidèle', libre: 'libre',
};
