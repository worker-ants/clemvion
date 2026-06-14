# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] 실행·디버깅 흐름 변경 — `05-run-and-debug/` 동반 갱신 누락

- **변경 파일:** `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- **매트릭스 항목:** `run-debug-flow-change` — "실행·디버깅 흐름 변경" → target: `codebase/frontend/src/content/docs/05-run-and-debug/`
- **누락된 동반 갱신:** `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx` 및 `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.en.mdx`
- **상세:** `websocket.gateway.ts`의 `buildContinuationErrorAck`가 A-1 리팩터로 동작을 의미적으로 변경했다. 이전 동작은 plain Error의 내부 `error.message`를 WS ack의 `error` 필드에 그대로 전달했지만, 변경 후에는 typed `ExecutionError`만 해당 class의 고정 client-safe `message`/`code`를 surface하고, 그 외 모든 임의(non-typed) 에러는 고정 fallback 문자열 + `EXECUTION_INTERNAL_ERROR` errorCode로 대체된다. 이는 사용자가 폼 제출/메시지 전송 중 오류를 만났을 때 보게 되는 오류 메시지 패턴이 근본적으로 바뀐 것이다. `05-run-and-debug/error-handling.mdx`에 이 errorCode 표면화 정책(typed vs plain error, errorCode 필드 의미, 사용자가 볼 수 있는 고정 문자열 종류)의 설명이 없으면 사용자 가이드가 실제 동작과 stale 상태가 된다.
- **제안:** `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx` + `.en.mdx`에 continuation ack 에러 표면화 정책 설명 섹션 추가. `errorCode` 필드의 세 가지 값(`INVALID_EXECUTION_STATE`, `EXECUTION_MESSAGE_TOO_LONG`, `EXECUTION_INTERNAL_ERROR`)과 각각의 의미, 사용자에게 노출되는 고정 문자열을 기술한다.

---

### 확인된 충족 항목 (누락 없음)

| 매트릭스 항목 | 판정 |
|---|---|
| `new-error-code` — `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG` → `backend-labels.ts` ERROR_KO 등록 | 충족 — `codebase/frontend/src/lib/i18n/backend-labels.ts` 에 두 코드 모두 한국어 매핑 포함 |
| `new-ui-string` — `interactionError.*` i18n parity | 충족 — `dict/ko/executions.ts` 와 `dict/en/executions.ts` 양쪽에 동일 key 구조(`invalidState`, `messageTooLong`, `internalError`) 등록 |
| 신규 섹션 디렉토리 locale 등록 | 해당 없음 — 신규 docs 섹션 디렉토리 없음 |
| 노드 추가/schema 변경 | 해당 없음 — `codebase/backend/src/nodes/**` 파일 변경 중 node handler/schema 변경 없음(error-codes.ts만 변경) |
| 인증·권한·세션 흐름 변경 | 해당 없음 — `codebase/backend/src/modules/auth/**` 변경 없음 |

## 요약

매트릭스 총 19개 trigger 중 실질 매칭은 3개(`new-error-code`, `run-debug-flow-change`, `new-ui-string`). `new-error-code`와 `new-ui-string`은 동반 갱신이 모두 충족됐다. `run-debug-flow-change` 1건 누락 — `buildContinuationErrorAck` 의 에러 표면화 정책 변경(`plain Error 내부 message 차단 + errorCode 필드 신규 의미론`)이 `05-run-and-debug/error-handling.{mdx,en.mdx}` 갱신 없이 merge되면 사용자 가이드가 실제 동작과 diverge된다.

## 위험도

LOW
