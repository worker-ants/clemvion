# 유지보수성(Maintainability) 리뷰

## 리뷰 대상

- `.claude/hooks/guard_default_branch_bash.py` (핵심 로직 변경)
- `.claude/tests/test_guard_default_branch_bash_mutating.py` (신규 테스트)
- `.claude/tests/README.md`, `.claude/docs/worktree-policy.md`,
  `plan/complete/harness-push-guard-subcommand-detection.md`,
  `plan/in-progress/harness-guard-followups.md` (문서·plan 갱신)

## 발견사항

- **[WARNING]** `_SEGMENT_SPLIT` 정규식과 `VAR=value` 접두 처리 정규식 조각이 `guard_review_before_push.py` 와 이름·형태가 사실상 동일하게 중복 구현됨
  - 위치: `.claude/hooks/guard_default_branch_bash.py:69`(`^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*(?:`), `.claude/hooks/guard_default_branch_bash.py:111`(`_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|\n]")`)
  - 상세: 같은 저장소의 `.claude/hooks/guard_review_before_push.py:120`(`_SEGMENT_IS_GIT = re.compile(r"^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b")`)과 `:127`(`_SEGMENT_SPLIT = re.compile(r"&&|[|;\n]")`)에 사실상 같은 개념("셸 구분자로 명령을 분할", "`VAR=value` 접두 건너뛰기")이 **변수명까지 동일하게(`_SEGMENT_SPLIT`)** 별도 구현돼 있다. `plan/in-progress/harness-guard-followups.md` §C 의 won't-do 결론은 "오탐 해제(redaction) 로직을 공유할 이득이 없다"는 근거이지, 이 순수 구문 분할·환경변수 접두 패턴까지 공유하지 말라는 근거는 아니다. 두 정규식이 이후 독립적으로 갱신되면(예: 한쪽만 `|&` 를 추가) 같은 문제를 다시 따로 풀게 되고, 코드 어디에도 "이 패턴은 `guard_review_before_push.py` 에도 동일하게 존재한다"는 교차 참조 주석이 없어 다음 유지보수자가 이 중복을 모르고 지나칠 수 있다.
  - 제안: 최소한 두 정규식 옆에 서로를 가리키는 한 줄 주석을 추가하거나, 판단 로직(오탐 해제)은 분리하되 순수 문법적 분할·env-prefix 정규식만 작은 공유 헬퍼(`_lib/shell_lexing.py` 류)로 추출한다. 이 부분은 정밀도 트레이드오프가 없는 순수 구문 규칙이라 §C 가 걱정한 "차단용 정밀도 비용을 넛지에 전가" 문제와 무관하다.

- **[INFO]** `_SEGMENT_SPLIT` 정규식에서 `\|\|` 대안이 문자 클래스 `[;|\n]` 와 기능적으로 겹침
  - 위치: `.claude/hooks/guard_default_branch_bash.py:111`
  - 상세: `[;|\n]` 는 이미 단일 `|` 문자를 매칭하므로 `||` 는 `\|\|` 대안 없이도 두 번의 개별 매칭으로 사실상 동일하게 분할된다(차이는 결과 리스트에 빈 문자열 하나가 더 생기는 정도이며, `_MUTATING.search("")` 는 항상 False 라 `_is_mutating` 의 결과에는 영향이 없다). 지금은 의도적으로 명시적인 형태(`&&`, `||`, `;`, `|`, 개행을 모두 나열)를 택해 셸 연산자 집합을 정규식만 보고 파악하기 쉽게 한 것으로 보이나, 이 미묘한 중첩 관계를 설명하는 주석이 없어 향후 누군가 "`\|\|` 는 죽은 코드"로 오판하고 제거할 경우 (기능적으로는 무해하지만) 의도가 불분명해진다.
  - 제안: 필수는 아니지만, 이 파일의 다른 정규식들처럼 "왜 `\|\|` 를 별도 대안으로 뒀는지(가독성을 위한 명시적 나열)"를 한 줄로 남기면 향후 혼란을 줄일 수 있다.

## 요약

핵심 변경은 `_is_mutating` 을 "명령 전체의 첫 토큰만 검사"에서 "구분자(`&&`/`||`/`;`/`|`/개행)로 나눈 각 세그먼트의 첫 토큰을 검사"로 바꾸는 작지만 목적이 분명한 diff이며, 함수 길이·중첩·복잡도 모두 낮게 유지되고 네이밍(`_MUTATING`, `_SEGMENT_SPLIT`, `_is_mutating`)도 기존 컨벤션과 일치한다. 신규 테스트 파일은 6개 클래스로 관심사(오탐 없음/세그먼트 검출/허용된 오탐/스코프 밖/env 접두/빈 입력)를 깔끔히 분리했고, 각 클래스 docstring 이 "왜 이 동작이 맞는지"를 근거와 함께 남겨 이 저장소의 문서화 컨벤션과 일관된다. 변경 배경(왜 `_redact_inert_text` 를 공유하지 않기로 했는지)도 plan 문서에 상세히 기록되어 있어 추적 가능성이 좋다. 유일한 아쉬운 점은 `guard_review_before_push.py` 에 이미 존재하는 거의 동일한 이름·형태의 `_SEGMENT_SPLIT`/`VAR=value` 정규식 조각과의 관계를 코드 상에서 명시적으로 언급하지 않아, "두 훅이 탐지 코드를 공유하지 않기로 했다"는 결정과 "순수 구문 규칙까지 독립적으로 재발명됐다"는 사실 사이에 약간의 정보 갭이 남는다는 점이다. 전반적으로 가독성·일관성·테스트 구조 모두 양호한 수준이다.

## 위험도

LOW
