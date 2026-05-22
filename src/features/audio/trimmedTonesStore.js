// Browser-side mirror of LocalTrimmedTonesStore.kt — persists trimmed
// clips so the user can re-download or re-preview them later.
//
// IndexedDB is the only browser API that holds Blob payloads with no size
// cap small enough to bite us in normal use. localStorage isn't an option
// (strings only, ~5MB hard cap).

const DB_NAME = 'yolo_trimmer';
const DB_VERSION = 1;
const STORE = 'tones';

const listeners = new Set();

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then(
      (r) => {
        result = r;
      },
      reject
    );
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  });
}

function emit() {
  listeners.forEach((cb) => {
    listAll().then(cb).catch(() => cb([]));
  });
}

export async function saveTone({ name, sourceName, blob, durationSec }) {
  const id =
    typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `t_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  const record = {
    id,
    name: name || 'Untitled clip',
    sourceName: sourceName || '',
    mime: blob.type || 'audio/wav',
    sizeBytes: blob.size,
    durationSec: durationSec || 0,
    createdAt: Date.now(),
    blob,
  };
  await tx('readwrite', (s) => {
    s.put(record);
  });
  emit();
  return record;
}

export async function listAll() {
  try {
    const items = await tx('readonly', (s) => {
      return new Promise((resolve, reject) => {
        const req = s.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    });
    return items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch {
    return [];
  }
}

export async function deleteTone(id) {
  await tx('readwrite', (s) => {
    s.delete(id);
  });
  emit();
}

export function subscribeTones(cb) {
  listeners.add(cb);
  listAll().then(cb).catch(() => cb([]));
  return () => listeners.delete(cb);
}
