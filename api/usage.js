export default async function handler(req, res) {
  if (req.headers['x-api-key'] !== process.env.NETGUARD_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const r = await fetch(`${process.env.NETGUARD_GATEWAY_URL}/status`, {
      headers: { 'x-api-key': process.env.NETGUARD_GATEWAY_TOKEN }
    });
    const data = await r.json();
    return res.status(200).json(data.bandwidth);
  } catch (e) {
    return res.status(502).json({ error: 'Gateway failed' });
  }
}
