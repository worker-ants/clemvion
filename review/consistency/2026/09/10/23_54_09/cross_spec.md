# Cross-Spec 일관성 검토 — `spec/5-system` (chat-channel PATCH bot-token, impl-done)

## 검토 범위와 방법

이번 라운드는 `spec/5-system` 델타 0(코드 전용 PR)인 impl-done 검토다. target
(`spec/5-system/15-chat-channel.md`, 특히 §5.4.1 · §5.4.1.1 · R-CC-10 · R-CC-21)은 오늘 이미
4차례(`21_37_56` / `22_04_23` / `22_14_27` / `22_45_26`) 유사 관점 검토를 받았고, planner PR
`df1962e25`(#1311) · `c0f2a885c`(#1313)가 그중 CRITICAL(telegram server-issued 서명 carve-out
누락)을 닫았다. 본 라운드는 (1) 그 CRITICAL이 실제로 해소됐는지, (2) 직전 라운드가 열어 둔
WARNING(들)이 이번 구현 완료 시점에도 열려 있는지, (3) 이번 diff(`chat-channel-config.dto.ts` ·
`update-trigger.dto.ts` · `triggers.controller.ts` · `triggers.service.ts` · 두 spec 파일)이 새로
만든 동작이 다른 spec 영역과 충돌하는지를 실측했다. 대조 파일: `spec/2-navigation/2-trigger-list.md`,
`spec/1-data-model.md` §2.8, `spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md`,
`spec/conventions/audit-actions.md`, `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`,
`spec/5-system/12-webhook.md`, `spec/4-nodes/7-trigger/providers/{telegram,slack}.md`,
`spec/data-flow/14-chat-channel.md`, 그리고 실제 구현·테스트
(`triggers.service.ts`, `trigger-dto-validation.spec.ts`).

## 발견사항

- **[WARNING]** `details.field` 표기 — target 과 자매 spec 이 함께 flat 경로를 적는데, 구현·테스트·
  canonical 규약은 중첩 경로를 확정했다 (이미 확인됐으나 아직 미정정)
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 표 3행(`details.field='botTokenRef'`,
    값 필드는 *"미확정 — 후속 e2e 확인 대기"*), §5.4.1.1 회전 행(`details.field` 도 동일하게 미확정)
  - 충돌 대상:
    - `spec/2-navigation/2-trigger-list.md` §2.3.1 (line 119-120) · PATCH 캐비엇(line 176) —
      같은 flat 표기(`details.field='botTokenRef'`, `'inboundSigningPlaintext'`)와 같은
      "미확정 — 후속 e2e 확인 대기" 문구를 반복
    - `spec/5-system/3-error-handling.md` (line 270) — canonical 규약: *"`details[].field` 는
      중첩/배열 경로를 `nodes[3].type` 형식으로 유지한다"*
    - 실제 구현·테스트: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
      의 `[실측] 차단 5필드의 details.field 는 전부 중첩 경로다` 케이스가 5필드 전부
      `chatChannel.<field>` (예: `chatChannel.botToken`, `chatChannel.botTokenRef`) 임을 확정하고,
      주석이 스스로 "flat 이름을 적은 spec 문면 쪽이 낡았다" 라고 적는다. 같은 결론이
      `triggers.controller.ts` 의 `@ApiBadRequestResponse` swagger 문서(이번 diff)에도
      `details.field="chatChannel.botToken"` 로 반영돼 있다.
  - 상세: 같은 요구사항(어떤 필드가 PATCH 로 차단되고 에러가 어떤 `details.field` 로 나가는가)을
    설명하는 두 spec 파일(`15-chat-channel.md`, `2-trigger-list.md`)이 서로는 일치하지만 둘 다
    canonical 규약(`3-error-handling.md`)과 실제 관측값에 반한다 — 3자 불일치. 클라이언트 구현자가
    이 두 문서만 보고 `error.details.field === 'botTokenRef'` 로 분기하면 실제 응답
    (`'chatChannel.botTokenRef'`)과 어긋나 매칭 실패한다. developer plan
    (`plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에 실측해 planner 로 넘길 것" 표)이
    이미 이 실측을 planner 후속으로 등재했으나, 이번 impl-done 시점까지 두 spec 파일 모두 미정정
    상태로 남아 있다.
  - 제안: `spec/5-system/15-chat-channel.md` §5.4.1 · §5.4.1.1 의 `details.field='botTokenRef'` /
    `'inboundSigningPlaintext'` (그리고 "미확정" 문구)를 `trigger-dto-validation.spec.ts` 의
    실측값(`chatChannel.botTokenRef` / `chatChannel.botToken` / `chatChannel.inboundSigningPlaintext`
    / `chatChannel.inboundSigningRef` / `chatChannel.inboundSigning`)으로 동시 정정하고,
    `spec/2-navigation/2-trigger-list.md` 의 동일 3곳(line 119, 120, 176)도 같은 커밋에서 정정할 것
    — 이미 developer plan 이 근거를 실어 뒀으므로 planner 턴에서 그대로 반영 가능.

- **[WARNING]** `SecretResolver.store()` vs `.rotate()` — 직전 라운드(`22_45_26`)가 지적한 오기가
  이번 impl-done 시점에도 그대로 남아 있다 (재확인)
  - target 위치: `spec/5-system/15-chat-channel.md:200,201,373,390`
  - 충돌 대상: `spec/conventions/secret-store.md` §2 (canonical 인터페이스 — `store`=이미 있으면
    throw, `rotate`=UPSERT) · target 자신의 R-CC-21(`:764` 부근, *"`secrets.rotate(botTokenRef, …)`
    를 조건 없이 실행"*) · `spec/conventions/chat-channel-adapter.md:354,359` ·
    `spec/4-nodes/7-trigger/providers/telegram.md:58,219` ·
    `spec/4-nodes/7-trigger/providers/slack.md:278`
  - 상세: 이번 diff(`triggers.service.ts`)로 실제 호출부를 다시 확인했다 — chat-channel 비밀 저장
    경로 전수(bot token rotate·provider-issued signing·server-issued signing·rotate-bot-token
    endpoint 6개 호출 지점)가 **모두 `this.secrets.rotate(...)`** 이고 `secrets.store(` 호출은
    **0건**이다. 총 4개 spec 파일 7곳이 여전히 `SecretResolver.store(...)` 라 적고 있어
    canonical 정의·실제 구현과 어긋난다. `spec/data-flow/14-chat-channel.md` 는 이미 "secret store
    UPSERT" 로 정확히 서술해 이 오기를 반복하지 않는다 — 이 파일이 정답 표기의 선례다.
  - 제안: 4개 파일 7곳의 `SecretResolver.store(...)` 표기를 `SecretResolver.rotate(...)` (UPSERT)로
    일괄 정정. `data-flow/14-chat-channel.md` 의 "secret store UPSERT" 표현을 참고 표준으로 삼을 것.

- **[INFO]** 신규 PATCH 차단 케이스(`chatChannel` 최초 부착 금지)가 target §5.4.1 표에 아직 반영되지
  않음
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 (표는 "최초 생성" · "활성화 PATCH" ·
    "토큰 변경" · "`chatChannel` 이 실린 PATCH(편집)" 4행만 나열)
  - 충돌 대상: 없음(직접 모순 아님) — 다만 이번 diff 가 `TriggersService.assertChatChannelAlreadySetUp`
    을 신설해 (a) `chatChannel` 이 아예 없던 webhook 트리거에 PATCH 로 처음 붙이려는 요청을
    `400 VALIDATION_ERROR` (`details.field='chatChannel'`) 로 거부하고, (b) 기존 provider 를 다른
    provider 로 바꾸려는 PATCH 도 `details.field='provider'` 로 거부한다. (b)는
    `spec/2-navigation/2-trigger-list.md` R-12(*"provider 변경하려면 트리거 삭제·재생성"*)로 이미
    문서화돼 있어 일치하지만, (a)는 target 또는 `2-trigger-list.md` 어디에도 명시적으로 등재돼 있지
    않다(모순되는 반대 서술도 없음 — 순수 커버리지 갭).
  - 상세: PATCH 로 `chatChannel` 을 새로 붙이면 body 에 `botToken` 을 실을 방법이 없어(D-1 이
    그 필드를 금지) 원천적으로 실패할 수밖에 없는 요청인데, 이 경로를 spec 표에 5번째 행으로
    추가하면 "최초 setup 은 생성 POST 한정" 이라는 §5.4.1 의 기존 결론이 명시적 사실로 승격된다.
  - 제안: §5.4.1 표에 "PATCH 로 `chatChannel` 신규 부착" 행을 추가(→ `400 VALIDATION_ERROR`,
    `details.field='chatChannel'`)하거나 최소한 표 아래 한 문장으로 명시. developer 소관 밖이라
    planner 턴 대상.

## 검증되어 충돌 없음으로 확인된 항목 (재확인)

- **telegram server-issued 서명 carve-out** — 직전 CRITICAL(`21_37_56`)이 지적한 "PATCH 는 비밀을
  쓰지 않는다" 문구와 telegram 의 `setupChannel()` 마다 재발급되는 `secret_token` 간 모순은 planner
  PR `c0f2a885c`(#1313)로 해소됐다. `R-CC-21` 상단 caveat("이 항목의 「비밀」은 두 축 한정")·
  §5.4.1.1 telegram 전용 행·`data-flow/14-chat-channel.md:151` 세 곳 모두 telegram 을 스코프 밖에
  명시적으로 둔다. 이번 diff(`setupChatChannel` 의 `storeUserSuppliedSecrets` 플래그)도 telegram
  의 `[쓰기 ③]` 을 무조건 유지해 이 결정과 일치한다.
- **RBAC** — `TriggersController.update` (PATCH) 와 `rotateBotToken` 모두 `@Roles('editor')`.
  `spec/5-system/1-auth.md:431` 의 "Editor+ 가 호출 가능한 특권 작업" 서술과 일치.
- **audit action 명명** — `trigger.chat_channel_bot_token_rotated` 가 `1-auth.md:431` ·
  `2-trigger-list.md:170` 에 일관되게 등재. 이번 diff 는 audit action 문자열을 변경하지 않아
  회귀 없음.
- **provider 전환 차단** — 신규 `assertChatChannelAlreadySetUp` 의 provider 변경 거부는
  `2-navigation/2-trigger-list.md` R-12(*"변경하려면 트리거 삭제·재생성"*)와 정확히 일치.
- **`ChatChannelUpdateConfigDto` 설계(D-1)** — `CreateTriggerDto` 는 별도 타입을 그대로 유지해
  생성 경로 무회귀(테스트로 확인). 공유 검증 함수를 쓰지 않고 `mode: 'create' | 'update'` 로
  분기한 것도 R-CC-21 "구현 시" 경고와 정합.

## 요약

이번 PR(`impl-chat-channel-patch-token`)의 코드는 target spec(`15-chat-channel.md` §5.4.1 ·
§5.4.1.1 · R-CC-21)이 요구하는 PATCH 비밀-쓰기 차단·telegram carve-out·provider 전환 차단을
정확히 구현했고, 오늘 이전 라운드가 발견한 유일한 CRITICAL(telegram 서명 모순)은 이미 별도
planner PR 로 닫혔다. 다만 직전 라운드가 WARNING 으로 남긴 두 항목(`details.field` 중첩 경로
표기, `SecretResolver.store()` vs `.rotate()`)은 이번 구현이 실측·테스트로 명확히 확정했음에도
불구하고 target 및 자매 문서(`2-navigation/2-trigger-list.md`, `conventions/chat-channel-adapter.md`,
`providers/telegram.md`, `providers/slack.md`)에는 아직 반영되지 않아 재확인 결과 그대로 열려
있다. 두 항목 모두 developer plan 이 이미 실측 근거를 실어 planner 후속으로 넘겨 뒀으므로
기능적 위험은 아니지만, 문서 신뢰도 저하(클라이언트 구현자가 flat 필드명을 그대로 믿을 위험)가
남아 CRITICAL 로 격상하지 않고 WARNING 으로 유지한다. 신규로 발견된 항목(PATCH 최초 부착 차단
케이스 미문서화)은 모순이 아닌 커버리지 갭이라 INFO.

## 위험도

MEDIUM
