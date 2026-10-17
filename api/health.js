import { attachMetrics } from './_metrics.js';
import { attachRequestLogger } from './_requestLogging.js';

export default function handler(req, res) {
  attachRequestLogger(req, res, { route: '/api/health' });
  attachMetrics(req, res, '/api/health');
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  // AI photo enhancement is off by default (CUR-183): it sends a private photo
  // to a third-party model, so it stays disabled unless explicitly enabled
  // server-side, independent of whether Gemini is otherwise configured.
  const imageEditingEnabled = geminiConfigured && process.env.AI_IMAGE_EDIT_ENABLED === 'true';
  res.status(200).json({
    ok: true,
    metadataAnalysisAvailable: geminiConfigured,
    fieldSuggestionsAvailable: geminiConfigured,
    storyPromptsAvailable: geminiConfigured,
    imageEditingAvailable: imageEditingEnabled,
    // Compatibility for older clients during the CUR-166 migration window.
    geminiConfigured,
  });
}
