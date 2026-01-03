import { http, HttpResponse } from 'msw';

/**
 * MSW handlers for mocking API requests
 * Used in Phase 3 (AI service) and Phase 4 (component tests)
 */

// Gemini API mock responses
export const geminiHandlers = [
  // Mock /api/gemini/analyze endpoint
  http.post('http://localhost:8787/api/gemini/analyze', async ({ request }) => {
    const body = await request.json();

    // Simulate successful AI analysis
    return HttpResponse.json({
      success: true,
      data: {
        title: 'Analyzed Item',
        notes: 'AI-generated description',
        fields: {},
      },
    });
  }),
];

// Supabase API mock responses
export const supabaseHandlers = [
  // Mock auth endpoints
  http.post('https://test.supabase.co/auth/v1/signup', () => {
    return HttpResponse.json({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
      session: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      },
    });
  }),

  http.post('https://test.supabase.co/auth/v1/token', ({ request }) => {
    const url = new URL(request.url);
    const grantType = url.searchParams.get('grant_type');

    if (grantType === 'password') {
      return HttpResponse.json({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
        },
      });
    }

    return HttpResponse.json({ error: 'Invalid grant type' }, { status: 400 });
  }),

  http.post('https://test.supabase.co/auth/v1/logout', () => {
    return HttpResponse.json({}, { status: 204 });
  }),

  // Mock database queries
  http.get('https://test.supabase.co/rest/v1/collections', () => {
    return HttpResponse.json([]);
  }),

  http.get('https://test.supabase.co/rest/v1/items', () => {
    return HttpResponse.json([]);
  }),

  http.post('https://test.supabase.co/rest/v1/collections', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...body, id: 'test-collection-id' });
  }),

  http.post('https://test.supabase.co/rest/v1/items', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...body, id: 'test-item-id' });
  }),

  // Mock storage endpoints
  http.post('https://test.supabase.co/storage/v1/object/curio-assets/*', () => {
    return HttpResponse.json({
      Key: 'test-key',
      Id: 'test-id',
    });
  }),
];

// Combine all handlers
export const handlers = [...geminiHandlers, ...supabaseHandlers];
