# Testing 관점 코드 리뷰

## 발견사항

### [INFO] 테스트 존재 여부 — 5개 케이스로 신규 분기 적절히 커버

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` L40–189
- 상세: `handleCallbackWithErrorCapture — cafe24 invalid_scope` describe 블록이 5개 케이스를 포함한다. (1) `pending_install` → status 보존 + `statusReason=oauth_invalid_scope` + `requiresCafe24Approval`, (2) restricted 교집합 없을 때 `details` 생략, (3) `connected` reauthorize → status 보존, (4) 이미 소비된 state → context 없이 throw, (5) `access_denied` 등 다른 error → 기존 `OAUTH_DENIED` 회귀. 핵심 경로를 모두 포함한다.
- 제안: 없음.

---

### [INFO] 기존 테스트 회귀 — `markIntegrationCallbackError` 5번째 인자 `undefined` 추가

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/backend/src/modules/integrations/integration-oauth.service.spec.ts` L511–513, L553–555
- 상세: `markIntegrationCallbackError` 시그니처에 선택적 `extra` 5번째 인자가 추가됨에 따라 기존 `toHaveBeenCalledWith` 어서션에 `undefined`를 명시적으로 추가한 변경. 기존 테스트가 회귀 깨지지 않도록 올바르게 갱신했다. jest는 `undefined`를 포함한 인자 수를 정확히 매칭하므로 이 처리가 필요하다.
- 제안: 없음.

---

### [WARNING] 커버리지 갭 — `rejectCafe24InvalidScope` 의 `integrationId` 없는 state 경로 미테스트

- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L755–757
- 상세: `rejectCafe24InvalidScope` 내부에 `if (!record.integrationId) throw err;` 분기가 존재한다. 이는 `new` mode 의 `invalid_scope` 콜백(state에 `integrationId`가 null인 케이스)을 처리한다. 5개 테스트 케이스 중 이 경로를 명시적으로 검증하는 케이스가 없다. 현재 테스트는 항상 `integrationId: 'int-iscope'`가 있는 state row를 주입한다. `new` mode에서 `integrationId`가 null인 상태로 `invalid_scope`가 오면 `save`가 호출되지 않고 context 없이 `OAUTH_INVALID_SCOPE`를 throw해야 한다.
- 제안: `makeStateRow({ integrationId: null, mode: 'new' })` 를 사용한 케이스를 추가해 `save` 미호출 + `OAUTH_INVALID_SCOPE` throw를 검증.

---

### [WARNING] 커버리지 갭 — `connected + OAUTH_INVALID_SCOPE` 분기에서 restricted 교집합 없는 케이스 미테스트

- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L877–884 / `integration-oauth.service.cafe24.spec.ts` L131–161
- 상세: `connected` + `reauthorize` 케이스(`it('connected reauthorize ...')`)는 `mall.write_privacy` (restricted scope)를 요청하는 시나리오만 테스트한다. `connected` + reauthorize에서 restricted가 없는 scope를 요청할 때(`mall.read_product` 등) `details`가 `undefined`이고 `statusReason`이 `oauth_invalid_scope`로 설정되는 동작은 검증되지 않는다.
- 제안: `connected` + `requestedScopes: ['mall.read_product']` (non-restricted) 케이스를 추가해 `statusReason=oauth_invalid_scope` + `details` 미설정을 확인.

---

### [INFO] Mock 적절성 — `makeStateRow` 헬퍼로 state 픽스처 일관성 확보

- 위치: `integration-oauth.service.cafe24.spec.ts` L41–61
- 상세: `makeStateRow(overrides)` factory function이 describe 블록 내에 로컬 정의되어 있고 `Partial<Record<string, unknown>>` 타입으로 유연하게 오버라이드를 받는다. `dataSource.query.mockResolvedValueOnce([[makeStateRow()], 1])` 패턴은 실제 DELETE…RETURNING 결과 형식(`[rows, count]`)을 정확히 모방한다.
- 제안: 없음.

---

### [INFO] 테스트 격리 — `integrationRepo.findOne` 재할당 패턴

- 위치: `integration-oauth.service.cafe24.spec.ts` L64–71, L104–110
- 상세: 각 `it` 블록 내에서 `integrationRepo.findOne = jest.fn().mockResolvedValue(...)` 로 직접 재할당하고 있다. `beforeEach`에서 `makeRepo()`로 초기화되므로 블록 간 상태 오염은 없으나, spy reset을 위해 `jest.spyOn` + `mockRestore` 패턴 대신 직접 프로퍼티 재할당을 사용한다. 기존 파일의 다른 describe 블록에서도 동일 패턴을 사용하고 있어 일관성은 유지된다.
- 제안: 없음 (기존 패턴과 일관).

---

### [INFO] 테스트 가독성 — `access_denied` 케이스에서 `dataSource.query` 미호출 어서션

- 위치: `integration-oauth.service.cafe24.spec.ts` L177–188
- 상세: `access_denied` 케이스에서 `expect(dataSource.query).not.toHaveBeenCalled()` 어서션이 포함되어 있다. 이는 state를 소비하지 않아야 함을 명확히 검증하며 회귀 방지에 효과적이다. 단, `beforeEach`에서 `dataSource.query`가 `jest.fn().mockResolvedValue([])` 로 초기화되므로 이전 케이스의 호출 횟수가 누적되지 않는다는 전제가 맞다 — `beforeEach`에서 `dataSource` 객체 자체를 재생성하므로 격리 정상.
- 제안: 없음.

---

### [INFO] 프론트엔드 테스트 부재 — `scope-tab.tsx` 신규 섹션 미검증

- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L1365–1374
- 상세: `statusReason === 'oauth_invalid_scope' && requiresApprovalFromError.length > 0` 조건의 렌더링 분기가 추가됐지만 이에 대한 React 컴포넌트 단위 테스트(RTL/Vitest)가 변경 셋에 포함되지 않는다. `readRequiresApproval` 순수 함수도 별도로 테스트되지 않는다. 계획(`cafe24-oauth-invalid-scope.md`)에 "frontend 확인: scope-tab 가 oauth_invalid_scope details 를 이미 렌더 (회귀 테스트 있으면 확인)" 이라고 명시되어 있으나 기존 테스트 존재 여부가 불명확하다.
- 제안: `readRequiresApproval` 순수 함수에 대한 단위 테스트(null/non-array/string-array 입력)와 `ScopeTab` 컴포넌트에 대한 `statusReason='oauth_invalid_scope'` + `requiresCafe24Approval` 있는/없는 두 시나리오 렌더링 테스트 추가 권고.

---

### [INFO] 테스트 용이성 — `rejectCafe24InvalidScope` private 메서드 테스트 접근

- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L736
- 상세: `rejectCafe24InvalidScope`는 `private` 메서드로, 현재 테스트는 `handleCallbackWithErrorCapture`를 통해 간접적으로 검증한다. 이 방식은 퍼블릭 API 경계를 통한 블랙박스 테스트로 바람직하다. 직접 단위 테스트가 필요하다면 `as any` 캐스팅이 필요하나 현재 수준으로 충분하다.
- 제안: 없음.

---

## 요약

신규 `invalid_scope` 분기에 대한 백엔드 테스트는 5개 케이스로 핵심 시나리오(pending_install 보존, restricted 교집합 없음, connected reauthorize, state 소비됨, access_denied 회귀)를 모두 커버하며 품질이 양호하다. 기존 `markIntegrationCallbackError` 시그니처 변경에 따른 회귀 테스트 갱신도 올바르다. 다만 두 가지 미검증 경로가 있다: `rejectCafe24InvalidScope` 내 `integrationId=null`인 새 연동(new mode)의 `invalid_scope` 처리, 그리고 `connected` reauthorize에서 restricted 아닌 scope의 `details` 미포함 동작. 또한 프론트엔드 `scope-tab.tsx`의 신규 렌더링 분기와 `readRequiresApproval` 순수 함수에 대한 컴포넌트 테스트가 부재하다.

## 위험도

LOW

STATUS: SUCCESS
