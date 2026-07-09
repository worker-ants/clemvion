import { describe, it, expect } from "vitest";
import { resolveFallbackWorkspace } from "../resolve-fallback";

const A = { id: "a", name: "A", type: "personal" as const, slug: "team-a", role: "owner" as const };
const B = { id: "b", name: "B", type: "team" as const, slug: "team-b", role: "editor" as const };

describe("resolveFallbackWorkspace", () => {
  it("returns the active workspace when currentWorkspaceId matches", () => {
    expect(resolveFallbackWorkspace([A, B], "b")).toBe(B);
  });

  it("falls back to the first workspace when currentWorkspaceId is null", () => {
    expect(resolveFallbackWorkspace([A, B], null)).toBe(A);
  });

  it("falls back to the first workspace when currentWorkspaceId is unknown", () => {
    expect(resolveFallbackWorkspace([A, B], "gone")).toBe(A);
  });

  it("returns null when there are no workspaces", () => {
    expect(resolveFallbackWorkspace([], "a")).toBeNull();
  });
});
