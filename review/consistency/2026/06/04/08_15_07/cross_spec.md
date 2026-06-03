# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-exec-intake-queue.md`
검토일: 2026-06-04

---

## 발견사항

### [WARNING] §7.1 stalled-job 전환 후 `WORKER_HEARTBEAT_TIMEOUT` 에러 코드 잔존 충돌
- target 위치: draft §3 "§7.1 재정의 — stalled-job 재큐"
- 충돌 대상: `spec/1-data-model.md §2.13` (`Execution.error` 컬럼 설명) + `spec/5-system/4-execution-engine.md §7.1`
- 상세: draft 는 §7.1 의 heartbeat 기반 표현을 BullMQ stalled-job 검출로 **전면 교체**하겠다고 선언한다. 그러나 `spec/1-data-model.md §2.13` 의 `Execution.error` 컬럼 설명에는 `WORKER_HEARTBEAT_TIMEOUT` 이 "(부팅 시 recovery — 30분 이상 heartbeat 없는 RUNNING Execution)" 이라는 설명과 함께 공식 error code 로 열거되어 있다. draft 가 spec 에 반영되면 이 에러 코드가 더 이상 "heartbeat 없는 RUNNING" 을 뜻하지 않거나 stalled-job 대체 경로에서 완전히 미발사되거나 다른 코드로 대체될 수 있다. 두 문서 중 어느 쪽이 SoT 인지 결정되지 않은 채 채택하면 data-model 과 engine 의 에러 코드 의미가 불일치한다. draft 후속 목록(`§후속` 의 `spec/1-data-model.md §2.13` 동기화 항목)은 이를 인지하고 있으나 구체적인 새 에러 코드 정의가 빠져 있다.
- 제안: spec 본문 반영 시 `spec/1-data-model.md §2.13` 의 `Execution.error.code` 열거를 **동시에** 갱신한다. `WORKER_HEARTBEAT_TIMEOUT` 을 (a) stalled-job 경로에서 계속 사용(`recoverStuckExecutions` 재명명 포함), (b) 새 코드로 교체, (c) 폐기 중 하나를 명시적으로 결정해 draft 에 기입해야 두 영역 동기화를 보장한다.

### [WARNING] §8 타임아웃 에러 코드 — `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` 명명 충돌
- target 위치: draft §5 "§8 재정의 — active-running 타임아웃 + 동시성 cap"
- 충돌 대상: `spec/5-system/4-execution-engine.md §8` + `spec/1-data-model.md §2.13`
- 상세: 현재 `spec/5-system/4-execution-engine.md §8` 에는 "최대 실행 시간 초과 → `EXECUTION_TIMEOUT` 에러" 라고 명시되어 있다. draft 는 "엔진 레벨 누적 active 타임아웃 전용 신규 코드 `EXECUTION_TIME_LIMIT_EXCEEDED`" 를 도입하고, code 노드의 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과 **의미가 달라 코드를 분리**한다고 명확하게 기술한다. 이는 올바른 방향이나, spec 본문(`§8` table) 의 `EXECUTION_TIMEOUT` 및 `spec/1-data-model.md` 의 `Execution.error` 어휘가 갱신되지 않으면 동일 용어가 두 개의 다른 에러 코드를 동시에 가리켜 혼란을 유발한다.
- 제안: draft 후속 목록에 이미 `spec/1-data-model.md §2.13` 동기화가 포함되어 있으나, `spec/5-system/4-execution-engine.md §8` 의 기존 `EXECUTION_TIMEOUT` 행을 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 교체(또는 두 코드를 구분해 병기)하는 것도 명시적으로 추가해야 한다.

### [WARNING] `execution-run` jobId 스키마와 continuation jobId 스키마의 일관성 검증 필요
- target 위치: draft §1 "4.2 작업 단위" — `"jobId": "<executionId>:run:<monotonic-seq>"`
- 충돌 대상: `spec/5-system/4-execution-engine.md §7.4` — `execution-continuation` jobId: `${executionId}:${nodeExecutionId}:${monotonic-seq}`
- 상세: `execution-run` job 의 jobId 가 `<executionId>:run:<monotonic-seq>` 로 정의되는데, `execution-continuation` 큐의 jobId 는 `${executionId}:${nodeExecutionId}:${monotonic-seq}` 형식이다. 두 형식이 의도적으로 다른 경우 (다른 네임스페이스) 라면 문서화가 필요하다. monotonic-seq 의 Redis 키 소스도 차이가 있다 — `execution-continuation` 은 `exec:cont:seq:<executionId>` (§9.2) 를 사용하는데, `execution-run` 큐의 seq 소스가 무엇인지 draft 에 명시되어 있지 않다. 같은 Redis seq 키를 공유하면 네임스페이스 충돌이 생기고, 별도 키를 쓰면 §9.2 키 패턴 테이블에 새 항목이 필요하다.
- 제안: spec 본문 반영 시 `spec/5-system/4-execution-engine.md §9.2` 에 `execution-run` 큐의 jobId seq Redis 키 패턴과 TTL 을 명시하고, `execution-continuation` 과의 네임스페이스 구분을 명확히 한다.

### [INFO] `spec/0-overview.md §2.4` "Message Queue — 실행 태스크를 큐에 발행 / Worker Pool — 큐에서 태스크를 소비하여 **노드** 실행" 표현
- target 위치: draft §6 "§0-overview §2.4 + Rationale 정직화"
- 충돌 대상: `spec/0-overview.md §2.4` 현재 본문
- 상세: 현재 `spec/0-overview.md §2.4` 에는 "**Message Queue** (Redis 기반) — 실행 태스크를 큐에 발행" / "**Worker Pool** (N개 인스턴스, 수평 확장) — 큐에서 태스크를 소비하여 노드 실행" 이라고 기술되어 있다. draft 가 이를 "execution-level intake 큐(`execution-run`)에 실행 시작을 발행 / 워커가 실행 1건(active 세그먼트)을 통째로 처리" 로 정정한다는 계획은 spec 내용과 정합하는 바람직한 방향이다. 이를 주 INFO 로 기록해 반영 범위를 확인한다.
- 제안: spec 반영 시 `spec/0-overview.md §2.4` 와 §6.1 구현 완료 표의 "시스템" 행 ("실행 엔진(Redis 큐 + 워커 풀, BullMQ 영속 `execution-continuation` 큐 기반 분산 continuation + §7.5 rehydration)") 도 `execution-run` intake 큐를 포함하도록 갱신한다.

### [INFO] `spec/0-overview.md §2.6` Redis BullMQ 큐 목록에 `execution-run` 미포함
- target 위치: draft §6 "`§2.6 Redis 큐 목록에 `execution-run` 추가`"
- 충돌 대상: `spec/0-overview.md §2.6`
- 상세: 현재 §2.6 의 Redis 설명에는 BullMQ 큐로 "`execution-continuation` / `background-execution`" 만 열거되어 있다. draft 가 `execution-run` 추가를 후속 목록에 포함하고 있으므로 INFO 수준이다.
- 제안: spec 반영 시 §2.6 큐 목록에 `execution-run` (intake 큐) 행 추가.

### [INFO] `spec/5-system/4-execution-engine.md §9.3` BullMQ 큐 목록 미동기화
- target 위치: draft §1 (§4.1–4.3 재정의), 후속 목록 "`§9.3 큐 목록에 execution-run 행`"
- 충돌 대상: `spec/5-system/4-execution-engine.md §9.3`
- 상세: 현재 §9.3 의 BullMQ 큐 목록에는 `execution-continuation` 과 `background-execution` 두 개만 있으며, "일반 노드 실행은 별도 큐 없이 `runExecution` 의 in-process while-loop 에서 직접 dispatch (§2.1) — 별도 `task-queue` 는 존재하지 않는다" 라고 주석이 달려 있다. `execution-run` 도입 시 이 주석과 큐 목록 모두 갱신이 필요하다. draft 후속 목록에 이미 포함되어 있으나 INFO 로 기록한다.
- 제안: spec 반영 시 §9.3 에 `execution-run` 행(역할: 첫 active 세그먼트 intake, concurrency: `EXECUTION_RUN_WORKER_CONCURRENCY`) 추가 및 in-process 주석 갱신.

### [INFO] `spec/5-system/4-execution-engine.md §11` ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY` 미포함
- target 위치: draft §1 "4.3 수평 확장" — `EXECUTION_RUN_WORKER_CONCURRENCY`
- 충돌 대상: `spec/5-system/4-execution-engine.md §11` (ENV 테이블)
- 상세: 신규 환경변수 `EXECUTION_RUN_WORKER_CONCURRENCY` 가 draft 에서 정의되나 기존 §11 ENV 표에 없다. draft 후속 목록에 포함됨.
- 제안: spec 반영 시 §11 ENV 표에 추가.

### [INFO] `spec/1-data-model.md §2.8 Trigger.type` enum — `triggerType` 어휘 충돌 위험
- target 위치: draft §1 "4.2 작업 단위" — `"triggerType": "webhook"` 과 `> triggerType 값은 기존 Trigger.type enum … 을 그대로 사용한다 — 신규 어휘(trigger 등) 도입 금지` 주석
- 충돌 대상: `spec/1-data-model.md §2.8 Trigger` 엔티티 (`type: Enum | webhook / schedule / manual`)
- 상세: draft 가 `Trigger.type` enum 을 `triggerType` job 필드에 재사용하겠다고 명시하고 있어 data model spec 과 일치한다. 신규 어휘 도입을 금지한다는 주석도 포함되어 있다. 충돌 위험을 방지하기 위한 명시적 확인이므로 INFO 로 기록한다.
- 제안: spec 반영 시 `triggerType` 필드가 `Trigger.type` enum 값만 허용됨을 실행 엔진 spec(§4.2) 에 명시해 두면 향후 신규 trigger type 추가 시 자동으로 양쪽이 동기화된다는 점을 확인한다.

---

## 요약

target draft 는 기존 aspirational(per-node task queue) 아키텍처를 execution-level intake 큐로 재정의하는 방향으로 기존 `spec/5-system/4-execution-engine.md` 과 `spec/0-overview.md` 과 대체로 정합한다. 핵심 설계 결정(waiting_for_input 의 durable park·stalled-job 일원화·active-running 타임아웃)은 기존 §7.4/§7.5 의 원칙과 직교하지 않으며 강화하는 관계다. CRITICAL 충돌은 없다. 두 WARNING 은 에러 코드 어휘(`WORKER_HEARTBEAT_TIMEOUT` 폐기/유지 결정, `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` 분리) 를 `spec/1-data-model.md §2.13` 과 동시에 갱신하지 않으면 두 영역 중 하나가 잘못된 에러 코드 의미를 기술하게 된다. draft 후속 목록에 이미 대부분의 연동 갱신 대상이 열거되어 있으나, 새 에러 코드 정의(`EXECUTION_TIME_LIMIT_EXCEEDED`) 와 `WORKER_HEARTBEAT_TIMEOUT` 의 처리 방향을 draft 에 명시적으로 기입하는 것이 리스크를 낮춘다. `execution-run` jobId 의 monotonic-seq Redis 키 소스도 spec 반영 전에 결정해야 `spec/5-system/4-execution-engine.md §9.2` 키 패턴 일관성이 유지된다.

---

## 위험도

MEDIUM
