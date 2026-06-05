# Cross-Spec 일관성 검토 결과

**Target**: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
**검토 모드**: spec draft (--spec)
**검토일**: 2026-06-06

---

## 발견사항

### 1. 데이터 모델 충돌

- **[INFO]** `resume_call_stack` 컬럼이 `1-data-model.md §2.13 Execution` 컬럼 표에 아직 없음
  - target 위치: C1 — `Execution.resume_call_stack jsonb NULL` 신규 컬럼 정의
  - 충돌 대상: `spec/1-data-model.md §2.13 Execution` 컬럼 표 (현재 `conversation_thread`·`user_variables` 까지만 기술, V084/V085 기반)
  - 상세: target 은 C5 에서 spec 적용 시 동기화를 명시하고 있으며, W1 항목(spec 적용 시 챙길 동기화)에서 §1-data-model §2.13 컬럼 행 추가를 요건으로 기술하고 있다. draft 자체가 "적용 전제(W3)" 로 PR-B2 코드와 동시 랜딩 조건을 명시하므로 현 시점의 미기재는 설계 의도된 상태다. spec 적용 시 반드시 §2.13 에 행 추가가 필요하다.
  - 제안: spec 적용(PR-B2 머지) 시 `1-data-model.md §2.13` 에 `resume_call_stack jsonb NULL` 행을 `user_variables` 아래에 추가할 것. 마이그레이션 참조 V087 도 병기.

- **[INFO]** `ResumeCallStackFrame.workflowId` 필드명이 기존 엔진 규약의 `__workflowId` 변수명과 상이
  - target 위치: C1 — `ResumeCallStackFrame = { workflowId: string, invokerNodeId: string, recursionDepth: number }`
  - 충돌 대상: `spec/5-system/4-execution-engine.md §6.1` — `context.variables.__workflowId` 가 내부 시스템 변수 키
  - 상세: frame 의 `workflowId` 는 JS 객체 필드명이고, `__workflowId` 는 ExecutionContext.variables 의 시스템 예약 키다. 충돌이 아니라 레이어가 다른 별개 개념이지만, 혼동 방지를 위해 target 의 Rationale 또는 §6.2 commit 목록에 "frame.workflowId = 호출된 sub-workflow 의 workflowId (정의 ID), context.variables.__workflowId 와 레이어가 다름" 주석이 있으면 좋다.
  - 제안: spec 작성 시 주석 1줄로 구분 명시.

---

### 2. API 계약 충돌

- **[INFO]** `driveResumeDetached`/`resumeFromCheckpoint` detached 제거 서술이 §7.5 rehydration 다이어그램과 완전 동기화 필요
  - target 위치: C4 — `resumeFromCheckpoint`/`driveResumeDetached` 도 detached(`void` + firePayload) 제거 → 직접 await
  - 충돌 대상: `spec/5-system/4-execution-engine.md §7.5` rehydration 흐름 다이어그램 (현재 `driveResumeDetached` 함수명 언급 없음)
  - 상세: §7.5 는 rehydration 경로를 코드 레벨 함수명 없이 흐름으로 기술하므로 직접 모순은 없다. 그러나 target C4 에서 "detached 제거 → 직접 await" 로 바꾸는 변경이 §7.5 의 rehydration 트리를 구조적으로 변경한다면(예: `void` 리턴 → `await` Promise) spec 에 반영이 필요하다.
  - 제안: spec 적용 시 §7.5 의 rehydration 흐름 다이어그램에 "직접 await 구동" 단계가 명시되어 있는지 확인하고 필요 시 보강.

---

### 3. 요구사항 ID 충돌

해당 없음. target draft 는 새 요구사항 ID(NAV-*, ED-*, ND-* 형식)를 부여하지 않고 내부 설계 결정(C1~C5, D4/D6) 코드를 사용한다. 타 spec 과 ID 충돌 없음.

---

### 4. 상태 전이 충돌

- **[WARNING]** §6.2 저장 전략 커밋 목록에 `resume_call_stack` 항목 누락
  - target 위치: C3/C5 — park 시 `resume_call_stack` 영속(C1)을 상태전이 트랜잭션과 원자 commit 으로 정의. C5 에서 §6.2 저장 전략에 `resume_call_stack` 추가를 동기화 항목으로 명시
  - 충돌 대상: `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표 — `waiting_for_input 진입 시` 행의 commit 대상이 현재 `NodeExecution.outputData + Execution.conversation_thread + Execution.user_variables` 이며, `resume_call_stack` 이 없음
  - 상세: target 이 "spec 적용 시 §6.2 commit 목록 + §1-data-model §2.13 컬럼 행 동시 추가(W1)" 를 체크리스트에 포함하고 있어 의도는 분명하나, spec 적용 이전까지 §6.2 는 `resume_call_stack` 언급이 없으므로 과도기에 spec↔구현 역전이 발생할 수 있다. PR-B2 코드 머지와 동시 갱신이 전제(W3)이므로 순간적 역전은 허용 범위 내다.
  - 제안: PR-B2 spec 적용 PR 에서 §6.2 표의 `waiting_for_input 진입 시` 행에 `Execution.resume_call_stack` 을 추가. 중첩 park 시에만 비NULL 이라는 조건도 병기.

- **[INFO]** §7.5 rehydration 에 중첩 call-stack 재진입 절차 미포함
  - target 위치: C3/C5 — `resume_call_stack IS NOT NULL` → 재귀 프레임 재진입 절차 추가 명시(W4)
  - 충돌 대상: `spec/5-system/4-execution-engine.md §7.5` rehydration 흐름 (현재 단일 레벨 park 재개만 기술)
  - 상세: 현 §7.5 는 top-level waiting node 에 대한 단일 경로만 기술. target C3 가 "call stack 을 읽어 top-level → 각 sub-workflow 프레임을 재귀적으로 재진입" 하는 중첩 재개 경로를 추가하므로, 해당 분기가 §7.5 에 반영되어야 한다. target C5/W4 에서 이를 동기화 요건으로 명시했으므로 인식은 있음.
  - 제안: spec 적용 시 §7.5 에 "resume_call_stack IS NOT NULL 인 경우: 프레임 스택을 outermost → inner 순으로 순회, 각 프레임에서 executeInline 재호출, 최내층 WAITING NodeExecution 에 payload 전달" 절차를 추가.

---

### 5. 권한·RBAC 모델 충돌

해당 없음. target 의 변경 범위(실행 엔진 내부 park/resume 메커니즘 + DB 컬럼)는 RBAC 계층과 교점이 없다.

---

### 6. 계층 책임 충돌

- **[WARNING]** C3 의 중첩 sub-workflow durable park 가 `executeInline` 의 "sync = in-process 반환" 계약과의 긴장 관계 미명시
  - target 위치: C3 — `executeInline` 내 blocking(form/button/AI)도 park-release + rehydration 재개
  - 충돌 대상: `spec/4-nodes/2-flow/1-workflow.md §4` — sync 모드 정의: `executeInline(...)` → 반환값을 `output: { result: <inlineResult> }` 으로 1단 래핑; `spec/5-system/4-execution-engine.md §4.2` — "한 세그먼트 = 한 워커 프로세스, in-process dispatch loop"
  - 상세: 현 workflow node spec(§4) 은 sync `executeInline` 이 "즉시 반환" 하는 것으로 기술되어 있으며, 내부에서 park 가 발생할 가능성을 명시하지 않는다. target C3 는 `executeInline` 이 내부에서 blocking → park 할 수 있다고 정의한다. 이 경우 `executeInline` 은 즉시 반환하지 않고 PARK_RELEASED sentinel 을 상위 `runNodeDispatchLoop` 로 버블업한다는 계약 변경이 암묵적으로 포함된다. workflow node spec 에 "sub-workflow 내 blocking 노드가 park 시 executeInline 호출 스택도 park-return 함" 명시가 없어 계층 책임 서술이 불완전하다.
  - 제안: spec 적용 시 `spec/4-nodes/2-flow/1-workflow.md §4` 실행 로직에 "sync 모드에서 sub-workflow 내부 blocking 노드가 park 할 경우 executeInline 도 PARK_RELEASED 로 반환하고, 상위 세그먼트가 park 로 종료된다(C3/D6)" 주석 추가. workflow node 의 출력이 park 전까지는 비확정임을 명시.

- **[INFO]** C4 에서 제거되는 `pendingContinuations`·`firstSegmentBarriers` 일가가 §7.4 Worker 동작 표에 여전히 과도기 서술로 언급
  - target 위치: C4 — `pendingContinuations` Map · `resolvePending` · `rejectPending` · `firstSegmentBarriers` 등 전면 제거
  - 충돌 대상: `spec/5-system/4-execution-engine.md §7.4 Worker 동작` 표 L829 — "멀티턴 AI 잠정 경로 rejectPending 단서" 가 현재 잔존
  - 상세: PR-B1 완료 후 현 spec 에 L829 에 "멀티턴 AI 한정으로 잠정 잔존(in-memory 코루틴)" 표기가 존재한다. target C5 에서 "PR-B2 완료 → 해당 단서 제거"를 명시하고 있어 의도는 분명하다. 단 "spec 적용 전 코드 머지" 시나리오에서 구현과 spec 이 과도기 역전 상태가 되므로 W3 조건이 중요하다.
  - 제안: PR-B2 spec 적용 시 §7.4 의 `pendingContinuations` 관련 과도기 서술을 모두 제거 완료형으로 대체. target C5 가 이를 이미 명시함.

---

### 7. 마이그레이션 번호 확인

- **[INFO]** V087 마이그레이션 번호 확정 근거 이중 확인
  - target 위치: C1 — "현재 최고 V086 #482 → next V087 확정"
  - 충돌 대상: 실제 migrations 디렉토리 — `V086__agent_memory_scope_updated_index.sql` + `.conf` 가 현재 최고
  - 상세: 파일 시스템 확인 결과 `V086` 이 실제 최고 버전이며 target 의 "V087" 확정은 올바르다. 모순 없음.

---

### 8. `_continuationCheckpoint` 기각 결정과의 직교성

- **[INFO]** `resume_call_stack` 과 §Rationale L1174 `_continuationCheckpoint` 기각의 구분이 target Rationale 에만 있고 기존 spec 에는 미기재
  - target 위치: Rationale — "W2: `_continuationCheckpoint` 컬럼 신설 기각(L1174)과의 구분"
  - 충돌 대상: `spec/5-system/4-execution-engine.md §Rationale L1174` — `_continuationCheckpoint` 컬럼 신설 기각 결정
  - 상세: target 은 `resume_call_stack` 이 기각된 `_continuationCheckpoint` 의 재도입이 아님을 Rationale 에서 명시한다. 해당 구분 주석은 spec 적용 시 기존 §Rationale 에 추가하는 것으로 명시되어 있다(target Rationale 끝단). 충돌이 아니라 기존 기각 결정을 보강하는 형태로 직교. 단, 기존 기각 결정 근처에 "D6 `resume_call_stack` 은 호출 체인 위상 영속이며 continuation 운반 컬럼과는 다른 범주" 주석이 spec 적용 전까지 없으면 독자가 혼동할 수 있다.
  - 제안: spec 적용 시 §Rationale 의 `_continuationCheckpoint` 기각 결정 항목 바로 다음에 W2 구분 주석을 삽입.

---

### 9. `CHECKPOINT_SCHEMA_VERSION` vs `CALL_STACK_SCHEMA_VERSION` 독립성

- **[INFO]** 두 버전 상수의 독립성이 기존 spec 에 미기재
  - target 위치: C1 — `version: CALL_STACK_SCHEMA_VERSION` (기존 `CHECKPOINT_SCHEMA_VERSION` 과 독립 — 혼동/coupling 방지)
  - 충돌 대상: `spec/5-system/4-execution-engine.md §1.3` — `CHECKPOINT_SCHEMA_VERSION` 이 단일 버전 상수로 정의됨
  - 상세: 현재 spec 에는 `CHECKPOINT_SCHEMA_VERSION` 하나만 언급. target 이 call stack 에 별도 상수(`CALL_STACK_SCHEMA_VERSION`)를 두는 것은 기존 상수와 독립적이라 모순 없음. 단, 기존 §1.3 서술에 "call stack 버전 상수는 별도" 주석이 없어 나중에 읽는 사람이 혼동할 수 있다.
  - 제안: spec 적용 시 §1.3 (또는 §C1 설명) 에 "resume_call_stack 의 schema version 은 CALL_STACK_SCHEMA_VERSION 독립 상수 — CHECKPOINT_SCHEMA_VERSION 과 별도로 진화" 주석 추가.

---

### 10. 컨테이너 body blocking 금지(§3.2)와 C3 의 제약 유지 선언 일치 확인

- **[INFO]** target 이 "§3.2 금지 그대로" 를 명시하므로 기존 spec 과 모순 없음
  - target 위치: C3 — "컨테이너(Loop/ForEach/Map/Parallel) body 의 blocking 은 §3.2 금지 그대로 — 따라서 영속할 iteration/branch 상태 없음(선형 call stack 만)"
  - 충돌 대상: `spec/5-system/4-execution-engine.md §3.2` body 서브그래프 제약 — "blocking 노드(form / buttons / ai_conversation) 금지"
  - 상세: target 이 명시적으로 컨테이너 body blocking 금지를 유지한다고 선언. 따라서 `resume_call_stack` 의 선형 call stack 전제(sub-workflow 호출 체인만)는 기존 §3.2 와 정합. 모순 없음.

---

## 요약

target draft 는 기존 `spec/**` 와 직접 모순되는 CRITICAL 항목이 없다. 주요 발견은 두 개의 WARNING — (1) §6.2 저장 전략 표의 `resume_call_stack` 커밋 항목 미기재, (2) sync `executeInline` 의 park-return 계약 변경이 `spec/4-nodes/2-flow/1-workflow.md §4` 에 미반영 — 이다. 두 WARNING 모두 target 자체가 "spec 적용 시 챙길 동기화" 체크리스트(W1/W4, C5)에 명시하고 있어 인식은 있으나, 실제 spec 갱신 PR 에서 누락될 위험이 있다. INFO 항목들은 spec 적용 시 주석·표 행 추가로 해소 가능하며, 모두 target 의 Rationale 또는 W 항목에서 이미 처리 대상으로 인지되고 있다. 마이그레이션 번호(V087), `CHECKPOINT_SCHEMA_VERSION` 독립성, `_continuationCheckpoint` 기각 결정과의 구분은 실제 충돌이 아니라 보강 주석 수준이다.

---

## 위험도

**LOW**

STATUS: OK
