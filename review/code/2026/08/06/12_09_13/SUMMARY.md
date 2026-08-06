# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 5명의 리뷰어(security/requirement/architecture/side_effect/testing)가 라운드 7이 신설한 CI 백스톱 가드(`TheGateItselfDoesNotBranchOnCiEnvTest`, 워크플로 identity 유일성)를 **실제 PoC로 우회**해 review-gate 판정을 뒤집는 데 성공했다 — 모두 하네스 스위트(835개) 전량 GREEN 을 유지한 채였다. 별도로 이미 enforce 중인 로컬 push/stop 훅(`review_guard._run_git`)에서도 살아있는 fail-open 버그가 발견됐다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/CI가드(파일범위 갭) | env-분기 금지 레지스트리 `_SCANNED`가 `review_guard.py`가 실제로 위임하는 `.claude/_shared/report_paths.py`/`block_integrity.py`를 스캔하지 않는다. 그 파일 중 하나(`missing_reports`/`has_report`)에 `GITHUB_JOB=="gate"`(또는 `GITHUB_WORKFLOW=="review-gate"`) 3줄만 심으면 강제 리뷰어가 실제로 보고서를 남기지 않은 세션이 review-gate.yml 의 실제 `gate` job에서만 "완전 커버"로 뒤집힌다 — security/requirement/side_effect 3개 리뷰어가 서로 다른 진입점·env 변수로 실측 PoC 확인(`check-review-gate.py --enforce` exit 1→0). dependency 리뷰어는 동일 갭을 "현재 dormant"로 WARNING 평가했으나 메커니즘 자체는 실증됨 | `.claude/tests/test_review_gate_ci.py:603`(`_SCANNED`); 대조 `.claude/hooks/_lib/review_guard.py:149-150,460,762,804` | `_SCANNED`를 import 그래프 기반 자동 도출로 전환하거나 최소 `_shared/report_paths.py`,`_shared/block_integrity.py` 명시 추가. `VerdictComesFromTheGateTest`가 스텁이 아니라 실제 `_shared` 모듈을 통해 검증하는 케이스 추가 |
| 2 | 보안/CI가드(구문범위 갭) | `TheGateItselfDoesNotBranchOnCiEnvTest`의 AST 수집기가 `os.environ.get()/.getenv()`·Subscript 두 형태만 인식한다. `.items()`, `.copy()`, `for k in os.environ`, 지역 별칭 등은 **이미 스캔 대상인 3개 파일(`review_guard.py` 자신 포함) 내부에서도** 검사를 피한다 — testing 리뷰어가 `review_guard.py`에 `dict(os.environ.items()).get("GITHUB_JOB")` 3줄을 직접 삽입해 실측(GITHUB_JOB=gate 시 즉시 판정 반전, 835개 전량 GREEN 유지) | `.claude/tests/test_review_gate_ci.py:594-596,605-640` | 정적 스캔을 행위 테스트로 전환(최소 환경 vs `GITHUB_JOB=gate` 포함 적대적 환경으로 `evaluate_review()` 실물 2회 호출 비교) 또는 최소 `ast.Attribute(attr="environ")` 전체 금지로 보강 |
| 3 | 아키텍처/CI가드(identity 정의 불일치) | `test_workflow_and_job_identities_are_unique`가 GitHub 이 실제 체크 매칭에 쓰는 job 표시 이름(`jobs.<id>.name` override, 기본값 job id)이 아니라 YAML **dict key**만 비교한다. 여기에 `_PULL_REQUEST_KEYS`가 필터 없는(가장 위험한) bare `pull_request:` 트리거를 검사 대상에서 제외하는 결함이 겹쳐, 기존 9개 워크플로를 한 글자도 건드리지 않고 새 워크플로 파일 하나(`name: gate` override + bare `pull_request:`)만 추가하면 `review-gate / gate` 체크를 참칭하는 always-green 워크플로를 심을 수 있음 — 실측: `test_workflow_yaml_structure.py` 전체 GREEN 유지 | `.claude/tests/test_workflow_yaml_structure.py:281,295`(`pairs` 키가 job dict key), `:247,265`(`_PULL_REQUEST_KEYS`, non-dict skip) | `pairs` 키를 `job.get("name", job_id)`(GitHub 이 실제 노출하는 문자열)로 변경. `_PULL_REQUEST_KEYS`의 non-dict skip 을 반전해 bare `pull_request:`도 등재 요구. 근본적으로 `.github/workflows/*.yml` **파일 집합 자체**를 닫힌 화이트리스트로 승격 |
| 4 | 보안(로컬 훅, 이미 활성) | `review_guard._run_git()`이 `git status --porcelain` 전체 stdout에 `.strip()`을 걸어, 여러 줄 블록의 **첫 줄**이 공백 상태코드로 시작(가장 흔한 "add 안 한 수정")할 때 선행 공백이 사라지고, `_porcelain_path()`의 고정폭 파싱이 경로 첫 글자를 깎는다(`codebase/x.ts`→`odebase/x.ts`). 그 파일은 "방금 편집됨" 신호를 완전히 잃어 로컬 push/stop 훅이 fail-open — 공격이 아니라 "파일 하나 고치고 push"라는 평범한 흐름에서 재현. 이번 PR 리뷰 대상 9개 파일 밖(위임된 판정 코드)이지만 이미 enforce 중인 1차 방어선의 살아있는 결함 | `.claude/hooks/_lib/review_guard.py:215`(`_run_git`), `:278-281`(`_porcelain_path`) | stdout을 줄 단위로 분리한 뒤 개행만 제거(전체-strip 금지). 실물 임시 git 저장소로 "커밋 안 된 수정 파일 정확히 하나" 시나리오 통합 회귀 테스트 추가 |
| 5 | 문서화(docstring 드리프트) | `test_workflow_yaml_structure.py` 모듈 docstring이 "Two invariants"라고 선언하지만 실제로는 라운드를 거쳐 8개 이상의 불변식을 강제한다 — 이 파일이 무엇을 막는지 헤더만 보고 판단할 다음 작업자를 오도할 수 있는, 이 저장소가 스스로(`README.md` PyYAML 단락) 경고해 온 "프로즈 개수는 stale해진다" 실패 클래스의 재발 | `.claude/tests/test_workflow_yaml_structure.py:16` | "Two invariants"를 개수 비의존 문구로 변경, 또는 최소 신규 클래스 추가 시 갱신 필요성을 헤더에 명시 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/최소권한 | `harness-checks.yml`에 명시적 `permissions:`이 없다(`review-gate.yml`은 `contents: read` 명시) — 저장소 기본 `GITHUB_TOKEN` 권한 설정에 의존 | `.github/workflows/harness-checks.yml` | `permissions: {contents: read}` 명시 추가 |
| 2 | 아키텍처 | 등재제(화이트리스트) 패턴이 6곳 이상에 독립 재구현돼 공유 추상화가 없다 — 한 축의 스코프 정의 오류(Critical #3)가 다른 축에서 잡히지 않는 구조 | `.claude/tests/test_workflow_yaml_structure.py`(다수), `test_review_gate_ci.py:600` | 공통 헬퍼(`assert_registered(actual, registry, formatter)`)로 통합 |
| 3 | 유지보수성 | `WorkflowStructureTest` 클래스가 이름(YAML 구조 유효성)과 무관한 8개 이질적 불변식(≈230줄)을 떠안았다 | `.claude/tests/test_workflow_yaml_structure.py:91` | 게이트-무결성 계열 6개 메서드를 `WorkflowGateIntegrityTest` 등으로 분리 |
| 4 | 유지보수성 | `OneJudgeTest.test_the_import_and_call_surface_stays_small` 한 메서드가 6가지 독립 정적검사를 수행(115줄) — 첫 실패에서 나머지 5개 성질의 생존 여부가 은폐됨 | `.claude/tests/test_review_gate_ci.py:265-378` | 성질별 메서드로 분리, `tree` 파싱은 `setUp`으로 공유 |
| 5 | 유지보수성 | "등재 집합이 stale하지 않은지" 검증하는 3단 관용구가 5곳에 손으로 중복 구현돼 있다 — 6번째 레지스트리 추가 시 다시 손 복사될 위험(문구/비교방향 drift) | `test_workflow_yaml_structure.py:180,220,242,278`, `test_review_gate_ci.py:639` | 공유 헬퍼 `assert_registry_is_current(registry, seen, label)` 도입 |
| 6 | 문서화 | README `test_review_gate_ci.py` 카탈로그 행이 실제 존재하는 3개 테스트 클래스(`TheGateItselfDoesNotBranchOnCiEnvTest` 포함)를 누락 | `.claude/tests/README.md:48` | 3개 클래스 설명 추가 |
| 7 | 문서화 | README `test_workflow_yaml_structure.py` 카탈로그 행이 이후 라운드에 추가된 5개 신규 불변식을 전혀 언급하지 않는다(scope 리뷰어도 동일 갭을 INFO로 독립 확인) | `.claude/tests/README.md:44` | 5개 불변식 요약 추가 |
| 8 | 문서화 | plan 문서 §배선가드 소제목 "네 라운드에 걸친 경화 이력"이 바로 아래 표(1R~6R, 6개 라운드)와 모순 — 같은 PR의 다른 곳(요약 표)은 정확히 "1R~6R"로 갱신했는데 이 소제목만 남음 | `plan/in-progress/harness-review-gate-ci-backstop.md:20` vs `:26-33` | "여섯 라운드" 또는 개수 비의존 문구로 갱신 |
| 9 | 요구사항 | 관측 모드 자체가 이미 오염 가능 — plan/스크립트 모두 "`--enforce` 전환은 여기 쌓이는 CI 판정으로 결정"이라 명시하는데, Critical #1이 그 판정 데이터를 `--enforce` 이전부터 오염시킬 수 있다 | `plan/in-progress/harness-review-gate-ci-backstop.md:39-40`, `scripts/check-review-gate.py:38-40` | Critical #1 해소 전까지 관측 로그를 `--enforce` 전환 결정 근거로 신뢰하지 말 것 |
| 10 | 동시성 | 리뷰 세션 디렉터리 생성(`create_session_dir`)이 초 단위 이름 + `os.makedirs(exist_ok=True)`로 원자적이지 않다 — 같은 초에 두 오케스트레이션이 충돌하면 나중 세션이 이전 세션의 `SUMMARY.md`(Critical 포함 가능)를 조용히 덮어쓴다. `code-review-agents`/`consistency-checker` 양쪽이 같은 `session.py`를 공유. PoC로 실측(threading 동시 호출도 같은 디렉터리 반환 확인, tie-break 규칙이 실제로 Critical을 삼키는 결과까지 재현) | `.claude/skills/code-review-agents/lib/session.py:23,32-44` | 마이크로초/PID/난수 접미사 추가 또는 `exist_ok=False` + 충돌 시 재시도 루프. 충돌 시나리오 회귀 테스트 추가 |
| 11 | 부작용 | `TheGateItselfDoesNotBranchOnCiEnvTest`의 AST 수집기가 리터럴 문자열 키(`ast.Constant`)만 인식한다 — 동적 조립 키(`"GITHUB_" + "WORKFLOW"`)는 스캔 대상 3개 파일 **내부**에서도 조용히 무검증 통과(Critical #2와 같은 파일 안의 별도 우회 축) | `.claude/tests/test_review_gate_ci.py:623-624,628-631` | `ast.Constant`가 아니면 조용히 넘어가지 말고 명시 실패(`OneJudgeTest._dotted`의 `assertIsNotNone` 원칙 이식) |
| 12 | 테스트 | `VerdictComesFromTheGateTest`(스텁)와 `ReviewGateCliTest`(실물)가 같은 대상을 다른 신뢰수준으로 검증한다 — 적대적 환경(`_HOSTILE_ENV`) 주입이 스텁에만 있고 실물 게이트에는 없어, Critical #2가 발생한 정확히 그 빈자리를 만든다 | `.claude/tests/test_review_gate_ci.py:498-582`(스텁), `:40-217`(실물, `_HOSTILE_ENV` 없음) | 실물 게이트에 대한 적대적 환경 행위 테스트 추가(Critical #1/#2 제안과 동일 축) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `setUp()`에서 훅 트리 전체를 매 테스트 메서드마다 반복 `shutil.copytree` — 격리 목적상 정당하나 훅 트리 규모가 커지면 비용이 선형 증가 | `test_review_gate_ci.py:46-50`, `test_stop_guard_failopen.py:70` | 규모 커지면 `setUpClass` 스냅샷 + `copy2` 방식 검토 |
| 2 | 성능 | 워크플로 YAML을 테스트 메서드마다 독립 재파싱(최대 63회) — 캐싱 기회 미활용 | `test_workflow_yaml_structure.py`(7개 메서드) | `setUpClass`에서 1회 파싱 후 공유 |
| 3 | 성능 | 동일 AST를 5회 독립 순회(`OneJudgeTest`) — 대상 스크립트가 작아 실질 비용은 무시 가능 | `test_review_gate_ci.py:265-373` | 대상 스크립트가 커지면 단일 `ast.walk`로 통합 검토 |
| 4 | 보안 | `pyyaml>=6,<7` 버전 범위 핀 — 정확/해시 핀 아님. 현재 알려진 활성 CVE 없음 | `.github/workflows/harness-checks.yml:88` | 재현성 필요해지면 해시 핀 전환 검토 |
| 5 | 보안 | `check-review-gate.py`의 예외 메시지가 그대로 stdout/stderr에 노출 — 현재 민감정보 경로 없음(순수 로컬 파일시스템 로직) | `scripts/check-review-gate.py:72-73,104-105` | 향후 네트워크/자격증명 다루도록 확장 시 유의사항으로만 기록 |
| 6 | 스코프 | `test_block_integrity.py`의 `PlanStubsMirrorTheRealInterfaceTest` 수정은 티켓 표제(CI 백스톱)와 직접 무관하나 근거가 문서화돼 있고 방향이 강화(약화 아님) | `test_block_integrity.py:690-703` | 없음(기록용) |
| 7 | 유지보수성 | README 신규 표 행(`test_review_gate_ci.py`)이 6개 이상 성질을 줄바꿈 없는 단일 문단(≈1,900자)에 압축해 스캔하기 어렵다(기존 관행과는 일관) | `.claude/tests/README.md:48` | 급하지 않음 — 다음에 손댈 때 명시적 줄바꿈/`<br>` 고려 |
| 8 | 유지보수성 | `timeout=120`이 이름 없는 리터럴로 4곳(+60 1곳)에 반복 | `test_review_gate_ci.py:85,154,569,674,690` | 모듈 상수 `_SUBPROC_TIMEOUT`로 통합 |
| 9 | 테스트 | `test_pull_request_trigger_shape_is_registered`는 키 **집합**만 비교하고 `paths:` 리스트의 실제 값은 비교하지 않는다(값 커버리지는 별개 파일이 담당, 결함 아님) — 보증 범위를 오해할 소지 | `test_workflow_yaml_structure.py:259-279` | docstring에 "키만 고정, 값은 별도 테스트가 분담" 명시 |
| 10 | 테스트 | advisory notes 배선이 스텁 게이트로만 end-to-end 검증됨 — 실물 게이트 + 실제 `block_integrity` 하향 판정 조합 케이스는 어디에도 없음 | `test_review_gate_ci.py:191-217` | 우선순위 낮음 — 실물 조합 케이스 1개 추가 검토 |
| 11 | 의존성 | (긍정) `review-gate.yml`의 `paths:` 트리거가 개별 파일명 나열→글롭(`.claude/hooks/_lib/**`)으로 확장돼 직전 라운드 WARNING이 검증 가능하게 해소됨 | `.github/workflows/review-gate.yml:31` | 없음 |
| 12 | 의존성 | 신규 외부 패키지 없음. PyYAML 핀 3곳(harness-checks.yml + deps-security-checks.yml 2곳) 일치가 테스트로 고정. GH Actions/Node 버전이 저장소 전체(9개 워크플로)와 정렬(`harness-checks.yml` node `'22'`→`'24'` 정정 포함) | 다수(README §의존성 참조) | 없음 |
| 13 | 문서화 | plan 상단 배너 "CI 백스톱 미착수" 문장이 같은 표의 "구현 완료(관측 모드)" 행과 모순 — 이번 라운드 이전(2026-07-31)부터 있던 문제, 이번 diff가 만든 결함은 아님 | `plan/in-progress/harness-review-gate-ci-backstop.md:10` | 다음에 배너를 손댈 때 함께 정리 |
| 14 | 아키텍처 | `WorkflowWiringTest.EXPECTED`(및 다른 레지스트리들)는 검증 대상 워크플로와 같은 PR에서 함께 편집 가능한 골든파일 — 정책(무엇이 안전한가)과 집행(실제로 그런가)이 같은 신뢰 경계 안에 있음(기지의 한계, 새 결함 아님) | `test_review_gate_ci.py:407` | 조치 불요(범위 밖) — 강화하려면 CODEOWNERS 등 별도 서명 절차 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | `_SCANNED` 파일목록 갭에 실제 PoC(Critical #1) + `review_guard._run_git()` porcelain 파싱 버그로 로컬 훅 fail-open(Critical #4) + harness-checks.yml permissions 부재(W1) |
| requirement | CRITICAL | `_SCANNED` 갭 독립 재확인(다른 진입점, Critical #1) + 관측모드 판정 데이터 오염 경고(W9) |
| architecture | CRITICAL | 워크플로 job identity 가드가 GH 실제 매칭 규칙(`name:` override)과 어긋나 새 워크플로 참칭 가능(Critical #3) + 레지스트리 패턴 산개(W2) |
| side_effect | CRITICAL | `_SCANNED` 갭(GITHUB_WORKFLOW 변형, Critical #1) + AST 리터럴-키-only 수집기로 인한 동적 키 우회(W11) |
| testing | CRITICAL | env 스캐너의 구문형태 커버리지 갭 — `.items()`/`.copy()`/별칭이 스캔 대상 파일 내부에서도 우회(Critical #2) + 스텁/실물 테스트 신뢰수준 분리(W12) |
| documentation | CRITICAL(문서) | `test_workflow_yaml_structure.py` docstring 개수 드리프트(Critical #5) + README 카탈로그 누락 2건(W6,W7) + plan 문서 자기모순(W8) |
| dependency | MEDIUM | `_SCANNED` 갭을 dormant로 재평가(WARNING, Critical #1과 동일 근본원인) — 그 외 신규 패키지·PyYAML·Actions 버전 전반 양호 |
| concurrency | LOW(WARNING 1건) | 라운드 7 diff 자체는 동시성 무해 — 인접 파일 `session.py`의 세션 디렉터리 생성 레이스(W10) PoC로 실측 |
| maintainability | LOW(WARNING 3건) | 테스트 클래스 응집도 저하(W3), 메서드 비대화(W4), 레지스트리 관용구 5곳 중복(W5) |
| performance | LOW | CI 인프라 코드, CRITICAL/WARNING급 성능 결함 없음 — setUp 반복복사·YAML 재파싱 등 INFO만 |
| scope | LOW | 범위 이탈 없음(`codebase/**` 변경 0건, 제3워크플로 참칭 없음) — README 문서 갭만 INFO |
| database | NONE | DB 관련 코드/설정 전무, 리뷰 대상 없음 |
| api_contract | NONE | REST/HTTP API 표면 없음, 리뷰 대상 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 중 매칭 0건, 리뷰 대상 없음 |

## 발견 없는 에이전트

- database — DB 관련 코드/설정 전무
- api_contract — API 계약 표면(REST/HTTP) 없음
- user_guide_sync — 유저 가이드 동반 갱신 매트릭스 매칭 0건

## 권장 조치사항

1. `_SCANNED` 등재제를 손으로 나열한 파일 목록이 아니라 `review_guard.py`의 실제 import 그래프(`_shared/**` 포함)에서 자동 도출하도록 전환한다 — Critical #1, #2, W11, W12 를 한 번에 닫는 근본 수정.
2. `TheGateItselfDoesNotBranchOnCiEnvTest`를 정적 AST 매칭에서 행위 테스트(최소 환경 vs `GITHUB_JOB=gate`/`GITHUB_WORKFLOW=review-gate` 포함 적대적 환경으로 `evaluate_review()` 실물 2회 호출 비교)로 전환한다 — `check-review-gate.py` 자신에 이미 적용한 "정적 부정 증명은 유한, 행위 테스트가 참"이라는 6R 교훈을 `review_guard.py`/`_shared/**`에도 적용.
3. `test_workflow_and_job_identities_are_unique`의 identity 정의를 job dict key에서 `job.get("name", job_id)`(GitHub 실제 매칭 규칙)로 교정하고, `_PULL_REQUEST_KEYS`가 bare `pull_request:` 트리거도 등재를 요구하도록 반전한다(Critical #3).
4. `review_guard._run_git()`의 전체-stdout `.strip()`을 줄 단위 처리로 교정한다 — 이미 enforce 중인 로컬 push/stop 훅의 fail-open 버그이므로 CI 백스톱 작업과 별개로 우선순위를 높게 잡는다(Critical #4).
5. `test_workflow_yaml_structure.py` 모듈 docstring과 `.claude/tests/README.md`의 두 카탈로그 행을 실제 불변식 목록과 동기화한다(Critical #5, W6, W7, W8) — 개수를 프로즈에 적지 않는 기존 관행(`harness-checks.yml` 상단 주석)을 재사용.
6. `code-review-agents`/`consistency-checker`가 공유하는 `session.py`의 세션 디렉터리 생성에 유일성 접미사 또는 `exist_ok=False`+재시도를 추가한다(W10) — 이 CI 백스톱 계층이 신뢰하는 committed `SUMMARY.md` 입력 자체의 무결성 문제.
7. `harness-checks.yml`에 `permissions: {contents: read}`를 명시한다(W1, 즉시 가능한 낮은 비용 조치).
8. 5곳에 중복된 "등재 집합 stale 검증" 관용구를 공유 헬퍼로 리팩터링하고(W2, W5), `WorkflowStructureTest`/`OneJudgeTest`의 응집도를 성질별로 분리한다(W3, W4) — 다음 라운드의 재발-대응 사이클 비용을 구조적으로 낮춘다.

## 라우터 결정

- `routing_status=skipped` — 사유: `--route=all`. 전체 reviewer 실행(14명, `agents_forced` 목록은 강제-포함 근거 기록용으로만 함께 계산됨: documentation, maintainability, requirement, scope, security, side_effect, testing).