# RESOLUTION — ai-review 2026/06/27/11_46_32

**대상**: `claude/mc-test-authz-7b3bbc` — model-config `:id/test` Editor+ 인가 강화
**SUMMARY**: Critical 0 / Warning 4 / Risk LOW
**처리 커밋**: `9c5db9b2` (review-fix)

> 실행 메모: Workflow ai-review 가 router 매핑 버그로 `reviewers:[]` 반환 → CLAUDE.md §외부 LLM 호출 정책의 fallback 평문 Agent fan-out 으로 8개 reviewer 재실행(security·api_contract·requirement·testing·scope·side_effect·maintainability·documentation). 6개(performance·architecture·dependency·database·concurrency·user_guide_sync)는 변경 성격상 무관으로 미실행.

## Critical

없음.

## Warning — 전부 FIXED

| # | 카테고리 | 처리 | 반영 |
|---|----------|------|------|
| W1 | Testing | FIXED | `workspace-rbac.e2e` 케이스 H 에 viewer→`POST preview-models` 403 단언 추가. R-7 이 묶는 두 action-POST 중 누락됐던 `previewModels` `@Roles('editor')` 회귀를 e2e 가 잡도록 보강 |
| W2 | Testing | FIXED | editor `testConnection` 단언을 `not.toBe(403)` 단독으로 축소. `toBe(200)`+`body.data.success===false`(best-effort 미존재 catch 흡수 구현 결합) 제거 — authz 계약만 단언 |
| W3 | Maintainability | FIXED | 컨트롤러 spec 의 `Reflect.getMetadata('roles', …)` 매직 스트링을 `roles.guard.ts` 의 `ROLES_KEY` import 참조로 교체(3곳). 키 변경 시 silent-failure 방지 |
| W4 | Documentation | FIXED | `CHANGELOG.md ## Unreleased` 에 `POST /api/model-configs/:id/test` Viewer→Editor+ breaking behavior change 기재(Breaking changes 섹션) |

## INFO — 선택 반영 / defer

| # | 카테고리 | 처리 | 비고 |
|---|----------|------|------|
| I6 | API/Doc | FIXED | `listModels` 에 `@Roles`/`@ApiForbiddenResponse` 미적용이 의도(Viewer+)임을 인라인 주석으로 명시 |
| I9 | Maintainability | FIXED | 컨트롤러 spec `@Roles` describe 블록 테스트 설명 영어 통일 |
| I11 | Maintainability | FIXED | editor 단언 중복(`not.toBe(403)`+`toBe(200)`) 제거 — W2 와 함께 정리 |
| I12 | Documentation | FIXED | `workspace-rbac.e2e` 파일 상단 JSDoc invariants 에 케이스 H 계약 항목 추가 |
| I1 | Security | DEFER | `@Query('type')` 런타임 열거형 강제 — pre-existing, 본 PR 무관 별건 |
| I2 | Security | DEFER | `previewModels` apiKey 로그 마스킹 확인 — pre-existing 인프라 점검 별건 |
| I3 | API Contract | KEEP | `testConnection` 미존재 config → 200{success:false} — pre-existing best-effort, 열거 차단 효과로 현행 유지 |
| I5 | API Contract | DEFER | `listModels` 페이지네이션 상한 — pre-existing, 별건 |
| I7 | Testing | DEFER | `X-Workspace-Id` 미전송 RolesGuard false 경로 — `roles.guard.spec` 별건 |
| I8 | Testing | KEEP | admin/owner 계층 긍정 경로 — 기존 RBAC 케이스 C·D·E 가 커버, 추가 불필요 |
| I10 | Maintainability | DEFER | `@Throttle` 매직 넘버 상수화 — pre-existing 리팩터 별건 |

## ESCALATE

없음 — 모든 Warning 이 테스트/문서 레벨이며 사용자 결정·spec 변경·sensitive-fix 불요.

## e2e

통과 — `.claude/tools/run-test.sh e2e` 215 pass (2026-06-27 12:07, log `_test_logs/e2e-20260627-120722.log`). 마지막 코드 커밋(`9c5db9b2`) 다음에 수행. 케이스 H 가 viewer→403(`:id/test`·`preview-models`) / editor→가드통과 / listModels viewer→404 를 실 인프라로 검증.
