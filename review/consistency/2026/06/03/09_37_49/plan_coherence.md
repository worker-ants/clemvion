## 발견사항

- **[WARNING]** `spec/conventions/spec-impl-evidence.md` 동시 수정 — 동일 파일 경합
  - target 위치: target plan W3 — `spec-impl-evidence.md §1` INCLUDE_PREFIXES 에 `spec/7-channel-web-chat/**.md` 추가 (§1, 약 line 33-37)
  - 관련 plan: worktree `spec-sync-audit` (branch `claude/spec-sync-audit`) — 동일 파일의 §2.1 / §3 / §4.1 / Rationale(lines 65, 78, 99, 178)을 수정 중 (pending_plans 검증 의미 정밀화, backlog 가드 문구 갱신)
  - 상세: 두 worktree 가 같은 파일을 건드리나 **수정 섹션은 서로 다름** (target = §1 목록 추가, spec-sync-audit = §2.1 이후). 텍스트 직접 충돌 가능성은 낮지만, 머지 순서에 따라 3-way merge 에서 context 행 충돌 가능성이 있다. stale 판정: Step 1 ACTIVE, Step 2 PR 없음(empty) → Step 3 fallback active.
  - 제안: spec-sync-audit 가 먼저 머지된 뒤 target 을 리베이스해 §1 추가를 fresh 기준으로 적용하거나, 두 변경의 diff가 비겹침임을 PR 머지 시 확인 후 승인. target plan 에 "spec-sync-audit worktree 머지 전 리베이스 필요" 메모 추가 권장.

- **[WARNING]** `codebase/backend/.env.example` 동시 수정 — 동일 파일 경합
  - target 위치: target plan W5 — `codebase/backend/.env.example` 에 `WEB_CHAT_WIDGET_ORIGINS=`(주석 포함) 추가
  - 관련 plan: worktree `system-status-recent-failed-86831b` (branch `claude/system-status-recent-failed-86831b`) — 동일 파일 끝에 `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, `SYSTEM_STATUS_FAILED_SCAN_CAP` 항목 3개 추가 (미머지 상태, plan/complete/system-status-recent-failed.md 로 완료 표기됐으나 main 에 미반영)
  - 상세: 두 항목 모두 파일 말미에 새 env 변수를 추가하는 방식이라 merge 순서에 따라 동일 라인 근처에서 충돌 발생 가능. 내용은 완전히 별개 도메인이므로 충돌 시 수동 병합으로 해결 가능. stale 판정: Step 1 ACTIVE, Step 2 PR 없음(empty) → Step 3 fallback active.
  - 제안: `system-status-recent-failed-86831b` 를 먼저 main 에 머지한 뒤 target 을 리베이스해 `.env.example` 추가를 신규 기준으로 적용. 또는 developer 구현 단계 착수 전 두 branch 의 `.env.example` diff 를 확인해 직렬화. target plan frontmatter `targets:` 에 이미 명시됐으므로 developer 착수 시 주의 메모만으로 충분.

- **[INFO]** `channel-web-chat-followups.md` §4 show/hide/updateProfile 미구현 — target 이 선결 설계를 제공
  - target 위치: target plan §4-a, §4-b
  - 관련 plan: `plan/in-progress/channel-web-chat-followups.md` §4 "show/hide/updateProfile command 위젯 SPA 핸들러 미구현" — "project-planner 가 1-widget-app §3 상태기계에 런처 visible/hidden 상태 추가 선행 필요"로 남겨둠
  - 상세: target plan 이 바로 그 project-planner 설계를 제공하고 있으므로 충돌이 아니라 **의도된 의존 해소**다. target 이 머지되면 `channel-web-chat-followups.md` §4 의 "project-planner 선행 필요" 블로커가 해제되어 developer 구현 착수가 가능해진다.
  - 제안: target 머지 후 `channel-web-chat-followups.md` §4 의 "show/hide/updateProfile" 항목에 "spec-draft-channel-web-chat-gaps 머지 완료로 spec 설계 확정 — 구현 가능" 메모 추가 권장. 본 plan 에 후속 언락 사실을 명시하면 developer 진입자가 파악하기 쉬워진다.

- **[INFO]** `channel-web-chat-followups.md` worktree — MERGED 확인
  - target 위치: target plan frontmatter `worktree: .claude/worktrees/feat-web-chat-demo`
  - 관련 plan: `plan/in-progress/channel-web-chat-followups.md` / `plan/in-progress/channel-web-chat-impl.md` (worktree `channel-web-chat-followups-1feff2`)
  - 상세: branch `claude/channel-web-chat-followups-1feff2` 에 대해 Step 1 ACTIVE (squash merge 로 ancestor 불일치), Step 2 PR state = MERGED. Stale 판정으로 worktree 충돌 검토 제외. target 이 spec/7 파일 수정을 포함하나 동 worktree 는 spec/7 를 건드리지 않아 경합 없음.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `channel-web-chat-followups-1feff2` (branch `claude/channel-web-chat-followups-1feff2`) — Step 1 ancestor 검사: ACTIVE (squash merge). Step 2 PR state: MERGED. → Stale 처리, §5 검토 제외.

나머지 후보 (`spec-sync-audit`, `system-status-recent-failed-86831b`) 는 Step 1 ACTIVE / Step 2 PR 없음 → Step 3 fallback active. 모두 WARNING 으로 보고.

해당 stale worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan `spec-draft-channel-web-chat-gaps.md`는 consistency-check W1~W5 spec 갭을 spec-only 명세 정밀화(새 동작 신설 없음)로 채우고, 이미 합의된 2-sdk §R4 결정을 위젯 SPA 상태기계에 반영(show/hide 직교 축)하며, updateProfile 의미를 EIA 표면 제약에서 논리적으로 도출한 구성으로, 미해결 결정 우회나 선행 plan 미해소 충돌은 발견되지 않았다. 단, `spec/conventions/spec-impl-evidence.md`(spec-sync-audit 동시 수정)와 `codebase/backend/.env.example`(system-status-recent-failed-86831b 동시 수정)에서 동일 파일 경합이 발생하므로 머지 직렬화 또는 리베이스가 필요하다. worktree 충돌 후보 3건 중 stale 1건(channel-web-chat-followups-1feff2, PR MERGED) skip, active 2건(spec-sync-audit, system-status-recent-failed-86831b) WARNING 으로 분류.

---

## 위험도

LOW
