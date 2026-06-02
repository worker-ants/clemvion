## 발견사항

발견된 CRITICAL / WARNING 항목 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보: `spec/5-system/16-system-status-api.md` 와 `spec/2-navigation/15-system-status.md` 를 동시에 보유한 worktree 를 전수 확인.

| worktree | branch | 판정 |
|---|---|---|
| `spec-sync-audit` | `claude/spec-sync-audit` | **Step 1 STALE** — `git merge-base --is-ancestor claude/spec-sync-audit origin/main` exit 0. 두 target spec 파일에 대해 `git diff main claude/spec-sync-audit` 도 empty (main 과 동일 커밋 `93847f73`). |
| `system-status-recent-failed-86831b` | `claude/system-status-recent-failed-86831b` | **Step 1 STALE** — 해당 브랜치도 현재 main(`93847f73`)과 동일 커밋. 본 분석 시점에서 이 worktree 는 현재 분석 대상인 target plan 의 작업 공간이며 아직 변경 사항이 커밋되지 않은 상태. |

`./cleanup-worktree-all.sh --yes --force` 실행을 권장한다. 단, `system-status-recent-failed-86831b` 는 현재 활성 작업 worktree 이므로 작업 완료·머지 후에 정리한다.

---

## 요약

`plan/in-progress/spec-draft-system-status-recent-failed.md` (및 연관 `system-status-recent-failed.md`) 는 `spec/5-system/16-system-status-api.md` / `spec/2-navigation/15-system-status.md` 두 파일에 additive DTO 변경·health 파생 규칙 교체·UI 병기 레이아웃을 제안한다. 검토 결과 다른 `plan/in-progress/**` 문서 중 이 두 spec 파일을 다루거나 `recentFailed` · health 임계 · `SYSTEM_STATUS_*` 환경변수에 대한 미해결 결정을 갖는 plan 은 없다. `spec-sync-audit` worktree 가 이 두 spec 파일을 포함하지만 Step 1 ancestry 검사에서 stale 확인(main 동일 커밋, diff empty). 기존 health §3 규칙의 `failed >= SYSTEM_STATUS_FAILED_THRESHOLD` 를 `recentFailed` 기준으로 전환하는 결정은 target plan `system-status-recent-failed.md` §확정된 결정에 사용자 합의로 명시되어 있어 일방적 우회가 아니다. 미해결 결정 충돌·중복 작업·선행 plan 미해소·후속 항목 누락 모두 해당 없다. worktree 충돌 후보 2건 모두 Step 1에서 stale로 skip.

---

## 위험도

NONE
