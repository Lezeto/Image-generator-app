// Deprecated endpoint. Use /api/generate instead.
export default function handler(_req, res) {
  return res.status(410).json({ error: 'Deprecated endpoint. Use /api/generate' });
}
