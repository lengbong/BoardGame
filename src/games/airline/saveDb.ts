/**
 * 큰 저장소 (IndexedDB). localStorage는 5MB쯤이 한도라, 회사가 수십 곳인 긴 판은 여기에 저장한다.
 * 브라우저가 디스크 여유에 따라 훨씬 넉넉하게 (보통 수백 MB 넘게) 내어 준다.
 */
export interface SaveBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

const DB_NAME = 'family-boardgame';
const STORE = 'saves';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
    // 못 열었으면 다음에 다시 열어 본다
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = work(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

const idbBackend: SaveBackend = {
  get: (key) => run<unknown>('readonly', (s) => s.get(key)).then((v) => (typeof v === 'string' ? v : null)),
  set: (key, value) => run('readwrite', (s) => s.put(value, key)).then(() => undefined),
  del: (key) => run('readwrite', (s) => s.delete(key)).then(() => undefined),
};

let override: SaveBackend | null | undefined;

/** 테스트에서 저장소를 바꿔 끼운다 (undefined면 원래대로, null이면 큰 저장소 없음) */
export function setSaveBackend(b: SaveBackend | null | undefined): void {
  override = b;
}

/** 쓸 수 있는 큰 저장소 (없으면 null: 사생활 보호 모드나 아주 오래된 브라우저) */
export function saveBackend(): SaveBackend | null {
  if (override !== undefined) return override;
  try {
    return typeof indexedDB !== 'undefined' && indexedDB ? idbBackend : null;
  } catch {
    return null;
  }
}
