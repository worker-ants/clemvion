# Filter (`filter`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/filter.md](../../node-specs/logic/filter.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

배열의 각 항목을 조건으로 평가해 `match` / `unmatched` 두 배열로 분리하는 노드. If/Else 가 단일 값 라우팅이라면 Filter 는 배열 원소 단위 평가입니다.

```json
{
  "config": {
    "inputField": "items",
    "conditions": [{ "field": "status", "operator": "eq", "value": "active" }],
    "combineMode": "and",
    "strictComparison": false
  },
  "output": {
    "match": [
      { "name": "Alice", "status": "active" },
      { "name": "Charlie", "status": "active" }
    ],
    "unmatched": [
      { "name": "Bob", "status": "inactive" }
    ]
  }
}
```

특징 요약:

- **이미 구조화된 output** — `match` / `unmatched` 두 배열로 분리됨. CONVENTIONS 기조에 매우 근접.
- 두 포트 (`match` / `unmatched`) 는 **동시에 활성화되지 않음** — `output` 구조 내에서 양쪽 결과를 모두 가짐.
- `inputField` 가 배열로 해석되지 않으면 **throw** (Split/ForEach 의 빈배열 fallback 과 다름).
- `expression-exclusions.ts` 로 `conditions` 전체는 expression resolver 제외 — 조건 `field`/`value` 에 `{{ ... }}` 쓰면 해석 안됨.
- `regex` 는 200자 제한 + 컴파일 실패 시 silent false.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 비배열 / null 입력 → throw | Principle 10 | Principle 10 은 "배열 기대 필드가 `undefined` 또는 `null` 이면 `[]` 로 fallback. throw 금지." 현재는 throw — **수정 필요** |
| 2 | 개수 정보 부재 | Principle 2 | `output.match.length`, `output.unmatched.length` 접근은 O(1) 아님. `meta.matchedCount` / `meta.unmatchedCount` / `meta.totalCount` 권장 |
| 3 | `meta.durationMs` 부재 | Principle 2 | 공통 메트릭 |
| 4 | 조건은 expression resolver 제외인데 사용자 인지하기 어려움 | Principle 11 / 7 | 문서에는 적혀있으나 config echo 에서 보이지 않음. `meta.conditionsEvaluated` 로 평가 결과 요약 가능 |
| 5 | `regex` 컴파일 실패가 silent false | Principle 3 | 사용자가 패턴 오류를 알 수 없음 — `meta.invalidRegexPatterns` 로 가시화 |
| 6 | 두 포트가 동시 활성화 안 되는 것이 특이한 컨트랙트 | Principle 5 | `port` 가 undefined 이고 `output.match` / `output.unmatched` 둘 다 채워지는 구조. 엣지는 어떻게 follow 되는지 — 엣지는 각 sub-key 를 input 으로 받는 구조. 문서 보강 필요 |

## 3. 제안된 Output 구조

### Before

```json
{
  "config": { "inputField": "items", "conditions": [...], "combineMode": "and", "strictComparison": false },
  "output": {
    "match": [...],
    "unmatched": [...]
  }
}
```

### After

```json
{
  "config": { "inputField": "items", "conditions": [...], "combineMode": "and", "strictComparison": false },
  "output": {
    "match": [
      { "name": "Alice", "status": "active" }
    ],
    "unmatched": [
      { "name": "Bob", "status": "inactive" }
    ]
  },
  "meta": {
    "durationMs": 3,
    "matchedCount": 1,
    "unmatchedCount": 1,
    "totalCount": 2,
    "fellBackToEmpty": false,
    "invalidRegexPatterns": []
  }
}
```

**핵심 변경점**:

- `output.match` / `output.unmatched` 구조 **유지** (이미 CONVENTIONS 부합).
- `meta.matchedCount`, `meta.unmatchedCount`, `meta.totalCount` 추가 — O(1) 접근 + 후속 로직에서 "몇 개 걸러졌는지" 파악 용이.
- `meta.durationMs` 공통 메트릭 추가.
- **Principle 10 적용**: `inputField` 가 `null` / `undefined` 이면 throw 대신 `[]` 로 fallback. 비배열 primitive (`number`, `string` 등) 는 **throw 유지** (사용자 실수 명백). `meta.fellBackToEmpty: boolean` 으로 fallback 발생 표시.
- `meta.invalidRegexPatterns: string[]` 추가 — regex 컴파일 실패 / 200자 초과 패턴 목록. silent false 를 가시화.
- 두 포트 컨트랙트 문서 보강: "Filter 는 `port` 를 반환하지 않음. `match` / `unmatched` 에지는 각각 `output.match` / `output.unmatched` 를 input 으로 받는다" (Principle 5).

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output.match` | `$node["X"].output.match` | No | 유지 |
| `$node["X"].output.unmatched` | `$node["X"].output.unmatched` | No | 유지 |
| `$node["X"].output.match.length` | `$node["X"].meta.matchedCount` | No (둘 다 유효) | 신규 O(1) 접근. 기존 `.length` 도 배열이므로 여전히 동작 |
| (없음) | `$node["X"].meta.unmatchedCount` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.totalCount` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.fellBackToEmpty` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.invalidRegexPatterns` | No (추가) | 신규 |
| null/undefined inputField → throw | null/undefined inputField → `[]` fallback | **Yes (behavior)** | 기존에 에러로 노드 FAILED 되던 워크플로우는 정상 실행 + 빈 결과로 변경됨. 이는 Principle 10 수정으로 **긍정적 breaking** |
| primitive inputField → throw | primitive inputField → throw | No | 유지 |

**권장 전략**:

1. P0 (additive): `meta.*` 필드 추가. 기존 워크플로우 무영향.
2. P1 (Principle 10 수정): null/undefined fallback 을 `[]` 로 변경. 기존 "에러로 중단" 에 의존하던 워크플로우는 `meta.fellBackToEmpty === true` 를 검사해 분기 가능하므로 실질적 영향은 낮음.
3. P1 (regex 가시화): 컴파일 실패한 regex 패턴을 `meta.invalidRegexPatterns` 에 누적. Warning 로그 병행.
4. 문서 보강: Filter 의 "port 없이 두 sub-key 에 분리" 컨트랙트를 Principle 5 관점에서 명시.

## 5. 근거

- **Principle 10 (빈/null fallback)**: "배열 기대 필드가 `undefined` 또는 `null` 이면 `[]` 로 fallback. throw 금지." — 현재 filter 는 위반. 단 primitive input 에 대한 throw 는 CONVENTIONS 에서도 "명백한 사용자 실수" 로 유지 권장.
- **Principle 2 (meta)**: count 류 메트릭과 `durationMs` 는 실행 메트릭.
- **Principle 3 (에러 가시화)**: regex 컴파일 실패 silent false 는 사용자에게 보이지 않음 — `meta.invalidRegexPatterns` 로 가시화.
- **Principle 5 (port 활성화 모델)**: filter 는 `port: undefined` + output sub-key 로 라우팅하는 특이 패턴 — CONVENTIONS 의 "기본 단일 출력" 분류에 준하나 엣지가 2개라는 점은 문서화 필요.
- **Principle 11 (출력 문서화)**: Case 별 (전체 통과 / 전체 미통과 / null fallback) 분리 기술 필요.
- INCONSISTENCY_MATRIX 축 5: filter 는 "이미 구조화됨 → 유지" — output 구조는 그대로. meta 보강과 Principle 10 적용이 본 제안의 핵심.
