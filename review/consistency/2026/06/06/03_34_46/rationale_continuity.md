# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)

---

## 발견사항

### 1. [INFO] `runNodeDispatchLoop` 반환 계약 변경 — Rationale 에 "SPEC-DRIFT" 자기 표기됨

- **target 위치**: `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화" 마지막 bullet, `runNodeDispatchLoop 반환 계약 (PR-B1, SPEC-DRIFT W3)` 항목
- **과거 결정 출처**: 동일 문서 §Rationale 내 Phase B 원칙 서술 — `Promise<void>` 가 암묵적 계약이었음
- **상세**: `runNodeDispatchLoop` 반환 타입이 `Promise<void>` → `Promise<{ parked: boolean }>` 로 변경됐다. spec 자체가 "코드가 옳고 spec 이 따라온다 — SPEC-DRIFT" 로 표기하며 사후 정합을 인정하고 있다. 이는 과거 결정의 번복이나 Rationale 누락이 아니라, spec 이 구현을 따라가는 흐름을 명시한 케이스다.
- **제안**: Rationale 에 이미 "(코드가 옳고 spec 이 따라온다 — SPEC-DRIFT)" 주석이 달려 있으므로 추가 조치 불필요. 다만 이 변경이 caller(`runExecution` / `driveResumeDetached`)의 계약을 바꾸는 것임을 §5.x (디스패치 루프 본문) 에 명시적으로 cross-reference 하면 가독성이 높아진다.

---

### 2. [INFO] B1·B2 분리 불가 원칙과 과도기 병존 상태의 문서 정합

- **target 위치**: `spec/5-system/4-execution-engine.md` §Rationale "단계적 롤아웃 (B1 → B2)" + §4.x park 구현 메모
- **과거 결정 출처**: 동일 §Rationale "B1·B2 분리 불가" 항목 — "코루틴 해제(B1)와 모든 재개 = rehydration(B2)은 한 덩어리 변경이다"
- **상세**: Rationale 는 "B1·B2 는 분리 불가(한 덩어리)"라고 명시하면서도, 바로 아래에서 "2개 PR 로 단계 적용"(B1 = form/button 먼저, B2 = 멀티턴 AI 나중)을 서술한다. 논리적으로 "분리 불가"는 같은 park-site 안에서의 원칙(form/button 사이트에서 B1+B2를 동시에)이고, PR 분리는 park-site 단위로 한 묶음임을 의미함을 본문이 "park-site 단위로 release+slow-path 를 함께"로 설명한다. 그러나 이 두 서술이 같은 단락에 있어 "분리 불가" 원칙이 "PR 분리 허용"과 모순처럼 보일 수 있다.
- **제안**: Rationale 에 "분리 불가는 동일 park-site 내 B1+B2 동시 적용 의무를 의미한다. park-site 단위 PR 분리(form/button PR-B1 vs. 멀티턴 AI PR-B2)는 이 원칙과 충돌하지 않는다"는 한 문장을 명시하면 혼동이 제거된다.

---

### 3. [INFO] `pendingContinuations` Map 제거 — 과도기와 최종 상태 혼용 서술

- **target 위치**: `spec/5-system/4-execution-engine.md` §7.4 Worker 동작 표 (`pendingContinuations` 관련 설명)
- **과거 결정 출처**: 동일 §Rationale "Sticky fast-path 제거" + "park 즉시 해제 + slow-path 일원화" — `pendingContinuations` Map 을 제거해 "항상 rehydration" 을 완성한다는 결정
- **상세**: §7.4 Worker 동작 표는 "park 시 코루틴을 즉시 해제하므로... in-process resolver(`pendingContinuations`)가 존재하지 않는다 — worker-side fast-path 는 제거됐고"라고 최종 상태를 기술하면서, 같은 셀 안에서 "멀티턴 AI 잠정 경로: `pendingContinuations` 에 in-memory 코루틴이 살아있으면 `rejectPending` 경로로 처리"라고 과도기 예외를 기술한다. 두 상태가 한 셀에 혼용돼 있어 독자가 현재 코드가 어느 상태인지 즉시 파악하기 어렵다.
- **제안**: §7.4 표에 "현황(2026-06-06)" 같은 명시적 시점 태그를 달거나, 최종 상태 서술과 과도기 서술을 시각적으로 분리(예: blockquote 또는 구현 상태 배너)하면 명확성이 향상된다. 내용 자체는 Rationale 와 충돌하지 않는다.

---

### 4. [INFO] D6 (`resume_call_stack`) 기각 결정과의 정합 — 범주 구분 보강 필요

- **target 위치**: `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화" D6 항목, 및 §6.2 park commit (e) 항목
- **과거 결정 출처**: 동일 §Rationale §6.2 "`_continuationCheckpoint` 컬럼 신설 기각" — "기존 SoT인 `NodeExecution.outputData` JSONB에 키로 보존해 DB 스키마 변경·마이그레이션을 회피한다"
- **상세**: D6 는 `resume_call_stack` 이라는 신규 컬럼(V087)을 도입한다. Rationale 는 이것이 기각된 `_continuationCheckpoint` 컬럼 신설과 "직교한 목적"이라고 설명하지만(운반 vs 위상 영속), 두 결정이 같은 문서에서 각자 "컬럼 추가를 회피/회피하지 않음"의 방향이라 처음 읽는 사람이 충돌로 오해할 수 있다.
- **제안**: D6 Rationale 항목에 "`_continuationCheckpoint` 기각이 DB 스키마 변경 자체를 금지한 것이 아니라, continuation 운반 목적의 컬럼을 BullMQ 큐로 충분히 대체할 수 있다는 결정이었다. `resume_call_stack` 은 다른 목적(중첩 실행 위상 영속)이므로 신규 컬럼이 필요하다"는 한 문장을 추가하면 충분하다. 이미 본문에 유사한 내용이 있으나 더 전면에 배치하면 좋다.

---

### 5. [INFO] `per-node task queue` 기각과 D6의 in-process call stack 영속의 경계 서술

- **target 위치**: `spec/5-system/4-execution-engine.md` §Rationale D6 항목 — "per-node task queue 기각과 다른 범주" 설명
- **과거 결정 출처**: 동일 §Rationale "per-node task queue → execution-level intake 큐" 기각 결정 — "개별 노드를 워커로 분산하려면 전체 ExecutionContext 를 직렬화/rehydration 해야 하고... 엔진 재작성급·고위험"
- **상세**: Rationale D6 는 "per-node task queue 기각과 다른 범주"라고 명시해 재도입이 아님을 선언하고 있다. 내용도 올바르다 — D6 는 park 지점(waiting node)에서만 직렬화하고 dispatch loop in-process 전제를 유지한다. 충돌 없음. 단, 기각 결정의 핵심("실행 중 노드 핸드오프")과 D6 의 차이점("park 이후 재개")을 한 문장으로 더 명확히 대비시키면 가독성 향상된다.
- **제안**: 현재 서술로 충분하나, "per-node task queue 는 실행 중 핸드오프이고 D6 는 park 이후 재개다"라는 대비 문장을 첫 줄에 배치하면 독자가 빠르게 이해할 수 있다.

---

### 6. [INFO] D3 (fresh-config-per-turn) 과 "replay reproducibility" 약화 수용 서술

- **target 위치**: `spec/5-system/4-execution-engine.md` §Rationale D3 항목 + §6.2 "Phase B turn-단위 park (D4) + fresh-config (D3)" 항목
- **과거 결정 출처**: 동일 §Rationale "Engine Raw Config Exposure" — "config + output 양쪽에 같은 evaluated 값을 두는 안은 Principle 1.1 직교성 위반으로 기각" + "Multi-turn resume 은 replay 가 아님"
- **상세**: D3 는 "매 turn rehydration 이 `node.config` 를 fresh 재유도하므로, park 중 워크플로 편집이 다음 turn 부터 반영된다"고 하며 "replay reproducibility 의 turn 단위 약화는 수용된 trade-off"라고 명시한다. 이는 과거 "Multi-turn resume 은 replay 가 아님" 결정과 정합하며, replay reproducibility 약화를 번복이 아닌 명시적 trade-off 수용으로 기록하고 있다. Rationale 연속성 관점에서 충돌 없음.
- **제안**: 추가 조치 불필요. 다만 §Rationale "Engine Raw Config Exposure" 의 "후속 항목" 목록에 D3 fresh-config 를 완료 표시(또는 삭제)하면 Rationale 의 후속 추적이 깔끔해진다.

---

## 요약

`spec/5-system` 영역 전체를 Rationale 연속성 관점에서 검토한 결과, **명시적으로 기각된 대안의 재도입이나 합의된 invariant 의 무근거 위반은 발견되지 않았다**. 가장 복잡한 변경인 "park 즉시 해제 + slow-path 일원화 (Phase B, PR-B1)" 는 과거 "Durable Continuation" + "Sticky fast-path 제거" + "항상 publish 원칙"의 자연스러운 연장선이며, 과거 기각된 대안(`per-node task queue`, `WAITING_FOR_INPUT → INTERRUPTED enum 신설`, `Temporal 이전`, `sticky fast-path`) 이 재도입된 흔적도 없다. D6(`resume_call_stack`) 도 기각된 `_continuationCheckpoint` 와 목적이 명확히 구분되어 기재되어 있어 번복이 아님이 내부적으로 정당화돼 있다. 발견된 사항은 모두 INFO 등급 — 서술 명확성 보강 제안이며, 결정의 연속성 자체에는 문제가 없다.

## 위험도

NONE

---

STATUS: OK
