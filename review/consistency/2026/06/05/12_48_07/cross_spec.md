# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 대상: `spec/5-system/` + `spec/1-data-model.md` (exec-park-durable-resume plan 관련 변경 포함)
검토 기준 커밋: `exec-park-durable-resume` worktree 현행 HEAD

---

## 발견사항

### [WARNING] §1.1 상태 전이 표 — `waiting_for_input → waiting_for_input` self-loop 설명이 Phase B 이후 구 모델 기술을 포함
- target 위치: `spec/5-system/4-execution-engine.md §1.1` 상태 전이 표 L62
- 충돌 대상: 동 파일 §4.x (park 설계 모델) L406, plan `exec-park-durable-resume.md Phase B`
- 상세: L62 의 `waiting_for_input → waiting_for_input` 전이 설명이 "Execution.status enum 자체는 변하지 않고 `pendingContinuations` 가 새 인스턴스에 재등록 (§7.5)" 으로 기술되어 있다. 그러나 §4.x L406 의 구현 메모는 "park 후 `runExecution` 코루틴은 in-process 로 살아 있어 fast-path 로 이어진다" 고 기술하며, plan Phase B 에서는 이 코루틴 누적 모델을 제거하고 "항상 rehydration 일원화" 로 전환할 예정이다. 전이 표의 "pendingContinuations 재등록" 문구는 rehydration(slow-path)을 기술하는 것으로 보이지만 fast-path 가 현재 여전히 존재하는 상황에서 두 모델이 혼재 서술됨 — Phase B 착수 직전 또는 완료 후 명시적 갱신이 필요하다.
- 제안: Phase B 구현 완료 후 L62 설명을 "모든 재개는 rehydration(§7.5) 으로 일원화" 로 갱신. 현재 A3 구현 착수 시점에서는 INFO 수준이나, Phase B 착수 전 반드시 갱신 체크 필요.

### [WARNING] §7.5 rehydration 시퀀스에 `Execution.user_variables` 복원 단계가 명시되어 있으나 A3 구현이 미완료 상태
- target 위치: `spec/5-system/4-execution-engine.md §7.5` L887, §6.2 L729
- 충돌 대상: plan `exec-park-durable-resume.md Phase A3` — `user_variables` 영속 미구현 (`[ ]` 미체크)
- 상세: spec 의 §6.2 저장 전략 표(L729)와 §7.5 rehydration 시퀀스(L887)는 `Execution.user_variables jsonb`(V085) 컬럼을 통한 park-commit 및 rehydration 복원을 이미 기술하고 있다. 그러나 plan Phase A3 는 전 항목이 `[ ]` 로 미완료이며 V085 마이그레이션도 미적용 상태이다. 즉 spec 은 완료된 것으로 기술하나 구현이 따라오지 않은 상태 — spec-impl drift. 이 상태에서 A3 를 착수하면 spec 과 일치시키는 구현이 되므로 drift 가 해소되나, "spec 이 미리 선언한 컬럼을 구현한다" 는 사실이 명시적으로 표시되어야 한다. (V085 마이그레이션 번호 충돌 위험도 확인 필요.)
- 제안: A3 PR 착수 전 V084 기존 마이그레이션 이후 V085 가 비어있는지 확인. 실제 구현 완료 후 plan 항목 체크 + spec frontmatter 갱신. 현재 spec 기술은 A3 구현 방향과 일치하므로 내용 충돌은 없음.

### [WARNING] §4.x 구현 메모 — fast-path(`pendingContinuations`) 와 slow-path 이원화가 spec 에 장기 잔류
- target 위치: `spec/5-system/4-execution-engine.md §4.x` L406 구현 메모 블록
- 충돌 대상: 동 파일 §7.4 L823 "Worker 동작" 표 (fast path 언급), plan Phase B 목표
- 상세: §4.x L406 은 "park 후 코루틴은 in-process 로 살아 있어 fast-path 로 이어진다" 를 현재 모델로 기술하며 "Phase B 에서 slow-path 일원화 예정" 을 병기한다. §7.4 L823 의 "Worker 동작" 표도 "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path)" 를 기술한다. 이 두 위치는 Phase B 완료 후 갱신 대상이나, plan §Spec 변경 항목(L103-L108) 이 해당 섹션을 명시적으로 열거하고 있어 단순 누락은 아니다. 그러나 A3 구현 착수 시점에 spec 을 읽는 개발자가 "현재 모델"과 "목표 모델"을 혼동할 가능성이 있다.
- 제안: Phase B 착수 전 §4.x 구현 메모와 §7.4 Worker 동작 표를 단일 갱신. A3 착수 시점에서는 현행 기술이 A3 범위와 무관하므로 차단은 아님.

### [INFO] §1.1 상태 전이 표 — `waiting_for_input → waiting_for_input` 전이의 D4 turn-unit park 반영 미완
- target 위치: `spec/5-system/4-execution-engine.md §1.1` L60 (transition 표)
- 충돌 대상: plan `exec-park-durable-resume.md D4` (확정: 멀티턴 AI = turn-단위 park)
- 상세: D4(멀티턴 AI = turn-단위 park) 는 2026-06-05 확정 결정이며, plan §Spec 변경 항목 L107 은 "D4 turn-단위 park Rationale 명문화" 를 Phase B 선행 의무 spec 변경으로 명시한다. 현재 §1.1 전이 표는 "AI Agent Multi Turn 대화 턴 대기" 를 waiting_for_input 조건으로 포함하나, turn 마다 park → 해제 → rehydration 이 반복되는 D4 모델은 아직 표에 반영되지 않았다. 이는 Phase B 착수 전 추가해야 할 항목이므로 현재(A3) 단계에서는 차단 사유가 아니지만 sync 포인트로 기록한다.
- 제안: Phase B 착수 직전 spec 변경 시 §1.1 전이 표에 D4 모델 반영 및 Rationale 절 추가.

### [INFO] `spec/1-data-model.md §2.13` — `user_variables` 컬럼 행이 spec 에 선언되어 있으나 plan A3 미체크 상태
- target 위치: `spec/1-data-model.md §2.13 Execution` L2537
- 충돌 대상: plan `exec-park-durable-resume.md Phase A3` `[ ]` 항목 목록
- 상세: 1-data-model.md §2.13 의 `user_variables | JSONB? | ...` 행(L2537)은 이미 spec 에 존재하며 V085 참조를 포함한다. plan A3 는 이 컬럼 생성을 "[ ] 마이그레이션 V085 `Execution.user_variables jsonb NULL`" 로 아직 미완료로 표시한다. 즉 spec 이 미리 작성(pre-declared)된 상태로, 구현이 따라가야 한다. 충돌은 없으나 spec-impl drift 상태임을 명시한다.
- 제안: A3 PR 완료 후 plan 항목 체크 및 spec frontmatter `status` 갱신.

### [INFO] `spec/5-system/4-execution-engine.md §1.1` 상태 전이 표 — `waiting_for_input → failed` 전이와 `waiting_for_input → cancelled` 의 원인 기술 중복
- target 위치: `spec/5-system/4-execution-engine.md §1.1` L61, L63
- 충돌 대상: 동 파일 §7.5 Rehydration 실패 케이스 표 (L907~L911)
- 상세: L63 의 `waiting_for_input → cancelled` 전이 조건에 "rehydration 실패의 단말 케이스" 를 열거하는데, §7.5(L907~911)의 케이스 표와 내용이 부분 중복한다. 두 위치 간 케이스 목록이 완전히 일치하는지 확인이 필요하다 — §1.1 은 `RESUME_CHECKPOINT_MISSING / RESUME_FAILED / RESUME_INCOMPATIBLE_STATE` 세 가지를 열거하고 §7.5 표도 세 가지를 열거하므로 현재는 일치. 단 미래에 케이스가 추가될 때 두 위치를 동시에 갱신해야 하는 단순화 대상.
- 제안: 장기적으로 §1.1 전이 표의 rehydration 케이스를 §7.5 로 포워드 참조만 남기고 목록은 단일화.

---

## 요약

`spec/5-system/` 영역(특히 `4-execution-engine.md` 와 `1-data-model.md §2.13`)은 exec-park-durable-resume plan 의 A1(완료)·A2a/A2b(완료)·A3(진행 중) 단계를 이미 반영하고 있으며 내용 충돌 없이 일관성이 유지된다. 주요 유의 사항은 두 가지다: (1) A3 구현 대상인 `Execution.user_variables`(V085)가 spec 에 이미 선언되어 있어 spec-impl drift 상태이므로 A3 PR 완료 후 plan 항목 체크와 spec `status` 갱신이 필요하다. (2) Phase B(park 즉시 해제 + slow-path 일원화)와 D4(turn-unit park)는 아직 spec 에 미반영 섹션이 남아 있으나 이는 plan 의 의도된 순서(Phase B 착수 전 spec 선행 갱신 의무)에 따른 것으로 A3 착수를 차단하는 CRITICAL 충돌은 없다. 전체적으로 스펙 간 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, RBAC 충돌은 발견되지 않았다.

## 위험도

LOW

STATUS: OK
