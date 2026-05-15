## 발견사항

### [WARNING] `note` 액션 스텝이 `evaluateFinishGuard`를 영구 차단
- **위치**: `workflow-assistant-stream.service.ts` `evaluateFinishGuard` (L531~L554)
- **상세**: `propose_plan.steps[*].action`에 `'note'`가 허용되어 있으나(`AssistantPlanStep` 타입), `evaluateFinishGuard`는 planStepId로 편집 tool call과 매칭하는 방식으로만 완료를 판단한다. `note` 스텝은 어떤 edit tool도 대응하지 않으므로 `completedStepIds`에 절대 포함되지 않는다. `finishBlockCount > 0` 안전 밸브 덕분에 무한루프는 방지되지만, note 스텝만 남은 상황에서 LLM이 `PLAN_NOT_COMPLETE` 응답에 있는 `pendingSteps` 배열을 보고 존재하지 않는 편집을 시도할 수 있다.
- **제안**: `evaluateFinishGuard` 내 pending step 필터에서 `action === 'note'` 스텝 제외:
  ```ts
  const pendingSteps = activePlan.steps
    .filter((s) => s.action !== 'note' && !completedStepIds.has(s.id))
    .map(...)
  ```

---

### [WARNING] Spec-구현 불일치: 2차 `finish` 차단 시 동작
- **위치**: `spec/3-workflow-editor/4-ai-assistant.md` §4.3 / `evaluateFinishGuard` L488
- **상세**: 스펙은 "반복 실패 시(2회 연속) 안전 탈출해 **error 이벤트**로 종료"라고 명시하지만, 구현체는 `finishBlockCount > 0`이면 `null`을 반환해 `finish`를 정상 통과(`ok: true`, `finishReason: 'stop'`)시킨다. 클라이언트 입장에서는 `done` 이벤트가 오지만 plan이 미완인 채로 종료된다. 에러 이벤트가 오지 않으므로 사용자는 이를 성공으로 오인할 수 있다.
- **제안**: 스펙을 현재 구현 기준(안전 탈출 = 정상 종료)으로 수정하거나, 구현을 스펙 기준(2차 차단 시 `ASSISTANT_PLAN_ABANDONED` 에러 이벤트)으로 맞출 것.

---

### [WARNING] `finish` LLM-facing 도구 반환 계약 신규 도입 (미선언 변경)
- **위치**: `workflow-assistant-stream.service.ts` L217~L248 / `spec/3-workflow-editor/4-ai-assistant.md` §4.3
- **상세**: 기존 `finish` 도구는 LLM에 반환값이 없었으나(`finishReason: 'stop'`으로 루프 탈출), 이제 `{ok: false, error: 'PLAN_NOT_COMPLETE', pendingSteps, openQuestions, message}` 형식의 tool_result를 LLM에 돌려준다. 이 신규 계약은 스펙 §4.3 표에는 반영되었으나, `tool_call_end` → tool_result 경로가 `kind: 'finish'`인 레코드를 `persistAssistantTurn`으로 DB에 저장하고 다음 턴 `toChatMessages`가 이를 history로 rehydrate한다는 점이 설계 문서에 명시되어 있지 않다. 향후 `toChatMessages` 수정 시 `finish` kind 레코드를 누락/잘못 처리할 위험이 있다.
- **제안**: `toChatMessages` 주석 또는 스펙 §8에 "blocked finish 레코드도 history rehydrate 대상"임을 명시.

---

### [INFO] `AssistantMessageView.onAnswerPlanQuestions` 필수 prop 추가 (내부 계약 변경)
- **위치**: `frontend/src/components/editor/assistant-panel/assistant-message.tsx` L10
- **상세**: `onAnswerPlanQuestions`가 선택이 아닌 필수 prop으로 추가되었다. 현재 유일한 소비자인 `assistant-panel.tsx`는 이미 처리하고 있으나, 테스트 코드나 Storybook 등 다른 소비자가 있으면 빌드 오류가 발생한다.
- **제안**: prop을 optional(`onAnswerPlanQuestions?: (answer: string) => void`)로 선언하거나, 소비자 전체를 점검 후 기록.

---

### [INFO] `MAX_TOOL_CALLS_PER_TURN` 16 → 32 (SLA 영향)
- **위치**: `workflow-assistant-stream.service.ts` L68
- **상세**: 안전 상한을 2배 늘렸다. 스펙 §10 타임아웃은 120초로 고정이므로, 32회 tool call이 모두 느린 LLM 응답과 겹치면 타임아웃 전에 상한이 트리거되지 않을 수 있다. 스펙은 이미 업데이트됨.
- **제안**: 특별한 조치 불필요. 다만 SSE keep-alive(15초)가 긴 루프에서도 클라이언트 연결을 유지하는지 모니터링 권고.

---

## 요약

이번 변경의 핵심 API 계약 신규 도입은 `finish` 도구가 단순 루프 종료 신호에서 LLM-facing 에러 페이로드(`PLAN_NOT_COMPLETE`)를 반환할 수 있는 양방향 계약으로 확장된 것이다. 전반적인 설계는 스펙과 일치하며 테스트 커버리지도 주요 시나리오를 잘 포함하고 있다. 다만 `note` 액션 스텝이 guard 로직에서 처리되지 않아 불필요한 loop round가 강제될 수 있고, spec에 기술된 "2차 차단 시 error 이벤트" 동작과 실제 구현(정상 finish)이 불일치한다는 두 가지 점이 개선이 필요하다. SSE 클라이언트 계약(`event: tool_call`이 `finish` kind에서 발행되지 않는 것)은 스펙과 일치하며, REST API 엔드포인트의 하위 호환성은 유지된다.

## 위험도

**MEDIUM**