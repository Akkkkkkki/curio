import type { CollectionItem, UserCollection } from '../types';
import { analyzeImage, refreshAiEnabled, type AnalyzeResult } from '../services/aiService';
import { compressImageForAi } from '../services/imageProcessor';

export interface CaptureBatchItem {
  id: string;
  image: string;
  title: string;
  notes: string;
  data: Record<string, any>;
  rating: number;
}

type CaptureCollection = Pick<
  UserCollection,
  'id' | 'name' | 'collectionDescription' | 'customFields'
>;

type SaveItem = Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>;

export interface CaptureWorkflowDependencies {
  refreshAiEnabled: () => Promise<boolean>;
  compressImage: (image: string) => Promise<string | null>;
  analyzeImage: typeof analyzeImage;
}

export interface WorkflowGuard {
  isActive: () => boolean;
}

export interface SingleAnalysisInput extends WorkflowGuard {
  image: string;
  collection: CaptureCollection;
  locale: string;
}

export type SingleAnalysisResult =
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'failed'; retryable: boolean }
  | {
      status: 'success';
      title: string;
      aiDescription?: string;
      fieldSuggestions: Record<string, string>;
      lowConfidence: boolean;
    };

export interface BatchAnalysisInput extends WorkflowGuard {
  images: string[];
  existingIds?: string[];
  collection: CaptureCollection;
  locale: string;
  shouldStop: () => boolean;
  onProgress?: (current: number, total: number) => void;
}

export interface BatchAnalysisResult {
  status: 'complete' | 'cancelled' | 'unavailable';
  items: CaptureBatchItem[];
  hadError: boolean;
}

export interface SaveSingleInput {
  collectionId: string;
  item: SaveItem;
  onSave: (collectionId: string, item: SaveItem) => void | Promise<void>;
}

export interface SaveBatchInput {
  collectionId: string;
  items: CaptureBatchItem[];
  onSave: (collectionId: string, item: SaveItem) => void | Promise<void>;
  onItemSaved?: (item: CaptureBatchItem) => void;
}

const defaultDependencies: CaptureWorkflowDependencies = {
  refreshAiEnabled,
  compressImage: compressImageForAi,
  analyzeImage,
};

export const cleanAiData = (data: Record<string, any>): Record<string, any> => {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== 'null') cleaned[key] = value;
  }
  return cleaned;
};

export const createBatchItem = (
  image: string,
  overrides: Partial<CaptureBatchItem> = {},
): CaptureBatchItem => ({
  id: Math.random().toString(36).slice(2, 10),
  image,
  title: '',
  notes: '',
  data: {},
  rating: 0,
  ...overrides,
});

const analyzeOne = async (
  deps: CaptureWorkflowDependencies,
  image: string,
  collection: CaptureCollection,
  locale: string,
): Promise<{ compressed: boolean; result?: AnalyzeResult }> => {
  const compressed = await deps.compressImage(image);
  if (!compressed) return { compressed: false };
  return {
    compressed: true,
    result: await deps.analyzeImage(compressed, collection.customFields, {
      collectionContext: {
        name: collection.name,
        description: collection.collectionDescription,
      },
      locale,
    }),
  };
};

export const createCaptureWorkflow = (
  deps: CaptureWorkflowDependencies = defaultDependencies,
) => ({
  async analyzeSingle(input: SingleAnalysisInput): Promise<SingleAnalysisResult> {
    if (!(await deps.refreshAiEnabled())) {
      return input.isActive() ? { status: 'unavailable' } : { status: 'cancelled' };
    }
    if (!input.isActive()) return { status: 'cancelled' };

    const analysis = await analyzeOne(deps, input.image, input.collection, input.locale);
    if (!input.isActive()) return { status: 'cancelled' };
    if (!analysis.compressed) return { status: 'failed', retryable: true };

    const result = analysis.result!;
    if (result.status !== 'success') {
      return {
        status: 'failed',
        retryable: result.status === 'error' ? result.retryable : true,
      };
    }

    const cleanedData = cleanAiData(result.data || {});
    const fieldSuggestions = Object.fromEntries(
      Object.entries(cleanedData)
        .filter(([key]) => input.collection.customFields.some((field) => field.id === key))
        .map(([key, value]) => [key, String(value)]),
    );
    const lowConfidence =
      (result.title === 'New Item' || !result.title) && Object.keys(cleanedData).length < 2;

    return {
      status: 'success',
      title: result.title || '',
      aiDescription: result.aiDescription || undefined,
      fieldSuggestions,
      lowConfidence,
    };
  },

  async analyzeBatch(input: BatchAnalysisInput): Promise<BatchAnalysisResult> {
    const existingIds = input.existingIds ?? [];
    if (!(await deps.refreshAiEnabled())) {
      if (!input.isActive()) return { status: 'cancelled', items: [], hadError: false };
      return {
        status: 'unavailable',
        hadError: true,
        items: input.images.map((image, index) =>
          createBatchItem(image, existingIds[index] ? { id: existingIds[index] } : {}),
        ),
      };
    }
    if (!input.isActive()) return { status: 'cancelled', items: [], hadError: false };

    const items: CaptureBatchItem[] = [];
    let hadError = false;
    for (let index = 0; index < input.images.length; index += 1) {
      if (!input.isActive()) return { status: 'cancelled', items, hadError };
      if (input.shouldStop()) break;

      const image = input.images[index];
      input.onProgress?.(index + 1, input.images.length);
      const analysis = await analyzeOne(deps, image, input.collection, input.locale);
      if (!input.isActive()) return { status: 'cancelled', items, hadError };

      const existingId = existingIds[index];
      if (!analysis.compressed || analysis.result?.status !== 'success') {
        hadError = true;
        items.push(createBatchItem(image, existingId ? { id: existingId } : {}));
        continue;
      }

      const result = analysis.result;
      items.push(
        createBatchItem(image, {
          id: existingId || Math.random().toString(36).slice(2, 10),
          title: result.title || '',
          notes: '',
          data: {
            ...cleanAiData(result.data || {}),
            ...(result.aiDescription ? { _aiDescription: result.aiDescription } : {}),
          },
        }),
      );
    }

    return { status: 'complete', items, hadError };
  },

  async saveSingle(input: SaveSingleInput): Promise<void> {
    await input.onSave(input.collectionId, input.item);
  },

  async saveBatch(input: SaveBatchInput): Promise<void> {
    for (const item of input.items) {
      await input.onSave(input.collectionId, {
        collectionId: input.collectionId,
        photoUrl: item.image,
        title: item.title || 'Untitled',
        rating: item.rating || 0,
        notes: item.notes || '',
        data: item.data || {},
      });
      input.onItemSaved?.(item);
    }
  },
});

export const captureWorkflow = createCaptureWorkflow();
