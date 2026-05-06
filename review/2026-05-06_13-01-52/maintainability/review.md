---

## 발견사항

### **[WARNING]** `executeSingleTurn` / `processMultiTurnMessageInner` 함수 길이 및 복잡도
- **위치**: `handler.ts:403-682` (executeSingleTurn ~280라인), `handler.ts:798-1079` (processMultiTurnMessageInner ~280라인)
- **상세**: 두 함수가 config 파싱, 시스템 프롬프트 조합, 첫 LLM 호출, tool loop, 결과 조립까지 전 과정을 담고 있어 함수 하나의 책임이 과중하다. 특히 tool loop 블록(while 내부)이 단일 턴과 멀티 턴 양쪽에 거의 동일하게 존재한다.
- **제안**: tool loop 로직을 `runToolLoop(messages, tools, ...) → ChatResult` 형태의 별도 private 메서드로 추출하면 두 경로 모두 호출할 수 있어 중복이 제거되고 단위 테스트도 쉬워진다.

---

### **[WARNING]** tool loop 블록 중복
- **위치**: `handler.ts:492-623` (single_turn), `handler.ts:877-1010` (multi_turn)
- **상세**: `while (result.toolCalls?.length && toolCallCount < maxToolCalls)` 루프 본체—classification, 조건 분기, provider/condition/normal 처리, LLM 재호출, llmCalls push—가 두 실행 경로에 거의 동일하게 복제되어 있다. 향후 tool 처리 정책이 바뀌면 두 곳을 동시에 수정해야 한다.
- **제안**: 위 WARNING과 동일하게 `runToolLoop` 추출로 해결.

---

### **[WARNING]** `buildConditionOutput` vs `buildMultiTurnFinalOutput` 출력 구조 중복
- **위치**: `handler.ts:1167-1221` vs `handler.ts:1112-1162`
- **상세**: 두 메서드가 `config / output.result / meta` 객체를 거의 동일한 키 세트로 조립한다. `buildConditionOutput`은 `output.result.condition` / `port: condition.id`가 추가될 뿐 나머지는 복제다. 공통 `meta` 조립 로직을 한 곳에서만 관리하면 totalTokens 계산 등 오류가 퍼지는 것을 막을 수 있다.
- **제안**: 공통 meta 빌더 helper 함수(`buildOutputMeta`)를 추출하고 두 메서드에서 호출하도록 리팩토링.

---

### **[WARNING]** config 파싱 보일러플레이트 반복
- **위치**: `handler.ts:408-418` (executeSingleTurn), `handler.ts:689-699` (executeMultiTurn), `handler.ts:802-844` (processMultiTurnMessageInner)
- **상세**: `config.xxx as Type` 패턴이 세 함수에 걸쳐 반복된다. 특히 `llmConfigId`, `model`, `temperature`, `maxTokens`, `knowledgeBases`, `maxToolCalls`, `conditions` 등이 거의 같은 형태로 재추출된다.
- **제안**: `parseAgentConfig(config: Record<string, unknown>): AgentRunConfig` 같은 타입 변환 헬퍼를 만들어 단일 진입점에서 파싱하면 타입 단언이 한 곳으로 모인다.

---

### **[INFO]** `sanitizeToolError`의 하드코딩 숫자 200
- **위치**: `handler.ts:70`
- **상세**: `if (firstLine.length > 200)` 에서 200이 상수 없이 리터럴로 사용된다. 바로 위 `TOOL_RESULT_PREVIEW_CHARS = 200`과 우연히 같은 값이지만 의미가 다른 상수다(에러 메시지 최대 길이 vs 결과 미리보기 길이).
- **제안**: `const SANITIZED_ERROR_MAX_CHARS = 200` 상수를 별도 선언해 두 값을 명시적으로 분리.

---

### **[INFO]** `processMultiTurnMessageInner` 조건 분기 내 `condTurnDebugHistory` 지역 변수
- **위치**: `handler.ts:899-912`
- **상세**: 조건 분기(condition-only case) 내에서 `condTurnDebugHistory`를 별도 이름으로 만들지만, 일반 경로(line 1028)에서는 `turnDebugHistory`를 사용한다. 이름이 달라 코드 리더가 두 경로의 동일한 역할을 추적하기 어렵다.
- **제안**: 변수 이름을 `turnDebugHistory`로 통일하거나, 동일 로직을 루프 이전에 한 번만 생성하도록 구조 조정.

---

### **[INFO]** `RagAccumulator.fromState`의 chunkId 추출 로직 중복
- **위치**: `handler.ts:144-153` (`pushSources`) vs `handler.ts:206-212` (`fromState`)
- **상세**: `chunkId`를 `unknown` 타입 오브젝트에서 추출하는 동일한 타입 단언 패턴이 두 메서드에 반복된다.
- **제안**: `extractChunkId(item: unknown): string | undefined` 인라인 helper로 추출해 중복 제거.

---

### **[INFO]** 스펙 파일(`ai-agent.handler.spec.ts`)의 state 객체 중복
- **위치**: `spec.ts:629-649`, `spec.ts:681-701`, `spec.ts:740-756`, `spec.ts:773-793` 등
- **상세**: `processMultiTurnMessage` 테스트들이 매번 유사한 state 객체를 인라인으로 선언한다. `knowledgeBases`, `ragTopK`, `ragThreshold`, `maxToolCalls`, `maxTurns`, `workspaceId` 등이 반복된다.
- **제안**: `baseMultiTurnState` 팩토리 함수나 상수를 테스트 describe 블록 상단에 정의하고 필요한 필드만 override해 DRY하게 작성.

---

### **[INFO]** `readSingleTurnMeta` 헬퍼 함수 선언 위치
- **위치**: `spec.ts:2081-2084`
- **상세**: 파일 최하단에 선언되어 있지만 spec 중간(`it('should NOT pre-search KB...', ...)` 내부, line 151)에서 사용된다. 호이스팅되는 function 선언이므로 동작에는 문제없지만, 독자 입장에서 사용처보다 정의가 뒤에 오면 추적이 어렵다.
- **제안**: describe 블록 직전 또는 `beforeEach` 인근으로 이동.

---

## 요약

전반적으로 코드는 명확한 의도와 적절한 주석을 갖추고 있으며, `RagAccumulator`/`RagAccumulatorGroup`처럼 책임이 잘 분리된 클래스도 있다. 다만 핵심 실행 경로인 `executeSingleTurn`과 `processMultiTurnMessageInner`가 각각 280라인 가까이 되고, tool loop 블록이 두 경로에 거의 동일하게 복제되어 있어 향후 tool 처리 정책 변경 시 양쪽을 동기화해야 하는 유지보수 부채가 있다. `buildConditionOutput` / `buildMultiTurnFinalOutput`의 meta 조립 중복과 config 파싱 보일러플레이트 반복도 같은 맥락이다. 테스트는 커버리지가 넓고 의도가 명확하나, `processMultiTurnMessage` state 픽스처 반복이 많아 테스트 추가 시 복사-붙여넣기 오류 위험이 있다.

## 위험도

**MEDIUM**