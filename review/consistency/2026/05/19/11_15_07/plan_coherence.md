# Plan 정합성 검토 결과

검토 대상 plan: `plan/in-progress/ai-agent-turn-fail-finalize.md`
worktree: `ai-agent-turn-fail-finalize-a22724`
검토 일시: 2026-05-19
모드: --impl-prep

---

## 발견사항

### [INFO] node-output-redesign P0 항목과의 역할 분담 명확 — 충돌 없음

- target 위치: `plan/in-progress/ai-agent-turn-fail-finalize.md` 전체
- 관련 plan: `plan/in-progress/node-output-redesign/README.md` §Phase E P0, `plan/in-progress/node-output-redesign/ai-agent.md` §종합 개선안 (impl) CRITICAL 항목
- 상세: `node-output-redesign/README.md` 는 ai-agent 에러 컨트랙트 미구현을 P0 으로 분류하고 "별도 plan + worktree 필요" 를 명시하고 있다. `ai-agent-turn-fail-finalize.md` 가 바로 그 별도 plan 이다. 두 plan 이 동일 gap 을 지목하지만 역할이 분리되어 있다: `node-output-redesign` 는 분석·인덱스이고, `ai-agent-turn-fail-finalize` 가 실 구현 plan 이다. 단, `node-output-redesign/ai-agent.md` 의 CRITICAL 체크박스 (`[ ] (impl) **CRITICAL** executeSingleTurn / executeMultiTurn / processMultiTurnMessageInner 의 llmService.chat 호출을 try/catch 로 감싸...`) 가 아직 미완료 상태로 남아 있다. target plan 이 완료되면 이 체크박스를 `[x]` 로 갱신해야 한다.
- 제안: target plan 완료 시 `plan/in-progress/node-output-redesign/ai-agent.md` 의 해당 `(impl) CRITICAL` 체크박스를 `[x]` 처리하고, `node-output-redesign/README.md` Phase 2 표의 ai-agent `impl 6` 카운트를 반영하도록 plan 갱신. target plan 에 이 후속 갱신 항목을 "완료 후 처리" 메모로 추가 권장.

### [INFO] node-output-redesign/ai-agent.md 의 handler try/catch 범위 차이 — 확인 필요

- target 위치: `plan/in-progress/ai-agent-turn-fail-finalize.md` §1 변경 범위 1), 2)
- 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` §종합 개선안 (impl) CRITICAL
- 상세: `node-output-redesign/ai-agent.md` 는 `executeSingleTurn` / `executeMultiTurn` / `processMultiTurnMessageInner` 의 handler 내부 try/catch 추가를 제안한다 (text-classifier / information-extractor 패턴 재사용). 반면 target plan `ai-agent-turn-fail-finalize.md` 는 `execution-engine.service.ts` 의 `handleAiMessageTurn` 에 try/catch 를 추가하는 engine 레벨 접근을 채택한다. 두 접근은 상호 배타적이지 않으나 (handler 내부 + engine 레이어 양쪽 가능), target plan 이 handler 내부 try/catch 를 추가하지 않고 engine 레이어에서만 잡으면 single-turn 에러 라우팅 (`spec §7.3`) 은 여전히 미구현 상태로 남는다. target plan 의 "신규 spec 없음, multi-turn 픽스만" 이라는 명시 scope 와는 일치하지만, `node-output-redesign` 의 CRITICAL 항목이 single-turn 포함 전체 try/catch 를 기대한다는 점에서 후속 미해소 gap 이 발생할 수 있다.
- 제안: target plan 은 multi-turn 경로만 fix 하는 것이 명시 scope 이므로 작업 자체는 적절하다. 단, plan 의 "후속 (본 PR 범위 외)" 절에 "단일 turn 의 `executeSingleTurn` / `executeMultiTurn` handler 내 try/catch (spec §7.3) 는 node-output-redesign P0 의 잔여 범위로 별도 PR" 메모를 추가해 scope 경계를 명시화하는 것을 권장한다.

### [INFO] 활성 worktree 단독 — 동시 경합 없음

- target 위치: `plan/in-progress/ai-agent-turn-fail-finalize.md` frontmatter `worktree: ai-agent-turn-fail-finalize-a22724`
- 관련 plan: 모든 in-progress plan
- 상세: `git worktree list` 결과, 현재 활성 worktree 는 `ai-agent-turn-fail-finalize-a22724` 단 하나이다. `node-output-redesign` 에서 언급된 `conversation-thread-e509c5` worktree 는 현재 활성화되어 있지 않다. 다른 in-progress plan (`merge-p2-async-fanin`, `replay-rerun`, `parallel-p2`, `ai-timezone-context-followups` 등) 은 worktree 가 TBD 이거나 미할당 상태이다. 동시 파일 경합 위험 없음.
- 제안: 추적 메모로 충분. 조치 불필요.

### [INFO] spec/5-system/4-execution-engine.md — 읽기만, 쓰기 없음

- target 위치: `plan/in-progress/ai-agent-turn-fail-finalize.md` §배경 및 §변경 범위
- 관련 plan: `plan/in-progress/replay-rerun.md` (§6.3 cross-link 갱신 완료, PR1 완료)
- 상세: target plan 은 `spec/5-system/4-execution-engine.md §54` 의 `ended` 정의를 근거로 참조하나, spec 파일을 수정하는 작업 항목은 없다 (plan 에 "신규 spec 없음" 명시). `replay-rerun.md` 는 동일 파일의 §6.3 을 이미 PR1 에서 수정 완료했으므로 해당 섹션은 main 에 반영된 상태이며 경합 없다.
- 제안: 조치 불필요.

### [INFO] spec/conventions/conversation-thread.md — 간접 관련, 직접 경합 없음

- target 위치: 검토 scope 메타 ("충돌 가능 영역: spec/conventions/conversation-thread.md mutation 진입점")
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` (`conversation-thread-e509c5` worktree 참조)
- 상세: 검토 scope 는 `conversation-thread.md` 를 충돌 가능 영역으로 적시했다. target plan 의 실제 변경 항목을 분석하면, `ai-agent.handler.ts` 의 `endMultiTurnConversation` 에 `endReason='error'` 분기를 검증·보강하고, `execution-engine.service.ts` 에 try/catch + `handleAiTurnError` helper 를 추가하는 것이다. 두 변경 모두 `ConversationThread` spec 의 mutation 진입점 규약 (`pushAiTurn` / `threadHolderFromState` 패턴) 과 직접 충돌하지 않는다. error 종결 경로에서는 새 ConversationThread turn 을 push 하지 않고 기존 `_resumeState` 의 누적 결과를 output 으로 뽑아내는 것이기 때문이다. `conversation-thread-e509c5` worktree 는 현재 비활성 상태이며 `ai-agent-tool-connection-rewrite.md` 에서만 선행 조건으로 언급되고 있다. target plan 은 그 선행 조건과 무관한 scope 이다.
- 제안: 조치 불필요. 단, error 종결 경로에서 ConversationThread push 가 발생하지 않는다는 의도를 plan 이나 코드 주석에 명시하면 추후 리뷰어가 확인할 수 있다.

---

## 요약

target plan `ai-agent-turn-fail-finalize.md` 는 `node-output-redesign` 에서 명시적으로 예고된 P0 별도 plan 이며, 미해결 결정을 일방적으로 우회하거나 다른 plan 과 worktree 를 경합시키는 문제는 없다. 유일한 주의 사항은 scope 경계다: target plan 이 완료되면 `node-output-redesign/ai-agent.md` 의 CRITICAL 체크박스 갱신이 필요하고, single-turn 에러 라우팅 (spec §7.3) 은 본 plan scope 밖임을 명시화해 두면 후속 추적이 용이하다. 동시 활성 worktree 는 현재 본 plan 하나뿐이므로 worktree 경합 위험 없음.

---

## 위험도

LOW
