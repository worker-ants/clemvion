# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] C1 — `resume_call_stack` 컬럼 vs L1174 `_continuationCheckpoint` 기각 결정: 범주 구분이 target 내 명시됨

- **target 위치**: C1 `resume_call_stack jsonb NULL` 신설 (C1절), Rationale "L1174 기각과의 구분(W2)" 항
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` § Rationale "Multi-turn 재시작 재개" L1174 — `_continuationCheckpoint` 컬럼 신설 기각: "기존 SoT 인 `NodeExecution.outputData` (JSONB) 에 키로 보존해 DB 스키마 변경·마이그레이션을 회피"
- **상세**: L1174 기각 결정은 "continuation 페이로드/상태를 위한 별도 DB 컬럼 신설"을 기각했다. target C1 은 `Execution.resume_call_stack jsonb` 신규 컬럼을 제안하는데, 이는 표면상 "별도 컬럼 신설 기각" 과 충돌해 보인다. 그러나 target 의 Rationale "L1174 기각과의 구분(W2)" 항이 범주 차이를 명시적으로 설명한다 — L1174 가 기각한 것은 continuation 운반 목적의 컬럼이고, `resume_call_stack` 은 park 시점의 중첩 실행 위상(호출 체인) 영속으로 직교 범주라는 것. 이 구분 주석을 spec 적용 시 §Rationale 에 함께 추가한다는 명시도 있다.
- **제안**: target Rationale 에 이미 구분 논거가 작성돼 있으므로 추가 조치 불요. 단, spec 적용 시 §Rationale 에 실제로 추가되어야 검토자가 사후에 혼동하지 않는다 (C5 적용 시 챙겨야 할 동기화 항목 W2 에 이미 명기됨).

---

### [INFO] C4 — `pendingContinuations` Map 완전 제거 vs Rationale "항상 BullMQ enqueue" 원칙과의 관계

- **target 위치**: C4 "fast-path 전면 제거" — `pendingContinuations` Map · `applyContinuation` fast-path · `resolvePending` · `rejectPending` · `firstSegmentBarriers` 일가 제거
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화" L1251 (B1·B2 분리 불가), L1257 단계적 롤아웃 — "PR-B2 완료 시점에 비로소 `pendingContinuations` Map 제거"
- **상세**: 기존 spec 은 L1257 에서 `pendingContinuations` Map 제거가 PR-B2 완료 시점의 결과임을 명시했고, C4 는 정확히 그 완료 단계를 구현한다. 즉 기각된 대안 재도입이 아니라 예정된 다음 단계의 실행이다. 원칙 위반이 아님.
- **제안**: 이상 없음. target C5 에서 spec §Rationale L1257 의 "단계적 롤아웃" note 를 "B1·B2 모두 완료" 상태로 갱신한다고 명기돼 있어 역사 맥락 보존 방향도 올바르다.

---

### [INFO] C3 — 중첩 sub-workflow blocking durable vs L1303 per-node task queue 기각 결정: target 이 직접 해명함

- **target 위치**: C3 "executeInline 내 blocking 도 top-level 과 동일하게 park-release + rehydration 재개", Rationale "per-node 분산(L1303 기각)과의 구분" 항
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §Rationale "per-node task queue → execution-level intake 큐" L1303 기각 — "개별 노드를 워커로 분산하려면 노드마다 전체 ExecutionContext 를 직렬화/rehydration 해야 하고 엔진 재작성급 위험"
- **상세**: L1303 기각의 핵심 이유는 "실행 중 노드 핸드오프"용 rehydration 이 아니라는 것이고, C3 의 durable park 는 "waiting node 에서만" 직렬화하는 "waiting 후 재개"의 중첩 확장 — 한 세그먼트(top-level → 각 sub-workflow 재귀 재진입)가 여전히 한 프로세스 내에서 구동된다. 따라서 L1303 기각의 "한 실행이 한 프로세스 안에 있다" 전제(L371, §4.2)를 위반하지 않는다. target Rationale 도 이 구분을 명시적으로 적어 놓았다.
- **제안**: 이상 없음. 단, spec 적용 시 §4.2 나 §7.5 에 "sub-workflow 중첩 재진입도 한 세그먼트 = 한 프로세스 내 재귀 구동" 임을 주석으로 명기하면 추후 검토 시 혼동을 줄일 수 있다.

---

### [INFO] C5 — L1257 "단계적 롤아웃" note 처리 방식

- **target 위치**: C5 Rationale 적용 지침 — "말미에 '(완료 — B1·B2 모두 머지, 2026-06-06; 중첩은 D6 call stack 영속)' append" (I3/I11 참조)
- **과거 결정 출처**: L1257 "단계적 롤아웃(B1→B2, 2026-06-05)" note — 역사적 단계 기록
- **상세**: target 이 L1257 note 를 인라인 대체가 아니라 append 방식으로 처리해 역사 맥락(B1·B2 분리 불가 원칙 사유 등)을 보존하는 방향은 Rationale 연속성 관점에서 가장 안전한 접근이다. 과거 결정(분리 불가 원칙·단계적 근거)이 소거되지 않고 완료 이력으로 전환된다.
- **제안**: 이상 없음.

---

### [INFO] `CALL_STACK_SCHEMA_VERSION` 독립 상수 — `CHECKPOINT_SCHEMA_VERSION` 과의 결합 원칙

- **target 위치**: C1 — "`version`: 별도 상수 `CALL_STACK_SCHEMA_VERSION` (기존 `CHECKPOINT_SCHEMA_VERSION` 과 독립 — 혼동/coupling 방지, W6)"
- **과거 결정 출처**: 해당 상수 분리에 대한 명시적 과거 Rationale 항목 없음
- **상세**: 기존 spec 에 `CHECKPOINT_SCHEMA_VERSION` 독립성에 대한 공식 Rationale 항목은 없으나, spec §1.3 `_resumeCheckpoint` 의 독립 버전 관리 패턴(schemaVersion 필드)과 일관된다. 분리 상수 채택은 coupling 방지 목적으로 합리적이며 기존 결정과 충돌하지 않는다.
- **제안**: spec 적용 시 I6 지침대로 §1.3 에 `CALL_STACK_SCHEMA_VERSION` 독립 상수 주석을 추가해 결정 근거를 명문화할 것.

---

## 요약

target 문서(`spec-draft-exec-park-b2-durable.md`)는 기존 spec `## Rationale` 에서 기각된 대안을 재도입하거나 합의된 불변식을 위반하는 부분이 없다. 가장 주의가 필요했던 세 지점 — (1) L1174 `_continuationCheckpoint` 컬럼 기각과 `resume_call_stack` 신규 컬럼의 충돌 가능성, (2) L1303 per-node task queue 기각과 중첩 durable park 의 충돌 가능성, (3) L1257 단계적 롤아웃 note 처리 — 은 모두 target 내 Rationale 섹션이 명시적 범주 구분을 작성해 두었거나 역사 맥락 보존 방식(append)으로 처리해 기각 결정의 번복이 아님을 자체 해명하고 있다. C4 의 `pendingContinuations` 전면 제거도 L1257 이 예고한 PR-B2 완료 단계를 그대로 이행하는 것이다. 발견된 항목은 모두 INFO 등급(보완 제안) 수준이며 결정 번복·기각 대안 재도입·invariant 위반에 해당하는 사항은 없다.

## 위험도

NONE
