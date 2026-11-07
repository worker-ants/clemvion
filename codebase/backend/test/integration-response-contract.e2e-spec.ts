import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  pickMatchingContract,
} from '../src/shared/testing/response-contract';
import {
  IntegrationActivityDto,
  IntegrationDto,
  TestConnectionResultDto,
} from '../src/modules/integrations/dto/responses/integration-response.dto';

/**
 * e2e: 통합 상세 · 목록 · 활동 · 연결 테스트 응답이 응답 DTO 선언과 맞는가(API 규약 §5.5 「부재 표현」).
 *
 * - `IntegrationDto`: 상태 사유 · 마지막 오류는 엔티티 컬럼이라 늘 실리고 값이 없으면 `null` 이다. 상태 사유는 행을
 *   직접 고쳐 값이 있는 경우도 대조한다. 마지막 오류는 암호화 컬럼이라 SQL 로 심을 수 없어 `null` 인 경우만 본다.
 * - `IntegrationActivityDto`: 활동 로그 행을 그대로 싣는다. 실패 행(오류 · 호출 API 식별 있음)과 성공 행(둘 다 없음)을
 *   함께 심어 두 모양을 모두 대조한다. 활동 로그는 노드 실행에 묶이므로 워크플로우 · 노드 실행을 먼저 만든다.
 * - `TestConnectionResultDto`: `message` 는 성공 · 실패 모두 실린다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('통합 응답의 계약 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  function headers() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  async function createIntegration(
    body: Record<string, unknown>,
  ): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/integrations')
      .set(headers())
      .send({ name: uniqueName('irc'), scope: 'personal', ...body });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  /** 활동 로그가 가리킬 워크플로우와 노드 실행을 만든다. */
  async function createNodeExecution(): Promise<{
    workflowId: string;
    nodeExecutionId: string;
  }> {
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set(headers())
      .send({ name: uniqueName('irc-wf') });
    expect(wf.status).toBe(201);
    const workflowId = (wf.body.data as { id: string }).id;
    const node = await db.query<{ id: string }>(
      'SELECT id FROM node WHERE workflow_id = $1 LIMIT 1',
      [workflowId],
    );
    const executionId = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, status, started_at)
       VALUES ($1, $2, 'completed', NOW())`,
      [executionId, workflowId],
    );
    const nodeExecutionId = randomUUID();
    await db.query(
      `INSERT INTO node_execution (id, execution_id, node_id, status, started_at)
       VALUES ($1, $2, $3, 'completed', NOW())`,
      [nodeExecutionId, executionId, node.rows[0].id],
    );
    return { workflowId, nodeExecutionId };
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('irc'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(BASE_URL, token, uniqueName('IRC'));
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('상세 · 목록 — 상태 사유 · 마지막 오류가 없으면 null 로 실리고 값이 있으면 문자열이다', async () => {
    const contract = await contractForDto(IntegrationDto);
    const id = await createIntegration({
      serviceType: 'http',
      authType: 'bearer_token',
      credentials: { token: 'irc-token' },
    });

    const detail = await request(BASE_URL)
      .get(`/api/integrations/${id}`)
      .set(headers());
    expect(detail.status).toBe(200);
    assertMatchesContract(detail.body.data, contract);
    expect(detail.body.data).toHaveProperty('statusReason', null);
    expect(detail.body.data).toHaveProperty('lastError', null);

    const list = await request(BASE_URL)
      .get('/api/integrations')
      .set(headers());
    expect(list.status).toBe(200);
    pickMatchingContract(
      list.body.data as Array<{ id: string }>,
      (i) => i.id === id,
      contract,
    );

    await db.query(
      `UPDATE integration SET status = 'error', status_reason = 'irc_probe_failed' WHERE id = $1`,
      [id],
    );
    const errored = await request(BASE_URL)
      .get(`/api/integrations/${id}`)
      .set(headers());
    expect(errored.status).toBe(200);
    assertMatchesContract(errored.body.data, contract);
    expect(errored.body.data).toMatchObject({
      status: 'error',
      statusReason: 'irc_probe_failed',
    });
  });

  it('활동 — 실패 행과 성공 행이 모두 IntegrationActivityDto 와 맞는다', async () => {
    const id = await createIntegration({
      serviceType: 'http',
      authType: 'bearer_token',
      credentials: { token: 'irc-token' },
    });
    const { workflowId, nodeExecutionId } = await createNodeExecution();
    await db.query(
      `INSERT INTO integration_usage_log
         (integration_id, node_execution_id, workflow_id, status, error, duration_ms, at, api_label, api_method, api_path)
       VALUES
         ($1, $2, $3, 'failed', '{"code":"HTTP_502","message":"Bad Gateway"}'::jsonb, 120,
          NOW() - INTERVAL '1 minute', NULL, 'GET', 'api.example.com/orders'),
         ($1, $2, $3, 'success', NULL, 80, NOW(), NULL, NULL, NULL)`,
      [id, nodeExecutionId, workflowId],
    );

    const res = await request(BASE_URL)
      .get(`/api/integrations/${id}/activity`)
      .set(headers());
    expect(res.status).toBe(200);
    assertMatchesContract(
      res.body.data,
      await contractForDto(IntegrationActivityDto),
    );
    const items = res.body.data.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.status === 'failed')).toMatchObject({
      integrationId: id,
      nodeExecutionId,
      workflowId,
      error: { code: 'HTTP_502', message: 'Bad Gateway' },
      durationMs: 120,
      apiLabel: null,
      apiMethod: 'GET',
      apiPath: 'api.example.com/orders',
    });
    expect(items.find((i) => i.status === 'success')).toMatchObject({
      error: null,
      apiLabel: null,
      apiMethod: null,
      apiPath: null,
    });
  });

  it('연결 테스트 — 성공 · 실패 응답 모두 TestConnectionResultDto 와 맞고 message 가 실린다', async () => {
    const contract = await contractForDto(TestConnectionResultDto);

    // base_url 이 없는 HTTP 통합은 테스터가 외부를 부르지 않는다.
    const httpId = await createIntegration({
      serviceType: 'http',
      authType: 'bearer_token',
      credentials: { token: 'irc-token' },
    });
    // compose 의 postgres 서비스는 사설 대역이라 SSRF 가드에 막혀 실패한다.
    const dbId = await createIntegration({
      serviceType: 'database',
      authType: 'connection_string',
      credentials: {
        driver: 'postgres',
        host: 'postgres',
        port: 5432,
        database: 'clemvion_e2e',
        username: 'clemvion',
        password: 'clemvion-e2e',
        ssl: 'disable',
      },
    });

    const outcomes = new Set<boolean>();
    for (const id of [httpId, dbId]) {
      const res = await request(BASE_URL)
        .post(`/api/integrations/${id}/test`)
        .set(headers())
        .send();
      expect(res.status).toBe(200);
      assertMatchesContract(res.body.data, contract);
      expect(typeof res.body.data.message).toBe('string');
      outcomes.add(res.body.data.success as boolean);
    }
    // 성공과 실패를 하나씩 봤는지 확인한다. 둘 다 같은 결과면 한쪽 모양을 대조하지 못한 것이다.
    expect([...outcomes].sort()).toEqual([false, true]);
  });
});
