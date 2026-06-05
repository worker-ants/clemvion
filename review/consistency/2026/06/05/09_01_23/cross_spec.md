# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 범위: `spec/5-system/` (전체)
검토 기준: `plan/in-progress/exec-park-durable-resume.md` 가 예고하는 변경과 기존 spec 영역 간 충돌 분석

---

## 발견사항

---

### [WARNING] `Execution.conversation_thread` 컬럼이 `spec/1-data-model.md §2.13 Execution` 에 누락

- **target 위치**: `spec/conventions/conversation-thread.md §4` (라인 209, 213), `§8.4` (라인 330), `spec/5-system/4-execution-engine.md §7.5` (라인 883–884)
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution` — `Execution` 엔티티 컬럼 정의 테이블
- **상세**: `conversation-thread.md §4` 는 `Execution.conversation_thread jsonb NULL` 컬럼이 "채택 완료"(`§8.4` Rationale 참조)라고 명시하며, `execution-engine.md §7.5` rehydration 절차도 이 컬럼에서 thread 를 복원하는 단계를 명시한다. 그러나 `spec/1-data-model.md §2.13 Execution` 의 컬럼 목록에는 해당 컬럼이 없다. 데이터 모델 단일 진실(`spec/1-data-model.md`)과 두 개의 운영 spec 사이의 불일치다. 구현자가 마이그레이션을 작성할 때 data-model 만 참고하면 컬럼을 누락할 수 있다.
- **제안**: `plan/in-progress/exec-park-durable-resume.md` Phase A1 구현 전(또는 `project-planner` 가 spec 갱신 시) `spec/1-data-model.md §2.13 Execution` 테이블에 `conversation_thread | JSONB? | park 직전 conversationThread 스냅샷 (durable resume 용). 평상시 NULL. 상세: [Spec Conversation Thread §4](./conventions/conversation-thread.md#4-영속화) · [실행 엔진 §7.5](./5-system/4-execution-engine.md#75-resume-after-restart-rehydration)` 행을 추가한다.

---

### [WARNING] `spec/5-system/4-execution-engine.md §4.x` 의 "현재 재개 경로" 기술이 plan 목표 상태와 혼재

- **target 위치**: `spec/5-system/4-execution-engine.md §4.x` (라인 402–404)
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §B1/B2/B3`
- **상세**: `§4.x` 의 "구현 메모 — 첫 세그먼트 배리어" 블록(라인 402)은 `firstSegmentBarriers`, `armFirstSegmentBarrier`, `settleFirstSegment`, `signalParkBarrier` 를 현행 구현으로 기술한다. 라인 404 의 "현재 재개 경로와 알려진 한계" 블록도 `runExecution` 코루틴이 in-process 로 살아 있는 fast-path 를 현재 상태로 서술한다. plan Phase B 가 완료되면 이 메커니즘 전체(fast-path, 첫 세그먼트 배리어, `pendingContinuations` fast-path 의존)가 제거되거나 강등되므로, B 완료 후 해당 절을 갱신하지 않으면 spec 이 과거 구현 모델을 계속 묘사하는 상태가 된다. 단 이는 "B 완료 후" 갱신 의무의 알림이지, 현재 착수 전 상태에서 모순은 아니다. plan 자체가 이를 인지하고 있다("Spec 변경" 항목).
- **제안**: plan B 완료 시 `spec/5-system/4-execution-engine.md §4.x` 의 "첫 세그먼트 배리어" 구현 메모와 "현재 재개 경로" 블록을 "park 즉시 해제 + slow-path 일원화" 모델로 교체한다. `§7.4` Worker 동작 행의 `pendingContinuations` fast-path 문구도 함께 정정한다(plan "Spec 변경" 항목과 동일). plan 에 spec 갱신 체크박스가 이미 있어 추적 중임을 확인.

---

### [WARNING] `spec/5-system/4-execution-engine.md §7.5` 상태 전이 테이블의 `waiting_for_input → waiting_for_input` self-loop 기술이 plan 완료 후 더 이상 유효하지 않을 수 있음

- **target 위치**: `spec/5-system/4-execution-engine.md §1.1` 상태 전이 테이블 (라인 62)
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §B2` — "재개 = 항상 rehydration"
- **상세**: 현재 상태 전이 테이블(라인 62)의 `waiting_for_input → waiting_for_input` 행 설명: "Execution.status enum 자체는 변하지 않고 `pendingContinuations` 가 새 인스턴스에 재등록(§7.5)." plan B2 에서 fast-path 의존이 제거·강등되면 `pendingContinuations` 재등록 표현이 부정확해진다. slow-path(rehydration) 일원화 이후 이 전이의 기술은 "rehydration 으로 재개 — §7.5 단일 경로" 로 단순화되어야 한다.
- **제안**: plan B 완료 시 §1.1 전이 테이블의 해당 행 설명에서 `pendingContinuations` 재등록 표현을 제거하거나 "rehydration 단일 경로" 로 갱신한다.

---

### [INFO] plan Phase A2 의 `information_extractor` checkpoint 확장 의도가 `spec/5-system/4-execution-engine.md §1.3` 의 "ai_agent 한정" 명시와 충돌 예정

- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` (라인 111–113): `_resumeCheckpoint` 는 "**`ai_agent` 노드 한정**" 으로 명시
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §A2` — "information_extractor 멀티턴도 ai_agent 와 동일하게 checkpoint 저장(현재 ai_agent 한정 여부 확인 후 확장)"
- **상세**: `spec/5-system/4-execution-engine.md §1.3` 과 `spec/4-nodes/3-ai/1-ai-agent.md §703` 등에서 `_resumeCheckpoint` 가 `ai_agent` 한정임을 3곳에 명시한다. plan A2 가 이를 `information_extractor` 로 확장하면 해당 "한정" 문구가 false 가 된다. plan 의 "Spec 변경" 절도 "A2 채택 시 한정 문구 3곳 동기 갱신" 을 의무로 기록하고 있어 인지된 상태이나, 구현 착수 전 시점에서 spec 이 여전히 `ai_agent` 한정 상태이므로 INFO 로 기록한다.
- **제안**: plan A2 구현 전 `project-planner` 가 `spec/5-system/4-execution-engine.md §1.3`, `spec/4-nodes/3-ai/1-ai-agent.md §703` 의 "ai_agent 한정" 표현을 갱신한다. 3곳 목록은 plan "Spec 변경" 항목 참조.

---

### [INFO] `spec/1-data-model.md §2.13 Execution` 의 `pending_plans` frontmatter 에 `exec-park-durable-resume.md` 미등록

- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` — 현재 `exec-park-durable-resume.md` 포함 확인
- **충돌 대상**: `spec/1-data-model.md` — frontmatter `pending_plans:` 없음
- **상세**: `spec/5-system/4-execution-engine.md` 의 frontmatter 에는 `plan/in-progress/exec-park-durable-resume.md` 가 이미 등록되어 있다. 그러나 본 plan 의 Phase A1 은 `Execution.conversation_thread` 컬럼을 추가하는 데이터 모델 변경을 수반하므로 `spec/1-data-model.md` 의 frontmatter 에도 `pending_plans:` 로 등록되어야 한다. 현재 `spec/1-data-model.md` 에는 frontmatter 자체가 없다.
- **제안**: `spec/1-data-model.md` 에 frontmatter 를 추가하거나, `spec/conventions/spec-impl-evidence.md` 의 연동 추적 방식을 통해 data-model 변경이 plan 과 연결됨을 명시한다.

---

### [INFO] `spec/5-system/4-execution-engine.md §4.x` 구현 메모와 plan Phase 0 흡수 대상(`exec-intake-queue PR3`)의 rehydration 범위 확장이 중복 진술됨

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md §Phase 0`
- **충돌 대상**: `plan/in-progress/exec-intake-queue-impl.md` (PR3 항목)
- **상세**: exec-park-durable-resume.md §Phase 0 가 exec-intake-queue PR3(rehydration 일반화 + 멱등 재개)를 본 worktree 로 흡수하기로 결정했다. `spec/5-system/4-execution-engine.md §4` 구현 상태 banner 는 아직 `exec-intake-queue-impl.md` 를 `pending_plans:` 로 등록한 채 두 plan 이 별개인 것처럼 기술한다. Phase 0 흡수가 실행되면 `exec-intake-queue-impl.md` 의 PR3 항목이 이관됨을 `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에도 반영해 혼선을 방지할 필요가 있다. 현재는 중복 추적 위험(INFO).
- **제안**: Phase 0 완료 시 `plan/in-progress/exec-intake-queue-impl.md` PR3 이관 표기 작업과 동시에 `spec/5-system/4-execution-engine.md` frontmatter 의 `pending_plans:` 도 정합하게 갱신한다.

---

## 요약

본 검토 대상(`spec/5-system/`)은 `plan/in-progress/exec-park-durable-resume.md` 가 제안하는 "park 즉시 해제 + slow-path 일원화 + resume 상태 durable 영속" 변환과 전반적으로 정합하다. 가장 실질적인 위험은 `spec/1-data-model.md §2.13 Execution` 에 `Execution.conversation_thread` 컬럼이 누락된 것(WARNING)으로, `conversation-thread.md §4/§8.4` 와 `execution-engine.md §7.5` 에서 이미 "채택 완료"로 선언된 컬럼이 데이터 모델 단일 진실에 반영되어 있지 않아 구현자가 마이그레이션 작성 시 누락할 수 있다. 두 번째 WARNING 은 plan B 완료 후 `§4.x` 의 첫 세그먼트 배리어/fast-path 구현 메모가 과거 모델을 계속 서술하게 되는 미래 drift 예고이며, plan 자체가 이를 인지하고 spec 갱신 체크박스로 추적 중이다. CRITICAL 수준의 직접 모순은 발견되지 않았다.

---

## 위험도

MEDIUM

---

STATUS: OK
