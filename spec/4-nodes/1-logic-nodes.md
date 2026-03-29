# Spec: Logic 노드 상세 (11종)

> 관련 문서: [PRD 노드 시스템](../../prd/3-node-system.md#3-logic-노드) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md)

---

## 1. If/Else

조건식을 평가하여 True/False 분기.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| conditions | ConditionGroup[] | 조건 그룹 목록 |
| combineMode | `and` / `or` | 조건 그룹 간 결합 방식 |

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
- 입력: `in` (1개)
- 출력: `body` (반복 본문 → 하위 노드로), `done` (반복 완료 후)

### 실행 컨텍스트 변수
- `$loop.index`: 현재 반복 인덱스 (0부터)
- `$loop.count`: 총 반복 횟수
- `$loop.isFirst`: 첫 번째 반복 여부
- `$loop.isLast`: 마지막 반복 여부

### 실행 로직
1. `count` 평가
2. `body` 포트에 연결된 노드 그룹을 count 횟수만큼 반복
3. 매 반복마다 `$loop.index` 업데이트
4. breakCondition 충족 시 조기 종료
5. maxIterations 초과 시 에러
6. 반복 완료 후 마지막 body 출력을 `done` 포트로 전달

> **반복 간 데이터 전달**: 리프 노드 정의, 다중 리프 출력 병합 규칙, 중첩 컨테이너 스코프 체인은 [실행 엔진 §3.1](../5-system/4-execution-engine.md#31-loop-실행) 및 [§3.4](../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프)를 참조한다.

### 컨테이너 렌더링

Loop 노드는 [컨테이너](../3-workflow-editor/0-canvas.md#10-컨테이너-노드)로 렌더링된다.

| 항목 | 설명 |
|------|------|
| body 포트 | 컨테이너 내부의 진입점. 내부 첫 번째 노드로 데이터 전달 |
| done 포트 | 컨테이너 외부 연속. 반복 완료 후 다음 노드로 진행 |
| 반복 간 데이터 전달 | 반복마다 내부 리프 노드의 출력이 다음 반복의 입력으로 전달 |
| 최종 출력 | 마지막 반복의 리프 노드 출력이 `done` 포트로 전달 |
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

배열 데이터를 개별 항목으로 분리.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| fieldPath | Expression | 분리할 배열 필드 경로 (예: `$input.items`) |
| keepOtherFields | Boolean | 원본 데이터의 다른 필드를 각 항목에 병합할지 |

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개 — 각 항목별 순차 출력)

### 실행 로직
1. `fieldPath`로 배열 추출
2. 배열이 아니면 에러
3. 각 항목을 개별 출력으로 순차 전달
4. keepOtherFields=true 시 원본 객체의 다른 필드를 각 항목에 병합
5. 하류 노드가 각 항목에 대해 순차 실행됨

**예시:**
```
입력: { "id": 1, "items": ["a", "b", "c"] }
출력 (순차):
  → { "id": 1, "item": "a" }
  → { "id": 1, "item": "b" }
  → { "id": 1, "item": "c" }
```

---

## 7. Map

배열의 각 항목에 변환 로직을 적용하여 새 배열 생성.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| inputField | Expression | 대상 배열 필드 경로 |
| outputField | String | 결과를 저장할 필드 이름 |
| mapping | MappingDef[] | 변환 매핑 규칙 |

**MappingDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| targetField | String | 출력 필드 이름 |
| expression | Expression | 변환 표현식 ({{ $item.field }} 참조) |

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

### 실행 로직
1. `inputField`로 배열 추출
2. 각 항목에 대해 mapping 규칙 적용
3. 변환된 배열을 `outputField`에 저장하여 출력

---

## 8. ForEach

배열의 각 항목에 대해 하위 워크플로우(노드 그룹)를 순차 실행.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| arrayField | Expression | 대상 배열 필드 경로 |
| errorPolicy | Enum | 에러 정책: `stop` / `skip` / `continue` |
| collectResults | Boolean | 실행 결과를 배열로 수집할지 |

### 포트
- 입력: `in` (1개)
- 출력: `body` (각 항목 처리 본문), `done` (전체 완료)

### 실행 컨텍스트 변수
- `$item`: 현재 배열 항목
- `$item.index`: 현재 인덱스
- `$item.isFirst`, `$item.isLast`: 첫/마지막 항목 여부

### 실행 로직
1. `arrayField`로 배열 추출
2. 각 항목에 대해 `body` 포트의 하위 노드 그룹 순차 실행
3. errorPolicy에 따라 에러 처리
4. collectResults=true 시 각 body 실행 결과를 배열로 수집
5. 전체 완료 후 수집된 결과를 `done` 포트로 전달

> **결과 배열 인덱스 유지 및 다중 리프 병합**: [실행 엔진 §3.2](../5-system/4-execution-engine.md#32-foreach-실행) 참조. 중첩 컨테이너 스코프 체인은 [§3.4](../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프)를 참조한다.

### 컨테이너 렌더링

ForEach 노드는 [컨테이너](../3-workflow-editor/0-canvas.md#10-컨테이너-노드)로 렌더링된다. Loop와 동일한 패턴을 따른다.

| 항목 | 설명 |
|------|------|
| body 포트 | 컨테이너 내부의 진입점. 각 항목을 내부 첫 번째 노드로 전달 |
| done 포트 | 컨테이너 외부 연속. 전체 배열 처리 완료 후 다음 노드로 진행 |
| 항목별 실행 | 각 배열 항목마다 내부 노드 그래프를 순차 실행 |
| 결과 수집 | collectResults=true 시 각 항목의 리프 노드 출력을 배열로 수집 → `done` 포트로 전달 |
| 실행 시각화 | 실행 중 헤더에 현재 항목 인덱스 표시 (예: "Item 2/5") |

---

## 9. Parallel

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

## 10. Merge

여러 입력 경로의 데이터를 하나로 합침.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| inputCount | Integer | 입력 포트 수 |
| strategy | Enum | 병합 전략 |
| outputFormat | Enum | 출력 형식 |

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
| `indexed` | 인덱스 키로 합침 `{ "0": input0, "1": input1 }` |

### 포트
- 입력: `in_0`, `in_1`, ... (동적, inputCount에 따름)
- 출력: `out` (1개)

---

## 11. Background

하위 노드 그룹을 백그라운드로 실행 (메인 흐름 비블로킹).

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| notifyOnComplete | Boolean | 완료 시 알림 |
| notifyOnError | Boolean | 에러 시 알림 |
| timeout | Integer? | 백그라운드 실행 타임아웃 (초) |

### 포트
- 입력: `in` (1개)
- 출력: `main` (즉시 진행), `background` (백그라운드 본문)

### 실행 로직
1. `background` 포트의 하위 노드 그룹을 비동기로 시작
2. 메인 흐름은 즉시 `main` 포트로 진행 (입력 데이터 pass-through)
3. 백그라운드 실행은 독립적으로 진행
4. 완료/실패 시 설정에 따라 알림
5. 타임아웃 초과 시 백그라운드 실행 강제 종료

### 컨테이너 렌더링

Background 노드는 [컨테이너](../3-workflow-editor/0-canvas.md#10-컨테이너-노드)로 렌더링된다.

| 항목 | 설명 |
|------|------|
| background 포트 | 컨테이너 내부의 진입점. 내부 노드를 비동기로 실행 |
| main 포트 | 컨테이너 외부로 즉시 진행 (입력 데이터 pass-through) |
| 실행 방식 | 내부 노드 그래프를 별도 Worker 태스크로 비동기 실행 (메인 흐름 비블로킹) |
| 실행 시각화 | 백그라운드 실행 중 헤더에 스피너 아이콘 표시 |
