# Security Review

## 변경 개요

이번 diff(`origin/main...HEAD`)는 `ws-event-types-extract` 작업 전체다. 코드 레벨 변경은
`codebase/backend/` 27개 파일(785 insertions, 313 deletions)로 좁혀지고, 나머지는
`plan/**`·`review/**`(직전 3라운드 review·consistency 산출물, RESOLUTION 등) 문서다.

코드 변경의 실질은 다음 세 가지뿐이다.

1. **Import 경로 재배선** — `websocket.service.ts` 가 함께 export 하던 enum(`ExecutionEventType`,
   `NodeEventType`, `BackgroundRunEventType`, `NotificationEventType`)·interface/type
   (`ExecutionChannelEvent`, `ChatChannelRoutingInfo`, `ExecutionRoutingContext`,
   `ToolCallStartedPayload`, `UserMessagePayload`, `ToolCallCompletedPayload`,
   `NotificationNewPayload`, `KbEventType`)을 신규 의존성-프리 모듈
   `codebase/backend/src/modules/websocket/websocket-events.types.ts` 로 추출하고,
   25개 이상 소비 지점의 import 를 그쪽으로 재배선했다(`websocket.service.ts` 는 하위호환
   re-export 유지). 이 신규 파일은 `import` 문이 0줄인 순수 선언 모듈이며, 필드 구조·enum
   값 문자열 전부 원본과 바이트 단위로 동일함을 직접 대조 확인했다.
2. **`TERMINAL_SHAPE` 모듈 스코프 상수화** — `execution-event-emitter.service.ts`
   (`emitTerminalExecution`)가 매 호출 시점 리터럴로 만들던 `{eventType, status}` 매핑을
   모듈 스코프 `const` 로 되돌렸다(ES-module 순환 회귀 #1174 재수정 완료 확인 후). 계산
   결과와 조립 로직(`wire.error = payload.error`, `wire.result = {cancelledBy}` 등)은
   변경 전과 동일 — pure refactor.
3. **신규 정적 가드 테스트** `websocket-events.types.spec.ts` — TypeScript AST(`ts.createSourceFile`)
   로 소스 트리를 순회해 순환 재편입을 컴파일타임이 아닌 테스트타임에 잡는 dev-only 스크립트.
   `fs.readFileSync`/`fs.readdirSync`/`path.join` 을 쓰지만 인자는 전부 `__dirname` 기반
   상수 경로이며, 사용자 입력·외부 데이터·네트워크 I/O 가 전혀 개입하지 않는다.

## 검증

- `codebase/backend/src/modules/websocket/websocket.service.ts` 전체를 직접 열람 —
  `CREDENTIAL_KEY_PATTERN`(`/^(password|passwd|pwd|api[_-]?key|secret|token|access[_-]?token|
  refresh[_-]?token|private[_-]?key|client[_-]?secret|authorization|cookie)$/i`),
  `sanitizePayloadForWs`/`sanitizeInner`(depth 상한 `MAX_SANITIZE_DEPTH=10` 초과 시
  `'[REDACTED_DEPTH]'` 통째 마스킹), `SANITIZE_CACHE`(WeakMap), `attachRoutingContext`
  (chatChannel 첨부 시에도 `sanitizePayloadForWs` 재적용), `NotificationsChannelAuthorizer`
  가드 언급 — 모든 보안 관련 로직이 리팩터 전후로 그대로 보존됨을 확인. 로직 diff 자체가 없다
  (이 파일의 변경분은 순수 import/export 문 재배치뿐).
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전체 열람 — 값/타입
  선언 외 로직 없음, import 0줄 확인.
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
  전체 열람 — `TERMINAL_SHAPE` 는 `websocket-events.types`(순환 밖) 값만 참조, `wire.error`/
  `wire.result` 조립은 §6/§6.5 계약(닫힌 3값 union, user-cancel 시 `error` 키 부재)을 그대로
  보존.
- `git diff origin/main...HEAD -- codebase/` 를 `+` 추가 라인 기준으로 import/export/type/주석을
  걸러낸 결과, 남는 실질 코드 추가는 `TERMINAL_SHAPE` 리터럴과 신규 spec 파일의 AST 순회
  로직뿐임을 확인 — 그 외 26개 파일은 전부 import 경로 문자열 변경만.
- 하드코딩 시크릿 패턴(`password|secret|api[_-]?key|token|private[_-]?key|BEGIN ... KEY|AKIA` 등)
  전수 grep — diff 추가 라인에서 매치 0건.
- 새 파일·수정 파일 어디에도 신규 HTTP 엔드포인트, 신규 사용자 입력 파싱, 인증/인가 조건문,
  암호화/해시 호출, DB 쿼리 변경이 없음(전부 import 재배선 + 상수 위치 이동 + 순수 test-only
  정적 분석기).

## 발견사항

없음 — Critical/Warning/INFO 대상 보안 결함을 찾지 못했다.

이번 diff 는 신규 엔드포인트·사용자 입력 처리 경로·인증/인가 로직·암호화·시크릿 관리를 전혀
건드리지 않는 순수 내부 리팩터다. 기존 보안 통제(credential 키 패턴 마스킹, 외부 fanout 필드
strip `stripExternalOnlyFields`, sanitize depth 상한을 통한 DoS/누출 방지, `TerminalEventPayload`
의 닫힌 union 계약)는 코드 레벨에서 바이트 단위로 보존되어 있음을 직접 소스 대조로 확인했다.
직전 3라운드(`19_27_37`→`20_05_17`→`20_27_08`)가 지적했던 보안 인접 항목(WARN #10 credential
JSDoc 고아화)도 이번 소스에서는 이미 올바른 위치(`websocket.service.ts` `CREDENTIAL_KEY_PATTERN`
선언 바로 위)에 있음을 재확인했다.

`payload.error`(`TerminalErrorPayload`)가 `sanitizeErrorMessage` 계열을 항상 경유하는지에
대한 전수 확인은 이번 diff 범위 밖(기존 설계, 무변경)이며 plan 문서(`spec-sync-external-
interaction-api-gaps.md` 등)에 이미 별도 턴 항목으로 등재되어 있어 재차 지적하지 않는다.

## 요약

`websocket.service.ts` 가 안고 있던 런타임 값(enum)·타입 선언을 ES-module 순환(#1174 회귀
원인) 밖의 의존성-프리 모듈로 옮기는 기계적 import 재배선과, `execution-event-emitter.service.ts`
의 `TERMINAL_SHAPE` 모듈 스코프 상수화(순환 이탈이 확인된 뒤의 안전한 회귀), 그리고 그 불변식을
지키는 test-only AST 정적 가드 추가로 구성된 diff다. 인젝션·인증/인가·암호화·시크릿·에러 노출·
의존성 관점 어디에서도 신규 취약점이나 기존 통제의 약화를 발견하지 못했다. credential 마스킹
(`CREDENTIAL_KEY_PATTERN`/`sanitizePayloadForWs`), 외부 fanout strip, depth 상한 방어는 전부
동일 파일에 동일 코드로 남아 있음을 직접 열람으로 검증했다.

## 위험도

NONE
