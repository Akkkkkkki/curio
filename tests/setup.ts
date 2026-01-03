import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock window.matchMedia (for theme tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock navigator.mediaDevices (for audio guide/museum guide)
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
});

// Mock IntersectionObserver (for lazy loading/virtual scrolling)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver (for responsive components)
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock URL.createObjectURL and revokeObjectURL (for image handling)
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Set up environment variables for tests
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';
process.env.VITE_AI_ENABLED = 'true';
process.env.VITE_API_BASE_URL = 'http://localhost:8787';
process.env.VITE_VOICE_GUIDE_ENABLED = 'false';
process.env.VITE_SUPABASE_SYNC_TIMESTAMPS = 'true';
