# Plan 정합성 검토 결과

검토 모드: `--impl-done` | 검토 대상: `spec/4-nodes/3-ai/` | 기준: `origin/main`
검토일: 2026-06-04

---

## 발견사항

### [WARNING] `ai-agent-tool-connection-rewrite` — 미해결 결정과의 관계 (§4 Tool Area 비활성 박스 유지)

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §4 (Tool Area 연동) + §6.1 step 3a dispatcher 분류
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정 (사용자 합의 필요)" — 5개 항목 모두 TBD
- **상세**: target(`1-ai-agent.md`)의 §4 는 "재작성 예정 (현재 제거됨)" 박스와 §6.1 step 3a dispatcher 분류 순서(`cond_* → kb_* → mcp_* → render_* → tool_*` 5단계) 를 유지하고 있다. `ai-agent-tool-connection-rewrite` plan 은 디자인 결정 5개 항목이 여전히 TBD 이며 착수 전 상태(worktree 미할당)다. target 이 §4 비활성 상태를 그대로 유지하고 있으므로 `tool_*` 관련 결정을 일방적으로 내리는 충돌은 없다. 단, plan 이 "§3 Spec 작성 단계에서 dispatcher 분류 순서 표를 갱신해야 한다"고 명시한 의존성이 target 에 남아 있어 후속 spec 편집 시 병합 충돌 위험이 존재한다.
- **제안**: 즉시 차단 불요. `ai-agent-tool-connection-rewrite` plan §결정 기록이 채워질 때 target `1-ai-agent.md` §6.1 step 3a 표의 dispatcher 분류 서술을 함께 갱신해야 함을 plan 에 명시 추가 권장.

---

### [INFO] `ai-context-memory-followup-v2` — 미구현 surface 5건이 pending_plans 로 올바르게 추적됨

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` / `1-ai-agent.md` frontmatter `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]`
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` 미구현 surface 5건 (persistent 증분 추출/TTL/추출 분류 깊이/메모리 가시화 UI/text_classifier·information_extractor 자동 주입)
- **상세**: target spec 들이 `status: partial` + `pending_plans` 로 올바르게 미완 상태를 표시하고 있으며, v2 plan 에서 체크된 항목(멀티턴 messages 물리 압축 — 본 worktree 구현)과 미체크 항목의 구분이 plan ↔ spec 간 정합하다. 충돌 없음.
- **제안**: 추적 상태 양호. 별도 조치 불요.

---

### [INFO] `ai-context-memory-followup-v2` — v2 코드 리뷰 도출 백로그 5건 미반영

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5, `spec/4-nodes/3-ai/_product-overview.md` (ND-AG-30)
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` §v2 코드 리뷰 도출 백로그 — `§6.2 d.5 본문에 auto-memory multi-turn 실행 경로 부연(SPEC-DRIFT I-2)`, `meta.memory.compactedMessages 를 _product-overview ND-AG-30 열거에 등재(naming I-7)` 등 5건 미완료
- **상세**: 이 항목들은 plan 에 `[ ]` (미완료) 체크박스로 명시되어 있으며 본 worktree 의 구현 완료 후 spec 정밀화 후속 작업으로 남겨진 것이다. target spec 이 해당 사항들을 누락하고 있는 점은 plan 과 일치하므로 정합 불일치가 아니다. 단, 일부 항목(특히 `ND-AG-30` 에 `compactedMessages` 미등재)은 spec-impl 드리프트 경고로 향후 spec-coverage 검토에서 지적될 수 있다.
- **제안**: 별도 조치 불요. 후속 spec 정밀화 PR 에서 v2 백로그 항목을 처리할 때 반영.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

| worktree | branch | 판정 방법 | 결과 |
|---|---|---|---|
| `fix-spec-frontmatter-catalog` | `claude/fix-spec-frontmatter-catalog` | Step 2: PR #453 MERGED | **stale** — skip |
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | Step 2: PR #451 MERGED | **stale** — skip |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-impl2` | Step 1: merge-base ancestor 검사 STALE | **stale** — skip |

두 worktree(`fix-spec-frontmatter-catalog`, `fix-bg-context-followups`) 는 `spec/4-nodes/3-ai/1-ai-agent.md` 를 수정하고 있으나 PR 이 MERGED 상태(squash merge — Step 1 에서 ancestor 미검출, Step 2 에서 MERGED 확인)이므로 worktree 충돌 분석 대상에서 제외한다. 활성으로 남아있을 이유가 없으며 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**active worktree 중 `spec/4-nodes/3-ai/` 를 동시 수정하는 branch 없음** — CRITICAL worktree 충돌 0건.

---

## 요약

`spec/4-nodes/3-ai/` target 문서군은 `ai-context-memory-followup-v2` plan 과 정합하게 `status: partial` + `pending_plans` 를 유지하고 있으며, 미해결 결정(tool_*) 을 일방적으로 내리지 않고 있다. worktree 충돌 후보 3건 모두 stale(PR MERGED / ancestor) 로 판정되어 active 충돌은 0건이다. 주요 경고는 `ai-agent-tool-connection-rewrite` plan 의 TBD 결정이 채워질 때 target spec §6.1 step 3a 와의 동기화가 필요하다는 후속 의존성이다(즉시 차단 수준 아님). worktree 충돌 후보 3건 중 stale 3건 skip, active 0건 분석.

---

## 위험도

LOW
