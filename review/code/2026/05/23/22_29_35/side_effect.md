# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO] `ai-agent.handler.ts` — `state.pendingFormToolCall` 직접 `delete` (의도된 상태 변경)**
  - 위치: `ai-agent.handler.ts`, form bypass 분기 (`else if (pendingFormToolCall && messageSource === 'ai_message')`)
  - 상세: bypass 분기에서 `delete state.pendingFormToolCall`을 수행한다. `state`는 외부에서 전달된 mutable reference(`_resumeState`)이므로 caller-side 원본 객체가 변이된다. 이는 기존 `form_submitted` 분기에서도 동일하게 사용하던 패턴이며 의도적이다.
  - 제안: 기존 패턴과 일치하므로 현재는 허용 가능. 장기적으로 `{ ...state, pendingFormToolCall: undefined }` 복제 방식으로 원본 불변성을 지키는 방향을 고려할 수 있다.

- **[WARNING] `node-handler.interface.ts` — `processMultiTurnMessage` 시그니처 변경이 미구현 구현체에 묵시적 영향 가능**
  - 위치: `node-handler.interface.ts`, `ResumableNodeHandler.processMultiTurnMessage` 세 번째 파라미터 추가
  - 상세: `options?: { source: ResumableMessageSource }`가 optional이므로 TypeScript 컴파일 차원에서 기존 구현체의 파라미터 미추가는 오류 없이 통과한다. 향후 신규 `ResumableNodeHandler` 구현체가 `options` 처리를 누락하면 form bypass 분기가 묵묵히 무시된다. `InformationExtractorHandler`는 `_options`로 명시적 no-op 처리하여 현재 범위에서는 문제없다.
  - 제안: 인터페이스 JSDoc에 "구현체는 options를 명시적으로 무시하는 방식(`_options`)으로 선언하여 의도를 명확히 표현하라"는 지침 추가 권장.

- **[WARNING] `execution-store.ts` — `resumeFromAiRenderForm`의 shallow-spread 패치**
  - 위치: `execution-store.ts`, `resumeFromAiRenderForm` action, `{ ...(conv as Record<string, unknown>), pendingFormToolCall: null }`
  - 상세: shallow copy 방식이므로 `conv` 내부 중첩 객체들이 reference를 공유한다. 현재 Zustand 사용 패턴과 conv 하위 필드의 immutable-by-convention 관행에서는 문제없으나, 이론적으로 stale reference 문제 가능성이 있다.
  - 제안: `structuredClone` 또는 deep copy를 고려하거나, 현 shallow spread가 충분하다면 주석으로 shallow copy 의도 명시.

- **[INFO] `executions/[id]/page.tsx` + `run-results-drawer.tsx` — `isWaitingForm`에서 `'ai_form_render'` 제외 (의도된 동작 변경)**
  - 위치: 두 파일의 `isWaitingForm` 계산 로직
  - 상세: `waitingInteractionType === "form"` 한정으로 축소됐다. 두 소비 위치 모두 동기화됐다. 다만 `isWaitingForm`을 참조하는 다른 위치가 있다면 해당 위치도 동기화 여부 확인이 필요하다.
  - 제안: 코드베이스 전체에서 `isWaitingForm` 또는 `waitingInteractionType === "ai_form_render"` 조합을 사용하는 다른 consumer 존재 여부 확인.

- **[INFO] `result-detail.tsx` — `conversationWithFormPreview` stack 제거**
  - 위치: `result-detail.tsx`, `previewContent` 조합 로직
  - 상세: `conversationWithFormPreview` 경로가 완전히 제거됐다. `isWaitingConversation`이 false이고 `isWaitingForm`도 false인 짧은 재수화 구간에서 form이 순간적으로 보이지 않을 수 있다.
  - 제안: 재수화 타이밍 race condition에 대한 로딩/스켈레톤 처리가 적절히 되어 있는지 확인.

- **[INFO] `ai-agent.handler.ts` — bypass 분기의 `messages[stubIndex]` 교체는 local copy에 대한 변경**
  - 위치: `ai-agent.handler.ts`, bypass 분기, `messages[stubIndex] = cancelledToolResult`
  - 상세: `messages`는 `const messages = [...(state.messages as ChatMessage[])]`로 shallow copy된 local 배열이다. 원본 `state.messages`는 영향받지 않는다. 올바른 패턴.

- **[INFO] `information-extractor.handler.ts` — `_options` 파라미터 추가 (no-op)**
  - 위치: `information-extractor.handler.ts`, `processMultiTurnMessage` 시그니처
  - 상세: `_options`로 명명하여 의도적 미사용을 표현하며 실제 로직에서 참조하지 않는다. 인터페이스 호환을 위한 stub 추가이며 부작용 없음.

- **[INFO] `execution-store.ts` — 신규 전역 store action `resumeFromAiRenderForm` 도입**
  - 위치: `execution-store.ts`, Zustand store
  - 상세: 기존 action을 오버라이드하지 않으며, `CLEAR_INPUT_AFFORDANCE`를 호출하지 않고 `pendingFormToolCall`만 null 패치한다. `waitingNodeId`, `waitingInteractionType`, `isWaitingAiResponse` 등 multi-turn 컨텍스트 보존은 의도된 동작이다.

## 요약

이번 변경은 `ResumableNodeHandler.processMultiTurnMessage`에 optional `options` 파라미터를 추가하고 AI Agent handler에 form bypass 분기를 신설하며, 프론트엔드에서 `ai_form_render` 활성 form의 UI 단일 진실을 timeline 인라인으로 통합하는 작업이다. 부작용 관점에서 의미있는 발견은 두 가지다: (1) `ai-agent.handler.ts`가 `state.pendingFormToolCall`을 `delete`로 직접 변이하는 패턴이 caller-side 원본 객체에 영향을 주나 기존 코드베이스 관행과 일치하여 의도된 것이고, (2) `ResumableNodeHandler` 인터페이스의 optional 파라미터 추가로 향후 신규 구현체가 form bypass 처리를 누락해도 컴파일 오류 없이 통과할 수 있다. 현재 구현 범위(`AiAgentHandler`, `InformationExtractorHandler`)는 모두 명시적으로 처리되어 있으며, `isWaitingForm` 축소는 두 소비 위치에서 일관되게 적용됐다. 전반적으로 의도하지 않은 부작용의 위험도는 낮다.

## 위험도

LOW
