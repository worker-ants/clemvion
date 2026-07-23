# 부작용(Side Effect) 리뷰 — push guard allowlist (`guard_review_before_push.py`)

## 발견사항

- **[CRITICAL]** `_MESSAGE_ARG` 정규식의 catastrophic backtracking (ReDoS) — PreToolUse 훅이 무기한 행(hang)될 수 있음
  - 위치: `.claude/hooks/guard_review_before_push.py` — `_MESSAGE_ARG` 정의(신규 추가) 및 이를 사용하는 `_redact_inert_text()` → `_is_git_push()` 경로
  - 상세: `_MESSAGE_ARG` 의 본문 그룹 `(?P<body>(?:\\.|(?!(?P=q)).)*)` 는 백슬래시 1글자마다 "`\\.`(이스케이프 쌍으로 소비)" 대 "일반 글자로 소비"라는 두 가지 파싱 경로가 겹쳐(ambiguous alternation), 최종 매칭이 실패할 때(닫는 인용부호를 못 찾을 때) 정규식 엔진이 2^n 에 가까운 백트래킹을 시도하는 고전적 ReDoS 패턴이다. 실측(동일 워크트리, 실제 `guard._is_git_push()` 호출):
    - `git commit -m "` + `\` × 30 + `git push` → **0.84초**
    - 같은 형태, `\` × 35 → **9.56초**
    - 같은 형태, `\` × 40 → **105.7초**
    (닫는 인용부호가 정상적으로 있는 동일 길이 문자열은 0ms — 매칭이 **실패**해야만 발동)
    이 경로는 `_is_git_push()` 가 blind 1차 패턴(`_GIT_PUSH`, 기존 로직·변경 없음)에서 hit 이 난 뒤 `_redact_inert_text()` 를 호출할 때만 실행되므로, "git … push" 형태이면서 `-m`/`-F`/`--message=` 뒤 인용부호가 (의도했든 우연히든, 예: 홀수 개의 트레일링 백슬래시로 인한 이스케이프) 정상적으로 닫히지 않는 입력이면 트리거된다. 커밋 메시지에 백슬래시가 여러 번 들어가는 것(윈도우 경로·정규식·LaTeX·JSON 이스케이프 언급 등)은 드문 일이 아니다. 기존(변경 전) `_GIT_PUSH` 단독 패턴은 같은 입력(백슬래시 1000개)에서 **선형 시간**(<10μs)임을 별도로 실측 확인했다 — 즉 이 취약점은 **이번 diff 가 신규로 도입**한 것이며 선재 결함이 아니다.
    이 훅은 PreToolUse 로 매 Bash 호출을 동기 게이팅하므로, 하나의 Bash 명령이 이 패턴에 걸리면 그 tool call 자체(더 나아가 세션)가 사실상 멈춘다 — 의도치 않은 가용성 부작용(사실상 DoS)이다.
  - 제안: `(?:\\.|(?!(?P=q)).)*` 형태의 모호한 alternation 을 결정적(deterministic) 패턴으로 교체한다. 예: `[^\\'"]*(?:\\.[^\\'"]*)*` (표준 "이스케이프 포함 인용 문자열" 패턴, alternation 겹침 없음). 동일 페이로드로 재검증한 결과 이 대안은 n=2000 백슬래시에서도 <0.1ms 로 선형이었다. 반드시 실패(닫는 인용부호 없음)·매우 긴 백슬래시 런을 코퍼스에 추가해 회귀를 고정할 것 (`test_push_guard_allowlist.py` 현재 코퍼스는 이 케이스를 포함하지 않는다 — 그래서 359건 스위트가 전부 통과해도 이 결함이 드러나지 않았다).

- **[INFO]** 보안 게이트의 판정 범위가 의도적으로 좁아짐 — 영향 반경이 전체 저장소
  - 위치: `.claude/hooks/guard_review_before_push.py:_is_git_push`
  - 상세: 이 함수의 반환값 자체(시그니처는 불변: `(command: str) -> bool`)가 이번 diff 의 핵심 목적대로 일부 이전 차단 케이스(커밋 메시지/heredoc 본문/그다음 pipe 안의 "push" 문구)를 더 이상 차단하지 않도록 변경된다. 이 훅은 `.claude/settings.json` Bash matcher 로 모든 worktree·세션에 전역 적용되므로, 로직에 결함이 있으면 실제 `git push` 가 조용히 통과하는 회귀(리뷰 우회)로 이어질 수 있다. `_redact_inert_text` 의 각 규칙을 직접 추적한 결과(escaped-pipe 치환의 길이 보존, heredoc 종료 탐지가 `.search()`(leftmost)라 실제 종료 지점보다 늦게 잡히는 경우가 구조적으로 불가능함, `-m`/`-F` 값이 안전하지 않으면 매칭 자체가 실패해 차단 유지) 는 "좁게 빗나가면 차단 유지"라는 설계 불변식을 실제로 지키고 있어 이 자체는 결함으로 보지 않는다. 다만 위 CRITICAL 항목이 보여주듯 이 새 코드 경로 자체의 정지(hang) 위험은 별개로 존재한다.
  - 제안: (조치 불요, 참고용) 향후 `_redact_inert_text` 를 수정할 때는 반드시 `test_push_guard_allowlist.py` 의 차등 테스트를 재실행해 "차단 유지" 불변식이 깨지지 않는지 확인.

- **[INFO]** 모듈 private 표면 확장 + 테스트의 내부 결합
  - 위치: `.claude/hooks/guard_review_before_push.py` (신규 모듈 상수 `_LIVE_EXPANSION`, `_ESCAPED_PIPE`, `_HEREDOC_START`, `_COMMIT_STDIN_CMD`, `_SEGMENT_SPLIT`, `_MESSAGE_ARG` 및 함수 `_owns_heredoc_as_message`/`_is_inert`/`_blank`/`_redact_inert_text`/`_blank_commit_heredocs`), `.claude/tests/test_push_guard_allowlist.py`
  - 상세: 새 private 심볼들은 모듈 전역 네임스페이스에 상수/헬퍼로 추가된다 — 전부 불변 객체(컴파일된 정규식, 튜플)이거나 순수 함수이며 어떤 것도 인자를 in-place mutate 하지 않는다(`_blank` 는 새 문자열 반환). 공유 가변 상태나 전역 변수 도입은 없다. 다만 신규 테스트가 `guard._GIT_PUSH.pattern` 문자열 동결과 `guard._is_git_push` 내부 동작을 직접 핀(pin)하므로, 향후 이 파일의 내부 구현(특히 `_GIT_PUSH` 패턴 문자열 자체)을 건드리면 테스트가 즉시 실패하도록 의도적으로 결합되어 있다(주석에도 명시됨). 이는 설계 의도이며 결함은 아니다. `test_push_guard_allowlist.py` 는 `_harness.load_module_by_path("guard_review_before_push", …)` 로 `sys.modules` 에 동일 이름으로 등록하지만, 같은 파일을 subprocess e2e 로 검증하는 기존 `test_guard_review_before_push_main.py` 는 이 로더를 쓰지 않아 이름 충돌은 없음을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** 파일시스템·환경변수·네트워크·이벤트/콜백 부작용 없음
  - 위치: 변경된 두 코드 파일 전체
  - 상세: 신규 함수들은 모두 문자열 입력→문자열/불리언 출력의 순수 연산이며, 파일 I/O, `os.environ` 읽기/쓰기, 네트워크 호출, 이벤트 발행/콜백 등록을 추가하지 않는다. 기존 `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 환경변수 사용도 무변경. `plan/in-progress/*.md` 두 파일의 diff 는 문서(체크박스·서술) 갱신뿐으로 런타임 부작용과 무관하다.
  - 제안: 조치 불요.

## 요약

이번 변경은 `git push` 오탐(false positive) 을 줄이기 위해 blind 1차 정규식(변경 없음, 바이트 단위 동결·테스트로 고정)에 "증명 가능하게 비활성인 텍스트만 지우는" 열거형 allowlist(`_redact_inert_text`)를 얹는 설계로, 전역 상태·파일시스템·환경변수·네트워크·이벤트 콜백 관점에서는 깨끗하다(순수 함수, in-place mutation 없음, 새 I/O 없음). 다만 새로 추가된 `_MESSAGE_ARG` 정규식이 닫는 인용부호를 찾지 못하는 입력에서 지수적 백트래킹(ReDoS)을 일으키는 것을 이 워크트리에서 실측 확인했다(백슬래시 40개로 105초, legacy 패턴은 동일 입력에서 선형 시간) — 이는 이번 diff 이전에는 없던, PreToolUse 훅(모든 Bash 호출을 동기 게이팅)을 무기한 정지시킬 수 있는 신규 가용성 결함이다. 이 하나를 제외하면 시그니처·공개 인터페이스는 보존되고, 판정 로직 완화(release) 자체는 "좁게 빗나가면 안전 방향(차단 유지)"이라는 설계 불변식을 잘 지키고 있다.

## 위험도

CRITICAL
