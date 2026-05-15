### 발견사항

**[INFO]** `stream()` 메서드의 함수 길이가 과도하게 김
- 위치: `google.client.ts`, `stream()` 메서드 (~165줄)
- 상세: 스트림 초기화, 청크 처리, usage 집계, finishReason 보정, fallback 조회 등 여러 단계가 단일 메서드에 인라인되어 있음. `chat()`과 구조가 다르므로 시각적 대칭이 없음
- 제안: 청크 처리 루프를 `processStreamChunks(...)`, usage fallback 조회를 `fetchAggregatedUsage(...)` 등으로 분리하면 각 단계를 독립적으로 테스트하기 쉬워짐

**[INFO]** `stream()`의 tool call ID 생성 로직이 `chat()`과 중복
- 위치: `google.client.ts` `chat()` L158, `stream()` L240–241
- 상세: `` `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` `` 패턴이 두 곳에 동일하게 존재
- 제안: `private generateToolCallId(): string` 헬퍼로 추출

**[INFO]** `startChatSession()` 반환 타입이 암시적(implicit)
- 위치: `google.client.ts` L127
- 상세: `private startChatSession(...)` 의 반환 타입이 `return model.startChat(...)` 에 의해 추론되므로 SDK 버전이 바뀌면 타입이 조용히 변경될 수 있음
- 제안: `ChatSession` 등 명시적 반환 타입 선언

**[INFO]** `safeParse`와 `asString`이 모듈 경계를 넘어 복사될 위험
- 위치: `workflow-assistant-stream.service.ts` 하단 유틸 함수
- 상세: 두 함수 모두 순수 유틸리티인데 파일 최하단에 파일 로컬로 정의됨. 향후 다른 서비스에서 비슷한 필요가 생기면 복사·붙여넣기가 발생하기 쉬움
- 제안: `src/common/utils/parse.ts` 등 공용 유틸 모듈로 이동; 현재 파일에서는 임포트해서 사용

**[INFO]** `streamMessage()` 함수가 지나치게 큼 (복잡도 높음)
- 위치: `workflow-assistant-stream.service.ts`, `streamMessage()` (~270줄)
- 상세: 세션 조회, LLM 설정, 히스토리 조립, 스트림 루프, 툴 분기(explore/plan/edit/finish), 에러 처리, DB 저장이 모두 한 메서드 안에 있음. 순환 복잡도가 매우 높아 테스트 케이스 작성이 어렵고 버그 위치 추적이 힘듦
- 제안: 최소한 `buildLlmMessages()`, `processToolCall()`, `runStreamLoop()` 정도로 세분화

**[WARNING]** `openQuestions` 배열 요소 타입 검증 없음
- 위치: `workflow-assistant-stream.service.ts`, `buildPlanFromArgs()` L446–448
- 상세: `args.openQuestions as string[]` 로 단순 캐스팅하고 있어, LLM이 배열 안에 숫자나 객체를 넣을 경우 런타임에 조용히 오염된 데이터가 DB에 저장됨. `asString`을 적용하는 다른 필드와 일관성이 없음
- 제안: `(args.openQuestions as unknown[]).filter((q): q is string => typeof q === 'string')` 으로 통일

**[INFO]** `redact.ts` 변경은 `any` 사용 제거라 양호하나, `value as unknown[]` 중간 단계 캐스팅 필요성 불명확
- 위치: `redact.ts` L17
- 상세: `Array.isArray(value)` 가 참인 경우 TypeScript는 `value`를 `T & any[]`로 좁혀주므로 `.map()` 자체는 원래도 동작함. 이전 코드가 lint 경고를 유발했기 때문에 수정한 것으로 보이며 의도는 타당함
- 제안: 변경 자체는 올바름; 추가 조치 불필요

**[INFO]** `MAX_TOOL_CALLS_PER_TURN`, `MAX_HISTORY_TURNS` 상수 위치
- 위치: `workflow-assistant-stream.service.ts` L59–60
- 상세: 모듈 상수로 파일 최상단에 선언된 것은 좋으나, 이 두 값이 조정될 때 어떤 트레이드오프를 고려해야 하는지 맥락이 없음
- 제안: 현재 기준으로는 충분하나, 추후 설정 외부화(환경변수 또는 `AssistantConfig` 엔티티)를 고려

---

### 요약

전반적으로 이번 변경은 `buildChatInputs()`·`startChatSession()` 추출, `asString()`·`safeParse()` 타입 강화, `mapGoogleFinishReason()` 순수 함수 분리 등 유지보수성을 실질적으로 개선한 리팩터링이다. 다만 `GoogleClient.stream()`과 `WorkflowAssistantStreamService.streamMessage()` 두 메서드 모두 여전히 단일 함수에 너무 많은 책임이 집중되어 있어 향후 수정 시 회귀 위험이 크다. tool call ID 생성 중복, `openQuestions` 타입 검증 누락은 작은 결함이지만 데이터 일관성이나 버그 추적 관점에서 보완할 가치가 있다.

### 위험도

**LOW**