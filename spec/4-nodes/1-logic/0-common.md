# Spec: Logic 노드 공통 규약

> 관련 문서: [PRD 노드 시스템](../../../prd/3-node-system.md#4-logic-노드-11종) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

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
| `skip` | 스킵된 인덱스에 `{ _skipped: true, error: { code, message } }` 삽입 (인덱스 유지) |
| `continue` | 에러 발생 항목도 결과에 포함 (에러 정보는 NodeExecution 에 기록) |

ForEach 의 결과 배열 인덱스 유지 규칙은 [실행 엔진 §3.2](../../5-system/4-execution-engine.md#32-foreach--map-실행) 참조.

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
