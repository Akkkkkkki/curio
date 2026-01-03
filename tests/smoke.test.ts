import { describe, it, expect, beforeEach } from 'vitest';
import { setupCanvasMocks } from './utils/canvas-mock';
import { mockCollection, createMockItem } from './utils/fixtures/collections';
import { resetSupabaseMocks, mockSupabaseClient } from './mocks/supabase';

/**
 * Smoke tests to verify testing infrastructure is working correctly
 *
 * These tests validate:
 * - Vitest configuration
 * - fake-indexeddb integration
 * - Browser API mocks (matchMedia, URL, etc.)
 * - Canvas mocks
 * - Supabase mocks
 * - Test utilities and fixtures
 */

describe('Testing Infrastructure Smoke Tests', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    setupCanvasMocks();
  });

  describe('Vitest Basics', () => {
    it('should run basic assertions', () => {
      expect(true).toBe(true);
      expect(1 + 1).toBe(2);
    });

    it('should support async tests', async () => {
      const promise = Promise.resolve(42);
      await expect(promise).resolves.toBe(42);
    });

    it('should support vi.fn() mocking', () => {
      const mockFn = vi.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Browser API Mocks', () => {
    it('should mock window.matchMedia', () => {
      expect(window.matchMedia).toBeDefined();
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      expect(media.matches).toBeDefined();
    });

    it('should mock navigator.mediaDevices', () => {
      expect(navigator.mediaDevices).toBeDefined();
      expect(navigator.mediaDevices.getUserMedia).toBeDefined();
    });

    it('should mock URL.createObjectURL', () => {
      expect(URL.createObjectURL).toBeDefined();
      const blob = new Blob(['test']);
      const url = URL.createObjectURL(blob);
      expect(url).toBe('blob:mock-url');
    });

    it('should mock IntersectionObserver', () => {
      expect(IntersectionObserver).toBeDefined();
      const observer = new IntersectionObserver(() => {});
      expect(observer.observe).toBeDefined();
    });

    it('should mock ResizeObserver', () => {
      expect(ResizeObserver).toBeDefined();
      const observer = new ResizeObserver(() => {});
      expect(observer.observe).toBeDefined();
    });
  });

  describe('IndexedDB Mock (fake-indexeddb)', () => {
    it('should provide indexedDB global', () => {
      expect(indexedDB).toBeDefined();
    });

    it('should allow opening a database', async () => {
      const request = indexedDB.open('test-db', 1);

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('test-store');
        };
      });

      expect(db.name).toBe('test-db');
      expect(db.version).toBe(1);
      db.close();
    });

    it('should support IndexedDB transactions', async () => {
      const request = indexedDB.open('test-db-2', 1);

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('items', { keyPath: 'id' });
        };
      });

      const tx = db.transaction('items', 'readwrite');
      const store = tx.objectStore('items');

      await new Promise<void>((resolve, reject) => {
        const addRequest = store.add({ id: 1, name: 'Test Item' });
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });

      const getRequest = store.get(1);
      const result = await new Promise((resolve, reject) => {
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      });

      expect(result).toEqual({ id: 1, name: 'Test Item' });
      db.close();
    });
  });

  describe('Canvas Mocks', () => {
    it('should provide HTMLCanvasElement', () => {
      expect(HTMLCanvasElement).toBeDefined();
      const canvas = document.createElement('canvas');
      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    });

    // Note: happy-dom doesn't fully support Canvas 2D context
    // These will be tested properly in Phase 1 imageProcessor tests using the real 'canvas' package
    it.skip('should support canvas 2d context', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();
      expect(ctx?.fillRect).toBeDefined();
    });

    it.skip('should mock canvas.toBlob', (done) => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      canvas.toBlob((blob) => {
        expect(blob).toBeInstanceOf(Blob);
        expect(blob?.type).toMatch(/^image\//);
        done();
      });
    });
  });

  describe('Supabase Mocks', () => {
    it('should provide mock Supabase client', () => {
      expect(mockSupabaseClient).toBeDefined();
      expect(mockSupabaseClient.auth).toBeDefined();
      expect(mockSupabaseClient.from).toBeDefined();
      expect(mockSupabaseClient.storage).toBeDefined();
    });

    it('should mock auth.signUp', async () => {
      const result = await mockSupabaseClient.auth.signUp({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.data?.user).toBeDefined();
      expect(result.data?.user?.email).toBe('test@example.com');
      expect(result.error).toBeNull();
    });

    it('should mock auth.signInWithPassword', async () => {
      const result = await mockSupabaseClient.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.data?.session).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Test Utilities and Fixtures', () => {
    it('should provide mock collections', () => {
      expect(mockCollection).toBeDefined();
      expect(mockCollection.id).toBe('test-collection-1');
      expect(mockCollection.name).toBe('Test Vinyl Collection');
    });

    it('should create mock items with factory', () => {
      const item = createMockItem({
        title: 'Custom Title',
        rating: 4,
      });

      expect(item.title).toBe('Custom Title');
      expect(item.rating).toBe(4);
      expect(item.id).toMatch(/^mock-item-/);
    });

    it('should support Blob and File APIs', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe('text/plain');

      const file = new File([blob], 'test.txt', { type: 'text/plain' });
      expect(file.name).toBe('test.txt');
      expect(file.type).toBe('text/plain');
    });
  });

  describe('Environment Variables', () => {
    it('should have test environment variables set', () => {
      expect(process.env.VITE_SUPABASE_URL).toBe('https://test.supabase.co');
      expect(process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY).toBe('test-key');
      expect(process.env.VITE_AI_ENABLED).toBe('true');
      expect(process.env.VITE_API_BASE_URL).toBe('http://localhost:8787');
    });
  });
});
