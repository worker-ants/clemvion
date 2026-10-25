import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  canUseIntegrationInWorkflow,
  clearUnusableIntegrationRefs,
  clearUnusableIntegrationRefsInNodes,
  type IntegrationRefFilterContext,
  type VisibleIntegration,
} from "../node-integration-refs";

const ALICE = "user-alice";
const BOB = "user-bob";

const integrations = new Map<string, VisibleIntegration>([
  ["org-1", { scope: "organization", createdBy: BOB }],
  ["alice-personal", { scope: "personal", createdBy: ALICE }],
]);

/** Alice 가 Bob 이 작성한 워크플로우에 붙여 넣는다. */
const aliceInBobsWorkflow: IntegrationRefFilterContext = {
  currentUserId: ALICE,
  workflowAuthorId: BOB,
  integrations,
};
/** Alice 가 자기가 작성한 워크플로우에 붙여 넣는다. */
const aliceInOwnWorkflow: IntegrationRefFilterContext = {
  ...aliceInBobsWorkflow,
  workflowAuthorId: ALICE,
};

describe("canUseIntegrationInWorkflow", () => {
  it("조직 통합은 워크플로우 작성자가 아니어도 쓴다", () => {
    expect(
      canUseIntegrationInWorkflow(integrations.get("org-1")!, ALICE, BOB),
    ).toBe(true);
  });

  it("개인 통합은 지금 사용자가 통합 소유자이면서 워크플로우 작성자일 때만 쓴다", () => {
    const personal = integrations.get("alice-personal")!;
    expect(canUseIntegrationInWorkflow(personal, ALICE, ALICE)).toBe(true);
    expect(canUseIntegrationInWorkflow(personal, ALICE, BOB)).toBe(false);
    expect(canUseIntegrationInWorkflow(personal, BOB, BOB)).toBe(false);
  });
});

describe("clearUnusableIntegrationRefs", () => {
  it("워크스페이스의 조직 통합은 남긴다", () => {
    const config = { integrationId: "org-1", to: "a@example.com" };
    expect(
      clearUnusableIntegrationRefs("send_email", config, aliceInBobsWorkflow),
    ).toEqual({ config, cleared: false });
  });

  it("지금 사용자의 개인 통합은 자기 워크플로우에서만 남긴다", () => {
    const config = { integrationId: "alice-personal", query: "select 1" };
    expect(
      clearUnusableIntegrationRefs("database_query", config, aliceInOwnWorkflow),
    ).toEqual({ config, cleared: false });
    expect(
      clearUnusableIntegrationRefs(
        "database_query",
        config,
        aliceInBobsWorkflow,
      ),
    ).toEqual({ config: { query: "select 1" }, cleared: true });
  });

  it("목록에 없는 통합(남의 개인 통합 · 없는 통합)은 비운다", () => {
    expect(
      clearUnusableIntegrationRefs(
        "cafe24",
        { integrationId: "bob-personal", operation: "x" },
        aliceInOwnWorkflow,
      ),
    ).toEqual({ config: { operation: "x" }, cleared: true });
  });

  it("문자열이 아닌 참조 값은 어느 통합도 가리키지 못하므로 비운다", () => {
    expect(
      clearUnusableIntegrationRefs(
        "makeshop",
        { integrationId: 42 },
        aliceInOwnWorkflow,
      ),
    ).toEqual({ config: {}, cleared: true });
  });

  it("표현식 참조와 고르지 않은 자리는 건드리지 않는다", () => {
    for (const integrationId of ["{{ $vars.integration }}", "", null]) {
      const config = { integrationId };
      expect(
        clearUnusableIntegrationRefs("send_email", config, aliceInBobsWorkflow),
      ).toEqual({ config, cleared: false });
    }
  });

  it("HTTP Request 는 authentication 이 integration 일 때만 본다", () => {
    const basic = { authentication: "none", integrationId: "bob-personal" };
    expect(
      clearUnusableIntegrationRefs("http_request", basic, aliceInOwnWorkflow),
    ).toEqual({ config: basic, cleared: false });
    expect(
      clearUnusableIntegrationRefs(
        "http_request",
        { ...basic, authentication: "integration" },
        aliceInOwnWorkflow,
      ),
    ).toEqual({ config: { authentication: "integration" }, cleared: true });
  });

  it("AI 에이전트는 쓸 수 없는 MCP 서버 항목만 노출 도구 설정째 뺀다", () => {
    const config = {
      model: "m",
      mcpServers: [
        { integrationId: "org-1", enabledTools: ["a"] },
        { integrationId: "alice-personal", enabledTools: ["b"] },
        { integrationId: "{{ $vars.mcp }}" },
        { integrationId: "gone", includePrompts: true },
      ],
    };
    expect(
      clearUnusableIntegrationRefs("ai_agent", config, aliceInBobsWorkflow),
    ).toEqual({
      config: {
        model: "m",
        mcpServers: [
          { integrationId: "org-1", enabledTools: ["a"] },
          { integrationId: "{{ $vars.mcp }}" },
        ],
      },
      cleared: true,
    });
    // 받은 config 는 바꾸지 않는다.
    expect(config.mcpServers).toHaveLength(4);
  });

  it("통합 참조 자리가 없는 노드는 같은 키가 있어도 보지 않는다", () => {
    const config = { integrationId: "gone" };
    expect(
      clearUnusableIntegrationRefs("code", config, aliceInOwnWorkflow),
    ).toEqual({ config, cleared: false });
  });

  it.each<[string, Partial<IntegrationRefFilterContext>]>([
    ["통합 목록이 확정되지 않았으면", { integrations: null }],
    ["워크플로우 작성자를 모르면", { workflowAuthorId: null }],
    ["지금 사용자를 모르면", { currentUserId: null }],
  ])("%s 비우지 않는다", (_label, patch) => {
    const config = { integrationId: "gone" };
    expect(
      clearUnusableIntegrationRefs("send_email", config, {
        ...aliceInBobsWorkflow,
        ...patch,
      }),
    ).toEqual({ config, cleared: false });
  });
});

describe("clearUnusableIntegrationRefsInNodes", () => {
  const node = (id: string, data: Record<string, unknown>): Node => ({
    id,
    type: "custom",
    position: { x: 0, y: 0 },
    data,
  });

  it("비운 노드의 레이블을 순서대로 돌려주고 나머지 노드는 그대로 둔다", () => {
    const untouched = node("n2", {
      type: "send_email",
      label: "Notify",
      config: { integrationId: "org-1" },
    });
    const { nodes, clearedLabels } = clearUnusableIntegrationRefsInNodes(
      [
        node("n1", {
          type: "database_query",
          label: "Query 2",
          config: { integrationId: "alice-personal" },
        }),
        untouched,
        node("n3", {
          type: "ai_agent",
          label: "Agent",
          config: { mcpServers: [{ integrationId: "gone" }] },
        }),
      ],
      aliceInBobsWorkflow,
    );
    expect(clearedLabels).toEqual(["Query 2", "Agent"]);
    expect(nodes[0].data).toEqual({
      type: "database_query",
      label: "Query 2",
      config: {},
    });
    expect(nodes[1]).toBe(untouched);
    expect(nodes[2].data.config).toEqual({ mcpServers: [] });
  });
});
