# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`

변경된 spec 파일:
- `spec/5-system/4-execution-engine.md`
- `spec/4-nodes/6-presentation/0-common.md`
- `spec/data-flow/3-execution.md`

---

### 발견사항

이 브랜치의 diff 를 기준으로, 기존에 없던 식별자는 아래와 같다.

- **[INFO]** `PARK_RELEASED` — spec 에 처음 등장하는 내부 Symbol 명
  - target 신규 식별자: `PARK_RELEASED` (Symbol, `spec/5-system/4-execution-engine.md` §Rationale 내 `runNodeDispatchLoop` 반환 계약 설명)
  - 기존 사용처: origin/main spec 에 없음. 코드베이스(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L270)에는 이미 `const PARK_RELEASED = Symbol('park_released')` 로 존재하며 코드와 spec 이 일치한다.
  - 상세: 충돌 없음. spec 이 코드를 추적하는 SPEC-DRIFT 형태이며, 다른 어떤 spec 에서 동일 명칭으로 다른 의미를 정의한 사례가 없다.
  - 제안: 현행 유지.

- **[INFO]** `cancelParkedExecution` — spec 에 처음 등장하는 private 메서드 명
  - target 신규 식별자: `cancelParkedExecution` (`spec/5-system/4-execution-engine.md` §7.4 Worker 동작 셀, PR-B1 취소 경로 설명)
  - 기존 사용처: origin/main spec 에 없음. 코드베이스(`execution-engine.service.ts` L1072)에 `private async cancelParkedExecution` 이미 존재하며 코드와 spec 이 일치한다.
  - 상세: 충돌 없음. 다른 spec 에서 동일 명칭을 다른 의미로 쓰는 사례 없다.
  - 제안: 현행 유지.

- **[INFO]** `runNodeDispatchLoop` 반환 타입 변경 — `Promise<void>` → `Promise<{ parked: boolean }>`
  - target 신규 식별자: `{ parked: boolean }` 반환 타입 (`spec/5-system/4-execution-engine.md` §Rationale)
  - 기존 사용처: origin/main spec 에는 `runNodeDispatchLoop` 의 반환 타입 명시가 없음. 코드베이스에서 이미 구현 완료.
  - 상세: spec 이 코드를 따라온 SPEC-DRIFT 형태로 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `### park 즉시 해제 + slow-path 일원화 (Phase B)` — 새 Rationale 섹션 제목
  - target 신규 식별자: Rationale 섹션 앵커 (`spec/5-system/4-execution-engine.md` Rationale 하위)
  - 기존 사용처: origin/main 의 Rationale 에 없는 섹션. origin/main 에는 "Durable Continuation" / "Execution 시간 제한" / "Execution-Level 큐" 등이 있으나 동일/충돌 제목 없음.
  - 상세: 고유 섹션 제목이며 기존 Rationale 섹션과 이름 충돌 없음.
  - 제안: 현행 유지.

**변경 없음 확인 (origin/main 에 이미 정의된 식별자):**

| 식별자 | 확인 위치 (origin/main) |
|--------|------------------------|
| `Execution.conversation_thread` (V084) | `spec/1-data-model.md` L465, `spec/conventions/conversation-thread.md` §4/§8.4 |
| `Execution.user_variables` (V085) | `spec/1-data-model.md` L466 |
| `RESUME_CHECKPOINT_MISSING` | `spec/5-system/3-error-handling.md` L92, `spec/5-system/6-websocket-protocol.md` L296 |
| `RESUME_FAILED` | `spec/5-system/6-websocket-protocol.md` L297 |
| `RESUME_INCOMPATIBLE_STATE` | `spec/5-system/6-websocket-protocol.md` L298 |
| `EXECUTION_MAX_ACTIVE_RUNNING_MS` | `spec/5-system/4-execution-engine.md` (origin/main) §11 환경변수 표 |
| `EXECUTION_RUN_WORKER_CONCURRENCY` | `spec/5-system/4-execution-engine.md` (origin/main) §11 환경변수 표 |
| `CONTINUATION_WORKER_CONCURRENCY` | `spec/5-system/16-system-status-api.md` L23, `spec/5-system/4-execution-engine.md` §11 |
| `execution.user_message` (WS 이벤트) | `spec/5-system/6-websocket-protocol.md` L180 |
| `EXECUTION_TIME_LIMIT_EXCEEDED` | `spec/5-system/3-error-handling.md` L60 |
| `driveResumeDetached` | origin/main codebase (spec 에 새 명시 추가됐으나 기존 구현과 일치) |

---

### 요약

이번 브랜치(`exec-park-durable-resume`)의 spec 변경(Phase B — park 즉시 해제 + slow-path 일원화)에서 신규로 spec 에 등장하는 식별자는 `PARK_RELEASED`, `cancelParkedExecution`, `{ parked: boolean }` 반환 계약, 새 Rationale 섹션 제목 4건이며, 이들은 모두 이미 구현된 코드에서 가져온 것이고 기존 spec 에서 다른 의미로 사용 중인 동일 명칭이 없다. `Execution.conversation_thread`, `Execution.user_variables`, 각종 `RESUME_*` 에러 코드, 환경변수 등 주요 식별자는 origin/main 에 이미 정의되어 있어 신규 도입에 해당하지 않는다. 의미 충돌이나 혼선 가능성이 있는 식별자는 발견되지 않았다.

---

### 위험도

NONE

---

STATUS: SUCCESS
