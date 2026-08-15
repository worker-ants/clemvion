# 보안(Security) 리뷰

## 대상 요약

이번 changeset 의 실질 코드 변경은 `ExecutionEventEmitter` 에 종결 이벤트(`completed`/`failed`/
`cancelled`) 전용 판별 union 파사드 `emitTerminalExecution(executionId, TerminalEventPayload)`
를 신설하고, `execution-engine.service.ts`·`retry-turn.service.ts` 의 `emitExecution(...)` 직접
호출 11곳을 그 파사드로 치환한 순수 리팩터다. 부수적으로 `retry-turn.service.ts` 의
`failRetryExecution` cancelled 분기에 종전엔 없던 `cancelledBy: 'user'` 필드가 채워지도록 결함을
흡수했다(자매 plan `retry-turn-terminal-guard.md` #2). 나머지 변경 파일(CHANGELOG, plan 문서 다수,
`review/code/2026/08/15/17_54_32/**`·`review/consistency/2026/08/15/17_20_28/**` 산출물, spec
문서 각주)은 코드가 아닌 문서/이전 리뷰 라운드 산출물이다.

## 발견사항

- **[INFO]** `cancelledBy: 'user'` 고정값은 실제 취소 주체(user/system/timeout)를 구분하지 못한다 — 보안 취약점은 아님
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution` (cancelled 분기, `type: 'cancelled', cancelledBy: 'user'`)
  - 상세: `ExecutionCancelledError` 는 "DB 가 이미 CANCELLED" 를 관측했을 때만 던져지므로 실제 취소 주체를 알 수 없다. `'user'` 로 고정하면 §6.5 규칙상 `error` 필드를 동행하지 않게 되어, 실제 원인이 system/timeout 이었던 경우 클라이언트에 원인 정보가 축소 전달된다. 정보 은폐 방향이지 노출(기밀성 침해)이 아니며, 인가/인증 우회·인젝션·시크릿 노출과 무관하다. plan(`plan/in-progress/eia-terminal-emit-facade.md`)에 이미 기지 한계로 명시돼 있다.
  - 제안: 조치 불요(문서화된 한계). 후속 `error.code` 기반 원인 파생은 별도 항목으로 이미 추적 중.

- **[INFO]** `TerminalEventPayload` 판별 union 은 닫힌 리터럴 타입이라 신규 인젝션 표면을 만들지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:31-49` (`TerminalEventPayload` 정의), `:104-139` (`emitTerminalExecution` wire 조립)
  - 상세: `type`(`'completed'|'failed'|'cancelled'`)·`cancelledBy`(`'user'|'system'|'timeout'`) 모두 닫힌 리터럴이라 임의 문자열이 wire 로 흘러들 수 없다. `wire` 객체는 정적 키(`status`/`durationMs`/`error`/`result`)만 조립하며 사용자 제어 값을 스프레드하지 않아 프로토타입 오염·객체 키 인젝션 여지가 없다. `error` payload(`TerminalErrorPayload`)를 그대로 WS 로 전달하는 동작 자체는 이 diff 이전(#1170)부터 존재하며 이번 변경은 조립 위치만 옮겼다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 전 변경 파일(코드 5개 + plan/review/spec 문서)
  - 상세: `grep -iE "password|secret|token|api[_-]?key|credential"` 로 diff 전수 검사 결과 리터럴 값 매칭 없음. 문서 내 "token" 언급은 JWT/실행 토큰 등 도메인 용어 서술뿐이다.
  - 제안: 없음.

- **[INFO]** 인증/인가·세션 관리·암호화 로직 변경 없음
  - 위치: 변경 5개 코드 파일 전체
  - 상세: `emitTerminalExecution` 은 내부적으로 기존 `emitExecution` → `WebsocketService.emitExecutionEvent` 를 그대로 위임 호출한다. 호출부(`execution-engine.service.ts`, `retry-turn.service.ts`) 도 이벤트 payload 조립 방식만 바뀌었고 인가 검사·세션·암호화 경로는 건드리지 않는다.
  - 제안: 없음.

## 요약

이번 changeset 의 실질 코드 변경(종결 이벤트 emit 판별 union 파사드 + 11개 호출부 이관)은 사용자 입력 처리·인증/인가·암호화·SQL/커맨드 실행 경로를 전혀 건드리지 않는 순수 내부 리팩터이며, 닫힌 리터럴 union 사용으로 새로운 인젝션 표면도 만들지 않는다. 유일하게 관측 가능한 동작 변화(`retry-turn.service.ts` cancelled 경로에 `cancelledBy: 'user'` 신규 emit)는 정보 정확성 이슈로 이미 plan 에 기지 한계로 문서화돼 있으며 기밀성/무결성/가용성 침해에 해당하지 않는다. 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화·에러 메시지 노출 등 OWASP Top 10 관련 결함은 발견되지 않았다.

## 위험도
NONE
