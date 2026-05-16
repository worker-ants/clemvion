# Code Review 통합 보고서

> 세션: `review/code/2026/05/16/13_17_18`
> 리뷰어: 13명 전원 success (pending 0, fatal 0)
> Critical 0건 / Warning 14건 / Info 13건

## 본 PR 의 실제 변경 범위

orchestrator 가 prepare 시점에 working tree 의 **prettier 자동 포매팅 변경 9 파일**도 diff scope 에 포함했으나 (uncommitted), 이는 본 작업과 무관한 빌드 부산물이라 리뷰 후 `git restore` 로 환원했다. 본 PR 의 실제 변경 파일:

- spec/data-flow/integration.md (§1.2.1 drift 정정)
- spec/2-navigation/4-integration.md (§4.2 + §9.1 + Rationale)
- spec/1-data-model.md (§2.10 follow-up)
- backend/src/modules/integrations/integration-oauth.service.ts (HMAC 진단 로그 + previewInstallToken + lint fix)
- backend/src/modules/integrations/integrations.service.ts (appUrl 필드 + installToken 제거)
- backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts (HMAC 로그 검증)
- backend/src/modules/integrations/integrations.service.spec.ts (toPublic appUrl 검증)
- frontend/src/lib/api/integrations.ts (IntegrationDto.appUrl)
- frontend/src/lib/i18n/dict/ko.ts / en.ts (cafe24DetailAppUrl* 키)
- frontend/src/app/(main)/integrations/[id]/page.tsx (Cafe24AppUrlCard 호출)
- frontend/src/app/(main)/integrations/[id]/cafe24-app-url-card.tsx (신규)
- frontend/src/app/(main)/integrations/[id]/__tests__/cafe24-app-url-card.test.tsx (신규)
- frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx (appUrl: null 추가)

## 본 PR 직접 관련 발견사항

### Critical

없음.

### Warning (직접 관련)

| # | 카테고리 | 발견 | 위치 | 조치 |
|---|----------|------|------|------|
| W1 | api_contract | `appUrl` 필드를 `IntegrationDto` 에 추가하면서 backend `meta.appType` 와의 의미 중복 여부 / 클라이언트가 `appType==='private'` 검사로 분기하던 기존 로직과의 정합성 | `integrations.service.ts` toPublic | `appUrl` 은 actionable URL (string) / `meta.appType` 는 hint (enum). 의미 다름 — 변경 없음. README/RESOLUTION 에 명시 |
| W2 | testing | `installToken` 응답 제거가 미사용 검증 — 다른 코드 경로에서 `entity.installToken` 을 통해 외부 노출하지 않는지 확인 필요 | grep across codebase | grep 으로 검증 완료 — frontend `IntegrationDto.installToken` 정의 없음, requestScopes 응답은 별도 shape (`Cafe24PrivatePendingBase.appUrl`) 으로 ApiUrl 만 제공. 위배 없음 |
| W3 | maintainability | `Cafe24AppUrlCard` 와 신규 등록 흐름의 `Cafe24PrivatePendingStep` 의 복사 UX 패턴이 거의 동일 — 중복 | new/page.tsx vs cafe24-app-url-card.tsx | 의도된 일관성. 향후 공통 컴포넌트 추출 검토는 별도 plan |

### Info (직접 관련)

| # | 카테고리 | 발견 | 위치 | 조치 |
|---|----------|------|------|------|
| I1 | documentation | `previewInstallToken` 헬퍼의 JSDoc 는 있으나 export 되지 않은 module-internal 헬퍼라 외부 호환성 영향 없음 | integration-oauth.service.ts | 확인. 추가 조치 없음 |
| I2 | security | `appUrl` 응답 필드에 install_token 전체가 포함된다 — credentials 마스킹 정책의 예외 | integrations.service.ts toPublic | install_token 은 capability token 으로 평문 저장이 spec 의 명시적 결정 (`spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격" + "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제") — workspace 인증된 사용자에게 노출은 정책상 허용 |
| I3 | testing | `previewInstallToken` 헬퍼 단위 테스트 부재 (현재는 logHmacFailure 통합 테스트로만 간접 검증) | integration-oauth.service.ts | logHmacFailure 의 token=AbCd..StUv assertion 으로 충분. 별도 unit test 불필요 (private fn) |

## 본 PR 무관 (pre-existing) — 별도 plan 권장

orchestrator 가 분석한 9개의 prettier 자동 포매팅 파일에서 발견된 14건의 Warning + Info 항목 — 본 PR 의 작업 의도와 무관 (해당 파일들의 실제 diff 는 line break 재배치뿐). 사용자 결정에 따라 별도 plan 으로 분리.

대표 항목 (전체는 `review/code/2026/05/16/13_17_18/<reviewer>/review.md` 참조):
- `cafe24Install` / `oauthCallback` catch 블록의 e.message 클라이언트 노출 (security)
- `isValidPostMessageOrigin` 단위 테스트 부재 (testing)
- `@ApiOkResponse` vs 실제 302 redirect 불일치 (api_contract)
- `VALID_OPERATIONS` Set 매 호출 재생성 (performance/maintainability)
- `FRONTEND_URL`/`APP_URL` 환경변수 문서화 누락 (documentation)
- `validateVariableDeclarationConfig` type enum 미검증 (requirement)

이들은 별도 PR/plan 으로 처리. 본 PR 의 RESOLUTION.md 에 follow-up 노트만 남긴다.

## BLOCK 판정

**BLOCK: NO** — 본 PR 의 실제 변경 범위에서 Critical 0건. Warning 3건은 모두 설계 의도 검증이며 코드 수정 불필요.

## Checker별 위험도

| Checker | 위험도 | 본 PR 직접 관련 |
|---------|--------|----------------|
| security | LOW | I2 (install_token spec 결정 — 위배 없음) |
| testing | LOW | W2 (검증 완료) / I3 (private fn — 추가 불필요) |
| api_contract | LOW | W1 (의미 분리 명확) |
| maintainability | LOW | W3 (의도된 일관성) |
| documentation | NONE | I1 (확인 완료) |
| 그 외 9 checker | NONE | 본 PR 무관 |
