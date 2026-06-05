# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
기준 spec: `spec/5-system/4-execution-engine.md §Rationale`, `spec/0-overview.md §Rationale`, `spec/1-data-model.md §Rationale`
검토 모드: spec draft (--spec)
검토일: 2026-06-06

---

## 발견사항

### 1. [INFO] C4 (full B3 제거) — Rationale 에 명시된 "단계적 롤아웃" note 갱신 필요

- **target 위치**: spec-draft §C4 ("full B3 제거"), §C5 ("spec 서술 재전환")
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화" L1257 — "단계적 롤아웃 (B1 → B2, 2026-06-05)"` 항
- **상세**: 기존 Rationale 의 단계적 롤아웃 note 는 PR-B2 완료 시점에 `pendingContinuations` Map·`firstSegmentBarriers` 일가·`firePayload` scheduler 가 제거됨을 서술한다. target C4 는 이 제거(B3)를 full B3 로 확정·수행하는 것이며, §C5 는 spec 본문 내 "PR-B2 미적용" banner 2개와 §7.4 Worker 동작의 "잠정 경로 rejectPending" 단서를 제거하겠다고 선언한다. 이 갱신 자체는 기존 Rationale 의 예고된 다음 단계를 실현하는 것으로 근본적인 번복은 아니다. 다만 기존 Rationale L1257 note 의 "B1·B2 단계 기술" 부분 자체도 "B1·B2 모두 완료(full durable)" 완료형으로 갱신해야 하는데, target §C5 는 이 갱신 의도를 밝히되 Rationale 항 자체에 어떤 텍스트를 추가할지 구체적으로 명시하지 않는다.
- **제안**: §C5 의 Rationale 갱신 항목에 "(B1·B2 모두 완료, full durable)" 문구 외에 D6(중첩 call stack 영속) 근거가 함께 추가된다는 것을 spec-draft §Rationale 섹션의 마지막 항에서 이미 설명하고 있으므로 실질적으로 충분하다. 다만 spec 작성 시 `§Rationale "park 즉시 해제 + slow-path 일원화"` 의 해당 note 를 그 자리에서 직접 수정(대체)하는 방식임을 명시하면 더 명확하다 (덧붙임인지 대체인지가 모호).

---

### 2. [INFO] C3 (중첩 sub-workflow durable) — "per-node task queue 기각(L1303)" 과의 범주 구분이 draft Rationale 에 서술됐으나 spec 본문 §Rationale 에는 아직 없음

- **target 위치**: spec-draft §C3 및 §Rationale "per-node 분산(L1303 기각)과의 구분"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "per-node task queue → execution-level intake 큐" (L1300~L1306)` — "개별 노드를 워커로 분산하려면 노드마다 전체 ExecutionContext를 직렬화/rehydration 해야 하고 … 엔진 재작성급·고위험"으로 기각. `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)"` — per-node task queue 기각 근거 cross-reference 포함.
- **상세**: D6 의 "waiting 후 재개의 중첩 확장"은 per-node task queue(모든 노드마다 context 직렬화 + 핸드오프)와 다른 범주임을 target draft §Rationale 항에서 자체 설명하고 있다. 이 구분 설명은 논리적으로 타당하다: L1303 기각 이유("실행 중 노드 handoff — context 직렬화·rehydration 엔진 재작성급")는 "park 지점(waiting node)에서만 직렬화하는 재개 중첩 확장"과 실제로 다른 범주다. draft 는 이를 스스로 명시("같은 범주이며 dispatch loop in-process 전제(L371)를 유지"), 기각 대안 재도입이 아님을 밝히고 있다. 그러나 이 구분 설명이 현재 spec §Rationale 에는 없고 draft 에만 존재한다. 이것이 spec 에 적용될 때 해당 구분 근거가 실제로 §Rationale 에 기록되어야 미래 독자가 오해를 방지한다.
- **제안**: spec 적용 시 `§Rationale "park 즉시 해제 + slow-path 일원화"` 또는 별도 "D6 — 중첩 call stack durable 영속" 항에 "L1303 기각 대안(per-node 분산)과의 구분" 내용을 명시. target draft §Rationale 에 이미 서술돼 있으므로 그대로 옮기면 충분.

---

### 3. [INFO] V086 renumber 명시 — 마이그레이션 naming convention 충돌 처리 절차 추적 필요

- **target 위치**: spec-draft §C1 "마이그레이션: V086__execution_resume_call_stack.sql … V087+ 로 renumber 필수"
- **과거 결정 출처**: `spec/1-data-model.md §Rationale "Execution.execution_path → ExecutionNodeLog"` — Flyway forward-only 채택 근거. `spec/0-overview.md §Rationale "DB 마이그레이션 도구로 Flyway 채택"` — V<NNN>__ naming collision 이 CI 마다 schema_history vs 파일 정합성 검증으로 탐지됨.
- **상세**: target 은 `V086` 이 agent_memory listScopes 인덱스(#482)로 이미 사용 중임을 인식하고 V087+ renumber 를 "필수" 로 명시한다. 이는 기존 forward-only 정책이나 naming convention 을 번복하지 않으며, 충돌 탐지·renumber 절차는 기존 Flyway 규약 내에 있다. spec 적용 시 최종 채택 버전 번호가 spec 본문(`spec/1-data-model.md §2.13`)에 반영될 때 확정 번호를 기재해야 하며, 가칭("V086+")이 그대로 남으면 spec 의 단일 진실 원칙을 위반한다.
- **제안**: spec 적용 전 실제 next 마이그레이션 번호를 확정하고 spec 본문에 정확한 번호(예: V087)로 기재. "가칭" 표현은 spec draft 에서는 허용되나 최종 spec 문서에 남으면 안 됨.

---

### 4. [INFO] C3 §3.2 컨테이너 body blocking 금지 — 기존 제약 유지 확인 (충돌 없음)

- **target 위치**: spec-draft §C3 "제약 유지: 컨테이너(Loop/ForEach/Map/Parallel) body 의 blocking 은 §3.2 금지 그대로"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §3.2 body 서브그래프 제약 L290` — "blocking 노드(form / buttons / ai_conversation) 금지 — body 내부에서 사용자 대기 상태가 발생하면 iter 반복 의미가 모호해지므로 차단"
- **상세**: target 이 이 제약을 그대로 유지한다고 명시하므로 충돌 없음. D6 가 다루는 범위는 executeInline(top-level sub-workflow 호출 체인)만이며, 컨테이너 body blocking 금지는 건드리지 않는다. 제약 유지 선언이 draft 에 명시된 것은 Rationale 연속성 면에서 바람직하다.
- **제안**: 없음 (정합 확인).

---

## 요약

spec-draft-exec-park-b2-durable.md 는 `spec/5-system/4-execution-engine.md §Rationale` 의 기존 결정들과 전반적으로 연속적이다. C2(멀티턴 turn-단위 park, D4)·C4(B3 제거)·C5(spec 재전환)는 기존 Rationale 이 "PR-B2 완료 시점의 최종 상태"로 예고한 단계를 실현하는 것이며, 기각된 대안(per-node task queue L1303, sticky fast-path, Temporal 이전, `waiting_for_retry` enum 신설 등)을 재도입하지 않는다. C3(중첩 call stack durable, D6)는 기각 대안인 per-node 분산과 다른 범주임을 draft Rationale 에서 자체 서술하며 논리적 구분이 유효하다. 발견된 사항은 모두 INFO 등급으로, 기각 결정 재도입이나 합의 원칙 위반은 없으며, spec 적용 시 Rationale 텍스트의 명시적 갱신 방향·마이그레이션 번호 확정·per-node 구분 근거 기록을 챙기면 연속성이 완결된다.

---

## 위험도

LOW
