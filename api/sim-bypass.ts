interface Request {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface Response {
  status(code: number): Response;
  json(body: unknown): Response;
}

const getHeader = (headers: Request["headers"], name: string): string => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

export default function handler(req: Request, res: Response): void {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const signature = getHeader(req.headers, "x-sim-signature");
    const environment = (globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }).process;
    const expectedSignature = environment?.env?.SIM_API_SIGNATURE;
    if (!expectedSignature || !signature || signature !== expectedSignature) {
      res.status(401).json({ error: "Invalid SIM API signature" });
      return;
    }

    res.status(503).json({
      error: "Real SIM usage backend is not configured",
      message: "No real SIM data - Run on real Android device with permission",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SIM bypass request failed";
    res.status(500).json({ error: message });
  }
}
