# 유지보수성(Maintainability) 리뷰

대상: `.claude/hooks/guard_default_branch_bash.py`, `.claude/hooks/guard_review_before_push.py`,
`.claude/tests/_harness.py`, `.claude/tests/test_guard_default_branch_bash_mutating.py`,
`.claude/tests/test_push_guard_allowlist.py`, `.claude/tests/README.md`,
`plan/in-progress/harness-guard-followups.md`, `review/code/2026/07/24/01_25_14/*`(신규 산출물, 코드 아님)

이 diff 는 두 커밋(`11a94fe9b` §J-후속 FN 해소, `6e1723985` 그 리뷰의 W1~W4 반영)을 합친 것이다.
직전 라운드(01_25_14) 리뷰가 지적한 WARNING 4건을 실제 코드에서 대조 확인했다.

## 이전 WARNING 반영 확인 (참고용 — 새 발견 아님)

- **W1** `guard_default_branch_bash.py:33-37` 모듈 docstring — "unclosed quote 는 이제 매치되고
  (`\S+` 폴백), empty value 만 unmatched" 로 정정됨. 자기모순 해소 확인.
- **W2** `test_push_guard_allowlist.py` 의 "§K" 오기 — `GeneratedFloorTest._VALUES` 리터럴 자체가
  `_harness.ENV_VALUE_SHAPES` 참조로 교체되며 문제의 주석이 사라짐(§L 로 올바르게 지칭하는 주석만
  `test_push_guard_allowlist.py:371`, `_harness.py:66-68` 에 남음). "§K" 잔존 없음을 grep 확인.
- **W3** `_VALUES` 리터럴 중복 — `_harness.py:62-70` 의 `ENV_VALUE_SHAPES` 로 단일화되고
  `test_guard_default_branch_bash_mutating.py:235`, `test_push_guard_allowlist.py:338` 양쪽이 이를
  참조. 실제 드리프트(§L 9건 추가가 한쪽에만 반영됐던 상태) 해소 확인.
- **W4** `test_no_duplicate_values`/`_MIN_COVERAGE` 비대칭 — `OldEnvPrefixSupersetTest` 에도
  `test_no_duplicate_values`(`test_guard_default_branch_bash_mutating.py:258-263`)와
  `_MIN_COVERAGE = 10`(같은 파일 239행)이 대칭 추가됨. 확인.

## 발견사항

- **[INFO]** 두 파일에 걸쳐 `test_no_duplicate_values` 로직이 문자 그대로에 가깝게 중복
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:258-263`
    (`OldEnvPrefixSupersetTest.test_no_duplicate_values`) vs
    `.claude/tests/test_push_guard_allowlist.py:352-356`
    (`GeneratedFloorTest.test_no_duplicate_values`)
  - 상세: W3 로 `_VALUES`(양쪽 다 `_harness.ENV_VALUE_SHAPES` 를 가리킴)가 이미 단일 소스로
    통합됐음에도, "그 리스트에 중복이 없는가" 를 검증하는 로직은 `values.count(v) > 1` 패턴 그대로
    두 파일에 복제돼 있다(한쪽은 `list(self._VALUES)` 로 먼저 복사, 다른 쪽은 `self._VALUES` 를
    바로 순회하는 사소한 차이만 있음). 동일한 하나의 튜플에 대한 동일한 불변식을 두 곳에서
    독립적으로 재검증하는 셈이라 드리프트 위험은 낮지만(같은 데이터 소스를 보므로 결과가 갈릴 수
    없음), 로직 자체는 `_harness.py` 에 헬퍼 하나로 옮기고 양쪽 테스트가 호출하는 편이 "데이터는
    이미 단일화했는데 그 데이터에 대한 불변식 검사는 아직 안 했다"는 상태를 완전히 정리한다.
  - 제안: (선택) `_harness.py` 에 `assert_no_duplicate_values(values)` 류 헬퍼를 추가하거나, 두
    `test_no_duplicate_values` 를 그대로 유지하되 최소한 동일한 표현식으로 통일. 낮은 우선순위 —
    현재도 실제 커버리지 손실은 없음.

- **[INFO]** 동일 목적의 비-vacuity 하한 상수가 파일마다 다른 이름·스코프로 존재
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:239`
    (`OldEnvPrefixSupersetTest._MIN_COVERAGE`, 클래스 속성) vs
    `.claude/tests/test_push_guard_allowlist.py:66` (`_MIN_CORPUS_COVERAGE`, 모듈 상수)
  - 상세: 두 상수 모두 값이 10 이고 "생성 케이스 중 실제로 floor/prefix 에 걸리는 개수가 이 값보다
    많아야 비교가 vacuous 하지 않다" 는 동일한 역할을 한다. `_harness.ENV_VALUE_SHAPES` 공유,
    docstring 상호 참조("Shared with the nudge hook's ...") 등 이 diff 는 두 테스트 스위트를
    의도적으로 나란히 대칭 유지하려는 노력을 보이는데, 이 상수만 이름(`_MIN_COVERAGE` vs
    `_MIN_CORPUS_COVERAGE`)과 스코프(클래스 속성 vs 모듈 레벨)가 서로 달라 그 대칭성에서 벗어나
    있다. 기능에는 영향 없음.
  - 제안: (선택) 이름을 통일하거나(예: 둘 다 `_MIN_GENERATED_COVERAGE`), 최소한 한쪽 주석에 "다른
    파일의 `_MIN_CORPUS_COVERAGE`/`_MIN_COVERAGE` 와 동일한 역할" 이라는 상호 참조를 추가.

- **[INFO]** 공유 코퍼스에 대한 "회귀 형태 보존" 가드가 한쪽 파일에만 존재 — 정책 자체는
  타당하나 대칭성 기준이 불명확
  - 위치: `.claude/tests/test_push_guard_allowlist.py:358-375`
    (`GeneratedFloorTest.test_the_regression_shapes_are_still_generated`, 존재) vs
    `.claude/tests/test_guard_default_branch_bash_mutating.py` 의 `OldEnvPrefixSupersetTest`
    (대응 테스트 없음)
  - 상세: 이 테스트는 `_harness.ENV_VALUE_SHAPES`(두 파일이 공유하는 바로 그 리스트)에서 실제
    회귀를 유발했던 5개 형태가 삭제되지 않았는지를 지킨다. 검증 대상이 두 파일이 공유하는
    **하나의** 리스트이므로 어느 한쪽에만 있어도 그 리스트가 훼손되면 CI 전체가 잡아낸다는 점에서
    기능적 결함은 아니다. 다만 바로 위 항목의 `test_no_duplicate_values` 는 "공유 데이터에 대한
    불변식이라도 양쪽 파일에 대칭으로 복제한다" 는 정책(W4 가 실제로 요구한 것)을 따랐는데, 이
    테스트는 같은 성격(공유 데이터에 대한 불변식)임에도 복제되지 않았다 — 어떤 공유-데이터 불변식은
    대칭 복제 대상이고 어떤 것은 아닌지 기준이 diff 안에서 드러나지 않아, 다음에 셋째 불변식을
    추가할 사람이 어느 쪽 선례를 따라야 할지 판단하기 어렵다.
  - 제안: 조치 불요(현재 커버리지 갭 없음). 다만 `_harness.py` 의 `ENV_VALUE_SHAPES` 주석에
    "이 리스트에 대한 불변식 테스트는 한쪽 파일에만 둔다(중복 불필요), 단 `_VALUES` 자체의
    존재/중복 여부처럼 리스트-사용 방식에 의존하는 검사는 양쪽에 둔다" 같은 한 줄 원칙을 남기면
    향후 판단 비용이 줄어든다.

## 그 외 확인 (문제 없음)

- 두 훅의 정규식 변경은 대안 하나(`[^\s'"]\S*` → `\S+`)만 넓힌 최소 변경으로, 함수 길이·중첩·
  가독성에 영향 없음. 함수 시그니처·모듈 구조 불변.
- `guard_default_branch_bash.py:69-108`, `guard_review_before_push.py:82-117` 의 정규식 옆 주석
  블록이 이번에도 늘었으나(이전 라운드 INFO 로 이미 언급), 전부 이번 회귀의 원인·근거를 설명하는
  실질 내용이고 이 저장소가 채택한 기존 컨벤션과 일치한다 — 반복 지적하지 않음.
- `OldEnvPrefixSupersetTest._pre_quoted_is_mutating` 이 라이브 정규식 문자열을 마커로 스플라이스하는
  방식(`test_guard_default_branch_bash_mutating.py:241-247`)은 이전 라운드에서 이미 INFO 로
  짚었고 자체 가드(`test_the_frozen_prefix_still_composes`)로 완화돼 있어 이번에 재론하지 않음 —
  이번 diff 에서 변경되지 않음.
- `review/code/2026/07/24/01_25_14/*.md`·`meta.json`·`_retry_state.json` 은 이전 라운드 리뷰
  산출물을 그대로 커밋한 것으로, 리포지토리 컨벤션(리뷰 산출물은 `review/**` 에 보관)에 부합하며
  코드로서 유지보수성 관점의 검토 대상이 아니다(정적 스냅샷 텍스트).

## 요약

이번 diff 는 직전 라운드(01_25_14)가 발견한 유지보수성 WARNING 4건(§K/§L 백로그 레터 혼용,
`_VALUES` 코퍼스 중복·드리프트, `test_no_duplicate_values` 비대칭)을 실제로 전부 해소했다 —
`_harness.ENV_VALUE_SHAPES` 단일화, docstring 자기모순 정정, 대칭 안전장치 추가를 코드에서 직접
대조 확인했다. 새로 도입된 결함은 없다. 다만 코퍼스를 단일화한 이후에도 그 코퍼스에 대한
불변식 검사 로직 자체(`test_no_duplicate_values`)는 여전히 두 파일에 거의 그대로 복제돼 있고,
비슷한 역할의 상수(`_MIN_COVERAGE`/`_MIN_CORPUS_COVERAGE`)가 서로 다른 이름·스코프를 쓰며, "공유
데이터에 대한 불변식을 어디까지 대칭 복제할 것인가"에 대한 명시적 기준이 diff 안에 없다 — 모두
기능적 결함이 아니라 다음 유지보수자가 판단 비용을 줄일 수 있는 선택적 정리 여지다. 프로덕션
가드 로직(정규식 변경 자체)의 가독성·네이밍·함수 길이·중첩·복잡도는 기존 컨벤션과 일관되게 양호하다.

## 위험도

LOW
