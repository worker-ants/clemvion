# API 계약(API Contract) 리뷰 — chat-channel PATCH 비밀 차단 (D-1·D-2·D-3)

## 발견사항

- **[WARNING]** PATCH `/api/triggers/:id` 의 Swagger `@ApiBadRequestResponse` 가 이번에 새로 생긴 두 400 사유를 문서화하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:110`(`@Patch(':id')`)~`:123`(`@ApiBadRequestResponse` 설명) — 이 파일은 이번 diff 에 포함되지 않았다(변경 안 됨).
  - 상세: 컨트롤러 레벨 설명은 여전히 "schedule 타입에 허용되지 않는 필드가 포함된 경우"만 예시로 든다. 이번 PR 이 새로 도입한 두 400 케이스 — ① `chatChannel.botToken`/`chatChannel.inboundSigningPlaintext` 가 PATCH body 에 실린 경우(`triggers.service.ts:669-687` `assertPatchCarriesNoSecrets`, `chat-channel-config.dto.ts:372-403` `ChatChannelUpdateConfigDto` 의 `@IsEmpty()`), ② 아직 한 번도 설정되지 않은 트리거에 PATCH 로 `chatChannel` 을 처음 붙이려는 경우(`triggers.service.ts:696-706` `assertChatChannelAlreadySetUp`) — 는 엔드포인트 레벨 설명에 반영되지 않았다. 필드 레벨 Swagger 설명(`ApiPropertyOptional({ description: ..., writeOnly: true })`)에는 정확히 적혀 있으므로 OpenAPI 스키마 자체는 정보를 담고 있지만, 사람이 읽는 엔드포인트 요약(`@ApiBadRequestResponse`)만 보면 이 두 신규 오류 사유를 놓치기 쉽다.
  - 제안: `@ApiBadRequestResponse` 설명에 두 문장을 추가한다 — "`chatChannel.botToken`/`chatChannel.inboundSigningPlaintext` 가 실리면 `code=VALIDATION_ERROR`, `details.field='chatChannel.botToken'|'chatChannel.inboundSigningPlaintext'`" 와 "설정된 적 없는 트리거에 처음 `chatChannel` 을 PATCH 로 붙이면 `details.field='chatChannel'`".

- **[WARNING]** (기존 트래킹 확인, 비차단) R-CC-21 / §5.4.1 산문("PATCH 는 어떤 비밀도 쓰지 않는다")이 실제 구현·telegram 동작과 어긋난다는 CRITICAL 이 아직 미해소 상태로 남아 있다
  - 위치: `spec/5-system/15-chat-channel.md` §5.4.1 신설행 · `### R-CC-21`; 대응 구현은 `codebase/backend/src/modules/triggers/triggers.service.ts:1110-1124`(telegram `issuedInboundSigning` 무조건 rotate, `storeUserSuppliedSecrets` 게이팅 대상 아님).
  - 상세: 이번 diff 자체(코드)는 **옳게 구현했다** — telegram 의 server-issued inbound-signing 은 PATCH 에서도 계속 재저장해 인입 웹훅 401 을 막는다(플랜 D-2 표 참조). 문제는 spec 산문이 "PATCH 는 어떤 비밀도 쓰지 않는다"고 무조건 서술해 이 telegram 예외를 포괄하지 못한다는 점이며, 이는 이번 diff 에 포함된 `review/consistency/2026/09/10/21_37_56/SUMMARY.md`(`cross_spec` checker) 가 이미 **CRITICAL / BLOCK: YES** 로 잡아냈고 developer plan(`plan/in-progress/impl-chat-channel-patch-token.md` "발견한 경계" 절)이 자기-반증형 소정정 조건 미충족(정정 대상이 API 계약 서술이라 developer 권한 밖)으로 planner 턴에 명시적으로 위임했다. 코드 결함이 아니라 **spec 문서(API 계약 설명)가 구현보다 좁게 못 미친 상태**이므로 이 PR 을 막을 사유는 아니지만, planner 턴으로 이관되지 않고 조용히 넘어가면 다음 사람이 산문만 믿고 telegram 케이스를 놓칠 수 있다.
  - 제안: `plan/in-progress/impl-chat-channel-patch-token.md` 의 체크리스트대로 planner 턴에서 §5.4.1/R-CC-21/§1.3(data-flow) 세 곳에 telegram server-issued carve-out 을 명시할 것. 이번 코드 리뷰에서는 정보성으로만 기록.

- **[INFO]** PATCH 요청 계약이 의도적으로 breaking change 됐다 — `botToken`/`inboundSigningPlaintext` 를 실은 PATCH 는 이제 항상 400
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:372-403`(`ChatChannelUpdateConfigDto`), `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:100-109`.
  - 상세: 종전에는 `ChatChannelConfigDto` 를 PATCH 에도 그대로 써서 `botToken` 이 **필수**였다(빼면 400). 이번 PR 은 이를 뒤집어 `botToken`/`inboundSigningPlaintext` 가 **금지**로 바뀐다(보내면 400). 이는 R-CC-10 single-path 우회라는 실재 CRITICAL 을 닫는 의도된 수정이고, 유일하게 알려진 소비자(`ChatChannelCard`)는 이미 두 필드를 보내지 않는다(`chat-channel-card.tsx` 확인 — plan 착수전 실측 표 참조). 다만 이 API 가 버전 접두사 없이(`/api/triggers/:id`) 서빙되는 내부 REST 라, 프런트 외 다른 API 클라이언트(운영 스크립트·Postman 컬렉션 등)가 존재한다면 이번 배포로 조용히 깨질 수 있다.
  - 제안: 릴리스 노트/변경 로그에 "PATCH 로 bot token·inbound signing 값을 보내면 이제 400 이 된다"를 명시해 알려진 것 외 클라이언트의 회귀를 사전에 알린다.

- **[INFO]** 최초 `chatChannel` 설정을 PATCH 로 시도하면 이제 명시적 400 — 종전엔 silent degraded 로 200 처리되던 경로
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:696-706`(`assertChatChannelAlreadySetUp`), 호출부 `:509-521`.
  - 상세: PATCH 는 비밀을 실을 수 없으므로 setup 이 안 된 트리거에 처음 `chatChannel` 을 붙이려는 PATCH 는 이제 `VALIDATION_ERROR`(`details.field='chatChannel'`)로 명시 거부된다. 종전에는 `setupChannel` 이 secret 을 못 찾아 실패해도 CCH-SE-01 의 best-effort catch 가 삼켜 `chatChannelHealth=degraded` 로 **200 성공 처럼 보이면서 조용히** 저장됐다. 실패를 눈에 보이게 바꾼 개선이지만, 이 경로에 의존하던 호출자가 있었다면(가능성 낮음) 응답 코드가 200→400 으로 바뀌는 계약 변경이다.
  - 제안: 별도 조치 불필요 — 개선 방향이 맞다. 계약 변경 사실만 기록.

- **[INFO]** 에러 응답 `details.field` 가 flat 이 아니라 중첩 경로(`chatChannel.<field>`)로 나간다 — spec 표기와의 불일치는 이미 추적 중
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:827-849`(`[실측] 차단 5필드의 details.field 는 전부 중첩 경로다`).
  - 상세: 이번 PR 이 실측으로 확정한 값(`chatChannel.botToken` 등)이 `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 의 flat 표기(예: `botTokenRef`) placeholder 와 다르다는 점을 developer plan 이 이미 인지하고 planner 후속으로 등재했다(`plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에 실측해 planner 로 넘길 것" 표). 구현은 전역 `CustomValidationPipe`(`3-error-handling.md §2.1` "중첩/배열 경로를 유지한다")를 그대로 따르고 있어 코드 결함은 아니다.
  - 제안: 별도 조치 불필요 — planner 턴에서 spec 표기만 정정하면 됨.

## 확인된 것 — 위반 없음

- `ChatChannelUpdateConfigDto` 는 `OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])` + `@IsEmpty()` 재선언으로 상속 충돌(부모의 `@IsString()` 필수와 자식의 금지가 동시에 걸리는 문제)을 올바르게 피했다.
- `CreateTriggerDto` 는 이번 diff 에서 건드리지 않아 생성 경로의 `botToken`/`inboundSigningPlaintext` 필수 요구는 무회귀로 유지된다(`trigger-dto-validation.spec.ts:855-879`, `triggers.service.spec.ts` create 경로 테스트로 회귀 고정).
- `setupChatChannel` 의 세 secret 쓰기 지점 중 PATCH 에서 게이팅해야 할 두 곳(사용자 입력 bot token · provider-issued signing)과 무조건 유지해야 할 한 곳(telegram server-issued signing)이 `storeUserSuppliedSecrets` 플래그로 정확히 분리됐고, 세 축 모두 회귀 테스트가 있다(`triggers.service.spec.ts:3038-3054` 등).
- 서비스 레이어(`assertPatchCarriesNoSecrets`)가 DTO 검증과 별도로 같은 규칙을 다시 검증하는 이중 방어 구조이며, 컨트롤러 밖에서 서비스가 직접 호출되는 경로까지 커버한다는 명시적 근거가 문서화돼 있다.
- 에러 봉투 형식(`code: 'VALIDATION_ERROR'`, `details: { field }`)은 기존 컨벤션과 일치하고 HTTP 상태(400)도 적절하다.
- 페이지네이션·URL 설계·인증/인가 데코레이터(`@Roles('editor')` 등)는 이번 diff 로 변경되지 않았고 회귀 신호도 없다.

## 요약

이번 변경은 이전 라운드에서 CRITICAL 로 판정된 "chatChannel PATCH 가 bot token single-path(R-CC-10)를 우회한다"는 실재 보안 결함을 PATCH 전용 DTO(`ChatChannelUpdateConfigDto`)와 서비스 레이어 이중 방어로 닫는다. 검증 로직·secret 쓰기 3축 분리·회귀 테스트 커버리지는 견고하다. API 계약 관점에서 남은 것은 코드 결함이 아니라 문서화 갭 두 가지다 — ① 컨트롤러 레벨 Swagger `@ApiBadRequestResponse` 가 이번에 추가된 두 신규 400 사유를 반영하지 않은 점(이 PR 에서 손대지 않은 파일), ② spec 산문(R-CC-21/§5.4.1)이 telegram server-issued 서명 회전 예외를 포괄하지 못해 구현보다 좁다는 점(이미 이 세션 자체의 consistency-check 가 CRITICAL/BLOCK:YES 로 잡아 planner 턴으로 위임함). 두 항목 모두 이번 PR 을 막을 사유는 아니며, 전자는 간단한 문서 보강으로, 후자는 이미 계획된 별도 planner 턴으로 해소 가능하다. 그 외 breaking change(PATCH 가 이제 botToken/inboundSigningPlaintext 를 거부)는 의도된 보안 수정이고 알려진 유일한 소비자는 영향받지 않는다.

## 위험도

LOW
