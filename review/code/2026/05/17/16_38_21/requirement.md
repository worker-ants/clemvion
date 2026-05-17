# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** `selectedConversationItemIndex` 보호 로직의 검증 범위 불완전
  - 위치: `apply-execution-snapshot.ts` L907-912, 테스트 케이스 "messages 가 비어있으면 setConversationMessages 호출 안 함"
  - 상세: 빈 messages no-op 테스트는 `selectedConversationItemIndex: 3` 이 유지되는지를 명시적으로 검증하지 않는다. `expect(state.conversationMessages).toEqual([])` 만 확인하고 `selectedConversationItemIndex` 가 3 으로 유지되는지는 검사하지 않으므로 주석에서 서술한 "selectedConversationItemIndex 가 reset 될 수 있으니 보호" 의 실제 효과를 단언하지 않는다. 주석의 의도와 테스트의 구현이 완전히 일치하지 않는다.
  - 제안: `expect(state.selectedConversationItemIndex).toBe(3)` 단언을 추가해 주석에서 서술한 보호 효과를 명시적으로 검증한다.

- **[INFO]** `inconsistent snapshot` 경로에서 `conversationMessages` 의 hydration 경로가 테스트되지 않음
  - 위치: `apply-execution-snapshot.ts` L1059-1084, `apply-execution-snapshot.test.ts` "inconsistent snapshot" 관련 테스트
  - 상세: `reconcileToWaiting` 이 true 인 경로(execution.status='running' + nodeExecution.status='waiting_for_input')에서도 `effectiveExecutionStatus === 'waiting_for_input'` 분기로 진입하여 ai_conversation hydration 로직이 실행된다. 그러나 기존 inconsistent snapshot 테스트들은 모두 `ai_conversation` 이 아닌 `buttons` 타입으로 설정되어 있어, reconcile 경로에서 conversationMessages hydration 이 정상 동작하는지 검증되지 않는다. 특히 페이지 재진입 시 가장 문제가 되는 상황(WS 미연결 + inconsistent snapshot + ai_conversation)은 테스트 공백이다.
  - 제안: `inconsistent snapshot (prevStatus=running) + ai_conversation` 조합에 대한 테스트 케이스를 추가하여 `reconcileToWaiting` 경로에서도 conversationMessages hydration 이 올바르게 동작함을 검증한다.

- **[INFO]** legacy flat shape (`outputData.messages`) 에 대한 hydration 단위 테스트 없음
  - 위치: `apply-execution-snapshot.ts` L908, `parseHistoryMessages` 내부 fallback 로직
  - 상세: 커밋 메시지는 "outputData.output.result.messages (구조화) / outputData.output.messages (legacy nested) / outputData.messages (flat) 세 가지 shape 모두 처리" 라고 명시하나, 추가된 4건의 테스트는 전부 `output.result.messages` 구조화 shape 만 사용한다. `parseHistoryMessages` 자체가 세 가지를 처리하더라도, `applyExecutionSnapshot` 경로에서 legacy shape 이 들어올 때 end-to-end 로 hydration 이 이루어지는지 snapshot 레벨에서 검증이 없다.
  - 제안: legacy flat shape(`outputData.messages`) 또는 `outputData.output.messages` shape 를 사용하는 테스트 케이스를 1건 이상 추가하여 커밋 메시지의 선언과 테스트 커버리지를 일치시킨다.

- **[INFO]** `turnDebug` 의 다중 llmCalls (tool-call 포함 다회 LLM 호출) 케이스 미검증
  - 위치: `apply-execution-snapshot.test.ts` "meta.turnDebug 로 assistant 메시지의 model 정보가 attach 됨" 테스트 (L172-230)
  - 상세: 테스트는 `llmCalls` 배열에 항목 1개만 존재하는 단순 케이스를 검증한다. function calling 이 발생하면 단일 turn 에 여러 assistant 메시지와 tool 메시지가 섞이고 `llmCalls` 에 2개 이상의 항목이 존재한다. `messagesToConversationItems` 의 `assistantIdxInTurn` 기반 매핑이 REST hydration 경로에서도 올바르게 동작하는지는 확인되지 않는다.
  - 제안: tool call 이 포함된 다회 LLM 호출 시나리오 케이스를 추가하거나, 해당 케이스가 `parseHistoryMessages` 단위 테스트에서 이미 커버된다면 그 사실을 주석으로 명시하여 추적 가능성을 높인다.

- **[INFO]** plan 파일 체크리스트 완료 상태이나 `complete/` 이동이 이 PR 에 포함되지 않음
  - 위치: `plan/in-progress/agent-session-restore-on-rejoin.md`
  - 상세: 모든 체크박스가 `[x]` 로 표시되어 있고 미해결 follow-up 도 없다. CLAUDE.md 의 PLAN 문서 라이프사이클 규약에 따르면 "모든 항목이 완료된 순간에 complete/ 로 이동"하고 "이동은 마지막 작업 PR 안에서 처리" 해야 한다. 이 PR 이 마지막 작업 PR 인지 확인이 필요하며, 만약 그렇다면 `git mv` 누락이다.
  - 제안: 이 PR 이 최종 PR 이라면 `git mv plan/in-progress/agent-session-restore-on-rejoin.md plan/complete/agent-session-restore-on-rejoin.md` 를 추가하고 `chore(plan): mark agent-session-restore-on-rejoin complete` 커밋을 포함시킨다.

## 요약

이번 변경은 페이지 재진입 시 AI Agent 대화 메시지가 복원되지 않는 회귀를 REST 스냅샷 경로(`apply-execution-snapshot.ts`)에 `parseHistoryMessages` 기반 hydration 로직을 추가해 해소한다. 핵심 요구사항(비어있을 때만 시드, WS 우선 보호, turnDebug 매핑)은 코드와 테스트에 올바르게 반영되어 있으며, 구현 의도와 실제 동작 간 결정적 괴리는 없다. 다만 네 가지 INFO 항목이 존재한다: (1) `selectedConversationItemIndex` 보호를 주장하는 테스트가 그 단언을 빠뜨린 점, (2) reconcile 경로(`inconsistent snapshot + ai_conversation`)의 테스트 공백, (3) 커밋 메시지가 선언한 세 가지 shape 중 두 가지(legacy)에 대한 스냅샷 레벨 검증 부재, (4) plan 이동 누락 가능성. 모두 기능 동작 자체를 차단하지는 않으나 회귀 방어망의 완전성을 낮춘다.

## 위험도

LOW
