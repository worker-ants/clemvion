## 부작용 코드 리뷰: `switch.handler.spec.ts`

### 발견사항

- **[INFO]** `context` 객체 내 `variables`, `nodeOutputCache`가 `beforeEach`에서 매 테스트마다 새 참조로 재생성됨
  - 위치: `beforeEach` (line 8–14)
  - 상세: `execute` 구현체가 `context.variables`나 `context.nodeOutputCache`를 mutate하더라도 테스트 간 오염이 발생하지 않는 안전한 패턴. 의도치 않은 상태 공유 없음.
  - 제안: 없음

- **[INFO]** `SwitchHandler` 인스턴스가 `beforeEach`에서 재생성되어 인스턴스 간 상태 누출 없음
  - 위치: `beforeEach` (line 9)
  - 상세: stateless 핸들러이므로 `beforeAll`로 바꿔도 무방하나, 현재 패턴이 부작용 방어 측면에서 더 보수적이고 안전함.
  - 제안: 없음

- **[INFO]** `__proto__.constructor` 경로 테스트가 프로토타입 오염 방어를 검증하나, 테스트 자체가 오염을 일으키지 않는지 확인 필요
  - 위치: `'should not traverse prototype properties'` (line 마지막 블록)
  - 상세: 테스트 입력 객체 `{}` 자체에는 `__proto__` 조작이 없고, `switchValue`로만 문자열 전달. 구현체가 이 문자열을 `eval`이나 `new Function()`으로 처리하지 않는 한 테스트 환경에 부작용 없음. 단, 구현체(`switch.handler.ts`)에서 경로 탐색 시 `Object.prototype`에 접근하게 되면 Jest 실행 프로세스 전역 상태가 오염될 수 있으므로, 구현체의 경로 탐색 로직(`hasOwnProperty` 또는 `Object.hasOwn` 방어 여부)을 별도 확인 필요.
  - 제안: 구현체에서 `Object.hasOwn(obj, key)` 또는 `Object.prototype.hasOwnProperty.call(obj, key)` 기반 경로 탐색을 사용하는지 확인

- **[INFO]** 전역 상태 변경, 파일시스템 접근, 네트워크 호출, 환경 변수 읽기/쓰기 없음
  - 위치: 파일 전체
  - 상세: 순수 인메모리 단위 테스트. 외부 부작용 요소 없음.
  - 제안: 없음

---

### 요약

`switch.handler.spec.ts`는 부작용 관점에서 매우 안전하다. 전역 변수 수정, 파일시스템 접근, 네트워크 호출, 환경 변수 의존성이 전혀 없으며, `beforeEach`에서 모든 상태를 새 객체로 초기화하여 테스트 간 격리가 완벽히 보장된다. 유일한 주의 지점은 `'__proto__.constructor'` 경로를 사용하는 보안 테스트로, 테스트 자체는 안전하나 **구현체(`switch.handler.ts`)의 경로 탐색 방식**이 `Object.prototype`을 traversal할 경우 Jest 프로세스 전역 상태를 오염시킬 수 있다. 이는 테스트 코드의 문제가 아닌 구현체 리뷰 항목이다.

### 위험도
**NONE**