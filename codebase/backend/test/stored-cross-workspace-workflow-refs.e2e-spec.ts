// 이미 저장된 트리거 · 스케줄이 다른 워크스페이스의 워크플로우를 가리켜도 실행하지 않는다(NERV Task
// `CLE-T-XYR067`).
// 근거: [데이터 모델 개요 「참조의 소속」](CLE-PLAT-DATA#참조의-소속)
//
// 요청 본문의 `workflowId` 는 저장 전에 막는다(`cross-workspace-references.e2e-spec.ts`). 그 전에 저장된
// 행은 남는다. 실행 엔진이 워크플로우를 id 로만 읽어 그런 행이 발화하면 다른 워크스페이스의 워크플로우가
// 실행됐다. 이 파일은 SQL 로 그 행을 만들고 웹훅 호출과 스케줄 «지금 실행» 을 밟는다. 고치기 전 코드에서는
// 둘 다 피해자 워크플로우의 실행 행을 만들었다.
//
// 복합 FK(V141, NERV Task `CLE-T-QTRRE6`) 뒤에는 DB 도 그 행을 막는다. 엔진 대조는 저장 검사와 DB 제약을 모두
// 지나친 행에 대한 방어선으로 남기고, 이 파일은 그 행을 복제 모드(FK 트리거를 끈다)로 만들어 잰다.
//
// 피해 단언(피해자 워크플로우의 실행 행 수)을 상태 코드 단언보다 먼저 둔다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { nextE2eClientIp } from './helpers/e2e-client-ip';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

type Actor = { token: string; workspaceId: string };

describe('저장된 교차 워크스페이스 워크플로우 참조의 실행 (e2e)', () => {
  let db: Client;
  let attacker: Actor;
  let victim: Actor;
  let victimWorkflowId: string;
  let attackerWorkflowId: string;
  const createdTriggerIds: string[] = [];

  const as = (actor: Actor, req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${actor.token}`)
      .set('X-Workspace-Id', actor.workspaceId);

  const newActor = async (label: string): Promise<Actor> => {
    const owner = await registerAndLogin(BASE_URL, uniqueEmail(label), db);
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName(label.toUpperCase()),
    );
    return { token: owner.accessToken, workspaceId };
  };

  const createWorkflow = async (actor: Actor, label: string) => {
    const res = await as(actor, request(BASE_URL).post('/api/workflows')).send({
      name: uniqueName(label),
    });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  };

  /** 트리거의 워크플로우를 다른 워크스페이스 것으로 바꾼다. 복제 모드는 `SET LOCAL` 이라 이 트랜잭션에서만 켜진다. */
  const forgeCrossWorkflow = async (triggerId: string, workflowId: string) => {
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL session_replication_role = replica');
      await db.query('UPDATE trigger SET workflow_id = $2 WHERE id = $1', [
        triggerId,
        workflowId,
      ]);
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  };

  const victimExecutionCount = async (): Promise<number> => {
    const r = await db.query<{ count: string }>(
      'SELECT count(*) FROM execution WHERE workflow_id = $1',
      [victimWorkflowId],
    );
    return Number(r.rows[0].count);
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    victim = await newActor('xexec-victim');
    attacker = await newActor('xexec-attacker');
    victimWorkflowId = await createWorkflow(victim, 'xexec-vw');
    attackerWorkflowId = await createWorkflow(attacker, 'xexec-aw');
  }, 60_000);

  afterAll(async () => {
    // 오류를 삼키지 않는다. 복제 모드로 커밋한 교차 행이 남으면 다음 실행의 composite-fk-scope V134 점검이 멈춘다
    try {
      await db.query('DELETE FROM trigger WHERE id = ANY($1)', [
        createdTriggerIds,
      ]);
    } finally {
      await db.end();
    }
  });

  it('웹훅 트리거의 workflow_id 가 다른 워크스페이스를 가리키면 트리거가 없을 때와 같은 404 이고 실행하지 않는다', async () => {
    const endpointPath = randomUUID();
    const created = await as(
      attacker,
      request(BASE_URL).post('/api/triggers'),
    ).send({
      workflowId: attackerWorkflowId,
      type: 'webhook',
      name: uniqueName('xexec-hook'),
      endpointPath,
    });
    expect(created.status).toBe(201);
    const triggerId = (created.body.data as { id: string }).id;
    createdTriggerIds.push(triggerId);
    // 요청 본문으로는 막혔으므로 SQL 로 그 전에 저장된 행을 흉내 낸다.
    await forgeCrossWorkflow(triggerId, victimWorkflowId);
    const before = await victimExecutionCount();

    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({ hello: 'world' });
    const unknown = await request(BASE_URL)
      .post(`/api/hooks/${randomUUID()}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({ hello: 'world' });

    expect(await victimExecutionCount()).toBe(before);
    expect(res.status).toBe(404);
    // 없는 엔드포인트와 응답을 구분하지 않는다(requestId 만 다르다).
    expect(res.body.error.code).toBe(unknown.body.error.code);
    expect(res.body.error.message).toBe(unknown.body.error.message);
  });

  // 파라미터 스키마를 워크플로우 id 로만 읽으면 실행 엔진에 닿기 전에 피해자 워크플로우의 필수 파라미터로
  // 400 을 내고 그 이름을 응답에 싣는다. 스키마도 트리거의 워크스페이스 안에서만 읽어야 404 가 된다.
  it('피해자 워크플로우에 필수 파라미터가 있어도 파라미터 검증 400 이 아니라 404 이고 파라미터 이름을 싣지 않는다', async () => {
    const paramName = `victimOnly${randomUUID().slice(0, 8)}`;
    const victimWithParam = await createWorkflow(victim, 'xexec-vwp');
    const saved = await as(
      victim,
      request(BASE_URL).post(`/api/workflows/${victimWithParam}/save`),
    ).send({
      nodes: [
        {
          id: randomUUID(),
          type: 'manual_trigger',
          category: 'trigger',
          label: 'Start',
          positionX: 0,
          positionY: 0,
          config: {
            parameters: [{ name: paramName, type: 'string', required: true }],
          },
        },
      ],
      edges: [],
    });
    expect(saved.status).toBe(200);

    const endpointPath = randomUUID();
    const created = await as(
      attacker,
      request(BASE_URL).post('/api/triggers'),
    ).send({
      workflowId: attackerWorkflowId,
      type: 'webhook',
      name: uniqueName('xexec-hookp'),
      endpointPath,
    });
    expect(created.status).toBe(201);
    const triggerId = (created.body.data as { id: string }).id;
    createdTriggerIds.push(triggerId);
    await forgeCrossWorkflow(triggerId, victimWithParam);
    const executionsBefore = await db.query<{ count: string }>(
      'SELECT count(*) FROM execution WHERE workflow_id = $1',
      [victimWithParam],
    );

    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .send({});

    const executionsAfter = await db.query<{ count: string }>(
      'SELECT count(*) FROM execution WHERE workflow_id = $1',
      [victimWithParam],
    );
    expect(executionsAfter.rows[0].count).toBe(executionsBefore.rows[0].count);
    expect(JSON.stringify(res.body)).not.toContain(paramName);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIGGER_NOT_FOUND');
  });

  it('스케줄의 트리거가 다른 워크스페이스 워크플로우를 가리키면 «지금 실행» 이 그 워크플로우를 실행하지 않는다', async () => {
    const created = await as(
      attacker,
      request(BASE_URL).post('/api/schedules'),
    ).send({
      workflowId: attackerWorkflowId,
      name: uniqueName('xexec-sched'),
      cronExpression: '0 0 1 1 *', // 매년 1월 1일 — 이 테스트 동안 자동 발화하지 않는다
      timezone: 'UTC',
    });
    expect(created.status).toBe(201);
    const scheduleId = (created.body.data as { id: string }).id;
    const linked = await db.query<{ trigger_id: string }>(
      'SELECT trigger_id FROM schedule WHERE id = $1',
      [scheduleId],
    );
    const triggerId = linked.rows[0].trigger_id;
    createdTriggerIds.push(triggerId);
    await forgeCrossWorkflow(triggerId, victimWorkflowId);
    const before = await victimExecutionCount();

    const res = await as(
      attacker,
      request(BASE_URL).post(`/api/schedules/${scheduleId}/run-now`),
    ).send();

    expect(await victimExecutionCount()).toBe(before);
    expect(res.status).toBe(400);
    // 연결된 워크플로우가 없을 때와 같은 본문이다(없는 워크플로우와 다른 워크스페이스의 워크플로우를
    // 구분하지 않는다).
    expect(res.body.error.message).toBe('Schedule has no associated workflow');
  });
});
