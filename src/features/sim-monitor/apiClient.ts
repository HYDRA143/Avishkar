export interface ApiClient {
  get<T>(url: string, signature: string): Promise<T>;
}

const request = async <T>(url: string, signature: string): Promise<T> => {
  try {
    if (!signature.trim()) {
      throw new Error("SIM API signature is required");
    }

    const response = await fetch(url, {
      headers: { "x-sim-signature": signature },
    });
    if (!response.ok) {
      throw new Error(`SIM API request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "SIM API request failed";
    throw new Error(message);
  }
};

export const apiClient: ApiClient = { get: request };
