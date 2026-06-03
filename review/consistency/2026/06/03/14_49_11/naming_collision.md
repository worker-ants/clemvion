## 발견사항

### 요구사항 ID 충돌

충돌하는 요구사항 ID 없음. target 문서는 별도 요구사항 ID를 신설하지 않는다.

---

### 엔티티/타입명 충돌

- **[INFO]** `NodeExecutionStatus.CANCELLED` — spec 에는 이미 정의, 코드에는 미정의 (일치하는 gap)
  - target 신규 식별자: `NodeExecutionStatus.CANCELLED` (enum 멤버)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/node-cancellation-engine-6bfcaa/codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts` — `NodeExecutionStatus` enum 에는 현재 `PENDING / RUNNING / COMPLETED / FAILED / SKIPPED / WAITING_FOR_INPUT` 6개만 정의되어 있고 `CANCELLED` 멤버가 없다. 반면 `ExecutionStatus` (같은 codebase 의 `execution.entity.ts`) 에는 이미 `CANCELLED = 'cancelled'` 가 존재한다.
  - 상세: 충돌이 아니라 gap. `NodeExecutionStatus` 에 `CANCELLED` 가 누락된 상태이며 target spec 은 이를 추가한다. `ExecutionStatus.CANCELLED` 와 동일 DB 문자열 값(`'cancelled'`)을 사용하는데, 상위(Execution) 와 하위(NodeExecution) 엔티티 간 어휘 재사용이므로 의미 충돌이 아니다. target 의 V069 migration 이 `node_execution.status` CHECK 제약에 `cancelled` 를 추가해야 일관성이 완성된다.
  - 제안: 충돌 없음. 구현 시 `node-execution.entity.ts` 에 `CANCELLED = 'cancelled'` 를 추가하고 V069 migration 작성 절차를 그대로 따른다.

---

### API Endpoint 충돌

신규 endpoint 없음. target 은 spec-only 변경이며 REST 경로를 신설하지 않는다.

---

### 이벤트/메시지명 충돌

- **[WARNING]** `execution.node.cancelled` — spec 에 이미 정의 완료, 코드에는 미구현 (명칭 충돌 없으나 spec 기술 주의)
  - target 신규 식별자: `execution.node.cancelled` (WebSocket 이벤트명)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/node-cancellation-engine-6bfcaa/spec/5-system/6-websocket-protocol.md` line 174 — 이벤트 표에 `execution.node.cancelled` 가 이미 정의되어 있다.
    - `/Volumes/project/private/clemvion/.claude/worktrees/node-cancellation-engine-6bfcaa/spec/5-system/6-websocket-protocol.md` line 757 — 외부 구독 매핑 표에도 존재한다.
    - `/Volumes/project/private/clemvion/.claude/worktrees/node-cancellation-engine-6bfcaa/spec/3-workflow-editor/3-execution.md` line 287, 624 — WS 이벤트 목록·설명에 이미 등장한다.
    - `/Volumes/project/private/clemvion/.claude/worktrees/node-cancellation-engine-6bfcaa/spec/conventions/node-cancellation.md` line 108 — `execution.node.cancelled` WS 이벤트 발행이 명시되어 있다.
  - 상세: spec 6개 파일 모두에 이미 기술되어 있다. 코드에는 해당 emit 코드가 없어(`grep` 결과 0건) target plan 의 구현 영향 섹션이 이를 올바르게 명시하고 있다. 이벤트명 의미 충돌은 없다. 다만, `spec/data-flow/3-execution.md` line 168 의 WS 이벤트 표(`execution.node.started/completed/failed`) 에는 `execution.node.cancelled` 가 누락되어 있어 소규모 spec 내 불일치가 남는다.
  - 제안: 이벤트명 충돌 없음. `spec/data-flow/3-execution.md` line 168 의 이벤트 열거에 `execution.node.cancelled` 를 추가하면 spec 내 일관성이 완성된다.

- **[INFO]** `node.cancelled` (프론트엔드 WS 이벤트 목록 표기) — `execution.node.cancelled` 의 축약 표기
  - target 신규 식별자: `node.cancelled` (spec/3-workflow-editor/3-execution.md WS 이벤트 목록 항목)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/node-cancellation-engine-6bfcaa/spec/3-workflow-editor/3-execution.md` line 624 에는 `execution.node.*` prefix 형태로만 열거한다.
  - 상세: target 이 `node.cancelled` (prefix 없는 형태)를 WS 이벤트 목록에 추가하는 경우, 기존 `execution.node.started/completed/failed/skipped` 항목과 표기 방식이 다르다. line 287 은 이미 `execution.node.cancelled` 전체 이름으로 표기하고 있다.
  - 제안: WS 이벤트 목록에는 일관되게 `execution.node.cancelled` 전체 이름을 사용한다.

---

### 환경변수·설정키 충돌

신규 ENV var 또는 config key 없음.

---

### 파일 경로 충돌

신규 spec 파일 경로 없음. target 은 기존 6개 파일의 내용을 갱신한다.

---

### 마이그레이션 번호 충돌

- **[CRITICAL]** V069 마이그레이션 번호 충돌 가능성
  - target 신규 식별자: `V069__<node_execution_cancelled>.sql` (Flyway 마이그레이션)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/node-cancellation-engine-6bfcaa/plan/complete/eia-distributed-seq-checklist.md` line 64 — "~~V069 migration / seq_counter 컬럼~~ — Redis-only 로 불필요" (해소·취소됨)
    - `/Volumes/project/private/clemvion/.claude/worktrees/node-cancellation-engine-6bfcaa/plan/in-progress/spec-sync-structural-followups.md` line 189 — "V069 이상 마이그레이션에 `ALTER TABLE node ADD CONSTRAINT UQ_node_workflow_label UNIQUE (workflow_id, label);` 추가하거나…" — V069 번호를 `UQ_node_workflow_label` 제약 추가에 쓸 것을 검토 중인 열린 plan 아이템.
  - 상세: 현재 최신 migration 은 `V068__execution_dry_run.sql` 이므로 다음 번호는 V069 이 맞다. `eia-distributed-seq-checklist.md` 의 V069 참조는 Redis-only 결정으로 **이미 취소**되어 실제 충돌 위험이 없다. 그러나 `spec-sync-structural-followups.md` 의 "V069 이상 마이그레이션에 `UQ_node_workflow_label` 추가" 제안이 열린 상태다. 두 plan(node-execution-cancelled + structural-followups)이 V069 를 독립적으로 작성하면 동일 번호 충돌이 발생한다.
  - 제안: target plan 의 V069 가 `node_execution.status` CHECK 에 `cancelled` 를 추가한다. `spec-sync-structural-followups.md` 의 `UQ_node_workflow_label` 제약 추가는 V070 이상을 사용해야 한다. 두 plan 의 담당자 간에 번호 사전 조율이 필요하다.

---

## 요약

target 이 도입하는 신규 식별자(`NodeExecutionStatus.CANCELLED`, `execution.node.cancelled`, `V069 migration`)는 기존 spec·코드의 다른 의미로 사용된 식별자와 직접 충돌하지 않는다. `ExecutionStatus.CANCELLED` 선례와 어휘적으로 일치하는 확장이며, `execution.node.cancelled` WS 이벤트는 이미 여러 spec 파일에 기술되어 있어 신설이 아닌 코드 구현 확정에 가깝다. 단, Flyway V069 번호를 `spec-sync-structural-followups.md` 의 `UQ_node_workflow_label` 제약 추가 아이템도 동일하게 참조하고 있어 두 plan 이 병행 구현되면 마이그레이션 번호가 충돌할 수 있다. 이 지점이 유일한 실질 위험이다.

## 위험도

MEDIUM
