# 부작용(Side Effect) 코드 리뷰 — push guard blind+allowlist (누적 diff, origin/main 대비)

## 리뷰 대상

- `.claude/hooks/guard_review_before_push.py` (`_redact_inert_text`/`_MESSAGE_ARG`/`_commit_heredoc_spans`/
  `_owns_heredoc_as_message`/`_blank_spans`/`_is_git_push` 신설·2라운드 성능 수정 포함)
- `.claude/tests/test_push_guard_allowlist.py` (신규, 32건) / `.claude/tests/test_guard_review_before_push_main.py`
  (docstring만 변경)
- `plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`,
  `review/code/2026/07/23/{14_23_23,14_57_32}/**` (문서·이전 리뷰 산출물)

머지베이스(`origin/main`) 대비 로컬 3개 커밋(`6eec7cb80`→`837ebba33`→`cef183faf`)의 누적 diff를 대상으로,
현재 워크트리의 실제 소스(`guard_review_before_push.py`)를 직접 읽고 대화형으로 실행해 검증했다.

## 검증 방법

- 리포지토리 전체에서 `_is_git_push`/`_redact_inert_text`/`guard_review_before_push` 참조를 grep — 이 모듈을
  `import`해서 내부 함수를 직접 호출하는 곳은 신규 테스트 파일 하나뿐임을 확인(시그니처/인터페이스 영향 범위 확정).
- 현재 `_is_git_push`/`_redact_inert_text`를 직접 호출해 이전 3건의 CRITICAL(홑따옴표 우회·ReDoS·확장 unmask)이
  실제로 고쳐졌는지, 그리고 side-effect 관점에서 새로 도입된 함수들이 순수(pure)한지 재확인.
- 이번 재설계가 만드는 새로운 상호작용면 — heredoc span 계산(`_commit_heredoc_spans`)과 메시지 인자 span 계산
  (`_MESSAGE_ARG`)이 **같은 명령 문자열 위에서 겹칠 때** `_blank_spans`가 어떻게 처리하는지 — 을 목표로 추가
  PoC 4종을 직접 구성해 실행(따옴표 안에 가짜 heredoc 마커를 심는 경우, 닫는 구분자를 못 찾는 경우, 들여쓰기된
  가짜 닫는 줄 등). 전부 안전한 방향(과소 해제/과대 차단)으로 수렴함을 확인 — 실측 로그는 발견사항 아래 참고용으로만
  남긴다(신규 결함 아님).

## 발견사항

- **[INFO]** 신규 전역 상수 8개 — 전부 불변(모듈 임포트 시 1회 컴파일되는 `re.Pattern`/`tuple`), 런타임 뮤테이션 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:78-113` (`_LIVE_EXPANSION`, `_ESCAPED_PIPE`, `_HEREDOC_START`,
    `_SEGMENT_IS_GIT`, `_COMMIT_OR_TAG`, `_STDIN_FILE_FLAG`, `_SEGMENT_SPLIT`, `_MESSAGE_ARG`)
  - 상세: 전부 모듈 스코프의 `re.compile(...)` 결과 또는 `tuple` 리터럴이며, 어떤 함수도 `global` 키워드로
    이들을 재바인딩하지 않는다. `_GIT_PUSH`(기존, 동결)를 포함해 모듈에는 여전히 변경 가능한 전역 상태가 없다.
    "새 전역 변수 도입" 항목에 해당하지만 전부 read-only 상수라 부작용 위험은 없음.
  - 제안: 없음(정보 제공용).

- **[INFO]** 시그니처·인터페이스 — `_is_git_push(command: str) -> bool` 시그니처 불변, 신규 헬퍼는 전부 추가적
  - 위치: `.claude/hooks/guard_review_before_push.py:254-276` (`_is_git_push`), 그 외 신규 private 함수 5개
  - 상세: `git grep`으로 리포지토리 전체를 확인한 결과 `_is_git_push`/`_redact_inert_text`를 임포트해 호출하는
    곳은 신규 테스트 파일(`test_push_guard_allowlist.py`) 하나뿐이다. `main()`·`_read_payload()`·`_REVIEW_MSG`/
    `_PLAN_MSG`·두 게이트(`evaluate_review`/`evaluate_plan`) 호출 지점은 diff에서 손대지 않았다(직접 확인).
    형제 훅 `guard_default_branch_bash.py`(`_MUTATING` 정규식, 서브커맨드 판정 로직 중복)도 이번 diff와 완전히
    독립이며 우연한 커플링이 없다 — 항목 C(`_lib/` 공유 추출)는 plan에 명시된 대로 여전히 미착수 상태로 남아 있다.
    이 훅은 하네스 내부 전용(공개 API 아님)이라 외부 소비자 영향 없음.
  - 제안: 없음.

- **[INFO]** 환경 변수 — 신규 read/write 없음
  - 위치: `.claude/hooks/guard_review_before_push.py::main` (diff 밖, 미변경)
  - 상세: `os.environ.get("BYPASS_REVIEW_GUARD")`/`BYPASS_PLAN_GUARD` 두 개뿐이며 이번 diff가 건드리지 않은
    영역이다. `_redact_inert_text`/`_is_git_push` 등 신규 로직은 환경 변수를 전혀 참조하지 않는다.
  - 제안: 없음.

- **[INFO]** 파일시스템/네트워크 — 훅 본체는 여전히 stdin만 읽고 아무것도 쓰지 않음; 신규 부작용은 테스트
  프로세스에만 국한
  - 위치: `.claude/hooks/guard_review_before_push.py::_read_payload`(미변경) / 신규 `BacktrackingTest`
    (`.claude/tests/test_push_guard_allowlist.py:301-374`)
  - 상세: 훅 자체는 이번 diff로도 파일 생성·수정·삭제나 네트워크 호출을 전혀 하지 않는다. 유일하게 새로 생긴
    프로세스 수준 부작용은 **테스트 인프라**에 있다 — `BacktrackingTest._run_guard_out_of_process`가
    `subprocess.run([sys.executable, "-c", script], ..., timeout=10.0)`으로 자식 파이썬 프로세스를 스폰해
    `importlib.util.spec_from_file_location`로 훅 파일을 다시 로드한다. 이유는 문서화되어 있다(파국적
    백트래킹은 C 레벨 `re` 안에서 발생해 인프로세스 타이밍/시그널로 못 잡음). `timeout=` 지정 시
    `subprocess.run`은 `TimeoutExpired` 발생 전에 프로세스를 kill+wait 하므로 타임아웃 시에도 좀비 프로세스가
    남지 않는다 — 실제로 `test_unterminated_quote_with_long_backslash_run_is_fast`/
    `test_repeated_subcommand_word_without_stdin_flag_is_fast` 두 테스트가 이 경로를 여러 번(서브테스트당 1회)
    호출하지만 정리는 표준 라이브러리가 보장한다. 프로덕션 훅 실행 경로에는 영향 없음(테스트 전용).
  - 제안: 없음(설계 의도대로 안전하게 격리됨).

- **[INFO]** 이벤트/콜백 빈도 변화 — `evaluate_review()`/`evaluate_plan()` 호출 트리거 조건이 좁아짐(의도된 효과),
  단 `_is_git_push()` 호출 지점 자체는 여전히 fail-open 방어망 밖에 있음
  - 위치: `.claude/hooks/guard_review_before_push.py::main` L319-336
  - 상세: `main()`은 `evaluate_review()`/`evaluate_plan()` 두 호출만 각각 `try/except`로 감싸 실패 시
    "fail open on internal error"로 처리한다. 그 앞의 `if not _is_git_push(command): return 0` 호출 자체는
    이번 diff 이전에도 try/except 밖이었지만, 그때는 `_is_git_push`가 정규식 1회 매치에 불과해 예외를 던질
    표면이 사실상 없었다. 이번 diff로 `_is_git_push`는 4개의 보조 정규식 + heredoc 탐색 루프 + span 재조립을
    거치는 ~150줄 로직이 되었고, 그 어디서든(예: 예기치 못한 입력에 대한 미처리 예외) 예외가 발생하면
    `main()` 밖으로 전파되어 파이썬 인터프리터의 기본 처리(트레이스백 출력 + non-zero exit)로 귀결된다.
    파일 상단 docstring의 "any other → treated as runtime error; tool call proceeds (fail-open)" 계약상
    이는 **정책적으로 허용된 방향**이고, 이미 `plan/in-progress/harness-guard-followups.md` §E(3중 fail-open,
    사용자/팀 판단 필요)로 별도 추적 중이며 지난 두 라운드(14_23_23 security INFO#10, 14_57_32) 모두 "이번
    diff가 도입한 정책이 아니라 선재 사항, 범위 밖"으로 판정했다 — 새로운 문제는 아니다. 다만 그 fail-open
    경로 앞에 실제로 실행되는 코드량이 이번 diff로 크게 늘었으므로, **노출 표면이 커졌다는 사실 자체**는
    side-effect 관점에서 기록해 둘 가치가 있다. 광범위한 회귀 테스트(32건 신규 + 뮤테이션 검증)로 알려진
    입력 공간에서 예외가 발생하지 않음은 실측 확인됨.
  - 제안(선택, 차단 아님): 여유가 될 때 `_is_git_push(command)` 호출도 `evaluate_review`/`evaluate_plan`과
    같은 `try/except` 패턴으로 감싸, 예외 시 구조화된 `_REVIEW_MSG`/`_PLAN_MSG` 대신 파이썬 기본 트레이스백만
    남는 비일관성을 줄이는 것을 고려. 정책 자체(§E)는 건드리지 않는 선에서 방어적 일관성만 높이는 제안이다.

- **[INFO]** span 겹침 처리(`_blank_spans`)의 "안전한 쪽으로만 치우침" 확인 — 부작용성 회귀 아님
  - 위치: `.claude/hooks/guard_review_before_push.py:158-176`(`_blank_spans`), `:212-241`(`_commit_heredoc_spans`)
  - 상세: `_redact_inert_text`는 heredoc span과 `-m`/`-F` 메시지 span을 **각각 독립적으로 계산**한 뒤
    `_blank_spans`에서 한 번에 정렬·재조립한다. 정렬 후 `start < prev`인 span은 "이미 커버됨"으로 통째로
    건너뛴다(부분 겹침이어도 잘라서 적용하지 않음). 이 설계가 "실행 가능한 텍스트를 지워버리는" 방향으로
    악화될 수 있는지 — 즉 heredoc 탐지가 인용 컨텍스트를 모르는 나이브 텍스트 스캔이라 `-m "... <<EOF ..."`
    처럼 메시지 값 **내부**에 가짜 heredoc 마커가 있는 입력에서 두 span 계산이 잘못 상호작용해 실제
    `&& git push`를 지워버리는지 — 를 직접 PoC 4종으로 검증했다(따옴표 안 가짜 heredoc·닫는 구분자 없음·
    들여쓰기된 가짜 닫는 줄·`-m` 안 heredoc 마커 뒤 별도 `bash -c` heredoc). 4건 모두 `_is_git_push`가 여전히
    `True`(차단 유지)이거나, `False`가 나온 유일한 경우(닫는 구분자를 끝내 못 찾아 본문이 문자열 끝까지 번짐)는
    실제 bash에서도 같은 입력이 "unterminated heredoc" 구문 오류로 **아무것도 실행되지 않는** 경우와 일치해
    안전함을 확인했다(실행되지 않는 명령을 놓아준 것은 우회가 아님). 새로운 결함이 아니라 설계가 의도한
    안전 불변식("좁게 실패 = 차단 유지, 안전")이 이 상호작용면에서도 유지됨을 확인한 것.
  - 제안: 없음 — 참고용 검증 기록. 다만 이 상호작용면은 `CORPUS`에 명시적 케이스로 없으므로(테스트 커버리지는
    testing 리뷰어 관점), 회귀 고정을 원한다면 `-m` 값 내부에 리터럴 `<<DELIM` 문자열이 들어간 케이스 1건을
    `ReleaseRefusedTest`류에 추가하는 것을 고려할 수 있다(차단 아님, 강화 제안).

## 스코프 밖으로 확인된 항목 (문제 없음)

- `plan/in-progress/*.md`, `review/code/2026/07/23/{14_23_23,14_57_32}/**` 변경은 전부 문서·리뷰 산출물이며
  런타임 부작용과 무관(파일시스템에 새 문서가 "커밋"되는 것은 이 리포지토리의 review 산출물 보관 컨벤션에
  따른 의도된 쓰기이지, 코드 실행 중 발생하는 부작용이 아님).
- `test_guard_review_before_push_main.py`는 docstring 한 단락만 변경되었고 실행 로직·assertion은 그대로다.

## 요약

이번 누적 diff(`6eec7cb80`→`837ebba33`→`cef183faf`)는 순수 함수 확장으로 구성되어 있다 — 새 전역 가변
상태·환경 변수·파일시스템/네트워크 부작용은 없고, `_is_git_push`의 공개 시그니처도 보존되며 이 모듈을
소비하는 곳은 신규 테스트뿐임을 grep으로 확인했다. 유일하게 side-effect 렌즈에서 의미 있는 관찰은
(1) `main()`에서 `_is_git_push()` 호출이 여전히 두 게이트와 달리 try/except 밖에 있어, 이번 diff로 대폭
커진 판정 로직의 예외가 구조화된 차단 메시지 없이 기존 §E fail-open 정책으로 흘러가는 표면이 넓어졌다는 점
(정책 자체는 선재·범위 밖으로 이미 처분됨), (2) heredoc span과 메시지 span이 같은 문자열 위에서 겹치는
입력을 어드버서리얼하게 4종 구성해 직접 실행 검증한 결과 전부 안전한 방향(차단 유지 또는 실제로 실행되지
않는 명령의 방면)으로 수렴함을 확인했다는 점이다. 테스트 파일이 도입한 서브프로세스 스폰(`BacktrackingTest`)도
타임아웃·정리가 표준 라이브러리 보장 범위 안에 있어 안전하다. 새로 도입된 CRITICAL 성격의 부작용은 발견하지
못했다.

## 위험도

LOW
