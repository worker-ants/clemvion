# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-exec-intake-queue.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `EXECUTION_TIME_LIMIT_EXCEEDED` — 기존 `EXECUTION_TIMEOUT` 과 의미 영역 중복 위험
  - target 신규 식별자: `EXECUTION_TIME_LIMIT_EXCEEDED` (§5, "엔진 레벨 누적 active 타임아웃 전용 신규 코드")
  - 기존 사용처:
    - `spec/5-system/3-error-handling.md:59` — `EXECUTION_TIMEOUT` 이 "워크플로우 또는 노드 실행 타임아웃" 으로 엔진 수준 에러 코드 표에 등재되어 있음
    - `spec/5-system/4-execution-engine.md:937` — `EXECUTION_TIMEOUT` 이 "최대 실행 시간 초과" 에러로 명시
    - `spec/4-nodes/5-data/2-code.md:246,269,286` — Code 노드의 스크립트 타임아웃 에러로 `EXECUTION_TIMEOUT` 사용
    - `codebase/backend/src/nodes/data/code/code.handler.ts:242,257,281,286,315` — `EXECUTION_TIMEOUT` 이 Code 노드 핸들러에서 실제 사용 중
    - `spec/5-system/14-external-interaction-api.md:532` — SSE payload 의 엔진 수준 에러 코드 예시로 `EXECUTION_TIMEOUT` 포함
    - `spec/conventions/chat-channel-adapter.md:387` — chat-channel 실패 분류기에서 `EXECUTION_TIMEOUT` 매핑
  - 상세: target draft 의 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 "엔진 레벨 누적 active 타임아웃"을 위한 신규 코드이고, `EXECUTION_TIMEOUT` 은 Code 노드 스크립트 타임아웃으로만 실제 사용 중이다(execution-engine.md §8 주석도 이를 명시). 두 코드가 공존하면 "execution-level 타임아웃"이라는 개념을 표현하는 에러 코드가 두 개가 되어 `spec/5-system/3-error-handling.md` 의 에러 코드 표가 `EXECUTION_TIMEOUT` 의 의미("워크플로우 또는 노드 실행 타임아웃")와 충돌한다. 특히 `3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 설명은 현재 "워크플로우 또는 노드 실행 타임아웃"으로 두 영역(엔진·노드)을 한 코드로 묶고 있는데, target 이 신규 코드로 엔진 레벨을 분리하면 `EXECUTION_TIMEOUT` 의 정의가 "Code 노드 스크립트 타임아웃 전용"으로 좁아져야 하나 기존 정의가 수정되지 않으면 불일치가 발생한다.
  - 제안: target spec 본문 반영 시 `spec/5-system/3-error-handling.md §1.4` 에서 `EXECUTION_TIMEOUT` 의 설명을 "Code 노드 스크립트 타임아웃 (`nodes/data/code/code.handler.ts`)" 으로 좁히고, `EXECUTION_TIME_LIMIT_EXCEEDED` 를 엔진 레벨 누적 active 타임아웃 코드로 신규 행에 추가하는 작업을 같은 spec 반영 커밋에 포함해야 한다. target 의 "후속 spec 본문 반영 시 동시 갱신 목록" 에 `spec/5-system/3-error-handling.md §1.4` 를 명시적으로 추가할 것을 권장.

---

### 발견사항 2

- **[INFO]** `execution-run` BullMQ 큐 이름 — 기존 큐 목록(§9.3)에 미등재, 신규 식별자 자체의 충돌은 없음
  - target 신규 식별자: `execution-run` (BullMQ 큐 이름)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:977-984` — `§9.3 BullMQ 큐 목록` 에 현재 `execution-continuation`, `background-execution` 두 큐만 등재. `execution-run` 이라는 이름은 기존 어디에도 사용되지 않음
  - 상세: 충돌 없음. 다만 target draft 의 "후속 spec 본문 반영 시 동시 갱신 목록" 이 `spec/5-system/4-execution-engine.md §9.3 큐 목록에 execution-run 행` 추가를 이미 명시하고 있어 인지된 상태. `spec/0-overview.md §2.6` 의 Redis 큐 목록에도 `execution-run` 추가가 필요하며 이도 draft 가 명시하고 있음.
  - 제안: spec 반영 시 누락 없이 §9.3 과 `0-overview.md §2.6` 양쪽 모두 갱신 확인.

---

### 발견사항 3

- **[INFO]** `EXECUTION_RUN_WORKER_CONCURRENCY` 환경변수 — 기존 사용처 없음, 신규 도입
  - target 신규 식별자: `EXECUTION_RUN_WORKER_CONCURRENCY` (§4.3)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:1081` — `CONTINUATION_WORKER_CONCURRENCY` 가 continuation worker 전용 ENV 로 존재. `EXECUTION_RUN_WORKER_CONCURRENCY` 는 어느 spec/코드에도 없음
  - 상세: 충돌 없음. 기존 `CONTINUATION_WORKER_CONCURRENCY` 와 접두사(`CONTINUATION_` vs `EXECUTION_RUN_`) 가 명확히 구분된다. target 이 "비양수·비정수·비숫자 입력 fallback 은 `CONTINUATION_WORKER_CONCURRENCY` 패턴 준용"으로 동작을 참조하므로 구현 시 일관성 유지 가능.
  - 제안: target 의 "spec 본문 반영 시 동시 갱신 목록"에 이미 `spec/5-system/4-execution-engine.md §11 ENV 표에 EXECUTION_RUN_WORKER_CONCURRENCY 행` 추가가 명시되어 있어 적절함.

---

### 발견사항 4

- **[INFO]** `jobId` 패턴 `<executionId>:run:<monotonic-seq>` — 기존 패턴과 구조는 유사하나 신규 세그먼트(`run`) 도입
  - target 신규 식별자: `<executionId>:run:<monotonic-seq>` (execution-run job 의 jobId 형식)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:798` — continuation job 의 jobId 는 `${executionId}:${nodeExecutionId}:${seq}` 패턴 사용. `exec:cont:seq:<executionId>` Redis 키가 이 seq 를 INCR 로 생성
  - 상세: 충돌 없음. 기존 continuation job 의 `jobId` 는 `executionId:nodeExecutionId:seq` 3-segment 패턴이고, target 의 `executionId:run:seq` 는 중간 segment 가 `nodeExecutionId` 가 아닌 리터럴 `run` 으로 다른 구조. 혼동 가능성은 낮다. 다만 `seq` 발급을 위한 Redis 카운터 키가 새로 필요한지(`exec:cont:seq` 와 공유 여부 또는 별도 `exec:run:seq` 신설 여부) target draft 에 명시되어 있지 않아 구현 시 결정이 필요함.
  - 제안: spec 본문 반영 시 §9.2 Redis 키 목록에 intake 큐용 seq 카운터 키 패턴(신설 또는 공유)을 명시.

---

### 발견사항 5

- **[INFO]** `WORKER_HEARTBEAT_TIMEOUT` 에러 코드의 의미 변경 연동 필요
  - target 신규 식별자: (신규 아님, 기존 코드) — 단, target 이 §7.1 "heartbeat 메커니즘 폐기 → BullMQ stalled-job 대체" 를 채택함으로써 이 코드의 의미가 달라짐
  - 기존 사용처:
    - `spec/1-data-model.md:447` — `Execution.error.code` 의 값 중 하나로 `WORKER_HEARTBEAT_TIMEOUT` 이 "부팅 시 recovery — 30분 이상 heartbeat 없는 RUNNING Execution" 으로 문서화
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2080` — `recoverStuckExecutions()` 에서 실제 사용 중
    - `spec/5-system/4-execution-engine.md:746` — "절대 시간 30분 임계 기반 stale 검출이며, 에러 코드 이름만 본 절을 선반영해 재사용"으로 이미 어색함이 인지된 상태
  - 상세: target 은 `recoverStuckExecutions()` 의 절대시간 일괄 fail 을 BullMQ stalled-job 재배달로 "대체 예정"으로 표기한다고 하며 구현 시 §7.2/§7.4 와 통합한다. 이 경우 `WORKER_HEARTBEAT_TIMEOUT` 코드가 더 이상 발급되지 않거나, 발급 시나리오가 달라진다. 신규 식별자 충돌 자체는 없으나, 기존 코드를 참조하는 `spec/1-data-model.md §2.13 Execution.error` 의 서술이 구현 완료 시 stale 해질 위험이 있다.
  - 제안: target 의 "후속 spec 본문 반영 시 동시 갱신 목록"에 `spec/1-data-model.md §2.13 Execution.error` 의 `WORKER_HEARTBEAT_TIMEOUT` 설명 갱신도 추가할 것을 권장.

---

## 요약

target draft 가 도입하는 신규 식별자 중 기존에 다른 의미로 사용 중인 동일 명칭은 발견되지 않는다. 가장 주목할 사항은 `EXECUTION_TIME_LIMIT_EXCEEDED` 신규 코드 도입 시 기존 `EXECUTION_TIMEOUT` 의 범위 정의가 충돌할 위험(WARNING)이다. `spec/5-system/3-error-handling.md §1.4` 가 `EXECUTION_TIMEOUT` 을 "워크플로우 또는 노드 실행 타임아웃"으로 폭넓게 정의하고 있어, 신규 코드와 공존하면 에러 코드 표가 의미적으로 모호해진다. 나머지 식별자(`execution-run` 큐명, `EXECUTION_RUN_WORKER_CONCURRENCY` ENV, jobId 패턴)는 기존과 겹치지 않으며, draft 내부에서 이미 갱신 대상 목록을 열거하고 있어 관리가 가능한 범위다. spec 반영 시 `3-error-handling.md` 와 `1-data-model.md §2.13` 동시 갱신을 빠뜨리지 않도록 주의가 필요하다.

## 위험도

LOW
