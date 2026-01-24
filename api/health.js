import { attachMetrics } from './_metrics.js';

export default function handler(req, res) {
  attachMetrics(req, res, '/api/health');
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  res.status(200).json({ ok: true, geminiConfigured });
}
