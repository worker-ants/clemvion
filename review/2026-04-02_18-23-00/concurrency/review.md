## 리뷰 결과

### 발견사항

- **[WARNING]** `resolveString`의 타입 보존 로직 버그 — 혼합 표현식도 `evaluate()` 결과를 그대로 반환
  - 위치: `expression-resolver.service.ts`, `resolveString()` 메서드
  - 상세: 스펙은 "혼합 텍스트 + 표현식은 항상 string 반환"을 명시하지만, 현재 구현은 `FULL_EXPRESSION_PATTERN`이 아닌 경우에도 `evaluate()` 결과를 그대로 반환합니다. 동시성 이슈는 아니지만, 멀티 스레드 환경에서 예상치 못한 타입으로 인한 직렬화 오류가 발생할 수 있습니다.
  - 제안: 혼합 텍스트인 경우 `String(result)` 명시적 변환 적용

- **[WARNING]** `buildExpressionContext`에서 `$execution.startedAt`이 실제 실행 시작 시각 대신 매 호출 시 `new Date()`를 사용
  - 위치: `expression-resolver.service.ts`, `buildExpressionContext()` 29번째 줄
  - 상세: 동일 실행(execution) 내에서 여러 노드가 병렬로 평가될 경우, `$execution.startedAt`이 노드마다 다른 값을 가집니다. `ExecutionContext`에 `startedAt`이 있다면 그 값을 사용해야 합니다.
  - 제안: `executionContext.startedAt ?? new Date().toISOString()` 사용

- **[INFO]** 자동완성 팝업에서 `keydown` 이벤트 리스너를 `anchorRef`에 직접 등록
  - 위치: `expression-autocomplete.tsx`, `useEffect` (keydown 등록)
  - 상세: React의 합성 이벤트와 네이티브 DOM 이벤트가 혼용됩니다. 네이티브 리스너는 React synthetic event 이전에 실행되므로, `Enter`/`Tab` 시 `e.preventDefault()`가 폼 submit이나 포커스 이동을 막지 못할 수 있습니다. 단일 스레드 환경이지만 이벤트 처리 순서 문제입니다.
  - 제안: `onKeyDown` prop을 `ExpressionInput`에서 직접 처리하거나 `capture: true` 옵션 적용

- **[INFO]** `ExpressionInput`에서 debounce 타이머와 컴포넌트 언마운트 타이밍
  - 위치: `expression-input.tsx`, validation `useEffect`
  - 상세: `clearTimeout`으로 cleanup이 올바르게 되어 있어 메모리 누수나 언마운트 후 setState 문제는 없습니다. 현재 구현은 정상입니다.

- **[INFO]** `$node` 라벨 충돌 시 나중 노드가 덮어씀
  - 위치: `expression-resolver.service.ts`, `buildExpressionContext()` `$node` 빌드 루프
  - 상세: 동일 라벨을 가진 노드가 여러 개일 때 `Map` 순회 순서에 의존합니다. JS `Map`은 삽입 순서를 보장하므로 결정론적이지만, 위상 정렬 순서와 Map 삽입 순서가 반드시 일치한다는 보장이 없습니다.
  - 제안: 스펙("나중에 실행된 노드가 우선")에 맞게 `nodeOutputCache` 존재 여부가 아닌 실행 순서를 기준으로 정렬 후 빌드

---

### 요약

이 변경사항은 표현식 엔진 공유 패키지(`@workflow/expression-engine`) 도입과 프론트엔드/백엔드 통합이 주요 내용입니다. 동시성 측면에서 치명적 이슈는 없습니다. 백엔드의 `ExpressionResolverService`는 상태를 보유하지 않는(stateless) NestJS 서비스로, 요청 간 공유 가변 상태가 없어 스레드 안전합니다. 프론트엔드는 단일 스레드 JS 환경이며 React의 상태 관리 패턴을 따릅니다. 주요 주의 사항은 `resolveString`의 혼합 표현식 타입 변환 누락(동시 실행 노드의 출력이 잘못된 타입으로 처리될 위험)과 `$execution.startedAt`의 호출 시점 불일치입니다. 전반적인 동시성 위험도는 낮습니다.

### 위험도
**LOW**