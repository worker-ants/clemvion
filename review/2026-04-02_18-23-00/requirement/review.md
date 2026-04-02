### 발견사항

---

**[CRITICAL] `resolveString`의 혼합 표현식 처리 로직 버그**
- 위치: `expression-resolver.service.ts` — `resolveString()` 메서드
- 상세: 스펙은 "혼합 텍스트 + 표현식(예: `Hello {{ $input.name }}!`)의 결과는 항상 string"이라고 명시한다. 그러나 현재 구현은 full-expression과 mixed 두 분기 모두 `evaluate(value, ctx)`의 반환값을 그대로 리턴한다 — 즉 두 분기가 동일하다. `evaluate()`가 전체 템플릿 문자열을 받아 혼합 텍스트를 string으로 보간하는 책임을 지는지, 아니면 단순히 표현식만 평가하는지에 따라 `"Hello Alice"` 대신 `"Alice"`만 반환되거나 에러가 날 수 있다.
- 제안: `FULL_EXPRESSION_PATTERN`이 일치하지 않는 경우(혼합 텍스트), `value`를 분할하여 각 `{{ }}` 블록만 `evaluate()`로 평가한 뒤 나머지 텍스트와 문자열로 조합하는 로직을 별도 구현해야 한다.

```ts
// 현재 두 분기 모두 동일
if (FULL_EXPRESSION_PATTERN.test(value)) {
  return result; // type-preserving
}
return result; // 동일 — mixed text 보간 없음
```

---

**[WARNING] `$execution.startedAt`이 실제 실행 시작 시각이 아닌 현재 시각을 사용**
- 위치: `expression-resolver.service.ts` — `buildExpressionContext()`, line `startedAt: new Date().toISOString()`
- 상세: 스펙은 `$execution = { id, workflowId, startedAt, mode }`를 정의한다. 표현식이 노드 실행 직전에 평가되므로, `startedAt`은 현재 시각이 아닌 실행 엔티티의 실제 `createdAt`/`startedAt` 이어야 한다. 장시간 실행되는 워크플로우에서는 노드마다 다른 `startedAt` 값이 주입된다.
- 제안: `ExecutionContext`에 `startedAt` 필드를 추가하거나 `Execution` 엔티티를 컨텍스트에 포함시켜 실제 시작 시각을 전달해야 한다.

---

**[WARNING] `$execution.mode`가 항상 `'manual'`로 하드코딩됨**
- 위치: `expression-resolver.service.ts` — `buildExpressionContext()`, line `mode: 'manual'`
- 상세: 스케줄 트리거, 웹훅, API 호출 등 다양한 실행 모드가 존재하는데 항상 `'manual'`을 반환한다. `$execution.mode`를 사용하는 표현식은 모두 잘못된 값을 참조하게 된다.
- 제안: `ExecutionContext`에 `mode` 필드를 추가하고 실제 실행 트리거 유형을 전달해야 한다.

---

**[WARNING] `ExpressionHighlight`가 multiline(textarea) 입력에 적용되지 않음**
- 위치: `expression-input.tsx` — 조건 `{hasExpression && !multiline && ...}`
- 상세: 스펙 §8.4.1은 "`{{ }}` 블록 구문 하이라이트"를 `ExpressionInput` 컴포넌트의 기능으로 명시한다. 그러나 `multiline=true`인 경우(System Prompt, Query, Body 등 핵심 필드들) 하이라이트 오버레이가 완전히 비활성화된다.
- 제안: textarea에도 하이라이트 오버레이를 적용하거나, multiline이 true일 때도 동작하는 별도 구현이 필요하다.

---

**[WARNING] `validate()` 호출 시 표현식 이중 래핑 가능성**
- 위치: `expression-input.tsx` — `validateExpressions()` 함수
- 상세: `EXPR_BLOCK_RE`가 `{{ expr }}`에서 `expr`(내부 내용)을 캡처하는데, 이를 다시 `` validate(`{{ ${m[1]} }}`) ``로 래핑한다. 만약 `validate()`가 `{{ }}`를 포함한 전체 문자열이 아닌 순수 표현식 텍스트를 받는다면, 이중 래핑된 `` {{ {{ expr }} }} ``이 전달될 수 있다. expression-engine API 계약에 따라 검증 결과가 무효화될 수 있다.
- 제안: expression-engine의 `validate()` 시그니처를 확인하고 호출 방식을 정렬해야 한다.

---

**[WARNING] `autocompleteOpen`이 `true`로 열린 후 제안 목록 변경 시 `selectedIndex` 미초기화**
- 위치: `expression-input.tsx` — `handleInput` 콜백
- 상세: 사용자가 타이핑하면 `suggestions` 배열이 바뀌지만 `selectedIndex`는 리셋되지 않는다. `clampedIndex`로 범위를 보정하지만, 이전에 5번째 항목을 선택하다가 목록이 2개로 줄어들면 마지막 항목이 선택된 것처럼 보인다.
- 제안: `suggestions`가 변경될 때 `setSelectedIndex(0)`을 호출하는 `useEffect`를 추가해야 한다.

---

**[WARNING] `getExpressionToken` 내 경계값 오류 (`i === 0`일 때 `value[-1]`)**
- 위치: `use-expression-suggestions.ts` — `getExpressionToken()`, 역방향 스캔 루프
- 상세: `i === 0`일 때 `value[i - 1]`은 `value[-1]`로 JavaScript에서 `undefined`이다. `value[i] === "}" && value[i - 1] === "}"` 조건은 `false`로 평가되어 크래시는 없지만, 문자열 맨 앞에서 `}}` 닫힘 감지가 누락될 수 있다.
- 제안: `i > 0 && value[i] === "}" && value[i-1] === "}"` 조건으로 수정해야 한다.

---

**[INFO] `ExpressionResolverService`에 `Logger`가 선언만 되고 사용되지 않음**
- 위치: `expression-resolver.service.ts` — `private readonly logger = new Logger(...)`
- 상세: 표현식 평가 에러가 발생할 때 에러를 throw만 하고 logger로 기록하지 않는다. 런타임 디버깅에 어려움이 있을 수 있다.
- 제안: catch 블록에서 `this.logger.warn(...)` 혹은 `this.logger.debug(...)` 호출을 추가하거나, 사용하지 않는 logger를 제거해야 한다.

---

**[INFO] `nodeMap` optional 파라미터로 표현식 미해석 경로 존재**
- 위치: `execution-engine.service.ts` — `executeNode()` 메서드
- 상세: `nodeMap`이 `undefined`일 경우 `resolvedConfig = node.config`로 폴백하여 `{{ }}` 표현식이 그대로 핸들러에 전달된다. 현재는 호출부에서 항상 `nodeMap`을 전달하지만, 향후 다른 호출 경로가 추가되면 표현식이 미해석된 채로 실행될 수 있다.
- 제안: `nodeMap`을 필수 파라미터로 변경하거나, `undefined`일 때 명시적 경고를 추가해야 한다.

---

**[INFO] `$now`와 `$today` 생성 시 `new Date()` 중복 호출**
- 위치: `expression-resolver.service.ts` — `buildExpressionContext()`
- 상세: `$execution.startedAt`, `$now`, `$today`가 각각 `new Date()`를 별도로 호출하여 밀리초 단위로 다른 시각이 주입될 수 있다.
- 제안: 메서드 상단에서 `const now = new Date()`를 한 번만 호출하여 재사용해야 한다.

---

### 요약

이번 변경은 `@workflow/expression-engine` 패키지를 공유 모듈로 도입하고, 백엔드 실행 엔진에 `ExpressionResolverService`를 통합하며, 프론트엔드에 `ExpressionInput` 컴포넌트를 추가하는 표현식 언어 지원의 핵심 구현이다. 구조적 설계(핸들러 제외 규칙, `$node` 라벨 매핑, 자동완성 파이프라인)는 스펙을 충실히 따르고 있으나, `resolveString`에서 혼합 텍스트+표현식의 string 보간이 누락된 CRITICAL 버그가 있으며, `$execution.startedAt`과 `mode`의 하드코딩, multiline 하이라이트 미지원 등 스펙 요구사항과의 괴리가 여럿 존재한다. 이 중 `resolveString` 버그는 HTTP 요청 URL, 이메일 본문 등 혼합 표현식을 사용하는 대부분의 노드에서 잘못된 동작을 야기할 수 있어 반드시 수정이 필요하다.

### 위험도

**HIGH**