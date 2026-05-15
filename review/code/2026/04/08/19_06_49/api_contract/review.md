### 발견사항

- **[WARNING]** `execution.ai_message` WebSocket 이벤트에 LLM 원본 요청/응답 페이로드가 클라이언트로 전송됨
  - 위치: `execution-engine.service.ts:884-896`, `use-execution-events.ts:218-251`
  - 상세: `requestPayload`와 `responsePayload`는 LLM API 키가 포함된 설정 객체, 내부 시스템 프롬프트, 전체 메시지 히스토리를 포함할 수 있음. WebSocket은 인증된 사용자에게만 열려 있더라도, 이 데이터가 클라이언트 메모리(Zustand store)에 저장되고 UI에 렌더링됨으로써 불필요한 노출 표면이 생김
  - 제안: 전송 전 `requestPayload`에서 민감 필드(API 키, 인증 헤더 등) 제거 또는 별도 `debug` 플래그가 활성화된 경우에만 전송하는 조건부 로직 추가

- **[WARNING]** `execution.ai_message` 이벤트 페이로드 구조가 기존 계약과 비교해 암묵적으로 확장됨
  - 위치: `execution-engine.service.ts:884`, `use-execution-events.ts:218`
  - 상세: 이벤트 타입을 `'execution.ai_message' as ExecutionEventType`으로 캐스팅하는 것은 타입 시스템을 우회하는 신호. `ExecutionEventType` enum에 정식으로 추가되지 않은 채 사용됨
  - 제안: `ExecutionEventType`에 `AI_MESSAGE = 'execution.ai_message'` 항목을 추가하여 타입 안전성 확보

- **[INFO]** `ConversationItem` 인터페이스에 추가된 새 필드(`timestamp`, `durationMs`, `requestPayload`, `responsePayload`, `metadata.model`)는 모두 옵셔널로 선언됨
  - 위치: `execution-store.ts:45-61`
  - 상세: 하위 호환성을 유지하는 올바른 방식으로 기존 클라이언트 코드에 영향 없음

- **[INFO]** `handleAiMessage`의 가드 조건이 `!payload.message`에서 `!payload.message && payload.message !== ""`로 변경됨
  - 위치: `use-execution-events.ts:226`
  - 상세: 빈 문자열 응답도 유효한 메시지로 처리하는 의도적 변경이나, 실제 `""` 응답이 의미 있는 경우인지 검토 필요

### 요약

이번 변경은 AI 에이전트 멀티턴 대화의 디버깅 기능을 추가하는 것으로, WebSocket 이벤트 페이로드를 확장하는 방식으로 구현됨. 기존 필드는 그대로 유지되므로 하위 호환성은 보존되나, LLM의 원본 요청/응답 객체 전체를 클라이언트에 전달하는 설계는 민감한 내부 정보(시스템 프롬프트 전문, 모델 파라미터 등) 노출 위험이 있음. 또한 `ExecutionEventType` enum을 타입 캐스팅으로 우회하는 패턴은 향후 이벤트 계약 관리를 어렵게 만들 수 있음.

### 위험도
MEDIUM