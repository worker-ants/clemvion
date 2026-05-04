### 발견사항

- **[WARNING]** `waiting_for_input` 분기의 WebSocket 페이로드 shape 파괴적 변경
  - 위치: `execution-engine.service.ts`, diff 기준 `-requestPayload: resumeState.lastTurnRequest` / `-responsePayload: resumeState.lastTurnResponse` 라인
  - 상세: `requestPayload`, `responsePayload` 두 필드가 제거되고 `llmCalls[]`로 대체됐다. `execution.ai_message`를 수신하는 기존 프론트엔드 소비자가 이 두 필드를 참조하고 있다면 런타임에 조용히 깨진다. spec은 갱신됐지만 클라이언트 호환성 마이그레이션 경로가 문서화되지 않았다.
  - 제안: 프론트엔드 소비 코드에서 `requestPayload`·`responsePayload` 참조를 그렙하고 실제 사용 여부를 확인한 뒤, 필요하면 `llmCalls[0]`으로의 전환 가이드를 spec에 명시하라.

- **[WARNING]** terminal emit 분기와의 대칭 여부를 diff에서 검증 불가
  - 위치: `execution-engine.service.ts`, 주석 `// Shape mirrors the terminal-emit branch below`
  - 상세: 이번 diff는 `waiting_for_input` 분기만 수정한다. "아래의 terminal emit 분기도 동일 shape" 라고 주석에 명시했지만 terminal 분기 코드는 diff 범위 밖이다. 두 분기가 실제로 같은 helper를 쓰지 않으면 주석이 거짓이 되고, 프론트엔드 디버그 타임라인 매칭이 깨진다.
  - 제안: terminal emit 분기도 `buildAiMessageDebugFromResumeState(resumeState)`로 이미 교체돼 있는지 코드 리뷰에서 명시적으로 확인하라. 만약 아직이라면 이번 PR에 포함시켜 "두 분기 동일 shape" 보장을 코드 레벨에서 실증하라.

- **[WARNING]** `resumeState` 타입이 `Record<string, unknown>`으로 erasure됨
  - 위치: `buildAiMessageDebugFromResumeState` 및 `buildConversationMetaFromResumeState` 시그니처
  - 상세: 두 helper 모두 내부 도메인 객체인 resumeState를 `Record<string, unknown>`으로 받아 `as unknown[] | undefined` 등의 unsafe cast를 반복한다. `turnDebugHistory[].llmCalls`, `turnDebugHistory[].totalDurationMs` 필드명이 바뀌어도 컴파일러가 잡지 못한다. 기존 패턴을 따른 것이지만 신규 helper 추가 시점이 타입 정의를 도입하기 좋은 기회였다.
  - 제안: `ResumeState` 인터페이스(또는 Zod schema)를 정의하고 두 함수의 입력 타입으로 교체하라. 최소한 `TurnDebugEntry { llmCalls?: LlmCallRecord[]; totalDurationMs: number }` 수준의 명시적 타입이면 cast를 제거할 수 있다.

- **[INFO]** 유틸리티 함수 세 개(`buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`, `buildConversationConfigFromOutput`)가 서비스 파일에 module-level export로 공존
  - 위치: `execution-engine.service.ts` 상단부
  - 상세: 순수 변환 함수들이 2,000줄짜리 서비스 파일 안에 섞여 있다. 테스트는 가능하지만 파일 크기와 SRP 측면에서 `ai-message.mapper.ts`나 `resume-state.serializer.ts` 같은 별도 모듈로 분리하면 응집도가 높아진다. 현재 패턴이 일관되게 유지되고 있어 즉각적인 문제는 없다.
  - 제안: 단기적으로는 현행 유지가 합리적이나, 서비스 파일 복잡도가 계속 높아진다면 serialization 레이어 분리를 고려하라.

- **[INFO]** `llmCalls?: unknown[]` 반환 타입이 item 형태를 감춤
  - 위치: `buildAiMessageDebugFromResumeState` 반환 타입
  - 상세: spec에서 각 item의 shape(`requestPayload`, `responsePayload`, `durationMs`)이 명확히 정의돼 있음에도 `unknown[]`으로 반환돼 소비 측에서 추가 cast가 필요하다. 테스트는 실제 shape을 사용하므로 회귀는 잡히지만 타입 문서 역할은 하지 못한다.
  - 제안: `LlmCallRecord` 타입을 공유 위치에 선언하고 반환 타입을 `{ llmCalls?: LlmCallRecord[]; durationMs?: number }`로 교체하라.

---

### 요약

이번 변경은 `execution.ai_message` WebSocket 이벤트의 `waiting_for_input` 분기와 terminal 분기의 shape을 통일하기 위해 `buildAiMessageDebugFromResumeState`를 추출·재사용하는 소규모 리팩터링이다. 함수 분리 자체는 기존 패턴과 일관되고 5개의 단위 테스트로 행동이 보장돼 있으며 spec도 갱신됐다. 주요 아키텍처 리스크는 두 가지다: (1) `requestPayload`/`responsePayload` 제거로 인한 프로토콜 파괴적 변경, (2) terminal 분기와의 대칭이 이번 diff에서 코드 레벨로 증명되지 않는다는 점. `Record<string, unknown>` 패턴 반복은 기존 기술 부채의 연장으로, 신규 helper 추가 시점에 `ResumeState` 인터페이스를 도입했다면 타입 안전성을 개선할 수 있었다.

### 위험도

**MEDIUM**