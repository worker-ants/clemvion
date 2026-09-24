# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 4건(전부 코드 로직이 아닌 회귀-테스트 부재·문서/헤더 stale·리뷰 산출물 위생 관련). 14명 reviewer 전원(강제 8명 포함) 결과 확보 완료 — 누락·재시도 필요 항목 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `/consistency-check --impl-prep` 산출물 `meta.json` 의 `target_path`/`mode` 가 이 세션 전용 scratch 절대경로(`/private/tmp/.../prep-scope-2`)를 그대로 영구 리포지토리 기록으로 남김. 선례(`review/consistency/2026/07/03/...`, `2026/06/06/...`)는 모두 저장소 상대경로의 실제 대상을 기록했음 | `review/consistency/2026/09/24/21_04_26/meta.json:3-4` | 실제 검토 대상(`spec/conventions/spec-impl-evidence.md`)으로 정정하거나 최소 병기. 병합 전 수정 권장(병합 후엔 영구 기록으로 굳음) |
| 2 | testing | 이번 수정이 막으려는 정확한 결함(`plan/**` pathspec 누락, 단일 파일만 실행)을 고정하는 자동 회귀 테스트가 하나도 없음 — 기존 하네스 3종(`test_workflow_yaml_structure.py`·`test_required_check_skip_jobs.py`·`test_workflow_run_inputs_covered.py`) 모두 이 특정 사실을 검사하지 않음을 실행 확인(`plan/**` 항목을 통째로 지워도 GREEN 유지) | `.github/workflows/spec-link-checks.yml:71,115` | `test_workflow_yaml_structure.py` 류 등재표 패턴으로 (a) `pathspecs` 에 `plan/**` 리터럴 존재, (b) `run:` 이 단일 `.test.ts` 가 아닌 디렉터리 실행 형태인지 고정하는 좁은 assertion 추가 |
| 3 | documentation | 워크플로 파일 최상단 헤더 요약(2행 "spec-link-integrity 가드로 검증", 11행 "가드 vitest 하나만 도는 lightweight 트리거")이 이번 디렉터리 전체 실행 확장 이후에도 갱신되지 않아, 본문 하단 2026-09-24 설명과 모순되는 stale 진술로 남음 | `.github/workflows/spec-link-checks.yml:2`, `:11` | 두 줄을 "docs 가드 전체(디렉터리)" 로 반영해 상단 요약과 하단 설명을 일치시킴 |
| 4 | documentation | 선행 두 건(동일하게 CI/harness 가드 동작을 바꾼 변경, `pending_plans` 가드 정정 · jest ESM 로딩)은 CHANGELOG 항목이 있는데, 이번 변경(plan/spec-only PR 에서 docs 가드 전체가 안 돌던 실결함 수정, `#1387` 사고 계기)에는 `CHANGELOG.md` 항목이 없음 | `CHANGELOG.md` (신규 항목 부재) | 같은 패턴의 선행 두 항목과 나란히 이번 변경 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / maintainability / requirement / side_effect / dependency | job id `spec-link-integrity` 가 이제 실제 실행 범위(디렉터리 전체 — plan-frontmatter·spec-frontmatter·spec-pending-plan-existence 등 다수 가드)보다 좁게 읽힘. `test_workflow_yaml_structure.py:262` 가 job id 를 required-check 앵커(`#1106`)로 고정해 즉시 개명 불가 — 의도된 트레이드오프이며 주석·plan 에 근거 명시, consistency-check `naming_collision`(INFO)도 동일 지적 | `.github/workflows/spec-link-checks.yml:90`, `:112-115` | 조치 불요(설계 의도, 근거 문서화됨). 후속: required check 등록 시점에 description/PR 템플릿으로 실제 범위 노출 고려 |
| 2 | performance / dependency | `plan/**` pathspec 추가로 CI 트리거 표면 확대 + 단일 파일→디렉터리 전체 실행으로 잡 실행시간 증가 — 둘 다 plan 문서가 실측(23파일/3567건, 수 초 · 과거 커밋 `relevant=false→true` 전이)으로 근거를 남긴 의도된 트레이드오프 | `.github/workflows/spec-link-checks.yml:69-71`, `:115` | 조치 불요. 향후 해당 디렉터리에 무거운(네트워크·긴 타임아웃) 테스트가 추가되면 "lightweight 트리거" 불변식이 깨질 수 있음을 그때 리뷰에서 재확인 |
| 3 | architecture / maintainability | 워크플로 헤더에 세 시점(도입 배경/`#912`, 2026-08-27, 2026-09-24)의 사고 이력 서술이 반복 누적되어 헤더가 전체 115줄 중 29줄(≈25%)을 차지, 같은 사실이 파일 내 3곳(헤더/job/step 주석)에서 부분 반복 | `.github/workflows/spec-link-checks.yml:1-29`, `:19-29`, `:85-89`, `:112` | 조치 불요(저장소 기존 컨벤션과 일치). 장기적으로 이력을 `plan/complete/**` 링크로 옮기고 헤더엔 한 줄 포인터만 남기는 것을 고려 |
| 4 | architecture | "가벼운 대체 트리거" 불변식(그 디렉터리엔 가벼운 docs 가드만 존재)이 코드/테스트로 강제되지 않고 관례로만 유지됨 | `.github/workflows/spec-link-checks.yml:115` | 후속 검토: 파일명 컨벤션, 실행시간 상한을 검증하는 하네스 테스트 |
| 5 | architecture | 저장소 전역 문서 거버넌스 가드가 `codebase/frontend` 패키지 테스트 트리에 물리적으로 결합된 기존 구조가, 파일 열거→디렉터리 전체 실행으로 인해 실행 경계로서 더 굳어짐 | `.github/workflows/spec-link-checks.yml:105-115` | 즉시 조치 불요. 후속으로 별도 workspace(`packages/repo-guards` 유사) 추출 여부 검토 가능 |
| 6 | testing | `relevant=='false'` 시 no-op 안내 echo 문구가 새 트리거 표면(`plan`)을 언급하지 않아 CI 로그만으로 원인 추론이 어려움 | `.github/workflows/spec-link-checks.yml:99` | 문구에 "plan" 추가(급하지 않음) |
| 7 | maintainability | `PROJECT.md` 문서 링크 검증 절이 "이 절의 나머지는 spec-link-integrity 가드 범위" 라는 사후 설명 문장으로 이어져 처음 읽을 때 관계 파악에 한 번 더 생각이 필요 | `PROJECT.md:378-388` | 선택적으로 "검사 스코프 3가지" 절 위에 소제목 추가 |
| 8 | documentation | job 정의부 주석의 "지금은 등록된 required check 없음(2026-09-24 실측)" 은 시점부 사실이라 향후 required check 가 실제 등록되면 stale 해짐 | `.github/workflows/spec-link-checks.yml:87-89` | 조치 불요(참고용, 논지 자체는 그 사실과 무관하게 유효) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 인젝션/시크릿/권한 확대/트리거 변경 없음 |
| performance | NONE | CI 리소스 소비 소폭 증가, 의도된 트레이드오프(INFO) |
| architecture | LOW | job 네이밍/스코프 불일치, 헤더 이력 누적, lightweight 불변식 비강제, frontend 패키지 결합(전부 INFO) |
| requirement | NONE | plan 처방과 정확히 일치, 로컬/하네스 재현으로 실측 검증 완료 |
| scope | NONE | 스코프 이탈·drive-by 변경 없음, 전 파일이 plan 처방과 직접 연결 |
| side_effect | LOW | consistency-check `meta.json` 의 scratch 경로 영구 기록(WARNING), job id 계약 확장(INFO) |
| maintainability | NONE | 네이밍/반복 서술은 INFO 수준, 차단 사유 없음 |
| testing | LOW | plan/**·디렉터리 실행을 고정하는 회귀 테스트 부재(WARNING) |
| documentation | LOW | 헤더 상단 요약 stale, CHANGELOG 항목 누락(WARNING x2) |
| dependency | NONE | 매니페스트 변경 없음, CI 내부 의존성 확장은 의도됨(INFO) |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음 |
| api_contract | NONE | 해당 없음 |
| user_guide_sync | NONE | doc-sync-matrix 22개 trigger 행 중 매칭 0건 |

## 발견 없는 에이전트

security, database, concurrency, api_contract, user_guide_sync

## 권장 조치사항
1. `review/consistency/2026/09/24/21_04_26/meta.json` 의 `target_path`/`mode` 를 실제 검토 대상(`spec/conventions/spec-impl-evidence.md`)으로 정정 — 병합 전에 고칠 것 (WARNING #1)
2. `spec-link-checks.yml` 의 `plan/**` pathspec 존재 및 디렉터리 전체 실행 형태를 고정하는 좁은 회귀 테스트를 `.claude/tests/`에 추가 (WARNING #2)
3. 워크플로 파일 상단 헤더 요약(2행·11행)을 디렉터리 전체 실행 기준으로 갱신 (WARNING #3)
4. `CHANGELOG.md` 에 이번 CI 가드 확장 항목 추가 (WARNING #4)
5. (선택) no-op 안내 echo 문구에 `plan` 언급 추가 (INFO #6)

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 14명 reviewer 전원 실행(그중 8명은 router_safety 강제 포함 목록: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing`). forced 8명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음 (0명)
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명, 전원 결과 확보)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |
