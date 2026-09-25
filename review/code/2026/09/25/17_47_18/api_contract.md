# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 경로 워크스페이스 라우트의 403 코드 변경은 wire-contract 상 breaking change 다 — 비멤버가 Admin/Owner 요구 라우트에서 받던 `ADMIN_REQUIRED`/`OWNER_REQUIRED`(혹은 서비스의 구 `FORBIDDEN`)가 `NOT_A_MEMBER` 로 바뀐다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `assertMember`(전체 파일 컨텍스트 209~230행) · `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`assertAdmin` 942~948행 부근) · `codebase/backend/test/workspace-rbac.e2e-spec.ts`(414~425행, outsider 케이스가 `ADMIN_REQUIRED`→`NOT_A_MEMBER` 로 바뀌었음을 직접 단언)
  - 상세: `spec/5-system/2-api-convention.md` §Overview 는 "소비자는 웹 프런트엔드 하나가 아니다. 외부 연동(EIA)·웹훅·생성된 SDK 가 같은 계약을 읽는다" 고 명시한다. 이번 변경은 `@Roles()` 가 붙은 **모든** 라우트(실측 editor 66·admin 9·owner 7·viewer 5)에서 헤더 위조·경로·부재 워크스페이스 거부의 wire 코드를 일괄 재정의한다 — 상태 코드(403)는 그대로지만 `code` 필드로 분기하는 클라이언트(에러 코드 기반 UX 분기, 자동화 스크립트, 문서화된 통합)는 침묵 회귀를 겪을 수 있다.
  - 이 결정은 `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드" 에서 대안(가)·(나)를 실측과 함께 비교하고 (나)를 명시적으로 채택한 것으로, 설계상 결함이 아니라 **의도된 트레이드오프**다. 다만 API-계약 리뷰 관점에서는 "code 값에 의존하는 하위 호환성 계약이 깨졌다"는 사실 자체는 남는다 — frontend 는 함께 조율됐다고 문서에 적혀 있으나, 이 세션의 diff 범위(`codebase/**` 28개)에는 frontend 소비 지점 변경이 포함되지 않아 이 리뷰만으로는 frontend/외부 소비자 동기화 여부를 직접 확인할 수 없다.
  - 제안: 새로 남지 않는다면 그대로 두어도 되나, 이 API 를 구독하는 외부 문서(Swagger 에 노출되는 `code` enum, 있다면 changelog/버전 고지)에 "2026-09-25 부로 비멤버 응답 코드가 라우트 요구 역할과 무관하게 `NOT_A_MEMBER` 로 통일됨"을 명시적으로 announce 했는지 확인 권장. (기존 3라운드 RESOLUTION 에서 이미 다뤄졌다면 재조치 불필요 — 이 항목은 새 지적이 아니라 계약 변경 사실의 재확인 차원.)

- **[INFO]** `POST /api/workspaces/:id/transfer-ownership` 의 실제 HTTP 상태(201)와 Swagger 문서(200) 불일치 — 이번 diff 로 새로 생긴 문제가 아니다.
  - 위치: `codebase/backend/test/workspace-path-guard.e2e-spec.ts` 253~255행 (주석에서 "OpenAPI 는 200 을 광고한다(기존 불일치, 트래커 등재)" 라고 스스로 명시)
  - 상세: 이번 라운드 diff 는 이 불일치를 만들지 않았고 이미 별도 트래커에 등재되어 있다고 코드 주석이 밝힌다. 회귀가 아니므로 이 리뷰에서 차단 사유로 삼지 않는다.
  - 제안: 조치 불필요(참고만). 별도 트래커 항목으로 이미 존재.

- **[INFO]** 소문자 레거시 코드 `admin_required`(`workspace-invitations.service.ts` `assertAdmin`)는 이제 HTTP 경로로 도달 불가 — `RolesGuard` 의 `@Roles('admin')` 이 먼저 대문자 `ADMIN_REQUIRED` 를 낸다.
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` `assertAdmin` 바로 위 docstring(532~538행 부근)
  - 상세: `spec/conventions/error-codes.md` (78행)가 이 정확한 시나리오를 이미 반영해 "2026-09-25 이후 `admin_required` 는 HTTP 로 나가지 않는다"고 갱신돼 있다 — 문서·구현·테스트(서비스 spec)가 모두 일치한다. 결함 아님, 확인 목적으로만 기록.

## 점검 관점별 요약

1. **하위 호환성**: 위 WARNING 1건(비멤버 응답 코드 변경) 외에는 breaking change 없음. `@WorkspaceParam` 도입으로 `PATCH/DELETE /workspaces/:id/*` 다수 라우트에 신규 `@Roles()` 가 붙었으나, 기존에도 서비스 계층이 같은 요구를 강제했으므로 **정상 클라이언트 동작에는 영향 없음**(요구 역할·거부 상태코드 동일, `roles.guard.spec.ts`·`workspace-rbac.e2e-spec.ts`로 검증됨). `switchWorkspace` 가 header-first 에서 경로-only 판정으로 바뀐 것도 Swagger `description` 이 함께 갱신됐다.
2. **버전 관리**: 이 프로젝트는 URL 버저닝을 쓰지 않는 정책(`spec/5-system/2-api-convention.md` §1)이며 이번 변경은 그 정책과 무관. 해당 없음.
3. **응답 형식**: 에러 응답이 `{ code, message }` 로 일관되며, 이번 변경 후에도 동일 형식 유지. `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 4개 코드가 `common/constants/workspace-roles.ts` 단일 소스에서 파생되어 guard·서비스 두 계층이 동일 문구를 낸다 — 이전엔 두 계층이 각자 다른 상수를 유지해 드리프트 위험이 있었는데 이번 변경이 그 위험을 없앤다(긍정적).
4. **에러 응답**: HTTP 상태 코드(400/403/404)는 그대로 유지되고 코드 필드만 정밀화됨. `@WorkspaceParam` 이 `ParseUUIDPipe` 를 내장해 형식 오류는 400, 형식은 맞지만 미가입/부재 워크스페이스는 403 으로 정확히 분리된다(e2e `workspace-path-guard.e2e-spec.ts` 로 검증). Swagger `@ApiForbiddenResponse` 설명도 모든 변경 라우트에서 갱신됨.
5. **요청 검증**: `@WorkspaceParam('id')` 가 `ParseUUIDPipe` 를 강제 내장해 이전에 라우트마다 수기로 붙이던 `@Param('id', ParseUUIDPipe)` 누락 위험을 구조적으로 제거. `WORKSPACE_ROLES`(DTO enum)와 `WORKSPACE_ROLE_LEVEL`(가드 서열)의 일치는 `workspace-roles.spec.ts` 가 상호 assert 해 드리프트를 막는다.
6. **URL/경로 설계**: 변경 없음, 기존 RESTful 구조(`/workspaces/:id/...`) 그대로. 새 데코레이터는 바인딩 방식만 바꿀 뿐 경로 자체는 불변.
7. **페이지네이션**: 이번 diff 범위에 페이지네이션 대상 목록 API 변경 없음. 해당 없음.
8. **인증/인가**: 이번 변경의 핵심 — 경로 파라미터로 워크스페이스를 받는 15개 라우트(`workspaces.controller.ts` 14 · `auth.controller.ts` 전환 1)가 종전엔 가드가 보지 못하고 서비스 계층에만 의존했는데(`transferOwnership` 은 심지어 가드가 **헤더·토큰** 워크스페이스를 오판정했다), 이제 `RolesGuard` 가 경로 값을 인가 대상으로 보고 멤버십을 매 요청 조회한다. 서비스 계층 검사는 "가드 인식이 깨졌을 때의 두 번째 선"으로 의도적으로 남겨 defense-in-depth 를 유지한다. `workspace-param-binding` 저장소 가드가 향후 `@Param(workspaceId)` 회귀를 CI 에서 fail-closed 로 차단하고, 부트 캐너리(`workspace-reflection-canary.ts`)가 reflection 파손 시 기동을 멈춘다. 설계 완결성이 높다.

## 요약

경로 파라미터로 워크스페이스를 받는 15개 라우트의 인가를 서비스 계층 단독에서 전역 `RolesGuard` 로 승격시키고, 멤버십·역할 거부 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)를 가드·서비스 두 계층이 공유하는 단일 상수 테이블(`workspace-roles.ts`)로 통합한 변경이다. `@WorkspaceParam` 데코레이터가 `ParseUUIDPipe` 를 구조적으로 내장하고, 정적 저장소 가드와 부트 캐너리가 향후 회귀(평범한 `@Param` 재도입, reflection 파손)를 fail-closed 로 막는 등 설계 완결성이 높다. e2e(`workspace-path-guard.e2e-spec.ts`)가 상태 코드·에러 코드·existence-oracle 폐쇄까지 직접 검증한다. 유일하게 짚을 지점은 비멤버가 Admin/Owner 라우트에서 받던 `ADMIN_REQUIRED`/`OWNER_REQUIRED` 가 `NOT_A_MEMBER` 로 일괄 바뀌는 wire-contract 변경인데, 이는 `spec/data-flow/12-workspace.md` §Rationale 에서 대안과 함께 명시적으로 채택된 트레이드오프이고 코드 필드에만 국한(HTTP 상태·응답 스키마는 불변)되므로 CRITICAL 로 볼 사안은 아니다. `transferOwnership` 의 201/200 Swagger 불일치는 이번 diff 이전부터 있던 별도 트래커 항목이라 회귀가 아니다. 이번 라운드에서 새로 도입된 CRITICAL 급 API 계약 결함은 발견하지 못했다.

## 위험도

LOW
