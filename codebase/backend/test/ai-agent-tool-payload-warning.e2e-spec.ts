import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: AI Agent 도구 정의 payload 예산 저장 시점 경고(backend-only graph warning
 * `ai_agent:tool-payload-budget`)가 실 인프라(HTTP → WorkflowsService → PG 통합
 * 조회 → credentials 복호화 transformer → 정적 도구 카탈로그 재현 → 예산 판정)를
 * 통해 `GET /workflows/:id/graph-warnings` 응답에 표면화되는지 검증한다.
 *
 * 단위/통합 테스트(tool-payload-save-warning.spec.ts, workflows.service.spec.ts)는
 * integration repository 를 mock 하므로 실제 DB 조회·credentials 복호화·Nest DI
 * 배선(Integration repo → WorkflowsModule)을 실행하지 못한다. 본 e2e 가 그 책임을
 * 진다. SoT: spec/4-nodes/3-ai/1-ai-agent.md §4.2·§10, cross-node-warning-rules §5·§8.
 *
 * 결정성: makeshop 정적 카탈로그(163 operation)는 기본 개수 상한(128, 별도 컨테이너
 * e2e 라 env override 불가)을 초과하므로 connected makeshop 통합을 참조하는 ai_agent
 * 노드는 기본 예산으로도 warning 을 확정 발화한다 (strict-save off 기본 → severity
 * warning, 저장 차단 없음).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const RULE_ID = 'ai_agent:tool-payload-budget';

interface GraphWarning {
  ruleId: string;
  severity: 'error' | 'warning';
  nodeId: string;
  message: string;
  params?: Record<string, string | number>;
}
interface GraphWarningsResponse {
  results: GraphWarning[];
  hasError: boolean;
  hasWarning: boolean;
}

describe('AI Agent tool-payload budget — config-time graph warning (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('toolbudget'), db);
    token = owner.accessToken;
    userId = owner.userId;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('TOOLBUDGET'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  /**
   * connected makeshop 통합 1건을 만든다. REST(http api_key) 로 생성해
   * credentials 를 앱 transformer 로 정상 암호화·복호화 가능하게 심은 뒤,
   * service_type/status 만 SQL 로 makeshop·connected 로 전환한다 (OAuth 흐름을
   * e2e 에서 재현하지 않고 카탈로그 재현 전제만 충족). makeshop 은 granted-scope
   * pre-filter 가 없어 credentials 내용과 무관하게 전체 카탈로그를 재현한다.
   */
  async function createConnectedMakeshop(name: string): Promise<string> {
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
    const id = (res.body.data as { id: string }).id;
    await db.query(
      `UPDATE integration SET service_type = 'makeshop', status = 'connected' WHERE id = $1`,
      [id],
    );
    return id;
  }

  async function insertWorkflow(name: string): Promise<string> {
    const row = await db.query<{ id: string }>(
      `INSERT INTO workflow (workspace_id, name, is_active, created_by)
         VALUES ($1, $2, true, $3) RETURNING id`,
      [workspaceId, name, userId],
    );
    return row.rows[0].id;
  }

  async function insertNode(
    workflowId: string,
    type: string,
    category: string,
    label: string,
    config: Record<string, unknown>,
  ): Promise<string> {
    const row = await db.query<{ id: string }>(
      `INSERT INTO node (workflow_id, type, category, label, config)
         VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [workflowId, type, category, label, JSON.stringify(config)],
    );
    return row.rows[0].id;
  }

  async function getGraphWarnings(
    workflowId: string,
  ): Promise<GraphWarningsResponse> {
    const res = await request(BASE_URL)
      .get(`/api/workflows/${workflowId}/graph-warnings`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    return res.body.data as GraphWarningsResponse;
  }

  it('surfaces the tool-payload budget warning for an ai_agent node bound to a connected makeshop integration', async () => {
    const intId = await createConnectedMakeshop(uniqueName('toolbudget-ms'));
    const workflowId = await insertWorkflow(uniqueName('wf-toolbudget'));
    const nodeId = await insertNode(workflowId, 'ai_agent', 'ai', 'Agent', {
      mcpServers: [{ integrationId: intId }],
    });

    const { results, hasWarning, hasError } = await getGraphWarnings(workflowId);

    const budget = results.find((r) => r.ruleId === RULE_ID);
    expect(budget).toBeDefined();
    expect(budget!.severity).toBe('warning');
    expect(budget!.nodeId).toBe(nodeId);
    // params 로 노드 라벨·수치가 분리 노출 (i18n Principle 3-C).
    expect(budget!.params?.node).toBe('Agent');
    expect(typeof budget!.params?.bytes).toBe('number');
    // 기본(strict-save off) 이므로 warning 이며 저장 차단(error)이 아니다.
    expect(hasWarning).toBe(true);
    expect(hasError).toBe(false);
  });

  it('does not warn for an ai_agent node without mcpServers (control)', async () => {
    const workflowId = await insertWorkflow(uniqueName('wf-nowarn'));
    await insertNode(workflowId, 'ai_agent', 'ai', 'Agent', {});

    const { results } = await getGraphWarnings(workflowId);
    expect(results.some((r) => r.ruleId === RULE_ID)).toBe(false);
  });
});
