# 의존성(Dependency) Review

## 스코프 확인

`git diff origin/main...HEAD --stat` 로 프롬프트가 열거한 17개 파일과 실제 diff 를 대조했다
(파일 2/5/6/8 은 프롬프트 크기 제한으로 본문이 실리지 않아 `Read`/`git diff` 로 직접 확인).
전부 `.claude/**`(하네스 자체 훅/스킬/스크립트/테스트)와 `plan/in-progress/**`(문서)이며,
`codebase/**`, `package.json`, `pnpm-lock.yaml`, `requirements.txt`, `pyproject.toml` 등
의존성 매니페스트는 diff 에 전혀 없다 (`git diff origin/main...HEAD --name-only` 로 확인).

## 발견사항

- **[CRITICAL]** 참조·문서화 전무한 실행 가능 orphaned 파일이 `code_review_orchestrator.py` 의
  전체 내부 의존 체인을 그대로 복제해 신규 커밋됨
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (신규 파일 전체, git diff status `A`, 1,304줄. import 블록 1-47줄, entrypoint `if __name__ == "__main__":` 1303줄)
  - 상세: 이 파일은 `code_review_orchestrator.py` 와 **동일한 docstring**("Code Review Agents
    Orchestrator — prepare-only mode. ...")으로 시작하고, `lib.line_anchors` / `lib.router_safety`
    / `lib.session` / `lib.role_instructions.REVIEWER_INSTRUCTIONS` /
    `lib.router_safety.compute_forced_agents` / `_lib.project_config` /
    `_shared.report_paths` 등 `code_review_orchestrator.py` 가 의존하는 내부 모듈 전체를
    그대로 다시 import 한다(1-47줄). `diff _probe_main.py code_review_orchestrator.py` 로
    단방향 비교하면, `_probe_main.py` 에만 있는 코드는 전부 이번 PR 이
    `code_review_orchestrator.py` 에 추가한 수정(`_omitted_content_note`/`_aggregate_omission_note`
    omission-notice 신설, 예산 계상 리팩터)이 **빠진 옛 스냅샷**뿐이다 — 즉 새 기능이 아니라
    `code_review_orchestrator.py` 의 내부 의존 그래프를 그대로 포크한 **그림자 모듈**이다.
    저장소 전체 grep 결과(`grep -rln "_probe_main"`) 이번 리뷰 세션 메타파일 외 참조가 0건 —
    `SKILL.md`/`README.md`/테스트 어디에서도 import·실행·문서화되지 않는다. 그럼에도
    `argparse` CLI 진입점과 `if __name__ == "__main__": main()` 을 갖춘 완전한 독립 실행
    스크립트로 `py_compile` 통과를 확인했다. 즉 **의존성 그래프에는 존재하지만 어떤 소비자도
    선언하지 않은 미아 모듈**이며, 실행되면 이 PR 이 방금 고친 결함(프롬프트 예산 초과 시 파일이
    아무 안내 없이 통째로 누락되는 문제)을 그대로 재현한다. 이 저장소는 같은 diff 안에서
    `_shared/report_paths.py` 로 push/stop 게이트와 `--verify-coverage` 의 판정 로직을
    공유시키는 등 "중복은 코드 한 곳만 고치면 되게" 라는 명시적 관례를 갖고 있는데(파일 6의
    `_shared` import 주석 참고), 정확히 그 반대 방향 — 전체 파일 단위 포크 — 가 검증 없이
    병합 대기 중이다. `scope-reviewer` 가 같은 파일을 범위(scope) 관점에서 독립적으로
    CRITICAL 판정했으며, 본 발견은 그와 별개로 **내부 의존성/불필요한 의존성 관점**에서 수렴한다.
  - 제안: `_probe_main.py` 삭제. 수정 전/후 비교용 스크래치가 필요했다면 워크트리 밖(로컬 scratch
    디렉터리)에 두고 커밋 범위에서 제외할 것 — 리포지토리 안에 남기면 유지보수자가 "진짜"
    오케스트레이터의 대체본으로 오인할 위험이 있다.

- **[INFO]** 신규 외부 의존성 없음 — 하네스 stdlib-only 관례 유지 확인
  - 위치: `.claude/tests/README.md:14-17` (관례 근거: "third-party dependencies — hooks must
    run on a bare `python3`. Do not introduce `pytest`/`requirements.txt`...")
  - 상세: 프롬프트가 전체 내용을 싣지 못한 4개 Python 스크립트(`review_guard.py`,
    `_probe_main.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)를 포함해
    변경된 모든 `.py` 파일의 `+import`/`+from` 라인을 `git diff origin/main...HEAD` 로 전수
    대조했다. 표준 라이브러리(`json`/`os`/`re`/`subprocess`/`sys`/`argparse`/`contextlib`/`io`/
    `shutil`/`tempfile`/`textwrap`/`unittest`/`datetime`/`importlib.util`)와 기존 내부 모듈
    (`_lib.project_config`, `_shared.report_paths`, `lib.line_anchors`, `lib.router_safety`,
    `lib.session`, `lib.role_instructions`, `_harness`) 외 신규 서드파티 패키지는 0건이다.
    `package.json`/`pnpm-lock.yaml`/`requirements.txt`/`pyproject.toml` 등 매니페스트 변경도
    없다(`git diff --name-only` 확인). 라이선스 호환성·버전 고정·알려진 취약점(CVE) 관점에서
    검토할 신규 대상 자체가 없다.
  - 제안: 없음 — 현 상태 유지 권장.

- **[INFO]** `evaluate_review()` 시그니처 확장 — 하위 호환 내부 API 변경
  - 위치: `.claude/hooks/_lib/review_guard.py:862` (`def evaluate_review(cwd=None, *, in_flight_ok=False)`), 호출부 `.claude/hooks/guard_review_before_stop.py:344` (`decision = evaluate_review(in_flight_ok=True)`)
  - 상세: push 가드(`guard_review_before_push.py`)와 stop 가드가 같은
    `review_guard.evaluate_review()` 를 공유하는 내부 의존 관계는 이전부터 있었다. 이번 변경은
    그 공유 함수에 키워드 전용 opt-in 인자(`in_flight_ok`, 기본값 `False`)를 추가해 두 호출자의
    동작을 분리했다 — push 가드 호출부(`guard_review_before_push.py`)는 무변경이라 이전 동작을
    그대로 유지한다(하위 호환). 레포 전체에서 `evaluate_review(` 호출부를 grep 해 push/stop 두
    실제 프로덕션 호출부 외에 파손될 곳이 없음을 확인했다. `EvaluateInFlightShortCircuitTest`
    (양방향)와 `test_stop_passes_in_flight_opt_in`(seam 이 실제로 kwarg 를 넘기는지)로 회귀가
    봉쇄돼 있다. 패키지 인터페이스가 아닌 순수 내부 모듈 간 계약 조정이다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** "origin 기본 브랜치 해석" 로직의 4중 독립 구현 — 이미 추적/defer 된 부채에 이번 PR 이 4번째 구현 추가
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1190` (`def _default_branch_ref():`, 이번 PR 신설), 근거 문서 `plan/in-progress/harness-review-gate-ci-backstop.md:65-71`
  - 상세: 이번 PR 이 추가한 `_default_branch_ref()` 는 `branch_guard._origin_default_branch()`
    (정본) · `review_guard._default_branch()` · `consistency_orchestrator` 의
    `args.diff_base or "origin/main"` 리터럴에 이어 **같은 개념("origin 기본 브랜치 판정")의
    4번째 독립 구현**이다. 다만 이는 이번 리뷰가 처음 발견한 것이 아니라 plan 문서에 이미
    "반환 계약이 달라(로컬 `main` vs `origin/main`) 단순 통합 불가, 실제 통합은 hooks/skills 의
    `_lib` 네임스페이스 충돌 해소가 선행" 이라는 근거와 함께 명시적으로 defer 된 항목이다 —
    의도적 기술부채이지 누락이 아니다. 기본 브랜치 정책이 바뀌면 4곳을 모두 손으로 갱신해야
    하는 drift 위험은 여전히 유효하다.
  - 제안: 이번 PR 범위에서 조치 불요(계획 문서에 defer 근거가 이미 기록됨). 향후 통합 시
    4개 구현을 동시 갱신하는 체크리스트를 어딘가에(`_lib` 통합 티켓 등) 명시해 drift 를
    방지할 것.

- **[INFO]** 신규 git 서브프로세스 호출 — 기존 하드 의존성 재사용, 신규 외부 도구 아님
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수
    `_branch_changed_rels`(`git diff --no-renames --name-only` 실행), `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1190-1211` 함수 `_default_branch_ref`(`git symbolic-ref`, `git rev-parse` 실행)
  - 상세: 두 오케스트레이터는 이미 같은 파일 안에서 `git diff`/`git rev-parse` 를 여러 차례
    셸아웃하고 있었다(`_git` 헬퍼, `get_git_branch_diff_files` 등 기존 코드). 이번 diff 로
    오케스트레이터 호출당 git 서브프로세스 호출이 소폭(1~2회) 늘었을 뿐, git 자체는 이
    하네스 전반의 기존 하드 의존성이라 "새 의존성"이 아니다. `timeout=30.0`/`timeout=5.0` 과
    실패 시 조용히 빈 결과/조기 리턴하는 fail-soft 경로도 기존 패턴과 동일하게 갖춰져 있다.
    단일 로컬 git 프로세스이고 CI 빌드 파이프라인과 무관한 개발자/리뷰 워크플로 전용 스크립트라
    번들 크기·빌드 시간에 미치는 영향은 무시할 수준이다.
  - 제안: 없음.

## 요약

이번 diff(17개 파일, 전부 `.claude/**` 하네스 툴링 + `plan/in-progress/**` 문서)는 패키지
매니페스트·lockfile 을 전혀 건드리지 않고, 변경된 모든 Python 파일의 import 문을 전수
대조한 결과 stdlib + 기존 내부 모듈 외 신규 외부 패키지가 없다 — `.claude/tests/README.md` 가
명시한 "하네스 Python 은 third-party 의존성 0" 관례가 그대로 유지되고, `evaluate_review()`
키워드 인자 확장도 하위 호환이며 seam 테스트로 회귀가 봉쇄돼 있다. 그러나 이번 diff 는
`code_review_orchestrator.py` 의 수정 전 스냅샷을 그대로 복제한 완전 실행 가능한 1,304줄
orphaned 파일(`_probe_main.py`)을 저장소 어디에서도 참조·문서화되지 않은 채 함께 커밋했다 —
같은 내부 의존 체인(`lib.*`/`_lib`/`_shared`)을 포크한 그림자 모듈이며, 실행되면 이 PR 이
방금 고친 버그를 그대로 재현한다. 순수 외부-패키지 의존성 관점은 NONE 이지만, 이 orphaned
내부 모듈 1건이 diff 순증가분의 절반 가까이를 차지한 채 병합 대기 중이라는 사실이 전체 판정을
좌우한다.

## 위험도

HIGH — 라이선스·버전 고정·취약점·신규 외부 패키지 항목은 전부 NONE 수준이나, 미참조 실행 가능
orphaned 내부 모듈(`_probe_main.py`)이 발견됐으므로 병합 전 삭제가 필요하다.
