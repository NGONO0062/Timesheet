// Accès à l'API .NET : même origine (/api relayé), cookie de session HttpOnly envoyé
// automatiquement. Une réponse en erreur lève ApiError avec son code et son corps.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Erreur ${status}`);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    ...rest,
    headers: { Accept: "application/json", ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}
