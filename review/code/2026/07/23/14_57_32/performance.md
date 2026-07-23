# 성능(Performance) 리뷰 — push guard blind-scan + allowlist (재설계 2라운드)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`
(그 외 `plan/in-progress/*.md`, `review/code/2026/07/23/14_23_23/*` 는 문서/리뷰 산출물로 성능
영향 없음 — 검토만 하고 발견사항에서 제외)

이 훅은 **모든 Bash 도구 호출을 동기적으로 게이팅**하는 PreToolUse 훅이다. 즉 여기서의
"성능 문제"는 곧 "세션 정지/지연"이며, 이미 같은 PR 의 1라운드 리뷰(`14_23_23`)에서 `_MESSAGE_ARG`
정규식의 지수적 백트래킹(ReDoS, CRITICAL #2)이 발견·수정됐다. 이번 diff 는 그 수정을 반영한
버전이다. 아래는 그 수정 이후에도 남아있는, 같은 계열(입력 크기에 따라 나빠지는 처리 비용)의
추가 발견사항이다.

## 발견사항

- **[WARNING]** `_redact_inert_text` 의 blanking 파이프라인이 매치마다 O(n) 전체 문자열 복사를 반복 — 다수 매치 입력에서 O(n·k) (최악 O(n²))로 열화
  - 위치: `.claude/hooks/guard_review_before_push.py::_redact_inert_text` (L149-161 부근, `spans` 루프) 및 `_blank_commit_heredocs` (L164-188)
  - 상세: `_blank(text, start, end)` 는 `text[:start] + " "*(end-start) + text[end:]` 로 **길이 n짜리 새 문자열을 매번 통째로 복사**해서 반환한다. `_redact_inert_text` 는 `_MESSAGE_ARG.finditer()` 로 찾은 모든 span 을 리스트에 모은 뒤 `for start, end in spans: out = _blank(out, start, end)` 로 **span 개수(k)만큼 반복 호출**한다. 각 호출이 O(n) 이므로 전체는 O(k·n). 매치 개수 k 는 입력 문자열에 반복되는 `-m "…"`/`-F "…"` 개수에 비례해 커질 수 있다(git 은 다중 `-m` 을 실제로 지원하는 관용구다 — 코퍼스의 `'git commit -m "a" -m "b && git push"'` 케이스가 이를 이미 인정하고 있다). 예: `-m "a"` 를 매우 많이 반복하는(수만~수십만 개) 하나의 긴 명령 문자열을 넣으면 k 와 n 이 함께 커져 O(n²) 로 접근한다. 같은 클래스의 문제가 `_blank_commit_heredocs` 의 `while True` 루프에도 있다 — heredoc 을 찾을 때마다 `text = _blank(text, body_start, body_end)` 로 전체 문자열을 재복사하며, 게다가 매 heredoc 마커마다(스킵되는 것 포함) `_owns_heredoc_as_message` 가 `_SEGMENT_SPLIT.split(prefix)` 로 그 시점까지의 prefix 전체를 다시 스캔한다(heredoc 이 여럿이면 이것도 누적 O(n²) 방향).
    이번 PR 이 막 고친 C2(ReDoS, 지수 백트래킹)보다는 등급이 낮다 — 다항(제곱) 열화이지 지수 폭발이 아니라서 유한 시간 안에는 끝난다. 하지만 이 훅이 "모든 Bash 호출을 동기 게이팅"한다는 전제 자체가 C2 를 CRITICAL 로 만든 근거였고, 그 전제는 이 경로에도 동일하게 적용된다. 실제로 문제가 되려면 명령 문자열 자체가 매우 커야 하므로(대략 n·k 가 10^9 오더에 도달할 정도 — 수십만 자 이상), 일상적 사용에서 트리거될 가능성은 낮지만 하드 상한이 코드 어디에도 없다.
  - 제안: span 들을 반복 호출 대신 **한 번의 선형 재조립**으로 처리한다 — 예를 들어 정렬된 span 리스트를 순회하며 `list`/`bytearray` 에 원본과 공백 조각을 append 하고 마지막에 한 번만 `"".join(...)` 하면 O(n) 으로 끝난다. `_blank_commit_heredocs` 도 같은 방식으로 "블랭킹할 구간 목록을 모았다가 마지막에 한 번에 조립"하도록 바꾸면 heredoc 개수에 비례한 반복 복사를 없앨 수 있다. 최소한의 방어책으로는, 이 훅이 다루는 입력(단일 Bash 명령 문자열)에 대해 상식적인 상한(예: 수십 KB)을 넘으면 redaction 을 생략하고 즉시 차단(fail-closed, 안전한 방향)하는 가드를 추가하는 것도 이번 PR 이 이미 채택한 "안전 방향으로만 벗어난다" 설계 원칙과 정확히 부합한다.

- **[INFO]** `_blank_commit_heredocs` 안에서 heredoc 종료 구분자 정규식을 매 heredoc 마다 동적으로 `re.compile()`
  - 위치: `.claude/hooks/guard_review_before_push.py::_blank_commit_heredocs` — `end_re = re.compile(rf"^[ \t]*{re.escape(delim)}[ \t]*$", re.M)`
  - 상세: 모듈 최상단에 미리 컴파일된 다른 패턴들(`_GIT_PUSH`, `_ESCAPED_PIPE` 등)과 달리 이 패턴은 `delim` 값에 의존해 호출마다 새로 컴파일된다. 다만 이 훅은 Bash 호출마다 **새 파이썬 프로세스**로 실행되는 것으로 보이므로(스크립트가 stdin payload 를 매번 새로 읽음) 인터프리터 기동 비용 자체가 이 컴파일 비용을 압도한다 — 실질 영향은 미미. Python `re` 모듈 자체도 `compile()` 호출을 내부 캐시(기본 512개)로 재사용하므로, 설령 프로세스가 재사용되는 실행 모델이더라도 심각하지 않다.
  - 제안: 우선순위 낮음. 원한다면 `delim` 을 정규식에 넣는 대신 라인 단위 문자열 비교(`line.strip() == delim`)로 바꿔 컴파일 자체를 없앨 수 있으나, 이번 diff 의 다른 이슈들에 비해 실익이 작다.

- **[INFO]** 좋은 설계: 비용이 큰 redaction 경로 진입 전 O(1)~O(n) 얕은 체크로 조기 반환
  - 위치: `.claude/hooks/guard_review_before_push.py::_is_git_push` (L215-220)
  - 상세: `"push" not in command` 부분문자열 검사, `_GIT_PUSH.search()` 블라인드 1차 매치, `_is_inert(command)` (라이브 확장 토큰 3종 부분문자열 검사) 순서로 값싼 검사를 먼저 수행하고, `push` 가 아예 없거나 라이브 확장이 있으면 (전자는 즉시 차단 해제, 후자는 즉시 차단 유지) `_redact_inert_text()` 의 다항 비용 경로 자체를 건너뛴다. 실무에서 마주치는 대다수 명령(단순 `git status`, `ls` 등)은 첫 줄에서 끝나고, 실제 커밋 메시지가 있는 명령만 무거운 경로를 탄다 — 위 WARNING 의 실질 발현 빈도를 낮추는 방향으로 잘 작동한다.
  - 제안: 없음 — 유지.

- **[INFO]** 정규식은 전부 모듈 스코프에서 1회 컴파일 후 재사용
  - 위치: `.claude/hooks/guard_review_before_push.py` L55-116 (`_GIT_PUSH`, `_LIVE_EXPANSION`, `_ESCAPED_PIPE`, `_HEREDOC_START`, `_COMMIT_STDIN_CMD`, `_SEGMENT_SPLIT`, `_MESSAGE_ARG`)
  - 상세: 함수 호출마다 재컴파일하지 않고 모듈 임포트 시 1회만 컴파일 — 반복 호출(테스트 스위트의 corpus 순회, 실제 다중 Bash 호출) 관점에서 올바른 패턴.
  - 제안: 없음.

- **[INFO]** `test_push_guard_allowlist.py::BacktrackingTest` 는 서브프로세스 기동 비용을 감수하지만 목적에 부합
  - 위치: `.claude/tests/test_push_guard_allowlist.py::BacktrackingTest._run_guard_out_of_process`
  - 상세: 3개 케이스(백슬래시 60/200/800개)마다 새 파이썬 서브프로세스를 띄운다. 인터프리터 기동 오버헤드가 있지만, docstring 이 명시하듯 "파국적 백트래킹은 C 레벨 `re` 안에서 일어나 시그널을 받지 않아 in-process 타이밍 검증이 통째로 hang 한다"는 근거가 명확하고, 하드 타임아웃(10s)으로 fail-fast 하게 만들어 테스트 스위트 자체가 무한정 멈추는 것을 막는다. 프로덕션 코드가 아니라 테스트 실행 시간에만 영향(수백 ms 수준)이므로 문제 삼을 수준 아님.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/*.md`, `review/code/2026/07/23/14_23_23/*.md`·`*.json` 변경분
  - 위치: 파일 3~16
  - 상세: 문서·이전 라운드 리뷰 산출물 갱신으로 실행 코드가 아니어서 성능 영향 없음.
  - 제안: 해당 없음.

## 요약

이 훅은 "모든 Bash 호출을 동기 게이팅"한다는 특성 때문에 정확성 못지않게 지연 상한이 곧 안전성 문제다. 1라운드 리뷰에서 발견된 `_MESSAGE_ARG` 의 지수적 백트래킹(ReDoS)은 disjoint alternation 으로 올바르게 고쳐졌고 서브프로세스+하드 타임아웃 회귀 테스트로 잘 고정됐다. 다만 그 수정 이후에도 `_redact_inert_text`/`_blank_commit_heredocs` 가 매치·heredoc 개수만큼 전체 문자열을 반복 복사하는 O(n·k)(최악 O(n²)) 패턴이 남아 있다 — 지수 폭발은 아니지만 같은 "동기 게이트가 느려지면 세션이 멈춘다"는 위험 모델 아래에서는 유효한 성능 결함이며, 한 번의 선형 재조립으로 쉽게 O(n) 으로 낮출 수 있다. 그 외에는 조기-반환 얕은 체크·모듈 스코프 정규식 사전 컴파일 등 이 코드베이스가 이미 견지해 온 신중한 패턴들이 잘 유지되고 있고, 일상적인 명령 크기에서는 실질적으로 체감되지 않을 정도로 낮은 위험이다.

## 위험도
LOW
