// Server-side fetch (used in Next.js Server Components) for the list of
// OAuth providers that the backend has credentials for.
//
// Always uses { cache: "no-store" } to avoid Next.js' fetch-cache disk writes
// (`.next/cache/...`) and prerender ISR writes (`.next/server/app/...`),
// which fail under read-only container filesystems (EROFS/ENOENT). The auth
// pages are also marked `dynamic = "force-dynamic"` for the same reason.
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
    const res = await fetch(`${API_BASE_URL}/auth/oauth/providers`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data?: { providers?: OAuthProvider[] };
    };
    return body.data?.providers ?? [];
  } catch {
    return [];
  }
}
