import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { randomUUID } from 'node:crypto';

import { createDbClient } from './helpers/db';
import { nextE2eClientIp } from './helpers/e2e-client-ip';
import {
  insertChatChannelTriggerRow,
  setupChatChannelTrigger,
} from './helpers/e2e-chat-channel-fixture';

/**
 * e2e: Discord Chat Channel adapter ([Spec providers/discord.md §3~§6]).
 *
 * 검증:
 * 1. PING handshake — 200 OK + root-level `{ type: 1 }` (TransformInterceptor 우회)
 * 2. 잘못된 signature → 401
 * 3. inboundSigningRef 미설정 (legacy) → signing skip + PING 응답
 * 4. 미지원 type(autocomplete) → 202 + ignored
 * 5. 컴포넌트 클릭 · 모달 제출 → 200 + root-level `{ type: 6 }` (NERV Task `CLE-T-7XWVC5`)
 * 6. 슬래시 명령 → 200 + 본인에게만 보이는 `{ type: 4 }`. 새 실행의 `response_code` 는 `200`
 *    (NERV Task `CLE-T-TSEP9G`)
 * 7. 꺼진 트리거도 인터랙션에는 인터랙션 응답으로 답하고 PING 은 202 다 (NERV Task `CLE-T-TSEP9G`)
 * 8. 채팅 채널 트리거는 공개 웹훅 한도(32KB 본문 · IP 시작 한도)를 받지 않는다 (NERV Task `CLE-T-QKJ2TZ`)
 *
 * ed25519 signature 의 정상 검증은 unit test (discord-signing.spec) 가 keypair round-trip
 * 검증 — e2e 는 HooksController PING handshake + 401 path 만 검증.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** 슬래시 명령의 기본 응답 — 본인에게만 보이는(flags 64) 수신 문구. */
const RECEIVED = {
  type: 4,
  data: { content: '요청을 받았습니다.', flags: 64 },
};

const post = (path: string, body: Record<string, unknown>) =>
  request(BASE_URL)
    .post(`/api/hooks/${path}`)
    .set('x-forwarded-for', nextE2eClientIp())
    .set('content-type', 'application/json')
    .send(JSON.stringify(body));

/** DM(channel type 1) 이나 길드 채널(0)의 interaction. 대화(채널 · 사용자)는 id 마다 따로 둔다. */
const interaction = (
  id: string,
  type: number,
  channelType: number,
  data?: Record<string, unknown>,
) => ({
  id,
  application_id: 'A',
  type,
  token: 'tok',
  version: 1,
  channel_id: `C-${id}`,
  channel: { id: `C-${id}`, type: channelType },
  user: { id: `U-${id}`, username: 'u' },
  ...(data ? { data } : {}),
});

const slash = (subCommand: string) => ({
  name: 'workflow',
  options: [{ name: subCommand, type: 1 }],
});

// user/workspace/workflow/trigger fixture 는 `helpers/e2e-chat-channel-fixture.ts` 공용 헬퍼로.
// Discord 는 `inboundSigningRef` 가 trigger.config 에 박히지 않는다 — signing skip
// (legacy) path 검증 위한 의도적 누락. 헬퍼가 provider='discord' 인자에서 이 동작을 보장.

describe('Discord Chat Channel e2e', () => {
  let db: Client;
  let endpointPath: string;
  let triggerId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const setup = await setupChatChannelTrigger({ db, provider: 'discord' });
    endpointPath = setup.endpointPath;
    triggerId = setup.triggerId;
  });

  afterAll(async () => {
    if (db) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [triggerId])
        .catch(() => undefined);
      await db.end().catch(() => undefined);
    }
  });

  it('PING (type=1) + signing skip (legacy) → 200 + { type: 1 }', async () => {
    const body = JSON.stringify({
      id: 'I-ping-1',
      application_id: 'A',
      type: 1,
      token: 'tok',
      version: 1,
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe(1);
  });

  it('미지원 type (autocomplete=4) → 202 + ignored', async () => {
    const body = JSON.stringify({
      id: 'I-ac-1',
      application_id: 'A',
      type: 4,
      token: 'tok',
      version: 1,
      channel_id: 'C1',
      channel: { id: 'C1', type: 1 },
      user: { id: 'U1' },
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(202);
  });

  // 길드 채널 슬래시 명령은 파서가 버리지만(parser null) 슬래시 명령이라 3초 응답은 돌려준다.
  it('guild channel (type=0) 슬래시 명령 → 200 + 수신 문구 { type: 4 } (parser null)', async () => {
    const body = JSON.stringify({
      id: 'I-guild-1',
      application_id: 'A',
      type: 2,
      token: 'tok',
      version: 1,
      channel_id: 'C2',
      channel: { id: 'C2', type: 0 },
      user: { id: 'U1' },
      data: { name: 'workflow', options: [{ name: 'start', type: 1 }] },
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(RECEIVED);
  });

  // 근거: [Discord 「인바운드 응답」](CLE-CHAT-DISCORD) — 컴포넌트 클릭 · 모달 제출은 3초 안에 200 과
  // 콜백 응답을 받아야 클라이언트에 실패 표시가 뜨지 않는다. NERV Task `CLE-T-7XWVC5`.
  describe('컴포넌트 클릭 · 모달 제출의 응답', () => {
    it('DM 버튼 클릭(type 3) → 200 + { type: 6 }', async () => {
      const res = await post(
        endpointPath,
        interaction(`I-btn-${Date.now()}`, 3, 1, {
          component_type: 2,
          custom_id: 'btn:1',
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ type: 6 });
    });

    it('DM 선택 메뉴(type 3, component_type 3) → 200 + { type: 6 }', async () => {
      const res = await post(
        endpointPath,
        interaction(`I-sel-${Date.now()}`, 3, 1, {
          component_type: 3,
          custom_id: 'sel:1',
          values: ['a'],
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ type: 6 });
    });

    it('길드 채널 버튼 클릭(파싱하지 않음) → 200 + { type: 6 }', async () => {
      const res = await post(
        endpointPath,
        interaction(`I-guild-btn-${Date.now()}`, 3, 0, {
          component_type: 2,
          custom_id: 'btn:1',
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ type: 6 });
    });

    it('Reply 모달 제출(type 5) → 200 + { type: 6 }', async () => {
      const res = await post(
        endpointPath,
        interaction(`I-modal-${Date.now()}`, 5, 1, {
          custom_id: 'clemvion_reply',
          components: [
            {
              type: 1,
              components: [{ type: 4, custom_id: 'reply', value: 'hello' }],
            },
          ],
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ type: 6 });
    });

    it('같은 interaction 이 다시 와도(재도착 무시) 200 + { type: 6 }', async () => {
      const body = interaction(`I-dup-${Date.now()}`, 3, 1, {
        component_type: 2,
        custom_id: 'btn:dup',
      });
      const first = await post(endpointPath, body);
      const second = await post(endpointPath, body);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual({ type: 6 });
    });
  });

  // 근거: [Discord 「인바운드 응답」](CLE-CHAT-DISCORD) — 슬래시 명령도 3초 안에 200 과 콜백 응답을 받아야
  // 한다. type 6 은 슬래시 명령에 쓸 수 없어 본인에게만 보이는 type 4 로 답한다. 2026-11-12 사람 결정
  // (NERV 질문 `01a1d025-899f-7709-b759-4f7bf6c16ef5`, Task `CLE-T-TSEP9G`).
  describe('슬래시 명령의 응답', () => {
    it('DM /workflow help → 200 + 기본 도움말 { type: 4 }', async () => {
      const res = await post(
        endpointPath,
        interaction(`I-help-${Date.now()}`, 2, 1, slash('help')),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        type: 4,
        data: {
          content: [
            '/workflow start - 새 대화 시작',
            '/workflow cancel - 진행 중인 대화 취소',
            '/workflow reply - 진행 중인 대화에 답장',
            '/workflow help - 도움말',
          ].join('\n'),
          flags: 64,
        },
      });
    });

    it('DM /workflow cancel(진행 중인 대화 없음) → 200 + 수신 문구 { type: 4 }', async () => {
      const res = await post(
        endpointPath,
        interaction(`I-cancel-${Date.now()}`, 2, 1, slash('cancel')),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(RECEIVED);
    });

    it('DM /workflow start → 200 + 수신 문구이고 새 실행의 response_code 는 200 이다', async () => {
      const setup = await setupChatChannelTrigger({ db, provider: 'discord' });
      await db.query(
        `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
         VALUES ($1, $2, 'manual_trigger', 'trigger', 'trg', $3, 0, 0, NOW(), NOW())`,
        [randomUUID(), setup.workflowId, JSON.stringify({ parameters: [] })],
      );
      try {
        const res = await post(
          setup.endpointPath,
          interaction(`I-start-${Date.now()}`, 2, 1, slash('start')),
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual(RECEIVED);

        const rows = await db.query<{ response_code: string | null }>(
          'SELECT response_code FROM execution WHERE workflow_id = $1',
          [setup.workflowId],
        );
        expect(rows.rows.map((r) => r.response_code)).toEqual(['200']);
      } finally {
        await db
          .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
          .catch(() => undefined);
      }
    });
  });

  // 근거: 2026-11-12 사람 결정(NERV 질문 `01a1d025-8baf-773f-95fd-201820c7cd5f`, Task `CLE-T-TSEP9G`) —
  // 트리거가 꺼져 있어도 인터랙션에는 인터랙션 응답으로 답해 클라이언트에 실패 표시가 뜨지 않게 한다.
  // 실행은 시작하지 않는다. PING 은 지금처럼 202 라 꺼진 트리거의 URL 등록은 실패한다.
  describe('꺼진 트리거의 응답', () => {
    let off: { endpointPath: string; triggerId: string; workflowId: string };

    beforeAll(async () => {
      const setup = await setupChatChannelTrigger({ db, provider: 'discord' });
      // 켜진 트리거는 지우고 같은 워크플로우에 꺼진 트리거를 단다.
      await db.query('DELETE FROM trigger WHERE id = $1', [setup.triggerId]);
      const row = await insertChatChannelTriggerRow(db, {
        workspaceId: setup.workspaceId,
        workflowId: setup.workflowId,
        name: 'discord-e2e-off',
        provider: 'discord',
        isActive: false,
      });
      off = { ...row, workflowId: setup.workflowId };
    });

    afterAll(async () => {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [off.triggerId])
        .catch(() => undefined);
    });

    it('버튼 클릭 → 200 + { type: 6 }', async () => {
      const res = await post(
        off.endpointPath,
        interaction(`I-off-btn-${Date.now()}`, 3, 1, {
          component_type: 2,
          custom_id: 'btn:1',
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ type: 6 });
    });

    it('/workflow start → 200 + 수신 문구이고 실행을 시작하지 않는다', async () => {
      const res = await post(
        off.endpointPath,
        interaction(`I-off-start-${Date.now()}`, 2, 1, slash('start')),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(RECEIVED);
      const rows = await db.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM execution WHERE workflow_id = $1',
        [off.workflowId],
      );
      expect(rows.rows[0]?.n).toBe('0');
    });

    it('PING → 202 (URL 등록은 실패한다)', async () => {
      const res = await post(off.endpointPath, {
        id: `I-off-ping-${Date.now()}`,
        application_id: 'A',
        type: 1,
        token: 'tok',
        version: 1,
      });
      expect(res.status).toBe(202);
    });
  });

  // 근거: [웹훅 「요청 제한과 남용 방어」](CLE-TRIG-WEBHOOK#요청-제한과-남용-방어) — 채팅 채널 트리거는
  // 프로바이더 서명으로 인증하고 공개 웹훅 제한을 받지 않는다. 공개 웹훅의 한도는 webhook-trigger e2e
  // L(413) · O(429)가 지킨다. NERV Task `CLE-T-QKJ2TZ`.
  describe('공개 웹훅 한도 제외', () => {
    it('32KB 를 넘는 본문도 413 이 아니라 처리한다', async () => {
      const res = await request(BASE_URL)
        .post(`/api/hooks/${endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .send(
          JSON.stringify({
            id: 'I-big-ping',
            application_id: 'A',
            type: 1,
            token: 'tok',
            version: 1,
            pad: 'x'.repeat(40 * 1024),
          }),
        );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ type: 1 });
    });

    it('같은 IP 에서 분당 시작 한도(10)를 넘겨 와도 429 가 아니다', async () => {
      // 다른 e2e 파일의 IP(203.0.113.0/24)와 겹치지 않게 TEST-NET-2 의 고정 IP 를 쓴다.
      const ip = '198.51.100.32';
      const statuses: number[] = [];
      for (let i = 0; i < 12; i += 1) {
        const res = await request(BASE_URL)
          .post(`/api/hooks/${endpointPath}`)
          .set('x-forwarded-for', ip)
          .set('content-type', 'application/json')
          .send(
            JSON.stringify({
              id: `I-burst-${i}`,
              application_id: 'A',
              type: 1,
              token: 'tok',
              version: 1,
            }),
          );
        statuses.push(res.status);
      }
      expect(statuses).toEqual(Array(12).fill(200));
    });
  });

  it('inboundSigningRef 설정된 trigger + 잘못된 signature → 401', async () => {
    const setup = await setupChatChannelTrigger({ db, provider: 'discord' });
    await db.query(`UPDATE trigger SET config = $1::jsonb WHERE id = $2`, [
      JSON.stringify({
        chatChannel: {
          provider: 'discord',
          botTokenRef: `secret://triggers/${setup.triggerId}/bot-token`,
          inboundSigningRef: `secret://triggers/${setup.triggerId}/inbound-signing`,
        },
      }),
      setup.triggerId,
    ]);
    const body = JSON.stringify({
      id: 'I',
      type: 1,
      token: 't',
      version: 1,
      application_id: 'A',
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${setup.endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .set('x-signature-ed25519', 'f'.repeat(128))
      .set('x-signature-timestamp', String(Math.floor(Date.now() / 1000)))
      .send(body);
    expect(res.status).toBe(401);
    await db
      .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
      .catch(() => undefined);
  });

  // ai-review (PR #301 security INFO #2) 후속 — chat-channel inbound webhook 은
  // public route 라 workspace owner 의 `emailVerified` 와 무관하게 동작한다
  // (`jwt.strategy` 가드는 protected API 한정). 본 invariant 가 향후 회귀로
  // 깨지면 (예: 누군가 inbound 처리에 owner.emailVerified 검사를 잘못 추가)
  // 본 케이스가 fail 해 차단한다. 헬퍼 JSDoc 의 "ownerEmailVerified" 옵션
  // 노트와 함께 SoT 를 이룸.
  it('owner.emailVerified=false trigger 의 inbound (PING) → 200 + signing skip (legacy)', async () => {
    const setup = await setupChatChannelTrigger({
      db,
      provider: 'discord',
      ownerEmailVerified: false,
    });
    const body = JSON.stringify({
      id: 'I-unverified-ping-1',
      application_id: 'A',
      type: 1,
      token: 'tok',
      version: 1,
    });
    const res = await request(BASE_URL)
      .post(`/api/hooks/${setup.endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .send(body);
    // inbound 는 owner.emailVerified 와 무관 — PING handshake 정상 수행.
    expect(res.status).toBe(200);
    expect(res.body.type).toBe(1);
    await db
      .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
      .catch(() => undefined);
  });
});
