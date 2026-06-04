# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/3-ai/)
검토 대상: `spec/4-nodes/3-ai/` (worktree `ai-context-memory-9c7e6e`, Phase A 완료 후 상태)

---

## 발견사항

### [INFO] plan §5 미해결 항목 3개 중 2개가 §3.1·spec §6에서 사실상 해소됨 — plan 체크박스 미반영
- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-context-memory-9c7e6e/plan/in-progress/ai-context-memory-auto.md` §5 (lines 154–156)
- 관련 plan: `plan/in-progress/ai-context-memory-auto.md` §5 "미해결 / 결정 필요"
- 상세:
  - `[ ] 신규 system spec 문서 번호` — §3.1에서 `spec/5-system/17-agent-memory.md` 로 확정 채번됨. 체크박스 미반영.
  - `[ ] 요약 LLM 콜이 쓰는 모델` — §3.1에서 "노드 `model`/`llmConfigId` 재사용"으로 확정. 체크박스 미반영.
  - `[ ] persistent 추출 스키마(fact/preference/entity 분류 깊이)` — `spec/5-system/17-agent-memory.md` §6 v2 로드맵에서 "v1은 단순 텍스트 사실 단위로 충분, 구조화 분류·dedup·갱신은 v2"로 명시됨. 사실상 v1 범위 결정이 내려진 것이므로 추적 목적으로만 남아있는 상태.
- 제안: plan §5 의 세 항목을 모두 `[x]`로 갱신하거나, 체크 후 "(Phase A에서 확정됨)" 부기 추가. Phase B 착수 전 혼란 방지.

### [INFO] `1-ai-agent.md` spec의 `pending_plans`에 `ai-context-memory-auto.md`가 추가됐으나 `0-common.md`에는 `ai-agent-tool-connection-rewrite.md`가 미등재
- target 위치: `spec/4-nodes/3-ai/0-common.md` frontmatter (worktree 내)
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 — "본 plan §3 Spec 작성 단계에서 `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a 의 dispatcher 분류 순서 표를 갱신해야 한다"
- 상세: `1-ai-agent.md`의 `pending_plans`에는 `ai-agent-tool-connection-rewrite.md`가 정상 등재. `0-common.md`는 `ai-context-memory-auto.md`만 등재. `ai-agent-tool-connection-rewrite.md`는 `0-common.md` 직접 수정 계획이 없으므로 현 상태가 정합 — 추적 메모 수준.
- 제안: 현 상태 유지. `ai-agent-tool-connection-rewrite.md` spec 작성 단계에서 `0-common.md`를 건드릴 필요가 있으면 그 시점에 `pending_plans` 추가.

### [INFO] `fix-bg-context-followups` worktree (PR OPEN, ACTIVE) — 파일 충돌 없음
- target 위치: 해당 없음
- 관련 plan: `plan/in-progress/background-context-key-followups.md` (worktree `fix-bg-context-followups`)
- 상세: 해당 worktree가 수정하는 파일은 `spec/5-system/4-execution-engine.md`, `spec/conventions/execution-context.md`, `codebase/backend/src/modules/execution-engine/execution-context.service.*`, `execution-engine.service.*`. target (`spec/4-nodes/3-ai/`) 과 겹치는 파일 없음 — worktree 충돌 아님.
- 제안: 조치 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검사 결과: 총 4개 worktree에 대해 cascade 판정 수행.

| worktree | branch | Step 1 | Step 2 | 판정 |
|---|---|---|---|---|
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-groom-c7568b` | ACTIVE (not ancestor) | PR MERGED | **stale** (Step 2) |
| `followup-conversation-reconcile` | `claude/followup-conversation-reconcile` | ACTIVE (not ancestor) | PR MERGED | **stale** (Step 2) |
| `workflow-turn-timing-69fee2` | `claude/workflow-turn-timing-69fee2` | ACTIVE (not ancestor) | PR MERGED | **stale** (Step 2) |
| `spec-sync-audit` | `claude/spec-sync-audit` | ACTIVE (not ancestor) | PR MERGED | **stale** (Step 2) |

위 4개 worktree는 모두 squash/rebase merge로 PR이 MERGED 종결됨. 활성으로 남아있을 이유 없음.

`./cleanup-worktree-all.sh --yes --force` 실행을 권장.

활성(ACTIVE) worktree로 분석된 후보:
- `fix-bg-context-followups` — Step 1 ACTIVE, Step 2 PR OPEN → **active**. 파일 충돌 없음 (상기 INFO 참조).
- `makeshop-api-catalog-730deb` — Step 1 ACTIVE, Step 2 PR 없음(empty) → Step 3 fallback, **active**. 수정 파일이 makeshop 전용 codebase + 별도 plan/review 파일로 target(`spec/4-nodes/3-ai/`)과 충돌 없음.

---

## 요약

`spec/4-nodes/3-ai/` (worktree `ai-context-memory-9c7e6e`) 의 Phase A 완료 상태는 plan `ai-context-memory-auto.md` 와 전반적으로 정합하다. 미해결 결정 우회, 선행 plan 미해소, active worktree 동시 수정 충돌은 발견되지 않았다. 지적 사항은 모두 INFO 수준으로 ①plan §5 체크박스 갱신 미반영(추적 정확도), ② 파일 비충돌 worktree 존재 안내에 그친다. `ai-agent-tool-connection-rewrite.md`의 미결정 설계(TBD 항목들)는 `spec/4-nodes/3-ai/1-ai-agent.md` §4 "재작성 예정" 박스로 명시적으로 격리돼 있어 target spec과 충돌하지 않는다. Phase B 이후 구현 착수를 차단할 요인 없음. worktree 충돌 후보 6건 중 stale 4건 skip, active 2건 분석(파일 충돌 없음).

---

## 위험도

NONE
