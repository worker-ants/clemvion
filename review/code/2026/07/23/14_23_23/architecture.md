# 아키텍처(Architecture) 리뷰 — push guard allowlist 재설계

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`,
`plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`

## 발견사항

- **[INFO]** OCP 를 정확히 구현한 확장점 설계
  - 위치: `.claude/hooks/guard_review_before_push.py:55-57`(`_GIT_PUSH`, frozen) / `:106-148`(`_redact_inert_text`)
  - 상세: 1차 blind 정규식은 코드·주석·테스트(`test_blind_pattern_is_frozen`)로 3중 고정되어 "폐쇄"되고,
    새로운 오탐 해제 규칙은 오직 `_redact_inert_text()` 안에 추가하도록 설계돼 "개방"된다.
    "판정을 넓히는 변경은 여기로만" 이라는 단일 진입점이 명확해 향후 규칙 추가(확장성 항목)가
    국소적이다. 앞선 두 번의 shlex 파서 재작성 실패(무한 표면) 경험을 구조적으로 반영한 결과로,
    이 파일만 볼 때는 의도적이고 잘 방어된 설계다.
  - 제안: 없음(현행 유지 권장).

- **[WARNING]** 두 가드 훅의 git 서브커맨드 판정 로직 중복이 이번 변경으로 더 벌어짐
  - 위치: `.claude/hooks/guard_review_before_push.py`(이번에 `_redact_inert_text` 등 ~140줄 추가) vs
    `.claude/hooks/guard_default_branch_bash.py:60-81`(`_MUTATING`, 셸 인용을 전혀 모르는 단순 정규식,
    diff 밖 파일)
  - 상세: 두 훅은 "이 Bash 명령이 어떤 git 동작을 실행하는가" 라는 동일한 문제를 각자 재구현한다.
    이 사실 자체는 `plan/in-progress/harness-guard-followups.md` 의 항목 C 로 이미 추적되고
    있고, 이번 diff 도 그 문서에 "② 재설계 확정 → C 착수 가능, 단 1차 패턴은 각자 두고
    redaction(오탐 해제)만 공유" 라고 정확히 선언해 두었다. 다만 이번 변경으로
    `guard_review_before_push.py` 쪽 redaction 로직이 상당히 정교해진 반면
    `guard_default_branch_bash.py` 는 그대로라, 두 구현의 정교함 격차가 넓어졌다 —
    커밋 메시지 안의 "push"성 단어를 오탐 처리하는 것과 동일한 유형의 문제가
    mutating 서브커맨드 판정에도 있을 수 있는데, 그 개선이 자동으로 전파되지 않는다.
    (`guard_default_branch_bash.py` 는 soft-fail 이라 당장 심각도는 낮음 — plan 도 이를 명시함.)
  - 제안: plan 항목 C 를 이번 PR 범위 밖으로 defer 하는 것은 합리적이나, 후속 PR 에서
    `_lib/git_command_detection.py` (혹은 redaction 전용 `_lib/inert_text_redaction.py`) 로
    `_redact_inert_text`/`_is_inert`/`_ESCAPED_PIPE` 류를 조기에 추출해 두 훅이 공유하도록
    우선순위를 올릴 것을 권한다. 격차가 더 벌어질수록 추출 시 두 훅의 동작을 일치시키는
    회귀 비용이 커진다.

- **[INFO]** `_redact_inert_text` 내부 3개 규칙 사이에 문서화되지 않은 순서 의존성
  - 위치: `.claude/hooks/guard_review_before_push.py:129-148`(`_redact_inert_text`),
    관련 헬퍼 `_SEGMENT_SPLIT`(:303 / 원본 라인 기준 :90 부근), `_owns_heredoc_as_message`
  - 상세: `_redact_inert_text` 는 (1) escaped-pipe 정규화 → (2) heredoc 본문 blanking → (3) 메시지
    인자 blanking 순서로 실행된다. 이 순서는 우연이 아니다 — `_owns_heredoc_as_message` 가 쓰는
    `_SEGMENT_SPLIT = re.compile(r"\|\||&&|[|;\n]")` 는 백슬래시 유무를 보지 않고 원문자
    `|` 를 그대로 구분자로 매칭하므로, heredoc 여는 줄 앞에 정규화되지 않은 `\|`(escaped pipe)가
    있으면 소유 세그먼트 분할이 잘못된 위치에서 끊겨 heredoc 소유권 판정이 틀릴 수 있다.
    즉 (1)이 (2)보다 먼저 실행돼야 하는 이유가 코드에는 있지만, 주석이나 전용 테스트로
    명시되어 있지 않다 — 이는 항목 C 의 `_lib/` 추출처럼 이 함수를 리팩터링/재배치할 때
    조용히 깨질 수 있는 숨은 불변식이다.
  - 제안: `_redact_inert_text` 함수 docstring 에 "순서가 의미 있다(1→2→3), 이유: ..." 를
    한 줄 추가하고, escaped-pipe 가 heredoc 여는 줄 앞에 있는 코퍼스 케이스
    (예: `'git commit -F - <<\'EOF\'\n...\nEOF\n' ` 앞에 `grep "a\|b" |` 를 붙인 형태)를
    `test_push_guard_allowlist.py` CORPUS 에 하나 추가해 회귀를 고정하면 좋다.

- **[INFO]** 테스트가 모듈 private 멤버(`_GIT_PUSH`, `_is_git_push`)를 직접 pin — 의도된 결합
  - 위치: `.claude/tests/test_push_guard_allowlist.py:644-649`(`BlindPassFrozenTest`),
    `:659, 672, 688` 등(`guard._is_git_push` 직접 호출)
  - 상세: 언더스코어 접두 내부 구현이 사실상 테스트의 공개 계약이 되어 있다. "1차 정규식을
    실수로 편집하면 즉시 실패" 라는 목적에는 정확히 맞는 설계(pinning test 패턴)이고
    문서화도 잘 되어 있어 결함은 아니다. 다만 항목 C 에서 이 로직을 `_lib/`
    모듈로 추출하면, `guard` 모듈이 `_GIT_PUSH`/`_is_git_push` 이름을 그대로
    재노출(re-export)하지 않는 한 이 테스트 스위트 전체가 함께 갱신되어야 한다.
  - 제안: 항목 C 추출 시 `guard_review_before_push.py` 에서 `from git_command_detection import
    _GIT_PUSH, _is_git_push  # noqa: F401 (re-export for pinning tests)` 형태로 이름을 보존하는
    쪽을 권장 — 그래야 이 테스트 파일을 고치지 않고도 추출이 가능하다.

## 요약

이번 변경은 "1차 blind 정규식(불변) + 2차 열거된 allowlist(`_redact_inert_text`)" 라는, 세 라운드의
실패(shlex 파서화 시도)를 근거로 명시적으로 설계 반전한 결과이며, 각 해제 규칙이 "좁게 실패하면
안전(차단 유지), 넓게 성공해야만 위험" 이라는 단일한 안전 불변식 아래 정렬돼 있어 응집도가 높고
OCP 를 교과서적으로 만족한다. 순환 의존성이나 레이어 경계 위반은 없으며, 테스트 스위트도
차등 테스트(`legacy ⇒ new` 부분집합 검증) + 동결 테스트 + 뮤테이션 실측으로 구조적 회귀를 상당히
막아둔 상태다. 유일하게 남는 아키텍처적 부채는 `guard_default_branch_bash.py` 와의 로직 중복인데,
이는 이미 `harness-guard-followups.md` 항목 C 로 추적·계획되어 있고 이번 diff 도 그 사실을
정확히 반영해 두었으므로 새로 도입된 결함이라기보다는 "격차가 더 벌어진" 기존 추적 항목이다.
그 외에는 `_redact_inert_text` 내부 규칙 순서 의존성이 문서화되지 않은 점, 테스트가 private
API 에 결속된 점 정도가 향후 리팩터링(항목 C) 시 주의할 지점으로 남는다.

## 위험도
LOW
