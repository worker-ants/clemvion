### 발견사항

---

**[INFO]** `evaluateCondition` 기본 파라미터 객체 반복 생성
- 위치: `condition-evaluator.util.ts:26` — `options: EvaluateOptions = {}`
- 상세: 호출자가 `options`를 생략할 때마다 빈 객체 `{}`가 새로 할당됨. `if-else` 핸들러처럼 조건 배열을 `map`으로 순회할 때 각 iteration마다 기본값 객체 생성이 발생.
- 제안: 모듈 레벨 상수로 추출. `const DEFAULT_OPTIONS: EvaluateOptions = { strict: false };`를 파일 상단에 선언하고 default value 대신 사용.

---

**[INFO]** `{ strict }` 객체 리터럴이 `cases.find` 콜백 내부에서 반복 생성
- 위치: `switch.handler.ts:113` — `evaluateCondition(input, c.condition, { strict })`
- 상세: `Array.find` 콜백이 케이스마다 실행될 때마다 `{ strict }` 객체가 새로 할당됨. 케이스가 10개면 최대 10번 할당. 일반 사용 범위에서는 무해하지만 불필요한 GC 압력.
- 제안: `execute` 함수 내에서 한 번만 생성: `const evalOptions = { strict };`로 추출 후 재사용.

---

**[INFO]** `matchByValue`의 선형 탐색
- 위치: `switch.handler.ts:146–156`
- 상세: `cases.find`는 O(n) 선형 탐색. 매 실행마다 `coerceCaseValue`도 케이스별로 호출. 케이스 수가 수십 개 이하라면 문제없지만, 동적 포트가 수백 개 생성되는 시나리오에선 Map 기반 조회(O(1))가 유리.
- 제안: 현재 규모에서는 조치 불필요. 케이스가 50+개를 초과하는 사용 사례가 생기면 `validate` 시점에 `Map<coercedValue, SwitchCase>` 사전 구축을 고려.

---

**[INFO]** `stripControlFields`의 스프레드 복사 범위 확대
- 위치: `execution-engine.service.ts` — `stripControlFields` 메서드
- 상세: 기존 `stripSelectedPort`는 `_selectedPort`가 있을 때만 얕은 복사를 수행했음. 변경 후엔 `port`, `status`, `_resumeState` 중 하나라도 있으면 출력 객체 전체를 스프레드 복사. AI 에이전트처럼 출력 객체가 큰 경우(수백 KB 단위의 conversation history 등) 노드 간 전달마다 이 비용이 발생.
- 제안: 실용적 완화책으로 이미 적용된 early-return 분기(`!('_selectedPort' in o) && !('port' in o) && ...`)가 제어 필드가 없는 일반 경로를 복사 없이 통과시키므로 현재 구현은 적절. 다만 AI/Form 노드 직후 다운스트림에서는 항상 복사가 발생함을 인지할 것.

---

### 요약

이번 변경은 제어 필드 누수(control-field leakage) 버그 수정과 조건 평가 로직 추출이 핵심이다. 성능 관점에서 신규 도입된 비효율은 모두 INFO 수준으로, 일반 워크플로우 규모(노드 수십 개, 케이스 수십 개)에서 측정 가능한 영향은 없다. 오히려 `stripControlFields`의 early-return 최적화는 제어 필드가 없는 일반 경로에서 불필요한 객체 복사를 회피하는 순개선이다. `evaluateCondition` 기본 파라미터 객체 생성과 `{ strict }` 리터럴 반복 할당은 코드 정리 차원에서 개선 가능하나 현 시점에서 긴급도는 낮다.

### 위험도

**LOW**