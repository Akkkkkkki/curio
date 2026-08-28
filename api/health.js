import { attachMetrics } from './_metrics.js';
import { attachRequestLogger } from './_requestLogging.js';

export default function handler(req, res) {
  attachRequestLogger(req, res, { route: '/api/health' });
  attachMetrics(req, res, '/api/health');
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  res.status(200).json({
    ok: true,
    metadataAnalysisAvailable: geminiConfigured,
    fieldSuggestionsAvailable: geminiConfigured,
    storyPromptsAvailable: geminiConfigured,
    imageEditingAvailable: geminiConfigured,
    // Compatibility for older clients during the CUR-166 migration window.
    geminiConfigured,
  });
}
