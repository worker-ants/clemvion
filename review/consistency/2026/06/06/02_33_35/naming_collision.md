# 신규 식별자 충돌 검토 — spec-draft-exec-park-b2-durable.md

검토 모드: spec draft 검토 (--spec)
대상 문서: `plan/in-progress/spec-draft-exec-park-b2-durable.md`

---

## 발견사항

### 1. INFO — `CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION` — 신규 상수, 충돌 없음
- **target 신규 식별자**: `CALL_STACK_SCHEMA_VERSION`
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L284 — `const CHECKPOINT_SCHEMA_VERSION = 1;` (및 L297 주석 "CHECKPOINT_SCHEMA_VERSION 옆에 선언해 checkpoint 스키마 관련 상수를 한곳에")
- **상세**: target spec 초안은 C1 에서 "기존 `CHECKPOINT_SCHEMA_VERSION` 과 독립 — 혼동/coupling 방지"를 명시하고 있어 설계 의도가 분명하다. 두 상수는 역할이 다르다 (`CHECKPOINT_SCHEMA_VERSION`은 `_resumeCheckpoint` JSONB 스키마 버전, `CALL_STACK_SCHEMA_VERSION`은 `resume_call_stack` JSONB 스키마 버전). 동일 파일 내 선언되나 이름이 구분되어 코드 충돌은 없다.
- **제안**: 두 상수를 같은 파일의 인접 위치에 선언해 "checkpoint 스키마 관련 상수를 한곳에" 원칙(L297 주석)을 유지할 것. 정합성을 위해 spec §6.2 commit 목록에 두 상수의 선언 위치를 명기 권장.

---

### 2. INFO — `version` 필드명 — `_resumeCheckpoint.schemaVersion` 과 동일 필드명, 다른 JSONB 컬럼
- **target 신규 식별자**: `resume_call_stack JSONB` 내 `{ version: number, frames: ResumeCallStackFrame[] }` 의 `version` 필드
- **기존 사용처**: `execution-engine.service.ts` L4363–L4378 — `_resumeCheckpoint` JSONB 내 `schemaVersion` 필드 (`buildResumeCheckpoint` 함수). L1784 `const ckptVersion = resumeCheckpoint.schemaVersion;`
- **상세**: target 이 선택한 키 이름 `version`(call stack JSONB 내부)과 기존의 `schemaVersion`(checkpoint JSONB 내부)은 서로 다른 이름이므로 JSONB 내 충돌은 없다. target spec 초안도 "필드명도 `_resumeCheckpoint.schemaVersion` 과 구분되도록 `version`"이라고 명시한다. 다만 두 JSONB 가 서로 다른 컬럼(`NodeExecution.output_data._resumeCheckpoint` vs `Execution.resume_call_stack`)에 속하므로 런타임 혼용 위험은 없다.
- **제안**: rehydration 로직에서 두 버전 필드를 모두 다루는 코드가 나란히 등장할 수 있으므로, 네이밍 불일치(`schemaVersion` vs `version`)를 의도적 설계 결정으로 spec §Rationale 에 1행 추가해 두면 향후 혼선을 방지한다.

---

### 3. INFO — `recursionDepth` — `ResumeCallStackFrame` 내 필드명, 기존 `Execution.recursionDepth`·`ExecutionContext.recursionDepth` 와 동음이의 잠재
- **target 신규 식별자**: `ResumeCallStackFrame = { workflowId: string, invokerNodeId: string, recursionDepth: number }` 내 `recursionDepth` 필드
- **기존 사용처**:
  - `spec/1-data-model.md §2.13 Execution` 테이블: `recursionDepth Integer` 컬럼 (DB level, 루트=0)
  - `spec/conventions/execution-context.md` L29: `ExecutionContext.recursionDepth`
  - `spec/4-nodes/2-flow/1-workflow.md` L99, L103–L107: 재귀 깊이 전달 인자
  - `codebase/backend/src/nodes/core/workflow-executor.interface.ts` L6, L26: `recursionDepth?: number`
  - `codebase/backend/src/nodes/core/node-handler.interface.ts` L127: `recursionDepth: number`
- **상세**: 같은 이름이지만 의미·범위가 다르다. 기존 `recursionDepth`는 루트 Execution 대비 전체 중첩 깊이(전역 스칼라), `ResumeCallStackFrame.recursionDepth`는 특정 프레임의 깊이 인덱스다. 타입 안전 측면에서 서로 다른 인터페이스에 속하므로 직접 충돌은 없다.
- **제안**: 이름이 동일해 rehydration 코드에서 혼동이 생길 가능성이 있다. `frameDepth` 또는 `subworkflowDepth`로 변경하거나, 아니면 spec 에서 두 `recursionDepth`의 의미 차이를 §6.2/§7.5 에 명시하는 것을 권장.

---

### 4. INFO — `invokerNodeId` — 기존 코드베이스 미존재, 충돌 없음
- **target 신규 식별자**: `ResumeCallStackFrame.invokerNodeId`
- **기존 사용처**: 코드베이스 전체 검색 결과 없음.
- **상세**: 순수 신규 식별자. 기존 `Node.id`(UUID) 참조 패턴과 의미적으로 일관적이다.
- **제안**: spec 에서 "해당 sub-workflow 를 호출한 Workflow(sub-workflow) 노드의 `Node.id`"라고 명확히 정의하고 있어 충분하다. 구현 시 `workflowNodeId` 또는 `callerNodeId` 를 대안으로 검토할 수 있으나 spec 용어가 명확하므로 변경 필수는 아님.

---

### 5. INFO — 마이그레이션 번호 `V087` — 기존 V086 과 순번 연속, 충돌 없음
- **target 신규 식별자**: `V087__execution_resume_call_stack.sql`
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` 가 현재 최고 번호. spec/1-data-model.md §3 및 spec/5-system/17-agent-memory.md 도 V086 을 참조 중.
- **상세**: V087 은 기존 V086 의 다음 번호이므로 순번 충돌 없음. target spec 초안도 "현재 최고 V086 #482 → next V087 확정" 으로 명시하고 있어 정합하다.
- **제안**: 없음. 마이그레이션 규약(`spec/conventions/migrations.md`) 네이밍 패턴 (`V{NNN}__{description}.sql`)을 준수한다.

---

### 6. INFO — `ResumeCallStackFrame` 타입명 — 기존 코드베이스 미존재, 충돌 없음
- **target 신규 식별자**: `ResumeCallStackFrame` (TypeScript 인터페이스/타입)
- **기존 사용처**: 코드베이스 전체 검색 결과 없음. 유사 이름(`ResumeCheckpoint`, `ResumeState` 등) 도 직접 일치 없음.
- **상세**: 순수 신규 타입명. `Resume` prefix 관용은 코드베이스 내 `_resumeCheckpoint`, `_resumeState`, `rehydrateAndResume` 등에서 일관적으로 사용되므로 명명 패턴이 부합한다.
- **제안**: 없음.

---

### 7. INFO — C4 제거 대상 식별자들 (`pendingContinuations`, `firstSegmentBarriers`, `armFirstSegmentBarrier`, `settleFirstSegment`, `signalParkBarrier`, `firePayload`, `resolvePending`, `rejectPending`, `driveResumeDetached`) — 현재 코드에 존재, 제거 후 충돌 해소
- **target 신규 식별자**: 제거 대상 (C4)
- **기존 사용처**: `execution-engine.service.ts` — `pendingContinuations` L732, `firstSegmentBarriers` L764, `armFirstSegmentBarrier` L776, `settleFirstSegment` L794, `driveResumeDetached` L1912, `rejectPending` L1046 (applyCancellation 내 분기), `resolvePending` L1023 (applyContinuation 내 fast-path), `firePayload`·`signalParkBarrier`는 코멘트·추상 개념 수준.
- **상세**: 이들은 신규 도입이 아니라 제거 대상이므로 "신규 식별자 충돌" 범주에 해당하지 않는다. 다만 제거 후 같은 이름을 다른 의미로 재사용할 계획이 없음을 확인했다. `applyContinuation`·`applyCancellation`·`resumeFromCheckpoint` 자체는 유지되며 내부 구현만 변경된다.
- **제안**: 제거 전 해당 식별자들을 참조하는 테스트·주석·JSDoc을 함께 정리해 dangling reference를 막을 것.

---

### 8. INFO — `stageDurableResumeSnapshot` — 기존에 이미 정의된 메서드, 신규 도입이 아님
- **target 신규 식별자**: `stageDurableResumeSnapshot` (C2 에서 "후속 turn 에도 매번" 적용 언급)
- **기존 사용처**: `execution-engine.service.ts` L3660, L5288, L6276, L8819 — 이미 정의·사용 중인 private 메서드.
- **상세**: target spec 이 새로 도입하는 식별자가 아니라 기존 메서드를 확장(적용 시점 확대)하는 것이다. 충돌 없음.
- **제안**: 없음.

---

### 9. INFO — `handleAiMessageTurn`, `runAiConversationLoop`, `finalizeAiNode` — 기존 존재, 동의어 충돌 없음
- **target 신규 식별자**: C2 에서 언급되는 `handleAiMessageTurn`, `runAiConversationLoop`, `finalizeAiNode`
- **기존 사용처**: `execution-engine.service.ts` — `runAiConversationLoop` L5009 (private 메서드), `finalizeAiNode` 다수 참조, `handleAiMessageTurn` L4935 주석/호출.
- **상세**: 기존 메서드들. target spec C2 는 `runAiConversationLoop` 의 내부 루프 제거를 설계하는 것이므로 메서드 자체 이름은 유지되거나 리팩터링 범위 내 변경된다. 신규 식별자 충돌 아님.
- **제안**: 없음.

---

## 요약

target spec draft (`spec-draft-exec-park-b2-durable.md`) 가 도입하는 식별자 집합(`resume_call_stack` DB 컬럼, `ResumeCallStackFrame` 타입, `CALL_STACK_SCHEMA_VERSION` 상수, `invokerNodeId` 필드, V087 마이그레이션)은 기존 코드베이스·spec 에 동일 이름으로 다른 의미를 가진 사용처가 없다. 동음이의 잠재 우려는 `ResumeCallStackFrame.recursionDepth` 가 기존의 `Execution.recursionDepth`·`ExecutionContext.recursionDepth` 와 같은 이름을 쓰는 점 하나이나, 서로 다른 타입·컬럼 범위에 속해 타입 충돌이 발생하지 않는다. 설계상 의도적 분리(`CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION`, `version` vs `schemaVersion`)도 spec 초안에 명시되어 있어 혼선 위험이 낮다. CRITICAL/WARNING 등급 충돌은 발견되지 않았다.

## 위험도

NONE

STATUS: OK
