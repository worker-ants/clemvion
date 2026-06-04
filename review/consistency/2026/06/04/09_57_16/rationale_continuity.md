# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`
검토 모드: `--impl-done` (구현 완료 후, diff-base=origin/main)
검토 일시: 2026-06-04

---

## 발견사항

### [WARNING] job payload 에서 `triggerType` 필드 누락 — spec §4.2 명시 스키마와 불일치
- **target 위치**: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` `ExecutionRunJob` interface (L117-120) 및 `execution-engine.service.ts` `execute()` 내 `executionRunQueue.add()` 호출 (L2190-2204)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §4.2` job 메시지 스키마

  ```json
  {
    "jobId": "<executionId>:run:<monotonic-seq>",
    "executionId": "uuid",
    "input": { ... },
    "triggerType": "webhook"
  }
  ```

  > `triggerType` 값은 기존 `Trigger.type` enum(`webhook` / `manual` / `schedule`)만 허용한다(신규 어휘 도입 금지).

- **상세**: 구현의 `ExecutionRunJob` 은 `{ executionId, input? }` 만 담고 `triggerType` 을 payload 에 싣지 않는다. `triggerType` 은 `execute()` 내에서 priority 계산에만 사용되고 job 객체 밖으로 나가지 않는다. Spec §4.2 는 `triggerType` 이 job payload 의 일부임을 명시하고, §4.3 우선순위 표도 `triggerType → priority 매핑` 을 전제로 한다. 현 구현에서는 워커(`ExecutionRunProcessor`)가 `triggerType` 에 접근할 수 없어 향후 worker-side 우선순위 재판단·로깅·트리거 유형별 분기가 불가하다. 이는 Rationale "per-node → execution-level intake 큐" 에서 확정한 §4.2 payload 계약을 이유 명시 없이 partial 구현한 것이다. 단, 코드 내 TODO(PR2) 주석이 이 누락을 의도된 임시 처리로 밝히고 있으므로 silent 번복은 아니다.
- **제안**: (a) `ExecutionRunJob` 에 `triggerType?: ExecutionRunTriggerType` 필드를 추가하고 `execute()` 가 값을 전달하도록 수정하거나, (b) spec §4.2 job 스키마 주석에 "PR1 에서는 payload 에 포함하지 않고 priority 계산에만 사용, PR2(triggerType threading)에서 추가 예정" 임을 명시해 intent 를 공식화한다. 현 코드 주석만으로는 spec-impl gap 이 검토자에게 명확하지 않다.

---

### [WARNING] `jobId` 스키마 — spec `<executionId>:run:<seq>` vs 구현 `executionId` 단순 사용
- **target 위치**: `execution-run.queue.ts` `buildExecutionRunJobId()` (L57-61), `execution-engine.service.ts` `execute()` (L2192)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §4.2` job 메시지 스키마: `"jobId": "<executionId>:run:<monotonic-seq>"`
- **상세**: Spec 은 `<executionId>:run:<seq>` 형식을 명시한다. 구현은 `executionId` 자체를 jobId 로 사용한다(`buildExecutionRunJobId` 가 executionId 를 그대로 반환). 코드 주석은 "PR3/PR4 의 re-enqueue 시나리오를 위한 일반형이며 PR1 에서는 seq 불필요" 라는 근거를 설명하고 있어 의도된 단순화임은 알 수 있다. 단, spec 본문의 `§4.2` 는 이 단순화를 반영해 갱신되지 않았고, Rationale 에도 PR1 에서 `<executionId>:run:<seq>` 대신 `executionId` 만 사용한다는 결정이 별도 항목으로 기록되지 않았다. "새 Rationale 부재 번복" 에 해당한다.
- **제안**: spec §4.2 의 `jobId` 표기를 PR1 현실에 맞게 갱신(`"jobId": "<executionId>"` 또는 `"jobId": "<executionId>:run:<monotonic-seq> (PR1 은 seq 없이 executionId 단독)"`)하거나, Rationale 에 "PR1 에서의 jobId 단순화 결정" 항목을 추가해 §4.2 명시 형식에서 벗어난 근거를 공식화한다.

---

### [INFO] `sticky fast-path 제거 — "항상 publish" 원칙` 과 `execute()` 단계 routing context 이동의 일관성
- **target 위치**: `execution-engine.service.ts` `execute()` (routing context 등록 제거) 및 `runExecutionFromQueue()` (routing context 재등록)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "재개 경로의 outbound routing context 재등록"` 및 `"Durable Continuation & Graceful Shutdown — 항상 publish 원칙"`
- **상세**: Rationale 의 "항상 BullMQ enqueue 로 통일, sticky fast-path 제거" 원칙을 따라 execute() 에서 routing context 등록을 제거하고 worker(`runExecutionFromQueue`)에서 재등록하는 구조는 §7.5 rehydration 경로가 consumer 측에서 routing 을 재등록하는 패턴과 정합한다. Rationale 에 이 이동의 근거가 명시돼 있으며, 구현도 코드 주석에 동일한 근거를 반복한다. 연속성 위반 없음 — 확인 사항으로 기록.

---

### [INFO] `maxStalledCount: 0` — Rationale "BullMQ stalled-job 일원화(Planned)" 와의 관계
- **target 위치**: `execution-run.queue.ts` `EXECUTION_RUN_MAX_STALLED_COUNT = 0` (L82) 및 `ExecutionRunProcessor` `@Processor` 데코레이터
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "Phase 2 cont 후속 정리 — 3. 워커 크래시 복구 BullMQ stalled-job 일원화 (Planned)"`
- **상세**: Rationale 는 stalled-job 재배달을 PR3/PR4 에서 도입하고 PR1 에서는 `maxStalledCount: 0` 으로 비멱등 이중 실행을 방지한다고 명시한다. 구현이 이를 그대로 따르고 있다. Rationale 연속성 관점에서 정합하며, 향후 PR3/PR4 에서 stalled-job 재배달을 활성화할 때 spec Rationale 의 "목표(Planned)" 항목도 함께 갱신해야 함을 주의 사항으로 기록한다.

---

## 요약

구현은 전반적으로 `spec/5-system/4-execution-engine.md §Rationale` 의 핵심 결정들(per-node task queue 기각 + execution-level intake 큐 채택, sticky fast-path 제거 + 항상 enqueue 원칙, routing context 를 consumer worker 에서 등록, maxStalledCount:0 으로 비멱등 보호, active 세그먼트 모델)을 충실히 따르고 있다. 다만 §4.2 가 명시한 job payload 스키마(`triggerType` 필드, `<executionId>:run:<seq>` jobId 형식) 두 가지가 PR1 에서 의도적으로 단순화됐으나 이에 상응하는 spec 갱신·Rationale 추가가 이루어지지 않아, 결정 번복의 근거가 코드 주석에만 존재하고 spec 본문은 미완성 스키마를 가리키는 상태다. 이를 보완하는 spec 갱신 또는 Rationale 공식화가 필요하다.

## 위험도

LOW
