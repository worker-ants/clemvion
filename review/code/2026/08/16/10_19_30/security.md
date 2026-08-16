# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 는 직전 라운드(`09_51_00`)의 RESOLUTION 이 적용된 상태다. 핵심 보안 로직은
`codebase/backend/src/shared/utils/terminal-error-payload.ts` 에 신설된 `redactTerminalError()`
(EIA 종결 이벤트 `error.message`/`error.details` 를 WS/SSE/outbound webhook egress 직전에
`deepRedactSecrets` 로 마스킹)이며, 나머지 파일(`sanitize-error-message.ts` docstring 정정,
`terminal-error-payload.spec.ts` 테스트 8건, `CHANGELOG.md`, `plan/**`, `review/consistency/**`)은
그 하드닝을 뒷받침·기록하는 문서/테스트다. 실제 소스(`terminal-error-payload.ts`,
`sanitize-error-message.ts`(shared+execution-engine), `terminal-error-payload.spec.ts`)를 직접
`Read` 로 열어 diff 와 대조했고, `code`/`nodeId` 값 공간이 실제로 닫혀 있다는 주장도
`execution-engine.service.ts`/`workflow-errors.ts` 원본을 열어 직접 검증했다.

## 발견사항

- **[INFO]** 자격증명이 없는 연결 문자열·내부 호스트명·사설 IP·스택 프래그먼트는 여전히 마스킹되지 않는다 (기존 갭, 이번 PR 이 악화시키지 않음, 이미 등재·추적됨)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `redactTerminalError`(게이트 96~104), 근거 JSDoc(게이트 69~87)
  - 상세: `deepRedactSecrets` → `redactSecrets`(`shared/utils/sanitize-error-message.ts`)가 재사용하는 `SECRET_LEAK_PATTERNS` 를 직접 열어 확인한 결과, Bearer 토큰·`key=value` 형 secret·bare JWT·URI-userinfo(`user:pass@host`)만 잡고 **자격증명이 없는** `postgres://host:5432/db` 류나 내부 호스트명/사설 IP 는 어떤 패턴에도 매칭되지 않는다(정규식 직접 대조로 재현). `Execution.error.message` 는 DB 연결 실패 같은 흔한 시나리오에서 내부 인프라 정보를 담을 수 있고, 이 값이 이번 PR 로 새로 열리는 WS/SSE/**EIA outbound webhook**(외부 제3자) 경로로 나간다 — 내부 네트워크 토폴로지 정찰(reconnaissance) 관점에서 낮은 수준의 정보 노출(CWE-200)에 해당한다. 다만 이건 이번 PR 이 새로 만든 결함이 아니라 **이전부터 있던 무방비 상태**이고, 이번 PR 은 오히려 그 표면을 자격증명 범위에서 좁혔다(하드닝 방향). `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 실측 근거(무수정 프로브 표)와 함께 이미 명시적으로 등재돼 있고, 넓히지 않은 이유(shared SoT 로 올리면 `deepRedactSecrets` 의 다른 소비자 — conversation-thread·`ai_message`·EIA `nodeOutput` — 전부에 blast radius 가 번진다)도 코드 JSDoc·plan 양쪽에 근거와 함께 기록돼 있다.
  - 제안: 별도 후속 PR 로 `CONNECTION_STRING_PATTERN`류를 shared SoT 로 승격하는 결정을 진행할 때, blast radius 영향받는 소비자별로 회귀 테스트를 먼저 갖추고 진행할 것(이미 계획대로 별건 처리 중이므로 이번 PR 을 막을 사유는 아님).

- **[INFO]** `toTerminalErrorPayload`/`redactTerminalError` 출력에 길이 상한이 없다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `toTerminalErrorPayload`(게이트 111~150)
  - 상세: 형제 유틸 `sanitize-error-message.ts`(execution-engine, 게이트 32 `ERROR_MESSAGE_MAX_LENGTH = 500`)는 알림 경로에서 길이를 절단하는데, 이번에 egress 초크포인트가 된 `toTerminalErrorPayload` 경로는 마스킹만 하고 크기를 제한하지 않는다. secret 노출 관점에서는 문제 없으나(마스킹은 걸림), 매우 큰 `details`/`message` 가 그대로 outbound webhook 수신자에게 전달될 수 있다. 이번 PR 이 만든 것이 아니라 함수의 선존 상태이고 plan 도 "범위 밖" 으로 명시했다.
  - 제안: 조치 불요(차단 사유 아님). 후속 항목으로 검토 권장.

- **[INFO]** 테스트 픽스처의 secret-형 리터럴은 실제 자격증명이 아니라 합성 테스트 값
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` (게이트 140 `Bearer sk-live-abcdef123456`, 게이트 147 `api-key=xyz789secret`, 게이트 154 `authorization: 'Bearer leak-me-999'`, 게이트 166~167 `Bearer sk-live-should-not-be-masked` / `api-key=must-stay-verbatim`)
  - 상세: 명백히 조작된 짧은 문자열로, 마스킹 대상 형태를 검증하기 위한 정상적 테스트 관행이다. 하드코딩된 시크릿 점검 항목에 대응해 명시적으로 확인·기록한다.
  - 제안: 조치 불요.

## 확인한 항목 (직접 검증, 문제 없음)

- **`code`/`nodeId` 를 마스킹 대상에서 제외한 설계가 실제로 안전한지 소스 레벨로 직접 검증했다.** `redactTerminalError` 는 `message`/`details` 만 마스킹하고 `code`/`nodeId` 는 건드리지 않는다(§6.4 값 공간이 닫혀 있다는 근거). `execution-engine.service.ts`/`workflow-errors.ts` 원본을 열어 `Execution.error.code` 를 쓰는 모든 지점을 추적한 결과: `finalizeFailedExecution` 만 `code` 를 채우고, 그 값은 `ErrorPortFallbackError.code = 'ERROR_PORT_FALLBACK'`(고정 리터럴), `ExecutionTimeLimitError.code = ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED`(고정 리터럴) sentinel 두 가지뿐이다. `failFirstSegmentSetup`/`failRetryExecution` 은 `code` 필드 자체를 쓰지 않는다(`{ message: errMessage }` 만). 즉 임의 문자열(자유 텍스트)이 `code` 로 흘러들어 마스킹을 우회해 secret 을 실어 나를 경로가 없다 — 문서화된 보안 근거가 코드와 정확히 일치한다.
- `SECRET_LEAK_PATTERNS`(재사용, 이번 diff 로 변경되지 않음)의 6개 정규식을 직접 열어 중첩 정량자·backtracking 위험을 확인 — 전부 선형(고정 길이 알터네이션 + `{n,}` 단순 반복 또는 lookbehind/lookahead), ReDoS 패턴 없음.
- `redactSecretsInJsonString` 의 `JSON.parse` 는 `try/catch` 로 감싸져 있어 malformed JSON 이 예외를 밖으로 던지지 않는다(egress 경로에서 크래시 없음).
- `toTerminalErrorPayload` 의 4개 반환 지점(문자열 레거시/숫자·불리언·bigint/그 외 스칼라/객체) **전부**가 `redactTerminalError()` 를 거친다 — 코드 직접 확인. "한 곳만 빠뜨린다" 는 이 저장소의 반복 실패 형태가 컴파일 타임 강제는 아니지만 코드 리딩상 전수 확인됨.
- `redactTerminalError`/`deepRedactSecrets` 는 입력을 mutate 하지 않는다(spread + copy-on-change) — 새 시크릿이 부수적으로 다른 곳에 남는 경로 없음.
- `sanitize-error-message.ts`(execution-engine) 변경은 docstring 정정뿐이며 정규식·로직 무변경 — 신규 인젝션/시크릿 취약점 없음.
- 인증/인가, DB 쿼리, 커맨드 실행, 파일 경로 처리 등 OWASP Top10 주요 축은 이번 diff 범위(문자열 마스킹 유틸 확장)와 무관 — 해당 없음.
- `CHANGELOG.md` 항목이 wire 바이트 변화(`Bearer sk-… → ***`, `postgres://user:pw@host/db → postgres://***@host/db`)와 잔여 갭(자격증명 없는 연결 문자열 등)을 정확히 고지한다 — 실제 정규식 동작과 일치함을 직접 대조 확인.

## 요약

이번 변경(및 그 직전 라운드의 fix 반영)은 EIA 종결 이벤트의 `error.message`/`details` 가 WS/SSE/outbound webhook 을 통해 외부 제3자에게 나가기 전 값-패턴 secret(Bearer 토큰·API 키·URI 임베디드 자격증명 등)을 마스킹하는 **순수 보안 하드닝**이며, 새로운 인젝션·인증우회·평문전송·하드코딩된 실제 시크릿·안전하지 않은 암호화는 발견되지 않았다. `code`/`nodeId` 를 마스킹 대상에서 제외한 설계 근거("값 공간이 닫혀 있다")를 소스까지 내려가 직접 검증했고 정확했다. 유일한 잔여 항목은 자격증명이 없는 연결 문자열/내부 호스트명이 여전히 통과한다는 것인데, 이는 이번 PR 이 만든 결함이 아니라 선존 상태이고(오히려 이번 PR 이 자격증명 범위에서 노출을 줄였다), 실측 근거·blast-radius 판단과 함께 `spec-sync-external-interaction-api-gaps.md` 에 명시적으로 추적되고 있어 INFO 로 등재한다. Critical/Warning 급 발견 없음.

## 위험도

LOW
