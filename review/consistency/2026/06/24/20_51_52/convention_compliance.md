# 정식 규약 준수 검토 — refactor-06 C-1 + M-7 (publish fail-fast)

검토 모드: `--impl-prep` (구현 착수 전 규약 준수 확인)
검토 범위: C-1 `cancelWaitingExecution` async + `ContinuationPublishResult` 통일 + REST `stop()` WAITING 분기 503, M-7 `nextSeq` random fallback 제거 → throw 전파

---

## 발견사항

### [WARNING] 신규 에러 코드 `CONTINUATION_ENQUEUE_FAILED` — `ErrorCode` enum 및 §7.5.2 `EXECUTION_*` 네임스페이스 충돌

- **target 위치**: 검토 scope 기술 텍스트 `"REST stop() WAITING 분기에서 queued=false 시 503(CONTINUATION_ENQUEUE_FAILED) surface"` — 구현 착수 전 단계이므로 코드베이스에 미등재.
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명 원칙) + `spec/5-system/4-execution-engine.md §7.5.2` ("신규 client-safe 코드는 중앙 `ErrorCode` enum 의 기존 `EXECUTION_*` 네임스페이스를 확장한다").
- **상세**: `CONTINUATION_ENQUEUE_FAILED` 는 "continuation enqueue 가 실패함"을 기술하며 의미 기반 명명 원칙 자체는 충족한다. 그러나 `spec/5-system/4-execution-engine.md §7.5.2` 는 `EXECUTION_INTERNAL_ERROR` / `EXECUTION_MESSAGE_TOO_LONG` 을 예시로 들어 `EXECUTION_*` prefix 를 신규 continuation-boundary 에러 코드의 표준 네임스페이스로 명시한다. `CONTINUATION_` prefix 는 이 네임스페이스와 다르며 spec 본문에 선례가 없다. `error-codes.ts` 의 `ErrorCode` enum 에도 `CONTINUATION_*` 코드가 존재하지 않는다.
- **제안**: 구현 착수 전 다음 중 하나를 확정한다.
  1. **권장**: `EXECUTION_ENQUEUE_FAILED` 로 명명하여 §7.5.2 의 `EXECUTION_*` 네임스페이스 확장 규칙과 정합. `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 에 등재 + JSDoc 에 `spec/5-system/4-execution-engine.md §7.4` 계약과 `§7.5.2` boundary 컨텍스트 명시.
  2. `CONTINUATION_ENQUEUE_FAILED` 를 사용하려면 `spec/5-system/4-execution-engine.md §7.5.2` 의 "`EXECUTION_*` 네임스페이스 확장" 문구를 `CONTINUATION_*` 네임스페이스도 허용하도록 planner spec 갱신이 선행돼야 한다.

---

### [WARNING] 신규 에러 코드 — `spec/5-system/3-error-handling.md` 카탈로그 등재 유예의 merge-gate 미명시

- **target 위치**: 검토 scope 기술 `"spec §7.4 1줄 + 에러코드 카탈로그 등재는 sibling planner spec-sync 로 defer (impl-first)"`.
- **위반 규약**: `spec/conventions/error-codes.md §1` — "카탈로그·분류·트리거: `5-system/3-error-handling.md §1` (SoT)". 에러 코드 카탈로그의 단일 진실은 `3-error-handling.md §1` 이므로 신규 코드는 해당 파일에 등재돼야 한다.
- **상세**: impl-first 접근은 scope 에 명시된 방침이나, 규약 준수 관점에서 구현 완료 후 planner spec-sync 없이 merge 하면 에러 코드 카탈로그가 구현과 영구 드리프트된다. `plan/in-progress/refactor/06-concurrency.md` C-1 항목에 spec 갱신이 체크박스로 없으면 추적이 소멸한다.
- **제안**: 구현 PR description 에 "본 PR 은 spec-sync(에러코드 카탈로그 등재 + §7.4 cancel publish 실패 계약 1줄)를 planner 후속 PR 로 defer 함 — merge 전 planner spec-sync PR 오픈 또는 동일 PR 에 포함" 을 명시한다. `plan/in-progress/refactor/06-concurrency.md` C-1 에 spec 갱신 pending 체크박스를 추가해 망실을 방지한다.

---

### [INFO] REST `stop()` WAITING 분기 HTTP 503 — shutdown 503 과의 의미 공유 확인

- **target 위치**: 검토 scope 기술 `"queued=false 시 503(CONTINUATION_ENQUEUE_FAILED) surface"`.
- **위반 규약**: `spec/5-system/2-api-convention.md §6` (HTTP 상태 코드 선택 SoT) — 직접 위반이 아니나 정합 확인 필요.
- **상세**: 503 Service Unavailable 은 `spec/5-system/4-execution-engine.md §11.1` 에서 이미 shutdown 게이트 응답 코드로 사용된다(`SERVER_SHUTTING_DOWN`). WAITING 분기 publish 실패에 503 을 추가로 사용하면 두 의미가 동일 status code 를 공유한다. 클라이언트는 `error.code` 로 분기하므로 status code 공유 자체는 수용 가능하나, `api-convention §6` 의 체계상 Redis 장애로 인한 enqueue 실패가 502(Bad Gateway — upstream 의존 실패) 보다 503 이 더 적합한지를 확인해야 한다.
- **제안**: 구현 PR 의 코드 주석 또는 PR description 에 "503 선택 근거: api-convention §6 분류 상 어느 범주인지" 를 한 줄로 명시한다.

---

### [INFO] `cancelWaitingExecution` async 전환 시 REST `stop()` WAITING 분기 await 누락 주의

- **target 위치**: `codebase/backend/src/modules/executions/executions.service.ts:730` — `this.executionEngineService.cancelWaitingExecution(id)` (현재 fire-and-forget).
- **위반 규약**: 구현 착수 시 주의 사항 — `spec/5-system/6-websocket-protocol.md §4.2` continuation queued 계약.
- **상세**: `cancelWaitingExecution` 가 `Promise<ContinuationPublishResult>` 를 반환하도록 변경된 후 `executions.service.ts:730` 을 `await` 하지 않으면 `queued=false` 경보 표면이 무력화된다. 현재 호출이 `void` 로 버려지고 있어 구현 착수 시 동반 수정이 누락되기 쉽다.
- **제안**: 구현 체크리스트에 `executions.service.ts:730` 의 `await cancelWaitingExecution` + `queued=false` 시 503/실패 body surface 를 명시한다.

---

## 요약

C-1 + M-7 의 구현 의도는 `spec/5-system/4-execution-engine.md §7.4·§9.2` 의 seq idempotency key 계약·queued 계약과 정합하며 `spec/conventions/error-codes.md` 의 의미 기반 명명 원칙도 위반하지 않는다. 주요 규약 리스크는 두 가지다: ① 신규 에러 코드 `CONTINUATION_ENQUEUE_FAILED` 의 prefix 가 `spec/5-system/4-execution-engine.md §7.5.2` 가 지정한 `EXECUTION_*` 네임스페이스와 불일치한다 — `EXECUTION_ENQUEUE_FAILED` 로의 rename 또는 spec 네임스페이스 갱신 선행 필요 (WARNING). ② scope 에서 유예한 에러코드 카탈로그 등재(`3-error-handling.md §1`)가 merge gate 없이 defer 되면 영구 드리프트 위험이 있다 (WARNING). 두 INFO 항목은 구현 착수 시 놓치기 쉬운 REST stop() await 누락과 503 선택 근거 명시다. CRITICAL 위반은 없다.

## 위험도

MEDIUM
