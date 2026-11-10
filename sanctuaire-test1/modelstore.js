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
