import { describe, it, expect } from "vitest";
import { collectPickerEntries } from "./assistant-message";
import type { AssistantToolCallRecord } from "@/lib/api/assistant";

/**
 * 서버는 `add_node` / `update_node` 성공 응답마다 pendingUserConfig 를 실어
 * 보낸다 (ED-AI-39). 노드 1 개에 대해 add_node 1 회 + 후속 update_node N 회면
 * 프런트 수신 tool 결과에 같은 `(nodeId, field)` pending entry 가 N+1 회
 * 등장. 이전 구현은 그대로 누적 렌더해 "Integration 선택" 드롭다운이 여러
 * 개 보이는 UX 버그가 있었다 — 본 spec 은 dedup last-wins 정책을 고정한다.
 */

const integrationIdField = {
  field: "integrationId",
  widget: "integration-selector" as const,
  label: "Integration",
  candidateCount: 2,
};

describe("collectPickerEntries", () => {
  it("같은 (nodeId, field) 가 여러 tool_call 에 있으면 가장 마지막 entry 하나만 남긴다", () => {
    const calls: AssistantToolCallRecord[] = [
      {
        id: "c1",
        name: "add_node",
        arguments: { type: "send_email" },
        kind: "edit",
        result: {
          ok: true,
          id: "node-A",
          pendingUserConfig: [integrationIdField],
        },
      },
      {
        id: "c2",
        name: "update_node",
        arguments: { id: "node-A" },
        kind: "edit",
        result: {
          ok: true,
          pendingUserConfig: [integrationIdField],
        },
      },
      {
        id: "c3",
        name: "update_node",
        arguments: { id: "node-A" },
        kind: "edit",
        result: {
          ok: true,
          pendingUserConfig: [integrationIdField],
        },
      },
    ];
    const entries = collectPickerEntries(calls);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      nodeId: "node-A",
      field: integrationIdField,
      key: "node-A:integrationId",
    });
  });

  it("다른 노드 또는 다른 field 는 각자 하나씩 유지", () => {
    const llmConfigField = {
      field: "llmConfigId",
      widget: "llm-config-selector" as const,
      label: "LLM Config",
      candidateCount: 1,
    };
    const calls: AssistantToolCallRecord[] = [
      {
        id: "c1",
        name: "add_node",
        arguments: { type: "send_email" },
        kind: "edit",
        result: {
          ok: true,
          id: "node-A",
          pendingUserConfig: [integrationIdField],
        },
      },
      {
        id: "c2",
        name: "add_node",
        arguments: { type: "ai_agent" },
        kind: "edit",
        result: {
          ok: true,
          id: "node-B",
          pendingUserConfig: [llmConfigField],
        },
      },
      {
        id: "c3",
        name: "update_node",
        arguments: { id: "node-A" },
        kind: "edit",
        result: {
          ok: true,
          pendingUserConfig: [integrationIdField],
        },
      },
    ];
    const entries = collectPickerEntries(calls);
    expect(entries).toHaveLength(2);
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("node-A:integrationId");
    expect(keys).toContain("node-B:llmConfigId");
  });

  it("실패한 (ok:false) call 과 edit 아닌 call 은 무시", () => {
    const calls: AssistantToolCallRecord[] = [
      {
        id: "c1",
        name: "add_node",
        arguments: { type: "send_email" },
        kind: "edit",
        result: {
          ok: false,
          error: "LABEL_CONFLICT",
          pendingUserConfig: [integrationIdField],
        },
      },
      {
        id: "c2",
        name: "get_current_workflow",
        arguments: {},
        kind: "explore",
        result: {
          ok: true,
          pendingUserConfig: [integrationIdField],
        },
      },
    ];
    expect(collectPickerEntries(calls)).toHaveLength(0);
  });

  it("update_node 가 camelCase `nodeId` 로 id 를 실어와도 매칭", () => {
    const calls: AssistantToolCallRecord[] = [
      {
        id: "c1",
        name: "update_node",
        arguments: { nodeId: "node-A" },
        kind: "edit",
        result: {
          ok: true,
          pendingUserConfig: [integrationIdField],
        },
      },
    ];
    const entries = collectPickerEntries(calls);
    expect(entries).toHaveLength(1);
    expect(entries[0].nodeId).toBe("node-A");
  });
});
