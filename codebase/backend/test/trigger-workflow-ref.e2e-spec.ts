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
 * 가 사라졌다 (`review/code/2026/09/06/01_13_50` W4).
 *
 * `assertMatchesContract` 가 무능해서가 아니다 — 그 검증자는 optional-non-nullable 필드의 `null`
 * 은 잡는다. **이 분기에 그 검증자를 거는 기존 호출이 하나도 없다**는 것이 이유이고, 부재 자체는
 * §5.4 키 생략형이라 그 축으로는 애초에 위반이 아니다. 그래서 양성 대조가 필요하다.
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
 * 양성 케이스는 **shape 만이 아니라 identity 도** 문다 — `expectedWorkflowId` 를 넘겨
 * `workflow.id` 가 그 트리거가 실제로 가리키는 워크플로우인지 확인한다. shape 만 보면
 * 엉뚱한 relation 에서 채워진 그럴듯한 UUID+이름이 통과한다
 * (`review/code/2026/09/10/14_34_18` testing W1).
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

/**
 * `chatChannel` 이 실린 요청 한 건의 상한.
 *
 * telegram client 는 5초 timeout × 3회 + 백오프 1s/2s 라 최악 ~18초다. **실측은 271~302ms** —
 * e2e 망에서 `api.telegram.org` DNS 가 즉시 실패해 timeout 까지 가지 않는다. 그래도 상한을
 * 넉넉히 두는 것은 CI 망에서 DNS 가 즉시 실패하지 않고 실제로 timeout 을 태울 수 있기 때문이고,
 * 그때 **flaky 실패를 재조회 분기 결함으로 오진하는 것**이 이 파일이 가장 피해야 할 결과다.
 */
const CHAT_CHANNEL_TIMEOUT_MS = 60_000;

/**
 * `beforeAll` 상한 — 회원가입 + 워크스페이스 + 워크플로 + 트리거 2개(그중 1개가 `chatChannel`).
 * `chatChannel` 한 건이 위 상한을 다 쓸 수 있으므로 그 두 배를 준다(파생값이라 두 숫자가 같은
 * 근거를 공유한다는 것이 코드에 드러난다).
 */
const SETUP_TIMEOUT_MS = CHAT_CHANNEL_TIMEOUT_MS * 2;

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
  }, SETUP_TIMEOUT_MS);

  /**
   * teardown 은 이웃 e2e 파일들의 관례를 그대로 따른다(raw `DELETE FROM trigger` + `db.end()`).
   *
   * **단 그 관례가 모든 테이블을 덮지는 않는다.** `chatChannel` 이 붙은 트리거는
   * `setupChatChannel` 이 외부 호출 **이전에** `secrets.rotate()` 로 `secret_store` 에 row 를
   * 쓴다 — 그래서 provider 호출이 실패해도 row 는 남는다. 그 정리는 `TriggersService.remove()`
   * 의 `deleteByPrefix` 만 하고, `secret_store` 는 FK 가 없어(application-level cascade)
   * raw `DELETE FROM trigger` 로는 **고아 row 가 남는다**
   * (`review/code/2026/09/10/14_34_18` side_effect W2).
   *
   * 여기서 그것까지 지우지 않는 이유는 자매 파일(`chat-channel-trigger-create.e2e-spec.ts`)과
   * 동일 관례를 유지하는 편이 낫고, e2e 스키마가 ephemeral 이라 세션을 넘겨 누적되지 않기
   * 때문이다. **"row 정리 불필요" 를 `secret_store` 까지 검증한 것으로 오인하지 말 것.**
   */
  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it('A. POST /api/triggers — 생성 응답에는 `workflow` 키가 없다 (두 서브경로 각각)', () => {
    // 평범한 생성: `saved`(관계 미로드) 를 그대로 반환.
    expectTriggerWorkflowRef(plainCreateBody, { present: false });
    // chatChannel 이 붙은 생성: setupChatChannel 뒤 재조회하지만 그 재조회도 `relations` 를
    // 싣지 않는다. **서브경로가 둘이므로 각각 문다** — 하나만 걸면 나머지가 조용히 갈릴 수 있다.
    expectTriggerWorkflowRef(chatCreateBody, { present: false });
  });

  it('B. GET /api/triggers — 목록은 채운다 (`findAll` 의 leftJoinAndSelect)', async () => {
    const res = await request(BASE_URL)
      .get('/api/triggers?type=webhook&limit=100')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    const listed = (res.body.data as Array<Record<string, unknown>>).find(
      (row) => row.id === plainTriggerId,
    );
    expect(listed).toBeDefined();
    expectTriggerWorkflowRef(listed, {
      present: true,
      expectedWorkflowId: workflowId,
    });
  });

  it('C. GET /api/triggers/:id — 단건은 채운다 (`findOneDetail` → `findById` relations)', async () => {
    const res = await request(BASE_URL)
      .get(`/api/triggers/${plainTriggerId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expectTriggerWorkflowRef(res.body.data, {
      present: true,
      expectedWorkflowId: workflowId,
    });
  });

  it('D. PATCH /api/triggers/:id — 일반 수정은 채운다 (`update` 가 `findById` 로 시작)', async () => {
    const res = await request(BASE_URL)
      .patch(`/api/triggers/${plainTriggerId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wfref-renamed') });
    expect(res.status).toBe(200);
    expectTriggerWorkflowRef(res.body.data, {
      present: true,
      expectedWorkflowId: workflowId,
    });
  });

  /**
   * **이 케이스(E)가 이 파일의 존재 이유다.**
   *
   * A~D 만 걸면 정확히 그때 깨졌던 경로를 안 무는 캐너리가 된다. `if (chatChannel)` 재조회 분기를
   * 실제로 통과해야 하므로 `chatChannel` 을 바디에 실어 보낸다 — 그 분기의 `relations: ['workflow']`
   * 를 지우면 **이 케이스만** RED 여야 한다(A~D 는 그 분기를 타지 않는다).
   *
   * > ## ⚠️ 이 요청 바디는 **판정된 결함을 그대로 재현한다** — 정상 계약이 아니다
   * >
   * > 아래 `botToken` 은 편의가 아니라 **`ChatChannelConfigDto` 가 필수로 요구해서** 넣은 것이고,
   * > 그 필수 요구 자체가 `spec/5-system/15-chat-channel.md` 의 **R-CC-10(Bot Token 변경은
   * > `POST /triggers/:id/chat-channel/rotate-bot-token` single-path)** 를 우회한다. 서비스는 이
   * > 값을 비교 없이 `secrets.rotate()` 로 덮어써 **24h grace 백업 · 전용 audit action ·
   * > `chatChannelRotatedAt` 갱신**을 모두 건너뛴다
   * > (`review/code/2026/09/10/14_34_18` api_contract ④ — CRITICAL 판정, 사전 존재 결함).
   * >
   * > **그래서 이 테스트의 200 을 "PATCH + `botToken` 은 정상" 으로 읽지 말 것.** 여기서 고정하는
   * > 것은 `workflow` 관계의 유무 한 축뿐이고, 바디는 오늘의 DTO 를 통과시키기 위한 최소 형태다.
   * >
   * > 그 결함의 처방(**PATCH 전용 `ChatChannelConfigDto` 변형 — `botToken` 제외**)이 들어오면
   * > 이 요청은 400 이 되므로 **이 케이스의 바디도 같은 PR 에서 함께 바뀌어야 한다.** 추적 항목은
   * > `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 *"CRITICAL: chatChannel
   * > PATCH 가 bot token single-path 를 우회한다"* 다. 이 참조가 없으면 캐너리가 **고쳐야 할
   * > 동작을 지키는 쪽으로 작동**한다 (`--impl-done` `15_23_41` rationale_continuity W1).
   */
  it(
    'E. PATCH /api/triggers/:id — chatChannel 포함 수정도 채운다 (재조회 분기, W4 회귀)',
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
            // 그 필수 요구가 R-CC-10 single-path 를 우회한다 — 위 docstring 의 경고 참조.
            botToken: '111:e2eWfRefBotToken',
            uiMapping: { formMode: 'auto' },
          },
        });
      expect(res.status).toBe(200);
      expectTriggerWorkflowRef(res.body.data, {
        present: true,
        expectedWorkflowId: workflowId,
      });
    },
    CHAT_CHANNEL_TIMEOUT_MS,
  );
});
