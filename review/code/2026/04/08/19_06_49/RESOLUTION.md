# 코드 리뷰 이슈 조치 내용

## Critical 이슈

### C-1: LLM 페이로드 클라이언트 노출 (Security)
- **조치**: `requestPayload`에서 `messages` 배열(시스템 프롬프트, RAG 컨텍스트 포함)을 제거하고 `model`, `temperature`, `maxTokens`, `tools`만 전송하도록 수정
- **파일**: `execution-engine.service.ts` — `sanitizedRequest` 객체로 필터링
- **비고**: `responsePayload`는 LLM 응답 원본으로 시스템 프롬프트를 포함하지 않으므로 유지. `messages` 배열은 이미 별도로 system role 필터링 후 전송 중

### C-2: 테스트 부재 (Testing)
- **조치**: 5개 테스트 추가 (603 total, 전부 pass)
  - `ai-agent.handler.spec.ts`: debug fields (lastTurnRequest/Response/DurationMs) 검증, 첫 턴 debug 정보 검증, messages 배열 mutation 방지 검증
  - `execution-engine.service.spec.ts`: 메시지 길이 초과 검증, pending continuation 부재 검증

## Warning 이슈

### W-1: O(N²) 메모리 누적 (Performance)
- **조치**: `requestPayload`에서 `messages` 배열 제외하여 매 턴마다 전체 대화 히스토리가 클라이언트에 중복 전달되지 않도록 수정
- **파일**: `execution-engine.service.ts`

### W-2: 사용자 입력 길이 제한 없음 (Security)
- **조치**: `continueAiConversation`에 `MAX_MESSAGE_LENGTH = 10,000` 검증 추가
- **파일**: `execution-engine.service.ts`

### W-3: AiAgentHandler 다운캐스팅 (Architecture)
- **보류**: 현재 `ai_agent` 하나만 multi-turn을 지원하므로, 향후 multi-turn 노드 타입 추가 시 `MultiTurnNodeHandler` 인터페이스 도입 예정

### W-4: chatParams 캡처 시점 불일치 (Maintainability)
- **조치**: `chatParams` 캡처를 tool call 루프 종료 후로 이동. `messages` 배열 제외하고 `model`, `temperature`, `maxTokens`, `tools`만 캡처
- **파일**: `ai-agent.handler.ts`

### W-5: 첫 턴 디버그 정보 누락 (Requirement)
- **조치**: `executeMultiTurn`에서 첫 번째 LLM 호출에도 `lastTurnRequest`, `lastTurnResponse`, `lastTurnDurationMs` 캡처하여 `_multiTurnState`에 포함
- **파일**: `ai-agent.handler.ts`

### W-6: ExecutionEventType enum 우회 (API Contract)
- **조치**: `ExecutionEventType`에 `AI_MESSAGE = 'execution.ai_message'` 정식 등록, 캐스팅 제거
- **파일**: `websocket.service.ts`, `execution-engine.service.ts`

### W-7: newState 중복 변수 (Maintainability)
- **조치**: `newState` 변수 제거, `multiTurnState`에서 직접 참조
- **파일**: `execution-engine.service.ts`

### W-8: SummaryView IIFE → useMemo (Maintainability)
- **조치**: 삼항 내 IIFE를 `useMemo`로 추출
- **파일**: `conversation-inspector.tsx`

### W-9: key={i} 인덱스 사용 (Maintainability)
- **조치**: `key={\`${item.type}-${item.turnIndex}-${i}\`}`로 의미 있는 key 사용
- **파일**: `conversation-inspector.tsx`

### W-10: SelectedItemDetail 탭 상태 미초기화 (Side Effect)
- **조치**: 부모에서 `key={...}` prop 전달하여 아이템 변경 시 컴포넌트 리마운트로 상태 리셋
- **파일**: `conversation-inspector.tsx`

### W-11: turnIndex 계산 오류 (Requirement)
- **조치**: `Math.floor(i/2)+1` → user 메시지마다 카운터 증가 방식으로 변경
- **파일**: `conversation-inspector.tsx`

### W-12: ragChunks 매핑 누락 (Requirement)
- **조치**: `handleAiMessage`의 metadata 매핑에 `toolCalls`, `ragChunks` 추가
- **파일**: `use-execution-events.ts`

## 추가 개선

- `durationMs` 포맷 로직을 `formatDuration()` 유틸 함수로 추출하여 중복 제거 (Info #4)
- `!payload.message && payload.message !== ""` → `payload.message == null`로 명확화 (Info #5)
