# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `test_report_playwright_flaky.py` 모듈 독스트링의 "harness-checks 게이트" 주장이 실제 CI 트리거 범위와 불일치
  - 위치: `.claude/tests/test_report_playwright_flaky.py:33-38` (모듈 독스트링) vs `.github/workflows/harness-checks.yml:7-17` (`on.pull_request.paths`)
  - 상세: 독스트링은 "`scripts/report_playwright_flaky.py` 의 파싱 로직이 조용히 회귀하면 flaky 관측 자체가 무력화된다. stdlib unittest 로 harness-checks 에서 게이트한다"고 명시한다. 그런데 `harness-checks.yml` 의 `paths:` 트리거 목록에는 `.claude/tests/**` 는 있지만 `scripts/**` 가 없다. 따라서 **이번 PR** 처럼 테스트 파일과 스크립트를 같은 diff 로 추가하면 트리거되지만, 앞으로 `scripts/report_playwright_flaky.py` **단독** 수정(테스트 파일 변경 없이)이 일어나면 `harness-checks` 워크플로 자체가 실행되지 않아 독스트링이 약속하는 "게이트"가 실제로는 작동하지 않는다. (`scripts/check-doc-links.py` 등 다른 `scripts/*.py` 는 애초에 이 gate 대상이 아니었어서 지금까지 드러나지 않은 gap.)
  - 제안: `harness-checks.yml` 의 `paths:` 에 `scripts/report_playwright_flaky.py` (또는 `scripts/**`)를 추가해 독스트링이 서술하는 보장과 실제 CI 배선을 일치시킨다. 그렇지 않으면 독스트링 문구를 "harness-checks 가 `.claude/tests/**` 변경 시에만 게이트한다"로 완화해 과장을 없앤다.

- **[INFO]** `.claude/tests/README.md` "What's covered" 표에 신규 테스트 파일 미등재
  - 위치: `.claude/tests/README.md:21-29`
  - 상세: README 는 각 `test_*.py` 를 표로 나열하며 "무엇을 가드하는지" 설명하는 것이 컨벤션인데, 신규 `test_report_playwright_flaky.py` 가 표에 없다. (다만 `test_plan_guard.py`·`test_consistency_impl_done.py`·`test_reap_merged_worktrees.py`·`test_run_test_watchdog.py` 도 이미 빠져 있어 이 gap 이 이번 PR 로 새로 생긴 것은 아니고 기존 누락 패턴이 이어진 것.)
  - 제안: 여유가 있으면 신규 행 1개 추가(예: "Playwright JSON 리포트에서 flaky 테스트를 추출하는 `find_flaky`/`render_markdown` 파싱·렌더 로직 회귀 방지"). 급하지 않으면 별도 정리 후속으로 미뤄도 무방(기존에도 지켜지지 않던 컨벤션).

- **[INFO]** `PROJECT.md` "보조 스크립트 (검증·운영)" 섹션에 신규 스크립트 미등재
  - 위치: `PROJECT.md:317-330` (§보조 스크립트, `check-doc-links.py` 항목과 동일 포맷)
  - 상세: 이 섹션은 정확히 `report_playwright_flaky.py` 와 같은 성격("설치 불요·stdlib 전용·용도·실행 방법"의 검증 스크립트)을 문서화하는 자리인데, 신규 스크립트가 여기 등재되지 않았다. 현재는 `playwright.config.ts` 주석·`e2e.yml` 주석·스크립트 자체 독스트링을 따라가야 발견 가능.
  - 제안: `check-doc-links.py` 항목과 같은 톤으로 짧은 서브섹션(용도/트리거 시점/exit code 정책) 추가를 고려. 필수는 아니나 §보조 스크립트가 "검증 스크립트 카탈로그"로 기능하는 만큼 발견성이 좋아진다.

- **[INFO]** `find_flaky` 독스트링이 재시도 횟수 계산 범위를 정확히 서술하지 않음
  - 위치: `scripts/report_playwright_flaky.py:948-953` (`find_flaky` 독스트링)
  - 상세: "spec 의 어떤 test 든 flaky 면 그 spec 을 flaky 로 집계하고, `results[].retry` 의 최댓값을 재시도 횟수로 쓴다"고만 서술한다. 실제 구현은 그 spec 에 속한 **모든** test(status 무관, flaky 아닌 test 포함)의 `results[].retry` 를 함께 훑어 최댓값을 취한다(`test_spec_flaky_if_any_test_flaky` 케이스가 이를 검증). "어떤 test 든" 이라는 표현이 두 가지로 읽혀(① flaky 판정 조건, ② retry 집계 대상) 후자가 "flaky 로 표기된 test 만" 이라고 오독될 여지가 있다.
  - 제안: "…그 spec 의 모든 test(project 별)의 results[].retry 최댓값을 재시도 횟수로 쓴다"로 한 문장 보강.

- **[INFO]** `main()` 에 함수 독스트링 부재 + line=0 처리 비대칭이 주석으로 설명되지 않음
  - 위치: `scripts/report_playwright_flaky.py:1019-1044`
  - 상세: (a) `main(argv)` 자체엔 독스트링이 없다(모듈 독스트링이 사용법을 커버하므로 경미). (b) `render_markdown`/`_location` 은 `line == 0` 이면 `:line` 을 생략하도록 명시적으로 처리·테스트되어 있는데(`test_flaky_table_lists_each` 의 `e2e/b.spec.ts` 케이스), `main()` 의 `::warning file=...,line={f['line']}::` 어노테이션 출력은 동일 처리 없이 `line=0` 을 그대로 찍는다. 두 출력 경로의 line 처리가 다른데 그 차이를 설명하는 주석이 없어, 왜 markdown 표만 line 0 을 특별 취급하는지 다음 유지보수자가 의도인지 누락인지 판단하기 어렵다.
  - 제안: 사소하지만 `main()` 에 한 줄 독스트링을 추가하거나, `::warning::` 출력부에 "line 0 이어도 어노테이션 자체엔 무해하므로 markdown 과 달리 그대로 둔다" 같은 주석을 붙여 의도를 명문화.

## 요약

이번 변경(flaky surfacing 스크립트·CI 스텝·config 주석·plan 문서)은 문서화 품질이 전반적으로 높다. 신규 Python 스크립트·테스트 파일 모두 배경(왜 필요한지)·계약(항상 exit 0, 리포트 부재 시 no-op)·SoT(plan 경로, PR 번호)까지 포함한 충실한 모듈/함수 독스트링을 갖췄고, `.github/workflows/e2e.yml`·`playwright.config.ts` 의 인라인 주석도 새 스텝/리포터의 목적과 상호작용(always(), host-mount, 머신 판독 vs 사람 판독)을 정확히 설명하며 서로 모순 없이 정합한다. `plan/in-progress/e2e-retry-visibility-followup.md` → `plan/complete/`로의 이동도 필수 frontmatter(`worktree`/`started`/`owner`/`spec_impact: none`)를 갖춰 라이프사이클 규약을 준수했다. CHANGELOG.md 미갱신은 이 변경이 CI/observability 전용(`spec_impact: none`, 기존 CHANGELOG 엔트리들이 모두 spec-linked 제품 변경인 것과 대비)이라는 점에서 기존 관례(#872/#873 류 안정화 커밋도 CHANGELOG 미등재)와 일치해 문제로 보지 않는다. 유일하게 실질적인 지적은 `test_report_playwright_flaky.py` 독스트링이 서술하는 "harness-checks 게이트" 보장이 `harness-checks.yml` 의 `paths:` 트리거에 `scripts/**` 가 빠져 있어 스크립트 단독 수정 시 실제로는 작동하지 않는다는 점이며, 나머지는 기존에도 지켜지지 않던 README/§보조 스크립트 카탈로그 등재 누락이나 서술 정밀도 관련 경미한 개선 여지다.

## 위험도
LOW
