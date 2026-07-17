# 의존성(Dependency) 리뷰

리뷰 대상 diff: `.claude/hooks/guard_review_before_push.py`, `.claude/tools/reap-merged-worktrees.sh`,
`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_push_detection.py`,
`.claude/tests/test_reap_merged_worktrees.py`, `.claude/docs/worktree-policy.md`,
`plan/in-progress/harness-session-anchor-guards.md` (+ `.claude/tests/README.md` 1줄, payload 미포함이나
`git diff origin/main...HEAD --stat` 로 확인).

전 범위가 `.claude/` 하네스 인프라(세션 앵커 reap 가드 + push 서브커맨드 판정 가드)이며 `codebase/`
애플리케이션 코드·패키지 매니페스트(`package.json`/`requirements.txt`/`pyproject.toml`/lockfile) 변경은
diff 에 전혀 없다.

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 유일한 신규 import 는 Python 표준 라이브러리
  - 위치: `.claude/hooks/guard_review_before_push.py:31` (`import shlex`)
  - 상세: `shlex.shlex(posix=True, punctuation_chars="();<>|&\n")` 로 셸 명령을 토큰화해 `git` 서브커맨드를
    판정한다. 자체 셸 파서를 새로 작성하거나 외부 라이브러리(예: `bashlex`)를 끌어오는 대신 표준
    라이브러리로 해결했다 — `.claude/tests/README.md` 가 명시하는 "harness Python 은 third-party
    의존성 0, bare `python3` 위에서 실행" 컨벤션(hooks 도 동일 관례를 공유)을 그대로 준수한다.
  - 제안: 없음 (현행 유지 권장 — third-party shell-parsing 라이브러리로 교체하지 말 것).

- **[INFO]** 신규/확장 테스트도 표준 라이브러리 + 기존 내부 테스트 하네스만 사용
  - 위치: `.claude/tests/test_push_detection.py:736-742` (신규 파일), `.claude/tests/test_reap_merged_worktrees.py:957-970`
  - 상세: `unittest`, `os`, `shutil`, `subprocess`, `tempfile` 표준 라이브러리와 기존 `_harness` 모듈
    (`_harness.load_module_by_path`, `_harness.REPO_ROOT`)만 사용. `_harness.py` 자체는 이번 diff 로
    변경되지 않은 기존 자산 — `pytest`/`unittest.mock` 등 신규 테스트 의존성 도입 없음. `mock gh` 스텁도
    순수 bash 스크립트(`_GH_STUB`)로 작성돼 있어 추가 mocking 라이브러리가 필요 없다.
  - 제안: 없음.

- **[INFO]** 내부 스크립트 간 신규 CLI 계약 — `bootstrap-session.sh` ↔ `reap-merged-worktrees.sh`
  - 위치: `.claude/tools/bootstrap-session.sh` (`anchor=$(...); bash "$reaper" ${anchor:+--keep "$anchor"} || true`)
    ↔ `.claude/tools/reap-merged-worktrees.sh` (`--keep` 파서 + `is_kept()`)
  - 상세: 패키지 의존성은 아니지만 "내부 의존성" 관점의 신규 결합이다. 호출부가 `|| true` 로 감싸여
    있어, 향후 `reap-merged-worktrees.sh` 의 인자 파서가 리팩터링되며 `--keep` 이 실수로 제거·개명되면
    (미지 인자 → `exit 2`) 실패가 조용히 삼켜지고 bootstrap 은 이를 감지·보고하지 않는다. 다만 이 결합은
    격리 단위테스트가 아니라 **엔드투엔드 테스트**(`test_bootstrap_keeps_the_worktree_it_was_invoked_from`,
    `test_bootstrap_still_reaps_unrelated_merged_worktrees`)로 양쪽 계약을 함께 고정해 뒀다 — plan
    문서(`plan/in-progress/harness-session-anchor-guards.md`) 자신도 "reaper 만 단위 테스트하면 bootstrap 이
    `--keep` 전달을 빠뜨려도 통과한다(계약의 양쪽 중 한쪽만 고정됨)" 는 근거로 이 테스트를 의도적으로
    추가했다고 명시한다. `.claude/settings.json` 의 SessionStart 등록
    (`bash "$CLAUDE_PROJECT_DIR/.claude/tools/bootstrap-session.sh"`) 도 이번 diff 로 바뀌지 않았음을
    확인했다 — `BASH_SOURCE[0]` 이 세션 앵커와 일치한다는 전제가 계속 유효하다.
  - 제안: 액션 불요(이미 완화됨). 향후 `reap-merged-worktrees.sh` 인자 파서를 만질 때는 이 두 e2e
    테스트가 항상 같이 통과해야 한다는 점만 유지·인지할 것.

- **[INFO]** 기존 외부 CLI 도구 의존성(`gh`, GitHub CLI)은 이번 diff 로 신규 도입되지 않았고 사용 방식도
  변경되지 않았다
  - 위치: `.claude/tools/reap-merged-worktrees.sh` (`gh_state()`, PR #677 최초 도입분, 이번 diff 미변경)
  - 상세: `is_kept()` 게이트가 `gh_state()` 호출 이전 단계(스킵 판정)에 추가됐을 뿐이다. fail-safe 정책
    (`gh` 부재·미인증 시 조회를 건너뛰고 삭제하지 않음)은 그대로 유지된다.
  - 제안: 없음 (참고용 확인).

- **[INFO]** Python 버전 호환성 — 새 문법이 기존 코드베이스 선례 범위 안
  - 위치: `.claude/hooks/guard_review_before_push.py:167` (`_tokenize`, `shlex.shlex(punctuation_chars=...)`)
  - 상세: `punctuation_chars` 문자열 인자는 Python 3.6+ 필요. `.claude/hooks/` 전반에 문서화된 최소 Python
    버전 명시는 없으나, 이미 `from __future__ import annotations` + PEP 604 `str | None` 유니언 문법이
    다수 훅 파일(`guard_default_branch_bash.py`, `_lib/branch_guard.py`, `_lib/review_guard.py`,
    `_lib/plan_guard.py` 등)에 광범위한 선례로 존재해, 이번 diff 가 새로운 버전 호환성 리스크를
    추가하지 않는다. 로컬 실행 환경은 Python 3.11.9 확인.
  - 제안: 없음.

- **[INFO]** 패키지 매니페스트 변경 없음 — 번들 크기·빌드 시간 영향 없음
  - 위치: N/A (diff 전체 범위)
  - 상세: `git diff origin/main...HEAD --stat` 로 확인한 8개 변경 파일(payload 의 7개 + `.claude/tests/README.md`
    1줄 추가)은 모두 `.claude/` 훅·스크립트·테스트·문서 및 `plan/` 진행 문서 1건이며, `package.json`/
    `requirements.txt`/`pyproject.toml`/lockfile 등 의존성 선언 파일은 하나도 포함되지 않았다. 이 코드는
    하네스 전용 스크립트로 `codebase/frontend`·`codebase/backend` 빌드 산출물에 포함되지 않는다.
  - 제안: 없음.

- **[INFO]** 라이선스·취약점 — 해당 없음
  - 상세: 신규 외부 패키지가 없으므로 라이선스 호환성 검토 대상도, 신규 CVE 노출 표면도 없다.
  - 제안: 없음.

## 요약

이번 변경은 `.claude/` 하네스 인프라(세션 앵커 reap 가드 + push 서브커맨드 판정 가드)에 국한되며, 신규
외부 패키지·라이선스·취약점·번들 크기 이슈가 전혀 없다. 유일한 신규 import(`shlex`)는 Python 표준
라이브러리이고, 신규/확장 테스트도 표준 라이브러리와 기존 내부 `_harness` 모듈만 재사용해 프로젝트가
`.claude/tests/README.md` 에 명시한 "하네스 Python 은 third-party 의존성 0" 컨벤션을 그대로 지켰다.
유일하게 주목할 만한 "내부 의존성" 변화는 `bootstrap-session.sh` ↔ `reap-merged-worktrees.sh` 사이의
신규 `--keep` CLI 계약인데, 이는 엔드투엔드 테스트로 양쪽을 함께 고정해 두어 향후 한쪽만
리팩터링되며 깨질 위험을 낮게 관리하고 있다. 전반적으로 의존성 관점에서는 조치가 필요한 항목이 없다.

## 위험도

NONE
