# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 실질 결함은 (1) 신규 scope 3(거버넌스 문서)를 반영 안 한 spec SoT 표 1건(SPEC-DRIFT), (2) 이 PR 의 핵심 회귀 방지 로직(`:(glob)` pathspec 매직)을 실행 계층에서 직접 pin 하는 테스트 부재 2건 — 기능 자체는 실측(vitest 18/18, unittest 25+17+18 전부 PASS)으로 정상 동작 확인됨. **강제 포함(router_safety) 대상 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec-impl-evidence.md §4.2` 표가 신규 scope 3(거버넌스 문서: 루트 `*.md` 비재귀 + `.claude/**.md`)를 반영하지 않음 — `PROJECT.md`·`spec-link-integrity.test.ts`·`spec-links.ts` 세 곳 모두 이 절을 SoT 로 인용하는데 정작 §4.2 표는 여전히 scope (1)(2) 두 개만 서술. PR 자신의 집행 체크리스트(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:838-840`)에도 이 표 갱신이 누락됨. requirement·documentation 두 reviewer 가 동일 지적 | `spec/conventions/spec-impl-evidence.md:132` | §4.2 표에 "(3) 거버넌스 문서(루트 `*.md` 비재귀 + `.claude/**.md`, `.claude/worktrees/` 제외)" 행 추가. `developer` 는 spec 직접 수정 권한 없음(자기반증형 소정정 요건도 미충족 — 제품 정의/계약 아님) → `project-planner` 턴으로 반영 |
| 2 | Testing | `:(glob)` 매직 스트립 로직(`filter_covers_file`)의 전용 boundary 단위테스트 부재 — 같은 파일의 `FilterMatchBoundaryTest` 클래스가 다른 모든 분기는 개별 pin 하는데 이 신규 분기만 `spec-link-checks.yml` 의 dead-filter 통합 테스트를 통해서만 간접 실행됨(로컬 재현, 25+17건 전부 GREEN 확인). requirement·testing 두 reviewer 가 동일 지적 | `.claude/tests/test_harness_checks_paths_coverage.py:209-224`(`_GIT_GLOB_MAGIC`), `FilterMatchBoundaryTest`(:375) | `FilterMatchBoundaryTest` 에 `filter_covers_file(":(glob)*.md", "PROJECT.md") == True` / `filter_covers_file(":(glob)*.md", "spec/x.md") == False` 직접 pin 케이스 추가 |
| 3 | Testing | 이 PR 의 핵심 회귀 주장("`:(glob)` 없으면 `*` 가 `/` 를 넘어 17,202개, 있으면 루트 6개만") 이 실제 `git diff` 실행 경로(`scripts/ci-paths-changed.sh`)에서 세그먼트 경계를 지키는지 pin 하는 테스트가 없음. 자매 파일 `test_ci_paths_changed.py` 는 이미 같은 패턴(`test_nested_path_matches_the_glob` 등)을 갖추고 있어 추가 비용 낮음 | `.github/workflows/spec-link-checks.yml:60`(`:(glob)*.md`), `scripts/ci-paths-changed.sh` | `test_ci_paths_changed.py` 의 `_RepoFixture` 재사용해 (a) 루트 `root.md` 변경 → `:(glob)*.md` 로 `relevant=true`, (b) `nested/deep.md` 변경 → `relevant=false` 2케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | CI 트리거 pathspec `.claude/**` 가 확장자 무관이라, 실제 가드 대상(`.claude/**.md`)보다 넓게 non-md 변경에도 `spec-link-integrity` job 이 부수적으로 자주 실행됨(harness 작업 다수가 `.claude/**` 를 건드리는 이 저장소 특성상 빈도 증가). 의도된 conservative-over-broad 선택으로 버그 아님 | `.github/workflows/spec-link-checks.yml:57-61` | CI 비용이 문제되면 `.claude/**/*.md` 로 좁히는 것 고려(선택) |
| 2 | Maintainability | 실측값 `17,202`(git pathspec 매치 파일 수)가 SoT 지정 없이 3곳(테스트 docstring·워크플로 주석·plan 문서)에 동일 하드코딩 | `.claude/tests/test_harness_checks_paths_coverage.py:206`, `spec-link-checks.yml:58`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:845` | 한 곳(테스트 docstring)을 SoT 지정하고 나머지는 참조 링크만 남기는 것 고려 |
| 3 | Maintainability | 비-공허성 검사 임계값 `20` 이 이름 없는 리터럴로 인라인(자매 Python 가드는 `_MIN_TARGETS` 등 named 상수 사용) | `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:110` | `_MIN_...` named 상수로 추출(비블로킹 스타일 정리) |
| 4 | Testing | `GOVERNANCE_SKIP_DIRS` 의 `node_modules` 제외 규칙에 회귀 fixture 없음(`worktrees` 만 커버) — 실수로 지워져도 어떤 테스트도 안 깨지는 죽은 방어일 수 있음 | `spec-links.ts:291`, `spec-link-integrity.test.ts:132-167` | fixture 에 `node_modules` 하위 깨진 링크 케이스 추가해 `worktrees` 와 동등하게 pin |
| 5 | Testing | `findBrokenGovernanceLinks` 진입점이 스코프 **안**의 깨진 링크를 실제 검출하는 양성 fixture 없음 — 현재는 "실 저장소가 깨끗하다"는 사실에만 의존 | `spec-link-integrity.test.ts:154-167` | fixture 의 `README.md` 등에 깨진 링크 1건 심어 `DEAD` 검출 양성 케이스로 pin |
| 6 | Documentation | `spec-link-checks.yml` 의 `pathspecs` 커버리지 회귀가 테스트가 아닌 prose 주석(및 이번 fix 자체)에만 의존 — `harness-checks.yml` 은 동일 클래스를 `test_harness_checks_paths_coverage.py` 회귀 캐너리로 codify 했으나 이쪽은 아직 없음 | `.github/workflows/spec-link-checks.yml` (게이트 47-68) | 후속 백로그: `pathspecs` 가 `spec-links.ts`/`spec-link-integrity.test.ts` 참조 루트를 실제로 커버하는지 확인하는 소규모 회귀 테스트 |
| 7 | Scope | `test_harness_checks_paths_coverage.py` 변경이 표면상 무관해 보이나, `spec-link-checks.yml` 의 신규 `:(glob)*.md` pathspec 이 이 매직을 모델링 안 하면 `test_no_pathspec_is_a_dead_filter` 가 깨지므로 **직접 필수 후속** — 스코프 위반 아님 | `.claude/tests/test_harness_checks_paths_coverage.py:199-224` | PR 설명/커밋 메시지에 두 파일의 인과관계 한 줄 명시(선택) |
| 8 | Security | `findBrokenLinksInFiles` 의 상대경로 target 을 검증 없이 `path.resolve` 로 해석 — 이론상 리포 밖 경로 가리킬 수 있으나 (a) CI/로컬 전용 개발 도구, (b) 입력은 이미 커밋된 신뢰 콘텐츠, (c) 결과는 존재여부/헤딩 비교에만 사용되고 파일 내용을 노출하지 않아 실질 공격 표면 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`findBrokenLinksInFiles`) | 조치 불필요. 향후 파일 내용을 외부 노출하는 방향으로 확장될 때만 리포 루트 하위 검증 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `path.resolve` 관련 INFO 1건 외 실질 결함 없음. CI `permissions: contents: read` 최소권한 유지 확인 |
| requirement | LOW | SPEC-DRIFT(§4.2 표 scope3 미반영) + `:(glob)` boundary 테스트 부재. 핵심 변경 정합성은 vitest/unittest 실행으로 직접 확인 |
| scope | NONE | plan 목표에 정확히 수렴. 공유 인프라(`test_harness_checks_paths_coverage.py`) 변경도 pathspec 확장의 직접 필수 후속으로 확인 |
| side_effect | NONE | CI 트리거 확장자 무관 확대(INFO) 외 부작용 없음. `scripts/check-doc-links.py` 삭제 잔존 참조 없음 확인 |
| maintainability | NONE | 실측값 중복 기재·이름 없는 임계값 등 스타일 수준 INFO만. 신규 함수는 기존 컨벤션과 구조·네이밍 일치 |
| testing | LOW-MEDIUM | 이 PR 의 존재 이유인 핵심 회귀 클래스(`:(glob)` 세그먼트 경계)를 실행 계층에서 pin 하는 테스트 부재. 기능 자체는 18/18·25/25/17/18 전부 PASS 로 직접 재현 확인 |
| documentation | LOW | 동일 SPEC-DRIFT 지적(§4.2 표) + pathspecs 커버리지 회귀가 테스트로 codify 안 됨(INFO). diff 자체 문서화 품질은 높음 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상 보고(순수 "문제 없음" 확인만 있는 항목은 위 표에서 대표 항목으로 축약, 나머지는 에이전트별 요약에 반영).

## 권장 조치사항

1. **(WARNING #1, SPEC-DRIFT)** `spec/conventions/spec-impl-evidence.md §4.2` 표에 신규 scope 3(거버넌스 문서)를 반영 — `project-planner` 턴 필요.
2. **(WARNING #2, #3)** `:(glob)` pathspec 매직의 boundary/실행 계층 테스트 추가 — `test_ci_paths_changed.py` 의 `_RepoFixture` 재사용 + `FilterMatchBoundaryTest` 직접 pin 케이스. 이 PR 이 방지하려는 정확한 회귀 클래스이므로 우선순위 높음.
3. (선택, INFO) `node_modules` 제외 규칙·`findBrokenGovernanceLinks` 양성 검출 fixture 보강, `17,202` 값 SoT 단일화, `spec-link-checks.yml` pathspecs 커버리지 회귀 테스트 백로그화 — 방어 심도 개선이며 병합 차단 사유 아님.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer 실행.
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(success).
  - **제외**: 없음.