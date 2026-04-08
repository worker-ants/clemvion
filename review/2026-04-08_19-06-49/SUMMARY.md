파일 쓰기 권한이 필요합니다. 아래는 통합 보고서 내용입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — LLM 요청/응답 페이로드(시스템 프롬프트·RAG 컨텍스트 포함)가 WebSocket을 통해 클라이언트에 무조건 노출되며, 새로 추가된 디버깅 기능 전반에 테스트가 전혀 없음

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | LLM 요청/응답 페이로드 전체(시스템 프롬프트, RAG 컨텍스트, 대화 히스토리)가 WebSocket 이벤트로 클라이언트에 전송·저장됨. 시스템 프롬프트 노출은 프롬프트 인젝션 공격 벡터가 됨 | `execution-engine.service.ts:884-891`, `use-execution-events.ts:218-251`, `execution-store.ts:45-62` | `NODE_ENV=development`일 때만 전송하거나 최소한 `role: 'system'` 메시지 필터링 후 전송 |
| 2 | Testing | 새로 추가된 디버깅 기능 전반(lastTurnRequest/Response/DurationMs 캡처, WebSocket emit 페이로드, 빈 문자열 가드 변경, 히스토리 모드 메시지 변환 IIFE)에 테스트가 전혀 없음. `_multiTurnState` 부재 시 런타임 오류 가능 | `ai-agent.handler.ts:388-479`, `execution-engine.service.ts:872-898`, `use-execution-events.ts:221`, `conversation-inspector.tsx:317-330` | `processMultiTurnMessage` 반환값 검증, `waitForAiConversation` emit payload 검증, 경계값 테스트 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `requestPayload`에 전체 메시지 히스토리 포함 채 매 턴마다 WebSocket 전송 → 클라이언트 스토어 누적. N턴 대화 시 O(N²) 메모리 누적 | `execution-engine.service.ts:887-892` | `{...chatParams, messages: undefined}` 경량 페이로드 전송 |
| 2 | Security | 사용자 입력 메시지에 길이 제한 없음 → 토큰 소비형 DoS 가능 | `run-results-drawer.tsx:handleSendMessage`, `execution-engine.service.ts:continueAiConversation` | 백엔드에서 메시지 최대 길이(예: 10,000자) 검증 추가 |
| 3 | Architecture | `ExecutionEngineService`가 `AiAgentHandler` 내부 상태 구조를 `Record<string, unknown>` 캐스팅으로 직접 접근. `as unknown as AiAgentHandler` 다운캐스팅으로 인터페이스 외부 메서드 호출 | `execution-engine.service.ts:872-893` | `MultiTurnNodeHandler` 인터페이스 도입, `processMultiTurnMessage` 반환 타입 명시 |
| 4 | Maintainability / Requirement | `chatParams`가 tool call 루프 시작 전 스냅샷으로 고정 → `lastTurnRequest`(초기)와 `lastTurnResponse`(최종)가 서로 다른 쌍이 되어 디버깅 데이터 신뢰도 저하 | `ai-agent.handler.ts:388-400` | tool call 루프 종료 후 최종 LLM 호출 직전 캡처, 또는 변수명을 `firstTurnRequest`로 명시 |
| 5 | Requirement | `executeMultiTurn`의 첫 번째 LLM 호출(초기 턴) 결과가 `_multiTurnState`에 저장되지 않아 첫 번째 턴의 디버그 정보가 inspector에서 보이지 않음 | `ai-agent.handler.ts:executeMultiTurn` | 첫 번째 LLM 호출에도 `lastTurnRequest/Response/DurationMs` 캡처하여 `waiting_for_input` 이벤트에 포함 |
| 6 | API Contract | `ExecutionEventType` enum을 타입 캐스팅으로 우회 (`'execution.ai_message' as ExecutionEventType`) | `execution-engine.service.ts:884`, `use-execution-events.ts:218` | enum에 `AI_MESSAGE = 'execution.ai_message'` 항목 공식 추가 |
| 7 | Maintainability | `newState`가 `multiTurnState`와 동일한 값을 가리키는 중복 변수 | `execution-engine.service.ts:872-876` | `newState` 제거, `multiTurnState.model` 등으로 직접 참조 |
| 8 | Maintainability | `SummaryView` 내 `isLive=false` 분기의 IIFE가 삼항 연산자 안에 삽입 → 가독성 저하, `useMemo` 없이 매 렌더링마다 재실행 | `conversation-inspector.tsx:SummaryView` | 별도 함수로 추출 + `useMemo` 적용 |
| 9 | Maintainability | 리스트 아이템 `key={i}` 인덱스 사용 → 메시지 추가/삭제 시 잘못된 컴포넌트 재사용 | `conversation-inspector.tsx:SummaryView items.map` | `key={\`${item.type}-${item.turnIndex}\`}` 등 의미 있는 key 사용 |
| 10 | Side Effect | `SelectedItemDetail`의 `activeTab` 상태가 다른 아이템 선택 시 초기화되지 않음 | `conversation-inspector.tsx:SelectedItemDetail` | `key={item.turnIndex}` prop 전달하여 아이템 변경 시 상태 리셋 |
| 11 | Requirement | 히스토리 모드 `turnIndex: Math.floor(i / 2) + 1` 계산이 연속 assistant 메시지(tool call) 시 불일치 | `conversation-inspector.tsx:317-330` | `type === "user"`일 때마다 카운터 증가 방식으로 변경 |
| 12 | Requirement | `ragChunks` 필드가 `handleAiMessage` metadata 매핑에 누락 → RAG 사용 시에도 `UsageTab`에서 항상 `undefined` | `use-execution-events.ts:handleAiMessage`, `conversation-inspector.tsx:UsageTab` | metadata 매핑에 `ragChunks` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `ConversationItem.metadata.model` JSDoc 누락 | `execution-store.ts` | `/** LLM model name used for this turn */` 추가 |
| 2 | Documentation | `processMultiTurnMessage` JSDoc에 새 디버깅 필드 미반영 | `ai-agent.handler.ts` | `@returns` 설명에 `lastTurnRequest/Response/DurationMs` 추가 |
| 3 | Documentation | `spec/` WebSocket 이벤트 스키마 문서에 `execution.ai_message` 신규 필드 업데이트 필요 가능성 | `spec/` 디렉토리 | 해당 문서 확인 및 업데이트 |
| 4 | Maintainability | `durationMs` 포맷 로직이 `ResponseTab`, `UsageTab` 두 곳에 중복 | `conversation-inspector.tsx` | `formatDuration(ms: number): string` 유틸 함수 추출 |
| 5 | Maintainability | `!payload.message && payload.message !== ""` 조건이 의도 불명확 | `use-execution-events.ts:221` | `if (payload.message == null) return;`으로 명확화 |
| 6 | Security | LLM 모델명이 클라이언트에 노출됨 | `execution-engine.service.ts:886` | 비즈니스 측과 공개 허용 범위 확인 |
| 7 | Security | `timestamp`를 클라이언트에서 생성 → 감사 목적 신뢰 불가 | `run-results-drawer.tsx:157` | 감사 목적이면 서버에서 생성 후 전송 |
| 8 | Concurrency | `turnDurationMs`가 순수 LLM 레이턴시가 아닌 tool call 전체 시간을 포함 | `ai-agent.handler.ts` | UI 레이블을 "Turn Duration (incl. tool calls)"으로 변경 |
| 9 | Architecture | `ConversationItem`에 디버깅 전용 필드와 도메인 필드가 혼재 | `execution-store.ts:45-60` | `debug?: ConversationItemDebug` 네임스페이스로 분리 고려 |
| 10 | Concurrency | `addConversationMessage()`와 `updateConversationConfig()` 두 Zustand `set` 호출이 비원자적 | `use-execution-events.ts:handleAiMessage` | 단일 `set` 호출로 통합하는 store 액션 추가 고려 |
| 11 | Performance | `handleSendMessage`의 `conversationMessages.filter().length`가 매 전송마다 O(N) 탐색 | `run-results-drawer.tsx:handleSendMessage` | store에 `userTurnCount` 파생 값 추가 |
| 12 | Scope | `SummaryView` 채팅 버블 레이아웃 재설계가 디버깅 탭 추가와 독립적 기능 변경으로 혼재 | `conversation-inspector.tsx:SummaryView` | 필요 시 별도 PR로 분리 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | HIGH | 시스템 프롬프트·RAG 데이터를 포함한 LLM 페이로드 클라이언트 무조건 노출 |
| testing | HIGH | 변경된 6개 파일 전체에 테스트 없음, `_multiTurnState` 부재 시 런타임 오류 가능 |
| performance | MEDIUM | N턴 대화 시 O(N²) 메모리 누적, `SummaryView` useMemo 누락 |
| maintainability | MEDIUM | `chatParams` 신뢰도 문제, IIFE 가독성 저하, 중복 변수 |
| architecture | MEDIUM | 핸들러 다운캐스팅으로 `NodeHandler` 추상화 무력화, 내부 상태 직접 접근 |
| api_contract | MEDIUM | LLM 원본 페이로드 WebSocket 전송, `ExecutionEventType` enum 우회 |
| requirement | LOW | 첫 턴 디버그 데이터 누락, `ragChunks` 매핑 누락, `turnIndex` 계산 오류 |
| side_effect | LOW | `SelectedItemDetail` 탭 상태 미초기화, `chatParams` 스냅샷 정확도 |
| dependency | LOW | `chatParams` 전체 페이로드 WebSocket 전송으로 런타임 데이터 볼륨 증가 |
| scope | LOW | `SummaryView` 재설계가 디버깅 기능과 독립적으로 혼재 |
| concurrency | LOW | `chatParams`-`lastTurnResponse` 쌍 불일치, `turnDurationMs` 측정 범위 모호 |
| documentation | LOW | JSDoc 일부 누락, WebSocket 계약 문서 업데이트 필요 가능성 |
| database | NONE | DB 관련 변경 없음 |

---

## 발견 없는 에이전트

- **database** — 6개 변경 파일 모두 데이터베이스 레이어와 무관

---

## 권장 조치사항

1. **[즉시] LLM 페이로드 클라이언트 노출 차단** — `requestPayload`/`responsePayload`를 `NODE_ENV=development`에서만 전송. 최소한 `role: 'system'` 메시지 필터링 필수
2. **[즉시] 사용자 입력 길이 제한** — 백엔드 `continueAiConversation`에서 최대 길이 검증 추가
3. **[즉시] 핵심 테스트 작성** — `processMultiTurnMessage` 반환값, `waitForAiConversation` emit payload, `_multiTurnState` 부재 방어 코드 검증
4. **[단기] WebSocket 페이로드 크기 제한** — `requestPayload`에서 `messages` 배열 제외하여 O(N²) 누적 방지
5. **[단기] `chatParams` 캡처 시점 수정** — tool call 루프 종료 후 최종 LLM 호출 직전으로 이동 또는 의도 명시
6. **[단기] 첫 턴 디버그 정보 포함** — `executeMultiTurn` 첫 번째 LLM 호출 결과도 `_multiTurnState`에 캡처
7. **[단기] `ragChunks` 매핑 추가 및 `ExecutionEventType` enum 정식 등록**
8. **[단기] `newState` 중복 변수 제거**
9. **[중기] `SummaryView` 리팩터링** — IIFE → 별도 함수 + `useMemo`, `key={i}` 교체, `SelectedItemDetail`에 `key` prop 전달
10. **[중기] `MultiTurnNodeHandler` 인터페이스 도입** — 다운캐스팅 패턴 제거 및 타입 안전성 확보