interface Request {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface Response {
  status(code: number): Response;
  json(body: unknown): Response;
}

const env = (name: string): string => {
  const processValue = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return processValue?.env?.[name] ?? "";
};

const header = (request: Request, name: string): string => {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(400).json({ error: "POST is required" });
      return;
    }
    if (header(req, "x-api-key") !== env("NETGUARD_API_KEY") || !env("NETGUARD_API_KEY")) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    if (req.body === undefined || req.body === null) {
      res.status(400).json({ error: "Report body is required" });
      return;
    }
    const gateway = env("NETGUARD_GATEWAY_URL");
    const token = env("NETGUARD_GATEWAY_TOKEN");
    if (!gateway || !token) {
      throw new Error("NETGUARD_GATEWAY_URL and NETGUARD_GATEWAY_TOKEN are required");
    }
    const response = await fetch(new URL("/report", gateway), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const body: unknown = await response.json();
    res.status(response.status).json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report request failed";
    res.status(500).json({ error: message });
  }
}
