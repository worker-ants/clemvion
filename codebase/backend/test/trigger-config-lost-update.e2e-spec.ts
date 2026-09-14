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
 * 요청 B 는 `update()` 의 **첫 쓰기**부터 `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`
 * 를 잡아야 하는데, 그 락을 테스트 트랜잭션이 이미 쥐고 있으므로 B 는 **아무것도 쓰기 전에**
 * 멈춘다.
 * 그동안 테스트가 «요청 A» 를 연기한다 — 즉 *"setupChannel 이 성공해 server-issued
 * 서명을 발급하고, 자기 스냅샷으로 `config` 를 통째로 다시 쓴 동시 요청"* 이다.
 *
 * ## 분기 ↔ 대조군 대응표
 *
 * `update()` 의 쓰기도 같은 락 안에 있으므로 B 는 **첫 쓰기 전에** 멈춘다. 그동안 테스트가
 * «요청 A» 를 커밋하고 락을 놓으면, 고친 코드는 재읽은 A 의 상태 위에 B 를 얹고, 고치기 전
 * 코드는 멈추지 않으므로 B 를 먼저 쓰고 A 가 그것을 덮는다.
 *
 * | | 고치기 전 (락·재읽기 없음) | 고친 뒤 | 무는 단언 |
 * |---|---|---|---|
 * | B 의 PATCH 값 | A 가 자기 스냅샷으로 덮어 **사라진다** → `rateLimitPerMinute=7` | 락 뒤 재읽기라 `42` 가 남는다 | ① |
 * | A 가 막 확립한 `inboundSigningRef` | B 가 요청 시작 시점 게이트로 써서 **지운다** → fail-open | 게이트 두 항이 모두 재읽은 행에서 온다 | ② |
 * | A 가 함께 커밋한 손대지 않은 키 | B 의 창 1 이 옛 스냅샷으로 덮어 **사라진다** | 창 1 이 재읽은 행 위에 병합한다 | ③ |
 *
 * 세 단언은 서로 다른 자리를 문다 — 하나만 남기는 편집은 나머지를 조용히 통과시킨다.
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
/** A 가 함께 커밋하는 «이번 요청이 손대지 않은» config 최상위 키. */
const UNTOUCHED_KEY = 'untouchedByPatchB';

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

  /** A 가 «손대지 않은 키» 로 커밋하는 config 최상위 키. */
  async function readUntouchedKey(
    triggerId: string,
  ): Promise<string | undefined> {
    const res = await db.query<{ config: Record<string, unknown> }>(
      'SELECT config FROM trigger WHERE id = $1',
      [triggerId],
    );
    return res.rows[0]?.config?.[UNTOUCHED_KEY] as string | undefined;
  }

  async function readChatChannel(triggerId: string): Promise<ChatChannelRow> {
    const res = await db.query<{ config: { chatChannel?: ChatChannelRow } }>(
      'SELECT config FROM trigger WHERE id = $1',
      [triggerId],
    );
    return res.rows[0]?.config?.chatChannel ?? {};
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
    //
    // `update()` 의 쓰기도 같은 락을 잡으므로 B 는 **아무것도 쓰기 전에** 여기서 멈춘다.
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

    await new Promise((r) => setTimeout(r, SETTLE_MS));

    // **겹침이 실제로 만들어졌는지**를 여기서 관측만 하고, 단언은 맨 뒤로 미룬다. 이 자리에서
    // 단언하면 고치기 전 코드가 유실을 보여 주기 **전에** 멈춰, 실패 메시지가 «응답이 벌써
    // 왔다» 가 된다 — 실측으로 확인했다. 무엇이 깨졌는지는 유실 단언이 말해야 한다.
    const blockedBeforeRelease =
      !bSettled &&
      (await readChatChannel(triggerId)).rateLimitPerMinute !==
        RATE_LIMIT_FROM_B;

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
        [UNTOUCHED_KEY]: 'kept',
      }),
    ]);
    // COMMIT 이 advisory lock 을 놓는다 (`pg_advisory_xact_lock` — 트랜잭션 종료 시 자동 해제).
    await lockDb.query('COMMIT');

    const bRes = await bPromise;
    expect(bRes.status).toBe(200);

    // ── 검증 ────────────────────────────────────────────────────────────────────────
    const after = await readChatChannel(triggerId);
    // ① B 의 PATCH 가 A 에게 통째로 덮이지 않았다.
    expect(after.rateLimitPerMinute).toBe(RATE_LIMIT_FROM_B);
    // ② A 가 막 확립한 서명 ref 를 B 가 지우지 않았다 — fail-open 회귀 캐너리.
    expect(after.inboundSigningRef).toBe(issuedRef);
    // ③ A 가 함께 커밋한 «손대지 않은 키» 도 살아남았다 — 창 1 이 재읽은 행 위에 병합한다.
    expect(await readUntouchedKey(triggerId)).toBe('kept');
    // ④ 관측 기록 — B 가 락에서 실제로 멈춰 있었고 아직 아무것도 쓰지 않았다.
    expect(blockedBeforeRelease).toBe(true);
  }, 120_000);
});
