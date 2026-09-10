import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { expectTriggerWorkflowRef } from '../src/shared/testing/trigger-workflow-ref';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: `TriggerDto.workflow` 가 **어느 응답 경로에서 실리고 어디서 빠지는가** 를 고정한다.
 *
 * ## 왜 별 파일인가
 *
 * 트리거 읽기·수정 표면이 세 e2e 파일에 흩어져 있어(수신 전용 `webhook-trigger`, 스케줄 동기화
 * `schedule-trigger`, 생성 진입 `chat-channel-trigger-create`) 단언을 그쪽에 얹으면 **"이 축은
 * 여섯 형태로 고정된다" 는 사실이 어느 파일에서도 읽히지 않는다.** 자매 축(스케줄)이 성립하는
 * 이유가 그 반대다 — 네 단언이 한 파일에 모여 있어 하나를 지우면 나머지가 대조군으로 남는다.
 *
 * ## 무엇을 막는가
 *
 * `TriggerDto.workflow` JSDoc 은 *"생성 응답에만 없다"* 고 보장한다. 그 보장이 **한 번 구현보다
 * 넓었다** — PATCH 의 chatChannel 재조회 분기가 `relations` 를 빼고 읽어 그 응답에서만 `workflow`
 * 가 사라졌다 (`review/code/2026/09/06/01_13_50` W4). 부재가 §5.4 **키 생략형**이라
 * `assertMatchesContract` 는 그 자리를 물지 못한다 — 양성 대조가 유일한 방어다.
 *
 * ## 경로 전수 (`TriggerDto` shape 를 내보내는 곳은 네 개뿐)
 *
 * | 경로 | 서비스 | `workflow` |
 * |---|---|---|
 * | `POST /api/triggers` | `create` (+chatChannel 분기 재조회도 `relations` 없음) | **없음** |
 * | `GET /api/triggers` | `findAll` — `leftJoinAndSelect('t.workflow','w')` | 있음 |
 * | `GET /api/triggers/:id` | `findOneDetail` → `findById` `relations: ['workflow']` | 있음 |
 * | `PATCH /api/triggers/:id` | `update` — `findById` 로 시작, chatChannel 분기는 `relations` 재조회 | 있음 |
 *
 * `history`·`DELETE`·rotate 3종은 트리거 shape 가 아니라 대상 밖이다.
 *
 * ## 외부 호출 비용 — 두 자리에서만 발생한다
 *
 * `chatChannel` 이 실린 요청은 `setupChatChannel` → 실제 provider API 를 때린다. e2e 에는 mock 이
 * 없어 실패하지만 `catch` 가 삼키고 `chatChannelHealth=degraded` 로 저장할 뿐이므로(CCH-SE-01)
 * 응답 경로는 정상 진행한다. telegram client 는 **5초 timeout × 3회 + 백오프 1s/2s** 라 호출당
 * 최악 ~18초다. 그래서 chatChannel 이 붙는 두 자리(생성 1회 · PATCH 1회)에만 넉넉한 타임아웃을
 * 준다. **이 비용을 모르면 캐너리가 기본 타임아웃에서 flaky 로 죽고, 원인을 재조회 분기가 아니라
 * 테스트 탓으로 오진한다.**
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** provider API 왕복 최악값(~18초) + 여유. */
const CHAT_CHANNEL_TIMEOUT_MS = 60_000;

describe('TriggerDto.workflow 응답 경로 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;

  /** chatChannel 없는 트리거 — 목록·단건·일반 PATCH 용. 외부 호출 0회. */
  let plainTriggerId: string;
  let plainCreateBody: unknown;

  /** chatChannel 있는 트리거 — 생성 서브경로 + chatChannel PATCH 용. */
  let chatTriggerId: string;
  let chatCreateBody: unknown;

  const createdTriggerIds: string[] = [];

  function postTrigger(body: Record<string, unknown>) {
    return request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send(body);
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wfref'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('WFREF'),
    );

    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wfref-wf') });
    expect(wf.status).toBe(201);
    workflowId = wf.body.data.id as string;

    const plain = await postTrigger({
      workflowId,
      type: 'webhook',
      name: uniqueName('wfref-plain'),
      // endpoint_path 는 서버가 v4 UUID 형식을 강제한다 (W1).
      endpointPath: crypto.randomUUID(),
    });
    expect(plain.status).toBe(201);
    plainCreateBody = plain.body.data;
    plainTriggerId = plain.body.data.id as string;
    createdTriggerIds.push(plainTriggerId);

    // chatChannel 이 붙는 생성 — 여기서 외부 호출 1회가 발생한다(실패는 삼켜진다).
    const chat = await postTrigger({
      workflowId,
      type: 'webhook',
      name: uniqueName('wfref-chat'),
      endpointPath: crypto.randomUUID(),
      chatChannel: { provider: 'telegram', botToken: '111:e2eWfRefBotToken' },
    });
    expect(chat.status).toBe(201);
    chatCreateBody = chat.body.data;
    chatTriggerId = chat.body.data.id as string;
    createdTriggerIds.push(chatTriggerId);
  }, 120_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it('1. POST /api/triggers — 생성 응답에는 `workflow` 키가 없다 (두 서브경로 각각)', () => {
    // 평범한 생성: `saved`(관계 미로드) 를 그대로 반환.
    expectTriggerWorkflowRef(plainCreateBody, { present: false });
    // chatChannel 이 붙은 생성: setupChatChannel 뒤 재조회하지만 그 재조회도 `relations` 를
    // 싣지 않는다. **서브경로가 둘이므로 각각 문다** — 하나만 걸면 나머지가 조용히 갈릴 수 있다.
    expectTriggerWorkflowRef(chatCreateBody, { present: false });
  });

  it('2. GET /api/triggers — 목록은 채운다 (`findAll` 의 leftJoinAndSelect)', async () => {
    const res = await request(BASE_URL)
      .get('/api/triggers?type=webhook&limit=100')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    const listed = (res.body.data as Array<Record<string, unknown>>).find(
      (row) => row.id === plainTriggerId,
    );
    expect(listed).toBeDefined();
    expectTriggerWorkflowRef(listed, { present: true });
  });

  it('3. GET /api/triggers/:id — 단건은 채운다 (`findOneDetail` → `findById` relations)', async () => {
    const res = await request(BASE_URL)
      .get(`/api/triggers/${plainTriggerId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expectTriggerWorkflowRef(res.body.data, { present: true });
  });

  it('4. PATCH /api/triggers/:id — 일반 수정은 채운다 (`update` 가 `findById` 로 시작)', async () => {
    const res = await request(BASE_URL)
      .patch(`/api/triggers/${plainTriggerId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wfref-renamed') });
    expect(res.status).toBe(200);
    expectTriggerWorkflowRef(res.body.data, { present: true });
  });

  /**
   * **이 케이스가 이 파일의 존재 이유다.**
   *
   * 1~4 만 걸면 정확히 그때 깨졌던 경로를 안 무는 캐너리가 된다. `if (chatChannel)` 재조회 분기를
   * 실제로 통과해야 하므로 `chatChannel` 을 바디에 실어 보낸다 — 그 분기의 `relations: ['workflow']`
   * 를 지우면 **이 케이스만** RED 여야 한다(1~4 는 그 분기를 타지 않는다).
   */
  it(
    '5. PATCH /api/triggers/:id — chatChannel 포함 수정도 채운다 (재조회 분기, W4 회귀)',
    async () => {
      const res = await request(BASE_URL)
        .patch(`/api/triggers/${chatTriggerId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Workspace-Id', workspaceId)
        .send({
          chatChannel: {
            provider: 'telegram',
            // **`botToken` 은 생략할 수 없다** — `ChatChannelConfigDto` 가 필수 문자열로 요구한다
            // (실측: 빼면 400 `VALIDATION_ERROR` / `chatChannel.botToken must be a string`).
            botToken: '111:e2eWfRefBotToken',
            uiMapping: { formMode: 'auto' },
          },
        });
      expect(res.status).toBe(200);
      expectTriggerWorkflowRef(res.body.data, { present: true });
    },
    CHAT_CHANNEL_TIMEOUT_MS,
  );
});
