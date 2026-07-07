import { describe, it, expect } from "vitest";
import { deriveIntegrationIds } from "../integration-list-context";

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
