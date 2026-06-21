# 유지보수성(Maintainability) 리뷰

리뷰 대상: `ai-turn-executor.ts` (신설, 2911줄), `ai-agent.handler.ts` (2999→219줄 축소), `ai-turn-executor.spec.ts` (273줄)

---

## 발견사항

### [WARNING] `processMultiTurnMessage` 함수가 단일 책임을 초과 (함수 길이 / 복잡도)
- 위치: `ai-turn-executor.ts`, `processMultiTurnMessage` (약 750줄, diff 기준 2127~2882 라인)
- 상세: 이 메서드는 form_submit 파싱 · bypass · 정상 user push · 자동메모리 재주입 · 물리 압축 · LLM 호출 · tool 루프(condition / provider / normal 3분기) · render_form blocking · 누적 토큰 · waiting/ended 분기 · pendingFormBlock 분기 · _resumeState 조립까지 단일 메서드 안에 수행한다. 순환 복잡도가 매우 높아 변경 시 회귀 추적이 어렵다.
- 제안: 최소한 아래 세 단위로 추출 고려.
  (1) `_resolveFormInteraction` — form_submitted / bypass / normal user push 3분기를 캡슐화.
  (2) `_runToolLoop` — while 루프·condition/provider/normal 처리·render_form break를 격리.
  (3) `_buildResumeStatePayload` — _resumeState/output/meta 조립을 분리.
  현재 동형 1·2단계(AiConditionEvaluator·AiMemoryManager)가 이미 유사 패턴을 보여주므로, 동일 방향으로 세분화 가능.

---

### [WARNING] `executeSingleTurn`과 `processMultiTurnMessage`의 tool 루프가 대규모 중복
- 위치: `ai-turn-executor.ts`, `executeSingleTurn` (1369~1911) 및 `processMultiTurnMessage` (2449~2687)
- 상세: condition-only 분기 · provider tool 배치 실행 · normal tool budget 처리 · `isToolTurnsEnabled` 확인 · `pushAiThreadTurn` 호출 패턴이 두 메서드에서 거의 동일하게 반복된다. `executeProviderToolBatch` 추출로 provider 배치는 단일화했지만 condition/normal 분기는 두 곳에 그대로 남아 있다. 변경 시 두 곳을 동시에 수정해야 하는 coupling이 남아 있다.
- 제안: condition-tool deferral 처리와 normal-tool budget 처리를 `_processNonProviderToolCalls(classification, messages, toolCallCount, config, state?, context?)` 형태의 공유 헬퍼로 추출. single-turn 경로는 `context`를 직접 넘기고, multi-turn 경로는 `state`로부터 파생한 같은 인터페이스를 사용하면 중복 제거 가능.

---

### [WARNING] `MAX_TURN_DEBUG_HISTORY` 상수가 메서드 내부에 인라인 선언
- 위치: `ai-turn-executor.ts`, `processMultiTurnMessage` 내부 (diff line 2741)
- 상세: `const MAX_TURN_DEBUG_HISTORY = 50;`이 함수 본문 안에 선언되어 있다. 동일 파일 최상단의 `MAX_RESUME_RAG_SOURCES = 200`이나 `DEFAULT_RETRY_STATE_TTL_MINUTES = 60`과 같이 모듈 레벨 상수로 정의되어야 한다. 현재 상태는 해당 값이 상수임을 인식하기 어렵고, 테스트나 오버라이드 시 찾기 힘들다.
- 제안: 파일 상단 상수 블록으로 이동. `const MAX_TURN_DEBUG_HISTORY = 50;` (JSDoc 포함).

---

### [WARNING] `sanitizeToolError` 내 하드코딩 숫자 `200`이 `TOOL_RESULT_PREVIEW_CHARS`와 동일 의미를 공유하나 별도 상수 없음
- 위치: `ai-turn-executor.ts`, `sanitizeToolError` 함수 (diff line 541)
- 상세: `if (firstLine.length > 200) return firstLine.slice(0, 200) + '...';`의 `200`은 `TOOL_RESULT_PREVIEW_CHARS`와 수치가 같지만 별개의 개념(error message truncation cap)이다. 현재는 두 값이 우연히 같아 혼동을 유발한다. 독립적인 명명 상수가 없어 나중에 하나만 바꾸면 의도치 않은 동작 차이가 생긴다.
- 제안: `const TOOL_ERROR_MESSAGE_MAX_CHARS = 200;`으로 분리하고, `capFormDataBytes` 내 `256B = JSON 구조 overhead` 주석 옆의 인라인 `256`도 `FORM_JSON_OVERHEAD_BYTES` 등 별도 상수로 추출.

---

### [INFO] `buildMultiTurnFinalOutput`의 파라미터 수가 9개로 과다 (함수 시그니처 복잡도)
- 위치: `ai-turn-executor.ts`, `buildMultiTurnFinalOutput` (diff line 2935)
- 상세: 공개 메서드임에도 positional argument가 9개이다. `endMultiTurnConversation`에서 호출 시 인수 순서 실수가 발생할 위험이 있고, 테스트에서 특정 인수만 바꾸고 싶을 때 전체 시그니처를 파악해야 한다. `buildConditionOutput`도 7개 positional 파라미터를 가지고 있어 같은 패턴 반복.
- 제안: `turnDebug` / `turnDebugHistory` / `rawConfig` / `errorPayload` / `retryStateSource` / `failedUserMessage` / `failedUserMessageSource` 를 단일 options 객체(`BuildFinalOutputOptions`)로 묶으면 호출부 가독성이 향상되고 향후 필드 추가도 용이.

---

### [INFO] `isToolTurnsEnabled`가 `processMultiTurnMessage` 안에서 반복 호출 시 매번 `state.rawConfig` 캐스팅
- 위치: `ai-turn-executor.ts`, `processMultiTurnMessage` (diff line 2543~2656)
- 상세: `this.isToolTurnsEnabled(state.rawConfig as Record<string, unknown> | undefined)`가 tool 루프 내 3곳 이상에서 반복된다. 루프 진입 전 `const toolTurnsEnabled = this.isToolTurnsEnabled(...)` 로컬 변수에 한 번만 평가하는 패턴이 더 명확하다.
- 제안: 루프 진입 전 단일 평가 후 로컬 변수 재사용. `executeSingleTurn`에서 `config`를 직접 넘기는 방식과 대칭이 되어 일관성도 확보.

---

### [INFO] `buildRetryState` 와 `multiTurnPortForEndReason` 의 JSDoc 블록 순서가 뒤집혀 있음 (가독성 / 일관성)
- 위치: `ai-turn-executor.ts`, diff line 3076~3169
- 상세: `multiTurnPortForEndReason` 선언 앞에 `buildRetryState`의 JSDoc 블록이 달려 있다. 즉 JSDoc이 설명하는 메서드(`buildRetryState`)가 아닌 다음 메서드(`multiTurnPortForEndReason`) 위에 위치한다. 파서는 바로 아래 선언에 JSDoc을 귀속시키므로, IDE hover / 자동 문서 생성 시 엉뚱한 메서드에 문서가 붙는다.
- 제안: `multiTurnPortForEndReason` JSDoc 블록을 해당 메서드 바로 위로 이동시키고, `buildRetryState` JSDoc은 `buildRetryState` 선언 위에만 두도록 정리.

---

### [INFO] `capFormDataBytes`가 `export` 공개이면서 테스트 파일(`ai-turn-executor.spec.ts`)에서 직접 테스트되지 않음
- 위치: `ai-turn-executor.ts` `capFormDataBytes` (export), `ai-turn-executor.spec.ts`
- 상세: `FORM_SUBMITTED_MAX_BYTES`, `FORM_SUBMITTED_GUIDANCE_MESSAGE`, `capFormDataBytes` 세 심볼이 `export`로 공개되어 있다. `capFormDataBytes`는 byte-level truncation 로직이 복잡하지만 신규 spec 파일에 테스트가 없다. (기존 handler spec에 간접 커버가 있을 수 있으나 직접 단위 테스트 부재.)
- 제안: `describe('capFormDataBytes', ...)` 블록을 `ai-turn-executor.spec.ts`에 추가하거나, 별도 `cap-form-data.spec.ts`로 분리. 특히 bytes-vs-chars 경계, 비-string 필드 보존, `formDataTruncation` 메타 존재 여부를 경계값 테스트로 고정.

---

### [INFO] `processMultiTurnMessage` 내 `state` 객체를 직접 `delete state.pendingFormToolCall`로 변이
- 위치: `ai-turn-executor.ts`, diff line 2241, 2266
- 상세: `state`는 caller가 넘겨준 객체인데 `delete state.pendingFormToolCall`로 직접 변이한다. 이는 암묵적 side-effect이며, 함수 시그니처(`state: Record<string, unknown>`)만 보면 변이가 일어남을 알 수 없다. 특히 재시도 시나리오에서 같은 state 객체를 재사용하면 pendingFormToolCall이 이미 지워져 있을 수 있다.
- 제안: `state`를 변이하는 대신 반환할 `_resumeState` 조립 시 해당 키를 생략하는 방식을 채택하거나, 파라미터 이름을 `mutableState`로 바꾸고 JSDoc에 변이 사실을 명시.

---

## 요약

`AiTurnExecutor`는 god-handler 분할의 최종 단계로서 핸들러 2999줄을 219줄 facade로 축소한 설계적 성과가 명확하다. 상수 명명·JSDoc·graceful degrade 패턴·단방향 의존 방향은 전반적으로 잘 유지되어 있다. 주요 유지보수성 위험은 두 가지로 압축된다: (1) `processMultiTurnMessage`가 750줄에 걸쳐 form 분기·메모리·tool 루프·상태 조립을 모두 담고 있어 단일 함수 순환 복잡도가 과도하고, (2) condition/normal tool 처리 블록이 `executeSingleTurn`과 `processMultiTurnMessage` 두 곳에 대칭 중복되어 향후 spec 변경 시 두 경로를 동시에 수정해야 하는 부담이 존재한다. 이 두 항목은 다음 리팩터 단계(M-1 후속 또는 M-2)에서 헬퍼 추출로 해소 가능하다. 나머지 항목들(`MAX_TURN_DEBUG_HISTORY` 인라인 상수, JSDoc 순서 오류, `state` 직접 변이)은 낮은 위험도지만 장기 가독성에 영향을 미친다.

## 위험도

MEDIUM
