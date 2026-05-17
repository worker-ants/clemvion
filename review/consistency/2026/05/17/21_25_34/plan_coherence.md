### 발견사항

- **[INFO]** ai-thread-source-mark plan 의 Phase 2 (`handleAiMessageTurn` WS emit 경로) 가 target 구현 파일과 중복됨
  - target 위치: `plan/in-progress/ai-agent-multiturn-waiting-persist.md` — 구현 대상 `execution-engine.service.ts:handleAiMessageTurn`
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Phase 2 항목 "handleAiMessageTurn 의 ai_message emit 분기 (waiting/terminal 둘 다) 에서 condMessages 가 source 를 보존하도록 확인"
  - 상세: 두 plan 이 모두 `execution-engine.service.ts` 의 `handleAiMessageTurn` 메서드를 수정 대상으로 지목한다. `ai-agent-multiturn-waiting-persist` 은 해당 분기에 `nodeExecutionRepository.save()` 를 추가하고, `ai-thread-source-mark` Phase 2 는 같은 분기의 WS emit 로직에서 `condMessages` 의 `source` 보존 여부를 확인·처리한다. 동시에 같은 메서드를 별도 worktree 에서 편집하면 merge 충돌이 발생할 수 있다. 단, `ai-thread-source-mark` 의 worktree는 `ai-thread-source-mark-7c4f2a` 로 현재 별도 분기에 존재하며, 이 worktree (`ai-agent-multiturn-persist-8bddbf`) 와는 다른 worktree다. `ai-thread-source-mark` Phase 2 가 착수 전 체크박스 미체크 상태이므로 실제 충돌은 잠재적 위험.
  - 제안: `ai-thread-source-mark.md` Phase 2 체크리스트에 "ai-agent-multiturn-waiting-persist PR 머지 후 rebase 필요" 주석을 추가하거나, 두 plan 의 순서 의존성을 명시한다.

- **[INFO]** agent-session-restore-on-rejoin plan 이 이미 완료됐으나 plan/in-progress 에 잔류
  - target 위치: `plan/in-progress/agent-session-restore-on-rejoin.md` 전체
  - 관련 plan: 해당 plan 내부 체크리스트 — 모든 항목 `[x]` 체크 완료. Follow-up 1건 `[ ]` 미완.
  - 상세: spec 변경 불요 판정 및 frontend 구현·테스트·리뷰까지 모두 `[x]` 상태. 단, Follow-up 절에 `[ ]` 미완 항목 1건 남아 있다: "spec/5-system/6-websocket-protocol.md 또는 spec/4-nodes/3-ai/1-ai-agent.md 의 Rationale 에 WS/REST 두 경로의 conversation messages 시드 동등 원칙 기록. project-planner 위임." Follow-up 이 하나라도 열려 있으므로 CLAUDE.md 기준 in-progress 유지가 옳다. 이 plan 이 target(`spec/4-nodes/3-ai/`) 을 읽기 참조하므로 충돌이 아닌 기록 차원의 메모.
  - 제안: Follow-up 이 project-planner 위임 항목이므로 별도 spec-update plan 으로 분리하거나, project-planner 가 해당 Rationale 을 작성한 후 `[x]` 처리하면 plan complete 이동 가능함을 추적.

- **[INFO]** node-output-redesign Phase E P0 항목(ai-agent error builder)이 target spec 과 연동되며 별도 plan 미작성 상태
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 / §7.9 (`output.error` + `port:'error'` 에러 라우팅 정의)
  - 관련 plan: `plan/in-progress/node-output-redesign/README.md` Phase E "P0 — ai-agent buildErrorOutput + port:'error' 추가. 별도 plan + worktree 필요" 및 `ai-agent.md` 잔여 권고 "(2026-05-16 신규) handler 가 output.error envelope + port:'error' 빌더를 보유하지 않음"
  - 상세: Phase E P0 는 "별도 plan + worktree 필요" 로 명시됐으나 현재 `plan/in-progress/` 에 해당 plan 이 없다. target spec 의 §7.3 / §7.9 는 에러 케이스의 올바른 shape 을 이미 정의하고 있으므로 target impl prep(이번 검토) 이후 developer 가 구현에 착수했을 때, spec 에 이미 정의된 에러 포트 라우팅과 핸들러 미구현 사이의 갭이 존재함. 이 갭은 spec 정의와 충돌이 아닌 누락이다.
  - 제안: `ai-agent-multiturn-waiting-persist` 구현 단계에서 `llmService.chat` throw 시 엔진 FAILED 전파 경로와 만날 가능성이 있으므로, 해당 plan 에 "P0 에러 builder 는 별도 plan 에서 처리 — 본 작업의 handleAiMessageTurn 에러 분기와 구분" 을 주석으로 명시하면 유용.

- **[INFO]** D6 결정(2026-05-17)으로 spec 출력 구조가 갱신됐고 target 이 이를 정확히 반영함 — 정합 확인
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4/§7.5 내 D6 결정 주석 (`output.result.messages` 단일 경로 통일)
  - 관련 plan: `plan/in-progress/node-output-redesign/README.md` D6 ✅ #157 머지 완료 표기
  - 상세: D6 PR #157 이 이미 머지됐고 spec 에 반영되어 있다. `ai-agent-multiturn-waiting-persist` 구현은 동일 D6 경로(`output.result.messages`)를 전제로 작성됐으므로 정합. 별도 조치 불요.

### 요약

Plan 정합성 관점에서 target(`spec/4-nodes/3-ai/`) 과 진행 중 plan 들은 전반적으로 잘 정렬되어 있다. CRITICAL 또는 WARNING 등급의 위반 사항은 발견되지 않았다. 주요 관찰은 다음과 같다: (1) `ai-agent-multiturn-waiting-persist` 와 `ai-thread-source-mark` Phase 2 가 동일한 `handleAiMessageTurn` 메서드를 각각 수정 예정이므로 순서 의존성을 plan 에 명시하면 merge 충돌 위험을 줄일 수 있다. (2) `agent-session-restore-on-rejoin` 의 Follow-up 미완 항목 1건 때문에 in-progress 상태가 적절히 유지되고 있다. (3) `node-output-redesign` Phase E P0(ai-agent error builder) 용 별도 plan 이 미작성 상태이나 이는 target 구현 착수와 직접 충돌하지 않는다. D6 결정이 이미 완료됐고 target spec 이 이를 반영하고 있으므로 미해결 결정과의 충돌은 없다.

### 위험도

LOW
