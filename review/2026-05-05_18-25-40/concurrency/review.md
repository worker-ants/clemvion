### 발견사항

- **[INFO]** `regexCache`가 `execute()` 호출마다 재생성됨
  - 위치: `filter.handler.ts` — `execute()` 내 `const regexCache = new Map<...>()`
  - 상세: 캐시가 인스턴스 레벨이 아닌 호출 로컬이므로, 동일 패턴을 사용하는 조건이 있어도 워크플로 실행 간 캐시가 공유되지 않음. 동시성 버그는 아니지만 고빈도 실행 시 정규식 재컴파일이 반복됨.
  - 제안: 현 설계(로컬 캐시)는 동시성 안전성 측면에서 올바른 선택. 성능이 문제가 되면 `WeakMap` 기반 인스턴스 캐시 + 패턴 문자열 키를 도입하되, 동시 접근 시 원자성 보장이 없어지므로 캐시 미스로 인한 중복 컴파일을 허용하는 check-then-act 패턴(현재 구조)을 유지.

- **[INFO]** `evaluate()` 가 동기 함수라는 암묵적 전제
  - 위치: `filter.handler.ts` — `resolveIfExpression()` 내 `return evaluate(value, ctx)`
  - 상세: `await` 없이 `evaluate()` 반환값을 직접 사용. 만약 `evaluate()`가 `Promise`를 반환하는 비동기 함수라면, `fieldValue`와 `resolvedValue`가 `Promise` 객체 그 자체가 되어 모든 비교 연산이 조용히 실패(`false`)함. 루프가 완전히 동기적으로 설계되어 있어 비동기 누출을 감지할 수단이 없음.
  - 제안: `evaluate()`의 반환 타입이 `Promise`가 아님을 단언하는 타입 검증 또는 주석 추가. `@workflow/expression-engine`의 타입 시그니처에서 반환 타입이 `unknown` (동기)임을 명시적으로 확인할 것.

---

### 요약

변경된 코드 전체가 동기 연산(`Promise.resolve()`로 래핑된 동기 루프)으로 설계되어 있고, `regexCache`·`match`·`unmatched` 등 모든 변경 가능한 상태가 `execute()` 호출 스코프 내에만 존재한다. `FilterHandler` 인스턴스 자체에는 가변 공유 상태가 없으므로 동시 실행 간 경쟁 조건·데드락·스레드 안전성 문제는 없다. 유일한 잠재 위험은 `evaluate()` 비동기 누출이지만, 이는 동시성 문제가 아닌 타입 계약 위반 문제이며 현재 TableHandler 선례와 동일한 패턴을 따르므로 기존 코드베이스에서 이미 검증된 것으로 보인다.

### 위험도

**LOW**