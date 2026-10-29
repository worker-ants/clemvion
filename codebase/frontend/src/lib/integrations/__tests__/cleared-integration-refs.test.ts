import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearedIntegrationRefLabels,
  stashRestoreClearedIntegrationRefs,
  takeRestoreClearedIntegrationRefs,
} from "../cleared-integration-refs";

const fetchRef = {
  nodeId: "n-1",
  nodeLabel: "Fetch",
  field: "config.integrationId",
};
const agentRefs = [0, 1].map((j) => ({
  nodeId: "n-2",
  nodeLabel: "Agent",
  field: `config.mcpServers[${j}].integrationId`,
}));

describe("clearedIntegrationRefLabels", () => {
  it("노드 레이블을 처음 나온 순서대로 중복 없이 돌려준다", () => {
    expect(clearedIntegrationRefLabels([fetchRef, ...agentRefs])).toEqual([
      "Fetch",
      "Agent",
    ]);
  });

  it("목록이 없으면 빈 배열이다", () => {
    expect(clearedIntegrationRefLabels(undefined)).toEqual([]);
  });
});

describe("restore cleared refs hand-off (REQ-WFVER-027)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("넘겨 둔 목록을 같은 워크플로우에서 한 번만 꺼낸다", () => {
    stashRestoreClearedIntegrationRefs("wf-1", [fetchRef]);
    expect(takeRestoreClearedIntegrationRefs("wf-2")).toEqual([]);
    expect(takeRestoreClearedIntegrationRefs("wf-1")).toEqual([fetchRef]);
    expect(takeRestoreClearedIntegrationRefs("wf-1")).toEqual([]);
  });

  it("비운 것이 없으면 아무것도 남기지 않는다", () => {
    stashRestoreClearedIntegrationRefs("wf-1", []);
    stashRestoreClearedIntegrationRefs("wf-1", undefined);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("깨진 값은 버리고 빈 배열을 돌려준다", () => {
    window.sessionStorage.setItem(
      "clemvion.restoreClearedIntegrationRefs:wf-1",
      "{not json",
    );
    expect(takeRestoreClearedIntegrationRefs("wf-1")).toEqual([]);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("저장소를 쓸 수 없어도 던지지 않는다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() =>
      stashRestoreClearedIntegrationRefs("wf-1", [fetchRef]),
    ).not.toThrow();
    expect(takeRestoreClearedIntegrationRefs("wf-1")).toEqual([]);
  });
});
