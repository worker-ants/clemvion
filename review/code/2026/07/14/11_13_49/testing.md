# 테스트(Testing) 리뷰

대상: F-4 (`ce8264f3a`) / F-5 (`ee13e3bf9` + prettier `3ed47bcc6`) / F-6 (`2eda0da55`) — payload 에 포함된 spec diff 3건(`15-chat-channel.md` / `4-execution-engine.md` / `6-websocket-protocol.md`) 이 참조하는 실제 구현·테스트 커밋을 git log 로 추적해 코드+테스트를 직접 확인함(payload 자체는 spec 문서 diff만 포함, 코드 diff 미포함이라 저장소에서 별도 확인).

전 대상 테스트 3개 스위트(`language-hint-defaults.spec.ts`, `trigger-dto-validation.spec.ts`, `websocket.gateway.spec.ts`) 및 회귀 대상 `hooks.service.spec.ts` 를 실제로 `npx jest` 실행해 통과(165+46 passed) 확인 — 테스트 존재/통과 자체는 사실과 부합.

## 발견사항

- **[WARNING]** F-4 `sendBestEffortNotice` 공유 헬퍼의 3번째 호출부(`maybeNotifyIgnored`) 회귀 테스트 전무
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (`maybeNotifyIgnored` → `groupChatRefusal`/`unsupportedMessageKind` 안내), 커밋 `ce8264f3a`
  - 상세: F-4 는 `sendExecutionStillRunningNotice`/`sendSurfaceMismatchNotice`/`maybeNotifyIgnored` 3개 호출부의 try/catch/warn 골격을 `sendBestEffortNotice` 로 통합했다. `hooks.service.spec.ts` 에는 앞의 두 호출부에 대한 정상/실패(swallow) 테스트가 각각 존재하지만(예: `934행 surfaceMismatch 안내 sendMessage 실패는 삼킴`, `1256행 sendExecutionStillRunningNotice — sendMessage 실패해도 throw 없이 ignored 반환`), `maybeNotifyIgnored`/`groupChatRefusal`/`unsupportedMessageKind`/`1:1 대화만 지원`/`지원하지 않는 메시지` 문자열을 참조하는 테스트가 `hooks.service.spec.ts` 전체에 **하나도 없음**(grep 결과 0건). CCH-CV-05(그룹챗 거부)·비지원 메시지 종류 경로가 공유 헬퍼 리팩터 이후에도 정상 동작하는지, 특히 발송 실패 시 삼킴(swallow) 동작이 유지되는지 검증하는 회귀 테스트가 없다.
  - 제안: `sendBestEffortNotice` 를 경유하는 3번째 호출부에도 성공/실패(swallow) 케이스 최소 1쌍을 추가해 3개 호출부 모두 대칭적으로 커버.

- **[WARNING]** F-6 `continueButtonClick`/`continueAiConversation`/`endAiConversation` 3개 메서드의 `expectedNodeId` 불일치 거부가 execution-engine 레벨에서 개별적으로 테스트되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4815-4882` (구현) vs `execution-engine.service.spec.ts:1994-2011` (F-1 테스트는 `continueExecution` 전용)
  - 상세: `resolveWaitingNodeExecutionId` 의 `expectedNodeId` 불일치 → `InvalidExecutionStateError` 거부 로직은 F-1 에서 `continueExecution`(form 경로) 을 통해서만 직접 검증됐다(`F-1 — expectedNodeId 가 대기 노드와 불일치하면 InvalidExecutionStateError`). F-6 이 동일 `expectedNodeId` 파라미터를 `continueButtonClick`/`continueAiConversation`/`endAiConversation` 3개 메서드에도 추가했지만, 이 3개 메서드를 직접 호출해 불일치 시 거부되는지 확인하는 engine-level 단위 테스트는 없다. `websocket.gateway.spec.ts` 의 F-6 테스트는 `ExecutionEngineService` 자체를 mock 하므로 "gateway 가 서비스에 nodeId 를 올바른 인자 위치로 전달하는지"만 검증하고, "서비스가 그 인자를 받아 실제로 불일치를 거부하는지"는 검증 범위 밖이다. 코드 구조상 3개 메서드 모두 동일 패턴으로 `resolveWaitingNodeExecutionId` 를 호출하므로 위험도는 낮지만, 세 호출부 중 하나에서 인자 순서/이름이 잘못 연결돼도(예: `expectedNodeId` 자리에 다른 값이 들어가는 리팩터 실수) 어떤 기존 테스트도 잡아내지 못한다.
  - 제안: `continueButtonClick`(또는 나머지 2개 중 최소 1개)에 대해 `expectedNodeId` 불일치 시 거부하는 engine-level 테스트를 최소 1건 추가해 실제 배선을 직접 검증.

- **[INFO]** F-6 spec 문서의 "WS gateway 4개 handler" 서술과 실제 diff/테스트(3개 handler)가 불일치
  - 위치: `spec/5-system/4-execution-engine.md:614` ("WS gateway 4개 handler 가 `data.nodeId` 를 `expectedNodeId` 로 forward"), 실제 구현 `websocket.gateway.ts` 는 `handleClickButton`/`handleSubmitMessage`/`handleEndConversation` 3개만 수정(`handleSubmitForm` 은 의도적으로 제외, spec 본문에도 명시). `websocket.gateway.spec.ts` F-6 테스트도 3건.
  - 상세: 테스트 커버리지 자체(3개 handler → 3개 테스트)는 실제 코드와 정합하나, spec 문서가 "4개" 라고 서술해 코드/테스트 완결성 기준선이 spec 과 어긋난다. 순수 오탈자(3→4)일 가능성이 높지만, 테스트 리뷰 관점에서는 "spec 이 약속한 handler 수 = 실제 테스트된 handler 수" 검증이 우선이므로, 오탈자가 아니라 실제로 누락된 4번째 handler 가 있는지 확인이 필요하다(코드 재확인 결과 4번째 forwarding 지점은 발견되지 않음 — spec 오탈자로 판단됨). consistency-checker 영역과 겹치나 테스트 완결성 판단에 직접 영향을 주므로 기록.
  - 제안: spec 문구를 "3개 handler" 로 정정하거나, 실제로 4번째 대상이 있다면 해당 handler + 테스트 추가.

- **[INFO]** F-6 세 handler 모두 "nodeId 제공"/"nodeId 미제공" 두 분기 중 한쪽만 테스트됨 (비대칭 커버리지)
  - 위치: `websocket.gateway.spec.ts` F-6 describe 블록 (`handleSubmitMessage`/`handleEndConversation` 은 nodeId "제공" 케이스만, `handleClickButton` 은 nodeId "미제공" 케이스만)
  - 상세: `handleSubmitMessage`/`handleEndConversation` 은 nodeId 를 이미 싣는 frontend 케이스만 테스트되고 undefined 전달 케이스(구버전 클라이언트 호환)는 미검증. 반대로 `handleClickButton` 은 미제공 케이스만 테스트되고, spec 이 명시한 "제공되면 대조" 분기(click_button 도 optional 로 nodeId 수용)는 미검증. 코드가 세 handler 모두 `data.nodeId` 를 조건 없이 그대로 forward 하는 동일 패턴이라 실질 위험은 낮으나, 회귀 시 어느 handler 의 어느 분기가 깨져도 알아채기 어렵다.
  - 제안: 필수는 아니나 `handleClickButton` 에 nodeId 제공 케이스 1건을 추가하면 3개 handler 커버리지가 완전 대칭이 된다.

- **[INFO]** F-5 제외 키(`discord` provider / `formOpenLabel` / CCH-ERR-* 6키)에 대한 명시적 "통과" 테스트 부재
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` (F-5 describe 블록, 5개 테스트)
  - 상세: 5개 테스트는 (실패 1) unescaped 거부 / (통과 4) escaped 허용·특수문자 없음·slack 미검증·telegram+`sessionExpired`(비-raw-send 키) 미검증 조합이다. 코드(`TELEGRAM_RAW_SEND_HINT_KEYS`, `findFirstUnsafeRawSendHint` 의 `provider !== 'telegram'` 얼리 리턴) 를 읽어보면 정확히 구현돼 있으나, 다음 케이스는 테스트에 없다: (1) `discord` provider 도 slack 과 동일하게 미검증 대상인지, (2) `formOpenLabel`(spec 이 명시적으로 제외 키로 언급) 도 unescaped `.` 를 허용하는지, (3) CCH-ERR-* 6 키(그 중 `executionFailedThirdParty4xx` 등은 default 문구 자체에 `(`/`)` 를 포함) 가 telegram 하에서 raw-send 검증을 우회하는지. 특히 (3) 은 회귀 위험이 실질적이다 — 향후 누군가 실수로 `TELEGRAM_RAW_SEND_HINT_KEYS` 에 CCH-ERR-* 키를 추가하면 기본 문구 자체가 거부되어 trigger 생성이 광범위하게 깨지는데, 이를 잡아줄 테스트가 없다.
  - 제안: 최소한 `executionFailedThirdParty4xx`(또는 CCH-ERR-* 대표 1개)와 `formOpenLabel` 에 대해 telegram + unescaped 특수문자로도 통과함을 확인하는 테스트 1~2건 추가. `discord` 는 `slack` 과 동일 분기라 우선순위는 낮음.

- **[INFO]** F-5 두 validator(`LanguageHintsPlaceholderValidator` + `LanguageHintsRawSendValidator`) 동시 적용 시 상호작용 미검증
  - 위치: `chat-channel-config.dto.ts` `languageHints` 필드에 `@Validate(LanguageHintsPlaceholderValidator)` `@Validate(LanguageHintsRawSendValidator)` 두 데코레이터가 스택됨
  - 상세: 한 요청이 두 validator 를 동시에 위반하는 경우(예: CCH-ERR-* 키에 허용되지 않는 placeholder + raw-send 키에 unescaped 문자가 동시에 있는 payload) class-validator 가 두 constraint 를 모두 에러로 보고하는지, 에러 메시지 direction 이 명확한지 테스트가 없다. 우선순위 낮음(둘 다 독립적으로는 잘 테스트됨).

## 요약

F-4/F-5/F-6 세 슬라이스 모두 최소 기본 테스트는 실제로 존재하고 실행 시 통과하며(직접 `npx jest` 로 확인), 테스트 코드 자체의 가독성·격리성(모듈 단위 `beforeEach` 재생성, pure 함수 기반 factory 테스트, immutable fixture)은 양호하다. 다만 커버리지 관점에서는 세 곳 모두 "리팩터/확장된 코드 경로 중 대표 사례만 테스트하고 나머지 대칭 분기는 비워둔" 패턴이 반복된다 — F-4 는 공유 헬퍼의 3개 호출부 중 1개(`maybeNotifyIgnored`)가 전혀 검증되지 않고, F-6 은 3개 handler 의 `expectedNodeId` 배선이 gateway 레벨 mock 테스트로만 확인되고 engine 레벨 직접 검증이 빠졌으며, F-5 는 제외 키 목록(`discord`/`formOpenLabel`/CCH-ERR-*) 중 일부만 대표로 테스트됐다. 이 중 F-5 의 CCH-ERR-* 미검증은 향후 리스트 관리 실수 시 trigger 생성 전반이 깨질 수 있는 잠재 회귀 지점이라 상대적으로 중요하고, 나머지는 구조적 유사성 덕에 실제 위험은 낮은 대칭성 갭이다. F-6 spec 문서의 "4개 handler" 서술은 실제 코드(3개)·테스트(3개) 와 어긋나 별도 확인이 필요하다.

## 위험도

MEDIUM
