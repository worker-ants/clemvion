# 테스트(Testing) 리뷰

대상: 세션 앵커 reap 가드(`--keep`) + push 오탐 가드(`_is_git_push`) 하네스 변경 전체
(`origin/main...HEAD`, route_mode=all). 이 changeset 은 직전 리뷰(`review/code/2026/07/17/17_09_10`)
가 이미 한 차례 통과시킨 초기 구현에, 그 리뷰가 찾은 Critical 4건 + Warning 3건에 대한 후속 수정과
회귀 테스트, 그리고 가장 최근 커밋(`f4489d314`, docstring 정정 + 특성 테스트 1건)까지를 포함한다.
정적 분석에 그치지 않고 `.claude/tests/` 전체 스위트를 직접 재실행(270건 전체 통과, 이전 리뷰 시점
264건 대비 신규 6건 확인)하고, 신규 테스트가 실제로 무엇을 검증/재현하는지 diff 단위로 추적했다.

## 발견사항

- **[INFO]** `guard_review_before_push.main()` 진입점의 subprocess 통합 테스트 부재 (기존 갭, 재확인 — 신규 회귀 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py:270`(`def main()`)
  - 상세: `_is_git_push`/`_tokenize`/`_git_subcommand`/`_is_segment_boundary` 는 이번 라운드를 거치며
    매우 촘촘히 테스트됐지만(아래 강점 참고), 이를 소비해 stdin JSON payload 를 파싱하고
    `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 분기·최종 exit code(0/2)를 결정하는 `main()` 자체는
    여전히 subprocess 수준 테스트가 0건이다(`grep -rn "guard_review_before_push" .claude/tests/*.py`
    → `test_push_detection.py` 만 매치, 그것도 개별 함수만 import). 직전 리뷰가 이미 INFO #15 로
    지적하고 RESOLUTION.md 에 "미반영, 후속 과제"로 명시적으로 보류한 항목이며, 이번 diff 도
    `main()` 라인 자체는 건드리지 않아 새 회귀는 아니다.
  - 제안(비차단, 후속): `test_reap_merged_worktrees.py` 의 bootstrap end-to-end 패턴처럼
    `{"tool_input": {"command": "git push"}}` 류 stdin JSON 을 흘려 exit code 를 단언하는 얇은
    통합 테스트 1~2건.

- **[INFO]** `.claude/tests/README.md` "What's covered" 표에 `test_reap_merged_worktrees.py` 행 부재 (기존 갭, 재확인)
  - 위치: `.claude/tests/README.md:22-33`
  - 상세: 이번 diff 로 `test_push_detection.py` 행은 추가됐으나(32행) `test_reap_merged_worktrees.py`
    는 여전히 표에 없다(`grep -n reap .claude/tests/README.md` → 0건). 직전 리뷰 INFO #14 로 지적됐고
    RESOLUTION.md 에 "미반영. 전체 감사는 별도 후속 권장"으로 이미 의식적으로 보류됨. 이번 세션이
    새로 만든 회귀 스위트 2개 중 하나만 색인에 남는 상태가 계속된다.
  - 제안: 합의된 후속 범위 — 이번 PR 에서 액션 불요, 재확인만.

- **[INFO]** `gh_state()` 의 "바이너리는 있지만 호출 자체가 실패"(미인증/에러) 분기가 어떤 테스트로도 실행되지 않음
  - 위치: `.claude/tools/reap-merged-worktrees.sh:125-130`(`gh_state()`) /
    `.claude/tests/test_reap_merged_worktrees.py:38-45`(`_GH_STUB`, 모든 경로에서 `exit 0`),
    `:174`·`:180`(`gh_bin=` 오버라이드는 정확히 2가지: 기본 스텁과 `no-such-gh` 부재 경로뿐)
  - 상세: 스크립트 주석은 "Fail-safe: with gh missing / unauthenticated / erroring, worktree removal
    is skipped entirely" 라고 3가지 실패 모드를 명시하지만, 테스트가 실제로 구성하는 `gh` 스텁은
    항상 `exit 0` 이거나(정상 스텁) 아예 존재하지 않는 바이너리(`command -v` 단계에서 조기 반환)
    뿐이다. `"$GH" pr view … 2>/dev/null || echo ""` 의 `|| echo ""` 폴백(바이너리는 있으나 호출이
    비정상 종료 — 실제 미인증 `gh` 가 내는 상황)은 어떤 테스트에서도 트리거되지 않는다. 다만 이
    가드는 정확히 문자열 `"MERGED"` 만 삭제를 트리거하도록 설계돼 있어(`[ "$state" != "MERGED" ]`),
    이 미검증 분기가 깨지더라도 결과는 여전히 "삭제 안 함" 쪽으로 fail-safe 하다 — 실사용 리스크는
    낮다고 판단.
  - 제안(선택): `exit 1` 하는 3번째 스텁(예: `gh_bin=<always-fails-script>`)을 추가해 "존재하되
    실패" 경로를 명시적으로 고정하면 주석의 3가지 서술과 테스트 커버리지가 완전히 대응된다.

- **[INFO]** Critical #4 의 "수용된 트레이드오프"(미지 옵션의 값이 우연히 `push` 인 비-push 명령의 과차단)에 대한 pinning 테스트 부재
  - 위치: `.claude/hooks/guard_review_before_push.py:185`(`_git_subcommand` fail-closed 분기:
    `return "push" if "push" in segment[i + 1:] else None`) /
    `plan/in-progress/harness-session-anchor-guards.md` "잔여 한계" 절
    (`git --hypothetical-flag push status` 류 사례 서술)
  - 상세: plan 문서가 이미 이 트레이드오프를 명시적으로 서술·수용했고(false positive 방향이라
    false negative 보다 안전), `test_unknown_global_option_does_not_misread_its_value_as_subcommand`
    (`test_push_detection.py:176`)가 구조적 fail-closed 동작 자체는 고정한다. 다만 "미지 옵션 뒤
    자유값이 문자 그대로 `push` 인 비-push 명령이 실제로 과차단되는지"를 `_is_git_push()` 전체
    파이프라인 수준에서 pin 하는 케이스는 없다(예: `git --unknown -m push` 처럼 커밋 메시지 값이
    우연히 "push" 인 경우). 이 세션이 다른 잔여 한계마다 보인 "문서화 즉시 회귀 테스트로 고정"
    스타일과 비교하면 이 항목만 비어 있다.
  - 제안(선택): 문서화된 대로 동작함을 1건으로 고정하면 향후 "이 케이스도 고쳐야 하나" 재논쟁을
    예방.

## 강점 (참고)

- **직전 리뷰의 WARNING 2건 모두 비-vacuity 가 확인되는 방식으로 해소됨.** `--keep` repeatable
  계약은 `test_keep_is_repeatable_and_protects_every_named_worktree`
  (`test_reap_merged_worktrees.py`, 커밋 `8783d7b12`)가 `--keep A --keep B` 동시 지정 + 무관한
  merged 워크트리는 여전히 reap 됨을 함께 단언해 "--keep 이 전부 스킵으로 퇴화"하는 회귀까지
  잡는다. `_GIT_OPTS_WITH_VALUE` 커버리지 갭은
  `test_all_value_taking_global_options_skip_their_value`(커밋 `2c4e96eb4`)가 9개 전항목을
  테이블 기반으로 파라미터화해 향후 항목 추가/오타에도 자동으로 대응한다.
- **과소차단 회귀 4건(Critical #1-4) 수정에 동반된 테스트가 정확히 원인 계층에 대응한다** — 개행
  단독 구분(`test_newline_is_a_segment_separator_on_its_own`, 토크나이저 레벨), 인용부호 분할
  (기존 `test_quoted_pipe_is_not_a_segment_separator` + 사전 필터 제거는 `MUST_BLOCK` 케이스로),
  대소문자(`GIT push` 케이스), 미등록 글로벌 옵션(`test_unknown_global_option_does_not_misread_...`,
  `_git_subcommand` 단위 + `MUST_BLOCK` 통합 양쪽). RESOLUTION.md 가 주장하는 "수정 전 코드에서
  9건 FAIL, 1건은 이미 PASS" 를 본 리뷰에서 별도로 재현하지는 않았지만(직전 세션이 이미 수행),
  현재 HEAD 에서 전체 스위트가 그린임은 직접 확인했다.
  코드/테스트가 명시적으로 `SUMMARY#C1`~`#C4`, `#W2`, `#W3` 태그를 남겨 리뷰 발견사항 ↔ 커밋 ↔
  테스트 3자 추적이 가능한 점도 좋은 관행이다.
  - 가장 최근 커밋(`f4489d314`)의 `test_quoted_pure_punctuation_is_read_as_a_boundary_and_that_is_safe`
    (`test_push_detection.py:113`)는 "이건 회귀 수정이 아니라 반증된 docstring 서술을 실측대로
    교정하고 그 동작(안전 방향)을 특성 테스트로 고정한 것"이라고 스스로 정확히 표현한다 —
    `_is_segment_boundary`/`_tokenize`/`_is_git_push` 3개 레이어에서 동일 입력을 검증해, "따옴표가
    보호한다"는 잘못된 미래의 "수정"을 막는다. 과장 없는 정직한 테스트 커밋.
- **Mock 사용이 여전히 적절.** `test_push_detection.py` 는 순수 함수만 다뤄 목이 전혀 없고,
  `test_reap_merged_worktrees.py` 는 git 은 실제 임시 저장소로 완전히 실행하면서 외부
  네트워크/인증 의존(`gh`)만 `REAP_GH_BIN` 환경변수 seam 으로 스텁한다 — README.md 의 "git
  자체가 아니라 git-backed helper 를 patch" 컨벤션과 부합. 셸 스크립트라 Python
  `unittest.mock` 을 못 쓰는 제약을 env-var seam 으로 우회한 설계.
- **테스트 격리 확인.** `test_reap_merged_worktrees.py` 는 매 테스트 `tempfile.mkdtemp()` +
  `addCleanup(shutil.rmtree)` 로 완전 독립된 git 저장소를 새로 만들고, 환경변수도
  `os.environ.copy()` 기반으로 subprocess 에만 주입(부모 프로세스 오염 없음), 스로틀은
  `REAP_MIN_INTERVAL=0` 으로 항상 무력화해 매 실행이 결정적이다. `--keep` 계열 테스트는 모두
  `cwd` 를 kept 워크트리가 아닌 다른 위치로 명시해, "cwd 스킵이 우연히 --keep 테스트를 통과시킨다"
  는 vacuity 를 능동적으로 차단한다(파일 상단 docstring 이 이 설계 의도를 직접 서술).
  독립 실행 순서 의존성 없음, 병렬 실행 시에도 안전.
- **테스트 가독성.** 거의 모든 테스트 메서드가 "무엇을 왜 고정하는지"를 docstring 에 원인
  Critical/Warning 번호와 함께 설명한다 — 향후 "이 테스트를 지워도 되나"라는 판단을 리뷰어가
  코드만 보고 내릴 수 있게 한다.
- **CI 배선 확인.** `.github/workflows/harness-checks.yml` 의 `paths:` 가 `.claude/hooks/**`·
  `.claude/tools/**`·`.claude/tests/**` 를 모두 포함해 이번 diff 는 정상적으로 CI 스위트를
  발화시킨다. e2e 는 `PROJECT.md` §e2e 면제 화이트리스트의 `.claude/**`/`plan/**` 부분집합이라
  면제가 정당하다(직접 재확인).

## 요약

이번 changeset 은 이미 한 차례 `/ai-review` 를 거쳐 Critical 4건·Warning 3건이 모두 코드+회귀
테스트로 해소된 상태이고, 이번 리뷰에서 그 해소가 실제로 견고한지(테이블 기반 전항목 커버,
"전부 스킵으로 퇴화" 방지 단언, --keep repeatable 등)를 diff 단위로 직접 추적·검증했다. 가장 최근
커밋은 로직 변경 없이 반증된 docstring 서술을 바로잡고 그 안전한 동작을 3-레이어 특성 테스트로
고정하는, 정직하고 범위가 좁은 변경이다. `.claude/tests/` 전체 스위트(270건)를 직접 재실행해
전부 통과함을 확인했고, 테스트 격리·가독성·mock 경계 설정 모두 프로젝트 컨벤션에 부합한다. 남은
갭은 전부 INFO 수준이며 그중 2건(`main()` 통합 테스트, README 색인)은 직전 리뷰에서 이미 의식적으로
후속으로 분류·보류된 항목의 재확인이고, 나머지 2건(`gh_state()` 의 "존재하되 실패" 분기 미검증,
Critical #4 트레이드오프의 pin 테스트 부재)은 이번 리뷰가 새로 관찰했지만 둘 다 이미 fail-safe/
false-positive 방향으로 설계상 보호되어 있어 실사용 리스크는 낮다. 이 diff 가 해결하려는 두 핵심
인시던트(세션 앵커 reap 사망, push 오탐)에 대한 테스트 실효성은 훼손되지 않는다.

## 위험도

LOW
