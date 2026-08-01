# 테스트(Testing) Review — round 9

대상: `.claude/_shared/{block_integrity,retry_state}.py`,
`.claude/hooks/_lib/{failopen_state,review_guard}.py`,
`.claude/hooks/guard_review_before_{push,stop}.py`,
`.claude/agents/consistency-summary.md`,
`.claude/skills/{code-review-agents,consistency-checker,merge-coordinator}/{SKILL.md,scripts/*.py}`,
`.claude/tests/{test_block_integrity,test_retry_state_shared,test_consistency_orchestrator_state,
test_review_changeset_warning,test_stop_guard_failopen,README}.*`,
`plan/in-progress/harness-review-gate-ci-backstop.md`.

방법: 프롬프트에서 잘린 5개 파일(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`, `test_block_integrity.py` 전문)은 전부 `Read` 로 원본을 직접
열어 확인했다. `git log`/`git show` 로 이 브랜치의 라운드별 커밋(1R~8R, 특히 7R=`5526fc8f8`,
8R=`54fff611f`)과 각 커밋의 정확한 diff 를 대조했고, 8R 의 직전 리뷰 산출물
(`review/code/2026/08/01/08_11_19/{testing.md,RESOLUTION.md}`)을 읽어 그 라운드에서 testing
리뷰어가 낸 지적이 이번 라운드까지 실제로 처리됐는지 재확인했다. 핵심 주장은 전부 코드 실행으로
검증했다(아래 각 항목에 측정 방법 명시). `python3 -m pytest .claude/tests/test_block_integrity.py`
38 tests 전부 PASS 확인.

## 발견사항

- **[WARNING]** Gate 2 의 downgrade advisory(`notes`)가 공개 진입점 `evaluate_review()` 를
  통해 실제로 흘러나오는지 검증하는 테스트가 스위트 전체에 여전히 없다 — **8R 리뷰가 이미 지적한
  결함이 8R 수정(fix) 커밋에서 처리되지 않은 채 이번 라운드까지 그대로 남아 있다.**
  - 위치: `.claude/tests/test_review_guard.py:369` (`class SpecConsistencyGateTest`, 여전히
    `_newest_resolved_impl_done_mtime` 을 `mock.patch.object` 로 완전히 대체) /
    `.claude/hooks/_lib/review_guard.py` 의 `evaluate_review` 함수, Gate 2 블록
    (`notes: list[str] = []` 선언 후 `_newest_resolved_impl_done_mtime(repo_root, dirty, notes)`
    호출하는 부분).
  - 상세: `review/code/2026/08/01/08_11_19/testing.md` 가 이 정확한 갭을 mutation 으로 실측
    확인했다 — `review_guard.py` 의 `notes` 인자를 throwaway 리스트로 shadow 해 바깥 `notes` 가
    영원히 비게 만든 뒤 관련 테스트 6개 파일(`test_review_guard.py` 등, 143개)을 실행하니 **전부
    GREEN** 이었다는 기록. 그 라운드의 후속 fix 커밋(`54fff611f`, "8R 리뷰 반영")의 stat 을 직접
    확인하면 `.claude/_shared/block_integrity.py`, `.claude/hooks/_lib/review_guard.py`,
    `code_review_orchestrator.py`, `test_block_integrity.py`, `test_review_changeset_warning.py`
    5개만 바뀌었고 **`test_review_guard.py` 는 포함돼 있지 않다** — 즉 그 라운드가 review_guard.py
    자체는 고쳤지만(다른 리뷰어들이 낸 두 번째 이차/glob 지수 문제), testing 리뷰어가 낸 이 WARNING
    은 처리되지 않았다. `RESOLUTION.md` 의 "기등재/후속" 목록(lost update §10,
    merge_coordinator reconcile 미위임 §9 등)에도 이 항목은 없고, `plan/in-progress/
    harness-review-gate-ci-backstop.md` 전체를 grep 해도 `SpecConsistencyGateTest`/이 갭에 대한
    언급이 전혀 없다 — 고쳐지지도, 의도적으로 defer 등재되지도 않은 채 리뷰→처분 사이에서 유실된
    것으로 보인다. 직접 재확인(이번 라운드): `test_review_guard.py:369` 의 `SpecConsistencyGateTest`
    는 지금도 `_newest_resolved_impl_done_mtime` 을 mock 하며, 이 파일 전체에 `.notes` 를
    단언하는 코드가 없다(grep 확인). 이 결함 클래스("advisory 가 조용히 유실될 수 있다")는 이
    branch 전체가 존재하는 이유 그 자체이므로, 그 방어선의 가장 중심 진입점(`evaluate_review()`)이
    여전히 무방비인 채로 8R·9R 두 라운드를 통과했다는 뜻이다.
  - 제안: (8R 이 이미 제시한 것과 동일) `test_review_guard_hardening.py::RebaseAuthorDateTest`
    의 "실제 임시 git repo + Gate 1 충족" 패턴과 `test_block_integrity.py::
    GateSurfacesTheContradictionTest._repo_with_session` 의 "downgrade 된 consistency 세션
    생성" 패턴을 결합해, spec `code:` glob 에 매칭하는 실제 파일 변경 + `--impl-done`/
    `BLOCK: NO`/`[CRITICAL]` 체커 리포트를 갖춘 저장소에서 `_newest_resolved_impl_done_mtime`
    을 mock 하지 않고 `evaluate_review(root)` 를 호출해 `d.notes` 가 비어있지 않음을 단언하는
    테스트를 추가할 것. 이 항목이 다시 한 라운드를 지나가게 두지 말고 지금 처리하거나, 최소한
    `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 목록에 명시적으로 등재할 것.

- **[WARNING]** `test_a_trailing_run_after_a_real_verdict_returns_fast` 가 자기 docstring 이
  주장하는 것을 검증하지 못한다 — round 7/8 이 반복해서 겪은 "이 이차 인스턴스를 고쳤다는 라운드와
  그 회귀 테스트가 실제로는 그 코드 경로에 도달조차 못 한다" 패턴의 세 번째 사례.
  - 위치: `.claude/tests/test_block_integrity.py:543-546` (`class VerdictParserStaysLinearTest`,
    method `test_a_trailing_run_after_a_real_verdict_returns_fast`).
  - 상세: 이 테스트의 docstring 은 "the tail gap in the END pattern"(`_BLOCK_AT_LINE_END` 의
    검증 뒤 트레일링 gap `[ \t*]*$`, 옛 버전은 `\**\s*$`)을 스트레스 테스트한다고 주장한다.
    **직접 실행으로 반증**: 입력 `"BLOCK: YES" + " "*45000 + "x"` 에 대해
    `_BLOCK_AT_LINE_END.finditer(text)` 는 **빈 리스트**를 반환한다(트레일링 `"x"` 때문에 `$` 가
    끝내 매치되지 못함) — 즉 이 정규식은 이 입력에서 **한 번도 성공 매치를 만들지 않는다**. 테스트가
    기대하는 `"YES"` 결과는 전적으로 `_BLOCK_AT_LINE_START` 로의 폴백에서 나오며, 그 패턴은
    "BLOCK: YES" 직후에서 매치를 끝내므로 뒤따르는 45,000자와는 아예 무관하다(둘 다
    `python3 -c` 로 직접 실행해 확인). 더 나아가 옛(pre-fix) 트레일링 패턴 `\**\s*$` 자체를 복원해
    같은 입력 및 5가지 변형(순수 공백/순수 별표/교대/공백-후-별표/별표-후-공백, n=2000~32000)으로
    측정했으나 **모든 경우 선형**이었다(옛/신 패턴 모두 n=45000 에서 0.0006s 이하) — `\**`(별표만
    매치)와 `\s*`(공백만 매치)는 서로소 문자 클래스라, START/END 양쪽의 "검증 앞" gap
    (`\s*\**\s*`, 실제로 이차였던 부분)과 달리 "검증 뒤" gap 은애초에 이차가 될 수 없다. 즉 이
    테스트는 (a) 자신이 주장하는 하위식을 실제로 실행 경로에 태우지 못하고, (b) 설사 그 하위식이
    옛(버그) 형태로 되돌아가도 이 입력으로는 감지할 수 없다 — 코드 자체는 올바르지만(다른 두
    테스트가 실제 이차를 정확히 잡아낸다, 아래 "확인된 사항" 참조), 이 세 번째 케이스는 순수하게
    vacuous 하다.
  - 제안: 이 테스트를 제거하거나, 실제로 `_BLOCK_AT_LINE_END` 를 성공 매치시키는 입력으로
    교체할 것(예: 트레일링 `"x"` 없이 `"BLOCK: YES" + " "*n` 로 끝내 `$` 가 성공하는 입력을 써서
    `_BLOCK_AT_LINE_END` 가 실제로 이 gap 을 통과하는지 확인). 또는 애초에 이 트레일링 gap 은
    (측정상) 이차가 아니므로 "무엇을 막는 테스트인지" 를 docstring 에서 정정할 것.

- **[INFO]** (8R 부터 이어지는, 아직 미해소) `test_push_guard_worktree_scope.py` 의 멀티-워크트리
  픽스처에 `notes` 필드가 없어, "target 순서 의존 advisory 유실" 결함이 **실제 `_push_targets`
  워크트리 선정 경로**를 통해서는 재발 감지되지 않는다.
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py` 의 `_REVIEW_STUB` 문자열,
    `_Decision` dataclass (`blocked: bool` / `reason: str` 만 있고 `notes` 없음 — 직접 확인).
  - 상세: 8R 테스트 리뷰가 이미 지적한 항목이며, 이번 라운드에도 그대로다.
    `NotesFromLaterTargetsSurviveAnEarlierBlockTest`(`test_block_integrity.py`)가
    `_evaluate_over_targets` 를 합성 문자열 target(`/w/0`, `/w/1`)으로 직접 구동해 로직 자체는
    잘 커버하지만, 실제 `git worktree list` 파싱 + 경로 해석을 거치는 subprocess 스위트 쪽은
    `notes` 를 다루지 않으므로 "target 선정 로직과 note 수집 로직이 얽히는" 미래 변경에서만
    노출되는 좁은 위험이다. `plan/in-progress/harness-review-gate-ci-backstop.md` 에도 이
    항목의 등재는 없다.
  - 제안: 8R 이 이미 제시한 것과 동일 — `_REVIEW_STUB` 의 `_Decision` 에 `notes: tuple = ()`
    필드와 이를 채우는 env 훅을 추가.

- **[INFO]** `_MAX_GLOB_WILDCARDS`(=6) 의 정확한 경계에 대한 테스트가 없다 — `>` 를 `>=` 로
  바꾸거나 상수 자체를 하나 어긋나게 하는 뮤테이션이 현재 스위트로는 잡히지 않는다.
  - 위치: `.claude/hooks/_lib/review_guard.py:603` (`if glob.count("*") > _MAX_GLOB_WILDCARDS:`).
  - 상세: `SpecGlobCompilationIsBoundedTest`(`test_block_integrity.py`)는 상한을 훨씬 초과하는
    글롭(`"a*"*24+"!"`, 별표 48개)과 실제 spec 글롭(별표 0~1개)만 다룬다. 정확히 6개·7개
    별표를 가진 글롭으로 "6은 정상 컴파일 경로를 타고 7은 캐치올(`.*`)로 빠진다" 는 경계를
    직접 확인하는 테스트는 없다. 실제 spec 글롭이 그 근처에도 가지 않으므로 운영 위험은 낮지만,
    경계값 테스트 자체의 부재는 "엣지 케이스 테스트" 관점의 작은 갭이다.
  - 제안: `_glob_to_regex("a" * 6 + "!")` (컴파일된 패턴이 캐치올이 아님을 확인)과
    `_glob_to_regex("a" * 7 + "!")` (캐치올로 빠짐을 확인) 두 케이스 추가.

- **[INFO]** `.claude/tests/README.md` 의 `test_block_integrity.py` 행(60번째 줄)이 원래의
  "Critical 하향 금지" 백스톱 목적만 서술하고, 7R/8R 이 같은 파일에 추가한 두 개의 다른 성격
  테스트 클래스(`VerdictParserStaysLinearTest` 의 정규식 이차 회귀, `SpecGlobCompilationIsBoundedTest`
  의 glob 지수 백트래킹 방지)는 언급하지 않는다.
  - 위치: `.claude/tests/README.md:60`.
  - 상세: `test_tests_readme_catalog.py` 메타 테스트는 파일명이 README 에 **등재돼 있는지**만
    검사하고(직접 확인: 정규식이 행 전체가 아니라 백틱 파일명만 파싱), 그 행의 산문이 파일 내부의
    각 테스트 클래스를 다 반영하는지는 검사 대상이 아니다. 따라서 이 드리프트는 그 가드의 사각지대
    바깥에 있고 조용히 쌓일 수 있다. 실질 피해는 작다(파일 자체의 docstring 은 최신이라 코드를
    직접 열면 알 수 있음) — discoverability 문제일 뿐.
  - 제안: 해당 행에 "정규식 O(n²) 회귀 방지 + glob 지수 백트래킹 상한" 한 문구 추가.

## 확인된 사항 (긍정 — 직접 측정)

- **정규식 O(n²) 회귀 테스트 중 두 개는 실제로 vacuous 하지 않다** (세 번째는 위 WARNING 참조).
  `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 를 각각 7R 시점(선두 클래스만 고친) 상태로
  복원해 `"BLOCK:" + " "*n` 을 측정 — 7R 상태에서 n=45,000 은 **14.67~14.94초**(현재 코드는
  0.0008초). `test_no_verdict_in_a_large_document_returns_fast` 와
  `test_a_bare_block_followed_by_a_long_run_returns_fast` 는 각각 실제 대상 코드 경로에
  도달해 실제로 재발을 잡는다는 것을 직접 실행으로 확인했다.
- 두 정규식(`_BLOCK_AT_LINE_START`, `_BLOCK_AT_LINE_END`) 전수에 대해 grep 으로 인접
  quantifier 패턴을 감사했고, 8R 이 고친 두 인스턴스(START/END 각각의 검증-앞 gap) 외에 다른
  파일(`review_guard.py`, `guard_review_before_push.py`, `consistency_orchestrator.py`,
  `code_review_orchestrator.py`, `merge_coordinator_orchestrator.py`)의 `re.compile` 전체를
  확인한 결과 세 번째 미해결 인스턴스는 발견되지 않았다.
- `_glob_to_regex` 의 지수 백트래킹 상한(6)과 "초과 시 캐치올" 방향은 코드·테스트 모두 올바르다
  (`test_a_pathological_glob_compiles_to_something_that_matches_fast`,
  `test_over_the_cap_matches_everything_not_nothing`,
  `test_real_spec_globs_are_all_under_the_cap` 확인).
- `_evaluate_over_targets` 의 "차단 시에도 후속 target 의 note 는 살아남아야 한다" 회귀
  (`NotesFromLaterTargetsSurviveAnEarlierBlockTest`)는 실제 함수를 stub 결정 객체로 직접
  구동하며, 순서·차단 메시지·note 잔존을 모두 명확히 분리해 단언한다 — 잘 설계된 회귀 테스트.
  round 7 diff 와 대조해 정확히 이 수정("return 대신 blocked 저장 후 루프 완주")을 겨냥함을 확인.
- `collect_change_infos` 의 scope-flag-drops-files 경고(8R [W])는
  `ScopeFlagDiscardingFilesIsAnnouncedTest` 4개 테스트로 정확히 커버된다(branch/commit/range
  각각 + files 만 있을 때 침묵 + scope flag 만 있을 때 침묵) — 실제 코드 diff 와 1:1 대응 확인.
- `retry_state.py` 공유 추출 이후의 원자적 쓰기(`save_state`)는
  `test_a_failed_write_leaves_the_original_intact` 가 `json.dump` 를 mock 으로 실패시켜 "원본이
  보존되는가" 를 직접 검증 — 적절한 최소 mock 사용례.
- 하네스 테스트 스위트(`test_block_integrity.py` 단독 38개) 실행 결과 전부 PASS.

## 항목별 평가

1. **테스트 존재**: 매우 좋음 — 이번 변경(누적 8라운드)의 핵심 로직은 대부분 신규/갱신 테스트로
   덮여 있다.
2. **커버리지 갭**: 위 WARNING 2건(Gate 2 notes 실데이터 경로 미검증, 트레일링 gap 테스트의
   실질 무효) + INFO 2건(worktree stub notes 필드, glob 상한 경계값)이 실질 갭이다. 그 외에는
   작다.
3. **엣지 케이스**: 우수 — verdict anchor 4가지 실제 사례, 빈/손상 리포트, 누락 매니페스트,
   워크트리 삭제, glob 캐치올 방향 등 폭넓게 커버. 다만 glob 상한의 정확한 경계(6 vs 7)는
   비어 있다.
4. **Mock 적절성**: 대체로 적절(subprocess+실제 모듈 로드를 선호하고 mock 은 최소한으로만 사용).
   예외가 `SpecConsistencyGateTest` — Gate 2 임계값 로직을 격리하는 mock 자체는 타당하지만, 그
   결과로 "실 데이터가 notes 까지 도달하는가" 를 검증할 자리가 스위트 전체에서 비어 있다(위
   WARNING).
5. **테스트 격리**: 좋음 — temp dir + `addCleanup`, subprocess 테스트의 `CLAUDE_PROJECT_DIR`
   격리, `SuiteLeavesNoRealStateTest` 로 실제 저장소 오염 여부까지 스위트가 자체 감시한다.
6. **테스트 가독성**: 매우 우수 — 거의 모든 테스트 클래스/메서드에 "왜 이 테스트가 존재하는가"
   (과거 결함·실측치·재현 사례)가 docstring 으로 박혀 있다. 단 그 신뢰도 때문에
   `test_a_trailing_run_after_a_real_verdict_returns_fast` 의 docstring 이 실측과 다른 주장을
   하는 것이 오히려 더 위험하다(읽는 사람이 docstring 을 믿고 "트레일링 gap 은 테스트됨"으로
   넘어간다).
7. **회귀 테스트**: round 7/8 이 고친 결함들 중 대부분은 실측으로 vacuous 하지 않음을 확인했다.
   그러나 (a) 8R 자신의 testing 리뷰가 낸 WARNING(Gate 2 notes)이 이번 라운드까지 미처리 상태로
   남아 있고, (b) 8R 이 추가한 트레일링-gap 테스트 1건이 vacuous 하다 — "회귀 테스트가 실제로
   실패할 수 있는가" 를 매 라운드 재확인해야 한다는 이 리뷰 자체의 전제가 다시 한번 정당화됐다.
8. **테스트 용이성**: 좋음 — `evaluate_review(cwd=None, *, in_flight_ok=False)`,
   `_resolution_in_flight(now=None, marker_dir=None)` 등 의존성 주입 지점이 명확하고,
   `_accepts_cwd` 명시적 프로빙 등 테스트를 쉽게 만드는 설계가 두드러진다.

## 요약

코드 자체(정규식 이차 두 인스턴스, glob 지수 백트래킹, `--files` 침묵 폐기, advisory 순서
유실)는 이번 라운드까지 실측 기준으로 올바르게 닫혀 있고, 그 중 대부분은 vacuous 하지 않은
회귀 테스트로 뒷받침된다 — 별도 파일들에 대해 옛 패턴을 직접 복원해 재확인했다. 다만 두 가지가
남는다. 하나는 새로 발견한 것으로, 8R 이 추가한 세 번째 회귀 테스트
(`test_a_trailing_run_after_a_real_verdict_returns_fast`)가 자신이 겨냥한다고 주장하는 하위식을
실제로는 한 번도 실행시키지 못한다는 것을 직접 측정으로 확인했다(그 하위식 자체가 애초에 이차가
아니었다는 것도 함께 확인) — "이차를 고쳤다는 라운드의 회귀 테스트가 실은 그 코드에 도달하지
못한다"는 이 브랜치의 반복 패턴이 세 번째로 재현된 사례다. 다른 하나는 새 발견이 아니라 전달
실패다 — 8R 의 testing 리뷰가 mutation 으로 직접 검증까지 마친 WARNING(Gate 2 의 downgrade
`notes` 가 공개 진입점 `evaluate_review()` 를 통해 실제로 흘러나오는지 아무도 검증하지 않는다)이
그 라운드의 fix 커밋에도, 후속 plan 문서에도 반영되지 않은 채 이번 라운드까지 그대로 남아 있음을
재확인했다. 이 결함 클래스(advisory 조용한 유실)는 이 브랜치 전체의 존재 이유이므로, 그 방어의
가장 중심 진입점이 여전히 무방비라는 사실은 낮은 비용으로 닫을 수 있음에도 두 라운드째 이월되고
있다는 점에서 눈여겨볼 가치가 있다.

## 위험도

MEDIUM — 활성 코드 결함은 없음(모든 핵심 주장을 직접 실행/측정으로 확인). 그러나 (1) 이 PR 이
막으려는 바로 그 결함 클래스("advisory 가 조용히 유실된다")가 가장 중심적인 공개 진입점에서 여전히
테스트 사각지대이고 이미 한 라운드 전에 지적됐음에도 처리되지 않았다는 점, (2) 새로 발견한 vacuous
회귀 테스트가 이 브랜치 특유의 반복 패턴("고쳤다는 라운드의 테스트가 실은 그 코드에 안 닿는다")의
세 번째 사례라는 점을 고려해 LOW 가 아닌 MEDIUM 으로 판단한다.
