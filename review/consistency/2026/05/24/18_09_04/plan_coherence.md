# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target 영역: `spec/4-nodes/3-ai`
검토 일시: 2026-05-24
Target Plan: `plan/in-progress/ai-agent-formdata-size-limit.md` (worktree: `ai-agent-formdata-size-limit-2ad8ff`)

---

## 발견사항

### [INFO] multiturn-error-preserve plan 이 plan/in-progress 에 잔류 — 실질 충돌 없음

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §12.7` (신설), `spec/4-nodes/3-ai/0-common.md` (본 target 은 미수정)
- 관련 plan: `plan/in-progress/multiturn-error-preserve.md` — `spec/4-nodes/3-ai/1-ai-agent.md §7.4/§7.9/§7 header/§10`, `spec/4-nodes/3-ai/0-common.md §5` 에 변경 기록
- 상세: `multiturn-error-preserve` plan 의 branch `worktree-multiturn-error-preserve` 는 PR #289 로 2026-05-23 MERGED. 해당 spec 변경 (`§7.x`, `§10`, `0-common.md §5`) 은 이미 main 에 반영됨. target 이 추가하는 `§12.7` 은 Rationale 영역 신규 sub-section 으로, MERGED 된 변경과 섹션 중복 없음. 단, plan 자체가 `plan/in-progress/` 에 잔류 중 — `retry-handler-followup.md` follow-up 작업이 남아 있기 때문. `retry-handler-followup.md` 가 계획하는 spec 변경 대상은 `spec/5-system/4-execution-engine.md` / `spec/5-system/6-websocket-protocol.md` 에 한정되며, `spec/4-nodes/3-ai/` 에 쓰기 대상이 없음 (cross-ref 링크만 존재).
- 제안: 실질 충돌 없음. `multiturn-error-preserve.md` 는 `retry-handler-followup.md` 완료 후 함께 `plan/complete/` 로 이동할 예정 — 별도 cleanup 불필요.

---

### [INFO] ai-agent-tool-connection-rewrite plan — 미결 결정과의 간접 관련

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §12.7`
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정 (TBD)" / §3 "Spec 작성 — `§6.1 step 3a dispatcher` 갱신 예정"
- 상세: `ai-agent-tool-connection-rewrite` plan 은 `§4 Tool Area`, `§6.1 step 3a dispatcher 분류 순서 표` 변경을 예정하고 있으며, 도구 등록 모델·시그니처 위치 등 핵심 결정이 TBD 상태. 그러나 target 이 신설하는 `§12.7` 은 Rationale 절 내 formData 크기 cap 결정 기록이며, `§6.1 step 3a`·`§4 Tool Area` 와 섹션 및 의미적으로 교차하지 않는다. tool-connection-rewrite plan 이 "결정 필요"로 남긴 도구 모델 항목이 formData cap 의 채택 결정을 일방적으로 선점하거나 제약하지도 않는다. 따라서 §점검관점 1 (미해결 결정과의 충돌) 해당 없음. worktree 도 미할당 (plan 에 frontmatter 없음) 이므로 §5 worktree 충돌도 해당 없음.
- 제안: 추적 불필요. 향후 tool-connection-rewrite 가 `§6.1 step 3a` 갱신 시 `§12.7` 을 인지하고 dispatcher 표 순서(`render_*` 포함) 가 formData cap 로직과 연관성이 있는지 재확인 권장 (단순 표 순서 변경이므로 충돌 가능성 낮음).

---

### [INFO] spec-followup-cron-7d-statemachine plan — 쓰기 대상 없음

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §12.7`
- 관련 plan: `plan/in-progress/spec-followup-cron-7d-statemachine.md` (worktree: `spec-followup-cron-7d-statemachine-868886`)
- 상세: 해당 plan 은 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 를 cross-ref 링크로만 참조 (행 설명의 보충 링크). target 파일에 대한 쓰기 대상 없음. 해당 plan 의 branch `claude/spec-followup-cron-7d-statemachine-868886` 는 로컬/원격 git 에 미존재 (worktree 미개시). 충돌 없음.
- 제안: 추적 불필요.

---

### [INFO] node-output-redesign/ai-agent.md — 대상 섹션 비중복

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §12.7`
- 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` — 대상 spec `§7 출력 구조` (§7.1~§7.9)
- 상세: node-output-redesign D1~D6 PR 전체 MERGED (README 명시: "모든 PR 머지 완료"). 잔여 pending 항목 (P0: `buildErrorOutput` + `port:'error'` 추가, P3: 여러 노드 legacy 잔재 제거) 은 "별도 plan + worktree 필요"로 분류되어 현재 활성 worktree 없음. target 의 `§12.7` 은 `§7` 출력 구조 섹션과 별개. 충돌 없음.
- 제안: 추적 불필요.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 결과:

- `worktree-multiturn-error-preserve` (plan field `worktree: multiturn-error-preserve`) — Step 1: `ACTIVE_OR_NOT_FOUND` (branch name 불일치: plan field 는 `multiturn-error-preserve`, 실제 branch 는 `worktree-multiturn-error-preserve`). Step 2: PR #289 `MERGED` (2026-05-23) → **stale** 판정. `.claude/worktrees/` 내 해당 디렉토리 미존재 (이미 정리됨). plan/in-progress 잔류 이유는 `retry-handler-followup.md` follow-up 추적용.

해당 worktree 디렉토리가 이미 제거되어 있어 `./cleanup-worktree-all.sh` 실행 불필요. `multiturn-error-preserve.md` 를 `plan/complete/` 로 이동하는 시점은 `retry-handler-followup.md` 완료 후.

활성 worktree 4건 (chat-channel-e2e-hardening-5ff799 / chore-stale-plan-cleanup-c7e170 / fix-secret-store-root-entities-6aa869 / trigger-create-multi-provider-ui-plan-677f12) 은 모두 `spec/4-nodes/3-ai/` 에 변경 없음 (diff 확인).

---

## 요약

`ai-agent-formdata-size-limit` plan 의 target 변경 (`spec/4-nodes/3-ai/1-ai-agent.md §12.7 신설` + `spec/4-nodes/6-presentation/0-common.md §10.9 (4) layer 행 보강`) 은 진행 중인 다른 plan 과 실질적 충돌이 없다. `multiturn-error-preserve.md` 가 plan/in-progress 에 잔류하지만 해당 branch(PR #289)는 MERGED · worktree 디렉토리 미존재 · 섹션 비중복이므로 stale로 skip했다 (worktree 충돌 후보 1건 중 stale 1건 skip, active 0건). `ai-agent-tool-connection-rewrite` 의 미결 디자인 결정이 §12.7 Rationale 내용을 일방적으로 우회하거나 선점하지 않으며, target 역시 `§6.1 step 3a` 등 미결 영역에 관여하지 않는다. 선행 plan 미해소 및 후속 항목 누락도 없다.

---

## 위험도

NONE

STATUS: OK
