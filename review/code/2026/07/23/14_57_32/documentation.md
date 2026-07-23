# 문서화(Documentation) 리뷰 — push guard allowlist (C1~C3 수정 반영본)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`,
`plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`,
`review/code/2026/07/23/14_23_23/*`(직전 라운드 리뷰 산출물, 신규 커밋)

## 발견사항

- **[WARNING]** plan 체크리스트의 테스트 건수가 최종 상태(C1~C3 수정 후)와 불일치
  - 위치: `plan/in-progress/harness-push-guard-subcommand-detection.md` `## 체크리스트` —
    `- [x] 차등 테스트 + 위 코퍼스 고정 (`test_push_guard_allowlist.py` 17건, 전체 스위트 359건)`
  - 상세: 같은 diff 안의 `review/code/2026/07/23/14_23_23/RESOLUTION.md` `## 검증` 절은
    `test_push_guard_allowlist.py` 25건, 전체 하네스 스위트 367건으로 적고 있고, 실측
    (`grep -c "    def test_" .claude/tests/test_push_guard_allowlist.py` → 25)도 25건과
    일치한다. 즉 체크리스트의 "17건/359건"은 C1~C3 CRITICAL 수정으로 `ReleaseRefusedTest`·
    `BacktrackingTest`·`KnownRemainingFalsePositiveTest` 등이 추가되기 **이전** 시점의 수치가
    남아 있는 것이다(위쪽 `## 검증 (재도전 시 필수)` 섹션도 같은 "17건" 근거를 마지막에
    갱신하지 않은 것으로 보인다). 같은 커밋에 두 문서가 서로 다른 최종 건수를 기록해,
    나중에 "차등 테스트가 몇 건 고정됐는가"를 이 plan 만 보고 확인하려는 사람은 실제보다
    적은 수를 믿게 된다. 기능적 영향은 없음(테스트 자체는 실행되고 통과) — 순수하게
    plan 문서와 실제 상태 간의 기록 drift.
  - 제안: 체크리스트 항목을 RESOLUTION.md 와 동일한 최종 수치(25건 / 367건)로 갱신하거나,
    "C1~C3 수정 후 25건으로 증가, 상세는 RESOLUTION.md 참고"처럼 시점을 명시. 이 프로젝트는
    "plan 체크박스 = 실제 상태"를 원칙으로 삼고 있어(리비전 이력에 이미 여러 차례 지적된
    패턴), 숫자 필드도 같은 기준을 적용하는 편이 일관적이다.

- **[INFO]** `_is_git_push()` 인라인 주석의 예시 명령이 실제 pin 된 코퍼스 문자열과 축약되어 다름
  - 위치: `.claude/hooks/guard_review_before_push.py::_is_git_push` (C3 관련 인라인 주석) —
    `#   git commit -m "fix: retry push bug" && echo "$(git push origin main)"`
  - 상세: 동일 결함(C3)을 가리키는 실제 회귀 테스트 케이스는
    `.claude/tests/test_push_guard_allowlist.py::CORPUS` 와 `RESOLUTION.md`/`SUMMARY.md` 양쪽
    모두 `git commit -m "fix: retry push notification bug" && echo "log: $(git push origin main)"`
    (단어 "notification", 접두어 "log: " 포함)로 동일하게 재현되어 있다. 코드 주석만
    "notification"과 "log: "를 생략한 축약형을 쓰고 있어, 이 결함을 추적하려는 사람이 코드
    주석의 문자열로 테스트 파일을 grep 하면 매치되지 않는다. 동작에는 영향 없음(주석일 뿐).
  - 제안: 인라인 주석의 예시를 CORPUS 항목과 완전히 동일한 문자열로 맞추거나("verbatim,
    see CORPUS"), 지금처럼 축약할 경우 "illustrative, see CORPUS for the exact pinned string"
    한 마디를 덧붙여 두 문자열이 의도적으로 다른 것임을 명시.

## 확인된 강점 (참고)

- `_is_git_push()`에 요약 독스트링이 이번 diff 에서 실제로 추가되어 있음을 확인
  (`"""True when this Bash command should be treated as a `git push`. Blind first pass,
  then an enumerated allowlist that can only SUBTRACT."""`) — 직전 라운드
  (`review/code/2026/07/23/14_23_23/documentation.md`) INFO #8이 지적한 항목이 실제로
  반영되어 코드에 존재함을 재확인했다(RESOLUTION.md의 "반영" 주장과 코드 실측이 일치).
- 같은 라운드 INFO #9(모듈 독스트링에 설계 안내 추가)는 RESOLUTION.md에서 "설계 설명은
  `_GIT_PUSH` 바로 위 블록 주석이 발견 지점으로 더 자연스럽다"는 근거로 의도적으로
  미반영 처리했고, 실제로 그 블록 주석(`_GIT_PUSH` 정의 직전)이 설계·SoR·"DO NOT EDIT"
  경고를 모두 담고 있어 근거가 타당하다. 재지적하지 않음.
- `_redact_inert_text`/`_blank_commit_heredocs`/`_owns_heredoc_as_message`/`_is_inert`/`_blank`
  전부 "무엇을·왜"를 함께 설명하는 독스트링·인라인 주석을 갖췄고, 실패한 이전 설계
  시도(예: heredoc "언급" 판정이 `echo "git commit -F -" | bash <<'EOF'` 로 뚫린 사례,
  C1 홑따옴표 이스케이프 오판정, C2 겹치는 alternation)까지 코드 옆에 실측 수치와 함께
  남겨 재발을 구조적으로 막는다.
- `_MESSAGE_ARG` 정규식 주석이 홑따옴표/겹따옴표 처리 차이를 POSIX 셸 의미론에 근거해
  정확히 설명하고, 두 대안이 disjoint 해야 하는 이유(ReDoS 방지)까지 명시 — 코드와
  일치함을 정규식 자체와 대조해 확인.
- `.claude/tests/test_push_guard_allowlist.py` 모듈 독스트링이 차등 테스트 전략·회귀
  이력·C1~C3 재현/수정 요약을 정확히 기술하고, `BacktrackingTest` 클래스 독스트링이
  "서브프로세스 + 하드 타임아웃으로 측정해야 하는 이유"(C-level `re` 는 시그널을 받지
  않아 in-process 타이밍 단언이 아예 hang 한다)까지 설명해, 향후 이 설계를 되돌리려는
  시도를 막는 문서로서 기능한다.
- `plan/in-progress/harness-guard-followups.md` 의 항목 C 갱신은 "재설계가 blind+allowlist
  로 확정됐으니 착수 가능하나, 두 훅의 1차 판정 로직 자체는 공유하지 않고 redaction 로직만
  공유한다"는 구체적 방향까지 정확히 기록해 향후 작업자가 바로 시작할 수 있게 해둠.
- CHANGELOG.md 미기재는 이 저장소의 기존 관례(`.claude/` 내부 하네스 변경은 CHANGELOG
  대상 아님, 이전 라운드에서 git log 로 확인됨)와 일치하고, 신규 공개 API·엔드포인트·
  환경변수가 없어(`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 그대로) README·API 문서·
  설정 문서 갱신 대상도 없다.
- `review/code/2026/07/23/14_23_23/*` (RESOLUTION.md·SUMMARY.md·per-agent 리포트)는 이번
  diff 에서 신규 커밋되는 파일이지만, 이는 프로젝트 컨벤션상 `review/code/**` 산출물이며
  Critical 3건 전부 재현 근거·수정 diff·비-vacuity 뮤턴트 결과를 표로 정리해 감사
  가능성(auditability)이 높다.

## 요약

이번 diff 는 직전 리뷰 라운드(14_23_23)가 지적한 CRITICAL 3건을 수정하면서 문서화 수준도
함께 유지했다 — 새로 발견된 결함(C1 홑따옴표 오판정, C2 ReDoS, C3 message-blanking 이
살아있는 확장을 드러냄)마다 재현 조건·수정 근거·회귀 테스트를 코드 주석·테스트 독스트링·
plan·RESOLUTION 네 층위에 일관되게 남겼고, 직전 라운드의 INFO 지적사항 하나(`_is_git_push`
독스트링)는 실제로 반영됐으며 다른 하나(모듈 독스트링 발견성)는 타당한 근거로 의도적으로
보류됐음을 코드 실측으로 확인했다. 유일한 새 지적은 plan 체크리스트의 테스트 건수가
C1~C3 수정 이후 최종 상태(25건/367건)로 갱신되지 않고 이전 값(17건/359건)에 머물러 있는
기록 drift(WARNING)이며, 그 외에는 인라인 예시 문자열 하나가 실제 pin 된 코퍼스 문자열과
완전히 동일하지 않다는 사소한 INFO 뿐이다. 두 건 모두 기능에는 영향이 없고 내부 하네스
문서의 정확성 문제에 그친다.

## 위험도

LOW
