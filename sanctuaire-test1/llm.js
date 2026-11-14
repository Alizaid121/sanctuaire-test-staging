/* Sanctuaire Test 1 v2.2.0: the on-phone language model that fixes Bergamot's draft.
   Model: Gemma 3 270M (instruction-tuned, ONNX, 8-bit) run on the PROCESSOR (WebAssembly), the same path on every phone.
   Nothing typed is ever sent anywhere: only the model files are downloaded (from Hugging Face), once.
   Parts: 1 the downloader that can resume, 2 loading, 3 the "fix the draft" step, 4 stored files (list, delete, save, load). */

export const MODEL = {
  id: 'onnx-community/gemma-3-270m-it-ONNX',
  host: 'https://huggingface.co/',
    smallFiles: ['config.json', 'generation_config.json', 'tokenizer.json', 'tokenizer_config.json'],
  label: 'Gemma 3 270M (8-bit)',
};
const CACHE_NAME = 'transformers-cache';
const CHUNK = 4 * 1024 * 1024;
const RUNTIME = new URL('./vendor/llm/', import.meta.url).href;

const state = { tf: null, tokenizer: null, model: null, dtype: null, loading: null, lastError: '' };
export const status = () => ({ ready: !!state.model, loading: !!state.loading, dtype: state.dtype, error: state.lastError });

// ---------- 1. downloading: our own code, with pause, continue and cancel, that survives a lost connection ----------
// The files are fetched in parts of 4 MB and every finished part is kept on the phone, so a stop (pause, lost connection,
// leaving the page, closing the app) never costs more than the part that was running. A finished file is put in the browser's
// cache under the address the engine will ask for, so loading the model later needs no download at all.
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
const idbKeys = () => idbDo('readonly', (s) => s.getAllKeys());
const idbDelKey = (k) => idbDo('readwrite', (s) => { s.delete(k); });

const fileUrl = (name) => `${MODEL.host}${MODEL.id}/resolve/main/${name}`;
const nameOf = (url) => (url.split('/resolve/main/')[1] || url);
const abortErr = () => new DOMException('Aborted', 'AbortError');
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(abortErr()); }, { once: true });
});
async function online(signal) { while (navigator.onLine === false) await sleep(1000, signal); }

// What will be downloaded, with the real sizes (from Hugging Face's file list). Only a processor-friendly 8-bit file is used:
// the 4-bit files need an operation that the processor engine does not have (this is what stopped the first try).
const VARIANTS = [['q8', 'onnx/model_quantized.onnx'], ['int8', 'onnx/model_int8.onnx'], ['uint8', 'onnx/model_uint8.onnx']];
export async function plan() {
  let list = null;
  try {
    const r = await fetch(`${MODEL.host}api/models/${MODEL.id}/tree/main?recursive=true`);
    if (r.ok) list = (await r.json()).filter((e) => e.type === 'file');
  } catch { list = null; }
  const sizeOf = (e) => (e && e.lfs && e.lfs.size) || (e && e.size) || 0;
  const head = async (name) => { try { const r = await fetch(fileUrl(name), { method: 'HEAD' }); return r.ok ? Number(r.headers.get('content-length')) || 0 : 0; } catch { return 0; } };
  let dtype = null, files = [];
  for (const [d, base] of VARIANTS) {
    if (list) {
      const main = list.find((e) => e.path === base);
      if (!main) continue;
      dtype = d;
      files = [{ name: base, size: sizeOf(main) }, ...list.filter((e) => e.path.startsWith(base + '_data')).map((e) => ({ name: e.path, size: sizeOf(e) }))];
    } else {
      const n = await head(base);
      if (!n) continue;
      dtype = d; files = [{ name: base, size: n }];
    }
    break;
  }
  if (!dtype) throw new Error('This model has no 8-bit file for the processor, so nothing was downloaded.');
  const small = list
    ? list.filter((e) => !e.path.includes('/') && /\.(json|jinja)$/.test(e.path) && sizeOf(e) < 8e6).map((e) => ({ name: e.path, size: sizeOf(e) }))
    : MODEL.smallFiles.map((name) => ({ name, size: 0 }));
  const all = [...small, ...files];
  if (all.some((f) => !f.size && !list)) { /* sizes unknown: the bar then counts files */ }
  return { dtype, files: all, total: all.reduce((s, f) => s + f.size, 0), exact: !!list };
}

export const DL = { state: 'idle', loaded: 0, total: 0, file: '', error: '', plan: null, resumable: true };   // idle | running | paused | done
const listeners = new Set();
export const onDownload = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(DL); } catch { /* ignore */ } });
let ctrl = null, cancelling = false, running = null;

// One part (or the whole file when the server ignores part requests). onPart(bytesOfThisPart) is called while it arrives.
async function fetchPart(url, start, end, signal, onPart) {
  let lastErr;
  for (let a = 0; a < 6; a++) {
    try {
      await online(signal);
      const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal });
      if (r.status === 200 && start === 0) { const e = new Error('no-range'); e.noRange = true; r.body && r.body.cancel && r.body.cancel().catch(() => {}); throw e; }
      if (r.status !== 206) throw new Error(`HTTP ${r.status}`);
      const chunks = []; let got = 0;
      const reader = r.body.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onPart(got); }
      return new Blob(chunks, { type: 'application/octet-stream' });
    } catch (e) {
      if (e.noRange || (signal && signal.aborted)) throw e;
      lastErr = e; await sleep(Math.min(1000 * 2 ** a, 15000), signal);
    }
  }
  const e = new Error(`The connection was lost (${(lastErr && lastErr.message) || 'no answer'}). Press Continue when it is back; nothing is lost.`);
  throw e;
}
async function wholeFile(url, size, signal, onBytes) {      // no resume possible: the server did not accept part requests
  DL.resumable = false;
  await online(signal);
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const chunks = []; let got = 0; const reader = r.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onBytes(got); }
  return new Blob(chunks, { type: 'application/octet-stream' });
}
async function downloadFile(url, size, onBytes, signal) {
  if (!size) return wholeFile(url, size, signal, onBytes);
  const n = Math.ceil(size / CHUNK), key = (i) => `${url}|${String(i).padStart(6, '0')}`;
  const meta = await idbGet(`${url}|meta`);
  if (!meta || meta.size !== size) { await idbDelPrefix(`${url}|`); await idbPut(`${url}|meta`, { size }); }
  const parts = []; let loaded = 0;
  for (let i = 0; i < n; i++) {
    const want = Math.min(size, (i + 1) * CHUNK) - i * CHUNK;
    let b = await idbGet(key(i));
    if (!b || b.size !== want) {
      try { b = await fetchPart(url, i * CHUNK, i * CHUNK + want - 1, signal, (g) => onBytes(loaded + g)); }
      catch (e) { if (e.noRange) { await idbDelPrefix(`${url}|`); return wholeFile(url, size, signal, onBytes); } throw e; }
      if (b.size !== want) throw new Error('A part of the file arrived with the wrong size, press Continue to try that part again.');
      await idbPut(key(i), b);
    }
    parts.push(b); loaded += b.size; onBytes(loaded);
  }
  const blob = new Blob(parts, { type: 'application/octet-stream' });
  if (blob.size !== size) { await idbDelPrefix(`${url}|`); throw new Error('The file has the wrong size after joining its parts. Press Continue to download it again.'); }
  return blob;
}

// Removes stored files of this model that this plan does not use (for example the 4-bit file of the first try) and their parts.
async function dropOtherFiles(p) {
  const keep = new Set(p.files.map((f) => f.name));
  try {
    const c = await caches.open(CACHE_NAME);
    for (const req of await c.keys()) if (req.url.includes(`/${MODEL.id}/`) && !keep.has(nameOf(req.url))) await c.delete(req);
  } catch { /* ignore */ }
  try {
    const keepUrls = p.files.map((f) => fileUrl(f.name));
    for (const k of await idbKeys()) if (!keepUrls.some((u) => String(k).startsWith(u + '|'))) await idbDelKey(k);
  } catch { /* ignore */ }
}

export function download() {
  if (running) return running;
  ctrl = new AbortController(); cancelling = false;
  DL.state = 'running'; DL.error = ''; DL.resumable = true; emit();
  const signal = ctrl.signal;
  running = (async () => {
    try {
      const p = DL.plan || (DL.plan = await plan());
      DL.total = p.total; emit();
      await dropOtherFiles(p);
      const cache = await caches.open(CACHE_NAME);
      let done = 0;
      for (const f of p.files) {
        const url = fileUrl(f.name); DL.file = f.name;
        if (await cache.match(url)) { done += f.size; DL.loaded = done; emit(); continue; }
        const blob = await downloadFile(url, f.size, (l) => { DL.loaded = done + l; emit(); }, signal);
        await cache.put(url, new Response(blob, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size) } }));
        await idbDelPrefix(`${url}|`);
        done += blob.size; DL.loaded = done; emit();
      }
      DL.state = 'done';
    } catch (e) {
      if (cancelling) { DL.state = 'idle'; DL.loaded = 0; DL.plan = null; }
      else if (signal.aborted) DL.state = 'paused';
      else { DL.state = 'paused'; DL.error = (e && e.message) || String(e); if (!DL.plan) DL.state = 'idle'; }
    } finally { running = null; emit(); }
    return DL;
  })();
  return running;
}
export function pause() { if (ctrl && DL.state === 'running') ctrl.abort(); }
export async function cancel() {
  cancelling = true;
  if (running) { ctrl.abort(); try { await running; } catch { /* ignore */ } }
  await deleteStored();
  DL.state = 'idle'; DL.loaded = 0; DL.error = ''; DL.plan = null; emit();
}
export const downloading = () => DL.state === 'running';
export async function hasPartial() { try { return (await idbKeys()).some((k) => String(k).includes('|0000')); } catch { return false; } }

// ---------- 2. loading ----------
// The runtime files are ours (vendor/llm/). Two of the library's imports were pointed at our own copy of the engine (see VERSIONS.txt),
// and the 27 MB processor file is kept in two parts because GitHub's web upload refuses single files above 25 MB.
async function wasmBlobUrl() {
  const parts = [];
  for (const n of ['part0', 'part1']) {
    let lastErr;
    for (let a = 0; a < 4; a++) {
      try { await online(); const r = await fetch(`${RUNTIME}ort-wasm-simd-threaded.asyncify.wasm.${n}`); if (!r.ok) throw new Error(`HTTP ${r.status} for the program file`); parts.push(await r.blob()); lastErr = null; break; }
      catch (e) { lastErr = e; await sleep(1000 * 2 ** a); }
    }
    if (lastErr) throw lastErr;
  }
  return URL.createObjectURL(new Blob(parts, { type: 'application/wasm' }));
}
async function runtime() {
  if (state.tf) return state.tf;
  const ort = await import('./vendor/llm/ort.webgpu.bundle.min.mjs');   // the same module that transformers.web.min.js imports
  const oenv = ort.env || (ort.default && ort.default.env);
  if (!oenv || !oenv.wasm) throw new Error('The language-model engine did not start (no WebAssembly settings).');
  oenv.wasm.numThreads = 1;                                            // this site cannot use several threads (no cross-origin isolation)
  oenv.wasm.proxy = false;
  oenv.wasm.wasmPaths = { mjs: RUNTIME + 'ort-wasm-simd-threaded.asyncify.mjs', wasm: await wasmBlobUrl() };
  const tf = await import('./vendor/llm/transformers.web.min.js');
  const env = tf.env;
  env.allowLocalModels = false; env.allowRemoteModels = true;          // remote only for tiny text files that might be missing
  env.useBrowserCache = true; env.cacheKey = CACHE_NAME;
  env.useWasmCache = false;                                            // the engine file is already in memory
  state.tf = tf;
  return tf;
}

async function cachedNames() {
  try { const c = await caches.open(CACHE_NAME); return (await c.keys()).map((k) => k.url).filter((u) => u.includes(`/${MODEL.id}/`)).map(nameOf); } catch { return []; }
}
export async function storedDtype() {
  const names = await cachedNames();
  for (const [d, base] of VARIANTS) if (names.includes(base)) return d;
  return null;
}
export async function isStored() { return !!(await storedDtype()) && (await cachedNames()).includes('tokenizer.json'); }

// opts: { onPhase(text) }. Needs the files to be stored already (download() first).
export function load(opts = {}) {
  if (state.model) return Promise.resolve(status());
  if (state.loading) return state.loading;
  state.lastError = '';
  state.loading = (async () => {
    try {
      const dtype = await storedDtype();
      if (!dtype) throw new Error('The model files are not stored on this phone yet.');
      const tf = await runtime();
      if (opts.onPhase) opts.onPhase('tokenizer');
      state.tokenizer = await tf.AutoTokenizer.from_pretrained(MODEL.id);
      if (opts.onPhase) opts.onPhase('model');
      try { state.model = await tf.AutoModelForCausalLM.from_pretrained(MODEL.id, { dtype, device: 'wasm' }); }
      catch (e) {
        if (/Could not find an implementation/i.test(String(e && e.message))) throw new Error(`The engine on this phone cannot run the stored model file (${dtype}). ${e.message}`);
        throw e;
      }
      state.dtype = dtype;
      if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch { /* ignore */ } }
      return status();
    } catch (e) {
      state.model = null; state.tokenizer = null;
      state.lastError = (e && e.message) || String(e);
      throw e;
    } finally { state.loading = null; }
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
  DL.plan = null;
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

export const __test = { buildPrompt, cleanOutput, downloadFile, plan, dropOtherFiles, fileUrl };
