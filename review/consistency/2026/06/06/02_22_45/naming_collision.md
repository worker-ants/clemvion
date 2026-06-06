# 신규 식별자 충돌 Check 결과

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-06

---

## 발견사항

### 발견사항 1

- **[CRITICAL]** 마이그레이션 버전 `V086` 이미 점유됨
  - target 신규 식별자: `V086__execution_resume_call_stack.sql` (가칭) — C1 에서 `resume_call_stack jsonb` 컬럼을 추가하는 마이그레이션 파일명
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` + `V086__agent_memory_scope_updated_index.conf` — `agent_memory` 의 `(workspace_id, scope_key, updated_at)` 인덱스(PR #482, agent_memory listScopes). `spec/1-data-model.md §3` 인덱스 표에서도 `(CONCURRENTLY, V086)` 로 명시적 레퍼런스
  - 상세: Flyway 는 버전 번호 유일성을 요구한다. `V086` 이 이미 `agent_memory_scope_updated_index` 로 배포됐으므로, target 이 동일 번호로 새 마이그레이션을 추가하면 Flyway `validate` 단계에서 checksum 불일치(기존 파일) 또는 중복 버전(신규 파일) 으로 배포가 즉시 중단된다. target 문서 본문(C1)에서도 이 충돌을 인지하고 "V087+ 로 renumber 필수" 라고 명시했으나, spec draft 자체는 여전히 `V086` 이름을 사용 중 — spec 에 확정 번호가 기재되지 않아 구현 착수 시 혼선 직결
  - 제안: spec draft 에서 마이그레이션 파일명을 `V087__execution_resume_call_stack.sql` (또는 더 높은 번호, 구현 착수 직전 `ls migrations/V08*` 재확인 후 확정) 으로 정정. 주의 메모(`"가칭"` / `"V086+"` 표기)는 제거하고 확정 번호를 기재한다. `1-data-model.md §2.13 Execution` 컬럼 표에 병기할 마이그레이션 버전도 동일하게 갱신.

---

### 발견사항 2

- **[WARNING]** `schemaVersion` 필드명 — `resume_call_stack` JSONB 내 신규 도입 vs `_resumeCheckpoint` 기존 동명 필드
  - target 신규 식별자: `resume_call_stack` JSONB 의 `{ schemaVersion: number, frames: Frame[] }` 내 `schemaVersion` 필드
  - 기존 사용처: `execution-engine.service.ts:284` `const CHECKPOINT_SCHEMA_VERSION = 1` + `_resumeCheckpoint` 객체의 `schemaVersion` 필드 (spec `spec/5-system/4-execution-engine.md` §1.3, `spec/conventions/node-output.md` §208). 동일 파일 내에서 `resumeCheckpoint.schemaVersion` 으로 읽히는 기존 버전 가드 코드가 존재
  - 상세: 충돌은 아니지만 두 별개 JSONB 객체(`_resumeCheckpoint` vs `resume_call_stack`)가 각각 `schemaVersion` 이라는 동일 필드명으로 버전 관리를 한다. spec 독자나 구현자가 두 `schemaVersion` 의 의미·진화 정책이 같은지(공유 상수 사용 가능한지) 혼동하기 쉽다. `CHECKPOINT_SCHEMA_VERSION` 상수는 `_resumeCheckpoint` 전용이며 `resume_call_stack` 에 그대로 재사용하면 두 스키마 진화가 묶이는 의도치 않은 coupling 이 생긴다
  - 제안: spec draft 에서 `resume_call_stack` 의 `schemaVersion` 이 `_resumeCheckpoint.schemaVersion` 과 **독립 정수**임을 명시(별도 상수 `CALL_STACK_SCHEMA_VERSION` 사용 예정 등). 또는 단순화를 위해 초기 spec 에서 아예 `version: 1` 로 이름을 달리해 구분 가능하게 한다.

---

### 발견사항 3

- **[WARNING]** `Frame` 타입명 — 신규 도입 vs 기존 사용처
  - target 신규 식별자: `Frame = { workflowId: string, invokerNodeId: string, recursionDepth: number }` — `resume_call_stack.frames` 배열의 원소 타입
  - 기존 사용처: codebase 전체 grep 결과 `interface Frame` / `type Frame` 로 명시 export 된 타입은 존재하지 않음. 그러나 `recursionDepth` 는 `node-handler.interface.ts:127`, `workflow-executor.interface.ts:6`, `execution-context.service.ts:24` 등 execution 컨텍스트 인터페이스의 최상위 필드로 이미 쓰임. `Frame` 라는 이름은 spec 레벨에서만 신규이며 코드 레벨에서 충돌 타입 없음
  - 상세: `Frame` 은 JS/TS 생태계에서 stack frame (call stack), video frame, animation frame 등 다의어로 널리 쓰인다. spec 에서 이름 없이 "Frame" 으로 정의하면 구현 시 이름 충돌 여부를 재확인해야 한다. 현재 codebase 에는 동명 export 타입이 없어 즉각 충돌은 아니나, 향후 animation/video/stack-frame 관련 코드 추가 시 혼동 가능
  - 제안: spec 에서 타입명을 `ResumeCallStackFrame` 또는 `CallStackFrame` 으로 명명해 도메인을 명확히 한다.

---

### 발견사항 4

- **[INFO]** `invokerNodeId` 필드명 — 기존 코드 컨벤션과의 정합
  - target 신규 식별자: `Frame.invokerNodeId` — 서브 워크플로를 호출한 Workflow 노드의 ID
  - 기존 사용처: codebase 에서 `invokerNodeId` 표기 없음. 호출 노드는 기존 코드에서 "source_node_id", "node.id", "workflowNodeId" 등으로 문맥별 달리 표기됨
  - 상세: 충돌 없음. 다만 기존 DB 스키마(Edge.source_node_id, NodeExecution.node_id)와의 의미상 연결을 spec 에서 명시하면 구현자가 어느 필드를 읽어 채워야 하는지 명확해짐
  - 제안: spec C1 에 "invokerNodeId = 해당 sub-workflow 를 호출한 Workflow 노드의 `Node.id`" 라고 한 줄 주석 추가.

---

### 발견사항 5

- **[INFO]** `D4`·`D6` 식별자 — plan 내부 레퍼런스 vs 기존 integration spec 내 D4
  - target 신규 식별자: `D4` (멀티턴 turn-단위 park 결정), `D6` (중첩 call stack 영속 결정) — `exec-park-durable-resume.md` plan 의 결정 레이블
  - 기존 사용처: `spec/4-nodes/4-integration/5-makeshop.md` 와 `spec/4-nodes/4-integration/0-common.md` 에서 `D4` 가 "Integration 노드 error port 라우팅 결정" 으로 이미 사용 중 (독립 도메인, 같은 약어)
  - 상세: plan 내부 레퍼런스(D4/D6)는 spec 본문에는 기재되지 않고 plan 파일 안에만 존재하므로 spec 단계 충돌은 아님. 단 plan 간 참조 시 "integration D4 오류 라우팅" 과 "exec-park D4 멀티턴 park" 가 같은 레이블로 혼동될 수 있음
  - 제안: plan 레이블(D4/D6)은 plan 파일 스코프 안에서만 유효한 내부 표기로 취급해 spec 본문에는 기재하지 않음(현 target draft 의 §Rationale 에는 등장 — 이 수준은 허용 범위).

---

## 요약

신규 식별자 충돌 관점에서 가장 심각한 문제는 마이그레이션 버전 충돌이다. `V086` 은 main 브랜치에 이미 `agent_memory_scope_updated_index` 로 배포·등록돼 있으며, target spec draft 가 동일 번호를 `resume_call_stack` 컬럼 추가에 사용하면 Flyway 배포가 즉시 중단된다. draft 문서 자체에서도 충돌을 인지해 "V087+ 로 renumber 필수" 라고 표기했으나 확정 번호가 spec 에 반영되지 않아 혼선이 잔존한다. 나머지 항목(`schemaVersion` 중의성, `Frame` 범용 타입명)은 동일 식별자가 다른 의미로 확정 충돌하는 케이스가 아니라 명명 명확화 권장 수준이며, API endpoint·이벤트·환경변수·파일 경로 차원의 충돌은 발견되지 않았다.

## 위험도

HIGH
