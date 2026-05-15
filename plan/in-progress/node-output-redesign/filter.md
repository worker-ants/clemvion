# Filter output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 양쪽 포트 동시 활성화는 `output.match` / `output.unmatched` sub-key 로 표현되어 Principle 5 변형으로 일관. 잔여 권고 없음.

> 대상 spec: `spec/4-nodes/1-logic/8-filter.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/8-filter.md:108-137`:

```json
{
  "config": {
    "inputField": "items",
    "conditions": [{ "field": "{{ $item.status }}", "operator": "eq", "value": "active" }],
    "combineMode": "and",
    "strictComparison": false
  },
  "output": {
    "match": [
      { "name": "Alice", "status": "active" },
      { "name": "Charlie", "status": "active" }
    ],
    "unmatched": [{ "name": "Bob", "status": "inactive" }]
  },
  "meta": {
    "durationMs": 0,
    "matchedCount": 2,
    "unmatchedCount": 1,
    "totalCount": 3,
    "fellBackToEmpty": false,
    "invalidRegexPatterns": []
  }
}
```

## 진단

Filter 는 **데이터 변형 + 양쪽 포트 동시 활성화 분기 노드** (단계 1개). 입력 배열을 두 부분집합으로 분리하여 `match` / `unmatched` 두 포트로 동시 전달.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output.match: Array` | 적절 (output) | 매칭 항목 배열 — 다운스트림이 `output.match` sub-key 로 받음 |
| `output.unmatched: Array` | 적절 (output) | 비매칭 항목 배열 |
| `meta.matchedCount` / `unmatchedCount` / `totalCount` | 적절 (meta) | O(1) 카운트 (Principle 2). 비즈니스 분기는 `output.match.length > 0` 으로도 가능하나 메트릭 분리 |
| `meta.fellBackToEmpty` | 적절 (meta) | Principle 10 진단 |
| `meta.invalidRegexPatterns: string[]` | 적절 (meta) | regex 컴파일 실패 silent fallback 가시화 (DoS 방지 cap) |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.*` (raw echo) | 적절 | Principle 7 — `condition.field` / `condition.value` 의 `{{ }}` 보존 |
| `port`: 미설정 | 적절 | spec footnote: "양쪽 포트 동시 활성화" — `port` 반환 없음. Principle 5 의 "기본 단일 출력" 변형 — 다운스트림은 `output.match` / `output.unmatched` 로 분기 |

부적절 항목 없음.

추가 점검:

- **`port` 가 `string` 도 `string[]` 도 아닌 미설정** — Principle 5 의 3 형태 (`undefined` / `string` / `string[]`) 중 `undefined` 에 해당하지만, 의미상 "양쪽 활성화" 이므로 `string[]` 의 fan-out 모델이 더 일관적일 수 있음. 그러나 `match` / `unmatched` 가 **데이터 sub-key 구분** 이지 포트 ID 가 아니므로 (편집기에서 두 포트가 모두 항상 활성), `undefined` 가 적절.
- **`output.match.length + output.unmatched.length === meta.totalCount`** — fallback 시 `totalCount = 0` 명시. 일관성 OK.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": {
    "inputField": <Expression raw>,
    "conditions": [<ConditionGroup>, ...],
    "combineMode": "and" | "or",
    "strictComparison": <boolean>
  },
  "output": {
    "match": [<item>, ...],
    "unmatched": [<item>, ...]
  },
  "meta": {
    "durationMs": <number>,
    "matchedCount": <number>,
    "unmatchedCount": <number>,
    "totalCount": <number>,
    "fellBackToEmpty": <boolean>,
    "invalidRegexPatterns": [<string>, ...]
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- Filter 는 If/Else 와 달리 **데이터 변형** (부분집합 분리) 이지 pass-through 가 아니다. spec §의 "Logic 공통 §10 Pass-through 규약과의 차이" footnote 명시.
- 양쪽 포트 동시 활성화는 동적 포트가 아니라 정적 두 포트 (`match`, `unmatched`) — 동적 포트 ID 명명 (Principle 6) 적용 대상 아님.
- `port` 미반환은 워크플로우 엔진이 두 포트 엣지를 모두 follow 하는 시멘틱과 정합 — `output.match` / `output.unmatched` 가 각 포트의 페이로드.
