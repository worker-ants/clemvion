## 리뷰 결과

### 발견사항

---

**[WARNING]** `cleared` 상태가 public API에서 생성되지 않는 dead code

- 위치: `active-plan-context.ts` — `ActivePlanStatus`, `ActivePlanContext.status`, `deriveStatus()`; `system-prompt.ts` — `renderActivePlanSection()`
- 상세: `findActivePlanContext`는 clear_plan이 감지되면 `null`을 반환한다. `deriveStatus()`의 `forceCleared` 파라미터는 항상 `false`로 호출되므로 `'cleared'` 상태는 절대 반환될 수 없다. 결과적으로 `renderActivePlanSection`의 `if (ctx.status === 'cleared') return ''` 분기는 런타임에서 도달 불가능하다. 타입과 실제 동작 간 불일치는 향후 유지보수자에게 혼란을 준다.
- 제안: `cleared` 상태를 `ActivePlanStatus`에서 제거하고 `null` 반환으로 통일하거나, 반대로 `findActivePlanContext`가 `null` 대신 `{ status: 'cleared', ... }`를 반환하도록 통일한다. `forceCleared` 파라미터와 `deriveStatus` 내 관련 분기도 함께 제거한다.

---

**[WARNING]** `hasClearPlanAfter`에서 `slice(planIndex)`가 plan 메시지 자신을 포함

- 위치: `active-plan-context.ts:68`
- 상세: `hasClearPlanAfter`는 `history.slice(planIndex)`로 시작하므로 plan이 기록된 메시지 자체가 스캔 범위에 포함된다. 반면 `hasNewerProposePlanAfter`는 올바르게 `slice(planIndex + 1)`을 사용한다. plan 메시지와 `clear_plan`이 같은 assistant turn에 기록되는 경우 자기 자신을 cleared로 오판할 수 있다.
- 제안: `history.slice(planIndex + 1)`로 수정하여 두 스캔을 일관되게 만든다.

---

**[WARNING]** `hasNewerProposePlanAfter`는 항상 `false` — 논리적으로 도달 불가능한 방어 코드

- 위치: `active-plan-context.ts:72-76`
- 상세: history를 역순으로 스캔해 `planIndex`를 찾으므로 해당 index 이후에 더 최신 plan이 존재할 수 없다. 이 조건은 항상 `false`여서 실제 역할이 없으며 코드 의도를 흐린다. 주석도 "안전 방어"라고 설명하지만 역순 스캔을 이해하면 불필요함을 알 수 있다.
- 제안: `hasNewerProposePlanAfter` 변수와 관련 조건을 제거한다. 역순 스캔으로 최신 plan을 보장한다는 설명을 `planIndex` 루프 주석에 추가하는 것으로 충분하다.

---

**[INFO]** `collectCompletedStepIds`에서 동일 필터 조건이 두 번 반복

- 위치: `active-plan-context.ts:96-115`
- 상세: history 루프와 pendingToolCalls 루프에서 아래 조건이 그대로 복사되어 있다.
  ```typescript
  tc.planStepId &&
  planStepIdSet.has(tc.planStepId) &&
  (!('result' in tc) || tc.result === undefined || isOkResult(tc.result))
  ```
  두 루프의 차이는 소스 배열뿐이다.
- 제안: 인라인 헬퍼 `isCompletedStep(tc, planStepIdSet)`로 추출하면 중복과 오류 가능성을 줄인다.

---

**[INFO]** `isOkResult`의 함수명이 동작을 오해하게 만든다

- 위치: `active-plan-context.ts:119-125`
- 상세: 함수명은 "결과가 ok인가"를 기대하게 하지만, 실제로는 `null`·원시값·`ok` 필드가 없는 객체 모두 `true`를 반환한다. 레거시 호환 주석이 있지만, 이름과 동작의 불일치는 이 함수를 재사용하거나 수정하는 맥락에서 버그를 유발할 수 있다.
- 제안: `isNotExplicitlyFailed(tc)` 또는 `isSuccessfulOrLegacy(result)` 같이 실제 의도를 드러내는 이름을 사용한다.

---

**[INFO]** `findActivePlanContext`가 턴당 두 번 호출되어 history를 이중 스캔

- 위치: `workflow-assistant-stream.service.ts:183`, `evaluateFinishGuard` 내부
- 상세: 시스템 프롬프트 구성 시 한 번, `evaluateFinishGuard` 내에서 다시 한 번 호출된다. 두 호출은 의도적으로 다른 인자(pendingToolCalls 포함 여부)를 사용하므로 설계 의도는 명확하지만, history가 길어질수록 O(n) 스캔이 두 번 발생한다. 현재 규모에서는 문제가 없으나 구조적 냄새다.
- 제안: 단기적으로 현 구조를 유지하되, `evaluateFinishGuard`의 서명에 이미 계산된 `activePlanContext`를 주입받을 수 있도록 리팩토링 여지를 두는 방향을 고려한다.

---

**[INFO]** `spec` 문서의 `finish` 도구 반환 설명이 새 `clear_plan` 동작을 반영하지 않음

- 위치: `spec/3-workflow-editor/4-ai-assistant.md:§4.3 finish 행`
- 상세: "활성 plan(이번 턴의 propose_plan 또는 히스토리 최근 plan)에 note를 제외한 pending step이 남아있거나..."로 시작하는 설명이 `clear_plan` 이후 guard가 비활성화된다는 내용을 포함하지 않는다. `§2.2`의 새 상태 설명과 불일치한다.
- 제안: `finish` 행에 "단, 같은 턴에 `clear_plan`이 호출된 경우 guard는 발동하지 않는다" 문구를 추가한다.

---

### 요약

`active-plan-context.ts`의 핵심 설계는 명확하며, DB 저장 없이 history로부터 derive하는 접근은 유지보수 측면에서 좋은 선택이다. 그러나 `cleared` 상태가 타입 시스템에는 존재하지만 런타임에서 실제로 생성되지 않는 구조적 불일치가 가장 큰 유지보수 위험이다. 향후 `renderActivePlanSection`의 `cleared` 분기를 수정하거나 `findActivePlanContext`를 확장할 때 이 불일치를 인지하지 못하면 버그로 이어질 수 있다. `hasClearPlanAfter`의 `slice(planIndex)` 오프셋 오류는 edge case이지만 실제 데이터 조건에 따라 재현 가능하다. 나머지 지적 사항은 가독성과 코드 청결도에 해당하며 즉각적인 기능 위험은 없다.

### 위험도

**MEDIUM**