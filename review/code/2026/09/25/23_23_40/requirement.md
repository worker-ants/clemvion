# 요구사항(Requirement) 충족 리뷰 — Personal 통합 소유자 강제

## 발견사항

- **[WARNING]** 콜백 커밋 직전 재판정(`assertRequesterStillAllowed`)의 403 메시지가 실제 동작(`request_scopes`)과 무관하게 항상 "reauthorize" 문구로 고정돼 있다.
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:426` (게이트 번호 기준 — `message: 'Admin role is required to reauthorize organization-scope integrations'`, 함수 `assertRequesterStillAllowed`)
  - 상세: `spec/2-navigation/4-integration.md` §8 판정 규칙은 "거부는 `403 ADMIN_REQUIRED` — 라우트 가드의 역할 거부와 같은 코드에 **동작별 문구**를 싣는다" 라고 명시한다. `IntegrationsService.assertCanModify`(`integrations.service.ts`)는 실제로 `` `Admin role is required to ${action} organization-scope integrations` `` 로 동작별 문구를 싣지만(예: `modify`/`rotate`/`create`/`reauthorize`), `IntegrationOAuthService.assertRequesterStillAllowed`는 `record`(`{ workspaceId, userId }`)에 `mode` 를 아예 받지 않아 `request_scopes` 콜백이 커밋 직전 Organization·비Admin 으로 거부될 때도 메시지가 "reauthorize" 로 고정 출력된다. 함수 docstring 자체가 "사용자가 시작한 재인증 · **scope 추가**는 커밋 직전에 인가를 다시 본다"라고 두 동작을 명시하고 있어 의도와 메시지 문구가 어긋난다. 에러 **코드**(`ADMIN_REQUIRED`)는 두 모드 모두 올바르므로 클라이언트 분기(코드 기반)에는 영향이 없고, 사람이 읽는 message 문자열에만 영향이 있다.
  - 이 경로는 유닛테스트로도 커버되지 않는다 — `integration-oauth.service.spec.ts` 의 "Organization 통합 — 요청자가 그 사이 %s 가 됐으면 403 ADMIN_REQUIRED" 케이스는 `stateOf('reauthorize')` 만 쓰고 `request_scopes` 모드로는 이 403 분기를 검증하지 않는다(404 케이스만 두 모드 `it.each` 로 검증).
  - 제안: `record` 에 `mode`(또는 action)를 실어 `assertRequesterStillAllowed` 도 `assertCanModify` 와 같은 동작별 문구 템플릿을 쓰게 하고, `request_scopes` 모드로 403 을 검증하는 유닛테스트를 추가한다.

- **[INFO]** `spec/2-navigation/4-integration.md` §8 "아직 강제되지 않는 것" 에 이미 문서화된 잔여 갭(노드 실행 시점 판정, `pending_install` 재사용의 생성자 미확인, Viewer 의 자기 personal 생성·수정·rotate·삭제, 상세 화면 버튼 미가림)은 이번 PR 범위 밖이며 `plan/in-progress/integration-personal-owner-followup.md` 로 추적되고 있어 이번 diff 의 결함이 아니다. 코드(`integrations.controller.ts` 의 `@Roles('editor')` 부착 현황 — `create`/`update`/`rotate`/`remove` 만 Editor 가드, `reauthorize`/`requestScopes`/`updateScope` 는 가드 없음)를 실제로 확인한 결과 followup plan 의 서술과 정확히 일치한다.

## 점검 상세 (문제 없음 확인)

- **기능 완전성 / 상태 전이**: `pickPrecheckConflict`(cafe24·makeshop 공용화), `IntegrationsService.requireVisible`/`assertCanModify`/`requireModifiable`/`judgedRow`, `IntegrationOAuthService.assertRequesterStillAllowed` 가 spec §8 판정 규칙(보이는가→404, Organization 이면 Admin→403)을 모든 `:id` 경로·`oauth/begin`(`reauthorize`/`request_scopes`/`request-scopes` 세 표기 모두)·precheck 두 엔드포인트·워크플로우 어시스턴트(`list_integrations`, `integration-selector`, `mcp-server-selector`)에 일관 적용한다. `IntegrationsController.oauthBegin` 의 `modifyActionOfBeginMode` 는 `never` 분기로 새 mode 추가 시 컴파일 차단 — 완결성 보장.
- **동시성/락**: `judgedRow` 로 조건부 UPDATE/DELETE(`scope` 를 WHERE 절에 포함)해 판정-쓰기 사이 TOCTOU(personal→organization 전환 등)를 compare-and-set 으로 닫는다. `rotate` 는 `pessimistic_write` 락 안에서 가시성·Admin 을 재판정한다. `handleCallback` 은 `pessimistic_write` 락을 잡은 시점 값으로 `assertRequesterStillAllowed` 를 호출해 begin↔콜백 사이(state TTL 윈도)의 강등·소유권 변경을 막는다.
- **에러 코드 승격**: spec §8 이 명시한 "2026-09-25 이전 FORBIDDEN 이었던 4곳(생성·rotate·request-scopes·scope 전환)" 이 diff 에서 정확히 `ADMIN_REQUIRED` 로 승격됐고, `update`(별칭 수정)·`remove`(삭제) 는 이전에 Organization Admin 판정이 전무했던 것을 이번에 신규로 추가한 것으로 실측(diff 전/후 비교) 확인 — spec 테이블("수정(별칭)/삭제 = Admin 이상")과 e2e(`Organization 통합 — Editor 의 이름 변경·삭제는 403 ADMIN_REQUIRED`)가 일치한다.
- **가시성 SQL**: `integrationVisibilityClause` 의 컬럼명(`scope`, `created_by`)이 `Integration` 엔티티의 실제 컬럼 매핑과 일치함을 엔티티 파일로 직접 확인했다.
- **DI 배선**: `IntegrationOAuthService` 의 `@Optional() workspacesService?: WorkspacesService` 가 `IntegrationsModule` → `WorkspacesModule`(`@Global`, `exports: [WorkspacesService]`) 경로로 정상 주입됨을 모듈 파일로 확인 — "역할 조회 불가 시 fail-closed" 경로가 프로덕션에서 우발적으로 상시 발동하는 배선 결함은 없다.
- **테스트 커버리지**: unit(서비스 5개 파일 · 컨트롤러 신규 완결성 캐너리 `integrations.controller.owner.spec.ts` · `integration-visibility.spec.ts`) + e2e(`integration-personal-owner.e2e-spec.ts`, Owner·Admin·Editor·Viewer 4액터) + 뮤테이션 표(plan 문서, P1~P20·R1~R9 전부 KILLED, 최초 SURVIVED 3건(P13·P18·P19)도 테스트 보강 후 KILLED)로 뒷받침됨. 리플렉션 기반 `:id` 라우트 전수 캐너리가 새 라우트 판정 누락을 구조적으로 방지.
- **문서(spec/mdx) 일치**: `spec/2-navigation/4-integration.md` §8·§9.2·§9.4, `spec/3-workflow-editor/4-ai-assistant.md` §4.1·§4.3.1, `spec/5-system/3-error-handling.md`(`ADMIN_REQUIRED` 행), `spec/5-system/1-auth.md` §3.2 RBAC 표가 모두 이 PR 의 구현과 line-level 로 일치 — SPEC-DRIFT 없음(spec 이 같은 변경 세트로 이미 갱신되어 있음). 사용자 가이드 mdx(en/ko) 의 역할별 설명(Viewer 가 자기 personal 을 reauthorize/scope 요청 가능, Editor 는 자기 personal 생성/수정/rotate 가능하지만 Organization 은 조회만, Admin/Owner 만 scope 전환)도 실제 `@Roles` 라우트 가드 배치와 대조해 정확함을 확인했다.
- **엣지 케이스**: 빈 배열(precheck rows.length===0 → conflict:false), priority 밖 transitional status(fallback, status 필드 omit), pending_install 행의 재판정 제외, 본인 personal 은 역할 조회 스킵 등이 spec·테스트로 모두 커버된다.

## 요약

이번 diff(백엔드 22 + 프런트 mdx 2 파일)는 spec §8 "Personal 통합 소유자 강제" 규칙을 목록·`:id` 경로·`oauth/begin`·precheck·워크플로우 어시스턴트 전면에 일관되게 구현하며, 판정-쓰기 TOCTOU·begin↔콜백 사이 강등 등 동시성 엣지 케이스까지 compare-and-set·락 재판정으로 닫았다. spec·에러 코드·RBAC 표·사용자 가이드 문서가 모두 line-level 로 구현과 일치하고, 뮤테이션 테스트·e2e·리플렉션 완결성 캐너리로 뒷받침되어 요구사항 충족도가 매우 높다. 유일하게 발견된 결함은 커밋 직전 재판정 실패 메시지가 `request_scopes` 모드에서도 "reauthorize" 로 고정 출력되는 사소한 문구 불일치(에러 코드는 정상)이며, 기능적 영향은 없으나 spec §8 이 명시한 "동작별 문구" 요건과는 어긋난다.

## 위험도

LOW
