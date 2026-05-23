# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `SelectedItemDetail` 내부 `onSubmitForm` prop 에 JSDoc 누락
- 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` — `SelectedItemDetail` 함수 props 타입 블록 (~line 355)
- 상세: `pendingFormToolCallId` 에는 spec 참조 JSDoc 이 추가됐으나, 바로 옆에 선언된 `onSubmitForm?: (data: Record<string, unknown>) => void` 에는 JSDoc 주석이 없다. 상위 `ConversationInspectorProps` 와 `SummaryView` 의 동일 prop 에는 짧게나마 설명이 달렸는데, `SelectedItemDetail` 만 비어있어 일관성이 깨진다.
- 제안: `onSubmitForm` 선언 직전에 `/** Active render_form 제출 콜백. pass-through to AssistantPresentationsBlock. */` 한 줄 추가.

### [INFO] `SummaryView` props 타입 블록에서 `onSubmitForm` JSDoc 단독 선언
- 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` — `SummaryView` props 블록 (~line 821)
- 상세: `pendingFormToolCallId` 에는 `/** spec §6.1.d.ii — ... */` JSDoc 이 있으나, 바로 이어지는 `onSubmitForm?: (data: Record<string, unknown>) => void` 는 JSDoc 없이 타입 선언만 있다. 동일 파일 내 `ConversationInspectorProps` 와의 설명 밀도 차이.
- 제안: `/** Active render_form 제출 콜백 — AssistantPresentationsBlock 에 pass-through. */` 추가.

### [INFO] `information-extractor.handler.ts` 의 inline import 형식 — 타입 가독성 약화
- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `processMultiTurnMessage` 파라미터 (~line 779)
- 상세: `_options` 파라미터 타입에 `import('../../core/node-handler.interface').ResumableMessageSource` inline import 가 사용됐다. 파일 최상단에 `import type { ResumableMessageSource }` 를 추가하는 편이 IDE hover 가독성·타입 오류 메시지 가독성 면에서 더 낫다. 주석 자체(`information_extractor 는 render_form 을 발행하지 않으므로 source 신호를 사용하지 않는다`)는 충분히 명확하다.
- 제안: 상단 import 에 `ResumableMessageSource` 추가 후 inline import 제거 (문서화 품질 개선, 기능 변경 없음).

### [INFO] `node-handler.interface.ts` 의 중복 블록 주석 (구 단독 주석 잔류)
- 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ResumableNodeHandler` 선언 바로 위 (~line 862-863)
- 상세: 변경 후 전체 파일 컨텍스트를 보면, `ResumableNodeHandler` 선언 직전에 두 개의 블록 주석이 연달아 존재한다. 첫 번째는 기존 `Multi-turn 대화형 노드 … 분기한다 (CRIT #4 — duck-typing 의존 제거).` 주석이고, 두 번째는 이번에 추가된 `ResumableMessageSource` type JSDoc 이다. 새 type 이 `ResumableNodeHandler` interface 앞에 삽입되면서 두 블록 주석이 서로 다른 대상(interface vs type)을 가리키는 형태가 됐는데, 코드 읽기 순서상 첫 번째 주석이 `ResumableMessageSource` type 에 대한 설명처럼 보일 수 있다.
- 제안: 첫 번째 주석(`Multi-turn 대화형 노드 … CRIT #4`)을 `export interface ResumableNodeHandler` 선언 직전으로 옮겨서 각 주석이 자신의 선언 바로 위에 위치하도록 정리.

### [INFO] `execution-store.ts` `resumeFromAiRenderForm` 구현부 인라인 주석이 interface JSDoc 내용과 중복
- 위치: `codebase/frontend/src/lib/stores/execution-store.ts` — `resumeFromAiRenderForm:` 구현 (~line 3193)
- 상세: interface 선언부 JSDoc(~line 3174)에 이미 상세 설명이 있는데, 구현부에도 동일 내용을 반복하는 긴 블록 주석이 붙었다. 중복이 미래 수정 시 두 곳을 동기화해야 하는 부담을 만든다. 구현부는 핵심만 한 줄로 요약하거나(`// spec §9.7.1 Inv-7 — pendingFormToolCall 만 null, 나머지 컨텍스트 보존`) interface JSDoc 에 완전히 위임하는 것이 좋다.
- 제안: 구현부 블록 주석을 `// spec/conventions/conversation-thread.md §9.7.1 Inv-7 — see interface JSDoc for full rationale.` 한 줄로 축약.

### [INFO] `result-detail.tsx` `ResultDetailProps.isWaitingForm` 필드 — JSDoc 신규 추가됐으나 기존 필드 여러 개는 여전히 문서 없음
- 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx` — `ResultDetailProps` interface (~line 2535)
- 상세: 이번 PR 에서 `isWaitingForm`, `onFormSubmit`, `onAiRenderFormSubmit`, `pendingFormToolCallId` 4개 필드에 JSDoc 이 추가됐다. 그러나 같은 interface 안의 `isWaitingButtons`, `buttonConfig`, `isWaitingConversation`, `conversationMessages`, `selectedConversationItemIndex` 등은 여전히 주석이 없다. 이번 변경과 직접 관련된 필드에만 집중적으로 문서화된 것은 이해할 수 있지만, 신규 기여자 입장에서 같은 interface 내 문서 밀도 불균형이 학습 장벽이 된다.
- 제안: 이번 PR 범위에서 필수 사항은 아니나, 다음 PR 기회에 interface 전체 JSDoc 완성을 고려.

### [INFO] `ai.en.mdx` form bypass 설명에서 cancelled tool_result 의 JSON 표기 개선 여지
- 위치: `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` (~line 2867)
- 상세: 유저 가이드 EN 버전에 `{type:'cancelled', reason:'user_sent_message_instead'}` 가 인라인 텍스트로 표기됐다. 마크다운 backtick 으로 감싸지 않아 일부 MDX 렌더러에서 중괄호가 JSX 표현식으로 파싱될 위험이 있다. KO 버전(`ai.mdx`)도 동일.
- 제안: `` `{type:'cancelled', reason:'user_sent_message_instead'}` `` 와 같이 code span 으로 감싸는 것을 권장.

## 요약

이번 변경은 공개 타입·인터페이스·컴포넌트 props 에 spec 섹션 참조를 명시한 JSDoc 을 일관되게 추가했고, 유저 가이드(KO/EN mdx) 도 신기능(form 인라인 렌더링·form bypass)에 맞춰 업데이트됐다. 핵심 공개 API(`ResumableMessageSource`, `processMultiTurnMessage`, `resumeFromAiRenderForm`, `AssistantPresentationsBlockProps`) 의 문서화 수준은 양호하다. 주요 미비 사항은 일부 내부 컴포넌트 props(`SelectedItemDetail.onSubmitForm` 등)의 JSDoc 누락, `node-handler.interface.ts` 에서 연달아 배치된 두 블록 주석의 대상 모호성, `ai.en.mdx` / `ai.mdx` 의 JSON 리터럴 코드 span 누락 정도이며, 모두 기능 동작에는 영향이 없다.

## 위험도

LOW
