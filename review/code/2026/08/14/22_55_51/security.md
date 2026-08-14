# 보안(Security) 코드 리뷰

## 리뷰 범위

`execution.failed` / 시스템 `execution.cancelled` 의 `error` 페이로드를 EIA §6.4
wire 형태로 정규화하는 변경(신규 `terminal-error-payload.ts` 헬퍼 + 4개 emit 지점
consolidation + 위조 에러코드 `'INTERNAL_ERROR'` 제거 + `null` 명시화). 관련 테스트·
`types.ts` 타입 변경·plan/spec 문서 갱신 포함, 총 23개 파일.

## 발견사항

- **[WARNING]** 신규 종결 에러 wire 헬퍼가 `message`/`details` 에 value-pattern 시크릿
  마스킹(`redactSecrets`/`deepRedactSecrets`)을 적용하지 않은 채 외부(EIA WS/SSE) 로
  그대로 내보낸다 — 형제 필드(`conversationThread`, `execution.ai_message`,
  `nodeOutput.conversationConfig`)와 REST `getStatus` 의 terminal `result`/`error` 는
  이미 이 방어가 강제(§R17 "bypass 차단")돼 있는데, 이 신규 helper 가 소비하는
  WS/SSE live 경로만 비대칭이다.
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts` 함수
    `toTerminalErrorPayload` (게이트 42~76행, 특히 66~71행의 `message`/`details` 대입부).
    소비처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664`
    (`error: toTerminalErrorPayload(row.error)`), 동 파일 `:4870`
    (`toTerminalErrorPayload(savedExecution.error)`),
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:966`
    (`toTerminalErrorPayload(execution.error)`).
  - 상세: `error.message` 의 실제 출처는 각 서비스의
    `errMessage = error instanceof Error ? error.message : String(error)` (예:
    `execution-engine.service.ts` `failFirstSegmentSetup`/`finalizeFailedExecution`,
    `retry-turn.service.ts` 동형 지점) — 즉 **임의의 내부 예외 메시지 원문**이다. 이
    저장소는 이미 이 정확한 위험 클래스(노드 예외가 echo 한 Bearer/API 키·DB 커넥션
    문자열·내부 호스트/경로)를 문서화한 전용 방어 모듈을 갖고 있다
    (`execution-engine/sanitize-error-message.ts` `sanitizeErrorMessage`, "WS 경로의
    key-name 기반 `sanitizePayloadForWs` 는 자유 텍스트 message 내부의 값-embedded
    토큰을 못 잡으므로, 알림/이메일 경로는 본 값-패턴 마스킹이 유일한 방어다" 라고 스스로
    명시). 그런데 이 `sanitizeErrorMessage` 는 `dispatchExecutionFailedNotification`(인앱/
    이메일 알림)에만 적용되고, 같은 `errMessage` 로 만들어진 `Execution.error.message` 가
    `toTerminalErrorPayload` 를 거쳐 `emitExecution(EXECUTION_FAILED, …)` 로 나갈 때는
    **키-이름 기반** `websocket.service.ts` 의 `sanitizePayloadForWs` 만 통과한다 — 이
    함수는 문자열 값이면 `typeof value !== 'object'` 로 즉시 그대로 반환하므로(실제 코드
    확인) 자유 텍스트 안에 박힌 토큰/키를 걸러내지 않는다. `websocket.service.ts` 전체에
    `deepRedactSecrets` 호출이 0건임도 직접 확인했다. 이 이벤트는
    `SseAdapter`(`external-interaction/sse-adapter.service.ts`)가 그대로 구독해 EIA
    **외부** SSE 스트림으로 재전송하므로, 실제로 unauthenticated/외부 클라이언트까지
    도달하는 경로다(REST `getStatus` 는 별도 `stripAndRedact`(=`deepRedactSecrets`+
    `stripExternalOnlyFields`)를 이미 거치므로 이 경로는 예외 — 문제는 live push 한정).
    Chat Channel(discord/slack/telegram) adapter 는 `classifyExecutionFailure` 가
    `error.code`+`details.statusCode` 화이트리스트만 쓰고 `error.message` 를 아예
    참조하지 않아 이 경로는 안전함을 코드로 확인했다(CCH-ERR-02/03).
  - **주의**: 이 갭 자체는 diff 이전에도 존재했다(종전 코드도 `error: errMessage` 를
    그대로 emit). 이번 diff 가 새로 만든 것은 아니지만, `terminal-error-payload.ts` 는
    이 필드를 "EIA §6.4 wire 형태"로 **공식화·단일 choke point 화**한 신규 파일이고
    JSDoc 이 스스로 "직전 PR(#1169)이 `llmCalls` strip 을 세 출구에서 하나씩 발견한 것과
    같은 클래스" 라고 명시할 만큼 이 저장소가 최근 반복적으로 겪은 바로 그 실수
    패턴(같은 데이터가 나가는 출구마다 방어를 따로 걸다 하나씩 빠뜨림)의 연장선에
    있다. 지금이 이 필드에도 값-패턴 마스킹을 넣을 자연스러운 지점인데 넣지 않았다.
  - 제안: `toTerminalErrorPayload` 내부에서 `message`(및 존재 시 `details`)에
    `redactSecrets`/`deepRedactSecrets` (SoT: `shared/utils/sanitize-error-message.ts`)
    를 적용해, REST `getStatus` 의 `stripAndRedact` 와 대칭을 맞출 것. 별도 함수로
    분리한다면 최소한 이 비대칭을 알고 있는 채로 defer 하는 근거를 헬퍼 JSDoc/plan 에
    남길 것(이 프로젝트 관례상 "유예 근거는 실측·명시 필요").

- **[INFO]** 위조 에러 코드(`'INTERNAL_ERROR'`) 제거는 보안·정확성 관점에서 개선이다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
    (게이트 546~558행), `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts`
    (게이트 68행).
  - 상세: 존재하지 않는 코드를 지어내던 이전 동작은 조사자가 존재하지 않는 코드의
    출처를 찾아 헤매게 하는 부작용이 있었다(위조 데이터가 로그/조사 흐름을 오도).
    `code: null` + `?? ''` 로 classifier 의 unknown-fallback(CCH-ERR-04, structured warn
    log)에 안전하게 떨어지는 것을 `execution-failure-classifier.ts` 로 직접 확인했다 —
    fail-closed 유지, 회귀 아님.
  - 제안: 없음(개선 사항, 조치 불요).

- **[INFO]** `terminal-error-payload.ts` 의 `code`/`message`/`nodeId` 필드는 모두
  `typeof` 런타임 가드를 거쳐 신규 리터럴 객체(`out`)에 named 대입되며, `details` 도
  단순 존재-체크 대입이다 — 임의 키 스프레드/머지가 없어 prototype pollution
  (`__proto__` 등) 벡터는 없음을 확인했다(게이트 66~74행).

## 요약

이번 diff 는 `execution.failed` 계열 에러 payload 를 문자열→typed object·위조 코드→
명시적 `null` 로 정규화하는 리팩터로, 인젝션·인증/인가·시크릿 하드코딩·암호화 관련
새 취약점은 발견되지 않았고 위조 에러 코드 제거는 오히려 조사 정확성을 개선한다.
다만 신규 공용 헬퍼 `toTerminalErrorPayload` 가 EIA 외부 WS/SSE 표면으로 나가는
`error.message`/`error.details` 에 이 저장소가 이미 다른 형제 필드(`conversationThread`,
`ai_message`, REST `getStatus` 의 `result`/`error`)에는 강제 적용 중인 value-pattern
시크릿 마스킹(`deepRedactSecrets`/`redactSecrets`)을 적용하지 않는다 — pre-existing
갭이지만 이 diff 가 정확히 그 갭을 공식 wire-format 으로 굳히는 지점이라 WARNING 으로
등재한다.

## 위험도

LOW
