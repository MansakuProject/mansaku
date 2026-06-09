import type { ProjectData } from "./types";

export type ProjectAutoSaveSnapshot = {
  autoSaveVersion: 1;
  savedAt: number;
  projectFileName?: string | null;
  data: ProjectData;
};

const DB_NAME = "mansaku-auto-save";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "latest";

function openAutoSaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runStoreRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    let request: IDBRequest<T>;

    openAutoSaveDb()
      .then((db) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        request = action(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
        transaction.onabort = () => {
          db.close();
          reject(transaction.error);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      })
      .catch(reject);
  });
}

export async function readProjectAutoSave(): Promise<ProjectAutoSaveSnapshot | null> {
  if (!("indexedDB" in window)) return null;

  const snapshot = await runStoreRequest<ProjectAutoSaveSnapshot | undefined>(
    "readonly",
    (store) => store.get(SNAPSHOT_KEY) as IDBRequest<ProjectAutoSaveSnapshot | undefined>
  );

  if (!snapshot || snapshot.autoSaveVersion !== 1 || !snapshot.data) {
    return null;
  }

  return snapshot;
}

export async function writeProjectAutoSave(
  snapshot: ProjectAutoSaveSnapshot
): Promise<void> {
  if (!("indexedDB" in window)) return;

  await runStoreRequest<IDBValidKey>("readwrite", (store) =>
    store.put(snapshot, SNAPSHOT_KEY)
  );
}

export async function clearProjectAutoSave(): Promise<void> {
  if (!("indexedDB" in window)) return;

  await runStoreRequest<undefined>("readwrite", (store) =>
    store.delete(SNAPSHOT_KEY) as IDBRequest<undefined>
  );
}
