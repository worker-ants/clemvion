# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (--impl-done, diff-base=origin/main)  
실제 변경 파일: `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`  
변경 성격: Phase A3 — user-defined variables durable park 영속 + rehydration 복원 (V085 migration)

---

## 발견사항

- **[INFO]** `Execution.user_variables` 컬럼 신설 — Rationale 항목 부재
  - target 위치: `spec/5-system/4-execution-engine.md` §6.2 표 ("waiting_for_input 진입 시" 행) + §7.5 rehydration 다이어그램 (lines 887-888), `spec/1-data-model.md` (`user_variables` 행)
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §8.4` — "`Execution.conversation_thread` 컬럼 채택 — durable park resume" 에서 "신규 컬럼 없음" 원칙을 번복하며 `conversation_thread` 컬럼을 도입할 때 "기각한 대안 — derived-view 재구성" 항목을 포함한 전용 Rationale 섹션을 작성했다. 같은 원칙 번복(신규 컬럼 신설)이 A3 에서 `user_variables` 컬럼에 재발생하지만 대응되는 Rationale 항목이 없다.
  - 상세: `conversation_thread` 컬럼 도입 시 별도 Rationale 섹션에서 (a) 기각 대안(derived-view 재구성), (b) 원칙 적용 범위 분리("실행 이력 재구성 목적과 durable in-flight resume 목적을 분리"), (c) Execution 레벨 단일 컬럼을 선택한 이유가 명기됐다. `user_variables` 는 plan 문서(`exec-park-durable-resume.md` §A3)에 "복원 필요·SMALL scope·A1 패턴 재사용"으로 결정 근거가 기록되어 있으나, `spec/5-system/4-execution-engine.md` 의 `## Rationale` 섹션에는 이 결정의 근거 항목이 없다. spec 내 Rationale 공백이므로 미래 독자가 "왜 별도 컬럼인가 / 기각된 대안은 무엇인가"를 파악하기 어렵다.
  - 제안: `spec/5-system/4-execution-engine.md ## Rationale` 에 "user-defined variables durable 영속 — `Execution.user_variables` 컬럼 채택 (A3)" 항목을 추가한다. 최소 내용: (a) park 중 변수 손실의 운영 영향(Variable Declaration 이후 park → 재개 시 `$var.X` 손실), (b) `conversation_thread` 패턴 재사용 근거(동일 신설 컬럼 필요), (c) 기각 대안("Redis context에만 의존 — 인스턴스 재시작 시 변수 소실" 기각 사유). plan 문서에 있는 결정 근거를 spec Rationale 로 이전하면 된다.

- **[INFO]** `§7.5` 재구성 다이어그램의 "Redis 우선" 문구와 durable 컬럼 우선 관계 — 서술 순서 불명확
  - target 위치: `spec/5-system/4-execution-engine.md` §7.5 lines 885-890
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §8.4` — "`Execution.conversation_thread` 컬럼에 commit 하고 rehydration 이 여기서 무손실 복원"이 인스턴스 재시작 후에도 보장되는 durable invariant로 확립되어 있다. 이 invariant는 Redis 상태와 독립이어야 한다.
  - 상세: 다이어그램에서 line 885-888(`conversation_thread`/`user_variables` 컬럼 복원)이 line 889-890(Redis 우선 `ExecutionContext` 재구성)보다 먼저 나열되어 있고, 줄 끝에 "thread/variables 는 위 컬럼에서 복원됨" 괄호가 있다. 구현 의도상 durable 컬럼 복원은 Redis context 복원과 무관하게(병렬·선행) 수행되지만, 다이어그램 서술 순서가 "Redis 우선" 다음에 "위 컬럼에서 복원됨" 괄호를 두어 Redis context 가 살아있을 때 컬럼 복원이 무시될 수 있다고 읽힐 여지가 있다. 실제로는 그렇지 않지만 서술이 모호하다.
  - 제안: §7.5 다이어그램 내 해당 줄을 "ExecutionContext 재구성 (Redis context 가 살아있으면 그것 우선, 없으면 DB 에서 복원. **단 thread/variables 는 Redis 상태와 무관하게 항상 위 전용 컬럼에서 복원됨**)" 으로 명시해 durable 컬럼 복원이 Redis 우선 결정과 직교함을 명확히 한다.

---

## 요약

본 브랜치의 실제 spec 변경(Phase A3 — `user_variables` durable park)은 기존 Rationale 에서 **명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하지 않는다**. `conversation_thread` 컬럼 도입 시 확립된 "신규 컬럼 신설로 durable resume 매체 제공" 패턴을 그대로 재사용하며, §7.5 재구성 순서도 durable 컬럼 우선 복원을 구조적으로 따른다. 다만 두 가지 INFO 수준의 보완 사항이 있다 — `user_variables` 컬럼 도입 결정의 근거가 plan 문서에만 있고 spec Rationale 에 없어 추후 독자 접근성이 낮은 점, 그리고 §7.5 다이어그램에서 "Redis 우선"과 durable 컬럼 복원의 관계가 서술상 모호한 점이다. 두 항목 모두 기능 정합성 문제는 아니며 Rationale 문서화 품질 개선 수준이다.

## 위험도

LOW
