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

- [ ] `backend/src/nodes/logic/filter/filter.handler.spec.ts` 에 다음 추가:
  - [ ] (#1) 사용자 원본 case: `[1,2,3]` + `field: "{{ $item }}"`, `value: "{{ 1 }}"`, `op: gt` → `match: [2,3]`
  - [ ] (#2) 빈 field sentinel: `[1,2,3]` + `field: ""`, `value: 1`, `op: gt` → `match: [2,3]`
  - [ ] (#3) `"$item"` 리터럴 sentinel: `["a","b"]` + `field: "$item"`, `value: "b"`, `op: eq` → `match: ["b"]`
  - [ ] (#4) 객체 배열 spec 표현식: `[{age:10},{age:20},{age:30}]` + `field: "{{ $item.age }}"`, `value: 15`, `op: gt` → `match: [{age:20},{age:30}]`
  - [ ] (#5) per-item value 표현식: 두 필드 비교
  - [ ] (#8) 평가 실패 → unmatched: `field: "{{ $item.deeply.missing }}"` 가 throw 없이 unmatched 로
  - [ ] (#7) strictComparison + sentinel 조합
  - [ ] (#9) 유효성: `field: 123` (비-문자열) → validate error
- [ ] `npx jest src/nodes/logic/filter` 로 RED 확인

### 2. 구현 (B+C)

- [ ] `backend/src/nodes/logic/_shared/condition-eval.util.ts:67` — C sentinel 분기 추가:
  ```ts
  const path = condition.field;
  const fieldValue =
    typeof path !== 'string' || path === '' || path === '$item'
      ? item
      : getNestedValue(item, path);
  ```
- [ ] `backend/src/nodes/logic/filter/filter.handler.ts` — per-item 표현식 평가:
  - [ ] `evaluate`, `ExpressionContext` import
  - [ ] 루프 안에서 `itemCtx = { ...baseCtx, $item: item, $itemIndex: index }` 구성
  - [ ] `field` / `value` 가 `{{` 패턴 포함 시 evaluate, 아니면 그대로
  - [ ] regex 캐시: 사전-컴파일 캐시 제거하고 per-item resolve 후 컴파일 (패턴 → RegExp 메모이즈)
  - [ ] 평가 실패는 try/catch 로 흡수 → `undefined` 로 fallback (해당 item 은 unmatched 로 자연스럽게 떨어짐)
- [ ] `backend/src/nodes/logic/filter/filter.schema.ts`
  - [ ] `validateFilterConfig:122` — `!cond.field` 거부 → `cond.field !== undefined && typeof cond.field !== 'string'` 만 거부
  - [ ] `conditions` UI 힌트 갱신: 도트 경로 / 표현식 / 빈/`$item` sentinel 모두 안내

### 3. 회귀 검증

- [ ] `[{name:"x"},{name:"y"}]` + `field: "name"` 같은 기존 dot-path 케이스 통과
- [ ] 모든 operator (eq, neq, gt, gte, lt, lte, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, regex, is_null, is_type) 통과
- [ ] `combineMode: "or"` / `"and"` 양쪽 통과

### 4. TEST WORKFLOW

- [ ] `cd backend && npm run lint`
- [ ] `cd backend && npm test -- src/nodes/logic/filter`
- [ ] `cd backend && npm test`
- [ ] `cd backend && npm run build`

### 5. REVIEW WORKFLOW

- [ ] `ai-review` skill 실행
- [ ] Warning 이상 이슈 조치
- [ ] `review/<timestamp>/RESOLUTION.md` 작성
- [ ] TEST WORKFLOW 재수행

### 6. 마무리

- [ ] 본 plan 을 `git mv` 로 `plan/complete/node-features/` 이동
- [ ] (선택) `user_memo/node-specs-improvement/logic/filter.md` item #4 가 본 작업으로 해결됨을 메모 (사용자 권한 영역이므로 사용자 확인 후 처리)

## 위험 및 메모

- **regex 캐시 재설계**: 기존 `compileRegexCache(conditions)` 는 사전-컴파일 모델. per-item resolve 와 충돌하므로 제거하고 per-item 메모이즈로 대체.
- **표현식 평가 비용**: 큰 배열에서 per-item × per-condition 호출 비용 증가. 본 stage 에서는 측정만, 최적화는 후속.
- **silent eval failure**: 평가 실패는 silently undefined → unmatched. Principle 3 (에러 가시화) 후속에서 `meta.expressionEvalErrors` 로 노출 검토 (`user_memo/node-specs-improvement/logic/filter.md` §3 의 meta 보강과 묶어서).
