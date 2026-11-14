/* Sanctuaire Test 1 v2.2.0: the on-phone language model that fixes Bergamot's draft.
   Model: Gemma 3 270M (instruction-tuned) as a GGUF file, run by wllama (llama.cpp compiled for the browser) on the PROCESSOR,
   the same path on every phone. Nothing typed is ever sent anywhere: only the model file is downloaded (from Hugging Face), once.
   Why not ONNX: every ONNX file of this model uses an operation (GatherBlockQuantized) that the processor engine does not have.
   Parts: 1 the downloader (pause, continue, cancel, resumes), 2 loading, 3 the "fix the draft" step, 4 stored files (list, delete, save, load). */

export const MODEL = {
  id: 'bartowski/google_gemma-3-270m-it-GGUF',
  file: 'google_gemma-3-270m-it-Q8_0.gguf',
  host: 'https://huggingface.co/',
  minBytes: 150e6, maxBytes: 450e6,               // the real file is about 285 MB: anything far from that is refused before downloading
  label: 'Gemma 3 270M (8-bit GGUF)',
};
const CACHE_NAME = 'sanctuaire-llm-v1';
const LEGACY_CACHES = ['transformers-cache'];      // from the ONNX tries: deleted at the first download
const CHUNK = 4 * 1024 * 1024;
const RUNTIME = new URL('./vendor/wllama/', import.meta.url).href;

const state = { Wllama: null, w: null, loading: null, lastError: '' };
export const status = () => ({ ready: !!state.w, loading: !!state.loading, dtype: state.w ? 'Q8_0' : null, error: state.lastError });

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

// What will be downloaded, with the real size (from Hugging Face's file list). A file whose size is far from the expected one is refused.
export async function plan() {
  let size = 0, exact = false;
  try {
    const r = await fetch(`${MODEL.host}api/models/${MODEL.id}/tree/main`);
    if (r.ok) { const e = (await r.json()).find((x) => x.type === 'file' && x.path === MODEL.file); if (e) { size = (e.lfs && e.lfs.size) || e.size || 0; exact = !!size; } }
  } catch { /* try the other way */ }
  if (!size) { try { const r = await fetch(fileUrl(MODEL.file), { method: 'HEAD' }); if (r.ok) size = Number(r.headers.get('content-length')) || 0; } catch { /* ignore */ } }
  if (!size) throw new Error('The size of the model file could not be read, so nothing was downloaded. Try again.');
  if (size < MODEL.minBytes || size > MODEL.maxBytes) throw new Error(`The model file has an unexpected size (${Math.round(size / 1048576)} MB), so nothing was downloaded.`);
  return { dtype: 'Q8_0', files: [{ name: MODEL.file, size }], total: size, exact };
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
  for (const n of LEGACY_CACHES) { try { await caches.delete(n); } catch { /* ignore */ } }
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
        if ((await blob.slice(0, 4).text()) !== 'GGUF') { await idbDelPrefix(`${url}|`); throw new Error('The downloaded file is not a model file (wrong header). It was discarded; press Continue to download it again.'); }
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
async function runtime() {
  if (state.Wllama) return state.Wllama;
  const mod = await import('./vendor/wllama/index.js');
  state.Wllama = mod.Wllama || (mod.default && mod.default.Wllama);
  if (!state.Wllama) throw new Error('The language-model engine did not start (wllama was not found).');
  return state.Wllama;
}
async function cachedNames() {
  try { const c = await caches.open(CACHE_NAME); return (await c.keys()).map((k) => k.url).filter((u) => u.includes(`/${MODEL.id}/`)).map(nameOf); } catch { return []; }
}
export async function isStored() { return (await cachedNames()).includes(MODEL.file); }

// Needs the file to be stored already (download() first).
export function load() {
  if (state.w) return Promise.resolve(status());
  if (state.loading) return state.loading;
  state.lastError = '';
  state.loading = (async () => {
    let w = null;
    try {
      const c = await caches.open(CACHE_NAME), res = await c.match(fileUrl(MODEL.file));
      if (!res) throw new Error('The model file is not stored on this phone yet.');
      const blob = await res.blob();
      const Wllama = await runtime();
      w = new Wllama({ default: RUNTIME + 'wllama.wasm' }, { suppressNativeLog: true });
      await w.loadModel([blob], { n_ctx: 1024, n_threads: 1, n_gpu_layers: 0 });    // processor only, one thread (no cross-origin isolation here)
      state.w = w;
      if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch { /* ignore */ } }
      return status();
    } catch (e) {
      try { if (w) await w.exit(); } catch { /* ignore */ }
      state.w = null;
      state.lastError = (e && e.message) || String(e);
      throw e;
    } finally { state.loading = null; }
  })();
  return state.loading;
}
export async function unload() {
  try { if (state.w) await state.w.exit(); } catch { /* ignore */ }
  state.w = null;
}

// ---------- 3. fix the draft ----------
// A very small model follows worked examples much better than long rules, and it answers the text instead of editing it when it is
// given rules only (this is what happened in the first run). So the request is a short conversation: two solved examples, then the real one.
// The first turns are the same on every call of one direction, so the engine can reuse them from its memory instead of reading them again.
// writer / reader: 'man' or 'woman' (this app is for one man and one woman: the English speaker is the man).
const LANGN = { en: 'English', fr: 'French' };
const EXAMPLES = {
  fr: [
    { text: 'What are you thinking about? Don\'t worry.', draft: 'À quoi penses-tu ? Ne vous inquiétez pas.', fixed: 'À quoi penses-tu ? Ne t\'inquiète pas.' },
    { text: 'You hit the nail on the head.', draft: 'Vous avez frappé le clou sur la tête.', fixed: 'Tu as mis dans le mille.' },
  ],
  en: [
    { text: 'À quoi penses-tu ? Ne t\'inquiète pas.', draft: 'What do you think of? Don\'t worry yourself.', fixed: 'What are you thinking about? Don\'t worry.' },
    { text: 'Tomber dans les pommes.', draft: 'Falling into the apples.', fixed: 'To pass out.' },
  ],
};
function turn(from, to, text, draft, extra) {
  const rule = to === 'fr'
    ? 'Fix the draft translation: same meaning, natural French, always "tu" (never "vous"), idioms by meaning.'
    : 'Fix the draft translation: same meaning, natural English, idioms by meaning.';
  return `${rule} Do not answer the text, only translate it.${extra ? ' ' + extra : ''}\n${LANGN[from]}: ${text}\n${LANGN[to]} draft: ${draft}\n${LANGN[to]} fixed:`;
}
export function buildMessages({ text, draft, from, to, writer, reader }) {
  const msgs = [];
  for (const e of EXAMPLES[to]) { msgs.push({ role: 'user', content: turn(from, to, e.text, e.draft) }); msgs.push({ role: 'assistant', content: e.fixed }); }
  const extra = to === 'fr' ? `The writer is a ${writer}, the reader is a ${reader}: use ${reader === 'woman' ? 'feminine' : 'masculine'} forms for the reader.` : '';
  msgs.push({ role: 'user', content: turn(from, to, text, draft, extra) });
  return msgs;
}

const words = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) || [];
// Cleans what the model wrote. Returns '' when it cannot be trusted (then the draft is kept).
export function cleanOutput(raw, draft) {
  let s = String(raw || '').trim();
  s = s.replace(/^(corrected translation|fixed translation|translation|traduction corrigée|traduction|(english|french) fixed)\s*(\([^)]*\))?\s*:\s*/i, '').trim();
  if (/^["«“].*["»”]$/s.test(s) && !/^["«“]/.test(draft.trim())) s = s.slice(1, -1).trim();
  if (!s) return '';
  if (/^(okay|ok\b|sure|of course|certainly|i understand|i will|i'll|i can|here is|here's|voici|bien sûr|d'accord|je comprends|je vais)/i.test(s)) return '';   // it answered or talked about the task
  if (/(corrected translation|translation editor|draft translation|do not answer|keep the meaning|i will (provide|not|keep)|je vais (fournir|corriger))/i.test(s)) return '';
  const a = s.length, b = Math.max(draft.length, 1);
  if (a < b * 0.5 || a > b * 1.8 + 15) return '';                          // far too short or too long: it went off the task
  const dw = words(draft), sw = words(s);
  if (dw.length > 3 && sw.length) {                                        // it must still be about the same text
    const set = new Set(dw); const same = sw.filter((w) => set.has(w)).length;
    if (same / sw.length < 0.3) return '';
  }
  return s;
}

export function canImprove() { return !!state.w; }
// Returns { text, ms, status, stats } where status is 'improved' | 'unchanged' | 'failed' | 'skipped'. handle.cancel() stops it.
// stats = { firstMs, tokens, perSec } when the engine reports them (to see where the time goes).
export async function improve({ text, draft, from, to, writer, reader, onToken, handle }) {
  if (!state.w) throw new Error('The language model is not ready.');
  const t0 = performance.now(), ac = new AbortController();
  if (handle) handle.cancel = () => { handle.cancelled = true; ac.abort(); };
  const maxNew = Math.min(220, Math.ceil(draft.length / 2.8) + 20);       // about the length of the draft, so that it cannot ramble on
  let raw = '', first = null, timings = null;
  try {
    const it = await state.w.createChatCompletion({ messages: buildMessages({ text, draft, from, to, writer, reader }), max_tokens: maxNew, temperature: 0, stream: true, cache_prompt: true, timings_per_token: true, abortSignal: ac.signal });
    for await (const ch of it) {
      const c = ch && ch.choices && ch.choices[0];
      const d = (c && ((c.delta && c.delta.content) || c.text)) || '';
      if (ch && ch.timings) timings = ch.timings;
      if (d) { if (first === null) first = Math.round(performance.now() - t0); raw += d; if (onToken) onToken(raw); }
    }
  } catch (e) { if (!(handle && handle.cancelled) && !(e && e.name === 'AbortError')) throw e; }
  const ms = Math.round(performance.now() - t0);
  const stats = { firstMs: first, tokens: timings ? timings.predicted_n : null, perSec: timings && timings.predicted_per_second ? Math.round(timings.predicted_per_second * 10) / 10 : null, promptMs: timings ? Math.round(timings.prompt_ms) : null };
  if (handle && handle.cancelled) return { text: draft, ms, status: 'skipped', stats };
  const clean = cleanOutput(raw, draft);
  if (!clean) return { text: draft, ms, status: 'failed', stats, raw: raw.slice(0, 200) };
  const same = clean.replace(/\s+/g, ' ').trim() === draft.replace(/\s+/g, ' ').trim();
  return { text: clean, ms, status: same ? 'unchanged' : 'improved', stats };
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
  for (const n of LEGACY_CACHES) { try { await caches.delete(n); } catch { /* ignore */ } }
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

export const __test = { buildMessages, cleanOutput, downloadFile, plan, dropOtherFiles, fileUrl };
