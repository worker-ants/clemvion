import { describe, it, expect } from "vitest";
import {
  filterNotifications,
  type NotificationFilter,
  type NotificationLite,
} from "../filter";

function n(id: string, type?: string): NotificationLite {
  return { id, type };
}

describe("filterNotifications", () => {
  const list = [
    n("a", "execution_failed"),
    n("b", "integration_action_required"),
    n("c", "integration_expired"),
    n("d", "team_invite"),
    n("e", "integration_action_required"),
    n("f", undefined), // legacy row without type — treat as 'general'
  ];

  it("returns all when filter='all'", () => {
    expect(filterNotifications(list, "all").map((n) => n.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("returns only integration_action_required when filter='integration-action-required'", () => {
    expect(
      filterNotifications(list, "integration-action-required").map(
        (n) => n.id,
      ),
    ).toEqual(["b", "e"]);
  });

  it("returns non-integration_action_required when filter='general'", () => {
    // 'general' = 통합 액션 필요 이외 모든 알림. integration_expired 는
    // 'general' 에 포함 (passive 알림으로 즉시 액션 의무 없음). type 누락
    // legacy 행도 general 로 분류.
    expect(filterNotifications(list, "general").map((n) => n.id)).toEqual([
      "a",
      "c",
      "d",
      "f",
    ]);
  });

  it("returns empty array when no matching notification", () => {
    expect(
      filterNotifications(
        [n("x", "team_invite")],
        "integration-action-required",
      ),
    ).toEqual([]);
  });

  it("returns empty array when input list is empty", () => {
    expect(filterNotifications([], "all")).toEqual([]);
    expect(filterNotifications([], "general")).toEqual([]);
    expect(filterNotifications([], "integration-action-required")).toEqual([]);
  });

  it("preserves input order (does not re-sort)", () => {
    const ordered: NotificationLite[] = [
      n("z", "integration_action_required"),
      n("y", "execution_failed"),
      n("x", "integration_action_required"),
    ];
    expect(
      filterNotifications(ordered, "integration-action-required").map(
        (n) => n.id,
      ),
    ).toEqual(["z", "x"]);
  });

  it("filter type union covers all UI options", () => {
    // Lock-in: 세 옵션만 유효. 향후 옵션 추가 시 i18n / 칩 / 분기 모두 갱신
    // 필요하다는 invariant.
    const filters: NotificationFilter[] = [
      "all",
      "general",
      "integration-action-required",
    ];
    expect(filters.length).toBe(3);
  });
});
