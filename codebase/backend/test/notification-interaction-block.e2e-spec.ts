// 입력 대기 알림 웹훅의 `interaction` 블록을 실제 실행 · 실제 fanout · 실제 발송 워커 위에서 고정한다
// (NERV Task `CLE-T-BZH1XK`).
// 근거: [EIA 알림 웹훅](CLE-EIA-NOTIFY) REQ-EIANOTI-033, [알림 이벤트 페이로드](CLE-EIA-NOTIFY-EVENTS)
// 「`execution.waiting_for_input`」.
//
// 웹훅 트리거 → Form 워크플로를 웹훅으로 실행해 입력 대기에 세운다. 알림 URL 은 이 러너 컨테이너에 띄운 수신 서버다.
// 발송 워커는 backend-e2e 컨테이너에서 돌고 러너의 호스트 이름(`backend-e2e-runner`)으로 닿는다. 알림 URL 이 http 라서
// backend-e2e 에 `ALLOW_HTTP_HOOKS=1` 을 준다. 둘 다 `docker-compose.e2e.yml` 에 있다.
//
// 확인하는 것: 알림에 실린 토큰으로 상태 조회 · 제출이 통과하고, 실행이 끝나면 그 토큰이 폐기된다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** backend-e2e 가 이 러너에 닿는 호스트 이름. `docker-compose.e2e.yml` 의 러너 `hostname` 이다. */
const RUNNER_HOST = os.hostname();

const WAIT_MS = 30_000;

interface NotificationBody {
  type: string;
  executionId: string;
  triggerId: string;
  payload: Record<string, unknown> & {
    interaction?: {
      token?: string;
      expiresAt?: string;
      endpoints: Record<string, string>;
      expectedCommands: string[];
    };
  };
}

async function waitFor<T>(
  read: () => T | Promise<T>,
  done: (value: T) => boolean,
  label: string,
): Promise<T> {
  const start = Date.now();
  let last: T | undefined;
  while (Date.now() - start < WAIT_MS) {
    last = await read();
    if (done(last)) return last;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `${label} 를 기다리다 시간이 다 됐다 (마지막 값 ${JSON.stringify(last)})`,
  );
}

describe('입력 대기 알림 웹훅의 interaction 블록 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  let formNodeId: string;
  let receiver: Server;
  let receiverPort: number;
  const received: NotificationBody[] = [];
  const triggerIds: string[] = [];
  const executionIds: string[] = [];

  function api(method: 'get' | 'post', path: string) {
    return request(BASE_URL)
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('notif-ix'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('NOTIF-IX'),
    );

    // 꺼진 워크플로는 웹훅으로 실행되지 않는다.
    const wf = await api('post', '/api/workflows').send({
      name: uniqueName('notif-ix-wf'),
      isActive: true,
    });
    expect(wf.status).toBe(201);
    workflowId = wf.body.data.id as string;

    const triggerNodeId = randomUUID();
    formNodeId = randomUUID();
    const save = await api('post', `/api/workflows/${workflowId}/save`).send({
      nodes: [
        {
          id: triggerNodeId,
          type: 'manual_trigger',
          category: 'trigger',
          label: 'Start',
          positionX: 0,
          positionY: 0,
        },
        {
          id: formNodeId,
          type: 'form',
          category: 'presentation',
          label: 'Approval Form',
          positionX: 240,
          positionY: 0,
          config: {
            title: 'Approval',
            fields: [{ name: 'note', type: 'text', label: 'Note' }],
          },
        },
      ],
      edges: [
        {
          sourceNodeId: triggerNodeId,
          sourcePort: 'out',
          targetNodeId: formNodeId,
          targetPort: 'in',
        },
      ],
    });
    expect(save.status).toBe(200);

    receiver = createServer((req, res) => {
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        raw += chunk;
      });
      req.on('end', () => {
        try {
          received.push(JSON.parse(raw) as NotificationBody);
        } catch {
          // 본문이 JSON 이 아니면 시험의 대기가 시간 초과로 드러낸다.
        }
        res.writeHead(200).end();
      });
    });
    receiverPort = await new Promise<number>((resolve) => {
      receiver.listen(0, '0.0.0.0', () => {
        resolve((receiver.address() as AddressInfo).port);
      });
    });
  }, 60_000);

  // beforeAll 이 중간에 실패해도 정리가 따라 실패하지 않도록 만들어진 것만 닫는다.
  afterAll(async () => {
    if (receiver) {
      receiver.closeAllConnections();
      await new Promise<void>((resolve) => receiver.close(() => resolve()));
    }
    for (const id of executionIds) {
      await db
        ?.query('DELETE FROM execution WHERE id = $1', [id])
        .catch(() => undefined);
    }
    for (const id of triggerIds) {
      await db
        ?.query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db?.end();
  });

  /** 입력 대기 알림을 구독하는 웹훅 트리거를 만들고 웹훅으로 실행해 그 알림 본문을 돌려준다. */
  async function runToWaitingNotification(
    tokenStrategy: 'per_execution' | 'per_trigger',
  ): Promise<{
    executionId: string;
    hookBody: Record<string, unknown>;
    body: NotificationBody;
  }> {
    const endpointPath = randomUUID();
    const created = await api('post', '/api/triggers').send({
      workflowId,
      type: 'webhook',
      name: uniqueName('notif-ix-trg'),
      endpointPath,
      interaction: { enabled: true, tokenStrategy },
      notification: {
        url: `http://${RUNNER_HOST}:${receiverPort}/notify`,
        events: ['execution.waiting_for_input'],
      },
    });
    expect(created.status).toBe(201);
    triggerIds.push(created.body.data.id as string);

    const hook = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .send({ payload: 'notif-ix' });
    expect(hook.status).toBe(202);
    const hookBody = hook.body.data as Record<string, unknown>;
    const executionId = hookBody.executionId as string;
    executionIds.push(executionId);

    const body = await waitFor(
      () =>
        received.find(
          (b) =>
            b.executionId === executionId &&
            b.type === 'execution.waiting_for_input',
        ),
      (b) => b !== undefined,
      '입력 대기 알림',
    );
    return { executionId, hookBody, body: body! };
  }

  function endpointsFor(executionId: string) {
    const base = `/api/external/executions/${executionId}`;
    return {
      stream: `${base}/stream`,
      submit: `${base}/interact`,
      status: base,
      cancel: `${base}/cancel`,
      refresh: `${base}/refresh-token`,
    };
  }

  it('per_execution — 알림에 실린 새 토큰으로 조회 · 제출이 통과하고 실행이 끝나면 그 토큰이 폐기된다', async () => {
    const { executionId, hookBody, body } =
      await runToWaitingNotification('per_execution');

    const interaction = body.payload.interaction;
    expect(interaction).toBeDefined();
    expect(interaction!.token).toMatch(/^iext_/);
    // 알림마다 새로 발급한다. 202 응답의 토큰과 다르다.
    expect(interaction!.token).not.toBe(
      (hookBody.interaction as { token: string }).token,
    );
    expect(Number.isNaN(Date.parse(interaction!.expiresAt!))).toBe(false);
    expect(interaction!.endpoints).toEqual(endpointsFor(executionId));
    expect(interaction!.expectedCommands).toEqual(['submit_form']);
    // 기존 평면 필드는 그대로 실린다.
    expect(body.payload.interactionType).toBe('form');
    expect(body.payload.waitingNodeId).toBe(formNodeId);

    const auth = { Authorization: `Bearer ${interaction!.token}` };
    const status = await request(BASE_URL)
      .get(interaction!.endpoints.status)
      .set(auth);
    expect(status.status).toBe(200);

    const submit = await request(BASE_URL)
      .post(interaction!.endpoints.submit)
      .set(auth)
      .send({
        command: 'submit_form',
        nodeId: formNodeId,
        data: { note: 'ok' },
      });
    expect(submit.status).toBe(202);

    await waitFor(
      async () =>
        (
          await db.query<{ status: string }>(
            'SELECT status FROM execution WHERE id = $1',
            [executionId],
          )
        ).rows[0]?.status,
      (s) => s === 'completed' || s === 'failed' || s === 'cancelled',
      '실행 종료',
    );
    // 종료 폐기는 fanout 이 종료 이벤트를 받은 뒤 비동기로 일어난다.
    await waitFor(
      async () =>
        (await request(BASE_URL).get(interaction!.endpoints.status).set(auth))
          .status,
      (code) => code === 401,
      '알림 토큰 폐기',
    );
  });

  it('per_trigger — token · expiresAt 없이 엔드포인트와 권장 명령만 싣는다', async () => {
    const { executionId, body } = await runToWaitingNotification('per_trigger');
    const interaction = body.payload.interaction;
    expect(interaction).toEqual({
      endpoints: endpointsFor(executionId),
      expectedCommands: ['submit_form'],
    });
  });
});
