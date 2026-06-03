# 신규 식별자 충돌 분석 — spec-draft-exec-intake-queue

target: `plan/in-progress/spec-draft-exec-intake-queue.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] `EXECUTION_TIMEOUT` 에러 코드 — 의미 충돌
- **target 신규 식별자**: target §5 "초과 시: `EXECUTION_TIMEOUT` → Execution `failed`" — 엔진 레벨 active-running 누적 시간 초과를 뜻하는 에러 코드로 제안
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §8 (line ~937): `최대 실행 시간 초과 → EXECUTION_TIMEOUT 에러 → Execution.status = failed` (aspirational, 미구현)
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.ts` (lines 238, 242, 257, 281, 282, 286, 315): `EXECUTION_TIMEOUT` 이 **Code 노드의 스크립트 실행 타임아웃** 에러 코드로 이미 사용 중 (`ERR_SCRIPT_EXECUTION_TIMEOUT` → `EXECUTION_TIMEOUT`)
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` (line 38): `EXECUTION_TIMEOUT` 이 chat-channel 실패 분류기의 에러 코드 집합에 포함
  - `spec/5-system/4-execution-engine.md` §8 주석(line ~925): "`EXECUTION_TIMEOUT` 은 `code` 노드의 스크립트 타임아웃과 chat-channel 실패 분류기 문자열로만 존재하며, 엔진 레벨 실행시간 timeout 이 아니다"
- **상세**: 기존 코드에서 `EXECUTION_TIMEOUT` 은 Code 노드 내부의 스크립트 실행 타임아웃을 뜻한다. target 은 이 동일 에러 코드를 엔진 레벨 active-running 누적 시간 초과에 재사용하려 한다. 의미 도메인이 다르다(노드 스크립트 타임아웃 vs. Execution 전체 누적 active 시간 초과). 기존 spec §8 도 미구현 aspirational 로 같은 이름을 사용하므로 target 과 목표 방향은 일치하나, Code 노드 구현과의 충돌이 실제로 존재한다. 엔진 레벨 타임아웃이 도입되면 동일 에러 코드 문자열이 두 맥락(노드 스크립트 / 엔진 전체)에서 발화되어 에러 원인 파악이 모호해진다.
- **제안**: 엔진 레벨 Execution 누적 active 시간 초과에는 별도 에러 코드를 명시한다. 예: `EXECUTION_ACTIVE_TIMEOUT` 또는 `EXECUTION_TIME_LIMIT_EXCEEDED`. Code 노드의 `EXECUTION_TIMEOUT` 은 그대로 유지한다. spec-draft 에 이를 반영하고 구현 시 code.handler.ts 와 chat-channel 분류기가 이 새 코드를 어떻게 처리할지(fail-transient 여부) 명시한다.

---

### [WARNING] `triggerKind` 필드 — 기존 코드/규약에 미등장, 독자 도입
- **target 신규 식별자**: `execution-run` job 메시지 내 `"triggerKind": "manual | trigger | schedule"` 필드
- **기존 사용처**:
  - 기존 spec 및 코드베이스에 `triggerKind` 라는 이름의 필드는 발견되지 않는다.
  - `spec/1-data-model.md` §2.8 Trigger 의 `type` 필드: `Enum — webhook / schedule / manual` (기존 트리거 분류는 `type` 으로 표현)
  - `spec/5-system/4-execution-engine.md` §7.4 continuation 메시지 타입: `continue / cancel / button_click / ai_message / ai_end_conversation / retry_last_turn` (triggerKind 없음)
  - 코드베이스에서 `triggerKind` 검색 결과 없음 (`grep` 상 미발견)
- **상세**: `triggerKind` 는 target 이 신규 도입하는 job 메시지 필드다. 기존 Trigger.type enum (`webhook / schedule / manual`) 과 의미 유사하나 명칭이 다르다. target 에서 제안하는 `"manual | trigger | schedule"` 열거값은 Trigger.type 의 `webhook` 를 `trigger` 로 교체한 것인데, `webhook` / `manual` / `schedule` 이 이미 시스템 전반에서 확립된 용어여서 새 열거값 `trigger` 가 혼동을 유발할 수 있다. "trigger 실행" 이라는 표현은 "트리거에 의한 실행"이라는 범용 의미로 읽히기 쉬우나, 이 문맥에서는 webhook 실행만을 뜻하는 것으로 추정된다.
- **제안**: 필드 이름을 기존 Trigger.type 이름 규약(`type`)과 일관되게 조정하거나, 열거값을 `webhook / manual / schedule` 로 통일해 기존 데이터 모델 어휘를 그대로 재사용한다. spec 본문 반영 시 이 매핑을 명시한다.

---

### [INFO] `EXECUTION_RUN_WORKER_CONCURRENCY` 환경변수 — 신규, 기존 패턴과 정합
- **target 신규 식별자**: `EXECUTION_RUN_WORKER_CONCURRENCY` (§4.3 신규 env)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md` §11 ENV 표: `CONTINUATION_WORKER_CONCURRENCY` (기본 1) — 동일 패턴의 기존 env
  - `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts` (line 73): `CONTINUATION_WORKER_CONCURRENCY` 사용 중
- **상세**: `CONTINUATION_WORKER_CONCURRENCY` 와 동일한 명명 패턴 `<QUEUE>_WORKER_CONCURRENCY` 를 따르므로 충돌 없음. target 에서 "기본값 TBD — 구현 시 결정" 으로 남긴 점은 INFO 수준. spec 본문 반영 시 §11 ENV 표에 행을 추가하고 기본값·fallback 정책을 `CONTINUATION_WORKER_CONCURRENCY` 패턴과 동일하게 명시한다.
- **제안**: spec 반영 시 기본값을 결정하고 §11 ENV 표에 추가한다. 비양수·비정수·비숫자 입력 fallback 은 `CONTINUATION_WORKER_CONCURRENCY` 패턴(1 로 fallback) 그대로 준용한다고 target 이 이미 기술하고 있어 일관성 문제 없음.

---

### [INFO] `execution-run` BullMQ 큐명 — 신규, 기존과 충돌 없음
- **target 신규 식별자**: BullMQ 큐 이름 `execution-run`
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md` §9.3 큐 목록: `execution-continuation`, `background-execution` 두 개만 열거 (`execution-run` 없음)
  - `spec/0-overview.md` §2.6 Redis 큐 목록: `execution-continuation` / `background-execution` 만 언급
- **상세**: 기존에 `execution-run` 이라는 이름의 큐는 없다. `execution-continuation`(재개 세그먼트 운반) 과 대칭적으로 `execution-run`(첫 세그먼트 운반)을 도입하는 것은 개념상 자연스럽다. 충돌 없음. spec 반영 시 §9.3 큐 목록과 §0-overview §2.6 Redis 큐 목록에 `execution-run` 행을 추가해야 한다(target §6 에서 §2.6 추가를 명시하고 있음).
- **제안**: 없음. 다만 spec 반영 시 `spec/5-system/4-execution-engine.md §9.3` 큐 목록 표에도 `execution-run` 행을 추가해 consistency 를 유지한다(target 이 §0-overview §2.6 만 언급, §9.3 누락).

---

### [INFO] `jobId` 패턴 `"<executionId>:run:<monotonic-seq>"` — 기존 `exec:cont:seq` 키와 패턴 비교
- **target 신규 식별자**: job ID 패턴 `<executionId>:run:<monotonic-seq>`
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md` §9.1 Redis 키 표: `exec:cont:seq:<executionId>` (continuation seq counter). 패턴은 `exec:cont:seq:` prefix 사용.
  - BullMQ `execution-continuation` job 의 `jobId` 는 spec 에서 별도 패턴이 명시되지 않으나, `exec:cont:seq` 가 관련 식별자
- **상세**: target 의 `<executionId>:run:<monotonic-seq>` 패턴은 `exec:cont:seq` 와 namespace 가 다르므로 직접 충돌은 없다. 다만 기존 continuation job ID 패턴이 spec 에 명시돼 있지 않아 일관성 비교가 어렵다.
- **제안**: spec 반영 시 `execution-run` job ID 패턴과 `execution-continuation` job ID 패턴을 §9.3 또는 §7.4 에서 나란히 명시해 일관성을 확인한다.

---

## 요약

target 이 도입하는 신규 식별자 중 실질적 충돌은 `EXECUTION_TIMEOUT` 에러 코드 한 건이다. 해당 에러 코드는 이미 Code 노드의 스크립트 실행 타임아웃으로 코드베이스에 사용 중이며, 동일 이름을 엔진 레벨 active-running 누적 타임아웃에 재사용하면 두 다른 맥락에서 같은 코드가 발화되어 운영 진단과 에러 분류기(chat-channel classifier 등) 에서 혼동이 발생한다. `triggerKind` 열거값 `trigger` 도 기존 Trigger.type 어휘(`webhook / manual / schedule`)와 불일치하여 혼동 가능성이 있다. 나머지 신규 식별자(`execution-run` 큐명, `EXECUTION_RUN_WORKER_CONCURRENCY` env)는 기존 명명 패턴을 잘 따르며 충돌 없다.

## 위험도

MEDIUM
