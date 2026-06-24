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

import { getServerApiBaseUrl } from "./constants";

export type OAuthProvider = "google" | "github";

export async function fetchEnabledOauthProviders(): Promise<OAuthProvider[]> {
  try {
    // Server-component fetch — getServerApiBaseUrl() prefers INTERNAL_API_URL
    // (cluster-internal service DNS) over the public URL. See lib/api/constants.ts.
    const res = await fetch(`${getServerApiBaseUrl()}/auth/oauth/providers`, {
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
