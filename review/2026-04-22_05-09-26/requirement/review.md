## 발견사항

---

### [WARNING] `hasClearPlanAfter` 범위 오류 — `clear_plan` + `propose_plan` 동일 턴 시나리오에서 신규 plan이 즉시 cleared 처리됨

- **위치**: `active-plan-context.ts` — `findActivePlanContext` 함수
- **상세**:
  ```typescript
  const hasClearPlanAfter = history
    .slice(planIndex)   // planIndex 자신을 포함
    .some(...)
  ```
  `planIndex`는 가장 최근 plan이 있는 메시지 위치다. LLM이 동일 턴에서 `clear_plan` → `propose_plan`을 순서대로 호출하면, 해당 assistant 메시지에 `plan` 필드(propose_plan 결과)와 `clear_plan` toolCall이 함께 저장된다. 다음 턴에 `findActivePlanContext`가 이 메시지를 `planIndex`로 찾고, `history.slice(planIndex)`가 이 메시지 자신을 포함하므로 `hasClearPlanAfter = true` → `null` 반환. 신규 plan이 곧장 비활성화된다.
  
  주석 `"// (2a) clear_plan 이 해당 plan 메시지 이후에 호출되었거나"`와 구현이 불일치한다(`이후에` = 엄밀히 "그 다음"인데 코드는 동일 메시지 포함). 기존 테스트는 `clear_plan`이 별도 메시지에 있어 이 버그를 잡지 못한다.

- **제안**: `history.slice(planIndex + 1)`로 변경. 테스트에 "동일 턴 clear_plan 후 propose_plan" 시나리오를 추가.

---

### [WARNING] `findUserRequestForPlan` — 원 요청이 아닌 마지막 사용자 메시지 반환

- **위치**: `active-plan-context.ts` — `findUserRequestForPlan`, 약 line 100
- **상세**:
  ```typescript
  for (let i = planIndex - 1; i >= 0; i--) {
    if (history[i].role === 'user') return history[i].content ?? null;
  }
  ```
  사용자 요청 → LLM 질문 → 사용자 답변 → LLM plan 제안 흐름에서 `userRequest`는 "사용자 원 의도"가 아닌 "마지막 clarification 답변"이 된다. 시스템 프롬프트에는 `User request: "환불 여부를 확인해줘"` 같이 부분 답변이 표시될 수 있어 LLM 맥락을 왜곡할 수 있다.
- **제안**: plan을 발행한 assistant 턴 이전의 **최초 user 메시지**를 찾거나, plan message의 역방향 scan 시 연속된 user/assistant 교환을 따라가 첫 user message를 반환하는 로직으로 개선. 또는 현재 한계를 스펙에 명시.

---

### [WARNING] `cleared` 상태는 `renderActivePlanSection`에서 도달 불가능한 dead code

- **위치**: `system-prompt.ts` — `renderActivePlanSection` 약 line 148, `active-plan-context.ts` — `deriveStatus`
- **상세**:
  `findActivePlanContext`는 plan이 cleared 상태일 때 `{ status: 'cleared', ... }`를 반환하지 않고 `null`을 반환한다. `deriveStatus`의 `forceCleared` 파라미터는 호출 지점 모두에서 `false`로 고정되어 있어 `'cleared'`를 반환하는 경로가 없다. 따라서:
  ```typescript
  if (ctx.status === 'cleared') return '';  // 절대 실행되지 않음
  ```
  `system-prompt.spec.ts`의 `'omits the section entirely when status=cleared'` 테스트는 수동으로 생성한 `{ status: 'cleared' }` 객체를 넘기는 방식으로 이 dead code를 테스트하고 있어 실제 동작을 보장하지 못한다.
- **제안**: `ActivePlanStatus`에서 `'cleared'`를 제거하고 cleared 경우에는 일관되게 `null` 반환으로 처리하거나, `findActivePlanContext`가 `{ status: 'cleared' }` 객체를 반환하도록 변경하여 `cleared` 상태를 실제로 사용. 현재 타입 정의와 런타임 동작이 불일치하므로 둘 중 하나로 통일 필요.

---

### [INFO] `collectCompletedStepIds` — plan 발행 이전 history도 포함하여 step ID 충돌 가능

- **위치**: `active-plan-context.ts` — `collectCompletedStepIds`
- **상세**: 전체 history를 순회하여 `planStepId` 매칭을 수행한다. 이전 plan에서 우연히 같은 step ID(예: 짧은 LLM-generated ID `s1`, `s2`)가 사용된 경우, 이전 plan의 edit 결과가 현재 plan의 완료 step으로 잘못 집계될 수 있다.
- **제안**: `planIndex`를 파라미터로 받아 해당 메시지 이후의 history만 스캔하도록 범위 제한. 현재 step ID가 LLM-generated이라 실용적 충돌 가능성은 낮지만 방어적 구현이 권장된다.

---

### [INFO] `isOkResult` — `null` 결과를 성공으로 처리

- **위치**: `active-plan-context.ts` — `isOkResult`
- **상세**:
  ```typescript
  if (!result || typeof result !== 'object') return true;
  ```
  `result`가 `null`이면 `!result === true`이므로 성공으로 간주한다. tool call 결과가 `null`인 edge case에서 실패한 step이 완료된 것으로 잘못 집계될 수 있다.
- **제안**: `if (result === null || result === undefined) return false;`로 명시적 처리.

---

## 요약

이번 변경은 세션 장기 컨텍스트(`ActivePlanContext`) 도출 로직과 `clear_plan` 도구를 추가하는 기능으로, 설계 의도와 구현 전반의 정합성은 양호하다. 단, `hasClearPlanAfter` 범위 오류(`planIndex` 포함 slice)는 `clear_plan` + `propose_plan`이 동일 LLM 턴에서 호출되는 현실적 시나리오에서 신규 plan이 즉시 비활성화되는 기능 버그이며, `cleared` 상태 타입이 런타임에서 실제로 생성되지 않아 타입 정의·테스트·런타임 간 불일치가 존재한다. `findUserRequestForPlan`이 원 사용자 의도가 아닌 clarification 답변을 반환할 수 있는 점도 LLM 맥락 품질에 영향을 줄 수 있다.

## 위험도

**MEDIUM**