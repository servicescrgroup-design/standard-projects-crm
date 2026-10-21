/** Fetch wrapper for provider APIs. Never includes tokens in error messages. */

/** The mailbox's access was revoked or expired for good: the user must reconnect. */
export class MailAuthError extends Error {}

export class MailApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(url: string, token: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      authorization: `Bearer ${token}`,
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  if (res.status === 401) throw new MailAuthError("Mailbox access expired");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let message = `${res.status}`;
    try {
      const j = JSON.parse(detail);
      message = j.error?.message ?? j.error_description ?? message;
    } catch {
      /* not JSON */
    }
    throw new MailApiError(`Mail provider error: ${String(message).slice(0, 200)}`, res.status);
  }
  if (res.status === 202 || res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
