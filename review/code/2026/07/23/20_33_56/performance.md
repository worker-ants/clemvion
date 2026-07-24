# 성능(Performance) 리뷰

## 스코프 확인

리뷰 payload 18개 파일 중 실제 실행 코드 변경은 `.claude/hooks/guard_default_branch_bash.py` 1건뿐이다
(`.claude/hooks/guard_review_before_push.py` 는 주석만 추가되어 로직·성능 영향 없음). 나머지는
문서(`worktree-policy.md`, `.claude/tests/README.md`, plan 문서 2건)와 신규 테스트 1건
(`test_guard_default_branch_bash_mutating.py`), 그리고 이전 라운드(20_02_29) 리뷰 산출물을 저장소에
반영한 아카이브 파일들(SUMMARY.md/RESOLUTION.md/`*.md`/`meta.json`/`_retry_state.json`)이다. 이
아카이브 파일들은 실행되는 코드가 아니므로 성능 관점 분석 대상에서 제외한다.

대상 훅은 **PreToolUse** 로 등록되어 모든 `Bash` 툴 호출 직전에 동기 실행되는 "hot path" 스크립트이므로,
정규식 처리 비용은 매 명령마다 지불된다는 전제로 분석했다.

## 발견사항

- **[INFO]** `main()` 에서 비용이 커진 `_is_mutating()` 검사가 저렴한 `_already_warned()` 검사보다 먼저 실행된다
  - 위치: `.claude/hooks/guard_default_branch_bash.py:200-205` (`main()` 내부, 이번 diff 의 hunk 밖 — 기존 순서가 이번 변경으로 비용 구조만 바뀜)
  - 상세: `_is_mutating(command)` (라인 200)이 먼저 호출되고, 세션당 1회만 의미 있는 `_already_warned(session_id)` (라인 204)는 그 뒤에 호출된다. 이번 diff 전에는 `_is_mutating` 이 정규식 1회 `.search()` 호출이라 순서가 중요하지 않았지만, 이번 변경으로 `_is_mutating` 은 `_SEGMENT_SPLIT.split()` (라인 146, 153) + 세그먼트 수만큼의 `_MUTATING.search()` 반복 호출로 바뀌어 상대적으로 더 비싸졌다. 세션이 이미 넛지를 받은 뒤(`_already_warned` 가 True 가 될 상황)에도, default branch 위에서 실행되는 모든 후속 Bash 호출마다 이 더 비싸진 분류 작업을 불필요하게 반복한다.
  - 제안: `_already_warned(session_id)` (파일 I/O 1회, `os.path.exists`) 를 `_is_mutating()` 보다 먼저 검사해 세션당 1회 이후의 모든 호출에서 정규식 분류 자체를 건너뛰도록 순서를 바꾼다. 다만 세션이 계속 바뀌는 시나리오(session_id 없음 → 매번 실행)에서는 순서 변경의 이득이 없다는 점은 유지된다.

- **[INFO]** 세그먼트가 많은 입력(대형 heredoc 등)에서 정규식 호출 횟수가 세그먼트 수에 비례해 증가
  - 위치: `.claude/hooks/guard_default_branch_bash.py:146` (`_SEGMENT_SPLIT`), `:149-154` (`_is_mutating`)
  - 상세: 개행이 구분자에 포함되므로(`test_heredoc_body_line_starting_with_a_verb_nudges` 가 이미 이 동작을 pin), 수백~수천 줄짜리 heredoc/멀티라인 명령은 `re.split()` 한 번 이후 줄 수만큼의 개별 `_MUTATING.search()` 호출로 이어진다. `_MUTATING` 이 `^` 로 앵커돼 있어 각 호출 자체는 매칭 실패 시 매우 빠르게 끝나므로 알고리즘적으로는 여전히 O(n) 선형이지만, 정규식 엔진 호출 오버헤드(파이썬 함수 콜 비용)가 "명령 전체를 한 번에 스캔"에서 "줄 수만큼 반복 호출"로 상수 배수가 늘었다. `BacktrackingTest` (`.claude/tests/test_guard_default_branch_bash_mutating.py:185-234`) 가 2만자급 적대적 입력을 20초 타임아웃 서브프로세스로 검증해 행(hang) 위험은 없음을 이미 확인했으므로, 이는 hang 회귀가 아니라 순수 상수-배수 오버헤드에 대한 참고 사항이다.
  - 제안: 현재 트래픽 패턴(1회성 세션당 넛지, PreToolUse 프로세스 재기동 비용이 이 오버헤드를 압도)에서는 조치 불필요. 다만 이 훅이 향후 매 호출마다 실행되는 경로로 강화되거나 명령 길이 상한이 없다는 점이 우려되면, push 가드가 이미 적용한 "입력 상한(16KB)" 패턴을 참고할 수 있다.

- **[INFO]** ReDoS/캐치스트로픽 백트래킹 — 측정으로 이미 반증, 회귀 아님
  - 위치: `.claude/hooks/guard_default_branch_bash.py:96-117` (`_MUTATING`), `:146` (`_SEGMENT_SPLIT`)
  - 상세: `VAR=value` 접두 반복 그룹(`(?:...)*`)과 3-way alternation(`'…'|"…"|[^\s'"]\S*`)은 중첩 quantifier 형태로 보일 수 있으나, 각 반복이 `^`+`IDENT=` 로 강제되어 엔진이 탐색할 분할이 없고, RESOLUTION.md 가 기록한 실측(`A="a b" ` ×24000 + 실패 tail 등)과 `BacktrackingTest` 가 선형성을 고정한다. push 가드가 겪었던 `_MESSAGE_ARG` CRITICAL 급 ReDoS 재발이 이 훅에는 없다.
  - 제안: 조치 불필요. 향후 `_MUTATING` 에 새 alternation·중첩 quantifier 를 추가할 때는 `BacktrackingTest` 급 회귀 테스트를 함께 갱신 권고(이미 plan/README 에 그 취지가 기록돼 있음).

- **[INFO]** 컴파일된 정규식 재사용 — 모듈 스코프 상수라 매 호출 재컴파일 없음
  - 위치: `.claude/hooks/guard_default_branch_bash.py:96` (`_MUTATING`), `:146` (`_SEGMENT_SPLIT`)
  - 상세: 두 정규식 모두 모듈 임포트 시 한 번만 컴파일되어 재사용된다(좋은 패턴). 매 Bash 호출마다 새 프로세스로 훅이 재기동되므로 "모듈 임포트 = 매 호출 1회 컴파일"이라는 한계는 있으나, 이는 하네스의 PreToolUse 실행 모델 자체의 특성이며 이번 diff 로 새로 생긴 문제가 아니다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 애플리케이션 코드(DB/API/캐싱/블로킹 I/O)와 무관한 개발 하네스 훅 1개 파일의 정규식 분류 로직 확장이며, 알고리즘적으로는 O(n) 선형을 유지하고 ReDoS 위험도 실측으로 반증되었다. 다만 `_is_mutating()` 이 단일 정규식 검사에서 "분할 + 세그먼트별 반복 검사"로 바뀌면서 상수 배수 비용이 늘었는데, `main()` 은 세션당 1회만 의미 있는 저렴한 `_already_warned()` 검사보다 이 비용이 늘어난 검사를 먼저 수행하는 순서를 그대로 두고 있어 이미 넛지가 끝난 세션에서도 불필요한 반복 비용을 지불한다. 다만 이 훅은 Bash 호출마다 프로세스가 재기동되는 구조라 이 오버헤드는 프로세스 기동 비용에 묻히는 수준이며, 실사용 명령 길이를 고려하면 체감 영향은 미미하다. CRITICAL/WARNING 급 성능 문제는 없다.

## 위험도
LOW
