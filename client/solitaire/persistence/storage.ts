import type { GameState, GameStats, SavedGame } from '../engine/types';

const DB_NAME = 'solitaire-db';
const DB_VERSION = 1;
const GAME_STORE = 'game';
const STATS_STORE = 'stats';

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(GAME_STORE)) {
        database.createObjectStore(GAME_STORE, { keyPath: 'id' });
      }
      
      if (!database.objectStoreNames.contains(STATS_STORE)) {
        database.createObjectStore(STATS_STORE, { keyPath: 'id' });
      }
    };
  });
}

export async function saveGame(state: GameState): Promise<void> {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([GAME_STORE], 'readwrite');
    const store = transaction.objectStore(GAME_STORE);
    
    const savedGame: SavedGame & { id: string } = {
      id: 'current',
      state,
      stats: { gamesPlayed: 0, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, totalPlayTime: 0 },
      lastSaved: Date.now(),
    };
    
    const request = store.put(savedGame);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([GAME_STORE], 'readonly');
      const store = transaction.objectStore(GAME_STORE);
      const request = store.get('current');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as (SavedGame & { id: string }) | undefined;
        resolve(result?.state ?? null);
      };
    });
  } catch {
    return null;
  }
}

export async function clearGame(): Promise<void> {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([GAME_STORE], 'readwrite');
    const store = transaction.objectStore(GAME_STORE);
    const request = store.delete('current');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

const DEFAULT_STATS: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalPlayTime: 0,
};

export async function loadStats(): Promise<GameStats> {
  try {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STATS_STORE], 'readonly');
      const store = transaction.objectStore(STATS_STORE);
      const request = store.get('stats');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as (GameStats & { id: string }) | undefined;
        if (!result) {
          resolve(DEFAULT_STATS);
          return;
        }
        // Strip the id field before returning
        const { id: _, ...stats } = result;
        resolve(stats);
      };
    });
  } catch {
    return DEFAULT_STATS;
  }
}

export async function saveStats(stats: GameStats): Promise<void> {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STATS_STORE], 'readwrite');
    const store = transaction.objectStore(STATS_STORE);
    
    const request = store.put({ id: 'stats', ...stats });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function recordWin(gameTime: number): Promise<GameStats> {
  const stats = await loadStats();
  const newStats: GameStats = {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + 1,
    currentStreak: stats.currentStreak + 1,
    bestStreak: Math.max(stats.bestStreak, stats.currentStreak + 1),
    bestTime: stats.bestTime ? Math.min(stats.bestTime, gameTime) : gameTime,
    totalPlayTime: stats.totalPlayTime + gameTime,
  };
  await saveStats(newStats);
  return newStats;
}

export async function recordLoss(gameTime: number): Promise<GameStats> {
  const stats = await loadStats();
  const newStats: GameStats = {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    losses: stats.losses + 1,
    currentStreak: 0,
    totalPlayTime: stats.totalPlayTime + gameTime,
  };
  await saveStats(newStats);
  return newStats;
}
