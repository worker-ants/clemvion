// Server-side fetch (used in Next.js Server Components) for the list of
// OAuth providers that the backend has credentials for. Cached for 5 minutes
// via Next.js' built-in fetch cache so the auth pages don't pay the cost on
// every render.
//
// Returns an empty list on failure so the UI gracefully degrades — SSO
// buttons are simply hidden rather than blocking sign-in entirely.

export type OAuthProvider = "google" | "github";

// Server-component fetches prefer INTERNAL_API_URL (e.g. cluster-internal
// service DNS) over NEXT_PUBLIC_API_URL (which may resolve to an external
// hostname unreachable from inside the pod). Fallback to the public URL keeps
// local dev simple.
const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3011/api";

export async function fetchEnabledOauthProviders(): Promise<OAuthProvider[]> {
  try {
    // Dev: skip cache so backend env edits take effect on next page load.
    // Prod: 5-min ISR cache to avoid an extra hop on every render.
    const fetchOptions: RequestInit =
      process.env.NODE_ENV === "development"
        ? { cache: "no-store" }
        : { next: { revalidate: 300 } };
    const res = await fetch(
      `${API_BASE_URL}/auth/oauth/providers`,
      fetchOptions,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data?: { providers?: OAuthProvider[] };
    };
    return body.data?.providers ?? [];
  } catch {
    return [];
  }
}
