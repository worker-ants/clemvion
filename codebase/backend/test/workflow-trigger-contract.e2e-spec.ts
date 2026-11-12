import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as crypto from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { createTeamWorkspace, registerAndLogin } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  pickMatchingContract,
} from '../src/shared/testing/response-contract';
import { EdgeDto } from '../src/modules/edges/dto/responses/edge-response.dto';
import { NodeDto } from '../src/modules/nodes/dto/responses/node-response.dto';
import { ScheduleDto } from '../src/modules/schedules/dto/responses/schedule-response.dto';
import {
  TriggerDto,
  TriggerHistoryItemDto,
} from '../src/modules/triggers/dto/responses/trigger-response.dto';
import {
  ExportWorkflowDto,
  WorkflowDto,
} from '../src/modules/workflows/dto/responses/workflow-response.dto';

/**
 * e2e: 워크플로 · 노드 · 엣지 · 스케줄 · 트리거 응답의 nullable 필드가 응답 DTO 선언과 맞는가
 * (API 규약 §5.5 「부재 표현」).
 *
 * 값이 없을 때 `null` 을 싣는 필드는 선언이 `required` + `nullable` 이어야 한다. 필드마다 **null 인 응답과 값이 있는
 * 응답**을 둘 다 대조하고, 각 경우가 실제로 일어났는지는 값 단언으로 따로 확인한다.
 *
 * `TriggerDto.nextRunAt` 은 키 생략형이다. 같은 묶음의 `cronExpression` · `timezone` 처럼 스케줄 트리거의 조회
 * 응답에만 덧붙는다. 다음 실행 시각이 비면(cron 해석 실패 등) 키를 빼고 `null` 을 싣지 않는다.
 *
 * 마지막 실행 시각 · 다음 실행 시각 비움 · 트리거 실행 이력은 SQL 로 심는다. 스케줄러나 실행 엔진을 돌리면 값을
 * 정할 수 없다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('워크플로 · 트리거 응답의 nullable 계약 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;

  function headers() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wtc'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(BASE_URL, token, uniqueName('WTC'));
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set(headers())
      .send({ name: uniqueName('wtc-wf') });
    expect(wf.status).toBe(201);
    workflowId = (wf.body.data as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  describe('WorkflowDto · ExportWorkflowDto', () => {
    it('description · folderId 는 비면 null, 채우면 값이 실린다', async () => {
      const contract = await contractForDto(WorkflowDto);
      const exportContract = await contractForDto(ExportWorkflowDto);

      const folder = await request(BASE_URL)
        .post('/api/folders')
        .set(headers())
        .send({ name: uniqueName('wtc-folder') });
      expect(folder.status).toBe(201);
      const folderId = (folder.body.data as { id: string }).id;

      const plain = await request(BASE_URL)
        .post('/api/workflows')
        .set(headers())
        .send({ name: uniqueName('wtc-plain') });
      expect(plain.status).toBe(201);
      assertMatchesContract(plain.body.data, contract);
      expect(plain.body.data).toMatchObject({
        description: null,
        folderId: null,
      });

      const filed = await request(BASE_URL)
        .post('/api/workflows')
        .set(headers())
        .send({
          name: uniqueName('wtc-filed'),
          description: 'memo',
          folderId,
        });
      expect(filed.status).toBe(201);
      assertMatchesContract(filed.body.data, contract);
      expect(filed.body.data).toMatchObject({ description: 'memo', folderId });

      const plainId = (plain.body.data as { id: string }).id;
      const filedId = (filed.body.data as { id: string }).id;
      for (const [id, description, folder] of [
        [plainId, null, null],
        [filedId, 'memo', folderId],
      ] as const) {
        const detail = await request(BASE_URL)
          .get(`/api/workflows/${id}`)
          .set(headers());
        expect(detail.status).toBe(200);
        assertMatchesContract(detail.body.data, contract);
        expect(detail.body.data).toMatchObject({
          description,
          folderId: folder,
        });

        const exported = await request(BASE_URL)
          .get(`/api/workflows/${id}/export`)
          .set(headers());
        expect(exported.status).toBe(200);
        // `formatVersion` 은 문서화된 미구현 갭이다(workflow-crud.e2e-spec.ts 와 같은 이유).
        assertMatchesContract(exported.body.data, exportContract, {
          allowMissing: ['formatVersion'],
        });
        expect(exported.body.data).toHaveProperty('description', description);
      }
    });
  });

  describe('NodeDto · EdgeDto', () => {
    it('노드의 설명 · 컨테이너 · 도구 소유자와 엣지 조건은 비면 null, 채우면 값이 실린다', async () => {
      const nodesUrl = `/api/workflows/${workflowId}/nodes`;
      const nodeContract = await contractForDto(NodeDto);

      const box = await request(BASE_URL)
        .post(nodesUrl)
        .set(headers())
        .send({ type: 'loop', category: 'flow', label: 'Box' });
      expect(box.status).toBe(201);
      assertMatchesContract(box.body.data, nodeContract);
      expect(box.body.data).toMatchObject({
        description: null,
        containerId: null,
        toolOwnerId: null,
      });
      const boxId = (box.body.data as { id: string }).id;

      const child = await request(BASE_URL).post(nodesUrl).set(headers()).send({
        type: 'code',
        category: 'data',
        label: 'Child',
        description: 'memo',
        containerId: boxId,
      });
      expect(child.status).toBe(201);
      const childId = (child.body.data as { id: string }).id;

      // `toolOwnerId` 는 `containerId` 와 한 노드에 함께 둘 수 없다(`chk_node_placement`).
      const tool = await request(BASE_URL).post(nodesUrl).set(headers()).send({
        type: 'http_request',
        category: 'integration',
        label: 'Tool',
        toolOwnerId: boxId,
      });
      expect(tool.status).toBe(201);
      const toolId = (tool.body.data as { id: string }).id;

      const nodes = await request(BASE_URL).get(nodesUrl).set(headers());
      expect(nodes.status).toBe(200);
      const nodeRows = nodes.body.data as Array<Record<string, unknown>>;
      expect(
        pickMatchingContract(nodeRows, (n) => n.id === boxId, nodeContract),
      ).toMatchObject({ description: null, containerId: null });
      expect(
        pickMatchingContract(nodeRows, (n) => n.id === childId, nodeContract),
      ).toMatchObject({
        description: 'memo',
        containerId: boxId,
        toolOwnerId: null,
      });
      expect(
        pickMatchingContract(nodeRows, (n) => n.id === toolId, nodeContract),
      ).toMatchObject({ containerId: null, toolOwnerId: boxId });

      const edgesUrl = `/api/workflows/${workflowId}/edges`;
      const edgeContract = await contractForDto(EdgeDto);
      const source = await request(BASE_URL)
        .post(nodesUrl)
        .set(headers())
        .send({ type: 'code', category: 'data', label: 'Source' });
      const target = await request(BASE_URL)
        .post(nodesUrl)
        .set(headers())
        .send({ type: 'code', category: 'data', label: 'Target' });
      expect(source.status).toBe(201);
      expect(target.status).toBe(201);
      const sourceNodeId = (source.body.data as { id: string }).id;
      const targetNodeId = (target.body.data as { id: string }).id;

      const plainEdge = await request(BASE_URL)
        .post(edgesUrl)
        .set(headers())
        .send({ sourceNodeId, targetNodeId: childId });
      expect(plainEdge.status).toBe(201);
      assertMatchesContract(plainEdge.body.data, edgeContract);
      expect(plainEdge.body.data).toHaveProperty('condition', null);

      const condition = { expression: '{{ $input.ok }}' };
      const guarded = await request(BASE_URL)
        .post(edgesUrl)
        .set(headers())
        .send({ sourceNodeId, targetNodeId, condition });
      expect(guarded.status).toBe(201);
      assertMatchesContract(guarded.body.data, edgeContract);
      expect(guarded.body.data).toHaveProperty('condition', condition);

      const edges = await request(BASE_URL).get(edgesUrl).set(headers());
      expect(edges.status).toBe(200);
      const edgeRows = edges.body.data as Array<Record<string, unknown>>;
      const plainEdgeId = (plainEdge.body.data as { id: string }).id;
      const guardedId = (guarded.body.data as { id: string }).id;
      expect(
        pickMatchingContract(
          edgeRows,
          (e) => e.id === plainEdgeId,
          edgeContract,
        ),
      ).toHaveProperty('condition', null);
      expect(
        pickMatchingContract(edgeRows, (e) => e.id === guardedId, edgeContract),
      ).toHaveProperty('condition', condition);
    });
  });

  describe('ScheduleDto · 스케줄 트리거의 TriggerDto', () => {
    it('lastRunAt · nextRunAt 은 비면 null 이고 트리거 응답은 다음 실행 시각이 비면 키를 뺀다', async () => {
      const scheduleContract = await contractForDto(ScheduleDto);
      const triggerContract = await contractForDto(TriggerDto);

      const created = await request(BASE_URL)
        .post('/api/schedules')
        .set(headers())
        .send({
          workflowId,
          name: uniqueName('wtc-sched'),
          cronExpression: '0 9 * * *',
          timezone: 'Asia/Seoul',
        });
      expect(created.status).toBe(201);
      assertMatchesContract(created.body.data, scheduleContract);
      expect(created.body.data).toHaveProperty('lastRunAt', null);
      expect(created.body.data).toHaveProperty('nextRunAt', expect.any(String));
      const scheduleId = (created.body.data as { id: string }).id;
      const triggerId = (created.body.data as { triggerId: string }).triggerId;

      // 다음 실행 시각이 있는 트리거 — 스케줄 트리거는 엔드포인트 · 인증 설정이 없다.
      const before = await request(BASE_URL)
        .get(`/api/triggers/${triggerId}`)
        .set(headers());
      expect(before.status).toBe(200);
      assertMatchesContract(before.body.data, triggerContract);
      expect(before.body.data).toMatchObject({
        endpointPath: null,
        authConfigId: null,
        lastTriggeredAt: null,
        nextRunAt: expect.any(String),
      });

      // 한 번 돈 뒤 다음 실행 시각을 계산하지 못한 상태(cron 해석 실패 등)를 SQL 로 만든다.
      const ranAt = new Date('2026-06-03T00:00:00.000Z');
      await db.query(
        `UPDATE schedule SET last_run_at = $1, next_run_at = NULL WHERE id = $2`,
        [ranAt, scheduleId],
      );
      await db.query(
        `UPDATE "trigger" SET last_triggered_at = $1 WHERE id = $2`,
        [ranAt, triggerId],
      );

      const schedule = await request(BASE_URL)
        .get(`/api/schedules/${scheduleId}`)
        .set(headers());
      expect(schedule.status).toBe(200);
      assertMatchesContract(schedule.body.data, scheduleContract);
      expect(schedule.body.data).toMatchObject({
        lastRunAt: ranAt.toISOString(),
        nextRunAt: null,
      });

      const detail = await request(BASE_URL)
        .get(`/api/triggers/${triggerId}`)
        .set(headers());
      expect(detail.status).toBe(200);
      assertMatchesContract(detail.body.data, triggerContract);
      expect(detail.body.data).toMatchObject({
        cronExpression: '0 9 * * *',
        lastTriggeredAt: ranAt.toISOString(),
      });
      expect(detail.body.data).not.toHaveProperty('nextRunAt');

      const listed = await request(BASE_URL)
        .get('/api/triggers')
        .query({ type: 'schedule', limit: 100 })
        .set(headers());
      expect(listed.status).toBe(200);
      const row = pickMatchingContract(
        listed.body.data as Array<Record<string, unknown>>,
        (t) => t.id === triggerId,
        triggerContract,
      );
      expect(row).toHaveProperty('cronExpression', '0 9 * * *');
      expect(row).not.toHaveProperty('nextRunAt');
    });
  });

  describe('webhook 트리거의 TriggerDto · TriggerHistoryItemDto', () => {
    it('엔드포인트 · 인증 설정이 실리고 실행 이력의 소요 시간은 끝나지 않았으면 null 이다', async () => {
      const triggerContract = await contractForDto(TriggerDto);

      const authConfig = await request(BASE_URL)
        .post('/api/auth-configs')
        .set(headers())
        .send({ name: uniqueName('wtc-ac'), type: 'api_key' });
      expect(authConfig.status).toBe(201);
      const authConfigId = (authConfig.body.data as { id: string }).id;

      const endpointPath = crypto.randomUUID();
      const created = await request(BASE_URL)
        .post('/api/triggers')
        .set(headers())
        .send({
          workflowId,
          type: 'webhook',
          name: uniqueName('wtc-hook'),
          endpointPath,
          isActive: true,
          authConfigId,
        });
      expect(created.status).toBe(201);
      assertMatchesContract(created.body.data, triggerContract);
      expect(created.body.data).toMatchObject({
        endpointPath,
        authConfigId,
        lastTriggeredAt: null,
      });
      // webhook 트리거에는 스케줄 필드가 붙지 않는다.
      expect(created.body.data).not.toHaveProperty('nextRunAt');
      const triggerId = (created.body.data as { id: string }).id;

      const patched = await request(BASE_URL)
        .patch(`/api/triggers/${triggerId}`)
        .set(headers())
        .send({ name: uniqueName('wtc-hook-renamed') });
      expect(patched.status).toBe(200);
      assertMatchesContract(patched.body.data, triggerContract);
      expect(patched.body.data).toMatchObject({ endpointPath, authConfigId });

      const finishedAt = new Date(Date.now() - 60_000);
      const runningAt = new Date();
      await db.query(
        `INSERT INTO execution (workflow_id, trigger_id, status, started_at, finished_at, duration_ms)
         VALUES ($1, $2, 'completed', $3, $3, 1500),
                ($1, $2, 'running', $4, NULL, NULL)`,
        [workflowId, triggerId, finishedAt, runningAt],
      );

      const history = await request(BASE_URL)
        .get(`/api/triggers/${triggerId}/history`)
        .set(headers());
      expect(history.status).toBe(200);
      const rows = history.body.data as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      const historyContract = await contractForDto(TriggerHistoryItemDto);
      for (const row of rows) assertMatchesContract(row, historyContract);
      // 최신순이다. 프런트 호출 이력 대화상자가 `startedAt` 을 읽는다.
      expect(rows[0]).toMatchObject({
        status: 'running',
        startedAt: runningAt.toISOString(),
        durationMs: null,
      });
      expect(rows[1]).toMatchObject({
        status: 'completed',
        startedAt: finishedAt.toISOString(),
        durationMs: 1500,
      });
    });
  });
});
