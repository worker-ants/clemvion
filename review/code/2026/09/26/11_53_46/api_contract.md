# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 이번 변경은 런타임 API 계약이 아니라 OpenAPI/Swagger **문서 문자열**만 바꾼다
  - 위치: `codebase/backend/src/modules/**/*.controller.ts` (29개 컨트롤러, 129곳) — 예: `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts:35`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts:131-133`
  - 상세: 모든 diff hunk 가 `@ApiForbiddenResponse({ description: '...' })` 의 하드코딩 문자열을 `FORBIDDEN_NOT_A_MEMBER` 상수 또는 `forbiddenForRole(role)` 헬퍼 호출로 치환하는 형태다. 실제 HTTP 상태 코드(403), 예외 발생 조건(`RolesGuard.assertMember`), 응답 바디 스키마, 라우트 경로, 페이지네이션, 인증 미들웨어는 전혀 건드리지 않았다. `codebase/backend/src/common/guards/roles.guard.ts` 의 `assertMember` 는 인라인 `reduce` 를 `lowestRequiredRole()` 호출로 바꿨을 뿐 로직은 동일하다(`codebase/backend/src/common/constants/workspace-roles.ts:36-42`와 대조 확인, `roleLevel`/`ROLE_REQUIRED` 사용도 그대로).
  - 제안: 없음(정보성). 하위 호환성·버전 관리·응답 스키마·상태 코드 관점에서 breaking change 가 아니다.

- **[INFO]** 에러 응답 "설명(문서)"의 일관성이 오히려 개선됨 — 계약 이행 감사(reflection) 가드 신설
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts`, `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes.spec.ts`
  - 상세: 새 저장소 가드는 각 라우트에서 `RolesGuard`가 실제로 던질 수 있는 거부 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)를 reflection 으로 계산하고, 그 라우트의 `@ApiForbiddenResponse` description 에 해당 코드 문자열이 포함되는지 부분 문자열로 대조한다(`scanForbiddenResponseCodes`). 스펙 설명대로 129/157곳이 코드 누락 상태였고 이번 변경으로 0건이 됐다(`forbidden-response-codes.spec.ts:32-37,66-67` 주석). 이는 "에러 응답 형식 일관성" 항목을 실제로 강화하는 조치이며, 클라이언트가 OpenAPI 문서만 보고 403 판별 코드를 분기 처리할 수 있게 한다.
  - 제안: 가드 주석에 명시된 대로 이 가드는 "설명에 남아있는 불필요한 코드"(역할 완화 후 잔존 코드)나 "서비스 계층이 던지는 403"(`FORBIDDEN`, `RERUN_PERMISSION_DENIED` 등)은 탐지하지 못한다는 한계를 인지하고 있다 — 문서화된 한계이므로 문제 없음.

- **[INFO]** `workflow-test-datasets.controller.ts`의 `update`/`remove` 403 설명이 이전보다 더 구체화됨
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` (update ~line 98, remove ~line 119 — 실제 파일 `@ApiForbiddenResponse` 데코레이터)
  - 상세: 기존 `'소유자 아님'` 한 줄이 `` `${forbiddenForRole('editor')}, 또는 데이터셋 소유자가 아님(FORBIDDEN — 서비스 판정)` `` 으로 바뀌어, 가드 레벨의 `editor` 요구와 서비스 레벨의 소유자 판정(둘 다 실제로 `@Roles('editor')` + 서비스 로직으로 존재, 파일 직접 확인)을 모두 문서화한다. 응답 형식·코드 자체는 그대로이며 설명만 더 정확해졌다 — 회귀 아님.
  - 제안: 없음.

- **[INFO]** `integrations.controller.ts`/`workspaces.controller.ts` 의 파일-로컬 상수(`FORBIDDEN_MEMBER` 등)를 제거하고 공용 헬퍼로 치환
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:92-97`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (해당 상수 블록 삭제)
  - 상세: 죽은 코드나 미사용 import 없이 전부 대체 사용됨을 직접 확인(`FORBIDDEN_MEMBER_OR_ORG_ADMIN`/`FORBIDDEN_EDITOR_OR_ORG_ADMIN`/`FORBIDDEN_MEMBER_OR_ADMIN` 모두 참조처 존재). `NOT_A_MEMBER` 개별 import 제거 후 남은 `ROLE_REQUIRED` import 는 여전히 사용 중.
  - 제안: 없음.

## 요약
전체 29개 컨트롤러·129곳의 변경은 모두 `@ApiForbiddenResponse` 데코레이터의 `description` 문자열을 하드코딩 텍스트에서 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER`, `forbiddenForRole(role)`)로 교체하는 기계적 리팩터링이며, 실제 HTTP 상태 코드·응답 바디 스키마·URL 경로·페이지네이션·인증/인가 로직·가드 판정 로직은 일절 변경되지 않았다(`lowestRequiredRole` 추출은 기존 인라인 로직과 동치임을 소스 대조로 확인). 오히려 신설된 reflection 기반 저장소 가드(`forbidden-response-codes-guard.ts`/`.spec.ts`)가 "가드가 실제로 던질 수 있는 거부 코드가 403 문서 설명에 반드시 포함되어야 한다"는 불변식을 상시 강제하게 되어, API 계약 문서(OpenAPI)의 에러 응답 설명 일관성이 이전보다 개선되었다. 샘플 점검한 `workflow-test-datasets`, `integrations`, `workspaces` 컨트롤러 모두 역할·코드 매핑이 실제 `@Roles()` 데코레이터 및 서비스 판정과 일치했고 죽은 코드나 미사용 import 도 없었다. API 클라이언트 관점에서 이 변경으로 깨지는 것은 없다(응답 바디의 `code`/`message` 필드는 원래도 `NOT_A_MEMBER`/`EDITOR_REQUIRED` 등이었고, 이번 변경은 그 값을 Swagger 문서 설명 텍스트에 노출시켰을 뿐이다).

## 위험도
NONE
