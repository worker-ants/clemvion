# 요구사항(Requirement) Review

리뷰 대상: `exec-park-durable-resume` PR-B2 prep — `resume_call_stack` 컬럼 인프라 (V087 마이그레이션 + 엔티티 + 타입), plan/spec 문서 갱신, consistency-check 산출물.

---

## 발견사항

### [CRITICAL] `resume_call_stack` 컬럼이 `spec/1-data-model.md §2.13 Execution` 표에 누락

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/1-data-model.md` §2.13 Execution 컬럼 표 (line ~466)
- **상세**: V087 마이그레이션(`V087__execution_resume_call_stack.sql`)과 `execution.entity.ts` 에 `resume_call_stack JSONB NULL` 컬럼이 추가됐다. 그러나 spec `1-data-model.md §2.13 Execution` 컬럼 표에는 해당 행이 없다. `conversation_thread`(V084, L465)·`user_variables`(V085, L466)는 표에 등재되어 있으나 `resume_call_stack`(V087)은 미등재. spec-draft(`plan/in-progress/spec-draft-exec-park-b2-durable.md` C1)가 이 갱신을 "동반 적용"으로 명기했지만, 실제 spec 파일은 갱신되지 않은 채 코드(마이그레이션+엔티티)만 추가된 상태다.
- **판단**: 코드가 맞고 spec 이 아직 반영되지 않은 SPEC-DRIFT 가 아니라, spec draft 에서 명시적으로 "C1 data-model 갱신 필수"로 요구한 사항이 미실행된 누락이다 — spec draft 자체(C1 "data-model §2.13 병기 번호도 동일")가 권위이며 코드와 spec 이 불일치한다.
- **제안**: `spec/1-data-model.md §2.13 Execution` 컬럼 표에 `conversation_thread`·`user_variables` 행 바로 다음에 다음 행 추가:
  `resume_call_stack | JSONB? | NULL 허용 (V087). 중첩 sub-workflow(executeInline) blocking 노드 park 시 executeInline 호출 체인(outermost→waiting inner 직전)을 durable commit하는 매체. rehydration(§7.5)이 이 스택으로 최내층 WAITING 노드까지 재귀 재진입. NULL = top-level park / park 이력 없음 / 배포 이전 row. 스키마: { version, frames: [{ workflowId, invokerNodeId, recursionDepth }] }`

---

### [CRITICAL] `resume_call_stack` 영속·재개 절차가 `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표에 미반영

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md` §6.2 저장 전략 (line ~733)
- **상세**: §6.2의 `waiting_for_input 진입 시` 저장 항목 표에 `conversation_thread`와 `user_variables`는 항목으로 기술되어 있으나, `resume_call_stack` 영속이 누락되어 있다. 또한 §7.5 rehydration 절차에 "resume_call_stack IS NOT NULL → 재귀 프레임 재진입" 단계가 없다. spec-draft C1("§6.2 저장 전략: durable park 스냅샷에 `resume_call_stack` 추가") 및 C3("§7.5 rehydration: 재귀 call-stack 재진입 절차 추가")가 이를 요구했으나 spec 본문에 미반영.
- **판단**: 코드(migration + entity + types)가 `resume_call_stack` 인프라를 준비했으나 spec §6.2/§7.5는 아직 이를 모른다. spec draft 가 이 갱신을 C1·C3으로 명시 요구했으므로 단순 SPEC-DRIFT가 아니라 PR 범위 내 명시 의무 미완성.
- **제안**: spec-draft C1/C3/C5 갱신(§6.2 저장 표 + §7.5 rehydration 절차)을 현 PR 커밋에 포함하거나, 이 PR이 인프라 선행이고 C2/C3/C4 구현 PR에서 spec 반영을 동반할 계획이면 plan에 해당 조건을 명시한다.

---

### [WARNING] `CALL_STACK_SCHEMA_VERSION` 상수가 `execution-engine.service.ts`에 미선언

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` (line 32–33)
- **상세**: 타입 파일 JSDoc이 "`CALL_STACK_SCHEMA_VERSION`(execution-engine.service.ts, `CHECKPOINT_SCHEMA_VERSION` 과 독립 상수)으로 스탬프된다"고 기술하나, 실제 `execution-engine.service.ts`에는 `CHECKPOINT_SCHEMA_VERSION = 1`만 있고 `CALL_STACK_SCHEMA_VERSION`이 선언되지 않았다. spec-draft C1도 "별도 상수 `CALL_STACK_SCHEMA_VERSION`"을 명시했고, consistency-check naming_collision 02_43_56에서 INFO로 "두 상수를 인접 위치에 선언" 권고했지만 실제 구현에 없다.
- **판단**: 현 단계에서 `resumeCallStack` 필드가 실제로 읽히거나 쓰이는 코드가 없으므로(엔티티·마이그레이션·타입만 추가, 엔진 로직은 PR-B2 미착수) 런타임 에러는 없다. 그러나 타입 문서와 실제 상수 부재의 괴리는 향후 구현자를 혼동시킨다.
- **제안**: `execution-engine.service.ts` 에 `const CALL_STACK_SCHEMA_VERSION = 1;` 을 `CHECKPOINT_SCHEMA_VERSION` 바로 옆에 선언. 또는 PR-B2 구현 단계에서 추가한다면 plan에 명기.

---

### [WARNING] [SPEC-DRIFT] `spec/5-system/4-execution-engine.md §4.x` 배너 — "PR-B2 미적용" 상태 기술이 이 PR의 코드 변경(V087 인프라 추가)과 시제 불일치

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md` line ~406–408
- **상세**: §4.x 배너가 "단계 적용 현황(2026-06-06) — PR-B1(form/button) 완료, PR-B2(멀티턴 AI) 미적용"으로 기술되어 있다. 이 PR이 PR-B2의 인프라 준비(V087 마이그레이션, 엔티티, 타입)를 포함하나 핵심 로직(장수 루프 제거, call stack 영속, rehydration 재귀 재진입)은 미구현이다. 따라서 "PR-B2 미적용" 표현 자체는 현재 상태를 정확히 반영한다. spec drift는 없다.
- **판단**: spec이 현 상태를 올바르게 기술하고 있음. SPEC-DRIFT 아님, INFO에 가깝지만 향후 실제 PR-B2 로직 구현 시 배너를 완료형으로 전환해야 함을 명시한다.
- **제안**: 없음 (현재 정확). PR-B2 로직 구현 시 spec-draft C5 절차에 따라 배너 완료형 전환.

---

### [WARNING] `driveResumeDetached` / `resumeFromCheckpoint`가 중첩 sub-workflow(executeInline) 경우를 처리하지 않음 — D6 미구현 인식 명시 필요

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `driveResumeDetached`(line ~1912), `resumeFromCheckpoint`(line ~1744)
- **상세**: V087 마이그레이션과 엔티티로 `resume_call_stack` 컬럼을 추가했지만, `driveResumeDetached`·`resumeFromCheckpoint`에는 `execution.resumeCallStack`를 읽어 프레임을 재귀 재진입하는 로직이 없다. spec-draft C3이 "재개 시: `driveResumeDetached`/`resumeFromCheckpoint` 가 call stack 을 읽어 top-level → 각 sub-workflow 프레임을 재귀적으로 재진입"을 명시했다. 현재 중첩 sub-workflow에서 park 후 continuation이 도착하면 `resumeCallStack`을 무시하고 flat 재개를 시도한다.
- **판단**: 이 PR이 인프라(컬럼)만 추가하는 선행 단계이고 실제 로직은 PR-B2 로직 구현 단계에서 추가한다면, 현재 상태에서는 중첩 sub-workflow blocking이 실제로 기능하지 않는다. plan에 이 미구현 범위가 명시되어 있으면 WARNING(미완성 인프라 추가)으로 유지; 아니면 CRITICAL.
- **제안**: `plan/in-progress/exec-park-durable-resume.md`의 해당 Phase에 "V087 컬럼은 인프라 선행, `driveResumeDetached` call-stack 재귀 재진입 로직은 B2 로직 구현 단계" 명시. 또는 `TODO: PR-B2 call-stack 재귀 재진입 구현 필요` 주석을 `driveResumeDetached` 상단에 추가.

---

### [INFO] `ResumeCallStackFrame.invokerNodeId` 의미가 엔티티 주석과 타입 JSDoc 간 미세 서술 차이

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` (line 132–136); `execution.entity.ts` (line 82–94)
- **상세**: `resume-call-stack.types.ts` JSDoc에서 `invokerNodeId`는 "이 sub-workflow 를 호출한 부모 그래프의 Workflow(sub-workflow) 노드 `Node.id`"로 정의된다. spec-draft C1도 "invokerNodeId = 해당 sub-workflow 를 호출한 Workflow(sub-workflow) 노드의 `Node.id`"로 동일하게 정의. 엔티티 주석에는 `invokerNodeId` 언급이 없다. 충돌 없음.
- **제안**: 없음.

---

### [INFO] `plan/in-progress/spec-draft-exec-park-b2-durable.md` frontmatter 존재 확인 — 이미 해소됨

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/plan/in-progress/spec-draft-exec-park-b2-durable.md` line 1–5
- **상세**: consistency-check `02_33_35` 라운드에서 CRITICAL로 분류했던 "plan frontmatter 누락" 이슈가 실제 파일에는 `worktree: exec-park-durable-resume`, `started: 2026-06-06`, `owner: planner` frontmatter가 존재한다. 이미 해소된 상태이며 build guard 위반 없음.
- **제안**: 없음 (해소 확인).

---

### [INFO] `spec/5-system/13-replay-rerun.md §14.3` D3 단서 갱신 — 이번 PR에서 반영됨

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/13-replay-rerun.md` line ~192
- **상세**: consistency-check `01_19_37` W1이 요구한 "D3 fresh-per-turn 전파(§14.3)"가 이번 diff(파일 40)에서 반영됐다 — "frozen snapshot 의 적용 범위는 한 turn 으로 한정된다 — D3(fresh-config-per-turn)에 따라 …" 문구 추가. 충족 확인.
- **제안**: 없음.

---

### [INFO] `spec/5-system/4-execution-engine.md §6.3` Multi-turn resume 표 행 갱신 — 이번 PR에서 반영됨

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/5-system/4-execution-engine.md` line ~2228 (diff 파일 41)
- **상세**: §6.3 표의 Multi-turn resume 행에 "frozen 범위 = 한 turn — D3, §6.1 rawConfig snapshot 정책·§Rationale" cross-ref가 추가됐다. consistency-check W1 요구사항 충족.
- **제안**: 없음.

---

## 요약

이번 변경은 `resume_call_stack` 컬럼의 **인프라 선행 추가**(V087 마이그레이션 + 엔티티 + 타입 정의)와 spec/plan 문서 갱신(§13-replay-rerun D3 전파, §4.x 배너 현황 반영, §6.3 표 갱신)을 포함한다. 기능 완전성 관점에서 Critical 문제가 2건 있다: (1) `resume_call_stack` 컬럼이 `spec/1-data-model.md §2.13`에 누락되어 있어 spec-draft C1의 명시 요구사항이 미이행됐고, (2) spec `§6.2` 저장 전략과 `§7.5` rehydration 절차에 `resume_call_stack` 영속·재개 절차가 미반영됐다. 이 두 Critical 항목은 spec-draft가 이 PR에서 동반 적용을 요구한 항목이다. `CALL_STACK_SCHEMA_VERSION` 상수 미선언(Warning)과 `driveResumeDetached` call-stack 재귀 재진입 미구현(Warning — 인프라 선행 단계면 plan 명시로 수용 가능)도 주의 필요. 일관성 검토(consistency-check) 산출물 자체는 요구사항에 맞게 생성됐으며, §13·§6.3 spec 갱신은 이번 PR에서 충실히 반영됐다.

---

## 위험도

**HIGH** — spec §2.13/§6.2/§7.5 미갱신(Critical 2건)으로 spec↔구현 역전이 발생. 코드 인프라 자체는 정합하나 spec 단일 진실 원칙 위반.
