# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-exec-intake-queue.md`
검토 기준 Rationale 출처: `spec/5-system/4-execution-engine.md §Rationale`, `spec/0-overview.md §Rationale`

---

## 발견사항

- **[INFO]** per-node task queue 기각 — Rationale 에 명시 근거 있음, 정합
  - target 위치: §Rationale "per-node task queue → execution-level intake 큐 (§4 재정의)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4 본문 banner — "§4.1~4.3 은 미구현 (Planned) … 1 Worker = 1 NodeExecution … per-node Worker·heartbeat·우선순위 큐는 어느 것도 구현돼 있지 않다"
  - 상세: 기존 §4 에서 per-node 모델(1 Worker = 1 NodeExecution)은 aspirational/미구현 으로만 표기됐으며 기각된 것이 아니라 미채택 상태였다. target draft 는 이를 명시적으로 **폐기 결정**하고 execution-level intake 큐를 채택하는 동시에, §Rationale 에서 per-node 기각 근거(context 직렬화 비용, rehydration 인프라 미준비, 엔진 재작성급 위험)를 상세히 작성했다. 따라서 기존에 "Rationale 에서 명시적으로 거부된" 대안을 재도입하는 것이 아니라, 반대로 aspirational 대안을 공식 기각하는 방향이다. Rationale 연속성 위반 없음.

- **[INFO]** heartbeat 기반 Recovery 전환 방향과 target §3 의 BullMQ stalled-job 대체 — 원칙 정합
  - target 위치: §3 "§7.1 재정의 — stalled-job 재큐 (active 세그먼트 한정)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale` "Phase 2 cont 후속 정리 — 3. heartbeat 기반 Recovery 전환 — 목표 방향 (현재 미구현)"
  - 상세: 기존 Rationale §3 은 "heartbeat 5초/미응답 15초 → 해당 태스크 재큐" 를 목표 방향(Planned)으로 기술하면서, 그 실현은 "§4 Worker/task-queue 모델과 함께 도입될 때"라고 명시했다. target draft 는 §4 를 per-node task queue 에서 execution-level intake 큐로 교체하면서 heartbeat 별도 메커니즘 표현을 폐기하고 BullMQ stalled-job 검출로 대체한다. 두 메커니즘의 목적(크래시 워커 검출 + 재배달)이 동일하므로 원칙 위반이 아니다. 다만 기존 Rationale 에 "heartbeat 5초/15초/재큐" 가 aspirational 목표로 명시돼 있으므로, target draft §3 이 이 방향을 BullMQ stalled-job 으로 구체화하면서 old heartbeat aspirational text 를 폐기함을 Rationale 에서 명시하고 있는지 확인 필요.
  - 보완: target §Rationale 에 "기존 §7.1 heartbeat 5초/15초/재큐 aspirational을 BullMQ stalled-job 검출로 대체 결정" 임을 한 줄 추가하면 번복 이유가 명문화된다. 현재는 §3 본문에 "별도 heartbeat 메커니즘 표현을 폐기하고 … BullMQ stalled-job 검출로 대체" 라고 기재되어 있어 사실상 충족에 가깝지만, Rationale 절에서 직접 언급이 없어 추적성이 약하다.

- **[INFO]** `0-overview.md` Rationale "NodeExecution = 워커가 핸들러 호출" 문구 정정 — 번복 Rationale 필요
  - target 위치: §6 "§0-overview §2.4 + Rationale 정직화"
  - 과거 결정 출처: `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)"` — "Execution = 큐 작업, NodeExecution = 워커가 핸들러 호출"
  - 상세: target draft 는 0-overview Rationale 의 "NodeExecution = 워커가 핸들러 호출" 문구를 "execution-level 세그먼트 모델로 정정하고, 본 결정(§아래 Rationale)으로 링크" 하겠다고 선언한다. 이 문구는 현재 `spec/0-overview.md` line 383 에 남아있는 채택된 설명문이다. 정정 자체는 spec-draft 가 신규 Rationale 를 작성함으로써 번복 근거를 제공하므로 절차 위반은 아니다. 단, 실제 spec 반영 시 0-overview Rationale 에서 구 문구를 단순 삭제가 아니라 "변경 이유 + 링크"로 업데이트해야 Rationale 연속성 원칙을 충족한다.

- **[WARNING]** `recoverStuckExecutions()` 절대시간 일괄 fail 의 "대체 예정" 표기 — 번복 Rationale 부재
  - target 위치: §3 마지막 문장 — "`recoverStuckExecutions()` 절대시간(... 30분) 일괄 fail 은 이 stalled 메커니즘으로 대체 예정으로 표기한다(구현 시 §7.2/§7.4 와 통합)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §7.1 banner` — "현 동작은 Execution 일괄 `failed` 마킹 (재큐 아님)" 및 §Rationale "3. heartbeat 기반 Recovery 전환 — 목표 방향 (현재 미구현)" 에서 절대시간 방식의 한계(false positive 위험)를 이미 진단했으나, 기존 Rationale 에는 "목표 방향" 으로만 서술됐다.
  - 상세: 기존 Rationale 는 heartbeat 전환을 목표로 선언했지만 "stalled-job 으로 `recoverStuckExecutions()` 를 대체" 라는 구체적 결정 근거가 없다. target draft 는 §3 본문에 대체 예정을 언급하면서도 draft Rationale 절에서 이 대체 결정의 구체 근거(왜 stalled-job 이 heartbeat 별도 구현보다 나은가)를 명시하지 않고 있다. 기존 §7.1 의 "heartbeat 5초/15초/재큐" aspirational 목표가 spec 에 남아 있는 상태에서 stalled-job 으로 전환한다는 결정 이유가 target Rationale 에 없으면, 미래 독자가 두 방향이 공존하는 것으로 오인할 수 있다.
  - 제안: draft Rationale 의 "per-node task queue → execution-level intake 큐" 항 또는 별도 항에 "§7.1 heartbeat 별도 구현을 포기하고 BullMQ stalled-job 검출로 일원화하는 이유 — BullMQ 자체 stalled-job 메커니즘이 동일 목적(크래시 워커 검출·재배달)을 추가 heartbeat emit 없이 충족하며, execution-level job 모델에서 per-node heartbeat 는 불필요해짐" 을 한 단락 추가할 것.

- **[INFO]** `waiting_for_input` 무기한 보존 원칙 — 강화 정합
  - target 위치: §2 및 §3 전반
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §7.4 Recovery`, §Rationale "Durable Continuation" — "`waiting_for_input` 은 무기한 보존 — 사용자 입력은 며칠 후 도착할 수도 있고"
  - 상세: target draft 는 `waiting_for_input` 이 "job 없음 · heartbeat 없음 · TTL 없음 · stalled 재큐 대상 아님 · stuck-recovery 대상 아님" 임을 재확인하며 기존 Rationale 의 invariant 를 강화한다. 충돌 없음.

- **[INFO]** active-running 누적 타임아웃 — 신규 결정, 기존 Rationale 와 충돌 없음
  - target 위치: §5 / §Rationale "타임아웃을 active-running 누적 기준으로"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §8` — 미명시 (wall-clock 인지 active 시간인지 미기재)
  - 상세: 기존 §8 에는 "단일 Execution 최대 실행 시간 30분" 이라는 수치만 있고 기준이 미명시였다. target draft 가 active-running 누적 기준으로 명문화하면서 wall-clock 기각 근거를 Rationale 에 작성한다. 기존 Rationale 에서 이 쟁점을 결정한 항목이 없으므로 번복이 아닌 신규 결정이다.

---

## 요약

target draft 의 핵심 설계 변경(per-node task queue 폐기 → execution-level intake 큐 채택)은 기존 spec Rationale 에서 명시적으로 "채택된" 결정을 번복하는 것이 아니라, aspirational(미구현) 방향을 공식 기각하면서 충분한 새 Rationale 를 함께 제시하고 있다. `waiting_for_input` 무기한 보존·WebsocketService 단일 sink·Continuation Bus 등 기존 Rationale invariant 도 모두 준수된다. 단 §7.1 heartbeat 별도 메커니즘(aspirational) 과 `recoverStuckExecutions()` 절대시간 방식을 BullMQ stalled-job 으로 대체하는 결정의 구체 근거가 draft Rationale 에서 충분히 서술되지 않아 WARNING 하나가 발생한다. 전반적으로 Rationale 연속성은 잘 유지되며 주요 위험은 없다.

---

## 위험도

LOW
