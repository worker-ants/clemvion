# Plan 정합성 검토 결과

검토 모드: spec draft (--spec)
Target plan: `plan/in-progress/spec-draft-cafe24-nonce-key-design.md`
대상 spec: `spec/4-nodes/4-integration/4-cafe24.md §9.8`
검토 일시: 2026-05-28

---

## 발견사항

- **[INFO]** target plan 이 INFO-6 을 정상 해소하며 `cafe24-test-spec-guard-cleanup-followups.md` 와 정합
  - target 위치: `spec-draft-cafe24-nonce-key-design.md` 전체
  - 관련 plan: `plan/in-progress/cafe24-test-spec-guard-cleanup-followups.md` §INFO-6 체크박스 (worktree `cleanup-followups` 내 버전에서 `[x]` 처리, "spec convention 문서 보강은 project-planner 영역" 으로 명시)
  - 상세: `cleanup-followups` 워크트리 내 `cafe24-test-spec-guard-cleanup-followups.md` 는 INFO-6 을 `[x]` 로 마크하고 "잔여: spec convention 문서 보강은 project-planner 영역 — 본 cleanup 범위 밖" 으로 명시해 두었다. target plan 이 이 잔여를 정확히 이어받아 처리한다. 미해결 결정 우회 없음.
  - 제안: 특별한 조치 불필요. target plan 이 INFO-6 의 정상 후속 작업임을 확인.

- **[INFO]** main 트리의 `cafe24-test-spec-guard-cleanup-followups.md` 와 `cleanup-followups` 워크트리 버전의 체크박스 상태 불일치
  - target 위치: 해당 없음 (target plan 의 직접 충돌 아님)
  - 관련 plan: `plan/in-progress/cafe24-test-spec-guard-cleanup-followups.md` (main 트리) — INFO-6 여전히 `[ ]` 미체크. `cleanup-followups` 워크트리 버전은 `[x]` 로 처리됨.
  - 상세: `cleanup-followups` 워크트리가 main 에 머지되면 main 트리의 plan 도 함께 업데이트된다. 현재는 머지 전이므로 기대된 상태. 단, `cleanup-followups` 브랜치가 main 에 머지된 후 `spec-draft-cafe24-nonce-key-design.md` 를 별도 PR 로 처리할 경우, main 트리의 INFO-6 이 이미 `[x]` 로 반영되어 있어 `cafe24-test-spec-guard-cleanup-followups.md` 를 `plan/complete/` 로 이동할 조건(모든 체크박스 `[x]` 이며 잔여 없음)이 충족될 수 있음을 주의.
  - 제안: `cleanup-followups` 머지 후, `spec-draft-cafe24-nonce-key-design.md` 실행·완료 시점에 `cafe24-test-spec-guard-cleanup-followups.md` 를 `plan/complete/` 로 `git mv` 처리하도록 후속 plan 에 명시.

- **[INFO]** `node-output-redesign/cafe24.md` 가 동일 파일(`spec/4-nodes/4-integration/4-cafe24.md`) 을 참조하지만 섹션 비중복
  - target 위치: `spec-draft-cafe24-nonce-key-design.md` §변경안 (§9.8 한정)
  - 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md` (§5 출력 구조 대상)
  - 상세: `node-output-redesign/cafe24.md` 는 `4-cafe24.md §5` (출력 구조) 만 다루며 `§9.8` (HMAC 검증 + Nonce cache) 와 섹션이 전혀 겹치지 않는다. 병렬 worktree 경합 없음. 다만 `node-output-redesign` 의 활성 worktree 가 별도로 존재하지 않으며 주요 D1~D6 단계가 모두 머지 완료 상태임을 확인.
  - 제안: 조치 불필요.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 확인 결과 `spec/4-nodes/4-integration/4-cafe24.md` 를 손대는 워크트리들에 대해 stale 판정 cascade 수행:

| worktree | branch | Step 1 | Step 2 | 판정 |
|---|---|---|---|---|
| `cafe24-mcp-label-i18n` | `claude/cafe24-mcp-label-i18n` | ACTIVE (exit 1) | PR MERGED | **stale** (squash merge) |
| `cafe24-mcp-usage-api` | `claude/cafe24-mcp-usage-api` | ACTIVE (exit 1) | PR MERGED | **stale** (squash merge) |
| `auth-config-webhook-wiring` | `worktree-auth-config-webhook-wiring` | ACTIVE (exit 1) | PR MERGED | **stale** (squash merge) |
| `chat-channel-error-notify-finish` | `worktree-chat-channel-error-notify-finish` | Step 1 STALE (exit 0) | — | **stale** (ancestor of main) |
| `frontend-csr-only-a985da` | `claude/frontend-csr-only-a985da` | ACTIVE (exit 1) | PR MERGED | **stale** (squash merge) |
| `integration-activity-api-label-ed0a6e` | `claude/integration-activity-api-label-ed0a6e` | ACTIVE (exit 1) | PR MERGED | **stale** (squash merge) |

6건 모두 stale 판정. §5번 worktree 충돌 분석 대상에서 전원 제외.

실제로 `4-cafe24.md §9.8` 과 충돌하는 active worktree 없음 (`cleanup-followups` 자신만 해당 섹션을 수정 대상으로 삼음).

해당 stale 워크트리들은 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec-draft-cafe24-nonce-key-design.md` (target) 는 `cafe24-test-spec-guard-cleanup-followups.md` 의 INFO-6 잔여("spec convention 문서 보강은 project-planner 영역") 를 정확히 이어받아 처리하는 순수 additive spec 명문화 작업이다. 미해결 결정 우회 없음, 코드 변경 없음, 다른 plan 의 미해소 선행 조건 의존 없음, 섹션 경합 없음. 유일한 후속 주의사항은 `cleanup-followups` 머지 후 `cafe24-test-spec-guard-cleanup-followups.md` 의 complete 이동 조건이 충족되는 시점을 누락하지 않는 것이다 (INFO 수준). worktree 충돌 후보 6건 중 stale 6건 skip, active 0건 분석.

---

## 위험도

NONE
