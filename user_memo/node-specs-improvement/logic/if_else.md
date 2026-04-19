# If/Else (`if_else`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/if_else.md](../../node-specs/logic/if_else.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

조건 평가 결과에 따라 `true` / `false` 두 포트 중 하나로 라우팅하는 pass-through 노드입니다. 데이터 변형은 하지 않고 input 을 그대로 `output` 에 복사합니다.

```json
{
  "config": {
    "conditions": [{ "field": "user.age", "operator": "gte", "value": 18 }],
    "combineMode": "and"
  },
  "output": { "user": { "age": 25, "name": "Alice" } },
  "port": "true"
}
```

특징 요약:

- `output` 이 input 과 완전히 동일 (pass-through).
- `meta` / `status` 는 핸들러가 반환하지 않음.
- `port` 는 `'true'` 또는 `'false'` 문자열 하나.
- 조건 평가 결과 자체(boolean)나 어떤 조건이 매칭되었는지에 대한 메타 정보는 **어디에도 기록되지 않음** — 후속 노드가 `port === 'true'` 를 eyeball 해서 확인해야 함.
- `is_type` / `regex` 는 schema enum 에는 있지만 핸들러에서 구현되지 않아 항상 `false` fall-through.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | `output` 이 input 그대로 | Principle 1 (형식적 위반) | "비즈니스 결과물" 원칙 상 pass-through 는 애매하지만, if_else 의 의도 자체가 "데이터를 변형하지 않고 라우팅" 이므로 현실적으로 허용. 단 문서 컨트랙트가 없음 |
| 2 | 조건 평가 결과(boolean) 가 어디에도 없음 | Principle 2 | `meta.conditionResult` 같은 실행 메트릭 필드가 부재. 후속 노드에서 `port` 문자열을 비교해 재판단해야 함 |
| 3 | 매칭된 조건 정보 부재 | Principle 2 | `combineMode='or'` 에서 어느 조건이 true 여서 분기됐는지 알 수 없음 |
| 4 | `is_type` / `regex` schema-handler 간 불일치 | Principle 3.1 (pre-flight) | schema 에서 허용되는 연산자가 핸들러에서 silent `false` 로 처리 — validate 단계에서 reject 되어야 함 |
| 5 | `status` 기본값 | Principle 0 / 9 축 | `status: undefined` 가 일반 완료의 관례. 현 문서에도 반영됨 (OK) |

## 3. 제안된 Output 구조

### Before

```json
{
  "config": { "conditions": [...], "combineMode": "and" },
  "output": { "user": { "age": 25 } },
  "port": "true"
}
```

### After

```json
{
  "config": { "conditions": [...], "combineMode": "and" },
  "output": { "user": { "age": 25 } },
  "meta": {
    "durationMs": 0,
    "conditionResult": true,
    "matchedConditions": [
      { "index": 0, "field": "user.age", "operator": "gte", "value": 18, "result": true }
    ]
  },
  "port": "true"
}
```

**핵심 변경점**:

- `output` 은 **input pass-through 유지** (breaking change 회피). 문서에 "if_else 는 pass-through 컨트랙트를 갖는다" 를 명시.
- `meta.conditionResult: boolean` 추가 — `port === 'true'` 를 문자열 비교하지 않고 boolean 으로 읽을 수 있도록.
- `meta.matchedConditions: Array<{ index, field, operator, value, result }>` 추가 — `combineMode='or'` 에서 디버깅에 필요.
- `meta.durationMs` 는 공통 필드 (Principle 2) — 엔진이 주입하는 값 기준.
- `is_type` / `regex` 는 schema enum 에서 **제거** (if_else 전용) 하거나, validate 단계에서 핸들러의 `VALID_OPERATORS` 와 검증. P1 이슈로 분류.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output` | No | 동일 유지 |
| `$node["X"].output.user.age` | `$node["X"].output.user.age` | No | pass-through 유지 |
| `$node["X"].port` | `$node["X"].port` | No | `'true'`/`'false'` 그대로 |
| (없음) | `$node["X"].meta.conditionResult` | No (추가) | 신규 필드 |
| (없음) | `$node["X"].meta.matchedConditions` | No (추가) | 신규 필드 |
| `is_type` / `regex` 연산자 사용 시 silent false | validate 단계에서 reject | **Yes (behavior)** | 기존 false-fallthrough 에 의존하던 워크플로우는 에러로 전환됨. 마이그레이션 스크립트 필요 |

**권장 전략**:

1. P0: `meta.conditionResult`, `meta.matchedConditions` 를 핸들러에서 반환하도록 추가 — additive 변경, 기존 워크플로우 무영향.
2. P1: schema enum 을 핸들러 `VALID_OPERATORS` 와 일치시키고 (`is_type`, `regex` 제거) validate 에서 reject. 기존 워크플로우 검사 후 migration notice 배포.
3. 문서에 "if_else 는 output pass-through 컨트랙트이다" 를 명시해 다른 로직 노드와 혼동 방지.

## 5. 근거

- **Principle 1 (output 은 비즈니스 데이터)**: if_else 의 "비즈니스 결과물" 은 조건 평가 결과 자체가 아니라 **분기된 데이터 흐름** 이므로 pass-through 가 개념적으로 일관. `meta` 로 평가 결과를 분리하는 것이 Principle 2 의 철학과 부합.
- **Principle 2 (meta 는 실행 메트릭)**: 조건 평가 결과, 어떤 조건이 매칭됐는지, 평가에 걸린 시간은 모두 실행 메트릭. `meta` 에 위치하는 것이 자연스러움.
- **Principle 3.1 (Pre-flight 에러)**: schema enum 과 handler 구현 불일치는 silent failure 를 유발하므로 pre-flight validate 단계에서 reject 해야 함.
- **Principle 0 (5-필드 invariant)**: `status` 는 기본값 `undefined` 유지 (일반 완료).
- INCONSISTENCY_MATRIX 축 6 "pass-through 노드" 채택안: "input 은 그대로 유지하되, 부가 정보는 `meta` 로 이동" — 본 제안이 해당 전략을 그대로 따름.
