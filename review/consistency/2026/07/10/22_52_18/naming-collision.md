# 신규 식별자 충돌 검토 — llm-usage-attr-hardening (impl-prep)

target: `/private/tmp/.../scratchpad/impl-prep-draft.md` (변경 (e) `ai-turn-executor.ts` `LlmCallContext` 타입 주석
+ 변경 (g) `information-extractor.handler.spec.ts` collection-retry attribution 테스트 1개 추가)

## 발견사항

0건 (CRITICAL/WARNING 없음). 아래는 검토 과정과 근거, 그리고 참고용 INFO 1건.

### [Info] `LlmCallContext` 재사용 자체는 신규 식별자 도입이 아님 — shadowing 없음 확인

- **검토 대상**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 에 named import 로
  `LlmCallContext` 추가 (`import { LlmService, LlmCallContext } from '../../../modules/llm/llm.service';`).
- **정의처**: `codebase/backend/src/modules/llm/llm.service.ts:41` — `export interface LlmCallContext { workflowId?...; executionId?...; nodeExecutionId?...; }`. 이 파일 전체에서 유일한 정의.
- **로컬 shadowing 없음**: `ai-turn-executor.ts` 전체를 grep 한 결과 `LlmCallContext` 문자열은 기존에 `:1520` 주석 1곳뿐이고(`// [Spec 7-llm-usage §1.3] LlmCallContext — ...`), 로컬 `interface`/`type`/`const LlmCallContext` 선언은 없음. 대상 라인(`:2599`)의 `const llmContext = {...}` 는 소문자 변수명이라 타입명과도 자연히 구분됨.
- **import 대상 모듈 재검토**: `../../core/node-handler.interface.ts` 의 export 목록(`TriggerExpressionData`, `TRIGGER_TRANSPORT_KEYS`, `ExecutionContext`, `ParallelBranchContext`, `ValidationResult`, `NodeHandlerOutput`, `ResumableNodeHandlerOutput`, `NodeHandler`, `ResumableMessageSource`, `ResumableMessageOptions`, `ResumableNodeHandler`, `isResumableNodeHandler`) 중 동명 심볼 없음. `../../../modules/llm/interfaces/llm-client.interface.ts` 의 export 목록(`ChatMessage`, `ToolDef`, `ToolCall`, `ChatParams`, `TokenUsage`, `ChatResult`, `ModelInfo`, `ChatStreamEvent`, `LLMClient`) 에도 동명 심볼 없음.
- **레포 전역 사용 일관성**: `LlmCallContext` 는 이미 `information-extractor.handler.ts:10,993,1885`, `text-classifier.handler.ts:200(주석)`, `ai-turn-executor.spec.ts:455(주석)` 에서 같은 module(`llm.service.ts`)로부터 동일 의미로 소비 중 — target 의 신규 import 는 기존 컨벤션을 `ai-turn-executor.ts` 의 resume 경로에 그대로 확장하는 것이며 새 의미를 도입하지 않음.
- **참고(조치 불요)**: 같은 파일에 시각적으로 유사한 이름 `LlmCallRecord` (line 63 import, 552/1496/2592 사용, 정의는 `shared/llm-tracing/llm-call-record.ts:18`) 가 이미 존재하나, 이는 target 이전부터 있던 별개 타입(호출 trace 레코드 배열 원소)이고 target 변경으로 새로 생기는 이름도 아니므로 충돌 대상 아님. 단순 명명 유사성 인지 목적으로만 기록.
- **결론**: 충돌 없음.

### [Info] 신규 IE 테스트 제목 — 기존 title 과 리터럴 중복 없음, 인접 테스트와 시나리오 유사(허용 범위)

- **검토 대상**: `information-extractor.handler.spec.ts` 의 `describe('collection retry loop')` (`:954`) 블록에 추가될 신규 `it(...)`.
- **기존 title 전수 스캔** (`grep -n "it("`): 해당 describe 블록 안 기존 4개 title —
  `:994 'feeds tool_result back and loops when finalize is called with missing required'`,
  `:1021 'routes to error port after exceeding maxCollectionRetries'`,
  `:1055 'appends a tool-role feedback message that carries missing fields'`,
  `:1091 'treats content-only responses as waiting and leaves retry count untouched'`.
  draft 가 기술한 신규 테스트 의도("collection retry 2번째 chat 의 llmContext 단언")와 문자열 그대로 중복되는 title 은 없음. 다만 `:994` 테스트가 시나리오 셋업(1차 finalizeCall 필수필드 누락 → retry → 2차 완전 응답)이 draft 의도와 동일 구조라, 신규 title 작성 시 `:994` 와 구분되는 표현(예: attribution/llmContext 를 명시)을 쓸 것을 권장 — 순수 문구 권장이며 실제 충돌은 아님.
- **fixture 오염 여부**: `beforeEach` (`:95-110`) 가 매 테스트마다 `mockLlmService = { resolveConfig: jest.fn()..., chat: jest.fn()... }` 를 새로 생성하므로 `mock.calls` 배열은 테스트 간 공유되지 않음 — 상호 오염 없음.
- **fixture id 리터럴 재사용(참고)**: 기존 `:930-933` 테스트(`processMultiTurnMessage` describe, `:921`)가 `executionId: 'exec-attr-1'`, `workflowId: 'wf-attr-1'`, `nodeExecutionId: 'nodeexec-row-1'` 를 사용. draft 가 명시한 대로 `collection retry loop` 블록의 `retryState()` 헬퍼(`:970-992`)는 `executionId`/`workflowId`/`nodeExecutionId` 필드가 기본값에 없어 신규 테스트가 이 3개 필드를 override 로 명시 주입해야 함(`handler.ts:891` 의 `state.executionId ? {...} : undefined` 분기와 일치). 각 `it` 은 독립 스코프이고 `beforeEach` 리셋도 있어 동일 리터럴(`'exec-attr-1'` 등)을 재사용해도 기능적 충돌은 없으나, 실패 시 grep 가독성을 위해 새 테스트는 `'exec-attr-2'` / `'wf-attr-2'` / `'nodeexec-row-2'` 등 구분되는 값을 쓰는 편이 좋음 — 이 역시 필수 아닌 권고.
- **결론**: 충돌 없음. 명명·fixture 값 선택에 대한 권고 2건만 기록(비차단).

## 요약

target 의 신규 식별자 도입은 사실상 (1) 이미 레포 전역에서 일관되게 쓰이는 `LlmCallContext` 타입을 `ai-turn-executor.ts` 스코프에 처음으로 named import 하는 것과 (2) 기존 `describe('collection retry loop')` 블록에 IE attribution 단언 테스트 1개를 추가하는 것으로, 두 경우 모두 실제 이름 충돌(같은 이름이 다른 의미로 이미 쓰이는 경우)은 발견되지 않았다. `ai-turn-executor.ts` 안에는 `LlmCallContext` 로컬 재정의나 import 출처 모듈의 동명 export 가 없고, 신규 테스트 title 도 대상 describe 블록의 기존 4개 title 과 문자열 중복이 없으며 `beforeEach` mock 리셋 덕분에 fixture 상호 오염 위험도 없다. 유사 이름(`LlmCallRecord`)·시나리오 유사 테스트(`:994`)·fixture 리터럴 재사용(`'exec-attr-1'` 계열) 은 실질 충돌이 아닌 가독성 권고 수준으로만 INFO 처리했다.

## 위험도

NONE

STATUS: DONE
