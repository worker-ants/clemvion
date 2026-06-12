# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
Target 문서: `spec/5-system/` (범위: 변경 파일 `spec/5-system/15-chat-channel.md` 중심)
Target worktree: `chat-channel-gaps-e5e3e8` (branch `claude/chat-channel-gaps-e5e3e8`)
검토 시점: 2026-06-12

---

## 발견사항

### 발견사항 1

- **[WARNING]** `spec-sync-webhook-gaps.md` 의 비활성 chatChannel 트리거 항목이 target 구현과 일치하지 않아 후속 혼란 유발 가능
  - target 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` — `§5.5 비활성 trigger` 항목을 `[x]` 로 갱신하며 "이미 구현됨" 으로 기재
  - 관련 plan: `plan/in-progress/spec-sync-webhook-gaps.md` — 동일한 갭 ("비활성 chatChannel 트리거의 202+{ignored:true} 분기 (WH-EP-07)") 을 여전히 `[ ]` (미구현) 으로 기재
  - 상세: `spec-sync-chat-channel-gaps.md` 는 `§5.5 비활성 trigger` 가 이미 구현됨을 확인하고 체크박스를 닫았다. 그러나 같은 갭을 추적하는 `spec-sync-webhook-gaps.md` 의 첫 번째 항목 ("비활성 chatChannel 트리거의 202+{ignored:true} 분기") 은 여전히 열려 있다. 두 plan 이 동일 코드 경로 (`HooksService.handleWebhook` 의 isActive 분기 순서) 를 중복 추적 중이며 하나만 갱신되어 불일치.
  - 제안: `plan/in-progress/spec-sync-webhook-gaps.md` 의 해당 항목을 `[x]` 로 닫고 "spec-sync-chat-channel-gaps.md 에서 동시 해소 확인됨 (2026-06-12)" 을 주석으로 추가. 단 target worktree 에서 직접 수행 가능 (planner 영역).

### 발견사항 2

- **[WARNING]** `auth-config-webhook-followups.md §2` 동일 갭 중복 추적 미해소
  - target 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` — `§5.5 비활성 trigger` `[x]` 완료 기재
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §2` ("chatChannel 트리거 + isActive=false 처리 순서 (review C2)") — 여전히 미착수로 열려 있으며 "chat-channel 도메인에서 재검토 필요" 메모
  - 상세: `auth-config-webhook-followups.md §2` 는 동일 갭을 독립 항목으로 기재하면서 "실제 spec ↔ 코드 불일치인지, 아니면 chat-channel 의 의도된 동작인지 chat-channel 도메인에서 재검토 필요"라고 유예 처리했다. Target 구현은 이 갭이 실제 불일치임을 확인하고 수정했으므로, 해당 §2 항목을 완료 처리해야 한다.
  - 제안: `auth-config-webhook-followups.md §2` 항목에 "chat-channel-gaps-e5e3e8 PR 에서 해소됨 (2026-06-12)" 주석 추가 및 완료 표기. 이 plan 의 worktree (`claude/auth-config-audit`) 는 PR #547 로 MERGED 되었으므로, 해당 plan 파일의 §2 갱신은 직접 main 에서 수행 가능.

### 발견사항 3

- **[INFO]** `spec-sync-chat-channel-gaps.md` frontmatter `worktree` 필드 변경
  - target 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter — `worktree: spec-sync-audit` → `worktree: chat-channel-gaps` 로 변경
  - 관련 plan: 해당 없음 (단순 추적 메모)
  - 상세: 기존 frontmatter 의 `worktree: spec-sync-audit` 은 이 plan 이 `spec-sync-audit` worktree 에서 작성됐음을 나타내는 worktree 기록이었다. target 이 `chat-channel-gaps` 로 변경했는데, `spec-sync-audit` worktree 는 PR #566 등에 의해 이미 main 에 흡수된 상태다. 갱신 자체는 올바르다 — plan-lifecycle 상 현재 활성 worktree 를 표시하는 것이 올바른 사용.
  - 제안: 없음 (정상 갱신).

### 발견사항 4

- **[INFO]** CCH-NF-03 잔여 항목이 spec/5-system/15-chat-channel.md 에 Planned 표기로 남아있는지 확인 필요
  - target 위치: `spec/5-system/15-chat-channel.md` 의 CCH-NF-03 관련 섹션
  - 관련 plan: `plan/in-progress/spec-sync-chat-channel-gaps.md` — CCH-NF-03 는 여전히 `[ ]` (별 PR 로 분리)
  - 상세: target 이 CCH-CV-03 (b), §5.5, §5.4 rotate-bot-token 3건을 구현하고 CCH-NF-03 을 잔여로 남겼다. spec diff 에는 CCH-NF-03 관련 변경이 없으므로, spec 이 CCH-NF-03 를 "Planned/미구현" 으로 이미 표기하고 있는지 확인 권장. 만약 spec 이 CCH-NF-03 를 구현된 것처럼 서술 중이라면 gap callout 추가 필요.
  - 제안: spec 담당자가 `15-chat-channel.md` CCH-NF-03 표기를 점검. plan-lifecycle 상 잔여 항목이 있는 plan 은 `in-progress/` 에 계속 유지 — 올바름.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석:

| worktree | branch | §5번 충돌 후보 여부 | 판정 |
|---|---|---|---|
| `chat-channel-followups-residual-1be5d3` | `claude/chat-channel-followups-residual-1be5d3` | `plan/in-progress/spec-sync-chat-channel-gaps.md` 동시 수정 | Step 1 ACTIVE (squash merge — commit hash 불일치), Step 2 PR `MERGED` → **stale** |
| `refactor-04-security-286de9` | `claude/refactor-04-security-286de9` | `spec/5-system/1-auth.md` 간접 언급 | Step 1 → ancestor of main → **stale** |

**stale skip 목록**:

- `chat-channel-followups-residual-1be5d3` (branch `claude/chat-channel-followups-residual-1be5d3`) — Step 1 ACTIVE (squash merge 로 ancestor 아님), Step 2 PR MERGED. `spec-sync-chat-channel-gaps.md` 를 동시 수정했으나 squash merge 로 이미 main 흡수. target 과의 실질 경합 없음.
- `refactor-04-security-286de9` (branch `claude/refactor-04-security-286de9`) — Step 1 ancestor of main (STALE). `spec/5-system/1-auth.md` 를 건드렸던 이전 PR 이지만 완전 흡수됨.

두 worktree 모두 활성 작업이 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**target worktree 자체** (`chat-channel-gaps-e5e3e8`, `claude/chat-channel-gaps-e5e3e8`): Step 1 ACTIVE, Step 2 PR 없음 (open) — active 정상.

---

## 요약

target (`chat-channel-gaps-e5e3e8`) 이 `spec/5-system/15-chat-channel.md` 에서 CCH-CV-03 (b) 분기 구현, §5.4 rotate-bot-token 응답 3필드 추가, §5.5 비활성 트리거 이미-구현 확인의 3건을 반영하면서 `spec-sync-chat-channel-gaps.md` 체크박스를 갱신했다. 미해결 결정을 우회하거나 선행 plan 미해소 상태에서 일방적 결정을 내리는 CRITICAL 급 충돌은 없다. 주된 문제는 같은 갭을 중복 추적하던 `spec-sync-webhook-gaps.md` 와 `auth-config-webhook-followups.md §2` 가 갱신되지 않아 plan 들 사이 상태 불일치가 남는 것(WARNING 2건)이다. worktree 충돌 후보 3건 중 stale 2건 skip, active 1건 (target 자체) 분석.

---

## 위험도

LOW
