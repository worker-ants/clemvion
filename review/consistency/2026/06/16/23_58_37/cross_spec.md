# Cross-Spec 일관성 검토 — `spec/5-system/4-execution-engine.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-17

---

## 발견사항

### [INFO] `pending_plans` frontmatter 에 완료된 plan 참조 잔존
- target 위치: `spec/5-system/4-execution-engine.md` 1~14행 frontmatter `pending_plans`
- 충돌 대상: `plan/complete/spec-sync-execution-engine-gaps.md` (완료 이동), `plan/in-progress/exec-park-durable-resume.md` (구현 완료 — spec §4.x/§7.4/§7.5 본문이 "구현 완료" 명시)
- 상세: frontmatter 의 `pending_plans` 에 다음 4개가 등록돼 있다.
  1. `plan/in-progress/execution-engine-residual-gaps.md` — 여전히 in-progress (G1/G2/G3 잔여).
  2. `plan/in-progress/spec-sync-execution-engine-gaps.md` — `plan/complete/` 로 이동 완료 (해당 경로 파일 없음).
  3. `plan/in-progress/exec-intake-queue-impl.md` — PR1 완료, PR2b 잔여로 in-progress 유지.
  4. `plan/in-progress/exec-park-durable-resume.md` — 구현 완료(PR-B2b 2026-06-06)이나 plan 파일은 in-progress 에 잔존.
- 제안: `spec-sync-execution-engine-gaps.md` 참조를 frontmatter 에서 제거 (파일 없어 dead link). `exec-park-durable-resume.md` 는 plan lifecycle 규칙에 따라 `plan/complete/` 이동 후 frontmatter 참조 삭제.

---

### [INFO] `Execution.status` enum — data-model 과 execution-engine 간 `skipped` 부재 일치 확인 (정합)
- target 위치: `spec/5-system/4-execution-engine.md §1.1`
- 충돌 대상: `spec/1-data-model.md §2.13`
- 상세: `Execution.status` enum 은 두 spec 모두 `pending / running / completed / failed / cancelled / waiting_for_input` 6종으로 일치한다. execution-engine §1.1 은 `skipped` 가 NodeExecution 전용임을 명시하며, data-model §2.13 의 Execution.status 에도 `skipped` 없음 — 모순 없음.
- 제안: 없음 (일치).

---

### [INFO] `NodeExecution.status` enum — data-model 과 execution-engine 간 일치 확인 (정합)
- target 위치: `spec/5-system/4-execution-engine.md §1.2`
- 충돌 대상: `spec/1-data-model.md §2.14 NodeExecution`
- 상세: 양쪽 모두 `pending / running / completed / failed / cancelled / skipped / waiting_for_input` 7종. `cancelled` 의 정의(`AbortError` 분류)도 data-model §2.14 가 `[node-cancellation §5] / [실행 엔진 §1.2]` 를 교차 참조해 동일 의미로 정렬됨 — 모순 없음.
- 제안: 없음 (일치).

---

### [INFO] BullMQ 큐 3종 — `spec/0-overview.md §2.4` / `§2.6` 과 일치 확인 (정합)
- target 위치: `spec/5-system/4-execution-engine.md §9.3`
- 충돌 대상: `spec/0-overview.md §2.4 Execution Engine`, `§2.6 Data Layer`
- 상세: `execution-run` / `execution-continuation` / `background-execution` 세 큐 모두 overview §2.4 에 명시됨. Redis 의 BullMQ 큐 백엔드 역할도 overview §2.6 에 열거됨 — 모순 없음.
- 제안: 없음 (일치).

---

### [INFO] `active_running_ms` 컬럼 — data-model 과 execution-engine 간 일치 확인 (정합)
- target 위치: `spec/5-system/4-execution-engine.md §8`
- 충돌 대상: `spec/1-data-model.md §2.13 Execution.active_running_ms`
- 상세: data-model 이 `active_running_ms` 컬럼을 정의하고 §8 타임아웃 측정 기준(active 세그먼트 합, `waiting_for_input` 제외)을 주석으로 포함한다. execution-engine §8 의 설명과 완전히 일치 — 모순 없음.
- 제안: 없음 (일치).

---

### [INFO] `Execution.resume_call_stack` (V087) — data-model 과 execution-engine 간 일치 확인 (정합)
- target 위치: `spec/5-system/4-execution-engine.md §6.2`, §7.5`
- 충돌 대상: `spec/1-data-model.md §2.13 Execution.resume_call_stack`
- 상세: data-model §2.13 에 V087 컬럼이 정의돼 있고 execution-engine §6.2 의 `waiting_for_input 진입 시` 저장 전략 표와 §7.5 frame-by-frame 재진입 설명이 일치한다 — 모순 없음.
- 제안: 없음 (일치).

---

### [INFO] `Execution.conversation_thread` / `user_variables` — data-model 과 execution-engine 간 일치 확인 (정합)
- target 위치: `spec/5-system/4-execution-engine.md §6.2`
- 충돌 대상: `spec/1-data-model.md §2.13 Execution.conversation_thread(V084)`, `user_variables(V085)`
- 상세: data-model 이 두 컬럼 모두 정의하고 execution-engine §6.2 의 park commit 표와 의미가 일치한다 — 모순 없음.
- 제안: 없음 (일치).

---

### [INFO] `failed → running` 재진입 전이 — 3-workflow-editor spec 과의 정합 확인
- target 위치: `spec/5-system/4-execution-engine.md §1.1`
- 충돌 대상: `spec/3-workflow-editor/3-execution.md` (실행 상태 참조)
- 상세: execution-engine §1.1 은 `failed → running` 을 `allowRetryReentry` opt-in 전용(AI Agent multi-turn retry)으로 한정한다. 3-execution.md 는 사용자가 직접 관찰하는 실행 상태 목록에서 이 전이를 별도 항목으로 두지 않으므로 사용자 노출 충돌은 없다 — 모순 없음.
- 제안: 없음.

---

### [INFO] `NodeExecution.interaction_data.interactionType` vs `WaitingInteractionType` — data-model 명시적 분리 선언 일치
- target 위치: `spec/5-system/4-execution-engine.md §1.3 interaction.data`
- 충돌 대상: `spec/1-data-model.md §2.14 NodeExecution.interaction_data`
- 상세: data-model §2.14 가 "수행된 user action 기록 enum 과 `WaitingInteractionType` 은 이름만 같고 별개 enum" 임을 명시하고, execution-engine §1.3 의 `interaction.type` 정의와 일치 — 모순 없음.
- 제안: 없음 (일치).

---

### [INFO] Graceful Shutdown Phase 1 범위 — `spec/0-overview.md §2.4` 기술과의 정합
- target 위치: `spec/5-system/4-execution-engine.md §11`
- 충돌 대상: `spec/0-overview.md §2.4 Execution Engine`
- 상세: execution-engine §11 은 Graceful Shutdown Phase 1 (HTTP gate 구현, WS gate 미구현) 범위를 명시 배너로 표기한다. overview §2.4 는 이 세부 구현 상태를 기술하지 않아 직접 충돌 없음.
- 제안: 없음.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 데이터 모델(`spec/1-data-model.md`), 아키텍처 개요(`spec/0-overview.md`), 워크플로우 에디터 실행 스펙(`spec/3-workflow-editor/3-execution.md`) 과의 관계에서 **직접 모순이 발견되지 않는다**. Execution/NodeExecution 상태 머신, BullMQ 큐 3종, durable park 컬럼(V084/V085/V087), active_running_ms 타임아웃 측정 기준 등 핵심 데이터 모델 교차 항목이 모두 정합된 상태다. 유일한 동기화 필요 지점은 frontmatter `pending_plans` 의 dead link (`spec-sync-execution-engine-gaps.md` — 이미 `plan/complete/` 이동) 및 구현 완료된 `exec-park-durable-resume` plan 이 여전히 `in-progress/` 에 잔존하는 관리 비일관성이며, 두 항목 모두 기능 정합성에 영향을 주지 않는 INFO 수준 정비 사항이다. 구현 착수를 차단하는 CRITICAL/WARNING 충돌은 없다.

---

## 위험도

LOW

---

STATUS: OK
