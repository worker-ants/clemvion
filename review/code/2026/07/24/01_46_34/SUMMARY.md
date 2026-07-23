# Code Review 통합 보고서

## 전체 위험도
**LOW** — `.claude/hooks/guard_default_branch_bash.py`/`guard_review_before_push.py` 의 env-value
정규식 대안에 `\S+` 트레일링 폴백을 복원해 §J-후속 회귀(미종료 따옴표로 인한 push/mutating
탐지 자체의 false-negative)를 고친 보안 강화 변경이며, 직전 리뷰(01_25_14)의 Warning 4건도 모두
반영 확인됨. Critical 없음, WARNING 2건(둘 다 커버리지/스코프 성격, 기능 결함 아님). **forced
reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect,
testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | §L(닫는 따옴표 뒤에 다른 문자가 붙는 env 값 미탐지, 예: `A="a b"c git push`)에 대한 캐너리 테스트·plan 신규 섹션·공유 픽스처(`ENV_VALUE_SHAPES`) 확장이, 이번 작업이 명시한 목적(§J-후속 회귀 수정) 밖의 완전히 별개 선재(pre-existing) 버그 클래스임에도 같은 diff 에 함께 포함됨. 실제 코드 동작 변경은 없고(§L 은 "고치지 않는다"는 사실 자체를 캐너리로 고정) 이미 `RESOLUTION.md`·직전 리뷰(01_25_14 INFO#3)에서 검토·수용된 트레이드오프임 | `.claude/tests/test_push_guard_allowlist.py` `KnownFalseNegativeTest`(신규), `.claude/tests/_harness.py:66-69`(§L 값 형태 3건 추가), `plan/in-progress/harness-guard-followups.md` `## L.` 섹션(495-511행) | 기능 영향 없어 되돌릴 필요는 없음. 향후 "회귀 수정" 커밋과 "새로 발견한 별개 갭의 캐너리 등록" 커밋을 분리하면 diff 가 더 좁고 리뷰하기 쉬워짐(권고, 비차단) |
| 2 | testing | `OldEnvPrefixSupersetTest`(넛지 훅 회귀 테스트)가 짝 클래스 `GeneratedFloorTest`(push 가드)가 명시한 두 축(env 값 SHAPE × **할당 개수**) 중 "할당 개수" 축을 전혀 생성하지 않음 — 값이 항상 유일·유일한 할당인 경우만 테스트하고, 두 번째 이후 위치의 할당이나 다중 할당 조합은 커버하지 않음. 이번 diff 전체의 전제("두 훅이 같은 방식으로 두 번 회귀했다")에 비춰 실질 커버리지 갭 | `.claude/tests/test_guard_default_branch_bash_mutating.py:236`(`_COMMANDS`), `:249-250`(`_cases`) — 대비: `.claude/tests/test_push_guard_allowlist.py`의 `GeneratedFloorTest._TEMPLATES`(다중 할당 템플릿 포함) | `_cases()`에 `GeneratedFloorTest._TEMPLATES`와 대칭적으로 `"A=1 B={v} {c}"`, `"A={v} B=z {c}"` 같은 다중 할당 템플릿 추가하여 push 가드와 대칭 커버리지 확보 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 변경 방향 자체가 보안 강화(FN 축소)이며 신규 취약점 없음. 두 훅 모두 입력을 실행하지 않고 `re.search()` 로만 판정하므로 커맨드 인젝션 경로 없음. `OldEnvPrefixSupersetTest`/`GeneratedFloorTest` 가 "옛 패턴의 엄밀한 상위집합"을 생성 기반으로 강제 | `guard_review_before_push.py:118-121`, `guard_default_branch_bash.py:109-114` | 조치 불요 |
| 2 | security | ReDoS(파국적 백트래킹) 재도입 여부 검증 — 필수 앵커·비중첩 반복 구조라 병리적 폭발 파티션 없음. `BacktrackingTest`(양쪽 훅)로 adversarial 입력 지속 회귀 가드 | 동일 두 정규식 | 조치 불요 |
| 3 | security/scope/testing | §L(닫는 따옴표 뒤 문자 결합) 은 이번 diff 범위 밖의 사전 존재 갭이며, `KnownFalseNegativeTest` 캐너리 + plan 백로그로 은폐되지 않게 관리 중. 자연스러운 수정안(문자 단위 반복 대안) 자체가 새로운 ReDoS 위험을 안고 있어 측정 선행 필요 — 성급한 수정을 보류한 판단은 타당. 다만 "넛지 훅도 같은 갭을 공유한다"는 plan 서술을 검증하는 테스트는 push 가드 쪽에만 있고 넛지 훅에는 없음(산문 주장) | `guard_review_before_push.py:118-121`; `test_push_guard_allowlist.py:891-928`(`KnownFalseNegativeTest`, push 가드 전용); `plan/in-progress/harness-guard-followups.md` `## L.` | 이번 PR 범위에서 조치 불요. (선택) 넛지 훅에도 `_is_mutating("A=\"a b\"c mkdir foo")`가 여전히 `False`임을 pin하는 축소판 캐너리 추가 시 plan 주장이 실행 가능한 단언이 됨 — 저우선순위 |
| 4 | security | 하드코딩 시크릿/인젝션/인증-인가/암호화/의존성 변경 없음. 테스트 픽스처의 `~/.key` 등은 매칭 대상 예시 문자열일 뿐 실제 자격증명 아님 | 전체 diff | 조치 불요 |
| 5 | security | fail-open 예외 처리(`except Exception: ... sys.exit(0)`)는 이번 diff 범위 밖 기존 설계이며, 문서화된 정책 + 별도 관측 카운터(`push_guard_failopen.json`) 존재 | `guard_default_branch_bash.py:63-66` | 조치 불요 |
| 6 | requirement | 대상이 `.claude/` 하네스 개발 도구(제품 코드 아님)라 `spec/` 커버리지 대상 밖. `plan/in-progress/harness-guard-followups.md` 가 사실상 SoR 역할을 하며 diff 와 line-level 로 일치 | `spec/` 전체 | 조치 불요 |
| 7 | requirement | plan 표의 정확한 수치("168건/28건/12건")가 §L 형태 추가(24→29개 값) 이후 현재 목록으로는 그대로 재현되지 않으나, 핵심 주장("손실 0건, 엄밀한 상위집합")은 현재 전체 목록(29개 값)으로 재계산해도 유지됨. 이미 RESOLUTION 에서 저우선순위로 처분됨 | `plan/in-progress/harness-guard-followups.md` J-후속 섹션 표 | 조치 불요 |
| 8 | scope | SoR 문서 경로 오탈자 정정(`plan/in-progress/...` → `plan/complete/...`)이 핵심 수정과 무관한 2개 파일에 곁다리로 포함된 drive-by. 사실관계는 맞고 규모가 극히 작음 | `guard_review_before_push.py:91`, `test_push_guard_allowlist.py:4` | 조치 불요. 향후 무관 경로 수정은 별도 커밋 권장 |
| 9 | scope/maintainability | 정규식 인접 인라인 주석 블록이 상당히 증가(각 파일 +9~11줄)했으나 실질 코드 변경은 alternation 한 곳뿐 — 이 저장소가 이미 채택한 "근거를 코드 옆에 직접 남기는" 컨벤션과 일치, 코드와 뒤섞이지 않음 | `guard_default_branch_bash.py:87-101,108-112`, `guard_review_before_push.py:106-117` | 조치 불요 |
| 10 | scope | 이전 리뷰 세션(`review/code/2026/07/24/01_25_14/`) 산출물 11개 파일이 diff 에 신규 파일로 포함 — `origin/main` 기준선 때문에 자연히 포함된 정상 워크플로 이력(`review/` 는 gitignore 대상 아님), 내용 불일치 없음 | `review/code/2026/07/24/01_25_14/*` | 조치 불요 |
| 11 | side_effect | 블로킹 게이트 `_GIT_PUSH` 판정 경계가 의도적으로 확장(무손실 상위집합) — 이전엔 무검사로 통과하던 push 형태가 이제 검사·차단 대상이 되는 관측 가능한 동작 변화지만 diff 의 명시적 목적 | `guard_review_before_push.py:119` | 조치 불요 |
| 12 | side_effect | 넛지 훅(`_MUTATING`)에도 동일 완화 적용 — 비차단이므로 부작용은 "reminder 가 조금 더 자주 뜬다" 수준 | `guard_default_branch_bash.py:111` | 조치 불요 |
| 13 | side_effect | 훅 2곳 + 테스트 미러 1곳(`_BLIND_PATTERN`) 의 패턴 동기화가 byte-identical 로 재확인됨. `EnvValueSubpatternSharedTest`/`BlindPassFrozenTest` 가 drift 지속 가드 | `guard_default_branch_bash.py:111`, `guard_review_before_push.py:119`, `test_push_guard_allowlist.py:82` | 조치 불요 |
| 14 | side_effect | 신규 공유 상수 `ENV_VALUE_SHAPES` 는 모듈 로드 시 1회 생성되는 불변 튜플, 테스트 전용, 런타임 부작용 없음 | `.claude/tests/_harness.py:62-70` | 조치 불요 |
| 15 | documentation/side_effect/maintainability/requirement/testing | 직전 리뷰(01_25_14)의 Warning 4건(W1: 모듈 docstring 자기모순, W2: §K/§L 백로그 레터 오기, W3: `_VALUES` 코퍼스 중복/드리프트, W4: `test_no_duplicate_values`/`_MIN_COVERAGE` 비대칭)이 전부 코드에 정확히 반영됨을 다수 리뷰어가 직접 파일 열람·grep·테스트 실행(71 passed / 552 passed 전체)으로 독립 재검증 | `guard_default_branch_bash.py:33-37`, `test_push_guard_allowlist.py`(§K 잔존 0건), `.claude/tests/_harness.py:62-70`(`ENV_VALUE_SHAPES`), `test_guard_default_branch_bash_mutating.py:239,258-263` | 조치 불요 |
| 16 | requirement/documentation | RESOLUTION.md 가 스스로 발견한 "공유 값 목록에서 미종료 따옴표 형태를 지우면 테스트가 안 잡는" 탈출구가 `test_the_regression_shapes_are_still_generated` 로 실제 봉쇄됐음을 뮤테이션 재현(제거→RED, 복원→GREEN)으로 독립 확인 | `test_push_guard_allowlist.py:358-375` | 조치 불요 |
| 17 | maintainability | `test_no_duplicate_values` 검증 로직이 공유 데이터(`ENV_VALUE_SHAPES`)에 대해 두 파일에 거의 그대로 복제됨(단일화된 것은 데이터뿐, 불변식 검사 로직은 아님) | `test_guard_default_branch_bash_mutating.py:258-263`, `test_push_guard_allowlist.py:352-356` | (선택) `_harness.py` 에 공용 헬퍼 추가 — 저우선순위 |
| 18 | maintainability | 동일 역할("생성 케이스가 비-vacuous 함을 보장")의 하한 상수가 파일마다 이름·스코프가 다름(`_MIN_COVERAGE` 클래스 속성 vs `_MIN_CORPUS_COVERAGE` 모듈 상수) | `test_guard_default_branch_bash_mutating.py:239`, `test_push_guard_allowlist.py:66` | (선택) 이름 통일 또는 상호 참조 주석 추가 |
| 19 | maintainability | "회귀 형태 보존" 가드(`test_the_regression_shapes_are_still_generated`)가 공유 데이터를 검증함에도 한쪽 파일에만 존재 — 실 커버리지 갭은 아니나(공유 리스트라 어느 쪽이든 CI 가 잡음), 어떤 공유-데이터 불변식을 대칭 복제할지 기준이 diff 에 없음 | `test_push_guard_allowlist.py:358-375` | (선택) `ENV_VALUE_SHAPES` 주석에 대칭 복제 기준 한 줄 추가 |
| 20 | testing | `_MIN_COVERAGE`/`_MIN_CORPUS_COVERAGE = 10` 비-vacuity 하한이 훨씬 커진 생성 케이스 모집단(116/203건) 대비 매우 느슨함(5~9%만 걸려도 통과) — 기존 설계를 답습한 것으로 이번 diff 가 새로 들여온 결함은 아님 | `test_guard_default_branch_bash_mutating.py:239`, `test_push_guard_allowlist.py:66,391` | (선택) 상대적 하한(비율 기반)으로 전환 또는 실측치에 근접한 값으로 상향 — 저우선순위 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 보안 강화 방향(FN 축소), 신규 취약점 없음, ReDoS 재도입 없음. §L 잔여 갭은 범위 밖·측정 선행 필요 판단 타당 |
| requirement | NONE | §J-후속 정확히 반영, 71 tests + 뮤테이션/직접 재현으로 검증 완료. spec 커버리지 대상 밖(harness 도구) |
| scope | LOW | 핵심 수정은 스코프 일치. §L 캐너리·SoR 오탈자 정정이 범위 밖으로 동반 포함(disclosed, 기능 영향 없음) → WARNING 1건 |
| side_effect | LOW | 함수 시그니처·전역 상태·공개 인터페이스·환경변수 불변. 유일한 관측 변화는 의도된 게이트 판정 경계 확장. 552 tests 재현 확인 |
| maintainability | LOW | 직전 Warning 4건 전부 해소 확인. 남은 것은 선택적 정리 여지(중복 로직·상수명 불일치) |
| testing | LOW | 직전 Warning 4건 반영 확인 + 71 tests/214 subtests 통과. 신규 WARNING(할당 개수 축 누락) 발견 |
| documentation | NONE | 직전 Documentation Warning 2건(docstring 자기모순, §K/§L 오기) 모두 정확히 해소 확인, 552 tests 독립 재현 |

## 발견 없는 에이전트

없음 — 7개 에이전트 모두 최소 1건 이상의 INFO 를 보고했다(Critical/Warning 없이 "문제 없음"만
보고한 에이전트는 없음).

## 권장 조치사항

1. (선택, 낮은 우선순위) testing WARNING #2: `OldEnvPrefixSupersetTest._cases()`에 다중 할당
   템플릿(`"A=1 B={v} {c}"`, `"A={v} B=z {c}"`)을 추가해 push 가드(`GeneratedFloorTest`)와 대칭
   커버리지 확보.
2. §L(닫는 따옴표 뒤 문자 결합 미탐지)은 이번 PR 범위에서 조치 불요 — 이미 백로그(plan `## L.`)
   + 캐너리(`KnownFalseNegativeTest`)로 은폐 없이 관리 중. 수정 시 ReDoS 재도입 위험이 있으므로
   측정을 선행할 것.
3. (선택) scope WARNING #1: 향후 유사 작업에서는 "회귀 수정" 커밋과 "새로 발견한 별개 갭의
   캐너리 등록" 커밋을 분리해 diff 표면을 좁힐 것 — 이번 건은 이미 disclosed 되어 되돌릴 필요
   없음.
4. (선택, 유지보수성) `_MIN_COVERAGE`/`_MIN_CORPUS_COVERAGE` 상수명 통일 및
   `test_no_duplicate_values` 중복 로직 공용 헬퍼화 — 저우선순위.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (reviewer · 이유, 7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 실행된 전원과 동일 — forced 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | prompt 에 개별 사유 미제공(라우터 판단). 대상이 정규식 hot-path 성능이 아닌 하네스 도구 diff라 관련성 낮음 |
  | architecture | prompt 에 개별 사유 미제공(라우터 판단) |
  | dependency | prompt 에 개별 사유 미제공(라우터 판단). 의존성 변경 없는 diff |
  | database | prompt 에 개별 사유 미제공(라우터 판단). DB 관련 코드 변경 없음 |
  | concurrency | prompt 에 개별 사유 미제공(라우터 판단). 동시성 관련 코드 변경 없음 |
  | api_contract | prompt 에 개별 사유 미제공(라우터 판단). API 계약 변경 없음 |
  | user_guide_sync | prompt 에 개별 사유 미제공(라우터 판단). 사용자 가이드 대상 아님(내부 harness 도구) |