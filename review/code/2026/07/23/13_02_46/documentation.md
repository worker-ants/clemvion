# 문서화(Documentation) 코드 리뷰

## 리뷰 대상
- `.claude/tests/test_guard_review_before_push_main.py` (신규)
- `plan/in-progress/harness-guard-followups.md` (D 항목 완료 갱신)

## 발견사항

### [WARNING] 신규 테스트 모듈 docstring 이 "`_is_git_push` 는 이미 두텁게 테스트됨" 이라는 이제는 거짓인 전제를 새로 심는다
- 위치: `.claude/tests/test_guard_review_before_push_main.py:35-36` (모듈 docstring 첫 문단)
  ```
  `_is_git_push` is already thickly tested elsewhere; what had NO coverage is the
  entry point that CONSUMES its result — ...
  ```
- 상세: 이 문장은 `review/code/2026/07/17/19_15_56/testing.md` 의 WARNING("`main()` 훅 진입점이 어디에도 테스트되지 않음") 서술을 그대로 이어받은 것인데, 그 리뷰가 전제한 "두터운 테스트"는 당시 `_is_git_push` 를 8개 헬퍼(`_tokenize`/`_find_command_substitutions`/`_git_subcommand`/`_shell_dash_c_argument`/`_eval_argument`/`_is_segment_boundary`/`_has_hostile_control_characters`/`_segment_runs_push`)로 전면 재작성한 버전과, 그것을 44개 케이스로 검증하던 `test_push_detection.py` 를 가리킨다. 그런데 그 재작성은 커밋 `3c6547b4d "revert(harness): push 가드 서브커맨드 재작성 철회 — ①(세션 앵커 reap)만 남긴다"` 로 **완전히 철회**됐다(관련 메모리: "reaper 앵커 --keep 완료 / push 가드 재작성은 3라운드 회귀로 철회"). 현재 `.claude/hooks/guard_review_before_push.py` 의 `_is_git_push` 는 단일 정규식(`_GIT_PUSH`)만 쓰는 단순 버전으로 되돌아갔고, `test_push_detection.py` 자체가 저장소에 존재하지 않는다(확인: `find .claude/tests -iname 'test_push_detection*'` → 0건, `grep -rn "_is_git_push\|_GIT_PUSH" .claude/tests/*.py` → 이 신규 파일 1개뿐). 즉 현재 시점에서 `_is_git_push` 의 정규식 정확성(간접실행·따옴표·개행·대소문자 등 엣지케이스)은 **어디에도 단위 테스트가 없다** — 이 신규 파일도 `_PUSH = "git push origin HEAD"` / `"git status"` 두 단순 문자열로만 간접 행사할 뿐, 저 도크스트링이 시사하는 수준의 커버리지는 제공하지 않는다. 같은 plan(`harness-guard-followups.md`)의 backlog 항목 ②("push 오탐 재설계")가 바로 이 갭을 다루도록 아직 미착수 상태로 남아 있어, 이 docstring 이 "이미 충분하다"는 잘못된 안도감을 줄 위험이 있다.
- 제안: 첫 문단을 사실에 맞게 정정 — 예) "`_is_git_push`'s current (simple-regex) implementation has no dedicated unit tests of its own (the earlier 44-case suite was reverted along with the subcommand-detection rewrite, see `harness-push-guard-subcommand-detection.md` / backlog item ②); this file only covers what `main()` does with whatever `_is_git_push` returns." 로 바꿔 두 갭(정규식 자체 vs 진입점 오케스트레이션)을 혼동하지 않도록 명시.

### [WARNING] 인라인 주석이 실제로 쓰이지 않는 심볼을 참조
- 위치: `.claude/tests/test_guard_review_before_push_main.py:66`
  ```python
  import _harness  # noqa: F401  — side effect: harness path setup; REPO_ROOT used below
  ```
- 상세: `_harness.py` 는 `REPO_ROOT`/`CLAUDE_DIR`/`HOOKS_DIR` 세 상수를 export 하는데, 이 테스트 파일이 실제로 쓰는 건 `HOOK_SRC = _harness.HOOKS_DIR / "guard_review_before_push.py"` 한 줄뿐이다. `REPO_ROOT` 는 파일 전체에서 단 한 번도 참조되지 않는다 — 주석의 "REPO_ROOT used below" 는 사실과 다르다. 또한 `_harness.HOOKS_DIR` 를 속성 접근으로 직접 사용하므로 이 import 는 flake8 관점에서 애초에 "unused"(F401)가 아니라, `# noqa: F401` 억제 자체도 불필요하다(다른 harness 테스트에서 `import _harness` 를 순수 side-effect 목적으로만 쓸 때 이 noqa 패턴을 그대로 복사해온 것으로 보인다). 사소하지만 다음 유지보수자가 "REPO_ROOT 를 여기서 어디에 쓰지?" 하고 혼란스러울 수 있다.
- 제안: 주석을 `HOOKS_DIR used below` 로 정정하거나, noqa 주석 자체를 제거(속성 접근으로 이미 "used").

### [WARNING] plan 하단 마스터 체크리스트가 방금 갱신한 본문과 즉시 어긋남
- 위치: `plan/in-progress/harness-guard-followups.md` — 본문 D 섹션(724행 부근, 이번 diff)은 `- [x]` + 완료 상세로 갱신됐지만, 파일 맨 끝 "## 체크리스트" 표(858행)의 `- [ ] D — push 훅 \`main()\` 테스트` 는 이번 diff 가 건드리지 않아 여전히 미체크 상태.
- 상세: 같은 파일 안에서 "D 는 완료됐다"(본문)와 "D 는 아직이다"(요약 체크리스트)가 동시에 참인 모순이 생겼다. 이 프로젝트는 "plan 체크박스 = 실제 상태" 를 명시적 규약/교훈으로 삼고 있고(과거 리뷰에서 stale checkbox 로 인한 오판·중복작업이 실제로 발생), 이 파일 자체가 다른 항목(A, F)에서는 본문·요약 둘 다 `[x]` 로 정확히 동기화되어 있어(855·860행) 이번 D 항목만 동기화가 누락된 게 두드러진다. 다음 세션이 파일 하단 체크리스트만 훑고 D 를 "아직 미착수"로 오판하거나, 반대로 본문만 보고 요약을 안 고친 채 plan 을 종결 판단할 위험이 있다.
- 제안: 체크리스트의 D 항목도 `- [x] D — push 훅 \`main()\` 테스트` 로 즉시 동기화.

### [INFO] `.claude/tests/README.md` "What's covered" 카탈로그에 신규 테스트 파일 행 누락
- 위치: `.claude/tests/README.md` §"## What's covered" 표
- 상세: 이 표는 `.claude/tests/` 의 각 `test_*.py` 파일을 1행씩 등재해 무엇을 가드하는지 서술하는 관례를 지금까지 지켜왔다(18개 파일 등재). 신규 `test_guard_review_before_push_main.py` 는 이번 diff 로 추가됐지만 이 표에는 행이 없다. 다만 이미 6개 기존 파일(`test_check_e2e_playwright_config.py`, `test_consistency_impl_done.py`, `test_consistency_target_validation.py`, `test_plan_guard.py`, `test_report_playwright_flaky.py`, `test_run_test_watchdog.py`)도 등재 누락 상태라(실측: `ls test_*.py` vs README 표 대조), 이 diff 만의 신규 회귀는 아니고 기존 drift 를 답습하는 정도다. README-vs-실제 파일 목록을 대조하는 자동 가드(예: `test_doc_sync_matrix.py` 패턴)는 없어 강제되지 않는다.
- 제안: 이번 파일 1행 추가는 선택 사항(우선순위 낮음). 근본 해결은 별건 — README 카탈로그와 실제 `test_*.py` 목록의 drift 를 잡는 가드 도입.

### [INFO] docstring/주석 자체의 품질은 우수
- 상세(긍정 소견): 모듈 docstring 이 "왜 이 테스트가 필요한가"(무엇이 회귀할 수 있는가)를 먼저 설명하고, stub 계약(`review_guard.evaluate_review()`/`plan_guard.evaluate_plan()` 의 반환 shape)과 `STUB_REVIEW`/`STUB_PLAN` env 스위치 전체 케이스를 표로 나열하는 방식은 이 리포의 다른 `.claude/tests/*.py` 관례와 일관되고, 실제 훅 소스(`guard_review_before_push.py`)와 대조했을 때 — gate 순서(REVIEW→PLAN), `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 게이트별 독립, import 실패 시 `evaluate_* = None` 비활성화, `evaluate_*()` 예외 시 fail-open, `tool_input`/`input` 별칭 키 — 위 두 건을 제외하면 전부 정확히 일치한다. 새 환경변수(`STUB_REVIEW`/`STUB_PLAN`)는 테스트 전용이며 docstring 안에서 즉시 문서화되어 있어 별도 설정 문서가 필요 없다.

## 요약
신규 e2e 테스트 파일은 문서화 수준이 전반적으로 높고(모듈 docstring, stub 계약 설명, 테스트별 근거 주석) 실제 훅 동작과도 대체로 정확히 일치하지만, 모듈 docstring 첫 문장이 이미 철회된 과거 재작성판을 근거로 "`_is_git_push` 는 두텁게 테스트됨"이라는 지금은 사실이 아닌 주장을 새로 심는 점, 그리고 같은 diff 가 갱신한 plan 파일에서 본문(D 완료)과 하단 마스터 체크리스트(D 미완료)가 즉시 서로 모순되는 점이 실질적인 정정 대상이다. 나머지(README 카탈로그 누락, `REPO_ROOT` 주석 오기재)는 기존 drift 를 답습하는 낮은 우선순위 사안이다.

## 위험도
MEDIUM
