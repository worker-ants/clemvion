# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 및 근거

1. `.claude/config/doc-sync-matrix.json` (SSOT, `rows[]` 19행)을 Read.
2. `PROJECT.md` §변경 유형 → 갱신 위치 매핑(L128–L198) 본문을 nuance 보조로 Read.
3. 변경 파일 목록: `git diff --name-only origin/main...HEAD` 로 실측(267개 파일 — 이 중 대다수는 `review/code/2026/09/06/<과거 라운드>/*.md` 같은 이전 리뷰 산출물이며 매트릭스 대상이 아님). 매트릭스 관점에서 의미 있는 non-review/non-plan 변경 파일만 추려 26개로 좁힘:
   - `.claude/hooks/_lib/review_guard.py`, `.claude/tests/test_review_guard.py` — harness 도구, 매트릭스 무관
   - `CHANGELOG.md`, `plan/in-progress/*.md` — 추적 문서, 매트릭스 target 아님
   - `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` — `spec-major-change` 행 glob(`spec/conventions/**`)에 형식적으로 매칭되나, 내용은 frontmatter `code:` 필드에 신규 시행 가드(`dto-jsdoc-citation-guard.ts`) 항목을 추가하고 그 경계를 취소선+정정으로 명시한 것으로 §3 요구(frontmatter 정합)를 이미 충족. 실제 존재하는 `dto-jsdoc-citation-guard.ts`/`dto-jsdoc-citation.spec.ts` 를 `code:` 에 정확히 반영했음을 확인(`git diff` 상 두 파일 다 리스트에 포함). 이 두 문서는 개발 규약(SoT) 문서이지 `codebase/frontend/src/content/docs/**` 의 사용자 대상 유저 가이드가 아니라 본 리뷰어 핵심 관점(nodes/i18n/docs MDX/backend-labels) 밖이며, 매트릭스 행 요구 자체도 이미 충족돼 있어 누락 없음.
   - `codebase/backend/src/common/db/pg-error.{ts,spec.ts}` — DB 에러 파싱 공유 유틸(`pgErrorConstraint` 신설). 사용자 노출 라벨/에러코드 체계(`nodes/core/error-codes.ts`, `WARNING_KO`/`ERROR_KO`)와 별개의 내부 SQLSTATE 판별 함수 — 매칭 대상 아님.
   - `codebase/backend/src/modules/triggers/triggers.service.{ts,spec.ts}` — `(workspace_id, endpoint_path)` UNIQUE 위반을 `RESOURCE_CONFLICT` + `details.code: 'TRIGGER_ENDPOINT_PATH_CONFLICT'` 로 포맷. 확인 결과 이 계약은 **`spec/2-navigation/2-trigger-list.md §3` 이 이미 문서화한 형태**를 구현이 뒤늦게 채운 것(문서→구현 방향, 반대 방향 아님) — 신규 사용자 가시 계약이 아니므로 유저 가이드 갱신 대상이 아니고, `nodes/core/error-codes.ts` 의 `ErrorCode` enum 이나 `warningRules` 와도 다른 코드 공간이라 `backend-labels.ts` `WARNING_KO`/`ERROR_KO` 매핑 대상도 아님. `grep -rn TRIGGER_ENDPOINT_PATH_CONFLICT codebase/frontend/src/` 0건 — frontend 가 이 subCode 를 소비하지 않아 영문 노출 표면 자체가 없음.
   - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.{ts,spec.ts}` — `findOne` 의 `creator` eager 관계에 투영을 추가해 `User` 전 컬럼 유출을 닫은 보안 수정. 응답 필드 구성 자체는 축소(과다 노출 → 3필드로 좁힘) 방향이라 사용자 가시 신규 기능이 아님 — user-guide 대상 아님.
   - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` — `WorkspaceMemberDto.joinedAt` swagger 선언 추가. 실측: `codebase/frontend/src/lib/api/workspaces.ts` 에 `joinedAt: string | null` 타입이 **이미 존재**하고 `WorkspacesService.listMembers` 가 이미 이 값을 런타임에 실어 왔음(DTO 미선언 상태였을 뿐) — 신규 API 노출이 아니라 기존 런타임 동작에 swagger 문서가 뒤늦게 맞춘 계약 정합 수정. `codebase/frontend/src/app/(main)/w/[slug]/workspace/settings/page.tsx` 가 이미 이 필드 계열을 소비하는 화면. `06-integrations-and-config` 류 신규 안내 대상 기능이 아니므로 "백엔드 API 추가·변경" 행의 "사용자 안내에 영향" 문턱을 넘지 않음(그레이존이나 경미).
   - 나머지(`codebase/backend/src/repo-guards/__tests__/**`, `codebase/backend/src/shared/testing/user-secret-absence.{ts,spec.ts}`, `codebase/backend/test/*.e2e-spec.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`) — 전부 `User` 엔티티 민감 컬럼 노출을 잡는 **테스트/가드/픽스처**이며 신규 노드·신규 UI 문자열·통합 provider·표현식 언어·실행/디버깅 흐름·인증 세션 흐름(모듈)·신규 섹션 디렉토리 어느 trigger 도 건드리지 않음. `codebase/backend/src/modules/auth/**` 경로는 이번 diff 에 전혀 없음(RBAC e2e 는 `modules/workspaces` 소비 테스트일 뿐 auth 모듈 자체 변경 아님).
4. `codebase/frontend/**`, `codebase/backend/src/nodes/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/modules/auth/**` 전체에 대해 `git diff --stat origin/main...HEAD` 를 별도로 실행 — 4개 경로 모두 **변경 파일 0건**을 실측 확인.

## 발견사항

없음. 매칭되는 trigger 가 없거나(위 4항목 glob 스코프 0건 실측), 형식적으로 glob 이 걸리는 두 행(`spec-major-change`, `backend-api-change`)도 실질 내용을 열어 보면 각각 (a) frontmatter 요구 사항을 이미 충족한 내부 규약 정정, (b) 이미 프론트엔드가 소비 중인 기존 런타임 필드의 swagger 문서 정합 수정이라 "누락"으로 볼 실질이 없음.

## 요약

매트릭스 19행 중 glob 스코프가 명확히 걸린 것은 없었고(`codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/packages/expression-engine/**`, `codebase/backend/src/modules/auth/**` 전부 0건 실측), 형식적으로 걸린 `spec/conventions/**`(spec-major-change)·`dto/**`(backend-api-change) 2행은 내용 검토 결과 실질적 누락이 없었다(전자는 frontmatter 요구 이미 충족, 후자는 신규 기능 아닌 기존 런타임 필드의 문서 정합). 본 변경 세트는 `User` 엔티티 민감 컬럼 노출을 막는 보안 방어(가드 2종 + e2e/spec)이며 `codebase/frontend/**` 전체가 diff 에 없어 유저 가이드/i18n dict/backend-labels 동반 갱신이 애초에 트리거되지 않는다.

## 위험도

NONE
