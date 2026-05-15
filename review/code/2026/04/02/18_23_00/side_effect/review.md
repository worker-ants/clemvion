## 발견사항

### 백엔드

- **[WARNING]** `resolveString`에서 혼합 표현식(mixed text + expression)도 `result`를 그대로 반환
  - 위치: `expression-resolver.service.ts:123-127`
  - 상세: `FULL_EXPRESSION_PATTERN`이 매치되지 않을 때도 `evaluate(value, ctx)` 결과를 반환하는데, `evaluate()`가 혼합 문자열에서 어떤 타입을 반환하는지에 따라 number/object가 string 필드에 들어갈 수 있음. 의도는 항상 string이라고 주석에 명시되어 있으나 강제하지 않음
  - 제안: `return String(result)` 또는 `evaluate()` 내부에서 혼합 패턴 처리 보장 필요

- **[WARNING]** `buildExpressionContext`에서 `$execution.startedAt`이 항상 `new Date()`로 생성됨
  - 위치: `expression-resolver.service.ts:46`
  - 상세: 실제 실행 시작 시각이 아닌 표현식 해석 시점의 시각이 들어감. 노드 실행마다 다른 값이 생성되어 `$execution.startedAt`이 부정확함
  - 제안: `ExecutionContext`에서 실제 startedAt 필드를 전달받아 사용

- **[INFO]** `MAX_DEPTH = 10` 초과 시 원본 객체를 그대로 반환
  - 위치: `expression-resolver.service.ts:74`
  - 상세: 깊이 초과 시 내부의 표현식들이 해석되지 않고 원본 문자열로 남음. 조용히 실패(silent fail)하며 로그도 없음
  - 제안: 깊이 초과 경고 로그 추가 또는 에러 발생

- **[INFO]** `ExecutionEngineService.executeNode` 시그니처 변경 — `nodeMap` 파라미터 추가
  - 위치: `execution-engine.service.ts:494`
  - 상세: `nodeMap?: Map<string, Node>` 파라미터가 optional로 추가되어 기존 호출부는 영향 없으나, `nodeMap`이 없을 때 표현식 해석이 건너뛰어짐(line 524). 내부 private 메서드이므로 외부 영향은 없음
  - 제안: optional 대신 항상 nodeMap을 전달하도록 리팩토링 권장

### 프론트엔드

- **[WARNING]** `next build --webpack` 플래그 추가
  - 위치: `frontend/package.json:7`
  - 상세: Next.js의 기본 번들러(Turbopack)를 비활성화하고 webpack으로 강제 전환. `transpilePackages`는 Turbopack에서도 동작하므로 이 변경은 불필요하며 빌드 성능 저하를 유발함
  - 제안: `--webpack` 플래그 제거 후 동작 확인

- **[INFO]** `ExpressionInput`에서 `autocompleteOpen`이 입력할 때마다 `true`로 설정됨
  - 위치: `expression-input.tsx:83`
  - 상세: `handleInput` 내에서 항상 `setAutocompleteOpen(true)` 호출. `{{` 없는 일반 텍스트 입력 중에도 autocomplete 열기 시도가 발생하지만, `shouldShowAutocomplete`가 `suggestions.length > 0`에 의존하므로 실제로는 표시되지 않음. 불필요한 상태 변경이 발생함
  - 제안: `{{`가 포함될 때만 `setAutocompleteOpen(true)` 호출

- **[INFO]** 외부 클릭 감지 이벤트 리스너가 `document`에 등록됨
  - 위치: `expression-input.tsx:138-143`
  - 상세: 컴포넌트가 여러 개 렌더링될 경우 각각 `document`에 `mousedown` 리스너를 등록. 현재 cleanup이 올바르게 구현되어 있어 누수는 없으나, 동시에 여러 인스턴스가 존재 시 모든 인스턴스가 이벤트를 처리함
  - 제안: 현재 구현으로 기능상 문제는 없음

- **[INFO]** `use-expression-context.ts`에서 `"use client"` 지시어가 있으나 `useMemo`, hook 사용은 올바름. `getAllFunctionNames()`가 매 렌더에서 호출되지 않고 `useMemo` 내부에서 호출됨

---

## 요약

이번 변경은 `@workflow/expression-engine` 공유 패키지를 frontend/backend에 로컬 파일 의존성으로 추가하고, 노드 실행 전 config의 `{{ }}` 표현식을 해석하는 `ExpressionResolverService`와 에디터의 `ExpressionInput` 컴포넌트를 도입한 것입니다. 구조적으로 잘 격리되어 있고 기존 인터페이스를 크게 깨지 않으나, 혼합 표현식에서 반환 타입이 명시적으로 강제되지 않는 점과 `$execution.startedAt`이 실행 시작 시각이 아닌 표현식 해석 시각으로 잘못 설정되는 점, 그리고 `--webpack` 플래그가 불필요하게 추가된 점이 주요 주의 사항입니다.

---

## 위험도

**LOW**