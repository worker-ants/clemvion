파일 쓰기 권한이 필요합니다. 아래 통합 보고서 내용을 확인해 주세요.

---

# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** - Multi-turn AI 대화 루프의 setTimeout 미정리로 인한 대화 영구 중단 버그 및 실행 소유권 검증 누락으로 인한 인가 우회 취약점 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | **stale setTimeout이 다음 턴의 pendingContinuations 항목을 삭제하는 버그** — 각 턴마다 새 Promise+setTimeout을 생성하지만 이전 타이머를 취소하지 않음. 1800초 후 이전 콜백이 발화하여 다음 턴의 continuation 항목을 삭제, 이후 대화가 영구 중단(hang) | `execution-engine.service.ts` — `waitForAiConversation()` while 루프 | `pendingContinuations` 타입에 `timeoutId` 추가 후 `continueAiConversation`/`endAiConversation`에서 반드시 `clearTimeout(pending.timeoutId)` 호출 |
| 2 | 보안 | **실행 소유권 검증 없음** — `userId` 인증 여부만 확인하고 `executionId`가 해당 사용자 소유인지 검증하지 않음. 인증된 모든 사용자가 타인의 AI 대화에 메시지를 주입하거나 강제 종료 가능 | `websocket.gateway.ts` — `handleSubmitMessage()`, `handleEndConversation()` | 서비스 레이어에서 execution의 `workspaceId`와 현재 사용자 워크스페이스를 대조하는 소유권 검증 추가 |
| 3 | 테스트 | **핵심 대화 흐름 제어 로직에 대한 테스트 전무** — `waitForAiConversation`, `continueAiConversation`, `endAiConversation` 및 신규 WebSocket 핸들러 단위 테스트 부재. Promise blocking, timeout, 상태 전환 등 가장 복잡한 비동기 흐름이 회귀 위험에 노출 | `execution-engine.service.ts`, `websocket.gateway.ts` | `execution-engine.service.spec.ts` 및 게이트웨이 스펙 파일에 테스트 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 버그 | **후속 턴 tool use 항상 비활성화** — `_multiTurnState`에 `toolNodeIds`/`toolOverrides` 미포함으로 `buildTools(state)` 항상 빈 배열 반환. ND-AG-14 요구사항 위반 | `ai-agent.handler.ts` — `executeMultiTurn` state 구성 | `_multiTurnState`에 `toolNodeIds`, `toolOverrides` 포함 |
| 2 | 보안 | **시스템 프롬프트 클라이언트 노출** — `role: 'system'` 포함된 `messages` 배열이 필터링 없이 전송 | `ai-agent.handler.ts` 반환값 | `messages.filter(m => m.role !== 'system')` 적용 |
| 3 | 보안 | **내부 에러 메시지 클라이언트 노출** — `error.message`가 그대로 반환되어 내부 상태 정보 노출 | `websocket.gateway.ts` — catch 블록 | 에러 메시지 일반화, 세부 내용은 서버 로그에만 기록 |
| 4 | 보안 | **사용자 메시지 길이·내용 미검증** — 길이 제한 없는 메시지가 LLM 컨텍스트에 직접 추가 | `ai-agent.handler.ts` — `processMultiTurnMessage()` | 최대 길이 제한(예: 4,000자) 및 공백 전용 메시지 거부 |
| 5 | 보안 | **AI 대화 전용 rate limiting 없음** — 무제한 메시지 전송 시 LLM API 비용 폭증 가능 | `websocket.gateway.ts` — `handleSubmitMessage()` | executionId당 최소 간격(예: 1초) 쓰로틀링 추가 |
| 6 | 부작용 | **`messages` 배열 직접 변이(mutation)** — `state.messages` 참조 복사 후 `push()`로 원본 배열 오염. 예외 발생 시 절반만 변이된 상태 잔류 | `ai-agent.handler.ts` — `processMultiTurnMessage()` | `const messages = [...(state.messages as ChatMessage[])]` shallow copy 후 사용 |
| 7 | 타입 | **`ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE` 미등록** — 강제 캐스팅으로 타입 안전성 우회 | `execution-engine.service.ts` | enum에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 추가 |
| 8 | 아키텍처 | **`AiAgentHandler` 직접 이중 캐스팅 참조** — `as unknown as AiAgentHandler` 패턴으로 의존성 역전 원칙 위반 | `execution-engine.service.ts` — 두 곳 | `MultiTurnCapable` 인터페이스 정의 또는 직접 DI 주입 |
| 9 | 아키텍처 | **`_multiTurnState` 내부 상태가 출력 캐시를 오염** — `NodeExecution.outputData`에 내부 구현 세부사항 저장 | `ai-agent.handler.ts`, `execution-engine.service.ts` | 멀티턴 상태를 별도 Map 또는 Redis에 분리 저장 |
| 10 | DB | **다중 DB 작업 트랜잭션 부재** — 상태 전환 중 크래시 시 Execution/NodeExecution 상태 불일치 | `execution-engine.service.ts` — `waitForAiConversation()` | `QueryRunner`로 단일 트랜잭션 처리 |
| 11 | DB | **Stale Entity 재사용** — 대화 시작 시 조회한 `nodeExec`를 수십 분 후 재검증 없이 저장 | `execution-engine.service.ts` — 말미 | 루프 종료 후 `findOne` 재조회 또는 조건부 UPDATE |
| 12 | 성능 | **매 턴 `llmService.resolveConfig` 재호출** — 불변 LLM 설정을 매 턴 DB/캐시에서 재조회 | `ai-agent.handler.ts` — `processMultiTurnMessage()` | resolved llmConfig를 `_multiTurnState`에 캐싱 |
| 13 | 성능 | **매 이벤트마다 전체 `messages` 배열 직렬화** — 턴이 쌓일수록 O(n²) 통신 비용 | `execution-engine.service.ts` — ai_message emit | ai_message에 최신 응답 메시지만 포함, 클라이언트가 누적 관리 |
| 14 | DB | **대화 전체 이력의 `outputData` 저장** — 장기 대화 시 수MB 규모 JSON 저장 | `execution-engine.service.ts` — 종료 처리 블록 | 요약 정보만 저장, 전체 messages는 별도 분리 |
| 15 | 스펙 | **`execution.resumed` 이벤트 스펙 미문서화** | `spec/5-system/6-websocket-protocol.md` | §4.1에 `execution.resumed` 이벤트 추가 |
| 16 | 테스트 | **`maxTurns = 0` 경계값 테스트 누락** | `ai-agent.handler.spec.ts` | 무제한 모드 동작 검증 테스트 추가 |
| 17 | 테스트 | **RAG system 메시지 삽입 구조 미검증** | `ai-agent.handler.spec.ts` | messages 배열 구조 검증 assert 추가 |
| 18 | 호환성 | **RAG 컨텍스트를 `system` 메시지로 대화 중간 삽입** — Anthropic 등 일부 프로바이더 미허용 | `ai-agent.handler.ts` — `processMultiTurnMessage()` | user 메시지에 포함하거나 첫 시스템 프롬프트 업데이트 방식으로 통일 |
| 19 | API | **WebSocket ACK 이벤트명 불일치** — 기존 패턴과 혼용, 스펙에 ACK 응답 형식 미정의 | `websocket.gateway.ts` | 스펙에 ACK 구조 명시 또는 기존 패턴 통일 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 타입 | `MultiTurnState` 인터페이스 미정의 — `Record<string, unknown>` 광범위 사용 | 전반 | `MultiTurnState`, `ConversationConfig`, `AiAgentOutput` 인터페이스 정의 |
| 2 | 성능 | 매 턴 `buildTools` 재계산 — 불변 tool 배열을 매 턴 재구성 | `processMultiTurnMessage()` | `_multiTurnState`에 tools 배열 캐싱 |
| 3 | 성능 | 핸들러 레지스트리 룩업이 while 루프 내 반복 | `waitForAiConversation()` | 루프 진입 전 한 번만 추출 |
| 4 | 성능 | `ragSources` 중복 누산 — 동일 문서가 여러 턴에 중복 포함 | `processMultiTurnMessage()` | Set 기반 dedup 또는 최신 턴만 기록 |
| 5 | 성능 | token 카운팅 불일치 — 중간 tool call 토큰 누락 | `executeMultiTurn()` | `+=` 누산 방식으로 변경 |
| 6 | 유지보수 | `waitForAiConversation` 메서드 과도한 크기(~130줄) | `execution-engine.service.ts` | 서브 메서드로 분리 |
| 7 | 유지보수 | LLM+tool calling 루프가 3개 메서드에 중복 | `ai-agent.handler.ts` | `runLlmWithToolLoop()` 공통 메서드 추출 |
| 8 | 유지보수 | 테스트 state 객체 중복 정의 | `ai-agent.handler.spec.ts` | 공통 픽스처로 추출 |
| 9 | 문서 | 공개 메서드 JSDoc 미흡 | `ai-agent.handler.ts` | `@param`, `@returns` 포함 JSDoc 추가 |
| 10 | 문서 | `_multiTurnState` 내부 상태 구조 스펙 미정의 | `spec/4-nodes/3-ai-nodes.md` | 스펙에 "내부 상태 구조" 섹션 추가 |
| 11 | API | `_multiTurnState`의 잠재적 WebSocket 페이로드 노출 경로 | `execution-engine.service.ts` | `outputData` 저장 시 `_multiTurnState` 필드 제거 |
| 12 | 보안 | RAG 컨텍스트를 통한 프롬프트 인젝션 가능성 | `processMultiTurnMessage()` | Knowledge Base 저장 시 인젝션 패턴 필터링 |
| 13 | API | `executionId`/`nodeId` UUID 형식 미검증 | `websocket.gateway.ts` | `@IsUUID()` 적용 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | **CRITICAL** | stale setTimeout이 다음 턴 pendingContinuations를 삭제하는 hang 버그 |
| security | **HIGH** | 실행 소유권 검증 누락, 시스템 프롬프트 노출, 내부 에러 노출 |
| testing | **HIGH** | 핵심 서비스 메서드 및 WebSocket 핸들러 테스트 전무 |
| performance | **HIGH** | setTimeout 타이머 누수, 매 이벤트 전체 messages 직렬화(O(n²)) |
| api_contract | **MEDIUM** | ExecutionEventType 미등록, 인가 검증 누락, ACK 이벤트명 불일치 |
| architecture | **MEDIUM** | AiAgentHandler 직접 캐스팅, _multiTurnState 출력 캐시 혼재 |
| dependency | **MEDIUM** | AiAgentHandler 직접 의존, ExecutionEventType enum 우회 |
| database | **MEDIUM** | 트랜잭션 부재, Stale Entity 재사용, 대용량 outputData 저장 |
| maintainability | **MEDIUM** | Record\<string, unknown\> 과용, LLM loop 3중 중복, 함수 크기 과다 |
| requirement | **MEDIUM** | 후속 턴 tool use 비활성화(ND-AG-14 위반), messages mutation |
| side_effect | **MEDIUM** | messages 배열 공유 참조 변이, setTimeout leak, 권한 검증 누락 |
| documentation | **LOW** | JSDoc 미흡, execution.resumed 스펙 누락, 내부 상태 구조 미문서화 |
| scope | **LOW** | ExecutionEventType 타입 단언, 기존 주석 삭제 범위 이탈(경미) |

---

## 발견 없는 에이전트
없음 (모든 에이전트가 발견사항 보고)

---

## 권장 조치사항

### 즉시 수정 필요 (CRITICAL/HIGH)

1. **[필수] setTimeout 타이머 정리** — `pendingContinuations` 타입에 `timeoutId` 추가 후 `continueAiConversation`/`endAiConversation`에서 반드시 `clearTimeout(pending.timeoutId)` 호출. 미수정 시 멀티턴 대화가 특정 턴 이후 영구 중단됨

2. **[필수] 실행 소유권 검증 추가** — `handleSubmitMessage`, `handleEndConversation`에서 `executionId` 소유자 검증. 인증된 사용자가 타인의 AI 대화를 임의로 제어 가능한 보안 취약점

3. **[필수] `_multiTurnState`에 `toolNodeIds`/`toolOverrides` 포함** — 미수정 시 멀티턴 중 tool use 항상 비활성화(ND-AG-14 요구사항 위반)

4. **[필수] 핵심 서비스/게이트웨이 테스트 추가** — `waitForAiConversation`, `continueAiConversation`, `endAiConversation`, 신규 WebSocket 핸들러 단위 테스트 작성

5. **[필수] `messages` 배열 직접 변이 제거** — `processMultiTurnMessage`에서 shallow copy 후 작업

### 단기 수정 권장 (WARNING)

6. `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE` 추가
7. 클라이언트 전달 `messages`에서 `role === 'system'` 필터링
8. 에러 메시지 일반화 (내부 상태 정보 노출 차단)
9. DB 상태 변경을 `QueryRunner` 단일 트랜잭션으로 처리
10. RAG 컨텍스트 삽입 방식 변경 (system 메시지 중간 삽입 제거)

### 중기 개선 검토

11. `MultiTurnState` 인터페이스 정의
12. `runLlmWithToolLoop()` 공통 메서드 추출
13. `execution.ai_message`에 최신 응답 메시지만 전달하도록 변경
14. `execution.resumed` 이벤트 스펙 문서화