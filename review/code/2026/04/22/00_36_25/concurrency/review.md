### 발견사항

- **[INFO]** `finishBlockCount` 로컬 변수의 원자성
  - 위치: `workflow-assistant-stream.service.ts:168`, `evaluateFinishGuard` 진입부
  - 상세: `finishBlockCount`는 `streamMessage` 제너레이터 호출 단위의 로컬 변수다. Node.js 이벤트 루프는 단일 스레드이므로 같은 요청 내에서는 원자성이 보장된다. 의도대로 동작한다.
  - 제안: 해당 없음

- **[INFO]** `finish` 차단 시 `done` 이벤트 미소비로 인한 사용량 누락
  - 위치: `workflow-assistant-stream.service.ts:229` (`break` 직후)
  - 상세: `finish` 호출을 차단하고 `break`를 실행하면 LLM 스트림에서 그 뒤에 오는 `done` 이벤트가 소비되지 않는다. 결과적으로 해당 라운드의 `usageEvent`가 null 상태로 남아 토큰 사용량이 SSE로 발행되지 않는다. `for await...of`에서 `break` 시 AsyncIterator의 `return()` 메서드가 호출되어 스트림이 정리되지만, 소비 중단 시점에 따라 LLM 공급자 측에서 불완전한 스트림 종료로 처리될 가능성이 있다.
  - 제안: 차단 후 `break` 전에 남은 이벤트를 드레인하거나, 차단 라운드에서 usage가 집계되지 않음을 로그로 명시하는 것을 고려할 수 있다. 운영상 치명적 결함은 아니다.

- **[LOW]** `PlanCard`의 답변 이중 제출(double-submit) 가능성
  - 위치: `plan-card.tsx`, `submitAnswer` 함수
  - 상세: `canSubmitAnswer` 확인 후 `onAnswerQuestions?.(trimmed)`를 호출하고 `setAnswer("")`로 상태를 초기화한다. React의 상태 업데이트는 비동기 배치이므로, 사용자가 버튼을 빠르게 연속 클릭하거나 Enter를 연타하면 첫 번째 호출로 인한 `disabled` 상태가 렌더링되기 전에 두 번째 제출이 통과할 수 있다.
  - 제안: `submitAnswer` 진입 직후 조기 반환 전에 로컬 ref 기반 `isSubmitting` 가드를 두거나, 서버 측 세션에서 중복 턴 감지로 대응할 수 있다. 저빈도 시나리오이고 서버가 중복 메시지를 받는 수준에 그치므로 MEDIUM 이하다.

- **[LOW]** 동일 세션에 대한 동시 요청 시 `evaluateFinishGuard` 상태 불일치
  - 위치: `workflow-assistant-stream.service.ts:488`, `evaluateFinishGuard`
  - 상세: 두 개의 동시 POST 요청이 같은 `sessionId`로 들어올 경우, 각 요청이 독립적으로 `history`를 로드하고 `pendingToolCalls`를 유지한다. 두 요청이 모두 plan의 일부 step만 실행하고 각각 `finish`를 시도하면, 양쪽이 서로의 진행 상황을 모르는 상태에서 `PLAN_NOT_COMPLETE` 판단이 엇갈릴 수 있다. 다만 스펙(§10)에 "워크플로우당 활성 스트리밍 1건만 허용(중복 POST 시 409)"이 명시되어 있으므로, 이 가드가 정상 적용되고 있다면 실질적 위험은 없다. 이번 변경 코드에는 해당 가드가 없고 기존 코드에 있을 것으로 보인다.
  - 제안: 기존 409 중복 스트림 가드가 이 경로를 실제로 커버하는지 확인한다.

---

### 요약

변경된 코드의 핵심 로직(`finishBlockCount`, `evaluateFinishGuard`, `findLatestPlanInHistory`)은 단일 요청의 `async` 제너레이터 실행 컨텍스트 내에서만 동작하며, Node.js 단일 스레드 모델 하에서 경쟁 조건이나 데드락 위험은 없다. `finish` 차단 시 `break`로 인한 사용량 누락과 React `PlanCard`의 이중 제출 가능성은 경미한 수준이고, 동일 세션 동시 요청 문제는 기존 스펙의 409 가드에 위임되어 있다. 이번 변경이 새로운 동시성 위험을 도입하지는 않는다.

### 위험도

**LOW**