function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
}

function parseCounter(value) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Gateway returned an invalid interface counter");
  }
  return parsed;
}

function parseInterface(value) {
  if (typeof value === "string") {
    const name = value.match(/(?:interface|name)='([^']+)'/)?.[1];
    const received = value.match(/(?:received_bytes|rx_bytes)=(\d+)/)?.[1];
    const transmitted = value.match(/(?:transmitted_bytes|sent_bytes|tx_bytes)=(\d+)/)?.[1];
    if (!name || received === undefined || transmitted === undefined) {
      throw new Error("Gateway returned an invalid interface record");
    }
    return {
      interface: name,
      received_bytes: parseCounter(received),
      transmitted_bytes: parseCounter(transmitted),
    };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Gateway returned an invalid interface record");
  }
  const entry = value;
  const name = entry.interface ?? entry.name ?? entry.iface;
  const received = entry.received_bytes ?? entry.rx_bytes;
  const transmitted = entry.transmitted_bytes ?? entry.sent_bytes ?? entry.tx_bytes;
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Gateway returned an interface without a name");
  }
  return {
    interface: name.trim(),
    received_bytes: parseCounter(received),
    transmitted_bytes: parseCounter(transmitted),
  };
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
    return res.status(503).json({ error: "Gateway usage source is not configured" });
  }

  try {
    const response = await fetch(new URL(`${gatewayUrl.replace(/\/+$/, "")}/status`), {
      headers: { "x-api-key": process.env.NETGUARD_GATEWAY_TOKEN },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Gateway usage source returned an error" });
    }

    const data = await response.json();
    const interfaces = data?.bandwidth?.interfaces;
    if (!Array.isArray(interfaces)) {
      return res.status(502).json({ error: "Gateway interface counters are unavailable" });
    }
    const parsedInterfaces = interfaces.map(parseInterface);
    if (parsedInterfaces.length === 0) {
      return res.status(502).json({ error: "Gateway returned no interface counters" });
    }

    return res.status(200).json({
      interfaces: parsedInterfaces.map((item) => ({
        ...item,
        received: item.received_bytes,
        transmitted: item.transmitted_bytes,
      })),
      measurementScope: "uno-interface",
      perDeviceUsage: {
        available: false,
        reason: "This Uno client only measures its own interface; router telemetry is required for per-device totals.",
      },
    });
  } catch {
    return res.status(502).json({ error: "Gateway interface counters are unavailable" });
  }
}
