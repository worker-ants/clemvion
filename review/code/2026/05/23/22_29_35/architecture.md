# Architecture Review

## 발견사항

### [WARNING] `options` 파라미터 타입이 인터페이스에 인라인 객체 리터럴로 정의됨
- 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ResumableNodeHandler.processMultiTurnMessage` 시그니처 (`options?: { source: ResumableMessageSource }`)
- 상세: `ResumableMessageSource` 타입은 명시적으로 export 되었으나, options 파라미터 자체의 타입(`{ source: ResumableMessageSource }`)은 별도 인터페이스나 타입 alias 없이 인라인으로 선언되어 있다. 향후 `options` 에 필드가 추가될 때 인터페이스 전체에 걸쳐 signature 불일치가 발생할 수 있고, 호출부마다 타입을 재선언해야 하는 확장 비용이 발생한다.
- 제안: `export interface ResumableMessageOptions { source: ResumableMessageSource }` 를 인터페이스 파일에 정의하고 시그니처를 `options?: ResumableMessageOptions` 로 교체. `InformationExtractorHandler` 의 `_options` 인라인 import 타입도 동일하게 참조하도록 정리.

### [WARNING] `InformationExtractorHandler.processMultiTurnMessage` 의 `options` 파라미터가 인라인 `import()` 타입으로 선언됨
- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (추가 라인 779-784)
- 상세: `_options?: { source: import('../../core/node-handler.interface').ResumableMessageSource }` 형태로 선언되어 있다. 모듈 경계를 인라인 동적 import 로 참조하는 것은 타입 의존성을 불명확하게 만들고, 리팩터링 도구(IDE 심볼 추적)의 정확도를 낮춘다. `InformationExtractorHandler` 가 options 를 사용하지 않는다는 사실이 인터페이스 계약 수준에서 명시되지 않아 인터페이스와 구현 사이의 암묵적 불일치가 생긴다.
- 제안: 파일 상단 import 에 `ResumableMessageSource` (또는 `ResumableMessageOptions`) 를 추가하고 인라인 import 제거. `options` 를 사용하지 않는다는 의도는 `_` prefix 로 충분하므로 타입 자체는 공유 타입 alias 를 사용한다.

### [INFO] `ResumableNodeHandler` 인터페이스 JSDoc 블록이 중복 선언됨
- 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — 857행 전후 (diff 기준)
- 상세: `ResumableNodeHandler` 인터페이스 직전에 JSDoc 블록이 두 개 연속으로 존재한다. 첫 번째 블록(`'processMultiTurnMessage' in handler narrowing 가드…`)이 `ResumableMessageSource` type 선언과 `ResumableNodeHandler` 사이에 floating 상태로 남아 있어 의도한 문서 대상이 불분명하다. 이는 인터페이스 타입의 `全체 파일 컨텍스트` 전체 파일에서도 동일하게 확인된다.
- 제안: `ResumableNodeHandler` 에 대한 JSDoc 은 interface 선언부 직전 하나로 통합하고, 기존 floating 주석 블록 제거.

### [INFO] `waitForAiConversation` 의 `source` 파라미터가 positional argument 로 전달됨 (엔진 레이어)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `waitForAiConversation` 메서드 시그니처 (추가 라인: `source: ResumableMessageSource = 'ai_message'`)
- 상세: 엔진 내부의 `waitForAiConversation` 은 `source` 를 4번째 positional parameter 로 받는다. `processMultiTurnMessage` 는 `options?: { source }` 로 named options 객체를 사용하는데, 엔진과 핸들러 두 레이어의 파라미터 전달 방식이 혼재한다. 현재는 호출지가 2곳뿐이라 문제가 없지만, `waitForAiConversation` 에 파라미터가 더 추가될 경우 positional ordering 오류가 발생하기 쉽다.
- 제안: `waitForAiConversation` 도 `options?: { source: ResumableMessageSource }` 형태로 전환하거나, 최소한 `source` 를 마지막 파라미터로 위치를 고정하는 관례를 주석으로 명시.

### [INFO] 프론트엔드 prop drilling 깊이 (3단계: page → ResultDetail/Drawer → ConversationInspector → SelectedItemDetail/SummaryView → AssistantPresentationsBlock)
- 위치: `executions/[id]/page.tsx`, `run-results-drawer.tsx`, `result-detail.tsx`, `conversation-inspector.tsx`, `assistant-presentations-block.tsx`
- 상세: `pendingFormToolCallId` 와 `onSubmitForm` 이 5단계 컴포넌트 트리를 관통하여 prop drill 된다. 현재 변경은 스펙(§6.1.d.ii)의 "단일 진실" 요구를 충족하기 위해 불가피한 구조이며, 각 중간 컴포넌트가 prop 을 단순 pass-through 하는 점은 설계상 명시적으로 인지되고 있다(`Inv-5 동형` 주석). 그러나 이 깊이는 미래에 `ConversationInspector` 의 다른 소비처가 생길 경우 context/store selector 분리를 고려해야 할 임계점에 근접해 있다.
- 제안: 현재 구현은 허용 범위이나, `ConversationInspector` 가 세 번째 다른 진입 경로를 갖게 될 경우 `pendingFormToolCallId` 를 execution store selector 로 직접 소비하는 방향으로 전환을 검토할 것. 현 시점에는 변경 불필요.

### [INFO] `state` 에 대한 직접 mutation (`delete state.pendingFormToolCall`)이 두 분기에서 반복됨
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `form_submitted` 분기 (기존) + `ai_message` bypass 분기 (신규, line ~1666)
- 상세: `delete state.pendingFormToolCall` 이 두 분기에서 각각 독립적으로 호출된다. 현재는 중복 2회이고 오류가 없으나, 세 번째 분기나 에러 경로가 생기면 누락될 가능성이 있다. 로직이 `processMultiTurnMessageInner` 끝에 공통으로 적용되어야 함을 보장하는 구조적 장치가 없다.
- 제안: `pendingFormToolCall` 클리어를 분기 내부가 아닌 분기 이후 공통 경로(`finally` 블록 또는 분기 후 단일 실행 코드)로 이동시키거나, 헬퍼 함수(`clearPendingFormToolCall(state)`)로 추출하여 두 분기에서 호출하는 방식으로 중복을 제거.

---

## 요약

이번 변경은 `render_form` 활성 form 의 UI 표면을 별도 stack 에서 assistant turn timeline 인라인으로 단일화하는 아키텍처 결정을 일관되게 구현하고 있다. 백엔드에서는 `ResumableNodeHandler` 인터페이스에 `options.source` 를 optional 로 추가하여 하위 호환을 유지하면서 form bypass 분기를 신설하였고, 프론트엔드에서는 별도 DynamicFormUI stack 을 제거하고 `AssistantPresentationsBlock` 의 case "form" 분기에서 `toolCallId` 매칭으로 활성/제출 상태를 분기하는 구조로 정리되었다. SOLID 관점에서 `InformationExtractorHandler` 가 사용하지 않는 `options` 파라미터를 인터페이스 호환을 위해 받는 형태는 인터페이스 분리 원칙(ISP)의 경계에 걸쳐 있으나, 공통 인터페이스를 통한 duck-typing 통일이라는 기존 설계 결정을 존중한 것으로 이해된다. 인라인 options 타입 및 중복 JSDoc 블록, `delete state.pendingFormToolCall` 반복은 소규모 정리 항목이며 기능적 위험도는 낮다. 전체적으로 레이어 책임 분리와 모듈 경계가 명확히 유지되고 있으며 확장성(향후 `source` 값 추가, form bypass 이외 분기 추가)에도 유연한 구조이다.

## 위험도

LOW
