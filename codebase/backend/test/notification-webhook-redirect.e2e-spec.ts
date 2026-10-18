// 알림 웹훅 발송이 리다이렉트를 따라가지 않는다는 것을 실제 발송 워커(backend-e2e) · 실제 fetch · 실제 네트워크 위에서
// 고정한다(NERV Task `CLE-T-ZGYXSZ`).
// 근거: [EIA 알림 웹훅 「재시도와 실패 처리」](CLE-EIA-NOTIFY#재시도와-실패-처리)
// 근거: [EIA 알림 웹훅 「SSRF 방지」](CLE-EIA-NOTIFY#ssrf-방지)
//
// 이 러너 컨테이너에 수신 서버 둘을 띄운다. 알림 URL 의 서버(redirector)는 307 로 다른 서버(landing)를 가리킨다.
// 발송 워커는 backend-e2e 컨테이너에서 돌고 러너의 호스트 이름(`backend-e2e-runner`)으로 이 서버들에 닿는다. 그 이름은
// Docker 내장 DNS 가 푼다. 알림 URL 이 http 라서 backend-e2e 에 `ALLOW_HTTP_HOOKS=1` 을 준다. 둘 다
// `docker-compose.e2e.yml` 에 있다.
//
// 두 서버는 같은 호스트에 있어서 redirector 가 요청을 받았다면 landing 에도 닿을 수 있다. 그래서 landing 이 요청을 받지
// 않은 것은 발송이 리다이렉트를 따라가지 않았다는 뜻이다. 다만 landing 에 닿을 수 없는 환경이어도 같은 결과가 나온다.
// 그래서 landing 을 알림 URL 로 직접 둔 발송이 landing 에 닿는 양성 대조를 함께 둔다. 발송 job 은 큐에 직접 넣는다.
// 실행을 끝까지 돌려 이벤트를 만드는 경로(fanout · dispatcher)는 이 시험의 대상이 아니고 각 단위 시험이 본다.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import request from 'supertest';
import { Queue, QueueEvents } from 'bullmq';

import {
  NOTIFICATION_BACKOFF_TYPE,
  NOTIFICATION_WEBHOOK_QUEUE,
  type NotificationWebhookJob,
} from '../src/modules/external-interaction/notification-dispatcher.types';
import { REDIRECT_NOT_FOLLOWED_HINT } from '../src/modules/external-interaction/notification-webhook.processor';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT ?? '6379'),
  ...(process.env.REDIS_PASSWORD
    ? { password: process.env.REDIS_PASSWORD }
    : {}),
};

/** backend-e2e 가 이 러너에 닿는 호스트 이름. `docker-compose.e2e.yml` 의 러너 `hostname` 이다. */
const RUNNER_HOST = os.hostname();

/** 발송 job 이 끝나기를 기다리는 상한. 첫 시도가 마지막 시도라 재시도 간격은 없다. */
const DELIVERY_WAIT_MS = 30_000;

interface ReceivedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '0.0.0.0', () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function close(server: Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('알림 웹훅 발송의 리다이렉트 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  let queue: Queue<NotificationWebhookJob>;
  let queueEvents: QueueEvents;
  let redirector: Server;
  let landing: Server;
  let redirectorPort: number;
  let landingPort: number;
  const redirectorRequests: ReceivedRequest[] = [];
  const landingRequests: ReceivedRequest[] = [];
  const createdTriggerIds: string[] = [];
  const addedJobIds: string[] = [];

  function api() {
    return {
      post: (path: string, body: object = {}) =>
        request(BASE_URL)
          .post(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId)
          .send(body),
    };
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('notif-redirect'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('NOTIF-REDIRECT'),
    );
    const wf = await api().post('/api/workflows', {
      name: uniqueName('notif-redirect-wf'),
    });
    workflowId = wf.body.data.id as string;

    landing = createServer((req, res) => {
      landingRequests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
      });
      res.writeHead(200).end();
    });
    landingPort = await listen(landing);
    redirector = createServer((req, res) => {
      redirectorRequests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
      });
      res
        .writeHead(307, {
          Location: `http://${RUNNER_HOST}:${landingPort}/landing`,
        })
        .end();
    });
    redirectorPort = await listen(redirector);

    queue = new Queue<NotificationWebhookJob>(NOTIFICATION_WEBHOOK_QUEUE, {
      connection: redisConnection,
    });
    queueEvents = new QueueEvents(NOTIFICATION_WEBHOOK_QUEUE, {
      connection: redisConnection,
    });
    await queueEvents.waitUntilReady();
  }, 60_000);

  // beforeAll 이 중간에 실패해도 정리가 따라 실패하지 않도록 만들어진 것만 닫는다.
  afterAll(async () => {
    for (const jobId of addedJobIds) {
      await (await queue?.getJob(jobId))?.remove().catch(() => undefined);
    }
    await queueEvents?.close();
    await queue?.close();
    await close(redirector);
    await close(landing);
    for (const id of createdTriggerIds) {
      await db
        ?.query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db?.end();
  });

  // 시험마다 받은 요청을 비워 서로의 결과에 섞이지 않게 한다.
  beforeEach(() => {
    redirectorRequests.length = 0;
    landingRequests.length = 0;
  });

  /** 알림 URL 이 `url` 인 webhook 트리거를 만들고 id 를 돌려준다. */
  async function createTriggerWithNotificationUrl(
    url: string,
  ): Promise<string> {
    const created = await api().post('/api/triggers', {
      workflowId,
      type: 'webhook',
      name: uniqueName('notif-redirect'),
      endpointPath: crypto.randomUUID(),
      notification: { url, events: ['execution.completed'] },
    });
    expect(created.status).toBe(201);
    const triggerId = created.body.data.id as string;
    createdTriggerIds.push(triggerId);
    return triggerId;
  }

  /** 첫 시도가 마지막 시도인 발송 job 을 큐에 넣고 job 과 deliveryId 를 돌려준다. */
  async function enqueueDelivery(triggerId: string) {
    const deliveryId = crypto.randomUUID();
    const executionId = crypto.randomUUID();
    const job = await queue.add(
      'notify:execution.completed',
      {
        deliveryId,
        triggerId,
        eventType: 'execution.completed',
        executionId,
        workflowId,
        eventBody: {
          type: 'execution.completed',
          executionId,
          triggerId,
          workflowId,
          seq: 1,
          timestamp: new Date().toISOString(),
          payload: { status: 'completed', durationMs: null },
        },
      },
      {
        jobId: deliveryId,
        // 첫 시도가 마지막 시도다. 3xx 가 다른 실패처럼 마지막 시도에서 degraded 를 남기는지 본다.
        attempts: 1,
        backoff: { type: NOTIFICATION_BACKOFF_TYPE },
      },
    );
    addedJobIds.push(deliveryId);
    return { job, deliveryId };
  }

  it('307 이 가리키는 주소로 서명한 본문을 보내지 않고 마지막 시도면 degraded 로 둔다', async () => {
    const triggerId = await createTriggerWithNotificationUrl(
      `http://${RUNNER_HOST}:${redirectorPort}/hook`,
    );
    const { job, deliveryId } = await enqueueDelivery(triggerId);

    await expect(
      job.waitUntilFinished(queueEvents, DELIVERY_WAIT_MS),
    ).rejects.toThrow(/HTTP 307/);

    // redirector 가 서명한 발송을 한 번 받았다. 발송 워커가 이 러너에 닿았다는 뜻이다.
    expect(redirectorRequests).toHaveLength(1);
    expect(redirectorRequests[0].method).toBe('POST');
    expect(redirectorRequests[0].url).toBe('/hook');
    expect(redirectorRequests[0].headers['x-clemvion-delivery']).toBe(
      deliveryId,
    );
    expect(redirectorRequests[0].headers['x-clemvion-signature']).toMatch(
      /^t=\d+,v1=[0-9a-f]+/,
    );
    // 같은 호스트의 landing 은 아무 요청도 받지 않았다.
    expect(landingRequests).toEqual([]);

    const row = await db.query<{
      notification_health: string;
      notification_last_error: string | null;
    }>(
      'SELECT notification_health, notification_last_error FROM trigger WHERE id = $1',
      [triggerId],
    );
    expect(row.rows[0].notification_health).toBe('degraded');
    expect(row.rows[0].notification_last_error).toBe(
      `HTTP 307 Temporary Redirect. ${REDIRECT_NOT_FOLLOWED_HINT}`,
    );
  });

  // 양성 대조: 위 시험의 "landing 이 요청을 받지 않았다" 는 backend-e2e 가 landing 에 닿지 못해도 참이다. landing 을
  // 알림 URL 로 직접 두면 같은 발송이 landing 에 닿고 성공해야 한다. 닿는다면 위 시험의 빈 landingRequests 는
  // 환경 탓이 아니라 리다이렉트를 따라가지 않아서다.
  it('landing 을 알림 URL 로 직접 두면 발송이 landing 에 닿고 healthy 로 둔다', async () => {
    const triggerId = await createTriggerWithNotificationUrl(
      `http://${RUNNER_HOST}:${landingPort}/landing`,
    );
    const { job, deliveryId } = await enqueueDelivery(triggerId);

    await job.waitUntilFinished(queueEvents, DELIVERY_WAIT_MS);

    expect(redirectorRequests).toEqual([]);
    expect(landingRequests).toHaveLength(1);
    expect(landingRequests[0].method).toBe('POST');
    expect(landingRequests[0].url).toBe('/landing');
    expect(landingRequests[0].headers['x-clemvion-delivery']).toBe(deliveryId);

    const row = await db.query<{
      notification_health: string;
      notification_last_error: string | null;
    }>(
      'SELECT notification_health, notification_last_error FROM trigger WHERE id = $1',
      [triggerId],
    );
    expect(row.rows[0].notification_health).toBe('healthy');
    expect(row.rows[0].notification_last_error).toBeNull();
  });
});
