import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ToolCallBadge } from "./tool-call-badge";
import type { AssistantToolCallRecord } from "@/lib/api/assistant";
import { useLocaleStore } from "@/lib/stores/locale-store";

/**
 * 도구 호출 배지의 요약 문구는 현재 로케일의 사전 문구로 그린다(CLE-UI-I18N 규칙 1,
 * CLE-WF-ASSIST-UI 「i18n 키」). 노드 라벨 · 타입 · 설정 키 · 상태 값처럼 도구 인자와
 * 결과에서 온 값은 그대로 싣는다.
 */

function call(
  name: string,
  args: Record<string, unknown> = {},
  result: unknown = { ok: true },
): AssistantToolCallRecord {
  return {
    id: `${name}-1`,
    name,
    arguments: args,
    kind:
      name.startsWith("get_") || name.startsWith("list_") ? "explore" : "edit",
    result,
  } as AssistantToolCallRecord;
}

const CASES: Array<{
  title: string;
  call: AssistantToolCallRecord;
  ko: string;
  en: string;
}> = [
  {
    title: "add_node with a label",
    call: call("add_node", { type: "http", label: "Fetch order" }),
    ko: "+ Fetch order",
    en: "+ Fetch order",
  },
  {
    title: "add_node without label or type",
    call: call("add_node", {}),
    ko: "+ 노드",
    en: "+ node",
  },
  {
    title: "update_node with patch keys",
    call: call("update_node", { id: "n1", patch: { url: 1, method: 2 } }),
    ko: "✎ url, method",
    en: "✎ url, method",
  },
  {
    title: "update_node without patch keys",
    call: call("update_node", { id: "n1", patch: {} }),
    ko: "✎ 노드",
    en: "✎ node",
  },
  {
    title: "remove_node",
    call: call("remove_node", { id: "n1" }),
    ko: "− 노드",
    en: "− node",
  },
  {
    title: "add_edge",
    call: call("add_edge", { source: "a", target: "b" }),
    ko: "→ 연결선",
    en: "→ edge",
  },
  {
    title: "remove_edge",
    call: call("remove_edge", { id: "e1" }),
    ko: "− 연결선",
    en: "− edge",
  },
  {
    title: "list_integrations",
    call: call("list_integrations"),
    ko: "통합 목록",
    en: "integrations",
  },
  {
    title: "list_workflows",
    call: call("list_workflows"),
    ko: "워크플로우 목록",
    en: "workflows",
  },
  {
    title: "get_workflow",
    call: call("get_workflow", { id: "wf-2" }),
    ko: "워크플로우 참조",
    en: "workflow ref",
  },
  {
    title: "get_node_schema",
    call: call("get_node_schema", { type: "http_request" }),
    ko: "스키마: http_request",
    en: "schema: http_request",
  },
  {
    title: "list_knowledge_bases",
    call: call("list_knowledge_bases"),
    ko: "지식 저장소 목록",
    en: "knowledge bases",
  },
  {
    title: "get_workflow_executions without status or result",
    call: call("get_workflow_executions", {}, null),
    ko: "실행 내역",
    en: "executions",
  },
  {
    title: "get_workflow_executions with status and items",
    call: call(
      "get_workflow_executions",
      { status: "failed" },
      { ok: true, items: [{}, {}, {}] },
    ),
    ko: "실행 내역 (failed): 3건",
    en: "executions (failed): 3",
  },
  {
    title: "get_workflow_executions with items only",
    call: call("get_workflow_executions", {}, { ok: true, items: [] }),
    ko: "실행 내역: 0건",
    en: "executions: 0",
  },
  {
    title: "get_execution_details without timeline",
    call: call("get_execution_details", { executionId: "x" }, null),
    ko: "실행 상세",
    en: "execution detail",
  },
  {
    title: "get_execution_details with timeline",
    call: call(
      "get_execution_details",
      { executionId: "x" },
      { ok: true, timeline: [{}, {}] },
    ),
    ko: "실행 상세: 노드 2개",
    en: "execution detail: 2 nodes",
  },
  {
    title: "unknown tool falls back to the tool name",
    call: call("propose_plan"),
    ko: "propose_plan",
    en: "propose_plan",
  },
];

function badgeText(c: AssistantToolCallRecord, count?: number): string {
  const { container } = render(<ToolCallBadge call={c} count={count} />);
  return container.querySelector("span.truncate")?.textContent ?? "";
}

describe("ToolCallBadge summary i18n", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });
  afterEach(() => cleanup());

  it.each(CASES)("renders the Korean summary: $title", ({ call: c, ko }) => {
    expect(badgeText(c)).toBe(ko);
  });

  it.each(CASES)("renders the English summary: $title", ({ call: c, en }) => {
    useLocaleStore.setState({ locale: "en" });
    expect(badgeText(c)).toBe(en);
  });

  it("keeps the group count and retry suffix around the localized summary", () => {
    const { container } = render(
      <ToolCallBadge call={call("add_edge")} count={3} retried />,
    );
    expect(container.querySelector("span.truncate")?.textContent).toBe(
      "→ 연결선 × 3 (재시도 후 성공)",
    );
  });
});
