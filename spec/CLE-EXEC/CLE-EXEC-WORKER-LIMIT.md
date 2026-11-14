---
id: "CLE-EXEC-WORKER-LIMIT"
title: "큐 워커 — 동시 실행 제한과 시간 한도"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-WORKER"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-WORKER"]
area: "CLE-EXEC"
content_hash: "98d266f127c4189e13c9e2e910aacb85b252975c9edce419e8d23b75b23728e9"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "b8b1b2828f423f7fff8abdbb8b66040fe6e8835bea5813710cd5f28e17335a15"
etag: "sha256-40dd55f13980cb8c782a02f3a9631e30b13d98886186f0165501c1986524c63b"
---
## 개요

이 문서는 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) 의 하위 문서로 워크스페이스 · 워크플로우 동시 실행 제한(admission gate, `maxConcurrentExecutions`), 실행 시간 한도(`EXECUTION_MAX_ACTIVE_RUNNING_MS`), 큐 대기 한도(`EXECUTION_QUEUE_WAIT_TIMEOUT`), 동시 실행 제한 검사의 원자성, 큐 워커 환경 변수를 정한다. 시작 큐와 세그먼트 직렬화 불변식은 부모 문서가 정한다.

## 동시 실행 제한

> 구현 상태: 실행 시간 한도(세그먼트 누적 시간 기준) 1단계(2026-06-05), 워크스페이스·워크플로우 동시 실행 제한과 큐 대기 5분 취소(2026-07-04. settings 키, advisory lock 검사, `queued_at`, `EXECUTION_QUEUE_WAIT_TIMEOUT`, 워크스페이스 settings 쓰기 API)가 구현됐다. 단일 실행 최대 노드 수(500)만 미구현(Planned)이다.

| 제한 항목 | 기본값 | 설정 위치 | 비고 |
| --- | --- | --- | --- |
| 워크스페이스당 동시 실행 수 | 10 | `Workspace.settings.maxConcurrentExecutions`(관리자 이상, `PATCH /api/workspaces/:id/settings`). 키 정의는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) | 시작 큐 + 동시 실행 제한 검사로 센다. |
| 워크플로우당 동시 실행 수 | 3 | `Workflow.settings.maxConcurrentExecutions`(편집자 이상, `PATCH /api/workflows/:id`). 키 정의는 [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md) | 시작 큐 + 동시 실행 제한 검사로 센다. |
| 단일 실행 최대 노드 수 | 500 | 시스템 설정 | 미구현(Planned) |
| 단일 실행 최대 실행 시간 | 30분 | 1단계: 시스템 env `EXECUTION_MAX_ACTIVE_RUNNING_MS`(기본 `1800000`ms, `0`=무제한). 2단계(후속): 워크플로우별 `Workflow.settings` | 세그먼트 누적 시간 기준(wall-clock 아님, 입력 대기 시간 제외). 1단계 구현 완료 |
| 노드별 기본 타임아웃 | 30초 | `Node.config` | |

**실행 시간 한도의 기준은 세그먼트 누적 시간이다.** 최대 실행 시간은 wall-clock 이 아니라 세그먼트들의 누적 시간(`Execution.active_running_ms`)으로 잰다. 입력 대기 park 동안 흐른 시간은 뺀다. 사용자 입력을 며칠 기다리는 정상 워크플로우를 타임아웃으로 끝내면 안 되기 때문이다. 세그먼트 작업은 세그먼트 구간에만 존재하므로(park 중에는 작업이 없다) 세그먼트 작업 시간이 곧 그 세그먼트의 시간이다. 누적은 세그먼트 시간의 합으로 추적한다. 적산 방식은 [실행 데이터와 흐름](CLE-EXEC-DATA.md) 에 있다.

**제한을 넘으면**:

- **동시 실행 수 초과**: 새 실행은 `pending` 상태로 시작 큐에서 기다린다. 시작 큐 소비자(`runExecutionFromQueue`)가 **첫 세그먼트 시작(`pending → running`) 직전에** 원자적으로 동시 실행 제한을 검사한다. 워크스페이스와 워크플로우 **양쪽**의 `COUNT(status='running')` 이 모두 한도 미만일 때만 `running` 으로 들어간다. 아니면 `pending` 을 유지하고 지연 재발행(백오프)한다.
  - 이 검사는 **`pending → running` 최초 진입에만** 적용한다. stalled 재배달의 `running` 분기와 park 재개는 이미 `running` 이거나 `waiting_for_input` 에서 돌아오는 재개라 다시 세지 않는다. 한 실행이 동시에 두 세그먼트를 돌 수 없으므로 이중 계산이 없다.
- **실행 시간 한도 도달**: 누적 시간이 **한도 이상**(`activeNow >= maxActiveRunningMs`, 경계값 포함)이면 `EXECUTION_TIME_LIMIT_EXCEEDED` 에러로 실행을 `failed` 로 끝낸다. 엔진 수준 누적 타임아웃 전용 코드다. Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과 뜻이 달라 코드를 나눴다. 기준은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 다.
- **큐 대기 한도(`EXECUTION_QUEUE_WAIT_TIMEOUT`) 초과**: 큐 대기 시간(`now - queued_at`)이 기본 5분(시스템 env `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, 기본 `300000`ms)을 넘으면 실행을 `cancelled` + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` 로 끝낸다. 시스템 취소이며 취소 주체(`cancelledBy`)는 `'timeout'` 이다. `execution.cancelled` 이벤트는 rehydration 실패 취소와 같은 경로로 발행한다. 이벤트 형식은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 에 있다.
  - **주 경로는 작업을 가져갈 때의 검사다.** 소비자가 작업을 가져가면 동시 실행 제한 검사 전에 `now - queued_at` 을 본다. 한도를 넘었으면 다시 넣지 않고 `cancelled` 로 끝낸다. 한도 초과로 지연 재발행된 작업은 재시도 때마다 다시 검사되므로 대기 초과를 반드시 잡는다.
  - **작업 자체를 잃은 대기 중 실행**(Redis 비영속, 작업 유실 등)은 부팅 복구 스캔이 같은 방식(`EXECUTION_QUEUE_WAIT_TIMEOUT`, `cancelledBy='timeout'`, `releaseExecutionRouting`)으로 회수한다. 2026-07-04 에 구현됐다. 한도 안쪽의 방치된 작업은 다음 스캔 때 한도를 넘었으면 회수한다(드문 경우, 부팅 때만 도는 best-effort). 규칙은 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 에 있다.

**동시 실행 제한 검사의 원자성(TOCTOU)**: 여러 소비자가 같은 슬롯을 두고 경쟁하므로 "세기 → 비교 → 전이" 가 원자적이어야 한다. 읽고 나서 판단하는 방식은 한도를 넘게 허용한다.

- 구현은 워크스페이스마다 PostgreSQL advisory lock(`pg_advisory_xact_lock`)으로 검사를 줄 세운 트랜잭션 안에서 조건부 UPDATE(`WHERE status='pending' AND (SELECT count …) < cap RETURNING`)를 한다. 워크스페이스 수는 실행 테이블에 `workspace_id` 가 없어 워크플로우와 join 해 센다.
- **조건부 UPDATE 하나만으로는 부족하다.** 서브쿼리 COUNT 가 훑는 다른 `running` 행에 잠금이 없어서 서로 다른 실행을 대상으로 한 두 검사가 같은 COUNT 스냅샷을 보고 둘 다 통과할 수 있다(한도 초과). advisory lock 이 같은 워크스페이스의 검사를 순서대로 처리해 스냅샷을 안정시킨다. 다른 워크스페이스끼리는 병렬로 진행한다.
- 판정은 `RETURNING` 이 돌려준 행 배열의 길이로 한다. raw SQL 결과를 읽는 규칙은 [raw SQL 결과 읽기 규약](../CLE-ENG/CLE-ENG-RAWQUERY.md) 에 있다.

## 환경 변수

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `EXECUTION_RUN_WORKER_CONCURRENCY` | `1` | 시작 큐 워커가 인스턴스마다 동시에 처리하는 세그먼트 수. work-stealing 처리량, backpressure, 동시 실행 제한의 토대다. 양수가 아니거나 정수가 아니거나 숫자가 아니거나 공백뿐이면 1 로 대신한다(`resolveExecutionRunWorkerConcurrency`). 모듈을 불러올 때 한 번 읽으므로 인스턴스를 다시 시작해야 반영된다. |
| `CONTINUATION_WORKER_CONCURRENCY` | `1` | 재개 큐 워커가 인스턴스마다 동시에 처리하는 재개 작업 수. 양수가 아니거나 정수가 아니거나 숫자가 아니면 1 로 대신한다. 다시 시작해야 반영된다. |
| `EXECUTION_MAX_ACTIVE_RUNNING_MS` | `1800000`(30분) | 단일 실행의 세그먼트 누적 시간 한도(ms). 넘으면 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 `failed`. `0` 은 무제한이다. 정수가 아니거나 음수거나 숫자가 아니면 기본값으로 대신한다(`resolveMaxActiveRunningMs`). 입력 대기 시간은 뺀다. 다시 시작해야 반영된다. |
| `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` | `300000`(5분) | 큐 대기 한도. 넘으면 `EXECUTION_QUEUE_WAIT_TIMEOUT` 으로 `cancelled`. |

`RESUME_BULLMQ_ATTEMPTS`(기본 3)는 환경 변수가 아니라 코드 상수다. `background-execution` 큐의 `attempts` 와 같은 방식으로 관리하며 환경 변수화는 후속이다. 안전 종료 관련 변수는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md), DLQ 모니터 변수와 seq TTL 은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 있다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/execution-limits.ts` (실행 시간 한도, 큐 대기 한도)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (동시 실행 제한 검사 `admitExecutionOrDefer`)

## Rationale

### 실행 시간 한도를 세그먼트 누적 시간으로 (2026-06-04 결정)

- **배경**: "단일 실행 최대 실행 시간 30분" 이 wall-clock 인지 active 시간인지 정해져 있지 않았다.
- **채택**: 입력 대기 시간을 뺀 세그먼트 누적 시간 기준. wall-clock 이면 사용자 입력을 며칠 기다리는 정상 워크플로우를 타임아웃으로 끝낸다. 과거 테스트에서 "늦게 돌아오니 세션 만료" 회귀로 확인된 안티패턴이다.
- **설계 맞물림**: 세그먼트 작업은 세그먼트 구간에만 있다(park 중에는 작업이 없다). 그래서 세그먼트 작업 시간이 곧 active 시간이 되고 별도 시계 없이 자연스럽게 나뉜다. 누적은 세그먼트 시간의 합이다.
- **에러 코드 분리**: 엔진 누적 타임아웃은 새 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 다. Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT`(`nodes/data/code/code.handler.ts`)과 뜻이 달라 이름을 바꾸지 않고 새로 만들었다. 에러 코드 명명 규약을 따른다.
- **한도 출처는 1단계 env, 2단계 워크플로우별**: 표의 설정 위치는 `Workflow.settings` 였지만 그 설정 필드가 아직 없어 1단계는 시스템 env 상수 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 로 구현했다. 워크플로우별 설정 필드와 UI 는 2단계 후속이다. 멀티테넌트 폭주 방지라는 핵심 목적은 전역 한도로 바로 이룰 수 있다. 워크플로우별 세분화는 DB 마이그레이션과 UI 가 필요한 별도 범위다.
- **판정은 `>=`(경계 포함)**: 한도와 정확히 같은 값도 초과로 본다. 한도에 닿은 세그먼트는 한도를 다 쓴 것이므로 끝내는 것이 맞다. `>` 보다 경계값에서 조용히 덜 적용될 위험이 없어 보수적으로 안전하다.
- **판정의 비원자성은 직렬화 불변식이 막는다**: `assertActiveTimeWithinLimit`(DB 누적값 + 진행 중 경과분을 읽어 판정)와 `updateExecutionStatus`(세그먼트 끝에 누적 기록) 사이에 잠금이 없다. 한 실행의 세그먼트가 항상 하나이고 동시에 돌지 않으므로 지금 구조에서는 실제 race 가 없다. 실행을 다시 `running` 으로 들이는 경로가 늘면 다시 검증한다([세그먼트 직렬화 불변식](CLE-EXEC-WORKER.md#세그먼트-직렬화-불변식)).

### 동시 실행 제한은 소비 쪽에서 검사하고 대기 초과는 취소한다 (2026-07-04)

사용자 결정(2026-07-04): spec 을 먼저 나누고 범위는 동시 실행 제한과 5분 취소로 한다. 우선순위 3단계는 후속으로 뺀다.

- **소비 쪽 검사(발행 쪽 아님)**: work-stealing 분산에서 어느 인스턴스가 실행할지는 작업을 가져가는 시점에 정해진다. `execute()` 는 항상 `pending` 으로 넣고 바로 반환하는 계약을 지킨다. 그래서 검사는 소비자(`runExecutionFromQueue`)가 `pending → running` 전이 직전에 원자적으로 해야 분산 정합이 맞다. 발행 쪽 검사(execute 때 세기)는 다중 인스턴스 race 가 생기고 즉시 반환 계약도 깨므로 기각했다.
- **`failed` 가 아니라 `cancelled`(+`error.code`)**: 큐 대기 초과는 노드 실행이 시작조차 안 된 상태다. "실패" 보다 "취소" 가 뜻에 맞다. 취소 주체 enum 에서 쓰이지 않던 값 `'timeout'` 을 처음 쓰고 `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` 으로 사용자 취소와 구분한다. rehydration 실패의 시스템 취소가 `execution.cancelled` 에 `error` 를 함께 싣는 기존 구조를 다시 쓰므로 새 payload 필드가 없다.
- **검사는 `pending → running` 최초 진입에만**: 한 실행이 동시에 두 세그먼트를 돌 수 없으므로 stalled 재배달과 park 재개까지 다시 세면 이중 계산이 된다. 크래시 재구동에서 인정한 zombie race 는 "같은 실행을 두 워커가 잠깐 굴릴 수 있다" 는 문제다. 동시 실행 제한이 세는 "서로 다른 실행 N 개" 와는 다른 문제다.
- **TOCTOU 원자화**: 읽고 나서 판단하는 방식은 한도를 넘게 허용한다. 조건부 UPDATE 만으로는 부족했다. 서브쿼리 COUNT 에 잠금이 없어 동시 검사가 같은 스냅샷을 보고 한도를 넘겼다(실제 Postgres 로 재현했다). 워크스페이스별 advisory lock 으로 같은 범위를 줄 세우고 다른 워크스페이스는 병렬로 둔다.
- **`queued_at` 컬럼 신설(V104)**: 5분 판정은 큐 대기 진입 시각 기준이다. `started_at`(`running` 전이 시각)은 부팅 복구 스캔의 stale 판정에 쓰여 다시 쓸 수 없다.
- **우선순위 3단계 분리**: `ExecuteOptions.triggerType` 전달은 ExecuteOptions, 트리거 payload, 큐 옵션 세 층을 바꾸는 일이라 동시 실행 제한 검사와 관계가 없다. 리뷰를 집중하려고 별도 후속으로 뺐다(사용자 결정). 2026-07-04 에 구현됐다.

### 동시 실행 제한 판정은 RETURNING 행 배열로 한다 (2026-08-30 소급 기록)

동시 실행 제한 검사는 4개월 동안 한 번도 통과하지 못했다. 검사는 advisory lock UPDATE 의 `RETURNING` 으로 `rows.length === 1` 을 판정했다. 그 반환값은 `[rows, affectedCount]` 튜플이라 길이가 항상 2였고 판정은 항상 거짓이었다. 2026-08-13 에 고쳤다.

제품이 동작한 이유: UPDATE 는 이미 커밋돼 행이 `running` 이 됐다. 다시 넣은 작업을 `runExecutionFromQueue` 의 `running` 분기가 stalled 재배달로 잘못 알고 rehydration 으로 재구동했다. 결과만 맞고 경로가 틀렸다. 그 대가로 실행마다 약 2초 지연이 생겼다. `if (admitted)` 블록(`recordRunningSegmentStart`, `EXECUTION_STARTED` 발행)은 통째로 죽은 코드가 됐다.

같은 결함의 반대 부호가 실행 상태 전이 쪽에 있었다. 그쪽은 `length > 0` 이라 항상 참이었다. 하나의 shape 오해가 "늘 실패" 와 "늘 성공" 양쪽으로 나타난 사례다. 불변식은 [raw SQL 결과 읽기 규약](../CLE-ENG/CLE-ENG-RAWQUERY.md) 이 정한다. 상태 전이 쪽 사례는 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 에 있다.
