# 유지보수성(Maintainability) 리뷰

## 개요

이 diff 는 `guard_default_branch_bash.py` 의 `_is_mutating` 분류기에 세그먼트 분할(`&&`/`||`/`;`/`|`/`&`/개행) +
`VAR=value` env 접두(따옴표 포함) 인식을 추가하고, `guard_review_before_push.py` 에는 이미 알려진 별건 결함(§J)을
가리키는 교차 참조 주석만 추가(코드 로직 변경 없음)했다. 나머지는 문서(`worktree-policy.md`, `.claude/tests/README.md`),
plan(`harness-guard-followups.md`, `harness-push-guard-subcommand-detection.md`) 갱신과, 이전 두 리뷰 라운드
(`20_02_29`, `20_33_56`)의 산출물(SUMMARY/RESOLUTION/개별 reviewer 리포트) 커밋이다.

이미 2라운드에 걸쳐 리뷰·수정된 이력이 있어(§J 주석 위치 오류, 정책 문서 구분자 누락, `test_line_anchors.py` 의
HEAD 크기 결속 등은 모두 `20_33_56/RESOLUTION.md` 에서 해소됨), 현재 최종 상태를 직접 열어 재확인한 결과
과거 발견사항은 실제로 반영되어 있다. 아래는 그 최종 상태 기준 새로 관찰된 사항이다.

## 발견사항

- **[INFO]** `_MUTATING` 정규식 정의 앞의 주석 블록이 코드 대비 매우 길다(설계 근거·측정치·타 훅과의 교차 참조가
  약 30줄, 정규식 정의 자체는 약 20줄).
  - 위치: `.claude/hooks/guard_default_branch_bash.py:69-98` (주석), `:99-120` (`_MUTATING` 정의)
  - 상세: 이 저장소는 "미측정 단정 금지 + 근거를 코드 옆에 남긴다"는 컨벤션을 명시적으로 채택하고 있고
    (`plan/in-progress/harness-guard-followups.md` §C 결론, 타 훅 주석 스타일과 동일), 이번 diff 의 주석도
    같은 패턴을 따른다. 결함은 아니며 하우스 스타일과 일관되지만, 정규식 자체의 의도(무엇을 매치하는지)를
    빠르게 파악하려는 신규 독자에게는 코드보다 주석을 더 오래 읽어야 하는 진입 비용이 있다.
  - 제안: 조치 불필요. 향후 이 파일에 세 번째 유사 주석 블록이 붙을 경우, "왜"는 계속 인라인에 두되
    "무엇을 매치하는가" 요약 한 줄을 정규식 직전 첫 줄에 두는 관례를 고려.

- **[INFO]** `_is_mutating` 의 새 구현이 세그먼트 수만큼 `_MUTATING.search` 를 반복 호출하는 `any()` 제너레이터로
  바뀌면서, 함수 자체의 가독성은 여전히 좋으나(3줄), 판정 로직이 "전체 명령 1회 매치"에서 "세그먼트별 반복 매치"로
  바뀐 사실이 함수 이름(`_is_mutating`)만으로는 드러나지 않는다.
  - 위치: `.claude/hooks/guard_default_branch_bash.py:152-157`
  - 상세: 호출부(`main()`)나 테스트 관점에서는 동작이 boolean 이라 문제 없지만, docstring 없이 3줄로 끝나는
    함수라 "왜 세그먼트별인지"는 위쪽 `_SEGMENT_SPLIT` 주석(133-148행)까지 거슬러 올라가야 알 수 있다.
  - 제안: 조치 불필요(경미). 필요하면 함수에 한 줄 docstring("체인의 각 세그먼트를 독립적으로 검사한다")을
    추가해 국소적으로도 의도가 드러나게 할 수 있음.

- **[INFO]** `test_guard_default_branch_bash_mutating.py::BacktrackingTest._PROBE` 가 subprocess 로 실행할
  Python 코드를 삼중따옴표 문자열 상수로 인라인하고 있어, 문법 오류가 있어도 정적 검사(linter/IDE)로는 잡히지
  않고 실제 subprocess 실행 시점에야 드러난다.
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:218-232`
  - 상세: ReDoS 회귀를 신호 안전하게(시그널이 C-level `re` 를 못 끊음) 검증하려면 별도 프로세스가 필요하다는
    설계 근거 자체는 타당하고, 이 패턴은 push 가드 계열 테스트에서도 이미 쓰이는 것으로 보이는 기존 관례다.
    새로운 문제는 아니며 이 diff 가 처음 도입한 패턴도 아니다.
  - 제안: 조치 불필요(기존 관례 준수). 향후 여러 훅에서 이 패턴이 반복되면 공통 헬퍼(`_run_redos_probe(code, module_path)`)로
    추출을 고려할 수 있으나, 지금은 파일당 1곳뿐이라 추출 이득이 낮음.

- **[INFO]** `test_line_anchors.py::_pick_commit_fixture` 가 도입한 `_MIN_FIXTURE_CHANGED_LINES = 80` /
  `_FIXTURE_SEARCH_DEPTH = 40` 는 매직 넘버가 아니라 이름 붙은 클래스 상수이고, 값의 근거(`assertGreater(checked, 20)`
  대비 "comfortably above")도 docstring 에 명시돼 있어 모범적이다. 결함 아님, 참고로 기록.
  - 위치: `.claude/tests/test_line_anchors.py:328,330`

## 재확인: 이전 라운드에서 지적됐던 항목은 실제로 해소됨

- §J 교차 참조 주석 — 이전 라운드는 `_SEGMENT_IS_GIT` 옆(엉뚱한 위치)에 있었다고 지적했으나, 현재 상태는
  실제 결함 지점인 `_GIT_PUSH` 정의 직전(`guard_review_before_push.py:97-106`)에 위치하고, `_SEGMENT_SPLIT`
  옆에는 "§J 결함은 위 `_GIT_PUSH` 에 있다, 여기 아니다"(`:153-156`)라는 짧은 역참조만 남아 중복이 최소화됨.
- `worktree-policy.md:73` 구분자 서술 — 코드·테스트가 6종(`&&`/`||`/`;`/`|`/`&`/개행)인데 문서만 5종이던 SPEC-DRIFT 는
  해소되어 `&` 와 따옴표 값 인식 모두 반영됨.
- `test_line_anchors.py::_prepare_commit` 의 HEAD 커밋 크기 결속 — `_pick_commit_fixture` 로 대체되어
  최근 40커밋 중 변경 라인 ≥80 인 첫 커밋을 고르도록 바뀜. 회귀 재현 가능성이 낮아짐.
- 두 파일이 동일 심볼명 `_SEGMENT_SPLIT` 을 다른 의미로 재사용하는 것은 이전 라운드에서 INFO 로 지적된 뒤
  "개명은 순수 churn" 이라는 사유로 의도적으로 채택하지 않기로 결정됨(RESOLUTION 기록 확인) — 재지적하지 않음.

## 요약

핵심 로직 변경은 `_is_mutating` 하나의 짧고 읽기 쉬운 함수(세그먼트 분할 + 세그먼트별 재사용 가능한 정규식 매치)로
좁게 국한되어 있고, 새 정규식·분할 상수는 모두 이름이 있으며 각 설계 결정(왜 이렇게 분할하는지, 왜 두 개의 알려진
오탐 클래스를 수용하는지, 왜 push 가드와 코드를 공유하지 않기로 했는지)이 주석·plan·테스트 docstring 3중으로 근거와
함께 기록되어 있다. 신규 테스트(`test_guard_default_branch_bash_mutating.py`)는 관심사별로 잘 분리된 7개 테스트
클래스로 구성되어 가독성이 높고, 과거 두 리뷰 라운드가 잡아낸 유지보수성 결함(주석 위치 오류, 정책 문서 drift,
HEAD 크기에 결속된 취약한 fixture)은 모두 최종 상태에서 실제로 해소된 것을 직접 확인했다. 남은 관찰사항은 모두
경미한 INFO 수준(주석 대 코드 비율이 높음, 소규모 함수 docstring 부재, subprocess 문자열 프로브의 정적 검사 사각)이며
새로운 WARNING/CRITICAL 급 유지보수성 결함은 발견되지 않았다.

## 위험도

LOW
