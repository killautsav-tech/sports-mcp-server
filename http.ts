/**
 * Shared HTTP utility for making API requests.
 */

export interface ApiResponse<T = unknown> {
  data: T;
  headers: Record<string, string>;
  status: number;
}

export async function fetchJson<T = unknown>(
  url: string,
  options?: { headers?: Record<string, string> }
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...options?.headers,
    },
  });

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `HTTP ${res.status} ${res.statusText}: ${body.slice(0, 500)}`
    );
  }

  const data = (await res.json()) as T;
  return { data, headers, status: res.status };
}

/**
 * Build a URL with query params, stripping undefined values.
 */
export function buildUrl(
  base: string,
  path: string,
  params: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}
