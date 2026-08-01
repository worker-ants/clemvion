# Code Review 통합 보고서

## 전체 위험도

**LOW** — 14개 에이전트 전원 개별 위험도 NONE 또는 LOW(CRITICAL/HIGH/MEDIUM 0건). 다만 WARNING 9건(다수가 뮤테이션/실측으로 실제 재현된 "가드·회귀테스트 사각지대")이 확인됐고, 그중 2건(`--root` 기본 경로 미검증 → silent-permanent-disable, `in_flight_ok` opt-in 회귀 방지 테스트 부재)은 `--enforce` 전환 전에 반드시 닫아야 할 실질적 리스크다. 오늘 시점 코드에 활성 결함은 없다 — 전부 "미래 회귀를 못 잡을 수 있는 방어망의 구멍" 성격.

## Critical 발견사항

없음 — 14개 에이전트 중 CRITICAL 등급 발견사항 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성 / 보안 | `review-gate.yml`의 트리거 `paths:`가 `review_guard.py`(965행 `_default_branch(cwd)`)가 실제로 import하는 형제 모듈 `branch_guard.py`(127행 `from branch_guard import _origin_default_branch`)를 커버하지 않는다. `branch_guard.py` 단독 변경 PR은 이 워크플로를 전혀 트리거하지 않음 — 이 저장소가 6번 겪은 "가드 로직이 바뀌었는데 CI가 재검증 안 함" 실패 클래스와 동일 모양. 현재 관측 모드라 즉시 위험은 없음. `harness-checks.yml`의 넓은 커버리지 + `test_branch_guard.py`가 있어 실무 위험은 제한적 | `.github/workflows/review-gate.yml:24-31`(특히 28행) | `paths:`에 `.claude/hooks/_lib/branch_guard.py`(또는 `.claude/hooks/_lib/**`) 추가, 또는 `review-gate.yml`용 paths-coverage 회귀 테스트를 `test_harness_checks_paths_coverage.py`와 같은 패턴으로 신설 |
| 2 | 아키텍처 / 테스트 | 자기-배선(self-wiring)을 지키는 신규 테스트들이 구조적 YAML 파싱이 아니라 "주석 제거 후 전체 텍스트 substring 검사"라서, 실제 배선이 깨져도 같은 문자열이 다른 위치에 남아 있으면 계속 GREEN. **두 실측 사례**: (a) `scripts/check-review-gate.py` 문자열이 `paths:`(트리거)와 `run:`(실행) 두 곳에 나타나 한쪽만 지워도 `test_it_runs_the_script`/`test_it_triggers_on_the_gate_it_depends_on`가 계속 통과(양방향 재현). (b) `if: github.actor != 'dependabot[bot]'` 조건 자체를 지우고 무관한 `run: echo` 스텝에 같은 문자열만 남겨도 `test_it_exempts_dependabot`가 계속 통과(재현). 같은 파일의 `OneJudgeTest`는 이미 "단어가 아니라 연산" 원칙으로 재작성된 전례가 있는데 `WorkflowWiringTest`류는 그 교훈이 아직 반영 안 됨 | `.claude/tests/test_review_gate_ci.py:245-260`(`test_it_runs_the_script`/`test_it_exempts_dependabot`/`test_it_triggers_on_the_gate_it_depends_on`) | 파일 전체 substring 대신 `on.pull_request.paths`/`jobs.gate.if` 블록만 `yaml.safe_load`로 구조적 파싱해 대조(이 PR이 이미 PyYAML을 CI 의존성으로 들여왔으므로 전례와 일관). 최소 조치로는 "정확히 두 번 등장" 단언 등으로 위치 구분 |
| 3 | 아키텍처 / 요구사항 / 테스트 | "판정자 단일성"(`OneJudgeTest`)의 금지 호출/임포트 목록이 열거형이라 두 가지 우회로가 실측 확인됨: (a) `pathlib.Path(root).rglob(...)`/`os.scandir` 기반 재구현 — attribute 호출의 베이스가 `ast.Name`이 아닌 호출식일 때 빈 문자열로 처리되어 접두어 없이 통과, `pathlib` import 자체도 금지 목록에 없음. (b) import alias(`from os import walk as _w`, `import os as _x` 등) — AST가 로컬 호출 이름만 기록해 정본 모듈명과 매칭 실패. `re`/`glob`/`subprocess` 자체 금지는 별칭에도 견고함(대조 확인). 현재 `check-review-gate.py`는 실제로 이런 우회를 쓰지 않아 즉시 결함은 아님 | `.claude/tests/test_review_gate_ci.py:179-225`(`OneJudgeTest` 정의), `:196-210`(호출명 수집·금지 호출 목록), `:222-223`(금지 import 목록) | denylist를 allowlist로 전환(현재 실사용 4개 `argparse`/`os`/`sys`/`review_guard`만 허용) 검토. 최소 조치는 `pathlib`/`os.scandir`/`os.listdir`를 금지 목록에 추가하고, `ast.alias.asname → 정본 dotted-name` 역매핑으로 별칭을 정규화(자매 가드 `test_harness_checks_paths_coverage.py::ExtractorBoundaryTest`에 이미 선례 있음) |
| 4 | 동시성 | CI 백스톱의 `evaluate(root)` 호출이 `in_flight_ok` opt-in 회귀를 막는 테스트가 없다. `evaluate_review()`의 `in_flight_ok=True`는 "세션 시작됨, SUMMARY 대기 중"일 때 차단하지 않는 스위치이며, 이 저장소는 이를 무조건 적용해 push 게이트가 30분 새는 사고를 이미 겪고 opt-in으로 고친 이력이 있다. **실측 재현**: 격리 스크래치 repo에서 `meta.json`만 있고 `SUMMARY.md`는 없는 세션 디렉토리를 커밋한 채, 스크립트 사본 90행만 `evaluate(root, in_flight_ok=True)`로 바꿔 재실행 → "통과 — in flight — allowed"(exit 0)로 전환. 현재 13개 테스트 중 이 상태(`meta.json`만 존재)를 구성하는 것이 하나도 없어 회귀를 못 잡는다 | `scripts/check-review-gate.py:90`(`decision = evaluate(root)`); 부재 테스트: `test_review_gate_ci.py`의 `ReviewGateCliTest`(39~173행) | `meta.json`만 있고 `SUMMARY.md`는 없는 신선한 세션 디렉토리를 커밋 → `--enforce`에서도 여전히 미커버/exit 1을 고정하는 테스트 추가(`test_a_resolved_review_lets_the_branch_through`와 대칭). 또는 `evaluate` 호출부에 `in_flight_ok=True`가 실려 있지 않음을 AST로 고정 |
| 5 | 문서화 / 유지보수성 | 함께 갱신되는 `plan/in-progress/harness-review-gate-ci-backstop.md`의 frontmatter `worktree:`가 이미 존재하지 않는 워크트리(`harness-block-backstop-b56163`)를 가리켜, `plan_guard`가 이 plan을 "연결된 plan 없음"으로 오판(실측: `plan_guard._linked_plans(cwd, cwd)` → `[]`, `plan-stale-audit.sh`도 `WORKTREE? MISSING`으로 확인). 실제 워크트리는 `harness-review-ci-backstop-91f379`. Ad-hoc 작업 escape 설계상 push는 막히지 않지만, PLAN 게이트가 이 티켓을 아예 보지 못하는 상태. 이번 PR이 만든 결함은 아니나(diff가 frontmatter를 건드리지 않음), 바로 이 파일 본문을 갱신하는 이번 라운드가 고치기 가장 쌌던 시점 | `plan/in-progress/harness-review-gate-ci-backstop.md:3` | `worktree: harness-review-ci-backstop-91f379`로 즉시 갱신(트리비얼) |
| 6 | 유지보수성 | `_load_gate()`가 `.claude/hooks`(부모 디렉터리)까지 `sys.path`에 얹지만 실측상 불필요하고, 근거 주석("두 경로 다 필요하다 — `review_guard`가 형제 모듈을 이름으로 import하므로")이 사실과 다르다. 격리 서브프로세스에서 `_lib` 하나만 `sys.path`에 넣고 `import review_guard` → `evaluate_review()` 끝까지 정상 실행 확인. 원본 `guard_review_before_push.py:54`도 `_lib` 하나만 얹음 — 이 스크립트만 다른 패턴이며 그 근거 주석이 반증됨 | `scripts/check-review-gate.py:55-57`(주석), `:61-67`(`_load_gate`) | `hooks` 삽입과 해당 주석 제거(원본 훅과 동일하게 `_lib`만 유지), 또는 실제 필요 근거로 주석 교체 |
| 7 | 유지보수성 | `.claude/tests/README.md` 신규 행(`test_review_gate_ci.py`)만 전체 한국어 산문으로 작성 — 같은 파일 나머지 27개 행은 예외 없이 영어(정책 고유명사·인용구만 한국어 인라인). 스캔 가능성 저하 + 향후 다른 행도 한국어로 써도 된다는 선례가 될 수 있음 | `.claude/tests/README.md:44` | 다른 행처럼 영어 산문으로 통일(정책 고유명사만 한국어 인용 유지), 또는 의도적 결정이라면 컨벤션 문서에 명시 |
| 8 | 유지보수성 | 테스트 헬퍼 중복 — `os.path.join(self.root, ".claude", "hooks", "_lib", "review_guard.py")` 경로 리터럴이 3곳에 반복되고, `test_notes_are_printed_on_both_verdicts`는 `env` 오버라이드가 필요해 `_run` 헬퍼를 못 쓰고 동일 로직(커맨드/`capture_output`/`timeout=120`)을 손으로 다시 타이핑한 두 번째 `subprocess.run`을 가짐 — "한 인스턴스는 고치고 나머지는 남기는" 실패 클래스가 재현되기 좋은 모양 | `.claude/tests/test_review_gate_ci.py:74-76`(`_run` 정의), `:120,127-128,162-163`(경로 리터럴 반복), `:167-170`(손으로 짠 두 번째 `subprocess.run`) | `setUp`에서 경로를 한 번만 계산해 재사용하거나, `_run(self, *extra, env=None)`으로 확장해 `test_notes_are_printed_on_both_verdicts`도 `_run`을 재사용하게 함 |
| 9 | 테스트 | 실제 CI가 매번 쓰는 `--root` **기본값**(`_ROOT_DEFAULT`, 경로 깊이 2단계 가정) 산정 경로는 13개 테스트 중 어느 것도 실행하지 않는다(전부 `--root <tempdir>`를 명시로 넘김). **실측**: `--root` 없이 정상 실행 → 정상 동작 확인. 이어서 `--root /tmp/nonexistent-repo-root-xyz --enforce`로 고장난 루트를 흉내내자 `ModuleNotFoundError`를 stderr에 찍고 **exit 0**(fail-open) — 관측 모드와 구분 불가능하게 조용히 통과. 향후 스크립트가 다른 디렉터리 깊이로 이동해 "2단계 상위" 가정이 깨지면 CI는 계속 초록인 채 백스톱이 영구 무력화되고 아무도 알아챌 신호가 없다("silent-permanent-disable" 클래스, 이 프로젝트가 이미 다른 곳에서 가드하는 것과 동일 성격) | `scripts/check-review-gate.py:58`(`_ROOT_DEFAULT`), `:61-74`(`_load_gate`), `:81`(`--root` argparse 기본값) | `--root` 없이 실제 저장소 대상으로 실행해 "게이트를 불러오지 못했습니다" 문구가 stderr에 없음을 단언하는 테스트 추가, 또는 `_harness.REPO_ROOT`와 `_ROOT_DEFAULT` 일치를 대조 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | 신규 CI 호출부(`evaluate(root)`)의 `evaluate_review(cwd=None, *, in_flight_ok=False)` 시그니처가 기존 두 호출부(push/stop 훅)와 정확히 일치 — 계약 불일치 없음 | `scripts/check-review-gate.py:90` 대 `review_guard.py:942` | 없음(확인 완료) |
| 2 | 보안 | `github.base_ref`가 `run:` 셸 명령에 직접 보간(GH Actions expression-injection 안티패턴). 노출은 낮음 — `pull_request_target`이 아닌 `pull_request`, 시크릿 미사용, `base_ref`는 조작 어려운 저장소 내 기존 브랜치명. `migration-check.yml`에도 동일 패턴 기존 | `.github/workflows/review-gate.yml:58` | `env: BASE_REF: ${{ github.base_ref }}` 후 `"$BASE_REF"` 간접 참조로 방어 심화(낮은 우선순위, `migration-check.yml`과 함께 처리 권장) |
| 3 | 보안 / 부작용 | 신규 워크플로에 명시적 `permissions:` 블록 없음 — 다만 기존 워크플로 10개 중 9개도 동일 관행(`migration-recheck-on-main.yml` 제외)이라 이 PR만의 이탈 아님. `gh`/쓰기 작업 없어 실질 위험 낮음 | `.github/workflows/review-gate.yml` 전체 | 신규 파일이니 `permissions: { contents: read }` 명시 권장(강제 아님) |
| 4 | 보안 | CI 백스톱이 신뢰하는 "리뷰됨" 판정은 손으로 작성 가능한 텍스트 마커(`SUMMARY.md`/`RESOLUTION.md` shape)에 전적으로 의존 — `review_guard.evaluate_review()`의 기존 설계(이번 PR 범위 밖, "판정자 단일성" 원칙상 의도적으로 손대지 않음). 쓰기 권한자는 실제 `/ai-review` 없이도 세션 디렉토리 shape만 맞추면 게이트 통과 가능 | `test_review_gate_ci.py:102-113`(`test_a_resolved_review_lets_the_branch_through`가 이 신뢰모델을 예시) | 별도 조치 불요(설계 확정, 범위 밖). `--enforce` 전환 검토 시점에 이 신뢰 경계를 명시적으로 재확인 |
| 5 | 보안 | 게이트 로딩/평가 실패 시 예외 메시지(`type(exc).__name__: exc`)가 그대로 stderr에 노출 — 시크릿 개입 여지 없는 import/호출 실패라 실질 위험 낮음, fail-open 설계상 의도된 트레이드오프 | `scripts/check-review-gate.py:71-73`(`_load_gate`), `:91-93`(`main`) | 현행 유지 가능(우선순위 낮음) |
| 6 | 부작용 | `_load_gate()`의 `sys.path`/`sys.modules` 캐싱 — 현재는 항상 새 서브프로세스로만 호출돼 무해(실측 확인)하나, 향후 한 프로세스 안에서 다른 `root`로 두 번 호출되면 두 번째 호출이 첫 호출의 캐시된 모듈을 반환하는 잠재 위험(`_lib` 네임스페이스 충돌과 같은 부류) | `scripts/check-review-gate.py:61-74` | docstring에 "always invoked as a fresh process" 명시, 또는 향후 in-process 재사용 시 `sys.modules.pop("review_guard", None)` 캐시 무효화 방어 추가 |
| 7 | 부작용 | 봇 예외가 `dependabot[bot]` 리터럴 1건만 커버 — 실측(최근 200커밋 author 집계: 사람 185/dependabot 15, 그 외 봇 0)상 현재 무해. `--enforce` 전환 후 신규 자동화 계정 등장 시 plan 문서가 이미 기술한 것과 동일한 실패 클래스(면제 없는 워크플로 = 그 계정 전용 알람) 재발 가능 | `.github/workflows/review-gate.yml:44` | 현재 조치 불요. `--enforce` 전환 결정 시점에 봇 계정 가정을 재측정 항목으로 plan에 기록 |
| 8 | 부작용 | 신규 외부 네트워크 호출(`actions/checkout` `fetch-depth: 0` + `git fetch --no-tags origin`) 추가 — merge-base 계산에 실제 필요, `pull_request` 트리거라 포크 PR 시크릿 노출 없음 | `.github/workflows/review-gate.yml:48-50,57-58` | 조치 불요(문서화만으로 충분) |
| 9 | 문서화 / 요구사항 | 스크립트·plan 문서가 인용하는 "리뷰 산출물 파일 수"(`review/code` 8,851개, `review/` 전체 14,517개)가 현재 HEAD 대비 소폭 낡음(실측 재현: fork point에서 9,113/14,779, PR #1057 병합 직전에서 8,964/14,630 — 두 시점 모두 코드/전체 델타 동일해 자연 증가로 해석 일관적). "리뷰 산출물은 gitignore 안 된다"는 정성적 결론은 개수와 무관하게 유효(`.gitignore`엔 `review/**/_prompts/` 한 줄뿐) | `scripts/check-review-gate.py:21-23`, `plan/in-progress/harness-review-gate-ci-backstop.md:180` | 스크립트 docstring에 측정 커밋 해시/날짜("2026-08-01 기준" 등) 병기(선택), 이후 유사 인용 시 측정 커밋 해시 동반 권장 |
| 10 | 문서화 | `PROJECT.md` "보조 스크립트(검증·운영)" 섹션에 `check-review-gate.py` 미등재 — 같은 성격의 CI 전용 스크립트 `check-e2e-playwright-config.py`도 미등재라 "CI가 자동으로만 부르는 검증 스크립트는 카탈로그에 넣지 않는다"는 기존 관행과 일치, 결함 아님 | `PROJECT.md:323` 이하(참고용, 이번 diff 대상 파일 아님) | 없음(현행 유지가 기존 관행과 일치) |
| 11 | 유지보수성 | `main()`의 통과/미커버(관측)/미커버(강제) 세 출력 갈래 + advisory 출력을 `_print_observed`/`_print_enforced` 등 이름 있는 헬퍼로 분리할 여지 | `scripts/check-review-gate.py:77-116`(`main`) | 선택적 리팩터링(강제 아님) |
| 12 | 유지보수성 | 테스트 스텁 문자열(`_D.notes`)이 `\uXXXX` escape로 작성돼 가독성 저하 — 파일의 다른 곳(주석/docstring)은 리터럴 한글 사용, 디코딩해 값은 정확함(버그 아님) | `.claude/tests/test_review_gate_ci.py:158` | 리터럴 문자열(`'⚠️  세션X: 하향 감지'`)로 교체 |
| 13 | 의존성 | 새 외부 패키지 의존성 없음(표준 라이브러리 + 내부 모듈 `review_guard`/`_harness`만 사용). PyYAML은 이번 diff 범위 밖(선행 커밋)이며 실사용처 전부 `safe_load`/`SafeLoader` 서브클래스만 사용 확인, 저장소 라이선스(AGPL-3.0)와 MIT(PyYAML/`actions/checkout`) 호환 | `scripts/check-review-gate.py:51-53`, `.github/workflows/harness-checks.yml:80-85`(배경) | 없음(확인 완료) |
| 14 | 의존성 | GitHub Actions 버전(`actions/checkout@v7`, `actions/setup-python@v7`, `python-version: '3.x'`)·`concurrency` 네이밍·`fetch-depth: 0`이 저장소 기존 12개 워크플로 전역 관례와 완전히 일치 — 신규 드리프트 없음 | `.github/workflows/review-gate.yml:33-35,48-54` | 없음(확인 완료) |
| 15 | 의존성 | CI 실행 비용 추정은 코드 판독(설치 스텝 없음, checkout+setup-python+git fetch 1회+스크립트 1회) 기반이며 실제 GitHub Actions 로그 실측은 아님 — `codebase/**`가 트리거 범위라 대부분의 제품 PR마다 도는 추가 job | `.github/workflows/review-gate.yml:22-25,37-61` | 병합 후 실제 실행 시간을 몇 차례 관찰해 `timeout-minutes: 5` 상한 여유 확인 권장 |
| 16 | 동시성 | 신규 `concurrency:`(`group: review-gate-${{ github.ref }}` / `cancel-in-progress: true`) 중복실행 방지 설정을 지키는 회귀 테스트 없음 — 삭제돼도 판정 정확성엔 영향 없고 러너 큐/시간 낭비만 발생 | `.github/workflows/review-gate.yml:33-35` | `WorkflowWiringTest`에 `assertIn("cancel-in-progress: true", self.code)` 1줄 추가(낮은 우선순위) |
| 17 | 범위 | `OneJudgeTest`의 별칭(alias) import 우회 사각지대(WARNING #3의 일부)는 이번 diff 자체의 범위 이탈은 아님 — 현재 `check-review-gate.py`엔 별칭이 전혀 없음(확인). 향후 스코프 확장을 막는 유일한 기계적 방어선의 좁은 맹점이라는 성격 | `.claude/tests/test_review_gate_ci.py:197-201` | 급하지 않음(WARNING #3 조치 시 함께 반영 권장) |
| 18 | 요구사항 | 이 변경 영역(harness/CI 메타 도구)을 규율하는 `spec/` 문서 없음 — 정상. `spec/`는 제품 정의 전용(CLAUDE.md 규약)이고, 이 변경의 SoT는 `plan/in-progress/harness-review-gate-ci-backstop.md`이며 실제 구현과 line-level로 대조해 부합 확인 | 해당 없음(`spec/` 전역, `grep -rl "review-gate\|review_guard" spec/` 0건) | 없음(확인 완료) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| api_contract | NONE | API 계약 요소 없음(harness/CI 전용 diff); `evaluate_review` 시그니처 신규 호출부 일치 확인 |
| architecture | LOW | 자기-트리거 커버리지 테스트가 substring 검사(#2); `OneJudgeTest` denylist가 pathlib/os.scandir 우회 못 잡음(#3); "단일 판정자, 다중 트리거" 설계는 실제로 준수됨을 확인(긍정) |
| concurrency | LOW | `in_flight_ok` opt-in 회귀 방지 테스트 없음(#4, 실측 재현으로 백스톱 무력화 가능성 확인); `concurrency:` 그룹 회귀 테스트 없음(INFO) |
| database | NONE | DB 접점 전혀 없음(harness/CI 전용, 8개 체크리스트 항목 모두 비적용) |
| dependency | LOW | `branch_guard.py` paths 누락(#1); `OneJudgeTest` 열거형 한계 보강 확인; 신규 의존성/버전 드리프트 없음(긍정), `hooks` sys.path 삽입 불필요 지적(→ #6과 병합) |
| documentation | LOW | plan `worktree:` frontmatter stale → `plan_guard` 연결 plan 0개로 오판(#5); 산출물 파일 수 실측치 소폭 낡음(INFO #9); 그 외 상호참조(커밋 해시·수치) 전수 검증 통과 |
| maintainability | LOW | `worktree:` frontmatter(#5); `sys.path` 근거 주석 오류(#6); README 신규 행만 한국어(#7); 테스트 헬퍼 3중 중복(#8); 뮤테이션 3종으로 "실패할 수 없는 테스트" 없음 확인 |
| performance | NONE | 성능 안티패턴 없음, O(1) 진입점(반복 DB/API 호출 자리 자체가 없음); 실측 13 tests/1.978s, `fetch-depth: 0`는 기존 저비용 패턴 재사용 |
| requirement | LOW | `OneJudgeTest` pathlib 우회 상세 실측(attribute-base 처리 버그, #3); 파일 수 실측치 드리프트(INFO #9); 뮤테이션 14종으로 "실패할 수 없는 테스트" 없음 확인, spec 미대상 정상 |
| scope | LOW | 이번 diff는 CONTEXT 의도와 정확히 일치, 범위 이탈 없음; `OneJudgeTest` alias 우회 발견(#3의 일부, 이 리뷰어는 INFO로 평가) |
| security | LOW | `branch_guard.py` paths 누락(#1); `base_ref` 셸 보간(INFO #2); `permissions:` 없음(INFO #3); 텍스트 마커 신뢰모델(INFO #4); 시크릿/인젝션/안전하지 않은 역직렬화 없음 확인 |
| side_effect | LOW | `permissions:` 없음(INFO #3); `sys.modules` 캐싱 잠재위험(INFO #6); dependabot 리터럴 단일 커버(INFO #7); 시그니처/인터페이스 무변경, hermetic 테스트 격리 확인 |
| testing | LOW | `--root` 기본값 미검증 → silent-permanent-disable(#9, 실측 핵심 발견); `WorkflowWiringTest` substring 검사(#2); `OneJudgeTest` alias 우회(#3); 핵심 불변식 3종은 뮤테이션으로 RED 전이 확인(vacuous 아님) |
| user_guide_sync | NONE | 유저가이드/i18n `doc-sync-matrix.json` 21개 trigger 전수 대조 — 매칭 0건(harness/CI 전용, `codebase/`·`spec/` 미접촉) |

## 발견 없는 에이전트

- **api_contract** — 대상 6개 파일 모두 HTTP API 엔드포인트·스키마·라우팅·인증 요소를 포함하지 않음("해당 없음").
- **database** — SQL/ORM/스키마/마이그레이션/커넥션/트랜잭션 요소가 전혀 없음("해당 없음").
- **performance** — 반복문 내 DB/API 호출, 문자열 누적, quadratic regex 등 통상적 성능 안티패턴이 들어설 구조적 자리가 없음. 확인성 INFO 4건 전부 "문제 아님, 조치 불요".
- **user_guide_sync** — `doc-sync-matrix.json` 21개 trigger(glob+semantic) 전수 대조 결과 매칭 0건(harness/CI 인프라 변경으로 `codebase/**`/`spec/**` 미접촉).

## 권장 조치사항

1. **(WARNING #9)** `--root` 기본값(`_ROOT_DEFAULT`) 산정 경로를 검증하는 테스트 추가 — 실제 CI가 매번 이 경로에 의존하는데 깨지면 조용히 영구 비활성화(silent-permanent-disable)된다. 우선순위 최상위.
2. **(WARNING #4)** `in_flight_ok` opt-in 회귀를 막는 테스트를 `ReviewGateCliTest`에 추가 — 이 저장소가 이미 한 번 겪은 버그 클래스가 새 호출부에서 무방비로 재발할 수 있음을 실측으로 확인했다.
3. **(WARNING #1)** `review-gate.yml`의 `paths:`에 `branch_guard.py`(또는 `.claude/hooks/_lib/**`) 추가 — 형제 모듈 변경이 CI를 트리거하지 않는 갭을 닫는다.
4. **(WARNING #3)** `OneJudgeTest`의 금지 목록을 강화(pathlib/os.scandir/alias 커버) 또는 allowlist로 전환 — "판정자 단일성"을 지키는 유일한 기계적 방어선의 사각지대.
5. **(WARNING #2)** `WorkflowWiringTest`류를 `yaml.safe_load` 기반 구조적 파싱으로 전환 — 이미 저장소에 PyYAML 전례가 있어 일관된 개선.
6. **(WARNING #5)** `plan/in-progress/harness-review-gate-ci-backstop.md`의 `worktree:`를 `harness-review-ci-backstop-91f379`로 즉시 갱신 — 트리비얼하며 이번 라운드가 고치기 가장 싼 시점.
7. **(WARNING #6)** `_load_gate()`의 불필요한 `hooks` sys.path 삽입과 사실과 다른 근거 주석 정리.
8. **(WARNING #7)** README 신규 행을 영어로 통일(기존 27개 행과 일관).
9. **(WARNING #8)** 테스트 헬퍼의 경로 리터럴 3중 반복과 손으로 짠 `subprocess.run` 사본을 `_run` 재사용으로 통합.
10. **(INFO 방어 심화)** `permissions: { contents: read }` 명시, `github.base_ref`를 `env:` 간접 참조로 전환 — 낮은 우선순위, 기존 워크플로 전반 정리와 함께 처리 권장.

## 라우터 결정

- `routing_status=skipped` — 사유: `--route=all`. 전체 reviewer 실행됨(14명: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync).
- 참고: `_retry_state.json`에 `agents_forced`(7개: documentation, maintainability, requirement, scope, security, side_effect, testing — 소스/문서 변경 시 상시 강제 대상) 및 근거가 기록돼 있으나, `--route=all`로 router 자체가 호출되지 않아 이 목록은 참고 정보이며 실제 라우팅 결정에는 영향 없음(어차피 14명 전원 실행).
- **메타데이터 참고**: `_retry_state.json`은 14개 reviewer 전원을 `agents_pending`으로, `agents_success`/`agents_fatal`은 빈 배열로 기록하고 있으나, 세션 디렉토리에 14개 결과 파일(`*.md`)이 모두 존재하고 각각 상세한 검증 방법·발견사항·위험도(NONE/LOW)를 담은 완결된 리포트임을 직접 Read로 확인했다. 이는 재시도가 필요한 상태가 아니라 retry-state 북키핑이 실제 완료 이후 갱신되지 않은 것으로 판단되며, 본 요약은 디스크상의 실제 리포트 내용을 근거로 작성했다(재시도 필요 0건).