// =========================================================================
// API helper hook — 返回稳定引用的 get / post / patch
// =========================================================================

import { useMemo } from "react";

const BASE = "/api";

async function request<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
    credentials: "include",
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }

  return json.data as T;
}

export function useApi() {
  return useMemo(
    () => ({
      get: <T = unknown>(url: string) => request<T>(url),
      post: <T = unknown>(url: string, body?: unknown) =>
        request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
      patch: <T = unknown>(url: string, body?: unknown) =>
        request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
    }),
    [],
  );
}
