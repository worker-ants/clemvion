# Security Review — harness-review-gate-fixes

## 발견사항

- **[INFO]** 이번 변경의 핵심은 실제로 게이트 우회(bypass) 결함을 **닫은** 것이다 — 신규 취약점이 아니라 수정 확인
  - 위치: `.claude/hooks/_lib/review_guard.py:862` (`evaluate_review` 시그니처), `:901` (`if in_flight_ok and _code_review_in_flight(...)`), `.claude/hooks/guard_review_before_stop.py:344` (`decision = evaluate_review(in_flight_ok=True)`), `.claude/hooks/guard_review_before_push.py:845-852` (`_evaluate_over_targets` → `evaluate(target)`, kwarg 없음)
  - 상세: 수정 전에는 `_code_review_in_flight()`(리뷰 세션 디렉터리 + `meta.json` 은 존재하지만 `SUMMARY.md` 미작성 상태, `_IN_FLIGHT_TTL_SECONDS=1800`초 이내)에 의한 억제가 `evaluate_review()` 내부에서 **무조건** 적용됐다. `guard_review_before_push.py` 의 hard gate 와 `guard_review_before_stop.py` 의 soft nudge 가 **같은 함수**를 공유하므로, 이 억제는 실제로 push 게이트까지 열어 버렸다 — 즉 리뷰 세션 디렉터리만 만들어두면(`SUMMARY.md` 작성 여부와 무관하게) 최대 30분간 `git push` 가 무리뷰 상태로 통과할 수 있는 실질적인 접근 통제 우회(access-control bypass, 이 저장소 맥락에서 "review-coverage gate") 였다. 모듈 자체 주석(`_IN_FLIGHT_TTL_SECONDS` 옆 주석, `_code_review_in_flight` docstring)이 "push guard still hard-gates" 라고 명시했지만 억제가 무조건인 동안 그 문장은 거짓이었다.
  - 이번 diff 는 `evaluate_review(cwd=None, *, in_flight_ok: bool=False)` 로 opt-in 화하고, Stop 훅만 `in_flight_ok=True` 를 넘기도록 스코프를 좁혔다. push 호출부(`guard_review_before_push.py`)는 `_evaluate_over_targets` → `evaluate(target)` (positional only, kwarg 없음)로 변경 없이 유지되어 이 opt-in 을 절대 받지 않는다. 직접 코드 추적으로 확인: `_run_gates` → `_evaluate_over_targets(evaluate_review, targets, ...)` → `evaluate(target)`.
  - 양방향 회귀 테스트로 고정됨: `test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest`(`test_push_path_still_blocks_while_in_flight` / `test_stop_path_opts_in_and_is_allowed`), `test_guard_review_before_push_main.py::test_push_never_opts_into_the_in_flight_concession`(seam 파일로 실제 전달된 kwarg 값이 `False` 인지 단언), `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in`(Stop 쪽은 `True` 전달 확인). 세 테스트 모두 "값이 실제로 그 kwarg 를 운반하는지"를 seam/spy 로 단언하므로, decision 객체만 비교하는 약한 assert 로는 잡지 못했을 회귀(예: `evaluate_review()` 로 되돌리는 뮤턴트)까지 커버한다.
  - 제안: 조치 불필요 — 수정이 이미 올바르게 적용되고 테스트로 봉쇄됨. plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`)가 스스로 후속 항목 #5 로 남긴 "`evaluate_review` 의 boolean flag 구조 — 세 번째 호출부가 생기면 다시 기본값에 의존" 이라는 관찰은 타당한 장기 리스크이나 이번 diff 범위의 결함은 아니다(defer 로 이미 기록됨).

- **[INFO]** 신규 subprocess 호출은 전부 list-형 인자 — 커맨드 인젝션 표면 없음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `_default_branch_ref()`(약 1201행 부근, `_git(["git", "symbolic-ref", ...])`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` `_branch_changed_rels()`(신규 함수, `subprocess.run(["git", "diff", ..., f"{diff_base}...HEAD", "--", "."], ...)`)
  - 상세: 신규 `--diff-base`/`_default_branch_ref` 관련 git 호출 모두 `shell=True` 없이 리스트 인자로 `subprocess.run`/`_git()` 래퍼를 사용한다. `diff_base` 는 셸에 전달되지 않으므로 셸 메타문자 인젝션 경로가 없다. 이 값은 로컬 CLI 플래그(`--diff-base <ref>`)로만 주입되는 개발자 도구 인자이지 원격/미신뢰 입력이 아니다.
  - 제안: 없음 (현재 패턴 유지 권장).

- **[INFO]** 신규 생략 안내문(`_omitted_content_note` / `_aggregate_omission_note`)이 저장소 파일 경로를 그대로 프롬프트에 삽입 — 새로운 회귀는 아니나 도구 특성상 유의
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561` (`_omitted_content_note`), `:1254` (`_aggregate_omission_note`)
  - 상세: `rel_path`(= `ci["file_path"]`, git diff/디렉터리 워크에서 온 값)를 이스케이프 없이 f-string 으로 마크다운에 삽입한다. 이는 이미 이 파이프라인 전체가 파일 **전체 내용**·diff 본문을 통째로 LLM sub-agent 프롬프트에 그대로 넣는 기존 설계의 연장선이라 새로운 신뢰 경계 침해는 아니다(파일 경로는 이미 노출되는 파일 내용의 부분집합). 다만 "LLM 에이전트에게 파일명/경로를 통해 prompt-injection 을 시도"하는 매우 협소한 시나리오가 이 도구 계열 전체(리뷰어·라우터·checker)에 항상 잠재한다는 점은 기록해 둘 가치가 있다 — 이번 diff 가 만든 문제는 아니다.
  - 제안: 조치 불필요. 향후 이 계열 도구에 신뢰 경계(예: 외부 기여 PR 자동 리뷰)가 추가된다면 별도로 재평가할 사항.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 변경된 15개 파일 전체(`*.py`, `*.md`) 대상 패턴 검색(`api[_-]?key|secret|password|token|bearer|-----BEGIN`) 수행 — 매칭은 전부 식별자/문서명 오탐(`_IMPL_DONE_MODE_TOKEN` 상수명, `secret-store.md` spec 문서명 언급, 테스트 주석의 `integration_expired`)이며 실제 자격증명은 없음.

## 요약

이번 diff 는 새로운 취약점을 도입하지 않았다. 반대로 diff 의 핵심 내용(`review_guard.evaluate_review()` 의 `in_flight_ok` opt-in 화)은 실질적인 접근 통제 결함 — 리뷰 세션 디렉터리만 생성해 두면 최대 30분간 `git push` 하드 게이트가 무리뷰 상태로 열리던 문제 — 를 닫는 보안 강화 커밋이며, push/Stop 양쪽 호출부와 회귀 테스트로 정확히 스코프가 검증됐다(직접 코드 추적으로 push 호출부가 새 opt-in 을 절대 받지 않음을 확인). 나머지 변경(프롬프트 예산/생략 안내 로직, `--diff-base` 기반 git subprocess 호출, 문서 정책 갱신)은 전부 list-형 subprocess 호출·시크릿 미포함·기존 신뢰 경계 유지로, 인젝션·인증우회·정보노출 관점에서 추가 위험이 없다.

## 위험도

NONE
