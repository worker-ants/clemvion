## 부작용 코드 리뷰: `switch.handler.spec.ts`

### 발견사항

- **[INFO]** `context` 객체가 `beforeEach`에서 재생성되지만 참조 공유 위험 없음
  - 위치: `beforeEach` 블록 (line 8–14)
  - 상세: `variables: {}`, `nodeOutputCache: {}`가 매 테스트마다 새 객체로 초기화됨. `execute`가 이 객체를 내부적으로 변경하더라도 테스트 간 오염 없음. 현재 구현상 문제없음.
  - 제안: 없음 (현재 패턴 적절)

- **[INFO]** `switchValue`로 `string` 경로 룩업과 직접 값 비교 두 경로가 모두 테스트되나, 경계 케이스 누락
  - 위치: execute > `'should fall through to default'` (line 113)
  - 상세: `switchValue: 'missing'`은 문자열이므로 path lookup을 시도하고 `undefined`가 나와 default로 빠짐. 그러나 `switchValue`가 `0`, `false`, `null` 같은 falsy 비-문자열 값일 때 path lookup 분기로 잘못 진입할 가능성이 구현체에 있을 수 있음. 스펙에 이 케이스가 없음.
  - 제안: `switchValue: 0`이나 `switchValue: null`에 대한 테스트 케이스 추가 고려

- **[INFO]** `validate` 테스트에서 `case`에 `id` 없을 때 에러 메시지 검증 누락
  - 위치: `'should return invalid when a case has no id'` (line 55)
  - 상세: `valid: false`만 검증하고 `errors` 내용을 검증하지 않음. 다른 validate 테스트들은 에러 메시지를 명시적으로 검증함.
  - 제안: `expect(result.errors).toContain(...)` 추가로 일관성 확보

### 요약

이 테스트 파일은 순수한 단위 테스트로, 전역 상태 변경, 파일시스템 접근, 네트워크 호출, 환경 변수 접근이 전혀 없습니다. `beforeEach`에서 handler와 context를 매번 새로 생성하므로 테스트 간 상태 오염 위험이 없고, 외부 의존성 없이 `SwitchHandler`와 `ExecutionContext` 타입만 임포트합니다. 구현체(`switch.handler.ts`)가 `context.variables`나 `context.nodeOutputCache`를 mutate하는 경우 테스트가 이를 검증하지 않는 점은 향후 구현 변경 시 silent side effect가 될 수 있으나, 현재 코드 범위 내에서는 부작용 리스크가 없습니다.

### 위험도

**NONE**