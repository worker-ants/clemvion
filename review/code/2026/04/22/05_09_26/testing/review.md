## 발견사항

### [CRITICAL] `hasClearPlanAfter` 슬라이스 경계 버그 — 동일 턴 내 `clear_plan` → `propose_plan` 시 다음 턴에서 새 plan이 cleared로 잘못 판정됨

- **위치**: `active-plan-context.ts` `findActivePlanContext()` 내 `hasClearPlanAfter` 계산부
- **상세**: `history.slice(planIndex)`는 plan이 저장된 메시지 자체를 포함한다. 동일 턴에서 `clear_plan` 호출 후 `propose_plan`이 호출되면, `persistAssistantTurn`은 하나의 assistant 메시지에 `toolCalls: [{name:'clear_plan'}, {name:'propose_plan'}]`과 `plan` 모두를 저장한다. 다음 턴에서 `findActivePlanContext`는 그 메시지를 planIndex로 찾고, `slice(planIndex)`가 그 메시지 자체를 포함하므로 `hasClearPlanAfter = true`가 되어 새 plan을 `null`로 반환한다.
- **재현 경로**: `clear_plan` → `propose_plan` (같은 턴) → 다음 턴 → 시스템 프롬프트에 Active plan context 미주입
- **제안**: `slice(planIndex + 1)`로 변경. 그리고 `active-plan-context.spec.ts`에 아래 케이스 추가:

```typescript
it('does not clear plan when clear_plan and propose_plan appear in the same message', () => {
  const newPlan = samplePlan({ title: 'new plan after topic change' });
  const history = [
    userMsg('화제 바뀐 요청'),
    assistantMsg({
      plan: newPlan,
      toolCalls: [
        { id: 'c1', name: 'clear_plan', arguments: {}, kind: 'plan', result: { ok: true, cleared: true } },
        { id: 'p1', name: 'propose_plan', arguments: {}, kind: 'plan', result: { ok: true } },
      ],
    }),
  ];
  const ctx = findActivePlanContext(history, null, [], '계속');
  expect(ctx).not.toBeNull();
  expect(ctx!.plan.title).toBe('new plan after topic change');
  expect(ctx!.status).toBe('active');
});
```

---

### [WARNING] `sanitizeOneLine` 미테스트 — 사용자 입력의 개행·백틱 치환 동작 보장 없음

- **위치**: `system-prompt.ts` `sanitizeOneLine()`, `system-prompt.spec.ts`
- **상세**: `sanitizeOneLine`은 프롬프트 블록 파괴를 막는 핵심 필터인데 별도 단위 테스트가 없다. 현재 fixture 데이터에는 개행이나 백틱이 없어서 실질적인 치환 경로가 전혀 검증되지 않는다. 특히 `userRequest`나 `plan.title`에 백틱이 포함된 LLM 응답이 그대로 넘어오면 프롬프트 코드 블록이 깨질 수 있다.
- **제안**: `system-prompt.spec.ts`에 다음 케이스 추가:

```typescript
it('sanitizes newlines and backticks in userRequest and plan fields', () => {
  const malformed = { ...activePlan, userRequest: 'line1\nline2`cmd`' };
  const prompt = buildSystemPrompt(defs as never, emptySnapshot, malformed);
  expect(prompt).not.toMatch(/line1\nline2/);
  expect(prompt).toMatch(/line1 line2'cmd'/);
});
```

---

### [WARNING] `note` step 렌더링 미테스트

- **위치**: `system-prompt.spec.ts`, `renderActivePlanSection()`의 `• [note]` 분기
- **상세**: `system-prompt.spec.ts`의 fixture는 `add_node`, `add_edge`만 포함하고 `note` action은 없다. `• [note] description` 형식 렌더링이 검증되지 않는다.
- **제안**: active plan fixture에 `{ id: 's4', action: 'note' as const, description: '참고 사항' }` 추가 후 `expect(prompt).toMatch(/\[note\].*참고 사항/)` 검증.

---

### [WARNING] `approved: false` 분기 미테스트 — "awaiting approval" 텍스트 검증 없음

- **위치**: `system-prompt.spec.ts`, `renderActivePlanSection()`의 `approved: ... ? 'yes ✅' : 'no (awaiting approval)'` 분기
- **상세**: 현재 active plan fixture는 `approved: true`만 사용한다. `approved: false`일 때 렌더링되는 `awaiting approval` 텍스트가 프롬프트에 포함되는지 테스트가 없다.
- **제안**: `approved: false`인 fixture로 추가 케이스 작성.

---

### [WARNING] `clear_plan` SSE 미발행 명시적 검증 없음

- **위치**: `workflow-assistant-stream.service.spec.ts`, `workflow-assistant-stream.service.ts`
- **상세**: 서비스 코드는 `clear_plan`에 대해 의도적으로 SSE `tool_call` 이벤트를 발행하지 않는다. 그러나 기존 테스트 "allows finish after clear_plan" 는 이를 명시적으로 검증하지 않는다. 나중에 로직이 변경되어 실수로 이벤트가 발행되어도 감지되지 않는다.
- **제안**: 해당 테스트에 다음 추가:

```typescript
const toolCallEvents = events.filter(e => e.event === 'tool_call');
expect(toolCallEvents.every(e => e.data.name !== 'clear_plan')).toBe(true);
```

---

### [WARNING] `forceCleared: true` 경로는 데드코드 — `deriveStatus` API 일관성 문제

- **위치**: `active-plan-context.ts` `deriveStatus(plan, ids, forceCleared)`
- **상세**: `forceCleared` 파라미터가 `true`로 전달되는 호출 지점이 현재 코드베이스에 없다. `cleared` 상태 판정은 `findActivePlanContext`에서 `hasClearPlanAfter` 조건으로 `null`을 반환하는 방식으로 처리된다. `deriveStatus`의 `forceCleared` 브랜치가 테스트되지 않으며 사실상 미사용이다.
- **제안**: `forceCleared` 파라미터 제거 또는 사용 경로 추가. 만약 유지한다면 `active-plan-context.spec.ts`에 직접 테스트 추가.

---

### [INFO] `isOkResult` 엣지케이스 미테스트

- **위치**: `active-plan-context.ts` `isOkResult()`
- **상세**: `result = null`, `result = { ok: false }`, `result = { ok: true }`, `result = {}`, `result = 42` 등의 케이스가 모두 명시적으로 테스트되지 않는다. 현재 "does not count failed tool calls" 테스트가 `{ ok: false, error: 'LABEL_CONFLICT' }` 하나만 커버한다.
- **제안**: `isOkResult`를 파일 외부로 export하거나 인라인 케이스 확장.

---

### [INFO] `buildAssistantTools()` / `TOOL_KIND_BY_NAME`에 `clear_plan` 추가 — 전용 단위 테스트 없음

- **위치**: `tool-definitions.ts`
- **상세**: `clear_plan`이 `TOOL_KIND_BY_NAME`에 `'plan'`으로, `buildAssistantTools()`에 도구 정의로 추가되었으나, 이를 직접 검증하는 단위 테스트가 없다. 서비스 레벨 통합 테스트에서 간접 검증되지만 회귀 가드로는 약하다.
- **제안**: tool-definitions 전용 spec 파일이 없다면 `workflow-assistant-stream.service.spec.ts`에 도구 목록 검증 케이스 추가.

---

### [INFO] `plan.summary` 빈 문자열 렌더링 미테스트

- **위치**: `system-prompt.spec.ts`, `renderActivePlanSection()`의 `if (ctx.plan.summary)` 분기
- **상세**: `summary`가 빈 문자열일 때 Summary 라인이 생략되는 동작이 테스트되지 않는다.

---

## 요약

전반적으로 테스트 커버리지는 새 기능(`findActivePlanContext`, `active plan` 프롬프트 섹션, `clear_plan` 후 finish 허용)의 핵심 경로를 잘 포착하고 있다. 그러나 **동일 턴 내 `clear_plan` → `propose_plan` 시퀀스**에서 `hasClearPlanAfter`가 `slice(planIndex)`(inclusive)를 사용해 plan 메시지 자체를 검색 범위에 포함시키는 경계 버그가 있으며 이 케이스에 대한 테스트가 전혀 없다. 이 버그는 다음 턴에서 active plan context가 소실되는 실사용 시나리오를 유발할 수 있어 수정이 필요하다. 그 외에는 `sanitizeOneLine`, `note` step 렌더링, `approved: false` 분기 등 렌더링 함수의 미커버 분기들이 WARNING 수준이다.

## 위험도

**MEDIUM** (critical 버그 1건은 실제 동작에 영향을 미치지만 발생 빈도가 낮은 엣지케이스이며, 나머지 이슈들은 테스트 갭 위주임)