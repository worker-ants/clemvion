# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope=`spec/4-nodes/3-ai/`, diff-base=`origin/main`)
검토 대상: `spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`, `_product-overview.md`

---

## 발견사항

- **[INFO]** `ai-context-memory-followup-v2.md` 의 `[x] 멀티턴 누적 messages 물리 축소` — spec 반영 확인
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 d.6`, `§12.14`
  - 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` (worktree: `ai-context-memory-9c7e6e`)
  - 상세: 2026-06-04 구현 완료로 체크된 항목. target spec 의 §6.2 d.6 (`compactMessagesToTail`, `user` 메시지 경계 불변식, `meta.memory.compactedMessages`) 기술이 plan 완료 기록과 일치한다.
  - 제안: 무충돌. 추적 완료.

- **[INFO]** `ai-context-memory-followup-v2.md` v2 미구현 항목들 — spec 에서 올바르게 v2 예정으로 표시
  - target 위치: `spec/4-nodes/3-ai/0-common.md §10` (`text_classifier`/`information_extractor` inject v2 예정)
  - 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` (`[ ] text_classifier / information_extractor 자동 주입 확장`)
  - 상세: spec 이 "AI Agent 한정 (text_classifier/information_extractor 는 v2)" 로 명시하고, plan 도 동일 항목을 `[ ]` 미완으로 보유. 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 모든 결정 사항이 TBD 상태 — target spec 은 "재작성 예정" 박스로 일관 표시
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` (⚠ 재작성 예정 박스), `§4` (⚠ 재작성 예정), `§6.1 step 3a` (`tool_call_not_implemented` 는 **미구현 (Planned)**)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` (결정 기록: 도구 등록 모델/시그니처/실행 컨텍스트/라우팅/ND-AG-21 모두 TBD)
  - 상세: target spec 이 일반 도구(`tool_*`) 경로를 "재작성 예정 (현재 제거됨)" 으로 박스 처리하고 dispatcher 분류 시 `tool_call_not_implemented` 를 Planned 로 표기한 것은 plan 의 미결 상태와 완전히 정합한다. target 이 일방적으로 `tool_*` 설계를 결정하지 않는다.
  - 제안: 무충돌.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 중 다음 3건이 Step 1 (ancestor 검사) 에서 ACTIVE 판정을 받았으나, Step 2 (GitHub PR state) 에서 MERGED 로 확인되어 stale 처리(squash merge 케이스).

- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 1: ACTIVE (squash로 ancestor 불일치), Step 2: PR #없음(gh pr list 결과 MERGED). 해당 worktree 가 `spec/4-nodes/3-ai/1-ai-agent.md` 를 포함하나 PR 이 이미 머지돼 실제 충돌 없음.
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 1: ACTIVE, Step 2: PR #451 MERGED. 해당 worktree 가 `spec/4-nodes/3-ai/1-ai-agent.md` 를 포함하나 PR 이미 머지됨.
- `workflow-turn-timing-69fee2` (branch `claude/workflow-turn-timing-69fee2`) — Step 1: ACTIVE, Step 2: PR #445 MERGED. 해당 plan 은 `spec/4-nodes/3-ai/` 직접 변경 없음 (websocket-protocol·conversation-thread 위주). 이미 머지됨.

위 3개 worktree 는 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

추가로 `spec-exec-intake-queue`(branch `claude/spec-exec-intake-queue`) 와 `spec-inprogress-impl2`(branch `claude/spec-inprogress-impl2`) 도 Step 1 STALE / Step 2 MERGED — ai spec 을 직접 건드리지 않으나 동일하게 cleanup 권장.

---

## 요약

target 문서(`spec/4-nodes/3-ai/` 5개 파일)는 진행 중인 2개 핵심 plan(`ai-context-memory-auto.md`, `ai-context-memory-followup-v2.md`) 과 완전히 정합한다. 구현 완료된 `§6.2 d.6` 물리 압축 및 v2 미구현 항목의 "예정" 표기 모두 plan 과 일치하며, `ai-agent-tool-connection-rewrite.md` 의 미결 결정(도구 등록 모델 TBD)에 대해서도 target 이 "재작성 예정" 비활성 박스를 유지해 일방적 결정을 내리지 않는다. 선행 plan 미해소나 후속 항목 누락 없음. worktree 충돌 후보 5건은 모두 squash merge stale 로 판정되어 skip — active worktree 와의 실질 경합 0건.

---

## 위험도

NONE
