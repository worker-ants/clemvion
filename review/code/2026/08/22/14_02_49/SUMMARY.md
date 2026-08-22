# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건은 모두 "이 PR 이 새로 만든 회귀"가 아니라 "이 PR 이 해결하려는 문제(경로 게이팅 커버리지 갭)와 같은 성격의, 검증되지 않은 사각지대"라 우선 조치 권고 대상. forced(router_safety) 화이트리스트 8명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Side Effect | `frontend-checks.yml` 에서 `codebase/channel-web-chat/**` pathspec 제거 근거를 "미러 가드가 이 잡에 있었다"는 **단일 소비처** 기준으로만 판단했다. 같은 frontend vitest 스위트 안에 그 경로를 실제로 스캔하는 또 다른 가드(`typescript-toolchain.test.ts` — `discoverWorkspaceDirs()`)가 있는지는 이 PR 의 plan·Rationale 에 언급되지 않았다. (완화 근거: side_effect/architecture 리뷰어가 독립적으로 두 가드 헤더를 확인한 결과 "실제 게이트는 로컬 `run-test.sh`"라고 스스로 명시해 CI 트리거 범위 축소가 실효 커버리지를 깨지 않음을 실측 확인 — 실질 위험은 낮으나, "다른 소비처 유무를 전수 확인하지 않고 판단"한 절차 자체가 이 PR 이 고치려는 패턴과 같은 성격이라 기록.) | `.github/workflows/frontend-checks.yml:41-47`(pathspec 블록), `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts:46-58` | `codebase/channel-web-chat/**` pathspec 유지 검토 또는, `pnpm-lock.yaml` pathspec 만으로 충분함을 plan 에 명시적 근거와 함께 기록. 이미 side_effect/architecture 가 확인한 "로컬 run-test.sh 가 실제 게이트" 근거를 plan 문서에 한 줄 추가하면 이 WARNING 은 해소됨 |
| 2 | Testing | 이 PR 의 핵심 동작 주장("backend-only 변경에서도 `repo-guards.yml` 이 relevant=true 로 돈다" — 즉 `codebase/**` pathspec 이 backend/frontend/packages 전 스택을 실제로 커버한다)이 자동 회귀 테스트로 고정되지 않고 plan 문서의 1회성 수동 "실측" 서술에만 남아 있다. 기존 제네릭 `test_no_pathspec_is_a_dead_filter` 는 pathspec 이 스택별로 좁혀져도 여전히 GREEN 을 낼 수 있는 형태라 이 불변식을 못 지킨다 | `.github/workflows/repo-guards.yml` (changes 잡 `pathspecs: codebase/**`), `.claude/tests/test_required_check_skip_jobs.py:171`(`test_no_pathspec_is_a_dead_filter`) | `repo-guards.yml` 전용으로 "pathspec 이 `codebase/backend/**`·`codebase/frontend/**`·`codebase/packages/**` 각각에서 최소 1개 tracked 파일과 매치해야 한다" assertion 을 추가하거나, `test_ci_paths_changed.py` 패턴(임시 git repo + subprocess)으로 "backend 파일만 바꾼 diff → relevant=true" 를 직접 재현하는 케이스 하나 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `actions/checkout@v7` 가 SHA 가 아닌 태그로 고정 — 저장소 전역 기존 관례이며 이 PR 이 새로 도입한 회귀 아님 | `.github/workflows/repo-guards.yml:74` | 조치 불요. SHA 핀 전환은 저장소 전체 정책으로 별도 트래커 |
| 2 | Architecture | 크로스스택 거버넌스 로직(마커 미러 가드)이 frontend 앱 소스 트리(`codebase/frontend/src/lib/repo-guards/__tests__/`) 안에 유일한 정본으로 위치 — 실제 책임 범위(backend·packages·channel-web-chat 판정)가 디렉터리 이름이 암시하는 범위보다 넓음 | `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:1-14` | 조치 불요(형제 가드와 일관, TS AST 필요성 실용적). 크로스스택 가드가 더 늘면 `.claude/tests/` 등 전용 위치 재검토 |
| 3 | Architecture / Side Effect / Scope | 미러 가드 spec 이 `frontend-checks.yml`(전체 vitest)과 `repo-guards.yml`(전용 잡) 두 워크플로에서 의도적으로 중복 실행됨 — 로컬 `run-test.sh unit` 이 별도 배선 없이 돌게 하려는 목적, plan/워크플로 헤더에 명문화 | `.github/workflows/repo-guards.yml:21-23` | 조치 불요(문서화된 트레이드오프). 후속 가드 추가 시 "저장소 전체 스캔 필요 가드만" 원칙 유지 |
| 4 | Maintainability | 워크플로 파일명 `repo-guards.yml` 이 기존 `<영역>-checks.yml` 명명 패턴에서 벗어남(선례 있음: `migration-check.yml`) | `.github/workflows/repo-guards.yml:24` | 강제 조치 불요. 통일 원하면 `repo-guards-checks.yml` 개명 검토 |
| 5 | Maintainability | `mirror-guard` 잡 이름이 단일 가드 전용이라 두 번째 저장소-전체 가드 추가 시 확장성 낮음; CI 스텝이 대상 spec 파일 경로를 문자열로 하드코딩(fail-closed 이라 조용한 실패는 아님) | `.github/workflows/repo-guards.yml:62`, `:85-86` | 지금은 조치 불요, 두 번째 가드 추가 시점에 재검토 |
| 6 | Documentation | `masked-marker-shared-package.md` 의 종결 메모("닫았다 (2026-08-22)")가 실제 설계·Rationale 전체가 담긴 `mirror-guard-single-copy.md` 를 파일명으로 교차 인용하지 않음 — 같은 문서가 세운 "처분 대상은 파일:라인으로 인용" 관행의 예외 | `plan/in-progress/masked-marker-shared-package.md:177` | 블록쿼트 첫 줄에 `plan/in-progress/mirror-guard-single-copy.md` 경로 인용 추가 |
| 7 | Scope | target 이 자신이 속하지 않은 다른 task(`masked-marker-contract-7d2e14`)의 plan 문서(`masked-marker-shared-package.md:165`)를 같은 턴에 `[x]` 처분 — target 자신의 plan 작업 항목이 이를 명시적으로 예고했고 PR #1190 머지 후 실존 확인한 뒤 진행 | `plan/in-progress/masked-marker-shared-package.md` | 조치 불요, 근거 문서화됨 |
| 8 | Dependency | 신규 외부/내부 패키지 의존성 0건 — 오히려 backend 사본이 소비하던 `typescript`+`@workflow/masked-markers` 중복 임포트(354줄)를 제거해 frontend 사본으로 수렴. 공유 devDep 패키지 추출안은 등록 표면 실측(8곳/자동검증 2곳 vs 5곳/자동검증 5곳)으로 명시 기각 | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`(삭제), `plan/in-progress/mirror-guard-single-copy.md` "왜 공유 패키지가 아닌가" 표 | 조치 불요 — 긍정적 변경, 근거 기록됨 |
| 9 | Dependency | 신규 `repo-guards.yml` 이 스택 무관하게 모든 `codebase/**` PR 에서 frontend pnpm install 을 태움(CI 시간 소폭 증가) — frontend PR 에서는 `frontend-checks.yml` 과 중복. 명시적으로 수용된 트레이드오프 | `.github/workflows/repo-guards.yml:62-86` | 조치 불요(disclosed cost). CI 시간이 실측 문제가 되면 targeted 최적화 검토 |
| 10 | Requirement / Testing / Side Effect / Dependency | backend 사본(`masked-marker-mirror-guard.ts`/`.spec.ts`) 삭제 후 잔존 참조 0건(grep/jest --listTests 실측), 캐너리 9종 전량 frontend 쪽에 보존(제목 단위 대조), 하네스 레지스트리 4곳(`_JOB_CONDITIONS`/`_SKIP_JOB_WORKFLOWS`/`_PULL_REQUEST_KEYS`/`_PERMISSIONS`) 전수 등재 확인, 29건 하네스 테스트 + 44건 vitest 실행 GREEN | `.claude/tests/test_workflow_yaml_structure.py:260,294,365,418`, `.claude/tests/test_required_check_skip_jobs.py:60` | 조치 불요 — 검증 목적 기록 |
| 11 | Requirement | `spec/` 전체에 이 변경 영역(CI 워크플로/테스트 하네스)을 규정하는 본문이 없음(grep 0건) — `spec_impact: none` 이 정확함. consistency-check 가 지적한 "정본 트래커 항목 파일 경로 미명시" WARNING 은 이미 구현에서 해소됨(경로·앵커 명시 확인) | `plan/in-progress/mirror-guard-single-copy.md`, `plan/in-progress/masked-marker-shared-package.md:165` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CI 인프라 전용, 최소 권한(`contents: read`), 신뢰불가 입력 미보간, 하드코딩 시크릿 없음. `checkout@v7` 태그 고정은 기존 관례(비회귀) |
| architecture | LOW | 공유 패키지 대신 전용 CI 잡으로 중복 원인 자체 제거 — 설계 근거 탄탄. 크로스스택 로직의 frontend 소재지, 의도적 중복 실행은 참고 사항 |
| requirement | LOW | plan-코드 일치를 실행 검증(29+44건 GREEN)으로 재확인. `channel-web-chat` pathspec 제거의 typescript-toolchain 소비처 영향 미검증(WARNING) |
| scope | NONE | 18개 변경 파일 전부가 단일 목적(사본 통합)에 직접 대응, 범위 이탈 없음 |
| side_effect | LOW | backend 심볼 삭제 후 잔존 참조 없음, 하네스 레지스트리 드리프트 없음. 신규 CI 잡 상시 추가·pathspec 축소는 의도되고 실측 안전 확인된 변경 |
| maintainability | NONE | 순net 개선(비대칭 결함 근원 삭제). 명명 패턴·잡 이름 확장성·경로 하드코딩은 전부 INFO |
| testing | LOW | 기존 계약 테스트 상속 구조는 견고하나, 이 PR 의 핵심 불변식(전 스택 pathspec 커버리지)을 검증하는 전용 회귀 테스트 부재(WARNING) |
| documentation | LOW | 헤더 주석 대칭 갱신 양호, spec 접점 없음 확인. 종결 메모의 상호 파일 인용 누락 1건(INFO) |
| dependency | NONE | 신규 의존성 0건, 오히려 중복 제거. 공유 패키지안은 실측 근거로 기각 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상 발견사항을 보고함 (실질 결함은 requirement·testing 의 WARNING 2건뿐).

## 권장 조치사항
1. `repo-guards.yml` 의 핵심 불변식(backend/frontend/packages 각 스택 최소 1개 tracked 파일과 pathspec 매치)을 검증하는 전용 회귀 테스트를 `.claude/tests/test_required_check_skip_jobs.py` 또는 유사 위치에 추가한다 (WARNING #2).
2. `frontend-checks.yml` 의 `codebase/channel-web-chat/**` pathspec 제거 근거에 "typescript-toolchain.test.ts 의 실제 게이트는 로컬 `run-test.sh`" 라는, side_effect/architecture 리뷰어가 이미 확인한 완화 사실을 plan 문서(`mirror-guard-single-copy.md`)에 한 줄 명시해 WARNING #1 을 해소한다.
3. (낮은 우선순위) `masked-marker-shared-package.md` 종결 메모에 `mirror-guard-single-copy.md` 파일 경로를 교차 인용해 트레이서빌리티를 완결한다.

## 라우터 결정

- `routing=all` (router 선별이 아닌 전체 실행 모드): 9개 reviewer 전원 실행 — security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency.
- **제외**: 없음 (skipped: none).
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — 전원 결과 확보됨. `architecture` 는 강제 화이트리스트 목록엔 없으나 `routing=all` 모드로 함께 실행되어 결과 확보됨.

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |