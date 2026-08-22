# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 결과 확보(전원 success, 재시도 필요 없음).

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL 0건, WARNING 은 사실상 동일 이슈(작업 체크리스트가 갱신 대상 파일을 명시하지 않음) 1건이 두 checker 에서 중복 지적됨. 나머지는 INFO 수준 참고 사항.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity, Plan Coherence | "정본 트래커 항목 `[x]`" 작업 체크리스트 항목이 갱신 대상 파일 경로를 명시하지 않음. 같은 문구("미러 가드 탐지 로직을 공유 test-utility 로 재추출")를 담은 원본은 `plan/in-progress/masked-marker-shared-package.md:165` §후속(이 PR 밖) 인데, 같은 소스 plan 안에 "정본 트래커"라 불리는 **다른** 항목(`:373`·`:757`, `spec-sync-external-interaction-api-gaps.md` 소재)이 이미 있어 실행자가 갱신 대상을 오인할 위험이 있음. 게다가 `masked-marker-shared-package.md` 는 별도 worktree(`masked-marker-contract-7d2e14`)에서 in-progress 상태로 `/ai-review` 1건만 남아 거의 완료 단계라, target PR 착지 시점에 그 plan 이 `plan/complete/` 로 이동해 있어 경로를 못 찾을 수도 있음 | `plan/in-progress/mirror-guard-single-copy.md` §작업 — `- [ ] 정본 트래커 항목 [x] + 대체 근거 (구현 커밋과 같은 턴)` | `plan/in-progress/masked-marker-shared-package.md:165` §후속(이 PR 밖) 첫 항목 (병렬 worktree, in-progress) | 해당 작업 항목을 `plan/in-progress/masked-marker-shared-package.md:165`(그 시점에 `plan/complete/` 로 이동했다면 이동 후 경로)로 명시. 착수 직전 병렬 세션이 이미 해당 plan 을 `complete/` 로 옮기지 않았는지 재확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 동일 masked-marker/CI-경로-게이팅 근본원인에 대한 두 번째 해법인데 spec Rationale 이 서로 참조하지 않음(모순은 아님 — production 값 미러=공유 패키지 vs test-only 가드=전용 CI 잡) | target "왜 사본이 둘이었나"/"왜 공유 패키지가 아닌가" 문단 ↔ `spec/5-system/14-external-interaction-api.md` 2026-08-21 결정 문단 | target Rationale 에 §14 결정을 1문장 교차 인용하거나 §14 쪽에 test-only 가드 해법 각주 추가 |
| 2 | Rationale Continuity | 기존 8개 `@workflow/*` 공유 패키지 선례(전부 production dependency)와 이번 devDep-only 케이스의 구분 근거가 문서에 명문화되지 않음 | target `## 왜 공유 패키지가 아닌가` 절 / `## Rationale` 기각한 대안 | "기존 8종은 production dep, 본 후보만 devDep-only 테스트 유틸 — 등록 표면 비대칭(Dockerfile 개입 여부)의 근원" 한 줄 추가 |
| 3 | Plan Coherence | `.github/workflows/frontend-checks.yml:44-49` 주석이 "미러 가드가 frontend 워크스페이스에서 돈다"는 이유로 `codebase/channel-web-chat/**`·`codebase/packages/**` pathspec 확장을 정당화하는데, target 이 미러 가드를 전용 `repo-guards.yml` 로 이관하면 그 근거가 소멸하고 두 워크플로에서 가드가 중복 실행될 수 있음(해는 없음, 참고용) | target §설계 — `.github/workflows/repo-guards.yml` 신설, pathspec `codebase/**` | 작업 항목에 "frontend-checks.yml 주석·pathspec 유효성 확인/갱신 또는 중복 실행 명시적 수용" 추가 검토 |
| 4 | Naming Collision | 신규 워크플로 파일명 `repo-guards.yml` 이 기존 `<영역>-checks.yml` 명명 패턴에서 벗어남(단, `migration-check.yml`/`review-gate.yml` 선례 있어 강제 컨벤션 위반 아님). 오히려 `codebase/{backend,frontend}/src/.../repo-guards/` 소스 디렉터리와 의미적으로 대응해 발견성은 좋음 | `.github/workflows/repo-guards.yml` (신설, 충돌 없음) | 강제 조치 불필요. 원할 경우 `repo-guards-checks.yml` 로 통일 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec 표면(데이터모델/API/요구사항ID/상태전이/RBAC) 미접촉, `spec_impact: none` 유효. §14 EIA 와의 상호참조 부재만 INFO |
| Rationale Continuity | LOW | spec Rationale 8개 문서 대조 결과 기각된 spec 대안 재도입 없음. 형제 plan 의 backlog 항목 파일경로 미명시(WARNING), 공유 패키지 선례 구분 근거 명문화 미흡(INFO) |
| Convention Compliance | NONE | `spec/conventions/**` 19개 문서 어느 도메인과도 접점 없음, 위반 없음 |
| Plan Coherence | LOW | 원 plan(`masked-marker-shared-package.md`)과 전제 정합. 트래커 항목 처분 지시가 파일경로 누락(WARNING), frontend-checks.yml pathspec 중복 가능성(INFO) |
| Naming Collision | NONE | 신규 식별자(`repo-guards.yml`) 는 git 이력·하네스 레지스트리(`CONVERTED`/`_PERMISSIONS`) 와 충돌 없음. 명명 패턴 이탈만 INFO |

## 권장 조치사항
1. target `plan/in-progress/mirror-guard-single-copy.md` §작업의 "정본 트래커 항목 `[x]`" 줄을 `plan/in-progress/masked-marker-shared-package.md:165`(§후속, 이 PR 밖) 로 구체화하고, 착수 직전 그 plan 이 이미 `plan/complete/` 로 이동했는지 재확인한다 (WARNING 해소).
2. (선택) target Rationale 에 `spec/5-system/14-external-interaction-api.md` 2026-08-21 결정과의 관계를 1문장 교차 인용한다.
3. (선택) `## 왜 공유 패키지가 아닌가` 절에 기존 8개 production-dep 패키지 선례와의 구분 근거(devDep-only 테스트 유틸)를 명문화한다.
4. (선택) `.github/workflows/frontend-checks.yml:44-49` 주석이 target 반영 후에도 유효한지, 또는 미러 가드 중복 실행을 수용할지 작업 항목에 명시한다.
5. target 은 BLOCK 사유가 없으므로 위 조치는 진행을 막지 않으며, 특히 1번만 처리하면 충분하다.
