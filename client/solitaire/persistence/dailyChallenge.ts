// Daily challenge persistence - tracks completed daily challenges (crowns)

import { getKey } from '../engine/solvableSeeds';
import { openDB } from './storage';

const DAILY_STORE = 'daily';

export interface DailyCompletion {
  dateKey: string;
  completedAt: number;
  timeSeconds: number;
  moveCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function keyToDayNumber(key: string): number {
  // key is "YYYY-MM-DD"
  const [y, m, d] = key.split("-").map(Number);
  // Use UTC to avoid DST parsing issues
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

// Check if a daily challenge has been completed
export async function isDailyCompleted(dateKey: string): Promise<boolean> {
  try {
    const database = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([DAILY_STORE], 'readonly');
      const store = transaction.objectStore(DAILY_STORE);
      const request = store.get(dateKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };
    });
  } catch {
    return false;
  }
}

// Record a daily challenge completion (earn a crown)
export async function recordDailyCompletion(
  dateKey: string,
  timeSeconds: number,
  moveCount: number
): Promise<void> {
  try {
    const database = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([DAILY_STORE], 'readwrite');
      const store = transaction.objectStore(DAILY_STORE);

      const completion: DailyCompletion = {
        dateKey,
        completedAt: Date.now(),
        timeSeconds,
        moveCount,
      };

      const request = store.put(completion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch(error) {
    console.warn("recordDailyCompletion failed", error);
  }
}

// Get all completed daily challenges (for showing crowns)
export async function getAllCompletions(): Promise<DailyCompletion[]> {
  try {
    const database = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([DAILY_STORE], 'readonly');
      const store = transaction.objectStore(DAILY_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result || []);
      };
    });
  } catch {
    return [];
  }
}

// Get the number of crowns (completed daily challenges)
export async function getCrownCount(): Promise<number> {
  const completions = await getAllCompletions();
  return completions.length;
}

function calculateStreaks(dateKeys: string[]): { current: number; best: number } {
  if (dateKeys.length === 0) return { current: 0, best: 0 };

  // De-dupe in case anything weird gets stored
  const keySet = new Set(dateKeys);

  // Convert to day numbers for robust consecutive-day checks
  const days = Array.from(keySet)
    .map(keyToDayNumber)
    .sort((a, b) => b - a); // most recent first

  // ---- Best streak: longest consecutive run in the whole history ----
  let bestStreak = 0;
  let run = 0;
  let prevDay: number | null = null;

  for (const day of days) {
    if (prevDay === null || prevDay - day === 1) {
      run += 1;
    } else {
      run = 1;
    }
    bestStreak = Math.max(bestStreak, run);
    prevDay = day;
  }

  // ---- Current streak: must include today or yesterday ----
  const todayKey = getKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getKey(yesterday);

  let startKey: string | null = null;
  if (keySet.has(todayKey)) startKey = todayKey;
  else if (keySet.has(yesterdayKey)) startKey = yesterdayKey;

  let currentStreak = 0;
  if (startKey) {
    let day = keyToDayNumber(startKey);

    while (true) {
      const expectedKey = getKey(new Date(day * DAY_MS));
      if (!keySet.has(expectedKey)) break;
      currentStreak += 1;
      day -= 1;
    }
  }

  return { current: currentStreak, best: bestStreak };
}

// Get current and best streak
export async function getStreaks(): Promise<{ current: number; best: number }> {
  const completions = await getAllCompletions();
  const dateKeys = completions.map(c => c.dateKey);
  return calculateStreaks(dateKeys);
}