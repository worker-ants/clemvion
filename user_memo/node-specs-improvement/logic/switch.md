# Switch (`switch`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/switch.md](../../node-specs/logic/switch.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

`switchValue` 를 `cases[].value` 와 순차 비교해 매칭된 케이스의 id 를 동적 포트로 활성화하고, 매칭 실패 시 `default` 포트 (또는 에러) 로 떨어지는 pass-through 노드입니다.

```json
{
  "config": {
    "switchValue": "user.role",
    "cases": [
      { "id": "admin", "label": "Admin", "value": "admin" },
      { "id": "guest", "label": "Guest", "value": "guest" }
    ]
  },
  "output": { "user": { "role": "admin" } },
  "meta": { "expression": "user.role", "value": "admin", "matchedCase": "admin" },
  "port": "admin"
}
```

특징 요약:

- `output` 은 input pass-through (if_else 와 동일한 전략).
- `meta` 에 이미 `expression`, `value`, `matchedCase` 3 개 필드가 있음 — **CONVENTIONS 와 이미 상당히 근접**.
- `port` 는 매칭된 케이스 id 또는 `'default'`.
- `hasDefault: false` + 매칭 실패 시 핸들러가 throw.
- 동적 포트 naming 은 `config.cases[].id` 그대로 사용.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | `meta.expression` 의 이름이 모호 | Principle 2 / 11 | "expression" 은 `{{ ... }}` 과 헷갈림. 실제로는 dot-path 문자열 또는 `undefined`. `meta.switchPath` 같은 더 명확한 이름이 바람직 |
| 2 | `meta.value` 가 raw 비교값인데 이름이 너무 일반적 | Principle 2 | `meta.resolvedValue` 로 명명 변경이 직관적 |
| 3 | `meta.durationMs` 누락 | Principle 2 (공통) | 모든 노드 공통 메트릭 |
| 4 | `strictComparison` 필드가 schema 에 있으나 핸들러 미사용 | Principle 3.1 | 사용자가 설정해도 무시됨. schema 에서 제거하거나 핸들러에 반영 |
| 5 | 매칭 실패 시 throw — 에러 컨트랙트 축과 맞지 않음 | Principle 3.1 | `hasDefault: false` 에서 "매칭 없음" 은 비즈니스 로직 실패가 아닌 설정 실패로 볼 수 있어 throw 는 허용 범위 (P2) |
| 6 | 예약어 `default` 와 case id 충돌 가능성 | Principle 6 | 프런트엔드에서 reserved word 검증 필요 |

## 3. 제안된 Output 구조

### Before

```json
{
  "output": { "user": { "role": "admin" } },
  "meta": { "expression": "user.role", "value": "admin", "matchedCase": "admin" },
  "port": "admin"
}
```

### After

```json
{
  "config": { "switchValue": "user.role", "cases": [...] },
  "output": { "user": { "role": "admin" } },
  "meta": {
    "durationMs": 0,
    "switchPath": "user.role",
    "resolvedValue": "admin",
    "matchedCase": "admin",
    "matchedCaseLabel": "Admin"
  },
  "port": "admin"
}
```

**핵심 변경점**:

- `output` 은 **input pass-through 유지** (switch 의 의미론 자체가 라우팅).
- `meta.expression` → `meta.switchPath` 로 이름 변경 (dot-path 만 담는 필드임을 명시). `switchValue` 가 비문자열이면 `undefined`.
- `meta.value` → `meta.resolvedValue` 로 이름 변경.
- `meta.matchedCaseLabel` 추가 — 로깅 / UI 측에서 label 이 필요한 경우.
- `meta.durationMs` 공통 필드 추가.
- 매칭 실패 + `hasDefault: true` 일 때 `meta.matchedCase: 'default'` 유지.
- `strictComparison` 은 schema 에서 **제거** (핸들러가 사용하지 않으므로 echo 조차 무의미). P1.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output` | No | pass-through 유지 |
| `$node["X"].port` | `$node["X"].port` | No | case id 그대로 |
| `$node["X"].meta.matchedCase` | `$node["X"].meta.matchedCase` | No | 이름 유지 |
| `$node["X"].meta.expression` | `$node["X"].meta.switchPath` | **Yes** | 이름 변경 |
| `$node["X"].meta.value` | `$node["X"].meta.resolvedValue` | **Yes** | 이름 변경 |
| (없음) | `$node["X"].meta.matchedCaseLabel` | No (추가) | 신규 필드 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 필드 |
| `$node["X"].config.strictComparison` | (제거) | **Yes** | dead field 제거 |

**권장 전략**:

1. P0 (additive): `meta.matchedCaseLabel`, `meta.durationMs` 추가.
2. P1 (renaming): `meta.expression` / `meta.value` → `meta.switchPath` / `meta.resolvedValue`. 기존 필드는 **한 릴리스 동안 deprecated alias 로 유지** 후 제거. Expression resolver 가 둘 다 읽을 수 있게.
3. P1 (schema cleanup): `strictComparison` 제거. DB 마이그레이션으로 기존 워크플로우 config 에서 해당 키 삭제.
4. P1 (reserved word): 프런트엔드 case id 입력 검증에 `['default', 'out', 'error']` 등 Principle 6 의 reserved list 추가.

## 5. 근거

- **Principle 1 (output 은 비즈니스 데이터)**: switch 역시 if_else 와 동일하게 "라우팅" 이 본질이므로 pass-through 가 개념적으로 일관.
- **Principle 2 (meta 는 실행 메트릭)**: 매칭 결과, resolved 값, 평가된 path 는 모두 메타. 이미 `meta` 에 있으나 네이밍이 덜 명확하므로 정리.
- **Principle 6 (동적 포트 네이밍)**: case id 는 사용자 설정이므로 reserved word 검증만 추가.
- **Principle 7 (Config echo)**: dead field 인 `strictComparison` 은 echo 가치가 없으니 schema 에서 제거.
- **Principle 11 (출력 문서화)**: Case 별 분리 (성공 매칭 / default / 에러) 는 현 문서가 이미 따름.
- INCONSISTENCY_MATRIX 축 7: switch 의 포트 id 규칙은 유지로 결정됨.
