# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 코드/보안 관점 위험은 없음(신규 FN 없음, ReDoS 재도입 없음, 회귀 테스트로 검증됨). 위험도는 전적으로 **documentation 정확성**에서 기인: 이번 diff가 고친 동작을 여전히 반박하는 오래된 모듈 docstring 1건, 같은 파일 내 백로그 레터(§K/§L) 자기모순 1건. forced whitelist(7명) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 모듈 docstring 이 이번 diff가 정확히 고친 동작("unclosed quote"는 여전히 unmatched)을 그대로 서술해 자기모순. 실제로는 `test_unterminated_quote_still_matches`가 이제 매치됨(assertTrue)을 확인함 — empty value 절만 여전히 참 | `.claude/hooks/guard_default_branch_bash.py:33-36` | docstring 을 "unclosed quote는 이제 매치됨(J-후속 폴백 추가), empty value만 여전히 unmatched"로 갱신 |
| 2 | Documentation / Maintainability | 같은 결함(닫는 따옴표에 다른 문자가 붙어 미탐지)을 파일 내에서 서로 다른 두 레터(§K, §L)로 지칭해 자기모순. `KnownFalseNegativeTest`(878~907행)와 plan `## L.` 섹션은 §L, `GeneratedFloorTest._VALUES` 주석만 §K로 오기 — §K는 실제로 전혀 다른 항목(게이트 실행 제어흐름 4중 복제)을 가리킴 | `.claude/tests/test_push_guard_allowlist.py:340-341` | 340-341행의 "§K"를 "§L"로 정정 |
| 3 | Maintainability | 두 테스트 파일의 생성 코퍼스(`OldEnvPrefixSupersetTest._VALUES` vs `GeneratedFloorTest._VALUES`)가 동일 목적으로 리터럴 중복 보유하면서 동기화 장치 없음 — 이미 드리프트 발생(push 가드 쪽만 §L 커버리지 9건 추가, 넛지 훅 쪽은 원래 20개 그대로) | `.claude/tests/test_guard_default_branch_bash_mutating.py:232-235`, `.claude/tests/test_push_guard_allowlist.py:336-343` | 공통 값-형태 리스트를 단일 소스화하거나, 두 리스트가 최소 교집합을 유지하는지 검증하는 드리프트 가드 테스트 추가 |
| 4 | Maintainability | `GeneratedFloorTest`에 있는 `test_no_duplicate_values` 안전장치(리터럴 리스트 중복 항목 검출)가 같은 설계 의도의 짝 클래스 `OldEnvPrefixSupersetTest`에는 없음 | `.claude/tests/test_guard_default_branch_bash_mutating.py:211-266` | `OldEnvPrefixSupersetTest`에도 동일한 `test_no_duplicate_values` 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 이번 변경(env-value fallback `[^\s'"]\S*`→`\S+`)은 방향성 자체가 게이트 우회(FN) 축소이며 신규 취약점 없음 — 하드코딩 시크릿/인젝션/인증-인가/의존성 변경 없음 | `guard_default_branch_bash.py`, `guard_review_before_push.py` | 조치 불요 |
| 2 | Security | ReDoS(catastrophic backtracking) 재도입 여부를 저자 실측 + 리뷰어 독립 adversarial 재현(3만~10만 회 반복)으로 확인 — 선형 시간 유지 | 두 훅의 `_MUTATING`/`_GIT_PUSH`; `BacktrackingTest` 양쪽 | 조치 불요 |
| 3 | Security / Testing / Requirement | §L(닫는 따옴표에 다른 문자가 붙는 값, 예: `A="a b"c git push`)은 이번 diff 범위 밖의 사전 존재 게이트 우회로 여전히 미탐지 — `KnownFalseNegativeTest`로 캐너리 고정 + plan 백로그 등록됨(넛지 훅도 동일 갭 공유). 자연스러운 수정형은 그 자체로 파국적 백트래킹 위험(실측 14회 반복에 5.2초)이라 측정 없이 성급히 고치면 안 됨 | `guard_review_before_push.py:118-121`; `test_push_guard_allowlist.py:877-914`; `plan/in-progress/harness-guard-followups.md` §L | 현행 backlog 우선순위 유지, 이번 PR 범위 밖 |
| 4 | Requirement | `spec/` 하위에 이 하네스 도구를 언급하는 문서 없음 — 제품 코드(`codebase/**`)가 아니므로 spec 커버리지 대상 밖. `plan/in-progress/harness-guard-followups.md`가 사실상 SoR 역할을 하며 diff와 line-level 정합 확인됨 | `spec/` 전체 | 조치 불요 |
| 5 | Scope / Side Effect | SoR 문서 경로 정정(`plan/in-progress/…`→`plan/complete/harness-push-guard-subcommand-detection.md`) 2개 파일 — 핵심 수정과 무관하지만 커밋 메시지에 disclosed된 사소한 drive-by, 실제 파일 위치와 대조해 정확함을 확인 | `guard_review_before_push.py:91`, `test_push_guard_allowlist.py:4` | 조치 불요 |
| 6 | Side Effect | `_GIT_PUSH`(차단 게이트) 판정 경계가 넓어짐 — 이전에 무검사로 통과되던 미종료 따옴표 형태가 이제 검사·차단 대상이 됨. 의도된 확장이며 `GeneratedFloorTest`(168조합, 손실 0/획득 12)로 무손실 상위집합임을 실측 확인 | `guard_review_before_push.py:119` | 조치 불요 — 향후 push 실패 리포트 증가 시 원인 추적 참고 |
| 7 | Testing | 넛지 훅(`_MUTATING`)의 `OldEnvPrefixSupersetTest`에는 push 가드 `GeneratedFloorTest`와 대칭적인 비-vacuity 커버리지 하한 단언(`compared > _MIN_CORPUS_COVERAGE`)이 없음 — 현재는 84건 중 68건 참여해 vacuous 아니나 향후 리팩터링 시 조용히 무력화될 수 있음 | `test_guard_default_branch_bash_mutating.py` `OldEnvPrefixSupersetTest.test_no_classification_is_lost` (255-261행) | `GeneratedFloorTest`와 동일한 하한 단언 추가 |
| 8 | Documentation | plan 체크리스트의 "두 훅 + 미러 3곳" 표현이 실제 반영 지점(훅 2 + 미러 1 = 총 3)과 다르게 5곳으로 오독될 여지 있음(낮은 확신) | `plan/in-progress/harness-guard-followups.md:486` | "미러 1곳" 또는 "총 3곳(훅 2+미러 1)"으로 정정 |
| 9 | Documentation | `.claude/tests/README.md` 카탈로그가 이번 diff의 신규 테스트 클래스(`OldEnvPrefixSupersetTest`, `GeneratedFloorTest`, `KnownFalseNegativeTest`)와 J-후속/§L 내용을 반영하지 않음 — 가드(`test_tests_readme_catalog.py`)는 파일명 등재만 검사해 통과함 | `.claude/tests/README.md:46-47` | 필수는 아니나 두 행에 한 문장씩 갱신 권장 |
| 10 | Requirement | 커밋 메시지/plan 표의 "생성 입력 168건, 28건 손실·12건 획득" 정확한 수치는 diff만으로 재현되지 않음(정성적 결론 "무손실 상위집합"은 여러 방식으로 독립 재검증되어 참) | `plan/in-progress/harness-guard-followups.md`, 커밋 `11a94fe9b` | 조치 불요(낮은 우선순위, 서술 정밀도) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 보안 강화 방향 확인, 신규 취약점 없음, ReDoS 미재도입 검증, §L 잔여 갭은 이미 캐너리·백로그로 관리됨 |
| requirement | NONE | §J-후속 FN 해소가 pytest 실행(69 passed/214 subtests)으로 정확히 검증됨, spec 커버리지 대상 밖(harness 도구), plan 정합 확인 |
| scope | LOW | 핵심 diff는 §J-후속 단일 결함 수정에 수렴, SoR 경로 정정 2줄 + §L canary 동반 포함은 disclosed minor |
| side_effect | LOW | 함수 시그니처/전역상태/공개 인터페이스 불변, 게이트 판정 경계 확장은 의도된 방향이며 무손실 상위집합 실측 확인 |
| maintainability | LOW | §K/§L 오기, 테스트 픽스처(`_VALUES`) 중복 및 안전장치(`test_no_duplicate_values`) 비대칭 |
| testing | LOW | 69 passed/214 subtests 결정적 통과, 넛지 훅 쪽 비-vacuity 커버리지 하한 단언 누락이 유일한 개선 여지 |
| documentation | MEDIUM | 모듈 docstring이 이번 diff가 고친 동작을 여전히 반박(자기모순), 같은 파일 내 §K/§L 레터 불일치 |

## 발견 없는 에이전트

없음 — 7개 에이전트 모두 최소 INFO 이상의 발견사항을 보고함(대부분 코드 동작에는 영향 없는 문서/테스트 정확성 수준).

## 권장 조치사항

1. `guard_default_branch_bash.py:33-36` 모듈 docstring에서 "unclosed quote는 unmatched로 남는다"는 서술을 제거·갱신 — 이번 diff가 정확히 그 동작을 고쳤으므로 자기모순 해소가 최우선.
2. `test_push_guard_allowlist.py:340-341`의 "§K"를 "§L"로 정정해 백로그 레터 자기모순 해소.
3. `OldEnvPrefixSupersetTest`(넛지 훅 테스트)에 `test_no_duplicate_values`와 비-vacuity 커버리지 하한 단언을 추가해 push 가드 쪽 `GeneratedFloorTest`와 방어 수준을 대칭화.
4. 두 테스트 파일의 `_VALUES` 생성 코퍼스 리터럴을 단일 소스화하거나 최소 드리프트 가드 테스트 추가.
5. (낮은 우선순위) plan 체크리스트 "미러 3곳" 표현 정정, `.claude/tests/README.md` 카탈로그에 신규 테스트 클래스 한 문장씩 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 즉 이번 실행된 7명 전원이 router_safety 화이트리스트에 의해 강제 포함되었으며 (router 자체의 organic 선택은 0명), forced 전원 결과 확보됨 — 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(사유 미기재, diff가 하네스 훅 정규식 변경으로 성능 프로파일 영역 아님) |
  | architecture | router 판단(사유 미기재, 아키텍처 변경 없음) |
  | dependency | router 판단(사유 미기재, 의존성 변경 없음) |
  | database | router 판단(사유 미기재, DB 관련 코드 없음) |
  | concurrency | router 판단(사유 미기재, 동시성 로직 변경 없음) |
  | api_contract | router 판단(사유 미기재, API 계약 변경 없음) |
  | user_guide_sync | router 판단(사유 미기재, 사용자 가이드 대상 아님·내부 harness 도구) |