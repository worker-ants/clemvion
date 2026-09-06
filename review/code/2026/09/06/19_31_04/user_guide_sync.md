# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 20건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑을 읽고, `git diff --stat origin/main...HEAD` 로 실제 코드 변경 스코프(24개 파일, `CHANGELOG.md` 포함, `review/**`·harness 파일 제외)를 확정한 뒤 각 trigger 에 대조했다.

## 개요

이번 diff(`96d3856a9`..`e008dd009`, 로컬 커밋 14개)는 `User` 엔티티 민감 컬럼 노출 방어 2축(`user-entity-exposure-guard`/`user-secret-absence`) 신설, `WorkflowVersionsService.findOne` 실유출 수정, `pg-error.ts` 두 wrap 표면 헬퍼 확장, 트리거 `endpointPath` UNIQUE 충돌을 문서한 형태(`details.field`/`details.code`)로 재던지는 수정, `WorkspaceMemberDto.joinedAt` 선언 추가로 구성된다. 전부 backend 내부 하드닝·테스트·계약(선언 vs 실측) 정합화이며, 신규 노드·신규 provider·신규 UI 문자열·신규 섹션 디렉토리·표현식 언어·실행/디버깅 흐름 변경은 diff 안에 없다.

## 발견사항

- **[INFO]** 트리거 `endpointPath` 충돌(409, `details.code="TRIGGER_ENDPOINT_PATH_CONFLICT"`) 세부 코드가 `02-nodes/triggers.mdx` 의 에러 코드 표에 없음 — 그러나 신규 노출로 보기 어려움
  - 변경 파일: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict`, `isEndpointPathUniqueViolation`), `codebase/backend/src/modules/triggers/triggers.controller.ts` (`@ApiConflictResponse` 추가)
  - 매트릭스 항목: `backend-api-change` — trigger `codebase/backend/src/**/*.controller.ts` (semantic). targets: "controller·DTO 의 swagger jsdoc" / "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: 이번 diff 의 JSDoc 주석 자체가 근거를 밝힌다 — `spec/2-navigation/2-trigger-list.md §3` 이 이미 "409 `RESOURCE_CONFLICT`(세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)" 를 계약으로 적어 뒀는데 구현이 그 문자열을 한 번도 발행하지 않고 있었다는 **spec-대-code 갭 수정**이다. 즉 `POST/PATCH /api/triggers` 가 endpointPath 충돌 시 409 를 돌려주는 동작 자체는 이 PR 이전에도 있었고(사전 존재 UNIQUE 인덱스 `idx_trigger_workspace_endpoint`, `V002__indexes.sql`), 이번 PR 은 그 409 의 `details` 페이로드만 spec 이 약속한 형태로 정밀화했다 — 사용자가 새로 마주치는 시나리오가 아니다. 또한 `endpointPath` 는 v4 UUID 형식만 허용되는 옵션 필드(`create-trigger.dto.ts:79`, `trigger-dto-validation.spec.ts` W1 보안)라 일반 GUI 사용자가 손으로 값을 지어 충돌시키는 경로가 아니고, frontend 어디에도 `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 문자열 소비 코드가 없어(grep 0건) `backend-labels.ts` ko 매핑도 필요하지 않다. `triggers.mdx`/`triggers.en.mdx` 의 기존 409 표(라인 ~290/301)는 커맨드 idempotency 섹션 소속이라 트리거 CRUD 충돌과는 별개 절이다.
  - 누락된 동반 갱신: 없음으로 판단(참고용 INFO) — 필요하다면 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`/`.en.mdx` 에 "동일 endpointPath 로 트리거를 두 개 만들 수 없다" 한 줄 추가 가능하나 필수는 아님.
  - 제안: 조치 불요. 후속 문서 보강을 원하면 저비용 한 줄 추가만.

- **[정보 확인, 결함 아님]** `WorkspaceMemberDto.joinedAt` 필드 추가는 신규 사용자 노출이 아님
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
  - 매트릭스 항목: `backend-api-change` (`dto/**` glob)
  - 상세: `codebase/frontend/src/lib/api/workspaces.ts` 의 `WorkspaceMember.joinedAt: string | null` 은 이번 diff 대상이 아니며(`git diff origin/main...HEAD` 결과 무변경, 선행 커밋 `9e4a798cf`/`003792a20` 시점부터 이미 존재) frontend 는 이 필드를 **이미 소비할 준비가 되어 있었다** — CHANGELOG 도 "프런트엔드는 `joinedAt: string | null` 로 소비 중" 이라고 명시. 즉 이번 PR 은 DTO **선언**을 실제 응답·frontend 기대에 맞춘 정합화이지 새 기능이 아니다. 07-workspace-and-team 문서(`workspaces-and-members.mdx`)에 멤버별 가입 일시를 표시하는 UI 언급도, 관련 문자열도 없어 갱신 대상 자체가 없다.
  - 조치 불요.

## 매칭되지 않은 항목 확인 (근거)

- **새 노드 추가 / 노드 schema 변경**: `codebase/backend/src/nodes/**` 변경 없음(diff-stat 확인) — 미매칭.
- **신규 UI 문자열(TSX)**: 변경된 frontend 파일은 `codebase/frontend/src/lib/api/workflows.ts` 1건뿐이며 `.ts`(비-`.tsx`)이고 추가 내용은 순수 JSDoc 주석(백엔드 타입과의 손-미러 경고)이라 사용자 노출 문자열이 아님 — 미매칭.
- **통합/제공자 변경**: `06-integrations-and-config/` 대상 provider 코드 변경 없음 — 미매칭.
- **신규 섹션 디렉토리**: `content/docs/` 신규 디렉토리 없음 — 미매칭.
- **인증·권한·세션 흐름 변경**: trigger glob `codebase/backend/src/modules/auth/**` 매칭 파일 없음. `workspaces`/`triggers` 모듈 변경은 있으나 이는 기존 RBAC 계약을 바꾸는 것이 아니라 응답 payload 의 민감 컬럼 유출을 막는 방어 강화(동일 응답 형태·동일 권한 결과, 내부 정보만 덜 샘)이므로 "흐름 변경"으로 보기 어렵다 — 미매칭.
- **표현식 언어 변경**: `codebase/packages/expression-engine/**` 무변경 — 미매칭.
- **실행·디버깅 흐름 변경**: 해당 없음 — 미매칭.
- **신규 warningCode/errorCode**: `codebase/backend/src/nodes/core/error-codes.ts` 무변경, `warningRules` 무변경. `RESOURCE_CONFLICT` 는 기존 코드(신규 아님), `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 `ErrorCode` enum 이 아니라 `details.code` 서브필드이며 frontend 소비처가 없음 — 미매칭.

## 요약

매트릭스 20개 행 중 semantic 매칭 후보는 `backend-api-change`(controller/DTO glob) 1건뿐이었고, 실측 결과 그 항목도 "신규 사용자 노출"이 아니라 "이미 spec(`2-trigger-list.md`)에 문서화된 계약을 코드가 뒤늦게 충족"·"frontend 가 이미 소비 준비된 필드의 DTO 선언 보정"에 해당해 유저 가이드 MDX·i18n dict·backend-labels 동반 갱신이 필요하지 않다. CRITICAL/WARNING 은 0건이며, 트리거 에러 코드 표 보강 가능성 1건만 INFO 로 남긴다. 이번 diff 는 전형적인 backend 내부 보안 하드닝 + 테스트 인프라 PR 로, User Guide Sync 관점에서는 무관에 가깝다.

## 위험도

NONE
