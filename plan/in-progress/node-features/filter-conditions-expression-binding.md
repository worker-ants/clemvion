# Filter 노드 — conditions 표현식 / per-item `$item` 바인딩 정합성 복구

> 상위 plan: `/Users/gehrig/.claude/plans/parallel-foraging-brooks.md` (사용자 승인됨)
> 관련 spec: `spec/4-nodes/1-logic-nodes.md` §8 Filter (line 367, 405)

## 목적

Filter 노드에서 spec 이 약속한 per-item `$item` 바인딩을 구현하고, 스칼라 배열 비교를 합법화한다.

- spec line 367: `field` = Expression (`{{ $item.status }}` 예시).
- spec line 405: "각 항목에 대해 `$item` 을 바인딩하고 모든 조건 평가".
- 현 구현은 `EXPRESSION_EXCLUSIONS.filter = new Set(['conditions'])` 로 conditions 전체를 표현식 해석에서 제외하고, 핸들러 루프에서도 per-item 평가가 없어 spec 미충족.

## 결정

- **B (per-item resolution)**: filter 핸들러 안에서 매 item 마다 `$item` / `$itemIndex` 를 바인딩한 expression context 로 `condition.field` / `condition.value` 를 재평가. TableHandler 선례(`backend/src/nodes/presentation/table/table.handler.ts:9-10, 75-103`) 와 동일 패턴(`@workflow/expression-engine` 의 `evaluate` 직접 import).
- **C (item-self sentinel)**: 평가 후 `field` 가 빈 문자열·`"$item"` 리터럴·비-문자열이면 `item` 자체를 비교 대상으로 사용. 스칼라 배열 비교 합법화.

`EXPRESSION_EXCLUSIONS.filter` 는 **유지** — 외부 foreach 안에서 filter 가 사용될 때 엔진의 사전 resolve 가 outer item 으로 잘못 해석하는 것을 방지하기 위함. per-item 해석은 filter 가 자기 책임으로.

## 작업 체크리스트

### 1. 테스트 선작성 (TDD RED)

- [x] `backend/src/nodes/logic/filter/filter.handler.spec.ts` 에 다음 추가:
  - [x] (#1) 사용자 원본 case: `[1,2,3]` + `field: "{{ $item }}"`, `value: "{{ 1 }}"`, `op: gt` → `match: [2,3]`
  - [x] (#2) 빈 field sentinel: `[1,2,3]` + `field: ""`, `value: 1`, `op: gt` → `match: [2,3]`
  - [x] (#3) `"$item"` 리터럴 sentinel: `["a","b"]` + `field: "$item"`, `value: "b"`, `op: eq` → `match: ["b"]`
  - [x] (#4) 객체 배열 spec 표현식: `[{age:10},{age:20},{age:30}]` + `field: "{{ $item.age }}"`, `value: 15`, `op: gt` → `match: [{age:20},{age:30}]`
  - [x] (#5) per-item value 표현식: 두 필드 비교
  - [x] (#8) 평가 실패 → unmatched: `field: "{{ $item.deeply.missing }}"` 가 throw 없이 unmatched 로
  - [x] (#7) strictComparison + sentinel 조합
  - [x] (#9) 유효성: `field: 123` (비-문자열) → validate error
- [x] `npx jest src/nodes/logic/filter` 로 RED 확인

### 2. 구현 (B+C)

- [x] `backend/src/nodes/logic/_shared/condition-eval.util.ts:67` — C sentinel 분기 추가:
  ```ts
  const path = condition.field;
  const fieldValue =
    typeof path !== 'string' || path === '' || path === '$item'
      ? item
      : getNestedValue(item, path);
  ```
- [x] `backend/src/nodes/logic/filter/filter.handler.ts` — per-item 표현식 평가:
  - [x] `evaluate`, `ExpressionContext` import
  - [x] 루프 안에서 `itemCtx = { ...baseCtx, $item: item, $itemIndex: index }` 구성
  - [x] `field` / `value` 가 `{{` 패턴 포함 시 evaluate, 아니면 그대로
  - [x] regex 캐시: 사전-컴파일 캐시 제거하고 per-item resolve 후 컴파일 (패턴 → RegExp 메모이즈)
  - [x] 평가 실패는 try/catch 로 흡수 → `undefined` 로 fallback (해당 item 은 unmatched 로 자연스럽게 떨어짐)
- [x] `backend/src/nodes/logic/filter/filter.schema.ts`
  - [x] `validateFilterConfig:122` — `!cond.field` 거부 → `cond.field !== undefined && typeof cond.field !== 'string'` 만 거부
  - [x] `conditions` UI 힌트 갱신: 도트 경로 / 표현식 / 빈/`$item` sentinel 모두 안내

### 3. 회귀 검증

- [x] `[{name:"x"},{name:"y"}]` + `field: "name"` 같은 기존 dot-path 케이스 통과
- [x] 모든 operator (eq, neq, gt, gte, lt, lte, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, regex, is_null, is_type) 통과
- [x] `combineMode: "or"` / `"and"` 양쪽 통과

### 4. TEST WORKFLOW

- [x] `cd backend && npm run lint`
- [x] `cd backend && npm test -- src/nodes/logic/filter`
- [x] `cd backend && npm test`
- [x] `cd backend && npm run build`

### 5. REVIEW WORKFLOW

- [x] `ai-review` skill 실행
- [x] Warning 이상 이슈 조치
- [x] `review/<timestamp>/RESOLUTION.md` 작성
- [x] TEST WORKFLOW 재수행

### 6. 마무리

- [x] 본 plan 을 `git mv` 로 `plan/complete/node-features/` 이동

## 위험 및 메모

- **regex 캐시 재설계**: 기존 `compileRegexCache(conditions)` 는 사전-컴파일 모델. per-item resolve 와 충돌하므로 filter 내부에서는 사용 중지하고 per-item 메모이즈 캐시로 대체. shared util 의 export 자체는 transform.array_filter 가 사용하므로 유지.
- **표현식 평가 비용**: 큰 배열에서 per-item × per-condition 호출 비용 증가. 본 stage 에서는 측정만, 최적화는 후속.
- **silent eval failure**: 평가 실패는 silently `undefined` → unmatched. Principle 3 (에러 가시화) 후속에서 `meta.expressionEvalErrors` 로 노출 검토 (`user_memo/node-specs-improvement/logic/filter.md` §3 의 meta 보강과 묶어서).
- **ReDoS 방어**: `MAX_REGEX_LENGTH = 200` 만으로는 카타스트로픽 백트래킹 패턴(`(a+)+b` 등)을 막지 못함. `safe-regex` / RE2 도입은 별도 stage.
- **strictComparison 기본값**: 현재 `false` (loose) 가 디폴트라 `0 == false` 등 의도치 않은 매칭 가능성. UX 개선은 별도 stage.
- **VALID_OPS 이중 관리**: `filter.schema.ts` 의 인라인 사본 vs `_shared/condition-eval.util.ts` 의 export. CI lint 룰로 정합성 가드 검토.

## 후속 stage 후보 (별도 plan 분리 권장)

- (선택) `user_memo/node-specs-improvement/logic/filter.md` item #4 (조건의 expression 미평가) 가 본 작업으로 해소된 것을 메모. 사용자 권한 영역이라 사용자 확인 시에만 처리.
- 위 "위험 및 메모" 의 ReDoS / strictComparison 디폴트 / VALID_OPS 정합 항목.
