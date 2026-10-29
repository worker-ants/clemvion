import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { IntegrationRefFilterContext } from "@/lib/integrations/node-integration-refs";
import { buildDuplicatedNode, NODE_DUPLICATE_OFFSET_PX } from "../duplicate-node";

/** Alice 가 Bob 이 작성한 워크플로우에서 노드 컨텍스트 메뉴로 복제한다. Alice 의 개인 통합은 여기서 쓸 수 없다. */
const aliceInBobsWorkflow: IntegrationRefFilterContext = {
  currentUserId: "alice",
  workflowAuthorId: "bob",
  integrations: new Map([
    ["org-1", { scope: "organization", createdBy: "bob" }],
    ["alice-personal", { scope: "personal", createdBy: "alice" }],
  ]),
};

const mail = (integrationId: string): Node => ({
  id: "n1",
  type: "custom",
  position: { x: 10, y: 20 },
  data: {
    type: "send_email",
    label: "Mail",
    config: { integrationId, to: "x" },
  },
});

describe("buildDuplicatedNode — 노드 컨텍스트 메뉴 «복제» (REQ-EDITOR-059)", () => {
  it("쓸 수 없는 통합 참조는 비우고 새 레이블로 알린다", () => {
    const { node, clearedLabels } = buildDuplicatedNode(
      mail("alice-personal"),
      "Mail",
      ["Mail"],
      aliceInBobsWorkflow,
    );
    expect(node.data).toMatchObject({
      label: "Mail 2",
      config: { to: "x" },
    });
    expect(
      (node.data as { config: Record<string, unknown> }).config,
    ).not.toHaveProperty("integrationId");
    expect(clearedLabels).toEqual(["Mail 2"]);
  });

  it("조직 통합 참조는 남기고 경고하지 않는다", () => {
    const { node, clearedLabels } = buildDuplicatedNode(
      mail("org-1"),
      "Mail",
      ["Mail"],
      aliceInBobsWorkflow,
    );
    expect(node.data).toMatchObject({
      config: { integrationId: "org-1", to: "x" },
    });
    expect(clearedLabels).toEqual([]);
  });

  it("비울 근거를 모르면(통합 목록 미확정) 비우지 않는다", () => {
    const { node, clearedLabels } = buildDuplicatedNode(
      mail("alice-personal"),
      "Mail",
      ["Mail"],
      { ...aliceInBobsWorkflow, integrations: null },
    );
    expect(node.data).toMatchObject({
      config: { integrationId: "alice-personal", to: "x" },
    });
    expect(clearedLabels).toEqual([]);
  });

  it("새 id 와 어긋난 위치를 주고 원본 노드를 바꾸지 않는다", () => {
    const original = mail("alice-personal");
    const { node } = buildDuplicatedNode(
      original,
      "Mail",
      ["Mail"],
      aliceInBobsWorkflow,
    );
    expect(node.id).not.toBe(original.id);
    expect(node.type).toBe("custom");
    expect(node.position).toEqual({
      x: 10 + NODE_DUPLICATE_OFFSET_PX,
      y: 20 + NODE_DUPLICATE_OFFSET_PX,
    });
    expect(
      (original.data as { config: Record<string, unknown> }).config,
    ).toEqual({ integrationId: "alice-personal", to: "x" });
  });
});
