import { describe, it, expect } from "vitest";
import {
  deriveIntegrationIds,
  deriveVisibleIntegrations,
} from "../integration-list-context";

function list(ids: string[], totalItems = ids.length) {
  return {
    data: ids.map((id) => ({ id })),
    pagination: { totalItems },
  };
}

describe("deriveIntegrationIds", () => {
  it("로딩 중이면 null (실재 여부 미확정)", () => {
    expect(deriveIntegrationIds(list(["a"]), true)).toBeNull();
  });

  it("목록 undefined 면 null", () => {
    expect(deriveIntegrationIds(undefined, false)).toBeNull();
  });

  it("완전한 목록이면 id 집합을 반환", () => {
    const ids = deriveIntegrationIds(list(["a", "b"]), false);
    expect(ids).not.toBeNull();
    expect(ids?.has("a")).toBe(true);
    expect(ids?.has("b")).toBe(true);
    expect(ids?.has("c")).toBe(false);
  });

  it("빈 목록(totalItems 0)이면 빈 집합 — 모든 참조가 missing 으로 판정됨", () => {
    const ids = deriveIntegrationIds(list([], 0), false);
    expect(ids).not.toBeNull();
    expect(ids?.size).toBe(0);
  });

  it("페이지네이션으로 잘린 목록(data.length < totalItems)이면 null (위양성 방지)", () => {
    // 100개 조회했으나 전체는 150개 → 전체 미확보 → 단정 불가
    const ids = deriveIntegrationIds(list(["a", "b"], 150), false);
    expect(ids).toBeNull();
  });
});

describe("deriveVisibleIntegrations (붙여넣기 필터가 쓰는 id → 공개 범위 · 통합 소유자)", () => {
  const row = (id: string, scope: "organization" | "personal", createdBy: string) => ({
    id,
    scope,
    createdBy,
  });
  const complete = (rows: ReturnType<typeof row>[], totalItems = rows.length) => ({
    data: rows,
    pagination: { totalItems },
  });

  it("로딩 중이면 null (비울 근거를 모른다)", () => {
    expect(deriveVisibleIntegrations(complete([row("a", "organization", "u1")]), true)).toBeNull();
  });

  it("목록 undefined 면 null", () => {
    expect(deriveVisibleIntegrations(undefined, false)).toBeNull();
  });

  it("페이지네이션으로 잘린 목록(data.length < totalItems)이면 null (모르는 참조를 비우면 쓸 수 있는 참조까지 잃는다)", () => {
    expect(
      deriveVisibleIntegrations(complete([row("a", "organization", "u1")], 150), false),
    ).toBeNull();
  });

  it("완전한 목록이면 id 별로 공개 범위와 통합 소유자만 담는다", () => {
    const visible = deriveVisibleIntegrations(
      complete([
        row("org-1", "organization", "bob"),
        row("alice-personal", "personal", "alice"),
      ]),
      false,
    );
    expect(visible).toEqual(
      new Map([
        ["org-1", { scope: "organization", createdBy: "bob" }],
        ["alice-personal", { scope: "personal", createdBy: "alice" }],
      ]),
    );
  });

  it("목록 응답의 다른 필드는 담지 않는다", () => {
    // 실제 응답 행은 이름 등 더 많은 필드를 싣는다.
    const fullRow = { ...row("a", "organization", "u1"), name: "secret-name" };
    const visible = deriveVisibleIntegrations(
      { data: [fullRow], pagination: { totalItems: 1 } },
      false,
    );
    expect(visible?.get("a")).toEqual({ scope: "organization", createdBy: "u1" });
  });

  it("빈 목록(totalItems 0)이면 빈 맵 — 모든 참조가 목록에 없는 통합이 된다", () => {
    const visible = deriveVisibleIntegrations(complete([], 0), false);
    expect(visible).not.toBeNull();
    expect(visible?.size).toBe(0);
  });
});
