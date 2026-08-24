import { attachMetrics } from '../_metrics.js';
import { attachRequestLogger, recordApiError } from '../_requestLogging.js';
import { requireAiAccess } from '../_aiSecurity.js';
import { analyzeItem, GEMINI_ANALYZE_MODEL } from '../../server/ai/operations.js';

export { buildAnalysisPrompt } from '../../server/ai/operations.js';

export default async function handler(req, res) {
  attachRequestLogger(req, res, {
    route: '/api/gemini/analyze',
    provider: 'google',
    model: GEMINI_ANALYZE_MODEL,
  });
  attachMetrics(req, res, '/api/gemini/analyze');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    recordApiError(res, { name: 'MethodNotAllowed', message: 'Method Not Allowed' });
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const denied = await requireAiAccess(req, res, '/api/gemini/analyze');
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    recordApiError(res, { name: 'MissingApiKey', message: 'GEMINI_API_KEY is not configured' });
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const requestInput = { ...(req.body || {}) };
    delete requestInput.apiKey;
    delete requestInput.client;
    const result = await analyzeItem({ ...requestInput, apiKey });
    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    const message = error instanceof Error ? error.message : 'AI analysis failed';
    recordApiError(res, {
      name: error instanceof Error && error.name ? error.name : 'AIAnalysisFailed',
      message,
    });
    if (statusCode >= 500) console.error('AI Analysis Failed:', error);
    return res
      .status(statusCode)
      .json({ error: statusCode === 400 ? message : 'AI analysis failed' });
  }
}
