import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient } from './helpers/db';
import { nextE2eClientIp } from './helpers/e2e-client-ip';
import { setupChatChannelTrigger } from './helpers/e2e-chat-channel-fixture';

/**
 * e2e: Telegram 에서 버린 버튼 클릭(callback_query)도 인바운드 응답은 그대로다(NERV Task `CLE-T-K8Z2W0`).
 *
 * 버린 클릭(워크플로우 비활성 · 중복 update 등)에는 `answerCallbackQuery` 를 보내 클라이언트의 진행
 * 표시를 끝낸다. 이 호출은 응답을 기다리게 하지 않고 실패해도 응답을 바꾸지 않는다. 이 e2e 의 트리거는
 * bot token 비밀값이 없어 수신 확인이 실패한다. 그래도 응답은 `202` 와 `ignored` 다.
 * 어떤 경로에서 `answerCallbackQuery` 를 부르는지와 키보드를 지우지 않는다는 점은 단위 테스트
 * (`hooks.service.spec.ts` 「버린 update 의 수신 확인」, `telegram.adapter.spec.ts` `ackDroppedUpdate()`)가 고정한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Telegram 버린 버튼 클릭의 응답 (e2e)', () => {
  let db: Client;
  let setup: Awaited<ReturnType<typeof setupChatChannelTrigger>>;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    setup = await setupChatChannelTrigger({ db, provider: 'telegram' });
    // 워크플로우를 끄면 진행 중인 실행이 없는 대화의 클릭은 새 실행을 만들지 못하고 버려진다.
    await db.query('UPDATE workflow SET is_active = false WHERE id = $1', [
      setup.workflowId,
    ]);
  });

  afterAll(async () => {
    if (db) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [setup.triggerId])
        .catch(() => undefined);
      await db.end().catch(() => undefined);
    }
  });

  const callbackUpdate = (updateId: number) => ({
    update_id: updateId,
    callback_query: {
      id: `cbq-${updateId}`,
      from: { id: 82001, is_bot: false },
      message: { message_id: 1, chat: { id: 72001, type: 'private' } },
      data: 'choice:1',
    },
  });

  const post = (body: Record<string, unknown>) =>
    request(BASE_URL)
      .post(`/api/hooks/${setup.endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .send(JSON.stringify(body));

  it('꺼진 워크플로우 대화의 클릭 → 202 ignored, 실행은 생기지 않는다', async () => {
    const res = await post(callbackUpdate(Date.now()));

    expect(res.status).toBe(202);
    expect(res.body.data.executionId).toBe('ignored');
    const count = await db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM execution WHERE workflow_id = $1',
      [setup.workflowId],
    );
    expect(count.rows[0]?.n).toBe('0');
  });

  it('같은 update 가 다시 와도(중복) 202 ignored 다', async () => {
    const body = callbackUpdate(Date.now() + 1);
    const first = await post(body);
    const second = await post(body);

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(second.body.data.executionId).toBe('ignored');
  });
});
