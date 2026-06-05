# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전), scope=`spec/5-system/`  
Target 문서: `plan/in-progress/exec-park-durable-resume.md` (Phase B 설계 + spec 변경 지시)  
기준 Rationale: `spec/5-system/4-execution-engine.md ## Rationale`

---

## 발견사항

### [WARNING] Phase B2 에서 fast-path(`pendingContinuations` local resolve) 를 "강등"으로만 처리하는 안이 기각된 Sticky fast-path 를 사실상 재도입할 여지 있음

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` Phase B2 항목 — `"fast-path(pendingContinuations.has) 제거 또는 '같은 프로세스 우연 생존 시 순수 최적화'로 강등(의존 금지)"`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale "Durable Continuation & Graceful Shutdown"` → `"Sticky fast-path 제거"` 항목 (line ~1209–1211)
- **상세**: Spec Rationale 는 "초기 검토안에서 `pendingContinuations` key가 있으면 BullMQ 우회하고 직접 resolve 하는 sticky fast-path 를 포함했다. 그러나 '모든 진입점은 항상 publish — 직접 dispatch 분기는 race window' 원칙과 정면 충돌해 **sticky fast-path 를 제거하고 항상 BullMQ enqueue 로 통일**"한다고 명시적으로 기각했다. 현재 spec §7.4 "라우팅 원칙" 행도 "**자기 인스턴스의 `pendingContinuations` 에 키가 있어도 마찬가지 — 항상 BullMQ enqueue**"를 invariant로 선언한다. plan의 "강등(의존 금지)"은 fast-path를 코드에 남겨두는 방향인데, 이는 기각된 sticky fast-path가 코드에 남아 우연히 실행될 여지를 허용한다. Rationale는 local resolve의 microsecond 절약보다 "운영 단순성·디버깅 가능성"이 우선이라고 근거를 밝혔으므로, 강등이 아닌 완전 제거가 합의된 방향이다.
- **제안**: B2 항목의 "또는 '같은 프로세스 우연 생존 시 순수 최적화'로 강등(의존 금지)" 구절을 제거하고 "fast-path 완전 제거"로 단일화한다. 만약 강등을 의도한다면 spec §7.4 라우팅 원칙 invariant와 Rationale "Sticky fast-path 제거" 결정을 함께 번복하는 새 Rationale를 plan 내 또는 spec에 명시해야 한다.

---

### [WARNING] Phase B1의 "멀티턴 turn-단위 park(D4)" 에 대한 Rationale 명문화 의무가 plan에 기재되어 있으나 Phase B 착수 전 spec 갱신 완료 여부가 불명

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` "Spec 변경" 항목 — `"[Phase B 선행 — 구현 착수 전 의무] D4 turn-단위 park Rationale 명문화"` 및 `B1` 단계의 체크박스(미완료)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md § 4.x waiting_for_input park` 본문 및 `§Rationale "per-node → execution-level intake 큐"`에서 전제된 "한 Execution의 active 세그먼트는 항상 1개" invariant
- **상세**: plan은 D4(turn-단위 park) Rationale 명문화를 Phase B 착수 전 의무로 명시했고, plan의 "Spec 변경" 섹션에 `[Phase B 선행 — 구현 착수 전 의무]`로 경고가 달려 있다. 본 consistency-check는 Phase B가 아직 착수 전 단계이므로 이 의무 이행 상태를 확인해야 한다. spec `4-execution-engine.md § 4.x` 현재 텍스트에는 `"runAiConversationLoop 의 장수 루프"` 모델에 대한 Rationale 및 "turn-단위 park vs 대화 전체=단일 waiting" 비교가 없다. 또한 turn-단위 park로 전환하면 §4.x의 "멀티턴 AI waiting_for_input" 서술과 §7.4 worker 동작 표의 "multi-turn 동일 노드의 turn N+1 | 동일 세션 유지(waiting 진입하지 않은 인-메모리 turn의 경우)" 행이 구현 현실과 달라진다. plan의 점검 의무는 인식되어 있으나 spec 갱신이 선행되지 않은 상태에서 구현이 착수될 경우 기존 spec invariant를 번복하는 코드가 Rationale 없이 배포될 수 있다.
- **제안**: Phase B 구현 착수 전 `4-execution-engine.md §4.x` 및 §7.4의 관련 행에 대해 "대화 전체=단일 waiting(기각)" vs "turn-단위 park(채택)" Rationale를 먼저 작성하고 spec에 커밋한 뒤 B1 구현에 진입한다. plan의 `[Phase B 선행 — 구현 착수 전 의무]` 체크박스가 이 요건을 이미 추적하고 있으므로, 해당 항목을 완료하기 전 B1 착수를 차단하는 가드를 plan 운영 차원에서 유지할 것.

---

### [INFO] B3에서 `firstSegmentBarriers` 제거 시 spec §4.x "구현 메모" 섹션 동기 갱신 필요

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` Phase B3 — `"firstSegmentBarriers / armFirstSegmentBarrier / settleFirstSegment / signalParkBarrier 제거 또는 축소"`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §4.x` "구현 메모 — '첫 세그먼트 배리어'(`firstSegmentBarriers`)" 블록 (line ~404–405)
- **상세**: spec §4.x는 `firstSegmentBarriers` 패턴을 현재 구현의 공식 서술로 명시하고 있다("'park 또는 terminal에 정착하는 순간' `settleFirstSegment`로 resolve", "배리어는 멱등·단발" 등). B3에서 이 구조가 제거·축소되면 spec의 해당 "구현 메모" 블록이 현실과 불일치하게 된다. plan의 "Spec 변경" 섹션에 §4.x 구현 메모 업데이트 항목이 있으나 B3 완료 시 삭제/대체 대상인 문단을 구체적으로 식별해 놓을 필요가 있다.
- **제안**: Phase B3 완료 후 spec §4.x의 "구현 메모 — '첫 세그먼트 배리어'" 블록을 제거 또는 "park 즉시 반환(해제)" 모델로 대체 서술하는 작업을 B3 체크박스에 명시적으로 추가한다.

---

### [INFO] plan의 B2 재개 일원화와 spec §7.4 "Worker 동작" 행의 fast-path 서술 불일치 예고

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` "Spec 변경" 섹션 — `"§7.4: Worker 동작 행의 '로컬 pendingMap 즉시 resolve(fast-path)' 서술 정정(제거/강등)"`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4` Worker 동작 표 (line ~823): "로컬 `pendingContinuations`에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration 경로 (slow path)"
- **상세**: plan이 §7.4 서술 정정을 Spec 변경 항목으로 이미 포함하고 있어 인지된 상태다. 그러나 "(제거/강등)"으로 두 방향이 열려 있어 위 WARNING 항목(sticky fast-path 기각 결정)과 동일한 모호성이 있다. 이 행의 갱신이 fast-path 완전 제거 방향으로 확정되면 spec Rationale "Sticky fast-path 제거" 결정과도 정합한다.
- **제안**: §7.4 Worker 동작 행 갱신 방향을 plan에서 "제거"로 명확히 한다. 강등을 원한다면 기각된 결정의 재도입이므로 별도 Rationale 필요(위 WARNING 항목 참조).

---

## 요약

`plan/in-progress/exec-park-durable-resume.md`의 Phase A 부분(A1~A2b 완료, A3 진행)은 spec Rationale와 대체로 정합하며, conversationThread durable 영속·checkpoint 견고화 결정도 기존 합의 원칙을 계승한다. 주요 우려는 Phase B 설계에 집중된다. 가장 중요한 점은 spec Rationale가 "Sticky fast-path 를 명시적으로 기각하고 항상 BullMQ enqueue 로 일원화"한 invariant가 있는데, plan Phase B2에서 fast-path를 "강등(의존 금지)"으로 남기는 옵션을 열어두는 서술이 해당 invariant와 충돌한다는 것이다. 또한 D4(turn-단위 park) Rationale 명문화가 Phase B 착수 전 의무로 plan 자체에 명시되어 있는데, spec에 아직 작성되지 않아 B1 구현 착수 전 이 의무가 이행되어야 한다. 전반적으로 알려진 의무는 plan이 추적하고 있으나, fast-path 처리 방향의 모호성은 기각된 결정의 암묵적 재도입 위험을 내포하므로 구현 착수 전 단일화가 필요하다.

---

## 위험도

MEDIUM
