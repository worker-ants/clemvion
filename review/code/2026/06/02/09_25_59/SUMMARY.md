# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 구현 정확성·보안·범위 측면에서 양호하나, 아키텍처 설계 개선 여지와 테스트 커버리지 갭이 복수 확인됨. 즉각 차단 이슈 없음.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `CallbackContext` 공유 인터페이스에 Cafe24 특화 필드(`requiresCafe24Approval`) 직접 추가 — ISP/SRP 위반, 공급자 증가 시 필드 팽창 위험 | `integration-oauth.service.ts` `CallbackContext` 인터페이스 | `extra?: Record<string, unknown>` 슬롯 또는 `Cafe24CallbackContext extends CallbackContext` 서브타입으로 분리 |
| 2 | Architecture | `rejectCafe24InvalidScope`가 state DELETE + restricted scope 계산 + throw를 단일 메서드에서 담당 — state 소비 경로가 두 곳으로 분기, 이중 소비 버그 위험 | `integration-oauth.service.ts` `rejectCafe24InvalidScope` | `consumeOAuthState(state)` 단일 메서드로 DELETE 추출, `rejectCafe24InvalidScope`는 row 인자를 받아 예외 생성에만 집중 |
| 3 | Testing | `rejectCafe24InvalidScope` 내 `integrationId=null` 경로(`new` mode의 invalid_scope) 미테스트 — `save` 미호출 + context 없는 throw 검증 부재 | `integration-oauth.service.cafe24.spec.ts` L755–757 | `makeStateRow({ integrationId: null, mode: 'new' })` 케이스 추가 |
| 4 | Testing | `connected` reauthorize에서 restricted 아닌 scope 요청 시 `details` 미포함 동작 미검증 | `integration-oauth.service.cafe24.spec.ts` L131–161 | `connected` + `requestedScopes: ['mall.read_product']` 케이스 추가 |
| 5 | Maintainability | `rejectCafe24InvalidScope` 내에서 동일 `BadRequestException` 인스턴스를 공유하며 조건부 재throw — "왜 같은 err를 두 경로에서 던지는가" 인지 부담 | `integration-oauth.service.ts` `rejectCafe24InvalidScope` | 조기 throw 경로에서 `throw new BadRequestException(...)` 인라인 작성, 최종 경로에서만 변수 사용 |
| 6 | Maintainability | 테스트 케이스마다 완전히 동일한 타입 단언 구조(`as { status: string; statusReason: string; lastError: {...} }`) 반복 | `integration-oauth.service.cafe24.spec.ts` (pending_install, connected 케이스) | describe 스코프 상단에 `type SavedIntegration = ...` 한 번 선언 후 재사용 |
| 7 | Documentation | `plan/in-progress/cafe24-oauth-invalid-scope.md` 체크리스트에서 step 8(TEST), 9(REVIEW), 10(plan complete) 미갱신 | `plan/in-progress/cafe24-oauth-invalid-scope.md` 단계 체크리스트 | 리뷰 완료 후 해당 체크박스 갱신 필수 (plan lifecycle 정상 흐름) |
| 8 | Requirement | 테스트 픽스처 `makeStateRow()`가 `mode='new'` + `integrationId='int-iscope'` 조합 사용 — 실제 운영에 없는 비현실 시나리오 | `integration-oauth.service.cafe24.spec.ts` `makeStateRow()` + L2333–2334 | `mode`를 `'reauthorize'`로 수정하거나 `new`+integrationId 조합 의도를 주석으로 명시 |
| 9 | User Guide | Cafe24 OAuth `invalid_scope` 별도 승인 필요 플로우(`statusReason='oauth_invalid_scope'` + scope-tab 안내)가 `cafe24.mdx`/`cafe24.en.mdx`에 미반영 | `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx` / `cafe24.en.mdx` | 기존 `invalid_scope` FAQ 항목에 별도 승인 필요 권한 케이스 안내 추가 (ko/en 동반 갱신) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `state` 파라미터 길이/형식 검증 없음 — 기존 패턴 미충족이나 이번 변경이 동일 패턴을 확산 | `integration-oauth.service.ts` `rejectCafe24InvalidScope` / `handleCallback` | 컨트롤러 또는 DTO에서 state 길이(≤128자)·허용문자 화이트리스트 검증 추가 권장 |
| 2 | Security | `rejectCafe24InvalidScope`에서 state row의 `provider` 필드 명시적 검증 생략 — 다른 provider의 state row 소비 이론상 가능(실현 가능성 낮음) | `integration-oauth.service.ts` L736–766 | `record.provider !== 'cafe24'` 시 `OAUTH_STATE_MISMATCH` throw 방어 코드 추가 권장 |
| 3 | Security | `markIntegrationCallbackError` catch 블록의 `logger.warn`에 DB 에러 메시지 노출 — `sanitizeLastErrorMessage`는 DB 저장 경로에만 적용 | `integration-oauth.service.ts` L888–891 | DB 에러 클래스 구별 후 코드/제약명만 로그에 남기도록 개선 고려 |
| 4 | Architecture | `handleCallback`의 `query.error` 블록에 Cafe24 특화 조건 누적 — OCP 관점에서 공급자 증가 시 if-else 체인 성장 위험 | `integration-oauth.service.ts` L1249–1255 | 단기 허용 가능; 중기적으로 전략(Strategy) 패턴 또는 `OAuthProvider.handleErrorCallback` 훅 검토 |
| 5 | Architecture | `markIntegrationCallbackError`의 `extra` 인자 타입이 인라인 구성 — `last_error.details` 구조의 타입 안전성이 런타임에만 보장 | `integration-oauth.service.ts` L1312–1315 | `MarkCallbackErrorExtra` 타입 명시적 export |
| 6 | Architecture | 프론트엔드 `readRequiresApproval`의 `lastError` 타입 — 런타임 체크만으로 좁힘, backend DTO와 타입 수준 계약 미공유 | `scope-tab.tsx` L1403–1413 | `packages/` 공유 레이어에 `IntegrationLastErrorDetails` 타입 추가 또는 OpenAPI code generation 검토 |
| 7 | Architecture | `oauth_invalid_scope` 섹션과 `missingScopes` 섹션에서 동일 `<p>` 렌더링 블록(i18n 키 + CSS 클래스) 중복 | `scope-tab.tsx` L1525–1532, L1540–1549 | `<Cafe24ApprovalErrorNotice scopes={...} t={t} />` 소형 컴포넌트 추출 |
| 8 | Maintainability | `rejectCafe24InvalidScope` 메서드명 — 기존 `handle*`/`mark*` 관례와 다른 첫 `reject*` prefix, 팀 내 암묵적 패턴 미문서화 | `integration-oauth.service.ts` private 메서드명 | 현 이름 유지 시 JSDoc에 "항상 throw(never returns)" 명시 |
| 9 | Maintainability | `integration-oauth.service.spec.ts`의 `undefined` 5번째 인자 주석이 두 곳에 거의 동일하게 반복 | `integration-oauth.service.spec.ts` L237, L246 | 한 곳에 `§2 extra 인자 계약` 설명, 나머지는 참조 형태로 축약 |
| 10 | Testing | 프론트엔드 `scope-tab.tsx` 신규 렌더링 분기 및 `readRequiresApproval` 순수 함수에 대한 컴포넌트/단위 테스트 부재 | `scope-tab.tsx` L1365–1374 | `readRequiresApproval` 단위 테스트 + `statusReason='oauth_invalid_scope'` 렌더링 시나리오 테스트 추가 |
| 11 | Requirement | `handleCallbackWithErrorCapture`의 `ctx.requiresCafe24Approval.length > 0` 체크와 `markIntegrationCallbackError` 내부 동일 체크 중복 — defence-in-depth로 무해 | `integration-oauth.service.ts` L790–793 | 기능적 문제 없음. 의도 주석 명시로 충분 |
| 12 | Requirement | `oauth_invalid_scope` + restricted 교집합 없는 케이스에서 UI 안내 부재 — spec에서 명시되지 않은 회색지대 | `scope-tab.tsx` L1527–1536 | spec `project-planner`에 위임 — 해당 시나리오 UI 안내 명시 여부 확인 |
| 13 | Scope | plan 파일의 개별 구현 체크박스(`- [ ]` 항목들) 미갱신 | `plan/in-progress/cafe24-oauth-invalid-scope.md` 구현 목록 | 완료된 항목 `[x]`로 갱신 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | state 파라미터 길이 검증 없음, provider 무결성 검증 생략 — 신규 취약점 없음 |
| architecture | LOW | `CallbackContext`에 Cafe24 특화 필드 노출(WARNING), state 소비 경로 이중화(WARNING) |
| requirement | LOW | 테스트 픽스처 비현실 조합(WARNING), spec 대비 구현 전체 충족 |
| scope | NONE | 변경 파일 모두 plan 범위 내, 불필요한 리팩토링 없음 |
| side_effect | LOW | `markIntegrationCallbackError` 시그니처 변경 보정 확인됨, 의도치 않은 부작용 없음 |
| maintainability | LOW | `rejectCafe24InvalidScope` 제어 흐름 인지 부담(WARNING), 테스트 타입 단언 중복(WARNING) |
| testing | LOW | 백엔드 5개 케이스 핵심 커버, `integrationId=null` 경로 및 `connected` non-restricted 케이스 미검증(WARNING) |
| documentation | LOW | JSDoc·인라인 주석 전반 양호, plan 체크리스트 미갱신(WARNING) |
| database | NONE | DB 변경 없음, 모든 dataSource는 mock — 검토 대상 없음 |
| user_guide_sync | WARNING | `cafe24.mdx`/`cafe24.en.mdx`에 별도 승인 플로우 미반영(WARNING) |

## 발견 없는 에이전트

- **database** — 이번 변경이 테스트 코드 및 서비스 로직 wiring에 한정, 실제 DB 스키마·쿼리·마이그레이션 변경 없음
- **scope** — 7개 변경 파일 전부 plan 명시 범위 내, 불필요한 변경 없음

## 권장 조치사항

1. **[WARNING #3] 테스트 커버리지 보완** — `integrationId=null` (`new` mode) + `invalid_scope` 케이스 테스트 추가. 현재 `rejectCafe24InvalidScope`의 조기 throw 경로가 전혀 검증되지 않음.
2. **[WARNING #4] 테스트 커버리지 보완** — `connected` reauthorize에서 restricted 아닌 scope 요청 시 `details` 미포함 동작 케이스 추가.
3. **[WARNING #9] 사용자 가이드 동반 갱신** — `cafe24.mdx`/`cafe24.en.mdx`의 `invalid_scope` FAQ에 별도 승인 필요 권한 케이스 안내 추가.
4. **[WARNING #8] 테스트 픽스처 수정** — `makeStateRow()`의 `mode: 'new'` + `integrationId` 조합을 `mode: 'reauthorize'`로 수정하거나 의도 주석 명시.
5. **[WARNING #7] plan 체크리스트 갱신** — 리뷰 완료 후 step 8(TEST), 9(REVIEW), 10(plan complete) 체크박스 갱신.
6. **[WARNING #1] 아키텍처 개선(중기)** — `CallbackContext`에서 Cafe24 특화 필드를 `extra?: Record<string, unknown>` 슬롯 또는 서브타입으로 분리.
7. **[WARNING #2] 아키텍처 개선(중기)** — state 소비 로직을 `consumeOAuthState()` 단일 메서드로 추출해 소비 경로 단일화.
8. **[WARNING #5] 가독성 개선** — `rejectCafe24InvalidScope` 내 조기 throw 경로를 인라인 `new BadRequestException(...)` 으로 분리.
9. **[WARNING #6] 테스트 타입 정의 중복 제거** — 반복되는 타입 단언 구조를 describe 스코프 상단 `type SavedIntegration`으로 추출.
10. **[INFO #2] 방어 코드 추가(선택)** — `rejectCafe24InvalidScope`에서 `record.provider !== 'cafe24'` 시 `OAUTH_STATE_MISMATCH` throw 추가.

## 라우터 결정

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `user_guide_sync` (10명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: `performance`, `dependency`, `concurrency`, `api_contract` (4명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터에 의해 생략 |
| dependency | 라우터에 의해 생략 |
| concurrency | 라우터에 의해 생략 |
| api_contract | 라우터에 의해 생략 |