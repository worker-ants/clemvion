# 보안(Security) 리뷰

## 대상 요약

이번 변경은 `ExecutionEventEmitter.emitTerminalExecution(executionId, TerminalEventPayload)` 라는
판별 union 기반 타입 파사드를 신설해, `completed`/`failed`/`cancelled` 종결 이벤트의 `status`·
이벤트 타입·필수 필드(`durationMs`, `error`, `cancelledBy`)를 컴파일 타임에 강제하는 순수 리팩터다.
`execution-engine.service.ts`·`retry-turn.service.ts` 의 11개 `emitExecution(...)` 직접 호출부를
`emitTerminalExecution(...)` 호출로 치환했고, wire 형태(필드 존재/부재)를 고정하는 회귀 테스트를
`execution-event-emitter.service.spec.ts` 에 추가했다. 나머지 파일(plan/`review/consistency`
산출물, spec 문서)은 문서·추적 자료이며 코드 변경이 없다.

## 발견사항

- **[INFO]** `cancelledBy: 'user'` 고정값은 데이터 정확성 이슈이지 보안 취약점은 아님
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (`failRetryExecution`, 변경된 코드 블록 내 `type: 'cancelled', cancelledBy: 'user'`)
  - 상세: `ExecutionCancelledError` 가 실제 취소 주체(user/system/timeout)를 구분하지 못하는 상황에서 `'user'` 를 고정 배정한다. §6.5 계약상 `'user'` 를 선택하면 `error` 필드를 함께 싣지 않게 되어, 실제 원인이 system/timeout 이었던 경우 클라이언트에 실제보다 적은 정보(원인 불명)가 노출된다 — 이는 정보 은폐이지 노출이 아니므로 기밀성 문제는 아니다. 인가/인증 우회, 인젝션, 시크릿 노출과 무관하며, plan 문서(`eia-terminal-emit-facade.md`)에 이미 한계로 명시돼 있다.
  - 제안: 조치 불요(문서화된 기지 한계). 후속으로 `error.code` 기반 원인 파생을 고려한다는 계획이 이미 별도 항목으로 등재돼 있음.

- **[INFO]** 종결 `error` 객체가 WebSocket 클라이언트에 그대로 전달되는 기존 동작은 이 diff 로 신규 도입된 것이 아님
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (`emitTerminalExecution` 내 `wire.error = payload.error`)
  - 상세: `toTerminalErrorPayload`(`codebase/backend/src/shared/utils/terminal-error-payload.ts`, 이번 diff 밖 파일)가 DB 의 `Execution.error` 를 `{code, message, nodeId, details?}` 로 정규화해 그대로 WS emit 에 싣는 동작은 이전부터 존재했다(#1170 에서 확립). 이번 변경은 그 값을 어디서 조립하는지(호출부 → 파사드)만 옮겼을 뿐 새로운 데이터 소스나 새로운 노출 경로를 추가하지 않는다. `details?: unknown` 필드에 내부 스택트레이스·경로 등이 실릴 가능성은 이 diff 의 스코프 밖(기존 동작 유지)이라 신규 발견사항으로 등재하지 않음.
  - 제안: 조치 불요(스코프 밖). 필요 시 `toTerminalErrorPayload` 자체에 대한 별도 리뷰에서 `details` 필드의 민감정보 포함 여부를 점검할 것.

- **[INFO]** 신규 코드에 사용자 입력 직접 처리·SQL/커맨드/경로 조작·인증 검사 로직 없음
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` 전체 diff, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 및 `retry-turn.service.ts` 의 호출부 치환 diff
  - 상세: `TerminalEventPayload` 는 닫힌 리터럴 union(`type: 'completed'|'failed'|'cancelled'`, `cancelledBy: 'user'|'system'|'timeout'`)이라 임의 문자열이 wire 로 흘러들 수 없다. `wire` 객체는 정적 키(`status`, `durationMs`, `error`, `result`)만 조립하며 사용자 제어 키를 스프레드하지 않아 프로토타입 오염·객체 키 인젝션 여지가 없다. 인증/인가·세션 관리·암호화·에러 메시지 노출 관점에서 이 diff 가 건드리는 로직은 없음.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 전 변경 파일(코드 5개 + plan/review 문서 12개)
  - 상세: `grep -iE "password|secret|token|api[_-]?key|credential"` 로 diff 전수 검사 결과 매칭 없음. plan/review 문서에도 실제 자격증명이나 API 키가 포함되지 않았고, 언급되는 "token"은 JWT/실행 토큰 등 도메인 용어에 대한 서술일 뿐 리터럴 값이 아님.
  - 제안: 없음.

## 요약

이번 변경은 종결(EXECUTION_COMPLETED/FAILED/CANCELLED) WebSocket 이벤트 emit 을 판별 union 타입 파사드로 초크포인트화하는 순수 리팩터로, 사용자 입력 처리·인증/인가·암호화·SQL/커맨드 실행 경로를 전혀 건드리지 않는다. 새로 노출되는 데이터는 없으며(기존에 이미 클라이언트로 나가던 `error`/`durationMs`/`cancelledBy` 필드의 조립 위치만 이동), 닫힌 리터럴 union 사용으로 임의 값 주입 여지도 없다. `cancelledBy: 'user'` 고정값은 정보 정확성 문제로 이미 문서화된 기지 한계이며 보안 취약점(기밀성/무결성/가용성 침해)에 해당하지 않는다. 하드코딩된 시크릿이나 신규 인젝션 표면도 발견되지 않았다.

## 위험도
NONE
