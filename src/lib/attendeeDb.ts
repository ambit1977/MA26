import type { Attendee } from "./attendees";

const DB_NAME = "ma26-okinawa";
const DB_VERSION = 1;
const STORE = "attendees";
const META_STORE = "meta";

export type AttendeeDbPayload = {
  attendees: Attendee[];
  rawText: string;
  importedAt: string;
  source: "paste" | "local-json";
  fetchedAt?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveAttendeeDb(payload: AttendeeDbPayload) {
  const db = await openDb();
  const tx = db.transaction([STORE, META_STORE], "readwrite");
  tx.objectStore(STORE).clear();
  for (const attendee of payload.attendees) {
    tx.objectStore(STORE).put(attendee);
  }
  tx.objectStore(META_STORE).put({
    key: "attendees",
    count: payload.attendees.length,
    rawText: payload.rawText,
    importedAt: payload.importedAt,
    source: payload.source,
    fetchedAt: payload.fetchedAt || "",
  });
  await txDone(tx);
  db.close();
}

export async function loadAttendeeDb() {
  const db = await openDb();
  const tx = db.transaction([STORE, META_STORE], "readonly");
  const attendees = await new Promise<Attendee[]>((resolve, reject) => {
    const request = tx.objectStore(STORE).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as Attendee[]);
  });
  const meta = await new Promise<Record<string, string | number> | undefined>((resolve, reject) => {
    const request = tx.objectStore(META_STORE).get("attendees");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as Record<string, string | number> | undefined);
  });
  db.close();
  return { attendees, meta };
}

export async function clearAttendeeDb() {
  const db = await openDb();
  const tx = db.transaction([STORE, META_STORE], "readwrite");
  tx.objectStore(STORE).clear();
  tx.objectStore(META_STORE).delete("attendees");
  await txDone(tx);
  db.close();
}

export async function tryLoadLocalAttendeeJson(options: { bypassCache?: boolean } = {}) {
  const response = await fetch("/attendees.local.json", options.bypassCache ? { cache: "reload" } : undefined);
  if (!response.ok) return null;
  return (await response.json()) as {
    rawText?: string;
    fetchedAt?: string;
    lineCount?: number;
    records?: Array<Record<string, unknown>>;
  };
}
