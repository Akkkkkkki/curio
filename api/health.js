import { attachMetrics } from './_metrics.js';
import { attachRequestLogger } from './_requestLogging.js';

export default function handler(req, res) {
  attachRequestLogger(req, res, { route: '/api/health' });
  attachMetrics(req, res, '/api/health');
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  res.status(200).json({ ok: true, geminiConfigured });
}
