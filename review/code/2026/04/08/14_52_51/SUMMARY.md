파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `review/2026-04-08_14-52-51/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

그 전에 분석 결과를 먼저 공유드립니다:

---

# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — stale setTimeout hang 버그·messages 배열 공유 참조 변이·후속 턴 tool calling 완전 비활성화(ND-AG-14 위반)·핵심 비동기 흐름 테스트 전무·실행 소유권 인가 검증 누락이 복합적으로 존재.

---

## Critical 발견사항 (5건)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | 동시성·부작용 | **stale setTimeout hang 버그** — 매 턴 타이머 생성 시 이전 타이머 미취소. 1800초 후 stale 콜백이 다음 턴의 `pendingContinuations` 항목 삭제 → 대화 영구 hang | `execution-engine.service.ts` — `waitForAiConversation()` while 루프 |
| 2 | 부작용·동시성 | **messages 배열 공유 참조 변이** — `const messages = state.messages`는 참조 복사. `push()` 가 `nodeOutputCache` 원본 직접 변이. 예외 발생 시 오염 상태 잔류 | `ai-agent.handler.ts` — `processMultiTurnMessage()` |
| 3 | 요구사항·부작용 | **후속 턴 tool calling 완전 비활성화 (ND-AG-14 위반)** — `_multiTurnState`에 `toolNodeIds`/`toolOverrides` 미포함으로 `buildTools(state)`가 항상 빈 배열 반환 | `ai-agent.handler.ts` — `executeMultiTurn()` `_multiTurnState` 구성부 |
| 4 | 테스트 | **핵심 비동기 흐름 테스트 전무** — `waitForAiConversation`, `continueAiConversation`, `endAiConversation` 미검증. `execution-engine.service.spec.ts` 자체 부재 | `execution-engine.service.ts` |
| 5 | 보안·인가 | **실행 소유권 검증 없음 (OWASP A01)** — `userId` 인증만 확인, `executionId` 소유권 미검증. 인증된 임의 사용자가 타인 AI 대화 메시지 주입·강제 종료 가능 | `websocket.gateway.ts` — `handleSubmitMessage()`, `handleEndConversation()` |

---

## 경고 (WARNING) — 28건 핵심 요약

**보안 (5건):** 시스템 프롬프트 클라이언트 노출, 내부 에러 메시지 직접 반환, 사용자 메시지 길이·내용 미검증, LLM API Rate Limiting 없음, RAG 컨텍스트 프롬프트 인젝션 경로

**성능 (3건):** 전체 messages 배열 매 이벤트 직렬화 O(n²), 매 턴 `llmService.resolveConfig` 재호출, 매 턴 `buildTools` 재계산

**테스트 (3건):** WebSocket 신규 핸들러 테스트 부재, 후속 턴 tool calling 시나리오 누락, `maxTurns=0` 경계값 누락

**요구사항 (3건):** 타임아웃 상태 전이 스펙 불일치, RAG 중간 system 역할 삽입(Anthropic 호환성), `maxTurns=0` 탈출 경로 단일화

**DB (3건):** 트랜잭션 부재, stale entity 재사용, `_multiTurnState` 포함한 전체 이력 outputData 저장

**API 계약 (4건):** `ExecutionEventType` enum 미등록, `execution.resumed` 스펙 미문서화, `waitingNodeId` 필드명 불일치, ACK 패턴 불일치

**아키텍처·의존성 (2건):** `AiAgentHandler` 이중 캐스팅 DIP 위반, 순환 의존성 심화

**유지보수성 (3건):** `waitForAiConversation` 130줄 단일 메서드, LLM 루프 3중복, `Record<string, unknown>` 과용

---

## 권장 조치사항 우선순위

**즉시 (프로덕션 배포 전):**
1. stale setTimeout → `clearTimeout` 추가
2. messages 배열 shallow copy (`[...state.messages]`)
3. `_multiTurnState`에 `toolNodeIds`/`toolOverrides` 추가 (ND-AG-14 복구)
4. WebSocket 핸들러 소유권 검증 추가
5. 시스템 프롬프트 필터링 (`filter(m => m.role !== 'system')`)
6. 내부 에러 메시지 일반화
7. `ExecutionEventType.EXECUTION_AI_MESSAGE` enum 등록
8. RAG 삽입 방식 통일 (system → user prefix, Anthropic 호환성)
9. 타임아웃 상태 전이 스펙 정렬
10. `outputData` 저장 시 `_multiTurnState` 제거

**단기 (다음 스프린트):** 서비스 레이어 테스트 작성, WebSocket 핸들러 테스트, 메시지 길이 검증, Rate Limiting, `execution.resumed` 스펙 문서화, DB 트랜잭션, `MultiTurnCapable` 인터페이스, `MultiTurnState` 타입 정의

**중기 (기술 부채):** 순환 의존성 해소(EventEmitter2), 메서드 분리, LLM 루프 공통화, 증분 이벤트 전송