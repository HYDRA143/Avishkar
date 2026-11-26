async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.NETGUARD_API_KEY;
  if (!apiKey || req.headers?.["x-api-key"] !== apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const gatewayUrl = process.env.NETGUARD_GATEWAY_URL;
  const gatewayToken = process.env.NETGUARD_GATEWAY_TOKEN;
  if (!gatewayUrl || !gatewayToken) {
    res.status(503).json({ error: "Gateway not configured" });
    return;
  }

  try {
    const response = await fetch(new URL("/status", gatewayUrl), {
      headers: { "x-api-key": gatewayToken },
    });
    if (!response.ok) {
      res.status(502).json({ error: "Gateway failed" });
      return;
    }
    const data = await response.json();
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      res.status(502).json({ error: "Invalid gateway response" });
      return;
    }
    res.status(200).json(data);
  } catch {
    res.status(502).json({ error: "Gateway failed" });
  }
}

module.exports = handler;
