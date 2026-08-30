import { attachMetrics } from '../_metrics.js';
import { attachRequestLogger, recordApiError } from '../_requestLogging.js';
import { requireAiAccess } from '../_aiSecurity.js';
import {
  GEMINI_ANALYZE_MODEL,
  sanitizeAiRequestBody,
  suggestFields,
} from '../../server/ai/operations.js';

export const createSuggestFieldsHandler =
  (route = '/api/gemini/suggest-fields') =>
  async (req, res) => {
    attachRequestLogger(req, res, {
      route,
      provider: 'google',
      model: GEMINI_ANALYZE_MODEL,
    });
    attachMetrics(req, res, route);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      recordApiError(res, { name: 'MethodNotAllowed', message: 'Method Not Allowed' });
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const denied = await requireAiAccess(req, res, route);
    if (denied) return denied;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      recordApiError(res, { name: 'MissingApiKey', message: 'GEMINI_API_KEY is not configured' });
      return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    try {
      const requestInput = sanitizeAiRequestBody(req.body);
      const result = await suggestFields({ ...requestInput, apiKey });
      return res.status(200).json(result);
    } catch (error) {
      const statusCode = error?.statusCode || 500;
      const message = error instanceof Error ? error.message : 'Field suggestion failed';
      recordApiError(res, {
        name: error instanceof Error && error.name ? error.name : 'FieldSuggestionFailed',
        message,
      });
      if (statusCode >= 500) console.error('Field suggestion failed:', error);
      return res
        .status(statusCode)
        .json({ error: statusCode === 400 ? message : 'Field suggestion failed' });
    }
  };

export default createSuggestFieldsHandler();
