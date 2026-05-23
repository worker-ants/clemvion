# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] ResumableNodeHandler.processMultiTurnMessage 인터페이스 시그니처 확장 — 하위 호환 설계 적절
- 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ResumableNodeHandler` 인터페이스, `options?: { source: ResumableMessageSource }` 추가
- 상세: `options` 파라미터를 optional (`?`) 로 선언하고 엔진 측 `waitForAiConversation` 의 내부 `processMultiTurnMessage` 호출에서 기본값 `'ai_message'` 를 default parameter 로 처리한다. 기존 호출자 (options 미전달) 는 동일 경로로 진행한다. 하위 호환 테스트 케이스("options 미전달 + pendingFormToolCall 없음 → 정상 ai_user 경로")가 명시적으로 포함되어 있어 계약 유지가 확인된다.
- 제안: 현행 설계 유지. 향후 인터페이스에 새 파라미터를 추가할 때도 동일한 optional + default 패턴을 유지한다.

### [INFO] InformationExtractorHandler 인터페이스 구현체 — source 무시 선언 일관성
- 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` L474
- 상세: `information_extractor` 는 `render_form` 을 발행하지 않으므로 `_options` 로 명시적 무시 처리한다. 인터페이스 계약(ResumableNodeHandler)을 만족하면서 동작 의도를 JSDoc 으로 명확히 설명하고 있다. 다른 ResumableNodeHandler 구현체가 추가될 경우에도 동일한 무시 패턴을 따를 수 있는 선례를 제공한다.
- 제안: 현행 유지. 새 ResumableNodeHandler 구현체 추가 시 해당 핸들러가 render_form 비발행 핸들러라면 동일하게 `_options` 패턴 적용.

### [INFO] tool_result cancelled 페이로드 스키마 — 비공개 내부 계약이나 형식 일관성 확인 필요
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L656–663
- 상세: cancelled tool_result 의 JSON 구조가 `{ type: 'cancelled', reason: 'user_sent_message_instead' }` 로 고정되어 있다. 이 페이로드는 LLM(Anthropic/OpenAI) API 에 tool_result 로 전달되는 데이터다. 현재 변경은 `form_submitted` 경로의 기존 `{ type: 'form_submitted', data: ... }` 형태와 병렬 구조를 이루며 일관성이 있다. 별도의 공개 API 스키마 문서는 존재하지 않으나 내부 계약상 형식이 일관하다.
- 제안: spec (1-ai-agent.md §6.2 step 2.c.bypass) 에 해당 cancelled 페이로드 스키마를 명시적으로 기록해 두면 향후 LLM 프로바이더 변경 시 참조 용이.

### [INFO] engine.waitForAiConversation source 전달 경로 — 타입 안전성 확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L2056, L2079
- 상세: `waitForAiConversation` 내부에서 `'ai_message'` / `'form_submitted'` 리터럴 스트링을 직접 전달한다. `ResumableMessageSource` 타입이 `node-handler.interface.ts` 에 export 되어 있고 해당 파일에서 import 하여 사용하므로 타입 불일치 위험은 없다. 단, engine service 에서 source 를 positional argument 로 넘기는 방식 (4번째 인자)과 handler 에서 options 객체로 받는 방식 사이의 래핑은 `waitForAiConversation` 내부 `processMultiTurnMessage` 호출부 (`{ source }`)에서 명확히 처리된다.
- 제안: 현행 유지.

## 요약

이번 변경은 `ResumableNodeHandler.processMultiTurnMessage` 인터페이스에 optional `options.source` 파라미터를 추가하는 내부 API 확장이다. 변경은 public HTTP API 가 아닌 백엔드 내부 핸들러 인터페이스(노드 실행 엔진과 핸들러 사이의 계약)에 국한된다. `options` 를 optional + default 값 처리로 설계하여 기존 호출자의 하위 호환성을 보장하며, 단위 테스트에서 options 미전달 케이스를 명시적으로 검증한다. `InformationExtractorHandler` 의 인터페이스 구현 일관성도 `_options` 무시 패턴으로 올바르게 유지된다. cancelled tool_result 페이로드(`{ type: 'cancelled', reason: 'user_sent_message_instead' }`)는 LLM 프로바이더에 전달되는 내부 페이로드로, `form_submitted` 분기와 병렬한 일관된 구조를 갖는다. 외부 공개 HTTP API 엔드포인트에 대한 변경은 포함되지 않으며, 전체적으로 API 계약 관점에서 위험 요소가 없다.

## 위험도

NONE
