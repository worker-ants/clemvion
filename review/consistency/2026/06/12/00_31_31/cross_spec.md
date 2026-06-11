# Cross-Spec 일관성 검토 결과

## 검토 대상

- 검토 모드: `--impl-done` (구현 완료 후 검토)
- Target: `spec/conventions/` (변경 없음) + 구현 변경 파일
- 실제 변경 파일:
  - `codebase/backend/src/nodes/core/error-codes.ts` — `HTTP_BLOCKED` 주석 보강
  - `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — `CODE_MEMORY_LIMIT`, `HTTP_BLOCKED` INTERNAL_CODES 등재
  - `codebase/backend/src/nodes/data/code/code.handler.ts` — `classifyCodeNodeError` 함수 상단 이동 + `LEGACY_TO_NORMALIZED` 타입 강화 + fallback 기본값을 `CODE_EXECUTION_FAILED` 로 고정
  - `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — 인라인 문자열 `'HTTP_BLOCKED'` → `ErrorCode.HTTP_BLOCKED` enum 참조 전환

---

## 발견사항

### [INFO] classifier INTERNAL_CODES 와 spec §3.1 매핑 표 간 잔존 갭 (기존 pre-existing)
- target 위치: `execution-failure-classifier.ts` `INTERNAL_CODES` set
- 충돌 대상: `spec/conventions/chat-channel-adapter.md §3.1` 매핑 표 (`DB_*` wildcard), `spec/4-nodes/2-flow/1-workflow.md §6`
- 상세: spec 매핑 표는 `DB_*` wildcard + `SUB_WORKFLOW_FAILED` 단일 항목으로 기술하지만, `ErrorCode` enum 에는 `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` / `EMAIL_HOST_BLOCKED` 가 별도로 존재한다. 이들은 현재 `INTERNAL_CODES` 에 등록되지 않아 unknown fallback(CCH-ERR-04 warn 로그) 경로를 탄다 — 최종 `executionFailedInternal` 결과는 동일하나 불필요한 warn 로그가 발생한다. 본 PR 이 `CODE_MEMORY_LIMIT` / `HTTP_BLOCKED` 를 등재한 것과 동일 패턴.
- 제안: 이 PR 의 범위를 벗어나는 pre-existing 갭이므로 차단 불필요. 후속 별도 PR 에서 `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` / `EMAIL_HOST_BLOCKED` 를 `INTERNAL_CODES` 에 추가하고, spec §3.1 매핑 표를 wildcard 표기 대신 개별 행 또는 "variant 포함" 주석으로 명확화 권장.

### [INFO] `error-codes.ts` JSDoc 주석이 `http-safety.ts` SoT 참조 (spec 미언급)
- target 위치: `error-codes.ts` line 15-17 (`HTTP_BLOCKED` 주석)
- 충돌 대상: `spec/4-nodes/4-integration/1-http-request.md §4` (SSRF 가드 설명)
- 상세: 추가된 주석이 "가드 정책의 SoT 는 `http-request/http-safety.ts`" 라고 기술하나, spec SoT 는 `spec/4-nodes/4-integration/1-http-request.md §4` 다. 구현 파일 내 주석이 코드 파일을 SoT 로 칭하는 것은 spec-driven 원칙과 상충할 수 있다. 동작·계약에는 영향 없다.
- 제안: 주석을 spec 참조 형식으로 개정하거나 현행 유지 (영향 없음).

---

## 요약

이번 PR(errcode-wiring) 이 도입하는 변경은 `spec/conventions/chat-channel-adapter.md §3.1` 매핑 표가 이미 명시한 `CODE_MEMORY_LIMIT`·`HTTP_BLOCKED`→`executionFailedInternal` 분류를 구현 코드에 후행 배선한 것이다. spec 정의와 구현 사이의 충돌은 없으며, 변경된 항목(INTERNAL_CODES 등재·ErrorCode enum 참조 통일·LEGACY_TO_NORMALIZED 타입 강화·classifyCodeNodeError 위치 이동)은 모두 기존 spec 약속을 코드 레벨에서 명시화하는 방향이다. 발견된 INFO 2건은 기존 pre-existing 갭 및 주석 정확도 이슈이며 이번 변경이 신규로 만들어낸 모순이 아니다.

## 위험도

NONE
