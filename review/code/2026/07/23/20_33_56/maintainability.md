### 발견사항

- **[WARNING]** §J(push 가드 detection 이 따옴표 env 접두에서 뚫리는 결함)의 코드 내 포인터가 실제 결함 지점(`_GIT_PUSH`)이 아니라 무관한 다른 정규식(`_SEGMENT_IS_GIT`)에 붙어 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:96-98` (`_GIT_PUSH` 정의, "DO NOT EDIT this pattern" 주석만 있고 §J 언급 없음) vs `:142-148` (§J 상호 참조 주석이 `_SEGMENT_IS_GIT`/`_SEGMENT_SPLIT` 옆에 위치)
  - 상세: 이번 diff(RESOLUTION W2 반영)로 두 훅의 `_SEGMENT_SPLIT`/env-prefix 패턴 사이에 상호 참조 주석이 추가된 것은 적절하다. 그런데 실제로 §J 가 지목하는 라이브 결함은 `_SEGMENT_IS_GIT`(heredoc 소유권 판정용, release 방향이라 안전)가 아니라 `_GIT_PUSH`(메인 게이트, `\S+` 때문에 `GIT_SSH_COMMAND="ssh -i k" git push` 를 통째로 놓쳐 리뷰 게이트가 우회됨)다. 그럼에도 `_GIT_PUSH` 정의부(라인 82-98)의 주석은 "DO NOT EDIT this pattern... releases belong in `_redact_inert_text()`... test_push_guard_allowlist.py 가 byte-for-byte 고정" 만 서술하고 §J 나 `\S+` 한계를 전혀 언급하지 않는다. §J 를 별 PR 로 고치러 오는 사람은 plan 문서를 먼저 읽지 않는 한, `_GIT_PUSH` 바로 옆에서는 이 결함의 존재를 알 수 있는 단서를 못 찾고 30여 줄 아래 `_SEGMENT_IS_GIT` 주석까지 읽어야 알게 된다. "DO NOT EDIT" 라는 강한 경고가 붙은 바로 그 자리가 실제 고쳐야 할 자리인데, 결함 포인터는 다른 곳에 있는 셈이다.
  - 제안: `_GIT_PUSH` 정의 위(또는 "DO NOT EDIT" 주석 안)에 "이 패턴의 env-prefix 그룹도 `\S+` 라 따옴표 값 push 를 놓친다 — harness-guard-followups §J, 별 PR" 한 줄을 직접 추가해 결함과 포인터를 같은 자리에 둔다.

- **[INFO]** 동일 로직·서술이 5곳 이상에 중복 서술되어 있어 향후 편집 시 동기화 비용이 있음
  - 위치: `.claude/hooks/guard_default_branch_bash.py:66-95`(`_MUTATING` 위 주석, ~30줄), `:130-145`(`_SEGMENT_SPLIT` 위 주석, ~16줄); `.claude/tests/test_guard_default_branch_bash_mutating.py:1-26`(모듈 docstring); `.claude/tests/README.md:46`; `plan/in-progress/harness-guard-followups.md` §C
  - 상세: "세그먼트 분할이 왜 필요한지", "잔여 오탐이 몇 종인지", "ReDoS 가 왜 무해한지" 같은 동일한 설명이 코드 주석·테스트 docstring·README·plan 문서에 각각 독립적으로 서술돼 있다. 이번 PR 의 RESOLUTION(W3)이 "잔여 오탐 1종"이라는 과대 단정을 "2종"으로 정정하며 README·테스트 docstring·plan 세 곳을 동시에 고쳐야 했던 것 자체가, 이 중복이 실제로 동기화 비용을 발생시킨다는 증거다. 프로젝트 컨벤션상 의도된 두꺼운 문서화(추적성 우선)이지만, 다음에 또 서술을 바꿀 일이 생기면 같은 비용이 반복된다.
  - 제안: 필수 조치는 아님. 굳이 줄이려면 코드 주석은 "무엇이 어떻게" 위주의 짧은 버전만 남기고, "왜 이 대안을 기각했는지"류 서술은 plan 문서(§C)를 SoT 로 지정해 한 줄 링크로 대체하는 편이 장기적으로 더 저렴하다.

- **[INFO]** `_SEGMENT_SPLIT` 의 `\|\|` 대안이 문자 클래스 `[;|&\n]` 와 기능적으로 겹쳐 존재 이유가 주석 없이 남아 있음 (라운드 1에서 지적된 항목, 이번 diff 에서 미조치·비차단)
  - 위치: `.claude/hooks/guard_default_branch_bash.py:146` (`_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|&\n]")`)
  - 상세: `[;|&\n]` 이 이미 단일 `|` 를 매칭하므로 `||` 는 `\|\|` 대안이 없어도 두 번 연속 매칭으로 동일하게 분할된다(`_MUTATING.search("")` 는 항상 False 라 결과에 영향 없음). 기능은 무해하지만 "왜 명시적으로 나열했는지(가독성)"를 밝히는 주석이 없어, 다음 편집자가 죽은 코드로 오판해 제거할 잠재적 혼란 지점으로 남아 있다.
  - 제안: 우선순위 낮음. 여유 있을 때 한 줄 주석("`||` 를 명시해 셸 연산자 전체 집합을 정규식만 보고 파악 가능하게 함")을 추가.

- **[INFO]** (긍정적 관찰) `_is_mutating` 자체는 4줄짜리 순수 함수, `_MUTATING`/`_SEGMENT_SPLIT` 모두 VERBOSE·명확한 alternation 구조를 유지해 함수 길이·중첩·복잡도 관점에서 문제 없음. 신규 테스트 파일도 관심사별 6개 클래스(오탐 없음/세그먼트 검출/허용된 오탐/스코프 밖/env 접두/빈 입력)로 잘 분리되고 각 클래스 docstring 이 "왜"를 근거와 함께 남겨 컨벤션과 일관된다.
  - 위치: `.claude/hooks/guard_default_branch_bash.py:149-154`; `.claude/tests/test_guard_default_branch_bash_mutating.py` 전체
  - 상세/제안: 해당 없음(조치 불필요).

### 요약

핵심 코드 변경(`_is_mutating` 을 세그먼트 분할 방식으로 바꾼 부분)은 함수 길이·중첩·네이밍·복잡도 모두 양호하고, 신규 테스트도 관심사별로 잘 조직돼 있다. 라운드 1 리뷰의 maintainability WARNING(두 훅 간 `_SEGMENT_SPLIT`/env-prefix 정규식 중복)은 이번 diff 에서 추출 대신 상호 참조 주석으로 적절히 완화됐다. 다만 그 완화 과정에서 §J(push 가드 게이트 우회 결함)를 가리키는 새 주석이 실제 결함 지점(`_GIT_PUSH`)이 아니라 이웃한 다른 정규식(`_SEGMENT_IS_GIT`) 옆에 붙어, "DO NOT EDIT" 경고가 있는 바로 그 자리에서는 결함의 존재를 알 수 없다는 새로운 포인터 배치 문제가 생겼다. 그 외에는 동일 서술이 코드 주석·테스트·README·plan 문서 5곳 이상에 반복돼 있는 의도된 두꺼운 문서화 관행이 향후 동기화 비용을 계속 발생시킬 수 있다는 점과, 라운드 1에서 지적된 사소한 정규식 중복 대안(`\|\|`) 미조치 정도가 남아 있다. 전반적으로 위험은 낮다.

### 위험도
LOW
