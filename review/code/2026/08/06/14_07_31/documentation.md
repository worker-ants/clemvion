# 문서화(Documentation) Review — round 10

## 발견사항

- **[WARNING]** 신설 공유 모듈의 모듈 docstring 첫 줄이 소비자 수를 실제보다 적게 말한다 — 같은 커밋 안에서 스스로 모순된다.
  - 위치: `.claude/_shared/git_probe.py:1` (첫 줄 `"""Git probes shared by the two push-gate guards.`), 같은 파일 20-23행(`Both suites hid it the same way … One implementation with real-repository tests replaces ten untested ones.`)
  - 상세: `git_probe.py` 는 이번 라운드(9R, 커밋 `e834d0f4e`)에 신설된 파일이다. 그런데 그 첫 줄과 마무리 문장은 소비자를 `review_guard.py`/`plan_guard.py` **두 곳**("the two push-gate guards"), 복제본을 5함수×2모듈="ten untested ones" 으로만 서술한다. 그러나 같은 커밋이 `.claude/hooks/_lib/branch_guard.py:42-45` 에서 명시하듯 `branch_guard.py` 는 **세 번째** 손-복제본이었고(`_run_git`/`_repo_root` 2개 함수), 이번 라운드에 그 모듈도 함께 `git_probe` 로 위임하도록 고쳤다(`branch_guard.py:45-46`: `_run_git = _git_probe._run_git` / `_repo_root = _git_probe._repo_root`). 이는 `test_plan_guard.py::GitProbesAreNotReDuplicatedTest` 의 `_SHARED_IN_BRANCH_GUARD = ("_run_git", "_repo_root")` 로도 테스트에서 확인된다(gate `.claude/tests/test_plan_guard.py:346` 부근) — 즉 실제 소비자는 3개 모듈, 복제본 총량은 5+5+2=12(이 브랜치의 커밋 메시지 자신도 "열 개 넘는 사본" 이라고 정확히 적었다). `git_probe.py` 의 docstring 만 "둘"·"열 개" 로 축소해 옆 파일(`branch_guard.py`)이 스스로 "세 번째 사본이었다" 라고 적어 둔 사실과 정면으로 어긋난다. 이 모듈은 정확히 "왜 이 추출이 존재하는가" 를 기록하는 것이 목적이라고 스스로 말하는데(“The extraction is not tidiness … now recorded three times over”), 정작 자신이 해소한 세 번째 드리프트를 자기 요약에서 빠뜨렸다.
  - 제안: 첫 줄을 "the three push-gate guards"(또는 "review/plan/branch guards")로, 마무리 문장을 "more than ten"(또는 정확한 12)으로 고치고, `branch_guard.py` 가 세 번째 사본이었다는 사실을 짧게 한 줄 추가한다 — `branch_guard.py:42-45` 의 서술과 대칭을 맞춘다.

- **[WARNING]** 이 작업 자체를 추적하는 plan 문서의 라운드 이력 표·배너가 실제 진행보다 2라운드 뒤처져 있다 — 하필 이번 라운드(9R)의 CRITICAL 3건이 기록에서 통째로 빠졌다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:18`(배너 "배선 가드 경화 | **1R~6R 진행 중**"), `plan/in-progress/harness-review-gate-ci-backstop.md:24-34`(§배선 가드 라운드 표, 1R~7R 로 끝남)
  - 상세: 이 저장소는 정보 저장 위치 규약상 `plan/in-progress/*.md` 를 "진행 중 작업" 의 단일 진실로 쓰고, 이 문서는 스스로 "라운드를 거듭한 경화 이력" 을 라운드별로 기록해 온 관행을 1R부터 7R까지 충실히 지켰다(1R substring 우회 → 2R 정규식 반전 → … → 7R `_shared/**` env 우회 + 살아있는 fail-open). 그런데 실제 커밋 이력은 `88ce9994d`("CI 백스톱 8R — plan_guard 가 7R 결함을 그대로 갖고 있었다")과 `e834d0f4e`("CI 백스톱 9R — git 프로브 손 복제 3벌을 _shared 로 통합 + 위험도 파싱 잠복 결함", CRITICAL 3 / WARNING 8)까지 진행됐다. 8R 은 본문 여기저기(예: 153·164·245행)에 산발적으로만 언급되고, **9R 은 이 문서 어디에도 등장하지 않는다** — `grep -n "9R" plan/in-progress/harness-review-gate-ci-backstop.md` 결과 0건 (`grep -rn "9R\\b" plan/` 로 확인한 다른 유일한 매치는 무관한 `retry-turn-terminal-guard.md`). 그런데 9R 은 정확히 이 게이트의 판정 코드(`_summary_is_resolved` 의 무조건 `break`)와 배선 가드 근거(git 프로브 손-복제)를 고친 라운드이고, 지금 이 문서를 리뷰하는 회차(round 10)가 그 직후다. 배너 한 줄("1R~6R")과 그 아래 표(7R까지)가 서로도 안 맞고, 실제 이력(9R까지)과는 둘 다 안 맞는다.
  - 제안: §배선 가드 표에 8R·9R 행을 추가하고(8R: `plan_guard` 가 7R 과 동일한 `.strip()` 결함을 그대로 갖고 있던 것 / 9R: 세 번째 손-복제(`branch_guard`) 통합 + `_summary_is_resolved` 무조건 `break` 잠복 결함), 상단 배너의 "1R~6R" 을 현재 라운드 수로 갱신한다.

- **[INFO]** `.claude/tests/README.md` 의 `test_review_guard_hardening.py` 행이 같은 라운드에 이 파일에 추가된 신규 회귀 테스트 클래스 두 개를 반영하지 않았다 — 같은 diff 안의 자매 행들(`test_plan_guard.py`, `test_workflow_yaml_structure.py`)은 "Rounds N-M added …" 서술로 갱신됐는데 이 행만 빠졌다.
  - 위치: `.claude/tests/README.md:57`(`test_review_guard_hardening.py` 행), `.claude/tests/test_review_guard_hardening.py` 모듈 docstring(파일 1-24행)
  - 상세: `git diff origin/main...HEAD` 로 확인하면 이번 PR 은 `test_review_guard_hardening.py` 에 `UnstagedModificationKeepsItsPathTest`(7R 추가 — 실제 저장소로 leading-space·non-ASCII quoting fail-open 을 구동)와 `RiskHeadingDecoyTest`(9R 추가 — 이번 라운드 CRITICAL 이었던 `_summary_is_resolved` 무조건 `break` 회귀)를 새로 넣었다. 그런데 `README.md:57` 의 행은 "porcelain rename parsing … rebase author-date regression … resolution-in-flight suppression" 만 나열하고 이 두 클래스는 언급하지 않는다. 같은 README diff 안에서 `test_plan_guard.py` 행(58행 부근)은 "Rounds 7-9 added real-repository coverage …" 로, `test_workflow_yaml_structure.py` 행(44행)은 "Rounds 5-7 grew this file past structural validity …" 로 정확히 이런 라운드별 추가를 서술하도록 갱신됐다 — 이 표의 확립된 관례가 이번엔 `test_review_guard_hardening.py` 에만 적용되지 않았다. 파일 자신의 모듈 docstring(1-24행) 도 `_summary_is_resolved` 항목을 "risk level found beyond the old 3-line window" 로만 적어, 이번에 고친 "무조건 break(디코이 헤딩)" 결함은 별도로 언급하지 않는다.
  - 제안: README 행에 두 문장 추가 — (a) `UnstagedModificationKeepsItsPathTest` 가 실제 저장소로 7R 의 leading-space·non-ASCII 결함을 구동한다는 것, (b) `RiskHeadingDecoyTest` 가 9R 의 디코이-헤딩 `break` CRITICAL 을 고정한다는 것. 파일 상단 docstring 의 `_summary_is_resolved` 불릿에도 "및 디코이 헤딩에 의한 조기 종료" 를 덧붙인다.

## 요약

핵심 판정 코드(`review_guard.py`/`plan_guard.py`/`branch_guard.py`/`_shared/git_probe.py`)와 CI 배선(`review-gate.yml`/`harness-checks.yml`/`check-review-gate.py`)의 독스트링·인라인 주석은 이례적으로 밀도가 높고, 지금 읽어도 실제 코드·테스트와 정확히 대응한다 — 각 방어선이 왜 그 모양인지, 무엇을 몇 라운드에서 뚫렸는지까지 소스에 남아 있다. 다만 이번 라운드가 새로 만든 공유 모듈 `git_probe.py` 는 자신이 정리한 세 번째 손-복제(`branch_guard.py`)를 자기 요약에서 빠뜨려 옆 파일의 서술과 모순되고, 이 작업 전체를 추적하는 plan 문서는 8R·특히 이번 9R(CRITICAL 3건)의 라운드 이력을 표·배너에 반영하지 않아 "라운드별 경화 이력" 이라는 이 문서의 존재 이유가 가장 최근 두 라운드에서 끊겼다. `.claude/tests/README.md` 카탈로그도 같은 diff 안에서 다른 행들은 라운드별 추가를 서술하도록 갱신됐는데 정작 이번 라운드의 CRITICAL 회귀 테스트가 들어간 행만 빠졌다. 셋 다 코드 동작에는 영향이 없는 순수 문서 드리프트이지만, 대상이 "우회가 매 라운드 한 층씩 옮겨간다" 는 것을 스스로 기록해 온 방어선이라는 점에서 기록 공백이 다음 라운드의 재작업 비용으로 이어질 수 있다.

## 위험도

LOW
