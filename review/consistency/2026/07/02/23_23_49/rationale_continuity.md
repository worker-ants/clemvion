### 발견사항

- **[CRITICAL] `waiting_for_input → running → failed` 2단계 전이는 spec 이 명시적으로 기각한 대안의 재도입**
  - target 위치: `plan/in-progress/spec-draft-c2-atomic-claim.md` "변경 3 — §1.2 NodeExecution 상태 (전이 추가)" 및 "변경 4 — §1.1 (Execution 원자성 노트 L81 + 재개 전이 정합)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → `### waiting_for_input → failed 전이 추가` (L1246–1254), 특히 L1252: "`WFI → running` 후 `running → failed` 의 두 단계 전이는 두 트랜잭션 분리로 단일 원자성이 깨져 더 복잡하므로 택하지 않는다."
  - 상세: 현재 spec 은 `waiting_for_input → completed`(L103) / `waiting_for_input → failed`(L76, L105)를 **직접·단일 트랜잭션 전이**로 명시하고, §1.1 원자성 보장 노트(L81)가 바로 이 직접성("짝이 되는 NodeExecution 상태 변경과 단일 DB 트랜잭션")을 근거로 삼는다. Rationale 항목은 "`WFI → running` 후 `running → failed`" 형태의 2단계 전이를 명시적으로 검토했고 "두 트랜잭션 분리로 단일 원자성이 깨진다"는 이유로 기각했다. target draft 의 변경 3/4 는 재개 진입을 `waiting_for_input → running`(claim) → (성공 시 `completed`, LLM throw 시 `failed`) 의 **2단계 전이**로 바꾸면서, 이를 "기존 `waiting_for_input → completed`·`waiting_for_input → failed` 직접 전이 서술은 'claim 후 running 을 경유해' 로 정합화(의미 동일 — 최종 종착 상태 불변)"라고만 서술한다. 그러나 L1252 의 기각 사유는 "최종 상태" 가 아니라 "**트랜잭션 분리로 인한 원자성 약화**" 였으므로, "의미 동일" 이라는 근거로는 이 기각을 되돌릴 수 없다. 특히 `waiting_for_input → failed` (LLM throw, 429/timeout/connection) 케이스는 claim 원자 UPDATE(트랜잭션 1) 후 별도로 `handleAiTurnError`/`finalizeAiNode` 가 `running → failed` 전이(트랜잭션 2)를 수행해야 하므로, L1252 가 우려한 "두 트랜잭션 분리" 그 자체가 된다. draft 의 신규 Rationale 소절(변경 6)은 §1.3 `_retryState` 패턴과의 정합만 논증할 뿐, 이 L1252 기각 사유와의 충돌은 언급하지 않는다.
  - 제안: (a) claim 을 재개 **진입** 지점(`waiting_for_input → running`, 성공 경로)에만 적용하고, LLM throw 등 실패 경로는 claim 성공 후 발생하는 것이므로 실제로는 이미 `running` 상태에서 실패하는 것이라 문제가 없다는 논리라면 그 구분을 draft/신규 Rationale 에 명시할 것. 또는 (b) L1246 소절에 claim 도입에 따른 **명시적 갱신**을 추가해 "본 결정(2026-07-02)으로 claim 이 `running` 경유를 강제하므로, 2026-06-xx 시점의 '2단계 전이 기각' 결정을 부분 수정한다 — claim 자체는 짧은 조건부 UPDATE 라 원자성 우려가 실질적으로 재현되지 않는 이유는 …" 형태로 과거 결정과의 관계를 정면으로 다룰 것. 현재 draft 표현("의미 동일 — 최종 종착 상태 불변")은 과거 기각의 핵심 논거(트랜잭션 분리)를 다루지 않아 무근거 번복에 해당한다.

- **[WARNING] §1.1 원자성 보장 노트의 "전이 쌍" 서술과 claim 도입의 정합성 미검증**
  - target 위치: 변경 4, L81 보강 문구("claim 실패(affected=0)는 no-op … claim 후 rehydration 실패는 RESUME_* terminal 로 원자 롤백")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §1.1 L81 "원자성 보장" — "`running ↔ waiting_for_input` 전이는 짝이 되는 `NodeExecution` 상태 변경과 단일 DB 트랜잭션으로 묶여 commit/rollback"
  - 상세: 기존 L81 은 `Execution.status` 전이와 `NodeExecution.status` 전이가 **하나의 트랜잭션**으로 묶인다는 것을 원자성의 정의로 삼는다. draft 의 claim 은 `UPDATE node_execution SET status='running' WHERE status='waiting_for_input'` 로 **NodeExecution 단독** 갱신이며, 이 시점에 `Execution.status` 도 함께 같은 트랜잭션에서 전이되는지가 draft 문면에서 불명확하다("Execution ↔ NodeExecution status 를 단일 트랜잭션으로 묶고"라고만 서술). claim 이 NodeExecution 만 먼저 갱신하고 Execution 갱신이 별도 스텝이라면, 기존 L81 이 정의한 "전이 쌍의 원자성" 자체가 새로운 형태로 재정의되는 것이므로 그 사실을 명시해야 한다.
  - 제안: 개정 문구에 claim UPDATE 가 `Execution.status`(예: `waiting_for_input → running`)와 `NodeExecution.status`(`waiting_for_input → running`)를 **동일 트랜잭션**에서 함께 갱신하는지 여부를 명시적으로 밝히고, 그렇지 않다면 L81 의 "전이 쌍 원자성" 정의를 claim 도입에 맞춰 명시적으로 갱신할 것.

- **[INFO] §7.4 CONTINUATION_WORKER_CONCURRENCY 서술과 "성능 튜닝 파라미터" 재정의는 기존 문구와 상충 없음**
  - target 위치: 변경 5 (§7.4 L876 보강)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.4 L876, Rationale L1376 "불변식 보존: 동일 turn 이중 실행 0(durable WAITING_FOR_INPUT + NodeExecution.status 재검증 가드 §7.5)"
  - 상세: L1376 은 불변식 보증 메커니즘으로 "재검증 가드"를 명시하고 있어, draft 가 그 가드를 claim 으로 교체하면 L1376 문구도 함께 갱신해야 정합이 유지된다. draft 의 side-effect 점검 대상에는 이 L1376 갱신이 누락되어 있다(§7.5.1/§7.5 실패표/conversation-thread/1-data-model 만 점검). 사소하지만 spec 반영 시 빠뜨리기 쉬운 지점이다.
  - 제안: 구체 변경 목록에 "변경 7 — §Rationale L1376 '불변식 보존' 문구의 '재검증 가드' 표현을 '원자 claim'으로 갱신" 을 추가할 것.

### 요약

target draft 의 핵심 결정(§7.5 재개 진입을 비원자 SELECT 재검증에서 DB 원자 claim 으로 전환)은 spec 이 이미 §1.3 `_retryState` 소비에서 확립한 "affected=1 인 쪽만 진행" 패턴의 정당한 일반화이며, spec 자신도 여러 곳(L411, L1446)에서 "선언한 불변식과 실제 보장 메커니즘 사이의 갭"을 재검증하는 선례를 갖고 있어 이 부분은 기각 대안의 재도입이 아니다. 그러나 그 구현 수단으로 §1.2/§1.1 의 노드/실행 상태 전이 구조를 `waiting_for_input → running → (completed|failed)` 의 2단계로 바꾸는 변경 3·4 는, spec 의 `## Rationale`(`waiting_for_input → failed 전이 추가`, L1252)이 "두 트랜잭션 분리로 단일 원자성이 깨진다"는 이유로 **명시적으로 검토·기각한 바로 그 대안**과 구조적으로 일치한다. draft 는 이를 "최종 상태 불변"이라는 표면적 논거로만 정당화하고 과거 기각의 실질 논거(트랜잭션 분리에 따른 원자성 약화)를 정면으로 다루지 않아, Rationale 연속성 관점에서 무근거 번복에 해당하는 CRITICAL 이슈가 있다. 이 지점을 spec 반영 전 명시적으로 해소(claim 이 원자성을 어떻게 유지하는지, 혹은 과거 기각 사유가 왜 더 이상 적용되지 않는지)해야 한다.

### 위험도
HIGH
