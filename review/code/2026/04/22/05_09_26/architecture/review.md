## Architecture Code Review

### 발견사항

---

**[WARNING] `cleared` 상태가 타입에는 존재하나 `findActivePlanContext`는 이를 절대 반환하지 않음**
- 위치: `active-plan-context.ts:ActivePlanStatus`, `active-plan-context.ts:deriveStatus`, `system-prompt.ts:renderActivePlanSection`
- 상세: `ActivePlanStatus`는 `'active' | 'cleared' | 'completed'` 세 값을 정의하지만, `findActivePlanContext`는 plan이 clear된 경우 `null`을 반환하고 `cleared` 상태의 컨텍스트를 반환하는 경로가 전혀 없다. `deriveStatus`의 `forceCleared` 파라미터도 항상 `false`로 호출된다. 결과적으로 `renderActivePlanSection`의 `if (ctx.status === 'cleared') return ''` 분기와 `system-prompt.spec.ts`의 `status=cleared` 테스트는 프로덕션 플로우에서 도달 불가능한 dead code다. 타입이 가능하다고 선언하는 상태와 실제 런타임에서 생성 가능한 상태가 불일치한다.
- 제안: (a) `cleared` 상태를 타입에서 제거하고 plan 해제 시 `null` 반환을 정식 계약으로 확정하거나, (b) `findActivePlanContext`가 `pendingToolCalls`의 `clear_plan` 호출을 스캔하여 `{ status: 'cleared', ... }`를 실제로 반환하도록 변경한다. 어느 쪽이든 타입, 구현, 테스트가 일치해야 한다.

---

**[WARNING] 현재 턴의 `clear_plan` 감지가 `findActivePlanContext` 외부의 플래그(`planClearedThisTurn`)에 의존**
- 위치: `workflow-assistant-stream.service.ts:planClearedThisTurn`, `workflow-assistant-stream.service.ts:evaluateFinishGuard`
- 상세: plan 해제 감지에 두 가지 코드 경로가 존재한다. 이전 턴의 `clear_plan`은 `findActivePlanContext`가 history를 스캔해 감지하고, 현재 턴의 `clear_plan`은 stream 루프의 `planClearedThisTurn` boolean 플래그로 감지한다. `findActivePlanContext`는 `pendingToolCalls`를 받지만, 완료된 step ID 집계에만 사용하고 `clear_plan` 탐지에는 사용하지 않는다. 이 비대칭성으로 인해 `evaluateFinishGuard`의 두 책임자(`planClearedThisTurn` 체크와 `findActivePlanContext` 호출)가 서로의 맹점을 채우는 암묵적 계약이 형성된다.
- 제안: `findActivePlanContext` 내부에서 `pendingToolCalls.some(tc => tc.name === 'clear_plan')`를 검사하여 현재 턴의 clear_plan도 직접 처리하면, `planClearedThisTurn` 플래그를 제거하고 감지 로직을 단일 함수로 응집시킬 수 있다.

---

**[WARNING] `hasNewerProposePlanAfter` 검사가 역방향 스캔과 중복**
- 위치: `active-plan-context.ts:75-80`
- 상세: `findActivePlanContext`는 `planIndex`를 역방향 스캔으로 찾는다—즉 정의상 가장 최근의 plan을 찾는다. 이후 `hasNewerProposePlanAfter`로 "이 plan 이후 더 최근 plan이 있는가"를 다시 검사하지만, 역방향 스캔이 이미 최신을 보장하므로 이 조건은 항상 `false`다. 주석도 이를 인정("drain 되어야 정상 발생하지 않지만 안전 방어")하고 있으나, 도달 불가능한 방어 코드는 독자에게 "이 경우가 실제로 발생할 수 있다"는 잘못된 신호를 준다.
- 제안: 실제로 의도한 불변식("역방향 스캔이 항상 최신 plan을 찾는다")을 코드 주석으로 명시하고 해당 조건 분기를 제거한다.

---

**[INFO] `findActivePlanContext`가 매 턴 두 번 호출됨 (파라미터가 다른 별도 호출)**
- 위치: `workflow-assistant-stream.service.ts:180-186`(시스템 프롬프트 조립), `workflow-assistant-stream.service.ts:578-583`(finish guard)
- 상세: 두 호출은 `pendingToolCalls`가 다르다—프롬프트 조립 시점에는 `[]`, guard 시점에는 실제 누적된 tool call 배열이다. 순수 함수이므로 정합성 문제는 없지만, 코드 독자는 왜 같은 함수를 다른 인자로 두 번 부르는지 즉시 파악하기 어렵다.
- 제안: 두 호출부 옆에 각각 "turn-start snapshot (pendingToolCalls empty)"와 "runtime snapshot (includes in-flight calls)" 용도임을 한 줄 주석으로 구분한다.

---

**[INFO] `planClearedThisTurn = false` 리셋이 새 plan 발행 시 암묵적으로 처리됨**
- 위치: `workflow-assistant-stream.service.ts:338`
- 상세: 같은 턴 안에 `clear_plan` → `propose_plan` 순서로 호출되면 `planClearedThisTurn`이 `false`로 리셋되어 새 plan의 guard가 정상 작동한다. 이 로직은 의도적이고 코멘트도 달려 있으나, flag 값에 의존하는 상태 전이가 stream 루프 안에 흩어져 있어 추적 비용이 있다.
- 제안: 위 WARNING의 수정(플래그 제거)이 이 문제도 함께 해소한다.

---

### 요약

이번 변경의 핵심 설계—**history에서 매 턴 derive하는 pure function `findActivePlanContext`** + **프롬프트 주입** + **finish guard 리팩터링**—는 DB 스키마 변경 없이 장기 세션 컨텍스트를 유지하는 합리적인 아키텍처 선택이다. 레이어 책임 분리와 순환 의존성 측면에서는 문제가 없으며, 순수 함수로 분리된 `active-plan-context.ts`는 높은 테스트 가능성을 갖는다. 다만 `cleared` 상태가 타입 정의와 실제 구현 사이에 불일치하는 dead code 문제, 그리고 `findActivePlanContext` 외부에서 `planClearedThisTurn` 플래그로 보완하는 이중 감지 경로가 응집도를 낮춘다. 이 두 문제를 `findActivePlanContext`가 `pendingToolCalls` 내 `clear_plan`도 직접 탐지하고 타입의 `cleared` 상태를 제거(혹은 실제 반환)하는 방향으로 수정하면 구현, 타입, 테스트의 일관성이 확보된다.

### 위험도

**LOW** — 기능 정확성에 즉각적인 영향은 없으나, 타입-구현 불일치와 이중 감지 경로는 이후 유지보수 시 버그 유입 가능성을 높인다.