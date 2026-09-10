# API 계약(API Contract) 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3) + inboundSigningRef fail-open 수정

## 컨텍스트

이번 리뷰 대상 diff 는 직전 라운드(`review/code/2026/09/10/23_21_57`)가 이미 검토한 D-1(`ChatChannelUpdateConfigDto`)·D-2(secret 쓰기 게이팅)·D-3 코드에, 그 라운드의 CRITICAL #1(`inboundSigningRef` PATCH 소실 → 인입 서명 fail-open, `771801fca`)과 WARNING #5(컨트롤러 `@ApiBadRequestResponse` 미반영, 같은 커밋)에 대한 조치가 더해진 상태다. 실제 코드(`chat-channel-config.dto.ts` · `update-trigger.dto.ts` · `triggers.controller.ts` · `triggers.service.ts`)를 직접 `Read` 로 열어 대조했다.

## 발견사항

- **[INFO]** `ChatChannelUpdateConfigDto` 의 금지 필드 두 개가 OpenAPI 스키마 상 `writeOnly: true` 로 선언돼 있어, "요청에는 넣을 수 있는 값"이라는 신호를 준다 — 실제로는 `@IsEmpty()` 로 값이 있으면 무조건 400 인 "전송 금지" 필드다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:381`(`botToken` 의 `writeOnly: true`), `:396`(`inboundSigningPlaintext` 의 `writeOnly: true`).
  - 상세: OpenAPI 의 `writeOnly`는 관례적으로 "요청 바디에는 넣되 응답에는 노출하지 않는 필드"(예: 부모 `ChatChannelConfigDto.botToken`, POST 전용, 값을 실제로 받아 저장함)를 뜻한다. `ChatChannelUpdateConfigDto` 는 이 의미론을 그대로 물려받아 붙였지만, 이 서브클래스에서는 두 필드가 "받을 수 있는 값이 없는" 필드다(보내면 100% 실패). description 텍스트에는 "(PATCH 금지)"가 명시돼 있어 사람이 읽으면 오해하지 않지만, OpenAPI 코드젠(SDK 생성기)은 description 산문을 해석하지 않고 스키마 필드(`writeOnly`, `type: string`)만 보고 "이 PATCH 요청 타입에 `botToken?: string` 을 채워도 된다"는 클라이언트 타입을 그대로 만들어낸다 — 실제로 채우면 항상 400 이 나는데도 타입 시스템은 이를 막지 않는다.
  - 제안: 이 두 필드에는 `writeOnly` 대신 (혹은 추가로) `deprecated: true` 또는 `readOnly: true`(응답에도 안 나가지만 "서버가 관리"함을 암시)처럼 "클라이언트가 채우면 안 되는 필드"라는 의도에 더 가까운 마커를 검토하거나, 최소한 `writeOnly` 를 유지할 경우 description 맨 앞에 "(항상 실패 — 절대 채우지 마세요)"류 경고를 명확히 유지한다(현재도 "(PATCH 금지)"가 있어 완화된 문제이나 스키마 레벨 신호는 여전히 불일치).

- **[INFO]** (기존 추적 재확인, 조치 불요) 서비스 레벨 가드 `assertPatchCarriesNoSecrets`/`assertChatChannelInputSafe` 가 던지는 `details.field` 는 flat(`'botToken'`)인데, 실제 HTTP 응답에 나가는 값은 전역 `CustomValidationPipe` 가 만드는 nested(`'chatChannel.botToken'`)다 — 컨트롤러 `@ApiBadRequestResponse` 문서(아래 "확인된 것" 참고)는 nested 값으로 정확히 적혀 있어 문서-실제 응답 간 불일치는 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `assertPatchCarriesNoSecrets`(683~701행) vs `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:827-849`(`[실측]` 테스트, nested 경로 확정).
  - 상세: HTTP 경유 시에는 DTO `@IsEmpty()` 가 먼저 걸려 서비스의 flat 메시지는 사실상 도달 불가(서비스 직접 호출 경로에서만 살아있는 이중 방어)다. 이 자체는 이미 developer plan(`plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에 실측해 planner 로 넘길 것" 표)이 spec 표기 정정을 planner 후속으로 명시 위임한 사안이라 이번 코드 리뷰에서 새로 막을 사유는 아니다.
  - 제안: 별도 조치 불요 — planner 후속 정정을 기다린다.

## 확인된 것 — 위반 없음 / 이전 WARNING 해소 확인

- **직전 라운드 WARNING(컨트롤러 `@ApiBadRequestResponse` 가 신규 400 사유 미반영)이 이번 diff 에서 해소됐다.** `codebase/backend/src/modules/triggers/triggers.controller.ts:120-128` 이 이번 chatChannel PATCH 가 내는 세 가지 400 사유(비밀 필드 포함 / 미설정 트리거에 최초 붙임 / provider 전환)를 `details.field` 값까지 명시했고, 각 문구는 실제 서비스 코드(`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`, `triggers.service.ts:683-735`)의 `details.field` 값과 정확히 일치한다.
- **직전 라운드 CRITICAL(`inboundSigningRef` PATCH 소실 → fail-open)의 수정이 응답 계약을 깨지 않는다.** `setupChatChannel`(`triggers.service.ts:1063-1248`)의 `inboundSigningRefSurvives` 로직은 내부 config 갱신에만 관여하고, `inboundSigningRef`/`botTokenRef` 는 여전히 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(`triggers.service.ts:87-95`, 이번 diff 로 변경 안 됨)에 의해 응답에서 무조건 strip 되며 `hasBotToken` derived 필드만 노출된다 — 새 코드가 응답으로 secret ref 를 흘리는 경로를 열지 않았다.
- `ChatChannelUpdateConfigDto` 는 `OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])` + `@IsEmpty()` 재선언으로 상속 충돌(부모 `@IsString()` 필수와 자식 `@IsEmpty()` 금지가 동시에 걸리는 문제)을 올바르게 피했고, `provider`·`botTokenRef`·`inboundSigningRef` 등 나머지 필드의 필수/금지 상태는 부모와 동일하게 유지돼 회귀가 없다.
- `CreateTriggerDto`(`create-trigger.dto.ts:15,118-123`)는 이번 diff 로 건드리지 않아 생성 경로의 `botToken` 필수 요구·`inboundSigningPlaintext` provider 분기는 무회귀로 유지된다(`trigger-dto-validation.spec.ts:855-879`, `triggers.service.spec.ts` create 스위트로 회귀 고정).
- provider 전환 차단(`assertChatChannelAlreadySetUp`, `triggers.service.ts:710-735`)과 최초 설정 차단은 기존 `RESOURCE_CONFLICT`(409, endpointPath 중복) 패턴과는 다르지만, 같은 파일의 기존 선례(schedule 타입 트리거의 필드 제한, `:496-510`)와 동일하게 `400 VALIDATION_ERROR`를 쓰고 있어 이 저장소의 기존 관례와 일관된다.
- 에러 봉투 형식(`code: 'VALIDATION_ERROR'`, `details: { field }`)·HTTP 상태(400)는 기존 컨벤션과 일치한다. 인증/인가(`@Roles('editor')`)·URL 설계·페이지네이션은 이번 diff 로 변경되지 않았다.
- e2e 캐너리(`test/trigger-workflow-ref.e2e-spec.ts` case E)는 새 계약(PATCH 가 `botToken` 을 거부)에 맞춰 바디를 갱신했고, 종전에 CRITICAL 을 재현하던 경고 블록을 "해소됨" 기록으로 정확히 교체했다 — 낡은 계약을 그대로 코드에 남기지 않았다.

## 요약

이번 diff 는 직전 라운드에서 CRITICAL 로 판정된 두 결함(chatChannel PATCH 의 R-CC-10 우회, PATCH 후 `inboundSigningRef` 소실로 인한 인입 서명 fail-open)을 모두 실측 검증된 형태로 닫았고, 같은 라운드의 WARNING(컨트롤러 Swagger 문서 미반영)도 해소했다. 세 가지 신규 400 사유(비밀 필드 포함 / 미설정 트리거에 최초 chatChannel 붙임 / provider 전환)는 서비스 코드와 컨트롤러 Swagger 문서·에러 봉투 형식이 정확히 일치하고, 응답 strip 로직도 새 secret 쓰기 게이팅과 충돌 없이 그대로 작동해 secret 노출 회귀가 없다. 남은 것은 코드 결함이 아니라 스키마 표현의 미세한 뉘앙스(신규 PATCH 금지 필드에 `writeOnly` 마커가 "쓸 수 있는 값"이라는 오신호를 줄 수 있음, INFO)와 이미 planner 후속으로 위임된 spec 표기 정정(flat vs nested `details.field`, INFO) 뿐이며 둘 다 이번 PR 을 막을 사유가 아니다.

## 위험도

LOW
