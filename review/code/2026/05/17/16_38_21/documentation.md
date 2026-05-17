### 발견사항

- **[INFO]** `applyExecutionSnapshot` 함수의 JSDoc에 신규 `setConversationMessages` 파라미터 및 `ai_conversation` hydration 동작이 미반영
  - 위치: `frontend/src/lib/websocket/apply-execution-snapshot.ts` — 함수 상단 JSDoc 블록 (`@param` 섹션)
  - 상세: 기존 JSDoc은 `pauseForConversation` 호출까지만 기술하고 있으며, 이번 변경으로 추가된 `conversationMessages` hydration 로직("비어있을 때만 시드", "WS 경로와 동등" 원칙)이 문서에 반영되지 않았다. `setConversationMessages`가 destructure 목록에 추가되었으나 JSDoc 동작 설명 항목(`-` 불릿)에는 해당 항목이 없다.
  - 제안: JSDoc 동작 설명 목록에 `- ai_conversation waiting 시 store.conversationMessages 가 비어있으면 parseHistoryMessages 로 시드 (WS handleWaitingForInput 동등 패턴; 이미 채워진 경우 보호)` 항목을 추가한다.

- **[INFO]** `parseHistoryMessages` 함수가 이 변경에서 신규 소비자로 추가되었으나, 해당 유틸 함수의 JSDoc/주석에 REST 스냅샷 경로에서도 사용됨을 언급하지 않음
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` (변경 대상 외 파일, 간접 영향)
  - 상세: `parseHistoryMessages`는 기존에 완료된 대화 표시에 사용되었고, 이번에 REST 스냅샷 hydration 경로(`apply-execution-snapshot.ts`)에도 추가 소비자가 생겼다. 유틸 함수 문서에 "WS·REST 양 경로에서 공유 사용" 맥락이 없어 후속 개발자가 side effect를 놓칠 수 있다. 단, 변경된 파일이 아니므로 INFO 등급.
  - 제안: `parseHistoryMessages` 함수의 JSDoc `@remarks` 또는 주석에 `apply-execution-snapshot` 경로에서도 호출됨을 명시하면 유지보수 맥락이 보강된다.

- **[INFO]** plan 문서(`plan/in-progress/agent-session-restore-on-rejoin.md`)의 "Side Effect 점검" 섹션에 spec 변경 불필요 판단이 서술되어 있으나, consistency-check SUMMARY(I-11)에서 "spec §Rationale 에 WS/REST 두 경로 messages 시드 동등 원칙 추가는 project-planner 위임"으로 명시한 후속 항목이 plan에 미체크 상태로 반영되지 않음
  - 위치: `plan/in-progress/agent-session-restore-on-rejoin.md` — "## 작업" 섹션
  - 상세: consistency-check I-11 이 project-planner 위임을 권고하고 있으나 plan 작업 목록에는 해당 항목이 존재하지 않는다. plan이 "모든 항목 완료" 상태로 complete로 이동될 경우 spec Rationale 보완이 추적에서 누락된다.
  - 제안: 작업 목록에 `- [ ] (project-planner 위임) spec §Rationale — WS/REST 두 경로 messages 시드 동등 원칙 기록 (I-11)` 항목을 추가하거나, 완료된 PR과 함께 별도 follow-up plan에 등록한다.

- **[INFO]** 테스트 파일의 `describe` 블록 제목이 변경된 내용을 반영하지 않음
  - 위치: `frontend/src/lib/websocket/__tests__/apply-execution-snapshot.test.ts` — line 317
  - 상세: describe 제목이 `"applyExecutionSnapshot — REST → store bridge (Carousel disabled stuck fix)"`인데, 이번에 추가된 테스트 4건은 `ai_conversation` hydration 기능에 관한 것으로 제목 범위를 넘는다. 테스트 파일 자체에 중요 변경 행위(ai_conversation hydration 신규 진입)를 설명하는 코멘트 블록이 diff에는 존재하지만 실제 describe 계층이 분리되지 않아, 테스트 파일을 처음 보는 독자가 구조를 파악하기 어렵다.
  - 제안: 신규 테스트 4건을 별도 `describe("ai_conversation waiting REST 스냅샷 hydration", () => { ... })` 블록으로 분리해 의도를 명확히 한다. 단, 기능에는 영향 없으므로 INFO.

- **[INFO]** `shouldUpdateStatus`, `mapNodeStatus`, `getCategoryForType` 내부 헬퍼 함수들은 export되어 있으나 JSDoc이 없음 — 이번 변경 범위는 아니지만 헬퍼 그룹에 신규 의존 함수(`setConversationMessages`)가 추가되어 헬퍼 블록 전체 문서화 공백이 강조됨
  - 위치: `frontend/src/lib/websocket/apply-execution-snapshot.ts` — 하단 exported helper 함수 그룹
  - 상세: `inferInteractionTypeFromNodeType`에는 JSDoc이 있지만, `mapNodeStatus`·`getCategoryForType`·`shouldUpdateStatus`에는 JSDoc이 없다. 이번 변경에서 `setConversationMessages` 호출이 추가되었고 `parseHistoryMessages` 임포트가 생겨 파일의 의존 표면적이 넓어졌다.
  - 제안: 다음 리팩토링 시 `mapNodeStatus`·`shouldUpdateStatus`·`getCategoryForType`에 최소 한 줄 JSDoc(`/** ... */`)을 추가한다.

### 요약

이번 변경(`apply-execution-snapshot.ts`의 `ai_conversation` 분기 hydration 추가)은 핵심 함수인 `applyExecutionSnapshot`의 JSDoc이 이미 상세하게 작성되어 있고, 신규 로직(비어있을 때만 시드, WS 경로와 동등)에 대한 인라인 주석도 충분히 제공되어 있어 전반적인 문서화 품질은 양호하다. 테스트 케이스마다 한국어 설명 주석이 붙어 있어 테스트 의도도 명확하다. 다만, 신규 `ai_conversation` hydration 동작이 함수 JSDoc의 동작 설명 목록에 미반영된 점과, consistency-check에서 project-planner 위임을 권고한 spec Rationale 보완 항목이 plan 작업 목록에 누락된 점이 소규모 문서 공백으로 남아 있다. CHANGELOG는 이 프로젝트에서 별도로 관리되지 않는 구조이며 커밋 메시지가 상세하여 대체 기능을 충분히 수행한다.

### 위험도

LOW
