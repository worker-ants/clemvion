# 테스트(Testing) 리뷰

## 리뷰 대상
- `.claude/hooks/guard_default_branch_bash.py` (`_MUTATING` env-prefix 마지막 대안 `[^\s'"]\S*` → `\S+`)
- `.claude/hooks/guard_review_before_push.py` (`_GIT_PUSH` 동일 변경)
- `.claude/tests/test_guard_default_branch_bash_mutating.py` (`OldEnvPrefixSupersetTest` 신설 + 기존 회귀 테스트 뒤집기)
- `.claude/tests/test_push_guard_allowlist.py` (`_BLIND_PATTERN` 미러 + `GeneratedFloorTest`/`KnownFalseNegativeTest` 신설)
- `plan/in-progress/harness-guard-followups.md` (J-후속/L 항목 등재, 문서 변경)

로컬 실행 확인:
```
python3 -m pytest test_push_guard_allowlist.py test_guard_default_branch_bash_mutating.py -q
→ 69 passed, 214 subtests passed (3회 반복 실행, 0.38~0.40s, 결정적)
python3 -m pytest test_tests_readme_catalog.py -q
→ 5 passed (카탈로그 drift 없음)
```
`.github/workflows/harness-checks.yml` 의 `paths:` 에 `.claude/hooks/**`·`.claude/tests/**` 가 모두 포함되어 있어 이 변경은 CI 에서 실제로 트리거된다 (하네스 가드/테스트 관련 과거 실패 클래스 — "가드는 고쳤는데 CI paths 에 없어서 안 돔" — 여기서는 해당 없음).

## 발견사항

- **[INFO]** 넛지 훅 쪽 superset 테스트에 push 가드와 동등한 "비-vacuity 바닥" 단언이 없음
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py` `OldEnvPrefixSupersetTest.test_no_classification_is_lost` (라인 255-261), 대조군 `test_the_generated_set_actually_exercises_the_floor`(같은 파일 `test_push_guard_allowlist.py` `GeneratedFloorTest`, 라인 373-377)
  - 상세: push 가드 쪽 `GeneratedFloorTest` 는 "floor matched almost nothing" 을 막기 위해 `compared > _MIN_CORPUS_COVERAGE` 로 생성 케이스가 실제로 legacy 패턴에 걸리는 개수를 별도로 단언한다. 반면 넛지 훅의 `OldEnvPrefixSupersetTest` 는 `test_the_frozen_prefix_still_composes` 에서 단일 케이스(`"A=x mkdir foo"`)만 스모크 체크하고, `test_no_classification_is_lost` 자체는 몇 건이 `_pre_quoted_is_mutating(c)==True` 로 참여하는지 세지 않는다. 직접 계산해보면 현재는 84건 중 68건이 참여해 실질적으로는 vacuous 하지 않지만, 향후 `_PRE_QUOTED_PREFIX`/`_SPLIT_MARKER` 추출 로직이 리팩터링돼 매칭 건수가 우연히 크게 줄어도 이 테스트는 계속 그린으로 남는다.
  - 제안: `GeneratedFloorTest.test_the_generated_set_actually_exercises_the_floor` 와 동일한 패턴으로 `sum(1 for c in self._cases() if self._pre_quoted_is_mutating(c))` 에 대한 하한 단언을 추가해 두 파일의 방어 수준을 동일하게 맞추면 좋다.

- **[INFO]** `BacktrackingTest`(넛지 훅)가 자신이 증명하지 못하는 것을 문서 안에서 정직하게 선언
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py` `BacktrackingTest` 클래스 docstring (라인 269-290)
  - 상세: "이 테스트는 env-value 대안이 서로 겹치지 않는다는 것의 대리 증거가 아니며, 모호성을 되살리는 뮤턴트도 이 테스트를 통과한다"고 명시. 실제 코드 결함은 아니고, 오히려 과잉 주장을 피한 좋은 테스트 문서화 관행이지만, 겹치는(overlapping) 대안으로의 회귀는 이 파일의 어떤 테스트로도 잡히지 않는다는 잔여 커버리지 갭이 실존한다는 점은 리뷰 기록으로 남겨둔다. push 가드 쪽은 이미 `BacktrackingTest.test_env_prefix_alternation_stays_linear` 주석에서 동일한 한계를 서술하고 있어 대칭적이며, 새로 도입된 결함은 아니다.
  - 제안: 조치 불요(설계상 인지된 트레이드오프). 추후 disjoint 여부 자체를 지키고 싶다면 정적 assert(예: 두 대안이 같은 첫 글자 클래스를 공유하지 않는지) 를 별도 테스트로 추가하는 방안을 backlog 후보로만 남겨도 됨.

- **[INFO]** §L(닫는 따옴표에 문자가 붙는 케이스) 은 의도적으로 미해결 상태로 캐너리 고정됨 — 정상
  - 위치: `.claude/tests/test_push_guard_allowlist.py` `KnownFalseNegativeTest`(라인 877-913), `plan/in-progress/harness-guard-followups.md` `## L.` 섹션
  - 상세: `test_quoted_value_glued_to_more_text_hides_a_push` 는 현재 버그 동작(`assertFalse`)을 고정하고 docstring 에 "§L 이 고쳐지면 이 클래스를 뒤집어라" 라고 명시. `test_the_gap_predates_the_j_fix` 로 이번 §J-후속 변경이 원인이 아님도 함께 pin. §J 캐너리가 실제로 이 프로젝트에서 작동한 전례를 그대로 재사용한 좋은 패턴이며, "자연스러운 수정형은 파국적 백트래킹 형태이므로 측정 선행 필수" 라는 경고도 plan 체크리스트에 남아 있다. 회귀 위험 없음 — 정보성 확인.

- **[INFO]** 회귀 테스트 뒤집기(`test_malformed_env_values_stay_unmatched` → `test_unterminated_quote_still_matches`)가 이전 테스트의 오판을 스스로 지적하며 교정
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py` 라인 177-200 (신규), `OldEnvPrefixSupersetTest` (라인 211-267)
  - 상세: 이전 리비전이 "새 패턴이 무엇을 놓쳤는지"만 보고 그 손실을 "의도된 갭"으로 잘못 pin했던 사례를, 이번 diff 가 "옛 패턴이 무엇을 분류했는지" 와 기계적으로 비교하는 `OldEnvPrefixSupersetTest` 로 교체해 재발을 막는 구조. 회귀 테스트가 실제로 유효한지 재확인한 결과 — 로컬 실행에서 전부 통과, 의도대로 동작.

## Mock/격리/가독성 평가

- Mock/stub 사용 없음 (순수 정규식·함수 테스트). 실제 동작과의 괴리 우려 없음.
- 모든 신규 테스트가 순수 함수 호출 기반이거나(`_is_mutating`, `_is_git_push`), 서브프로세스+timeout 격리(`BacktrackingTest`)로 실행돼 테스트 간 공유 상태·순서 의존성이 없음. 파일 I/O 도 없어 병렬 실행/반복 실행 시에도 결정적임(3회 재실행 확인, 시간 편차 없음).
- 가독성: 각 테스트 클래스 docstring 이 "왜 이 축으로 생성했는지", "이전에 무엇이 잘못됐는지"를 구체적 커밋/리뷰 라운드까지 인용하며 서술 — 이 리포지토리의 기존 컨벤션과 일치하고, 향후 유지보수자가 맥락을 재유도할 필요가 없을 정도로 상세함.
- `EnvValueSubpatternSharedTest`(기존 테스트, 이번 diff로 대상 문자열만 변경) 가 두 훅의 env-value 서브패턴이 byte-identical 한지 계속 검증하므로, 이번처럼 3곳(두 훅 + 테스트 미러) 을 동시에 고쳐야 하는 변경에서 미러 누락을 자동으로 잡아준다 — 실제로 3곳 모두 `\S+` 로 일관되게 반영됐음을 grep 으로 확인.

## 요약

이번 변경은 §J 수정이 재도입한 FN(28건)을 해소하면서, 그 원인이었던 "curated 코퍼스만 순회하는 회귀 테스트의 구조적 맹점"을 `GeneratedFloorTest`/`OldEnvPrefixSupersetTest` 라는 축-생성 기반 비-vacuity 테스트로 근본적으로 보강했다. 두 훅과 테스트 미러(3곳)가 정확히 동기화됐고, 기존 `EnvValueSubpatternSharedTest` 가 향후 드리프트를 자동 검출하며, 새로 발견된 선재 갭(§L)은 무리하게 지금 고치지 않고 백트래킹 위험을 사전에 측정 요구사항으로 못박은 채 캐너리로만 고정해 안전하게 defer 했다. 로컬 재현 결과 69개 테스트·214개 subtest 전부 결정적으로 통과하며 CI paths 트리거도 정상 포함돼 있다. 발견된 사항은 모두 INFO 등급으로, 넛지 훅 쪽 superset 테스트에 push 가드와 대칭적인 명시적 커버리지 하한 단언이 빠져 있다는 점 정도가 유일한 개선 여지이며 현재 동작에는 영향이 없다.

## 위험도
LOW
