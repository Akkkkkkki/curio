import { evaluateMetricAlerts, summarizeMetrics } from './_metrics.js';
import { attachRequestLogger, recordApiError } from './_requestLogging.js';

export default function handler(req, res) {
  attachRequestLogger(req, res, { route: '/api/metrics' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    recordApiError(res, { name: 'MethodNotAllowed', message: 'Method Not Allowed' });
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const routes = summarizeMetrics();
  const alerts = evaluateMetricAlerts(routes);
  res.status(200).json({
    generatedAt: new Date().toISOString(),
    status: alerts.length > 0 ? 'degraded' : 'ok',
    alerts,
    routes,
  });
}
