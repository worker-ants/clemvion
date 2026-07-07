import { describe, it, expect, beforeEach } from "vitest";
import {
  pushRecentNodeType,
  RECENT_NODES_MAX,
  useRecentNodesStore,
} from "../recent-nodes-store";

describe("pushRecentNodeType (§4.1)", () => {
  it("빈 목록에 추가하면 단일 항목", () => {
    expect(pushRecentNodeType([], "http_request")).toEqual(["http_request"]);
  });

  it("가장 최근이 맨 앞", () => {
    expect(pushRecentNodeType(["a"], "b")).toEqual(["b", "a"]);
  });

  it("중복은 앞으로 끌어올리며 제거 (길이 불변)", () => {
    expect(pushRecentNodeType(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("최대 개수 초과 시 가장 오래된 것 제거", () => {
    const full = ["e", "d", "c", "b", "a"]; // 길이 5 = RECENT_NODES_MAX
    const next = pushRecentNodeType(full, "f");
    expect(next).toHaveLength(RECENT_NODES_MAX);
    expect(next[0]).toBe("f");
    expect(next).not.toContain("a"); // 가장 오래된 것 밀려남
  });

  it("max 파라미터로 상한 조절 가능", () => {
    expect(pushRecentNodeType(["a", "b"], "c", 2)).toEqual(["c", "a"]);
  });
});

describe("useRecentNodesStore.recordRecentNodeType", () => {
  beforeEach(() => useRecentNodesStore.setState({ recentNodeTypes: [] }));

  it("recordRecentNodeType 로 순서대로 반영", () => {
    useRecentNodesStore.getState().recordRecentNodeType("a");
    useRecentNodesStore.getState().recordRecentNodeType("b");
    expect(useRecentNodesStore.getState().recentNodeTypes).toEqual(["b", "a"]);
  });
});
