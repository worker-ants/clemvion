import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 요청 본문의 참조 id 가 **다른 워크스페이스**(워크플로 범위 필드는 **다른 워크플로**)를 가리키면 저장 전에 거부한다.
 *
 * 종전엔 서비스가 그 id 를 컬럼에 그대로 저장했다. 트리거 · 스케줄의 `workflowId` 는 실행 경로가 워크스페이스로 거르지 않아 상대
 * 워크플로가 이쪽 트리거로 실행됐고, 캔버스 저장은 자기 워크플로에 없는 노드 id 를 «신규» 로 `save` 해 상대 노드 행을 이쪽으로
 * 옮겼다(`plan/complete/cross-workspace-refs.md` §실측 — 고치기 전 코드에서 이 파일의 18케이스가 전부 RED). 나머지는 끊긴 참조로 남았다.
 *
 * 규칙 · 에러는 `spec/1-data-model.md` §1.1: 400 `VALIDATION_ERROR` + `details: [{ field, message, code: 'INVALID_FIELD' }]`, 모델 설정
 * 참조는 기존 검증기(`findEntity(id, workspaceId, kind)`)를 재사용해 404 `MODEL_CONFIG_NOT_FOUND`. 없는 id 와 남의 id 를 구분하지 않는다.
 * 지식 베이스 세 필드는 픽스처(임베딩 설정 · 문서)가 무거워 단위 테스트만 본다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

type Actor = { token: string; workspaceId: string };

describe('요청 본문의 교차 워크스페이스 참조 (e2e)', () => {
  let db: Client;
  let a: Actor;
  let b: Actor;
  const ids: Record<string, string> = {};

  const as = (actor: Actor, req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${actor.token}`)
      .set('X-Workspace-Id', actor.workspaceId);

  const created = async (
    actor: Actor,
    path: string,
    body: Record<string, unknown>,
  ): Promise<string> => {
    const res = await as(actor, request(BASE_URL).post(path)).send(body);
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  };

  const newActor = async (label: string): Promise<Actor> => {
    const owner = await registerAndLogin(BASE_URL, uniqueEmail(label), db);
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName(label.toUpperCase()),
    );
    return { token: owner.accessToken, workspaceId };
  };

  const codeNode = (label: string): Record<string, unknown> => ({
    type: 'code',
    category: 'data',
    label,
  });

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    a = await newActor('xref-a');
    b = await newActor('xref-b');

    // B(상대)의 행들
    ids.folderB = await created(b, '/api/folders', {
      name: uniqueName('xb-f'),
    });
    ids.workflowB = await created(b, '/api/workflows', {
      name: uniqueName('xb-w'),
    });
    ids.nodeB = await created(
      b,
      `/api/workflows/${ids.workflowB}/nodes`,
      codeNode('Victim'),
    );
    ids.modelConfigB = await created(b, '/api/model-configs', {
      kind: 'chat',
      provider: 'openai',
      name: uniqueName('xb-mc'),
      apiKey: 'stub-not-used',
      defaultModel: 'stub-model',
      defaultParams: {},
      isDefault: false,
    });

    // A(요청자)의 행들 — 같은 워크스페이스의 다른 워크플로(workflowA2)도 둔다
    ids.folderA = await created(a, '/api/folders', {
      name: uniqueName('xa-f'),
    });
    ids.workflowA = await created(a, '/api/workflows', {
      name: uniqueName('xa-w'),
    });
    ids.workflowA2 = await created(a, '/api/workflows', {
      name: uniqueName('xa-w2'),
    });
    ids.nodeA = await created(
      a,
      `/api/workflows/${ids.workflowA}/nodes`,
      codeNode('Mine'),
    );
    ids.nodeA2 = await created(
      a,
      `/api/workflows/${ids.workflowA2}/nodes`,
      codeNode('OtherWorkflow'),
    );
    // 캔버스 저장 케이스 전용 — 고치기 전 코드에서 성공한 저장이 다른 케이스의 픽스처를 지우지 않게 한다.
    ids.workflowCanvas = await created(a, '/api/workflows', {
      name: uniqueName('xa-canvas'),
    });
    ids.session = await created(a, '/api/workflow-assistant/sessions', {
      workflowId: ids.workflowA,
      title: 'xref',
    });
  }, 120_000);

  afterAll(async () => {
    await db.end();
  });

  // `details` 는 배열이다(spec 1-data-model §1.1) — 파이프가 내는 VALIDATION_ERROR 와 같은 모양.
  const expect400 = (res: request.Response, field: string): void => {
    const details: unknown = res.body?.error?.details;
    expect({
      status: res.status,
      code: res.body?.error?.code,
      isArray: Array.isArray(details),
    }).toStrictEqual({ status: 400, code: 'VALIDATION_ERROR', isArray: true });
    expect(
      (details as Array<{ field: string; code: string }>).map((d) => [
        d.field,
        d.code,
      ]),
    ).toContainEqual([field, 'INVALID_FIELD']);
  };

  describe('워크스페이스 범위 — B 의 id 를 A 의 요청에 싣는다', () => {
    it('트리거 생성의 workflowId', async () => {
      const res = await as(a, request(BASE_URL).post('/api/triggers')).send({
        workflowId: ids.workflowB,
        type: 'webhook',
        name: uniqueName('xt'),
        endpointPath: randomUUID(),
      });
      expect400(res, 'workflowId');
    });

    it('스케줄 생성의 workflowId', async () => {
      const res = await as(a, request(BASE_URL).post('/api/schedules')).send({
        workflowId: ids.workflowB,
        name: uniqueName('xs'),
        cronExpression: '0 0 1 1 *',
        timezone: 'Asia/Seoul',
      });
      expect400(res, 'workflowId');
    });

    it('알림 규칙 생성의 workflowId', async () => {
      const res = await as(a, request(BASE_URL).post('/api/alerts')).send({
        type: 'failure_rate',
        threshold: 10,
        channel: 'in_app',
        workflowId: ids.workflowB,
      });
      expect400(res, 'workflowId');
    });

    it('워크플로 생성의 folderId', async () => {
      const res = await as(a, request(BASE_URL).post('/api/workflows')).send({
        name: uniqueName('xw'),
        folderId: ids.folderB,
      });
      expect400(res, 'folderId');
    });

    it('워크플로 수정의 folderId', async () => {
      const res = await as(
        a,
        request(BASE_URL).patch(`/api/workflows/${ids.workflowA}`),
      ).send({ folderId: ids.folderB });
      expect400(res, 'folderId');
    });

    it('폴더 생성의 parentId', async () => {
      const res = await as(a, request(BASE_URL).post('/api/folders')).send({
        name: uniqueName('xf'),
        parentId: ids.folderB,
      });
      expect400(res, 'parentId');
    });

    it('어시스턴트 세션 생성의 llmConfigId — 404 MODEL_CONFIG_NOT_FOUND', async () => {
      const res = await as(
        a,
        request(BASE_URL).post('/api/workflow-assistant/sessions'),
      ).send({ workflowId: ids.workflowA, llmConfigId: ids.modelConfigB });
      expect({ status: res.status, code: res.body?.error?.code }).toStrictEqual(
        { status: 404, code: 'MODEL_CONFIG_NOT_FOUND' },
      );
    });

    it('어시스턴트 세션 수정의 llmConfigId — 404 MODEL_CONFIG_NOT_FOUND', async () => {
      const res = await as(
        a,
        request(BASE_URL).patch(
          `/api/workflow-assistant/sessions/${ids.session}`,
        ),
      ).send({ llmConfigId: ids.modelConfigB });
      expect({ status: res.status, code: res.body?.error?.code }).toStrictEqual(
        { status: 404, code: 'MODEL_CONFIG_NOT_FOUND' },
      );
    });
  });

  describe('워크플로 범위 — 다른 워크스페이스 · 같은 워크스페이스의 다른 워크플로', () => {
    it('노드 생성의 containerId (B 의 노드)', async () => {
      const res = await as(
        a,
        request(BASE_URL).post(`/api/workflows/${ids.workflowA}/nodes`),
      ).send({ ...codeNode(uniqueName('xn')), containerId: ids.nodeB });
      expect400(res, 'containerId');
    });

    it('노드 수정의 containerId (A 의 다른 워크플로 노드)', async () => {
      const res = await as(
        a,
        request(BASE_URL).patch(`/api/nodes/${ids.nodeA}`),
      ).send({ containerId: ids.nodeA2 });
      expect400(res, 'containerId');
    });

    it('노드 수정의 toolOwnerId (B 의 노드)', async () => {
      const res = await as(
        a,
        request(BASE_URL).patch(`/api/nodes/${ids.nodeA}`),
      ).send({ toolOwnerId: ids.nodeB });
      expect400(res, 'toolOwnerId');
    });

    it('엣지 생성의 targetNodeId (B 의 노드)', async () => {
      const res = await as(
        a,
        request(BASE_URL).post(`/api/workflows/${ids.workflowA}/edges`),
      ).send({ sourceNodeId: ids.nodeA, targetNodeId: ids.nodeB });
      expect400(res, 'targetNodeId');
    });

    it('엣지 생성의 sourceNodeId (A 의 다른 워크플로 노드)', async () => {
      const res = await as(
        a,
        request(BASE_URL).post(`/api/workflows/${ids.workflowA}/edges`),
      ).send({ sourceNodeId: ids.nodeA2, targetNodeId: ids.nodeA });
      expect400(res, 'sourceNodeId');
    });
  });

  describe('캔버스 저장', () => {
    const trigger = (): Record<string, unknown> => ({
      id: randomUUID(),
      type: 'manual_trigger',
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
      config: {},
    });
    const node = (
      id: string,
      label: string,
      extra: Record<string, unknown> = {},
    ): Record<string, unknown> => ({
      id,
      type: 'code',
      category: 'data',
      label,
      positionX: 100,
      positionY: 0,
      config: {},
      ...extra,
    });
    const save = (
      workflowId: string,
      body: Record<string, unknown>,
    ): request.Test =>
      as(a, request(BASE_URL).post(`/api/workflows/${workflowId}/save`)).send(
        body,
      );

    it('다른 워크스페이스 노드의 id 를 새 노드로 실으면 거부하고, 그 노드는 그대로다', async () => {
      const res = await save(ids.workflowCanvas, {
        nodes: [trigger(), node(ids.nodeB, 'Taken')],
        edges: [],
      });
      expect400(res, 'nodes[1].id');
      const r = await db.query<{ workflow_id: string; label: string }>(
        'SELECT workflow_id, label FROM node WHERE id = $1',
        [ids.nodeB],
      );
      expect(r.rows[0]).toStrictEqual({
        workflow_id: ids.workflowB,
        label: 'Victim',
      });
    });

    it('같은 워크스페이스 다른 워크플로 노드의 id 도 거부한다', async () => {
      const res = await save(ids.workflowCanvas, {
        nodes: [trigger(), node(ids.nodeA2, 'Taken')],
        edges: [],
      });
      expect400(res, 'nodes[1].id');
    });

    it('containerId 는 이번 페이로드의 노드여야 한다', async () => {
      const res = await save(ids.workflowCanvas, {
        nodes: [
          trigger(),
          node(randomUUID(), 'Child', { containerId: ids.nodeB }),
        ],
        edges: [],
      });
      expect400(res, 'nodes[1].containerId');
    });

    it('toolOwnerId 는 이번 페이로드의 노드여야 한다', async () => {
      const res = await save(ids.workflowCanvas, {
        nodes: [
          trigger(),
          node(randomUUID(), 'Tool', { toolOwnerId: ids.nodeA2 }),
        ],
        edges: [],
      });
      expect400(res, 'nodes[1].toolOwnerId');
    });

    it('엣지 끝점은 이번 페이로드의 노드여야 한다', async () => {
      const t = trigger();
      const res = await save(ids.workflowCanvas, {
        nodes: [t],
        edges: [{ sourceNodeId: t.id, targetNodeId: ids.nodeB }],
      });
      expect400(res, 'edges[0].targetNodeId');
    });
  });
});
