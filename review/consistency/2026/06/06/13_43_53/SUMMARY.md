# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 4건은 spec 갱신 및 Rationale 기록 필요이나 차단 사유에 해당하지 않음.

## 전체 위험도
**MEDIUM** — exec-park PR-B2b(D6 durable resume) 구현은 spec 설계안을 충실히 이행했으나, (1) spec Rationale 가 D6+B3 동시 수행을 명시했는데 B3 가 후속으로 분리됐고, (2) §7.5 알고리즘 기술이 실제 구현(iterative innermost-first)과 달라 두 항목 모두 Rationale/spec 갱신이 필요하다. 나머지는 spec-behind-impl(구현 상태 배너 갱신) 수준이며 명명 충돌은 전무하다.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Rationale Continuity | Rationale 가 PR-B2b 에서 D6+full B3 를 "한 덩어리"로 수행한다고 명시했으나, 구현은 B3(`pendingContinuations`·`firstSegmentBarriers`·`firePayload` 제거)를 `@todo` 로 남겨 분리함 — 번경 근거가 Rationale 에 없음 | `execution-engine.service.ts` `resumeFromCheckpoint` `fireNested` 블록; `NESTED_FIRE_MAX_ATTEMPTS`/`NESTED_FIRE_POLL_MS` 상수 | `spec/5-system/4-execution-engine.md` `## Rationale` §"PR-B2b(중첩 D6 + full B3)" 서술 | Rationale 에 "D6 구현 완료, B3 는 PR-B2c 로 분리" 를 추가하거나 현 PR 에 B3 제거를 포함. project-planner 위임 |
| W2 | Rationale Continuity | spec §7.5 재진입 알고리즘 "outermost→innermost `executeInline` 재귀 호출" 과 구현 "innermost-first `driveResumeFrame` iterative bubble-up" 불일치 — 의도적 변경이나 spec 갱신·Rationale 기록 없음 | `execution-engine.service.ts` `driveCallStackResume` 전체 (innermost frame 직접 처리 후 bubble-up) | `spec/5-system/4-execution-engine.md` §7.5 step 2 "outermost→innermost … executeInline 재호출" | §7.5 step 2 를 실제 구현 알고리즘으로 갱신하거나 Rationale 에 "iterative 채택 이유(스택 깊이 제한·DB lookup 중복 방지 등)" 기록. project-planner 위임 |
| W3 | Cross-Spec / Convention Compliance (통합) | spec 의 "구현 상태" 배너가 exec-park D6 전체(`driveCallStackResume`, park stage, `ParkReleaseSignal`, `executeInline` call-stack)를 "PR-B2 후속 커밋에서 미구현"으로 기재 — spec-impl 단방향 불일치 (`spec-impl-evidence.md` 단일 진실 원칙 위반) | `spec/5-system/4-execution-engine.md` §4.x 배너(line 406), §7.5 note(line 905); `spec/1-data-model.md §2.13` `resume_call_stack` 행(line 467) | 구현 diff (`driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput`, `stageDurableResumeSnapshot`+`snapshotCallStack`, `executeInline` park-release) | spec §4.x·§7.5·Rationale exec-park D6 배너를 "구현 완료(PR-B2b, 2026-06-06)"로 갱신; `spec/1-data-model.md §2.13` `resume_call_stack` 설명 갱신. project-planner 위임 (plan `exec-park-durable-resume.md §PR-B2b 진행 상태` "spec flip(남음)" 항목으로 이미 추적 중) |
| W4 | Cross-Spec / Convention Compliance (통합) | `spec/conventions/execution-context.md` 원칙 4 선례 목록에 신규 `_callStack` 필드 미등재 — 원칙 취지상 도입과 함께 등재 필요 | `codebase/backend/src/nodes/core/node-handler.interface.ts` `_callStack?: ResumeCallStackFrame[]` 추가 | `spec/conventions/execution-context.md` §원칙 4 선례 목록 (`_executedNodes`, `_resumeState`, `_retryState`, `_contextKey`) | 선례 목록에 `_callStack` 항목 추가(용도: 중첩 executeInline 호출 체인 park/재개, 핸들러 비소비 내부 엔진 필드, spec 참조: 4-execution-engine.md §7.5). project-planner 위임 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | spec §7.4 Worker 동작 "worker-side fast-path 제거" 서술이 B3 완료 시점 기준 최종 상태 — 현재는 `pendingContinuations`/`firePayload` 잔존하는 과도기 | `spec/5-system/4-execution-engine.md` §7.4 Worker 동작 (~line 829) | plan `exec-park-durable-resume.md §PR-B2b 진행 상태` "spec flip(남음)"으로 이미 추적 중. 현재 조치 불요 |
| I2 | Cross-Spec | spec §7.5 step 2 "executedNodes DB seed" 서술과 실제 구현(in-memory 누적 전달) 불일치 — crash-restart 시 완료 노드 재실행 가능성 | `execution-engine.service.ts` `driveResumeFrame` (`opts.executedNodes` 직접 주입, DB lookup 없음) | "DB seed vs in-memory 누적 중 어느 쪽이 SoT" 결정 필요. plan `exec-park-durable-resume.md` 에 todo 항목 기록 권장. B3 완료 단계에서 재검토 |
| I3 | Rationale Continuity | `waitForFormSubmission` JSDoc `@todo` 에서 "W15 OCP 약화" 언급이 삭제됨 — B3 가 별도 PR 로 분리되면 추적 가시성 저하 가능 | `execution-engine.service.ts` `waitForFormSubmission` JSDoc | B3 분리 확정 시 plan/in-progress `exec-park-durable-resume.md` 에 OCP 약화 잔여 TODO 명시 |
| I4 | Plan Coherence | target spec `spec/5-system/4-execution-engine.md` 이번 브랜치에서 수정 없음 → spec flip 미포함은 계획된 분리(plan "spec flip(남음, project-planner)" 명시) | `plan/in-progress/exec-park-durable-resume.md §PR-B2b 진행 상태` | PR 머지 후 `spec-draft-exec-park-b2-durable.md` C3/C5 + `spec-update-exec-park-d6-rehydration-step2.md` 일괄 spec flip 시 §7.5 "구현 예정" 표식 제거·step 2 문구 갱신 병행 |
| I5 | Plan Coherence | full B3 미완료·dockerized e2e 미완료 — plan 에 후속 항목으로 추적 중. PR description 에 "step 8(D6) 완료 / B3·e2e·spec flip 은 후속 커밋 계속" 명기 권장 | `plan/in-progress/exec-park-durable-resume.md §B3` | PR description 에 미완 범위 명기 |
| I6 | Plan Coherence | `impl-concurrency-cap-pr2b` worktree 가 `spec/5-system/4-execution-engine.md` 동시 수정 중이나, target 브랜치는 동 파일 수정 없어 이번 PR 에서는 경합 없음 | `plan/in-progress/exec-park-durable-resume.md §진행 메모 W4` | spec flip PR 착수 전 `impl-concurrency-cap-pr2b` rebase 선행 확인(기존 W4 조치 그대로) |
| I7 | Naming Collision | `CALL_STACK_SCHEMA_VERSION`(export)과 `CHECKPOINT_SCHEMA_VERSION`(파일-스코프 비export) 이 둘 다 `= 1` — 의도적 독립 상수이나 이후 버전 비대칭 우려 | `execution-engine.service.ts:289` `CHECKPOINT_SCHEMA_VERSION`; `resume-call-stack.types.ts` `CALL_STACK_SCHEMA_VERSION` | `CHECKPOINT_SCHEMA_VERSION` 도 export 하거나 독립 상수임을 나타내는 주석 추가(INFO, 차단 불요) |
| I8 | Naming Collision | 신규 식별자 전체(`ParkReleaseSignal`, `_callStack`, `invokerNodeId`, `driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput`) — 명명 충돌 없음 | 각 신규 파일·인터페이스·private 메서드 | 조치 불요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec 구현 상태 배너 3곳이 "미구현"으로 잔존(spec-behind-impl). §7.5 executedNodes DB-seed vs in-memory 누적 잠재적 차이. 이미 plan 에서 추적 중. |
| Rationale Continuity | MEDIUM | PR-B2b Rationale 가 D6+B3 동시 수행 명시했으나 B3 미완 — 번경 근거 없음. §7.5 재진입 알고리즘 기술이 실제 구현과 상이 — spec 갱신 불동반. |
| Convention Compliance | MEDIUM | spec-impl-evidence 단일 진실 원칙 위반(구현 상태 배너 미갱신). `execution-context.md` 원칙 4 선례 목록 `_callStack` 미등재. |
| Plan Coherence | LOW | 구현은 plan D6/PR-B2b step 8 항목을 정확히 이행. spec flip·B3·e2e 미완료는 계획된 분리. 타 worktree 경합 없음. |
| Naming Collision | NONE | 신규 식별자 전체 충돌 없음. `CALL_STACK_SCHEMA_VERSION` / `CHECKPOINT_SCHEMA_VERSION` 유사값 INFO 수준. |

---

## 권장 조치사항

1. **(WARNING W1 — Rationale 번경 기록)** `spec/5-system/4-execution-engine.md` `## Rationale` §PR-B2b 서술에 "D6 구현 완료, B3 는 PR-B2c 로 분리" 추가. project-planner 위임. 머지 전 또는 spec flip PR 에서 처리.
2. **(WARNING W2 — §7.5 알고리즘 정정)** `spec/5-system/4-execution-engine.md` §7.5 step 2 를 실제 구현("innermost frame → `driveResumeFrame` + bubble-up iterative")으로 갱신하거나 Rationale 에 iterative 채택 이유 기록. project-planner 위임.
3. **(WARNING W3 — spec 구현 상태 배너 flip)** spec §4.x·§7.5·Rationale exec-park D6 배너 + `spec/1-data-model.md §2.13` `resume_call_stack` 행을 "구현 완료(PR-B2b, 2026-06-06)"로 갱신. plan `exec-park-durable-resume.md §PR-B2b 진행 상태` "spec flip(남음)" 항목 수행. project-planner 위임.
4. **(WARNING W4 — conventions 선례 목록 갱신)** `spec/conventions/execution-context.md` 원칙 4 선례 목록에 `_callStack` 추가(용도·spec 참조·핸들러 비소비 명시). project-planner 위임.
5. **(INFO I2 — executedNodes seed 결정)** `driveResumeFrame` 의 in-memory 누적 전달이 crash-restart 시 완료 노드 재실행을 야기하는지 검토. plan `exec-park-durable-resume.md` 에 todo 기록 권장.
6. **(INFO I5 — PR description)** PR description 에 "step 8(D6) 완료 / B3·dockerized e2e·spec flip 은 후속 커밋에서 동일 worktree 계속 진행" 명기.