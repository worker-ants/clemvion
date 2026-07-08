import { describe, it, expect } from "vitest";
import { buildWorkspaceHref } from "../href";

describe("buildWorkspaceHref", () => {
  it("prefixes an absolute path with /w/<slug>", () => {
    expect(buildWorkspaceHref("team-a", "/workflows")).toBe("/w/team-a/workflows");
  });

  it("normalizes a path that lacks a leading slash", () => {
    expect(buildWorkspaceHref("team-a", "workflows")).toBe("/w/team-a/workflows");
  });

  it("preserves nested paths and query strings", () => {
    expect(buildWorkspaceHref("team-a", "/integrations/abc?x=1")).toBe(
      "/w/team-a/integrations/abc?x=1",
    );
  });

  it("falls back to the bare path when slug is null (catch-all absorbs it)", () => {
    expect(buildWorkspaceHref(null, "/workflows")).toBe("/workflows");
  });

  it("falls back to the bare path when slug is undefined", () => {
    expect(buildWorkspaceHref(undefined, "/profile")).toBe("/profile");
  });

  it("collapses protocol-relative leading slashes (open-redirect defense)", () => {
    // `//evil.com/x` must not survive as a protocol-relative URL.
    expect(buildWorkspaceHref("team-a", "//evil.com/x")).toBe(
      "/w/team-a/evil.com/x",
    );
    expect(buildWorkspaceHref(null, "//evil.com/x")).toBe("/evil.com/x");
  });

  it("neutralizes backslash and control-char open-redirect bypasses", () => {
    // WHATWG URL treats `\`, tab, CR, LF like `/` in special schemes.
    expect(buildWorkspaceHref(null, "\\\\evil.com/x")).toBe("/evil.com/x");
    expect(buildWorkspaceHref(null, "/\\evil.com")).toBe("/evil.com");
    expect(buildWorkspaceHref(null, "/\t/evil.com")).toBe("/evil.com");
    expect(buildWorkspaceHref("team-a", "\\\\evil.com")).toBe("/w/team-a/evil.com");
  });
});
