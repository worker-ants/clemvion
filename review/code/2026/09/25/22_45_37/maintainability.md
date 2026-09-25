# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 컨트롤러에 `resolveRole()` + 위임 3줄 블록이 8곳에서 동일하게 반복된다(이번 PR이 4곳을 새로 추가해 기존 4곳과 합쳐 총 8곳)
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:226-238`(`oauthBegin` 신규), `:437-441`(`create`, 기존), `:462-472`(`update`, 신규), `:520-530`(`rotate`, 기존), `:552-561`(`reauthorize`, 신규), `:586-596`(`requestScopes`, 기존), `:619-629`(`updateScope`, 기존), `:650-654`(`remove`, 신규)
  - 상세: 모든 핸들러가 `const role = await this.integrationsService.resolveRole(workspaceId, user.sub); return this.integrationsService.<method>(id, workspaceId, user.sub, role, ...)` 형태를 그대로 복사한다. `oauthBegin`의 새 `if (mode !== 'new' && body.integrationId)` 블록도 같은 3줄을 인라인으로 한 번 더 반복한다. 새 `:id` 변경 경로가 추가될 때마다 이 블록을 손으로 복사해야 하고, `resolveRole` 시그니처가 바뀌면 8곳을 함께 고쳐야 하는 shotgun-surgery 위험이 있다.
  - 제안: 컨트롤러에 `private async withRole<T>(workspaceId, user, fn: (role) => Promise<T>)` 같은 헬퍼를 두거나, `resolveRole` 호출 자체를 서비스 메서드 내부(이미 `workspaceId`·`userId`를 받으므로)로 옮겨 컨트롤러가 role 을 몰라도 되게 하는 편이 반복을 없앤다.

- **[WARNING]** 같은 "요청자(가시성 판정 대상)" 개념이 서비스마다 `userId`/`viewerId`로 다르게 명명되어 있다
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts:12-17`(`isIntegrationVisibleTo(row, userId)`), `codebase/backend/src/modules/integrations/integrations.service.ts:630-641`(`requireVisible(id, workspaceId, userId)`) — 이 두 곳은 `userId`. 반면 `codebase/backend/src/modules/integrations/integration-oauth.service.ts:346-360`(`pickPrecheckConflict(rows, viewerId)`), `:1935-1943`(`precheckMakeshopShop(..., viewerId)`), `:2135-2141`(`precheckCafe24Mall(..., viewerId)`)은 정확히 같은 값(컨트롤러의 `user.sub`)을 `viewerId`로 부른다.
  - 상세: 컨트롤러(`integrations.controller.ts`)는 두 서비스 모두에 `user.sub`를 위치 인자로 넘기므로 타입 에러는 나지 않지만, 같은 PR·같은 기능(§8 판정)에서 파라미터 이름만 다르면 호출 체인을 따라가며 읽는 사람이 "이게 같은 개념인지" 매번 되짚어야 한다. `integration-oauth.service.ts`는 기존에도 다른 의미의 `userId`(OAuth 세션 시작자, 라인 81·252·304 등)를 이미 쓰고 있어 이름 충돌을 피하려 `viewerId`를 택한 것으로 보이나, 그 선택의 이유를 설명하는 주석이 없어 의도적 구분인지 실수인지 구별되지 않는다.
  - 제안: `viewerId` 채택 이유를 `pickPrecheckConflict` JSDoc에 한 줄 추가하거나, 전역적으로 "가시성 판정에 쓰는 요청자"를 가리키는 이름을 하나로 통일(예: 항상 `viewerId`이거나 항상 `userId`)해 두 서비스 간 인지 부담을 줄인다.

- **[INFO]** `Integration.scope`가 여전히 `string`이라, 이번 PR이 추가한 리터럴 비교(`'personal'`/`'organization'`)가 컴파일 타임 보호 없이 늘었다
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts:16`(`row.scope !== 'personal'`), `codebase/backend/src/modules/integrations/integrations.service.ts:653`(`row.scope === 'organization'`)
  - 상세: `codebase/backend/src/modules/integrations/entities/integration.entity.ts:50`의 `scope: string` 선언은 이번 PR 이전부터 있던 상태라 이 PR의 결함은 아니지만, PR이 같은 문자열 리터럴에 의존하는 비교 지점을 두 곳 더 늘렸다. 오타(`'Personal'`, `'orgnization'` 등)가 나도 컴파일러가 잡아주지 않는다.
  - 제안: 이번 PR 범위는 아니지만 후속으로 `type IntegrationScope = 'personal' | 'organization'`을 엔티티·DTO·이 두 헬퍼에 도입하는 것을 고려.

- **[INFO]** `create()`의 조직 스코프 거부 메시지가 `assertCanModify`가 쓰는 것과 같은 문구 패턴(`Admin role is required to <verb> organization-scope integrations`)을 별도 리터럴로 반복한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:707-711`(`this.throwAdminRequired('Admin role is required to create organization-scope integrations')`) vs `:648-658`(`assertCanModify`가 생성하는 `` `Admin role is required to ${action} organization-scope integrations` ``)
  - 상세: `create`는 아직 존재하지 않는 행을 다루므로 `assertCanModify(row, ...)`를 그대로 재사용할 수 없어 별도 인라인 문자열을 쓴 것으로 보이나, 두 문구가 같은 템플릿을 손으로 두 번 유지하는 모양이 됐다. `IntegrationModifyAction`에 `'create'`를 추가하고 메시지 생성 로직만 분리하면 드리프트 위험이 줄어든다(이 파일은 과거에도 같은 리터럴이 여러 곳에 흩어져 있었다가 `throwIntegrationNotFound`로 한 번 통합한 이력이 주석에 남아 있다 — 같은 패턴의 재발).
  - 제안: 급하지 않음. 다음에 이 메시지를 고칠 일이 생기면 통합을 고려.

## 긍정적인 점 (참고)

- `pickPrecheckConflict`(신규, `integration-oauth.service.ts:346-360`)가 `precheckCafe24Mall`/`precheckMakeshopShop`에 거의 동일하게 존재하던 priority-loop + fallback 로직을 하나로 합쳐, 실제로 중복을 줄였다.
- `assertCanModify`/`throwAdminRequired`/`requireVisible`/`requireModifiable`(`integrations.service.ts:630-678`)로의 추출은 이전에 4곳에 흩어져 있던 `ForbiddenException`/`NotFoundException` 인라인 생성을 통합했고, 각 함수가 짧고 단일 책임을 유지한다.
- `isIntegrationVisibleTo`(TS)와 `integrationVisibilityClause`(SQL)의 의도적 중복은 JSDoc에서 "같은 규칙의 두 표현이라 함께 둔다"고 명시적으로 근거를 밝혀, 실수로 보이지 않는다.
- `integrations.controller.ts`의 `FORBIDDEN_*`/`NOT_FOUND_INTEGRATION` 상수 추출은 이전에 각 `@ApiForbiddenResponse`마다 흩어져 있던 하드코딩 한국어 문자열을 코드 상수의 `.code` 보간으로 바꿔, 코드명 변경 시 문서가 따라오게 했다.

## 요약

이번 PR은 Personal/Organization 통합 가시성·인가 판정을 여러 서비스에 걸쳐 `userId`/`viewerId` 파라미터로 관통시키는 보안 수정으로, 규모가 크지만(22개 파일) 실제로는 방어적 리팩토링(`pickPrecheckConflict`, `assertCanModify`/`requireVisible` 추출)을 통해 기존에 존재하던 중복을 오히려 줄였다. 새로 발견된 문제는 심각하지 않다 — 컨트롤러의 `resolveRole` 보일러플레이트가 8곳으로 늘어난 점과, 같은 개념에 `userId`/`viewerId` 두 이름을 섞어 쓴 점이 가장 눈에 띄는 유지보수성 저하 요인이며, 둘 다 국소적 리팩토링으로 쉽게 정리 가능한 수준이다. 함수 길이·중첩 깊이·매직 넘버 측면에서는 새로 추가된 코드 대부분이 짧고 단일 책임을 유지했다.

## 위험도

LOW
