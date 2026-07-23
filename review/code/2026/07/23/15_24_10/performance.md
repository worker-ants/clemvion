# 성능(Performance) 리뷰 — push guard blind-scan + allowlist (3라운드, 누적 diff)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`.
그 외 `.claude/tests/test_guard_review_before_push_main.py`(docstring만 변경), `plan/in-progress/*.md`,
`review/code/2026/07/23/{14_23_23,14_57_32}/*`(이전 라운드 리뷰 산출물)는 실행 코드가 아니라 성능
영향 없음 — 검토만 하고 발견사항에서 제외.

이 훅은 **PreToolUse 로 모든 Bash 호출을 동기 게이팅**한다. 이미 이 PR 안에서만 같은 계열의
CRITICAL 성능 결함이 두 번 발견·수정됐다(1라운드 `_MESSAGE_ARG` 지수적 백트래킹, 2라운드
`_COMMIT_STDIN_CMD` 두 그리디 구간의 O(n²)). 두 건 다 "단일 정규식/단일 호출 내부"의 열화였고,
독립 단일 패스 probe 분리로 올바르게 고쳐졌다(실측: 205KB 38.0s → 0.014s). `_blank()` 의 span 당
전체 문자열 복사(O(n·k))도 `_blank_spans()` 한 번의 선형 재조립으로 고쳐졌음을 직접 재확인했다
(5,000 span × 200,000자에서 0.0006s — 정상).

이번 라운드에서 남아 있는 것은 **"단일 호출은 선형인데, 그 호출이 반복되는 횟수"** 축의 O(n²)이다
— 앞의 두 수정과 다른 축이라 그 수정들로는 닫히지 않았다.

## 발견사항

- **[WARNING]** `_commit_heredoc_spans`/`_owns_heredoc_as_message` — heredoc 시작 마커가 한 줄에
  여럿이면 소유권 판정이 마커 개수의 제곱으로 열화(O(h²))
  - 위치: `.claude/hooks/guard_review_before_push.py::_commit_heredoc_spans` (L212-241),
    `::_owns_heredoc_as_message` (L116-129)
  - 상세: `_commit_heredoc_spans`는 `_HEREDOC_START.search(text, pos)`로 heredoc 오프너를 차례로
    찾고, 매 오프너마다 `line_start = text.rfind("\n", 0, m.start()) + 1` 로 "그 줄의 시작"을 구한
    뒤 `_owns_heredoc_as_message(text[line_start:m.start()])`를 호출한다. 2라운드에서 이 함수 내부의
    두 그리디 구간을 세 개의 독립 단일 패스 probe(`_SEGMENT_IS_GIT` → `_COMMIT_OR_TAG` →
    `_STDIN_FILE_FLAG`)로 나눠 **호출 1회당 비용은 이미 선형**이다. 그런데 실제 개행이 하나도
    없는 한 줄에 heredoc 오프너(`<<TOK0 <<TOK1 … <<TOKn`)가 여러 개 연달아 있으면, `line_start`가
    매번 0으로 고정되고 `text[line_start:m.start()]`(그리고 그 안의
    `_SEGMENT_SPLIT.split(prefix)`, `text.rfind`)가 매 마커마다 **그 시점까지 누적된 prefix
    전체**를 다시 스캔한다. 개별 호출은 O(prefix_len)로 여전히 선형이지만, prefix_len 이 마커마다
    커지므로 총합은 등차수열 합 = O(h²)이다. 이는 1·2라운드가 고친 "한 호출 내부의 중첩 수량자"와
    **다른 축**이라 그 수정들로 닫히지 않은 채 남아 있다.
    실측(공개 진입점 `guard._is_git_push()` 전체 경로, `git commit -m x <<TOK0 … <<TOKn && git
    push` 형태 — 블라인드 1차 매치가 걸리고 라이브 확장이 전혀 없어 `_redact_inert_text` 의
    무거운 경로를 실제로 타는 입력):
    | 오프너 개수 | 명령 길이 | 소요 시간 |
    |---|---|---|
    | 4,000 | 38,917자 | 1.746s |
    | 8,000 | 78,917자 | 7.216s |
    | 12,000 | 120,917자 | 16.559s |

    입력 2배(4,000→8,000) → 시간 4.1배, (8,000→12,000, 1.5배) → 시간 2.3배(≈1.5²)로 O(n²) 패턴이
    명확하다. 12,000개 시점에 이미 이 스위트 자신이 "hang" 기준으로 쓰는 하드 타임아웃(10초,
    `BacktrackingTest._TIMEOUT`)을 넘어선다 — 즉 이 훅을 동기 게이팅하는 세션 관점에서 1·2라운드가
    CRITICAL/WARNING 으로 다뤘던 것과 **같은 피해 범주**(세션 정지 체감, 또는 하네스 타임아웃에
    의한 fail-open)다. 지수 폭발이 아니라 다항(제곱) 열화이므로 유한 시간 안에 끝나긴 하지만, 2라운드
    성능 리뷰(`review/code/2026/07/23/14_57_32/performance.md`)가 바로 이 경로를 "heredoc 이 여럿이면
    누적 O(n²) 방향"이라고 이미 언급했음에도, 그 라운드의 RESOLUTION(`14_57_32/RESOLUTION.md`
    W1·W2)은 `_COMMIT_STDIN_CMD`(단일 호출 내부 중첩 수량자)와 `_blank()`(span 당 전체 복사) 두
    가지만 고쳤을 뿐, "호출 반복 횟수 × 누적 prefix 길이" 축은 다루지 않아 **여전히 미해결**로
    남았다. 또한 그때 추정한 트리거 규모("대략 수십만 자 이상 필요")보다 실제로는 훨씬 작은
    121KB(12,000개 마커)에서 이미 16.5초에 도달해, 실제 위험도가 이전 추정보다 다소 높다.
    트리거 조건: 명령이 (a) 블라인드 1차 패턴에 걸리는 `git … push` 텍스트를 포함하고, (b) 라이브
    확장(`$(` / 백틱 / `${`)이 전혀 없고, (c) 개행 없이 heredoc 오프너 형태 토큰(`<<X`)이 한 줄에
    다수 이어져야 한다 — 완전히 인위적인 적대적 입력은 아니며, 여러 heredoc 을 체이닝하는 대형
    생성 스크립트에서 우연히도 재현 가능한 형태다.
  - 제안: "소유권 판정 window"의 시작점을 매번 마지막 실제 개행으로 되돌리는 대신, **직전에 처리한
    heredoc 마커의 끝 위치**와 `max()`를 취해 그 이후 구간만 스캔하도록 바꾼다 — 즉
    `window_start = max(line_start, prev_marker_end)`. 이 설계가 이미 명시한 안전 원칙("판정이
    좁게 빗나가면 차단 유지 = 안전, 넓게 빗나가는 것만 위험")과 정확히 부합한다: window 를 좁히면
    `_SEGMENT_IS_GIT.match`가 실패해 최악의 경우 정당한 release 를 놓치고 차단을 유지할 뿐,
    잘못된 release 를 만들지 않는다. 이 변경만으로 전체 스캔이 heredoc 마커 개수에 무관하게
    총 O(n)으로 떨어진다. 최소 방어책으로 `BacktrackingTest`류에 "한 줄에 heredoc 오프너 다수"
    케이스(예: 8,000~16,000개, 10초 타임아웃 근접 여부 실측 후 결정)를 회귀 테스트로 추가할 것 —
    현재 `test_repeated_subcommand_word_without_stdin_flag_is_fast`는 heredoc 오프너 **1개**만
    두고 그 앞의 텍스트 길이만 늘리므로 이 경로(오프너 개수 자체의 배수 효과)를 전혀 pin 하지
    않는다.

- **[INFO]** heredoc 종료 구분자 정규식을 매 heredoc 마다 동적 `re.compile()`
  - 위치: `.claude/hooks/guard_review_before_push.py::_commit_heredoc_spans`
    (`end_re = re.compile(rf"^[ \t]*{re.escape(delim)}[ \t]*$", re.M)`)
  - 상세: 2라운드 리뷰에서 이미 지적된 사항(그대로 남아 있음). 모듈 최상단에 사전 컴파일된 다른
    패턴들과 달리 `delim` 값 의존이라 호출마다 새로 컴파일하지만, 이 훅이 Bash 호출마다 새
    파이썬 프로세스로 실행되는 실행 모델(인터프리터 기동 비용이 지배적)과 `re` 모듈 자체의 내부
    컴파일 캐시를 감안하면 실질 영향은 미미하다. 위 WARNING 이 고쳐지면(호출 자체가 줄어드는 것은
    아니고 스캔 비용만 줄어드는 것이므로) 이 항목의 상대적 비중도 달라지지 않는다.
  - 제안: 우선순위 낮음. 원하면 `delim`을 정규식에 넣는 대신 `line.strip() == delim` 문자열
    비교로 대체해 컴파일 자체를 없앨 수 있다.

- **[INFO]** 좋은 설계: 비용이 큰 redaction 경로 진입 전 얕은 체크로 조기 반환 유지됨
  - 위치: `.claude/hooks/guard_review_before_push.py::_is_git_push` (L254-276)
  - 상세: `"push" not in command` 부분문자열 검사 → 블라인드 1차 매치 → `_is_inert(command)`
    라이브 확장 3종 부분문자열 검사 순으로, 값싼 검사를 먼저 통과해야만 `_redact_inert_text()`의
    다항 비용 경로에 도달한다. 실무 대다수 명령(`git status`, `ls` 등)은 첫 줄에서 끝나 위
    WARNING 의 실제 발현 빈도를 낮추는 방향으로 잘 작동한다. 유지 권장.

- **[INFO]** `_blank_spans` 단일 선형 재조립 — 2라운드 WARNING(W2, span 당 O(n) 복사 반복)이
  올바르게 해소됐음을 직접 재실측으로 확인
  - 위치: `.claude/hooks/guard_review_before_push.py::_blank_spans` (L158-176)
  - 상세: 정렬된 span 목록을 한 번 순회하며 조각을 모았다가 `"".join()`으로 한 번만 조립 —
    5,000 span × 200,000자 입력에서 0.0006s (재실측, 선형 확인). 겹치는 span 도
    `start < prev`로 안전하게 스킵.
  - 제안: 없음 — 유지.

- **[INFO]** 정규식은 전부 모듈 스코프에서 1회 컴파일 후 재사용
  - 위치: `.claude/hooks/guard_review_before_push.py` L68-113 (`_GIT_PUSH`, `_ESCAPED_PIPE`,
    `_HEREDOC_START`, `_SEGMENT_IS_GIT`, `_COMMIT_OR_TAG`, `_STDIN_FILE_FLAG`, `_SEGMENT_SPLIT`,
    `_MESSAGE_ARG`)
  - 상세: 함수 호출마다 재컴파일하지 않음 — 반복 호출(테스트 코퍼스 순회, 실제 다중 Bash 호출)
    관점에서 올바른 패턴. 유지.

- **[INFO]** `test_push_guard_allowlist.py::BacktrackingTest` 의 서브프로세스+하드 타임아웃 방식
  - 위치: `.claude/tests/test_push_guard_allowlist.py::BacktrackingTest`
  - 상세: 파국적 백트래킹은 C 레벨 `re` 안에서 일어나 시그널을 받지 않아 in-process 타이밍
    검증이 통째로 hang 한다는 근거가 명확하고, 하드 타임아웃(10s)으로 fail-fast 해 스위트 자체가
    무한정 멈추는 것을 막는다. 프로덕션 코드가 아니라 테스트 실행 시간(수백 ms~수 초)에만
    영향이라 문제 삼을 수준 아님. 다만 위 WARNING 의 회귀 테스트를 이 클래스에 같은 방법론으로
    추가할 것을 제안.

## 요약

이 훅은 "모든 Bash 호출을 동기 게이팅"하는 특성 때문에 지연 상한이 곧 안전성 문제이고, 실제로
이 PR 안에서만 같은 계열의 CRITICAL/WARNING 급 다항·지수 열화가 두 차례 발견되어 올바르게
고쳐졌다(`_MESSAGE_ARG` ReDoS → disjoint alternation, `_COMMIT_STDIN_CMD` O(n²) → 독립 단일 패스
3-probe 분리, `_blank()` O(n·k) → `_blank_spans` 단일 재조립 — 세 건 모두 재실측으로 수정 확인).
다만 "한 번의 호출은 선형이지만 그 호출이 heredoc 마커 개수만큼 반복되며 매번 누적 prefix 를
다시 스캔"하는 축의 O(n²)이 `_commit_heredoc_spans`/`_owns_heredoc_as_message`에 남아 있다 —
2라운드 리뷰가 언급만 하고 RESOLUTION 에서 실제로는 고치지 않은 항목이다. 공개 진입점
`_is_git_push()`를 통한 실측으로 121KB(heredoc 오프너 12,000개) 입력에서 16.5초가 걸림을
확인했으며, 이는 이 코드베이스 자신이 "hang"의 기준으로 쓰는 10초 타임아웃을 이미 넘는다. 지수
폭발이 아니라 다항 열화이고 트리거하려면 개행 없이 heredoc 오프너가 다수 이어지는 다소 특수한
모양의 명령이 필요하지만, 이전 라운드가 추정했던 것보다 더 작은 입력에서 이미 유효 위험 수준에
도달한다는 점에서 재점검이 필요하다. 그 외 조기-반환 얕은 체크·모듈 스코프 정규식 사전 컴파일 등
이 코드베이스가 견지해 온 신중한 성능 패턴은 잘 유지되고 있다.

## 위험도
MEDIUM
