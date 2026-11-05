import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import Redis from 'ioredis';
import request from 'supertest';
import http from 'node:http';
import { randomUUID } from 'node:crypto';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: EIA SSE 스트림의 Redis 쪽 동작과 트리거 단위 토큰 무효 때 닫기.
 *
 * 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림),
 * [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰), NERV Task `CLE-T-Z35F7P` · `CLE-T-EQDYC1` ·
 * `CLE-T-1GR2JE` · `CLE-T-XPG8DQ`.
 *
 * 백엔드 인스턴스는 하나다. 다른 서버 인스턴스는 이 테스트가 Redis 에 직접 쓰는 것으로 흉내 낸다. 버퍼 Stream 에 넣기,
 * live 채널 · 닫기 채널 발행, 연결 상한 ZSET 채우기다. 서버 인스턴스 둘 사이의 전달 자체는 단위 테스트
 * (`sse-adapter.service.spec.ts`)가 Redis 대역으로 본다. 여기서는 키 이름 · 메시지 형식 · Lua 스크립트가 실제 Redis 와
 * 맞는지 본다.
 *
 * 실행 행은 DB 에 직접 넣는다. 워크플로가 돌지 않으므로 스트림의 이벤트는 이 테스트가 넣은 것뿐이다. Redis 쓰기 대상
 * 판정을 보는 테스트만 워크플로를 실제로 돌린다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
/** 다른 서버 인스턴스를 흉내 내는 메시지의 `origin`. 백엔드의 것과 겹치지 않는다. */
const OTHER_ORIGIN = `e2e-other-${randomUUID()}`;
const SIGNAL_TIMEOUT_MS = 5_000;

interface SseConnection {
  status: number;
  /** 지금까지 받은 본문. */
  body(): string;
  /** 응답이 끝나면 풀린다. */
  ended: Promise<void>;
  close(): void;
}

function openSse(
  executionId: string,
  token: string,
  lastEventId?: string,
): Promise<SseConnection> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    };
    if (lastEventId !== undefined) headers['Last-Event-Id'] = lastEventId;
    const req = http.get(
      new URL(`/api/external/executions/${executionId}/stream`, BASE_URL),
      { headers },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          body += chunk;
        });
        const ended = new Promise<void>((done) => {
          res.on('end', done);
          res.on('close', done);
        });
        resolve({
          status: res.statusCode ?? 0,
          body: () => body,
          ended,
          close: () => req.destroy(),
        });
      },
    );
    req.on('error', reject);
  });
}

interface SseFrame {
  event?: string;
  id?: string;
  data?: string;
}

/** 본문을 프레임으로 나눈다. heartbeat 주석은 뺀다. */
function frames(body: string): SseFrame[] {
  return body
    .split('\n\n')
    .map((block) => {
      const frame: SseFrame = {};
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) frame.event = line.slice(7);
        else if (line.startsWith('id: ')) frame.id = line.slice(4);
        else if (line.startsWith('data: ')) frame.data = line.slice(6);
      }
      return frame;
    })
    .filter((f) => f.event !== undefined);
}

async function waitFor<T>(
  read: () => T | Promise<T>,
  ok: (value: T) => boolean,
  label: string,
): Promise<T> {
  const deadline = Date.now() + SIGNAL_TIMEOUT_MS;
  for (;;) {
    const value = await read();
    if (ok(value)) return value;
    if (Date.now() > deadline) {
      throw new Error(
        `${label}: ${SIGNAL_TIMEOUT_MS}ms 안에 오지 않았다 (마지막 값 ${JSON.stringify(value)})`,
      );
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function waitEnded(conn: SseConnection, label: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      conn.ended,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`${label}: ${SIGNAL_TIMEOUT_MS}ms 안에 끝나지 않았다`),
            ),
          SIGNAL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** 백엔드의 구독 연결 이름. `SSE_SUBSCRIBER_CONNECTION_NAME` 과 같다. */
const SUBSCRIBER_CONNECTION_NAME = 'eia-sse-sub';

/** 크기 상한을 넘어 이벤트 대신 실린 생략 표시 메시지. */
function omittedMessage(executionId: string, seq: number): string {
  return JSON.stringify({
    v: 1,
    origin: OTHER_ORIGIN,
    omitted: { executionId, seq, eventType: 'execution.node.completed' },
  });
}

function eventMessage(executionId: string, seq: number): string {
  return JSON.stringify({
    v: 1,
    origin: OTHER_ORIGIN,
    event: {
      executionId,
      eventType: 'execution.node.started',
      seq,
      payload: { executionId, seq },
    },
  });
}

describe('EIA SSE — Redis fan-out 과 트리거 단위 토큰 무효 때 닫기 (e2e)', () => {
  let db: Client;
  let redis: Redis;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  const triggerIds: string[] = [];
  const executionIds: string[] = [];

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    redis = new Redis({
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT ?? '6379'),
    });
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('sse-fo'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('SSEFO'),
    );
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('sse-fo-wf') });
    expect(wf.status).toBe(201);
    workflowId = wf.body.data.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const id of executionIds) {
      await db
        .query('DELETE FROM execution WHERE id = $1', [id])
        .catch(() => undefined);
    }
    for (const id of triggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
    await redis.quit();
  });

  function api(method: 'post' | 'patch', path: string) {
    return request(BASE_URL)
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
  }

  async function issueTriggerToken(triggerId: string): Promise<string> {
    const issued = await api(
      'post',
      `/api/triggers/${triggerId}/interaction/revoke-token`,
    );
    expect(issued.status).toBe(200);
    const value = issued.body.data.token as string;
    expect(value).toMatch(/^itk_/);
    return value;
  }

  /** 트리거 단위 토큰 전략의 웹훅 트리거를 만들고 토큰을 발급한다. */
  async function createItkTrigger(): Promise<{
    triggerId: string;
    itk: string;
  }> {
    const created = await api('post', '/api/triggers').send({
      workflowId,
      type: 'webhook',
      name: uniqueName('sse-fo-trg'),
      endpointPath: randomUUID(),
      interaction: { enabled: true, tokenStrategy: 'per_trigger' },
    });
    expect(created.status).toBe(201);
    const triggerId = created.body.data.id as string;
    triggerIds.push(triggerId);
    return { triggerId, itk: await issueTriggerToken(triggerId) };
  }

  async function insertWaitingExecution(triggerId: string): Promise<string> {
    const id = randomUUID();
    await db.query(
      `INSERT INTO execution (id, workflow_id, trigger_id, status, started_at)
       VALUES ($1, $2, $3, 'waiting_for_input', NOW())`,
      [id, workflowId, triggerId],
    );
    executionIds.push(id);
    return id;
  }

  /** 백엔드가 구독자를 등록하고 연결 자리를 잡을 때까지 기다린다. 응답 헤더는 등록 뒤 재확인을 마치고 나간다. */
  async function waitSlot(executionId: string, count: number): Promise<void> {
    await waitFor(
      () => redis.zcard(`eia:sse:subs:${executionId}`),
      (n) => n === count,
      `연결 자리 ${count}개`,
    );
  }

  async function expectRejected(
    executionId: string,
    itk: string,
  ): Promise<void> {
    const again = await openSse(executionId, itk);
    await waitEnded(again, '401 응답');
    expect(again.status).toBe(401);
    expect(
      (JSON.parse(again.body()) as { error: { code: string } }).error.code,
    ).toBe('TOKEN_INVALID');
  }

  it('토큰을 재발급하면 옛 토큰으로 연 스트림이 끝나고 옛 토큰은 401 이다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    const conn = await openSse(executionId, itk);
    expect(conn.status).toBe(200);
    await waitSlot(executionId, 1);

    const rotated = await issueTriggerToken(triggerId);

    await waitEnded(conn, '재발급 뒤 스트림 종료');
    // 끝낸 연결의 자리를 돌려준다.
    await waitSlot(executionId, 0);
    await expectRejected(executionId, itk);

    const fresh = await openSse(executionId, rotated);
    expect(fresh.status).toBe(200);
    fresh.close();
  });

  it('PATCH 로 인터랙션을 끄면 스트림이 끝나고 같은 토큰은 401 이다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    const conn = await openSse(executionId, itk);
    expect(conn.status).toBe(200);
    await waitSlot(executionId, 1);

    const patched = await api('patch', `/api/triggers/${triggerId}`).send({
      interaction: { enabled: false, tokenStrategy: 'per_trigger' },
    });
    expect(patched.status).toBe(200);

    await waitEnded(conn, '인터랙션 끈 뒤 스트림 종료');
    await expectRejected(executionId, itk);
  });

  it('다른 서버 인스턴스의 닫기 신호(eia:sse:close)로 스트림이 끝난다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    const conn = await openSse(executionId, itk);
    expect(conn.status).toBe(200);
    await waitSlot(executionId, 1);

    await redis.publish(
      'eia:sse:close',
      JSON.stringify({ v: 1, origin: OTHER_ORIGIN, triggerIds: [triggerId] }),
    );

    await waitEnded(conn, '닫기 신호 뒤 스트림 종료');
  });

  /** 다른 서버 인스턴스가 쓰는 형식(`seq` · `data` 필드)으로 버퍼에 넣는다. */
  async function appendBuffer(
    executionId: string,
    seq: number,
    message: string,
  ): Promise<void> {
    const key = `eia:sse:buf:${executionId}`;
    await redis.xadd(
      key,
      'MAXLEN',
      '~',
      1000,
      '*',
      'seq',
      String(seq),
      'data',
      message,
    );
    await redis.pexpire(key, 300_000);
  }

  async function waitLiveSubscribed(executionId: string): Promise<void> {
    const channel = `eia:sse:live:${executionId}`;
    await waitFor(
      async () =>
        Number(((await redis.pubsub('NUMSUB', channel)) as unknown[])[1]),
      (n) => n >= 1,
      'live 채널 구독',
    );
  }

  it('replay 버퍼에서 seq 필드가 있는 항목을 Last-Event-Id 뒤부터 다시 보낸다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    for (const seq of [1, 2, 3]) {
      await appendBuffer(executionId, seq, eventMessage(executionId, seq));
    }

    const conn = await openSse(executionId, itk, '1');
    expect(conn.status).toBe(200);
    const got = await waitFor(
      () => frames(conn.body()),
      (f) => f.some((x) => x.id === '3'),
      'replay 프레임',
    );
    conn.close();
    expect(got.map((f) => f.id)).toEqual(['2', '3']);
  });

  // 배포 중에는 이전 버전 서버 인스턴스가 `data` 필드만 있는 항목을 쓴다. 그 항목도 읽어야 한다.
  it('replay 버퍼(Redis Stream)에서 Last-Event-Id 뒤의 이벤트를 다시 보낸다 — seq 필드가 없는 이전 형식', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    const key = `eia:sse:buf:${executionId}`;
    for (const seq of [1, 2, 3]) {
      await redis.xadd(
        key,
        'MAXLEN',
        '~',
        1000,
        '*',
        'data',
        eventMessage(executionId, seq),
      );
    }
    await redis.pexpire(key, 300_000);

    const conn = await openSse(executionId, itk, '1');
    expect(conn.status).toBe(200);
    const got = await waitFor(
      () => frames(conn.body()),
      (f) => f.some((x) => x.id === '3'),
      'replay 프레임',
    );
    conn.close();
    expect(got.map((f) => f.id)).toEqual(['2', '3']);
    expect(got.map((f) => f.event)).toEqual([
      'execution.node.started',
      'execution.node.started',
    ]);
  });

  it('다른 서버 인스턴스가 live 채널로 보낸 이벤트를 받는다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    const channel = `eia:sse:live:${executionId}`;
    const conn = await openSse(executionId, itk);
    expect(conn.status).toBe(200);
    await waitFor(
      async () =>
        Number(((await redis.pubsub('NUMSUB', channel)) as unknown[])[1]),
      (n) => n >= 1,
      'live 채널 구독',
    );

    await redis.publish(channel, eventMessage(executionId, 1));

    const got = await waitFor(
      () => frames(conn.body()),
      (f) => f.length > 0,
      'live 프레임',
    );
    conn.close();
    expect(got).toEqual([
      {
        event: 'execution.node.started',
        id: '1',
        data: JSON.stringify({ executionId, seq: 1 }),
      },
    ]);
  });

  // 근거: NERV Task `CLE-T-1GR2JE` — 구독 연결이 끊긴 사이 발행된 이벤트는 live 로 오지 않는다. 다시 준비되면 버퍼로 채운다.
  it('구독 연결이 끊겼다가 다시 준비되면 그 사이 버퍼에만 들어간 이벤트를 채우고 실시간 전달을 이어 간다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    const channel = `eia:sse:live:${executionId}`;
    const conn = await openSse(executionId, itk);
    expect(conn.status).toBe(200);
    await waitLiveSubscribed(executionId);

    await appendBuffer(executionId, 1, eventMessage(executionId, 1));
    await redis.publish(channel, eventMessage(executionId, 1));
    await waitFor(
      () => frames(conn.body()),
      (f) => f.some((x) => x.id === '1'),
      'live 프레임 1',
    );

    // 백엔드의 구독 연결을 끊는다. 다시 연결하기 전에 다른 서버 인스턴스가 낸 이벤트는 버퍼에만 있다.
    const list = (await redis.client('LIST')) as string;
    const ids = list
      .split('\n')
      .filter((line) => line.includes(` name=${SUBSCRIBER_CONNECTION_NAME} `))
      .map((line) => /(?:^|\s)id=(\d+)/.exec(line)?.[1])
      .filter((id): id is string => id !== undefined);
    expect(ids.length).toBeGreaterThan(0);
    await appendBuffer(executionId, 2, eventMessage(executionId, 2));
    for (const id of ids) await redis.client('KILL', 'ID', id);

    await waitFor(
      () => frames(conn.body()),
      (f) => f.some((x) => x.id === '2'),
      '다시 준비된 뒤 따라잡은 프레임 2',
    );
    // 다시 구독했으므로 live 채널로 오는 이벤트도 받는다.
    await waitLiveSubscribed(executionId);
    await appendBuffer(executionId, 3, eventMessage(executionId, 3));
    await redis.publish(channel, eventMessage(executionId, 3));
    const got = await waitFor(
      () => frames(conn.body()),
      (f) => f.some((x) => x.id === '3'),
      'live 프레임 3',
    );
    conn.close();
    expect(got.map((f) => f.id)).toEqual(['1', '2', '3']);
  });

  // 근거: NERV Task `CLE-T-XPG8DQ` — 크기 상한을 넘은 이벤트는 다른 서버 인스턴스에 생략 표시로만 온다.
  it('live 채널로 생략 표시가 오면 그 자리에서 replay_unavailable 을 보내고 실시간 전달을 이어 간다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    const channel = `eia:sse:live:${executionId}`;
    const conn = await openSse(executionId, itk);
    expect(conn.status).toBe(200);
    await waitLiveSubscribed(executionId);

    await redis.publish(channel, eventMessage(executionId, 1));
    await redis.publish(channel, omittedMessage(executionId, 2));
    await redis.publish(channel, eventMessage(executionId, 3));
    const got = await waitFor(
      () => frames(conn.body()),
      (f) => f.some((x) => x.id === '3'),
      'live 프레임 3',
    );
    conn.close();
    expect(got.map((f) => [f.event, f.id])).toEqual([
      ['execution.node.started', '1'],
      ['execution.replay_unavailable', undefined],
      ['execution.node.started', '3'],
    ]);
    expect(JSON.parse(got[1].data!)).toMatchObject({ lastEventId: 1 });
  });

  it('replay 범위에 생략 표시가 있으면 구간이 끊긴 것으로 보고 replay_unavailable 만 보낸다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    await appendBuffer(executionId, 1, eventMessage(executionId, 1));
    await appendBuffer(executionId, 2, omittedMessage(executionId, 2));
    await appendBuffer(executionId, 3, eventMessage(executionId, 3));

    const conn = await openSse(executionId, itk, '1');
    expect(conn.status).toBe(200);
    await waitFor(
      () => frames(conn.body()),
      (f) => f.length > 0,
      'replay_unavailable 프레임',
    );
    // 부분 replay 가 뒤따르지 않는지 잠시 더 본다.
    await new Promise((r) => setTimeout(r, 300));
    conn.close();
    expect(frames(conn.body()).map((f) => f.event)).toEqual([
      'execution.replay_unavailable',
    ]);
  });

  it('버퍼 키가 없고 순번 카운터가 Last-Event-Id 보다 크면 replay_unavailable 을 보낸다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    await redis.set(`exec:seq:${executionId}`, '7', 'EX', 60);

    const conn = await openSse(executionId, itk, '5');
    expect(conn.status).toBe(200);
    const got = await waitFor(
      () => frames(conn.body()),
      (f) => f.length > 0,
      'replay_unavailable 프레임',
    );
    conn.close();
    expect(got[0].event).toBe('execution.replay_unavailable');
    // 스트림 위치가 아니므로 id 를 싣지 않는다.
    expect(got[0].id).toBeUndefined();
  });

  it('연결 상한은 모든 서버 인스턴스의 자리를 합친 Redis ZSET 으로 센다', async () => {
    const { triggerId, itk } = await createItkTrigger();
    const executionId = await insertWaitingExecution(triggerId);
    const key = `eia:sse:subs:${executionId}`;
    const now = Date.now();
    await redis.zadd(key, now, 'other-1', now, 'other-2', now, 'other-3');
    await redis.pexpire(key, 45_000);

    const rejected = await openSse(executionId, itk);
    await waitEnded(rejected, '429 응답');
    expect(rejected.status).toBe(429);
    expect(
      (JSON.parse(rejected.body()) as { error: { code: string } }).error.code,
    ).toBe('TOO_MANY_CONNECTIONS');

    // heartbeat 가 45초 넘게 끊긴 자리는 Lua 스크립트가 지우고 센다.
    await redis.zadd(key, now - 60_000, 'other-1');
    const admitted = await openSse(executionId, itk);
    expect(admitted.status).toBe(200);
    expect(await redis.zscore(key, 'other-1')).toBeNull();
    admitted.close();
    await redis.del(key);
  });

  // 근거: NERV Task `CLE-T-XPG8DQ` — EIA SSE 로 열릴 수 있는 실행(트리거가 있거나 실행 토큰 행이 있음)의 이벤트만 Redis 에
  // 쓴다. 같은 워크플로를 웹훅과 수동 실행으로 돌려 비교한다.
  describe('Redis 쓰기 대상', () => {
    // 꺼진 워크플로는 웹훅으로 실행되지 않는다. 이 묶음만 켠 워크플로를 쓴다.
    let activeWorkflowId: string;
    beforeAll(async () => {
      const wf = await request(BASE_URL)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ name: uniqueName('sse-fo-active'), isActive: true });
      expect(wf.status).toBe(201);
      activeWorkflowId = wf.body.data.id as string;
    });

    async function waitTerminal(executionId: string): Promise<void> {
      await waitFor(
        async () => {
          const r = await db.query<{ status: string }>(
            'SELECT status FROM execution WHERE id = $1',
            [executionId],
          );
          return r.rows[0]?.status ?? null;
        },
        (status) =>
          status === 'completed' ||
          status === 'failed' ||
          status === 'cancelled',
        '실행 종료',
      );
    }

    it('트리거로 시작한 실행은 replay 버퍼에 쓴다', async () => {
      const endpointPath = randomUUID();
      const created = await api('post', '/api/triggers').send({
        workflowId: activeWorkflowId,
        type: 'webhook',
        name: uniqueName('sse-fo-hook'),
        endpointPath,
      });
      expect(created.status).toBe(201);
      triggerIds.push(created.body.data.id as string);

      const hook = await request(BASE_URL)
        .post(`/api/hooks/${endpointPath}`)
        .send({ payload: 'sse' });
      expect(hook.status).toBe(202);
      const executionId = hook.body.data.executionId as string;
      executionIds.push(executionId);
      await waitTerminal(executionId);
      await waitFor(
        () => redis.xlen(`eia:sse:buf:${executionId}`),
        (n) => n > 0,
        '버퍼 항목',
      );
      const [[, fields]] = (await redis.xrange(
        `eia:sse:buf:${executionId}`,
        '-',
        '+',
      )) as Array<[string, string[]]>;
      expect(fields[0]).toBe('seq');
      expect(fields[2]).toBe('data');
    });

    it('트리거도 실행 토큰도 없는 수동 실행은 Redis 에 쓰지 않는다', async () => {
      const exec = await api(
        'post',
        `/api/workflows/${activeWorkflowId}/execute`,
      ).send({});
      expect(exec.status).toBe(202);
      const executionId = exec.body.data.executionId as string;
      executionIds.push(executionId);
      await waitTerminal(executionId);
      // 판정과 쓰기는 이벤트 뒤에 비동기로 일어난다. 트리거 실행이 버퍼를 채우는 시간보다 넉넉히 기다린다.
      await new Promise((r) => setTimeout(r, 500));
      expect(await redis.exists(`eia:sse:buf:${executionId}`)).toBe(0);
    });
  });
});
