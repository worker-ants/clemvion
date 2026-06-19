# 보안(Security) 리뷰 결과

## 발견사항

### 정보 노출 관련

- **[WARNING]** `requestPayload` / `responsePayload` 필드가 LLM 호출 트레이스에 포함됨
  - 위치: `/codebase/backend/src/shared/llm-tracing/llm-call-record.ts` — `LlmCallRecord` 인터페이스 (`requestPayload`, `responsePayload` 필드)
  - 상세: `requestPayload` 와 `responsePayload` 는 LLM 에 전달된 전체 요청/응답을 직렬화해 `meta.turnDebug[]` / `_resumeState.turnDebugHistory[]` 경로로 JSONB 에 저장된다. 이 필드에는 systemPrompt(사용자 데이터, 시스템 지시사항) 및 LLM 응답 본문이 그대로 포함될 수 있다. 해당 값이 WebSocket 이벤트(`execution.ai_message`)를 통해 프론트엔드로 전달되는 경우, 내부 프롬프트 구조·사용자 데이터·보안 지시사항이 클라이언트에 노출될 수 있다.
  - 제안: (1) 클라이언트 전달 전 `requestPayload` / `responsePayload` 를 제거하거나 별도 `debugPayload` 계층으로 분리해 관리자/개발자 전용 채널로만 노출할 것. (2) WebSocket emit 계층에서 이 필드들을 필터링하는 명시적 레이어를 추가할 것. (3) 프로덕션 환경에서는 환경 변수 플래그로 payload 포함 여부를 제어할 것.

- **[INFO]** `lastResponse` 가 에러 출력에 포함됨
  - 위치: `information-extractor.handler.ts` — `executeSingleTurn`, `buildErrorOutput` 호출 시 `details.lastResponse` 전달
  - 상세: LLM 파싱 실패 시 `lastResponse` (LLM 원문 응답)가 에러 payload 의 `details.lastResponse` 로 포함된다. LLM 응답에 사용자 데이터가 반영된 경우 에러 출력에서 의도치 않게 노출될 수 있다.
  - 제안: 에러 payload 에서 `lastResponse` 는 내부 로깅 전용으로만 기록하고, 클라이언트에 전달되는 에러 envelope 에서는 제거 또는 제한적으로 포함할 것 (길이 트런케이션 등).

### 입력 검증

- **[INFO]** `toolCall.arguments` JSON.parse 에 대한 검증 범위
  - 위치: `information-extractor.handler.ts` — `runTurnWithCollectionRetries` 내 `JSON.parse(toolCall.arguments || '{}')`
  - 상세: LLM이 반환한 tool call arguments를 JSON.parse 후 `mergePartial`에 직접 전달한다. JSON 파싱 실패는 try/catch로 방어하지만 파싱 성공 후 내용 검증(outputSchema 대비 타입/값 범위)은 `isComplete` / `mergePartial` 에서만 수행된다. LLM 이 악의적·예상 밖의 키를 포함시켜도 `mergePartial` 가 이를 필터링하지 않으면 `partialResult` 에 오염된 데이터가 들어갈 수 있다.
  - 제안: `mergePartial` 에서 `outputSchema` 에 정의된 필드명만 허용하도록 화이트리스트 필터링을 적용할 것. 현재 구현을 확인해 스키마 외 키가 삭제되는지 명시적으로 보장할 것.

### 이번 변경의 직접 보안 영향

- **[INFO]** 이번 PR의 변경 범위는 순수 타입 리팩터링 (중복 인터페이스 → 단일 canonical 타입)
  - 위치: 3개 파일 전체
  - 상세: 이번 변경은 `LlmCallRecord` / `TurnDebugEntry` 를 노드별 로컬 정의에서 `shared/llm-tracing/llm-call-record.ts` 의 단일 정의로 통합한다. 필드 추가·제거·런타임 로직 변경이 없으며 TypeScript `type` import 만 추가되어 런타임 아티팩트가 없다. 직접적인 신규 보안 취약점은 도입되지 않음.

## 요약

이번 변경은 LLM 호출 트레이스 타입(`LlmCallRecord`, `TurnDebugEntry`)의 중복 정의를 제거하고 단일 canonical 파일로 통합하는 순수 구조 리팩터링이다. 런타임 동작 변경이 없으므로 이번 PR 자체로 신규 보안 취약점이 생기지는 않는다. 다만 통합된 타입에 `requestPayload` / `responsePayload` 필드가 명시적으로 정의됨에 따라, 이 필드가 WebSocket 이벤트나 에러 응답을 통해 클라이언트에 유출될 경로가 존재하는지 별도로 확인이 필요하다. LLM 요청/응답 전체를 담는 이 필드는 내부 프롬프트·사용자 데이터 노출 경로가 될 수 있으므로 클라이언트 전달 레이어에서 필터링 여부를 명시적으로 감사할 것을 권고한다.

## 위험도

LOW
