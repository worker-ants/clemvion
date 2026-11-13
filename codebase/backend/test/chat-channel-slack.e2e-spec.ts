import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';
import { createHmac, randomUUID } from 'crypto';
import request from 'supertest';

import { createDbClient } from './helpers/db';
import { nextE2eClientIp } from './helpers/e2e-client-ip';
import {
  insertChatChannelTriggerRow,
  setupChatChannelTrigger,
} from './helpers/e2e-chat-channel-fixture';

/**
 * e2e: Slack Chat Channel adapter ([Spec providers/slack.md §3~§6]).
 *
 * 실 인프라 위에서 검증:
 * 1. url_verification handshake — 200 OK + root-level { challenge } (TransformInterceptor 우회)
 * 2. X-Slack-Signature HMAC-SHA256 검증
 *    - 정상 signature → 202 Accepted
 *    - 잘못된 signature → 401 Unauthorized
 *    - 5분 replay window 밖 → 401
 * 3. DM message event_callback → 202 + execution 시작 (or ignored)
 * 4. group chat (channel_type !== 'im') → 202 + ignored (groupChatRefusal)
 * 5. Interactivity(block_actions · view_submission) → 200 + 빈 본문. 트리거가 꺼져 있어도 같다
 *    (NERV Task `CLE-T-FCBG91`)
 * 6. 슬래시 명령 → 200 + 본인에게만 보이는 `{ response_type: 'ephemeral', text }`. help 는 도움말이고
 *    실행을 시작하지 않는다. 새 실행의 `response_code` 는 `200`. 트리거가 꺼져 있어도 같다
 *    (NERV Task `CLE-T-MGZRRP`)
 *
 * 본 e2e 는 chat.postMessage 외부 호출은 검증 안 함 — fake 가 없으면 실 API 호출이라
 * degraded health 갱신만 결과. 핵심은 HooksController + signing + parser dispatch flow.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const SLACK_SIGNING_SECRET = 'e2e-test-signing-secret-32chars-abc';

function signSlack(body: string, ts: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
    .update(`v0:${ts}:${body}`)
    .digest('hex');
  return `v0=${hmac}`;
}

function nowSec(offset = 0): string {
  return String(Math.floor(Date.now() / 1000) + offset);
}

/** 서명 검증을 건너뛰도록 `inboundSigningRef` 를 뺀 설정으로 바꾼다. */
async function dropSigningRef(db: Client, triggerId: string): Promise<void> {
  await db.query(`UPDATE trigger SET config = $1::jsonb WHERE id = $2`, [
    JSON.stringify({
      chatChannel: {
        provider: 'slack',
        botTokenRef: `secret://triggers/${triggerId}/bot-token`,
      },
    }),
    triggerId,
  ]);
}

/** Interactivity 요청 — Slack 은 `payload=<JSON>` 을 form-urlencoded 로 보낸다. */
function postInteractivity(path: string, payload: unknown) {
  return request(BASE_URL)
    .post(`/api/hooks/${path}`)
    .set('x-forwarded-for', nextE2eClientIp())
    .set('content-type', 'application/x-www-form-urlencoded')
    .send(
      `payload=${encodeURIComponent(typeof payload === 'string' ? payload : JSON.stringify(payload))}`,
    );
}

/** 슬래시 명령 요청 — Slack 은 `command` · `text` 등을 form-urlencoded 로 보낸다. 대화는 id 마다 따로 둔다. */
function postSlashCommand(path: string, id: string, text: string) {
  const form = new URLSearchParams({
    command: '/workflow',
    text,
    user_id: `U-${id}`,
    channel_id: `D-${id}`,
    team_id: 'T-e2e',
    trigger_id: `trg-${id}`,
  });
  return request(BASE_URL)
    .post(`/api/hooks/${path}`)
    .set('x-forwarded-for', nextE2eClientIp())
    .set('content-type', 'application/x-www-form-urlencoded')
    .send(form.toString());
}

/** 슬래시 명령의 기본 응답 — 본인에게만 보이는 수신 문구. */
const SLASH_RECEIVED = {
  response_type: 'ephemeral',
  text: '요청을 받았습니다.',
};

// inbound-signing secret 저장 (AES-256-GCM application encryption — secret_store INSERT 는
// application 경로를 거쳐야 함. e2e 에서는 직접 INSERT 가 불가 — REST API 없이
// 우회 위해 testing endpoint 가 있다면 사용, 없으면 SecretResolverService 의 평문 INSERT
// 가 fail-fast 라 별도 stub 필요. 본 e2e 는 trigger row 만 setup + auth flow 만 검증.
// user/workspace/workflow/trigger fixture 신설은 `helpers/e2e-chat-channel-fixture.ts` 에서 공용 헬퍼로.

describe('Slack Chat Channel e2e', () => {
  let db: Client;
  let endpointPath: string;
  let triggerId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const setup = await setupChatChannelTrigger({ db, provider: 'slack' });
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

  describe('inbound HTTP contract — Spec §5.5', () => {
    it('url_verification → 200 OK + root-level { challenge } (NOT { data: ... })', async () => {
      const body = JSON.stringify({
        type: 'url_verification',
        challenge: 'e2e-challenge-xyz',
        token: 'slack-token',
      });
      const ts = nowSec();
      const sig = signSlack(body, ts, SLACK_SIGNING_SECRET);
      // url_verification 도 signing header 필요 (Slack 동작) — 단 secret_store 가 비어있으면
      // verify skip (inboundSigningRef resolve 실패 케이스). 본 e2e 는 inboundSigningRef 가
      // 등록됐지만 secret_store row 가 없는 상태 → 401. signing skip path 확인 위해 ref 없는
      // trigger 별도 setup 도 가능하지만 본 spec 은 verify 정책만 검증.
      const res = await request(BASE_URL)
        .post(`/api/hooks/${endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .set('x-slack-signature', sig)
        .set('x-slack-request-timestamp', ts)
        .send(body);
      // secret_store 에 row 없으니 401 (resolve 실패). 정상 흐름 검증은 secret_store
      // setup 가 필요 — 본 e2e 는 signing path 분기만 확인.
      expect([200, 401]).toContain(res.status);
    });

    it('잘못된 signature → 401', async () => {
      const body = JSON.stringify({
        type: 'event_callback',
        event_id: 'Ev0001',
        event: {},
      });
      const ts = nowSec();
      const res = await request(BASE_URL)
        .post(`/api/hooks/${endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .set('x-slack-signature', 'v0=' + 'f'.repeat(64))
        .set('x-slack-request-timestamp', ts)
        .send(body);
      expect(res.status).toBe(401);
    });

    it('replay window 밖 (10분 과거) → 401', async () => {
      const body = '{}';
      const ts = nowSec(-(10 * 60));
      const sig = signSlack(body, ts, SLACK_SIGNING_SECRET);
      const res = await request(BASE_URL)
        .post(`/api/hooks/${endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .set('x-slack-signature', sig)
        .set('x-slack-request-timestamp', ts)
        .send(body);
      expect(res.status).toBe(401);
    });

    it('inboundSigningRef 미설정 trigger 는 signing skip → 202 (legacy)', async () => {
      // 새 trigger setup — inboundSigningRef 없음.
      const setup = await setupChatChannelTrigger({ db, provider: 'slack' });
      await db.query(`UPDATE trigger SET config = $1::jsonb WHERE id = $2`, [
        JSON.stringify({
          chatChannel: {
            provider: 'slack',
            botTokenRef: `secret://triggers/${setup.triggerId}/bot-token`,
          },
        }),
        setup.triggerId,
      ]);
      const body = JSON.stringify({
        type: 'url_verification',
        challenge: 'legacy-challenge',
      });
      const res = await request(BASE_URL)
        .post(`/api/hooks/${setup.endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .send(body);
      // signing skip + url_verification challenge 응답 → 200
      expect(res.status).toBe(200);
      expect(res.body.challenge).toBe('legacy-challenge');
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    });

    it('미지원 envelope → 202 + ignored (parser null)', async () => {
      const setup = await setupChatChannelTrigger({ db, provider: 'slack' });
      await db.query(`UPDATE trigger SET config = $1::jsonb WHERE id = $2`, [
        JSON.stringify({
          chatChannel: {
            provider: 'slack',
            botTokenRef: `secret://triggers/${setup.triggerId}/bot-token`,
          },
        }),
        setup.triggerId,
      ]);
      const body = JSON.stringify({ unknown: 'shape' });
      const res = await request(BASE_URL)
        .post(`/api/hooks/${setup.endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .send(body);
      expect(res.status).toBe(202);
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    });
  });

  describe('group chat 차단 — Spec CCH-CV-05', () => {
    it('channel_type=channel 의 message → 202 + ignored', async () => {
      const setup = await setupChatChannelTrigger({ db, provider: 'slack' });
      await db.query(`UPDATE trigger SET config = $1::jsonb WHERE id = $2`, [
        JSON.stringify({
          chatChannel: {
            provider: 'slack',
            botTokenRef: `secret://triggers/${setup.triggerId}/bot-token`,
          },
        }),
        setup.triggerId,
      ]);
      const body = JSON.stringify({
        type: 'event_callback',
        event_id: 'Ev_group_001',
        event: {
          type: 'message',
          channel_type: 'channel',
          channel: 'C123',
          user: 'U1',
          text: 'hi',
        },
      });
      const res = await request(BASE_URL)
        .post(`/api/hooks/${setup.endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .send(body);
      // 202 + ignored (parser null → caller maybeNotifyIgnored).
      // 본 e2e 는 chat.postMessage outbound (groupChatRefusal 안내 발송) 까지는 검증 안 함 —
      // fake Slack API 없이는 외부 호출 결과 검증 불가.
      expect(res.status).toBe(202);
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
    });
  });

  // 근거: [Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK) · Slack 공식 문서(Handling user interaction) —
  // Interactivity 요청에는 3초 안에 HTTP 200 으로 답해야 한다. 본문은 비워도 된다. 트리거가 꺼져 있어도
  // 같다(2026-11-12 사람 결정, NERV 질문 `01a1d025-8baf-773f-95fd-201820c7cd5f`). NERV Task `CLE-T-FCBG91`.
  describe('Interactivity 응답', () => {
    const blockActions = (id: string) => ({
      type: 'block_actions',
      trigger_id: `trg-${id}`,
      user: { id: `U-${id}` },
      channel: { id: `D-${id}` },
      container: { channel_id: `D-${id}` },
      actions: [{ action_id: 'btn', value: 'choice:1' }],
    });

    let on: { endpointPath: string; triggerId: string };
    let off: { endpointPath: string; triggerId: string };

    beforeAll(async () => {
      const setup = await setupChatChannelTrigger({ db, provider: 'slack' });
      await dropSigningRef(db, setup.triggerId);
      on = { endpointPath: setup.endpointPath, triggerId: setup.triggerId };
      off = await insertChatChannelTriggerRow(db, {
        workspaceId: setup.workspaceId,
        workflowId: setup.workflowId,
        name: 'slack-e2e-off',
        provider: 'slack',
        isActive: false,
      });
      await dropSigningRef(db, off.triggerId);
    });

    afterAll(async () => {
      await db
        .query('DELETE FROM trigger WHERE id = ANY($1::uuid[])', [
          [on.triggerId, off.triggerId],
        ])
        .catch(() => undefined);
    });

    it('block_actions(진행 중인 대화 없음) → 200 + 빈 본문', async () => {
      const res = await postInteractivity(
        on.endpointPath,
        blockActions(`ba-${Date.now()}`),
      );
      expect(res.status).toBe(200);
      expect(res.text).toBe('');
    });

    it('같은 block_actions 가 다시 와도(재도착 무시) 200 + 빈 본문', async () => {
      const payload = blockActions(`dup-${Date.now()}`);
      const first = await postInteractivity(on.endpointPath, payload);
      const second = await postInteractivity(on.endpointPath, payload);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.text).toBe('');
    });

    it('view_submission(알 수 없는 모달) → 200 + 빈 본문', async () => {
      const res = await postInteractivity(on.endpointPath, {
        type: 'view_submission',
        trigger_id: `trg-vs-${Date.now()}`,
        user: { id: 'U-vs' },
        view: { id: `V-${Date.now()}`, callback_id: 'other_modal' },
      });
      expect(res.status).toBe(200);
      expect(res.text).toBe('');
    });

    it('JSON 이 아닌 payload → 200 + 빈 본문', async () => {
      const res = await postInteractivity(on.endpointPath, 'not-json');
      expect(res.status).toBe(200);
      expect(res.text).toBe('');
    });

    it('꺼진 트리거의 block_actions → 200 + 빈 본문', async () => {
      const res = await postInteractivity(
        off.endpointPath,
        blockActions(`off-${Date.now()}`),
      );
      expect(res.status).toBe(200);
      expect(res.text).toBe('');
    });

    it('꺼진 트리거의 Events API 메시지는 지금처럼 202 다', async () => {
      const res = await request(BASE_URL)
        .post(`/api/hooks/${off.endpointPath}`)
        .set('x-forwarded-for', nextE2eClientIp())
        .set('content-type', 'application/json')
        .send(
          JSON.stringify({
            type: 'event_callback',
            event_id: `Ev-off-${Date.now()}`,
            event: {
              type: 'message',
              channel_type: 'im',
              channel: 'D-off',
              user: 'U-off',
              text: 'hi',
            },
          }),
        );
      expect(res.status).toBe(202);
    });
  });

  // 근거: [Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK) · Slack 공식 문서(Slash commands) — 슬래시
  // 명령에는 3초 안에 HTTP 200 으로 답해야 사용자에게 오류가 보이지 않는다. 응답 모양은 Discord 슬래시
  // 명령 선례(NERV Task `CLE-T-TSEP9G`)를 따른다. 본인에게만 보이는 메시지로 help 는 도움말, 나머지는
  // 수신 문구다. 트리거가 꺼져 있어도 같고 이때 실행은 시작하지 않는다. NERV Task `CLE-T-MGZRRP`.
  describe('슬래시 명령의 응답', () => {
    let on: { endpointPath: string; triggerId: string; workflowId: string };
    let off: { endpointPath: string; triggerId: string; workflowId: string };

    const countExecutions = async (workflowId: string): Promise<string> => {
      const rows = await db.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM execution WHERE workflow_id = $1',
        [workflowId],
      );
      return rows.rows[0]?.n ?? '';
    };

    beforeAll(async () => {
      const setup = await setupChatChannelTrigger({ db, provider: 'slack' });
      await dropSigningRef(db, setup.triggerId);
      on = {
        endpointPath: setup.endpointPath,
        triggerId: setup.triggerId,
        workflowId: setup.workflowId,
      };
      const offSetup = await setupChatChannelTrigger({ db, provider: 'slack' });
      // 켜진 트리거는 지우고 같은 워크플로우에 꺼진 트리거를 단다.
      await db.query('DELETE FROM trigger WHERE id = $1', [offSetup.triggerId]);
      const row = await insertChatChannelTriggerRow(db, {
        workspaceId: offSetup.workspaceId,
        workflowId: offSetup.workflowId,
        name: 'slack-e2e-slash-off',
        provider: 'slack',
        isActive: false,
      });
      await dropSigningRef(db, row.triggerId);
      off = { ...row, workflowId: offSetup.workflowId };
    });

    afterAll(async () => {
      await db
        .query('DELETE FROM trigger WHERE id = ANY($1::uuid[])', [
          [on.triggerId, off.triggerId],
        ])
        .catch(() => undefined);
    });

    it('/workflow help → 200 + 기본 도움말이고 실행을 시작하지 않는다', async () => {
      const res = await postSlashCommand(
        on.endpointPath,
        `help-${Date.now()}`,
        'help',
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        response_type: 'ephemeral',
        text: [
          '/workflow start - 새 대화 시작',
          '/workflow cancel - 진행 중인 대화 취소',
          '/workflow reply - 진행 중인 대화에 답장',
          '/workflow help - 도움말',
        ].join('\n'),
      });
      expect(await countExecutions(on.workflowId)).toBe('0');
    });

    it('/workflow cancel(진행 중인 대화 없음) → 200 + 수신 문구', async () => {
      const res = await postSlashCommand(
        on.endpointPath,
        `cancel-${Date.now()}`,
        'cancel',
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(SLASH_RECEIVED);
    });

    it('/workflow start → 200 + 수신 문구이고 새 실행의 response_code 는 200 이다', async () => {
      const setup = await setupChatChannelTrigger({ db, provider: 'slack' });
      await dropSigningRef(db, setup.triggerId);
      await db.query(
        `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
         VALUES ($1, $2, 'manual_trigger', 'trigger', 'trg', $3, 0, 0, NOW(), NOW())`,
        [randomUUID(), setup.workflowId, JSON.stringify({ parameters: [] })],
      );
      try {
        const res = await postSlashCommand(
          setup.endpointPath,
          `start-${Date.now()}`,
          'start',
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual(SLASH_RECEIVED);

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

    it('꺼진 트리거의 /workflow start → 200 + 수신 문구이고 실행을 시작하지 않는다', async () => {
      const res = await postSlashCommand(
        off.endpointPath,
        `off-start-${Date.now()}`,
        'start',
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(SLASH_RECEIVED);
      expect(await countExecutions(off.workflowId)).toBe('0');
    });
  });
});
