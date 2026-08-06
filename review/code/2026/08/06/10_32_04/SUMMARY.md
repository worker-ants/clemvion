# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이번 라운드(4R)의 임무는 "모든 테스트를 GREEN으로 유지한 채 SHIPPED BEHAVIOUR를 바꿀 수 있는가"였고, 9개 이상의 리뷰어가 독립적으로 job-level `continue-on-error: true` 우회를 실측 재현했다. 그 외에도 `on.pull_request` 트리거 매핑 미검증(paths 형제 키), 스텝 목록 완전성 미검증(신규 스텝 삽입/기존 스텝 명령 추가), `WorkflowWiringTest` 자체의 PyYAML 부재 시 fail-open 등 최소 4개 계열의 독립적 CI 백스톱 우회가 실측 확인되었다. 현재는 관측 모드(`check-review-gate.py`가 항상 exit 0)라 즉시 가시적 피해는 없지만, `--enforce` 전환 시점 또는 그 이전에 이 구멍들이 조용히 게이트를 무력화한다 — 그중 하나(`on.pull_request.branches` 형제 키 추가)는 **지금 당장, enforce 여부와 무관하게** 워크플로 자체를 영구 트리거 불능으로 만든다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CI 워크플로 배선 (테스트 커버리지) | `_NEUTERING_KEYS`(`if`/`continue-on-error`/`timeout-minutes`) 검사가 게이트 **step** 딕셔너리에만 적용되고 **job** 딕셔너리는 `if` 키 하나만 검사한다. `jobs.gate.continue-on-error: true` 한 줄을 job 레벨에 추가하면 `--enforce` 전환 후 게이트 스크립트가 exit 1을 내도 job/workflow run 전체가 "성공"으로 보고되어 PR이 통과된다 — 라운드 3에서 닫은 것과 동일 등급의 무력화가 한 단계 위(job)에서 재발. 실측: `test_review_gate_ci.py` 18개 + `test_workflow_yaml_structure.py` 6개 전부 GREEN 유지 (security·performance·architecture·requirement·side_effect·maintainability·testing·database·concurrency 9개 리뷰어가 독립 재현) | `.claude/tests/test_review_gate_ci.py:405-406`(`self.job` 파싱 후 미검사 방치), `:423`(`_NEUTERING_KEYS` 정의, step 전용), `:425-438`(step만 순회), `:440-443`(job은 `if`만 단언) / `.github/workflows/review-gate.yml` `jobs.gate` 블록 | `_NEUTERING_KEYS` 순회를 `self.job`에도 적용하거나(`assertNotIn` 3키), 더 근본적으로 `self.job`의 키 집합을 `{"runs-on","timeout-minutes","if","steps"}`로 닫힌 허용목록(exact-set) 비교로 전환 |
| 2 | CI 워크플로 배선 (트리거 매핑 미검증) | `test_trigger_paths_are_exactly_the_expected_set`이 `self.on["pull_request"]`의 `paths` **서브키만** 정확 일치로 검사하고 매핑 전체(키 집합)는 열려 있다. 실측된 우회 변형: (a) `types: [closed]` 추가 시 PR이 **닫힐 때만** 게이트가 돌아 리뷰가 필요한 시점엔 결코 개입 못함(security, CRITICAL), (b) `branches: ['this-branch-does-not-exist']`를 형제 키로 추가하면 이 워크플로가 **지금 당장, enforce 여부 무관** 어떤 실제 PR에서도 영원히 트리거되지 않음(requirement, CRITICAL — Actions 탭에 실행 기록조차 안 남아 감지 불가), (c) `types: [opened]`로 좁혀 `synchronize`를 제거하면 push 커밋마다 재실행 안 됨(testing, WARNING — 로컬 push 훅이 잔존 커버리지 제공하므로 완전 사각은 아님). 세 변형 모두 18개 테스트 전부 GREEN | `.claude/tests/test_review_gate_ci.py:456-459` (`paths` 서브키만 비교) / `.github/workflows/review-gate.yml:22-24` (`on.pull_request.paths`) | `self.on["pull_request"]`를 `{"paths": self.EXPECTED_PATHS}`와 **키 집합까지 포함해** `assertEqual`로 정확 일치 검사 — `types`/`branches`/`branches-ignore`/`tags` 등 모든 형제 키 신설을 한 번에 차단 |
| 3 | CI 워크플로 배선 (스텝 목록 완전성 미검증) | `WorkflowWiringTest`는 게이트 스텝 자신과 명명된 몇 개 스텝(checkout)만 검사하고, `self.job["steps"]` 리스트 전체의 개수·순서·비검사 스텝의 존재는 어디서도 고정하지 않는다. 실측된 두 독립 변형: (a) 게이트 스텝 앞에 새 스텝을 추가해 `scripts/check-review-gate.py`를 항상 exit 0인 no-op 스텁으로 덮어쓰거나, 검사 대상이 아닌 기존 "Fetch base ref" 스텝의 `run:`에 `&&`로 한 줄만 추가해 같은 결과를 냄(side_effect), (b) 게이트 스텝 앞에 `$GITHUB_PATH`를 조작해 `python3` 바이너리 자체를 가로채는(PATH 하이재킹) 스텝을 삽입해 게이트 스텝의 `run:` 문자열은 그대로인데 실제 스크립트가 한 번도 실행되지 않게 함(documentation). `WorkflowWiringTest` 클래스 docstring의 "우회할 패턴이 아예 없다"는 단언이 두 실측 모두에서 반증됨 | `.claude/tests/test_review_gate_ci.py:358-373`(class docstring 과확신), `:406-412`(`_gate_step_index` — 검사 스코프가 스텝 1~2개로 국한) / `.github/workflows/review-gate.yml` `jobs.gate.steps` 전체(순서·개수 미검증) | (a) `self.steps` 전체를 순서 있는 리스트로 exact-equality 고정(스텝 개수·각 `name`/`run`/`uses`/`with`을 기대값과 비교), 또는 (b) 더 근본적으로 게이트 스텝 자체가 실행 직전 `git diff --quiet HEAD -- scripts/check-review-gate.py .claude/hooks/_lib/review_guard.py .claude/_shared`를 스스로 확인해 실패 시 non-zero로 죽는 행위/불변식 검증으로 전환 (워크플로 파일이 아니라 스크립트/저장소 상태에 방어가 실리므로 이동 불가) |
| 4 | 테스트 실행조건 (fail-open) | `WorkflowWiringTest.setUpClass`가 `import yaml` 실패 시 `unittest.SkipTest`로 조용히 스킵한다(fail-open). 이 파일만 단독(타겟) 재실행되는 환경(이 저장소가 실제로 채택하는 관행 — 실패 reviewer만 재실행)에서 PyYAML이 없으면 발견 #1~#3을 포함해 7개 배선 불변식 전부가 무음 `OK`로 통과한다. 오늘 전체 스위트(`unittest discover -p 'test_*.py'`)가 안전한 것은 이 파일의 설계가 아니라 **무관한 옆 파일**(`test_override_floors.py`가 `import yaml` 실패 시 의도적으로 fail-closed)의 우연한 부작용 덕분이며, 이 결합은 문서화·테스트되어 있지 않아 다음 리팩터에서 조용히 사라질 수 있음. 클래스 docstring이 "패턴 매칭은 세 번 뚫렸으니 정확 일치로 우회 불가"라 선언한 바로 그 검증 전체가 단일 옵션 의존성 부재로 조건 없이 무력화됨 (dependency) | `.claude/tests/test_review_gate_ci.py:394` (`setUpClass`, `except ImportError: raise unittest.SkipTest("PyYAML 없음 — CI는 설치한다")`) | `setUpClass`를 스킵이 아니라 fail-closed로 전환 — `scripts/check-override-floors.py`가 이미 쓰는 패턴처럼 가드 없는 `import yaml`(다른 곳처럼) 또는 `self.fail(...)`로 바꿔, PyYAML 부재 시 이 클래스 자체가 ERROR로 떨어지게 함 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CI 워크플로 배선 (실제 필요성 미검증) | "Fetch base ref" 스텝(merge-base 계산을 위해 `origin/<base>`를 해석해야 한다고 스텝 주석이 명시)의 존재·`run`·`env.BASE_REF` 어느 것도 어떤 테스트로도 고정되지 않는다 — 스텝을 통째로 삭제해도 `test_review_gate_ci.py` 18개 전부 GREEN. (testing은 이를 CRITICAL로 분류 — 게이트 판정의 입력 전제이자 3R/4R이 이미 두 번 고친 "step은 실행되지만 실질 없음"과 같은 모양이라는 근거; performance는 INFO로 분류 — 실제 GitHub Actions 러너에서 `actions/checkout@v7`의 `fetch-depth: 0`만으로 충분한지 실측하지 않아 인과를 단정할 수 없다는 근거. 두 리뷰어 모두 갭 자체는 동일하게 확인했으나 실제 런타임 영향에 대한 확신도가 갈려 WARNING으로 종합) | `.claude/tests/test_review_gate_ci.py:358`(class 범위) / `.github/workflows/review-gate.yml:67-70`(`Fetch base ref` 스텝) | 이 스텝이 실제로 필요하면 `run`/`env.BASE_REF`를 정확 일치로 고정하는 테스트 추가; 불필요하면(`fetch-depth: 0`만으로 충분하면) 주석과 함께 제거. 실제 GitHub 러너에서 `git fetch` 없이 `git rev-parse origin/<base>`가 성공하는지 1회 실측으로 결정 가능 |
| 2 | 아키텍처 / 계약 | `ReviewDecision`(`blocked`/`reason`/`notes`/`push_blocks`) 계약이 세 소비자(`guard_review_before_push.py`, `guard_review_before_stop.py`, `scripts/check-review-gate.py`)와 두 테스트 스텁 사이에서 덕타이핑으로만 공유되고, 이를 명시하는 `typing.Protocol` 등 공통 인터페이스가 없다. 필드가 늘거나 이름이 바뀌어도 정적으로 드리프트를 잡을 장치가 없음 (architecture) | `.claude/hooks/_lib/review_guard.py:182-203`(`ReviewDecision` 정의) vs `scripts/check-review-gate.py:100-102`(직접 속성 접근, `push_blocks` 미사용) | `_shared/`에 `class ReviewDecisionLike(Protocol)`을 두고 세 소비자·스텁이 참조하게 하면 mypy/pyright 도입 시 드리프트를 즉시 검출 가능. 지금 급하진 않음(테스트가 행위로 이미 커버) — 다음 필드 변경 시점에 검토 |
| 3 | 문서 정합성 (SoT 낡음) | `plan/in-progress/harness-review-gate-ci-backstop.md`(이 기능의 SoT)가 "2026-08-01 구현 완료(관측 모드)" 배너 이후 실제로 있었던 라운드별 경화 이력(1R 부분매칭 우회 → 2R 구조+부분정규식 우회 → 3R `&& false` 영구무력화 우회 → 4R `continue-on-error` 발견/차단, 그리고 이번 4R 리뷰가 찾은 후속 구멍들)을 전혀 반영하지 않는다. plan 문서만 읽으면 이 백스톱이 2026-08-01 이후 안정 상태라고 오인하기 쉬움 (documentation) | `plan/in-progress/harness-review-gate-ci-backstop.md:9-17`(진행 배너, "구현 완료"에서 멈춤), 파일 끝(316줄) | 기존 배너 형식을 따라 "워크플로 배선 검사 라운드 1~4" 항목을 추가하고, 이번 라운드 CRITICAL 발견이 처리되면 같은 자리에 이어 기록 |
| 4 | 의존성 관리 | `pyyaml>=6,<7` 버전 pin 문자열이 `.github/workflows/harness-checks.yml`과 (이번 diff 밖의) `.github/workflows/deps-security-checks.yml` 등 3곳에 손으로 중복돼 있고, 두 워크플로의 pin이 실제로 같은지 비교하는 테스트가 없다. 이 저장소가 "손-동기 쌍은 드리프트한다"는 교훈을 스스로 여러 번 기록해 두었음에도 이 pin 쌍은 아직 묶여 있지 않음 (dependency) | `.github/workflows/harness-checks.yml:85`, `.github/workflows/deps-security-checks.yml:58,92`(diff 밖) | 두 워크플로 파일의 `pyyaml` pin 문자열이 동일하다는 정확 일치 테스트를 harness 스위트에 추가하거나, `requirements-dev.txt`/`constraints.txt`로 단일 진실화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 핵심 원칙("판정자는 하나, 트리거만 훅과 독립")은 코드·문서 양쪽에서 일관 유지. `check-review-gate.py`는 판정 로직을 재구현하지 않는 얇은 어댑터로 잘 절제됨 (architecture) | `scripts/check-review-gate.py:1-47` | — |
| 2 | 문서 정합성 | "관측 모드가 기본인 이유" 수치(435 PR 중 80건 미커버, 18%)가 plan 문서·`.claude/tests/README.md`·스크립트 docstring 세 곳에서 정확히 일치. 크로스 문서 drift 없음 (documentation) | 다수 파일 | — |
| 3 | 권한/축소 여지 | `permissions: contents: read`가 어떤 테스트의 단언 대상도 아니어서 조용히 `contents: write` 등으로 넓어져도 감지 불가 — 판정 로직 자체를 바꾸지 않으므로 CRITICAL은 아님 (performance) | `.github/workflows/review-gate.yml:41-42` | 여유 있으면 `permissions` 값을 정확 일치로 고정 |
| 4 | 테스트 설계 | `_gate_step_index()`가 이름이 아니라 `run` 문자열로 게이트 스텝을 찾아, `EXPECTED_GATE_RUN`을 포함하는 가짜 스텝을 추가하면 `enumerate` 순서상 먼저 오는 쪽이 검사되고 진짜 스텝은 검사받지 않을 수 있음 — 이번 diff의 신규 결함은 아니고 기존 사각 (testing) | `.claude/tests/test_review_gate_ci.py:408-412` | 향후 강화 시 고려 |
| 5 | 스코프 | 라운드 4 diff(`.claude/tests/test_review_gate_ci.py` 23줄)는 커밋 메시지가 예고한 범위와 정확히 일치. 브랜치 전체 누적(4라운드)도 전부 직전 라운드 발견에 1:1 대응, 범위 밖 항목(evaluate 중복호출 가드 등)은 실행하지 않고 명시적으로 유보만 기록 (scope) | — | — |
| 6 | 데이터베이스 / API 계약 / 유저 가이드 동반 갱신 | 이번 변경은 harness(`.claude/`, `.github/`, `scripts/`, `plan/in-progress/`) 전용이라 DB 쿼리/스키마/트랜잭션, 제품 REST API 표면, 유저 가이드 MDX·i18n·backend-labels 동반 갱신 매트릭스 어디에도 해당 사항 없음 (database, api_contract, user_guide_sync) | — | — |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | HIGH | job-level `continue-on-error` 미검사(#1), `on.pull_request.types` 미검사(#2) |
| performance | CRITICAL | job-level `continue-on-error` 미검사(#1); "Fetch base ref"/`permissions` 미검사(INFO) |
| architecture | CRITICAL | job-level `continue-on-error` 미검사(#1); `ReviewDecision` 덕타이핑 계약(WARNING) |
| requirement | CRITICAL | job-level `continue-on-error` 미검사(#1), `on.pull_request.branches` 형제 키로 트리거 영구 무력화(#2) |
| scope | NONE | 발견 없음 — 라운드 4 diff가 커밋 메시지 범위와 정확히 일치 |
| side_effect | CRITICAL | 스텝 삽입/기존 스텝 명령 추가로 `check-review-gate.py` 무력화(#3) |
| maintainability | CRITICAL | job-level `continue-on-error` 미검사(#1) + 스타일 INFO 2건 |
| testing | CRITICAL | "Fetch base ref" 삭제(WARNING #1), job-level `continue-on-error`(#1), `types` 미검사(#2 변형) — 3개 독립 실험 |
| documentation | CRITICAL | 스텝 목록 완전성 미검사·PATH 하이재킹(#3); plan 문서 이력 누락(WARNING #3) |
| dependency | CRITICAL | `WorkflowWiringTest` PyYAML 부재 시 fail-open(#4); pin 문자열 손동기화(WARNING #4) |
| database | NONE(DB 관점) / 부록 CRITICAL | DB 코드 없음(주 판정 NONE); 부록에서 job-level `continue-on-error`(#1) 독자 재현 |
| concurrency | CRITICAL | job-level `continue-on-error` 미검사(#1) — job 키 화이트리스트 부재 |
| api_contract | NONE | 제품 API 표면 변경 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 중 매칭 0건 |

## 발견 없는 에이전트

scope, api_contract, user_guide_sync (database는 DB 관점 주 판정은 NONE이나 부록에서 동일 CRITICAL을 재현해 위 표에 포함)

## 권장 조치사항

1. **(최우선)** `WorkflowWiringTest`의 `_NEUTERING_KEYS` 검사를 `self.job` 딕셔너리에도 적용하거나, `self.job`의 키 집합을 `{"runs-on","timeout-minutes","if","steps"}`로 닫힌 허용목록 비교로 전환한다 — 9개 이상의 리뷰어가 독립 재현한 가장 광범위한 우회(Critical #1)를 닫는다.
2. `self.on["pull_request"]`를 `{"paths": self.EXPECTED_PATHS}`와 **키 집합까지** 정확 일치(exact-equality)로 검사해 `types`/`branches`/`branches-ignore`/`tags` 형제 키 우회(Critical #2)를 한 번에 차단한다. 특히 `branches` 변형은 enforce 여부와 무관하게 지금 당장 워크플로를 영구 무력화하므로 시급.
3. `WorkflowWiringTest`에 게이트 job의 `steps` 리스트 전체를 순서·개수·필드까지 exact-equality로 고정하는 테스트를 추가하거나, 게이트 스텝 자신이 실행 직전 관련 파일들의 git 상태(`git diff --quiet`)를 스스로 확인해 변조 시 fail하는 행위 검증으로 전환한다(Critical #3).
4. `WorkflowWiringTest.setUpClass`를 PyYAML 부재 시 SkipTest(fail-open) 대신 fail-closed로 전환한다(Critical #4) — 타겟 재실행(`REVIEW_AGENTS`류 관행) 환경에서 이 클래스 전체가 우연에 의존하지 않게 한다.
5. "Fetch base ref" 스텝의 실제 필요성을 실제 GitHub Actions 러너에서 1회 검증하고, 필요하면 `run`/`env.BASE_REF`를 정확 일치로 고정하는 테스트를 추가하거나 불필요하면 제거한다(Warning #1).
6. 위 4개 Critical 항목을 해결한 뒤 `plan/in-progress/harness-review-gate-ci-backstop.md`에 라운드별 경화 이력(1R~4R+이번 라운드)을 배너 형식으로 갱신해 SoT 낡음(Warning #3)을 해소한다.
7. 여유가 되면 `ReviewDecision`에 `typing.Protocol` 계약을 도입(Warning #2)하고, `pyyaml` pin 문자열 동기화 테스트를 추가(Warning #4)한다.

## 라우터 결정

- `routing_status=skipped` — 사유: `--route=all`. 전체 14개 reviewer 실행됨.
- 참고: `_retry_state.json`에는 `agents_forced` 목록(documentation, maintainability, requirement, scope, security, side_effect, testing — 문서/코드 변경 트리거 근거)이 함께 기록되어 있으나, `route_mode=all`이므로 이 forced 목록은 실행 여부에 영향을 주지 않았다(라우터가 애초에 선별을 수행하지 않음). 14개 reviewer 전원의 결과 파일(`*.md`)이 세션 디렉터리에 존재하며 전부 `STATUS: SUCCESS`(또는 `STATUS=success`)로 종료되었다 — 재시도 필요 항목 없음.