# 변경 범위(Scope) 리뷰 — push 가드 §J 따옴표 env-prefix 우회 수정

## 발견사항

- **[INFO]** 테스트 파일에 회귀 목적을 넘어서는 "vacuity guard" 단언이 함께 추가됨
  - 위치: `.claude/tests/test_push_guard_allowlist.py:251` (`test_no_new_false_negatives` 의 `assertGreater(compared, 10, ...)`), `.claude/tests/test_push_guard_allowlist.py:269` (`test_no_new_blocks` 의 `assertGreater(blocked, 10, ...)`)
  - 상세: 순수하게 §J(따옴표 env 접두 우회) 수정만 검증하려면 `QuotedEnvPrefixTest`(614행~)와 `_BLIND_PATTERN`/`blind_is_push` 도입만으로 충분하다. 두 `assertGreater` 는 "코퍼스/베이스라인이 우연히 비교를 못 하게 됐을 때 테스트가 항진명제가 되는 것"을 막는 별개의 방어 목적으로, 이번 diff 의 핵심 결함(따옴표 env 값)과 직접 연관은 없다.
  - 제안: 범위 이탈이라 보기보다는, 같은 diff 에서 `_LEGACY_PATTERN`/`_BLIND_PATTERN` 이원화·`legacy_is_push`→`blind_is_push` 치환이 일어나 "차등 테스트가 조용히 무력화될 위험"이 이번 변경 자체가 만든 것이므로 동반 하드닝으로 정당화 가능. 별도 조치 불요, 참고용 기록.

- **[INFO]** `KnownFalseNegativeTest` → `QuotedEnvPrefixTest` 클래스 리네임 + docstring 전면 재작성
  - 위치: `.claude/tests/test_push_guard_allowlist.py:614` (구 613행 부근, diff 상 `class QuotedEnvPrefixTest`)
  - 상세: 클래스명·문서·단언 방향(assertFalse→assertTrue)이 통째로 바뀌었으나, 이는 원 코드 자체가 "§J 가 고쳐지면 이 클래스를 assertTrue 로 뒤집어라, 같은 커밋에서" 라고 명시적으로 지시해 둔 절차(구 docstring: "the §J fix is proved by FLIPPING them to assertTrue... Do that in the same commit that edits `_GIT_PUSH`")를 그대로 따른 것. 범위 이탈 아님.

## 요약
세 파일(`guard_review_before_push.py`, `test_push_guard_allowlist.py`, `plan/in-progress/harness-guard-followups.md`) 모두 plan 에 명시된 단일 항목 §J("`_GIT_PUSH` 가 따옴표 env 접두에서 push 탐지를 놓쳐 리뷰 게이트가 우회된다")의 수정에만 관여한다. 훅 본체 수정은 정규식 한 그룹(`\S+` → 3-분기 따옴표 인식)에 국한되고, 다른 로직·주석·기존 docstring 블록은 건드리지 않았다. 테스트 파일 변경은 분량이 크지만 전부 "핀 고정된 정규식을 바꿀 때는 핀·차등 코퍼스·뮤테이션까지 같은 PR 로 처리하라"는 이 저장소 자체의 선행 결정(§J 백로그 원문)에 따른 필연적 동반 변경이며, 새 기능이나 무관한 리팩토링은 없다. plan 문서 변경도 완료된 §J 체크박스 두 곳을 갱신하는 것에 정확히 한정된다. 포맷팅 전용 변경, 불필요한 임포트, 설정 파일 변경, 무관한 파일 수정은 발견되지 않았다.

## 위험도
NONE
