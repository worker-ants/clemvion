# Security Review — `User` 엔티티 컬럼 방어 (2축 검출) PR

## 발견사항

- **[CRITICAL]** 새 "구조 검출" 가드가 이름 기반이라, **이미 살아있는 `User` 전체 컬럼 유출**을 놓친다 — `GET /api/workflows/:wfId/versions/:versionId` 가 워크플로 버전 작성자(`creator`)를 `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 포함 **전체 `User` 엔티티**로 응답한다.

  - 위치(근본 원인 — 이번 diff에 포함된 신규 파일):
    `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 게이트 33-36 (`isUserRelationPath` — 관계 경로의 마지막 세그먼트가 문자열 그대로 `'user'` 인지만 본다) 및 게이트 115-126 (`relations: […]` 판정이 `ts.isArrayLiteralExpression(node.initializer)` 인 **배열 리터럴 형태만** 파싱한다).
  - 위치(실제 유출 지점 — 이번 diff 밖, 기존 코드):
    `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:73` `relations: ['creator']` (동 파일 `:67` `findOne`, `select` 없음, `:81` `return version;` 로 엔티티 그대로 반환) →
    `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts:81` `return this.workflowVersionsService.findOne(wfId, versionId);` (그대로 pass-through, DTO 변환·`ClassSerializerInterceptor`·`select` 어느 것도 없음. 전역 인터셉터는 `TransformInterceptor`(단순 `{data}` 래핑) 뿐임을 `app.module.ts:203-204` 및 해당 인터셉터 구현으로 확인).
  - 상세:
    1. `WorkflowVersion.creator` 는 `@ManyToOne(() => User)` (`workflow-version.entity.ts`) 이고, `findOne` 이 `relations: ['creator']` 로 **투영 없이** 전체 `User` 로우를 조인해 그대로 컨트롤러 반환값에 실은 뒤 HTTP 응답으로 나간다. `WorkflowVersionDto.creator` 는 `WorkflowVersionCreatorDto`(id/name/email)만 광고하지만, 이 엔드포인트를 때리는 e2e 자체가 **0건**이라(`codebase/backend/test/` 에 workflow-versions 관련 spec 없음) 선언-실체 불일치도, 유출도 지금까지 아무 테스트에 걸리지 않는다.
    2. 이번 PR 이 세우는 두 검출 축 중 어느 쪽도 이 자리를 잡지 못한다.
       - 구조 축(`user-entity-exposure-guard.ts`): `isUserRelationPath` 가 관계 **경로 문자열**이 `'user'` 인지만 확인한다. `creator`(`workflow.entity.ts`·`integration.entity.ts`·`workflow-version.entity.ts`), `owner`(`workspace.entity.ts`), `executor`(`execution.entity.ts`) 처럼 **엔티티 타입은 `User` 이지만 관계 이름이 다른** 자리는 원천적으로 스캔 대상이 아니다. 이름이 아니라 로드된 **엔티티 타입**을 봐야 하는 자리에서 이름 매칭을 썼다.
       - 게다가 배열 리터럴 형태(`relations: ['user']`)만 파싱하고, TypeORM 0.3 의 객체 형태(`relations: { user: true }`, `FindOptionsRelations`)는 아예 순회하지 않는다. 이 객체 형태는 **같은 저장소에서 실제로 쓰인다** — `workflow-versions.service.ts:54` `relations: { creator: true }`(마침 이 PR 이 다루는 `WorkflowVersionsService` 자신), `web-chat-cors-origin.resolver.ts:41` `relations: { workflow: true }`. 즉 `relations: { user: true }` 로 쓰든, 위 `:54` 의 `select: { creator: {...} }` narrowing 을 나중에 누가 지우든, 새 가드는 **회귀를 전혀 감지하지 못한다.**
       - 이름 축(`user-secret-absence.ts`/`expectNoUserSecrets`): 값을 실제로 검사하므로 이 유출 형태 자체는 잡을 수 있는 설계이지만, 이번 PR 이 이 헬퍼를 배선한 곳은 `audit-logs.e2e-spec.ts` 와 `workspace-rbac.e2e-spec.ts` (`GET /:id/members`) **둘뿐**이다. `GET /workflows/:wfId/versions/:versionId` 에는 애초에 e2e 자체가 없어 이 그물도 닿지 않는다.
    3. 노출 범위: 컨트롤러에 `@Roles()` 가 없고 `assertWorkspaceOwnership` 는 워크스페이스 소속만 확인하므로, **viewer 역할을 포함한 모든 워크스페이스 멤버**가 다른 사용자(버전 작성자, 종종 owner/admin)의 비밀번호 해시·2FA TOTP secret·2FA/WebAuthn 복구 코드·미사용 상태의 `passwordResetToken`/`emailVerifyToken`/`emailChangeToken` 을 그대로 받을 수 있다. 특히 리셋/검증/변경 토큰이 아직 유효한 상태라면 **즉시 계정 탈취**로 이어진다 — 이번 PR 이 고친 감사 로그 유출(§ CHANGELOG)과 정확히 같은 결함 클래스가 다른 엔드포인트에 그대로 남아 있다.
  - 제안:
    - 즉시: `findOne` 에 `select` 로 `creator: { id, name, email }` 투영을 추가하거나(다른 `findByWorkflow` 메서드와 동일 패턴), `relations: ['creator']` 를 제거하고 별도 매핑으로 안전한 필드만 채운다. `GET /workflows/:wfId/versions/:versionId` 를 때리는 e2e 를 신설하고 `assertMatchesContract` + `expectNoUserSecrets` 두 축을 모두 배선한다(이번 PR 이 `workspace-rbac.e2e-spec.ts` 에 한 것과 동일 패턴).
    - 가드 자체: `findUserRelationLoads` 의 판정을 이름 대조가 아니라 **관계가 실제로 가리키는 엔티티** 기준으로 넓힌다 — 최소한 저장소 내 `@ManyToOne(() => User)`/`@OneToOne(() => User)` 등으로 선언된 관계 **속성명 전체**(현재: `user`, `creator`, `owner`, `executor` — grep 으로 4개 확인)를 이름 집합으로 등재해 `isUserRelationPath` 가 그 집합과 대조하게 한다. 동시에 `relations` 판정에 `ts.isObjectLiteralExpression(node.initializer)` 분기를 추가해 `FindOptionsRelations` 객체 형태(중첩 포함)도 스캔한다. 두 수정 다음에 `user-entity-exposure.spec.ts` 베이스라인을 재실측해야 한다 — 이번 지적이 맞다면 `workflow-versions.service.ts#findOne` 이 새 위반으로 잡혀야 정상이다.

- **[INFO]** `USER_SECRET_KEYS`(`user-secret-absence.ts`)는 `user.entity.ts` 의 자격증명·토큰류 7컬럼과 정확히 일치한다(직접 대조 완료: `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`). `oauthProviderId` 는 목록에 없으나 이는 자격증명이 아니라 외부 계정 식별자라 스코프 밖으로 보인다 — 결함으로 보지 않는다.

- **[INFO]** `expectNoUserSecrets`/`findUserSecretLeaks`(`codebase/backend/src/shared/testing/user-secret-absence.ts`)는 `tsconfig.build.json` 의 `src/shared/testing/**` 빌드 제외 대상이라 프로덕션 번들에는 실리지 않는다 — 런타임 노출 경로 없음, 테스트 전용으로 안전하게 격리돼 있다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신설(§5.4 기본형, `nullable: true` + non-optional)은 wire 를 바꾸지 않는 순수 선언 보강이고, `WorkspacesService.listMembers` 가 이미 무조건 `joinedAt: m.joinedAt` 을 싣고 있었다는 서술과도 일치한다. 보안 영향 없음.

- **[INFO]** `workspace-rbac.e2e-spec.ts` 의 신규 테스트 F(`GET /:id/members`)는 이름 축(`expectNoUserSecrets`)을 계약 축(`assertMatchesContract`)보다 **먼저** 실행하도록 순서를 명시적으로 고정했고 그 근거(계약 대조가 먼저면 이름 축이 관측되지 못한다는 실측)를 주석에 남겼다 — 두 검증축이 서로를 가리지 않게 하는 좋은 패턴이다. 결함 아님.

## 요약

이번 PR 은 `GET /api/audit-logs` 유출(감사 로그가 `User` 26키를 통째로 내보낸 사고)을 계기로 `User` 전체 로드를 잡는 정적 AST 가드와, 응답 본문을 이름으로 깊이 훑는 런타임 부재 단언을 신설해 "구조가 생기는 순간 잡는다"는 검출망을 세운다. 두 축의 설계 의도와 개별 테스트 품질(대조군 fixture, 순서 의존성 검증, 접미 번호로 키 충돌 방지 등)은 견고하다. 그러나 구조 축의 핵심 술어(`isUserRelationPath`)가 **관계의 실제 타입이 아니라 이름 문자열 `'user'`** 만 매칭하고, `relations` 판정이 **배열 리터럴 형태만** 파싱해 TypeORM 0.3 의 객체 형태(`FindOptionsRelations`, 같은 저장소의 `workflow-versions.service.ts` 자신이 이미 사용 중)를 놓친다. 이 두 사각지대의 실측 사례로, `WorkflowVersionsService.findOne`(`relations: ['creator']`, 투영 없음)이 `GET /api/workflows/:wfId/versions/:versionId` 를 통해 워크플로 버전 작성자의 비밀번호 해시·2FA secret·복구 코드·계정 탈취용 토큰 전체를 임의 워크스페이스 멤버(viewer 포함)에게 그대로 노출하고 있음을 확인했다 — e2e 커버리지가 전혀 없어 계약 축도 이름 축도 이 자리를 건드리지 않는다. 이는 이번 PR 이 고치려는 것과 동일한 결함 클래스가 검출망 신설 시점에 이미 그물 밖에 살아있는 경우이므로, 가드의 술어를 엔티티 타입 기준(또는 최소한 알려진 별칭 집합 `user/creator/owner/executor`)으로 넓히고 객체 리터럴 `relations` 파싱을 추가한 뒤, 해당 엔드포인트를 즉시 투영하고 e2e 로 봉인하는 후속 조치가 필요하다.

## 위험도

CRITICAL
