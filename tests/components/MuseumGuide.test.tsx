import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../utils/test-utils';
import { MuseumGuide } from '@/components/MuseumGuide';
import { UserCollection } from '@/types';
import * as geminiService from '@/services/geminiService';

// Mock geminiService
vi.mock('@/services/geminiService', () => ({
  connectMuseumGuide: vi.fn(),
}));

// Mock getUserMedia
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Mock AudioContext
window.AudioContext = vi.fn().mockImplementation(() => ({
  createMediaStreamSource: vi.fn(() => ({
    connect: vi.fn(),
  })),
  createScriptProcessor: vi.fn(() => ({
    connect: vi.fn(),
    onaudioprocess: null,
  })),
  createBuffer: vi.fn(),
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  })),
  destination: {},
  currentTime: 0,
  close: vi.fn(),
}));

describe('MuseumGuide', () => {
  const mockCollection: UserCollection = {
    id: 'col1',
    name: 'Test Collection',
    items: [],
    templateId: 'general',
    icon: '🏛️',
    customFields: [],
    isPublic: false,
    ownerId: 'user1',
    updatedAt: '',
    createdAt: '',
  };

  const defaultProps = {
    collection: mockCollection,
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
    (geminiService.connectMuseumGuide as any).mockResolvedValue({
      sendRealtimeInput: vi.fn(),
      close: vi.fn(),
    });
  });

  it('renders connecting state initially', () => {
    renderWithProviders(<MuseumGuide {...defaultProps} />);
    expect(screen.getByText(/preparing the archive expert/i)).toBeInTheDocument();
  });

  it('handles permission denied error', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(permissionError);

    renderWithProviders(<MuseumGuide {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/microphone access denied/i)).toBeInTheDocument();
    });
  });

  it('handles generic error', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Unknown error'));

    renderWithProviders(<MuseumGuide {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('allows retry on error', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('Unknown error'));

    renderWithProviders(<MuseumGuide {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    // Reset mock to succeed next time
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });

    const retryButton = screen.getByText(/try again/i);
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/preparing the archive expert/i)).toBeInTheDocument();
    });
  });
});
