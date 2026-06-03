# API 계약(API Contract) 리뷰 결과

## 발견사항

### 응답 형식

- **[INFO]** `meta.memory` 객체에 `compactedMessages?: number` 필드 신규 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `memoryMeta` 확장 (~line 2311), 물리 압축 분기 (~line 2336)
  - 상세: 기존 `meta.memory` 구조(`strategy`, `summarized`, `recalledCount`, `tokenBudgetUsed`)에 선택적 필드가 추가된다. 물리 압축이 발생한 경우에만 `compactedMessages > 0`으로 노출되며, 미발생 시 필드 자체가 없다(옵셔널). 기존 클라이언트는 미지 필드를 무시하는 것이 일반적이므로 breaking change 아님.
  - 제안: 해당 없음 — 옵셔널 추가 필드는 하위 호환.

- **[INFO]** `injectMemoryContext` 반환 타입에 `keepUserExchanges: number` 필드 추가
  - 위치: `ai-agent.handler.ts` ~line 2193, 2339, 2356, 2375
  - 상세: 내부 private 메서드의 반환 구조 확장. 외부 API 계약 직접 노출 없음. 호출부만 영향.
  - 제안: 해당 없음 — 내부 전파 경로.

### 하위 호환성

- **[INFO]** `manual` 전략 완전 무변경 확인
  - 위치: `ai-agent.handler.ts` ~line 2326 — `if (mem.memory.summarized && mem.keepUserExchanges > 0)` 분기
  - 상세: `manual` 전략은 `multiTurnMemoryStrategy !== 'manual'` 블록에 진입하지 않으므로 물리 압축 로직이 실행되지 않는다. 기존 `manual` 워크플로 동작 무변경.
  - 제안: 해당 없음.

- **[INFO]** `summary_buffer` / `persistent` 전략에서 `summarized=false`인 경우 압축 미발생 보장
  - 위치: `ai-agent.handler.ts` — `if (mem.memory.summarized && mem.keepUserExchanges > 0)` 조건
  - 상세: 이번 turn에 요약이 진행되지 않으면 messages 물리 압축을 건드리지 않는다. 기존 turn 단위 메시지 누적 동작 유지.
  - 제안: 해당 없음.

### 요청 검증 / 내부 인터페이스

- **[INFO]** `compactMessagesToTail` 방어 경계 확인
  - 위치: `agent-memory-injection.ts` ~line 1131–1134
  - 상세: `messages[0].role !== 'system'` 또는 `keepUserExchanges <= 0` 시 무변경 반환하여 예기치 않은 형태에서 안전하게 fallback. WebSocket/REST API 계약에 직접 영향 없음.
  - 제안: 해당 없음.

---

## 요약

이 변경은 AI 에이전트 핸들러의 내부 LLM messages 배열 물리 압축 기능 추가로, 외부 공개 HTTP 엔드포인트·RESTful URL·WebSocket 프로토콜에 직접 변경이 없다. 유일한 API 계약 접점은 `meta.memory` 응답 객체에 선택적 필드(`compactedMessages?: number`)가 추가되는 것인데, 옵셔널 추가 필드는 하위 호환적이므로 breaking change가 아니다. `manual` 전략 무변경 불변식, tool_use↔tool_result 페어링 보존, 요약 미발생 시 압축 미실행 조건이 코드와 테스트에서 모두 명확히 보호되고 있다.

## 위험도

NONE

---

STATUS=success ISSUES=0
