async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-api-key,x-sim-signature,Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!process.env.SIM_API_SIGNATURE || req.headers?.["x-sim-signature"] !== process.env.SIM_API_SIGNATURE) {
      res.status(401).json({ error: "Invalid SIM API signature" });
      return;
    }

    if (!process.env.NETGUARD_GATEWAY_URL || !process.env.NETGUARD_GATEWAY_TOKEN) {
      res.status(503).json({ error: "Gateway not configured" });
      return;
    }

    res.status(503).json({
      error: "Real SIM usage backend is not configured",
      message: "No real SIM data - Run on real Android device with permission",
    });
    return;
  } catch {
    res.status(502).json({ error: "Gateway failed" });
    return;
  }
}

module.exports = handler;
