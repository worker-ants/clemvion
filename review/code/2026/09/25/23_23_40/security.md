# 보안(Security) 리뷰 — integration-personal-owner (2라운드)

## 발견사항

새로 보고할 Critical/Warning 없음.

- **[INFO]** 1라운드 WARNING(OAuth 콜백 커밋 시점 인가 재검증 누락, TOCTOU)이 이번 라운드에서 올바르게 닫혔다 — 재발 없음 확인
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `assertRequesterStillAllowed` (private 메서드, 클래스 상단) 및 그 호출부 `handleCallback` 내부 `dataSource.transaction` 블록 (`await this.assertRequesterStillAllowed(integration, record);` 줄, 주석 `// 락을 잡은 이 시점 값으로 인가를 다시 본다 — 자격 증명을 덮어쓰기 직전이다.` 바로 다음)
  - 상세: 1라운드 리뷰(`review/code/2026/09/25/22_45_37/security.md`)가 지적한 결함은 "`begin()` 호출 직전에만 인가를 검사하고, 실제 자격 증명을 덮어쓰는 `handleCallback` 커밋 시점에는 재검증이 없어 begin↔callback 사이(state TTL, 최대 수 분) 역할이 강등돼도 재인증이 통과한다"는 것이었다. 이번 diff(`5999aedfe`)에서 `handleCallback`이 `pessimistic_write` 락으로 행을 재조회한 **직후, 자격 증명을 대입하기 전**에 `assertRequesterStillAllowed(integration, record)`를 호출하도록 고쳐졌다. 이 함수는 `isIntegrationVisibleTo`로 가시성(남의 personal → 404)을 먼저 보고, `scope === 'organization'`이면 `workspacesService.getMemberRole`로 그 시점 역할을 다시 조회해 `ADMIN_ROLES`에 없으면 403을 던진다. `workspacesService`가 없으면(수동 생성 테스트 전용 케이스) fail-closed로 거부한다. `pending_install` 행은 의도적으로 제외되는데, 그 state의 `userId`가 요청자가 아니라 설치 흐름의 생성자이기 때문이며 이는 문서화돼 있고 사용자가 `pending_install` 행에 재인증을 시작하는 입구 자체가 `begin()`에서 막혀 있다(테스트 `pending_install 행(설치 흐름)은 재판정하지 않는다`로 고정됨). `integration-oauth.service.spec.ts`에 추가된 테스트(강등 시 403, 남의 personal이 됨 시 404, 본인 personal은 역할 조회 생략, `workspacesService` 미주입 시 fail-closed 403)가 이 재검증 경로를 모두 커버한다.
  - 결론: 추가 조치 불필요. 완결성 확인 차 기재.

## 검증한 항목 (문제 없음)

- **SQL 인젝션**: `integrationVisibilityClause(alias)`는 코드베이스 전체 호출부 2곳(`integrations.service.ts:517`, `explore-tools.service.ts:173`) 모두 alias 를 하드코딩 리터럴 `'i'`로만 호출한다. 사용자 입력은 `INTEGRATION_USER_PARAM` 파라미터 바인딩으로만 전달되어 SQL 에 직접 연결되지 않는다.
- **인가 — 판정 순서**: `IntegrationsService.requireModifiable`/`requireVisible`는 "보이는가(404) → Organization 이면 Admin 인가(403)" 순서를 일관되게 지킨다. `remove()`는 인가 판정을 사용처 조회(409 정보 노출 가능 지점)보다 먼저 수행하도록 명시적으로 순서를 잡았다.
- **인가 — TOCTOU (rotate/scope 변경)**: `rotate()`는 연결 테스트(외부 호출, 수 초 소요) 이후 `pessimistic_write` 트랜잭션 안에서 행을 재조회해 `isIntegrationVisibleTo`/`assertCanModify`를 다시 검사한다. `update()`/`remove()`/`updateScope()`/`reauthorize()`의 비-oauth 리셋 분기는 `judgedRow`(id·workspaceId·**판정 근거인 scope**)를 조건으로 하는 조건부 UPDATE/DELETE로 판정-쓰기 사이 scope 변경을 compare-and-set 으로 닫는다.
- **인가 — 라우트 완결성**: `IntegrationsController`의 `:id` 핸들러 전부(`findOne`/`listUsages`/`activity`/`testConnection`/`update`/`rotate`/`reauthorize`/`requestScopes`/`updateScope`/`remove`)가 `requireVisible`/`requireModifiable`를 거치며, `integrations.controller.owner.spec.ts`가 리플렉션으로 `:id` 라우트를 전수 나열해 판정 표와 대조하는 완결성 캐너리를 둔다(새 라우트 추가 시 표에 등록 안 하면 테스트가 실패).
- **`oauth/begin`의 우회 경로 차단**: `integrationId`를 지정한 `reauthorize`/`request_scopes` 모드도 `:id/reauthorize`와 동일한 `requireModifiable` 판정을 begin 시점에 거치고, `handleCallback`이 커밋 직전에 동일 판정을 다시 본다(위 참조) — `mode: 'new'`는 `integrationId`를 state 에 저장은 하되 `handleCallback`의 `if (record.mode === 'new')` 조기 반환 경로가 이를 사용하지 않아 판정 우회 통로가 아님을 코드로 확인.
- **존재-오라클 방지**: 남의 personal 은 존재 여부와 무관하게 항상 동일한 `404 { code: 'RESOURCE_NOT_FOUND', message: 'Integration not found' }`(`throwIntegrationNotFound()` 단일 지점)이며, `updateScope`는 Admin 여부를 가시성 검사보다 먼저 확인해 비-Admin 요청자에게는 대상 존재와 무관하게 항상 동일한 403이 나간다. e2e(`integration-personal-owner.e2e-spec.ts`)가 `hidden`/`absent` 응답의 status·code·message 동일성을 실제 HTTP 레벨로 재확인한다.
- **입력 검증**: `CreateIntegrationDto.scope`/`UpdateScopeDto.scope`는 `@IsIn(['personal', 'organization'])`로 화이트리스트 검증되어 임의 문자열이 `assertCanModify`/`isIntegrationVisibleTo`의 비교 대상으로 들어갈 수 없다.
- **권한 상수 단일화**: `ADMIN_ROLES`/`ROLE_REQUIRED`/`NOT_A_MEMBER`는 `common/constants/workspace-roles.ts` 공유 상수를 이 PR 전역에서 일관되게 참조한다(과거 파일별 로컬 `ADMIN_ROLES` drift 문제를 반복하지 않음).
- **DI 배선**: `IntegrationOAuthService`의 `@Optional() workspacesService`는 실제 `IntegrationsModule`이 `WorkspacesModule`을 import 하고 `WorkspacesModule`이 `WorkspacesService`를 export 하므로 프로덕션에서는 항상 주입된다 — fail-closed 분기는 수동 생성 테스트 전용 경로다.
- **정보 노출 — precheck**: `pickPrecheckConflict`(공통 함수로 cafe24/makeshop 통합)는 충돌 자체는 항상 알리되(spec 워크스페이스 유일성 요구), 충돌 행이 남의 personal이면 `isIntegrationVisibleTo`로 `existingIntegrationId`/`existingName`을 제외한다 — 신규/구 두 서비스가 `pickPrecheckConflict` 공통 함수 하나로 합쳐져 동작이 drift 할 표면이 준 것도 확인.
- **감사 로그**: `INTEGRATION_UPDATED`/`INTEGRATION_SCOPE_CHANGED`/`INTEGRATION_ROTATED`/`INTEGRATION_REAUTHORIZED` 감사 로그의 `details`에는 자격 증명 값이 아닌 `{from, to}`/`{authType}`/`{mode}` 같은 메타데이터만 실린다.
- **하드코딩 시크릿**: e2e 신규 스펙의 `credentials: { token: 'e2e-ipo-...' }`는 테스트 픽스처 더미 값이며 실제 시크릿이 아니다.
- **문서 동기화**: `integration-management.mdx`/`.en.mdx`의 역할 표·Danger zone 설명이 이번 diff 가 구현한 정책(Viewer 는 자기 Personal 재인증/scope 요청 가능, Editor 는 자기 Personal 전권·Organization 은 조회만, scope 전환은 Admin 이상 전용)과 일치 — 사용자에게 노출되는 권한 안내가 실제 서버 판정과 어긋나 오해를 유발할 여지 없음.

## 요약

이 PR은 2라운드로, 1라운드에서 지적된 유일한 WARNING(OAuth reauthorize/request_scopes의 begin↔callback 사이 인가 재검증 누락 TOCTOU)이 `assertRequesterStillAllowed`를 `handleCallback`의 `pessimistic_write` 잠금 안, 자격 증명 대입 직전에 삽입하는 방식으로 정확히 닫혔음을 소스 레벨에서 직접 확인했다. 판정 순서(가시성 404 → Organization Admin 403), 존재-오라클 차단, compare-and-set 기반 TOCTOU 방어, `:id` 라우트 완결성 캐너리, SQL 필터링(alias 하드코딩으로 인젝션 경로 없음), 감사 로그 비민감화, DI 배선까지 전반적으로 견고하게 구현되어 있다. `getForExecution`의 가시성 미적용과 precheck/유일성 제약의 존재-노출 잔여는 spec Rationale이 명시적으로 받아들인 기존 후속 항목으로, 이번 diff의 새 결함이 아니다. 새로 보고할 Critical/Warning 없음.

## 위험도

NONE
