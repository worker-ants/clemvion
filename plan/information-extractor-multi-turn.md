# Information Extractor 노드에 Single Turn / Multi Turn 모드 추가 + Output Schema required 토글 노출

## Context

현재 `Information Extractor` 노드(`backend/src/modules/execution-engine/handlers/ai/information-extractor.handler.ts`)는 **단일 LLM 호출로 한 번에 전체 스키마를 추출**하는 single-turn 방식만 지원한다. 실무 시나리오에서는 입력이 불완전하거나 애매한 경우가 많아, **부족한 필드를 사용자에게 되물어 채워 나가는 multi-turn 대화형 추출**이 필요하다.

또한 현재 UI(`frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx:286-368`)는 출력 필드의 `required` 여부를 UX에 노출하지 않고 있어서 사용자가 필수/옵션 필드를 구분할 수 없다. 백엔드 `OutputField` 타입(line 8-14)과 `validate`/`execute` 로직은 `required`를 이미 읽고 있으므로 UI만 추가하면 된다. Multi turn 모드에서는 "required 필드가 모두 채워질 때까지 되묻기"를 종료 조건으로 삼으므로 이 필드 구분이 특히 중요하다.

AI Agent 노드가 이미 동일 모드 분기를 갖추고 있고(handler: `ai-agent.handler.ts:111-122`, engine: `execution-engine.service.ts:1209~` `waitForAiConversation`), 엔진의 Pause/Resume 인프라는 `interactionType: 'ai_conversation'` 기준으로 **노드 종류에 무관하게** 동작하도록 설계되어 있다. Information Extractor도 동일한 인프라를 재사용하여 구현한다.

## 요구사항

### 1. Single Turn / Multi Turn 모드
- **Single Turn (기본)**: 현재 동작 유지. 한 번의 LLM 호출로 스키마 전체 추출.
- **Multi Turn**:
  - 초기 `inputField` 값을 첫 user 메시지로 LLM에 전달.
  - LLM이 JSON 응답에 **현재까지 추출한 필드 값 + 부족한 필드를 묻는 follow-up question**을 함께 담아 반환하도록 프롬프트.
  - 모든 `required: true` 필드가 채워졌으면 종료하고 최종 JSON 출력.
  - 아직 비었으면 `interactionType: 'ai_conversation'`으로 `waiting_for_input` 진입 → 사용자 응답 후 다음 턴.
  - `maxTurns` 도달 또는 사용자 `end_conversation` 시 partial 결과를 `endReason`과 함께 반환.

### 2. Config 신규 필드 (백엔드/프론트 공통)
- `mode`: `'single_turn' | 'multi_turn'` (기본 `'single_turn'`)
- `maxTurns`: number, 0 = unlimited (기본 10)
- `turnTimeout`: seconds (기본 1800)

### 3. Output Schema에 required 토글 노출
- 각 필드 카드에 `Required` 체크박스 추가.
- 체크 해제 시 `required: false`로 저장 → optional 필드가 됨.
- UI에 `(required)` / `(optional)` 라벨이 시각적으로 구분되도록 표기.

## 설계

### 백엔드

#### A. 핸들러 리팩토링
**파일**: `backend/src/modules/execution-engine/handlers/ai/information-extractor.handler.ts`

1. 기존 `execute()` 구현을 `executeSingleTurn()`으로 이름 변경.
2. 새 `execute()`는 `config.mode` 분기:
   ```ts
   if (mode === 'multi_turn') return this.executeMultiTurn(input, config, context);
   return this.executeSingleTurn(input, config, context);
   ```
3. `validate()` 확장:
   - `mode === 'multi_turn'`일 때 `maxTurns >= 0`, `turnTimeout > 0` 검증.
   - `outputSchema`에 `required: true`가 하나도 없으면 multi_turn은 경고(일단은 validate 통과시키고, LLM 프롬프트에서 "모든 필드가 optional이면 처음 턴에 완료"로 처리).

#### B. `executeMultiTurn`
AI Agent의 `executeMultiTurn`(ai-agent.handler.ts:296~)을 참고.

1. System prompt를 확장: 기존 schemaDesc + 다음 지시 추가:
   ```
   If any `required` fields are missing or ambiguous, also include:
   - "_missingFields": string[] of field names still needed
   - "_followUpQuestion": one natural-language question to ask the user
   Otherwise set both to empty/empty-string.
   ```
2. JSON schema의 `properties`에 `_missingFields`, `_followUpQuestion` 추가(둘 다 optional, LLM이 항상 생성하도록 schema에 포함).
3. `inputField` 값을 user 메시지로 넣고 첫 LLM 호출.
4. 파싱한 결과에서 required 필드의 값이 `null/undefined`가 아닌 것을 누적(`partialResult`).
5. 종료 판정:
   - `requiredFields.every(f => partialResult[f] != null)` → 최종 출력 반환.
6. 미종료 시 `waiting_for_input` 반환:
   ```ts
   return {
     type: 'ai_conversation',
     status: 'waiting_for_input',
     interactionType: 'ai_conversation',
     conversationConfig: {
       message: followUpQuestion,
       messages,               // ChatMessage[] 지금까지 대화
       turnCount: 1,
       maxTurns,
       turnTimeout,
     },
     _multiTurnState: {
       llmConfigId, model, workspaceId,
       outputSchema, instructions, examples,
       messages,
       partialResult,
       turnCount: 1, maxTurns, turnTimeout,
       totalInputTokens, totalOutputTokens,
     },
   };
   ```

#### C. `processMultiTurnMessage(userMessage, state)`
엔진 `waitForAiConversation`가 사용자 메시지 수신 시 호출.

1. `state.messages`에 user 응답 append.
2. 동일 확장 JSON schema로 LLM 재호출.
3. 결과를 `partialResult`에 머지(LLM이 null 반환한 필드는 기존 값 유지).
4. 종료 조건 확인(모든 required 채움 or `turnCount + 1 >= maxTurns`).
5. 종료 시 `buildMultiTurnFinalOutput` 반환, 아니면 갱신된 `_multiTurnState`로 다시 `waiting_for_input`.

#### D. `buildMultiTurnFinalOutput(state, endReason)`
`endReason`: `'completed' | 'max_turns' | 'user_ended' | 'timeout'`.

출력 shape(AI Agent와 호환되게 맞춤 — `parseHistoryMessages` 재사용 위함):
```ts
{
  config: { schema: state.outputSchema, mode: 'multi_turn' },
  output: {
    ...state.partialResult,
    _messages: state.messages,
    _endReason: endReason,
    _turnCount: state.turnCount,
  },
  meta: {
    model, inputTokens: state.totalInputTokens, outputTokens: state.totalOutputTokens,
    totalTokens, interactionType: 'ai_conversation',
  },
}
```

#### E. 엔진 통합
**파일**: `backend/src/modules/execution-engine/execution-engine.service.ts` — **변경 없음**.

- `waitForAiConversation`는 `handler.processMultiTurnMessage(...)` / `handler.buildMultiTurnFinalOutput(...)`를 handler-agnostic하게 호출한다.
- `execute` 반환에 `interactionType: 'ai_conversation'`만 포함하면 dispatch 로직(`execution-engine.service.ts:490-496`, `861-866`)이 자동으로 대기 경로로 라우팅.

**확인 필요**: `handlers/node-handler.interface.ts`의 `NodeHandler`에 `processMultiTurnMessage` / `buildMultiTurnFinalOutput`가 optional로 선언되어 있는지. AI Agent가 구현하고 있으므로 이미 선언되어 있을 가능성이 높지만, duck-typed라면 타입 선언만 추가.

### 프론트엔드

#### A. Config UI — Mode 토글 + Multi Turn 섹션
**파일**: `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (`InformationExtractorConfig`, 286-368)

`AiAgentConfig`(62-209) 패턴을 모방:
- 최상단에 `Mode` SelectField 추가(`single_turn` / `multi_turn`).
- `mode === 'multi_turn'`일 때만 `Multi Turn Settings` 섹션 노출:
  - `Max Turns` NumberField (기본 10, 0=unlimited)
  - `Turn Timeout (sec)` NumberField (기본 1800)

#### B. Config UI — Output Schema Required 토글
**파일**: 동일 파일.

- 현재 `outputSchema` 타입 선언은 이미 `required: boolean`을 포함하고 있고(288번 라인), `addField`는 `required: true` 기본값으로 추가됨(293번 라인). UI에만 토글 추가하면 된다.
- 각 필드 카드(330-361) 내에 `CheckboxField` 추가:
  ```tsx
  <CheckboxField
    label="Required"
    checked={field.required !== false}
    onChange={(v) => updateField(i, "required", v)}
  />
  ```
- `Field N` 라벨 옆에 `required ? '(required)' : '(optional)'` 배지 또는 텍스트 표시(가독성용).
- `CheckboxField`는 같은 파일 `TextClassifierConfig`(253번 라인 `includeConfidence`)에서 이미 사용 중이므로 import/재사용 그대로.

#### C. 실행 UI
**변경 불필요.** `ConversationInspector`, `pauseForConversation`/`resumeFromConversation`/`addConversationMessage`(`execution-store.ts:234-246`), `use-execution-events.ts`의 `execution.ai_message`/`execution.waiting_for_input` 핸들러 모두 노드 타입에 무관하게 `interactionType: 'ai_conversation'` 기준으로 동작. 동일 `conversationConfig`/`_messages` shape 유지하면 그대로 렌더.

#### D. 노드 정의
**파일**: `frontend/src/lib/node-definitions/index.ts`

- Information Extractor의 기본 config(`defaultConfig` 또는 상응 필드)에 `mode: 'single_turn'`, `maxTurns: 10`, `turnTimeout: 1800` 추가.
- `outputSchema`의 예시 필드에도 `required: true`/`false`를 혼합하여 샘플 제공(선택).

### Spec 문서

**파일**: `spec/4-nodes/3-ai-nodes.md` (497번 라인~ Information Extractor 섹션)

1. `config` 테이블에 `mode`, `maxTurns`, `turnTimeout` 3개 필드 추가.
2. FieldDef 테이블의 `required`, `enumValues`는 이미 명시되어 있으나, UI 그림에서도 `✅ Required` / `☐ Optional` 구분이 실제 체크박스임을 명기.
3. "Multi Turn 동작" 하위 섹션 신규 작성:
   - LLM 응답 JSON schema 확장(`_missingFields`, `_followUpQuestion`).
   - 턴 진행/종료 규칙.
   - 최종 output shape(`_messages`, `_endReason`, `_turnCount`).
   - UI 흐름(ConversationInspector 재사용).

## 주요 수정 파일

### 변경
- `backend/src/modules/execution-engine/handlers/ai/information-extractor.handler.ts` — `executeSingleTurn` 분리 + `executeMultiTurn` / `processMultiTurnMessage` / `buildMultiTurnFinalOutput` 추가
- `backend/src/modules/execution-engine/handlers/ai/information-extractor.handler.spec.ts` — multi-turn + required/optional 분기 테스트 추가
- `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` — `InformationExtractorConfig`에 Mode 토글, Multi Turn Settings, Required 체크박스 추가
- `spec/4-nodes/3-ai-nodes.md` — Information Extractor 섹션 갱신

### 확인 후 필요 시 수정
- `backend/src/modules/execution-engine/handlers/node-handler.interface.ts` — multi-turn 메서드 optional 시그니처
- `frontend/src/lib/node-definitions/index.ts` — 기본 config 값

## 재사용하는 기존 코드

- **엔진 대기/재개 루프**: `execution-engine.service.ts:1209~` `waitForAiConversation`
- **WS 이벤트**: `execution.waiting_for_input`, `execution.ai_message`, `execution.resumed`
- **프론트 상태 전이**: `pauseForConversation`, `resumeFromConversation`, `addConversationMessage` (`execution-store.ts:234-246`)
- **대화 렌더링**: `ConversationInspector`, `MessageInput`, `parseHistoryMessages`
- **WS 이벤트 처리**: `use-execution-events.ts`의 `execution.ai_message` 브랜치
- **CheckboxField**: 동일 파일 `TextClassifierConfig`에서 사용 중

## 검증

### Unit Test (backend)
`information-extractor.handler.spec.ts`에 추가:
1. `mode: 'multi_turn'` + 초기 입력으로 모든 required 필드 충족 → 첫 턴에 완료(최종 shape 반환).
2. 초기 입력 불완전 → `status: 'waiting_for_input'` + `conversationConfig.message` + `_multiTurnState` 보존.
3. `processMultiTurnMessage`로 사용자 응답 주입 → 누락 필드가 채워지면 최종 JSON 반환.
4. optional 필드는 비어있어도 종료 조건 충족.
5. required 필드가 null이면 follow-up question 생성.
6. `maxTurns` 도달 시 `endReason: 'max_turns'`로 partial 결과 반환.
7. Validate: `mode: 'multi_turn'` + `maxTurns < 0` → error.

### Unit Test (frontend)
`node-configs` 관련 테스트가 있다면 `InformationExtractorConfig` 토글 동작 케이스 추가(없으면 E2E로 대체).

### 수동 E2E
1. 에디터에서 Information Extractor 노드 배치, Output Schema에 필드 3개(2 required, 1 optional) 구성.
2. Required 체크박스 토글이 저장되는지 확인.
3. Mode를 Multi Turn으로 변경 후 workflow 실행.
4. 불완전한 입력 → Run Results 드로어에 `ConversationInspector`가 렌더되고 follow-up 질문이 표시되는지 확인.
5. 사용자 응답 → 다음 턴에서 partial 결과 누적.
6. Required 필드 모두 채워짐 → workflow 재개, 다음 노드로 연결.
7. Max Turns 도달 시 partial 결과로 종료.

### TEST WORKFLOW
- backend: `npm run lint` → `npx jest src/modules/execution-engine/handlers/ai/information-extractor.handler.spec.ts` → 전체 테스트 → `npm run build`
- frontend: `npm run lint` → `npx vitest run` → `npm run build`

### REVIEW WORKFLOW
- `ai-review` 스킬 실행 후 이슈 해결.

## 단계별 진행 순서 (SDD/TDD)

1. **Spec 갱신** — `spec/4-nodes/3-ai-nodes.md`에 동작과 config 명문화.
2. **Handler 테스트 먼저 작성** — `.spec.ts`에 위 7개 케이스 추가(실패 상태로 시작).
3. **Handler 구현** — `executeSingleTurn` 분리, `executeMultiTurn` / `processMultiTurnMessage` / `buildMultiTurnFinalOutput`.
4. **Handler 테스트 통과 확인** + lint/build.
5. **Frontend Config UI**
   - Output Schema의 Required 체크박스 추가(독립 변경, 먼저).
   - Mode 토글 + Multi Turn Settings 섹션 추가.
6. **E2E 수동 검증**.
7. **TEST WORKFLOW** (backend + frontend).
8. **REVIEW WORKFLOW** → RESOLUTION.md 작성.
