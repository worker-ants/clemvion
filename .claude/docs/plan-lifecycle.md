# PLAN 문서 라이프사이클 (상세)

> CLAUDE.md 본문에는 "`plan/in-progress/` ↔ `plan/complete/`" 한 줄 요약만. 본 문서는 라이프사이클·이동 규칙·frontmatter 스키마·자가 점검의 SSOT.

## 1. 폴더 구조

`plan/` 하위는 다음 두 폴더 중 하나에 위치한다. 최상위(`plan/*.md`)에는 plan 문서를 두지 않는다.

- **`plan/in-progress/`** — 처리할 항목이 하나라도 남아있는 plan. 새 plan 은 항상 여기에서 생성. 하위 그룹핑(예: `stages/`) 무방.
- **`plan/complete/`** — 모든 작업·체크리스트·후속 항목까지 끝난 plan. 미완 항목이 단 하나라도 남으면 옮기지 않는다.
- **`plan/complete/archive/from-*/`** — 옛 `memory/`·`user_memo/` 의 1회성·역사 문서 보관. 신규 생성 금지.

## 2. 분류 기준

미체크 체크박스(`[ ]`), "TODO", "남은 작업", "다음 단계", "결정 필요", 미해결 follow-up 항목이 **하나라도** 있으면 `in-progress/`.

## 3. 이동 규칙

- **`git mv` 사용**: 단순 복사·삭제가 아니라 `git mv` 로 history 보존.
- **이동 시점**: 작업 단계가 끝날 때마다 plan 갱신, 모든 항목이 완료된 순간 `complete/` 로 이동.
- **이동은 마지막 작업 PR 안에서**: 모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에 `chore(plan): mark <name> complete` 형태의 별 commit 으로. **plan 이동만 담은 별 PR 분리 금지** (PR 증식 + 이동 누락 패턴 차단).
- **revert 패턴**: review 중 follow-up 으로 빠지면 같은 PR 의 추가 commit 으로 `[ ]` 복원 + `git mv` 도 `in-progress/` 로 revert.
- **인입 참조**: `review/**` 같은 시점 기록 문서는 옛 경로 유지. `spec/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신.

## 4. Frontmatter 스키마

`plan/in-progress/<name>.md` 상단:

```markdown
---
worktree: <task_name>-<slug>     # 이 plan 이 살아있는 worktree 디렉토리 이름
started: 2026-05-13              # ISO 날짜
owner: <역할/이름>                 # planner / developer / 사용자 본인 등
---
```

`complete/` 로 옮긴 후에도 frontmatter 유지 (history 보존).

용도:
- 동시 작업 추적
- worktree 충돌 검출 (`consistency-checker` 의 `plan_coherence` checker)

## 5. 이동 commit 자가 점검

commit 전 확인:

- [ ] 본 PR 의 변경으로 plan 의 모든 체크박스가 `[x]` 인가
- [ ] 미해결 follow-up·"TODO"·"결정 필요" 항목이 0건인가
- [ ] `git mv` 로 옮겼는가 (단순 복사·삭제 아님)
- [ ] commit 메시지가 `chore(plan): mark <name> complete` 형식인가

한 항목이라도 `[ ]` 이면 이동 skip — 이번 PR 은 plan 의 일부만 처리한 것이고 plan 은 `in-progress/` 에 남는다.
