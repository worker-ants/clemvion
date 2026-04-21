## 리뷰 대상: Active Plan Context 기능 추가

### 발견사항

- **[INFO]** `deriveStatus` 함수의 `forceCleared` 매개변수가 항상 `false`로 호출됨
  - 위치: `active-plan-context.ts` — `deriveStatus(plan, completedStepIds, false)` (두 호출 모두)
  - 상세: `ActivePlanStatus`에 `'cleared'` 가 선언되어 있지만, `findActivePlanContext`는 `cleared` 상태 대신 항상 `null`을 반환한다. `forceCleared` 매개변수와 `deriveStatus` 내 해당 분기는 실행 불가능한 데드코드다. `system-prompt.spec.ts`의 `status=cleared` 테스트는 수동으로 객체를 생성해 검증하므로 정상 흐름에서 이 상태는 도달 불가.
  - 제안: `forceCleared` 파라미터 제거 또는, `findActivePlanContext`가 `null` 대신 `{status: 'cleared', ...}` 를 반환하도록 설계를 일관되게 통일. 현재는 타입과 구현 간 불일치가 존재함.

- **[INFO]** `hasClearPlanAfter` 슬라이스 범위가 plan 메시지 자체를 포함함
  - 위치: `active-plan-context.ts` — `history.slice(planIndex)` (not `planIndex + 1`)
  - 상세: 극히 드문 케이스지만, `planIndex` 메시지에 `propose_plan`과 `clear_plan`이 동시에 포함될 경우 plan이 즉시 cleared 처리된다. 의도가 "plan 발행 이후의 `clear_plan` 감지"라면 `planIndex + 1`이 더 정확하다. 현재 코드는 동작은 맞지만 의도가 덜 명확함.
  - 제안: `history.slice(planIndex + 1)` 로 변경해 의도를 명시적으로 표현.

- **[INFO]** `evaluateFinishGuard` 매개변수 순서 변경 (`planForTurn ↔ history` 스왑)
  - 위치: `workflow-assistant-stream.service.ts` — 메서드 시그니처 및 호출부
  - 상세: 기능 변경과 무관한 순서 변경이 포함되어 있으나, 내부 private 메서드이고 호출부도 함께 변경되어 리스크 없음. 리팩토링 범위 내로 판단.

- **[INFO]** `findLatestPlanInHistory` 삭제
  - 위치: `workflow-assistant-stream.service.ts`
  - 상세: `findActivePlanContext`로 기능이 흡수되어 삭제된 것으로, 의도된 범위 내 정리임. 외부 노출 없는 private 메서드라 사이드이펙트 없음.

---

### 요약

전체 변경은 "Active Plan Context" 기능 추가와 `clear_plan` 도구 신규 구현이라는 단일 목적에 일관되게 집중되어 있다. 무관한 파일 수정, 불필요한 포맷팅 변경, 과도한 기능 확장은 발견되지 않는다. 다만 `ActivePlanStatus` 타입에 선언된 `'cleared'` 상태가 `findActivePlanContext`에서 실제로 생성되지 않고 항상 `null`을 반환하는 설계 불일치가 존재한다 — 이는 타입 정의와 구현 간의 인터페이스 계약 모호성으로, 향후 호출자가 `cleared` 상태를 기대하는 코드를 작성할 경우 혼란의 소지가 있다.

### 위험도

**LOW**