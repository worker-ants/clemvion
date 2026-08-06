# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이번 라운드(5R)가 `review-gate.yml` 자체(문서 전체 정확 일치 + 판정자 단일성 행위 검증)는 실제로 견고하게 굳혔으나, 그 방어를 CI 에 실어 나르는 `harness-checks.yml` 과, 판정자 단일성을 지키는 `check-review-gate.py`/`test_review_gate_ci.py` 조합 양쪽에 **아직 뚫려 있는 서로 다른 3개 CRITICAL 우회 경로**가 5개 리뷰어(architecture, security, requirement, side_effect, testing)의 독립 실측(mutation)으로 확인됐다. 모두 "테스트 스위트 전체 GREEN 유지 + 실제 판정/동작은 바뀜" 형태다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/CI 배선 | `review-gate.yml` 에 적용된 "job/step 이 실패를 삼키거나 꺼질 수 없다" 불변식이 그 스위트를 실제로 구동하는 `harness-checks.yml` 에는 없다. `unittest` 스텝에 `continue-on-error: true` 삽입 또는 job 에 `if: false` 삽입해도 하네스 826개 테스트 전부 그대로 통과(격리 clone 실측 완료). GH Actions 상에서는 해당 job 이 조용히 무력화/skip 되고 PR 은 다른 체크만으로 머지 가능해진다. | `.github/workflows/harness-checks.yml:68`(job), `:87-88`(unittest 스텝) | `harness-checks.yml` 에도 `WorkflowWiringTest` 와 동형인 전체-문서 골든파일 비교 또는 최소 "continue-on-error 없음·if 없음·timeout≠0" 서브셋 불변식을 검증하는 `test_harness_checks_wiring.py` 신설 |
| 2 | 보안/CI 배선 | `harness-checks.yml` 의 테스트 discovery 커맨드(`-p 'test_*.py'`) 자체를 검증하는 가드가 없다. 패턴을 한 문자만 좁혀(`test_[!r]*.py`) 재현한 결과 `test_review_gate_ci.py` 를 포함해 11개 가드 파일이 CI 에서 영원히 안 도는데도, 남은 파일들과 11개 파일을 discover 밖에서 개별 실행한 결과 모두 GREEN — "파일이 옳다"와 "CI 가 그 파일을 부른다"가 분리돼 있고 후자를 고정하는 것이 없다(PR 이 자기 자신의 `harness-checks.yml` 을 이렇게 고치면 그 PR 을 검사하는 CI 실행 자체가 이미 이 뮤테이션으로 돈다). | `.github/workflows/harness-checks.yml:88`(`run:` 문자열) | `-p` 값을 파싱해 `.claude/tests/` 의 실제 `test_*.py` 파일 목록과 `fnmatch` 결과가 **전체집합**으로 일치하는지 검사하는 메타 테스트 추가, 또는 `WorkflowWiringTest` 방식을 이 파일에도 적용 |
| 3 | 요구사항/테스트/부작용 (3개 리뷰어 중복 발견 — 통합) | "판정자는 하나다"를 지키는 정적 `OneJudgeTest`(`ast.Call` 노드만 순회)와 행위 `VerdictComesFromTheGateTest`(부모 프로세스 환경을 그대로 상속) 둘 다 `os.environ` 의 **비-Call 접근**(`Subscript`/`Compare`/`IfExp`)을 통한 판정 우회를 놓친다. 세 리뷰어가 각각 다른 변형(① `GITHUB_ACTOR` 값 화이트리스트로 `blocked=False` 강제, ② `REVIEW_GATE_SKIP=1` 조건부 override, ③ `args = ap.parse_args(...)` 직후 `GITHUB_ACTOR=="trusted-release-bot"` 조기 `return 0` — 게이트 호출 자체를 건너뜀)로 실측: 새 import/Call/속성대입 0개인 채 14개 테스트 전부 GREEN 유지, 그러나 실제 미해결-리뷰 세션에 `--enforce` 적용 시 종료 코드가 1→0으로 뒤집힘(③번 변형은 advisory 출력조차 없이 조용히 통과). | `scripts/check-review-gate.py`(`args`파싱 직후 또는 `decision.blocked` 읽는 지점 직후 삽입 가능), `test_review_gate_ci.py:265-355`(`OneJudgeTest`), `:493-527`(`VerdictComesFromTheGateTest`) | (1) `VerdictComesFromTheGateTest` 의 subprocess 호출을 ambient env 상속 대신 최소·명시 env 로 바꾸거나 GH Actions 예약 변수(`GITHUB_ACTOR` 등)를 임의 비어있지 않은 값으로 채운 조합을 추가. (2) `OneJudgeTest` 를 `ast.Compare`/`ast.Subscript`/`ast.IfExp`/`ast.BoolOp` 까지 넓히거나, `parse_args`~`evaluate` 호출 구간에 조건부 `return`/`If` 가 없다는 제어흐름 선형성을 별도 테스트로 고정. 두 축 다 필요(하나만으로는 다음 라운드에 다른 축으로 재발). |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `harness-checks.yml` 자신의 `concurrency:`(group/cancel-in-progress) 블록 값에 테스트 커버리지가 전혀 없다 — `group` 을 `github.run_id` 기반으로, `cancel-in-progress` 를 `false` 로 바꿔도 하네스 827개 테스트 전부 green(실측). 새로 만든 결함은 아니나 이번 라운드가 겨냥해 온 "테스트가 안 보는 필드" 클래스와 동일 모양. | `.github/workflows/harness-checks.yml:63-65` | `doc["concurrency"] == {"group": "harness-checks-${{ github.ref }}", "cancel-in-progress": True}` 한 줄 단언 추가 |
| 2 | 부작용 | Critical #3 와 같은 구멍의 일반형: `decision.reason`/`decision.notes` 의 **내용**을 `==`/`in` 으로 비교해 분기하는 것도 같은 비-Call 우회다. 환경변수 없이도 스크립트 단독 diff 로 성립. | `scripts/check-review-gate.py:101-102` | Critical #3 수선과 동일 조치로 함께 닫힘 — 별도 대응 불필요 |
| 3 | 의존성 | `PyYamlPinsAgreeTest` 는 3개 pip-install 지점의 PyYAML 버전 **합의**만 검증, "그 합의된 값이 안전한 하한인가"는 검증하지 않는다 — 세 지점을 동시에 낮춰도(예: 오래된 취약 릴리스) `len(pins)==1` 이라 통과. pip install 리터럴이라 Dependabot·override-floor 가드 어디에도 안 걸린다(테스트 자신도 이 한계를 docstring 에 인정). | `.claude/tests/test_review_gate_ci.py:530-549` | 유일 pin 값에 대해 `assertGreaterEqual` 로 하한 버전 파싱 단언 추가, 근본 해결은 `constraints.txt` 단일화(plan 후속 등재) |
| 4 | 문서화 | `harness-checks.yml` 의 `.github/workflows/**` 등재 사유 주석이 "두 가드"만 나열하는데 실제로는 `test_review_gate_ci.py::WorkflowWiringTest` 도 이 glob 폭에 의존하는 세 번째 가드다 — 미래에 이 주석만 믿고 glob 을 좁히면 `review-gate.yml` 단독 수정이 트리거를 놓치는 사각을 만든다(가드 자신이 막으려는 실패 클래스를 주석이 재생산). | `.github/workflows/harness-checks.yml:41-52` | 주석에 `WorkflowWiringTest` 를 세 번째 항목으로 추가, "두 가드"→"세 가드" 정정 |
| 5 | 문서화 | `.claude/tests/README.md` 의 `test_review_gate_ci.py` 행이 현재(4R) 방어 수준인 "파싱된 워크플로 문서 **전체**를 하나의 기대 리터럴과 비교"(`WorkflowWiringTest`)를 설명하지 못하고, 더 이전(이미 뚫린) "구조적 파싱" 수준 서술에 머물러 있다(`WorkflowWiringTest` 클래스명, "전체 문서" 표현 모두 README 에 등장하지 않음, grep 0건). | `.claude/tests/README.md:48` | `WorkflowWiringTest` 명시 + "문서 전체 비교" 로 갱신, `VerdictComesFromTheGateTest` 와의 역할 구분도 명시 |
| 6 | 유지보수성 | 동일 advisory 문자열(`"⚠️  세션X: 하향 감지"`)이 다른 3개 지점은 리터럴 한글, `test_review_gate_ci.py:207` 한 곳만 `\uXXXX` escape 로 표기 — 기능은 동일하나 `grep "하향 감지"` 가 이 발생 지점을 건너뛴다. | `.claude/tests/test_review_gate_ci.py:207` | 다른 3곳과 동일하게 리터럴 한글로 통일 |
| 7 | 유지보수성 | 테스트 메서드 2개(`OneJudgeTest.test_the_import_and_call_surface_stays_small`, `WorkflowWiringTest.test_the_expectation_still_describes_a_gate_that_runs`)가 각각 5개/6개의 독립 불변식을 하나로 묶어 함수 길이·책임이 과다하다. 라운드4 이전엔 이름 붙은 개별 테스트였고, 이번 통합으로 실패 시 테스트 **이름**만으로 "무엇이 깨졌는지" 알아채기 어려워졌다(`test_it_is_still_observation_only` 의 발견 가능성 설계가 `--enforce` 부재 단언 한 줄로 축소). | `.claude/tests/test_review_gate_ci.py:265`, `:440` | 각 불변식을 이름이 곧 실패 사유가 되는 별도 assert 헬퍼 또는 개별 `test_*` 메서드로 재분리 |
| 8 | 성능 | 이번 PR 이 `evaluate_review()` 의 두 번째 정기 호출자(로컬 훅 + CI)를 추가했는데, 그 함수의 실행시간/자원 사용에 상한을 두는 단언이 어디에도 없다 — `_run()` 은 `timeout=120`(초) 로만 걸러내 수십 초대 성능 회귀가 들어와도 스위트는 green. | `scripts/check-review-gate.py:97`, `test_review_gate_ci.py:85` | wall-clock 측정 advisory 로깅 또는 세션 수 N/2N 배율 확인하는 성능 회귀 테스트 추가 검토 |
| 9 | 테스트 | `PyYamlPinsAgreeTest` 의 정규식 `pip install "(pyyaml[^"]*)"` 은 큰따옴표 형태만 인식 — 홑따옴표(`pip install 'pyyaml>=6,<7'`)나 무인용(`pip install pyyaml==6.0.3`) 형태는 "다르다"로 실패하는 게 아니라 `pins` 딕셔너리에 아예 안 잡혀 "안 보인다"로 조용히 통과한다. | `.claude/tests/test_review_gate_ci.py:541-549` | 홑따옴표/무인용 fixture 로 `BoundaryTest` 추가, 또는 "워크플로 파일 수 == pin 찾은 파일 수" 별도 단언 |
| 10 | 테스트 | `VerdictComesFromTheGateTest` 의 스텁이 `cwd`/`in_flight_ok` 인자를 완전히 무시(의도된 격리) — 이 클래스가 인자 전달 자체의 회귀는 검사하지 않는다는 경계가 독스트링에 명시돼 있지 않다. | `.claude/tests/test_review_gate_ci.py:495-510` | 독스트링에 "인자는 무시, 인자 전달 회귀는 `ReviewGateCliTest` 가 담당" 한 줄 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 크로스커팅 (4개 리뷰어 독립 관측) | 리뷰 페이로드에 포함되지 않은 `.claude/tests/test_workflow_yaml_structure.py` 가 작업 트리에 이미(unstaged) 수정돼 있는 상태를 performance/side_effect/testing/dependency 4개 리뷰어가 각각 독립적으로 관측(모두 손대지 않고 보고만 함). `continue-on-error` 를 전 워크플로/전 job·step 에 걸쳐 금지하는 `test_no_guard_workflow_swallows_its_own_failure` 신설로 보인다 — 방향성은 Critical #1 과 정확히 합치. | `.claude/tests/test_workflow_yaml_structure.py`(uncommitted) | 이 상태가 이번 라운드의 의도된 진행중 산출물인지 다른 세션 잔여물인지 확인 후 커밋 또는 정리, plan 문서에 반영 |
| 2 | 아키텍처 | default-branch 해석 로직이 `branch_guard`/`review_guard`/`code_review_orchestrator`/`consistency_orchestrator` 4곳에 독립 구현(반환 계약도 상이) — pre-existing, plan 문서에 이미 후속(defer) 등재됨 | `plan/in-progress/harness-review-gate-ci-backstop.md`(§신규 후속) | 정책 변경 시 4곳 동기화 필요, 별도 조치 불요(추적만 재확인) |
| 3 | 아키텍처 (긍정) | `_lib/failopen_state.py` 추출(스트림 파라미터 주입) 과 `block_integrity` 의 `ALL_CHECKERS` 파생 강제 + 의존성 방향 고정 — 둘 다 DRY/의존성 역전을 테스트로 고정한 좋은 사례 | `.claude/tests/test_stop_guard_failopen.py`, `.claude/tests/test_block_integrity.py:640` | 조치 불필요 |
| 4 | 동시성 | `review-gate.yml` 의 전체-문서 정확일치(`WorkflowWiringTest`)는 최상위 키 **중복** 스머글링에는 그 자체로 무력하고, 이웃 파일(`test_workflow_yaml_structure.py::test_no_duplicate_keys`)의 저장소 전역 가드에 암묵 의존(스위트 전체 기준으로는 안전, 상호참조 문서화만 갭) | `test_review_gate_ci.py:436-438` | `WorkflowWiringTest` docstring 에 "중복 키 방어는 별도 파일 담당" 한 줄 상호참조 추가 |
| 5 | 동시성 (긍정) | 스레드/asyncio/subprocess 기반 "숨은 제2 판정자" 경쟁 공격은 import/호출 허용목록(`OneJudgeTest`)으로 이미 구조적으로 닫혀 있음 | `test_review_gate_ci.py:239-246` | 조치 불필요 |
| 6 | 의존성 (긍정) | PyYAML 재사용은 신규 외부 의존 아님(2026-08-01 기승인), `safe_load` 만 사용, 라이선스 충돌 없음. GH Actions 액션 pin 도 저장소 전역 관례와 완전 일치, 신규 action 없음 | `.github/workflows/harness-checks.yml:80-85`, `review-gate.yml:55-61` | 조치 불필요 |
| 7 | 의존성 | `harness-checks.yml:74-76` 주석("v5/v6 line")이 실제 pin(`@v7`)과 어긋남 — pre-existing, 이번 diff 대상 아님 | `.github/workflows/harness-checks.yml:74-76` | 다음에 이 파일을 건드릴 때 한 줄 정정(차단 사유 아님) |
| 8 | 의존성 (긍정) | `scripts/check-review-gate.py` → `.claude/hooks/_lib/review_guard.py` 결합은 명시적 설계 의도("판정자 하나")이고, import/paths 트리거·fail-open 으로 잘 봉쇄됨 | `review-gate.yml:24-34`, `harness-checks.yml:58-60`, `check-review-gate.py:51-74` | 조치 불필요, 시그니처 변경 시 상호 참조 주석 권장 |
| 9 | 문서화 | `Fetch base ref` 스텝 주석이 필요성을 기정사실처럼 서술하는데 plan 문서는 "GH Actions 러너 없이 미실측"으로 명시 — 두 문서의 확신 수준 불일치 | `review-gate.yml:63-66` vs `plan/in-progress/harness-review-gate-ci-backstop.md:38-40` | 워크플로 주석에 "필요성 미실측 — plan 열린 질문 참조" 한 줄 추가 |
| 10 | 문서화 | `_ROOT_DEFAULT` 계산 줄에 설명 주석이 없고, 인접 주석은 다른 결정(`_load_gate` 의 `_lib` 경로 선택)을 설명해 오독 소지 | `scripts/check-review-gate.py:55-60` | `_ROOT_DEFAULT` 위에 가정+가드 테스트명을 명시하는 주석 추가 |
| 11 | 문서화 | plan 문서 상태표가 "1R~4R 진행 중"에 머물러 있으나 실제로는 4R 결론이 이미 코드에 커밋 반영됨 | `plan/in-progress/harness-review-gate-ci-backstop.md:18` | 라운드5 종료 후 상태표에 결과 반영 행 추가 |
| 12 | 유지보수성 | 손으로 작성한 결정 객체 stub 소스 문자열이 여러 파일에 반복 타이핑돼 있고, `push_blocks` 필드 하나만 교차검증(`PlanStubsMirrorTheRealInterfaceTest`) — 다른 신규 필드는 강제되지 않음 | `test_block_integrity.py:640`, `test_stop_guard_failopen.py:45,135` | `_harness.py` 에 stub 빌더 함수 추가(범위 밖, 우선순위 낮음) |
| 13 | 유지보수성 | `WorkflowWiringTest.EXPECTED` 가 `review-gate.yml` 전체를 파이썬 리터럴로 재타이핑 — 의도된 트레이드오프(4R 라운드 결론)지만 이중 유지보수 지점 | `test_review_gate_ci.py:385-421` vs `review-gate.yml:20-73` | 조치 불필요(현재 `assertEqual` diff 로 실질적 충족) |
| 14 | 유지보수성 | `VerdictComesFromTheGateTest._CASES` 4-분기 진리표가 이름 없는 위치 인자 튜플로 표현 | `test_review_gate_ci.py:493` | `NamedTuple`/`dataclass` 로 필드명 부여(우선순위 낮음) |
| 15 | 성능 | `ReviewGateCliTest.setUp()` 이 테스트 메서드마다(9회) `.claude/hooks`+`.claude/_shared` 전체를 `shutil.copytree` — 절대 비용은 작으나 스위트 성장 시 누적 | `test_review_gate_ci.py:47-50` | `setUpClass` 로 베이스 트리 복사 1회 이동 검토(시급하지 않음) |
| 16 | 성능 | `fetch-depth: 0` 전체 히스토리 체크아웃 + 고정 `timeout-minutes: 5` — 저장소 성장에 따른 비용 증가를 감지할 예산 임계 테스트/모니터링 없음. 타임아웃 시 게이트는 "판정"이 아니라 "인프라 타임아웃"으로 죽고, 이는 스크립트 내부 fail-open 계약 밖 사각지대 | `review-gate.yml:47`(timeout), `:57`(fetch-depth), `:67-70` | 기록만, 조치 요구 없음 |
| 17 | 보안 | `harness-checks.yml` 에 명시적 `permissions:` 블록 없음(pre-existing, 이번 diff 는 경로 한 줄+주석만 추가) — 조직 기본 `GITHUB_TOKEN` 권한을 그대로 상속 | `.github/workflows/harness-checks.yml` | `review-gate.yml` 과 동일하게 `permissions: {contents: read}` 명시 권장(차단 사유 아님) |
| 18 | 보안 | `check-review-gate.py` 의 fail-open 예외 처리기가 `{type(exc).__name__}: {exc}` 형태로 예외 메시지를 stderr 에 그대로 출력 — 시크릿 아님, 의도된 관측성 트레이드오프 | `scripts/check-review-gate.py:72, 104` | 조치 불필요 |
| 19 | 요구사항 | `Fetch base ref` 필요성 미검증과 "기대값+워크플로 동시 편집" 한계 모두 plan 문서/테스트 docstring 이 정직하게 인정한 known limit — 새 결함 아님 | `plan/in-progress/harness-review-gate-ci-backstop.md:38-40`, `test_review_gate_ci.py:380-381` | 조치 불필요 |
| 20 | 스코프 | `PyYamlPinsAgreeTest` 신설(전체 워크플로 순회)과 `test_block_integrity.py`/`test_stop_guard_failopen.py` 의 무관 백스톱 버그 수정은 이번 라운드 요청 범위를 다소 벗어나나 테스트 전용·좁은 변경으로 리스크 낮음 | `test_review_gate_ci.py:530`, `test_block_integrity.py:640` | 조치 불필요, 향후 커밋 메시지에 "겸사겸사 추가"임을 명시하면 추적성 향상 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | CRITICAL | `harness-checks.yml` 에 review-gate.yml 급 배선 불변식 부재(Critical #1) |
| security | CRITICAL | `harness-checks.yml` 테스트 discovery 커맨드 미검증(Critical #2) |
| requirement | HIGH | `os.environ` 비-Call 접근으로 판정자 단일성 가드 우회(Critical #3, 재현) |
| side_effect | CRITICAL | 동일 우회(Critical #3) 재현 + reason/notes 비교 변형(WARNING #2) |
| testing | CRITICAL | 동일 우회(Critical #3) 재현 — 게이트 호출 자체를 건너뛰는 조기 return 변형, 가장 은밀 |
| concurrency | MEDIUM | `harness-checks.yml` `concurrency:` 값 미검증(WARNING #1) |
| dependency | LOW | `PyYamlPinsAgreeTest` 하한 미검증(WARNING #3) |
| documentation | LOW | README/주석 stale·확신 수준 불일치 (WARNING #4, #5) |
| maintainability | LOW | 문자열 표기 불일치, 테스트 메서드 과다 묶음 (WARNING #6, #7) |
| performance | LOW | `evaluate_review()` 성능 회귀 가드 부재 (WARNING #8) |
| scope | LOW | 8개 파일 diff 범위 내로 확인, 부가 하드닝 2건은 저위험 |
| database | NONE | 데이터베이스 관련 코드 변경 없음 |
| api_contract | NONE | 제품 API 표면 변경 없음 |
| user_guide_sync | NONE | 유저 가이드 동기화 매트릭스 22개 trigger 모두 비매칭 |

## 발견 없는 에이전트

- database — 데이터베이스 스키마/쿼리/ORM/마이그레이션 대상 없음
- api_contract — 제품 REST/GraphQL API 표면 변경 없음
- user_guide_sync — 매트릭스 22개 trigger 행 전수 대조, 매칭 0건

## 권장 조치사항

1. **`harness-checks.yml` 에 `review-gate.yml` 급 배선 불변식 이식** — (a) job/step 의 `continue-on-error`/`if` 부재를 검증하는 전체-문서 골든파일 비교 또는 서브셋 단언, (b) `-p` 테스트 discovery 패턴이 `.claude/tests/` 의 실제 `test_*.py` 전체집합과 일치하는지 검증하는 메타 테스트, (c) `concurrency:` 값 고정 단언 — 세 가지를 한 번에 닫아야 Critical #1·#2·WARNING #1 이 동시에 해결된다.
2. **판정자 단일성 가드를 두 축 모두 보강** — `OneJudgeTest` 를 `ast.Compare`/`ast.Subscript`/`ast.IfExp` 까지 확장하거나 게이트 호출 전 구간의 제어흐름 선형성을 직접 고정하고, `VerdictComesFromTheGateTest` 의 subprocess 환경을 ambient 상속 대신 GH Actions 예약 변수를 포함한 명시적 조합으로 교체(Critical #3, WARNING #2).
3. `PyYamlPinsAgreeTest` 에 하한 버전 단언 추가(WARNING #3).
4. `harness-checks.yml` 경로 등재 사유 주석("두 가드"→"세 가드")과 `README.md` 의 `test_review_gate_ci.py` 설명(구조적 파싱→문서 전체 일치)을 현재 코드 상태로 갱신(WARNING #4, #5).
5. `\uXXXX` escape 리터럴 통일, `OneJudgeTest`/`WorkflowWiringTest` 의 다중 불변식 테스트를 개별 assert 헬퍼/메서드로 재분리해 실패 이름의 발견 가능성 복원(WARNING #6, #7).
6. `evaluate_review()` 실행시간에 대한 성능 회귀 가드 추가 검토(WARNING #8).
7. `PyYamlPinsAgreeTest` 파서에 홑따옴표/무인용 pin fixture 보강, `VerdictComesFromTheGateTest` 스텁의 인자 무시 범위를 독스트링에 명시(WARNING #9, #10).
8. `.claude/tests/test_workflow_yaml_structure.py` 의 미커밋 변경 상태를 확인(이번 라운드 진행중 산출물인지, 다른 세션 잔여물인지) 후 커밋 또는 정리(INFO #1, 4개 리뷰어 독립 관측).

## 라우터 결정

`routing_status=skipped` — 사유: `--route=all`. 전체 14개 reviewer 실행됨(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync).

참고로 `_retry_state.json` 에는 router_safety 에 의한 강제 포함 목록(`agents_forced`: documentation, maintainability, requirement, scope, security, side_effect, testing)이 기록돼 있으나, `--route=all` 로 라우터 자체가 스킵되어 전원 실행되는 이번 상황에서는 이 목록이 실질적 영향을 주지 않았다(강제 여부와 무관하게 14명 전원 실행·전원 보고서 확보).