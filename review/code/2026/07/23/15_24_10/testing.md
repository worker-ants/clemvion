# 테스트(Testing) 리뷰 — push guard allowlist (3라운드 누적 diff, fresh review)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`(491줄,
신규), `.claude/tests/test_guard_review_before_push_main.py`(독스트링만), `plan/in-progress/harness-
guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`. diff base 는
`origin/main`(`git diff origin/main HEAD`, 3개 커밋 `6eec7cb80`→`837ebba33`→`cef183faf` 누적).
`review/code/2026/07/23/{14_23_23,14_57_32}/**` 는 이 작업 자체에 대한 이전 두 라운드 리뷰 산출물
(코드 아님)이라 테스트 분석 대상에서 제외했다.

이 diff 는 이미 2회의 `/ai-review` 사이클을 거쳤다 — 1라운드가 CRITICAL 3건(홑따옴표 우회·ReDoS·
확장 unmask)을, 2라운드가 그 수정 자체가 새로 연 O(n²) 표면(WARNING)을 찾아 모두 수정됐다고
주장한다. 이번 라운드는 그 주장을 **직접 실행 + 독립 뮤테이션**으로 재검증하는 데 집중했다.

## 실행 검증 (직접 수행)

- `python3 -m unittest discover -s .claude/tests -p "test_*.py"` → **374/374 OK** (plan/RESOLUTION
  주장과 일치).
- `python3 -m unittest test_push_guard_allowlist -v` → **32/32 OK**, `BacktrackingTest` 2건 포함
  전체 0.15초(서브프로세스 기반인데도 빠름 — 현재 구현이 실제로 선형임을 뒷받침).

## 독립 뮤테이션 재검증 (3종, 전부 cp 백업 → 적용 → 실행 → 복원, 최종 `git status --short` clean 확인)

- **뮤턴트 1 — 2라운드 이전의 실제 취약 정규식을 `git show 837ebba33`에서 바이트 단위로 그대로
  재도입**(`_owns_heredoc_as_message`를 3-probe 분해 이전의 단일 `_COMMIT_STDIN_CMD`로 되돌림).
  `BacktrackingTest.test_repeated_subcommand_word_without_stdin_flag_is_fast` 가 정확히 예상대로
  **10.11초에 `TimeoutExpired`로 FAIL** — 2라운드 W1 회귀 테스트가 vacuous 하지 않음을 재현 코드
  기준으로 직접 확인했다(참고: 손으로 근사 재구성한 유사 정규식(trailing `[^\n]*$` 생략)으로는
  30,000 반복에서 2.26초에 그쳐 타임아웃을 못 넘겼다 — **바이트 정확한 재현이 아니면 이런 종류의
  다항 백트래킹 결함은 재현/재검증 결과가 크게 달라질 수 있다**는 점 자체가 이 테스트 설계에서
  주목할 교훈이다).
- **뮤턴트 2 — `_SEGMENT_IS_GIT`에서 env-assignment 접두 그룹 제거**(`^\s*(?:[A-Za-z_]
  [A-Za-z0-9_]*=\S+\s+)*git\b` → `^\s*git\b`). `test_every_enumerated_release_actually_releases`
  가 `GIT_EDITOR=vim git commit -F - <<'EOF'...` 케이스에서 정확히 FAIL — 2라운드 리뷰가 "테스트상
  dead branch"로 지적했던 분기가 이번 diff 에서 코퍼스에 추가된 케이스로 **실제로 살아 있는
  회귀 가드가 됐음**을 확인했다.
- **뮤턴트 3 — `_SEGMENT_SPLIT`에서 `\|\|` 대안 제거**(`r"\|\||&&|[|;\n]"` → `r"&&|[|;\n]"`). 전체
  32건이 **변화 없이 그대로 통과**(0 실패). `_SEGMENT_SPLIT`은 오직 `_owns_heredoc_as_message`
  한 곳에서만 `[-1]`(마지막 세그먼트)을 취하는 데 쓰이는데, `split()`의 마지막 요소를 기준으로는
  `\|\|`를 하나의 토큰으로 다루든 `|`를 두 번 개별 매치하든(그 사이에 빈 세그먼트가 하나 더
  생길 뿐) **결과가 항상 동일**하다(Python REPL 로 직접 확인: `"a||git commit -F -"`,
  `"x||y||git commit -F -"` 등 3개 입력 모두 두 패턴이 같은 tail 세그먼트를 반환). 아래 발견사항
  참고.

## 발견사항

- **[INFO]** `_SEGMENT_SPLIT`의 `\|\|` 분기가 현재 유일한 호출부 기준으로 테스트 불가능한(그리고
  실제로 무의미한) 코드
  - 위치: `.claude/hooks/guard_review_before_push.py:113`(`_SEGMENT_SPLIT = re.compile(r"\|\||&&|
    [|;\n]")`), 호출부 `:123`(`_owns_heredoc_as_message`, `.split(prefix)[-1]`)
  - 상세: 주석("Naive separator split...")은 이 정규식이 "인용 문자열 내부에서 잘못 분리돼도
    안전 방향"이라는 설계 의도를 설명하지만, `\|\|`를 `[|;\n]`(단일 파이프 포함)보다 먼저 두는
    이유는 설명하지 않는다. 위 뮤턴트 3 이 보이듯, **마지막 세그먼트만 취하는 현재 사용 방식에서는
    `\|\|`전용 분기가 결과에 어떤 영향도 주지 않는다** — 그래서 어떤 테스트도(CORPUS 33건 + 전용
    테스트 전체) 이 분기가 제거돼도 실패하지 않는다. 안전 결함은 아니다(옳은 방향으로도 틀린
    방향으로도 동작을 바꾸지 않음이 실측으로 확인됨). 다만 "왜 이 분기가 존재하는가"를 코드도
    테스트도 설명하지 못하는 상태로 남아 있어, 향후 유지보수자가 이를 "의미 있는 안전장치"로
    오인해 손대기를 꺼리거나, 반대로 무심코 지웠다가 (`_SEGMENT_SPLIT`이 훗날 `[-1]`이 아닌 다른
    용도로 재사용될 경우) 실제로 의미가 생기는 순간을 놓칠 수 있다.
  - 제안: 우선순위 낮음. 둘 중 하나 — (a) `\|\|` 분기를 제거해 `_SEGMENT_SPLIT`을 `r"&&|[|;\n]"`로
    단순화(동작 무변화, 뮤턴트 3으로 확인됨), 또는 (b) 유지한다면 주석에 "현재는 `[-1]` 사용 방식상
    동작에 영향 없음 — `_SEGMENT_SPLIT`을 다른 세그먼트 인덱스에 쓰게 될 미래를 대비한 정확성"
    같은 한 줄을 남겨 "테스트가 못 잡는 이유"를 의도로 남긴다.

- **[INFO]** (2라운드에서 이월, 여전히 미반영 — 낮은 우선순위로 재확인) `main()` 오케스트레이션과
  `_is_git_push` 유닛 테스트 사이의 통합 이음매(release 판정된 명령이 실제 하네스 프로세스에서
  exit 0 을 받는가)를 검증하는 e2e 스모크가 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:280` 부근(`main()`이 `_is_git_push(command)`
    직접 호출) / `.claude/tests/test_guard_review_before_push_main.py`(release 케이스 0건, 여전히
    "unambiguous commands"만 사용)
  - 상세: 2라운드 리뷰(`14_57_32/testing.md` INFO #3)가 이미 지적했고 이번 diff는 그 파일의
    **독스트링만** 갱신했을 뿐(파일 2, 16줄 diff) release 경로 e2e 케이스는 추가되지 않았다. 위험은
    낮다 — `_is_git_push`가 25건대비 32건의 전용 유닛 테스트로 두텁게 커버되고 `main()`의 분기
    로직 자체는 단순하다.
  - 제안: 우선순위 낮음. `test_guard_review_before_push_main.py`에 "release 되는 커밋 메시지(예:
    `git commit -m "add push notification"`)가 STUB_REVIEW=blocked 상태에서도 리뷰 게이트를 타지
    않고 exit 0" 케이스 1건을 추가하면 유닛-레벨 정확성과 프로세스 배선 사이의 이음매가 막힌다.

## 회귀 테스트 유효성 (직전 두 라운드 대비)

- 1라운드 CRITICAL 3건(C1/C2/C3)과 2라운드 WARNING 4건(W1 O(n²)/W2 O(n·k)/W3·W4 문서 drift)
  전부에 대응하는 회귀 테스트가 이번 최종 상태에 실재하고, 그 중 성능 관련 2건(W1의 후신인
  `test_repeated_subcommand_word_without_stdin_flag_is_fast`, 그리고 env-assignment 커버리지)을
  독립 뮤테이션으로 직접 재확인해 vacuous 하지 않음을 검증했다(위 참고).
- 2라운드가 지적한 문서 drift 2건도 이번 diff 에서 실제로 해소됨을 확인했다: (a)
  `test_guard_review_before_push_main.py` 모듈 독스트링이 "`_is_git_push`에 전용 테스트가 없다"는
  이제-거짓인 서술에서 "detection 은 `test_push_guard_allowlist.py`가 커버, 이 파일은 main()
  오케스트레이션"으로 정정됨. (b) plan 체크리스트가 라운드마다 바뀌는 건수(17건/359건 등)를
  하드코딩하는 대신 `RESOLUTION.md` 참조로 대체돼 동일 drift 재발을 구조적으로 막음.
- 테스트 격리: `test_push_guard_allowlist.py`는 모듈 레벨에서 훅을 1회 로드해 순수 함수만
  호출하며 상태를 바꾸지 않는다. `BacktrackingTest`만 실제 서브프로세스를 새로 띄워 실행되므로
  다른 테스트와 완전히 독립적이다(catastrophic backtracking 이 시그널을 무시해 in-process 로는
  검증 불가능하다는 점을 정확히 설계에 반영). 전체 스위트 374건이 순서 무관하게 통과함을 확인했다.
- 가독성: `CORPUS`(command, note, release_reason) 3-필드 단일 리스트 + `RELEASED` 파생, `subTest`
  파라미터화, 각 CRITICAL 회귀 테스트 docstring 에 "무엇이 왜 깨졌는지"와 PoC 를 병기하는 패턴이
  이번 최종 상태까지 일관되게 유지됨.

## 요약

3라운드에 걸친 이 diff 의 테스트 방법론(동결 테스트 + 차등 테스트 + 해제-사유 stale 방지 테스트 +
서브프로세스 하드 타임아웃 ReDoS 테스트)은 실행(374/374, 32/32)과 3종의 독립 뮤테이션(바이트 정확한
이전 취약 정규식 재도입 포함)으로 재확인한 결과 전부 유효하고 vacuous 하지 않다. 직전 두 라운드가
찾은 CRITICAL 3건·WARNING 4건은 이번 최종 상태에서 코드·테스트 양쪽으로 실제 해소됐음을 독립적으로
검증했다. 새로 발견한 갭은 둘 다 심각도가 낮다 — `_SEGMENT_SPLIT`의 `\|\|` 분기가 현재 유일한
호출부 기준으로는 테스트로도 동작으로도 아무 영향이 없는(그러나 안전하지도 위험하지도 않은) 코드로
남아 있다는 점(INFO), 그리고 2라운드부터 이월된 `main()` ↔ `_is_git_push` 통합 이음매 e2e 스모크
부재가 이번에도 반영되지 않았다는 점(INFO)이다. Critical/Warning 급 신규 테스트 결함은 발견하지
못했다.

## 위험도

LOW
