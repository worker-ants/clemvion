# Rationale 연속성 검토 결과

검토 대상: M-4 park-진입 dispatch 추출 (구현 착수 전 --impl-prep)
검토 시각: 2026-06-24

---

## 발견사항

### 발견사항 없음 — 관련 Rationale 과 충돌 없음

검토 범위에서 아래를 확인했다.

**1. `resume-turn-dispatch` 와의 대칭 원칙**

`spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화"` 항의 "resume turn dispatch registry 추출 (#507)" 단락이, form/buttons/ai turn 분기를 ordered registry + 단일 진입점(`dispatchResumeTurn`, `resume-turn-dispatch.ts`)으로 일원화한 것을 **동작 보존 리팩토링**으로 명시 기록하고 있다.

M-4 가 제안하는 `ParkEntryDispatch` registry(`buildParkEntryRegistry` factory)는 이 동일 패턴의 park-진입 측 대칭이며, 해당 Rationale 이 기각한 대안("두 곳에 하드코딩 분기 유지")을 재채택하는 방향이 **아니다** — 오히려 그 Rationale 의 연장이다.

**2. `interaction-type-registry.md §4` Rationale 의 목적과의 정합**

`spec/conventions/interaction-type-registry.md §4 Rationale` 는 "하나의 enum 값을 추가했는데 N개의 처리 분기 위치 중 일부를 빠뜨림" 패턴을 3중 가드(매트릭스 SoT + AST 가드 + TypeScript exhaustive switch)로 차단하는 것이 목적이라고 명시한다. M-4 는 park-진입 측의 두 중복 블록(`retry-드라이브` + `메인 루프`)을 단일 `dispatchParkEntry` 로 수렴해 shotgun surgery 를 추가 제거하는 방향이며, 이 Rationale 목적과 동일하다.

**3. per-node task queue 기각과의 구분**

`spec/5-system/4-execution-engine.md §Rationale "per-node task queue → execution-level intake 큐"` 에서 명시적으로 기각된 "per-node task queue" 와 M-4 의 ParkEntryDispatch registry 는 무관하다. M-4 는 한 세그먼트 내부의 노드 dispatch 를 분산하는 것이 아니라, 이미 in-process 로 실행 중인 park 진입 분기를 registry 패턴으로 정리하는 것이다. 같은 Rationale 의 §Phase 2 cont 마지막 bullet 이 "exec-park D6 — `waitForX` 에서만 직렬화, dispatch loop in-process 전제 유지 — 따라서 그 기각 대안의 재도입이 아니다"를 명시 분리한 선례와 동일 논리다.

**4. `PARK_RELEASED` escape 사이트별 보존**

M-4 scope 서술에서 "PARK_RELEASED escape는 사이트별 보존(bare return/ParkReleaseSignal throw/{parked:true})"을 명시하고 있다. 이것은 `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화" B1·B2 분리 불가` 항에서 결정된 "park = 세그먼트 종료, 즉시 반환·해제" 계약 및 `runNodeDispatchLoop` 가 `Promise<{ parked: boolean }>` 를 반환하는 계약(`spec §Rationale "runNodeDispatchLoop 반환 계약 (PR-B1, SPEC-DRIFT W3)"`)과 정합한다. registry 로 분기를 통합하면서 이 반환 계약을 사이트별로 보존한다는 것은 해당 Rationale 을 준수하는 것이다.

**5. spec 노트 후행 deferral**

M-4 scope 서술에서 "spec 노트(interaction-type-registry.md §1.2 park-entry)는 후속 planner spec-sync PR"이라고 명시하고 있다. `plan/in-progress/refactor/02-architecture.md §M-4` 가 이미 "spec 갱신 필요 — interaction-type-registry.md §1.2 emit 위치 열 + 진행 중 spec-sync-resume-dispatch-registry.md 에 park-entry 레이어 추가 (planner)" 를 선행 조건으로 적시했고, 해당 plan 의 M-4 항목도 "미착수" 임을 명시한 상태다. 즉 이 deferral 은 plan 이 이미 인지·기록한 사항이며 Rationale 을 우회하는 새 결정이 아니다. (단, spec 미갱신 상태로 구현을 착수한다면 plan M-4 의 선행 조건을 충족하지 않는 점은 developer 와 planner 가 판단해야 할 사항이나, Rationale 연속성 관점에서는 기각된 대안 재도입이 아니다.)

---

## 요약

M-4 target 의 설계(park-진입 dispatch 를 `ParkEntryDispatch` registry + `buildParkEntryRegistry` factory 로 일원화, resume 측 `dispatchResumeTurn` PR #507 과 대칭, PARK_RELEASED escape 사이트별 보존, behavior-preserving)는 `spec/5-system/4-execution-engine.md §Rationale` 및 `spec/conventions/interaction-type-registry.md §4 Rationale` 에 기록된 모든 결정과 정합한다. 기각된 대안(per-node task queue, 이벤트 포트 추상화, sticky fast-path, 두 중복 블록 하드코딩 유지)을 재도입하지 않으며, 합의된 불변식(park = 세그먼트 종료 즉시 반환·해제, runNodeDispatchLoop 반환 계약, 모든 재개 = rehydration 단일 경로, exhaustive switch 규약)을 위반하지 않는다. Rationale 연속성 관점의 충돌은 발견되지 않았다.

---

## 위험도

NONE
