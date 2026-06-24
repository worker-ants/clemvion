# 정식 규약 준수 검토 결과

검토 범위: `06-concurrency C-1+M-7` — continuation publish fail-fast 통일
변경 파일:
- `/codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`
- `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `/codebase/backend/src/modules/executions/executions.service.ts`
- `/codebase/backend/src/nodes/core/error-codes.ts`
- 관련 `.spec.ts` 파일 4개

---

## 발견사항

### [WARNING] `EXECUTION_ENQUEUE_FAILED` 에러 코드가 `spec/5-system/3-error-handling.md §1` 카탈로그에 미등재
- **target 위치**: `codebase/backend/src/nodes/core/error-codes.ts` L87 — `EXECUTION_ENQUEUE_FAILED: 'EXECUTION_ENQUEUE_FAILED'`
- **위반 규약**: `spec/conventions/error-codes.md §Overview` — "카탈로그·분류·트리거: `5-system/3-error-handling.md §1` (SoT)"; `spec/5-system/3-error-handling.md §1.5` — WS commands 에러 코드 공용 카탈로그 등재 원칙
- **상세**: `EXECUTION_ENQUEUE_FAILED` 는 REST `stop()` 경로에서 발행되는 신규 에러 코드다. `spec/5-system/3-error-handling.md §1.5` 는 WS ack 전용이고, `§1.4` 는 엔진 수준/노드 수준 에러 카탈로그다. 두 섹션 모두에 이 코드가 등재되지 않았다. `error-codes.md` 명명 규약 문서 자체는 "카탈로그·분류·트리거의 SoT 는 `3-error-handling.md §1`" 이라고 명시한다. `code:` 주석에 설명은 추가됐으나 카탈로그 spec 은 갱신되지 않은 상태다.
- **제안**: `spec/5-system/3-error-handling.md §1.4` 또는 별도 REST surface 절에 다음을 추가한다. 단, 프롬프트에 명시된 "에러코드 카탈로그는 sibling planner spec-sync defer" 계획이 있으므로 즉시 차단이 아닌 WARNING으로 분류한다.
  ```
  | `EXECUTION_ENQUEUE_FAILED` | REST stop() — WAITING_FOR_INPUT cancel publish 실패(Redis 장애로 BullMQ enqueue 불가). 503. 클라이언트 재시도 유도. C-1 (06-concurrency) |
  ```

---

### [INFO] HTTP 503 선택 근거가 `spec/5-system/2-api-convention.md §6` 표에 미포함
- **target 위치**: `codebase/backend/src/modules/executions/executions.service.ts` — 주석 "api-convention §6 — Redis 의존성 장애 = upstream 불가용이므로 502 가 아닌 503"
- **위반 규약**: `spec/5-system/2-api-convention.md §6` HTTP 상태 코드 표 — 503 항목 미포함 (표는 200/201/204/400/401/403/404/409/422/429/500만 열거)
- **상세**: 코드 주석이 spec §6을 503 근거로 인용하지만, 실제 §6 표에는 503이 없다. 엔진 종료(`SERVER_SHUTTING_DOWN`)에서 이미 503을 사용 중이나 spec §6 표에는 미반영. 코드 동작 자체는 올바르고 503은 업계 표준 의미에도 부합한다.
- **제안**: 코드 주석의 spec 인용을 "SERVER_SHUTTING_DOWN 503 선례(§4-execution-engine.md §11) 준용" 으로 수정하거나, spec-sync 시 §6 표에 503 항목을 추가한다.

---

### [INFO] `cancelWaitingExecution` async 전환이 WS protocol spec §4.2 stop ack 표에 미반영
- **target 위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelWaitingExecution` 이 `void` → `Promise<ContinuationPublishResult>` 로 변경
- **위반 규약**: 직접 위반 아님; `spec/5-system/4-execution-engine.md §7.5.2` "4종 continuation 핸들러" 목록에 `cancelWaitingExecution`(REST stop 경로)이 미포함
- **상세**: C-1 변경으로 cancel 도 동일 `ContinuationPublishResult` 계약을 따르게 됐으나, WS/REST protocol spec의 stop ack 표에 `queued:false` → 503 surface 경로가 기술되지 않았다. spec-sync defer 범위 내 사항.
- **제안**: planner spec-sync 에서 `spec/5-system/4-execution-engine.md §7.5` 및 `6-websocket-protocol.md §4.2` stop ack 표에 WAITING 경로 `queued:false` → 503 케이스 추가 반영.

---

## 규약 준수 긍정 확인

- **에러 코드 명명(error-codes.md §1 의미 기반 명명)**: `EXECUTION_ENQUEUE_FAILED` 는 "조건의 의미(무엇이 잘못되었는가)"를 기술한다. 구현 세부(`Redis INCR`, `M-7`)를 이름에 박지 않았다.
- **에러 코드 표기(UPPER_SNAKE_CASE)**: `EXECUTION_ENQUEUE_FAILED` 준수.
- **에러 코드 prefix(error-codes.md §1)**: `EXECUTION_*` 네임스페이스 확장 — `spec/5-system/4-execution-engine.md §7.5.2` "신규 client-safe 코드는 기존 `EXECUTION_*` 네임스페이스를 확장한다" 지침 준수.
- **ErrorCode enum 중앙화**: 인라인 문자열 없이 `ErrorCode.EXECUTION_ENQUEUE_FAILED` 참조 — `error-codes.md §Overview` "인라인 문자열 금지" 준수.
- **파일·식별자 명명**: `cancelWaitingExecution`, `ContinuationPublishResult`, `buildPublishResult` 등 기존 패턴과 일관된 TypeScript camelCase/PascalCase.
- **금지 항목 없음**: conventions에서 명시적으로 금지한 패턴(random fallback seq 제거, fire-and-forget 에러 유실 제거) 방향이 spec §7.4/§9.2 계약과 일치한다.

---

## 요약

이번 C-1+M-7 구현은 `spec/conventions/error-codes.md`의 의미 기반 명명·표기·중앙화 원칙을 올바르게 따른다. 주요 발견은 신규 에러 코드 `EXECUTION_ENQUEUE_FAILED`가 카탈로그 SoT(`spec/5-system/3-error-handling.md §1`)에 등재되지 않은 점(WARNING)이며, 이는 프롬프트에 "에러코드 카탈로그는 sibling planner spec-sync defer"로 이미 인식·계획된 사항이다. 503 HTTP 상태 코드 선택의 spec §6 인용 부정확(INFO)과 WS protocol spec stop ack 케이스 미기술(INFO)도 동일 spec-sync defer 범위다. 코드 자체의 정식 규약 직접 위반은 없다.

## 위험도

LOW
