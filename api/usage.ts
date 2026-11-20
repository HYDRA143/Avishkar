interface Request {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
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
    if (req.method !== "GET") {
      res.status(400).json({ error: "GET is required" });
      return;
    }
    if (header(req, "x-api-key") !== env("NETGUARD_API_KEY") || !env("NETGUARD_API_KEY")) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    const gateway = env("NETGUARD_GATEWAY_URL");
    const token = env("NETGUARD_GATEWAY_TOKEN");
    if (!gateway || !token) {
      throw new Error("NETGUARD_GATEWAY_URL and NETGUARD_GATEWAY_TOKEN are required");
    }
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (typeof value === "string") {
        query.set(key, value);
      }
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await fetch(new URL(`/usage${suffix}`, gateway), {
      headers: { authorization: `Bearer ${token}` },
    });
    const body: unknown = await response.json();
    res.status(response.status).json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Usage request failed";
    res.status(500).json({ error: message });
  }
}
