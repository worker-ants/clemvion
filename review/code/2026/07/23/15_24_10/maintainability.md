# 유지보수성(Maintainability) 리뷰 — push guard blind+allowlist 재설계 (3회차, 2라운드 성능 수정)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`,
`.claude/tests/test_guard_review_before_push_main.py` (+ `plan/in-progress/harness-guard-followups.md`,
`plan/in-progress/harness-push-guard-subcommand-detection.md`)

`review/code/2026/07/23/{14_23_23,14_57_32}/*` 는 이전 리뷰 라운드의 산출물(리포트/상태
데이터)이라 이번에도 8개 관점 대상에서 제외한다.

이번 diff(commit `cef183faf`)는 직전 라운드(`14_57_32`)에서 지적된 Warning 4건 — (W1) CRITICAL
수정 자체가 새로 연 `_COMMIT_STDIN_CMD` 의 O(n²) 백트래킹, (W2) `_blank()` 반복 호출로 인한
O(n·k) 문자열 복사, (W3) 이웃 테스트 docstring drift, (W4) plan 체크리스트 수치 drift — 를 전부
수정한 결과물이다. 4건 모두 실제로 반영됐음을 코드로 확인했다: `_COMMIT_STDIN_CMD` 는
`_SEGMENT_IS_GIT`/`_COMMIT_OR_TAG`/`_STDIN_FILE_FLAG` 3개의 겹치지 않는 단일 패스 probe 로
분리됐고, `_blank()`(즉시 복사)는 `_blank_spans()`(정렬 후 단일 재조립)로 교체됐으며,
`test_guard_review_before_push_main.py` 의 docstring 과 plan 체크리스트도 갱신됐다. 옛 이름
(`_COMMIT_STDIN_CMD`, `_blank_commit_heredocs`, `_blank`)에 대한 잔존 참조가 소스 코드에
없음을 grep 으로 확인했다.

## 발견사항

- **[INFO]** `guard_review_before_push.py` 안에 여전히 1줄 공백만 있는 top-level 경계가 하나 남아 있음(전회 라운드에서 이미 지적, 이번에도 미수정 확인)
  - 위치: `.claude/hooks/guard_review_before_push.py:129-131` (`_owns_heredoc_as_message` 함수 종료 ~ `_MESSAGE_ARG` 주석 시작 사이 공백 줄이 1개)
  - 상세: 파일의 나머지 top-level 경계는 모두 2줄 공백(PEP8 관례)을 따른다 — 예를 들어 바로 위
    `_SEGMENT_SPLIT` 정의와 `def _owns_heredoc_as_message` 사이는 2줄(L113-116), 파일 끝
    `_commit_heredoc_spans` 와 `def _read_payload` 사이도 이번 라운드에서 2줄로 정리됐다(전전
    라운드 INFO 반영 완료). 이 한 지점만 1줄이라 파일 안에서 spacing 컨벤션이 국소적으로
    깨진다. 동작에는 전혀 영향 없는 순수 whitespace 이슈.
  - 제안: 여유 있을 때 공백 줄 1개 추가해 2줄로 통일. 정규식 본문은 건드리지 않으므로 이전
    라운드가 우려한 "정규식을 건드리는 리스크"는 없다.

- **[INFO]** 신규 테스트 클래스 `BacktrackingTest` 안에서 클래스 상수 선언 위치가 형제 상수와 다름(일관성)
  - 위치: `.claude/tests/test_push_guard_allowlist.py:356` (`_QUADRATIC_REPEATS = 30_000`)
  - 상세: 같은 클래스의 `_TIMEOUT = 10.0` (L317)은 클래스 docstring 바로 뒤, 첫 테스트 메서드
    이전에 선언돼 있어 "클래스 상수는 맨 위" 관례를 스스로 세운다. 반면 `_QUADRATIC_REPEATS` 는
    `test_unterminated_quote_with_long_backslash_run_is_fast` 와
    `test_repeated_subcommand_word_without_stdin_flag_is_fast` 두 테스트 메서드 사이에 끼워
    선언돼 있다. 값 근처에 그 값을 고른 근거(측정값 비교) 주석이 함께 있는 것은 좋지만, 클래스를
    위에서 훑을 때 "메서드만 나열되어 있다"는 기대를 깨고, 같은 클래스 안에서 상수 배치 규칙이
    두 가지로 갈린다.
  - 제안: `_QUADRATIC_REPEATS` 와 그 설명 주석을 `_TIMEOUT` 바로 아래로 옮겨 클래스 상단에
    모은다. 근거 주석은 그대로 이동하면 되므로 정보 손실 없음.

## 요약

이번 diff 는 순수 성능 버그 수정(그리디 `[^\n]*` 두 개가 겹치던 `_COMMIT_STDIN_CMD` 를 서로
독립적인 3개 단일 패스 probe 로 분리, 반복 `_blank()` 호출을 `_blank_spans()` 단일 재조립으로
교체)과 두 건의 문서 drift 정정이며, 셋 다 직전 라운드가 지적한 항목을 정확히 겨냥해 고쳤다.
새 코드(`_SEGMENT_IS_GIT`/`_COMMIT_OR_TAG`/`_STDIN_FILE_FLAG`, `_blank_spans`,
`_commit_heredoc_spans`)는 기존 네이밍 컨벤션(모듈 상수는 SCREAMING_SNAKE_CASE 컴파일된
정규식, 함수는 단일 책임)을 그대로 따르고, 각 분리·재작성의 이유(측정치 포함)가 코드 바로
위 주석에 남아 있어 왜 겹치는 alternation/그리디 구간을 피해야 하는지가 다음 편집자에게
자명하게 전달된다. `_commit_heredoc_spans` 는 여전히 상태를 가진 단일 스캐너 루프(≈28줄)로
응집돼 있고, 중첩 깊이·순환 복잡도 모두 낮다. 테스트 쪽도 `_assert_finishes` 헬퍼 추출로
`BacktrackingTest` 두 메서드 간 중복이 사라졌고(직전 diff 대비 개선), `BlankSpansTest` 는
매직 넘버 없이 재조립 계약(길이 보존·미정렬·겹침·빈 입력)을 이름이 분명한 개별 테스트로
고정했다. `_COMMIT_STDIN_CMD`/`_blank_commit_heredocs`/`_blank` 같은 옛 식별자에 대한 잔존
참조가 소스에 없음을 확인했다 — 이름 변경이 깨끗하게 전파됐다. 발견된 두 건은 모두 순수
whitespace/배치 스타일 문제로 동작·가독성에 실질적 영향이 없으며, 그중 하나(공백 줄 1개)는
전회 라운드에서 이미 지적됐던 사안이 이번에도 남아 있는 것이다.

## 위험도
LOW
