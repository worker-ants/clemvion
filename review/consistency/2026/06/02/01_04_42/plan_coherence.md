### 발견사항

- **[WARNING]** `channel-web-chat-followups.md §7-b` 항목이 target 에서 결정됐으나 plan 체크박스 미갱신
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §1 (`data-global` 속성), §1 마지막 항목 (`on()` 해제함수 반환 + `off(event, cb?)` / `off(event)` 제공), §2 (`off()` npm 예제), §Rationale R3
  - 관련 plan: `plan/in-progress/channel-web-chat-followups.md` §7-b (체크박스 — `on()` 구독 해제, 전역명 충돌 방지)
  - 상세: `channel-web-chat-followups.md §7-b` 는 `on()` 구독 해제와 전역명 충돌 방지를 "spec `2-sdk` 표면 변경 → project-planner 위임 필요"로 열어두고 있다. target spec 은 이 두 항목을 정식 결정으로 명문화했다 (`data-global` + `on()` 반환 unsubscribe + `off()` 제공). 결정 자체는 정당하며 현재 worktree(channel-web-chat-followups-1feff2)가 project-planner 역할로 spec 변경 중이므로 CRITICAL 충돌은 아니다. 그러나 plan 의 해당 체크박스가 여전히 미완료(`[ ]`) 상태이고, `channel-web-chat-followups.md` 는 이 결정이 본 spec PR 에서 처리됨을 반영하지 않았다.
  - 제안: `plan/in-progress/channel-web-chat-followups.md` §7-b 의 `on()` 구독 해제 체크박스와 전역명 충돌 방지 체크박스를 `[x]`로 갱신하고, "spec 2-sdk 반영 완료 (channel-web-chat-followups PR)" 메모 추가. `wc:resize` 수신 처리는 여전히 구현 미완료이므로 open 유지.

- **[WARNING]** `wc:resize` spec 강화 — plan 체크박스 우선순위 표기 미반영
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §3 `wc:resize` 설명 — "`wc:resize` host 처리(필수): host(loader/WidgetBridge)는 `wc:resize` 수신 시 iframe 엘리먼트의 크기를 payload에 맞춰 적용한다"
  - 관련 plan: `plan/in-progress/channel-web-chat-followups.md` §7-b `[ ] wc:resize 수신 처리`
  - 상세: target spec 이 `wc:resize` host 처리를 "(필수)"로 격상 명시했다. plan 체크박스는 미완료(`[ ]`)가 맞으나, spec 에서 "필수" 로 강화됐음을 plan 이 반영하지 않으면 구현 시 우선순위 혼선 가능.
  - 제안: `channel-web-chat-followups.md §7-b` wc:resize 항목에 "spec §3 '필수' 격상 완료" 주석 추가. 구현 우선순위를 name-fix 보다 높게 표기.

- **[INFO]** `channel-web-chat-impl.md` / `channel-web-chat-followups.md` frontmatter `worktree` 가 stale branch 참조
  - target 위치: `plan/in-progress/channel-web-chat-impl.md` frontmatter `worktree: .claude/worktrees/channel-web-chat-spec-3b22b3` (동일하게 `channel-web-chat-followups.md` 도 동일 값)
  - 관련 plan: 두 plan 모두 `channel-web-chat-spec-3b22b3` 을 worktree 로 참조
  - 상세: `channel-web-chat-spec-3b22b3` 은 PR #384 (MERGED) 로 이미 머지된 stale branch 이고, 해당 worktree 디렉토리도 존재하지 않음. 현재 실제 작업은 `channel-web-chat-followups-1feff2` worktree 에서 진행 중이다.
  - 제안: 두 plan 의 `worktree` 필드를 `.claude/worktrees/channel-web-chat-followups-1feff2` 로 갱신. `channel-web-chat-impl.md` 의 구현이 이미 PR #384 에서 완료됐다면 `plan/complete/` 이동 검토.

---

### Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보:

- `channel-web-chat-spec-3b22b3` (branch `claude/channel-web-chat-spec-3b22b3`) — Step 1: git merge-base --is-ancestor 결과 ACTIVE_OR_NOTFOUND (squash merge 로 commit hash 변경). Step 2: PR #384 state = **MERGED** → **stale 판정, skip**. 해당 worktree 디렉토리는 이미 삭제됨. plan frontmatter 참조만 잔존. `./cleanup-worktree-all.sh --yes --force` 대상 아님(디렉토리 없음), 단 plan frontmatter 정정 권장.

---

### 요약

`spec/7-channel-web-chat/2-sdk.md` target 은 npm scope(`@workflow/web-chat`) 결정, `on()` 구독 해제 함수 반환, `off()`, `data-global` 전역명 충돌 방지를 정식 명문화했다. npm scope 는 `eia-sdk-publish.md §결정 #3`(2026-06-02 확정 기록)과 정합하며 충돌 없다. `on()`/`off()`/`data-global` 항목은 `channel-web-chat-followups.md §7-b` 가 "project-planner 위임 필요"로 열어둔 항목을 현재 worktree(project-planner 역할)가 처리한 것이므로 결정 권한 충돌은 없다. 그러나 plan 체크박스와 우선순위 메모가 갱신되지 않아 WARNING 2건이 발생한다. worktree 충돌 후보 1건 중 stale 1건(PR #384 MERGED) skip, active 0건 분석.

---

### 위험도

LOW
