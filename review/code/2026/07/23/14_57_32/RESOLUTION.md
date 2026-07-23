# RESOLUTION — ② push 가드 2라운드 (CRITICAL 수정 검증 + 신규 hang 표면)

리뷰: `review/code/2026/07/23/14_57_32/SUMMARY.md` — RISK=MEDIUM, **Critical 0**, Warning 4.
forced 7명 전원 확보(`forced_missing: []`).

1라운드 CRITICAL 3건(C1 홑따옴표 우회 / C2 ReDoS / C3 확장 unmask)은 **리뷰어들이 PoC 를 재실행해
전부 정상 수정 확인**했다. 이번 라운드의 핵심은 **그 수정 자체가 새로 연 hang 표면**이다.

## Warning (4) — 전부 반영

### W1 (side_effect/성능) — 내 CRITICAL 수정이 새 O(n²) 백트래킹을 열었다

`_COMMIT_STDIN_CMD` 는 `commit|tag` 앞뒤로 **그리디 `[^\n]*` 두 개**를 두었다. 두 구간이 겹쳐서,
`commit` 이 반복되고 끝내 `-F -` 를 못 찾는 입력이면 엔진이 모든 분할을 시도한다. C2 와 **같은
피해 범주**(PreToolUse 동기 게이팅 → 세션 정지)인데 `BacktrackingTest` 는 `_MESSAGE_ARG` 만
겨냥해 이 경로를 전혀 pin 하지 않았다.

**재현(수정 전)**: 입력 2배 → 시간 4배. 27KB 0.646s / 54KB 2.65s / 109KB 10.3s / 205KB **38.0s**.
같은 길이 일반 텍스트는 0.0004s.

**수정**: 하나의 정규식을 **서로 독립인 단일 패스 probe 3개**로 분리 —
`_SEGMENT_IS_GIT`(세그먼트가 git 명령인가) → `_COMMIT_OR_TAG`(서브커맨드 단어) →
`_STDIN_FILE_FLAG`(그 **뒤에서** stdin 플래그 탐색). 같은 텍스트 위에 중첩 수량자가 없다.
**재현(수정 후)**: 205KB 0.0138s, 448KB 0.0097s — 선형.

### W2 (성능) — span 마다 전체 문자열 복사

`_blank()` 가 span/heredoc 개수만큼 O(n) 복사를 반복해 O(n·k) 였다.
→ `_blank_spans()` 로 **한 번의 선형 재조립**(정렬 후 join, 겹침 span 흡수). `_blank_commit_heredocs`
도 in-place 변경 대신 **span 을 반환**하도록 바꿔 모든 redaction 을 한 번에 적용한다.

### W3 (문서 drift) — 이웃 테스트 docstring

`test_guard_review_before_push_main.py` 가 "`_is_git_push` 는 전용 테스트가 전혀 없다" 고 서술.
**이 PR 이 바로 그 갭을 닫았다**(D PR 에서 리뷰 지적으로 정정한 문구가 이번엔 반대로 stale).
→ "detection 은 `test_push_guard_allowlist.py` 가 커버, 이 파일은 main() 오케스트레이션" 으로 갱신.

### W4 (문서 drift) — plan 체크리스트 수치

"17건 / 359건" 은 C1~C3 수정 **이전** 수치라 RESOLUTION·실측과 모순.
→ 숫자를 박는 대신 **RESOLUTION 참조**로 바꿨다. 라운드마다 바뀌는 값을 두 곳에 박으면 같은
drift 가 반복된다.

## ⚠️ 내가 만든 회귀 테스트가 vacuous 였다 (뮤테이션이 잡음)

W1·W2 회귀 테스트를 추가한 뒤 뮤턴트를 돌렸더니 **둘 다 통과** — 즉 아무것도 지키지 못했다.
원인은 입력 크기: W1 은 8000 repeats(54KB)를 썼는데 옛 코드도 2.65s 로 10초 타임아웃 안이었다.

- **W1 테스트**: 옛/새 구현을 나란히 실측해 크기를 재선정 — **30,000 repeats(205KB)**
  (OLD 38.0s vs NEW 0.014s). 16,000 은 10.3s 로 타임아웃 경계라 부적합. 뮤턴트 재검증 → 포착 ✓.
- **W2 테스트**: timing gate 를 **철회**했다. 이 quadratic 은 memcpy 라 현실 크기(≤100KB,
  ≤1k span)에서 수십 ms 다 — 임계 테스트가 vacuous 하거나 비현실적 입력을 요구한다.
  대신 `BlankSpansTest` 로 **재조립 계약**(길이 보존·미정렬 span·겹침 span·빈 입력)을 고정했다.
  vacuous 테스트는 없는 것보다 나쁘다(거짓 확신).

## INFO 중 반영한 것

- #9 `_SEGMENT_IS_GIT` 의 env-assignment 분기가 **테스트상 dead** → `GIT_EDITOR=vim git commit -F -`
  heredoc 해제 케이스를 코퍼스에 추가(실제로 그 분기를 태움을 확인).
- #6 `-am` / `--message ` (공백형) 미인식 → `KnownRemainingFalsePositiveTest` 에 고정(보수적
  오탐이라 안전 방향이지만 발견 가능하게).
- #1 `_LIVE_EXPANSION` 에 프로세스 치환이 없는 이유(인용/heredoc 안에서는 미트리거) 주석 추가.
- #5 `_redact_inert_text` 규칙 **순서 의존성** docstring 명시.
- #8/#12 공백 줄 — 3줄 런 0건 확인(이미 해소됨).

## INFO 중 미반영(사유)

- #2 `main()` 3중 fail-open: 선재 정책, plan §E 추적 중. 범위 밖.
- #3 아키텍처 강점 확인(조치 불요) / #4 항목 C 조기 추출: 별 PR.
- #7 heredoc 종료 구분자가 POSIX 보다 관대: 리뷰어도 "항상 과소-해제(차단 유지) 방향" 이라 명시.
- #10 release 케이스 e2e 스모크: 우선순위 낮음(유닛+differential 로 이미 두텁다).
- #11 인라인 예시 문자열 축약: 예시임이 문맥상 자명.

## 검증

- `test_push_guard_allowlist.py` **32건**, 전체 하네스 스위트 **374건 OK**.
- 뮤턴트: W1 되돌림 → `test_repeated_subcommand_word_without_stdin_flag_is_fast` 포착 ✓
  (치환 적용·문법 검사 선행 후 측정).
- 동작 동등성: 해제 6종·차단 7종 13케이스 전부 수정 전후 동일.
