---
id: "CLE-NODE-PARALLEL-CONFIG"
title: "Parallel 노드 — 설정과 에러"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-PARALLEL"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC", "CLE-NODE-PARALLEL"]
area: "CLE-NODE-LOGIC"
content_hash: "5836dfd6942172e1d60099391d4160a5e1caaae4058c29d5036b303605649807"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "38d0881e44672a697a41a4645154f76ae2f847cbc51ddf5908aa98b28e32d660"
etag: "sha256-1d103494c810644dfdb9447bb3dae582c041fba4332a8e07c40a03e39cee6d06"
---
## 개요

이 문서는 [Parallel 노드](CLE-NODE-PARALLEL.md) 의 하위 문서로 설정 필드, 설정 화면, 포트, 설정 요약, 에러를 정한다. 실행 순서와 항목 에러 정책의 동작은 [실행 로직](CLE-NODE-PARALLEL-EXEC.md), 출력 형태는 [출력 구조](CLE-NODE-PARALLEL-OUTPUT.md), 중첩 깊이 검사는 [놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md) 이 정한다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| branchCount | Integer | ✓ | `2` | 병렬 분기 수(출력 포트 수). `2` ~ `16`. 정상 경로에서는 `handler.validate` 가 범위 밖 값을 거부한다. 핸들러와 실행기의 범위 맞추기(2 미만·16 초과를 줄임)는 검증을 거치지 않은 값에 대한 방어다 |
| maxConcurrency | Integer | | `0` | 동시 실행 수. `0` 은 `branchCount` 와 같다(제한 없음). `1`~`16` 은 동시 실행 슬롯 수. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#리소스-제한) |
| waitAll | Boolean | | `true` | 모든 병렬 분기가 끝난 뒤 `done` 으로 나아간다. `false` 는 `handler.validate` 가 거부한다(아래 3번). 설정 화면에 표시하지 않는다 |
| errorPolicy | `stop` / `continue` / `cancel-others-on-fail` | | `stop` | 병렬 분기의 항목 에러 정책. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#항목-에러-정책). 정책별 동작은 [실행 로직](CLE-NODE-PARALLEL-EXEC.md#실행-로직) 5번, 취소 규칙은 [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) |

코드 기준: `codebase/backend/src/nodes/logic/parallel/parallel.schema.ts` (export `parallelNodeConfigSchema`)

1. `errorPolicy` 는 `parallelNodeConfigSchema` 에 직접 드러난 Parallel 전용 필드다. 공통 에러 처리 정책(`errorHandling.policy`)과 별개다.
2. 엔진은 `config.errorPolicy` 가 있으면 그 값을 그대로 쓴다. 없으면 공통 `errorHandling.policy` 를 대응시켜 쓴다. `skip_node` / `use_default_output` / `route_to_error_port` 는 `continue`, 그 밖은 `stop` 이다(옛 동선 호환).
3. `waitAll: false` 는 지원하지 않는다. `validateParallelConfig` 가 `waitAll === false` 를 거부한다. Parallel 은 항상 모든 병렬 분기가 끝난 뒤 `done` 포트로 결과를 합쳐 보낸다. `PARALLEL_ENGINE=off` 되돌림 경로는 완료 출력을 만들지 않는다([출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#off-되돌림-경로는-완료-출력을-만들지-않는다-2026-11-02)). 병렬 분기가 끝나는 대로 다음 노드로 나아가는 fire-and-forget 이 필요하면 [Background 노드](CLE-NODE-BACKGROUND.md) 를 쓴다. 옛 워크플로우의 `config.waitAll: false` 는 스키마 검증에서 거부되므로 사용자가 워크플로우 에디터에서 고쳐야 한다. 근거는 Rationale 「[`waitAll=false` 를 지원하지 않는다](#waitallfalse-를-지원하지-않는다-2026-05-30-결정-k)」.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 병렬 분기 수 | 맨 위 | `Branch Count` 입력(예 `3`), 안내 "병렬 실행할 분기 수 (2~16)" | `branchCount` 를 편집한다 |
| 동시 실행 수 | 가운데 | `Max Concurrency` 입력(예 `0`), 안내 "0 = 제한 없음 (branchCount 와 동일)" | `maxConcurrency` 를 편집한다 |
| 에러 정책 | 맨 아래 | `Error Policy` 드롭다운(`stop` / `continue` / `cancel-others-on-fail`) | `errorPolicy` 를 바꾼다 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 외부 데이터 진입. 모든 병렬 분기에 같은 입력을 복제해 넘긴다 |
| 출력 | `branch_0` ~ `branch_{N-1}` | Branch i | data | true | `branchCount` 에 따라 동적으로 만든다(`dynamicPorts.kind = 'parallel-branches'`). 병렬 분기마다의 진입점 |
| 출력 | `done` | Done | data | false | 모든 병렬 분기가 끝난 뒤 `{ branches, count }` 를 넘긴다. 실패한 병렬 분기가 있으면 `skipped` 도 넘긴다 |

동적 포트 ID 는 `branch_<index>` 형식이다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 `<prefix>_<index>` 규칙). 동적 포트도 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#동적-포트-id-불변성) 의 ID 불변성을 따른다. `branchCount` 를 바꿔 포트를 다시 구성해도 기존 인덱스의 포트 ID 는 유지된다.

## 설정 요약

- 형식: `{N} branches`
- 예: `3 branches`
- 구현: `parallel.schema.ts` 의 `summaryTemplate` (`'{{branchCount}} branches'`).

## 에러

Parallel 은 런타임 에러 포트가 없다. 설정 검증 실패는 사전 검증 에러로 던지고 병렬 분기 실행 중의 에러는 항목 에러 정책으로 처리한다. 메시지는 영문 원문이 기준이고 캔버스는 프론트엔드 i18n 으로 한국어를 렌더링한다.

`branchCount` 범위 검사는 노드 경고 규칙 한 곳에만 둔다. `handler.validate` 는 경고 규칙과 `validateConfig` 의 결과를 합쳐 돌려주므로 같은 문구가 캔버스 배지와 검증 결과에 한 번씩 보인다. `validateConfig`(`validateParallelConfig`)는 경고 규칙의 표현식으로 쓸 수 없는 정수 검사만 맡는다.

표의 `PARALLEL_INVALID_CHILD` · `PARALLEL_BACK_EDGE` · `PARALLEL_NESTED_DEPTH_EXCEEDED` 는 에러 메시지 앞에 붙는 접두사다. `ErrorCode` enum 값이 아니고 `output.skipped[].error.code` 값도 아니다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#컨테이너-패턴) 규칙 1 의 `CONTAINER_*` 와 같은 방식이다. 그래서 `errorPolicy='continue'` 에서 실행 중 대기로 실패한 병렬 분기는 `error.code` 가 `'UNKNOWN_ERROR'` 이고 접두사는 `error.message` 앞에 붙는다. 접두사는 진단용이며 클라이언트가 분기 근거로 쓰지 않는다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#규칙) 규칙 4). 접두사는 안정된 코드로 올리지 않는다(2026-11-05, [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#실패한-회차와-병렬-분기의-errorcode-2026-11-05)).

아래 표의 항목 에러 정책 행(`stop` · `continue` · `cancel-others-on-fail` · 사용자 취소)은 요약이다. 정책별 동작의 정본은 [실행 로직](CLE-NODE-PARALLEL-EXEC.md#실행-로직) 5번이고 고칠 때는 그쪽을 먼저 고친다.

| 발생 조건 | 메시지 · 처리 | 시점 |
|-----------|--------------|------|
| `branchCount` 가 `[2, 16]` 밖 | `branchCount must be a value between 2 and 16.` | 노드 경고 규칙(캔버스 배지와 `handler.validate`) |
| `branchCount` 가 정수 아님 | `branchCount must be an integer.` | `handler.validate` |
| `maxConcurrency` 가 숫자 아님 | `maxConcurrency must be a number.` | `handler.validate` |
| `maxConcurrency` 가 정수 아님 | `maxConcurrency must be an integer.` | `handler.validate` |
| `maxConcurrency` 가 `[0, 16]` 밖 | `maxConcurrency must be a value between 0 and 16 (0 = unlimited).` | `handler.validate` |
| `waitAll` 이 불리언 아님 | `waitAll must be a boolean.` | `handler.validate` |
| `waitAll === false` | `waitAll=false is not supported. Use waitAll=true (default) or the Background node for fire-and-forget semantics.` | `handler.validate` |
| `errorPolicy` 가 세 값 밖 | `errorPolicy must be 'stop', 'continue', or 'cancel-others-on-fail'.` | `handler.validate` |
| 병렬 분기 에러(`errorPolicy=stop`) | 모든 병렬 분기가 끝난 뒤 실패한 병렬 분기 가운데 번호가 가장 작은 것의 에러를 던짐. Parallel 노드 실패 | 엔진 런타임([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#항목-에러-정책)) |
| 병렬 분기 에러(`errorPolicy=continue`) | 실패 자리는 `null`, 실패 정보는 `output.skipped`([완료 시점](CLE-NODE-PARALLEL-OUTPUT.md#완료-시점-done-포트)). Parallel 노드는 `done` 으로 끝남 | 엔진 런타임 |
| 병렬 분기 에러(`errorPolicy=cancel-others-on-fail`) | 자기 그룹 `AbortController.abort()` → 다른 병렬 분기 외부 I/O 중단 + 원인 에러를 던짐 → Parallel 실패. 규칙: [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) | 런타임(`ParallelExecutor`) |
| 사용자가 실행을 취소함 | 항목 에러 정책과 상관없이 `ExecutionCancelledError` 를 다시 던짐. `output.skipped` 에 넣지 않음 | 런타임(`ParallelExecutor`) |
| 병렬 분기 안에 블로킹 노드(form / buttons / ai_conversation) | `PARALLEL_INVALID_CHILD: …` | 엔진 그래프 검증(`planParallelBody`, 병렬 분기 실행 전) |
| 병렬 분기 안 노드가 실행 중에 `waiting_for_input` 을 냄 | `PARALLEL_INVALID_CHILD: …` 로 그 병렬 분기 실패. 처리는 항목 에러 정책을 따름([입력 대기](CLE-NODE-PARALLEL-EXEC.md#병렬-분기-안-입력-대기는-실행-중에도-병렬-분기-실패로-다룬다-2026-11-02)) | 엔진 런타임(병렬 분기 루프) |
| 병렬 분기 안에 되돌아가는 연결선 | `PARALLEL_BACK_EDGE: …` | 엔진 그래프 검증(`planParallelBody`) |
| 중첩 Parallel 깊이 > 2 (깊이 2 의 병렬 분기나 그 안 컨테이너 본문에 또 Parallel) | `PARALLEL_NESTED_DEPTH_EXCEEDED: …` | 엔진 그래프 검증. 바깥 Parallel 의 `planParallelBody` 가 병렬 분기 실행 전에, 컨테이너가 첫 반복 전에(`runContainerInner`) 검사한다([놓인 위치별 실행과 중첩 깊이](CLE-NODE-PARALLEL-NEST.md#놓인-위치별-실행과-중첩-깊이)) |
| 중첩 Parallel 동시 실행 수 곱이 32 초과 | 조용히 줄임 + 안쪽 Parallel 의 `meta.clampedConcurrency` 기록 + debug 로그 | 런타임(`ParallelExecutor`) |

## Rationale

### `waitAll=false` 를 지원하지 않는다 (2026-05-30 결정 K)

`waitAll: false` 는 처음에 스키마에 드러나 있었지만 엔진이 무시하는 죽은 필드였다. 활성화와 제거를 검토했고 지원하지 않기로 했다.

**`waitAll=false` 가 뜻하려던 동작**: 병렬 분기(`branch_i`)가 끝나는 즉시 그 병렬 분기의 바깥 다음 노드를 시작한다. 예를 들어 branch 0 이 1초, branch 1 이 5초 걸리면 branch 0 의 다음 노드가 1초 시점에 시작한다.

**기각 근거는 엔진 구조다**: `ExecutionEngineService` 는 Node.js 단일 스레드 메인 루프로 노드를 dispatch 한다. `runParallel` 은 메인 루프가 `await` 로 기다리는 함수이고 메인 루프는 `runParallel` 이 반환된 뒤에야 다음 노드로 나아간다. 그래서 병렬 분기 완료 콜백 안에서 `propagateReachability` 를 불러도 바깥 노드는 모든 병렬 분기가 끝난 뒤에야 dispatch 된다.

이 동작을 살리려면 병렬 분기가 끝날 때마다 바깥 다음 노드를 별도 하위 루프로 dispatch 해야 한다. 그러면 다음 위험이 따른다.

- 메인 dispatch 루프와 별도 하위 루프가 동시에 돈다. 경쟁 상태와 `executedNodes` 집합 동시 변경이 생긴다.
- Loop · ForEach · Map 같은 컨테이너의 fan-out 경로(`runContainer`)와 서로 영향을 준다.
- 병렬 분기 안에 ForEach · Loop · Map 이 들어가는 시나리오가 회귀할 수 있다.

**대안은 Background 노드다**: fire-and-forget 은 [Background 노드](CLE-NODE-BACKGROUND.md) 가 명시적으로 지원한다. BullMQ enqueue 모델로 워커 단에서 이미 분리돼 있어 더 안전하다.

**결정**: Parallel 은 항상 `waitAll=true` (기본)로 동작한다. 모든 병렬 분기가 끝난 뒤 `done` 포트로 결과를 합쳐 보낸다. `PARALLEL_ENGINE=off` 되돌림 경로는 완료 출력을 만들지 않는다([`off` 되돌림 경로](CLE-NODE-PARALLEL-OUTPUT.md#off-되돌림-경로는-완료-출력을-만들지-않는다-2026-11-02)). `waitAll=false` 를 명시한 워크플로우는 스키마 검증에서 거부한다([에러](#에러) 표).

**옛 워크플로우 호환: 데이터 마이그레이션은 하지 않는다 (2026-07-16 확정)**. DB 에 `config.waitAll: false` 가 저장된 경우 실행 시점에 스키마 검증이 거부하고 사용자가 워크플로우 에디터에서 고친다. 이것이 완결된 처리 경로이고 저장된 값을 한꺼번에 고치는 데이터 마이그레이션은 하지 않는다.

- 근거: 결정 K 는 `waitAll=false` 를 스키마에는 남기고 검증에서 거부하는 형태로 정했다. 잘못된 값이 다른 뜻으로 조용히 실행되지 않고 명확한 에러 메시지로 바로 드러나며 그 메시지가 대안(Background 노드)까지 안내한다.
- 데이터 마이그레이션이 더 얻는 것은 "에디터에서 한 번 고치는 수고" 를 없애는 것뿐이다. 그 대가로 사용자 워크플로우 설정을 소급해 고치는 쓰기 마이그레이션을 치러야 한다. `false` 를 `true` 로 바꾸면 뜻이 달라지고 Background 노드로 옮기는 것은 그래프 구조 변경이라 자동화할 수 없다.
- 뜻이 바뀌는 자동 변환은 사용자 의도를 대신 정하는 일이라 거부하고 안내하는 쪽이 더 안전하다.

### `branchCount` 범위 검사는 경고 규칙 한 곳에 둔다 (2026-11-01)

노드 경고 규칙(`branchCount must be 2 to 16.`)과 `validateParallelConfig`(`branchCount must be a value between 2 and 16.`)가 같은 범위를 따로 검사했다. `handler.validate` 는 두 결과를 합치므로 `branchCount=1` 이면 같은 뜻의 문구가 두 번 나왔다. 범위 검사는 경고 규칙 한 곳에만 두고 문구는 `maxConcurrency` 문구와 같은 모양으로 정했다. 두 문구를 그대로 두고 이 문서의 에러 표만 실제에 맞추는 안은 같은 뜻의 문구가 계속 두 번 보여 기각했다.
