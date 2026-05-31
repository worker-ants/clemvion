---
id: common
status: implemented
code:
  - codebase/backend/src/nodes/logic/_shared/*.ts
  - codebase/backend/src/nodes/logic/*/*.handler.ts
  - codebase/backend/src/nodes/logic/*/*.schema.ts
---

# Spec: Logic 노드 공통 규약

> 관련 문서: [PRD 노드 시스템](../_product-overview.md#4-logic-노드-12종) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

본 문서는 Logic 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [If/Else](./1-if-else.md)
- [Switch](./2-switch.md)
- [Loop](./3-loop.md) (컨테이너)
- [Variable Declaration](./4-variable-declaration.md)
- [Variable Modification](./5-variable-modification.md)
- [Split](./6-split.md)
- [Map](./7-map.md) (컨테이너)
- [Filter](./8-filter.md)
- [ForEach](./9-foreach.md) (컨테이너)
- [Parallel](./10-parallel.md)
- [Merge](./11-merge.md)
- [Background](./12-background.md) (컨테이너)

---

## 1. ConditionGroup 구조

If/Else, Switch, Filter, ForEach 등 조건 평가 노드가 공통으로 사용하는 구조.

| 필드 | 타입 | 설명 |
|------|------|------|
| field | Expression | 비교할 값 (표현식). Filter 등 배열 노드에서는 `$item` 으로 현재 항목 참조 |
| operator | Enum | 비교 연산자 (아래 표 참조) |
| value | Expression | 비교 대상 값 |

**ConditionGroup 자체:**

| 필드 | 타입 | 설명 |
|------|------|------|
| logicalOperator | `and` / `or` | 그룹 내 조건 결합 방식 |
| conditions | Condition[] | 개별 조건 목록 |

`combineMode` (그룹 간 결합 방식) 는 If/Else / Filter 노드에서 다중 그룹을 사용할 때 추가로 노출된다.

## 2. 지원 연산자

| 연산자 | 설명 |
|--------|------|
| `eq` | 같음 (==) |
| `neq` | 다름 (!=) |
| `gt` | 초과 (>) |
| `gte` | 이상 (>=) |
| `lt` | 미만 (<) |
| `lte` | 이하 (<=) |
| `contains` | 포함 (문자열) |
| `not_contains` | 미포함 (문자열) |
| `starts_with` | ~로 시작 |
| `ends_with` | ~로 끝남 |
| `is_empty` | 비어 있음 |
| `is_not_empty` | 비어 있지 않음 |
| `regex` | 정규식 매칭 |
| `is_null` | null 여부 |
| `is_type` | 타입 확인 (string, number, boolean, array, object) |

타입 변환 규칙 / strict 모드 동작은 [표현식 언어 §3.2.1](../../5-system/5-expression-language.md#321-strict-모드) 참조. 조건 평가 노드는 `strictComparison: Boolean` (기본 false) 필드로 strict 모드를 토글할 수 있다.

## 3. 컨테이너 노드 패턴 (Loop / Map / ForEach)

Loop / Map / ForEach 는 모두 `body` 서브그래프를 반복 실행하고 `emit` 포트로 결과를 수집하는 **컨테이너 노드**다. 동일한 실행 모델을 공유한다.

| 포트 | 방향 | 설명 |
|------|------|------|
| `in` | 입력 | 외부 데이터 진입 |
| `emit` | 입력 | body 서브그래프에서 수집 지점 (반드시 정확히 1개의 body 노드 연결) |
| `body` | 출력 | 컨테이너 내부의 진입점. 각 반복에서 첫 번째 노드로 데이터 전달 |
| `done` | 출력 | 반복 완료 후 수집된 배열을 다음 노드로 전달 |

**제약 (모든 컨테이너 공통):**
- `emit` 포트에 **반드시 정확히 1개**의 body 노드가 연결되어야 한다 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`).
- body 내부에 back-edge(순환) 및 blocking 노드(form / buttons / ai_conversation)는 허용하지 않는다.
- 캔버스에서 [컨테이너](../../3-workflow-editor/0-canvas.md#11-컨테이너-노드)로 렌더링되며, 실행 중 헤더에 현재 진행 인덱스를 표시한다 (예: "Iteration 3/10", "Item 2/5").

> **중첩 컨테이너 스코프**: [실행 엔진 §3.4](../../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프) 참조.

> Background 노드는 다른 컨테이너와 달리 **`containerId` 멤버십 패턴을 쓰지 않는다** — `background` 출력 포트의 엣지로 연결된 노드들을 본문 진입점으로 보고 forward-reachable 노드를 본문으로 간주한다. 본문은 **fire-and-forget** 으로 실행되며 결과가 메인으로 돌아오지 않는다. 자세한 동작은 [Background 노드 문서](./12-background.md) 참조.

## 4. 에러 정책 (errorPolicy)

Map / ForEach / Parallel 은 반복 중 에러 발생 시 다음 정책으로 분기된다:

| 값 | 동작 |
|------|------|
| `stop` (기본) | 즉시 실행 실패 |
| `skip` | 실패 인덱스에 인덱스 보존 placeholder 를 두고, 실패 정보는 노드별 분리 위치로 보낸다 (ForEach: `output.items[i] = null` + `output.skipped[]`. Map: `output.mapped[i] = { _skipped: true, error }` 인라인). |
| `continue` | 에러 발생 항목도 결과에 포함하되 `skip` 과 동일한 분리 위치로 정보가 흐른다 (NodeExecution 에도 기록) |

ForEach 의 결과 분리 형태는 [foreach §5.3](./9-foreach.md#53-case-변형-errorpolicy--skip--continue-시-결과-분리), Map 의 인라인 마커 형태는 [map §5.4](./7-map.md) 참조. 결과 배열 인덱스 보존 규칙은 [실행 엔진 §3.2](../../5-system/4-execution-engine.md#32-foreach--map-실행) 참조.

## 5. 반복/분기 출력 구조 (CONVENTIONS §9.2)

컨테이너 / 분기 노드는 `{ <컬렉션>, count }` 형태로 결과를 내보낸다 (CONVENTIONS §9.2).

| 노드 | 컬렉션 키 |
|------|-----------|
| Loop | `iterations` |
| Map | `mapped` |
| ForEach | `items` |
| Parallel | `branches` |

다운스트림은 `$node["X"].output.<key>[i]` 로 개별 결과에, `$node["X"].output.count` 로 실행된 개수에 접근한다.

## 6. 리소스 제한

| 필드 | 노드 | 설명 |
|------|------|------|
| `maxIterations` | Loop | 최대 반복 제한 (기본 1000). 초과 시 에러 |
| `maxConcurrency` | Parallel | 동시 실행 제한. `0` = 무제한, `1`~`16` = 해당 수만큼 동시 실행. 기본 `0` |

## 7. 포트 ID 불변성 (동적 포트)

If/Else, Switch, Filter, AI Agent 조건 도구 등에서 **동적으로 추가/삭제 가능한 포트**는 다음 규칙을 따른다:

- 정적 포트: 노드 정의에서 고정 문자열 (`in`, `out`, `true`, `false`, `body`, `done` 등)
- 동적 포트: 생성 시 **UUID v4** 를 할당. 포트 이름 변경, 재정렬, 다른 포트 삭제 등 편집 작업에도 **기존 포트 ID는 불변**.

이를 통해 포트에 연결된 엣지가 편집 이후에도 유지된다.

---

## 8. 캔버스 요약

각 Logic 노드가 캔버스에 표시하는 설정 요약 텍스트 포맷. ([캔버스 §5.3](../../3-workflow-editor/0-canvas.md#53-노드-설정-요약-configuration-summary) 참조)

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| If/Else | 첫 번째 조건의 `{field} {operator} {value}`. 조건 2개 이상이면 `{combineMode}` 표시 후 잘림 | `role == "admin" AND ...` |
| Switch | `{switchValue} → {N} cases` | `$input.type → 3 cases` |
| Loop | `{count}x`. breakCondition 있으면 `· break condition` 추가 | `10x · break condition` |
| Variable Declaration | 선언된 변수명 쉼표 구분 (최대 3개, 초과 시 `+N`) | `counter, total, +1` |
| Variable Modification | `{variable} {operation}` (첫 번째 수정) | `counter increment` |
| Split | 대상 필드 경로 | `$input.items` |
| Map | `{N} mappings` | `3 mappings` |
| Filter | `{inputField} · {N} conditions · {combineMode}`. 조건 1개이면 combineMode 생략 | `$input.items · 2 conditions · AND` |
| ForEach | `{arrayField}`. errorPolicy가 `stop`이 아니면 `· {policy}` 추가 | `$input.items · skip errors` |
| Parallel | `{N} branches` | `3 branches` |
| Merge | `{N} inputs · {strategy}` | `3 inputs · wait_all` |
| Background | `notifyOnFailure`/`maxDurationMs` 요약. 알림이 꺼져 있으면 시간만 표시 | `notify on fail · 5m` |

---

## 9. 5필드 공통 규약 (Logic 카테고리)

Logic 노드는 모두 [CONVENTIONS Principle 0](../../conventions/node-output.md) 의 5필드 invariant `{ config, output, meta?, port?, status? }` 를 따른다. 카테고리 특이 사용 패턴:

| 필드 | Logic 카테고리에서의 사용 패턴 |
|------|----------------------------------|
| `config` | 사용자 입력 raw echo (Principle 7). `conditions[]` 등 표현식 `{{ }}` 보존. credentials/sensitive 필드는 Logic 카테고리에 해당 없음 |
| `output` | 분기 노드(if_else, switch, filter)·변수 노드(var_decl, var_mod)·배경(background main) 은 **input pass-through** (§10). 컨테이너 노드(loop, foreach, map, parallel)는 핸들러가 `output: items` (또는 `null`) 반환 → 엔진이 `{ <컬렉션>, count }` 로 오버라이트 (§5, Principle 9). 데이터 노드(split, merge)는 계산 결과 |
| `meta` | 실행 메트릭만 (Principle 2). 컨테이너: `meta.iterations? / branches? / matchedCount?`. 분기: `meta.conditionResult? / matchedConditions?`. 모든 노드 공통: `meta.durationMs` (엔진 inject) |
| `port` | 분기 노드는 `'true'` / `'false'` / 동적 case ID. 컨테이너는 `'done'`. 일반 노드는 `undefined` (단일 출력) |
| `status` | Logic 노드는 모두 비-블로킹이므로 일반적으로 `undefined`. background 만 `'background_running'` 등 가능 |

### 9.1 컨테이너 노드 핸들러 ↔ 엔진 오버라이트 컨트랙트

Loop / ForEach / Map / Parallel 의 노드 envelope 는 시점에 따라 두 가지 다른 `output` 을 갖는다:

1. **시작 시점 (body 진입 직전)**: 핸들러가 한 번 실행되어 `output: items[]` 를 반환한다. 엔진은 이 배열을 body iteration 입력으로 분배.
2. **완료 시점 (모든 iteration 종료 후)**: **엔진이 핸들러 호출 없이 `output` 을 `{ <컬렉션>: [...], count: N }` 으로 직접 덮어쓴다** (Principle 9). 핸들러는 두 번째 tick 으로 재호출되지 않는다.

| 노드 | 컬렉션 키 | 시작 시점 output (handler return) | 완료 시점 output (engine override) |
|------|-----------|--------------------|----------------------------------------|
| `loop` | `iterations` | (없음 — Loop는 입력 분배 안 함) | `{ iterations: [...], count }` |
| `foreach` | `items` | `items[]` (body 입력 분배) | `{ items: [...], count }` |
| `map` | `mapped` | `items[]` (body 입력 분배) | `{ mapped: [...], count }` |
| `parallel` | `branches` | (없음 — 분기별 빈 입력) | `{ branches: [...], count }` |

> **D2 결정**: 시작 시점의 `output: items[]` 는 **엔진-내부 전용 중간 표현** 이다. body 분배 직후 엔진 오버라이트로 envelope 의 `output` 이 `{ <컬렉션>, count }` 로 교체되므로, **다운스트림 expression (`$node["X"].output.*`) · 외부 observer (run history API · webhook payload 등) 어디서도 raw 배열이 노출되지 않는다**. 핸들러 시그니처(`output: items[]`)와 외부 노출 형태가 다른 이질감은 의도된 설계 — 5필드 invariant (`{config, output, meta?, port?, status?}`) 를 깨지 않고 분배용 데이터를 엔진에 전달하기 위한 컨트랙트다.

다운스트림 노드는 `done` 포트 이후에 항상 `{ <컬렉션>, count }` 형태를 본다.

## 10. Pass-through 노드 규약

다음 5종 Logic 노드는 `output = input` (변형 없음) **pass-through 컨트랙트**를 갖는다:

| 노드 | 분기 방식 | 부가 정보 위치 |
|------|-----------|---------------|
| `if_else` | `port: 'true' \| 'false'` | `meta.conditionResult`, `meta.matchedConditions` |
| `switch` | `port: <case_id> \| 'default'` | `meta.matchedCase`, `meta.matchedCaseLabel`, `meta.matchedCaseIndex`, `meta.resolvedValue` |
| `variable_declaration` | 단일 출력 | `meta.declared[]`, `meta.skipped[]`, `meta.coercionWarnings[]` |
| `variable_modification` | 단일 출력 | `meta.modifications[]`, `meta.coercionWarnings[]`, `meta.createdVariables[]` |
| `background` (main 포트) | `main` (즉시) / `bg` (background 진입 시) | `meta.backgroundRunId` |

**왜 pass-through 인가**: 위 노드의 "비즈니스 결과물" (Principle 1) 은 input 자체가 아니라 **분기된 데이터 흐름**이다. input 을 변형 없이 흘려보내고 분기/메타정보만 `port`·`meta` 에 담는 것이 다른 노드들의 데이터 변형 컨트랙트(map, transform 등)와 명확히 구분된다.

Switch `meta.value` 는 deprecated alias 이며 `meta.resolvedValue` 단독으로 정리되어 있다.

## 11. 출력 구조 색인

각 Logic 노드의 출력 구조 케이스 색인. 각 노드 문서의 §5 로 링크.

| 노드 | 정상 / 분기 케이스 | 컨테이너 케이스 (Principle 9) | 비고 |
|------|-------------------|---------------------------------|------|
| [if_else](./1-if-else.md#5-출력-구조) | §5.1 (`true`) / §5.2 (`false`) | — | Pass-through |
| [switch](./2-switch.md#5-출력-구조) | §5.1 (`<case_id>`) / §5.2 (`default`) | — | Pass-through, 동적 포트 |
| [loop](./3-loop.md#5-출력-구조) | §5.1 (시작 — `body`) / §5.2 (`done`) | §5.7 `{iterations, count}` | 컨테이너 |
| [variable_declaration](./4-variable-declaration.md#5-출력-구조) | §5.1 (단일) | — | Pass-through |
| [variable_modification](./5-variable-modification.md#5-출력-구조) | §5.1 (단일) | — | Pass-through |
| [split](./6-split.md#5-출력-구조) | §5.1 (단일) | — | 데이터 노드 |
| [map](./7-map.md#5-출력-구조) | §5.1 (시작) / §5.2 (`done`) | §5.7 `{mapped, count}` | 컨테이너 |
| [filter](./8-filter.md#5-출력-구조) | §5.1 (`match` + `unmatched` 동시 활성화) | — | 분기 (양쪽 포트 동시) |
| [foreach](./9-foreach.md#5-출력-구조) | §5.1 (시작) / §5.2 (`done`) | §5.7 `{items, count}` | 컨테이너 |
| [parallel](./10-parallel.md#5-출력-구조) | §5.1 (시작 — N분기) / §5.2 (`done`) | §5.7 `{branches, count}` | 컨테이너 |
| [merge](./11-merge.md#5-출력-구조) | §5.1 (단일) | — | 데이터 노드 |
| [background](./12-background.md#5-출력-구조) | §5.1 (`main`) / §5.2 (`bg`) | §5.7 (변형) | 컨테이너 (fire-and-forget) |
