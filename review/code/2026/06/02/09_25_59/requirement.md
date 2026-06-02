# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [WARNING] `mode='new'` + `integrationId` 있는 state row 에서 invalid_scope 를 받으면 integrationId 가 not null 이므로 save 가 호출되지만, 해당 state 가 mode='new' 인 경우 spec §10.4 의 "status 보존" 정책이 `pending_install` / `connected` 이외 상태(최초 new 등록 시 integration 이 아직 없는 경우 등)에도 동일하게 적용되는지 코드가 별도로 검증하지 않는다. 테스트의 `makeStateRow()` 는 `mode: 'new'` 이면서 `integrationId: 'int-iscope'` 를 설정하는데, spec §10.4 에서 `invalid_scope` 의 "status 보존"은 `pending_install` / `connected` 케이스만 명시하고 있다. 이 조합이 실제로 가능한 시나리오인지 spec 이 침묵하고 있다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` `makeStateRow()` + 첫 번째 테스트 케이스 (line 2333–2334, `mode: 'new'`, `integrationId: 'int-iscope'`)
  - 상세: `mode='new'` 에서 `integrationId` 가 채워진 state 는 일반 OAuth flow 에서 발생하지 않는다 — `new` mode 는 최초 등록이라 아직 `integrationId` 가 없다. 테스트 픽처가 현실에 없는 조합을 사용하고 있어 테스트가 검증하는 시나리오가 실제 운영 경로와 다를 수 있다. 운영에서 발생 가능한 경로는 `mode='reauthorize'` + `status='pending_install'` (Cafe24 Private 초기 install) 또는 `mode='reauthorize'` + `status='connected'` 이다.
  - 제안: `makeStateRow()` 의 `mode` 를 `'reauthorize'` 로 수정하거나, 의도적으로 `new` + integrationId 조합을 사용하는 이유를 주석에 명시한다.

### [WARNING] `connected` reauthorize 케이스 테스트에서 `requiresCafe24Approval` 필드를 `mall.write_privacy` 로 설정했을 때 `pickRestrictedApprovalScopes` 가 이를 실제로 restricted 로 분류하는지 단위 테스트가 직접 검증하지 않는다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` line 141 (`requestedScopes: ['mall.write_privacy']`)
  - 상세: 이 테스트는 `dataSource.query` mock 이 state row 를 반환하고, `rejectCafe24InvalidScope` 가 실제 `pickRestrictedApprovalScopes` 를 호출한다. `mall.write_privacy` 가 `SCOPE_LEVEL_RESTRICTED_SCOPES` 에 포함되어 있는지는 `restricted-approval.ts` 의 구현에 의존하는데, 통합 테스트 레벨에서 이 연결이 끊어지면 빈 `requiresCafe24Approval` 가 반환되고 테스트가 실패한다. 이는 실제로 잘 연결되어 있으나 (`mall.write_privacy` = `mall.write_${privacy}` 가 `SCOPE_LEVEL_RESTRICTED_SCOPES` 에 포함됨), 명시적 단위 테스트가 없어 추후 `restricted-approval.ts` 변경 시 회귀 위험이 있다.
  - 제안: 현재 구조는 수용 가능하나, `restricted-approval.ts` 자체에 `mall.write_privacy` 등 경계값 단위 테스트 추가를 권장한다.

### [INFO] `handleCallbackWithErrorCapture` 의 `extra` 전달 로직에서 `ctx.requiresCafe24Approval.length > 0` 체크가 `markIntegrationCallbackError` 내부의 동일 체크와 중복된다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/backend/src/modules/integrations/integration-oauth.service.ts` line 790–793
  - 상세: `handleCallbackWithErrorCapture` 에서 `ctx.requiresCafe24Approval.length > 0` 일 때만 `extra` 를 비-undefined 로 만들고, `markIntegrationCallbackError` 내부 (line 852) 에서도 `extra.requiresCafe24Approval.length > 0` 체크를 다시 한다. 중복 체크이지만 Defence-in-depth 관점에서는 무해하다.
  - 제안: 기능적 문제는 없다. 주석으로 의도를 명시하는 것으로 충분.

### [INFO] 테스트 `'이미 소비된 state → row context 없이 OAUTH_INVALID_SCOPE throw, save 미호출'` 에서 `state: 'gone'` 을 사용하지만 `query.state` 가 truthy 여야 `rejectCafe24InvalidScope` 분기로 진입한다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` line 164–176
  - 상세: `handleCallback` 에서 `query.state` 가 있어야 `rejectCafe24InvalidScope` 가 호출된다. `state: 'gone'` 은 truthy 이므로 올바르다. mock 이 `[[], 0]` 을 반환해 consumed 배열이 비어있으므로 integrationId context 없이 throw 하는 경로를 잘 커버한다. 기능적으로 이상 없음.
  - 제안: 없음.

### [INFO] Spec §10.4 에서 `invalid_scope` 시 spec §1 (scope-level) 과의 교집합을 `requiresCafe24Approval` 로 기록한다고 명시되어 있으나, 구현은 `pickRestrictedApprovalScopes` 가 `SCOPE_LEVEL_RESTRICTED_SCOPES` 만 참조하고 §2 (operation-level store) 항목은 제외한다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` line 79–88
  - 상세: spec §10.4 는 "요청 scopes ∩ cafe24-restricted-scopes.md §1 의 교집합" 이라고 명시하고 있어 §2 (operation-level) 을 별도로 제외하는 것이 spec-conformant 하다. §2 항목은 scope 자체가 일반 사용 가능(`mall.read_store`/`mall.write_store`)이라 교집합에 포함되지 않는 것이 맞다. 구현이 spec 과 정확히 일치한다.
  - 제안: 없음. 확인용 INFO.

### [INFO] `scope-tab.tsx` 의 새 섹션은 `statusReason === 'oauth_invalid_scope' && requiresApprovalFromError.length > 0` 를 gate 조건으로 사용하는데, `requiresApprovalFromError` 가 비어있고 `statusReason === 'oauth_invalid_scope'` 인 경우(restricted 교집합이 없는 invalid_scope) 섹션이 렌더링되지 않는다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` line 1527–1536
  - 상세: spec §10.4 / cafe24-restricted-scopes.md §4.3 은 교집합이 비어있으면 `details` 를 omit 하도록 명시하고 있다 (`last_error.details` 가 없으면 `requiresApprovalFromError = []`). 따라서 이 조건은 spec-conformant 하다. 그러나 이 경우 사용자에게는 `OAUTH_INVALID_SCOPE` 에러가 발생했지만 UI 안내가 없을 수 있다. spec 이 이 시나리오에서의 UI 표시를 명시하지 않으므로 회색지대.
  - 제안: spec `project-planner` 에 위임 — `oauth_invalid_scope` + 비-restricted scope 교집합 케이스의 UI 안내 명시 여부 확인 필요.

## 요약

변경된 코드는 spec/2-navigation/4-integration.md §10.4 와 spec/conventions/cafe24-restricted-scopes.md §4.3 이 명세한 기능을 전체적으로 충족한다. 핵심 플로우인 `invalid_scope` callback → state 소비 → `OAUTH_INVALID_SCOPE` throw + context attach → `markIntegrationCallbackError` → `statusReason='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval` 기록 → status 보존 경로가 구현 코드와 테스트 모두에서 검증된다. `connected` reauthorize + `pending_install` 양 케이스가 커버된다. 테스트 픽처에서 `mode='new'` + `integrationId` 조합을 사용하는 것이 현실 시나리오와 다소 괴리가 있으며, `scope-tab.tsx` 에서 restricted 교집합 없이 `oauth_invalid_scope` 만 있는 케이스의 UI 미표시가 spec 에서 명시되지 않은 회색지대로 남아있다.

## 위험도

LOW
