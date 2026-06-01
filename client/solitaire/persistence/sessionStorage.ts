import type { PersistedLimitState, PlaySession } from '../limits/types';
import { openDB } from './storage';

const LIMIT_STATE_STORE = 'limitState';
const SESSIONS_STORE = 'sessions';
const CURRENT_LIMIT_STATE_ID = 'current';

export async function loadLimitState(): Promise<PersistedLimitState | null> {
  try {
    const database = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([LIMIT_STATE_STORE], 'readonly');
      const store = transaction.objectStore(LIMIT_STATE_STORE);
      const request = store.get(CURRENT_LIMIT_STATE_ID);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve((request.result as PersistedLimitState | undefined) ?? null);
      };
    });
  } catch (error) {
    console.warn('Failed to load limit state:', error);
    return null;
  }
}

export async function saveLimitState(state: PersistedLimitState): Promise<void> {
  try {
    const database = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([LIMIT_STATE_STORE, SESSIONS_STORE], 'readwrite');
      const limitStore = transaction.objectStore(LIMIT_STATE_STORE);
      const sessionsStore = transaction.objectStore(SESSIONS_STORE);

      limitStore.put({ ...state, id: CURRENT_LIMIT_STATE_ID, updatedAt: Date.now() });
      sessionsStore.put({ ...state.session, updatedAt: Date.now() });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.warn('Failed to save limit state:', error);
  }
}

export async function saveCompletedSession(session: PlaySession): Promise<void> {
  try {
    const database = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([SESSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.put({ ...session, updatedAt: Date.now() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn('Failed to save completed session:', error);
  }
}
