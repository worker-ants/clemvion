---
id: "CLE-NODE-PARALLEL-NEST"
title: "Parallel 노드 — 놓인 위치와 중첩"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-PARALLEL"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC", "CLE-NODE-PARALLEL"]
area: "CLE-NODE-LOGIC"
content_hash: "5da7f30de20c10a40f1899b14204546a7325f7d56287b856e7d47764479877f5"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "d84a11676955b28015404de2551880d9c07a6ce42f845a753fb3e2dfe58f3b1d"
etag: "sha256-3a2f12d5a203fc39bdd5ec187c0988b6e1e8e13114178b8100649367eec8afa0"
---
## 개요

이 문서는 [Parallel 노드](CLE-NODE-PARALLEL.md) 의 하위 문서로 Parallel 을 놓은 위치별 실행 경로, 중첩 Parallel 의 깊이 제한과 동시 실행 수 곱 상한, 깊이 검사의 시점과 범위를 정한다. 저장 · 캔버스 경고 규칙은 [그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md) 이 정한다.

## 놓인 위치별 실행과 중첩 깊이

Parallel 은 워크플로우 맨 바깥, 다른 Parallel 의 병렬 분기 안, 컨테이너(Loop · ForEach · Map) 본문, 동기 서브 워크플로우, Background 본문에 둘 수 있다. `PARALLEL_ENGINE=v1` 이면 어디에 두든 엔진의 Parallel 실행 경로(`runParallel`)로 실행한다. 메인 루프, 병렬 분기 루프(`executeParallelBranchBody`), 컨테이너 본문 루프(`executeContainerBody`), 동기 서브 워크플로우와 Background 본문 루프(`executeInline`)가 모두 Parallel 노드를 이 경로로 넘긴다. 그래서 실행기, 완료 출력 `{ branches, count, skipped? }` 와 `port: 'done'`, 항목 에러 정책, 결과 노드 규칙, 블로킹 노드와 되돌아가는 연결선 금지는 위치와 상관없이 같다. `PARALLEL_ENGINE=off` 면 어느 위치든 되돌림 경로로 실행한다.

중첩 깊이와 곱 상한은 위치에 따라 다르다.

| 위치 | 중첩 깊이 | 곱 상한 32 | 깊이 위반을 가장 먼저 잡는 곳 |
|------|----------|-----------|-----------------------------|
| 맨 바깥 | 1 | 걸리지 않음 | 자기 `planParallelBody`(병렬 분기 시작 전) |
| 병렬 분기 안(안쪽 Parallel) | 2 | 바깥 동시 실행 수와 곱해 적용 | 바깥 Parallel 의 `planParallelBody`(바깥 병렬 분기 시작 전) |
| 병렬 분기 밖 컨테이너 본문 | 1 | 걸리지 않음 | 컨테이너 시작(`runContainerInner`, 첫 반복 전) |
| 병렬 분기 안 컨테이너 본문 | 2(바깥 병렬 분기의 깊이를 이어받음) | 바깥 동시 실행 수와 곱해 적용 | 바깥 Parallel 의 `planParallelBody`(바깥 병렬 분기 시작 전) |
| 동기 서브 워크플로우 | 1(새로 셈) | 호출한 쪽과 곱하지 않음 | 서브 워크플로우 실행 안에서 위 규칙대로 |
| Background 본문 | 1(실행할 때 새로 셈) | 호출한 쪽과 곱하지 않음 | Background 본문 실행 안에서 위 규칙대로. 병렬 분기 본문에 바로 둔 Background 면 바깥 Parallel 의 `planParallelBody` 가 바깥 깊이를 이어서 먼저 검사한다([저장 규칙과 실행 검사의 범위](#저장-규칙과-실행-검사의-범위)) |
| 컨테이너 안 Background 본문 | 1(실행할 때 새로 셈) | 호출한 쪽과 곱하지 않음 | 컨테이너 시작(`runContainerInner`, 첫 반복 전)이 깊이 1 부터 센다. 병렬 분기 안 컨테이너면 바깥 Parallel 의 `planParallelBody` 가 깊이 1 부터 세어 먼저 검사한다 |

컨테이너 반복 회차는 컨테이너가 받은 컨텍스트를 그대로 쓴다. 그래서 병렬 분기 안 컨테이너 본문의 Parallel 은 바깥 병렬 분기 컨텍스트의 `parentParallelConcurrency` 를 보고 깊이 2 로 실행한다. 바깥 × 안쪽 동시 실행 수 곱이 32를 넘으면 안쪽 동시 실행 수를 줄이고 `meta.clampedConcurrency` 에 남긴다.

동기 서브 워크플로우는 실행하는 동안 호출한 쪽 컨텍스트의 `parentParallelConcurrency` 를 떼어 둔다. 서브 워크플로우가 끝나면 실패했더라도 그 값을 되돌린다. 그래서 서브 워크플로우의 Parallel 은 깊이 1 부터 센다. 병렬 분기 안에서 부른 서브 워크플로우의 Parallel 에는 호출한 쪽의 곱 상한이 걸리지 않으므로 동시 실행 수가 바깥 16 × 서브 워크플로우 16 까지 늘 수 있다. Background 본문은 새 컨텍스트에서 실행하므로 깊이 1 부터 센다.

컨테이너 본문 안이나 그 안의 병렬 분기에서 큐에 넣은 Background 는 깊이를 새로 세지만 그 회차의 반복 변수(`itemContext` · `loopContext`)는 복사해 받는다. 그래서 Background 본문의 식은 큐에 넣은 회차의 `$item` · `$loop` 를 읽는다([컨테이너 실행 §컨테이너 본문 안 Background](../CLE-EXEC/CLE-EXEC-CONTAINER.md#컨테이너-본문-안-background), [Background 노드](CLE-NODE-BACKGROUND.md#요구사항) 의 컨테이너 회차 반복 변수 복사 요구사항. 번호는 부모 문서 [하위 문서](CLE-NODE-PARALLEL.md#하위-문서) 표 아래에 있다).

깊이 검사는 병렬 분기나 반복 회차가 시작되기 전에 한다. 바깥 Parallel 은 병렬 분기 본문을 계획할 때(`planParallelBody`) 본문에서 안쪽 Parallel 이나 컨테이너를 만나면 그 본문까지 내려가 검사한다. 컨테이너 본문은 `containerId` 로 찾고 중첩된 컨테이너 본문까지 내려간다. 컨테이너도 시작할 때 첫 반복 전에 자기 본문의 Parallel 깊이를 검사한다(`runContainerInner`). 에디터의 연결선 체인 규칙 때문에 컨테이너 안 Background 의 `background` 연결선 뒤 노드도 그 컨테이너의 `containerId` 를 가진다. 두 사전 검사는 컨테이너 본문 노드 가운데 Background 본문으로만 닿는 노드를 골라(`collectBackgroundOnlyNodeIds`) 그 안의 Parallel 을 깊이 1 부터 센다. 회차 본문에서도 닿는 노드는 회차 루프가 실행하므로 컨테이너 본문 깊이로 센다. 회차 안에서 처음 검사하면 깊이 위반이 회차 하나의 실패가 되어 컨테이너의 `errorPolicy` 가 흡수하고 병렬 분기 안이면 바깥 Parallel 의 `continue` 도 흡수한다. 미리 검사하면 위반이 실행 실패로 드러난다.

서브 워크플로우는 다른 그래프라서 호출한 쪽의 사전 검사가 보지 않는다. 서브 워크플로우 안의 깊이 위반은 그 실행에서 에러로 던져지고 [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) 가 그 에러를 `error` 포트로 돌린다. Background 본문의 실패는 메인 실행에 영향을 주지 않는다([Background 노드](CLE-NODE-BACKGROUND.md)).

컨테이너 본문의 `emit` 원천 노드가 본문 Parallel 의 병렬 분기 안에 있어도 그 노드의 출력을 회차 결과로 모은다. `runParallel` 이 병렬 분기가 출력을 쓴 노드 ID 를 돌려주고 컨테이너 본문 루프는 그 ID 로 `emit` 원천 노드가 실행됐는지 판정한다. `emit` 규칙은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다.

### 저장 규칙과 실행 검사의 범위

중첩 깊이는 저장 단계 규칙 `parallel:nested-depth-exceeded`([그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md#등록된-규칙))와 실행 검사가 함께 본다. 두 검사가 따라가는 범위는 다르다.

| 항목 | 저장 단계 규칙 | 실행 검사 |
|------|--------------|----------|
| 시작하는 연결선 | 번호와 상관없이 모든 `branch_N` 연결선 | 맨 바깥 Parallel 은 `branch_0` ~ `branch_{branchCount-1}`. 안쪽 Parallel 은 `branchCount` 가 표현식일 수 있어 최댓값 16 으로 본다 |
| 따라가는 연결선 | 모든 연결선을 앞으로 따라간다 | 앞으로 가는 연결선을 따라가되 안쪽 Parallel 은 그것을 둘러싼 본문 안의 연결선만 따라간다 |
| 합류 노드 | 본문으로 세고 그 뒤 노드까지 따라간다 | 둘 이상의 병렬 분기가 닿는 노드는 본문에서 뺀다 |
| 컨테이너 본문 | 컨테이너 `body` 연결선을 따라 들어간다 | `containerId` 로 찾아 들어간다(중첩 컨테이너 포함) |
| 병렬 분기 안 Background 본문 | `background` 연결선도 따라가 병렬 분기 본문으로 센다 | 같다. 앞으로 가는 연결선을 포트와 상관없이 따라간다 |
| 병렬 분기 안 컨테이너에 둔 Background 본문 | 컨테이너 `body` 연결선과 `background` 연결선을 따라가 병렬 분기 본문으로 센다 | Background 본문으로만 닿는 노드를 가려 깊이 1 부터 센다 |
| 서브 워크플로우 | 보지 않는다 | 보지 않는다 |
| 구현 | `codebase/packages/graph-warning-rules/src/rules/parallel.ts` (`collectParallelBranchBodyNodeIds`) | `collectParallelBranchMembership` 과 `planParallelBody`, 컨테이너 본문은 `assertContainerBodyParallelsAllowed` 와 `collectBackgroundOnlyNodeIds` |

연결선으로 이어진 노드만 보면 저장 단계 규칙이 실행 검사보다 넓다. 합류 노드 뒤의 Parallel 과 설정한 병렬 분기 수 밖 `branch_N` 아래의 Parallel 은 저장할 때만 중첩으로 센다. 병렬 분기 안 컨테이너에 둔 Background 본문의 Parallel 도 저장할 때만 바깥 병렬 분기 깊이를 이어서 센다. 실행 검사는 컨테이너 본문을 `containerId` 로 찾으므로 컨테이너 `body` 연결선에서 닿지 않는 본문 노드도 본다. 호출한 쪽 그래프의 두 검사는 서브 워크플로우 안을 보지 않는다. 서브 워크플로우는 자기를 저장할 때와 실행할 때 따로 검사한다.

병렬 분기 본문에 바로 둔 Background 의 본문은 두 검사 모두 실제 실행보다 엄격하게 본다. 실행 그래프의 순방향 연결선 분류(`back-edge-identifier.ts`)와 병렬 분기 소속 판정(`collectParallelBranchMembership`)은 포트를 보지 않는다. 그래서 병렬 분기 안에 Background 가 있으면 `background` 연결선 뒤의 본문 노드도 그 병렬 분기 본문으로 잡힌다. 바깥 Parallel 의 사전 검사(`planParallelBody`)와 저장 규칙 `parallel:nested-depth-exceeded` 는 둘 다 그 Background 본문의 Parallel 을 바깥 병렬 분기 깊이를 이어서 센다. 그래서 깊이 2 병렬 분기 안 Background 본문에 Parallel 을 두면 저장 단계에서 거부되고 실행 때도 `PARALLEL_NESTED_DEPTH_EXCEEDED:` 로 실패한다. 그 Background 본문이 실제로 실행되면 깊이 1 로 돌 수 있는 그래프다. Background 본문이 실제로 실행될 때의 깊이는 위 표대로 1 이고 이 두 검사는 그보다 엄격하다. 실행 검사의 블로킹 노드 금지(`PARALLEL_INVALID_CHILD`)도 같은 이유로 병렬 분기 안 Background 본문에 걸린다. 검사 범위에서 뺄지는 [미결 사항](CLE-NODE-PARALLEL.md#미결-사항) 에 남겼다. 컨테이너에 둔 Background 의 본문은 이 문단에 해당하지 않는다. 실행 검사는 컨테이너 본문을 병렬 분기 소속 판정이 아니라 `containerId` 로 찾고 그 가운데 Background 본문으로만 닿는 노드를 깊이 1 부터 센다. 저장 규칙만 바깥 깊이를 이어서 센다.

## Rationale

### 중첩 Parallel 을 제한적으로 허용한다 (깊이 2, 동시 실행 수 곱 상한 32, 2026-05-30 결정 #3 · G · D)

처음 단계에서는 `PARALLEL_NESTED_NOT_SUPPORTED` 로 모든 중첩을 거부했다. 다음 결정으로 제한적 중첩 허용으로 바꿨다.

**깊이 2 까지만**: 바깥 Parallel 의 병렬 분기 안에 안쪽 Parallel 한 단계만 허용하고 3중부터(`PARALLEL_NESTED_DEPTH_EXCEEDED`) 거부한다. 워크플로우를 나누기 어려운 경우가 있어 부분 허용은 가치가 있다. 하지만 깊이를 제한하지 않으면 동시 워커 수가 폭발하고 그래프 구조가 사용자가 머릿속에 그릴 수 있는 범위를 넘는다. 두 단계면 "분기 안에서 또 분기" 라는 가장 흔한 요구를 담는다.

**동시 실행 수 곱 상한 32**: 바깥 `maxConcurrency` 16 × 안쪽 16 이면 최대 256 워커가 동시에 돌 수 있다. 운영 환경에서 메모리 부족이나 이벤트 루프 지연 위험이 있다. 32 는 바깥 4 × 안쪽 8, 바깥 8 × 안쪽 4, 바깥 16 × 안쪽 2 같은 합리적 조합을 모두 허용하면서 워커 수 상한을 보수적으로 지킨다. 2026-11-06 부터 실행 시점의 곱 상한은 병렬 분기 안 Parallel 과 병렬 분기 안 컨테이너 본문의 Parallel 에만 걸리고 동기 서브 워크플로우 경계에서 끊긴다. 병렬 분기 안에서 부른 서브 워크플로우의 Parallel 은 깊이 1 부터 세므로 동시 실행 수가 바깥 16 × 서브 워크플로우 16 까지 늘 수 있다. 이 대가는 NERV 질문 `01a1b05f-6988-7613-a9d3-78c9492b9a86` 의 답(A, 2026-11-06 gehrig)에서 받아들였다. 병렬 분기 안 Background 본문의 Parallel 은 이 답과 별개로 새 컨텍스트에서 실행하므로 이 상한이 걸리지 않는다. 결정 경위는 [컨테이너 본문과 서브 워크플로우의 Parallel 도 Parallel 실행 경로로 넘긴다](#컨테이너-본문과-서브-워크플로우의-parallel-도-parallel-실행-경로로-넘긴다-2026-11-06) 에 있다.

**거부하지 않고 조용히 줄인다**: 상한을 넘으면 거부하지 않고 `effectiveConcurrency = max(1, floor(32 / parentEffective))` 로 자동으로 줄인다. `max(1, …)` 하한은 `parentEffective > 32` 인 경계에서 `floor` 가 0 이 돼 슬롯이 0 이 되고 모든 병렬 분기가 실행되지 않는 교착을 막는다(최소 1개 병렬 분기는 항상 실행한다). 워크플로우 작성자가 바깥·안쪽 `maxConcurrency` 곱을 늘 정확히 계산하기를 기대하기 어렵다. 의도와 실제의 차이는 두 경로로 보인다.

1. **런타임**: `ParallelExecutor` 가 값을 줄이면 결과에 `clampedConcurrency` 를 넣고 엔진이 그 값을 Parallel 노드의 `meta.clampedConcurrency = { intended, actual, parentEffective, cap }` 에 기록한다. 다음 노드는 `$node["Parallel"].meta.clampedConcurrency` 로 볼 수 있고 사용자는 실행 결과 타임라인에서 바로 확인한다. 운영 로그에는 `Logger.debug` 로 남긴다.
2. **저장·캔버스 사전 경고**: 그래프 경고 규칙 `parallel:nested-concurrency-cap` (warning)이 곱이 32를 넘으면 캔버스 배지로 먼저 알린다. 저장은 통과한다(런타임 줄이기가 안전망). 규칙 정의는 [그래프 경고 규칙 §등록된 규칙](../CLE-WF/CLE-WF-WARN.md#등록된-규칙) 이 정한다.

**3중 가드 (결정 E)**: 깊이 검증은 세 곳에서 한다. 런타임 그래프 검증(`planParallelBody` 와 컨테이너 시작)이 거부하고 워크플로우 저장이 그래프 경고 규칙 `parallel:nested-depth-exceeded` (error)로 거부(400 `GRAPH_VALIDATION_FAILED`)하고 캔버스가 같은 규칙을 로컬에서 평가해 먼저 알린다. 저장·캔버스 가드는 [그래프 경고 규칙 §평가 시점과 3중 가드](../CLE-WF/CLE-WF-WARN.md#평가-시점과-3중-가드) 가 정한다.

런타임 검사는 바깥 병렬 분기가 시작되기 전에 안쪽 본문까지 본다. 바깥 Parallel 이 병렬 분기 본문을 계획할 때 안쪽 Parallel 의 병렬 분기 본문과 컨테이너 본문까지 내려가고 컨테이너는 시작할 때 첫 반복 전에 자기 본문을 한 번 더 본다. 깊이 위반이 병렬 분기 하나나 반복 회차 하나의 실패로 바뀌면 바깥 `continue` 나 컨테이너 `errorPolicy` 가 그 실패를 흡수하기 때문이다(2026-11-06). 세 가드가 따라가는 범위는 같지 않고 그 차이는 [저장 규칙과 실행 검사의 범위](#저장-규칙과-실행-검사의-범위) 표가 정한다.

**전파 방식 (결정 G)**: `parentParallelConcurrency: number` 필드를 `ParallelBranchContext extends ExecutionContext` 에 둔다. 바깥 Parallel 의 `ParallelExecutor` 가 병렬 분기 컨텍스트를 복제할 때 자기 `effectiveConcurrency` 를 이 필드에 넣는다. 안쪽 Parallel 은 자기 `effectiveConcurrency` 를 계산할 때 이 값을 읽어 상한을 적용한다. 깊이 2 가드 아래에서 한 단계만 쌓인다. 값이 없으면(가장 바깥 Parallel) 줄이지 않고 자기 값을 그대로 쓴다.

초안 결정 G 는 이 필드를 `ExecutionContext` 의 선택 필드(`parentParallelConcurrency?`)로 바로 넣었다. 그러나 `ExecutionContext` 가 모든 것을 떠안는 객체가 된다는 우려에 따라 Parallel 전용 필드를 `ParallelBranchContext` 로 떼어 내도록 바꿨다(2026-05-31). 분류 근거와 결정 규칙은 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 가 정한다.

### 병렬 분기 안의 안쪽 Parallel 을 Parallel 실행 경로로 넘긴다 (2026-11-06)

이 개정 전에는 병렬 분기 루프(`executeParallelBranchBody`)가 컨테이너와 Background 만 따로 실행하고 안쪽 Parallel 은 다른 노드처럼 핸들러만 불렀다. 안쪽 Parallel 은 핸들러가 연 `branch_N` 포트로만 라우팅되어 안쪽 병렬 분기 노드를 바깥 병렬 분기 루프가 차례로 실행했고 `done` 포트 뒤 노드는 실행되지 않았다. 완료 출력이 없었고 깊이 · 곱 상한의 실행 시점 검사도 돌지 않았다.

이제 병렬 분기 루프는 Parallel 노드를 만나면 엔진의 Parallel 실행 경로(`runParallel`)로 넘긴다. 정한 내용은 다음과 같다.

- **동시 실행 수 상한**: 안쪽 Parallel 은 바깥 병렬 분기 컨텍스트를 받으므로 `parentParallelConcurrency` 로 곱 상한 32 를 적용한다. 값을 줄였으면 안쪽 Parallel 의 `meta.clampedConcurrency` 에 남긴다.
- **깊이 검사 시점**: 바깥 Parallel 이 병렬 분기 본문을 계획할 때(`planParallelBody`) 안쪽 Parallel 의 본문까지 함께 검사한다. 안쪽 Parallel 이 실행될 때 검사하면 깊이 위반이 바깥 병렬 분기 하나의 실패가 되어 바깥 `errorPolicy='continue'` 가 흡수한다. 깊이 초과는 실행을 실패시켜야 하므로 바깥 병렬 분기가 시작되기 전에 검사한다. 안쪽 `branchCount` 는 표현식일 수 있어 이 시점에는 값을 모른다. 그래서 최댓값 16 으로 보고 모든 `branch_N` 연결선을 따라간다. 저장 단계 규칙 `parallel:nested-depth-exceeded` 도 병렬 분기 수와 상관없이 모든 `branch_N` 연결선을 따라가므로 이 검사가 저장 단계보다 넓게 거부하지 않는다.
- **출력 범위**: 안쪽 병렬 분기도 자기 캐시 사본을 쓴다. 안쪽 병렬 분기가 끝나면 성공 여부와 상관없이 그 사본에 쓴 출력을 바깥 병렬 분기 사본에도 옮긴다(`publishBranchOutputsToParent`). 안쪽 합류 노드와 안쪽 `done` 뒤 노드는 바깥 병렬 분기 루프가 실행하고 바깥 사본에서 입력을 읽기 때문이다. 가장 바깥 Parallel 에서는 부모가 루트 컨텍스트라 옮길 것이 없다. 안쪽 완료 출력은 엔진 공통 쓰기 지점 `commitNodeOutput` 으로 루트와 바깥 사본에 함께 쓴다.
- **결과 노드**: 결과 노드 규칙은 바꾸지 않았다. 안쪽 병렬 분기 본문 노드는 바깥 병렬 분기 루프가 실행하지 않으므로 바깥 결과 노드 후보가 아니다. 안쪽 Parallel 노드 자신은 후보이고 그 결과는 안쪽 완료 출력이다.
- **출구 전파**: Parallel 이 끝나면 `done` 포트 뒤 노드와 병렬 분기 출구 노드의 다음 노드를 도달 가능으로 표시한다. 이때 병렬 분기 본문 안의 노드는 표시하지 않는다. 이 개정 전에는 출구 노드가 같은 병렬 분기 본문 노드로도 이어지면 메인 루프가 그 노드를 한 번 더 실행했다. 이 수정은 가장 바깥 Parallel 에도 적용된다.
- **`PARALLEL_ENGINE=off`**: 병렬 분기 루프는 `v1` 에서만 쓰므로 되돌림 경로는 바뀌지 않는다.

기각한 대안은 세 가지다.

- **안쪽 Parallel 이 실행될 때 깊이를 검사하는 안**: 깊이 위반이 바깥 `continue` 에 흡수되어 실행이 성공으로 끝날 수 있다. 깊이 초과는 실행을 실패시킨다는 규칙과 어긋난다.
- **안쪽 병렬 분기 출력을 안쪽 사본에만 두는 안**: 안쪽 합류 노드는 바깥 병렬 분기 루프가 실행하므로 입력이 빈다. 2026-11-02 「[병렬 분기 사본에 엔진 쓰기를 옮긴다](CLE-NODE-PARALLEL-EXEC.md#병렬-분기-사본에-엔진-쓰기를-옮긴다-2026-11-02)」 가 고친 결함이 한 단계 안에서 다시 생긴다.
- **[그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md#평가-시점과-3중-가드) 의 실행 시점 가드에 안쪽 Parallel 예외를 적는 안**: 동시 실행 수 곱 초과는 저장 단계에서 경고만 하고 저장을 통과시킨다. 실행 시점에 줄이지 않으면 그 안전망이 없어진다.

**기존 워크플로우 영향**: 병렬 분기 안 안쪽 Parallel 의 병렬 분기가 동시에 실행되고 안쪽 Parallel 이 `done` 포트로 완료 출력을 낸다. 안쪽 `done` 뒤 노드가 실행된다. 바깥 × 안쪽 동시 실행 수 곱이 32를 넘으면 안쪽 동시 실행 수가 줄어든다. 깊이 3 이상인 그래프는 병렬 분기가 시작되기 전에 실행이 실패한다.

### 컨테이너 본문과 서브 워크플로우의 Parallel 도 Parallel 실행 경로로 넘긴다 (2026-11-06)

이 개정 전에는 컨테이너 본문 루프(`executeContainerBody`)와 동기 서브 워크플로우 · Background 본문 루프(`executeInline`)가 Parallel 을 다른 노드처럼 핸들러만 불렀다. 그래서 같은 Parallel 노드라도 컨테이너 본문이나 서브 워크플로우에 두면 병렬 분기가 차례로 실행되고 완료 출력이 없었다. 항목 에러 정책과 깊이 · 곱 상한의 실행 시점 검사도 적용되지 않았다.

이제 두 루프도 Parallel 노드를 `runParallel` 로 넘긴다. 실행기, 완료 출력, `port: 'done'`, 항목 에러 정책, 결과 노드 규칙은 맨 바깥 Parallel 과 같다. [앞 절](#병렬-분기-안의-안쪽-parallel-을-parallel-실행-경로로-넘긴다-2026-11-06)에서 정한 깊이 검사 시점, 출력 범위, 출구 전파 규칙도 그대로 쓴다. `PARALLEL_ENGINE=off` 의 동작은 바꾸지 않았다([`off` 되돌림 경로](CLE-NODE-PARALLEL-OUTPUT.md#off-되돌림-경로는-완료-출력을-만들지-않는다-2026-11-02)). 이 경로로 넘기면서 사람에게 올려 정한 것은 두 가지다.

**중첩 깊이를 세는 방법 (NERV 질문 `01a1b05f-6988-7613-a9d3-78c9492b9a86`)**: 컨테이너 본문은 바깥 병렬 분기의 깊이를 이어받고 동기 서브 워크플로우는 깊이를 새로 센다(A, 채택). 컨테이너 본문은 같은 워크플로우 그래프에 있고 저장 단계 규칙도 컨테이너 `body` 연결선을 따라가 병렬 분기 안 컨테이너 본문의 Parallel 을 중첩으로 센다. 깊이를 이어받으면 바깥 Parallel 의 사전 검사가 병렬 분기 안 컨테이너 본문까지 내려가 깊이 위반을 병렬 분기 시작 전에 잡는다. 컨테이너 반복 회차는 받은 컨텍스트를 그대로 쓰므로 따로 고칠 필드도 없다. 대가는 병렬 분기 안에서 부른 서브 워크플로우의 Parallel 에 호출한 쪽의 곱 상한 32 가 걸리지 않는다는 것이다. 이 답으로 [곱 상한 결정](#중첩-parallel-을-제한적으로-허용한다-깊이-2-동시-실행-수-곱-상한-32-2026-05-30-결정-3--g--d)(2026-05-30)의 범위를 좁힌다. Background 본문은 이 결정과 상관없이 깊이를 새로 센다. Background 본문은 메인 실행과 따로 큐(BullMQ) 작업으로 돌고 새 실행 컨텍스트(`ExecutionContextService.createContext`)에서 시작한다. 호출한 쪽 병렬 분기의 컨텍스트 필드가 따라가지 않으므로 이어받을 깊이가 없다. 결과도 메인 흐름으로 돌아오지 않는다([Background 노드](CLE-NODE-BACKGROUND.md)).

- **(B) 둘 다 이어받는 안** (기각): 지금 깊이는 `parentParallelConcurrency` 가 있는지만 보고 1 이나 2 로 판별한다. 서브 워크플로우 호출을 건너 깊이를 넘기려면 `ParallelBranchContext` 에 깊이 필드를 더하고 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 를 고쳐야 한다. 서브 워크플로우는 다른 그래프라 바깥 사전 검사가 보지 못하므로 그 안의 깊이 위반은 실행 중에만 드러난다. 그러면 바깥 `continue` 가 그 실패를 흡수하므로 깊이 초과 시 실행 실패 규칙에 예외가 생긴다.
- **(C) 둘 다 새로 세는 안** (기각): 컨테이너 반복 회차마다 `parentParallelConcurrency` 를 떼어야 한다. 저장 단계 규칙은 병렬 분기 안 컨테이너 본문의 Parallel 을 중첩으로 세므로 실행 검사와 어긋난다.

어느 안을 골라도 Background 본문은 새 컨텍스트에서 시작해 깊이를 새로 센다. 병렬 분기 본문에 바로 둔 Background 의 본문은 바깥 사전 검사와 저장 규칙이 바깥 깊이를 이어서 센다([저장 규칙과 실행 검사의 범위](#저장-규칙과-실행-검사의-범위)). 여기에는 (C) 를 기각한 이유인 저장 규칙과 실행 깊이의 어긋남이 있다. 바깥 사전 검사도 저장 규칙처럼 깊이를 이어서 세므로 두 검사끼리는 맞고 실제 실행 깊이보다 엄격할 뿐이다. 검사 범위를 실행 깊이에 맞출지는 [미결 사항](CLE-NODE-PARALLEL.md#미결-사항) 에 남겼다. 병렬 분기 안 컨테이너에 둔 Background 의 본문은 실행 검사가 깊이 1 부터 센다([2026-11-12 절](#컨테이너-안-background-본문의-parallel-은-사전-검사도-깊이-1-부터-센다-2026-11-12)).

**병렬 분기의 반복 변수 (NERV 질문 `01a1b060-de22-7734-a37a-69c25ee314a3`)**: 병렬 분기 컨텍스트가 바깥 반복 변수(`itemContext` · `loopContext`, 표현식의 `$item` · `$itemIndex` · `$loop`)를 이어받는다(A, 채택). 요구사항의 「비운다」를 「부모 컨텍스트 값을 그대로 둔다」로 고쳤다. 맨 바깥과 병렬 분기 안의 Parallel 에서는 두 필드가 늘 비어 있었으므로 동작이 바뀌지 않는다. 병렬 분기마다 컨텍스트 객체가 따로라서 병렬 분기 안 ForEach · Loop 가 반복 변수를 바꿔도 다른 병렬 분기에 새지 않는다. 처음에 두 필드를 비운 이유가 중첩 ForEach · Loop 상태가 새지 않게 하려는 것이었는데 이 격리로 충분하다.

- **(B) 비우는 안** (기각): 컨테이너 본문 Parallel 의 병렬 분기에서 `$item` · `$loop` 가 `undefined` 가 된다. 회차마다 다른 반복 변수를 병렬 분기 안에서 쓸 수 없다.

**기존 워크플로우 영향** (`v1`):

- 컨테이너 본문 Parallel 의 병렬 분기가 동시에 실행된다. `done` 뒤 노드는 시작 시점 출력 대신 `{ branches, count, skipped? }` 를 받는다.
- 컨테이너 본문 Parallel 에는 블로킹 노드와 되돌아가는 연결선 금지와 깊이 검사가 적용된다. 컨테이너 본문은 이미 입력 대기 노드를 금지하므로 블로킹 노드 때문에 새로 실패하는 경우는 없다. 깊이 3 은 저장 단계 규칙이 이미 거부하므로 그 규칙이 생기기 전에 저장된 워크플로우만 새로 실패할 수 있다.
- 동기 서브 워크플로우와 Background 본문의 Parallel 에도 맨 바깥 Parallel 이 이미 따르던 블로킹 노드와 되돌아가는 연결선 금지가 새로 적용된다. 전에는 블로킹 노드에서 동기 서브 워크플로우는 입력을 기다렸고 Background 본문은 에러 없이 끝났다([Background 노드](CLE-NODE-BACKGROUND.md#본문의-블로킹-노드가-입력-대기로-멈추면-곧바로-조용히-끝낸다)). 이제는 병렬 분기가 시작되기 전에 메시지가 `PARALLEL_INVALID_CHILD:` 로 시작하는 에러로 실패한다. 실행 중에 입력 대기를 내는 노드는 그 병렬 분기를 실패시킨다.
- 병렬 분기 안 컨테이너 본문의 Parallel 은 곱 상한 32 를 넘으면 동시 실행 수가 줄어든다.
- 동기 서브 워크플로우 안 Parallel 의 병렬 분기가 동시에 실행된다. `done` 뒤 노드는 완료 출력을 받는다. 서브 워크플로우는 깊이를 1 부터 다시 세므로 병렬 분기 안에서 불러도 그 때문에 깊이 검사에 새로 걸리지는 않는다.
- 동기 서브 워크플로우가 Parallel 로 끝나면(`done` 뒤에 노드가 없으면) 서브 워크플로우의 최종 출력이 마지막 병렬 분기 노드의 출력에서 Parallel 완료 출력으로 바뀐다.
- Background 본문의 Parallel 은 전에는 병렬 분기 노드를 차례로 실행하고 완료 출력이 없었다. 이제 병렬 분기가 동시에 실행되고 `done` 으로 완료 출력이 나간다.

### 컨테이너 안 Background 본문의 Parallel 은 사전 검사도 깊이 1 부터 센다 (2026-11-12)

이 개정 전에는 컨테이너 본문 사전 검사(`assertContainerBodyParallelsAllowed`)가 컨테이너의 자식 노드 전부를 컨테이너 본문으로 보고 같은 `containerId` 를 가진 Background 본문의 Parallel 도 컨테이너가 받은 깊이로 셌다. 워커는 그 본문을 새 컨텍스트에서 깊이 1 부터 센다. 사전 검사가 실행보다 엄격해서 다음 두 조합이 실행 전에 `PARALLEL_NESTED_DEPTH_EXCEEDED:` 로 실패했다.

- 깊이 2 병렬 분기 안 컨테이너의 Background 본문에 Parallel 을 둔 경우. 워커에서는 깊이 1 이다.
- 깊이 1 병렬 분기 안 컨테이너의 Background 본문에 Parallel 을 두 단 둔 경우. 워커에서는 깊이 2 까지다.

**(A) Background 본문으로만 닿는 노드를 깊이 1 부터 세는 안** (채택): 사전 검사는 컨테이너 본문 노드 가운데 Background 본문으로만 닿는 노드를 가려(`collectBackgroundOnlyNodeIds`) 그 안의 Parallel 을 깊이 1 부터 센다. Background 노드의 `background` 연결선 대상에서 포트와 상관없이 따라가 닿는 노드가 Background 본문 쪽이다. 본문 안 Background 의 본문도 들어간다. 컨테이너 `body` 연결선 대상에서 Background 의 `background` 연결선만 건너뛰고 따라가 닿는 노드가 회차 본문 쪽이다. 두 쪽에서 모두 닿는 노드는 회차 루프도 실행하므로 컨테이너 본문 깊이로 센다. 컨테이너 시작(`runContainerInner`)과 바깥 Parallel 의 `planParallelBody` 가 같은 함수로 컨테이너 본문을 검사하므로 두 지점이 함께 바뀐다. 실행할 때의 깊이 판별(`parallelDepthOf`)은 바꾸지 않았다.

- **(B) 컨테이너 사전 검사에서 Background 본문 노드를 빼는 안** (기각): 워커가 본문을 실행할 때 다시 검사하므로 깊이 위반은 결국 드러난다. 그러나 Background 본문의 실패는 메인 실행에 영향을 주지 않으므로 메인 실행은 성공한다. Background 본문 안에서도 깊이 3 이 되는 그래프(Parallel 세 단)는 첫 반복 전에 잡아야 [놓인 위치별 실행과 중첩 깊이](#놓인-위치별-실행과-중첩-깊이) 의 「미리 검사하면 위반이 실행 실패로 드러난다」 와 맞는다.

병렬 분기 본문에 바로 둔 Background 의 본문은 이번에 바꾸지 않았다. 그 본문은 병렬 분기 소속 판정(`collectParallelBranchMembership`)이 바깥 병렬 분기 본문으로 잡으므로 고치려면 그 판정과 저장 규칙을 함께 바꿔야 한다. [미결 사항](CLE-NODE-PARALLEL.md#미결-사항) 에 남겼다.

**저장 규칙과의 차이**: 저장 규칙 `parallel:nested-depth-exceeded` 는 바꾸지 않았다. 그 규칙은 컨테이너 `body` 연결선과 `background` 연결선을 따라가 바깥 병렬 분기 깊이를 이어서 센다. 그래서 위 두 조합은 지금도 저장 단계에서 거부된다. 실행 검사가 저장 규칙보다 느슨한 경우가 하나 늘었고 합류 노드 뒤 Parallel 과 같은 종류의 차이다. 2026-11-06 절은 컨테이너 반복 회차마다 깊이를 새로 세는 안(C)을 저장 규칙과 어긋난다는 이유로 기각했다. 그 대상은 컨테이너가 받은 컨텍스트를 그대로 쓰는 회차 본문이다. 회차 본문의 Parallel 은 실제로 바깥 병렬 분기 깊이로 실행되므로 새로 세면 실행이 저장 규칙보다 느슨해진다. Background 본문은 새 컨텍스트에서 실행되어 실제 깊이가 1 이다. 이번 개정은 실행 깊이를 바꾸지 않고 사전 검사를 실제 실행 깊이에 맞춘 것이라 (C) 를 기각한 이유와 부딪치지 않는다. 남는 차이는 저장 규칙이 더 엄격한 쪽 하나다.

**기존 워크플로우 영향**: 저장 단계 규칙이 두 조합을 이미 거부하므로 그 규칙을 통과해 저장된 워크플로우의 동작은 바뀌지 않는다. 그 규칙을 거치지 않고 저장된 워크플로우만 이제 실행 전에 실패하지 않고 Background 본문을 큐에 넣는다.
