/**
 * IndexedDB wrapper for the ingestion queue and local cache.
 * Uses the 'idb' library for a promise-based API.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "BrowseGraphDB";
const DB_VERSION = 1;
const STORE_QUEUE = "ingestionQueue";
const STORE_CACHE = "responseCache";

interface QueueItem {
  id: string;
  type: "image" | "text";
  payload: any;
  sourceUrl: string;
  timestamp: number;
  status: "pending" | "processing" | "done" | "error";
  retries: number;
}

interface CacheItem {
  key: string;
  response: any;
  timestamp: number;
  ttl: number;
}

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
        queueStore.createIndex("status", "status");
        queueStore.createIndex("timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        const cacheStore = db.createObjectStore(STORE_CACHE, { keyPath: "key" });
        cacheStore.createIndex("timestamp", "timestamp");
      }
    },
  });
  return dbInstance;
}

export async function addToQueue(item: Omit<QueueItem, "id" | "timestamp" | "status" | "retries">): Promise<string> {
  const db = await getDB();
  const id = `${item.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const queueItem: QueueItem = {
    id,
    type: item.type,
    payload: item.payload,
    sourceUrl: item.sourceUrl,
    timestamp: Date.now(),
    status: "pending",
    retries: 0,
  };
  await db.put(STORE_QUEUE, queueItem);
  return id;
}

export async function getPendingItems(limit: number = 10): Promise<QueueItem[]> {
  const db = await getDB();
  const tx = db.transaction(STORE_QUEUE, "readonly");
  const index = tx.store.index("status");
  const items: QueueItem[] = [];
  let cursor = await index.openCursor(IDBKeyRange.only("pending"));
  while (cursor && items.length < limit) {
    items.push(cursor.value as QueueItem);
    cursor = await cursor.continue();
  }
  return items;
}

export async function updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<void> {
  const db = await getDB();
  const existing = await db.get(STORE_QUEUE, id);
  if (existing) {
    await db.put(STORE_QUEUE, { ...existing, ...updates });
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_QUEUE, id);
}

export async function getCached(key: string): Promise<any | null> {
  const db = await getDB();
  const item = await db.get(STORE_CACHE, key) as CacheItem | undefined;
  if (!item) return null;
  if (Date.now() - item.timestamp > item.ttl) {
    await db.delete(STORE_CACHE, key);
    return null;
  }
  return item.response;
}

export async function setCache(key: string, response: any, ttlMs: number = 5 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const cacheItem: CacheItem = {
    key,
    response,
    timestamp: Date.now(),
    ttl: ttlMs,
  };
  await db.put(STORE_CACHE, cacheItem);
}

export async function clearExpiredCache(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(STORE_CACHE, "readwrite");
  const store = tx.store;
  let cursor = await store.openCursor();
  let cleared = 0;
  while (cursor) {
    const item = cursor.value as CacheItem;
    if (Date.now() - item.timestamp > item.ttl) {
      await cursor.delete();
      cleared++;
    }
    cursor = await cursor.continue();
  }
  return cleared;
}

export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  done: number;
  error: number;
}> {
  const db = await getDB();
  const tx = db.transaction(STORE_QUEUE, "readonly");
  const index = tx.store.index("status");
  const stats = { pending: 0, processing: 0, done: 0, error: 0 };

  for (const status of ["pending", "processing", "done", "error"] as const) {
    const count = await index.count(IDBKeyRange.only(status));
    stats[status] = count;
  }

  return stats;
}