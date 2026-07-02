### 발견사항

- **[WARNING]** `data-flow/3-execution.md §3.2` NodeExecution 상태 다이어그램이 신규 `waiting_for_input → running` 전이 갱신 대상에서 누락
  - target 위치: "변경 3"(§1.2 NodeExecution 상태), "side-effect 점검 대상" 목록
  - 충돌 대상: `spec/data-flow/3-execution.md §3.2` (`node_execution.status` mermaid `stateDiagram-v2`, L266-283)
  - 상세: draft 는 `spec/5-system/4-execution-engine.md §1.2` 의 NodeExecution 상태 다이어그램에 `waiting_for_input ──► running` 화살표를 신규 추가한다고 명시한다(변경 3). 그러나 동일 엔티티(`node_execution.status`)의 **병행 상태 다이어그램**인 `data-flow/3-execution.md §3.2` 는 현재 `waiting_for_input --> completed`, `waiting_for_input --> failed` 두 전이만 정의하고 `waiting_for_input --> running` 이 없다(§3.1 `execution.status` 다이어그램에는 이미 `waiting_for_input --> running: continuation-queue (BullMQ) consume` 이 있지만, 이는 Execution 레벨이지 NodeExecution 레벨이 아니다). draft 를 그대로 적용하면 `execution-engine.md §1.2` 와 `data-flow/3-execution.md §3.2` 가 **같은 엔티티의 상태 머신을 다르게 기술**하게 된다. draft 의 "side-effect 점검 대상" 목록은 `data-flow/3-execution.md §1.4`(시퀀스 다이어그램, 변경 7)만 언급하고 §3.2(상태 다이어그램)를 빠뜨렸다.
  - 제안: 변경 7 범위를 §1.4 시퀀스 다이어그램뿐 아니라 §3.2 `node_execution.status` mermaid 에도 `waiting_for_input --> running: 재개 진입 원자 claim (§7.5, affected=1)` 전이를 추가하도록 확장. 동일하게 §3.1 `execution.status` 의 기존 `waiting_for_input --> running: continuation-queue (BullMQ) consume` 라벨도 "claim 성공(affected=1)" 조건을 반영하도록 갱신 여부 검토.

- **[INFO]** `data-flow/3-execution.md §1.4` 시퀀스 다이어그램의 `running` 전이 시점이 claim(진입 gate) 시점과 다르게 그려짐 — target 자체가 이미 인지·처리
  - target 위치: "변경 7"
  - 충돌 대상: `spec/data-flow/3-execution.md §1.4` L165 `Eng->>PG: UPDATE execution SET status='running' + UPDATE node_execution SET status='completed'`
  - 상세: 확인 결과 이 UPDATE 는 rehydration 시퀀스 **끝부분**(turn 처리 완료 후 커밋 단계)에 위치해 있어, draft 가 지적한 대로 "running 전이는 최종 커밋 단계로 그려져 있다"는 서술이 정확하다. draft 는 이를 이미 "변경 7"로 인지하고 다이어그램 반영 또는 drift 인지 문구 등재를 제안했으므로 별도 조치 불요 — 위 §3.2 WARNING 과 함께 일괄 처리 권장.
  - 제안: (조치 불요, §3.2 WARNING 과 동일 PR 에서 함께 처리 권장)

- **[INFO]** V095 partial index 인용은 정확 — 신규 인덱스 불요 판단 근거 확인됨
  - target 위치: "side-effect 점검 대상" 중 `1-data-model.md §3` 항목
  - 충돌 대상: `spec/1-data-model.md` L840 `(execution_id, status) WHERE status IN ('waiting_for_input','running')` (V095)
  - 상세: draft 가 인용한 인덱스 정의를 확인했다 — claim UPDATE(`WHERE status='waiting_for_input'`, `execution_id` 스코프)의 핫경로를 실제로 커버한다. draft 의 "신규 인덱스 불요" 판단은 근거가 정확하다.
  - 제안: 없음 (확인만).

- **[INFO]** `§1.3 _retryState` "affected=1" 패턴 인용 검증 — 정확
  - target 위치: "개정 방향", "변경 6"
  - 충돌 대상: `spec/5-system/4-execution-engine.md` L177 (`_retryState` 소비 로직)
  - 상세: 원문은 "키 제거가 **affected=1** 인 쪽만 진행해 동시 retry 중복 spawn 차단"으로, draft 가 "일반화"로 인용한 패턴과 정확히 일치한다. Rationale 신규 소절의 "기존 패턴의 일반화" 논거는 spec 인용이 정확하다.
  - 제안: 없음 (확인만).

- **[INFO]** `§7.4 recoverStuckExecutions` "RUNNING 대상" 인용 검증 — 정확, 단 명시적 30분 룰 언급은 없음
  - target 위치: "변경 1" 끝부분("claim 후 worker 크래시로 남은 running row 는 §7.4 recoverStuckExecutions(RUNNING 대상)가 회수한다")
  - 충돌 대상: `spec/5-system/4-execution-engine.md §7.4` "Recovery" (L899-906), `data-flow/3-execution.md §3.3` (L285-292)
  - 상세: 두 문서 모두 `recoverStuckExecutions` 가 `status='running' AND started_at < now() - 30분(STUCK_RECOVERY_STALE_MS)` 인 row 만 대상으로 하고 `waiting_for_input` 은 무기한 보존한다고 일관되게 서술한다. draft 의 인용은 정확하며 claim 후 크래시 시나리오(row 가 `running` 으로 전이된 채 남음)가 이 기존 메커니즘으로 자연 커버된다는 논증도 구조적으로 타당하다. 다만 draft 는 "claim 성공 직후 ~ rehydration 실질 시작 전"의 매우 짧은 창에서도 이론상 이 row 가 (통상 수 ms 내 즉시 이어지는 rehydration 대비) 30분 룰의 대상이 된다는 점을 명시하지 않는다 — 실질 위험은 낮으나(claim과 rehydration 이 사실상 같은 트랜잭션 흐름 내에서 이어짐) 명시적 언급이 없다.
  - 제안: 변경 1 또는 Rationale 신규 소절에 "claim 성공 후 정상 흐름에서는 즉시 rehydration 이 이어지므로 30분 stale 창에 노출되는 것은 worker 크래시 등 비정상 케이스에 한정된다"는 1줄 명시 권장(선택적, WARNING 아님).

### 요약

Cross-Spec 관점에서 draft(spec-draft-c2-atomic-claim.md rev2)는 `execution-engine.md` 내부 정합성(§1.1/§1.2/§7.4/§7.5/Rationale)과 `1-data-model.md`(V095 인덱스) 인용은 모두 정확히 검증됐고, `6-websocket-protocol.md` §4.2 ack 계약과의 무영향 주장도 확인상 타당하다. 다만 `data-flow/3-execution.md` 는 두 곳에서 target 이 변경하는 NodeExecution/Execution 상태 머신과 병행 서술을 갖고 있는데, draft 의 "side-effect 점검 대상"이 그중 §1.4(시퀀스 다이어그램)만 짚고 §3.2(`node_execution.status` mermaid 상태 다이어그램)를 놓쳤다 — 이 문서를 갱신하지 않으면 execution-engine.md §1.2 와 data-flow/3-execution.md §3.2 가 동일 엔티티의 상태 전이를 서로 다르게 기술하는 drift 가 생긴다. 이는 target 자신의 "변경 7"의 자연스러운 확장 범위이므로 spec 반영 시 함께 처리하면 되는 낮은 비용의 보강이며, 구조적 재설계나 Option A 자체의 재검토를 요하지 않는다.

### 위험도
LOW
