# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
기준 Rationale: `spec/5-system/4-execution-engine.md ## Rationale` (주), `spec/1-data-model.md ## Rationale`

---

## 발견사항

### [INFO] `resume_call_stack` 컬럼 신설과 L1174 `_continuationCheckpoint` 기각 결정의 범주 구분

- **target 위치**: spec-draft C1 — `Execution.resume_call_stack jsonb NULL` 컬럼 신설
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` L1174 "별도 `_continuationCheckpoint` 컬럼 신설 기각"
- **상세**: L1174 는 "continuation 페이로드/상태를 위한 별도 컬럼"을 기각했다. `resume_call_stack` 은 Execution 테이블에 신규 컬럼을 추가하는 점에서 형식이 유사해 보일 수 있다. 그러나 target 의 Rationale D6 절 "W2 구분 주석"은 이 차이를 명시적으로 설명하고 있다: L1174 는 continuation 페이로드 운반(BullMQ 큐가 담당)을 위한 컬럼이고, `resume_call_stack` 은 park 시점의 중첩 실행 위상(호출 체인 구조) 영속이다 — 직교. 논리는 충분히 설명됐다.
- **평가**: 범주 구분 설명이 target 내에 명시돼 있으므로 Rationale 번복이 아님. INFO 수준.
- **제안**: spec 적용 시 target 이 예고한 대로 `spec/5-system/4-execution-engine.md §Rationale` 에 이 구분 주석을 실제로 추가해 독자가 L1174 와 연결해 읽을 수 있도록 한다. (target 의 "spec 적용 시 §Rationale 에 이 구분 주석 추가" 의도가 실제 적용 단계에서 누락되지 않도록 주의.)

---

### [INFO] per-node task queue 기각(L1303)과 D6 중첩 sub-workflow durable의 범주 구분

- **target 위치**: spec-draft C3 / Rationale D6 절 "per-node 분산(L1303 기각)과의 구분"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` "per-node task queue → execution-level intake 큐" (L1303 기각)
- **상세**: L1303 은 "모든 노드를 워커로 분산(개별 노드마다 전체 ExecutionContext 직렬화/rehydration)하는 per-node task queue"를 기각했다. D6 는 park 지점(waiting 노드)에서만 직렬화하고 dispatch loop in-process 전제를 유지한다. target 자체가 이 구분을 Rationale 에 명시적으로 기술한다.
- **평가**: target 이 기각 이유를 충분히 인지하고 있으며 범주 구분도 명문화했다. INFO 수준.
- **제안**: spec 적용 시 이 구분 주석이 `spec/5-system/4-execution-engine.md §Rationale` 의 "per-node task queue → execution-level intake 큐" 항 바로 아래 cross-reference 로 추가되면 추후 독자가 혼동하지 않는다.

---

### [INFO] 단계적 롤아웃 note (L1257) — "완료형"으로 인라인 대체 시 B1·B2 분리 불가 원칙 언급 보존 여부

- **target 위치**: spec-draft C5 — L1257 "단계적 롤아웃(B1→B2)" note를 "B1·B2 모두 완료(full durable)"로 갱신
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` L1251 "B1·B2 분리 불가" 원칙
- **상세**: 현행 Rationale L1257 은 왜 2개 PR 로 나뉘었는지(park-site 단위, B1·B2 분리 불가 원칙 유지) 구체적 사유를 기술한다. target 은 이를 "B1·B2 모두 완료(full durable)" + D6 근거 추가로 대체하겠다고 예고한다. 대체 시 "B1·B2 왜 분리 불가였는가"(코루틴 해제→in-memory resolve 소멸→rehydration 강제의 연쇄)라는 역사적 의사결정 맥락이 소실될 수 있다.
- **평가**: Rationale 원칙("B1·B2 분리 불가" — L1251) 자체는 유지되므로 직접 위반은 아니다. 단, 롤아웃 기록이 인라인 대체로 완전히 사라지면 추후 변경 이력 추적이 어려워진다. INFO 수준.
- **제안**: "B1·B2 모두 완료(full durable)"로 갱신 시 L1251 "B1·B2 분리 불가 원칙" 항의 설명은 그대로 보존하고, L1257 의 롤아웃 단계 서술만 "완료" 표기로 갱신한다. 롤아웃 완료를 "인라인 대체"가 아닌 기존 항 말미에 "(완료 — B1·B2 모두 머지됨, 2026-06-xx)" 정도의 완료 표기를 append 하는 방식이 역사 보존에 유리하다.

---

### [INFO] C2 멀티턴 AI = turn-단위 park (D4) — 기각 대안 명시 범위 완전성

- **target 위치**: spec-draft C2 — `runAiConversationLoop` 장수 루프 제거, turn-단위 park
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` L1254 D4 결정 — "기각 대안: 대화 전체=단일 waiting 유지+코루틴 누적 수용은 bounded-메모리 목표와 정면 충돌"
- **상세**: target C2 의 설계는 L1254 D4 와 완전히 정합한다. 기존 Rationale 이 이미 "장수 루프 제거 + turn-단위 park"를 채택 결정으로 기록하고, bounded-메모리 목표를 invariant로 확정했으므로 target 은 그 결정을 이행하는 것이다.
- **평가**: 충돌 없음. INFO 확인.
- **제안**: 없음.

---

### [INFO] C4 B3 (pendingContinuations 제거 등) — Sticky fast-path 제거 원칙과 정합

- **target 위치**: spec-draft C4 — `pendingContinuations` Map · `applyContinuation` fast-path · `firstSegmentBarriers` 일가 · `firePayload` 제거
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` L1217 "Sticky fast-path 제거 — 항상 publish 원칙 보존" / L1251–1252 B3 결정
- **상세**: L1217 과 L1251–1252 는 이미 sticky fast-path 제거 및 B3 제거를 결정으로 확정했다. C4 는 그 결정을 실행하는 이행 내용이다. 완전히 정합한다.
- **평가**: 충돌 없음. INFO 확인.
- **제안**: 없음.

---

## 요약

target 문서(`spec-draft-exec-park-b2-durable.md`)는 기존 `spec/5-system/4-execution-engine.md ## Rationale`에 기록된 핵심 결정들(D4 turn-단위 park, B3 fast-path 제거, per-node task queue 기각, _continuationCheckpoint 컬럼 신설 기각, Sticky fast-path 제거 원칙, bounded-메모리 invariant)과 전면적으로 정합한다. 새로 도입하는 D6(중첩 call stack durable 영속)도 기각된 대안(per-node task queue, _continuationCheckpoint 컬럼 신설)과의 범주 구분을 target 자체 Rationale 에 명시해 번복 위험을 예방했다. 식별된 발견사항은 모두 INFO 등급으로, spec 적용 단계에서 역사적 맥락 보존과 cross-reference 추가에 주의하면 충분히 해소된다. CRITICAL 또는 WARNING 수준의 기각 대안 재도입, 합의 원칙 위반, 무근거 번복은 발견되지 않았다.

## 위험도

LOW

---

STATUS: OK
