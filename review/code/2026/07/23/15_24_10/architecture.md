# 아키텍처(Architecture) 리뷰 — push guard allowlist (3라운드 누적, W1/W2 fix 반영 후 fresh review)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`,
`.claude/tests/test_guard_review_before_push_main.py`(docstring만), `plan/in-progress/harness-guard-followups.md`,
`plan/in-progress/harness-push-guard-subcommand-detection.md`. diff base 는 `git merge-base HEAD origin/main`
(`860aad982`)로 직접 계산 — `review/code/2026/07/23/{14_23_23,14_57_32}/*` 는 이전 두 라운드의 리뷰
산출물(문서)이 이번 diff 에 함께 포함돼 있으나, 코드가 아니라 리뷰 리포트 그 자체이므로 아키텍처
분석 대상에서 제외했다.

이 라운드에서 실제로 "처음 보는" 코드는 `_owns_heredoc_as_message`/`_commit_heredoc_spans`/
`_blank_spans` — 직전 라운드(`14_57_32`)가 지적한 W1(O(n²) backtracking)·W2(O(n·k) 문자열 복사)를
고친 `cef183faf` 커밋의 결과물이다. `_MESSAGE_ARG`/`_GIT_PUSH`/전체 OCP 경계는 두 차례 이미 LOW 로
수렴했으므로 이번엔 재확인 위주로, W1/W2 fix 코드만 새로 상세 분석했다.

## 발견사항

- **[INFO]** W1 fix — 단일 정규식을 3개의 독립된 단일 패스 probe 로 분해한 것은 일관된 SRP 리팩터
  - 위치: `.claude/hooks/guard_review_before_push.py:106-129` (`_SEGMENT_IS_GIT`, `_COMMIT_OR_TAG`,
    `_STDIN_FILE_FLAG`, `_owns_heredoc_as_message`)
  - 상세: 이전(`14_57_32`) 라운드가 지적한 O(n²) 원인은 `commit|tag` 앞뒤로 겹치는 그리디 `[^\n]*`
    두 구간을 가진 **단일** 정규식이었다. 수정은 이를 "세그먼트가 git 명령인가" → "commit/tag
    단어가 있는가" → "그 뒤에 stdin 플래그가 있는가" 라는 **책임이 분리된 3개의 순차 probe**로
    바꾸고, 오케스트레이션은 `_owns_heredoc_as_message` 한 함수에 모아 두었다. 각 probe 가 정확히
    한 가지만 검사하고, 그 이유(왜 겹치면 위험한지)가 상수 정의 바로 위 주석에 남아 있어 "왜 3개로
    쪼갰는가"라는 설계 결정이 코드와 함께 이동한다. 함수 자체의 공개 계약(`prefix: str -> bool`)은
    바뀌지 않아 호출부(`_commit_heredoc_spans`)는 무수정.
  - 제안: 없음(현행 유지 권장). 이 리팩터는 성능 결함 수정이 곧 설계 개선(SRP)으로 이어진 바람직한
    사례다.

- **[INFO]** 같은 클래스의 ReDoS를 서로 다른 두 가지 기법으로 해소 — 모듈 내 "안전한 스캔" 스타일이
  아직 성문화되지 않음
  - 위치: `_MESSAGE_ARG`(:145-150, 겹치는 alternation을 disjoint 하게 만들어 **단일 정규식** 안에서
    해결) vs `_owns_heredoc_as_message`(:116-129, 겹치는 그리디 구간을 **별도 함수로 분해**해 해결)
  - 상세: 두 CRITICAL/WARNING 모두 "정규식 두 대안/구간이 같은 문자를 두고 겹친다"는 동일한 병인을
    가졌는데, 고친 방식은 서로 다르다 — 하나는 정규식 내부를 disjoint 하게 재작성했고, 다른 하나는
    정규식 자체를 3개로 쪼갰다. 두 기법 모두 정답이고 각자의 자리에서는 최선이지만(전자는 "구조
    안에서 상태를 나눌 수 있는 경우", 후자는 "조건이 순차적으로 좁혀지는 경우"), 이 모듈에 "안전한
    스캔 primitive를 어떻게 작성하는가"에 대한 **하나의 성문화된 원칙**이 아직 없다. 앞으로 4번째
    allowlist 규칙을 추가하는 사람이 어느 쪽 관용구를 따라야 할지 코드에서 바로 판단하기 어렵다 —
    지금은 두 사례를 나란히 읽고 유추해야 한다.
  - 제안: 낮은 우선순위. `_redact_inert_text` 모듈 상단 설계 주석(:52-67)에 "새 해제 규칙을 작성할
    때: 상태(직전 문자)에 따라 분기 가능하면 disjoint alternation, 조건이 순차적으로 좁혀지면 분리된
    단일 패스 probe들로 나눌 것" 한 줄을 추가하면 재발(다음 규칙에서 또 다른 제3의 기법이 등장해
    스타일이 세 갈래로 갈라지는 것)을 막을 수 있다.

- **[INFO]** `_blank_spans` 도입으로 "무엇을 지울지 결정"과 "어떻게 지울지 실행"의 책임이 명확히
  분리됨 — 응집도 개선
  - 위치: `_blank_spans`(:158-176, 유일한 실행부) / `_commit_heredoc_spans`(:212-241, heredoc 스팬
    수집) / `_redact_inert_text`(:179-209, `_MESSAGE_ARG` 스팬 수집 + 한 번의 `_blank_spans` 호출)
  - 상세: W2 이전에는 `_blank_commit_heredocs`가 in-place 로 문자열을 블랭킹하며 반복 호출됐다(리뷰
    이력상 추정). 지금은 각 규칙이 "지울 구간(span)"만 **데이터**로 반환하고, 그 데이터를 실제
    문자열에 반영하는 것은 `_blank_spans` 단 하나의 함수가 담당한다 — Strategy 패턴에 가까운 형태로,
    새 해제 규칙을 추가할 때 "span 을 어떻게 계산하는가"만 고민하면 되고 "실행"은 이미 검증된
    공통 경로를 재사용한다(오프셋 유효성·정렬·겹침 처리를 규칙마다 재구현할 필요 없음). 이는 확장성
    항목에서 명백한 개선이다.
  - 제안: 없음(현행 유지 권장).

- **[WARNING]** (직전 두 라운드에서 이월, 변화 없음) 두 가드 훅의 git 서브커맨드 판정 로직 중복
  - 위치: `.claude/hooks/guard_review_before_push.py`(`_redact_inert_text` 계열, 이번 diff 로
    ~212줄) vs `.claude/hooks/guard_default_branch_bash.py:59-81`(`_MUTATING`, `re.VERBOSE` 단순
    패턴 — `git\s+(?:commit|reset|...|push\b|...)` 를 포함하지만 인용/heredoc/이스케이프를 전혀
    모름. diff 밖 파일, 직접 확인함)
  - 상세: 두 훅 모두 "이 Bash 명령이 어떤 git 동작을 실행하는가"라는 동일 문제를 각자 재구현한다.
    이번 W1/W2 라운드로 `guard_review_before_push.py` 쪽만 세 번째로 더 정교해졌고(3-probe 분해,
    span 기반 단일 재조립), `guard_default_branch_bash.py`는 여전히 손대지 않은 단순 정규식이다 —
    두 구현의 정교함 격차가 계속 벌어지는 추세다. `plan/in-progress/harness-guard-followups.md` §C
    가 "① 재설계 확정 → C 착수 가능, 단 1차 패턴은 각자 두고 redaction 만 공유"로 정확히 스코프를
    좁혀 추적 중이며, 이번 diff 도 그 사실을 갱신해 반영했다(새로 도입된 결함이 아니라 기존 추적
    항목의 연장). `guard_default_branch_bash.py`는 soft-fail(차단 없음)이라 오분류의 실질 피해가
    낮다는 완화 요인도 세 라운드 내내 동일하게 유효하다.
  - 제안: (재권고, 우선순위 변화 없음) `_redact_inert_text`/`_is_inert`/`_ESCAPED_PIPE`/새 3-probe
    세트를 `_lib/`(예: `_lib/inert_text_redaction.py`)로 조기 추출해 두 훅이 공유하도록 다음 PR
    우선순위를 올릴 것. 정밀도 결함(C1~C3, W1~W2)이 반복적으로 이 redaction 로직에서만 발생해 온
    이력을 볼 때, 격차가 더 벌어질수록 추출 시 두 훅의 동작을 일치시키는 회귀 비용이 커진다.

- **[INFO]** (직전 두 라운드에서 이월, 이번 라운드에 해소됨) `_redact_inert_text` 규칙 순서 의존성
  — docstring 반영 확인
  - 위치: `_redact_inert_text`:179-194
  - 상세: 두 차례 architecture 리뷰가 "escaped-pipe 정규화가 heredoc 소유권 판정보다 먼저 실행돼야
    하는 이유가 코드에는 있지만 문서화돼 있지 않다"고 지적했는데, 이번 diff 의 docstring
    (`"The rules run in a fixed ORDER and it matters: (1) normalises escaped pipes first so the
    later scans see the same segment boundaries the blind pass will."`)이 정확히 이 갭을 메웠다.
    리뷰 피드백이 실제로 다음 라운드 코드에 반영되는 루프가 작동하고 있음을 확인.
  - 제안: 없음(해소 확인).

- **[INFO]** 모듈 경계·순환 의존성·레이어 책임 — 이상 없음(재확인)
  - 위치: 파일 상단 import 블록(:39-48), `main()`(:319-352)
  - 상세: `review_guard`/`plan_guard` 임포트가 각각 독립 `try/except`로 격리되어 있어 한쪽 모듈의
    문법 오류가 다른 쪽 게이트까지 무력화하지 않는다(장애 도메인 분리, 이번 diff 로 변경 없음
    — 재확인만). `_is_git_push`(판정/"비즈니스 로직")와 `main()`(payload 파싱·게이트 호출 순서·
    exit code — "오케스트레이션") 사이 책임 분리도 유지된다. 순환 임포트 없음(`_lib/` → 상위 모듈
    역참조 없음). 이 파일이 속한 "하네스 훅" 계층은 애플리케이션 코드(`codebase/**`)와 완전히
    분리된 별도 도구 계층이라 레이어 침범도 없다.
  - 제안: 없음.

## 요약

이번 라운드에서 아키텍처 관점으로 새로 볼 코드는 직전 라운드(`14_57_32`)가 발견한 W1(O(n²)
backtracking)·W2(O(n·k) 문자열 복사) 수정분(`_owns_heredoc_as_message` 3-probe 분해, `_blank_spans`
단일 재조립)이며, 둘 다 성능 수정이 곧 SRP·응집도 개선으로 이어진 바람직한 리팩터다 — "무엇을
지울지"(규칙별 span 계산)와 "어떻게 지울지"(`_blank_spans` 단일 경로)의 분리, 그리고 겹치는 그리디
구간을 독립된 단일 패스 probe 3개로 쪼갠 것 모두 확장성에 긍정적이다. `_GIT_PUSH`(폐쇄) /
`_redact_inert_text`(개방) 라는 핵심 OCP 경계는 세 라운드에 걸친 CRITICAL/WARNING 수정이 전부
개방된 절반 안에서만 일어났다는 사실로 재차 실증됐다. 유일하게 남아 이월되는 구조적 부채는
`guard_default_branch_bash.py`와의 git 서브커맨드 판정 로직 중복인데, 이는 이미 backlog 항목 C로
추적 중이고 이번 diff 도 그 상태를 정확히 갱신해 두었다 — 새로 도입된 결함이 아니라 세 라운드째
격차가 벌어지고 있는 기존 항목이다. 그 외 신규로 지적할 만한 항목은, 같은 병인(겹치는 정규식
구간)의 두 fix 가 서로 다른 기법(disjoint alternation vs probe 분해)을 썼는데 이를 규율하는 성문화된
원칙이 아직 모듈에 없다는 점 정도이며, 낮은 우선순위 INFO 다.

## 위험도
LOW
