# 신규 식별자 충돌 검토 — spec-draft-exec-park-b2-durable.md

검토 모드: spec draft 검토 (--spec)
대상 문서: `plan/in-progress/spec-draft-exec-park-b2-durable.md`

---

## 발견사항

### 1. INFO — `CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION` — 신규 상수, 충돌 없음

- **target 신규 식별자**: `CALL_STACK_SCHEMA_VERSION`
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `const CHECKPOINT_SCHEMA_VERSION = 1;` 및 "CHECKPOINT_SCHEMA_VERSION 옆에 선언해 checkpoint 스키마 관련 상수를 한곳에" 주석
- **상세**: target spec 초안이 "기존 `CHECKPOINT_SCHEMA_VERSION` 과 독립 — 혼동/coupling 방지(W6)"를 명시한다. 두 상수는 역할이 다르다 — `CHECKPOINT_SCHEMA_VERSION`은 `_resumeCheckpoint` JSONB 스키마 버전, `CALL_STACK_SCHEMA_VERSION`은 `resume_call_stack` JSONB 스키마 버전. 같은 파일 내 선언 예정이나 이름이 구분되어 코드 충돌 없음.
- **제안**: 두 상수를 인접 위치에 선언해 "checkpoint 스키마 관련 상수를 한곳에" 원칙을 유지. spec §1.3 에 독립 상수 선언 주석을 추가(I6)하면 향후 의도가 명확해진다.

---

### 2. INFO — `version` 필드명(call stack JSONB) — `_resumeCheckpoint.schemaVersion`과 별개 JSONB, 충돌 없음

- **target 신규 식별자**: `resume_call_stack JSONB` 내 `{ version: number, frames: ResumeCallStackFrame[] }` 의 `version` 필드
- **기존 사용처**: `execution-engine.service.ts` — `_resumeCheckpoint` JSONB 내 `schemaVersion` 필드 (`buildResumeCheckpoint` 함수 L4526, 버전 검사 L1784 `resumeCheckpoint.schemaVersion`)
- **상세**: target 이 선택한 키 이름 `version`(call stack JSONB)과 기존의 `schemaVersion`(checkpoint JSONB)은 서로 다른 이름이므로 JSONB 내 키 충돌 없음. target spec 초안도 "필드명도 `_resumeCheckpoint.schemaVersion` 과 구분되도록 `version`"이라고 명시한다. 두 JSONB가 서로 다른 컬럼(`NodeExecution.output_data._resumeCheckpoint` vs `Execution.resume_call_stack`)에 속하므로 런타임 혼용 위험도 없음.
- **제안**: rehydration 코드에서 두 버전 필드(`version` vs `schemaVersion`)를 나란히 다루는 경우 혼동이 생길 수 있으므로 spec §Rationale 에 "두 필드명 불일치는 의도적 설계 결정" 1행을 추가하면 후임 개발자 혼선을 방지한다.

---

### 3. INFO — `ResumeCallStackFrame.recursionDepth` — 기존 `Execution.recursionDepth`·`ExecutionContext.recursionDepth` 와 동음이의 잠재

- **target 신규 식별자**: `ResumeCallStackFrame = { workflowId: string, invokerNodeId: string, recursionDepth: number }` 내 `recursionDepth` 필드
- **기존 사용처**:
  - `spec/1-data-model.md §2.13 Execution` 테이블: `recursionDepth Integer` 컬럼 (DB, 루트=0)
  - `spec/conventions/execution-context.md` — `ExecutionContext.recursionDepth`
  - `codebase/backend/src/nodes/core/workflow-executor.interface.ts` L6, L26: `recursionDepth?: number` / `recursionDepth: number`
  - `codebase/backend/src/nodes/core/node-handler.interface.ts` L127: `recursionDepth: number`
  - `execution-engine.service.ts` L2722–L2723, L2984, L3010, L3030: `context.recursionDepth` 갱신·전달 패턴
- **상세**: 같은 이름이지만 의미·범위가 다르다. 기존 `recursionDepth`는 루트 Execution 대비 전체 중첩 깊이(전역 스칼라), `ResumeCallStackFrame.recursionDepth`는 해당 프레임의 깊이 인덱스다. 서로 다른 인터페이스·타입에 속하므로 직접 타입 충돌은 없으나, rehydration 구현에서 두 값이 나란히 쓰일 때 혼동 가능성이 있다.
- **제안**: `frameDepth` 또는 `subworkflowDepth`로 변경하거나, 아니면 spec §6.2/§7.5 에서 두 `recursionDepth`의 의미 차이를 명시적으로 구분해 두는 것을 권장한다. 현재 이름 그대로 유지하려면 구현 코드의 변수명 충돌을 타입 레이어에서 분리(`const { recursionDepth: frameDepth } = frame` 형태)하도록 impl 가이드를 spec 에 추가하면 혼선을 방지할 수 있다.

---

### 4. INFO — `invokerNodeId` — 기존 코드베이스 미존재, 충돌 없음

- **target 신규 식별자**: `ResumeCallStackFrame.invokerNodeId`
- **기존 사용처**: 코드베이스 전체 검색 결과 없음 (`codebase/`, `spec/`, `plan/` 전범위).
- **상세**: 순수 신규 식별자. `Node.id`(UUID) 참조 패턴과 의미적으로 일관적이다. spec 초안에서 "해당 sub-workflow 를 호출한 Workflow 노드의 `Node.id`"로 명확히 정의하고 있다.
- **제안**: 없음. 필요하면 `callerNodeId`가 대안이나 현재 명명이 충분히 명확하다.

---

### 5. INFO — 마이그레이션 번호 `V087` — 현재 최고 V086 다음 번호, 충돌 없음

- **target 신규 식별자**: `V087__execution_resume_call_stack.sql`
- **기존 사용처**: `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` 및 `V086__agent_memory_scope_updated_index.conf` 가 현재 최고 번호. `spec/1-data-model.md §3` 인덱스 표에도 V086 참조 중.
- **상세**: V087 은 기존 V086 의 다음 번호이므로 순번 충돌 없음. target spec 초안이 "현재 next=V087; 최고 V086 #482. 착수 직전 `ls migrations/V08* | tail -2` 재확인"을 명시해 PR race 대비 재검증 절차를 포함하고 있다.
- **제안**: 없음. `spec/conventions/migrations.md §1` 명명 규약(`V{NNN}__{snake_case_descriptor}.sql`)을 준수한다.

---

### 6. INFO — `ResumeCallStackFrame` 타입명 — 기존 코드베이스 미존재, 충돌 없음

- **target 신규 식별자**: `ResumeCallStackFrame` (TypeScript 인터페이스/타입)
- **기존 사용처**: 코드베이스 전체 검색 결과 없음.
- **상세**: 순수 신규 타입명. `Resume` prefix 관용은 코드베이스 내 `_resumeCheckpoint`, `_resumeState`, `rehydrateAndResume` 등에서 일관적으로 사용되므로 명명 패턴에 부합한다. (이전 draft 에서 `Frame`이라는 이름을 사용했으나 현재 target 은 `ResumeCallStackFrame`으로 구체화되어 더 명확하다.)
- **제안**: 없음.

---

### 7. INFO — `resume_call_stack` DB 컬럼 — 기존 spec/코드 미존재, 충돌 없음

- **target 신규 식별자**: `Execution.resume_call_stack jsonb NULL` (DB 컬럼)
- **기존 사용처**: `spec/1-data-model.md §2.13 Execution` 컬럼 표에 없음. `codebase/backend/migrations/` 전체 검색 결과 없음. 기존 유사 컬럼 — `conversation_thread jsonb`(V084), `user_variables jsonb`(V085)는 다른 이름으로 구분된다.
- **상세**: 순수 신규 컬럼. `_continuationCheckpoint` 기각 결정(L1174)과의 범주 차이는 target Rationale 에 명시되어 있다 — continuation 운반이 아닌 park 시점의 중첩 실행 위상 영속으로 직교.
- **제안**: 없음. spec 적용 시 data-model §2.13 컬럼 표에 `conversation_thread`/`user_variables`와 같은 "durable park 스냅샷" 분류로 추가하는 것이 가독성에 유리하다(W1).

---

### 8. INFO — C4 제거 대상 식별자들 — 현재 코드에 존재, 제거 후 재사용 계획 없음

- **target 신규 식별자**: 제거 대상 식별자들(C4) — `pendingContinuations`, `firstSegmentBarriers`, `armFirstSegmentBarrier`, `settleFirstSegment`, `signalParkBarrier`, `firePayload`, `resolvePending`, `rejectPending`
- **기존 사용처**: `execution-engine.service.ts` — `pendingContinuations` Map L732, `firstSegmentBarriers` Map L764, `armFirstSegmentBarrier` L776, `settleFirstSegment` L794, `rejectPending` L2334 (private 메서드), `resolvePending` L2324 (private 메서드). `applyCancellation`·`applyContinuation`·`cancelParkedExecution`·`rehydrateAndResume`은 제거 대상이 아니라 내부 구현만 변경.
- **상세**: 이들은 신규 도입이 아니라 제거 대상이므로 "신규 식별자 충돌" 범주 외이다. 제거 후 같은 이름을 다른 의미로 재사용할 계획이 없음을 확인했다.
- **제안**: 제거 전 테스트·주석·JSDoc에서 이들을 참조하는 dangling reference를 함께 정리할 것. 특히 `continuation-execution.processor.ts` L25 의 `pendingContinuations` 언급 주석도 정리 대상이다.

---

## 요약

target spec draft(`plan/in-progress/spec-draft-exec-park-b2-durable.md`)가 도입하는 신규 식별자 집합(`resume_call_stack` DB 컬럼, `ResumeCallStackFrame` 타입, `CALL_STACK_SCHEMA_VERSION` 상수, `invokerNodeId` 필드, `V087` 마이그레이션, call stack JSONB 내 `version` 필드)은 기존 코드베이스·spec 에 동일 이름으로 다른 의미를 가진 사용처가 없다. 잠재 혼동은 `ResumeCallStackFrame.recursionDepth`가 기존 `Execution.recursionDepth`·`ExecutionContext.recursionDepth`와 같은 이름을 쓰는 점 하나이나, 서로 다른 타입·컬럼 범위에 속해 직접 타입 충돌이 발생하지 않는다. 설계상 의도적 분리(`CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION`, call stack `version` vs checkpoint `schemaVersion`)가 spec 초안에 명시되어 있어 혼선 위험이 낮다. CRITICAL/WARNING 등급 충돌은 발견되지 않았다.

## 위험도

NONE
