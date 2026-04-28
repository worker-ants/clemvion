import { describe, it, expect } from "vitest";
import { normalizePagedResponse } from "../paginated";

describe("normalizePagedResponse", () => {
  it("parses standard PaginatedResponseDto shape", () => {
    const body = {
      data: [{ id: "a" }, { id: "b" }],
      pagination: { page: 2, limit: 10, totalItems: 25, totalPages: 3 },
    };
    const r = normalizePagedResponse<{ id: string }>(body);
    expect(r.items).toHaveLength(2);
    expect(r.page).toBe(2);
    expect(r.totalItems).toBe(25);
    expect(r.totalPages).toBe(3);
  });

  it("handles bare array (legacy endpoint)", () => {
    const body = [{ id: "a" }, { id: "b" }];
    const r = normalizePagedResponse<{ id: string }>(body, 4);
    expect(r.items).toHaveLength(2);
    expect(r.page).toBe(4);
    expect(r.totalItems).toBe(2);
    expect(r.totalPages).toBe(1);
  });

  it("falls back to totalPages=1 when pagination metadata is missing", () => {
    // Critical regression: previous fallback was ceil(items.length / pageSize),
    // which returned 1 on a partial last page (e.g. 5 items / pageSize 20)
    // and silently collapsed the pagination UI.
    const body = { data: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    const r = normalizePagedResponse<{ id: string }>(body);
    expect(r.items).toHaveLength(3);
    expect(r.totalPages).toBe(1);
  });

  it("returns empty result for null/undefined body", () => {
    expect(normalizePagedResponse(null).items).toEqual([]);
    expect(normalizePagedResponse(undefined).items).toEqual([]);
  });

  it("returns empty result when data field is missing", () => {
    const r = normalizePagedResponse<{ id: string }>({
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    expect(r.items).toEqual([]);
    expect(r.totalPages).toBe(0);
  });

  it("uses fallbackPage when pagination omits page", () => {
    const r = normalizePagedResponse({ data: [], pagination: {} }, 7);
    expect(r.page).toBe(7);
  });
});
