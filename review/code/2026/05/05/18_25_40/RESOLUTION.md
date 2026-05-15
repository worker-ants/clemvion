# Filter conditions 표현식 / per-item `$item` 바인딩 — AI Review 조치

리뷰 세션: `review/2026-05-05_18-25-40/`
관련 plan: `plan/in-progress/node-features/filter-conditions-expression-binding.md`

## 조치 요약

| 카테고리 | 등급 | 항목 | 상태 |
|---|---|---|---|
| Security | Critical | Expression Injection (eval/Function) | 검증 — false positive |
| Security | Warning | ReDoS — 카타스트로픽 백트래킹 미방어 | 후속 stage 로 분리 |
| Security | Warning | Prototype Pollution (baseCtx 스프레드) | 검증 — 영향 없음 |
| Security | Warning | Silent eval failure 보안 이벤트 은닉 | 후속 stage 로 분리 |
| Bug | Warning | `computeFieldValue(undefined)` 가 item 으로 fallback 안 함 | 수정 |
| Architecture | Warning | stub `Condition` 패턴 — 내부 결합 | 수정 |
| Architecture | Warning | `Condition.field: unknown` 공유 인터페이스 약화 | 되돌림 (string 유지) |
| Architecture | Warning | `evaluateCondition` 의 sentinel 분기 — 공유 유틸 오염 | 되돌림 |
| Side Effect | Warning | `resolveIfExpression` 실패 시 `null` → 숫자 비교 silent match | 수정 (undefined 반환) |
| API Contract | Warning | `ExecutionContext.expressionContext` 인터페이스 미선언 | 검증 — 이미 선언됨 |
| Maintainability | Warning | `EXPRESSION_PATTERN` 로컬 정의 | shared util 로 이동 |
| Maintainability | Warning | `regexCache` `null` 마커 가독성 | `has()`/`get()` 패턴으로 정리 |
| Testing | Warning | 6건 누락 (`$itemIndex`, OR + per-item, 동적 regex, ctx 변수, condition-eval util 직접, 미존재 field execute) | 7건 추가 |
| Plan | Warning | 체크리스트 미체크 + `in-progress/` 잔류 | 본 commit 에서 갱신, 완료 시 이동 |

## 상세

### [Critical 1 — false positive] Expression Injection 검증

리뷰는 `evaluate(value, ctx)` 가 `eval()` / `new Function()` 기반이면 RCE 가능성이 있다고 지적했다. `packages/expression-engine/src` 를 직접 점검:

- 구조: `tokenize → parse → AST → Evaluator.evaluate()` (tree-walk evaluator).
- `eval()`, `new Function()`, `Reflect.apply` 등 동적 코드 실행 API **미사용** (전체 src 디렉토리 grep 결과 0건).
- 함수 호출은 `getFunction(name)` 의 화이트리스트 기반 (`functions/*.ts`).
- `ChainExpression`, `MemberExpression` 도 모두 AST 해석.

→ AST 기반 sandbox. 본 변경의 표현식 평가 패턴은 RCE 위험 없음. ReDoS 와 ctx 오염 같은 부속 위험은 별도 카테고리로 분리.

### [Warning — Bug] `computeFieldValue(undefined)` 수정

`backend/src/nodes/logic/filter/filter.handler.ts:152-165`

`validate` 는 `field` 누락 = "item 자체" 로 허용했으나, `execute` 에서는 `undefined` 분기가 누락되어 모든 항목이 `unmatched` 로 떨어졌다. `if (field === undefined || field === '' || field === '$item') return item;` 으로 통합. 회귀 가드로 `should treat undefined field at execute time as item-self sentinel` 테스트 추가.

### [Warning — Architecture] stub `Condition` 패턴 + `Condition.field: unknown` 되돌림

`backend/src/nodes/logic/_shared/condition-eval.util.ts` 에 `evaluateResolvedCondition(fieldValue, operator, compareValue, strict, regex)` 신규 export. 이미 fieldValue 를 외부에서 계산한 호출자(filter)가 path-lookup 우회를 위해 stub 을 만들 필요가 없어졌다.

- `Condition.field` 타입 `unknown` → `string` 으로 되돌림 — 다른 소비자(transform.array_filter)의 타입 안전성 회복.
- `evaluateCondition` 내부에 추가했던 `typeof path !== 'string' || path === '' || path === '$item'` sentinel 분기 제거 — sentinel 은 filter 의 관심사이므로 핸들러 내부의 `computeFieldValue` 로 일원화. 다른 노드가 `field: ''` 로 호출해도 silent 동작 변화 없음.
- 핸들러는 `AuthoredCondition { field?: string }` 로컬 타입을 사용해 사용자 작성 형태를 명시. resolved 값은 `evaluateResolvedCondition` 인자로 직접 전달.

### [Warning — Side Effect] `resolveIfExpression` null → undefined

`null` 반환 시 `Number(null) === 0` 이 되어 `gt -1` 등 0 인접 임계값 비교에서 silent match 가 발생한다는 지적. `undefined` 로 변경 — `Number(undefined) === NaN` 이라 모든 수치 비교가 false 로 떨어지며, `getNestedValue` 의 missing-path 동작과도 일치한다. 회귀 가드 테스트(`should not silently match is_null on numeric thresholds when eval fails`) 추가.

### [Warning — Maintainability] `EXPRESSION_PATTERN` shared 위치로 이동

`filter.handler.ts:31` 의 로컬 상수를 `_shared/condition-eval.util.ts` 로 export. 향후 다른 노드(if-else 등)에서 동일한 표현식 감지 패턴이 필요할 때 단일 정의를 import 하면 된다.

### [Warning — Maintainability] regex 캐시 가독성

`Map<string, RegExp | null>` 의 `null` 마커는 그대로 두되 `has()`/`get()` 패턴으로 단순화: 캐시 hit 인지 여부를 명시적으로 검사한 뒤 `null` → undefined 변환을 한 곳에서만 수행.

### [Warning — API Contract — false positive] `expressionContext` 인터페이스

`backend/src/nodes/core/node-handler.interface.ts:39` 에 `expressionContext?: Record<string, unknown>` 가 이미 선언되어 있다. `as EngineContext` 캐스팅이 필요한 이유는 `EngineContext` 가 더 좁은 타입(`$item` 등 known 키 포함)이기 때문 — 런타임에는 `Record<string, unknown>` 와 호환되므로 안전. 본 리뷰 항목은 false positive.

### [Warning — Testing] 누락 테스트 7건 추가

| # | 테스트 | 위치 |
|---|---|---|
| 1 | `should treat undefined field at execute time as item-self sentinel` | `filter.handler.spec.ts` |
| 2 | `should expose $itemIndex in expression context (0-based)` | `filter.handler.spec.ts` |
| 3 | `should evaluate per-item expressions with combineMode "or"` | `filter.handler.spec.ts` |
| 4 | `should support per-item dynamic regex pattern (memoized cache)` | `filter.handler.spec.ts` |
| 5 | `should inherit workflow context variables in per-item expressions` | `filter.handler.spec.ts` |
| 6 | `should not silently match is_null on numeric thresholds when eval fails` | `filter.handler.spec.ts` |
| 7 | `should support is_type with per-item field expression` | `filter.handler.spec.ts` |
| 8 | `should accept regex pattern at the boundary length (200 chars)` | `filter.handler.spec.ts` |
| 9 | shared util 직접 단위 테스트 신설 (`evaluateResolvedCondition`, `evaluateCondition`, `compileRegexCache`, exports) | `condition-eval.util.spec.ts` (신규) |

전체 backend 테스트: **2684 → 2708 통과** (+24).

## 후속 stage 로 분리한 항목

다음 항목은 본 변경 범위 밖이며 별도 plan 으로 분리:

1. **ReDoS 방어** (`safe-regex` / RE2 도입). `MAX_REGEX_LENGTH = 200` 만으로는 카타스트로픽 백트래킹을 막지 못함. 단, 본 변경 이전부터 존재하던 표면이며 회귀 아님.
2. **expression eval 실패 가시화** (`meta.expressionEvalErrors` 노출 + logger.warn). 사용자 디버깅성 향상. `user_memo/node-specs-improvement/logic/filter.md` §3 의 meta 보강과 묶어 다음 단계에서 처리.
3. **VALID_OPS 이중 관리** (schema 의 인라인 사본 vs util 의 export). CI lint 룰 또는 단일 import 로 정합성 가드.
4. **`conditionGroupSchema` 공유 위치 분리**. 현재 filter 가 if-else 의 schema 를 import — `_shared/condition.schema.ts` 로 이동.
5. **strictComparison 기본값 `true`** 검토 (UX). 현재 사용자 입장에서 silent type coercion 발생 여지.

## TEST WORKFLOW 재수행

- lint: clean
- unit: 2708 / 2708 pass
- build: clean
