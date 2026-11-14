---
id: "CLE-NODE-PARALLEL"
title: "Parallel 노드"
type: "feature"
version: 11
status: "approved"
requirements: ["REQ-PARALLEL-001", "REQ-PARALLEL-002", "REQ-PARALLEL-003", "REQ-PARALLEL-004", "REQ-PARALLEL-005", "REQ-PARALLEL-006", "REQ-PARALLEL-007", "REQ-PARALLEL-008", "REQ-PARALLEL-009", "REQ-PARALLEL-010", "REQ-PARALLEL-011", "REQ-PARALLEL-012", "REQ-PARALLEL-013", "REQ-PARALLEL-014", "REQ-PARALLEL-015", "REQ-PARALLEL-016", "REQ-PARALLEL-017", "REQ-PARALLEL-018", "REQ-PARALLEL-019", "REQ-PARALLEL-020", "REQ-PARALLEL-021", "REQ-PARALLEL-022", "REQ-PARALLEL-023", "REQ-PARALLEL-024", "REQ-PARALLEL-025", "REQ-PARALLEL-026", "REQ-PARALLEL-027", "REQ-PARALLEL-028", "REQ-PARALLEL-029", "REQ-PARALLEL-030", "REQ-PARALLEL-031", "REQ-PARALLEL-032", "REQ-PARALLEL-033", "REQ-PARALLEL-034", "REQ-PARALLEL-035", "REQ-PARALLEL-036", "REQ-PARALLEL-037"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "6b9228cb25fe7335cf810d22a62b116e681ba04f208cc5adcadfb9230514ac20"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/1-logic/10-parallel.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "810a610c8e6117fcb0d01f09fecd41daedc8b7cf2194f172116c600dd2d579d7"
etag: "sha256-e48b08eab1ee27645fef793af6ae10698a732b195f2fab8765f218ee42b71231"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/1-logic/10-parallel.md`, `spec/4-nodes/_product-overview.md` (§4.10) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Parallel 노드(Parallel, `parallel`)는 같은 입력을 받는 병렬 분기(branch) N개를 동시에 실행하는 노드다(`executionMetadata.kind = 'parallel'`). 컨테이너는 아니지만 엔진 덮어쓰기를 받는 노드다. 핸들러는 `branch_0` ~ `branch_{N-1}` 동적 출력 포트를 한꺼번에 활성화한다. 모든 병렬 분기가 끝나면 엔진이 `done` 포트로 `{ branches, count, skipped? }` 결과를 내보낸다. `branches[i]` 는 `branch_i` 병렬 분기의 결과 노드 출력이다. 결과 노드를 고르는 규칙은 [병렬 분기의 노드 집합과 위상 순서](CLE-NODE-PARALLEL-EXEC.md#병렬-분기의-노드-집합과-위상-순서) 가 정한다. `errorPolicy='continue'` 에서 실패한 병렬 분기는 `branches[i]` 를 `null` 로 두고 실패 정보를 `output.skipped` 에 따로 모은다. 이 형태는 [ForEach 노드](CLE-NODE-FOREACH.md) 와 같고 `meta.skippedCount` 는 싣지 않는다. 출력의 자세한 모양은 [완료 시점](CLE-NODE-PARALLEL-OUTPUT.md#완료-시점-done-포트) 이 정한다.

**구현 상태**: `ParallelExecutor` 가 `p-limit` 과 `Promise.allSettled` 로 병렬 분기를 동시에 실행한다. 코드 기본값이 `PARALLEL_ENGINE=v1` 이라 기본으로 켜져 있다. k8s 기본 매니페스트는 `off` 다([미결 사항](#미결-사항)). `PARALLEL_ENGINE=off` 로 명시하면 엔진이 위상 순서로 차례로 실행하는 되돌림 경로를 쓰고 완료 출력을 만들지 않는다(REQ-PARALLEL-027). 이 환경 변수는 모듈을 불러올 때 한 번 읽으므로 바꾸면 인스턴스를 다시 시작해야 반영된다. `branchCount` 2~16, `maxConcurrency` 0(제한 없음)·1~16 을 지원한다. 병렬 분기 안에 블로킹 노드와 되돌아가는 연결선은 둘 수 없다. 중첩 Parallel 은 깊이 2까지 허용한다. `waitAll` 은 항상 `true` 로 동작하고 `false` 는 지원하지 않는다. fire-and-forget 이 필요하면 [Background 노드](CLE-NODE-BACKGROUND.md) 를 쓴다. `v1` 에서 Parallel 은 놓인 곳(맨 바깥 · 병렬 분기 안 · 컨테이너 본문 · 동기 서브 워크플로우 · Background 본문)과 상관없이 엔진의 Parallel 실행 경로를 탄다(REQ-PARALLEL-034). 남은 구현 갭은 하나다. 재개 · 재구동 뒤에는 완료 출력 대신 시작 시점 출력이 보인다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항)).

이 문서와 [하위 문서](#하위-문서)는 Parallel 노드의 설정, 포트, 실행 로직, 병렬 분기 격리, 중첩 Parallel 제한, 출력 구조, 에러를 정한다. 항목 에러 정책의 값 비교와 엔진 덮어쓰기 계약은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md) 이 정한다. 엔진 덮어쓰기의 실행 흐름은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md), `abortSignal` 전파 규칙은 [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md), 실행 컨텍스트 필드 분류는 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md), 저장·캔버스 단계의 중첩 경고 규칙은 [그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md) 이 정한다. 동기 서브 워크플로우 실행은 [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) 가 정한다.

## 요구사항

- REQ-PARALLEL-001 WHEN Parallel 노드가 실행되면 THE SYSTEM SHALL 여러 병렬 분기를 동시에 실행한다. (원본: ND-PL-01)
- REQ-PARALLEL-002 WHEN 사용자가 `branchCount` 를 바꾸면 THE SYSTEM SHALL 병렬 분기 출력 포트(`branch_<index>`)를 그 수만큼 동적으로 만들거나 없앤다. (원본: ND-PL-02)
- REQ-PARALLEL-003 WHEN `PARALLEL_ENGINE` 이 `off` 가 아닐 때 모든 병렬 분기가 끝나면 THE SYSTEM SHALL `done` 포트로 `{ branches, count, skipped? }` 결과를 한 번에 합쳐 보낸다. (원본: ND-PL-03, Merge `wait_all` 로 우회하는 구성은 선택 사항)
- REQ-PARALLEL-004 WHEN 사용자가 `maxConcurrency` 를 설정하면 THE SYSTEM SHALL 동시에 실행하는 병렬 분기 수를 그 값으로 제한한다. (원본: ND-PL-04)
- REQ-PARALLEL-005 WHEN `maxConcurrency` 가 `0` 이면 THE SYSTEM SHALL 동시 실행 수를 `branchCount` 와 같게 둔다.
- REQ-PARALLEL-006 WHEN 핸들러가 시작 시점 출력을 반환하면 THE SYSTEM SHALL `output: null` 과 `port: string[]` (`branch_0` ~ `branch_{N-1}`)을 반환해 모든 병렬 분기를 활성화한다.
- REQ-PARALLEL-007 WHEN 병렬 분기를 시작하면 THE SYSTEM SHALL 모든 병렬 분기에 같은 입력을 복제해 넘긴다.
- REQ-PARALLEL-008 WHEN 병렬 분기 컨텍스트를 만들면 THE SYSTEM SHALL `ExecutionContext` 를 얕게 복사하고 `variables` 는 `structuredClone` 으로 깊게 복사한다.
- REQ-PARALLEL-009 WHEN 병렬 분기 컨텍스트를 만들면 THE SYSTEM SHALL `nodeOutputCache` · `structuredOutputCache` 를 얕게 복사하고 `itemContext` · `loopContext` 는 부모 컨텍스트 값을 그대로 둔다.
- REQ-PARALLEL-010 WHILE 실행 환경이 `development` 나 `test` 인 동안 THE SYSTEM SHALL 병렬 분기 복제 직후 공유 캐시 값 객체를 깊게 얼려 값 내부 변경을 `TypeError` 로 드러낸다.
- REQ-PARALLEL-011 IF 항목 에러 정책이 `stop` 이고 병렬 분기가 실패하면 THE SYSTEM SHALL 모든 병렬 분기가 끝나기를 기다린 뒤 실패한 병렬 분기 가운데 번호(`branch_i` 의 `i`)가 가장 작은 것의 에러를 던져 Parallel 노드를 실패로 전이한다.
- REQ-PARALLEL-012 IF 항목 에러 정책이 `continue` 고 병렬 분기가 실패하면 THE SYSTEM SHALL 모든 병렬 분기가 끝나기를 기다린 뒤 그 병렬 분기의 `output.branches[i]` 를 `null` 로 두고 실패 정보를 `output.skipped` 에 `{ index, error: { code, message } }` 로 모은다.
- REQ-PARALLEL-013 IF 항목 에러 정책이 `cancel-others-on-fail` 이고 병렬 분기가 처음 실패하면 THE SYSTEM SHALL 자기 그룹의 `AbortController` 를 abort 해 다른 병렬 분기의 외부 I/O 를 중단하고 모든 병렬 분기가 끝난 뒤 첫 원인 에러를 Parallel 노드의 에러로 던진다.
- REQ-PARALLEL-014 WHEN `cancel-others-on-fail` 로 원인 에러를 고르면 THE SYSTEM SHALL `AbortError` 가 아닌 첫 실패를 원인으로 쓰고 `AbortError` 는 사용자에게 드러내지 않는다.
- REQ-PARALLEL-015 WHEN 상위 `context.abortSignal` 이 abort 되면 THE SYSTEM SHALL 그 abort 를 Parallel 그룹의 병렬 분기에도 전파한다.
- REQ-PARALLEL-016 IF `config.errorPolicy` 가 설정되지 않았으면 THE SYSTEM SHALL 공통 `errorHandling.policy` 가 `skip_node` / `use_default_output` / `route_to_error_port` 일 때 `continue`, 그 밖이면 `stop` 을 쓴다.
- REQ-PARALLEL-017 WHEN `PARALLEL_ENGINE` 이 `off` 가 아닐 때 모든 병렬 분기가 끝나면 THE SYSTEM SHALL 노드 `output` 을 `{ branches, count, skipped? }` 로 덮어쓰고 `port: 'done'`(단일 문자열)을 싣는다.
- REQ-PARALLEL-018 IF `waitAll` 이 `false` 면 THE SYSTEM SHALL `handler.validate` 에서 거부하고 Background 노드를 쓰라고 안내한다.
- REQ-PARALLEL-019 IF `branchCount` 가 정수가 아니거나 2~16 밖이면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-PARALLEL-020 IF `maxConcurrency` 가 숫자가 아니거나 정수가 아니거나 0~16 밖이면 THE SYSTEM SHALL `handler.validate` 에서 거부한다.
- REQ-PARALLEL-021 IF 검증을 거치지 않은 `branchCount` 가 2~16 밖이면 THE SYSTEM SHALL 핸들러와 실행기 양쪽에서 그 범위로 줄여 방어한다.
- REQ-PARALLEL-022 IF 병렬 분기 안에 블로킹 노드가 있으면 THE SYSTEM SHALL 병렬 분기를 실행하기 전 엔진 그래프 검증에서 메시지가 `PARALLEL_INVALID_CHILD:` 로 시작하는 에러로 실행을 실패시킨다.
- REQ-PARALLEL-023 IF 병렬 분기 안에 되돌아가는 연결선이 있으면 THE SYSTEM SHALL 엔진 그래프 검증에서 메시지가 `PARALLEL_BACK_EDGE:` 로 시작하는 에러로 실행을 실패시킨다.
- REQ-PARALLEL-024 IF 중첩 Parallel 깊이가 2를 넘으면 THE SYSTEM SHALL 엔진 그래프 검증에서 메시지가 `PARALLEL_NESTED_DEPTH_EXCEEDED:` 로 시작하는 에러로 실행을 실패시킨다.
- REQ-PARALLEL-025 IF 중첩 Parallel 의 바깥 × 안쪽 동시 실행 수 곱이 32를 넘으면 THE SYSTEM SHALL 안쪽 동시 실행 수를 `max(1, floor(32 / parentEffective))` 로 줄이고 `meta.clampedConcurrency` 에 기록한다.
- REQ-PARALLEL-026 WHEN 워크플로우를 저장하거나 캔버스를 편집하면 THE SYSTEM SHALL 중첩 깊이 위반은 저장을 거부하고 동시 실행 수 곱 초과는 경고 배지로 먼저 알린다.
- REQ-PARALLEL-027 WHEN `PARALLEL_ENGINE=off` 로 설정하면 THE SYSTEM SHALL 병렬 분기를 위상 순서로 차례로 실행하고 완료 출력(`branches` · `count` · `skipped`)을 만들지 않으며 Parallel 노드 출력을 핸들러의 시작 시점 출력(`output: null`, `port: ['branch_0', …]`)으로 둔다.
- REQ-PARALLEL-028 WHEN Parallel 노드를 정의하면 THE SYSTEM SHALL 런타임 에러 포트를 두지 않는다.
- REQ-PARALLEL-029 IF 실패한 병렬 분기가 없으면 THE SYSTEM SHALL 완료 출력에 `output.skipped` 를 싣지 않는다.
- REQ-PARALLEL-030 WHEN 병렬 분기의 결과를 정하면 THE SYSTEM SHALL 이번 Parallel 실행에서 그 병렬 분기가 출력을 쓴 노드 가운데 [위상 순서](#병렬-분기의-노드-집합과-위상-순서)가 가장 늦은 노드의 출력을 엔진 제어 필드(`_selectedPort` 등)를 빼고 `output.branches[i]` 에 담고 그런 노드가 없거나 그 출력이 `undefined` 면 `null` 을 담는다.
- REQ-PARALLEL-031 WHEN 병렬 분기 안의 노드가 출력을 쓰면 THE SYSTEM SHALL 그 출력을 병렬 분기의 캐시 사본에도 옮겨 같은 병렬 분기의 다음 노드 입력과 포트 라우팅이 그 출력을 쓰게 한다.
- REQ-PARALLEL-032 IF 병렬 분기 안의 노드가 실행 중에 `waiting_for_input` 상태를 내면 THE SYSTEM SHALL 메시지가 `PARALLEL_INVALID_CHILD:` 로 시작하는 에러로 그 병렬 분기를 실패시키고 항목 에러 정책대로 처리한다.
- REQ-PARALLEL-033 WHEN 실패한 병렬 분기를 `output.skipped` 에 더하면 THE SYSTEM SHALL `error.code` 를 ForEach · Map 과 같은 규칙으로 고른다. 백엔드가 직접 싣는 카탈로그 코드는 그대로 두고 `name` 이 `AbortError` 인 에러는 `AbortError` 로, 그 밖은 `UNKNOWN_ERROR` 로 둔다.
- REQ-PARALLEL-034 WHEN `PARALLEL_ENGINE` 이 `off` 가 아닐 때 컨테이너(Loop · ForEach · Map) 본문이나 동기 서브 워크플로우나 Background 본문의 Parallel 노드가 실행되면 THE SYSTEM SHALL 맨 바깥 Parallel 과 같은 Parallel 실행 경로로 병렬 분기를 실행하고 완료 출력을 `done` 포트로 보낸다.
- REQ-PARALLEL-035 WHEN 컨테이너 본문에 둔 Parallel 의 중첩 깊이를 세면 THE SYSTEM SHALL 컨테이너를 둘러싼 병렬 분기의 깊이를 이어받아 병렬 분기 안 컨테이너 본문의 Parallel 을 안쪽 Parallel 로 보고 REQ-PARALLEL-024 · 025 를 적용한다.
- REQ-PARALLEL-036 WHEN 동기 서브 워크플로우나 Background 본문에 둔 Parallel 의 중첩 깊이를 세면 THE SYSTEM SHALL 호출한 쪽의 병렬 분기 깊이를 이어받지 않고 그 Parallel 을 맨 바깥 Parallel 로 본다.
- REQ-PARALLEL-037 IF 컨테이너 본문(중첩된 컨테이너 본문 포함)에서 실행될 Parallel 의 중첩 깊이가 2를 넘으면 THE SYSTEM SHALL 그 컨테이너를 둘러싼 바깥 병렬 분기나 그 컨테이너의 첫 반복이 시작되기 전에 메시지가 `PARALLEL_NESTED_DEPTH_EXCEEDED:` 로 시작하는 에러로 실행을 실패시킨다.

## 하위 문서

| 문서 | 맡는 내용 | 요구사항 |
|------|----------|---------|
| [Parallel 노드 — 설정과 에러](CLE-NODE-PARALLEL-CONFIG.md) | 설정 필드, 설정 화면, 포트, 설정 요약, 에러 표, `waitAll=false` · `branchCount` 범위 검사 결정 | REQ-PARALLEL-002, 016, 018, 019, 020, 022, 023, 028 |
| [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md) | 병렬 분기의 노드 집합과 위상 순서, 결과 노드, 실행 로직, 병렬 분기 격리, 항목 에러 정책 동작 | REQ-PARALLEL-001, 004, 005, 007, 008, 009, 010, 011, 012, 013, 014, 015, 021, 030, 031, 032 |
| [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md) | 시작 · 완료 시점 출력, 엔진 덮어쓰기 계약, `off` 되돌림 경로의 출력, 완료 출력 쓰기 순서 | REQ-PARALLEL-003, 006, 017, 027, 029, 033 |
| [Parallel 노드 — 놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md) | 놓인 위치별 실행, 중첩 깊이와 동시 실행 수 곱 상한, 저장 규칙과 실행 검사의 범위 | REQ-PARALLEL-024, 025, 026, 034, 035, 036, 037 |

하위 문서가 번호 없이 가리키는 요구사항은 다음과 같다. `off` 되돌림 경로(REQ-PARALLEL-027)가 예외로 두는 완료 출력 요구사항은 REQ-PARALLEL-003 · 017 이다. 컨테이너 본문 안에서 큐에 넣은 Background 가 회차 반복 변수를 복사해 받는 규칙은 [Background 노드](CLE-NODE-BACKGROUND.md#요구사항) REQ-BGRUN-028 이 정한다.

## 실행 로직

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#실행-로직)

## 병렬 분기의 노드 집합과 위상 순서

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#병렬-분기의-노드-집합과-위상-순서)

## 놓인 위치별 실행과 중첩 깊이

→ [Parallel 노드 — 놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md#놓인-위치별-실행과-중첩-깊이)

### 저장 규칙과 실행 검사의 범위

→ [Parallel 노드 — 놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md#저장-규칙과-실행-검사의-범위)

## 출력 구조

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#출력-구조)

### 엔진 덮어쓰기 계약

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#엔진-덮어쓰기-계약)

## 미결 사항

- **정수가 아닌 `branchCount` 의 캔버스 배지** (info): 노드 경고 규칙은 범위만 보므로 REQ-PARALLEL-019 의 정수 아님 배지는 표시되지 않는다. `handler.validate` 는 거부한다. 배지를 더할지 요구사항을 고칠지 결정 필요.
- **`PARALLEL_ENGINE=off` 에서 `done` 뒤 노드의 실행 시점** (info): 되돌림 경로에서 `done` 연결선 뒤 노드가 병렬 분기 완료를 기다리는지 정하지 않았다. 핸들러가 `port: ['branch_0', …]` 를 돌려주면 엔진이 `done` 을 포함한 모든 연결선을 활성화하므로 `done` 뒤 노드는 실행되고 Parallel 의 시작 시점 출력을 받는다(2026-11-06 확인). 실행 순서 확인과 결정 필요.
- **k8s 기본 매니페스트의 `PARALLEL_ENGINE`** (warning): 코드 기본값과 `.env.example` 은 `v1` 이다. k8s 기본 매니페스트(`k8s/base/configmap.yaml`)는 `PARALLEL_ENGINE: "off"` 다. 그래서 지금 k8s 기본 매니페스트로 배포하면 되돌림 경로(REQ-PARALLEL-027)로 실행되고 완료 출력(`branches` · `count` · `skipped`)이 나오지 않는다. 매니페스트를 `v1` 로 바꿀지 결정 필요.
- **입력 대기로 실패한 자식 노드의 실행 기록 상태** (info): REQ-PARALLEL-032 로 병렬 분기가 실패할 때 `waiting_for_input` 을 낸 자식 노드의 실행 기록이 어느 상태로 끝나는지 정하지 않았다. 지금 테스트도 이 상태를 확인하지 않는다. 종결 상태를 정하고 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 의 전이 표에 넣을지 결정 필요.
- **병렬 분기 안 Background 본문의 검사 범위** (info): 바깥 Parallel 의 사전 검사(`planParallelBody`)와 저장 규칙 `parallel:nested-depth-exceeded` 는 병렬 분기 안 Background 본문을 바깥 병렬 분기 본문으로 보고 깊이를 이어서 센다. 사전 검사는 그 본문의 블로킹 노드도 막는다. 그 본문은 실제로 실행될 때 새 컨텍스트에서 깊이 1 부터 센다([저장 규칙과 실행 검사의 범위](CLE-NODE-PARALLEL-NEST.md#저장-규칙과-실행-검사의-범위)). Background 본문을 검사 범위에서 뺄지 결정 필요. 빼려면 저장 규칙과 실행 검사를 함께 고쳐야 한다. 병렬 분기 안 컨테이너에 둔 Background 본문은 실행 검사가 이미 깊이 1 부터 세고(2026-11-12) 저장 규칙만 바깥 깊이를 이어서 센다. 저장 규칙을 고친다면 이 경우도 함께 본다. 후속 NERV Task `CLE-T-B7A8B2`.

## 구현 위치

- `codebase/backend/src/nodes/logic/parallel/parallel.*.ts`
- `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` (`ParallelExecutor`, `ParallelBranchContext`)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`executeParallelBranchBody` · `runParallel` 완료 시점 덮어쓰기, 완료 출력 쓰기 `commitParallelDoneOutput`, 엔진 공통 출력 쓰기 지점 `commitNodeOutput`, 병렬 분기 사본 반영 `syncParallelBranchCacheEntry`, 안쪽 병렬 분기 출력을 바깥 병렬 분기 사본에 옮기는 `publishBranchOutputsToParent`, 컨테이너 본문 루프 `executeContainerBody` 와 동기 서브 워크플로우 · Background 본문 루프 `executeInline` 의 Parallel 넘김)
- `codebase/backend/src/modules/execution-engine/graph/parallel-precheck.ts` (`ParallelPrecheck` 의 `planParallelBody` 와 사전 깊이 검사 `assertParallelBranchChildrenAllowed` · `assertNestedParallelBodyAllowed` · `assertContainerBodyParallelsAllowed`, 깊이 판별 `parallelDepthOf`)
- `codebase/backend/src/modules/execution-engine/graph/parallel-branch-membership.ts` (`collectParallelBranchMembership`, 병렬 분기 소속과 합류 노드 판정)
- `codebase/backend/src/modules/execution-engine/graph/background-body-membership.ts` (`collectBackgroundOnlyNodeIds`, 컨테이너 본문 노드 가운데 Background 본문으로만 닿는 노드 판정)
- `codebase/backend/src/modules/execution-engine/graph/topological-sort.ts` (위상 순서)

## Rationale

결정 근거는 하위 문서마다 끝 `## Rationale` 에 있다. 아래 절은 옮긴 곳을 가리킨다.

### 병렬 분기 캐시 격리: 얕은 복사와 개발·테스트 환경 동결 (2026-06-10)

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#병렬-분기-캐시-격리-얕은-복사와-개발테스트-환경-동결-2026-06-10)

### `done` 출력에 `count` 를 싣는다 (2026-06-03 결정 B)

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#done-출력에-count-를-싣는다-2026-06-03-결정-b)

### `waitAll=false` 를 지원하지 않는다 (2026-05-30 결정 K)

→ [Parallel 노드 — 설정과 에러](CLE-NODE-PARALLEL-CONFIG.md#waitallfalse-를-지원하지-않는다-2026-05-30-결정-k)

### 중첩 Parallel 을 제한적으로 허용한다 (깊이 2, 동시 실행 수 곱 상한 32, 2026-05-30 결정 #3 · G · D)

→ [Parallel 노드 — 놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md#중첩-parallel-을-제한적으로-허용한다-깊이-2-동시-실행-수-곱-상한-32-2026-05-30-결정-3--g--d)

### `cancel-others-on-fail` 항목 에러 정책 (2026-05-30, 결정 A · H)

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#cancel-others-on-fail-항목-에러-정책-2026-05-30-결정-a--h)

### 완료 `meta` 에 병렬 분기 수와 실패 수를 따로 싣지 않는다 (2026-10-24)

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#완료-meta-에-병렬-분기-수와-실패-수를-따로-싣지-않는다-2026-10-24)

### 완료 출력은 병렬 분기 결과를 그대로 두고 실패를 따로 모은다 (2026-11-01)

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#완료-출력은-병렬-분기-결과를-그대로-두고-실패를-따로-모은다-2026-11-01)

### 실패 목록 필드 이름은 `skipped` 다 (2026-11-01)

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#실패-목록-필드-이름은-skipped-다-2026-11-01)

### 병렬 분기 결과는 실제로 실행된 마지막 노드의 출력이다 (2026-11-01)

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#병렬-분기-결과는-실제로-실행된-마지막-노드의-출력이다-2026-11-01)

### 완료 출력 `port` 는 `'done'` 문자열이다 (2026-11-01)

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#완료-출력-port-는-done-문자열이다-2026-11-01)

### `branchCount` 범위 검사는 경고 규칙 한 곳에 둔다 (2026-11-01)

→ [Parallel 노드 — 설정과 에러](CLE-NODE-PARALLEL-CONFIG.md#branchcount-범위-검사는-경고-규칙-한-곳에-둔다-2026-11-01)

### `error.code` 의 값 (2026-11-01)

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#errorcode-의-값-2026-11-01)

### 병렬 분기 사본에 엔진 쓰기를 옮긴다 (2026-11-02)

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#병렬-분기-사본에-엔진-쓰기를-옮긴다-2026-11-02)

### 결과 노드의 동률은 엔진 위상 순서로 가른다 (2026-11-02)

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#결과-노드의-동률은-엔진-위상-순서로-가른다-2026-11-02)

### `off` 되돌림 경로는 완료 출력을 만들지 않는다 (2026-11-02)

→ [Parallel 노드 — 출력 구조](CLE-NODE-PARALLEL-OUTPUT.md#off-되돌림-경로는-완료-출력을-만들지-않는다-2026-11-02)

### 병렬 분기 안 입력 대기는 실행 중에도 병렬 분기 실패로 다룬다 (2026-11-02)

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#병렬-분기-안-입력-대기는-실행-중에도-병렬-분기-실패로-다룬다-2026-11-02)

### 병렬 분기 안의 안쪽 Parallel 을 Parallel 실행 경로로 넘긴다 (2026-11-06)

→ [Parallel 노드 — 놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md#병렬-분기-안의-안쪽-parallel-을-parallel-실행-경로로-넘긴다-2026-11-06)

### 컨테이너 본문과 서브 워크플로우의 Parallel 도 Parallel 실행 경로로 넘긴다 (2026-11-06)

→ [Parallel 노드 — 놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md#컨테이너-본문과-서브-워크플로우의-parallel-도-parallel-실행-경로로-넘긴다-2026-11-06)

### `stop` 은 모든 병렬 분기를 기다린 뒤 실패를 던진다 (2026-11-06)

→ [Parallel 노드 — 실행 로직](CLE-NODE-PARALLEL-EXEC.md#stop-은-모든-병렬-분기를-기다린-뒤-실패를-던진다-2026-11-06)

### 컨테이너 안 Background 본문의 Parallel 은 사전 검사도 깊이 1 부터 센다 (2026-11-12)

→ [Parallel 노드 — 놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md#컨테이너-안-background-본문의-parallel-은-사전-검사도-깊이-1-부터-센다-2026-11-12)
