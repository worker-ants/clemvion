# 보안(Security) Review — CI 백스톱 (review-gate.yml) round 12

## 방법론 메모

리뷰 대상 15개 파일 중 프롬프트에 전문이 실리지 않은 것(`.claude/hooks/_lib/review_guard.py`,
`.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
`.claude/tests/test_review_guard_hardening.py`, `.claude/tests/test_review_gate_ci.py` 465줄
초과분)은 전부 `Read` 로 원본을 직접 열어 확인했다. 아래 인용 줄 번호는 (a) 프롬프트에 게이트가
붙은 파일은 그 게이트 숫자, (b) `Read` 로 직접 연 파일(주로 `review_guard.py`,
`test_review_guard_hardening.py`, `test_block_integrity.py`)은 `Read` 출력의 실제 소스 줄
번호를 그대로 썼다.

이 브랜치는 CI 백스톱을 1R~11R 에 걸쳐 반복적으로 우회 시도 → 경화해 온 이력이 있고, 이번
라운드(12R)에서 이전 라운드 결과물(테스트 픽스처 격리, `refs/remotes/origin/<name>` 폴백, 우회
0건 상태) 위에서 전체 파일셋을 재검토했다. 아래는 그 위에서 발견한 것이다.

## 발견사항

- **[INFO]** GitHub Actions가 커밋 SHA가 아니라 이동 가능한 태그(`@v7`)로 고정돼 있다
  - 위치: `.github/workflows/review-gate.yml:55,59` (`actions/checkout@v7`, `actions/setup-python@v7`), `.github/workflows/harness-checks.yml:80,84,105` (`actions/checkout@v7`, `actions/setup-python@v7`, `actions/setup-node@v7`)
  - 상세: 태그 고정은 해당 태그가 재푸시(force-push)되거나 액션 자체가 손상될 경우 CI 실행 코드가 조용히 바뀔 수 있는 공급망 표면이다. `review-gate.yml`/`harness-checks.yml` 은 `contents: read` 만 요구하고 `pull_request`(비-`pull_request_target`)로 시크릿 노출이 없으므로 영향은 제한적이지만, 이 워크플로들은 리뷰 게이트 자체의 판정 로직을 실행한다는 점에서 일반 CI job보다 신뢰 요구가 높다.
  - 제안: 저장소 전체 컨벤션(다른 워크플로도 동일하게 태그 고정)과 일관되므로 이번 PR 단독으로 고칠 항목은 아니다. 저장소 차원에서 SHA 고정(`actions/checkout@<sha> # v7`) 전환을 별도 트래킹 항목으로 남기는 것을 권장.

- **[INFO]** `pyyaml` 이 정확한 버전/해시가 아니라 범위(`>=6,<7`)로 pin 되어 있다
  - 위치: `.github/workflows/harness-checks.yml:93` (`run: pip install "pyyaml>=6,<7"`)
  - 상세: 사소한 공급망 표면 — 그 범위 안에서 PyPI에 새 버전이 게시되면 검증 없이 설치된다. `test_review_gate_ci.py::PyYamlPinsAgreeTest`(원본 `.claude/tests/test_review_gate_ci.py:806-835`)가 이 pin 이 워크플로 간에 최소한 서로 갈리지 않는지는 지키지만, 해시 고정까지는 하지 않는다.
  - 제안: PyYAML 은 잘 알려진 안정적 패키지이고 사용자 입력이 아니므로 위험도는 낮다. 우선순위를 올릴 근거가 생기면(`pip install --require-hashes` 또는 `constraints.txt` 도입) 그때 처리해도 충분.

- **[INFO]** `_default_branch()`의 최종 로컬 fallback이 origin의 실제 기본 브랜치를 확인하지 않고 이름 우선순위로 추정한다
  - 위치: `.claude/_shared/git_probe.py:163-167` (`for ref in ("refs/remotes/origin/{}", "refs/heads/{}"): for name in ("main", "master")`)
  - 상세: `refs/remotes/origin/HEAD` symbolic-ref 와 네트워크 조회(`git remote show origin`)가 둘 다 실패했을 때만 도달하는 3순위 경로다. 이 경로는 `origin/main`, `origin/master`, 로컬 `main`, 로컬 `master` 순으로 **존재 여부만** 보고 첫 매치를 반환한다 — origin의 실제 기본 브랜치가 무엇인지는 절대 확인하지 않는다. `refs/remotes/origin/main` **과** `refs/remotes/origin/master` 가 둘 다 로컬에 존재하는(레거시 전환기 저장소 등) 특수 토폴로지에서, origin의 진짜 기본이 `master` 여도 이 경로는 `main` 을 고른다. 이 경우 `_merge_base()`가 잘못된 브랜치 기준으로 diff base 를 계산해 "이 브랜치가 바꾼 파일" 목록이 실제와 달라질 수 있다 — 게이트가 봐야 할 변경 중 일부를 놓치는 방향으로 흐를 여지가 있다(우선순위 (1)이 명시한 "게이트가 실제보다 덜 보게 만드는" 클래스에 해당).
  - `ActionsCheckoutTopologyTest::test_the_remote_tracking_ref_outranks_a_local_branch_of_another_name`(`.claude/tests/test_review_guard_hardening.py:898-933`)는 "로컬 `main` vs origin의 `master`" 케이스만 고정하고, "origin에 `main`과 `master`가 둘 다 존재" 케이스는 커버하지 않는다.
  - 제안: 이 저장소 자신은 `main` 단일 기본 브랜치이고 이 경로는 이미 상위 2개 방법이 실패했을 때만 닿는 최종 방어선이라 현재 도달 가능성은 낮다(round 11 修 자체가 "measured, 도달 불가 → 그래도 correctness로 넣는다" 패턴을 반복해 온 이 브랜치의 관행과 같은 성격). CRITICAL로 올릴 근거(실측된 도달 가능성)는 없어 INFO로 남긴다 — 다만 다음에 이 경로를 만지게 되면 "origin에 main·master 둘 다 존재" 케이스를 회귀 테스트로 추가할 가치는 있다.

- **[INFO]** (긍정 확인, 회귀 아님) `Fetch base ref` 스텝이 `${{ github.base_ref }}`를 `run:` 문자열에 직접 보간하지 않고 `env:` 경유로 셸에 넘긴다
  - 위치: `.github/workflows/review-gate.yml:67-70`
  - 상세: GitHub Actions 의 알려진 injection 클래스(`${{ }}` 를 `run:` 문자열에 직접 삽입하면 attacker-controlled 컨텍스트 값이 셸 스크립트로 그대로 치환됨)를 코멘트에 명시하고 올바르게 회피하고 있다. `pull_request` 이벤트라 시크릿 노출도 없다. 새로 도입된 파일이라 확인 삼아 긍정 기록.

## 확인했으나 재보고하지 않은 항목 (CONTEXT 의 Known limits)

- 게이트가 "리뷰가 실제로 수행됐는가"가 아니라 리뷰 **산출물의 존재·형태**만 검증하는 신뢰
  모델(`_forced_coverage_missing` 이 `_retry_state.json` 부재/조작 시 `[]`를 반환해 커버리지
  요구가 사라지는 경로 포함, `review_guard.py:386-402`)과, 게이트 자신의 코드가 PR HEAD에서
  로드된다는 사실은 `--enforce` 전환의 선행조건으로 이미 `plan/in-progress/harness-review-gate-ci-backstop.md`
  에 등재돼 있다. 현재 워크플로는 관측 모드(`--enforce` 없음, `scripts/check-review-gate.py:3037`
  이하 관측 분기)라 이 신뢰 모델이 실제로 push 를 막는 데 쓰이지 않으므로 CRITICAL 로
  재기재하지 않았다.
- `Fetch base ref` 스텝이 `fetch-depth: 0` 위에서 실제로 필요한지는 실 Actions 러너 없이는
  검증 불가 — 지시대로 재보고하지 않음.
- 기대값(`WorkflowWiringTest.EXPECTED`, `.claude/tests/test_review_gate_ci.py:412-447`)과
  워크플로 문서를 "함께" 편집하면 항상 통과하는 구조적 한계 — 지시대로 재보고하지 않음.

## 실측 확인 사항

- 하드코딩된 시크릿: 15개 대상 파일 전체에 대해
  `grep -rniE "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][A-Za-z0-9+/=_-]{8,}"` 실행
  → 매치 1건(`review_guard.py:153` `_IMPL_DONE_MODE_TOKEN = "--impl-done"`), 오탐 확인(모드
  레이블 상수이지 시크릿 아님). 실제 시크릿 없음.
- 커맨드 인젝션: `git_probe.py::_run_git` 을 포함해 리뷰 대상 전체의 `subprocess.run` 호출은
  전부 리스트 인자이며 `shell=True` 사용 없음 — 셸 인젝션 표면 없음.
- ReDoS: `_glob_to_regex`(spec `code:` glob → regex, `review_guard.py:542-590`)는 와일드카드
  6개 상한(`_MAX_GLOB_WILDCARDS`)으로 지수 폭발을 차단하고
  `test_block_integrity.py:577-637`(`SpecGlobCompilationIsBoundedTest`)로 서브프로세스+timeout
  실측 고정돼 있음. `block_integrity.summary_block_verdict` 의 과거 이차 정규식 결함도
  `test_block_integrity.py:492-575`(`VerdictParserStaysLinearTest`)로 실측 회귀 테스트가 있음.
- 권한: `review-gate.yml`·`harness-checks.yml` 모두 `permissions: contents: read` 명시,
  `pull_request`(비-`pull_request_target`) 사용 — 시크릿 접근·권한 상승 표면 없음.
- 경로 탐색: `stop._marker_path` 의 `session_id`/`branch` 새니타이징은
  `test_review_guard_hardening.py:363-369`(`test_marker_path_sanitizes_path_traversal`)로
  이미 고정. `plan_guard.py` 의 `worktree:` frontmatter 값은 파일 경로 조립이 아니라 비교
  대상(`_normalize_worktree_value` → `keys` 집합 매칭)으로만 쓰여 경로 탐색 표면 없음.

## 요약

이 브랜치는 정규식/구조 우회를 겨냥한 11라운드의 적대적 리뷰를 거치며 판정자 단일성·환경변수
비의존성·워크플로 문서 전체 고정·실 저장소 기반 행위 테스트로 이미 매우 강하게 경화돼 있다.
이번 라운드에서 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화·민감정보 노출 클래스의
새로운 결함은 발견하지 못했다. 남은 것은 전부 INFO 수준 — 액션 태그 고정(SHA 미고정),
PyYAML 버전 범위 pin, 그리고 `_default_branch()` 최종 fallback 이 (도달 극히 드문 조건에서)
origin 실제 기본 브랜치를 확인 없이 이름 순으로 추정하는 잔여 엣지 케이스다. 이미 문서화된
"산출물 형태만 검증" 신뢰 모델과 "게이트 코드가 PR HEAD 에서 로드됨" 전제는 지시에 따라
`--enforce` 선행조건으로만 남기고 재기재하지 않았다.

## 위험도

NONE
