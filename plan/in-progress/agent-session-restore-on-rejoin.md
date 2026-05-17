---
worktree: agent-session-restore-on-rejoin
started: 2026-05-17
owner: developer
---

# AI Agent 대화 세션 페이지 재진입 시 메시지 복원

## 배경

워크플로우를 실행해 AI Agent 노드와 대화 중인 사용자가 다른 페이지로 이동했다가 대시보드에서 같은 실행을 다시 열면, 대화 메시지가 전혀 보이지 않는 회귀가 보고됨.

## 근본 원인

`frontend/src/lib/websocket/apply-execution-snapshot.ts:223-227` — REST 스냅샷 적용 경로의 `ai_conversation` 분기는 `pauseForConversation(nodeId, convConfig)` 만 호출하고 `setConversationMessages()` 를 호출하지 않음.

비교 — WebSocket 이벤트 경로 `use-execution-events.ts:233-269` 는 `convConfig.messages` 가 있고 store 가 비었을 때 `messagesToConversationItems(...)` 로 변환 후 `setConversationMessages(items)` 를 호출해 메시지를 시드한다.

페이지 재진입 흐름:

1. `executionId` 변경 → `resetStore()` 호출 → `conversationMessages: []` 초기화
2. REST 폴링 응답 도착 → `applyExecutionSnapshot()` 호출
3. `pauseForConversation()` 만 호출되고 `conversationMessages` 는 비어 있음
4. WebSocket 이벤트가 도착하지 않거나 도착 전 → `isWaitingConversation` 분기에서 빈 화면

데이터(`NodeExecution.outputData.output.result.messages`)는 이미 영속되어 있어 frontend 한 곳 수정으로 해결 가능.

## 작업

- [x] 스펙·관련 코드 분석 (apply-execution-snapshot, use-execution-events, conversation-utils, AI Agent handler, execution-store)
- [x] consistency-check (frontend 단일 파일 hydration 분기 보완. spec 영향 없음)
- [x] plan/in-progress 작성
- [x] 테스트 선작성 — `apply-execution-snapshot.test.ts` 에 ai_conversation hydration 케이스 추가
  - 케이스 A: structured envelope `{config, output:{result:{messages}}, meta}` 가 도착하면 `conversationMessages` 가 채워진다
  - 케이스 B: store 가 이미 메시지를 갖고 있으면 덮어쓰지 않는다 (중복 방지)
  - 케이스 C: `meta.turnDebug` 가 있으면 debug 정보가 함께 매핑된다
- [x] 구현 — `apply-execution-snapshot.ts` 의 `ai_conversation` 분기에 `parseHistoryMessages` 를 활용한 hydration 로직 추가
- [x] 테스트 보강 — frontend unit test 통과 확인
- [x] TEST WORKFLOW — lint·unit·build (e2e 는 면제 화이트리스트 적합성 평가)
- [x] REVIEW WORKFLOW — /ai-review, RESOLUTION.md

## Side Effect 점검

- 영향 받는 파일: `frontend/src/lib/websocket/apply-execution-snapshot.ts` (단일)
- 의존성: `parseHistoryMessages` (이미 export 됨, 완료된 대화 표시에 사용 중) → 추가 모듈 변경 없음
- backend 변경 없음 (데이터 영속화는 이미 정상)
- spec 변경 불필요 (구현 디테일, 외부 계약 변화 없음)
