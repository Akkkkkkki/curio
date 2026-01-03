/**
 * Mock Gemini AI response fixtures
 * Used in Phase 3 (geminiService tests) and Phase 4 (AddItemModal tests)
 */

export const mockGeminiAnalysisSuccess = {
  success: true,
  data: {
    title: 'Rare Vinyl Record',
    notes: 'Classic album in excellent condition',
    fields: {
      artist: 'The Beatles',
      album: 'Abbey Road',
      year: '1969',
      condition: 'Excellent',
      genre: 'Rock',
    },
  },
};

export const mockGeminiAnalysisChocolate = {
  success: true,
  data: {
    title: 'Dark Chocolate Bar',
    notes: '70% cacao from Ecuador',
    fields: {
      brand: 'Valrhona',
      origin: 'Ecuador',
      cacao_percentage: '70%',
      tasting_notes: 'Fruity, earthy notes',
    },
  },
};

export const mockGeminiAnalysisTimeout = {
  success: false,
  error: 'Request timeout',
};

export const mockGeminiAnalysisInvalidSchema = {
  success: true,
  data: {
    // Missing required fields
    fields: {},
  },
};

export const mockGeminiAnalysisNetworkError = {
  success: false,
  error: 'Network error',
};

/**
 * Create a mock Gemini response for a given collection template
 */
export function createMockGeminiResponse(templateId: string) {
  switch (templateId) {
    case 'vinyl':
      return mockGeminiAnalysisSuccess;
    case 'chocolate':
      return mockGeminiAnalysisChocolate;
    default:
      return {
        success: true,
        data: {
          title: 'Mock Item',
          notes: 'Mock description',
          fields: {},
        },
      };
  }
}
