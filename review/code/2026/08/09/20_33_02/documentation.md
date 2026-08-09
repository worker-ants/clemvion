# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** `_changed-paths.yml` 을 공유하는 워크플로 수가 "세 개"에서 "여덟 개"로 늘었는데, 그 사실을 정확히 반영한 곳과 옛 표현을 그대로 남긴 곳이 **같은 커밋 안에서 갈린다**.
  - 위치: `.claude/tests/README.md:50` (`test_changed_paths_reusable.py` 행) — `Read` 로 직접 확인.
  - 상세: 이 PR 은 `harness-checks.yml`·`migration-check.yml`·`packages-checks.yml`·`spec-link-checks.yml`·`web-chat-checks.yml` 5개를 추가로 `_changed-paths.yml` 소비자로 전환해, 그 reusable workflow 를 부르는 워크플로가 3개→8개가 됐다. 바로 다음 행(`.claude/tests/README.md:51`, `test_required_check_skip_jobs.py`)은 이번 diff 에서 "As of 2026-08-09 the registry covers **eight** workflows" 로 정확히 갱신됐다. 그런데 그 위 행(`test_changed_paths_reusable.py`, line 50)은 이 diff 에서 새 테스트(`#`-주석 드롭 등) 설명을 추가하며 **같이 편집됐음에도** "the `changes` job **the three converted workflows share**" 와 "every check in **all three workflows** silently no-ops" 라는 옛 개수를 그대로 남겼다. 두 인접 행이 같은 사실(공유 워크플로 개수)에 대해 서로 다른 숫자를 말하는 상태다.
  - 같은 클래스의 잔여 stale 표현(이번 diff 가 직접 건드리진 않았지만 이번 diff 로 인해 사실과 어긋나게 된 기존 주석): `.github/workflows/_changed-paths.yml:1`("세 워크플로가 공유하는 reusable workflow"), `:23`("세 워크플로의 모든 검사가"); `.claude/tests/test_changed_paths_reusable.py:11`(모듈 docstring, "세 워크플로의 모든 검사가"); `.claude/tests/test_required_check_skip_jobs.py:64`("세 워크플로가 공유하는 `changes` 잡"), `:187`("세 워크플로가 한꺼번에 게이팅을 잃어도").
  - 제안: 위 6곳의 "세 워크플로/three (converted) workflows" 를 "여덟"/"eight" (또는 "the converted workflows", 개수에 안 묶이는 표현)로 갱신. 최소한 README 의 두 인접 행 사이의 모순은 이번 PR 범위 안에서 고치는 것이 맞다 — 이 PR 자체가 "손 목록 3→2" 같은 개수 변화를 다른 곳에서는 꼼꼼히 갱신했기 때문에(예: `internal-package-registration-guard.ts`, `internal-package-registration.test.ts`), 이 한 곳만 빠진 것이 더 눈에 띈다.

- **[WARNING]** `plan/in-progress/ci-required-check-skip-jobs.md` 의 frontmatter `worktree:` 필드가 이미 삭제된 예전 worktree 를 가리켜, plan↔worktree 연결 판정이 깨질 수 있다.
  - 위치: `plan/in-progress/ci-required-check-skip-jobs.md:3` (`worktree: ci-required-check-skip-jobs-42f5d8`)
  - 상세: `.claude/docs/plan-lifecycle.md:54` 는 "in-progress plan frontmatter 의 `worktree:` 가 **현재 worktree 디렉토리**(또는 `claude/` 뗀 branch)와 매칭되는 plan 이 대상" 이라고 명시한다. 그런데 이번 diff(그리고 직전 커밋 `0f5ed9acf`/`af391ad82`)는 `ci-skip-jobs-remaining-8aa9f8` worktree 에서 작업됐고, `.claude/worktrees/ci-required-check-skip-jobs-42f5d8` 는 더 이상 존재하지 않는다(`git worktree list` 로 확인). 이 plan 이 여전히 in-progress 상태로 남아 있는 한, plan-coherence/staleness 가드가 이 plan 을 현재 worktree 와 "연결되지 않은" plan 으로 오판할 위험이 있다.
  - 제안: `worktree:` 를 `ci-skip-jobs-remaining-8aa9f8` (또는 이 작업의 실제 worktree 슬러그)로 갱신하거나, plan 을 완료 처리할 계획이면 그 시점에 한 번에 정리.

- **[INFO]** `test_harness_checks_paths_coverage.py::test_every_guarded_file_is_covered` 의 실패 메시지가 "this is the sixth time this class has leaked" 라는 고정 문구를 유지한다 — 이번 diff 가 이 문장을 `paths:`→`pathspecs:` 표현으로 바꾸면서도 숫자는 그대로 옮겼다.
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py:472-474` (`test_every_guarded_file_is_covered`)
  - 상세: 모듈 docstring(`:31-40`)은 이미 "여섯 번" 유출이 전부 과거에 발생했고 그중 마지막(`.claude/config/**`)은 이 파일이 첫 실행에서 잡았다고 적어 뒀다. 그런데 이 assert 메시지는 "(this is the sixth ...)" 라고 고정돼 있어, 만약 앞으로 **일곱 번째** 유출이 이 테스트에서 잡히면(정확히 이 파일이 존재하는 이유) 메시지가 스스로 오탈자처럼 읽힌다. 이번 diff 가 이 줄을 편집한 김에(워딩만 `paths:`→`pathspecs:` 로 교체) 숫자를 카운터 없는 표현("this class has leaked before — see the module docstring")으로 바꿨으면 이 재발이 자연스럽게 예방됐을 것. 사소하고 이번 diff 가 새로 만든 문제는 아니지만, 같은 문장을 만졌다는 점에서 지적한다.
  - 제안: 우선순위 낮음 — 다음에 이 줄을 만질 때 숫자를 없애거나 "N번째"로 동적화.

검증한 항목 중 문제 없음(참고):
- `.claude/tests/README.md:51`(`test_required_check_skip_jobs.py`)의 "eight" 주장은 실제로 `CONVERTED` 8개(`backend-checks`·`deps-security-checks`·`frontend-checks`·`harness-checks`·`migration-check`·`packages-checks`·`spec-link-checks`·`web-chat-checks`) + `review-gate.yml`/`e2e.yml` 제외로 정확히 일치(`grep -l pull_request .github/workflows/*.yml` 로 재확인, `_changed-paths.yml` 자신은 workflow_call 이라 제외).
- `packages-checks.yml`/`spec-link-checks.yml`/`web-chat-checks.yml` 는 종전에도 `push` 트리거가 있었고 이번 전환에서도 유지됐다 — "`push` 트리거는 추가하지 않는다, 종전에도 없었다" 주석은 `harness-checks.yml`/`migration-check.yml` 두 곳(종전에 `push` 없던 두 워크플로)에만 붙어 있고 실제로도 그 두 곳만 해당 — 일관됨.
- `plan/in-progress/ci-required-check-skip-jobs.md` 의 "8워크플로 / 실잡 14개" 수치를 8개 워크플로 YAML 을 직접 파싱해 재현 — `changes` 제외 job 정의 수 합계가 정확히 14(matrix 는 job 정의 1개로 카운트, 서술과 일치).
- `internal-package-registration-guard.ts`/`internal-package-registration.test.ts` 의 `blockScalarAtPath` JSDoc·손 목록 "4→3"/"3→2" 서술은 각 파일이 다루는 스코프(전체 4곳 vs `packages-checks.yml` 자체 3곳)가 달라 서로 모순이 아님 — 정확.
- `.github/workflows/harness-checks.yml` 의 `pathspecs:` 블록 내 항목별 "왜 등재했는가" 주석은 `_changed-paths.yml` 의 `#`-드롭 로직·`test_harness_checks_paths_coverage.py`/`test_required_check_skip_jobs.py`/`blockScalarAtPath` 3중 파서와 일관되게 3단 정규화(strip·blank 드롭·`#`-시작 드롭)를 공유 — README 의 "same three cuts as the runtime" 주장과 일치.

## 요약

전체적으로 이 PR 은 문서화 수준이 매우 높다 — YAML 워크플로 주석, README 표, plan 문서, 테스트 docstring 이 설계 이유·과거 6번의 커버리지 갭·fail-safe 방향까지 촘촘히 교차 설명하고, 개수 변화("3개→2개" 손 목록 등)도 대부분 정확히 갱신됐다. 다만 이번 diff 로 `_changed-paths.yml` 공유 워크플로 수가 3→8로 실질적으로 바뀌었는데, `.claude/tests/README.md` 의 두 인접 행이 이 숫자에 대해 서로 다른 값("three" vs "eight")을 말하는 내부 모순이 남았고, 같은 클래스의 "세 워크플로" 표현이 `_changed-paths.yml`·`test_changed_paths_reusable.py`·`test_required_check_skip_jobs.py` 등 5곳에 더 남아 있다. 또한 plan frontmatter 의 `worktree:` 가 삭제된 옛 worktree 를 가리켜 이 저장소 자체의 plan-coherence 가드 판정 로직과 어긋난다. 둘 다 기능적 결함은 아니지만, 이 PR 이 스스로 세운 "손 목록이 어긋나면 안 된다"는 원칙을 문서 자신에게는 완전히 적용하지 못한 사례다.

## 위험도

LOW
