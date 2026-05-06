---

### 발견사항

---

**[HIGH] `endMultiTurnConversation` 공개 메서드 테스트 전무**
- 위치: `ai-agent.handler.ts:1077–1101`, `ai-agent.handler.spec.ts` 전체
- 상세: `endMultiTurnConversation`는 실행 엔진이 사용자 종료·타이머 만료 시 호출하는 엔진-facing 공개 API다. 스펙 파일에 단 한 건의 테스트도 없다. `buildMultiTurnFinalOutput`에 위임하지만 state 언팩 로직(messages 추출, lastResponse 결정, ragLastDiagnostics 전달)이 있어 독립적인 검증이 필요하다.
- 제안: `endMultiTurnConversation` describe 블록을 추가하고 `user_ended`, `error`, empty-state(messages=[])를 각각 테스트.

---

**[HIGH] `toolCallCount` 계산 비대칭: single_turn vs. multi_turn 혼합 경로**
- 위치: `ai-agent.handler.ts:570–579` (single_turn), `ai-agent.handler.ts:957–967` (multi_turn)
- 상세: condition 도구가 provider 도구와 혼합된 Case 2/3 경로에서 single_turn은 `toolCallCount++`를 하지 않고(주석: "does not count toward toolCallCount"), multi_turn은 `toolCallCount++`를 한다. `maxToolCalls`가 임박한 상황에서 동일한 설정이 두 모드에서 다른 루프 횟수를 만들 수 있다. 이 비대칭이 의도인지 버그인지 테스트로 문서화되지 않았다.
- 제안: 각 모드에서 "provider tool + condition tool 동시 호출" 케이스를 추가하고 `meta.toolCalls` 값을 명시적으로 assert.

---

**[WARNING] 조건·provider 도구 혼합(Case 2/3) 미테스트**
- 위치: `ai-agent.handler.ts:537–618`, `ai-agent.handler.ts:924–1001`
- 상세: LLM이 단일 응답에 `kb_*` 도구와 `cond_*` 도구를 동시에 반환하는 Case 2/3 경로가 single_turn과 multi_turn 모두 테스트되지 않았다. 현재 조건 관련 테스트는 condition-only(Case 1) 경로만 커버한다.
- 제안: `toolCalls: [{ name: kbToolName('kb-1') }, { name: 'cond_x' }]` 형태의 픽스처를 추가해 condition 도구가 deferral 처리되고 KB 결과 후 LLM이 다시 호출되는 시퀀스를 테스트.

---

**[WARNING] `maxTurns=0` (무제한) 경계값 미테스트**
- 위치: `ai-agent.handler.ts:1021`: `const isLastTurn = maxTurns > 0 && turnCount >= maxTurns`
- 상세: `maxTurns=0`이면 항상 `isLastTurn=false`여야 한다는 동작이 테스트되지 않았다. 실수로 이 조건식이 변경되면 무제한 대화가 즉시 종료된다.
- 제안: `maxTurns: 0`으로 `processMultiTurnMessage` 호출 후 결과가 `status: 'waiting_for_input'`임을 assert.

---

**[WARNING] `llmService.chat` 예외 전파 경로 미테스트**
- 위치: `ai-agent.handler.ts:471`, `ai-agent.handler.ts:855`
- 상세: provider(`ragService.search`) 예외는 `runProviderTool`이 포착해 LLM 에 오류 컨텍스트를 전달하는 테스트가 있다(line 1775). 그러나 `llmService.chat` 자체가 throw 하는 경우(네트워크 오류, 타임아웃)는 핸들러가 잡지 않고 상위로 전파되는데, 이 경로를 확인하는 테스트가 없다.
- 제안: `mockLlmService.chat.mockRejectedValueOnce(new Error('LLM timeout'))` 픽스처로 execute()가 reject 되는지, cleanupProviders가 finally에서 여전히 호출되는지 확인.

---

**[WARNING] `conversationHistory` / `historyCount` 스키마 필드 핸들러 미사용 — 테스트 없음**
- 위치: `ai-agent.schema.ts:280–308`, `ai-agent.handler.ts` 전체
- 상세: 스키마에 `conversationHistory`와 `historyCount`가 정의되어 있으나 핸들러가 이 값을 전혀 읽지 않는다. dead field이지만 테스트가 없어 향후 구현 시 회귀를 잡기 어렵다.
- 제안: `conversationHistory: 'last_n', historyCount: 3`을 설정해도 현재 동작이 변하지 않음을 문서화하는 테스트(또는 TODO 주석) 추가. 또는 스펙 없는 필드라면 스키마에서 제거.

---

**[INFO] `readSingleTurnMeta` 헬퍼 위치 비표준**
- 위치: `ai-agent.handler.spec.ts:1975–1978`
- 상세: 헬퍼가 `describe` 블록 바깥 파일 맨 끝에 정의되어 있어 테스트 내부에서 참조하는 패턴이 파일 위-아래를 오가게 된다. 더욱이 line 151에서 `readSingleTurnMeta(handler)`를 호출해 결과 함수를 즉시 실행하는 커링 패턴이 직관적이지 않다.
- 제안: 헬퍼를 `describe('AiAgentHandler')` 블록 상단으로 이동하거나, 단순 인라인 추출로 교체.

---

**[INFO] `processMultiTurnMessage` 상태 객체 반복 인라인 구성**
- 위치: `ai-agent.handler.spec.ts:587–608, 639–660, 695–716` 등
- 상세: multi_turn 테스트마다 동일한 state 구조를 수동으로 구성한다. state 필드가 추가되면 모든 테스트를 일일이 수정해야 한다.
- 제안: `describe` 블록 상단에 `baseMultiTurnState` 픽스처를 선언하고 개별 테스트에서 스프레드(`{ ...baseMultiTurnState, maxTurns: 2 }`)로 오버라이드.

---

**[INFO] `sanitizeToolError` / `previewContent` 단위 테스트 없음**
- 위치: `ai-agent.handler.ts:52–72`
- 상세: 두 모듈 수준 함수가 private이라 직접 호출은 불가하나, WS 이벤트 payload의 `content` 길이를 assert하거나 200자 초과 에러 메시지가 잘리는지를 통합 경로로 검증할 수 있다. 현재는 이 경계값이 테스트되지 않았다.
- 제안: `mockRagService.search`가 300자 content를 반환하는 픽스처를 추가하고 `tool_call_completed` 이벤트의 `content`가 200자 + `'...'`인지 확인.

---

### 요약

테스트 스위트는 전반적으로 매우 높은 수준이다. single_turn과 multi_turn의 핵심 흐름(KB tool 호출, 병렬 검색, maxToolCalls 상한, 중복 ragSources 제거, condition 라우팅, WS 텔레메트리, 오류 복구)이 충실히 커버되고 `beforeEach`로 모든 mock이 격리된다. 단, 엔진이 직접 호출하는 `endMultiTurnConversation` 공개 메서드가 테스트되지 않은 점과 single_turn/multi_turn 간의 `toolCallCount` 계산 비대칭이 의도인지 버그인지 불명확한 점이 주요 위험 요소다. 나머지 갭(maxTurns=0, 혼합 도구 경로, LLM 오류 전파)은 방어 커버리지를 보강하면 회귀 안전망을 완성할 수 있는 수준이다.

### 위험도

**MEDIUM**