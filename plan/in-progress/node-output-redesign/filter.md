# Filter output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 양쪽 포트 동시 활성화는 `output.match` / `output.unmatched` sub-key 로 표현되어 Principle 5 변형으로 일관. (2026-05-16 구현 분석) handler / schema / spec 5필드 envelope 정합. 미시 보강 1건: regex `MAX_REGEX_LENGTH` 의 spec 명시값 (200) 이 공유 util 상수 (`_shared/condition-eval.util.ts`) 와 일치하는지 직접 spec 표기 없음 — 본 plan §"종합 개선안" 으로 흡수.

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

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/logic/filter/{filter.handler.ts, filter.schema.ts, filter.handler.spec.ts, filter.schema.spec.ts, filter.component.ts}` 와 `codebase/backend/src/nodes/logic/_shared/condition-eval.util.ts` (공유 condition 평가 + `MAX_REGEX_LENGTH=200`).

1. **spec §5 ↔ handler return 정합성**:
   - `filter.handler.ts:171-192` return `{ config: { inputField, conditions, combineMode, strictComparison }, output: { match, unmatched }, meta: { matchedCount, unmatchedCount, totalCount, fellBackToEmpty, invalidRegexPatterns } }` 가 spec §5.1 와 5필드/sub-key 모두 일치.
   - `port` 반환 없음 (양쪽 포트 동시 활성화) — Principle 5 의 `undefined` 형태, spec §3.2 footnote 정합.
   - `meta.durationMs` 는 engine inject — handler 직접 추가하지 않음 (spec 일치).

2. **schema ↔ spec config 정합성**: `filterNodeConfigSchema` (`filter.schema.ts:35-74`) 의 `inputField` / `conditions` / `combineMode` / `strictComparison` 모두 spec §1 표와 동일. default `''`/`[]`/`'and'`/`false` 정합. `conditionGroupSchema` 는 if-else.schema 에서 import — 공유. `filterNodeOutputSchema` 의 `output: { match, unmatched }` shape (`:23-29`) 가 spec §5.1 와 일치.

3. **validate 일관성**:
   - `handler.validate()` (`filter.handler.ts:46-58`) 는 SSOT (`evaluateMetadataBlockingErrors`) + `combineMode` enum guard 추가. `inputField` 빈/누락, `conditions` 빈/누락, per-condition `field` type/operator 화이트리스트 검증은 `warningRules` + `validateFilterConfig` 가 담당 (`schema.ts:95-138, 154-165`).
   - SSOT 분리 명확. 중복 검출 없음.

4. **에러 컨트랙트 (Principle 3)**:
   - pre-flight throw: config 검증 실패 (handler.validate) — spec §6 표 5종 케이스.
   - **Runtime throw 분기 1종**: `inputField` 해석 결과가 non-array & non-null (string/number/object) — `filter.handler.ts:83-84` 의 `throw new Error('Filter inputField does not resolve to an array')`. Principle 3.1 의 "pre-flight throw" 가 아닌 runtime throw 분기 — spec §6 표가 "execute (런타임 throw)" 로 명시하므로 정합.
   - `null`/`undefined` 는 `[]` fallback + `meta.fellBackToEmpty: true` (Principle 10).
   - runtime `port: 'error'` 없음. spec §6 정합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `output.match` / `output.unmatched` 는 변형 결과 (부분집합) — config 리터럴 echo 잔재 아님. 부합.
   - Principle 2: `matchedCount` / `unmatchedCount` / `totalCount` / `fellBackToEmpty` / `invalidRegexPatterns` 모두 실행 메트릭 — 부합.
   - Principle 5: `port` 미반환 + 두 포트 모두 활성화 (sub-key 분기) — spec footnote 정합. `port` 활성화 모델의 `undefined` 분기.
   - Principle 7: `rawConfig` 4필드 모두 echo (`:170-177`) — `?? 'and'` / `?? false` fallback 도 schema default 와 일치하여 raw echo 완전. 부합.
   - Principle 8: 이중 중첩 없음.
   - Principle 10: `null`/`undefined` → `[]` + `meta.fellBackToEmpty: true` 분기 (`:78-82`). 부합. Map 의 silent `[]` fallback 과 달리 진단 메트릭 명시 — 일관성 권고 (Map 측 후속).

6. **handler 테스트 (`filter.handler.spec.ts`)**:
   - validate (11 case) / execute 전 operator 15종 / per-item expression / combine modes / fallback / nested field / strictComparison / regex 4 case / invalid regex / 길이 cap / meta 메트릭 다종 검증 — 1342 lines 전반 (`:50-1342`).
   - **모든 spec §5.1 case 직접 커버**: 매칭/비매칭/빈 배열/모두 매칭/모두 비매칭/fallback/regex invalid/regex 길이 초과/strict 모드. spec §5.1 의 모든 필드가 테스트로 검증됨 (`:1264-1340`).
   - **누락 없음**.

7. **횡단 일관성 (Logic 분기/변형 4종)**:
   - If/Else / Switch / Filter 의 공통점: meta 에 분기 진단 (`conditionResult` / `matchedCase*` / `matchedCount`) 배치. Filter 는 양쪽 동시 활성화이므로 `port` 미반환 — If/Else 의 `'true'/'false'` 와 Switch 의 `<case_id>` 와 분리된 시멘틱이 명확.
   - Filter 의 `meta.fellBackToEmpty` 는 Principle 10 진단 메트릭의 reference 구현 — 타 노드 (Map 등) 일관성 권고 대상.
   - Filter 의 `MAX_REGEX_LENGTH=200` 은 `_shared/condition-eval.util.ts:22` 가 `core/condition-evaluator.util.ts:40` 를 re-export. Transform 노드도 동일한 상수를 inline 정의 (`transform.handler.ts:35`) — 횡단 상수 중복 (별도 정리 후보, 본 plan 범위 외).

8. **구현 품질**:
   - `regexCache` + `invalidRegexPatterns` insertion-ordered Set (`:95-99`) 으로 dedup + 재컴파일 방지. 매 iter cache hit 시 O(1).
   - `resolveIfExpression` 의 catch 분기가 `undefined` 반환 (`:215-222`) — 주석에 "Numeric comparators coerce it to NaN (always false)" 명시. silent 실패 의도가 명확.
   - per-item `itemCtx` (`:130-133`) 가 base context 를 spread + `$item`/`$itemIndex` overlay — workflow context 상속 정합.
   - dead code 없음.

## 종합 개선안 (2026-05-16)

- [ ] (spec) §4 의 regex 길이 cap (`≤ 200`) 출처를 `_shared/condition-eval.util.ts` 의 `MAX_REGEX_LENGTH` 상수로 명시 (footnote / 인용). 근거: 현 spec 은 `≤ 200` 만 명시하고 source of truth 미연결.
- [ ] (impl/spec) `output.match.length` / `output.unmatched.length` 가 비어있을 때 후속 노드의 입력 분기 동작 (downstream 노드가 빈 배열을 받았을 때 skip 인지 실행인지) 을 spec 본문에서 한 줄 명시. 근거: 양쪽 포트 동시 활성화 + 빈 배열 케이스가 spec §5.1 footnote 에 명시되어 있으나 다운스트림 분기 동작이 모호.
