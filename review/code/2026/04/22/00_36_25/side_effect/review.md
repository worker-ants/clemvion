## 발견사항

---

### [WARNING] 성공적인 `finish` 호출이 DB에 저장되지 않아 미래 세션에서 맥락 유실

- **위치**: `workflow-assistant-stream.service.ts` — `finish` 성공 처리 블록
- **상세**: 차단된 `finish`(`PLAN_NOT_COMPLETE`)는 `pendingToolCalls.push(...)` 로 DB에 저장되지만, 이어서 성공한 `finish`는 `pendingResultsForLlm.push({ id: ev.id, result: { ok: true } })` 만 하고 `pendingToolCalls` 에는 추가되지 않습니다. 결과적으로 `persistAssistantTurn` 이 저장하는 tool_calls 목록에는 차단 기록(`ok: false, error: PLAN_NOT_COMPLETE`)만 남고, 최종 성공 시그널이 없습니다. 다음 세션에서 `toChatMessages` 로 히스토리를 재수화(rehydrate)할 때 LLM은 "plan이 완료되지 않은 채 턴이 끝났다"고 인식해 이미 완료된 step을 재실행하려 시도할 수 있습니다.
- **제안**: 성공한 `finish` 도 `pendingToolCalls` 에 push하거나, 차단된 `finish` 레코드에 `resolution: 'succeeded_in_later_round'` 필드를 추가해 히스토리 재수화 시 LLM이 최종 상태를 알 수 있게 합니다.

---

### [WARNING] Round 1 사용량(usage) 이벤트가 소실됨

- **위치**: `workflow-assistant-stream.service.ts` — `finish` 차단 시 `break`
- **상세**: 차단된 `finish` 를 처리한 뒤 `break` 로 내부 `for await` 루프를 탈출하면, 같은 스트림에서 그 뒤에 오는 `done` 이벤트(usage 정보 포함)가 소비되지 않습니다. `usageEvent` 가 `null` 로 남아 Round 1의 토큰 사용량이 클라이언트에 전달되지 않고, `llm_usage_log` 기록도 누락됩니다.
- **제안**: `break` 전에 남은 이벤트를 drain하거나, `for await` 루프 내에서 `finish` 를 만났을 때 즉시 종료하지 않고 `done` 이벤트까지 계속 읽도록 합니다.

---

### [WARNING] 플랜 step ID 충돌로 `evaluateFinishGuard` 오판 가능

- **위치**: `workflow-assistant-stream.service.ts` — `evaluateFinishGuard` → `findLatestPlanInHistory`
- **상세**: `completedStepIds` 는 전체 히스토리(이전 턴 포함)의 `planStepId` 를 수집합니다. LLM 은 플랜 step ID를 `s1`, `s2`, `s3` 처럼 간단하게 생성하는 경향이 있어, 이전 플랜에서 완료된 `s1` 이 새 플랜의 미완료 `s1` 과 충돌하면 가드가 "이미 완료됨"으로 오판해 차단을 건너뜁니다(false negative).
- **제안**: step ID를 플랜 ID로 네임스페이스하거나(`${planId}::${stepId}`), `activePlan` 이 이번 턴에 새로 생성된 경우에는 히스토리에서 수집한 completed IDs 를 무시합니다.

---

### [WARNING] `AssistantMessageViewProps.onAnswerPlanQuestions` 필수 prop 추가 — 호출자 영향

- **위치**: `frontend/src/components/editor/assistant-panel/assistant-message.tsx`
- **상세**: `onAnswerPlanQuestions: (answer: string) => void` 가 optional 없이 필수 prop으로 추가되었습니다. 현재 코드베이스에서 `assistant-panel.tsx` 외에 `AssistantMessageView` 를 렌더링하는 곳이 있다면 TypeScript 컴파일 오류 또는 런타임 에러가 발생합니다. 이 diff에서 확인되는 유일한 호출지(`assistant-panel.tsx`)는 업데이트되었으나, 스토리북 스냅샷 테스트나 다른 래퍼 컴포넌트가 존재한다면 영향을 받습니다.
- **제안**: prop을 optional(`onAnswerPlanQuestions?: ...`)로 선언하거나, 코드베이스 전체에서 다른 호출지가 없는지 확인합니다.

---

### [INFO] 차단된 `finish` 가 `kind: 'finish'` 로 DB에 저장 — 신규 데이터 패턴

- **위치**: `workflow-assistant-message.entity.ts` + `workflow-assistant-stream.service.ts`
- **상세**: `AssistantToolCallKind` 에 `'finish'` 가 추가되어, 차단된 finish 호출이 `tool_calls` JSONB 컬럼에 `kind: 'finish'` 로 저장됩니다. `tool_calls` 를 직접 쿼리·파싱하는 분석 쿼리나 외부 소비자가 있다면 `kind` 필터 로직을 갱신해야 합니다. DB 마이그레이션은 불필요(JSONB이므로)하지만 기존 코드가 exhaustive switch를 쓰는 경우 `'finish'` 처리가 없어 기본 분기로 빠집니다.
- **제안**: `toChatMessages` 와 기타 tool_calls 소비 코드에서 `kind === 'finish'` 케이스 처리를 명시적으로 추가합니다.

---

### [INFO] 스트리밍 중 PlanCard 답변 입력창이 비활성화되지 않음

- **위치**: `frontend/src/components/editor/assistant-panel/plan-card.tsx`
- **상세**: `submitAnswer` 는 `isStreaming` 여부를 확인하지 않습니다. 답변 전송 후 LLM 응답이 스트리밍 중인 상태에서 사용자가 입력창을 다시 사용해 추가 전송하면 동시 요청이 발생합니다. 하단 `MessageInput` 은 `disabled={streaming}` 처리가 되어 있으나, plan-card의 textarea는 그렇지 않습니다.
- **제안**: `onAnswerQuestions` prop이 있을 때 `isStreaming` 상태를 추가로 받거나, `canSubmitAnswer` 조건에 포함해 스트리밍 중 재전송을 방지합니다.

---

### [INFO] `isDynamicPorts`/`dynamicPorts` 이중 체크 — 메타데이터 속성 불일치

- **위치**: `backend/src/modules/workflow-assistant/prompts/system-prompt.ts:26-28`
- **상세**: `d.metadata.isDynamicPorts || d.metadata.dynamicPorts` 로 두 가지 속성명을 동시에 체크합니다. 이는 기존 노드 중 일부가 `dynamicPorts`(camelCase 변형)를 사용하고 있음을 시사하며, 속성 이름이 통일되어 있지 않음을 나타냅니다. 명세 불일치가 있는 노드가 마커를 달지 못할 수 있습니다.
- **제안**: 노드 메타데이터의 속성명을 `isDynamicPorts` 로 통일하고, 레거시 `dynamicPorts` 속성을 사용하는 노드 정의를 일괄 업데이트합니다.

---

## 요약

이번 변경은 `PLAN_NOT_COMPLETE` 가드, dynamic-ports 프롬프트 강화, plan 카드 인라인 답변 UX 등 기능적으로 잘 설계된 개선이나, 부작용 관점에서 가장 중요한 이슈는 **성공적인 `finish` 가 DB에 저장되지 않는 것**입니다. 차단된 finish만 히스토리에 남아 미래 세션에서 LLM이 이미 완료된 플랜을 미완료로 인식할 수 있습니다. 아울러 Round 1 usage 소실, step ID 네임스페이스 미지정, PlanCard 동시 전송 가능성도 운영 환경에서 예상치 못한 동작을 유발할 수 있습니다. 필수 prop 추가(`onAnswerPlanQuestions`)는 현재 호출지 업데이트로 대응됐지만, 다른 소비자 여부를 확인해야 합니다.

## 위험도

**MEDIUM**