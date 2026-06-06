# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`
검토 모드: `--impl-prep` (구현 착수 전)

---

## 발견사항

### [INFO] heartbeat 키 패턴이 §9.2 키 목록에 잔존 — stalled-job 일원화 결정과 정합성 검토 필요

- target 위치: `spec/5-system/4-execution-engine.md` §9.2 용도별 키 정의 표 — `exec:{wsId}:worker:{workerId}:heartbeat` 행 (TTL 15초)
- 과거 결정 출처: 동일 문서 `## Rationale` — "§7.1 heartbeat → stalled-job 일원화 (2026-06-04 결정)". "별도 heartbeat 채널(워커 5초 emit + 중앙 검사) 도입을 **포기하고 BullMQ 내장 stalled-job 으로 일원화**한다(구 초안의 '헤드비트 미응답 기반 판정' 전제는 폐기)."
- 상세: Rationale 에서 별도 heartbeat 인프라를 BullMQ stalled-job 으로 교체하기로 확정했음에도, §9.2 키 목록에 `exec:{wsId}:worker:{workerId}:heartbeat` (TTL 15초)가 그대로 유지되어 있다. §7.1 본문에도 "현 구현: `recoverStuckExecutions()`가 절대시간 기반" 이며 "heartbeat 기반으로의 전환은 Planned" 라는 이중 설명이 공존한다. 이 키가 실제 구현에 쓰이는지, 아니면 Planned 상태에서만 남아 있는 잔재인지 명확하지 않다. stalled-job 일원화 결정에서 heartbeat emit 자체가 폐기됐다면 §9.2 표에서도 이 항목을 삭제하거나 "폐기 예정" 비고를 달아야 한다.
- 제안: §9.2 의 `heartbeat` 키 행에 "stalled-job 일원화(§Rationale / §7.1)로 폐기 예정" 비고 추가, 또는 PR1 단계에서 실제 구현이 없다면 삭제.

---

### [INFO] `resume_call_stack` (V087) 의 `_continuationCheckpoint` 기각 Rationale 가 §6.2 와 Rationale 두 곳에 분산 — 상호 참조만 충분

- target 위치: §6.2 저장 전략 표 `waiting_for_input` 진입 시 행, §Rationale "exec-park D6"
- 과거 결정 출처: 동일 문서 `## Rationale` — "별도 `_continuationCheckpoint` 컬럼 신설 기각: continuation 은 BullMQ 큐가 durable 운반하므로 불요." / "per-node task queue 기각과 다른 범주"
- 상세: §6.2 와 §Rationale 모두 `_continuationCheckpoint` 기각 이유를 반복 설명하고 있어 내용 충돌은 없다. 그러나 `resume_call_stack` (exec-park D6) 가 "per-node task queue 기각의 재도입이 아니다" 라는 설명이 Rationale 에만 있고 §6.2 본문에는 없어, 본문을 읽는 사람이 Rationale 를 함께 읽지 않으면 per-node 분산과 혼동할 여지가 있다. 현재 cross-link 은 "(§Rationale exec-park D6)" 형태로 있으므로 큰 문제는 아니다.
- 제안: 현재 상태 수용 가능. 단, §6.2 표의 `resume_call_stack` 비고에 "per-node 분산과 무관 — park 지점에서만 직렬화, §Rationale exec-park D6 참조" 한 줄 추가를 선택적으로 고려.

---

### [INFO] §9.2 키 패턴 예외 항목(`exec:recover:lock`, `exec:cont:seq:*`) 이 §9.1 규약과 충돌하지 않음을 본문에서만 설명 — Rationale 에 미기재

- target 위치: §9.2 표 하단 "전역 키 ... §9.1 패턴을 따르지 않는다" 비고
- 과거 결정 출처: §9.1 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴 (spec 본문 원칙으로 기록됨)
- 상세: §9.2 는 본문 비고에서 예외 이유를 간략 설명하지만, §Rationale 에 별도 항이 없다. 원칙 예외를 Rationale 에 기록하지 않아도 본문 비고로 충분할 수 있으나, 다른 스펙 섹션들(예: `##Rationale "DLQ 모니터링"`)이 훨씬 작은 결정도 Rationale 로 명문화하는 패턴과 비교하면 일관성이 낮다.
- 제안: 선택적. `##Rationale` 에 "Redis 전역 키 예외 — `exec:recover:lock` 와 `exec:cont:seq:*` 는 workspaceId 종속이 없어 §9.1 패턴 미적용" 항 추가 고려.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 Rationale 연속성 관점에서 전반적으로 양호하다. 과거 Rationale 에서 명시적으로 기각한 대안(per-node task queue, sticky fast-path, heartbeat 인프라, `waiting_for_retry` 상태 신설, Redis pub/sub, Temporal/Inngest 이전, `_continuationCheckpoint` 컬럼 신설, WAITING_FOR_INPUT → INTERRUPTED enum, `waitForRetry` 상태 신설, wall-clock 타임아웃, OTel Gauge 신설 등)은 모두 Rationale 에서 기각 처리된 채 본문에도 채택되지 않아 재도입 없음이 확인된다. 합의된 원칙(항상 BullMQ enqueue, execution-level 세그먼트 단위, park = 세그먼트 종료, bounded 메모리, single DB 트랜잭션 원자성, WebsocketService 단일 sink 등)도 본문 전반에서 일관되게 적용되고 있다. 다만 stalled-job 일원화 결정 이후에도 §9.2 에 heartbeat Redis 키가 잔존하는 점이 Rationale 와 소폭 불일치하며, 이 키 행의 상태 표기를 명확화하는 것이 권장된다. 나머지 두 발견사항은 문서 완결성 보완 제안 수준이다.

## 위험도

LOW
