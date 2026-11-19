import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Map · ForEach 의 배열 입력과 완료 meta([Logic 노드 공통 「배열이 아닌 입력 처리」](CLE-NODE-LOGIC-COMMON#배열이-아닌-입력-처리)).
 *
 * 실제 실행(save → execute → engine → 표현식 해석)에서 두 가지를 본다.
 *
 * 1. **입력 배열을 그대로 돈다**: 컨테이너 핸들러가 입력 배열과 함께 `meta` 를
 *    돌려줘도 컨테이너가 그 배열을 돈다. 엔진의 flat 캐시가 meta 만 보고 출력을
 *    `{ data: [...] }` 로 감싸 구조화 캐시의 output 까지 바꾸던 회귀를 막는다.
 *    상류 Code 가 배열을 그대로 돌려줘도 컨테이너의 입력과 `$node["Code"].output` 은
 *    그 배열이다. `port: 'success'` 때문에 엔진 안에서 `{ data: [...] }` 봉투로 실리던
 *    값이 다운스트림까지 새던 결함을 막는다(NERV Task CLE-T-T30D5S).
 * 2. **비배열 입력은 meta 로 알린다**: 배열 경로가 원시값 · 객체로 풀리면 바디를 돌지
 *    않고 `meta.fellBackToEmpty: true` 를 남긴다. 다운스트림은
 *    `$node["<컨테이너>"].meta.*` 로 읽는다.
 * 3. **실행 이력의 컨테이너 행은 완료 시점 값이다**: 실행 상세 API 의 컨테이너
 *    노드 실행은 완료 출력 `{ <items|mapped>, count }` · 완료 meta 와 바디까지 포함한
 *    실행 시간을 담는다. 컨테이너 뒤에서 멈췄다가 재개해도 다운스트림은
 *    그 행에서 복원한 완료 출력을 읽는다(NERV Task CLE-T-JXD0W5).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL = ['completed', 'failed', 'cancelled'];

type ContainerType = 'map' | 'foreach';

describe('Container array input and completion meta (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('ctrmeta'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CTRMETA'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function poll(
    executionId: string,
    until: (status: string) => boolean = (st) => TERMINAL.includes(st),
  ): Promise<string> {
    const start = Date.now();
    let last = '';
    while (Date.now() - start < 20_000) {
      const res = await request(BASE_URL)
        .get(`/api/executions/${executionId}`)
        .set(auth())
        .set('X-Workspace-Id', workspaceId);
      if (res.status === 200) {
        last = (res.body.data as { status: string }).status;
        if (until(last)) return last;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`poll timed out at status=${last}`);
  }

  async function readOutput(
    executionId: string,
    nodeId: string,
  ): Promise<Record<string, unknown>> {
    const r = await db.query<{
      output_data: { output?: Record<string, unknown> };
    }>(
      `SELECT output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, nodeId],
    );
    expect(r.rows.length).toBe(1);
    return r.rows[0].output_data?.output ?? {};
  }

  async function readInput(
    executionId: string,
    nodeId: string,
  ): Promise<unknown> {
    const r = await db.query<{ input_data: unknown }>(
      `SELECT input_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, nodeId],
    );
    expect(r.rows.length).toBe(1);
    return r.rows[0].input_data;
  }

  async function countBodyRuns(
    executionId: string,
    bodyId: string,
  ): Promise<number> {
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM node_execution
         WHERE execution_id = $1 AND node_id = $2`,
      [executionId, bodyId],
    );
    return Number(r.rows[0].n);
  }

  // Start → Code(return <codeBody>) → <컨테이너>(배열 경로) ⟲ Body → Echo
  // Echo 는 사용자가 쓸 표현식 그대로 컨테이너의 output · meta 를 옮겨 적는다.
  // parkAfterDone 이면 done 과 Echo 사이에 Form 을 두어 실행을 멈췄다가 재개한다.
  // 재개는 노드 실행 행에서 컨텍스트를 복원(rehydration)하므로 Echo 가 읽는 값은
  // 컨테이너 행의 output_data 다.
  async function runGraph(
    type: ContainerType,
    codeBody: string,
    arrayExpr: string,
    opts: { parkAfterDone?: boolean } = {},
  ): Promise<{
    executionId: string;
    ctrId: string;
    bodyId: string;
    echoId: string;
    status: string;
  }> {
    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName(`ctrmeta-${type}`) });
    expect(created.status).toBe(201);
    const workflowId = created.body.data.id as string;

    const triggerId = randomUUID();
    const codeId = randomUUID();
    const ctrId = randomUUID();
    const bodyId = randomUUID();
    const echoId = randomUUID();
    const formId = randomUUID();
    const ctrLabel = type === 'map' ? 'Map' : 'ForEach';
    const collection = type === 'map' ? 'mapped' : 'items';

    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: [
          {
            id: triggerId,
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            positionX: 0,
            positionY: 0,
            config: {},
          },
          {
            id: codeId,
            type: 'code',
            category: 'data',
            label: 'Code',
            positionX: 200,
            positionY: 0,
            config: { language: 'javascript', code: codeBody, timeout: 5 },
          },
          {
            id: ctrId,
            type,
            category: 'logic',
            label: ctrLabel,
            positionX: 400,
            positionY: 0,
            config:
              type === 'map'
                ? { inputField: arrayExpr, errorPolicy: 'stop' }
                : { arrayField: arrayExpr, errorPolicy: 'stop' },
          },
          {
            id: bodyId,
            type: 'transform',
            category: 'data',
            label: 'Body',
            positionX: 440,
            positionY: 80,
            containerId: ctrId,
            config: {
              operations: [{ type: 'set_field', field: 'seen', value: 'yes' }],
            },
          },
          {
            id: echoId,
            type: 'transform',
            category: 'data',
            label: 'Echo',
            positionX: 640,
            positionY: 0,
            config: {
              operations: [
                {
                  type: 'set_field',
                  field: 'fell',
                  value: `{{$node["${ctrLabel}"].meta.fellBackToEmpty}}`,
                },
                {
                  type: 'set_field',
                  field: 'iterations',
                  value: `{{$node["${ctrLabel}"].meta.iterations}}`,
                },
                {
                  type: 'set_field',
                  field: 'count',
                  value: `{{$node["${ctrLabel}"].output.count}}`,
                },
                {
                  type: 'set_field',
                  field: 'first',
                  value: `{{$node["${ctrLabel}"].output.${collection}[0]}}`,
                },
              ],
            },
          },
          ...(opts.parkAfterDone
            ? [
                {
                  id: formId,
                  type: 'form',
                  category: 'presentation',
                  label: 'Wait',
                  positionX: 540,
                  positionY: 0,
                  config: {
                    title: 'Wait',
                    fields: [{ name: 'note', type: 'text', label: 'Note' }],
                  },
                },
              ]
            : []),
        ],
        edges: [
          {
            sourceNodeId: triggerId,
            sourcePort: 'out',
            targetNodeId: codeId,
            targetPort: 'in',
          },
          {
            // Code 노드의 출력 포트는 `success` 하나다(code.schema.ts).
            sourceNodeId: codeId,
            sourcePort: 'success',
            targetNodeId: ctrId,
            targetPort: 'in',
          },
          {
            sourceNodeId: ctrId,
            sourcePort: 'body',
            targetNodeId: bodyId,
            targetPort: 'in',
          },
          {
            sourceNodeId: bodyId,
            sourcePort: 'out',
            targetNodeId: ctrId,
            targetPort: 'emit',
          },
          ...(opts.parkAfterDone
            ? [
                {
                  sourceNodeId: ctrId,
                  sourcePort: 'done',
                  targetNodeId: formId,
                  targetPort: 'in',
                },
                {
                  sourceNodeId: formId,
                  sourcePort: 'out',
                  targetNodeId: echoId,
                  targetPort: 'in',
                },
              ]
            : [
                {
                  sourceNodeId: ctrId,
                  sourcePort: 'done',
                  targetNodeId: echoId,
                  targetPort: 'in',
                },
              ]),
        ],
      });
    expect(save.status).toBe(200);

    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    const executionId = exec.body.data.executionId as string;
    if (opts.parkAfterDone) {
      const parked = await poll(
        executionId,
        (st) => st === 'waiting_for_input' || TERMINAL.includes(st),
      );
      expect(parked).toBe('waiting_for_input');
      const resumed = await request(BASE_URL)
        .post(`/api/executions/${executionId}/continue`)
        .set(auth())
        .set('X-Workspace-Id', workspaceId)
        .send({ formData: { note: 'resume' } });
      expect([200, 202]).toContain(resumed.status);
    }
    const status = await poll(executionId);
    return { executionId, ctrId, bodyId, echoId, status };
  }

  it.each<ContainerType>(['map', 'foreach'])(
    '%s iterates an upstream array and reports fellBackToEmpty=false',
    async (type) => {
      const { executionId, bodyId, echoId, status } = await runGraph(
        type,
        'return { items: [{ v: 1 }, { v: 2 }, { v: 3 }] };',
        '{{ $node["Code"].output.items }}',
      );
      expect(status).toBe('completed');
      expect(await countBodyRuns(executionId, bodyId)).toBe(3);
      const echo = await readOutput(executionId, echoId);
      expect(echo.fell).toBe(false);
      expect(echo.iterations).toBe(3);
      expect(echo.count).toBe(3);
      expect(echo.first).toEqual({ v: 1, seen: 'yes' });
    },
    60_000,
  );

  // Code 가 배열을 그대로 돌려주는 경우. 컨테이너가 Code 의 배열을 `$node["Code"].output`
  // 으로 읽든 `$input` 으로 읽든 세 번 돈다(NERV Task CLE-T-T30D5S).
  it.each<[ContainerType, string]>([
    ['map', '{{ $node["Code"].output }}'],
    ['foreach', '{{ $node["Code"].output }}'],
    ['map', '{{ $input }}'],
  ])(
    '%s iterates an array the upstream Code returned as is (%s)',
    async (type, arrayExpr) => {
      const items = [{ v: 1 }, { v: 2 }, { v: 3 }];
      const { executionId, ctrId, bodyId, echoId, status } = await runGraph(
        type,
        'return [{ v: 1 }, { v: 2 }, { v: 3 }];',
        arrayExpr,
      );
      expect(status).toBe('completed');
      // 컨테이너 실행 행의 입력도 봉투가 아니라 Code 가 돌려준 배열이다.
      expect(await readInput(executionId, ctrId)).toEqual(items);
      expect(await countBodyRuns(executionId, bodyId)).toBe(3);
      const echo = await readOutput(executionId, echoId);
      expect(echo.fell).toBe(false);
      expect(echo.iterations).toBe(3);
      expect(echo.count).toBe(3);
      expect(echo.first).toEqual({ v: 1, seen: 'yes' });
    },
    60_000,
  );

  // 실행 상세 API 의 컨테이너 행이 시작 시점 핸들러 출력(입력 배열)과 핸들러만의 실행
  // 시간이 아니라 완료 출력과 바디까지 포함한 실행 시간을 담는다(NERV Task CLE-T-JXD0W5).
  it.each<ContainerType>(['map', 'foreach'])(
    '%s node execution in the history API holds the completion output and full duration',
    async (type) => {
      const { executionId, ctrId, bodyId, status } = await runGraph(
        type,
        'return { items: [{ v: 1 }, { v: 2 }, { v: 3 }] };',
        '{{ $node["Code"].output.items }}',
      );
      expect(status).toBe('completed');

      const res = await request(BASE_URL)
        .get(`/api/executions/${executionId}`)
        .set(auth())
        .set('X-Workspace-Id', workspaceId);
      expect(res.status).toBe(200);
      type NodeExecutionDto = {
        nodeId: string;
        status: string;
        startedAt: string;
        finishedAt: string | null;
        durationMs: number | null;
        outputData: {
          output?: Record<string, unknown>;
          meta?: Record<string, unknown>;
        } | null;
      };
      const rows = (res.body.data as { nodeExecutions: NodeExecutionDto[] })
        .nodeExecutions;
      const ctrRows = rows.filter((r) => r.nodeId === ctrId);
      expect(ctrRows).toHaveLength(1);
      const ctr = ctrRows[0];
      expect(ctr.status).toBe('completed');

      const collection = type === 'map' ? 'mapped' : 'items';
      expect(ctr.outputData?.output?.count).toBe(3);
      expect(ctr.outputData?.output?.[collection]).toEqual([
        { v: 1, seen: 'yes' },
        { v: 2, seen: 'yes' },
        { v: 3, seen: 'yes' },
      ]);
      expect(ctr.outputData?.meta).toEqual(
        expect.objectContaining({ iterations: 3, fellBackToEmpty: false }),
      );

      // 컨테이너의 끝 시각은 마지막 바디가 끝난 뒤이고, 실행 시간은 시작 · 끝 시각 차다.
      const bodyRows = rows.filter((r) => r.nodeId === bodyId);
      expect(bodyRows).toHaveLength(3);
      const lastBodyFinished = Math.max(
        ...bodyRows.map((r) => Date.parse(r.finishedAt ?? '')),
      );
      expect(ctr.finishedAt).not.toBeNull();
      const ctrFinished = Date.parse(ctr.finishedAt!);
      expect(ctrFinished).toBeGreaterThanOrEqual(lastBodyFinished);
      expect(ctr.durationMs).toBe(ctrFinished - Date.parse(ctr.startedAt));
    },
    60_000,
  );

  it.each<ContainerType>(['map', 'foreach'])(
    '%s skips the body for a non-array path and reports fellBackToEmpty=true',
    async (type) => {
      const { executionId, bodyId, echoId, status } = await runGraph(
        type,
        'return { items: 42 };',
        'items',
      );
      expect(status).toBe('completed');
      expect(await countBodyRuns(executionId, bodyId)).toBe(0);
      const echo = await readOutput(executionId, echoId);
      expect(echo.fell).toBe(true);
      expect(echo.iterations).toBe(0);
      expect(echo.count).toBe(0);
    },
    60_000,
  );

  // 컨테이너 뒤에서 실행이 멈췄다가 재개되면 컨텍스트는 노드 실행 행에서 복원된다.
  // 다운스트림이 읽는 컨테이너 output · meta 는 그 행에 남은 완료 출력이다
  // (NERV Task CLE-T-JXD0W5).
  it.each<ContainerType>(['map', 'foreach'])(
    '%s completion output survives a park after done and the resume',
    async (type) => {
      const { executionId, bodyId, echoId, status } = await runGraph(
        type,
        'return { items: [{ v: 1 }, { v: 2 }, { v: 3 }] };',
        '{{ $node["Code"].output.items }}',
        { parkAfterDone: true },
      );
      expect(status).toBe('completed');
      expect(await countBodyRuns(executionId, bodyId)).toBe(3);
      const echo = await readOutput(executionId, echoId);
      expect(echo.fell).toBe(false);
      expect(echo.iterations).toBe(3);
      expect(echo.count).toBe(3);
      expect(echo.first).toEqual({ v: 1, seen: 'yes' });
    },
    60_000,
  );
});
