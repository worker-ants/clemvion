STATUS: OK

---

# Cross-Spec 일관성 검토 결과

**검토 범위**: `spec/5-system/` (--impl-prep 모드)
**검토 대상 draft**: `plan/in-progress/spec-draft-exec-intake-queue.md` (execution-level intake 큐 재정의)
**검토 기준 시각**: 2026-06-04

---

## 발견사항

### [WARNING] `execution-run` 큐가 세 군데 SoT 에 미등록 상태

- **target 위치**: `spec-draft-exec-intake-queue.md §4.1`, §후속 동시 갱신 목록
- **충돌 대상**:
  1. `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` — `execution-continuation`·`background-execution`·13개 기존 큐만 등재. `execution-run` 미포함
  2. `/Volumes/project/private/clemvion/spec/5-system/16-system-status-api.md §1 대상 큐 레지스트리` — `background-execution`·`execution-continuation` 2개 execution 그룹 큐만 열거. `execution-run` 미포함
  3. `/Volumes/project/private/clemvion/spec/0-overview.md §2.6 Data Layer` — Redis BullMQ 큐 목록에 `execution-continuation`·`background-execution` 만 명시. `execution-run` 미포함
- **상세**: draft 의 §후속 동시 갱신 목록이 이 세 곳을 나열하고 있지만, 실제 spec 본문은 아직 갱신되지 않아 신규 큐 정의가 어느 SoT 에도 등록되지 않은 상태다. `spec/data-flow/0-overview.md §4` 는 명시적으로 "큐가 늘어나면 본 표와 해당 도메인 spec 모두 갱신한다"고 규정한다. `16-system-status-api.md` 의 `QueueRegistry` 도 `execution-run` 을 동적으로 포함해야 모니터링 커버리지가 유지된다.
- **제안**: spec 본문 반영 시 세 문서를 동시에 갱신해야 한다. `16-system-status-api.md §1` 표에 `execution-run | execution | EXECUTION_RUN_WORKER_CONCURRENCY(TBD) | 실행 시작 첫 active 세그먼트` 행 추가. 구현 착수 전 누락 상태를 인지하되, impl-prep 단계에서 spec 본문 미반영이 예상된 상태이므로 CRITICAL은 아님.

---

### [WARNING] `EXECUTION_TIMEOUT` 의미 분기 — 에러 코드 중복 오인 위험

- **target 위치**: `spec-draft-exec-intake-queue.md §5` — "신규 `EXECUTION_TIME_LIMIT_EXCEEDED` 코드 도입 (Code 노드 `EXECUTION_TIMEOUT`과 의미가 달라 분리)"
- **충돌 대상**:
  1. `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md §1.4` — `EXECUTION_TIMEOUT` 을 "워크플로우 또는 노드 실행 타임아웃"으로 정의. 범위가 모호하여 엔진 레벨 누적 타임아웃도 포함된다고 오해될 소지
  2. `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §8` — "최대 실행 시간 초과 → `EXECUTION_TIMEOUT` 에러" 라고 명시적으로 기록 (Planned 항목이지만 여전히 이 코드를 사용)
- **상세**: draft 는 `EXECUTION_TIME_LIMIT_EXCEEDED`(엔진 누적 active 타임아웃)와 `EXECUTION_TIMEOUT`(Code 노드 스크립트 타임아웃)을 의도적으로 분리하나, 현재 `3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 정의는 "워크플로우 또는 노드 실행 타임아웃"으로 양쪽을 모두 포함하는 범위다. 구현자가 에러 코드 카탈로그를 보면 `EXECUTION_TIMEOUT` 을 엔진 레벨 타임아웃에도 써야 하는지 혼동할 수 있다. `4-execution-engine.md §8` 표는 명시적으로 `EXECUTION_TIMEOUT` 을 참조하는데 draft 는 이를 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 교체하길 요구한다 — 기존 spec 과 직접 어긋난다.
- **제안**: draft 의 §후속 동시 갱신 목록대로 spec 본문 반영 시 (a) `3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 정의를 "Code 노드 스크립트 타임아웃 한정"으로 축소하고 `EXECUTION_TIME_LIMIT_EXCEEDED` 신규 행 추가, (b) `4-execution-engine.md §8` 표의 `EXECUTION_TIMEOUT` 참조를 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 교체. 두 갱신이 동시에 이루어지지 않으면 코드 vocabulary 가 분열한다.

---

### [WARNING] `spec/1-data-model.md §2.13` `Execution.error` — `WORKER_HEARTBEAT_TIMEOUT` 설명과 stalled 재큐 모델 불일치

- **target 위치**: `spec-draft-exec-intake-queue.md §3 §7.1 재정의`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/1-data-model.md §2.13` — `Execution.error.code` 어휘에 `WORKER_HEARTBEAT_TIMEOUT` 이 "30분 이상 heartbeat 없는 RUNNING Execution(§7.4)" 으로 정의됨
- **상세**: draft 는 `WORKER_HEARTBEAT_TIMEOUT` 을 "별도 heartbeat 폐기 → BullMQ stalled 재배달 attempts 소진 시 `failed`" 의미로 재정의하여 유지한다. 기존 data-model 의 설명 "30분 이상 heartbeat 없는 RUNNING Execution, §7.4" 는 더 이상 현 설계와 일치하지 않는다. 구현자가 data-model 을 참조하면 별도 heartbeat 검출 코드가 필요한 것으로 오해할 수 있다.
- **제안**: `1-data-model.md §2.13` 의 `WORKER_HEARTBEAT_TIMEOUT` 설명을 "active 세그먼트 job(`execution-run`/`execution-continuation`)이 BullMQ stalled 재배달 attempts 를 모두 소진하여 Execution `failed` 처리된 경우"로 교체. `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가. draft §후속 동시 갱신 목록에 이미 명시되어 있으나 실제 spec 미반영.

---

### [WARNING] `spec/0-overview.md §2.4 Execution Engine` — "노드 실행" 표현이 per-node 뉘앙스 유지

- **target 위치**: `spec-draft-exec-intake-queue.md §6`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/0-overview.md §2.4` — "Message Queue — 실행 태스크를 큐에 발행 / Worker Pool — 큐에서 태스크를 소비하여 **노드** 실행"
- **상세**: draft 가 제거 대상으로 명시한 "노드 실행" 뉘앙스가 현재 `0-overview.md §2.4` 에 그대로 남아 있다. 또한 동문 §2.4 의 Execution Engine 설명 블록에 "Execution intake 큐 (Redis/BullMQ `execution-run`)" 가 이미 부분 삽입된 흔적(`0-overview.md` 라인 81 "실행 엔진(Redis 큐 + 워커 풀, BullMQ 영속 `execution-continuation` 큐 기반 분산 continuation)")이 있으나 `execution-run` 은 미포함. §2.6 Data Layer Redis BullMQ 목록에도 `execution-run` 미기재.
- **제안**: spec 본문 반영 시 §2.4 · §2.6 동시 갱신. 특히 "noード 실행" → "실행 1건(active 세그먼트)을 통째로 처리" 로 교체.

---

### [WARNING] `spec/0-overview.md §6.1 시스템` — `execution-run` 큐 미언급, `execution-continuation` 만 기재

- **target 위치**: `spec-draft-exec-intake-queue.md §6`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/0-overview.md §6.1 시스템` 구현 완료 열 — "실행 엔진(Redis 큐 + 워커 풀, BullMQ 영속 `execution-continuation` 큐 기반 분산 continuation + §7.5 rehydration)"
- **상세**: intake 큐(`execution-run`) 가 구현되면 해당 설명에 `execution-run` intake 큐가 함께 언급돼야 한다. 현재는 `execution-continuation` 만 열거하여 intake 큐 부재 → fire-and-forget 단일 큐 구조로 오독 가능.
- **제안**: §6.1 구현 상태 설명에 `execution-run` intake 큐 추가. 단 이는 구현 완료 후 갱신 사안이므로 impl-prep 단계에서 방어적 인지.

---

### [INFO] `spec/5-system/4-execution-engine.md §9.3 BullMQ 큐 목록` — `execution-run` 행 미추가

- **target 위치**: `spec-draft-exec-intake-queue.md` §후속 동시 갱신 목록
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §9.3` — 현재 `execution-continuation` · `background-execution` 2행만 존재
- **상세**: draft 는 `execution-run` 큐를 §9.3 큐 목록에 추가하도록 명시하나, 현재 spec 본문 미반영. 구현자가 §9.3 만 보면 `execution-run` 큐의 `attempts`·jobId 패턴·`removeOnFail` 정책 등을 spec 에서 찾을 수 없다.
- **제안**: spec 본문 반영 시 §9.3 에 `execution-run | 실행 시작 첫 active 세그먼트 | 3회(TBD) | jobId: <executionId>:run:<seq>` 행 추가.

---

### [INFO] `spec/5-system/4-execution-engine.md §11 ENV 표` — `EXECUTION_RUN_WORKER_CONCURRENCY` 미등재

- **target 위치**: `spec-draft-exec-intake-queue.md §4.3`, §후속 동시 갱신 목록
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §11` ENV 변수 표 — `SIGTERM_GRACE_MS`, `RESUME_BULLMQ_ATTEMPTS`, `CONTINUATION_WORKER_CONCURRENCY` 등 기재, `EXECUTION_RUN_WORKER_CONCURRENCY` 미포함
- **상세**: draft §4.3 에 신규 env `EXECUTION_RUN_WORKER_CONCURRENCY`(기본값 TBD) 가 정의되나, §11 ENV 일람표에 미기재. 운영자·구현자가 ENV 목록을 참조할 때 해당 변수를 찾지 못한다.
- **제안**: spec 본문 반영 시 §11 ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY` 행 추가.

---

### [INFO] `triggerType` 필드 어휘 — `Trigger.type` 사용 확인 필요

- **target 위치**: `spec-draft-exec-intake-queue.md §4.2` — job 메시지의 `triggerType` 필드, "기존 `Trigger.type` enum 그대로 사용"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/1-data-model.md §2.8 Trigger` — `type` 필드 enum 어휘
- **상세**: draft 가 `Trigger.type` 어휘(`webhook`/`manual`/`schedule`)를 그대로 재사용한다고 명시하나, job 메시지 내 필드명 `triggerType` 이 기존 어디에도 정의되지 않은 신규 필드다. 어휘 재사용(충돌 없음) 자체는 정합하나, 신규 필드는 `1-data-model.md` 의 Execution 엔티티 또는 별도 큐 메시지 스키마 정의에 반영이 필요하다.
- **제안**: job 메시지 스키마를 §9.3 큐 목록 또는 §4.2 에 canonical 하게 명시하여 구현자가 참조 가능하도록 한다. `Trigger.type` 어휘 재사용 결정은 명시적이므로 추가 교정 불필요.

---

### [INFO] `spec/5-system/16-system-status-api.md §3 health 규칙 2` — `execution-run` 큐 추가 후 `waiting > 0 && active === 0` 규칙 오탐 가능성

- **target 위치**: `spec-draft-exec-intake-queue.md §4.3`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/16-system-status-api.md §3` — 규칙 2: `waiting > 0 && active === 0 → down (워커 미가동 추정)`
- **상세**: `execution-run` 큐가 추가되면, 실행이 burst 시 `waiting` 이 일시적으로 증가할 수 있다. 기존 §3 규칙 2 는 `waiting > 0 && active === 0` 를 "워커 미가동 추정"으로 해석하지만 "단일 스냅샷 휴리스틱이라 일시 오탐 가능"이라고 이미 단서를 달고 있다. intake 큐의 경우 burst 중에는 waiting 이 정상 상태에서도 발생할 수 있어 `down` 오탐 빈도가 높아질 가능성이 있다. 그러나 기존 규칙 자체가 오탐 허용 설계임을 명시하고 있으므로 직접 충돌은 아님.
- **제안**: `execution-run` 큐 추가 시 §3 주석에 "intake 큐(`execution-run`)의 경우 burst 시 `waiting > 0 && active === 0` 오탐이 더 빈번할 수 있으며 UI 는 "점검 필요(추정)" 뉘앙스 유지"를 부기하여 운영자 혼동 예방.

---

## 요약

`spec-draft-exec-intake-queue.md` 가 정의하는 execution-level intake 큐(`execution-run`) 모델은 기존 `spec/5-system/4-execution-engine.md` 의 `waiting_for_input` park 원칙·`execution-continuation` Continuation Bus·`§7.5 rehydration`·BullMQ 공통 패턴과 근본적으로 충돌하지 않는다. draft 자체가 동시 갱신이 필요한 문서 목록을 이미 나열하고 있어 설계자가 충돌 지점을 인지한 상태다. 그러나 **spec 본문이 아직 반영되지 않은 상태**에서 구현에 착수하면 세 곳의 SoT(`data-flow/0-overview.md §4`, `16-system-status-api.md §1`, `0-overview.md §2.6`)에 `execution-run` 이 누락된 채로 코드가 만들어지고, `3-error-handling.md` 의 `EXECUTION_TIMEOUT` 정의와 `1-data-model.md` 의 `WORKER_HEARTBEAT_TIMEOUT` 설명이 새 설계와 분리된 채로 남는다. 이 네 WARNING 사항은 모두 draft §후속 동시 갱신 목록에 명시된 것들이므로 구현 착수 전 spec 본문 반영을 먼저 완료하거나, 또는 구현 PR 과 spec 갱신 PR 을 함께 진행하는 것을 강하게 권장한다.

---

## 위험도

MEDIUM
