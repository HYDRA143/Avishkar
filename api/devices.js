function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
}

function parseDevice(value) {
  if (typeof value === "string") {
    const field = (name) => value.match(new RegExp(`${name}='([^']+)'`))?.[1] ?? "";
    const ipAddress = field("ip_address") || field("ip");
    const macAddress = field("mac_address") || field("mac");
    const deviceName = field("hostname") || field("name");
    if (!ipAddress && !macAddress && !deviceName) {
      throw new Error("Gateway returned an invalid device record");
    }
    return {
      ip_address: ipAddress,
      mac_address: macAddress,
      interface: field("interface"),
      ...(deviceName ? { name: deviceName } : {}),
    };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Gateway returned an invalid device record");
  }
  const ipAddress = value.ip_address ?? value.ip ?? value.address ?? "";
  const macAddress = value.mac_address ?? value.mac ?? "";
  const deviceName = value.hostname ?? value.device_name ?? value.name ?? "";
  if (
    typeof ipAddress !== "string"
    || typeof macAddress !== "string"
    || typeof deviceName !== "string"
    || (!ipAddress.trim() && !macAddress.trim() && !deviceName.trim())
  ) {
    throw new Error("Gateway returned an invalid device record");
  }
  const deviceInterface = value.interface ?? value.iface ?? "";
  if (typeof deviceInterface !== "string") {
    throw new Error("Gateway returned an invalid device interface");
  }
  return {
    ip_address: ipAddress.trim(),
    mac_address: macAddress.trim(),
    interface: deviceInterface.trim(),
    ...(deviceName.trim() ? { name: deviceName.trim() } : {}),
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
    return res.status(503).json({ error: "Gateway device source is not configured" });
  }

  try {
    const response = await fetch(new URL(`${gatewayUrl.replace(/\/+$/, "")}/status`), {
      headers: { "x-api-key": process.env.NETGUARD_GATEWAY_TOKEN },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return res.status(502).json({ error: "Gateway device source returned an error" });

    const data = await response.json();
    const devices = data?.devices?.devices;
    if (!Array.isArray(devices)) {
      return res.status(502).json({ error: "Gateway device discovery data is unavailable" });
    }
    return res.status(200).json({
      devices: devices.map(parseDevice),
      measurementScope: "device-discovery-only",
      perDeviceUsage: {
        available: false,
        reason: "Device discovery does not provide per-device traffic counters.",
      },
    });
  } catch {
    return res.status(502).json({ error: "Gateway device discovery is unavailable" });
  }
}
