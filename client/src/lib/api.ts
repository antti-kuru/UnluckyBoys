const defaultServerBases = ["http://localhost:8000/api", "http://server:8000/api"];

function serverBaseUrls() {
  return [
    import.meta.env.API_BASE_URL,
    import.meta.env.PUBLIC_API_BASE_URL,
    ...defaultServerBases
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  let lastError: unknown;

  for (const baseUrl of serverBaseUrls()) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {})
        },
        ...init
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }));
        const issue = body.issues?.[0];
        const issuePath = Array.isArray(issue?.path) ? issue.path.join(".") : "";
        const issueMessage = issue?.message ? `${issuePath ? `${issuePath}: ` : ""}${issue.message}` : "";
        throw new Error(issueMessage || body.error || "Request failed");
      }

      return response.json() as Promise<T>;
    } catch (caught) {
      lastError = caught;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("API request failed");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    const issue = body.issues?.[0];
    const issuePath = Array.isArray(issue?.path) ? issue.path.join(".") : "";
    const issueMessage = issue?.message ? `${issuePath ? `${issuePath}: ` : ""}${issue.message}` : "";
    throw new Error(issueMessage || body.error || "Request failed");
  }

  return response.json() as Promise<T>;
}

export function postJson<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export async function uploadImage(path: string, image: File) {
  const body = new FormData();
  body.set("image", image);
  const response = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    body
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(result.error ?? "Upload failed");
  }

  return response.json() as Promise<{ url: string }>;
}

export function putJson<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function deleteJson<T>(path: string) {
  return api<T>(path, { method: "DELETE" });
}
