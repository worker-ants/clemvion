## 리뷰 결과

### 발견사항

---

**[WARNING]** `hasClearPlanAfter` 에서 `slice(planIndex)` — plan 메시지 자체를 포함
- **위치**: `active-plan-context.ts` → `findActivePlanContext` 함수
- **상세**: `history.slice(planIndex)` 는 plan 을 담은 메시지 자체를 포함한다. 만약 단일 assistant 턴에서 `propose_plan` 과 `clear_plan` 이 모두 호출되어 `toolCalls` 에 둘 다 기록된다면, `findActivePlanContext` 는 해당 plan 을 즉시 `null` 로 반환한다. `persistAssistantTurn` 이 `plan` 필드와 `toolCalls`(clear_plan 포함) 를 동일 row 에 저장할 수 있으므로 이 경로는 이론적으로 도달 가능하다.
- **제안**: `slice(planIndex + 1)` 로 변경해 "plan 발행 이후" 만 탐색하거나, 테스트에서 동일 턴 propose→clear 시나리오를 커버하여 의도적 동작임을 고정.

---

**[WARNING]** `hasNewerProposePlanAfter` — 역방향 스캔으로 인해 항상 false
- **위치**: `active-plan-context.ts` → `findActivePlanContext`, planIndex 검색 직후
- **상세**: 루프가 history 를 역방향으로 스캔해 **가장 최근** plan 에서 break 하므로, `history.slice(planIndex + 1)` 에는 더 최신 plan 이 존재할 수 없다. 해당 분기는 사실상 dead code 이다. 코드 내 주석도 이를 인정하고 있지만, 로직이 변경될 경우(순방향 스캔 도입 등) 잘못된 안전감을 줄 수 있다.
- **제안**: 주석에 "이 검사는 현재 역방향 스캔 때문에 항상 false" 라고 명시하거나, 조건 자체를 제거하고 위의 `hasClearPlanAfter` 만 남기는 방향을 검토.

---

**[WARNING]** `clear_plan` SSE 미발행 — 프론트엔드가 동일 턴 내 plan 해제를 감지 불가
- **위치**: `workflow-assistant-stream.service.ts` → `kind === 'plan'` 분기
- **상세**: `clear_plan` 처리 시 `planClearedThisTurn = true` 로 내부 상태를 변경하지만 SSE 이벤트를 발행하지 않는다. `kind='plan'` 이므로 일반 `tool_call` 이벤트도 전달되지 않는다. 현재 기획(spec §5.3)은 `clear_plan` 을 UI 에 노출하지 않는다고 명시하나, Plan 카드가 화면에 남아있는 상태에서 사용자가 다른 작업을 하면 카드가 다음 턴까지 잔류한다.
- **제안**: 현재 설계가 의도적이라면 스펙에 "Plan 카드는 다음 응답이 올 때까지 잔류한다" 는 UX 동작을 명시. 즉시 해제가 필요하다면 `clear_plan` 에 대한 전용 SSE 이벤트(`event: plan_cleared`) 추가를 고려.

---

**[INFO]** `sanitizeOneLine` — 마크다운 구조 문자 미처리 (경미한 프롬프트 인젝션 면)
- **위치**: `system-prompt.ts` → `sanitizeOneLine`
- **상세**: 개행과 백틱은 제거하지만 `##`, `**`, `-`, `>` 등 마크다운 구조 문자는 통과된다. 사용자 요청("User request: ...")이 시스템 프롬프트에 직접 삽입되므로, 사용자가 `## Active plan context` 같은 문자열을 요청에 포함하면 프롬프트 섹션 구조를 흉내낼 수 있다. 실질적 피해는 낮지만 의도치 않은 LLM 동작을 유발할 수 있다.
- **제안**: 사용자 요청을 `>` 인용 블록 또는 XML-like fence(`<user-request>...</user-request>`)로 감싸 프롬프트 섹션과 시각적으로 분리.

---

**[INFO]** `isOkResult` — nullish result 를 성공으로 처리
- **위치**: `active-plan-context.ts` → `isOkResult`
- **상세**: `result` 가 `null`, `undefined`, 혹은 non-object 이면 `true` 를 반환한다. 레거시 호환을 위한 의도적 설계임이 주석에 명시되어 있지만, 실패한 편집 도구가 `result` 를 `null` 로 기록했을 경우 완료로 집계될 수 있다.
- **제안**: 현재 동작을 테스트로 명시적으로 고정(nullish result 케이스 추가). 새 데이터는 항상 `{ok: boolean}` 을 기록하므로 레거시 경로를 장기적으로 제거하는 마이그레이션 계획 수립.

---

**[INFO]** `buildSystemPrompt` 시그니처 변경 — 하위 호환 유지됨
- **위치**: `system-prompt.ts`
- **상세**: 세 번째 파라미터 `activePlanContext: ActivePlanContext | null = null` 이 추가되었으나 기본값이 있어 기존 호출자에 영향 없음. `evaluateFinishGuard` 내부 파라미터 순서(history ↔ planForTurn) 도 변경되었으나 `private` 메서드이며 호출부도 함께 수정되어 일관성 유지.

---

**[INFO]** `findActivePlanContext` 한 턴에 두 번 호출
- **위치**: `workflow-assistant-stream.service.ts`
- **상세**: 프롬프트 생성 시 한 번(pendingToolCalls=[]), finish guard 평가 시 또 한 번(누적 pendingToolCalls 포함) 호출된다. 의도적이며 각각 "턴 시작 상태"와 "현재 진행 상태"를 정확히 반영한다. 대규모 history 에서는 매 finish 시마다 O(n) 스캔이 반복되는 비용이 있으나 현재 규모에서는 문제없음.

---

### 요약

변경사항 전반은 설계 의도가 명확하고 기존 공개 인터페이스 하위 호환성을 유지하고 있다. 가장 주의할 부분은 `hasClearPlanAfter` 의 `slice(planIndex)` 로, plan 과 clear_plan 이 동일 턴에 발행될 때 plan 이 즉시 소멸되는 엣지 케이스가 잠재한다. `clear_plan` 의 SSE 미발행은 의도적이나 Plan 카드 잔류라는 UX 부작용을 내포한다. `isOkResult` 의 nullish-success 처리와 `sanitizeOneLine` 의 마크다운 미처리는 경미한 수준이며 현재 데이터 흐름에서는 실질 위험이 낮다. 전체 로직은 순수 함수 기반으로 전역 상태 변경, 파일시스템, 네트워크 부작용이 없다.

### 위험도

**LOW**