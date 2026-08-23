const RATE_LIMIT = 10;
const WINDOW_SECONDS = 60;

const getSupabaseConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  anonKey:
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
});

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

const jsonHeaders = (anonKey, token) => ({
  apikey: anonKey,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const requireAiAccess = async (req, res, route) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return res.status(503).json({ error: 'AI auth is not configured' });
  }

  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: jsonHeaders(anonKey, token),
    });
    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await userResponse.json();
    req.user = { ...user, sub: user?.id || user?.sub || null };

    const limitResponse = await fetch(`${url}/rest/v1/rpc/consume_ai_rate_limit`, {
      method: 'POST',
      headers: jsonHeaders(anonKey, token),
      body: JSON.stringify({ p_route: route }),
    });

    if (!limitResponse.ok) {
      console.error('AI rate limit check failed', {
        route,
        status: limitResponse.status,
      });
      return res.status(503).json({ error: 'AI rate limiting is not configured' });
    }

    const result = await limitResponse.json();
    res.setHeader('RateLimit-Limit', String(RATE_LIMIT));
    if (Number.isFinite(result?.remaining)) {
      res.setHeader('RateLimit-Remaining', String(result.remaining));
    }
    if (result?.reset_at) {
      res.setHeader('RateLimit-Reset', String(result.reset_at));
    }

    if (!result?.allowed) {
      res.setHeader('Retry-After', String(WINDOW_SECONDS));
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before trying again.',
      });
    }

    return null;
  } catch (error) {
    console.error('AI access check failed', { route, error });
    return res.status(503).json({ error: 'AI access check failed' });
  }
};
