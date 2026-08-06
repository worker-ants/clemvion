# 보안(Security) Review — round 10

대상: `.claude/_shared/git_probe.py`, `.claude/hooks/_lib/{branch_guard,plan_guard,review_guard}.py`,
`.claude/tests/{README.md,test_block_integrity.py,test_plan_guard.py,test_review_gate_ci.py,
test_review_guard_hardening.py,test_stop_guard_failopen.py,test_workflow_yaml_structure.py}`,
`.github/workflows/{harness-checks.yml,review-gate.yml}`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`.

`review_guard.py`·`.claude/tests/README.md`·`test_block_integrity.py`·`test_review_gate_ci.py` 는
프롬프트에서 절단돼 `Read` 로 전문을 직접 확인했다 (`.claude/hooks/_lib/review_guard.py` 1007줄,
`.claude/tests/test_review_gate_ci.py` 830줄, `.claude/tests/test_block_integrity.py` 845줄,
`.claude/tests/README.md` 102줄 — 전량 읽음). `.claude/_shared/block_integrity.py` ·
`.claude/_shared/report_paths.py` 도 `review_guard.py` 가 위임하는 판정 코드라 함께 열어 확인했다.

## 발견사항

- **[WARNING]** `harness-checks.yml` 이 PR 이 공급한(잠재적으로 신뢰할 수 없는) Python 테스트
  코드를 실행하는데 최소권한 `permissions:` 를 선언하지 않는다.
  - 위치: `.github/workflows/harness-checks.yml:90-91` (`- name: Run harness unit tests` /
    `run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'`)
  - 상세: 이 step 은 PR diff 안의 `.claude/tests/test_*.py` 를 `unittest discover` 로 그대로
    실행한다 — 즉 그 PR 이 추가/수정한 파이썬 코드가 CI 러너 안에서 임의 실행된다. 이 워크플로는
    `permissions:` 블록이 전혀 없어 조직/저장소의 기본 `GITHUB_TOKEN` 권한(원 저장소에 read-write
    가 기본이던 시기에 만들어진 저장소라면 write 일 수 있다)을 그대로 상속한다. 같은 작업에서
    나온 자매 파일 `review-gate.yml:41-42` 는 정확히 이 이유로 `permissions: {contents: read}` 를
    명시했고 그 주석이 "기존 파일 다수가 생략하고 있지만 신규 파일이니 명시한다" 라고 스스로
    적어 두었다 — 즉 이 저장소도 이 패턴이 방어적으로 필요하다는 것을 이미 인지하고 있다.
    `actions/checkout@v7` (harness-checks.yml:75) 는 기본값 `persist-credentials: true` 이므로,
    실행되는 PR 코드가 `.git/config` 의 인증 헤더를 읽어 그 토큰으로 API 를 호출하는 것도
    이론상 막혀 있지 않다. `pull_request` 트리거이므로 **fork 발 PR** 은 GitHub 플랫폼이
    `GITHUB_TOKEN` 을 강제로 read-only 로 낮춰 주지만, 이 저장소의 실제 작업 방식은
    `.claude/worktrees/` + 같은 저장소 안의 `claude/*` 브랜치(= fork 아님)이므로 그 플랫폼
    보호가 적용되지 않는 경로가 주 워크플로다.
  - 제안: `harness-checks.yml` 에도 `permissions: {contents: read}` 를 명시(자매 파일과 동일
    패턴)하고, 두 워크플로의 `actions/checkout` step 에 `persist-credentials: false` 를 추가해
    실행되는 PR 코드가 그 인증정보를 아예 볼 수 없게 한다. 이 저장소가 fork 가 아니라 브랜치
    기반 PR 위주라는 점에서 이 조치의 실효성이 특히 크다.

- **[INFO]** PyYAML 설치가 해시 고정(`--require-hashes`) 없이 버전 범위만 고정한다.
  - 위치: `.github/workflows/harness-checks.yml:87-88` (`pip install "pyyaml>=6,<7"`)
  - 상세: 공급망 무결성 검증이 없다. 다만 PyYAML 은 잘 알려진 단일 소유자 패키지이고, 세 워크플로
    간 pin 값 일치는 `test_review_gate_ci.py::PyYamlPinsAgreeTest` 가 이미 고정하고 있어 drift
    위험은 낮다. 차단 사유는 아니고 참고용 개선 여지.
  - 제안: 여유가 있다면 `constraints.txt` + `--require-hashes` 또는 `pip-audit` 단계 검토.

- **[INFO]** `actions/checkout@v7` 가 두 워크플로 모두 `persist-credentials` 기본값(=true)을
  그대로 둔다.
  - 위치: `.github/workflows/review-gate.yml:55-57`, `.github/workflows/harness-checks.yml:75`
  - 상세: `review-gate.yml` 은 `permissions: {contents: read}` 로 이미 범위를 좁혀 두었고 이
    잡은 push 를 하지 않으므로 실질 위험은 낮지만, 방어 심층화(defense-in-depth) 관점에서
    checkout 이후 git 자격증명이 워크스페이스에 남을 이유가 없다.
  - 제안: 두 워크플로 checkout step 에 `persist-credentials: false` 추가.

## 확인된 견고한 지점 (참고, 발견사항 아님)

- `Fetch base ref` step (`review-gate.yml:67-70`) 이 `${{ github.base_ref }}` 를 `run:` 에
  직접 보간하지 않고 `env: BASE_REF` 경유로 셸에 전달한다 — GitHub Actions expression-injection
  방어 관행을 정확히 따랐다.
- `_shared/git_probe.py._run_git` 을 포함해 저장소 전체의 git 호출이 리스트 인자
  (`subprocess.run(["git", ...], ...)`) 로만 이루어지고 `shell=True` 사용이 전무하다 — 커맨드
  인젝션 표면이 없다.
- `review_guard._glob_to_regex` (spec `code:` glob → regex, `review_guard.py:539,566-567`) 와
  `block_integrity._BLOCK_AT_LINE_START/_END` (`block_integrity.py:71-113`) 모두 이전 라운드에서
  발견된 ReDoS 를 실측 후 선형 패턴/와일드카드 상한으로 고정했고, 회귀 테스트가 서브프로세스 +
  타임아웃으로 재발을 잡는다(`test_block_integrity.py::VerdictParserStaysLinearTest`,
  `SpecGlobCompilationIsBoundedTest`).
- 두 워크플로 모두 `secrets.` 참조가 없고 `pull_request_target` 을 쓰지 않는다 — fork 발 PR 에
  대해 시크릿 노출/쓰기 권한 승격 경로가 없다.
- `dependabot[bot]` 면제(`review-gate.yml:51`)는 GitHub 이 예약한 봇 계정명이라 일반 사용자가
  자기 `github.actor` 를 그 값으로 위장할 수 없다 — actor 스푸핑으로 백스톱을 우회하는 경로 없음.
- 하드코딩된 API 키/비밀번호/토큰 없음. 평문 전송·안전하지 않은 해시/암호화 알고리즘 사용 없음
  (암호 관련 로직 자체가 이 변경 범위에 없음).
- 예외 처리가 전부 `except Exception as exc: print(f"...{type(exc).__name__}: {exc}", ...)`
  형태로 일관되고, 스택트레이스나 파일시스템 절대경로 이상의 민감정보(자격증명·내부 IP 등)를
  노출하지 않는다.
- `report_paths.report_path()` 는 세션 상태 파일에 기록된 `output_file` 값에서
  `os.path.basename()` 만 취해 `session_dir` 에 join 하므로, 그 값에 `../` 가 섞여도 경로 탈출이
  불가능하다 — path traversal 방어가 이미 되어 있다.

## 범위 밖(이미 결정된 사항, 재지적 아님)

컨텍스트에 명시된 대로 다음은 이번 라운드가 다시 다룰 대상이 아니라고 판단해 발견사항에서
제외했다: 게이트가 "리뷰 산출물의 존재/형태" 만 보고 "리뷰가 실제로 수행됐는지"는 보지 않는다는
신뢰 모델(예: `review_guard._summary_is_resolved` 가 `RESOLUTION.md` 를 존재 여부만으로 인정,
`_forced_coverage_missing` 이 `_retry_state.json` 부재 시 fail-open) — 이는 `--enforce` 전환의
선행 조건으로 이미 plan 문서(`harness-review-gate-ci-backstop.md`)에 실증·기록되어 있고, 현재
관측 모드(`review-gate.yml` 이 `--enforce` 없이 항상 exit 0)에서는 실질적으로 아무 PR 도 이
경로로 차단되지 않으므로 활성 위험이 아니다.

## 요약

인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화 등 OWASP Top 10 범주의 활성 취약점은
발견되지 않았다. git 서브프로세스 호출은 전부 리스트 인자로 안전하고, GitHub Actions
expression-injection 방어(env 경유 보간)가 정확히 적용됐으며, 이전 라운드에서 지적된 ReDoS 두
건은 측정 기반으로 고정되고 회귀 테스트까지 갖췄다. 유일하게 실질적인 개선 여지는
`harness-checks.yml` 이 PR 이 공급한 파이썬 테스트 코드를 최소권한 선언 없이 실행한다는 점으로,
같은 작업에서 나온 `review-gate.yml` 이 이미 적용한 `permissions: contents: read` 패턴을
따르지 않는 비일관성이다 — fork 가 아닌 브랜치 기반 PR 을 쓰는 이 저장소 구조상 무시하기 애매한
지점이라 WARNING 으로 기록한다. 나머지는 방어 심층화 수준의 INFO.

## 위험도

LOW
