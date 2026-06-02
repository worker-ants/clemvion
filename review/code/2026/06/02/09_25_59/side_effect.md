# 부작용(Side Effect) 리뷰 결과

리뷰 대상: Cafe24 OAuth `invalid_scope` callback 분기 구현 (§10.4)
분석 파일: integration-oauth.service.ts, integration-oauth.service.spec.ts, integration-oauth.service.cafe24.spec.ts, scope-tab.tsx, plan/in-progress/cafe24-oauth-invalid-scope.md, review/consistency/** (신규 파일 다수)

---

## 발견사항

### [WARNING] `markIntegrationCallbackError` 시그니처 변경 — 5번째 인자 `extra` 추가

- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `handleCallbackWithErrorCapture` 내부 `markIntegrationCallbackError` 호출부 (diff +799 라인)
- 상세: `markIntegrationCallbackError(integrationId, workspaceId, errorCode, message)` 에 `extra?: { requiresCafe24Approval?: string[] }` 5번째 인자가 추가됐다. 변경 diff 에는 `markIntegrationCallbackError` 의 시그니처 정의 변경이 포함되지 않았으나(`integration-oauth.service.ts` 의 `markIntegrationCallbackError` 메서드 본체는 diff 에 파일 3 hunk +874 블록으로 포함됨), 이 메서드가 `public` 이라면 외부 호출자에게 영향을 미칠 수 있다. 실제로 `integration-oauth.service.spec.ts` diff (파일 2)가 기존 테스트의 `spy.toHaveBeenCalledWith(...)` 에 5번째 인자 `undefined` 를 추가하는 보정 변경을 포함하고 있어, 호출자 쪽 기대값이 변경됐음을 확인한다. `extra` 는 optional 이므로 기존 호출자가 인자를 생략해도 TypeScript 컴파일은 통과하지만, 테스트의 `toHaveBeenCalledWith` 는 정확한 인자 일치를 검증하므로 기존 테스트가 보정 없이는 실패했을 것이다. 이 보정이 이번 diff 에 포함되어 있어 처리됐음을 확인.
- 제안: 현재 diff 내에서 이미 `integration-oauth.service.spec.ts` 의 두 테스트에 `undefined` 보정이 추가됐으므로, 해당 메서드를 직접 호출하는 다른 위치(integration controller 등)가 없는지 코드베이스 전체를 추가 확인할 것. diff 범위 외의 호출자가 존재하면 누락된 인자 없이 컴파일은 통과하지만, 향후 해당 호출자의 테스트 기대값이 어긋날 수 있다.

### [INFO] `CallbackContext` 인터페이스에 `requiresCafe24Approval?: string[]` 추가 — 공개 인터페이스 확장

- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L151–157 (diff +151 블록)
- 상세: `CallbackContext` 는 `export` 된 공개 인터페이스다. optional 필드 추가이므로 기존 소비자와 하위 호환이 유지된다. `attachCallbackContext` / `callbackContextOf` 유틸도 특정 필드를 강제하지 않으므로 런타임 동작 변경은 없다. 외부 모듈이 `CallbackContext` 를 타입으로 destructure 하거나 satisfies 검사를 수행한다면 새 optional 필드에 대해 아무런 영향이 없다. 의도된 변경으로 부작용 없음.
- 제안: 없음.

### [INFO] `rejectCafe24InvalidScope` — DB 상태 변경(DELETE)이 항상 throw 와 결합됨

- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L1271–L1301 (`rejectCafe24InvalidScope` private 메서드)
- 상세: 메서드가 `Promise<never>` 를 반환하며 항상 throw 한다. `DELETE FROM integration_oauth_state WHERE state = $1 RETURNING *` 쿼리가 실행되어 state row 를 영구 소비(삭제)한 뒤 예외를 던진다. state 가 이미 소비된 경우(0 rows)도 throw 한다. 이 메서드는 `handleCallback` 의 `query.error === 'invalid_scope'` 분기에서만 호출되며, 호출 경로는 단일하다(`await this.rejectCafe24InvalidScope(query.state)`). DB DELETE 가 예외 경로에서 발생하는 구조이나, 이것이 의도된 설계(state 소비 후 throw)이므로 비정상 부작용은 없다. 단, `rejectCafe24InvalidScope` 내부에서 DELETE 성공 후 throw 전에 다른 예외가 발생하는 경우(예: `normalizeRawStateRow` throw)는 state 가 소비됐음에도 context 없이 propagate 된다. 현재 `normalizeRawStateRow` 구현이 throw 하는지 확인이 필요하나, 이는 기존 코드 경로에도 존재하는 일반적 패턴으로 신규 부작용이 아니다.
- 제안: 없음. 단, `normalizeRawStateRow` 가 throw 가능한 함수라면 그 예외가 state 소비 이후 context 없이 propagate 됨을 주석으로 명시하는 것이 좋다.

### [INFO] `scope-tab.tsx` — `readRequiresApproval` 이 `lastError` 를 직접 읽음 (렌더 중 파생 상태)

- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L1444 (`readRequiresApproval(integration.lastError)`)
- 상세: `requiresApprovalFromError` 는 컴포넌트 렌더 시마다 재계산되는 파생 값이다. 이는 React 패턴에 부합하며 전역 상태나 외부 상태를 변경하지 않는다. 새로 추가된 `statusReason === 'oauth_invalid_scope'` 섹션은 이 파생 값을 조건부로 렌더링할 뿐이다. 이 변경은 기존 `missingScopes` 섹션과 독립적인 새 섹션으로, 기존 렌더링 경로에 간섭하지 않는다. 새 섹션의 조건(`statusReason === 'oauth_invalid_scope' && requiresApprovalFromError.length > 0`)은 기존 `missingScopes` 섹션의 조건(`statusReason === 'insufficient_scope' && allOptions.length > 0`)과 서로 배타적이지 않다 — 두 조건이 동시에 참이 될 수 있으나(예: statusReason 이 다르면 한쪽만 true), 정상 시나리오에서는 `oauth_invalid_scope` 와 `insufficient_scope` 는 동시에 설정되지 않으므로 실질적 중복 렌더 위험은 없다.
- 제안: 없음.

### [INFO] `integration-oauth.service.spec.ts` — 테스트 내 `process.env.OAUTH_STUB_MODE` 조작

- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.spec.ts` L306, L318 (전체 파일 컨텍스트 — 변경 없는 기존 코드)
- 상세: `beforeEach` 에서 `process.env.OAUTH_STUB_MODE = 'true'` 를 설정하고 `afterEach` 에서 `delete process.env.OAUTH_STUB_MODE` 로 정리한다. 이는 기존 패턴이며, 이번 diff 의 변경 범위와 무관하다. 이번 변경(파일 2 diff)은 기존 두 테스트의 `spy.toHaveBeenCalledWith` 에 `undefined` 인자를 추가하는 것뿐이며, 환경 변수 조작 패턴에 영향을 주지 않는다. 신규 부작용 없음.
- 제안: 없음.

### [INFO] `integration-oauth.service.cafe24.spec.ts` — `Date.now()` 기반 `expiresAt` 사용

- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` L57 (`new Date(Date.now() + 60_000)`)
- 상세: `makeStateRow` 헬퍼가 `expiresAt: new Date(Date.now() + 60_000)` 을 생성한다. 이는 테스트 실행 시점의 절대 시간에 의존하지만, 60초 여유를 두므로 단위 테스트 환경에서 타이밍 경합이 발생할 가능성은 매우 낮다. 기존 cafe24 spec 파일의 패턴과 동일하며 신규 부작용 아님.
- 제안: 없음.

### [INFO] 신규 review/consistency 파일 — review 디렉토리에 다수 파일 생성

- 위치: `review/consistency/2026/06/02/09_09_52/` 하위 6개 파일 (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, naming_collision.md, plan_coherence.md, rationale_continuity.md, meta.json)
- 상세: 이 파일들은 consistency-check 산출물로, CLAUDE.md 규약에 따라 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 저장된다. write-once 산출 파일이며 이후 코드 실행에 영향을 주지 않는다. `_retry_state.json` 은 orchestrator 재시도 상태 파일로 `agents_success: []` 상태를 기록하고 있어, 해당 세션이 완료됐음에도 success 목록이 비어있는 점이 눈에 띈다. 그러나 이 파일은 orchestrator 내부 상태 추적용이며 SUMMARY.md 가 존재하므로 정상 완료된 것으로 판단된다. 코드 실행에 대한 부작용 없음.
- 제안: 없음.

---

## 요약

이번 변경은 Cafe24 OAuth `invalid_scope` callback 분기를 backend 서비스 레이어에 wiring 하는 작업이다. 부작용 관점에서 가장 주목할 점은 `markIntegrationCallbackError` 에 5번째 `extra` 인자가 추가되면서 기존 두 테스트의 `toHaveBeenCalledWith` 기대값이 보정됐다는 것이다 — 이 보정이 diff 내에 포함되어 처리됐으나, 동 메서드를 직접 호출하는 다른 위치(controller 등)가 diff 범위 밖에 존재할 경우 해당 테스트의 기대값 보정이 누락됐을 수 있다. `CallbackContext` 인터페이스 확장(optional 필드 추가)은 하위 호환을 유지한다. `rejectCafe24InvalidScope` 의 DELETE + throw 패턴은 의도된 설계로 state row 를 정확히 소비하며, 전역 상태나 파일시스템, 환경 변수, 네트워크 호출에 대한 의도치 않은 부작용은 발견되지 않았다. frontend `scope-tab.tsx` 의 새 렌더링 분기는 기존 경로와 독립적으로 동작한다.

---

## 위험도

LOW

STATUS: SUCCESS
