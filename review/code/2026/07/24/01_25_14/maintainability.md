# 유지보수성(Maintainability) 리뷰

대상: `.claude/hooks/guard_default_branch_bash.py`, `.claude/hooks/guard_review_before_push.py`,
`.claude/tests/test_guard_default_branch_bash_mutating.py`, `.claude/tests/test_push_guard_allowlist.py`,
`plan/in-progress/harness-guard-followups.md`

## 발견사항

- **[WARNING]** 주석 내 plan 섹션 참조 오류 — "§K" 라고 썼지만 실제로는 "§L"
  - 위치: `.claude/tests/test_push_guard_allowlist.py:340-341` (`GeneratedFloorTest._VALUES` 내 주석)
  - 상세: 해당 주석은 "따옴표 조각이 비따옴표 문자에 붙어 있어 미탐지되는" 형태(`'"a b"c'`, `"'a b'c"`, `'x"a b"'`)를 §K 로 지칭한다. 그러나 같은 파일의 `KnownFalseNegativeTest`(878행: `"""§L — an env value whose closing quote is glued to more text."""`, 889-907행)는 정확히 같은 버그 클래스를 **§L** 로 명시하고, `plan/in-progress/harness-guard-followups.md` 의 `## L. env 값의 닫는 따옴표에 다른 문자가 붙으면 여전히 미탐지` 섹션도 이를 뒷받침한다. `## K.` 섹션은 전혀 다른 주제(게이트 실행 제어 흐름 4중 복제)다. 이 plan 은 §J 리셋 이후 문자 재배정 이력이 있어(§K 가 뒤늦게 다른 항목에 재사용됨, 체크리스트 517행 참고) 혼동이 발생하기 쉬운 상황인데, 이번 diff 에서 plan 문서 자체는 올바르게 갱신됐음에도(§L 신설) 같은 diff 의 테스트 주석은 갱신되지 않고 잘못된 문자를 남겼다. 향후 독자가 "§K" 를 따라가 plan 을 열면 완전히 무관한 섹션을 보게 된다.
  - 제안: 340-341행의 "§K" 를 "§L" 로 수정.

- **[WARNING]** 두 테스트 파일에 걸친 `_VALUES` 생성-코퍼스 리터럴 중복 + 동기화 장치 부재
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:232-235` (`OldEnvPrefixSupersetTest._VALUES`) vs `.claude/tests/test_push_guard_allowlist.py:336-343` (`GeneratedFloorTest._VALUES`)
  - 상세: 두 클래스는 "값 형태 × 할당 개수" 두 축으로 생성 입력을 만들어 회귀 바닥(regression floor)을 검증한다는 동일한 목적(plan 문서 487행: "두 축으로 생성한 입력을 바닥에 통과시킨다")을 갖고 있고, 실제로 `_VALUES` 리스트의 앞 20개 항목은 완전히 동일한 문자열 리터럴이다. 그러나 이 두 리스트를 동기화하는 장치가 없다 — 정규식 본문 자체는 `EnvValueSubpatternSharedTest` 가 byte-identical 을 강제하지만, 테스트 픽스처 데이터는 그런 보증이 없다. 실제로 이미 드리프트가 발생했다: push 가드 쪽 리스트는 §L 커버리지를 위해 9개 항목(`r'"a\"b"'` 중복 변형, `"a b"`, `"''''"`, `'"""'`, `'"a b"c'` 등)을 추가로 갖고 있지만 넛지 훅 쪽은 여전히 원래 20개뿐이다. 한쪽만 갱신되고 다른 쪽을 잊는 실수가 조용히 통과된다.
  - 제안: 공통 축(값 형태 리스트)을 `_lib/` 공유 모듈이나 최소한 상수 import 로 단일 소스화하거나, 두 리스트가 최소한 서로소가 아님(교집합 유지)을 단언하는 드리프트 가드 테스트를 추가. §C 의 "두 훅 판정 로직은 공유하지 않는다" 결론은 프로덕션 정규식 얘기이지 테스트 픽스처 중복까지 정당화하지는 않는다.

- **[WARNING]** `GeneratedFloorTest` 에는 있는 `test_no_duplicate_values` 안전장치가 짝 클래스 `OldEnvPrefixSupersetTest` 에는 없음
  - 위치: `.claude/tests/test_push_guard_allowlist.py:357-361` (있음) vs `.claude/tests/test_guard_default_branch_bash_mutating.py:211-266` (`OldEnvPrefixSupersetTest` 전체 — 없음)
  - 상세: `test_no_duplicate_values` 는 "`_VALUES` 안의 중복 항목이 조용히 표본 공간을 줄인다"는, 손으로 쓴 리터럴 리스트 특유의 실패 모드를 잡기 위한 가드다. 같은 실패 모드는 `OldEnvPrefixSupersetTest._VALUES` (`.claude/tests/test_guard_default_branch_bash_mutating.py:232-235`)에도 동일하게 존재하는데 대응하는 가드가 없다. 두 클래스가 같은 설계 의도(plan 문서상 "같은 두 축의 생성 테스트"로 나란히 언급됨)로 만들어진 짝이라는 점에서, 한쪽에만 적용된 안전장치는 리뷰·유지보수 시점의 비일관성이다.
  - 제안: `OldEnvPrefixSupersetTest` 에도 동일한 `test_no_duplicate_values` 를 추가.

- **[INFO]** 정규식 1줄을 뒷받침하는 주석 블록이 매우 길다 (기존 컨벤션과 일치하지만 계속 증가 중)
  - 위치: `.claude/hooks/guard_review_before_push.py:82-117` (약 36줄 주석 → 118-121행 4줄 코드), `.claude/hooks/guard_default_branch_bash.py:69-107` (약 39줄 주석 → 108-129행 정규식)
  - 상세: 이번 diff 는 두 파일 모두에서 "후행 `\S+` 폴백을 왜 남겨야 하는가"를 설명하는 문단을 기존 주석 위에 추가로 쌓았다. 이 저장소는 "확신에 찬 주석이 이후 라운드에 반증된 전례"(§C 원인 분석, `guard_default_branch_bash.py:82-93`) 때문에 근거를 코드 옆에 직접 남기는 것을 의도적 컨벤션으로 채택하고 있어 스타일 자체는 기존과 일관되고 정당화된다. 다만 주석:코드 비율이 계속 커지고 있어(이번 추가분만 각각 +11줄, +9줄), 향후 이 블록을 다시 수정할 때 "어느 문단이 최신 결론인지" 추적 비용이 늘어난다. 차단 요소는 아니며 기록 목적의 참고 사항.
  - 제안: (선택) 인라인 narrative 가 일정 길이를 넘으면 관련 plan 섹션(§J/§J-후속/§L)으로 발췌 이동하고 코드에는 요약 + 링크만 남기는 것도 고려할 수 있으나, 이 저장소의 기존 관행과는 상충하므로 강제하지 않음.

- **[INFO]** `_pre_quoted_is_mutating` 이 라이브 정규식 문자열을 마커로 스플라이스하는 방식은 취약하지만 자체 가드로 완화됨
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:238-244` (`_pre_quoted_is_mutating`), `226-230`(`_SPLIT_MARKER`)
  - 상세: `guard._MUTATING.pattern.split(self._SPLIT_MARKER, 1)[1]` 은 `_MUTATING` 정규식 소스 문자열 안에 정확히 `r"\s+)*(?:"` 서브스트링이 존재한다는 가정에 의존한다. `_MUTATING` 이 `re.VERBOSE` 포맷을 바꾸거나(공백 추가/줄바꿈 변경) 알테너티브 구조를 리팩터링하면 이 스플라이스가 조용히 다른 지점에서 잘리거나 `IndexError` 를 던질 수 있다. `test_the_frozen_prefix_still_composes`(249-253행)가 마커 존재와 최소 동작을 확인하는 회귀 가드 역할을 하므로 완전히 무방비는 아니지만, 여전히 "테스트가 피시험 모듈의 내부 문자열 레이아웃에 결합"되는 코드 복잡도 냄새다.
  - 제안: 현재 가드로 충분히 완화되어 있으나, 향후 `_MUTATING` 리팩터링 시 이 결합을 기억하도록 `_MUTATING` 컴파일 지점 근처에도 짧은 역참조 주석을 추가하면 발견성이 좋아진다.

## 요약

이번 변경은 기존 §J 수정이 놓친 "따옴표를 열고 닫지 않은 env 값" false-negative 를 재발 방지 테스트와 함께 두 훅(넛지·차단 게이트)에 동일하게 적용한 소규모 정정이다. 정규식 자체의 변경 폭은 작고(대안 하나를 `[^\s'"]\S*` → `\S+` 로 되돌려 폴백으로 승격) 관련 정규식 본문은 `EnvValueSubpatternSharedTest` 로 두 훅 간 드리프트가 코드로 강제되어 있어 안전하다. 다만 이번에 함께 추가된 생성 기반 회귀 테스트(`OldEnvPrefixSupersetTest`, `GeneratedFloorTest`)는 같은 설계 의도로 두 파일에 나란히 작성됐음에도 `_VALUES` 리터럴 중복·짝 클래스 간 안전장치(`test_no_duplicate_values`) 비대칭이 있고, 코멘트 한 곳에 plan 섹션 참조 오탈(§K→§L)이 남아 있다. 모두 동작에는 영향이 없는 테스트/문서 수준의 유지보수성 이슈이며, 프로덕션 가드 로직의 가독성·네이밍·함수 길이·중첩·복잡도는 기존 컨벤션과 일관되게 양호하다.

## 위험도

LOW
