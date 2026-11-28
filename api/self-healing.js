function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
}

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.NETGUARD_API_KEY) {
    return res.status(503).json({ error: "API authentication is not configured" });
  }
  if (req.headers["x-api-key"] !== process.env.NETGUARD_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.status(200).json({
    status: "Unconfigured",
    healing: false,
    integrity: {
      state: "unconfigured",
      signedBaselineConfigured: false,
    },
    manualApprovalRequired: true,
    message: "No trusted signed GitHub baseline is configured. No source code is changed automatically.",
  });
}
