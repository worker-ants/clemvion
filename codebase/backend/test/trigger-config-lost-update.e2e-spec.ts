import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { buildSecretRef } from '../src/modules/secret-store/secret-ref';
import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: `trigger.config` lost update — 동시 PATCH 가 서로의 쓰기를 되돌리는가.
 *
 * 상위 plan: `plan/in-progress/trigger-config-lost-update.md` §C.
 * 구현: `src/modules/triggers/trigger-config-lock.ts` (advisory lock + 락 안 재읽기).
 *
 * ## 무엇이 이 테스트를 «판별» 하게 만드는가
 *
 * 두 요청이 **같은 스냅샷을 보도록 겹쳐야** 한다 — 겹치지 않으면 고치기 전에도 통과한다.
 * 그래서 겹침을 우연에 맡기지 않고 **advisory lock 을 테스트가 직접 쥐어** 만든다:
 * 요청 B 의 binder 쓰기는 `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))` 를
 * 잡아야 하는데, 그 락을 테스트 트랜잭션이 이미 쥐고 있으므로 B 는 거기서 멈춘다.
 * 그동안 테스트가 «요청 A» 를 연기한다 — 즉 *"setupChannel 이 성공해 server-issued
 * 서명을 발급하고, 자기 스냅샷으로 `config` 를 통째로 다시 쓴 동시 요청"* 이다.
 *
 * ## 분기 ↔ 대조군 대응표
 *
 * B 의 `adapter.setupChannel` 은 e2e 에 외부 mock 이 없어 **반드시 실패**하지만 그 실패까지
 * 걸리는 시간은 환경에 따라 다르다. 그래서 고치기 전 코드에는 **두 가지 인터리빙**이 있고,
 * 단언 하나만으로는 한쪽을 놓친다 — 아래 두 단언이 각각 한 행씩 맡는다.
 *
 * | B 의 binder 쓰기 시점 | 고치기 전 (락·재읽기 없음) | 고친 뒤 | 이 행을 무는 단언 |
 * |---|---|---|---|
 * | A 보다 **먼저** (setupChannel 이 빨리 실패) | A 가 자기 스냅샷으로 `config` 를 통째로 덮어 B 의 PATCH 가 **사라진다** → `rateLimitPerMinute=7` | B 가 락 뒤에 재읽어 쓰므로 `42` 가 남는다 | ① `rateLimitPerMinute === 42` |
 * | A 보다 **나중** (setupChannel 이 늦게 실패) | B 가 **요청 시작 시점의 게이트**(ref 없음)로 써서 A 가 막 확립한 `inboundSigningRef` 를 **지운다** → 인입 서명 검증 fail-open | 락 안 재읽기가 A 의 ref 를 보고 보존한다 | ② `inboundSigningRef` 존재 |
 *
 * 즉 **두 단언이 함께 있어야** 고치기 전이 어느 인터리빙에서도 RED 가 된다. 하나만 남기는
 * 편집은 나머지 한 행을 조용히 통과시킨다.
 *
 * ## 실측 — 이 테스트는 판별한다
 *
 * binder 의 **catch 경로만** 고치기 전 모양(`triggerRepository.update` 로 옛 스냅샷 위에 덮기)
 * 으로 되돌려 이 spec 하나만 돌렸다. 나머지 두 자리는 고친 채로 두어 원인을 한 자리로 좁혔다.
 *
 * - 뮤턴트: **RED** — `Expected: 42 / Received: 7` (대응표 1행. B 의 PATCH 가 통째로 사라졌다)
 * - 원본:  **PASS**
 *
 * 이 환경에서는 `setupChannel` 이 빨리 실패해 1행 인터리빙이 나온다. 2행(②번 단언)은 실패가
 * 늦은 환경을 위한 것이라 여기서는 실행되지 않았다 — **관측되지 않았다는 이유로 지우지 말 것.**
 *
 * ## 왜 telegram 인가
 *
 * 결함의 전제는 *"B 가 읽는 시점에 `inboundSigningRef` 가 **없고**, 그 사이 다른 요청이 그것을
 * 처음 확립한다"* 이다. slack/discord 의 ref 는 생성 시 사용자 평문으로 확립되고 PATCH DTO 는
 * `inboundSigningPlaintext` 를 아예 갖지 않으므로(`OmitType`), 기존 트리거에서 ref 를 **새로
 * 확립하는** 동시 요청은 telegram 의 server-issued 발급뿐이다. 게다가 telegram 트리거는 이
 * 환경에서 setupChannel 이 실패해 ref 없는 행으로 자연스럽게 만들어진다 — 전제를 만들려고
 * 행을 손으로 긁어낼 필요가 없다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** B 의 PATCH 가 싣는 값 — 락 안 재읽기가 이것을 **잃지 않아야** 한다. */
const RATE_LIMIT_FROM_B = 42;
/** A 의 스냅샷이 갖고 있던 값 — 고치기 전에는 이것이 B 를 덮는다. */
const RATE_LIMIT_FROM_A = 7;
/** B 가 락을 실제로 잡으러 갈 여유 — 이 대기는 판별이 아니라 관측 보조다(아래 註). */
const SETTLE_MS = 300;
/** window 1 커밋을 기다리는 폴링 상한·간격. */
const POLL_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 50;

interface ChatChannelRow {
  provider?: string;
  botTokenRef?: string;
  inboundSigningRef?: string;
  rateLimitPerMinute?: number;
}

describe('PATCH /api/triggers/:id — config lost update (e2e)', () => {
  let db: Client;
  /** 락 트랜잭션 전용 연결 — 폴링을 같은 연결로 하면 자기 트랜잭션 스냅샷을 본다. */
  let lockDb: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  const createdTriggerIds: string[] = [];

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    lockDb = createDbClient();
    await lockDb.connect();

    const owner = await registerAndLogin(BASE_URL, uniqueEmail('cfg-lost'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CFGLOST'),
    );

    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('cfg-lost-wf') });
    workflowId = wf.body.data.id;
  }, 60_000);

  // `secret_store` 고아 row 의 무해함과 `secret-store.md §R4` 와의 관계는
  // `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 註가 정본이다 — 같은 서술을 두 벌 두면
  // 한쪽만 낡는다.
  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await lockDb.end().catch(() => undefined);
    await db.end();
  });

  async function readChatChannel(triggerId: string): Promise<ChatChannelRow> {
    const res = await db.query<{ config: { chatChannel?: ChatChannelRow } }>(
      'SELECT config FROM trigger WHERE id = $1',
      [triggerId],
    );
    return res.rows[0]?.config?.chatChannel ?? {};
  }

  /** window 1(`update()` 의 config 쓰기)이 커밋될 때까지 기다린다. */
  async function waitForWindowOneCommit(triggerId: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      const cc = await readChatChannel(triggerId);
      if (cc.rateLimitPerMinute === RATE_LIMIT_FROM_B) return;
      if (Date.now() > deadline) {
        throw new Error(
          `window 1 커밋을 ${POLL_TIMEOUT_MS}ms 안에 관측하지 못했다 — ` +
            `PATCH 가 config 를 쓰지 않았거나 값이 달라졌다 (관측: ${JSON.stringify(cc)}). ` +
            '이 오류는 테스트가 겹침을 만들지 못했다는 뜻이므로 통과로 넘기면 안 된다.',
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  it('동시 PATCH — 한쪽이 막 확립한 inboundSigningRef 도, 다른 쪽의 PATCH 값도 살아남는다', async () => {
    // ── 준비: ref 가 **없는** telegram 트리거 (setupChannel 실패 → degraded) ──────────
    const created = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName('cfg-lost-tg'),
        endpointPath: crypto.randomUUID(),
        chatChannel: {
          provider: 'telegram',
          botToken: '111:e2eTelegramBotToken',
        },
      });
    expect(created.status).toBe(201);
    const triggerId = created.body.data.id as string;
    createdTriggerIds.push(triggerId);

    // 전제 확인 — ref 가 없어야 B 의 게이트가 거짓이 된다. 있으면 이 테스트는 결함을
    // 재현하지 못하므로 **여기서 멈추는 것이 맞다**.
    const before = await readChatChannel(triggerId);
    expect(before).not.toHaveProperty('inboundSigningRef');

    // ── 1) 테스트가 config 락을 쥔다 — B 의 binder 쓰기를 여기서 멈춰 세운다 ───────────
    await lockDb.query('BEGIN');
    await lockDb.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      triggerConfigLockKey(triggerId),
    ]);

    // ── 2) 요청 B — 카드 편집 PATCH (평문 없음 → ref presence 게이트가 거짓) ──────────
    let bSettled = false;
    const bPromise = request(BASE_URL)
      .patch(`/api/triggers/${triggerId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        chatChannel: {
          provider: 'telegram',
          rateLimitPerMinute: RATE_LIMIT_FROM_B,
        },
      })
      .then((res) => {
        bSettled = true;
        return res;
      });

    // window 1 은 락을 쓰지 않으므로 먼저 커밋된다. 이것을 기다리는 이유: A 의 쓰기가
    // window 1 보다 **앞서면** window 1 이 A 의 ref 를 덮어써서, 고친 코드에서도 ref 가
    // 사라진다. 그 창(window 1)은 이 배치의 범위 밖이라 트래커 항목으로 남겨 두었다.
    await waitForWindowOneCommit(triggerId);
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    // 여기서 **값만 붙잡고 단언은 맨 뒤로 미룬다.** 이 자리에서 단언하면 고치기 전 코드가
    // 유실을 보여 주기 **전에** 여기서 멈춰, 실패 메시지가 «응답이 벌써 왔다» 가 된다 —
    // 실측으로 확인했다(뮤턴트 첫 실행). 무엇이 깨졌는지는 유실 단언이 말해야 한다.
    const bPendingAtRelease = !bSettled;

    // ── 3) 요청 A — setupChannel 이 성공해 ref 를 확립하고, 자기 스냅샷으로 통째로 쓴다 ──
    const issuedRef = buildSecretRef({
      scope: 'triggers',
      resourceId: triggerId,
      name: 'inbound-signing',
    });
    const botTokenRef = buildSecretRef({
      scope: 'triggers',
      resourceId: triggerId,
      name: 'bot-token',
    });
    await lockDb.query('UPDATE trigger SET config = $2::jsonb WHERE id = $1', [
      triggerId,
      JSON.stringify({
        chatChannel: {
          provider: 'telegram',
          botTokenRef,
          inboundSigningRef: issuedRef,
          rateLimitPerMinute: RATE_LIMIT_FROM_A,
        },
      }),
    ]);
    // COMMIT 이 advisory lock 을 놓는다 (`pg_advisory_xact_lock` — 트랜잭션 종료 시 자동 해제).
    await lockDb.query('COMMIT');

    const bRes = await bPromise;
    expect(bRes.status).toBe(200);

    // ── 검증 ────────────────────────────────────────────────────────────────────────
    const after = await readChatChannel(triggerId);
    // ① B 의 PATCH 가 A 에게 통째로 덮이지 않았다 (대응표 1행).
    expect(after.rateLimitPerMinute).toBe(RATE_LIMIT_FROM_B);
    // ② A 가 막 확립한 서명 ref 를 B 가 지우지 않았다 — fail-open 회귀 캐너리 (대응표 2행).
    expect(after.inboundSigningRef).toBe(issuedRef);
    // ③ 관측 기록 — B 가 락에서 실제로 멈춰 있었다. 판별은 ①·② 가 하고, 이것은 «겹침이
    //    만들어졌는가» 를 남긴다. setupChannel 의 실패 지연이 길면 고치기 전 코드에서도
    //    참이 될 수 있으므로 단독으로는 판별하지 못한다.
    expect(bPendingAtRelease).toBe(true);
  }, 120_000);
});
