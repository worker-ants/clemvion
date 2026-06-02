# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] plan 체크박스 미갱신 항목 포함
- 위치: `plan/in-progress/cafe24-oauth-invalid-scope.md` 구현 목록 (`- [ ]` 항목들)
- 상세: plan 파일의 구현 체크박스(`- [ ] CallbackContext 에 requiresCafe24Approval...` 등)가 모두 미완료(`[ ]`)로 남아 있다. 단계 체크리스트는 5-7 단계까지 `[x]`로 표기했으나, 구현 목록 자체의 개별 항목은 갱신되지 않았다. 범위 이탈은 아니지만 plan 추적 정확성이 떨어진다.
- 제안: 구현이 완료된 각 항목(`CallbackContext.requiresCafe24Approval`, `rejectCafe24InvalidScope`, `handleCallbackWithErrorCapture extra 전달`, `markIntegrationCallbackError connected 분기`, `scope-tab.tsx 섹션`)을 `[x]`로 갱신.

### [INFO] `markIntegrationCallbackError` 시그니처 변경 — 기존 테스트 인자 조정
- 위치: `integration-oauth.service.spec.ts` diff +237, +246 (5번째 `undefined` 인자)
- 상세: `markIntegrationCallbackError` 에 `extra` 5번째 파라미터가 추가되면서, 기존 테스트 2건의 `expect(spy).toHaveBeenCalledWith(...)` 호출에 `undefined` 인자가 추가됐다. 이는 시그니처 변경에 따른 필수 조정이며 범위 이탈이 아니다. 주석(`§2: 5번째 extra 인자`)도 변경 의도를 명확히 설명한다.
- 제안: 현 상태 유지.

### [INFO] `scope-tab.tsx` — 기존 `missingScopes` 섹션 내부와 신규 `oauth_invalid_scope` 섹션의 i18n 키 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-oauth-invalid-scope-408b14/codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` 라인 1527-1532 (기존), 라인 1541-1550 (신규)
- 상세: `integrations.cafe24RestrictedApprovalApiError` i18n 키가 기존 `missingScopes` 섹션 내부(`requiresApprovalFromError.length > 0` 조건부)와 신규 `oauth_invalid_scope` 섹션 두 곳에서 동일하게 사용된다. 이는 두 경로(insufficient_scope + missing scopes + restricted 교집합 vs oauth_invalid_scope)가 같은 메시지를 표시하는 의도적 설계로 보인다. 범위 이탈은 아니나, 두 케이스가 실제로 같은 메시지로 충분한지 UX 관점 검토가 권장된다.
- 제안: 의도적 재사용이면 주석으로 명시. 케이스별 구분 메시지가 필요하면 별도 i18n 키 추가.

## 요약

7개 변경 파일 모두 plan에 명시된 §2 OAuth `invalid_scope` callback 분기 구현 범위 내에 있다. 백엔드는 `CallbackContext.requiresCafe24Approval` 필드 추가, `rejectCafe24InvalidScope` private 메서드 신설, `handleCallbackWithErrorCapture` extra 전달, `markIntegrationCallbackError` connected 분기 추가로 한정되며, 프론트엔드는 `scope-tab.tsx`에 `oauth_invalid_scope` 섹션 하나만 추가됐다. 기존 기능에 대한 불필요한 리팩토링, 무관한 파일 수정, 의미 없는 포맷팅 변경, 미사용 임포트 추가는 발견되지 않았다. consistency-check 산출물(`review/consistency/2026/06/02/09_09_52/`)과 plan 파일은 이 작업의 사전 준비 단계 결과물로 정상 포함된다. plan 체크박스 미갱신과 i18n 키 재사용은 경미한 INFO 수준이다.

## 위험도

NONE
