async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.status(400).json({ error: "GET is required" });
      return;
    }

    if (!process.env.NETGUARD_API_KEY || req.headers?.["x-api-key"] !== process.env.NETGUARD_API_KEY) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    if (!process.env.NETGUARD_GATEWAY_URL || !process.env.NETGUARD_GATEWAY_TOKEN) {
      res.status(503).json({ error: "Gateway not configured" });
      return;
    }

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (typeof value === "string") {
        query.set(key, value);
      }
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await fetch(new URL(`/usage${suffix}`, process.env.NETGUARD_GATEWAY_URL), {
      headers: { authorization: `Bearer ${process.env.NETGUARD_GATEWAY_TOKEN}` },
    });
    const body = await response.json();
    res.status(response.status).json(body);
  } catch {
    res.status(502).json({ error: "Gateway failed" });
    return;
  }
}

module.exports = handler;
