import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecoveryEvent } from '@/services/db';

const BASE_DB_NAME = 'CurioDatabase';
const originalOpen = indexedDB.open.bind(indexedDB);
const originalDeleteDatabase = indexedDB.deleteDatabase.bind(indexedDB);

const deleteDatabase = (name: string): Promise<void> =>
  new Promise((resolve) => {
    const request = originalDeleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });

afterEach(() => {
  Object.defineProperty(indexedDB, 'open', { configurable: true, value: originalOpen as any });
  Object.defineProperty(indexedDB, 'deleteDatabase', {
    configurable: true,
    value: originalDeleteDatabase as any,
  });
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('db.ts recovery event buffering', () => {
  it('replays startup recovery events that fire before the app callback is registered', async () => {
    const testDbName = `${BASE_DB_NAME}__recovery_${Math.random().toString(16).slice(2)}`;
    let shouldFailFirstOpen = true;

    Object.defineProperty(indexedDB, 'open', {
      configurable: true,
      value: ((name: string, version?: number) => {
        if (name === BASE_DB_NAME && shouldFailFirstOpen) {
          shouldFailFirstOpen = false;
          const request: Partial<IDBOpenDBRequest> = {
            error: new DOMException('simulated startup corruption', 'UnknownError'),
          };
          queueMicrotask(() => request.onerror?.(new Event('error')));
          return request as IDBOpenDBRequest;
        }
        return originalOpen(name === BASE_DB_NAME ? testDbName : name, version);
      }) as typeof indexedDB.open,
    });
    Object.defineProperty(indexedDB, 'deleteDatabase', {
      configurable: true,
      value: ((name: string) =>
        originalDeleteDatabase(
          name === BASE_DB_NAME ? testDbName : name,
        )) as typeof indexedDB.deleteDatabase,
    });

    const dbModule = await import('@/services/db');

    const recoveredDb = await dbModule.initDB();
    recoveredDb.close();

    const events: RecoveryEvent[] = [];
    dbModule.setRecoveryCallback((event) => events.push(event));

    expect(events.map((event) => event.type)).toEqual(['corruption_detected', 'recovery_complete']);

    const secondCallback = vi.fn();
    dbModule.setRecoveryCallback(secondCallback);
    expect(secondCallback).not.toHaveBeenCalled();
    dbModule.setRecoveryCallback(null);

    await deleteDatabase(testDbName);
  });
});
