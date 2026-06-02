# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target: `spec/4-nodes/4-integration/` (전체 5문서)
Current plan: `plan/in-progress/cafe24-install-ratelimit.md` (worktree `cafe24-install-ratelimit-2891d1`)

---

## 발견사항

### [INFO] node-output-redesign P2 항목이 target 과 관련되나 active worktree 없음

- target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §1 `pagination` 필드
- 관련 plan: `plan/in-progress/node-output-redesign/README.md` §"진행 상태 요약" P2 — "Cafe24 §1 pagination `cursor?: string` spec 정정"
- 상세: node-output-redesign plan 이 `4-cafe24.md §1` 의 pagination `cursor` 필드 정정을 P2 항목으로 열거하고 있다. 그러나 node-output-redesign 폴더에는 할당된 active worktree 가 없고, 본 cafe24-install-ratelimit plan 이 변경하는 영역은 `§9.8` (install endpoint 보안) 및 `spec/2-navigation/4-integration.md §9` (install endpoint 행) 으로 `§1` 과는 다른 섹션이다. 직접적 충돌은 없으나, 추후 node-output-redesign P2 착수 시 동일 파일을 손댈 예정임을 인지해야 한다.
- 제안: 특별 조치 불필요. node-output-redesign 착수 시 본 plan 의 §9.8 상수 테이블 변경 내용을 해당 plan 에서 재확인.

### [INFO] cafe24-restricted-scopes-followups §3 — 동일 파일(`4-cafe24.md`) 접근, 다른 섹션

- target 위치: `spec/4-nodes/4-integration/4-cafe24.md` (전반)
- 관련 plan: `plan/in-progress/cafe24-restricted-scopes-followups.md` §1 (AI Agent allowlist UI) · §3 (store `privacy_*` prefix 재명명)
- 상세: `cafe24-restricted-scopes-followups.md` 는 worktree `TBD (per-item)` 으로 아직 active worktree 가 배정되지 않았다. §1 은 frontend 전용이고 §3 은 `store.md` catalog 변경으로, 본 plan 이 건드리는 `§9.8` 보안 섹션과 영역이 다르다. 병렬 경합 위험 낮음.
- 제안: 조치 불필요.

### [INFO] cafe24-backlog-residual A-3 체크박스 미갱신 필요

- target 위치: `plan/in-progress/cafe24-backlog-residual.md` §A-3
- 관련 plan: `plan/in-progress/cafe24-install-ratelimit.md` frontmatter `parent: plan/in-progress/cafe24-backlog-residual.md (A-3)`
- 상세: `cafe24-backlog-residual.md` 의 A-3 항목(`- [ ] **운영(A-3)**`)이 아직 미체크 상태다. `cafe24-install-ratelimit.md` 는 이 항목을 처리하는 plan 이므로, 구현 완료 후 plan complete 단계에서 A-3 체크박스를 `[x]` 로 갱신하고 "본 plan 에서 처리됨" 표기가 필요하다.
- 제안: plan complete 단계에서 `cafe24-backlog-residual.md` A-3 체크박스 갱신 필요. 현재 착수 전 단계에서는 조치 불필요.

### [WARNING] spec 갱신 대상 명시 방식 — "developer read-only" 표기와 계획 정합

- target 위치: `plan/in-progress/cafe24-install-ratelimit.md` §"Spec 갱신 (정식 phase — 외부 위임 아님)"
- 관련 plan: CLAUDE.md `spec/` 쓰기 권한 정책 (`spec/` 변경 → `project-planner`)
- 상세: plan 마지막 줄이 "developer 는 spec read-only — 본 갱신은 spec-update 제안으로 작성 후 project-planner 적용 (또는 orchestrator 가 직접)" 으로 끝나, 정식 phase 로 선언한 spec 갱신의 실행 주체가 plan 내에서 여전히 모호하다. 갱신 대상은 `spec/4-nodes/4-integration/4-cafe24.md §9.8` 및 `spec/2-navigation/4-integration.md §9` 두 파일이다. CLAUDE.md 규약상 developer 는 spec 을 직접 편집할 수 없으므로, 착수 직전 project-planner 위임 절차가 명확히 필요하다. 현재 plan 에는 이 절차가 명시적으로 없어 단계 3(`consistency-check --impl-prep`) 이후 spec 갱신이 누락될 위험이 있다.
- 제안: `cafe24-install-ratelimit.md` 단계 4 앞에 "project-planner 에게 spec 갱신 위임" 또는 "orchestrator 직접 spec 갱신" 중 하나를 명시적으로 체크박스로 추가. 현재 암묵적으로만 처리되어 있어 갱신이 skip 될 위험.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 조사 결과, target spec (`spec/4-nodes/4-integration/`) 을 동시에 수정 중인 active worktree 는 없었다. 단, git worktree 목록에서 다음 2개가 stale 판정되어 CRITICAL 분류 대상에서 제외됨:

- `channel-web-chat-followups-1feff2` (branch `claude/channel-web-chat-followups-1feff2`) — Step 1 ancestor 검사: STALE (branch HEAD 가 `origin/main` 조상에 포함됨). Step 2: PR 조회 결과 empty (GitHub CLI 응답 없음 — Step 1 ancestor 로 stale 확정).
- `mermaid-lint-f4943c` (branch `claude/mermaid-lint-f4943c`) — Step 1 ancestor 검사: STALE. 동일 사유.

두 worktree 모두 이미 main 에 머지된 branch 로 활성 유지 이유 없음. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/4-nodes/4-integration/` 전체는 현재 이 worktree 와 경합하는 active worktree 가 없다. `node-output-redesign` plan 이 `4-cafe24.md §1` 을, `cafe24-restricted-scopes-followups` plan 이 `4-cafe24.md §8.3` 을 후속 대상으로 두고 있으나 모두 worktree 미배정 상태이고 본 plan 의 변경 범위(`§9.8`, `spec/2-navigation/4-integration.md §9`)와 섹션이 겹치지 않아 병렬 경합 위험은 없다. 주요 주의 사항은 spec 갱신 실행 주체 모호성(WARNING)으로, 착수 전 project-planner 위임 절차를 plan 에 명시적으로 추가하는 것이 권장된다. worktree 충돌 후보 2건은 모두 stale 판정으로 skip, active 는 0건이다.

---

## 위험도

LOW

STATUS: OK
