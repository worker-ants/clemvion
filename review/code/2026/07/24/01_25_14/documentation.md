# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 모듈 docstring 이 이번 diff 가 고친 바로 그 동작을 여전히 옛 상태로 서술 (오래된 주석)
  - 위치: `.claude/hooks/guard_default_branch_bash.py:33-36`
  - 상세: 파일 최상단 docstring 은 "Two env-value forms stay unmatched — an empty value
    (`VAR= git commit`) and an unclosed quote — both pinned there too; neither is a valid
    command shape worth widening the pattern for." 라고 말한다. 그러나 이번 diff 가 정확히
    이 "unclosed quote" 케이스를 고쳤다 — `test_unterminated_quote_still_matches`
    (`.claude/tests/test_guard_default_branch_bash_mutating.py:182-200`) 는 `"A='x mkdir foo"`,
    `'A="unclosed git commit -m x'`, `"A=' git commit -m x"` 모두 이제 **`assertTrue`**
    (매치됨) 로 단언한다. 즉 "unclosed quote" 는 더 이상 "stay unmatched" 가 아니다 — empty
    value (`VAR= git commit`) 절만 여전히 참이다(`test_empty_env_value_stays_unmatched`).
    이 diff 는 정규식 바로 위 인라인 주석(83-100행)은 매우 상세히 갱신했지만, 파일 최상단
    모듈 docstring 은 그대로 두어 서로 모순된 상태로 남았다.
  - 제안: docstring 33-36행에서 "unclosed quote" 문구를 제거하거나, "이제 매치되며(J-후속
    폴백 추가), empty value 만 여전히 unmatched" 로 갱신한다.

- **[WARNING]** 같은 파일 안에서 백로그 항목 참조가 자기모순 (§K ↔ §L 오기재)
  - 위치: `.claude/tests/test_push_guard_allowlist.py:340-341`
  - 상세: `GeneratedFloorTest._VALUES` 주석은 "Quoted piece glued to an unquoted one — §K,
    still undetected by both patterns. Present so a future §K fix is measured on the same
    axes." 라고 §K 를 지목한다. 그러나 같은 파일의 `KnownFalseNegativeTest`
    (`.claude/tests/test_push_guard_allowlist.py:877-913`) 는 정확히 같은 결함(`A="a b"c git
    push` 형태 — 따옴표 뒤에 다른 문자가 붙어 미탐지)을 4곳(878/889/890/907행)에서 명시적으로
    **"§L"** 이라고 부른다. `plan/in-progress/harness-guard-followups.md` 의 `## L.` 섹션
    (495-511행, "env 값의 닫는 따옴표에 다른 문자가 붙으면 여전히 미탐지")도 동일 결함을 §L 로
    등록했다. §K 는 전혀 다른 항목("게이트 실행 제어 흐름이 훅 2개 × 게이트 2개 = 4중 복제",
    plan 514-528행)을 가리킨다. 즉 340-341행의 "§K" 는 오기 — 같은 파일 안에서도 서로 다른
    두 글자로 같은 결함을 부르는 상태다. 미래에 이 주석만 보고 "§K" 를 추적하면 완전히 무관한
    백로그 항목에 도달한다.
  - 제안: 340-341행의 두 "§K" 를 "§L" 로 정정.

- **[INFO]** plan 체크리스트 수치가 실제 미러 개수와 어긋날 가능성
  - 위치: `plan/in-progress/harness-guard-followups.md:486`
  - 상세: "두 훅 + 미러 3곳의 env 값에 후행 `\S+` 폴백 추가" 라고 적혀 있으나, 실제로 이 폴백이
    적용된 코드 위치는 grep 기준 3곳뿐이다 — `guard_default_branch_bash._MUTATING`,
    `guard_review_before_push._GIT_PUSH`, 그리고 `test_push_guard_allowlist.py` 의
    `_BLIND_PATTERN` 미러 1개. 같은 파일의 `EnvValueSubpatternSharedTest` 자신의 docstring
    도 "The env-value alternation is copied into three places" 라고 (두 훅 + 미러 1곳 =
    총 3곳) 정확히 서술한다. "두 훅 + 미러 **3**곳" 이라는 표현은 "총 3곳"(두 훅+미러 1곳)을
    의도했다면 문구가 어긋나 5곳으로 오독될 수 있다. `test_guard_default_branch_bash_mutating.py`
    쪽 `_PRE_QUOTED_PREFIX` 는 의도적으로 옛(비-따옴표) 형태로 동결돼 있어 폴백 대상이 아니다.
  - 제안: "미러 1곳" 또는 "총 3곳(훅 2 + 미러 1)" 으로 정정해 향후 독자의 혼동을 줄인다.
    (낮은 확신 — 표현의 의도가 "총 3곳" 이었을 수 있음.)

- **[INFO]** `.claude/tests/README.md` 카탈로그 서술이 이번 diff 의 신규 테스트 클래스를 반영 안 함
  - 위치: `.claude/tests/README.md:46` (`test_guard_default_branch_bash_mutating.py` 행),
    `.claude/tests/README.md:47` (`test_push_guard_allowlist.py` 행)
  - 상세: 두 행 모두 §J 시점까지의 내용(예: 47행은 `_LEGACY_PATTERN`/`_BLIND_PATTERN` 분리를
    언급)은 서술하지만, 이번 diff 가 추가한 `OldEnvPrefixSupersetTest`(넛지 훅, 46행 대상)와
    `GeneratedFloorTest`·`KnownFalseNegativeTest`(§L, 47행 대상), 그리고 J-후속 회귀 자체는
    언급이 없다. 이 파일은 `test_tests_readme_catalog.py` 가드로 "파일명 등재 여부"만 검사하므로
    가드 자체는 통과하지만, 같은 PR 계열의 다른 행(예: 45행 §E 서술)은 주요 로직 변경 시마다
    내용을 갱신해 온 선례가 있어 이번 두 행만 뒤처진 상태다.
  - 제안: 필수는 아니나, 46-47행에 J-후속 회귀(폴백 누락)·§L 캐너리·생성 기반 플로어 테스트
    한 문장씩 추가하면 카탈로그의 "무엇을 지키는지" 설명력이 회복된다.

## 요약

이번 diff 는 정규식 하나의 회귀(폴백 `\S+` 누락)를 고치면서 인라인 주석·plan 문서를 이례적으로
공들여 갱신했고, 그 노력 대부분은 정확하다(§J/J-후속 수치, `SoR` 경로를 `plan/complete/` 로
정정한 것 등은 실제 파일 위치와 대조해 확인함). 다만 그 공들인 갱신 범위가 **정규식 바로 옆
주석**에는 미쳤지만 **파일 최상단 모듈 docstring**까지는 닿지 못해, 이번 diff 가 고친 동작을
정확히 반박하는 오래된 문장이 하나 남았다(§ guard_default_branch_bash.py:33-36). 또한 새로
추가된 테스트 파일 내부에서 동일한 결함을 가리키는 백로그 레터가 §K/§L 로 갈라져 자기모순을
일으킨다. 두 건 모두 기능에는 영향이 없고(넛지 훅은 애초에 차단하지 않음, 테스트 자체는
정확히 동작함) 순수하게 주석/문서 정확성 문제이지만, 이 저장소가 comment accuracy 에 두는
비중을 감안하면 방치 시 향후 리더를 오도할 수 있다. plan 체크리스트의 "미러 3곳" 수치와
`.claude/tests/README.md` 카탈로그 서술의 최신화 누락은 부차적이고 낮은 우선순위다.

## 위험도

MEDIUM
