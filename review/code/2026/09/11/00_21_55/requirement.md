# 요구사항(Requirement) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3) 3라운드

## 컨텍스트

이 diff 는 `origin/main`(`c0f2a885c`)부터 현재 HEAD(`83d5f3f94`)까지로, 이미 두 차례
`/ai-review` 라운드(`review/code/2026/09/10/23_21_57`, `review/code/2026/09/10/23_55_23`)가
CRITICAL 1건(inboundSigningRef PATCH 소실 → 인입 서명 fail-open)과 WARNING 다수를 찾아
조치 완료한 상태의 최종본이다. 핵심 코드(`chat-channel-config.dto.ts` ·
`update-trigger.dto.ts` · `triggers.controller.ts` · `triggers.service.ts` 및 대응
테스트)를 `Read`/`Grep`으로 직접 열어 spec(`spec/5-system/15-chat-channel.md`
§5.4.1·§5.4.1.1·R-CC-21)과 line-level로 대조했다. 저장소 파일은 변경하지 않았다
(`git status --short` 확인 불필요 — 읽기만 수행).

## 발견사항

- **[WARNING]** `assertChatChannelAlreadySetUp` 의 "최초 설정은 PATCH 로 할 수 없다" 분기가 3라운드 내내 테스트 커버리지 0건이다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:722-747`
    (`assertChatChannelAlreadySetUp`, 특히 `if (!current?.provider) { throw … }` 728-735행),
    호출부는 `update()` 520-522행 `if (chatChannel) { this.assertChatChannelAlreadySetUp(trigger, chatChannel); }`.
  - 상세: 이 함수는 이번 PR(`cf4ba26e9`)이 신설한 두 분기를 갖는다 — (1) 트리거에
    `config.chatChannel.provider` 가 아직 없는데 PATCH 로 처음 붙이려는 경우 400
    (`details.field='chatChannel'`), (2) 이미 설정된 provider 를 PATCH 로 바꾸려는 경우 400
    (`details.field='provider'`). 이번 라운드까지 두 라운드 리뷰(`23_21_57`, `23_55_23`)가
    분기 (2)만 지적해 테스트가 추가됐고(`triggers.service.spec.ts:3270-3284`
    `'PATCH 로 provider 를 바꾸면 400'`), 분기 (1)은 어느 테스트 파일에도 등장하지 않는다 —
    `triggers.service.spec.ts` 의 PATCH suite(`describe('… R-CC-21)'`, 2928행~)가 쓰는
    `existing()` 헬퍼(2938-2953행)는 항상 `provider` 가 채워진 "이미 setup 된" 트리거만
    만들고, `trigger-dto-validation.spec.ts` 는 DTO 레벨이라 이 서비스 로직에 닿지 않으며,
    `trigger-workflow-ref.e2e-spec.ts` case E 가 쓰는 `chatTriggerId` 도 사전에 POST 로
    `chatChannel` 을 생성해 둔 트리거다(`test/trigger-workflow-ref.e2e-spec.ts:140-141`,
    `chat.body.data.id`). `chat-channel-{slack,discord,trigger-create}.e2e-spec.ts` 는
    생성(POST) 전용이라 이 경로를 타지 않는다. 즉 "설정 없는 트리거에 PATCH 로 chatChannel
    을 처음 붙이면 400" 이라는, 이 PR 이 직접 신설한 비즈니스 규칙이 어떤 계층에서도
    관측되지 않는다.
  - 왜 중요한가: 이 가드 자신의 JSDoc(716-720행)이 존재 이유를 이렇게 설명한다 — "PATCH 로
    최초 setup 을 시도하면 비밀을 실을 방법이 없어 반드시 실패하는데, 그 실패가
    `setupChatChannel` 의 best-effort catch(1234-1258행)에 삼켜지면 `chatChannelHealth=degraded`
    로 **조용히** 앉는다. 그래서 여기서 먼저 명시적으로 거부한다." 이는 이 PR 이 다른 곳(D-2,
    `inboundSigningRef` fail-open)에서 반복적으로 경계해 온 "실패가 보이는 형태에서 조용한
    형태로 바뀐다"는 바로 그 결함 클래스이며, 이 가드가 그 클래스의 마지막 방어선이다. 그런데
    정작 이 방어선 자체는 회귀 테스트가 없어, 다음 리팩터링이 `if (!current?.provider)` 조건을
    실수로 느슨하게 바꾸거나(예: `?.provider` 대신 `?.chatChannel` 존재 여부로 바꾸는 등) 삭제해도
    어떤 테스트도 RED 를 내지 않는다 — 그 회귀는 바로 이 PR이 막으려던 "조용한 degraded" 로
    되돌아간다.
  - 제안: `triggers.service.spec.ts` 의 R-CC-21 PATCH suite 에 `existing()` 대신
    `config: {}` (또는 `chatChannel` 없음) 트리거로 `service.update(..., { chatChannel: cardBody(provider) }, ...)`
    를 호출해 `rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR', details: { field: 'chatChannel' } } })`
    를 단언하는 케이스 1개를 추가한다. `assertChatChannelAlreadySetUp` 의 두 분기가 대칭
    구조(existing 유무 vs provider 일치 여부)이므로, 이미 있는 "provider 전환" 테스트 바로
    옆에 자연스럽게 짝을 이룬다.

## 확인한 것 — 문제 없음

- **DTO 계층(`ChatChannelUpdateConfigDto`)이 spec 본문과 line-level 로 일치한다.**
  `chat-channel-config.dto.ts:372-404` 의 `OmitType(ChatChannelConfigDto, ['botToken',
  'inboundSigningPlaintext'])` + 두 필드 `@IsEmpty()` 재선언은 R-CC-21(`spec/5-system/15-chat-channel.md:735-810`)
  의 "PATCH 는 botToken 도 slack/discord 의 inboundSigningPlaintext 도 받지 않는다" 결정,
  §5.4.1 표 4행(`:376`, "저장된 bot token 을 바꾸지 않는다")과 §5.4.1.1 표 회전 행(`:391`,
  "PATCH 에서는 그 필드가 있으면 거부")을 정확히 반영한다. "왜 optional 로 두고 무시하지
  않는가" JSDoc(362-363행)도 spec 의 「기각한 대안」 첫 항목(`:774-775`, "값이 오면 무시 —
  침묵은 이 자원에 맞지 않는다")과 문자 그대로 대응한다.
- **secret 쓰기 게이팅(D-2, `setupChatChannel` 1075-1260행)이 spec 의 3-쓰기 비대칭 요구를
  정확히 구현한다.** bot token rotate(`storeUserSuppliedSecrets` 게이팅, 1122-1128행)와
  provider-issued signing(같은 게이팅, 1135-1149행)은 PATCH 에서 건너뛰고, telegram
  server-issued 재발급(1196-1202행)은 게이팅 없이 무조건 저장 — §5.4.1.1 telegram 행
  (`:391`, "**바꾼다** — 우회가 아니라 provider 등록과 한 동작")과 R-CC-21 caveat(`:741-745`)에
  정확히 대응하고, 테스트(`triggers.service.spec.ts:3038-3054` "telegram — server-issued
  서명은 PATCH 에서도 재저장된다")가 이 비대칭을 적극적으로 고정한다.
- **`details.field` 값-형태 분기가 실측·문서·구현 세 곳에서 일관된다.** 비어있지 않은 값은
  전역 `CustomValidationPipe` 가 중첩 경로(`chatChannel.botToken`)로,
  `null`/`''` 는 `@IsEmpty()` 를 통과해 서비스(`assertPatchCarriesNoSecrets`,
  695-713행)가 flat 이름(`botToken`)으로 거부한다 — 이 갈림이
  `trigger-dto-validation.spec.ts` 의 `[실측]` 테스트, `triggers.service.spec.ts:3236-3263`
  의 "null/빈 문자열 4조합" 테스트, `triggers.controller.ts:125-128` Swagger 서술,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 planner 인계 표까지
  네 곳 전부 같은 값을 말한다 — 2라운드가 "한 갈래만 쟀다"고 자체 정정한 이후 최종본은
  일치한다.
- **생성(POST) 경로 무회귀.** `CreateTriggerDto`/`ChatChannelConfigDto` 는 건드리지 않았고
  (`botToken`·`inboundSigningPlaintext` 여전히 필수), `trigger-dto-validation.spec.ts` 의
  "CreateTriggerDto 는 여전히 botToken 을 요구한다" 테스트와 `triggers.service.spec.ts` 의
  `createWithChannel` 헬퍼로 옮겨진 舊 10개 케이스가 이를 고정한다.
- **응답 경계 스트립 무회귀.** `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(87-95행)는 이번 diff로
  변경되지 않았고 `botToken`/`inboundSigningPlaintext`/세 ref 필드를 여전히 커버해,
  D-2 의 신규 게이팅이 응답으로 secret 을 흘리는 새 경로를 열지 않는다.
- **에러 코드·HTTP 상태·envelope 형식**(`code: 'VALIDATION_ERROR'`, `details: {field}`, 400)이
  이 파일의 기존 관례(schedule 타입 필드 제한, 496-510행)와 신규 3분기 모두 일관된다.
- **문서(mdx) 갱신이 실제 동작과 일치한다.** `triggers.{mdx,en.mdx}` ·
  `telegram.{mdx,en.mdx}` 의 "Rotating the bot token" 절이 옛 필드명(`botTokenRef`)·옛
  `details.field` 값을 걷어내고 실제 필드(`botToken`)·중첩 `details.field` 값으로
  교체됐으며, "`botTokenRef` 는 애초에 입력 필드가 아니었다"는 서술도 DTO 구현(내부 전용,
  `@IsEmpty()`)과 부합한다.
- **TODO/FIXME/HACK/XXX 부재** — `git diff c0f2a885c HEAD` 범위 전체에 해당 마커 0건.

## 요약

이번 diff 의 핵심 계약(PATCH DTO 분리, secret 쓰기 게이팅, `details.field` 값-형태 분기, 응답
strip, 생성 경로 무회귀)은 `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1·R-CC-21 본문과
line-level 로 정확히 일치하고, 앞선 두 라운드가 찾은 CRITICAL·WARNING 은 실제로 소스에서
닫혀 있음을 직접 대조로 확인했다. 다만 이번 PR이 신설한 `assertChatChannelAlreadySetUp` 의
두 분기 중 "최초 설정은 PATCH 로 불가" 분기는 — 그 자신의 존재 이유가 이 PR 이 다른 곳에서
막 닫은 것과 같은 클래스의 "조용한 degraded" 결함을 막는 것임에도 — unit·service·e2e 어느
계층에도 회귀 테스트가 없다. 실제 동작 자체는 코드를 직접 읽어 확인한 바 정확하나, 이
방어선의 무결성이 다음 리팩터링에서 검출 없이 깨질 수 있어 WARNING 으로 남긴다.

## 위험도

LOW
