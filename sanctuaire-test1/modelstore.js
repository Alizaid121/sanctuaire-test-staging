// Keeps the translation model files on this phone (in the browser's IndexedDB), so they are downloaded only once.
// Used by both test pages. Nothing here sends data anywhere.

const DB_NAME = 'sanctuaire-test1-models';
const STORE = 'files';
const REQUIRED = ['model:enfr', 'vocab:enfr', 'model:fren', 'vocab:fren'];   // the word-list ("lex") files are optional

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'key' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('storage is blocked'));
  });
}

async function run(mode, action) {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result;
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('storage write was cancelled')); };
  });
}

export const get = (key) => run('readonly', (s) => s.get(key));
export const put = (record) => run('readwrite', (s) => s.put(record));
export const clear = () => run('readwrite', (s) => s.clear());
export const keys = () => run('readonly', (s) => s.getAllKeys());

export async function isComplete() {
  try {
    const have = await keys();
    return REQUIRED.every((k) => have.includes(k));
  } catch { return false; }
}

// Asks the browser not to delete the stored files when space is low. The browser may say no; that is fine.
export async function persist() {
  try { return (navigator.storage && navigator.storage.persist) ? await navigator.storage.persist() : false; } catch { return false; }
}

export async function usage() {
  try {
    const e = await navigator.storage.estimate();
    return { used: e.usage || 0, quota: e.quota || 0 };
  } catch { return null; }
}

// ---------- v2.2.0: list, delete, save to a file, load from a file ----------
export const all = () => run('readonly', (s) => s.getAll());
export const remove = (key) => run('readwrite', (s) => s.delete(key));
const MAGIC = 'SMDB1\n';
// One file with everything inside: "SMDB1\n" + one JSON line (the list) + the bytes of each model file in order.
export async function exportBlob() {
  const recs = (await all()) || [];
  if (!recs.length) throw new Error('Nothing is stored yet.');
  const list = recs.map((r) => ({ key: r.key, name: r.name, version: r.version ?? null, bytes: r.bytes ?? r.buffer.byteLength, savedAt: r.savedAt ?? null, size: r.buffer.byteLength }));
  return new Blob([MAGIC, JSON.stringify({ files: list }) + '\n', ...recs.map((r) => r.buffer)], { type: 'application/octet-stream' });
}
export async function importFile(file) {
  if ((await file.slice(0, MAGIC.length).text()) !== MAGIC) throw new Error('This is not a Sanctuaire model file.');
  const rest = file.slice(MAGIC.length), probe = await rest.slice(0, 2_000_000).text(), nl = probe.indexOf('\n');
  if (nl < 0) throw new Error('The file is damaged (no header).');
  const meta = JSON.parse(probe.slice(0, nl));
  const allowed = ['model:enfr', 'vocab:enfr', 'lex:enfr', 'model:fren', 'vocab:fren', 'lex:fren'];
  let pos = new Blob([probe.slice(0, nl + 1)]).size, n = 0;
  for (const f of meta.files || []) {
    if (!allowed.includes(f.key)) throw new Error('The file contains something that does not belong to the translator.');
    const part = rest.slice(pos, pos + f.size);
    if (part.size !== f.size) throw new Error('The file is incomplete.');
    await put({ key: f.key, buffer: await part.arrayBuffer(), name: f.name, version: f.version ?? null, bytes: f.bytes ?? f.size, savedAt: Date.now() });
    pos += f.size; n++;
  }
  return n;
}
