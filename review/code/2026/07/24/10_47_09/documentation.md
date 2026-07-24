# Documentation Review — push-guard-worktree-scope (session 10_47_09)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_worktree_scope.py`,
`.claude/tests/README.md`

## 발견사항

- **[WARNING]** `.claude/tests/README.md` 테이블 47행이 이스케이프 안 된 `|` 로 3열로 쪼개져,
  GFM 렌더링 시 마지막 문단이 통째로 사라진다
  - 위치: `.claude/tests/README.md:47` (`test_push_guard_allowlist.py` 행)
  - 상세: 이 행 본문 중간에 `\|` 로 이스케이프되지 않은 리터럴 `|` 가 하나 있다
    (`... shared with the nudge hook's suite so a shape learned from one guard is
    immediately tried against the other. | §J (2026-07-24) split the frozen constant
    in two, ...`). 헤더는 `| File | Guards |` 로 2열이고(`|---|---|`), 이 파일의 다른 모든 행은
    `... |` 로 닫혀 있는데(46행·48행 확인: 둘 다 ` |` 로 끝남) 47행만 `... that.` 로 끝나 닫는
    파이프가 없다. GFM 표 규칙상 헤더보다 셀이 많은 본문 행은 초과분이 **버려진다** — 즉
    `_LEGACY_PATTERN`/`_BLIND_PATTERN` 분리 배경과 `EnvValueSubpatternSharedTest` 설명을 담은
    마지막 문단 전체가 GitHub 렌더 화면에서 안 보이게 된다. 이 파일의 다른 어떤 행에도 리터럴
    `|` 사용례가 없어(`grep '\\|'` 0건) 관례가 아니라 결함이다. `test_tests_readme_catalog.py`
    는 각 행의 선두 패턴(`^| \`test_x.py\` |`)만 파싱하므로 이 파손을 잡지 못한다(가드 사각).
    `git blame`/`git log -S` 로 추적한 결과 이 파손은 이 브랜치가 직접 작성한 커밋이 아니라
    **origin/main 의 PR #1003(커밋 `10441e1bc`)에서 이미 이 형태로 들어왔고**(`git merge-base
    --is-ancestor 10441e1bc origin/main` 확인), 이번 브랜치의 병합 커밋(`26c8e86a3`, "README
    카탈로그 3행 병합")이 그대로 흡수했다. 즉 이번 작업 자체가 만든 신규 결함은 아니지만, 지금
    이 파일이 이 상태로 push 될 것이므로 리뷰 대상 파일 안에 실재하는 결함이다.
  - 제안: 47행의 리터럴 `|` 를 제거하고(그 뒤 문장을 같은 셀 안으로 이어 붙이거나 `\|` 로
    이스케이프), 행 끝에 닫는 ` |` 를 추가해 2열 구조로 복원. 근본 원인이 origin/main 쪽 PR
    이므로 그쪽에도 같은 수정이 필요할 수 있음을 함께 기록.

- **[INFO]** `_run_gates` 의 `targets` 매개변수가 docstring 에 여전히 설명되지 않음 (기지의 이월 항목)
  - 위치: `.claude/hooks/guard_review_before_push.py:692`
  - 상세: 시그니처는 `_run_gates(outcome: _Outcome, targets: list[str]) -> int`인데 docstring 은
    `"""Run both gates, recording into `outcome` what each one did."""` 한 줄 그대로다. 이 항목은
    직전 라운드(`review/code/2026/07/24/01_25_15/documentation.md` INFO 2)에서 이미 지적됐고,
    같은 라운드 RESOLUTION 이 "미조치 — 낮은 우선순위" 로 분류한 뒤 그대로 유지되고 있다(새로
    발견된 것 아님, 재확인 목적). 기능 영향 없음.
  - 제안: 조치 불요(기존 판단 유지) — 다음에 이 함수를 만질 때 `targets` 한 줄 추가 권장.

- **[INFO]** 일부 private 헬퍼(`_read_payload`, `_import_reason`, `main`)에 docstring 이 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:335`(`_read_payload`), `:638`(`_import_reason`),
    `:741`(`main`)
  - 상세: 이 파일은 지배적으로 근거·엣지케이스를 상세히 설명하는 docstring 관례를 갖고 있으나
    (`_owns_heredoc_as_message`, `_is_git_push`, `_worktree_branches`, `_push_targets`,
    `_evaluate_over_targets`, `_report_fail_open` 등 모두 상세 docstring 보유), 위 3개는 이름과
    본문만으로 자명한 짧은 함수라 실질적 문서 손실은 적다. `main()` 은 `finally` 절 근거를 설명하는
    인라인 주석으로 실질적으로 대체돼 있다.
  - 제안: 낮은 우선순위 — 필요 시 한 줄 docstring 추가.

## 확인된 양호 사항 (참고, 조치 불요)

- 직전 두 라운드(`01_25_15`, `01_46_34`)가 지적했던 WARNING(회귀 테스트 docstring 의 리뷰 라운드
  오귀속 `17_51_28`→`18_06_41`)과 INFO(`# SoR:` stale 경로 `plan/in-progress/`→`plan/complete/`)가
  현재 파일에서 실제로 정정돼 있음을 직접 열어 재확인했다(`test_push_guard_worktree_scope.py:438`,
  `guard_review_before_push.py:96`).
- §J 관련 신규 주석 블록(`guard_review_before_push.py:102-122` 부근, env-prefix 이스케이프 인식
  버그·후행 `\S+` 폴백 근거·`EnvValueSubpatternSharedTest`/`ReleasePathNarrownessTest` 교차참조)은
  왜/무엇이 고쳐졌는지, 어떤 테스트가 그 불변식을 고정하는지까지 구체적으로 서술돼 이 파일의
  기존 문서화 수준과 일치한다.
- 신규 테스트 `test_bypass_plan_also_suppresses_a_scoped_block` 은 왜 이 테스트가 필요한지(REVIEW
  쪽엔 있었지만 PLAN 쪽엔 없었던 비대칭, 이전에 그 비대칭으로 실제로 당한 이력)를 docstring 에
  명시한다.
- `.claude/tests/README.md` 의 `test_push_guard_worktree_scope.py` 행(48행)은 실제 테스트가
  커버하는 항목(false-ALLOW 회귀 핀, PLAN 게이트 대칭 스코핑, `_accepts_cwd` 계약, 두 fail-open
  경로, `_mentions_branch` 경계, 절단 상한, cwd 항상 평가, `BYPASS_*`)과 1:1로 정확히 대응한다.
  이 행 자체는 정상적으로 닫혀 있다(파이프 파손은 바로 위 47행에 한정).
  `test_tests_readme_catalog.py` 요구(모든 테스트 파일이 표에 존재)도 충족.
- `plan/in-progress/push-guard-worktree-scope.md` 는 raw text 로 4라운드(17_28_02 → 17_51_28 →
  18_06_41 → 01_25_15)의 반영 이력·mutation 실측표(M1~M11)·origin/main 이 같은 파일에서 두 번
  앞서간 사건(§E 관측 구조, §J 탐지 버그픽스)·잔여 갭 3항목을 최신 상태로 유지한다. "테스트
  24건" 주장은 `test_push_guard_worktree_scope.py`의 실제 테스트 메서드 수(24개, 직접 카운트로
  검증)와 정확히 일치한다.
- 이 저장소는 CHANGELOG.md 대신 plan 문서를 변경 이력으로 쓰는 관례이며 이번 변경은 그 관례를
  충실히 따른다. API 문서·신규 환경변수·예제 코드: 해당 없음(harness 내부 pre-push 훅, 신규
  공개 API·env var 없음 — `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 는 기존 변수 재사용). 테스트
  파일 자체가 신규 함수들의 사용례 역할을 이미 수행.
- `guard_review_before_push.py` 모듈 상단 docstring 의 "Contract" 절은 `guard_default_branch_edit.py`
  의 실제 docstring 과 문구까지 일치함을 대조 확인.

## 요약

이번 diff(§J push-탐지 버그픽스 흡수 + `test_bypass_plan_also_suppresses_a_scoped_block` 신설 +
회귀 테스트 docstring 라운드 인용 정정)는 이미 4라운드 수렴을 거친 worktree-스코핑 기능 위에 얹힌
소규모 변경이며, 문서화 수준은 전반적으로 매우 높다 — 신규 정규식 로직 근거, 테스트 docstring,
plan 변경 이력이 모두 정확·최신이다. 실질적 신규 결함 1건은 `.claude/tests/README.md:47` 행이
이스케이프 안 된 리터럴 `|` 때문에 GFM 렌더링에서 마지막 문단(§J 관련 `_LEGACY_PATTERN`/
`_BLIND_PATTERN` 분리 설명)이 통째로 사라지는 것이다 — 다만 `git log -S`로 추적한 결과 이는 이
브랜치가 아니라 origin/main 의 PR #1003 에서 이미 이 형태로 들어와 병합으로 흡수된 것이라, 이번
작업이 새로 만든 결함은 아니다. 그 외 INFO 2건은 모두 이미 알려진(일부는 직전 라운드가 이미
"낮은 우선순위"로 분류) 사소한 docstring 공백이다.

## 위험도

LOW
