# 부작용(Side Effect) 리뷰 — summary-agent-terminal-fix

## 검토 범위
review payload 에 명시된 10개 파일(agent 정의 3 · command 문서 3 · SKILL 1 · 신규 테스트 1 · plan 문서 2)을
`git diff origin/main...HEAD` 로 직접 재확인하고, 관련 런타임 workflow(`.claude/workflows/*.js`) 및 SoT 문서
(`subagent-call-contract.md §7`)와 교차 검증했다. 신규 테스트(`test_summary_agent_contract.py`) 및 전체
하네스 test suite(247건, `unittest discover`)를 실제로 실행해 회귀 여부를 확인했다.

## 발견사항

- **[WARNING]** 리뷰 payload 에서 파일 삭제 1건이 누락됨 — orchestrator diff-discovery 의 rename 은폐 블라인드 스팟
  - 위치: `plan/in-progress/forced-coverage-gate.md` (실제로는 `D`, git 기본 rename-detection 상
    `R090 → plan/complete/forced-coverage-gate.md`). 이 side_effect.md payload 의 "리뷰 대상 파일" 10개
    목록에는 포함돼 있지 않음.
  - 상세: `git diff --no-renames --name-status origin/main...HEAD` 로 직접 대조하면 실제 변경 파일은
    **11개**(payload 는 10개만 포함)이며, 빠진 1개가 이 삭제다. 원인은 git 의 rename detection 이
    `plan/in-progress/forced-coverage-gate.md` 삭제와 `plan/complete/forced-coverage-gate.md` 신규 생성을
    90% 유사도로 묶어 "rename" 으로 접어버리고, `code_review_orchestrator.py` 의
    `git diff --name-only <range>` 기반 파일 목록 수집 단계에서 old path 가 애초에 나타나지 않기
    때문이다(직접 재현: `--no-renames` 를 끄면 두 경로가 각각 A/D 로 잡히고, 기본값에서는 new path
    하나만 남는 것을 확인). 이번 건 자체는 내용이 그대로 보존된 채 끝에 "## 후속 (durable 이관)" 11줄만
    추가된 **정상적인 plan-lifecycle 이동**(in-progress → complete)이라 실질 피해는 없다 — 옛 경로를
    참조하는 살아있는 문서도 없음(유일한 hit 은 과거 리뷰 세션의 시점 스냅샷
    `review/code/2026/07/17/13_28_39/**` 뿐이며 이는 정상적인 historical record). 그러나 이 diff 자체가
    실증하듯, **파일 삭제가 rename detection 뒤에 숨으면 어떤 reviewer 도 그 삭제를 볼 수 없다** —
    향후 diff 에서 "이름을 바꾸면서 내용도 몰래 지우는" 패턴이 이 경로로 side-effect 리뷰를 그대로
    통과할 수 있다는 뜻이다.
  - 제안: `code_review_orchestrator.py`(및 동형 로직을 가진 `consistency_orchestrator.py` /
    `merge_coordinator_orchestrator.py`)의 diff 파일 목록 수집에 `--no-renames` 를 쓰거나, rename 탐지된
    항목의 old/new 경로를 모두 리뷰 payload 에 노출하도록 보강 검토. (이번 diff 가 만든 결함이 아니라
    기존 orchestrator 의 pre-existing gap — 이번 건에서 처음 실증됨.)

- **[INFO]** summary 에이전트 3종의 파일 쓰기 범위가 "자기 output" 밖으로 확장 — 이미 live 였던 동작을 문서가 뒤늦게 반영
  - 위치: `.claude/agents/code-review-summary.md` / `consistency-summary.md` / `integration-risk-summary.md`
    의 신규 "2. 누락 파일 영속화" 단계.
  - 상세: 세 summary 에이전트가 이제 자신의 `summary_output_file` 뿐 아니라, manifest 가 지목한 각
    reviewer/checker/analyzer 의 `output_file` 이 비어 있으면 그 경로에도 Write 하라고 명시적으로
    지시받는다. `tools:` frontmatter(Write 포함)는 이번 diff 로 바뀌지 않았고, `.claude/workflows/ai-review.js`
    · `consistency-check.js` · `merge-coordinate.js`(모두 이번 diff 의 대상 파일이 아님, 이미 origin/main
    tip 에 병합돼 있음)를 grep 한 결과 이 세 workflow 는 이미 동일한 "누락 파일 영속화" ·
    `inlineReports()` 프롬프트를 보내고 있었다. 즉 이 파일-쓰기 확장 자체는 이 diff 가 새로 만든
    부작용이 아니라 실제 동작을 뒤늦게 정확히 반영한 것이며, 오히려 이전 문서("terminal 이라 Write 가
    막힐 수 있다")가 이 필수 persist 단계 이행을 주저하게 만들 수 있었던 자기모순을 없애 위험을 낮추는
    방향이다. 신규 회귀 테스트 로컬 실행 결과 4/4 통과, 전체 하네스 247/247 통과, 실행 후 워킹트리에
    의도치 않은 파일 생성 없음(`git status` 로 확인).
  - 제안: 없음(net 위험 완화). 기록 목적.

- **[INFO]** Critical/Warning 집계 포함 기준이 `status` 무관 "전문 존재" 로 완화 → 하류 자동화 트리거 빈도 증가 가능
  - 위치: 세 summary 에이전트 정의의 "인라인 전문이 authoritative" 절 + `.claude/commands/ai-review.md`
    step4(`critical_count`+`warning_count` > 0 시 `resolution-applier` 자동 호출), `merge-coordinate.md` /
    `merge-coordinator/SKILL.md` 의 `BLOCK` 판정(실제 격리 worktree git merge/rebase 실행을 게이트).
  - 상세: 이전에는 `status` 가 `success`/`fatal` 인 reviewer 만 결과가 반영되고 그 외(pending/rate_limit
    등)는 "재시도 필요"로만 표기됐다. 변경 후에는 `status` 값과 무관하게 인라인 전문만 있으면 발견사항이
    정상 집계된다. 명시적으로 거짓음성(예: forced 인데 결과 없음이 "clean" 으로 보이는 것, merge-coordinator
    의 `BLOCK: NO` 가 실제로는 분석 누락인 경우)을 줄이려는 의도된 변경이라 안전성 개선에 해당하지만,
    집계 기준이 넓어진 만큼 이전에는 조용히 빠지던 non-success 결과가 앞으로는 `critical_count`/
    `warning_count` 에 잡혀 `resolution-applier` 자동 호출(코드 수정·커밋)이 이전보다 더 자주 트리거될
    수 있다는 하류 side effect 를 인지해 둘 필요가 있다.
  - 제안: 없음(의도된 개선). 운영 중 `resolution-applier` 호출 빈도가 유의미하게 늘면 원인이 이 변경임을
    참고할 것.

## 확인되어 문제 없는 항목
- STATUS 헤더 리터럴 포맷(`STATUS=<written|write_blocked> RISK=... CRITICAL=... WARNING=... PATH=...` /
  `STATUS=<written|write_blocked> BLOCK=... PATH=...`)은 세 에이전트 모두 문자 그대로 유지 — 기존
  호출자(`ai-review.md` / `consistency-check.md` / `merge-coordinate.md` / `merge-coordinator/SKILL.md`
  의 파서)에 대한 시그니처·인터페이스 breaking change 없음. 문서 내 단계 재번호("5번 Write") 도 실제
  삽입된 새 단계(2. 누락 파일 영속화)에 맞춰 정확히 재계산됨(직접 대조 확인, 6개 참조 지점 모두 일치).
- 전역 변수·환경 변수 읽기/쓰기·네트워크 호출 관련 변경 없음(모두 문서 및 read-only 테스트 파일이며
  실행 코드 로직 변경이 없음).
- 신규 테스트 파일(`test_summary_agent_contract.py`)은 read-only(`.read_text()` 만 수행)이고
  `.claude/tests/` 명명 규약·`unittest discover -p 'test_*.py'` 패턴과 정합해 CI(`harness-checks.yml`)에
  자동 편입됨. 실행 전후 `git status` 로 부수 파일 생성 없음을 확인.
- `plan/complete/forced-coverage-gate.md` 가 참조하는 실제 구현(`_forced_coverage_missing`,
  `_reconcile_state_with_disk` 등)은 이미 `origin/main` tip 커밋(PR #962, `d891694`)에 존재함을
  `git log`/`grep` 으로 확인 — "구현 없이 완료로 표시된 plan" 은 아님.

## 요약
이번 diff 는 코드 로직 변경이 아니라 7개 하네스 문서(sub-agent 정의 3·command 3·SKILL 1)의 "왜 Write 가
막히는가" 설명을 (refuted) "terminal 이라서" → (실측) "정확한 basename 매칭, terminal 무관" 으로 정정하고,
이미 런타임에 살아있던 "누락 파일 영속화" 지시(선행 PR #962 로 workflow.js 에 이미 반영됨, grep 으로
확인)를 에이전트 정의에 반영해 자기모순을 제거하며, 이를 회귀 테스트로 고정한 것이다. STATUS 라인
포맷 등 호출자 인터페이스는 문자 그대로 보존되어 하위 호환 파손이 없고, 전역 변수·env·네트워크 관련
부작용도 없다. 유일한 실질 발견은 이 diff 자체가 아니라 **이 diff 를 리뷰용으로 잘라낸 파이프라인**에서
나왔다 — git 의 rename detection 때문에 `plan/in-progress/forced-coverage-gate.md` 삭제가 리뷰 payload
10개 파일 목록에서 통째로 빠졌고(실제로는 11개 파일 diff), 직접 `git diff --no-renames` 로 확인해 보니
이번 건은 내용이 보존된 정상 plan 이동이라 무해하지만, orchestrator 의 diff 파일 discovery 가 "rename
뒤에 숨은 삭제"를 구조적으로 놓친다는 것을 실증한다 — 향후 diff 의 side-effect 리뷰 신뢰도에 영향을 줄
수 있는 별도 tooling 이슈로 플래그한다. summary 에이전트의 파일-쓰기 범위 확장과 Critical/Warning
집계 완화는 둘 다 의도된 것이고 이미 부분적으로 live 였던 동작을 문서가 뒤늦게 따라잡은 것이라 위험
완화 방향이다.

## 위험도
LOW
