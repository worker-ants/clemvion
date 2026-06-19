import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 통합(Integration) 사용처 추적이 직접 참조(node.config.integrationId) ∪
 * MCP 참조(AI Agent node.config.mcpServers[].integrationId) 합집합을 실 PostgreSQL
 * 의 jsonb `@>` containment + CASE 분기로 정확히 산출하는지 검증한다.
 * (spec/4-nodes/4-integration §7 사용처 추적 — usageKind 'direct'|'mcp').
 *
 * 단위테스트(integrations.service.spec.ts)는 QueryBuilder mock 이라 `@>` containment
 * 와 CASE 식 자체를 실행하지 못한다. 이 핵심 SQL 동작은 실 PG 에서만 검증 가능하므로
 * 본 e2e 가 그 책임을 진다:
 *   - 직접 참조 노드 A → usageKind='direct'
 *   - MCP 참조 노드 B (AI Agent) → usageKind='mcp'
 *   - 무관한 통합 id 만 가진 노드 C → false-positive 미포함
 *   - DELETE 가 MCP-only 참조만 있어도 409 INTEGRATION_IN_USE 로 차단
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

interface UsageNode {
  id: string;
  label: string;
  type: string;
  usageKind: 'direct' | 'mcp';
}
interface UsageWorkflow {
  workflowId: string;
  workflowName: string;
  isActive: boolean;
  nodes: UsageNode[];
}

describe('Integration usage tracking — direct ∪ MCP (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('usagemcp'), db);
    token = owner.accessToken;
    userId = owner.userId;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('USAGEMCP'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  /** http api_key 통합 1건 생성 (REST 경로). 생성된 integration id 반환. */
  async function createIntegration(name: string): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/integrations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        serviceType: 'http',
        name,
        authType: 'api_key',
        credentials: {
          base_url: 'https://api.example.com',
          location: 'header',
          key_name: 'X-Api-Key',
          value: 'secret',
        },
        scope: 'personal',
      });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  /** workflow 1건 INSERT. 생성된 workflow id 반환. */
  async function insertWorkflow(name: string): Promise<string> {
    const row = await db.query<{ id: string }>(
      `INSERT INTO workflow (workspace_id, name, is_active, created_by)
         VALUES ($1, $2, true, $3)
         RETURNING id`,
      [workspaceId, name, userId],
    );
    return row.rows[0].id;
  }

  /** node 1건 INSERT (config 는 jsonb). 생성된 node id 반환. */
  async function insertNode(
    workflowId: string,
    type: string,
    category: string,
    label: string,
    config: Record<string, unknown>,
  ): Promise<string> {
    const row = await db.query<{ id: string }>(
      `INSERT INTO node (workflow_id, type, category, label, config)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING id`,
      [workflowId, type, category, label, JSON.stringify(config)],
    );
    return row.rows[0].id;
  }

  async function getUsages(integrationId: string): Promise<UsageWorkflow[]> {
    const res = await request(BASE_URL)
      .get(`/api/integrations/${integrationId}/usages`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    return (res.body.data as UsageWorkflow[]) ?? [];
  }

  it('A. tracks both direct (config.integrationId) and MCP (mcpServers[].integrationId) references, excluding unrelated nodes', async () => {
    const intId = await createIntegration(uniqueName('usage-tracked'));
    const otherIntId = await createIntegration(uniqueName('usage-unrelated'));
    const workflowId = await insertWorkflow(uniqueName('WF-usage'));

    // 노드 A: 직접 참조
    const nodeA = await insertNode(
      workflowId,
      'http-request',
      'integration',
      'Direct HTTP',
      { integrationId: intId },
    );
    // 노드 B: AI Agent MCP 참조
    const nodeB = await insertNode(workflowId, 'ai-agent', 'ai', 'AI Agent', {
      mcpServers: [{ integrationId: intId, enabledTools: [] }],
    });
    // 노드 C: 무관한 통합 id 만 MCP 참조 → false-positive 미포함 검증
    const nodeC = await insertNode(
      workflowId,
      'ai-agent',
      'ai',
      'AI Agent (other)',
      { mcpServers: [{ integrationId: otherIntId, enabledTools: [] }] },
    );

    const usages = await getUsages(intId);
    const allNodes = usages.flatMap((w) => w.nodes);
    const byId = new Map(allNodes.map((n) => [n.id, n]));

    // @> containment + CASE 의 실 PG 동작 검증.
    expect(byId.get(nodeA)?.usageKind).toBe('direct');
    expect(byId.get(nodeB)?.usageKind).toBe('mcp');
    expect(byId.has(nodeC)).toBe(false);
    expect(allNodes).toHaveLength(2);
  }, 30_000);

  it('B. blocks DELETE with 409 INTEGRATION_IN_USE even when only an MCP reference exists', async () => {
    const intId = await createIntegration(uniqueName('usage-mcponly'));
    const workflowId = await insertWorkflow(uniqueName('WF-mcponly'));
    // MCP-only 참조 (직접 참조 노드 없음)
    await insertNode(workflowId, 'ai-agent', 'ai', 'AI Agent only', {
      mcpServers: [{ integrationId: intId, enabledTools: [] }],
    });

    // 사전 확인: 사용처가 MCP 1건으로 잡혀야 한다.
    const usages = await getUsages(intId);
    const mcpNodes = usages.flatMap((w) => w.nodes);
    expect(mcpNodes).toHaveLength(1);
    expect(mcpNodes[0].usageKind).toBe('mcp');

    const del = await request(BASE_URL)
      .delete(`/api/integrations/${intId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(del.status).toBe(409);
    // GlobalExceptionFilter 가 nested `{ error: { code, message } }` 로 직렬화한다.
    expect(del.body.error?.code).toBe('INTEGRATION_IN_USE');
  }, 30_000);

  it('C. direct precedence (spec §7.1) and multi-entry mcpServers matched by real-PG @>/CASE', async () => {
    const intId = await createIntegration(uniqueName('usage-prec'));
    const otherIntId = await createIntegration(uniqueName('usage-prec-other'));
    const workflowId = await insertWorkflow(uniqueName('WF-prec'));

    // 노드 BOTH: 직접 참조와 MCP 참조에 동시 해당.
    // spec §7.1 — direct 우선. 실 PG 의 CASE(WHEN ->>'integrationId'=id THEN 'direct'
    // ELSE 'mcp') 가 단일 row 를 'direct' 로 반환해야 하며, OR 두 조건 모두 매칭해도
    // 노드가 중복(2건)으로 나오지 않아야 한다 (innerJoin + 단일 node row).
    const nodeBoth = await insertNode(
      workflowId,
      'ai-agent',
      'ai',
      'AI Agent (direct + mcp)',
      {
        integrationId: intId,
        mcpServers: [{ integrationId: intId, enabledTools: [] }],
      },
    );

    // 노드 MULTI: mcpServers 배열의 2번째 항목이 대상. `@>` containment 가
    // 인덱스 0 뿐 아니라 임의 위치 항목을 매칭하는지 실 PG 로 검증.
    const nodeMulti = await insertNode(
      workflowId,
      'ai-agent',
      'ai',
      'AI Agent (multi mcp)',
      {
        mcpServers: [
          { integrationId: otherIntId, enabledTools: [] },
          { integrationId: intId, enabledTools: ['x'] },
        ],
      },
    );

    const usages = await getUsages(intId);
    const allNodes = usages.flatMap((w) => w.nodes);
    const byId = new Map(allNodes.map((n) => [n.id, n]));

    // direct 우선: 양쪽 매칭 노드는 단일 'direct' 항목으로만 나타난다 (중복 없음).
    const bothOccurrences = allNodes.filter((n) => n.id === nodeBoth);
    expect(bothOccurrences).toHaveLength(1);
    expect(byId.get(nodeBoth)?.usageKind).toBe('direct');

    // 배열 비-0 인덱스 매칭 → 'mcp'.
    expect(byId.get(nodeMulti)?.usageKind).toBe('mcp');

    expect(allNodes).toHaveLength(2);
  }, 30_000);
});
