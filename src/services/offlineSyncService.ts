/**
 * OfflineSyncService
 *
 * Implements resilient offline IndexedDB storage and transactional mutation queuing for PWA.
 * Enables zero-data-loss offline operation: when internet connectivity drops or is intermittent,
 * financial transactions (Receipts, Payments, Handovers, Vouchers) are saved to an IndexedDB
 * write-ahead log. When connectivity is restored, the queue is atomically flushed to Firestore.
 */

export interface QueuedMutation {
  id: string;
  type:
    | 'CREATE_RECEIPT'
    | 'UPDATE_RECEIPT'
    | 'CREATE_PAYMENT'
    | 'UPDATE_PAYMENT'
    | 'CREATE_TRANSACTION'
    | 'UPDATE_TRANSACTION'
    | 'VOID_RECORD'
    | 'CREATE_MEMBER'
    | 'UPDATE_MEMBER'
    | 'CUSTOM';
  collectionName: string;
  docId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  userEmail: string;
  userId: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;
}

const DB_NAME = 'CharityAccountingSyncDB';
const DB_VERSION = 1;
const QUEUE_STORE = 'offline_mutations';
const SNAPSHOT_STORE = 'cached_collections';

class OfflineSyncService {
  private static instance: OfflineSyncService;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isOnlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<(isOnline: boolean, pendingCount: number) => void> = new Set();
  private isProcessingQueue = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      // Initialize BroadcastChannel for cross-tab multi-window synchronization
      try {
        if ('BroadcastChannel' in window) {
          this.broadcastChannel = new BroadcastChannel('charity_ledger_sync');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'QUEUE_UPDATED' || event.data?.type === 'RECORD_SYNCED') {
              this.notifyListeners();
            }
          };
        }
      } catch (err) {
        console.warn('BroadcastChannel not supported in this environment', err);
      }

      // Online / Offline window events
      window.addEventListener('online', () => {
        this.isOnlineStatus = true;
        this.notifyListeners();
        this.autoFlushQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnlineStatus = false;
        this.notifyListeners();
      });
    }
  }

  public static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  /**
   * Initializes or retrieves the IndexedDB instance
   */
  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB is not available in this environment'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(QUEUE_STORE)) {
            const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
            queueStore.createIndex('timestamp', 'timestamp', { unique: false });
            queueStore.createIndex('status', 'status', { unique: false });
          }
          if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
            db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  /**
   * Returns whether the browser is currently online
   */
  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : this.isOnlineStatus;
  }

  /**
   * Subscribes to connectivity and queue size changes
   */
  public subscribe(callback: (isOnline: boolean, pendingCount: number) => void): () => void {
    this.listeners.add(callback);
    this.getPendingCount().then((count) => callback(this.isOnline(), count));
    return () => {
      this.listeners.delete(callback);
    };
  }

  private async notifyListeners() {
    const count = await this.getPendingCount();
    const online = this.isOnline();
    this.listeners.forEach((fn) => fn(online, count));
  }

  /**
   * Enqueues a transaction into the offline IndexedDB write-ahead log
   */
  public async enqueueMutation(
    mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'status' | 'retryCount'>
  ): Promise<QueuedMutation> {
    const item: QueuedMutation = {
      ...mutation,
      id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    };

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB write failed, falling back to localStorage queue:', err);
      this.fallbackEnqueueLocalStorage(item);
    }

    // Broadcast change across open tabs
    this.broadcastChannel?.postMessage({ type: 'QUEUE_UPDATED', mutationId: item.id });
    await this.notifyListeners();

    return item;
  }

  /**
   * Retrieves all pending mutations ordered by timestamp
   */
  public async getPendingMutations(): Promise<QueuedMutation[]> {
    try {
      const db = await this.getDB();
      return new Promise<QueuedMutation[]>((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const list: QueuedMutation[] = req.result || [];
          list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return this.fallbackGetLocalStorage();
    }
  }

  /**
   * Returns count of queued mutations
   */
  public async getPendingCount(): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise<number>((resolve) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
    } catch {
      return this.fallbackGetLocalStorage().length;
    }
  }

  /**
   * Removes a synced mutation from the queue
   */
  public async removeMutation(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.fallbackRemoveLocalStorage(id);
    }
    this.broadcastChannel?.postMessage({ type: 'QUEUE_UPDATED', removedId: id });
    await this.notifyListeners();
  }

  /**
   * Clears all pending mutations
   */
  public async clearQueue(): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('charity_offline_queue');
      }
    }
    await this.notifyListeners();
  }

  /**
   * Caches an entire collection snapshot for instantaneous offline startup
   */
  public async cacheSnapshot(key: string, data: unknown): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
        const store = tx.objectStore(SNAPSHOT_STORE);
        const req = store.put({ key, data, updatedAt: new Date().toISOString() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        sessionStorage.setItem(`cached_snap_${key}`, JSON.stringify(data));
      } catch {
        // storage quota exceeded or disabled
      }
    }
  }

  /**
   * Retrieves a cached collection snapshot
   */
  public async getCachedSnapshot<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise<T | null>((resolve) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
        const store = tx.objectStore(SNAPSHOT_STORE);
        const req = store.get(key);
        req.onsuccess = () => {
          resolve(req.result ? (req.result.data as T) : null);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      try {
        const s = sessionStorage.getItem(`cached_snap_${key}`);
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Flushes the pending offline queue using a custom sync executor
   */
  public async flushQueue(
    executor: (mutation: QueuedMutation) => Promise<boolean>
  ): Promise<{ synced: number; failed: number }> {
    if (this.isProcessingQueue) return { synced: 0, failed: 0 };
    this.isProcessingQueue = true;

    let synced = 0;
    let failed = 0;

    try {
      const mutations = await this.getPendingMutations();
      for (const mut of mutations) {
        try {
          const success = await executor(mut);
          if (success) {
            await this.removeMutation(mut.id);
            synced++;
          } else {
            failed++;
          }
        } catch (err) {
          console.error(`Failed to flush mutation ${mut.id}:`, err);
          failed++;
        }
      }
    } finally {
      this.isProcessingQueue = false;
      this.notifyListeners();
    }

    return { synced, failed };
  }

  /**
   * Automatically flushes queue when reconnected
   */
  private async autoFlushQueue() {
    if (typeof window !== 'undefined' && (window as any).__flushOfflineLedgerQueue) {
      try {
        await (window as any).__flushOfflineLedgerQueue();
      } catch (e) {
        console.warn('Auto flush error:', e);
      }
    }
  }

  // LocalStorage Fallback helpers in case IndexedDB is restricted in iframe/private mode
  private fallbackEnqueueLocalStorage(item: QueuedMutation) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.fallbackGetLocalStorage();
      current.push(item);
      localStorage.setItem('charity_offline_queue', JSON.stringify(current));
    } catch (e) {
      console.warn('localStorage enqueue error', e);
    }
  }

  private fallbackGetLocalStorage(): QueuedMutation[] {
    if (typeof window === 'undefined') return [];
    try {
      const s = localStorage.getItem('charity_offline_queue');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  }

  private fallbackRemoveLocalStorage(id: string) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.fallbackGetLocalStorage().filter((m) => m.id !== id);
      localStorage.setItem('charity_offline_queue', JSON.stringify(current));
    } catch {
      // ignore
    }
  }
}

export const offlineSyncService = OfflineSyncService.getInstance();
