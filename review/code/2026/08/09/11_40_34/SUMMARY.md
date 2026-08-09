# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — required-check 데드락 해소라는 핵심 목적은 정확히 달성됐고 Critical 은 없으나, (1) 판정 스크립트 `scripts/ci-paths-changed.sh` 의 핵심 fail-safe 로직이 어떤 자동 테스트로도 실행 검증되지 않고, (2) `scripts/ci-paths-changed.sh` 자신이 `harness-checks.yml` 의 `paths:` 커버리지에 빠져 있으며(이 저장소가 "6번 leaked" 라 기록한 클래스의 재발), (3) `push` 트리거의 필터 소멸과 `changes` 잡(barrier) 실패 시 하위 잡 skip 재발 가능성 등 여러 reviewer 가 독립적으로 지적한 실질적 WARNING 이 다수 존재. 강제(forced) reviewer 7명 전원 결과 확보됨(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/requirement | `scripts/ci-paths-changed.sh` 의 핵심 판정 로직(4개 fail-safe 분기 + git pathspec 매칭)을 실제로 subprocess 로 실행해 검증하는 자동 테스트가 없다 — 정적 YAML 구조 검사만 존재. under-match 시 required check 는 초록인데 검사는 전혀 안 도는, 이 PR 이 막으려는 것과 같은 클래스의 실패가 재발 가능 | `scripts/ci-paths-changed.sh:47-83`; `.claude/tests/test_required_check_skip_jobs.py` (구조 검사만) | 실제 임시 git repo + subprocess 로 (1) 관련 변경→true (2) 무관 변경→false (3) 4개 fail-safe 분기→true 를 pin하는 테스트 추가 |
| 2 | requirement | `scripts/ci-paths-changed.sh` 자신이 `harness-checks.yml` 의 `paths:` 목록에 등재돼 있지 않다 — 이 저장소가 스스로 "6번 leaked" 라 기록한 "paths 커버리지 갭" 클래스의 새 사례. 자동 가드(`test_harness_checks_paths_coverage.py`)도 method-level 체인은 건너뛰는 documented blind spot 때문에 이 케이스를 못 잡음 | `.github/workflows/harness-checks.yml:56-64`; `.claude/tests/test_harness_checks_paths_coverage.py:266-269` | `harness-checks.yml` 의 `paths:` 에 `'scripts/ci-paths-changed.sh'` 추가 |
| 3 | requirement/concurrency/side_effect | `changes` 잡(barrier) 자체가 인프라 실패(checkout 네트워크 오류, timeout, cancel-in-progress 취소)로 실패/취소되면 `needs: changes` 하위 잡 전체가 `skipped` 로 보고되어, 이 PR 이 명시적으로 피하려던 "skip 이 required check 를 만족하는지 모호한" 상태가 다른 경로로 재발할 수 있음. 잔존 리스크이며 검증 테스트 없음 | `.github/workflows/deps-security-checks.yml:69-146` (`needs: changes`); `.github/workflows/frontend-checks.yml:52`; `scripts/ci-paths-changed.sh:16-18` (설계 근거) | 하위 잡에 `if: always() && needs.changes.result != 'failure' && needs.changes.result != 'cancelled'` 류 가드 추가, 또는 최소한 알려진 잔존 리스크로 문서화 |
| 4 | side_effect | `push` 트리거의 `paths:` 필터가 통째로 제거되고 push 전용 diff 비교로 대체되지 않아, `scripts/ci-paths-changed.sh` 가 `GITHUB_EVENT_NAME != "pull_request"` 를 무조건 fail-safe `true` 처리 — 결과적으로 `main` 으로의 모든 push(예: `spec/`·`plan/` 만 바꾸는 머지)가 무조건 `pnpm audit`/`pnpm install`/frontend build 등 전체 잡을 실행. required-check 데드락은 PR 에만 해당하므로 이 광역화는 목적 범위를 넘어서는 부수효과이며 검증 테스트도 없음 | `.github/workflows/deps-security-checks.yml:29-30`; `.github/workflows/frontend-checks.yml:19-20`; `scripts/ci-paths-changed.sh:47-52` | `push` 이벤트에도 `github.event.before`/`after` 를 env 로 넘겨 실제 diff 비교, 또는 최소한 의도적 광역화임을 주석에 명시 + 회귀 가드 추가 |
| 5 | testing/dependency/architecture/documentation | skip-job 패턴 적용 대상 워크플로 레지스트리가 `test_required_check_skip_jobs.py::CONVERTED` 와 `test_workflow_yaml_structure.py::_SKIP_JOB_WORKFLOWS`(+`_PULL_REQUEST_KEYS` 빈-집합 항목) 두(사실상 3) 곳에 독립적으로 존재하며 상호 검증 테스트가 없음. 한쪽만 갱신하고 다른 쪽을 빠뜨려도 조용히 통과 가능(부분적으로는 `test_step_conditions_are_registered` 가 대신 잡아주지만 완전하지 않음) | `.claude/tests/test_required_check_skip_jobs.py:40-43`; `.claude/tests/test_workflow_yaml_structure.py:211-213,273-283` | 한쪽을 SoT 로 삼아 다른 쪽이 import 하거나, 두 집합이 동일한지 `assertEqual` 하는 바인딩 테스트 추가 |
| 6 | testing | `test_changes_job_publishes_relevant` 는 `outputs.relevant` 키의 **존재**만 확인하고 값이 실제로 `${{ steps.detect.outputs.relevant }}` 를 가리키는지는 확인하지 않음 — step id 오타가 있어도 통과하며 그 경우 모든 스텝이 조용히 no-op 됨(docstring 이 "특히 위험"이라 명시한 시나리오) | `.claude/tests/test_required_check_skip_jobs.py:77-85` | `outputs["relevant"]` 값이 정확한 참조 문자열과 같은지, `id: detect` 스텝 존재를 함께 단언 |
| 7 | architecture/maintainability/dependency/performance | `changes` 잡 wiring(체크아웃+`fetch-depth:0`+env 배선+스크립트 호출)이 두 워크플로 파일에 거의 동일하게 복제됨 — 패턴이 더 많은 워크플로로 확산될 예정이라 복제 비용이 워크플로 수에 비례해 증가 | `.github/workflows/deps-security-checks.yml:43-67`; `.github/workflows/frontend-checks.yml:27-49` | 3번째 워크플로 전환 시점에 reusable workflow(`workflow_call`)/composite action 으로 추출 검토 |
| 8 | performance | `changes` 잡이 매 PR·push 마다 `fetch-depth: 0` 전체 히스토리 clone 수행 — 이전엔 무관 PR 은 워크플로 자체가 트리거 안 돼 비용 0 이었으나 이제 항상 지불. 두 워크플로에 각각 독립적으로 있어 같은 PR 에 풀 클론 2회 발생 | `.github/workflows/deps-security-checks.yml:53`; `.github/workflows/frontend-checks.yml:37` | 의도된 트레이드오프이나 확장 시 단일 공유 `changes` 잡(reusable workflow) 통합 검토 |
| 9 | maintainability | 신규 테스트 클래스 `RequiredCheckSkipJobContract` 가 저장소 전역 컨벤션인 `*Test` 접미사를 따르지 않음(동작 영향 없음, 순수 네이밍 일관성) | `.claude/tests/test_required_check_skip_jobs.py:55` | `RequiredCheckSkipJobContractTest` 로 리네임 |
| 10 | documentation | `.claude/tests/README.md` 의 `test_workflow_yaml_structure.py` 카탈로그 행(44행)이 같은 diff 로 그 파일이 받은 실질 변경(`_SKIP_JOB_RUN`/`_SKIP_JOB_NOOP` 예외, `_PULL_REQUEST_KEYS` 빈-집합 허용)을 반영하지 않아 부분적으로 stale. `test_tests_readme_catalog.py` 는 행의 존재만 검사해 이 staleness 를 못 잡음 | `.claude/tests/README.md:44` | 44행에 skip-job 예외 클래스와 bare `pull_request:` 허용을 설명하는 문구 추가, 48행과 상호참조 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | GitHub Actions script-injection 클래스는 정석적으로 회피됨(`env:` 간접화 + 항상 인용) — 확인 사항, 결함 아님 | `.github/workflows/deps-security-checks.yml:55-57`; `frontend-checks.yml:39-41`; `scripts/ci-paths-changed.sh:54-55` | 없음 — 유지 권장 |
| 2 | security | `changes` 잡에 명시적 `permissions:` 없음(저장소 전역 기존 관례, `pull_request` 트리거라 실질 위험 낮음) | `.github/workflows/deps-security-checks.yml:43-67`; `frontend-checks.yml:28-49` | 여유 있으면 `permissions: contents: read` 명시 |
| 3 | security | Actions 가 major 태그로 핀(SHA 핀 아님) — 저장소 전역 기존 관례, 이번 PR 이 만든 회귀 아님 | `deps-security-checks.yml:50`; `frontend-checks.yml:35` | 전사적 SHA 핀 전환은 별도 트래킹(스코프 밖) |
| 4 | requirement/side_effect | `push` 필터 소멸이 이번 변경의 목적(PR 데드락 해소) 범위를 넘어서는 부수효과라는 점은 WARNING #4 로 상향 반영됨(중복 언급) | — | — |
| 5 | requirement | 관련 `spec/` 문서 없음 — `spec/conventions/migrations.md` 는 별개 맥락. `spec_impact: none` 과 정합, spec drift 없음 | — | — |
| 6 | architecture | `scripts/ci-paths-changed.sh` 가 SRP·OCP 준수하며 이전 이중 `paths:` 중복을 단일 SoT 로 정리한 긍정적 설계 | `scripts/ci-paths-changed.sh` 전체 | 없음 |
| 7 | concurrency | `needs:`+job outputs 를 통한 잡 간 데이터 전달 자체는 GitHub Actions 가 보장하는 동기화라 경쟁 조건 없음. `emit()` 은 잡당 정확히 1회만 호출 | `scripts/ci-paths-changed.sh:42-83` | 없음 |
| 8 | dependency | 새 외부 의존성 없음 — PyYAML 은 기존 승인된 예외 재사용, 버전 핀 불변 | `.claude/tests/test_required_check_skip_jobs.py:33` | 없음 |
| 9 | documentation | `scripts/ci-paths-changed.sh` 의 `## 사용` 섹션이 `GITHUB_EVENT_NAME`/`PR_BASE_SHA`/`PR_HEAD_SHA` 환경변수를 이름으로 문서화하지 않음 | `scripts/ci-paths-changed.sh:20-24` | 로컬 재현 예시 한 줄 추가 |
| 10 | documentation | 두 워크플로 헤더 주석에 push 트리거의 필터링 소멸 함의가 명시되지 않음 | `deps-security-checks.yml:21-30`; `frontend-checks.yml:15-20` | 상단 주석에 한 줄 명시 |
| 11 | performance | 게이팅된 잡들은 스텝이 no-op 이어도 러너 VM 할당·큐잉 오버헤드는 그대로 받음(설계상 감수한 비용, 결함 아님) | `deps-security-checks.yml:69-146`; `frontend-checks.yml:51-90` | 조치 불요, 확산 시 러너 사용량 관찰 |
| 12 | scope/database/api_contract/user_guide_sync | 범위 이탈·무관 수정·포맷팅 혼입 없음. DB/API 계약/유저가이드 매트릭스 어느 것도 해당 없음 | — | — |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | script-injection 정석 회피, permissions/SHA 핀은 기존 관례(INFO) |
| performance | LOW | `fetch-depth:0` 전체 clone 이 매 PR 반복(트레이드오프), 잡 오버헤드 |
| architecture | LOW | `changes` 잡 wiring 복제, 스텝별 `if:` 반복, 두 레지스트리 비바인딩 |
| requirement | MEDIUM | fail-safe 로직 미검증, harness-checks.yml paths 갭 재발, changes 잡 실패 시 skip 재발 가능 |
| scope | NONE | 6개 파일 전부 단일 의도에 정확히 종속, 범위 이탈 없음 |
| side_effect | MEDIUM | push 필터 소멸로 목적 범위 초과 광역화, barrier 실패 시 skip 전파 |
| maintainability | LOW | 테스트 클래스 네이밍 컨벤션 불일치, 구조적 중복(INFO) |
| testing | MEDIUM | 핵심 fail-safe 로직 미검증, 두 레지스트리 비바인딩, output 참조 미검증 |
| documentation | LOW | README 카탈로그 부분 stale, 3-way 레지스트리 우연 일치, 사용법 문서 갭 |
| dependency | LOW | 신규 의존성 없음, 레지스트리 비바인딩 리스크만 |
| database | NONE | 해당 없음 |
| concurrency | LOW | barrier(`changes` 잡) 실패 시 하위 잡 skip 전파 잔존 리스크 |
| api_contract | NONE | 해당 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21개 행 전부 미매칭, 해당 없음 |

## 발견 없는 에이전트

- database (해당 없음 — DB 코드 없음)
- api_contract (해당 없음 — API 계약 코드 없음)
- user_guide_sync (해당 없음 — doc-sync-matrix 트리거 미매칭)
- scope (범위 이탈 없음 — 단일 의도에 정확히 종속)

## 권장 조치사항

1. `scripts/ci-paths-changed.sh` 의 fail-safe 4분기 + pathspec 매칭을 실제 subprocess + temp git repo 로 검증하는 테스트 추가 (WARNING #1) — 이 PR 의 핵심 안전장치가 현재 미검증 상태.
2. `harness-checks.yml` 의 `paths:` 목록에 `scripts/ci-paths-changed.sh` 추가 (WARNING #2) — 자기 자신을 포함한 다른 스크립트들과 동일한 커버리지 규칙 적용.
3. `push` 트리거의 필터 소멸이 의도적인지 재확인 — 의도적이면 워크플로 주석에 명시하고, 아니라면 push 전용 diff 비교(`github.event.before`/`after`)로 대체 (WARNING #4).
4. `changes` 잡(barrier) 실패/취소 시 하위 잡이 `skipped` 로 떨어지는 잔존 리스크에 대해 `if: always() && needs.changes.result != 'failure'` 류 가드 추가 또는 최소한 알려진 한계로 문서화 (WARNING #3).
5. `CONVERTED`(test_required_check_skip_jobs.py) 와 `_SKIP_JOB_WORKFLOWS`(test_workflow_yaml_structure.py) 두 레지스트리를 단일 SoT 로 묶거나 동등성 assert 테스트 추가 (WARNING #5).
6. `test_changes_job_publishes_relevant` 가 `outputs.relevant` 의 참조 문자열 정확성과 `id: detect` 존재를 함께 단언하도록 보강 (WARNING #6).
7. (낮은 우선순위) 테스트 클래스명 `RequiredCheckSkipJobContract` → `...Test` 로 리네임, README 카탈로그 44행 갱신, `changes` 잡 wiring 을 3번째 워크플로 전환 시점에 reusable workflow 로 추출 검토.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success)
- **제외**: 없음 (0명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨. 강제 화이트리스트 미이행 없음.

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |