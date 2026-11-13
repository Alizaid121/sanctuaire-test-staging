/* Sanctuaire Test 1 v2.2.0: the on-phone language model that fixes Bergamot's draft.
   Model: Gemma 3 270M (instruction-tuned, ONNX, 4-bit) run on the PROCESSOR (WebAssembly), the same path on every phone.
   Nothing typed is ever sent anywhere: only the model files are downloaded (from Hugging Face), once.
   Parts: 1 the downloader that can resume, 2 loading, 3 the "fix the draft" step, 4 stored files (list, delete, save, load). */

export const MODEL = {
  id: 'onnx-community/gemma-3-270m-it-ONNX',
  host: 'https://huggingface.co/',
  dtypes: ['q4', 'q4f16', 'q8'],                 // tried in this order until one exists
  smallFiles: ['config.json', 'generation_config.json', 'tokenizer.json', 'tokenizer_config.json'],
  label: 'Gemma 3 270M (4-bit)',
};
const CACHE_NAME = 'transformers-cache';
const CHUNK = 8 * 1024 * 1024;
const RUNTIME = new URL('./vendor/llm/', import.meta.url).href;

const state = { tf: null, tokenizer: null, model: null, dtype: null, loading: null, lastError: '' };
export const status = () => ({ ready: !!state.model, loading: !!state.loading, dtype: state.dtype, error: state.lastError });

// ---------- 1. a download that survives a lost connection ----------
const IDB = 'sanctuaire-llm-chunks';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('c');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('c', mode), st = tx.objectStore('c');
    let out; try { out = fn(st); } catch (e) { rej(e); return; }
    tx.oncomplete = () => { db.close(); res(out && 'result' in out ? out.result : out); };
    tx.onerror = tx.onabort = () => { db.close(); rej(tx.error); };
  });
}
const idbPut = (k, v) => idbDo('readwrite', (s) => s.put(v, k));
const idbGet = (k) => idbDo('readonly', (s) => s.get(k));
const idbDelPrefix = (prefix) => idbDo('readwrite', (s) => { s.delete(IDBKeyRange.bound(prefix, prefix + '\uffff')); });

let progressCb = null;                                   // set while loading: ({ file, loaded, total, allLoaded })
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function online() { if (navigator.onLine === false) await new Promise((r) => window.addEventListener('online', r, { once: true })); }

async function fetchRange(url, start, end, signal) {
  let lastErr;
  for (let a = 0; a < 6; a++) {
    try {
      await online();
      const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal });
      if (r.status !== 206) throw new Error(`HTTP ${r.status} for a part of the file`);
      return await r.blob();
    } catch (e) { lastErr = e; if (signal && signal.aborted) throw e; await wait(Math.min(1000 * 2 ** a, 15000)); }
  }
  throw lastErr;
}

let doneBytes = 0;                                       // bytes of finished files in this load (for the overall bar)
export async function resumableFetch(input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || String(input);
  const method = (init && init.method) || 'GET';
  const mine = url.startsWith(MODEL.host + MODEL.id + '/resolve/');
  if (!mine || method !== 'GET') return fetch(input, init);
  const name = url.split('/resolve/')[1].split('/').slice(1).join('/');
  let total = 0;
  try {
    const probe = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    const cr = probe.headers.get('content-range');            // "bytes 0-0/12345"
    if (probe.status === 206 && cr && /\/(\d+)$/.test(cr)) total = Number(cr.match(/\/(\d+)$/)[1]);
    try { await probe.arrayBuffer(); } catch { /* ignore */ }
  } catch { total = 0; }
  if (!total || total < CHUNK / 2) {                           // small file, or the server does not support ranges: plain download
    const r = await fetch(url);
    if (progressCb && r.ok) { const n = Number(r.headers.get('content-length')) || 0; doneBytes += n; progressCb({ file: name, loaded: n, total: n, allLoaded: doneBytes }); }
    return r;
  }
  const n = Math.ceil(total / CHUNK), key = (i) => `${url}|${String(i).padStart(5, '0')}`;
  const have = (await idbGet(`${url}|meta`)) || null;
  if (!have || have.total !== total) { await idbDelPrefix(`${url}|`); await idbPut(`${url}|meta`, { total }); }
  const parts = [];
  let loaded = 0;
  for (let i = 0; i < n; i++) {
    let b = await idbGet(key(i));
    if (!b) {
      b = await fetchRange(url, i * CHUNK, Math.min(total, (i + 1) * CHUNK) - 1);
      await idbPut(key(i), b);
    }
    parts.push(b); loaded += b.size;
    if (progressCb) progressCb({ file: name, loaded, total, allLoaded: doneBytes + loaded });
  }
  doneBytes += total;
  const blob = new Blob(parts, { type: 'application/octet-stream' });
  idbDelPrefix(`${url}|`).catch(() => {});
  return new Response(blob, { status: 200, headers: { 'Content-Length': String(total), 'Content-Type': 'application/octet-stream' } });
}

// ---------- 2. loading ----------
async function runtime() {
  if (state.tf) return state.tf;
  const tf = await import('./vendor/llm/transformers.web.min.js');
  const env = tf.env;
  env.allowLocalModels = false; env.allowRemoteModels = true;
  env.useBrowserCache = true; env.cacheKey = CACHE_NAME;
  env.fetch = resumableFetch;
  const w = env.backends && env.backends.onnx && env.backends.onnx.wasm;
  if (!w) throw new Error('The language-model runtime did not start (no WebAssembly settings).');
  w.numThreads = 1;                                       // this site cannot use several threads (no cross-origin isolation)
  w.proxy = false;
  w.wasmPaths = { mjs: RUNTIME + 'ort-wasm-simd-threaded.mjs', wasm: RUNTIME + 'ort-wasm-simd-threaded.wasm' };
  state.tf = tf;
  return tf;
}

// Approximate download size, from the servers' answers to small requests (shown before the download starts).
export async function downloadSize() {
  let files = 0, bytes = 0, unknown = 0;
  const names = [...MODEL.smallFiles, `onnx/model_${MODEL.dtypes[0]}.onnx`, `onnx/model_${MODEL.dtypes[0]}.onnx_data`];
  await Promise.all(names.map(async (f) => {
    try {
      const r = await fetch(`${MODEL.host}${MODEL.id}/resolve/main/${f}`, { method: 'HEAD' });
      if (r.ok) { files++; const n = Number(r.headers.get('content-length')); if (n) bytes += n; else unknown++; }
    } catch { unknown++; }
  }));
  return { files, bytes, unknown };
}

export async function isStored() {
  try {
    const c = await caches.open(CACHE_NAME), keys = await c.keys();
    const mine = keys.map((k) => k.url).filter((u) => u.includes(`/${MODEL.id}/`));
    return mine.some((u) => /\/onnx\/model[^/]*\.onnx$/.test(u)) && mine.some((u) => u.endsWith('/tokenizer.json'));
  } catch { return false; }
}

// opts: { onProgress({ file, loaded, total, allLoaded }), onPhase(text) }
export function load(opts = {}) {
  if (state.model) return Promise.resolve(status());
  if (state.loading) return state.loading;
  state.lastError = '';
  state.loading = (async () => {
    const tf = await runtime();
    progressCb = opts.onProgress || null; doneBytes = 0;
    try {
      if (opts.onPhase) opts.onPhase('tokenizer');
      state.tokenizer = await tf.AutoTokenizer.from_pretrained(MODEL.id);
      let lastErr = null;
      for (const dtype of MODEL.dtypes) {
        try {
          if (opts.onPhase) opts.onPhase('model');
          state.model = await tf.AutoModelForCausalLM.from_pretrained(MODEL.id, { dtype, device: 'wasm' });
          state.dtype = dtype; lastErr = null; break;
        } catch (e) { lastErr = e; if (!/(not find|locate|404|not found)/i.test(String(e && e.message))) break; }
      }
      if (lastErr) throw lastErr;
      if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch { /* ignore */ } }
      return status();
    } catch (e) {
      state.model = null; state.tokenizer = null;
      state.lastError = (e && e.message) || String(e);
      throw e;
    } finally { progressCb = null; state.loading = null; }
  })();
  return state.loading;
}
export async function unload() {
  try { if (state.model && state.model.dispose) await state.model.dispose(); } catch { /* ignore */ }
  state.model = null; state.tokenizer = null; state.dtype = null;
}

// ---------- 3. fix the draft ----------
// writer / reader: 'man' or 'woman' (this app is for one man and one woman: the English speaker is the man).
export function buildPrompt({ text, draft, from, to, writer, reader }) {
  const name = { en: 'English', fr: 'French' };
  const rules = to === 'fr'
    ? [
      'Always address the reader as "tu" (tu, te, ton, ta, tes, toi), never "vous", in every sentence. Imperatives use "tu" too (for example "Viens", "Prends").',
      'Idioms and sayings must be replaced by the natural French equivalent with the same meaning, never translated word for word.',
      `The writer is a ${writer}, the reader is a ${reader}: use the ${reader === 'woman' ? 'feminine' : 'masculine'} form when speaking to the reader (for example "occupée" for a woman) and the ${writer === 'woman' ? 'feminine' : 'masculine'} form for the writer.`,
      'Keep the tone warm and natural, as between two close people. Keep names, nicknames and words such as "sakina" or greetings like "Assalam o alaikum" unchanged.',
    ]
    : [
      'Write natural, warm English as between two close people. Idioms and sayings must be replaced by the natural English equivalent with the same meaning, never translated word for word.',
      'Keep names, nicknames and words such as "sakina" or greetings like "Assalam o alaikum" unchanged. Slang and text abbreviations must be translated by meaning (for example "Tkt" means "Don\'t worry").',
      'Do not repeat words or sentences that are not repeated in the original.',
    ];
  const ex = to === 'fr'
    ? 'Example:\nOriginal (English): You hit the nail on the head, I agree with you.\nDraft translation (French): Vous avez frappé le clou sur la tête, je suis d\'accord avec vous.\nCorrected translation (French): Tu as vu juste, je suis d\'accord avec toi.'
    : 'Example:\nOriginal (French): Tu te prends la tête pour rien, arrête de tourner autour du pot.\nDraft translation (English): You take your head for nothing, stop turning around the pot.\nCorrected translation (English): You are overthinking this for nothing, stop beating around the bush.';
  return [
    `You are a careful ${name[from]}-${name[to]} translation editor for a private chat between two close partners.`,
    `Improve the draft translation from ${name[from]} to ${name[to]}. Keep the meaning exactly. Do not add, remove or explain anything.`,
    'Rules:', ...rules.map((r) => `- ${r}`),
    'Reply with the corrected translation only, nothing else.', '', ex, '',
    `Original (${name[from]}): ${text}`, `Draft translation (${name[to]}): ${draft}`, `Corrected translation (${name[to]}):`,
  ].join('\n');
}

// Cleans what the model wrote. Returns '' when it cannot be trusted (then the draft is kept).
export function cleanOutput(raw, draft) {
  let s = String(raw || '').trim();
  s = s.replace(/^(corrected translation|translation|traduction corrigée|traduction)\s*(\([^)]*\))?\s*:\s*/i, '').trim();
  if (/^["«“].*["»”]$/s.test(s) && !/^["«“]/.test(draft.trim())) s = s.slice(1, -1).trim();
  if (!s) return '';
  const a = s.length, b = Math.max(draft.length, 1);
  if (a < b * 0.4 || a > b * 2.5 + 20) return '';          // far too short or too long: the model went off the task
  if (/^(sure|here is|here's|of course|voici|bien sûr)\b/i.test(s)) return '';
  return s;
}

export function canImprove() { return !!state.model; }
// Returns { text, ms, status } where status is 'improved' | 'unchanged' | 'failed'. handle.cancel() stops it ('skipped' is set by the caller).
export async function improve({ text, draft, from, to, writer, reader, onToken, handle }) {
  if (!state.model) throw new Error('The language model is not ready.');
  const tf = state.tf, tok = state.tokenizer, t0 = performance.now();
  const prompt = buildPrompt({ text, draft, from, to, writer, reader });
  const inputs = tok.apply_chat_template([{ role: 'user', content: prompt }], { add_generation_prompt: true, return_dict: true });
  const inLen = inputs.input_ids.dims.at(-1);
  const stop = tf.InterruptableStoppingCriteria ? new tf.InterruptableStoppingCriteria() : null;
  if (handle) handle.cancel = () => { handle.cancelled = true; if (stop) stop.interrupt(); };
  const maxNew = Math.min(400, Math.max(40, Math.round(draft.length * 0.9) + 40));
  let streamed = '';
  const streamer = tf.TextStreamer && onToken ? new tf.TextStreamer(tok, { skip_prompt: true, skip_special_tokens: true, callback_function: (x) => { streamed += x; onToken(streamed); } }) : undefined;
  const out = await state.model.generate({ ...inputs, max_new_tokens: maxNew, do_sample: false, repetition_penalty: 1.05, ...(stop ? { stopping_criteria: [stop] } : {}), ...(streamer ? { streamer } : {}) });
  const seq = out.slice(null, [inLen, null]);
  const raw = tok.batch_decode(seq, { skip_special_tokens: true })[0];
  const ms = Math.round(performance.now() - t0);
  if (handle && handle.cancelled) return { text: draft, ms, status: 'skipped' };
  const clean = cleanOutput(raw, draft);
  if (!clean) return { text: draft, ms, status: 'failed' };
  const same = clean.replace(/\s+/g, ' ').trim() === draft.replace(/\s+/g, ' ').trim();
  return { text: clean, ms, status: same ? 'unchanged' : 'improved' };
}

// ---------- 4. stored files ----------
export async function storedFiles() {
  try {
    const c = await caches.open(CACHE_NAME), out = [];
    for (const req of await c.keys()) {
      if (!req.url.includes(`/${MODEL.id}/`)) continue;
      const r = await c.match(req), b = r ? await r.blob() : null;
      out.push({ url: req.url, name: req.url.split('/resolve/')[1] || req.url, size: b ? b.size : 0 });
    }
    return out;
  } catch { return []; }
}
export async function deleteStored() {
  await unload();
  const c = await caches.open(CACHE_NAME);
  for (const req of await c.keys()) if (req.url.includes(`/${MODEL.id}/`)) await c.delete(req);
  await idbDelPrefix(MODEL.host).catch(() => {});
}

// One file with everything inside: "SMDL1\n" + JSON line (list of files) + the bytes of each file in order.
const MAGIC = 'SMDL1\n';
export async function exportBlob() {
  const c = await caches.open(CACHE_NAME), list = [], parts = [];
  for (const req of await c.keys()) {
    if (!req.url.includes(`/${MODEL.id}/`)) continue;
    const b = await (await c.match(req)).blob();
    list.push({ url: req.url, size: b.size, type: b.type || 'application/octet-stream' }); parts.push(b);
  }
  if (!list.length) throw new Error('Nothing is stored yet.');
  return new Blob([MAGIC, JSON.stringify({ model: MODEL.id, files: list }) + '\n', ...parts], { type: 'application/octet-stream' });
}
export async function importFile(file) {
  const head = await file.slice(0, MAGIC.length).text();
  if (head !== MAGIC) throw new Error('This is not a Sanctuaire model file.');
  const rest = file.slice(MAGIC.length), probe = await rest.slice(0, 2_000_000).text();
  const nl = probe.indexOf('\n'); if (nl < 0) throw new Error('The file is damaged (no header).');
  const meta = JSON.parse(probe.slice(0, nl));
  if (meta.model !== MODEL.id) throw new Error('This file is for another model.');
  let pos = new Blob([probe.slice(0, nl + 1)]).size;
  const c = await caches.open(CACHE_NAME);
  for (const f of meta.files) {
    if (!f.url.startsWith(MODEL.host + MODEL.id + '/')) throw new Error('The file lists an address that does not belong to this model.');
    const b = rest.slice(pos, pos + f.size);
    if (b.size !== f.size) throw new Error('The file is incomplete.');
    await c.put(f.url, new Response(b, { status: 200, headers: { 'Content-Type': f.type, 'Content-Length': String(f.size) } }));
    pos += f.size;
  }
  return meta.files.length;
}

export const __test = { buildPrompt, cleanOutput, resumableFetch };
