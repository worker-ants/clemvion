# 아키텍처(Architecture) 리뷰 — push guard allowlist 재설계 (fresh review, C1/C2/C3 fix 반영 후)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`,
`plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`
(참고: 이번 diff 에는 `review/code/2026/07/23/14_23_23/*` 직전 리뷰 라운드 산출물도 포함돼 있으나,
이는 리뷰 리포트 그 자체이므로 아키텍처 분석 대상에서 제외했다.)

본 라운드는 직전 리뷰(`14_23_23`, RISK=CRITICAL, C1/C2/C3)에서 지적된 `_MESSAGE_ARG` 정규식의
3가지 결함(홑따옴표 이스케이프 오판정·파국적 백트래킹·메시지 blanking 이 살아있는 확장을 드러냄)이
수정된 이후의 상태를 다시 본다. 세 수정 모두 `_MESSAGE_ARG`/`_is_git_push` 내부의 **정규식 정밀도·
안전 조건**을 고친 것으로, 함수 분해·모듈 경계·의존 방향 등 아키텍처 골격 자체는 바꾸지 않았다.
따라서 이번 라운드의 결론은 직전 architecture.md(LOW)의 구조적 판단을 재확인하는 성격이 강하다.

## 발견사항

- **[INFO]** OCP 확장점 설계는 fix 이후에도 그대로 유효
  - 위치: `.claude/hooks/guard_review_before_push.py:55-57`(`_GIT_PUSH`, frozen) / `:129-161`(`_redact_inert_text`)
  - 상세: C1~C3 수정은 모두 "해제 규칙" 내부(`_MESSAGE_ARG`의 따옴표별 본문 분리, `_is_git_push`의
    명령 전체 inert 검사)에 국한됐고, "1차 정규식은 불변·해제는 `_redact_inert_text()` 안에서만"
    이라는 폐쇄/개방 경계선은 건드리지 않았다. 즉 CRITICAL 3건이 모두 "개방된" 절반 안에서
    발생하고 그 안에서 고쳐졌다는 사실 자체가, 이 설계의 격리 경계가 실제로 유효했음을
    사후적으로 증명한다 — 결함이 `_GIT_PUSH`(폐쇄 half)로 번지지 않았다.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** `_is_git_push` 의 3단계 판정이 "fail-closed 우선" 불변식을 아키텍처 수준에서 강제
  - 위치: `.claude/hooks/guard_review_before_push.py:216-233` (`_is_git_push`)
  - 상세: C3 수정으로 추가된 `if not _is_inert(command): return True` 는 함수의 제어 흐름을
    "표현이 있으면 무조건 차단 유지 → 없을 때만 redaction 후 재판정" 순서로 재배열했다. 이
    순서 자체가 하나의 아키텍처 불변식(안전 방향의 기본값)을 코드 구조로 표현한다 — 즉
    안전성이 개별 규칙의 정확성에만 의존하지 않고, 함수 진입점의 얕은 guard clause 로도 한 번
    더 보장된다(defense in depth). 세 CRITICAL 이 전부 "규칙 하나의 정밀도" 문제였지 이
    guard clause 배치 자체의 문제가 아니었다는 점도 이 구조의 견고성을 뒷받침한다.
  - 제안: 없음. 향후 새 해제 규칙을 추가할 때도 이 순서(표현 전체 스캔 → 규칙별 redaction)를
    깨지 않도록 상단 docstring에 "이 순서를 바꾸지 말 것" 한 줄을 명시하면 유지보수자에게
    더 명확할 수 있음(선택).

- **[WARNING]** 두 가드 훅의 git 서브커맨드 판정 로직 중복 — fix 이후에도 격차 유지(직전 라운드 이월)
  - 위치: `.claude/hooks/guard_review_before_push.py`(`_redact_inert_text` 등 ~140줄) vs
    `.claude/hooks/guard_default_branch_bash.py:59-75`(`_MUTATING`, 셸 인용을 전혀 모르는
    `re.VERBOSE` 단순 패턴 — 직접 확인함, diff 밖 파일)
  - 상세: 이번 fix 라운드는 `_MESSAGE_ARG`/`_is_git_push` 내부만 고쳤을 뿐 `guard_default_branch_bash.py`
    쪽은 전혀 손대지 않았다. 두 훅 모두 "커밋 메시지에 등장하는 git 관련 단어를 mutating/push
    로 오분류하지 않는가" 라는 동일한 유형의 문제(오탐 해제)를 갖고 있는데, `guard_review_before_push.py`
    쪽만 이번에 세 라운드에 걸쳐 정교해졌다. `plan/in-progress/harness-guard-followups.md`
    가 이 사실을 정확히 반영해 "① 재설계 확정 → 항목 C 착수 가능, 단 1차 패턴은 각자 두고
    redaction 만 공유" 라고 스코프를 좁혀 기록해 둔 점은 적절하다 — 이는 이번 diff 가 새로
    도입한 결함이 아니라 이미 추적 중인 부채가 계속 누적되는 것이다. `guard_default_branch_bash.py`
    는 soft-fail(차단 없음)이라 오분류의 실질 피해가 낮다는 점도 여전히 유효하다.
  - 제안: plan 항목 C 를 이번 PR 밖으로 계속 defer 하는 것은 합리적이나, `_redact_inert_text`/
    `_is_inert`/`_ESCAPED_PIPE` 를 조기에 `_lib/`(예: `_lib/inert_text_redaction.py`)로 추출해
    두 훅이 공유하도록 우선순위를 올릴 것을 재권고한다. C1~C3 같은 정밀도 결함이 앞으로도
    발생할 수 있는 유일한 표면이 이 redaction 로직인데, 그것이 한 훅에만 있으면 다른 훅은
    같은 클래스의 버그를 독립적으로 재발견/재수정해야 한다.

- **[INFO]** `_redact_inert_text` 내부 3규칙(escaped-pipe → heredoc → message)의 순서 의존성 — 여전히 문서화 안 됨
  - 위치: `.claude/hooks/guard_review_before_push.py:129-161`(`_redact_inert_text`)
  - 상세: 직전 라운드에서 지적된 항목이며 이번 fix(C1~C3)는 이 함수의 규칙 "순서"가 아니라
    3번째 규칙(`_MESSAGE_ARG`)의 "내용"을 고쳤을 뿐이라 이 갭은 그대로 남아 있다.
    `_owns_heredoc_as_message` 가 쓰는 `_SEGMENT_SPLIT`(`\|\||&&|[|;\n]`)은 백슬래시 유무를
    보지 않고 원문자 `|` 를 구분자로 매칭하므로, escaped-pipe 정규화(1단계)가 heredoc
    소유권 판정(2단계)보다 먼저 실행돼야 한다는 숨은 전제가 코드 순서에만 있고 docstring/
    테스트에는 없다.
  - 제안: (직전 권고와 동일, 재확인) `_redact_inert_text` docstring 에 "순서가 의미 있다"는
    한 줄과, escaped-pipe 가 heredoc 여는 줄 앞에 있는 코퍼스 케이스 1건을 `CORPUS` 에 추가.

- **[INFO]** 테스트가 모듈 private 멤버(`_GIT_PUSH`, `_is_git_push`)에 직접 결속 — 의도된 pinning, 변화 없음
  - 위치: `.claude/tests/test_push_guard_allowlist.py` `BlindPassFrozenTest`, `DifferentialTest` 등
  - 상세: 직전 라운드와 동일한 관찰. 이번 fix 로 `CORPUS`/`RELEASED` 구조가 3-필드 튜플로
    재구성되고(직전 WARNING #2 반영) 코퍼스 항목이 다수 늘었지만, private API 결속이라는
    아키텍처적 성격 자체는 바뀌지 않았다. 여전히 항목 C(`_lib/` 추출) 시 re-export 없이는
    이 테스트 스위트 전체가 함께 갱신되어야 한다.
  - 제안: (직전과 동일) 추출 시 `_GIT_PUSH`/`_is_git_push` 이름을 재노출(re-export)할 것.

## 요약

이번 fix 라운드(C1 홑따옴표 이스케이프·C2 파국적 백트래킹·C3 메시지 blanking 의 확장 은폐)는
전부 "개방된" 절반인 `_redact_inert_text`/`_MESSAGE_ARG`/`_is_git_push` 내부의 정규식 정밀도와
안전 가드 순서를 고친 것으로, 1차 blind 정규식(폐쇄)과 열거된 allowlist(개방)를 분리한 아키텍처
경계선 자체는 그대로 유지됐다. 오히려 이 라운드는 그 경계가 설계대로 작동했음을 보여준다 —
세 CRITICAL 모두 개방된 확장점 안에서 발생했고 그 안에서 격리된 채 수정됐으며, `_GIT_PUSH`
(폐쇄 half)는 손대지 않고도 안전성을 회복했다. `_is_git_push` 에 새로 추가된 "명령 전체에 살아있는
확장이 있으면 무조건 차단 유지" guard clause 는 개별 규칙의 정확성 여부와 무관하게 안전
방향을 강제하는 이중 방어선(defense in depth) 역할을 한다. 순환 의존성이나 레이어 경계 위반은
없다(`_lib/review_guard`·`_lib/plan_guard` 는 독립적으로 best-effort import 되어 한쪽 실패가
다른 쪽을 침묵시키지 않는 느슨한 결합을 유지). 남아 있는 유일한 실질적 아키텍처 부채는
`guard_default_branch_bash.py` 와의 판정 로직 중복인데, 이는 새로 도입된 결함이 아니라 이미
`harness-guard-followups.md` 항목 C 로 추적·스코프까지 정해진 상태이며 이번 diff 도 그 사실을
정확히 반영해 두었다. `_redact_inert_text` 내부 규칙 순서 의존성 미문서화, 테스트의 private API
결속은 직전 라운드에서 이미 INFO 로 남았던 항목이 그대로 이월된 것으로, 이번 fix 의 범위(정규식
정밀도) 밖이라 재발생이 아니다.

## 위험도
LOW
