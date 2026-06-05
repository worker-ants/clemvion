# Cross-Spec 일관성 검토 결과

**검토 모드**: --impl-done (구현 완료 후 검토)
**검토 범위**: `spec/5-system/` (Phase A1·A2a·A2b·A3 구현 완료 시점)
**검토 기준**: spec/5-system/ 내 변경분이 기존 spec 다른 영역과 충돌하는지

---

## 발견사항

### [INFO] `spec/5-system/4-execution-engine.md §1.1` 상태 전이표 — `waiting_for_input → waiting_for_input` self-loop 서술이 Phase B 이후 제거 대상임을 명시하지 않음
- **target 위치**: `spec/5-system/4-execution-engine.md §1.1` 허용 상태 전이표 `waiting_for_input → waiting_for_input` 행 ("다른 인스턴스에서 재개 (rehydration) — Execution.status enum 자체는 변하지 않고 `pendingContinuations` 가 새 인스턴스에 재등록 (§7.5)")
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §B2·§B3` — Phase B 완료 후 `pendingContinuations` fast-path 가 제거되고 모든 재개가 slow-path rehydration 으로 일원화된다. `pendingContinuations` 재등록 개념 자체가 사라지는 설계 변경이다.
- **상세**: 현재 §1.1 서술은 "pendingContinuations 가 새 인스턴스에 재등록" 이라고 기술하는데, 이는 Phase B 이후 더 이상 사실이 아니게 된다. spec 이 in-flight 구현 상태를 반영하는 과도기 메모를 포함하고 있으므로 Phase B 착수 전 갱신 의무가 명확히 표시되지 않으면 Phase B 구현자가 혼동할 수 있다.
- **제안**: Phase B 착수 전 플래너가 §1.1 `waiting_for_input → waiting_for_input` 행을 "rehydration slow-path (pendingContinuations 제거 후)" 로 갱신. 현재는 plan 의 "Spec 변경" 항목에 §7.4 서술 정정만 포함되어 있으며 §1.1 전이표는 미포함 — 갱신 대상 목록에 추가 권장.

---

### [INFO] `spec/5-system/4-execution-engine.md §4.x` 구현 메모 — Phase B 이후 제거될 `firstSegmentBarriers`·detach 코루틴 서술이 spec 본문에 남아 있음
- **target 위치**: `spec/5-system/4-execution-engine.md §4.x` 구현 메모 블록("첫 세그먼트 배리어(`firstSegmentBarriers`)") 및 "현재 재개 경로와 알려진 한계" 블록
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §B1·§B3` — `firstSegmentBarriers`·`armFirstSegmentBarrier`·`settleFirstSegment`·`signalParkBarrier` 전체와 detach 코루틴 패턴이 Phase B 에서 제거 대상이다.
- **상세**: spec §4.x 의 "구현 메모" 블록이 Phase B 이후 obsolete 가 될 내용을 현재 구현 사실로 상당히 상세하게 기술하고 있다. plan 의 "Spec 변경" 절에는 §4.x 갱신이 포함되어 있으나("'park 즉시 해제 + slow-path 일원화' 로 구현 모델 갱신"), spec 내에 해당 메모가 "Phase B 이후 갱신 예정" 임을 표시하는 마커가 없어 현재 spec 독자가 이 내용을 확정 설계로 오인할 수 있다.
- **제안**: §4.x 의 두 구현 메모 블록에 "(Phase B 로 대체 예정 — `plan/in-progress/exec-park-durable-resume.md §B1/§B3`)" 인라인 주석 추가, 또는 plan 의 spec 변경 목록에 §1.1 전이표와 §4.x 메모 블록을 명시적으로 추가. 현재 plan §Spec 변경 항목("§7.4: Worker 동작 행의 '로컬 pendingMap 즉시 resolve(fast-path)' 서술 정정")이 §4.x 메모 블록을 암묵적으로 포함한다고 해석할 수 있으나 명시적이지 않다.

---

### [INFO] `spec/5-system/4-execution-engine.md §7.5` — "case 1: 로컬 pendingMap 키 있음 → 즉시 resolve (fast path)" 서술이 Phase B 이후 제거 대상임을 식별하지 않음
- **target 위치**: `spec/5-system/4-execution-engine.md §7.5` 재개 흐름 다이어그램 내 "case 1: 로컬 pendingMap 키 있음 → 즉시 resolve() (fast path — §7.4)" 분기
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §B2` — "continuation 처리(`applyContinuation`)에서 fast-path(`pendingContinuations.has`) 제거 또는 '같은 프로세스 우연 생존 시 순수 최적화'로 강등(의존 금지). 모든 재개가 `execution-continuation` job → `rehydrateAndResume` 로 일원화."
- **상세**: §7.5 흐름 다이어그램의 case 1 / case 2 분기는 Phase B 이후 case 1 이 제거(또는 순수 최적화로 강등)될 예정이다. spec 이 현재 fast-path 를 주요 경로로 명시하는 구조인데 이 변경이 plan 에 기술되어 있다. plan 의 "Spec 변경" 절에 §7.5 갱신("case 1 (fast-path) 문구 동반 정정")이 포함되어 있으나, 현재 spec 에서 이를 예고하는 표시가 없다.
- **제안**: INFO 수준 — Phase B 착수 전 spec 갱신이 plan 에 이미 정식으로 포함되어 있으므로 충돌은 아니다. plan 체크리스트의 적절한 위치에 §7.5 case 1 분기 다이어그램 갱신을 명시적 항목으로 추가하면 누락 위험이 감소한다.

---

### [INFO] `spec/5-system/4-execution-engine.md §7.4` — "라우팅 원칙: 자기 인스턴스의 `pendingContinuations` 에 키가 있어도 마찬가지 — 항상 BullMQ enqueue" 와 "Worker 동작: 로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve" 간 내부 긴장
- **target 위치**: `spec/5-system/4-execution-engine.md §7.4` 라우팅 원칙 / Worker 동작 행
- **충돌 대상**: `plan/in-progress/exec-park-durable-resume.md §B2` — Phase B 에서 fast-path 가 제거되거나 의존 금지(순수 최적화로 강등)된다.
- **상세**: 현재 §7.4 는 라우팅 원칙("항상 BullMQ enqueue")과 Worker 동작("로컬 pendingContinuations 에 키가 있으면 즉시 resolve") 이 공존한다. Phase B 이후 Worker 동작 행의 fast-path 절이 삭제 또는 "키가 있으면 최적화로 즉시 resolve 가능하나 의존 경로로 간주하지 않음"으로 약화되어야 한다. plan "Spec 변경" 절에 §7.4 갱신이 포함되어 있으므로 충돌 수준 이슈는 아니나, 동일 섹션 내 두 진술 간 긴장이 현재 spec 을 정확히 독해하기 어렵게 한다.
- **제안**: 현 §7.4 Worker 동작 행에 "(Phase B 이후 fast-path 제거 예정 — `plan/in-progress/exec-park-durable-resume.md §B2`)" 주석 추가 권장. 또는 plan §Spec 변경 항목 기술 강화.

---

### [INFO] `spec/1-data-model.md §2.13` Execution.`conversation_thread` 및 `.user_variables` 컬럼 — 다른 spec 영역과의 참조 일관성
- **target 위치**: `spec/1-data-model.md §2.13` Execution 엔티티 필드 목록 (`conversation_thread`, `user_variables` 컬럼)
- **충돌 대상**: `spec/5-system/4-execution-engine.md §6.2/§7.5`, `spec/conventions/conversation-thread.md §4/§8.4`
- **상세**: `spec/1-data-model.md §2.13` 에 두 컬럼이 등재되어 있고 각각 V084/V085 마이그레이션과 연결된 상세 설명이 있다. 스펙 내 cross-reference 가 일관되게 기술되어 있으며(실행 엔진 §6.2/§7.5 와 conversation-thread §4/§8.4 양쪽에서 참조), 이 부분의 충돌은 발견되지 않았다. Phase A1·A3 에서 동기 갱신이 완료된 것이 확인된다.
- **제안**: 정합성 유지 중. 추가 조치 불필요.

---

### [INFO] `spec/5-system/4-execution-engine.md §1.3` — `_resumeCheckpoint` 적용 범위("ai_agent · information_extractor") 가 `spec/4-nodes/3-ai/1-ai-agent.md` 및 `spec/4-nodes/3-ai/3-information-extractor.md` 와 동기됨 확인
- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` "보존 예외 — `_resumeCheckpoint`" 적용 범위
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.4/§7.5`, `spec/4-nodes/3-ai/3-information-extractor.md`
- **상세**: Phase A2b 에서 "ai_agent 한정" → "ai_agent · information_extractor" 로 확장 갱신이 수행되었고, plan §A2b 항목에 "spec 3곳('ai_agent 한정' 문구) 동기 갱신 완료" 가 체크(✅)되어 있다. 실행 엔진 §1.3, AI Agent §7.4 노트, Information Extractor 는 plan 기술대로 갱신 완료로 확인된다. 교차 충돌 없음.
- **제안**: 정합성 유지 중. 추가 조치 불필요.

---

## 요약

`spec/5-system/` 의 Phase A1~A3 구현 완료 범위(conversationThread durable 영속, _resumeCheckpoint 견고화, information_extractor 확장, user_variables 영속)에서 다른 spec 영역과의 **직접 모순(CRITICAL·WARNING 등급)은 발견되지 않는다**. 데이터 모델 충돌(`spec/1-data-model.md §2.13` 컬럼 추가), API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 모델 충돌 관점에서 모두 정합적이다.

유일한 주의 사항은 **Phase B 에서 제거될 fast-path(`pendingContinuations`), `firstSegmentBarriers`, detach 코루틴 관련 서술이 현재 `spec/5-system/4-execution-engine.md §1.1·§4.x·§7.4·§7.5` 에 살아있다는 점**이다. 이는 plan §Spec 변경 절에 명시적 갱신 항목이 포함되어 있으므로 spec 자체의 충돌이 아니라 "Phase B 착수 전에 정리해야 할 예고된 기술 부채" 이다. Phase B 착수 직전 project-planner 가 해당 서술을 정리하지 않으면 구현자가 제거 대상 fast-path 로직을 보존하거나 신규 로직과 혼동할 위험이 있다. 모두 INFO 등급으로 분류한다.

---

## 위험도

LOW
