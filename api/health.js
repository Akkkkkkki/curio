export default function handler(_req, res) {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  res.status(200).json({ ok: true, geminiConfigured });
}
