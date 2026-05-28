# Plan 정합성 검토 — spec-draft-triggers-auth-column.md

검토 모드: `--spec`
Target: `plan/in-progress/spec-draft-triggers-auth-column.md`
Target 대상 spec: `spec/2-navigation/2-trigger-list.md`
검토 일시: 2026-05-29

---

## 발견사항

발견된 CRITICAL / WARNING 없음. 아래 INFO 1건만 기록.

- **[INFO]** trigger-drawer-tests.md 케이스 6 갱신 상태 확인 — 이미 반영됨
  - target 위치: `spec-draft-triggers-auth-column.md` 변경 1 (§2.1 "인증" 행) + Rationale R-15 본문 중 `authConfigId IS NULL` 경고 조건
  - 관련 plan: `plan/in-progress/trigger-drawer-tests.md` 케이스 6
  - 상세: `trigger-drawer-tests.md` 케이스 6은 2026-05-28 auth-config-webhook-wiring PR 병합 시점에 "authType 별 i18n 렌더링 hmac/bearer/none → AuthConfig selector 기준으로 재작성" 으로 이미 무효화·갱신 주석이 삽입되어 있다. target 의 R-15 ("경고는 신호, 강제 차단 아님") 는 해당 케이스와 개념적으로 직교하며 추가 충돌 없음.
  - 제안: 별도 조치 불요. 케이스 6 재작성 시 `authConfigId == null + webhook` → 경고 아이콘 렌더링 케이스를 추가하면 R-15 구현 회귀 가드로 활용 가능 — 구현 plan `triggers-auth-column.md` P3 (테스트 선작성) 단계에서 처리 권장.

---

## worktree 충돌 후보 검토 결과

`spec/2-navigation/2-trigger-list.md` 를 참조하는 in-progress plan 이 보유한 worktree 를 전수 확인했다.

### 후보 목록 및 stale 판정

| plan 파일 | worktree/branch | Step 1 | Step 2 | 판정 |
|---|---|---|---|---|
| `trigger-list-chat-channel-ui.md` | `claude/trigger-list-chat-channel-ui-d0c4a3` | exit 1 (not ancestor) | PR #283 state=MERGED | **STALE** |
| `spec-draft-auth-config-webhook-wiring.md` / `auth-config-webhook-wiring.md` | `.claude/worktrees/auth-config-webhook-wiring` (branch `worktree-auth-config-webhook-wiring`) | exit 0 (ancestor — stale) | PR #341 state=MERGED (squash도 확인) | **STALE** |
| `spec-fix-isactive-drawer-toggle.md` | `trigger-drawer-cleanup-f6a707` | exit 1 (branch 미존재, N/A) | 빈 결과 (PR 미존재) | **Step 3 fallback → active 로 처리** |

### spec-fix-isactive-drawer-toggle 상세

- worktree 물리 디렉토리 미존재, git branch 로컬/원격 모두 미존재, PR 없음.
- 해당 plan 이 손대는 영역: `spec/2-navigation/2-trigger-list.md §2.3.1 isActive 행` — target 이 손대는 영역(`§2.1` 목록 표 신규 행 + Rationale R-15) 과 **다른 섹션**이므로 실질 worktree 경합 없음.
- stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 `./cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장.
- 결론: 경합 위험 없어 INFO 수준에서 기록으로만 남김.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 3건 중 stale 2건 skip, active(fallback) 1건 분석.

- `trigger-list-chat-channel-ui-d0c4a3` (branch `claude/trigger-list-chat-channel-ui-d0c4a3`) — Step 2 PR #283 MERGED
- `auth-config-webhook-wiring` (branch `worktree-auth-config-webhook-wiring`) — Step 1 ancestor 확인 + Step 2 PR #341 MERGED

두 worktree 모두 물리 디렉토리 미존재 (`git worktree list` 미등재). cleanup 대상 없음 (이미 정리됨).

---

## 요약

`spec-draft-triggers-auth-column.md` 는 `spec/2-navigation/2-trigger-list.md §2.1` 목록 표에 "인증" 행을 추가하고 Rationale R-15 를 등록하는 소규모 spec 증분이다. 검토한 모든 in-progress plan 과의 관계에서 미해결 결정 우회(관점 1), 선행 plan 미해소(관점 3), 후속 항목 누락(관점 4) 이 식별되지 않았다. target 이 전제하는 핵심 기반 — R-14 (authConfigId v1 격상), AuthConfig wiring (PR #341), 무인증=`authConfigId IS NULL` 모델 — 이 모두 main 에 병합 완료되어 사전 조건이 충족된 상태다. worktree 충돌 후보 3건 중 실제 active 경합은 0건 (`spec-fix-isactive-drawer-toggle` 의 단독 fallback active 판정은 §2.3.1 대상이라 §2.1 target 과 섹션 분리). stale skip 2건, active 1건(섹션 비충돌) 분석.

### 위험도

NONE
