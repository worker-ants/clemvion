# 유지보수성(Maintainability) 리뷰 — push guard blind+allowlist 재설계 (2회차)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`
(+ `plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`,
`review/code/2026/07/23/14_23_23/*` 는 이전 리뷰 라운드 산출물 아카이브 — 코드가 아니라
리포트/상태 데이터이므로 본 리뷰의 8개 관점 대상에서 제외)

본 라운드는 `review/code/2026/07/23/14_23_23` 에서 발견된 CRITICAL 3건(단일/이중 따옴표
이스케이프 혼동, 정규식 파국적 백트래킹, 메시지 blanking 이 살아있는 확장을 노출)과
WARNING 3건(훅 간 로직 중복 확대, `CORPUS`/`RELEASED` 이중 SoT, `git tag` 해제 경로 무테스트)에
대한 수정 diff다. Warning #2(이중 SoT)는 `CORPUS` 3-필드 재구성 + `RELEASED` 파생으로 실제로
해소됐음을 확인했다.

## 발견사항

- **[WARNING]** 이웃 테스트 파일의 모듈 docstring이 이번 diff로 stale해짐 — "탐지 로직 미커버" 주장이 더 이상 사실이 아님
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:9-15`
  - 상세: 이 파일의 모듈 docstring은 "`_is_git_push`'s own detection logic ... has no
    dedicated unit tests at all ... That gap is real and tracked as backlog item ②
    (harness-push-guard-subcommand-detection)"라고 명시한다. 그런데 이번 diff가 추가하는
    `test_push_guard_allowlist.py`가 바로 `_is_git_push`/`_GIT_PUSH`/`_redact_inert_text`를
    직접 대상으로 하는 25건짜리 전용 유닛 테스트 스위트이고, 연결된 plan
    (`harness-push-guard-subcommand-detection.md`)의 체크리스트도 이번 diff에서 전부 `[x]`로
    완료 표시됐다. 즉 이 diff가 정확히 그 "backlog item ②"를 닫으면서도, 그 사실을 알려야 할
    이웃 파일의 주석은 손대지 않아 이제 거짓 진술이 됐다. 향후 이 파일만 읽는 개발자는 탐지
    로직이 여전히 무커버 상태라고 오판해 중복 작업을 하거나, 리팩터링 시 `_is_git_push`를
    안전하게 바꿔도 되는 줄 착각할 수 있다.
  - 제안: `test_guard_review_before_push_main.py` L9-15의 "NOT covered ... backlog item ②"
    문단을 갱신해 `test_push_guard_allowlist.py`를 상호 참조하도록 수정(예: "detection 로직
    자체는 이제 `test_push_guard_allowlist.py`가 커버한다. 이 파일은 `main()`의 오케스트레이션만
    다룬다"). 코드 변경 없이 주석 한 문단 교정이라 이번 PR 스코프에 안전하게 포함 가능.

- **[INFO]** 파일 내부 top-level 정의 사이 공백 줄 수가 3가지 값으로 흩어짐(1/2/3줄), PEP8(2줄) 미준수 지점 존재
  - 위치: `.claude/hooks/guard_review_before_push.py:109`(1줄, `_owns_heredoc_as_message` 종료 ~
    `_MESSAGE_ARG` 주석 시작) / `:202-204`(3줄, `_blank_commit_heredocs` 종료 ~ `_read_payload`
    시작, 전 라운드 INFO #3에서 이미 지적·"스타일, 동작 영향 없음"으로 의도적 보류됨)
  - 상세: 파일 대부분(`_is_inert`~`_blank` 등)은 2줄 관례를 따르는데 위 두 지점만 벗어나
    있어, 하나의 파일 안에 3가지 spacing이 혼재한다. 동작에는 영향 없음.
  - 제안: 여유 있을 때 두 지점 모두 2줄로 통일. `:202-204`는 이미 지난 라운드에서 의도적으로
    defer된 사안이라 재차단 사유는 아니며, `:109`는 이번에 처음 관측된 것으로 함께 정리하면
    비용이 거의 없음(순수 whitespace, regex 본문 무변경이라 "정규식을 건드리는 리스크" 없음).

- **[INFO]** 신규 정규식(`_MESSAGE_ARG`, `_COMMIT_STDIN_CMD`)의 시각적 밀도가 높음 — 이미 인지·보류된 사안
  - 위치: `.claude/hooks/guard_review_before_push.py:95-98`, `:124-129`
  - 상세: `re.VERBOSE` 미사용으로 토큰 경계가 눈으로 바로 안 들어온다. 다만 전 라운드에서
    이미 지적됐고(SUMMARY INFO #4), RESOLUTION이 "오히려 정규식을 건드리는 리스크"라는
    타당한 근거로 명시적으로 보류했다. 그 판단은 이번에도 유효 — 특히 C1/C2가 바로 이
    정규식들의 미세한 문법 실수에서 나왔던 만큼, 지금 손대는 것은 실익보다 회귀 위험이 크다.
  - 제안: 조치 불필요(기존 defer 유지). 참고용으로만 기록.

## 요약

이번 라운드는 순수 버그 수정(단일/이중 따옴표 처리 분리, 겹치는 alternation 제거, 명령 전체
inert 검사로 보수화)이며, 유지보수성 관점에서 코드 품질이 오히려 개선됐다: 각 CRITICAL의
근본 원인·재현·수정 논거가 정규식 바로 위 주석에 서술식으로 남아 있어 "왜 홑따옴표와
겹따옴표를 다르게 다루는가", "왜 alternation을 서로소로 만들었는가" 같은 향후 재발하기 쉬운
실수를 코드 옆에서 바로 막아준다. 함수 길이·중첩·네이밍·순환 복잡도 모두 양호하며(가장 긴
`_blank_commit_heredocs`도 순차적 스캐너 상태 하나를 다루는 응집된 25줄), 매직 넘버 없이
`_LIVE_EXPANSION` 같은 명명된 상수로 의미를 드러낸다. 테스트 파일도 전 라운드 WARNING #2
(CORPUS/RELEASED 이중 SoT)를 3-필드 튜플 + 파생 dict로 실제로 해소했다. 유일하게 실질적인
지적은 이웃 테스트 파일(`test_guard_review_before_push_main.py`)의 docstring이 이 diff로 인해
stale해진 점 — 코드 자체의 결함이 아니라 "변경이 다른 파일의 진술을 거짓으로 만들었는데
그 파일은 손대지 않은" 정합성 갭이다. 나머지는 이미 이전 라운드에서 의도적으로 보류된
스타일 항목의 잔존 확인 수준이다.

## 위험도
LOW
