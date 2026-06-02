# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/` (--impl-prep, cafe24 OAuth `invalid_scope` callback 구현)

---

## 발견사항

### [INFO] `OAUTH_INVALID_SCOPE` 에러 코드 — spec 선정의와 코드 선정의 간 표기 일관
- target 신규 식별자: `last_error.code='OAUTH_INVALID_SCOPE'` (spec/2-navigation/4-integration.md §10.4)
- 기존 사용처: `integration-oauth.service.ts:497` 의 `code: 'OAUTH_DENIED'` 패턴, `integration-status-reason.ts:32` 의 `'oauth_invalid_scope'` (snake_case)
- 상세: spec §10.4 는 `last_error.code='OAUTH_INVALID_SCOPE'` (UPPER_SNAKE_CASE) 를 명시하고, DB `status_reason` 은 `'oauth_invalid_scope'` (snake_case) 로 이미 정의되어 있다. 두 표기는 의도적으로 분리된 컨벤션이며, spec 내 Rationale (`spec/2-navigation/4-integration.md §10.4` 하단 "status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분" 섹션) 에 명시되어 있다. 충돌 없음 — 단, 구현 시 혼동 방지를 위해 `OAUTH_INVALID_SCOPE` 상수가 아직 코드에 존재하지 않는 점을 확인.
- 제안: 구현 시 `code: 'OAUTH_INVALID_SCOPE'` 리터럴을 상수로 추출하거나 기존 에러 코드 패턴과 동일한 inline 객체 방식으로 일관성 유지.

### [INFO] `throwCafe24InvalidScope` private 메서드명 — 기존 패턴과의 명명 검토
- target 신규 식별자: plan `cafe24-oauth-invalid-scope.md` 가 명시한 private 메서드 `throwCafe24InvalidScope(state)`
- 기존 사용처: `integration-oauth.service.ts` 에 이미 `handleCallback`, `handleCallbackWithErrorCapture` 등 동사형 메서드 존재
- 상세: `throw` 를 메서드 이름 접두어로 사용하는 패턴은 현재 코드베이스에 선례가 없다. 관례상 내부에서 예외를 던지는 메서드는 `handleXxx` 또는 `processXxx` 로 명명한다. 기능 충돌은 없으나 명명 컨벤션 일관성 문제.
- 제안: `private handleCafe24InvalidScope(state)` 또는 `private rejectCafe24InvalidScope(state)` 로 변경 검토.

### [INFO] `CallbackContext.requiresCafe24Approval` 필드 추가 — 기존 인터페이스 확장
- target 신규 식별자: plan 이 `CallbackContext` 에 `requiresCafe24Approval?: string[]` 을 추가
- 기존 사용처: `integration-oauth.service.ts:149` 의 `CallbackContext` 인터페이스 (현재 `integrationId?`, `mode?` 등 포함), `attachCallbackContext` / `callbackContextOf` 유틸
- 상세: `CallbackContext` 는 이미 export 된 공개 인터페이스다. `optional` 필드 추가이므로 기존 소비자와 하위 호환이 유지되고 의미 충돌도 없다. 다만 `requiresCafe24Approval` 은 frontend 의 `scope-tab.tsx:27` 및 `integrations.ts:68` 에서 `last_error.details.requiresCafe24Approval` 키로 이미 소비되고 있어, 이 컨텍스트 필드명과 최종 DB 저장 키 이름이 일치하는지 구현 시 확인 필요.
- 제안: 문제 없음. 구현 시 `CallbackContext.requiresCafe24Approval` → `markIntegrationCallbackError(extra.requiresCafe24Approval)` → `last_error.details.requiresCafe24Approval` 경로를 단위 테스트로 검증하면 충분.

---

## 요약

`spec/2-navigation/` 영역이 도입하는 식별자(`oauth_invalid_scope` status_reason, `OAUTH_INVALID_SCOPE` 에러 코드, `requiresCafe24Approval` 필드)는 모두 이미 spec 에 명세되어 있고, 코드베이스에도 `integration-status-reason.ts`, `scope-tab.tsx`, `integrations.ts` 를 통해 소비 측이 사전 준비되어 있다. 새로 부여되는 식별자가 다른 도메인에서 다른 의미로 재사용되는 충돌 케이스는 없다. `token_exchange_failed` (auth 소셜 로그인 도메인, URL param) 와 `oauth_token_exchange_failed` (integration 도메인, status_reason) 의 의도적 prefix 분리도 spec Rationale 에 명시되어 있어 혼동 위험이 해소되어 있다. 유일한 경미한 이슈는 plan 상의 내부 메서드명 `throwCafe24InvalidScope` 이 기존 명명 관례와 다소 어긋나는 점이나, 이는 공개 식별자가 아니어서 외부 충돌은 없다.

---

## 위험도

NONE
