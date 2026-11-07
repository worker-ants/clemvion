import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
} from '../src/shared/testing/response-contract';
import { DashboardSummaryDto } from '../src/modules/dashboard/dto/responses/dashboard-response.dto';
import {
  LlmUsageSummaryDto,
  StatisticsSummaryDto,
} from '../src/modules/statistics/dto/responses/statistics-response.dto';

/**
 * e2e: 대시보드 · 통계 요약 응답이 응답 DTO 선언과 맞는가(API 규약 §5.5 「부재 표현」).
 *
 * 세 요약은 서비스가 값을 계산해 돌려준다. 증감률 · 비용 · 상위 provider 는 비교할 직전 구간이나 비용 기록이 없으면
 * `null` 이다. 그래서 같은 DTO 를 **null 인 응답과 값이 있는 응답** 두 번 대조한다. 한쪽만 보면 선언이 그 경우를
 * 덮는지 알 수 없다. 각 경우가 실제로 일어났는지는 값 단언으로 따로 확인한다. 계약 대조만으로는 시드가 빗나가
 * 두 응답이 같은 모양이 돼도 통과한다.
 *
 * 실행 · LLM 사용 기록은 SQL 로 심는다. 실행 엔진을 돌리면 시각(`started_at` · `created_at`)을 직전 구간에 둘 수 없다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('대시보드 · 통계 요약 응답의 계약 (e2e)', () => {
  let db: Client;
  let token: string;
  /** 실행 · 사용 기록을 심는 워크스페이스 */
  let workspaceId: string;
  /** 아무것도 심지 않는 워크스페이스 — 직전 구간이 비어 있는 경우 */
  let emptyWorkspaceId: string;
  /** 현재 구간과 직전 구간 모두에 실행이 있는 워크플로우 */
  let busyWorkflowId: string;
  /** 현재 구간에만 실행이 있는 워크플로우 */
  let quietWorkflowId: string;

  function headers(ws: string) {
    return { Authorization: `Bearer ${token}`, 'X-Workspace-Id': ws } as const;
  }

  async function createWorkflow(ws: string, name: string): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set(headers(ws))
      .send({ name });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  async function seedExecution(
    workflowId: string,
    daysAgo: number,
  ): Promise<void> {
    const at = new Date(Date.now() - daysAgo * DAY_MS);
    await db.query(
      `INSERT INTO execution (workflow_id, status, started_at, finished_at, duration_ms)
       VALUES ($1, 'completed', $2, $2, 1200)`,
      [workflowId, at],
    );
  }

  async function seedLlmUsage(row: {
    workflowId: string;
    provider: string;
    model: string;
    totalTokens: number;
    costUsd: number | null;
  }): Promise<void> {
    await db.query(
      `INSERT INTO llm_usage_log
         (workspace_id, workflow_id, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd)
       VALUES ($1, $2, $3, $4, $5, 0, $5, $6)`,
      [
        workspaceId,
        row.workflowId,
        row.provider,
        row.model,
        row.totalTokens,
        row.costUsd,
      ],
    );
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('dsc'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(BASE_URL, token, uniqueName('DSC'));
    emptyWorkspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('DSC-empty'),
    );

    busyWorkflowId = await createWorkflow(workspaceId, uniqueName('dsc-busy'));
    quietWorkflowId = await createWorkflow(
      workspaceId,
      uniqueName('dsc-quiet'),
    );

    // busy: 현재 7일에 2건, 직전 7일(7~14일 전)에 1건 → 증감률 100%.
    await seedExecution(busyWorkflowId, 1);
    await seedExecution(busyWorkflowId, 2);
    await seedExecution(busyWorkflowId, 10);
    // quiet: 현재 7일에 1건뿐 → 워크플로우로 좁히면 증감률 null.
    await seedExecution(quietWorkflowId, 1);

    // busy 는 비용이 기록된 호출, quiet 는 비용을 모르는 호출만 둔다.
    await seedLlmUsage({
      workflowId: busyWorkflowId,
      provider: 'openai',
      model: 'dsc-priced',
      totalTokens: 300,
      costUsd: 0.25,
    });
    await seedLlmUsage({
      workflowId: quietWorkflowId,
      provider: 'local',
      model: 'dsc-unpriced',
      totalTokens: 100,
      costUsd: null,
    });
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  describe('DashboardSummaryDto', () => {
    it('직전 7일 실행이 없으면 runs7dChangePercent 는 null 로 실린다', async () => {
      const res = await request(BASE_URL)
        .get('/api/dashboard/summary')
        .set(headers(emptyWorkspaceId));
      expect(res.status).toBe(200);
      assertMatchesContract(
        res.body.data,
        await contractForDto(DashboardSummaryDto),
      );
      expect(res.body.data).toHaveProperty('runs7dChangePercent', null);
    });

    it('직전 7일 실행이 있으면 runs7dChangePercent 는 숫자다', async () => {
      const res = await request(BASE_URL)
        .get('/api/dashboard/summary')
        .set(headers(workspaceId));
      expect(res.status).toBe(200);
      assertMatchesContract(
        res.body.data,
        await contractForDto(DashboardSummaryDto),
      );
      // 현재 3건(busy 2 · quiet 1) 대 직전 1건 → 200%.
      expect(res.body.data).toMatchObject({
        runs7d: 3,
        runs7dPrevious: 1,
        runs7dChangePercent: 200,
      });
    });
  });

  describe('StatisticsSummaryDto', () => {
    it('직전 구간 실행이 없으면 totalExecutionsChangeRate 는 null 로 실린다', async () => {
      const res = await request(BASE_URL)
        .get('/api/statistics/summary')
        .query({ period: '7d', workflowId: quietWorkflowId })
        .set(headers(workspaceId));
      expect(res.status).toBe(200);
      assertMatchesContract(
        res.body.data,
        await contractForDto(StatisticsSummaryDto),
      );
      expect(res.body.data).toMatchObject({ totalExecutions: 1 });
      expect(res.body.data).toHaveProperty('totalExecutionsChangeRate', null);
    });

    it('직전 구간 실행이 있으면 totalExecutionsChangeRate 는 숫자다', async () => {
      const res = await request(BASE_URL)
        .get('/api/statistics/summary')
        .query({ period: '7d', workflowId: busyWorkflowId })
        .set(headers(workspaceId));
      expect(res.status).toBe(200);
      assertMatchesContract(
        res.body.data,
        await contractForDto(StatisticsSummaryDto),
      );
      expect(res.body.data).toMatchObject({
        totalExecutions: 2,
        totalExecutionsChangeRate: 100,
      });
    });
  });

  describe('LlmUsageSummaryDto', () => {
    it('기록이 없으면 totalCostUsd · topProvider 는 null 이고 byModel 은 비어 있다', async () => {
      const res = await request(BASE_URL)
        .get('/api/statistics/llm-usage/summary')
        .query({ period: '7d' })
        .set(headers(emptyWorkspaceId));
      expect(res.status).toBe(200);
      assertMatchesContract(
        res.body.data,
        await contractForDto(LlmUsageSummaryDto),
      );
      expect(res.body.data).toMatchObject({ totalTokens: 0, byModel: [] });
      expect(res.body.data).toHaveProperty('totalCostUsd', null);
      expect(res.body.data).toHaveProperty('topProvider', null);
    });

    it('비용을 모르는 호출만 있으면 totalCostUsd 와 모델별 costUsd 가 null 이다', async () => {
      const res = await request(BASE_URL)
        .get('/api/statistics/llm-usage/summary')
        .query({ period: '7d', workflowId: quietWorkflowId })
        .set(headers(workspaceId));
      expect(res.status).toBe(200);
      assertMatchesContract(
        res.body.data,
        await contractForDto(LlmUsageSummaryDto),
      );
      expect(res.body.data).toMatchObject({
        totalTokens: 100,
        topProvider: 'local',
        byModel: [{ provider: 'local', model: 'dsc-unpriced', costUsd: null }],
      });
      expect(res.body.data).toHaveProperty('totalCostUsd', null);
    });

    it('비용이 기록된 호출이 있으면 totalCostUsd 는 숫자다', async () => {
      const res = await request(BASE_URL)
        .get('/api/statistics/llm-usage/summary')
        .query({ period: '7d' })
        .set(headers(workspaceId));
      expect(res.status).toBe(200);
      assertMatchesContract(
        res.body.data,
        await contractForDto(LlmUsageSummaryDto),
      );
      expect(res.body.data).toMatchObject({
        totalTokens: 400,
        totalCostUsd: 0.25,
        topProvider: 'openai',
      });
    });
  });
});
