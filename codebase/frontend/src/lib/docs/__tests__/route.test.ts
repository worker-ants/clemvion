import { describe, expect, it } from "vitest";
import { parseDocsRoute } from "../route";

describe("parseDocsRoute", () => {
  it("parses a valid /docs/<locale>/<section>/<slug> path", () => {
    expect(parseDocsRoute(["ko", "01-first", "a"])).toEqual({
      locale: "ko",
      docSlug: ["01-first", "a"],
    });
    expect(parseDocsRoute(["en", "02-nodes", "ai"])).toEqual({
      locale: "en",
      docSlug: ["02-nodes", "ai"],
    });
  });

  it("returns null when the slug is too short (must have locale + section + page)", () => {
    expect(parseDocsRoute([])).toBeNull();
    expect(parseDocsRoute(["ko"])).toBeNull();
    expect(parseDocsRoute(["ko", "01-first"])).toBeNull();
  });

  it("returns null when the first segment is not a known locale", () => {
    // Legacy bookmark with no locale prefix → page.tsx redirects using cookie.
    expect(parseDocsRoute(["01-first", "a", "b"])).toBeNull();
  });

  it("returns null for unknown locale codes (e.g. fr)", () => {
    // Unknown locales fall through to the legacy-bookmark redirect path.
    expect(parseDocsRoute(["fr", "01-first", "a"])).toBeNull();
  });

  it("preserves deeper paths beyond the minimum 2-depth", () => {
    expect(parseDocsRoute(["ko", "a", "b", "c"])).toEqual({
      locale: "ko",
      docSlug: ["a", "b", "c"],
    });
  });
});
