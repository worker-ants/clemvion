# Variable Modification (`variable_modification`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/variable_modification.md](../../node-specs/logic/variable_modification.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

> UI 라벨: "Set Variable"

## 1. 현재 Output 구조 요약

워크플로우 변수 저장소 (`$var.*`) 의 값을 변경하는 pass-through + side-effect 노드. `set` / `increment` / `decrement` / `append` / `push` / `pop` 6개 operation 을 순서대로 적용합니다.

```json
{
  "config": {
    "modifications": [
      { "variable": "counter", "operation": "increment", "value": 1 },
      { "variable": "log",     "operation": "append",    "value": " done" },
      { "variable": "items",   "operation": "push",      "value": { "id": 42 } }
    ]
  },
  "output": { "previous": "node output here" }
}
```

특징 요약:

- **컨테이너 아님**, **Blocking 아님**.
- `output` 이 input pass-through.
- 실제 효과는 `context.variables` 에 대한 side-effect. 배열 순서대로 적용.
- 선언되지 않은 변수도 자유롭게 만들 수 있음 (declaration 없이 바로 `set` 가능).
- **schema-handler 불일치**: schema `modOperationSchema` 의 enum 에는 `set_field` / `delete_field` 가 포함되어 있으나 **핸들러에는 구현이 없어** validate 단계에서 reject됨. 사용자 혼란 가능.
- `push` / `pop` 은 **in-place mutation** — 동일 배열 참조를 다른 변수 / 노드 output 에서 보는 경우 주의.
- `meta` / `port` / `status` 미사용.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | **schema enum 과 handler 구현 불일치** | Principle 3.1 / 7 | `set_field` / `delete_field` 가 schema 에는 있으나 핸들러 미구현 → validate 에서 reject. 이는 **P0 이슈**: schema 를 handler 에 맞춰 `set/increment/decrement/append/push/pop` 6개로 축소하거나 handler 에 해당 ops 를 구현 |
| 2 | `output` 이 input pass-through | Principle 1 (형식적) | side-effect 노드, 메인 흐름 계속 — pass-through 정당 |
| 3 | 실제 적용된 변경 목록이 meta 에 없음 | Principle 2 | 어떤 변수가 어떤 값으로 변했는지 meta 로 노출 필요 |
| 4 | `meta.durationMs` 부재 | Principle 2 | 공통 메트릭 |
| 5 | `push` / `pop` in-place mutation 의 공유 참조 이슈 | Principle 3 (silent bug) | 다른 노드의 output 이 같은 배열 참조를 잡고 있으면 조용히 변경됨 — 디버깅 어려움. 최소한 문서/meta 에 경고 |
| 6 | `increment` / `decrement` 시 비숫자 값이 `0` 으로 리셋 | Principle 3 | silent 타입 변환 — `meta.coercionWarnings` 로 가시화 |
| 7 | `append` 시 비문자열 값이 `''` 으로 리셋 | Principle 3 | 위와 동일 |
| 8 | `push` 시 비배열 변수가 `[value]` 로 덮어쓰기 | Principle 3 | 기존 값이 조용히 버려짐 |

## 3. 제안된 Output 구조

### Before

```json
{
  "config": {
    "modifications": [
      { "variable": "counter", "operation": "increment", "value": 1 }
    ]
  },
  "output": { "previous": "node output here" }
}
```

### After

```json
{
  "config": {
    "modifications": [
      { "variable": "counter", "operation": "increment", "value": 1 },
      { "variable": "log",     "operation": "append",    "value": " done" }
    ]
  },
  "output": { "previous": "node output here" },
  "meta": {
    "durationMs": 1,
    "modified": [
      {
        "variable": "counter",
        "operation": "increment",
        "previousValue": 0,
        "newValue": 1
      },
      {
        "variable": "log",
        "operation": "append",
        "previousValue": "processing",
        "newValue": "processing done"
      }
    ],
    "coercionWarnings": [],
    "createdVariables": []
  }
}
```

**핵심 변경점**:

- `output` 은 **input pass-through 유지** (side-effect 노드 특성).
- `meta.modified: Array<{ variable, operation, previousValue, newValue }>` 추가 — 적용된 각 변경의 before/after. 디버깅과 감사 추적에 핵심.
- `meta.coercionWarnings` 추가 — 타입 리셋이 발생한 경우 (`increment` on non-number → 0 으로 reset, `append` on non-string → `''` 로 reset, `push` on non-array → `[value]` 로 덮어쓰기) 기록.
- `meta.createdVariables: string[]` 추가 — 선언 없이 이 노드가 **처음 생성한** 변수 이름 목록 (사용자 오탈자 감지).
- `meta.durationMs` 공통 메트릭 추가.
- **P0: schema-handler enum 동기화** — 다음 중 택일:
  - (A) schema 를 handler 에 맞춰 축소: `set` / `increment` / `decrement` / `append` / `push` / `pop` 6개만.
  - (B) handler 에 `set_field` / `delete_field` 구현 추가. 객체 필드 setter/deleter — 유용할 수 있음.
  - 권장: **(A)** 로 먼저 맞추고 (B) 는 별도 기능으로 관리.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output` | No | pass-through 유지 |
| `$node["X"].config.modifications` | `$node["X"].config.modifications` | No | echo 유지 |
| `$var.counter` | `$var.counter` | No | 전역 변수 접근 유지 |
| (없음) | `$node["X"].meta.modified` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.coercionWarnings` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.createdVariables` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 |
| schema enum `set_field` / `delete_field` | schema enum 에서 제거 | **Yes (schema)** | 저장된 워크플로우 config 검사 — 실제 사용 여부 확인 (handler 에서 reject 되므로 실제로 동작하던 워크플로우는 없을 것) |

**권장 전략**:

1. P0 (schema fix): schema enum 을 handler 의 `VALID_OPERATIONS` 와 일치시켜 `set_field` / `delete_field` 제거. 기존 워크플로우 영향 조사 — handler 에서 이미 reject 되고 있으므로 실사용 불가능했음을 확인.
2. P0 (additive meta): `meta.modified`, `meta.coercionWarnings`, `meta.createdVariables`, `meta.durationMs` 추가.
3. P1: 프런트엔드 실행 결과 패널에서 `meta.modified` 의 before/after 를 시각화.
4. P1: `push` / `pop` 의 in-place mutation 특성을 문서에 경고로 강화. 필요 시 엔진에서 `structuredClone` 기반 모드 스위치 검토 (Phase 별도).
5. 문서 보강: "variable_declaration 과 달리, variable_modification 은 선언되지 않은 변수도 만들 수 있다" 를 `meta.createdVariables` 와 연계해 기술.

## 5. 근거

- **Principle 3.1 (Pre-flight 에러)**: schema 와 handler 의 enum 불일치는 사용자가 설정한 값이 silent 로 reject 되는 pre-flight 에러 — 가장 우선순위가 높은 수정 대상.
- **Principle 1 (output 은 비즈니스 데이터)**: side-effect 노드의 pass-through 는 정당. 변경 내용은 `meta` 로 분리.
- **Principle 2 (meta 는 실행 메트릭)**: `modified`, `coercionWarnings`, `createdVariables`, `durationMs` 는 모두 실행 메트릭.
- **Principle 3 (silent failure 해소)**: 타입 리셋, 비배열 → 배열 덮어쓰기 등 조용히 일어나는 데이터 변경을 `meta.coercionWarnings` 로 노출.
- **Principle 7 (Config echo)**: `modifications` 배열 전체 echo 유지 (이미 준수).
- **audit 트레일**: variable 변경의 before/after 기록은 워크플로우 실행 감사 (audit) 측면에서도 가치 — 디버깅, 자동 테스트, rollback 분석.
- **쌍 노드 대칭성**: `variable_declaration.meta.declared` ↔ `variable_modification.meta.modified` — 두 side-effect 노드가 동일 패턴으로 `meta` 에 결과를 노출해 일관성 확보.
- INCONSISTENCY_MATRIX 축 6 채택안: "pass-through 유지 + 부가 정보는 `meta` 로 이동" — 본 제안이 해당 전략 적용.
