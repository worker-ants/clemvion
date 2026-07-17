### 발견사항

- **[WARNING]** plan lifecycle 이동이 별도 `chore(plan)` 커밋이 아니라 본 fix 커밋에 섞여 있음
  - 위치: `plan/complete/forced-coverage-gate.md` (신규), `plan/in-progress/harness-report-contract-followups.md` (신규) — 커밋 `78ffd9983 fix(harness): summary agent 정의 3개의 반증된 "terminal" 메커니즘 정정 + 계약 동기화`
  - 상세: 이 커밋의 표제 목적은 3개 summary agent 정의(`code-review-summary.md`/`consistency-summary.md`/`integration-risk-summary.md`) + 4개 command/skill 문서의 잘못된 "terminal" 설명 정정과, 이를 고정하는 신규 테스트(`test_summary_agent_contract.py`) 추가다(파일 1~8, 총 8개). 그런데 같은 커밋(단일 커밋, PR 은 origin/main 대비 1 commit)에 **다른 task(worktree `forced-coverage-gate-c906f7`, PR #962)의 plan 문서**를 `plan/in-progress/` → `plan/complete/` 로 옮기고(git rename-detection 기준 R090), 3개 과거 PR(#958·#960·#962)의 잔여 항목을 모은 신규 backlog plan 을 함께 추가했다. `git diff` (rename 미검출) 로 만들어진 이번 review payload 에는 이 이동이 완전한 신규 파일(98줄 add)로만 보여 원본 삭제가 드러나지 않지만, `git diff -M` 로 확인하면 실제로는 `R090 plan/in-progress/forced-coverage-gate.md → plan/complete/forced-coverage-gate.md` 인 rename+edit 이다.
    이 프로젝트의 [`plan-lifecycle.md` §3](.claude/docs/plan-lifecycle.md)은 명시적으로 "이동은 마지막 작업 PR 안에서: 모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에 `chore(plan): mark <name> complete` 형태의 **별 commit** 으로. **plan 이동만 담은 별 PR 분리 금지**" 라고 규정한다. `forced-coverage-gate.md` 는 PR #962(worktree `c906f7`) 에서 체크박스가 전부 완료됐는데 이동이 누락된 "loose end" 였다는 것이 커밋 메시지에 적혀 있다 — standalone plan-move PR 이 금지돼 있으므로 다음 실 PR 에 실어 보내는 것 자체는 정책과 상충하지 않지만, **같은 PR 안에서도 별도 commit 이어야 한다**는 요건은 지켜지지 않았다: 이 diff 는 agent 정의 fix 와 plan 재배치·신규 backlog 문서 생성이 **하나의 커밋**에 뭉쳐 있다. 또한 두 plan 파일 모두 frontmatter `worktree` 가 현재 worktree(`summary-agent-terminal-fix-253ab6`)와 일치하지 않아 자동 push-gate("연결 판정")의 대상도 아니었다 — 즉 이 번들링은 어떤 자동 강제에 의한 것도 아니고, 리뷰가 아니면 걸러지지 않는다. 기능적 위험은 없다(문서 전용, `.claude/**`+`plan/**` 변경만이라 push-gate 도 애초에 `codebase/**` 트리거 조건에 안 걸림).
  - 제안: 아직 push 되지 않았다면(현재 origin/main 대비 1 commit ahead) `git reset --soft HEAD~1` 후 (1) agent 정의 7개 + 신규 테스트 fix 커밋, (2) `chore(plan): mark forced-coverage-gate complete` (plan 이동 + `harness-report-contract-followups.md` 신설) 커밋으로 분리해 plan-lifecycle.md §3 의 "별 commit" 요건을 맞춘다. 이미 push/머지됐다면 향후 동일 패턴 방지를 위한 참고로 남긴다.

- **[INFO]** 신규 backlog plan 의 5번 항목이 문서 자체가 규정한 주제와 무관
  - 위치: `plan/in-progress/harness-report-contract-followups.md` "## 5. sidebar 테스트 mock 보일러플레이트 공유 헬퍼 (#958 W#4)"
  - 상세: 이 문서의 `## 배경` 은 스스로를 "PR #958 → #960 → #962 로 이어진 '하네스 report 계약' 작업에서 의도적으로 미룬 항목의 durable 앵커" 로 규정한다. 1~4번 항목(report-path 공유·리포트 내용 검증·문서 hub 정리·cross-session 테스트)은 실제로 이 주제(summary agent Write 차단·상태 파일 동기화)에 부합한다. 반면 5번 항목은 PR #958(`사용자 가이드(/docs) 진입 시 /w/<slug> 무한 중첩 라우팅 fix`, 실제로는 네비게이션/프론트엔드 버그)의 리뷰에서 나온 `Sidebar` 컴포넌트 테스트 mock 헬퍼 추출 제안으로, "하네스 report 계약" 과 기술적 연관이 전혀 없는 별개 서브시스템(frontend 라우팅 테스트) 항목이다. 문서 표제·배경이 약속하는 범위와 실제 포함 항목이 어긋나 있어, "하네스 report-contract 후속"을 찾는 사람도 "sidebar 테스트 정리"를 찾는 사람도 이 문서에서 바로 찾기 어렵다.
  - 제안: 5번 항목을 별도의 범용 developer 잔여 작업 backlog(또는 frontend 전용 backlog)로 옮기거나, 최소한 `## 배경`에 "harness 계약 외 잡다한 이월 항목도 포함" 같은 예외 문구를 추가해 표제-내용 불일치를 없앤다.

- **[INFO]** 신규 테스트 파일의 미사용 import
  - 위치: `.claude/tests/test_summary_agent_contract.py:21` — `from pathlib import Path`
  - 상세: `Path` 가 import 됐지만 파일 전체에서 실제로 사용되는 곳이 없다(`AGENTS`/`WORKFLOWS` 는 `REPO_ROOT`(이미 Path 인스턴스로 추정) 의 `/` 연산으로 구성되고, 메서드 타입힌트도 `str` 반환뿐). 다만 이 저장소에는 Python lint(ruff/flake8) 설정이 없고, 동일 패턴(`Path` import 후 미사용)이 기존 `.claude/tests/test_agent_consistency.py` 에도 이미 존재해 전례가 있다 — 신규성은 낮고 위험도도 낮다.
  - 제안: `from pathlib import Path` 제거(선택 사항, 게이트에 걸리지 않으므로 강제 아님).

### 요약
핵심 변경(파일 1~8: 3개 summary agent 정의 + 4개 command/skill 문서의 반증된 "terminal" 설명 정정, 그리고 이를 고정하는 신규 회귀 테스트)은 커밋 메시지가 밝힌 단일 의도("정정 + 계약 동기화")에 정확히 대응하며 무관한 리팩터링·포맷팅·임포트 정리·설정 변경은 발견되지 않았다. 다만 같은 커밋에 **다른 task(PR #962, worktree `forced-coverage-gate-c906f7`)의 완료된 plan 문서를 `plan/complete/` 로 옮기고 신규 backlog plan 을 생성하는 행위**가 함께 들어가 있는데, 이는 프로젝트 자체 문서(`plan-lifecycle.md` §3)가 요구하는 "별도 `chore(plan)` 커밋" 요건을 지키지 않은 번들링이다(같은 PR 에 싣는 것 자체는 standalone plan-move PR 금지 규정과 상충하지 않으나 커밋 분리는 안 됐다). 이 번들링은 기능적 위험은 없고 커밋 메시지에 투명하게 설명돼 있으나, agent 프롬프트 정정이라는 핵심 fix 와 별개 PR(#962)의 lifecycle 마감이 한 커밋에 섞여 리뷰·되돌리기 단위를 흐린다. 추가로 신규 backlog 문서의 항목 하나(#958 sidebar 테스트 헬퍼)가 문서 자체 주제와 무관하고, 신규 테스트 파일에 미사용 import 가 하나 있으나 둘 다 사소하다.

### 위험도
LOW
