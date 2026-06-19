# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`
검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 일시: 2026-06-19

---

## 발견사항

- **[INFO]** `exec:{wsId}:worker:{workerId}:heartbeat` Redis 키와 Rationale "heartbeat 미신설" 결정 간 외형 충돌
  - target 위치: `spec/5-system/4-execution-engine.md` §9.1 sub 예시(`heartbeat`) 및 §9.2 키 정의 표 `exec:{wsId}:worker:{workerId}:heartbeat` 행
  - 과거 결정 출처: 동일 문서 `## Rationale` "§7.1 heartbeat → stalled-job 일원화" — "별도 heartbeat 채널(워커 5초 emit + 중앙 검사 경로)을 신설하지 않는다. 별도 heartbeat emit/검사 인프라는 BullMQ stalled 메커니즘과 기능 중복이라 YAGNI."
  - 상세: Rationale 이 heartbeat 인프라를 "미신설·YAGNI" 로 기각했음에도 §9.1 sub 예시에 `heartbeat` 가 남아 있고 §9.2 키 표에도 heartbeat 키가 "Planned" 표시 없이 등재되어 있다. 이는 Rationale 의 기각 결정과 외형상 충돌한다. 실제 구현 여부와 무관하게 spec 독자가 두 문장을 동시에 읽으면 혼란을 일으킨다.
  - 제안: §9.1 sub 예시에서 `heartbeat` 를 제거하거나, §9.2 heartbeat 키 행에 "(Planned — stalled-job 일원화 대체 예정, §7.1 Rationale 참조)" 주석을 추가해 기각 결정과의 관계를 명시한다.

- **[INFO]** `EngineDriver` 내부 계약의 본문 기술 부재로 인한 기각 대안 재도입 위험
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale "C-1 god-class 분할" — `EngineDriver`(`token ENGINE_DRIVER, useExisting: ExecutionEngineService`) 및 `WorkflowExecutor` 재사용 기각 항목; §1.3 구현 위치 주석
  - 과거 결정 출처: 동일 문서 §4.4 Rationale — "`IExecutionEventEmitter` 같은 인터페이스 추상화를 도입하지 않는다" 및 §Rationale C-1 — "`WorkflowExecutor` 재사용 기각 (nodes→engine 공개 계약에 과적)"
  - 상세: `EngineDriver`(engine 내부 계약)와 `WorkflowExecutor`(nodes→engine 공개 계약)의 역할 구분은 Rationale 에만 기술되고 본문 어디서도 두 계약이 각자의 소관 범위를 정의하지 않는다. 후속 구현자가 `WorkflowExecutor` 를 engine 내부 통신에 재사용하거나 `EngineDriver` 위에 추상화 인터페이스를 얹으려 할 때 기각 근거가 가시적이지 않다.
  - 제안: §1.3 구현 위치 주석 또는 §5 NodeHandlerRegistry 절에 `EngineDriver`(engine 내부 전용 / in-process) vs `WorkflowExecutor`(nodes→engine 공개 계약) 구분을 한 줄이라도 본문 기술로 포함해 기각 대안 재도입 벡터를 줄인다.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 기각된 대안(per-node task queue, Redis pub/sub, in-memory 코루틴 park, heartbeat 인프라, `_resumeState` DB 미영속, `waiting_for_retry` 상태 신설, Temporal/Inngest 이전, sticky fast-path, `IExecutionEventEmitter` 추상화 등)을 이유 명시 없이 재도입하는 내용이 없으며, 합의된 invariant(`waiting_for_input` 무기한 park, active-running 누적 타임아웃, 단일 BullMQ enqueue, WebsocketService 단일 sink, per-node task queue 금지)도 본문 전반에 걸쳐 일관되게 유지된다. INFO 2건은 §9 Redis 키 표의 heartbeat 잔존과 EngineDriver/WorkflowExecutor 역할 경계의 본문 가시성 부재에 관한 보완 제안이며, 설계 방향 번복이나 invariant 위반이 아니다. Rationale 연속성 관점에서 구현 착수를 차단할 이슈는 없다.

---

## 위험도

NONE
