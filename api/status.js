function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.NETGUARD_API_KEY) {
    return res.status(503).json({ error: "API authentication is not configured" });
  }
  if (req.headers["x-api-key"] !== process.env.NETGUARD_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const gatewayUrl = process.env.NETGUARD_GATEWAY_URL;
  if (!gatewayUrl || !process.env.NETGUARD_GATEWAY_TOKEN) {
    return res.status(503).json({ error: "Gateway status source is not configured" });
  }

  try {
    const response = await fetch(new URL(`${gatewayUrl.replace(/\/+$/, "")}/status`), {
      headers: { "x-api-key": process.env.NETGUARD_GATEWAY_TOKEN },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return res.status(502).json({ error: "Gateway status source returned an error" });

    const data = await response.json();
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return res.status(502).json({ error: "Gateway returned an invalid status document" });
    }
    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ error: "Gateway status is unavailable" });
  }
}
