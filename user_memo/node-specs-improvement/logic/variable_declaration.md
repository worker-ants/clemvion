# Variable Declaration (`variable_declaration`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/variable_declaration.md](../../node-specs/logic/variable_declaration.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

워크플로우 변수 저장소 (`$var.*`) 에 변수를 선언하고 초기값을 설정하는 pass-through + side-effect 노드. **이미 선언된 변수는 덮어쓰지 않음** (최초 1회만 초기화).

```json
{
  "config": {
    "variables": [
      { "name": "counter", "type": "number", "defaultValue": 0 },
      { "name": "users", "type": "array", "defaultValue": "[]" }
    ]
  },
  "output": { "previous": "node output here" }
}
```

특징 요약:

- **컨테이너 아님**, **Blocking 아님**.
- `output` 이 input pass-through.
- 실제 효과는 `context.variables[name]` 에 대한 side-effect.
- `coerceToType` 으로 초기값을 타입별 변환. `null` / `undefined` / 생략 → 항상 `null` 저장.
- 이미 선언된 변수는 skip (re-initialize 하려면 `variable_modification` 의 `set` 사용).
- `meta` / `port` / `status` 미사용.
- 단일 `out` 포트.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | `output` 이 input pass-through | Principle 1 (형식적) | 변수 선언은 side-effect 노드이며 메인 흐름은 계속 진행되어야 하므로 pass-through 정당. 문서 컨트랙트 명시 |
| 2 | 실제로 선언된 변수 목록이 meta 에 없음 | Principle 2 | 어떤 변수가 실제로 선언되었는지 (중복으로 skip 된 변수 vs 신규 선언된 변수) 를 meta 로 노출 필요 |
| 3 | skip 된 변수 (이미 존재) 가 invisible | Principle 3 | 사용자가 의도한 초기화가 실제로 일어나지 않았을 때 silent. `meta.skipped` 로 가시화 |
| 4 | `meta.durationMs` 부재 | Principle 2 | 공통 메트릭 |
| 5 | `coerceToType` 실패가 silent | Principle 3 | `type: 'number'` + `defaultValue: 'abc'` → `null` 저장 (조용히). 사용자 의도와 다른 저장이 일어남을 meta 로 알림 |

## 3. 제안된 Output 구조

### Before

```json
{
  "config": {
    "variables": [
      { "name": "counter", "type": "number", "defaultValue": 0 },
      { "name": "users", "type": "array", "defaultValue": "[]" }
    ]
  },
  "output": { "previous": "node output here" }
}
```

### After

```json
{
  "config": {
    "variables": [
      { "name": "counter", "type": "number", "defaultValue": 0 },
      { "name": "users", "type": "array", "defaultValue": "[]" }
    ]
  },
  "output": { "previous": "node output here" },
  "meta": {
    "durationMs": 1,
    "declared": [
      { "name": "counter", "type": "number", "initialValue": 0 },
      { "name": "users", "type": "array", "initialValue": [] }
    ],
    "skipped": [],
    "coercionWarnings": []
  }
}
```

**핵심 변경점**:

- `output` 은 **input pass-through 유지** — side-effect 노드 특성 상 메인 흐름을 가로막지 않음.
- `meta.declared: Array<{ name, type, initialValue }>` 추가 — 실제로 이번 실행에서 선언되어 값이 저장된 변수 목록.
- `meta.skipped: Array<{ name, reason: 'already_declared' }>` 추가 — 이미 존재하여 skip 된 변수 목록. 사용자가 의도한 초기화가 실제 일어나지 않은 경우 가시화.
- `meta.coercionWarnings: Array<{ name, type, originalValue, coercedValue }>` 추가 — `coerceToType` 이 예상과 다른 결과를 낸 경우 (예: `'abc'` → `null`).
- `meta.durationMs` 공통 메트릭 추가.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output` | No | pass-through 유지 |
| `$node["X"].config.variables` | `$node["X"].config.variables` | No | echo 유지 |
| `$var.counter` | `$var.counter` | No | 전역 변수 접근 경로 유지 |
| (없음) | `$node["X"].meta.declared` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.skipped` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.coercionWarnings` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 |

**권장 전략**:

1. P0 (fully additive): `meta.*` 필드만 추가. 기존 워크플로우 무영향.
2. P1: `meta.coercionWarnings` 가 비어있지 않으면 execution 로그에 warn 레벨 이벤트 기록.
3. P1: 프런트엔드 노드 실행 결과 패널에서 `meta.skipped` 를 시각화 (사용자가 의도한 "새 변수 선언" 이 실제로 일어났는지 확인 가능하도록).
4. 문서 보강: "variable_declaration 의 output 은 pass-through. side-effect 결과는 `meta.declared` 에서 확인" 을 명시.

## 5. 근거

- **Principle 1 (output 은 비즈니스 데이터)**: variable_declaration 의 "비즈니스 데이터" 는 메인 흐름의 연속 자체 — pass-through 정당. side-effect 정보는 `meta` 로 분리.
- **Principle 2 (meta 는 실행 메트릭)**: `declared`, `skipped`, `coercionWarnings` 는 모두 이 노드의 "실행 결과 메타데이터" — 후속 노드가 이 값에 분기 로직을 걸지 않음.
- **Principle 3 (silent failure 해소)**: 이미 선언된 변수 skip, coerceType 실패는 현재 silent. `meta` 로 가시화.
- **Principle 10 (빈/null fallback)**: `defaultValue` 가 `null` / `undefined` 일 때 `null` 저장 동작은 Principle 10 과 부합 — 유지.
- **Minimal change 전략**: INCONSISTENCY_MATRIX 축 6 채택안에 따라 "input 그대로 유지 + `meta` 로 부가 정보 이동" — 본 제안이 해당 전략을 그대로 적용.
- **side-effect 노드의 가시화**: `variable_modification` 과 쌍을 이루는 노드. 두 노드 모두 `meta.declared` / `meta.modified` 로 side-effect 를 드러내야 대칭성 확보.
