# Spec: Logic 노드 상세 (12종)

> 관련 문서: [PRD 노드 시스템](../../prd/3-node-system.md#3-logic-노드) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md)

---

## 1. If/Else

조건식을 평가하여 True/False 분기.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| conditions | ConditionGroup[] | 조건 그룹 목록 |
| combineMode | `and` / `or` | 조건 그룹 간 결합 방식 |
| strictComparison | Boolean | 엄격 타입 비교 모드 (기본: false). true 시 타입 변환 없이 비교. [표현식 언어 §3.2.1](../5-system/5-expression-language.md#321-strict-모드) 참조 |

**ConditionGroup 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| field | Expression | 비교할 값 (표현식) |
| operator | Enum | 비교 연산자 |
| value | Expression | 비교 대상 값 |

**지원 연산자:**

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

### 설정 UI

```
┌──────────────────────────────────────┐
│  Conditions (AND ▼)                  │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ {{ $input.role }} [equals ▼]    ││
│  │ "admin"                     [×] ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ {{ $input.age }}  [greater ▼]   ││
│  │ 18                          [×] ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Condition]                   │
└──────────────────────────────────────┘
```

### 포트
- 입력: `in` (1개)
- 출력: `true` (조건 만족), `false` (조건 불만족)

### 실행 로직
1. `input` 데이터에 대해 모든 조건 평가
2. combineMode에 따라 AND/OR 결합
3. 결과가 true → `true` 포트로 출력, false → `false` 포트로 출력
4. 입력 데이터는 변형 없이 해당 포트로 전달 (pass-through)

---

## 2. Switch

입력 값에 따라 N개의 경로 중 하나로 분기.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| mode | `value` / `expression` | 매칭 모드 |
| switchValue | Expression | 비교할 기준 값 (mode=value) |
| cases | CaseDef[] | 케이스 목록 |
| hasDefault | Boolean | Default 경로 사용 여부 |
| strictComparison | Boolean | 엄격 타입 비교 모드 (기본: false). true 시 타입 변환 없이 비교. [표현식 언어 §3.2.1](../5-system/5-expression-language.md#321-strict-모드) 참조 |

**CaseDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| label | String | 케이스 이름 (포트 라벨) |
| value | any | 매칭 값 (mode=value) |
| condition | ConditionGroup | 조건식 (mode=expression) |

### 포트
- 입력: `in` (1개)
- 출력: 동적 추가/제거. 각 케이스 포트에 **UUID v4** 기반 ID를 할당한다 (예: `550e8400-e29b-41d4-a716-446655440000`). 케이스 추가/삭제/재정렬/이름 변경 시에도 기존 포트 ID는 불변이므로 연결된 엣지가 유지된다. `default` 포트는 고정 ID.

### 설정 UI
- 케이스 추가/제거 버튼
- 각 케이스에 라벨과 값/조건 입력
- 케이스 순서 드래그 정렬 (포트 ID는 변경되지 않음)
- Default 토글

### 실행 로직
1. `switchValue` 평가
2. 각 케이스의 값/조건과 순서대로 비교
3. 첫 번째 매칭 케이스의 포트로 출력
4. 매칭 없고 hasDefault=true → `default` 포트로 출력
5. 매칭 없고 hasDefault=false → 에러 (또는 에러 핸들링 정책)

---

## 3. Loop

지정된 횟수만큼 내부 노드 그룹을 반복 실행.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| count | Expression | 반복 횟수 (정수 또는 표현식) |
| maxIterations | Integer | 최대 반복 제한 (기본: 1000) |
| breakCondition | ConditionGroup? | Break 조건 (선택) |

### 포트
- 입력: `in` (외부 데이터 진입), `emit` (body 서브그래프에서 수집 지점)
- 출력: `body` (반복 본문 → 하위 노드로), `done` (반복 완료 후)

### 실행 컨텍스트 변수
- `$loop.index`: 현재 반복 인덱스 (0부터)
- `$loop.count`: 총 반복 횟수
- `$loop.isFirst`: 첫 번째 반복 여부
- `$loop.isLast`: 마지막 반복 여부

### 실행 로직
1. `count` 평가.
2. `body` 포트에 연결된 노드 그룹을 count 횟수만큼 반복.
3. 매 반복마다 `$loop.*`를 바인딩하고 body를 토폴로지 순서로 실행.
4. 각 반복의 `emit` 포트에 연결된 body 노드 출력을 결과 배열로 수집.
5. `breakCondition` 충족 시 조기 종료.
6. `maxIterations` 초과 시 에러.
7. 반복 완료 후 수집된 배열을 `done` 포트로 전달.

### 제약
- `emit` 포트에 **반드시 정확히 1개**의 body 노드가 연결되어야 한다 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`).
- body 내부에 back-edge(순환) 및 blocking 노드(form / buttons / ai_conversation)는 허용하지 않는다.

> **중첩 컨테이너 스코프**: [실행 엔진 §3.4](../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프) 참조.

### 컨테이너 렌더링

Loop 노드는 [컨테이너](../3-workflow-editor/0-canvas.md#10-컨테이너-노드)로 렌더링된다.

| 항목 | 설명 |
|------|------|
| body 포트 | 컨테이너 내부의 진입점. 내부 첫 번째 노드로 데이터 전달 |
| emit 포트 | 각 반복에서 수집할 값을 지정하는 body 내부 입력 |
| done 포트 | 컨테이너 외부 연속. 반복 완료 후 수집된 배열을 다음 노드로 전달 |
| 실행 시각화 | 실행 중 헤더에 현재 반복 인덱스 표시 (예: "Iteration 3/10") |

---

## 4. Variable Declaration

워크플로우 실행 컨텍스트에 변수 선언.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| variables | VarDef[] | 선언할 변수 목록 |

**VarDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| name | String | 변수 이름 (영문, _, 숫자) |
| type | Enum | string / number / boolean / array / object |
| defaultValue | any | 초기값 (표현식 가능) |

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

### 실행 로직
1. 각 변수를 실행 컨텍스트에 등록
2. 초기값 설정
3. 입력 데이터를 그대로 `out` 포트로 전달 (pass-through)
4. 이후 노드에서 `{{ $var.variableName }}`으로 참조

---

## 5. Variable Modification

이전에 선언된 변수의 값 수정.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| modifications | ModDef[] | 수정 목록 |

**ModDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| variable | String | 대상 변수 이름 |
| operation | Enum | 수정 연산 |
| value | Expression | 새 값 또는 연산에 사용할 값 |

**지원 연산:**

| 연산 | 적용 타입 | 설명 |
|------|-----------|------|
| `set` | 모든 타입 | 값 덮어쓰기 |
| `increment` | number | 값 증가 |
| `decrement` | number | 값 감소 |
| `append` | string | 문자열 뒤에 추가 |
| `push` | array | 배열 끝에 요소 추가 |
| `pop` | array | 배열 끝 요소 제거 |
| `set_field` | object | 객체 필드 설정 (value = {field, val}) |
| `delete_field` | object | 객체 필드 제거 |

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

### 실행 로직
1. 대상 변수 존재 확인 (없으면 에러)
2. 연산 수행
3. 입력 데이터를 그대로 `out` 포트로 전달

---

## 6. Split

배열 데이터를 `[{ index, value }]` 형태로 정규화하여 출력한다. 각 항목에 대한 반복 실행이 필요하면 ForEach 노드와 조합한다.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| fieldPath | Expression | 분리할 배열 필드 경로 (예: `$input.items`) |

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개 — 정규화된 항목 배열을 일괄 출력)

### 실행 로직
1. `fieldPath`로 배열 추출. **dot-path 문자열**(`"items"`, `"order.items"`)이면 `$input`에 적용하고, `{{ $var.a }}`처럼 **inline 표현식**이면 expression resolver가 값 자체를 치환하므로 그 값을 그대로 사용.
2. 배열이 아니면 빈 배열(`[]`)을 출력.
3. 각 항목을 `{ index, value }` 객체로 감싸 배열로 출력.

**예시:**
```
입력: { "id": 1, "items": [{ "name": "a" }, { "name": "b" }] }

출력:
  [
    { "index": 0, "value": { "name": "a" } },
    { "index": 1, "value": { "name": "b" } }
  ]
```

원본의 다른 필드(`id` 등)는 Split 출력에 포함되지 않는다. 필요하면 후속 노드에서 `$node["이전 노드"].output.id`로 직접 참조한다.

### Split + ForEach 조합 패턴

Split은 배열을 일괄 출력하므로, 각 항목에 대해 개별 처리가 필요하면 ForEach 노드와 연결한다.

```
[Split] → out: [{index,value}, ...] → [ForEach (arrayField: $input)] → body: 각 항목 처리 → done: 결과 배열
```

**예시 — 주문 항목 개별 처리:**
```
1. Split: $input.order.items → [{ index: 0, value: <item0> }, ...] 배열 출력
2. ForEach: 배열의 각 항목에 대해 body 실행. body 내에서 $item.value로 실제 항목, $item.index로 순번 참조
3. done: 각 항목 처리 결과를 배열로 수집
```

---

## 7. Map

배열의 각 항목에 대해 body 서브그래프를 실행하고, 각 반복의 `emit` 포트 출력을 모아 새 배열을 생성하는 **컨테이너 노드**. ForEach와 동일한 실행 모델을 사용하지만 시맨틱이 "결과 수집(transform)"으로 특화되어 있다.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| inputField | Expression | 변환 대상 배열 필드 경로 (예: `$input.items`) |
| errorPolicy | Enum | `stop` / `skip` / `continue` (기본 `stop`) |

### 포트
- 입력: `in` (외부 데이터 진입), `emit` (body 서브그래프에서 수집 지점)
- 출력: `body` (각 항목을 body 내부 첫 노드로 전달), `done` (전체 변환 완료 후 수집된 배열)

### 실행 로직
1. `inputField`로 배열 추출. **dot-path 문자열**(`"items"`)이면 `$input`에 적용, **inline 표현식**(`{{ $var.a }}`)이면 resolver가 치환한 값을 직접 사용. 배열이 아니면 빈 배열로 처리.
2. 각 항목에 대해:
   - `$item`/`$itemIndex`를 바인딩하고 body 서브그래프의 첫 노드로 항목을 전달.
   - body 노드를 토폴로지 순서로 실행.
   - `emit` 포트에 연결된 body 노드의 출력을 해당 iter 결과로 수집.
3. 모든 iter 완료 시 수집된 결과 배열을 `done` 포트로 전달.
4. `errorPolicy`에 따라 iter 에러 처리: `stop`은 즉시 실패, `skip`/`continue`는 에러 항목에 `{_skipped, error}`를 넣고 진행.

### 제약
- `emit` 포트에 **반드시 정확히 1개의 body 노드**가 연결되어야 한다 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`).
- body 내부에 back-edge(순환) 및 blocking 노드(form / buttons / ai_conversation)는 허용하지 않는다.

### ForEach와의 차이
ForEach는 "각 항목에 대해 side effect 중심의 body 실행", Map은 "각 항목을 새로운 값으로 변환하여 배열을 생성"에 의미적으로 특화. 엔진 내부에서 동일한 executor(`ForEachExecutor`)를 공유하지만 UX·시맨틱상 두 노드를 구분한다.

---

## 8. Filter

배열에서 조건에 맞는 항목만 추출하여 출력한다. 조건에 맞지 않는 항목은 별도 포트로 출력한다.

> **Transform `array_filter`와의 차이**: Transform의 `array_filter`는 변환 체인 내에서 특정 필드의 배열을 간단한 조건식으로 필터링하는 인라인 연산이다. Filter 노드는 워크플로우 흐름 상의 독립 노드로, 다중 조건(ConditionGroup)과 조건 결합(AND/OR)을 지원하며, 매칭/비매칭 항목을 각각 별도 포트로 분기한다.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| inputField | Expression | 대상 배열 필드 경로 (예: `$input.items`) |
| conditions | ConditionGroup[] | 필터 조건 목록 (If/Else와 동일 구조) |
| combineMode | `and` / `or` | 조건 간 결합 방식 (기본: `and`) |
| strictComparison | Boolean | 엄격 타입 비교 모드 (기본: false). true 시 타입 변환 없이 비교. [표현식 언어 §3.2.1](../5-system/5-expression-language.md#321-strict-모드) 참조 |

**ConditionGroup 구조:** If/Else 노드와 동일. 단, 조건 내 `field` 표현식에서 `$item`으로 현재 배열 항목을 참조한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| field | Expression | 비교할 값 (예: `{{ $item.status }}`, `{{ $item.age }}`) |
| operator | Enum | 비교 연산자 (If/Else와 동일 연산자 목록) |
| value | Expression | 비교 대상 값 |

### 설정 UI

```
┌──────────────────────────────────────┐
│  Array Field                         │
│  [$input.items___________________]   │
│                                      │
│  Conditions (AND ▼)                  │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ {{ $item.status }} [equals ▼]   ││
│  │ "active"                    [×] ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ {{ $item.age }}  [greater ▼]    ││
│  │ 18                          [×] ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Condition]                   │
│                                      │
│  ☐ Strict type comparison            │
└──────────────────────────────────────┘
```

### 포트
- 입력: `in` (1개)
- 출력: `match` (조건 만족 항목 배열), `unmatched` (조건 불만족 항목 배열)

### 실행 컨텍스트 변수
- `$item`: 현재 평가 중인 배열 항목 (ForEach, Map과 동일 패턴)

### 실행 로직
1. `inputField`로 배열 추출
2. 배열이 아니면 에러
3. 각 항목에 대해 `$item`을 바인딩하고 모든 조건 평가
4. combineMode에 따라 AND/OR 결합하여 최종 매칭 여부 결정
5. 매칭된 항목을 배열로 수집하여 `match` 포트로 출력
6. 매칭되지 않은 항목을 배열로 수집하여 `unmatched` 포트로 출력
7. 빈 배열도 정상 출력 (에러 아님)

---

## 9. ForEach

배열의 각 항목에 대해 body 서브그래프를 순차 실행하고, 각 반복의 `emit` 포트 출력을 수집해 배열로 내보내는 **컨테이너 노드**.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| arrayField | Expression | 대상 배열 필드 경로 |
| errorPolicy | Enum | 에러 정책: `stop` / `skip` / `continue` (기본 `stop`) |

### 포트
- 입력: `in` (외부 데이터 진입), `emit` (body 서브그래프에서 수집 지점)
- 출력: `body` (각 항목 처리 본문 진입), `done` (전체 완료 후 수집된 배열)

### 실행 컨텍스트 변수
- `$item`: 현재 배열 항목
- `$itemIndex`: 현재 인덱스
- `$item.isFirst`, `$item.isLast`: 첫/마지막 항목 여부 (itemContext 기반)

### 실행 로직
1. `arrayField`로 배열 추출. **dot-path 문자열**(`"items"`)이면 `$input`에 적용, **inline 표현식**(`{{ $var.a }}`)이면 resolver가 치환한 값을 직접 사용. 배열이 아니면 빈 배열로 처리.
2. 각 항목에 대해:
   - `$item` / `$itemIndex`를 바인딩하고 body 서브그래프를 토폴로지 순서로 실행.
   - `emit` 포트에 연결된 body 노드의 출력을 해당 iter 결과로 수집.
3. `errorPolicy`에 따른 에러 처리 (원본 배열과 **동일 인덱스** 유지):
   - `skip`: 스킵된 인덱스에 `{ _skipped: true, error: { code, message } }` 삽입.
   - `continue`: 에러 발생 항목도 결과에 포함 (에러 정보는 NodeExecution에 기록).
   - `stop`: 즉시 실행 실패.
4. 전체 완료 후 수집된 결과 배열을 `done` 포트로 전달.

### 제약
- `emit` 포트에 **반드시 정확히 1개**의 body 노드가 연결되어야 한다 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`).
- body 내부에 back-edge(순환) 및 blocking 노드(form / buttons / ai_conversation)는 허용하지 않는다.

> **결과 배열 인덱스 유지 및 중첩 컨테이너 스코프**: [실행 엔진 §3.2](../5-system/4-execution-engine.md#32-foreach-실행) 및 [§3.4](../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프) 참조.

### 컨테이너 렌더링

ForEach 노드는 [컨테이너](../3-workflow-editor/0-canvas.md#10-컨테이너-노드)로 렌더링된다. Loop/Map과 동일한 패턴을 따른다.

| 항목 | 설명 |
|------|------|
| body 포트 | 컨테이너 내부의 진입점. 각 항목을 내부 첫 번째 노드로 전달 |
| emit 포트 | 각 반복에서 수집할 값을 지정하는 body 내부 입력 |
| done 포트 | 컨테이너 외부 연속. 전체 배열 처리 완료 후 수집된 배열을 다음 노드로 전달 |
| 실행 시각화 | 실행 중 헤더에 현재 항목 인덱스 표시 (예: "Item 2/5") |

---

## 10. Parallel

여러 분기를 동시에(병렬로) 실행.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| branchCount | Integer | 분기 수 (출력 포트 수) |
| maxConcurrency | Integer? | 동시 실행 제한 (없으면 전체 동시) |
| waitAll | Boolean | 모든 분기 완료를 기다릴지 |

### 포트
- 입력: `in` (1개)
- 출력: `branch_0`, `branch_1`, ... (동적, branchCount에 따름)

### 실행 로직
1. 입력 데이터를 모든 분기에 복제 전달
2. 각 분기의 하위 노드 그룹을 병렬 실행
3. maxConcurrency 설정 시 동시 실행 수 제한
4. waitAll=true → 모든 분기 완료 후 다음 노드 진행
5. waitAll=false → 각 분기 독립적으로 완료 시 다음 노드 진행

---

## 11. Merge

여러 입력 경로의 데이터를 하나로 합침.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| strategy | Enum | 병합 전략 |
| outputFormat | Enum | 출력 형식 |
| timeout | Integer | 입력 대기 타임아웃 (초 단위, 기본: 300) |
| partialOnTimeout | Boolean | 타임아웃 시 부분 병합 수행 여부 (기본: false). true 시 도착한 입력만으로 병합 수행. false 시 에러 처리 정책에 따름 (`MERGE_TIMEOUT` 에러) |

**병합 전략:**

| 전략 | 설명 |
|------|------|
| `wait_all` | 모든 입력이 도착할 때까지 대기 후 합침 |
| `first` | 가장 먼저 도착한 입력만 통과 |
| `append` | 도착 순서대로 배열에 추가, 모든 입력 도착 후 출력 |

**출력 형식:**

| 형식 | 설명 |
|------|------|
| `array` | 각 입력을 배열 요소로 합침 `[input0, input1, ...]` |
| `merge_object` | 객체를 shallow merge `{...input0, ...input1}` |
| `indexed` | 인덱스 키로 합침 `{ "in_0": input0, "in_1": input1 }` |

### 포트
- 입력: `in` (1개, 다중 엣지 수신 가능)
- 출력: `out` (1개)

---

## 12. Background

하위 노드 그룹을 백그라운드로 실행 (메인 흐름 비블로킹).

> **🚧 구현 상태 — 미구현 (spec-only)**: 본 절은 장래 도입 예정 기능의 스펙이다. 현재 `frontend/src/lib/node-definitions/index.ts`에 `background` 노드 정의가 없고, `backend/.../execution-engine.service.ts`의 `registerHandlers`에도 `background` 타입 핸들러가 등록되어 있지 않다. 실행 엔진 §3.3(Background 실행)도 같은 상태. 다른 컨테이너(Loop/ForEach/Map)가 공유하는 `runContainer` → `executeContainerBody` 인프라 위에 **비동기 실행 + 알림 파이프라인**만 추가하면 되므로, 구현 시 이 절을 기준으로 작업한다. 캔버스 컨테이너 UX 규칙은 Loop/ForEach/Map과 동일.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| notifyOnComplete | Boolean | 완료 시 알림 (기본: false) |
| notifyOnError | Boolean | 에러 시 알림 (기본: true) |
| notifyChannels | String[] | 알림 채널 목록 (기본: `["in_app"]`). 지원 값: `in_app`, `email`, `slack` |
| slackChannelId | String? | Slack 알림 대상 채널 ID (`notifyChannels`에 `slack` 포함 시 필수). 워크스페이스에 연동된 Slack Integration 사용 |
| timeout | Integer? | 백그라운드 실행 타임아웃 (초) |

### 포트
- 입력: `in` (1개)
- 출력: `main` (즉시 진행), `background` (백그라운드 본문)

### 실행 로직
1. `background` 포트의 하위 노드 그룹을 비동기로 시작
2. 메인 흐름은 즉시 `main` 포트로 진행 (입력 데이터 pass-through)
3. 백그라운드 실행은 독립적으로 진행
4. 완료/실패 시 `notifyChannels` 설정에 따라 알림 전송 (아래 참조)
5. 타임아웃 초과 시 백그라운드 실행 강제 종료

### 실패 알림 처리

Background 내부 실행이 실패하면 메인 흐름의 Execution 상태에는 영향을 주지 않으나, 사용자에게 알림을 전송한다.

| 알림 채널 | 동작 |
|-----------|------|
| `in_app` | Notification 엔티티 생성 (`type: background_failed`). 실행을 시작한 사용자에게 인앱 알림. 클릭 시 Execution 상세로 이동 |
| `email` | 실행을 시작한 사용자의 이메일로 실패 알림 발송. 워크플로우 이름, 실패 노드, 에러 메시지 포함 |
| `slack` | `slackChannelId`로 지정된 채널에 실패 메시지 전송. 워크스페이스에 연동된 Slack Integration 사용. Integration 미연결 시 건너뜀 (에러 아님) |

**Execution 상세 화면 표시**: Background 실패 시 Execution 상세 화면에 "Background 실행" 별도 섹션을 표시한다. 실패한 내부 노드의 에러 정보, 실행 경로, 입출력 데이터를 확인할 수 있다. ([실행 엔진 §3.3](../5-system/4-execution-engine.md#33-background-실행) 참조)

### 컨테이너 렌더링

Background 노드는 [컨테이너](../3-workflow-editor/0-canvas.md#10-컨테이너-노드)로 렌더링된다.

| 항목 | 설명 |
|------|------|
| background 포트 | 컨테이너 내부의 진입점. 내부 노드를 비동기로 실행 |
| main 포트 | 컨테이너 외부로 즉시 진행 (입력 데이터 pass-through) |
| 실행 방식 | 내부 노드 그래프를 별도 Worker 태스크로 비동기 실행 (메인 흐름 비블로킹) |
| 실행 시각화 | 백그라운드 실행 중 헤더에 스피너 아이콘 표시 |

---

## 13. 캔버스 요약

각 Logic 노드가 캔버스에 표시하는 설정 요약 텍스트 포맷. ([캔버스 §5.3](../3-workflow-editor/0-canvas.md#53-노드-설정-요약-configuration-summary) 참조)

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
| Background | 알림 채널 나열. 없으면 `no notification` | `notify: slack, email` |
