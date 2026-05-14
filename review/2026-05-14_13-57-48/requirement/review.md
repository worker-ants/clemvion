### 발견사항

---

**[CRITICAL] 테스트 assertion — mode 값 불일치 (테스트 실패)**
- **위치:** `integration-oauth.service.cafe24.spec.ts`, `handleInstall` happy-path 테스트, `stateRepo.create.mock.calls[0][0]` 검증
- **상세:** 서비스(`handleInstall`)는 `stateRepository.create({ ... mode: 'reauthorize', ... })`로 상태를 저장하는데, 테스트는 `expect(savedState.mode).toBe('reconnect')`로 검증한다. `'reconnect'`는 유효하지 않은 mode 값이며, 해당 테스트는 현재 코드 기준으로 반드시 실패한다.
- **제안:** 테스트 assertion을 `expect(savedState.mode).toBe('reauthorize')`로 수정.

---

**[WARNING] `installToken` 컬럼 생성 후 미사용 — 명세·SQL 주석과 구현 불일치**
- **위치:** `V042__cafe24_private_app_pending_install.sql` + `integration.entity.ts` + `integration-oauth.service.ts` `handleInstall()`
- **상세:** 마이그레이션 주석은 `install_token`을 "HMAC 검증 보조용, App URL 핸들러가 pending Integration을 특정하기 위해 사용"이라고 설명한다. 그러나 `handleInstall()`의 실제 조회 쿼리는 `service_type='cafe24'` + `status='pending_install'` 두 조건만 사용하고 `install_token`은 전혀 조회/비교하지 않는다. 컬럼은 생성·저장·nulling 되지만 식별에 사용되지 않아 컬럼 설명과 코드가 모순된다.
- **제안:** (a) `installToken`으로 추가 필터링하거나 (b) 컬럼 주석을 "현재 미사용, HMAC 단독으로 식별"으로 정정. 단순 HMAC 방식이 충분히 안전하므로 (b)가 더 현실적.

---

**[WARNING] `pending_install` 인테그레이션 TTL/정리 메커니즘 부재**
- **위치:** `createPrivatePendingIntegration()` 전체, `handleInstall()` 조회 쿼리
- **상세:** 사용자가 "테스트 실행"을 하지 않으면 `pending_install` 상태의 Integration은 영구 잔존한다. 같은 `mall_id`로 여러 번 begin을 호출하면 복수의 `pending_install` 행이 누적된다. `handleInstall()`은 전체를 순회하며 HMAC 검증을 시도하므로, 행이 많을수록 처리 비용이 늘고 불필요한 복호화(credentials transformer)가 발생한다.
- **제안:** `created_at` 기준 TTL(예: 24–48h) 스캐너 추가, 또는 `createPrivatePendingIntegration` 호출 시 동일 `workspaceId + mall_id`의 기존 `pending_install` Integration을 삭제 후 신규 생성.

---

**[WARNING] Cafe24 Private Pending 화면 "이동" 버튼 — 레이블과 라우트 불일치**
- **위치:** `frontend/src/app/(main)/integrations/new/page.tsx`, `Cafe24PrivatePendingStep` 컴포넌트
- **상세:** 버튼 i18n 키 `cafe24PrivatePendingViewList`는 "Go to integrations list" / "통합 목록으로 이동"으로 정의되어 있지만, 실제 라우트는 `/integrations/${integrationId}` — 목록이 아닌 개별 통합 상세 페이지다.
- **제안:** (a) 라우트를 `/integrations`(목록)로 변경하거나, (b) i18n 키 값을 "통합 상세 보기 / Go to integration detail"로 수정.

---

**[WARNING] `/oauth/install/cafe24` 엔드포인트 rate limiting 부재**
- **위치:** `integrations.controller.ts`, `cafe24Install()` — `@Public()` 데코레이터, throttle 없음
- **상세:** `@Public()` 엔드포인트이므로 인증 없이 외부에서 반복 호출 가능. `pending_install` Integration 수가 많을 경우 HMAC 브루트포스 또는 스캔 시도에 노출된다. 다른 `@Public()` 엔드포인트들 (`preview-test` 등)은 `@Throttle`이 적용되어 있다.
- **제안:** `@Throttle({ default: { limit: 30, ttl: 60_000 } })` 수준의 제한 추가.

---

**[WARNING] `handleInstall` — `client_secret`이 `providerMeta`에 포함되어 OAuthState 테이블에 저장**
- **위치:** `integration-oauth.service.ts`, `handleInstall()` 내 `stateRecord` 생성 부분
- **상세:** `providerMeta: { mall_id, app_type, client_id, client_secret }` — `client_secret`이 `oauth_state` 테이블 행에 평문 저장된다. callback 단계에서 토큰 교환에 필요하지만, state TTL 이후 삭제되지 않으면 노출 위험이 있다. credentials에 이미 `client_secret`이 암호화 저장되어 있으므로 중복 저장이다.
- **제안:** callback 핸들러에서 `integrationId`를 통해 credentials를 직접 조회하도록 변경하고, `providerMeta`에서 `client_secret` 제거. 또는 state TTL 내 확실한 삭제 보장.

---

**[INFO] Spec changelog — "active" 오기**
- **위치:** `spec/4-nodes/4-integration/4-cafe24.md` Revision History 마지막 행, `spec/2-navigation/4-integration.md` §6 상태 전이 다이어그램 하단 주석
- **상세:** "Integration `pending_install → active`"라고 기재되어 있으나 유효 status는 `connected`. `active`는 정의된 상태값이 아니다.
- **제안:** `active` → `connected`로 일괄 수정.

---

**[INFO] `ListStatusFilter` 타입에 `pending_install` 미포함**
- **위치:** `frontend/src/lib/api/integrations.ts`, `ListStatusFilter` 타입
- **상세:** `IntegrationStatus`에 `pending_install`이 추가되었지만 `ListStatusFilter`(`"all" | "connected" | "expiring" | "expired" | "error"`)에는 없어, 사용자가 목록에서 `pending_install` 상태로 필터링할 수 없다.
- **제안:** `pending_install` 필터 지원 여부를 명시적으로 결정. 지원한다면 `ListStatusFilter`에 추가하고 백엔드 필터 로직도 확인.

---

### 요약

Cafe24 Private 앱 OAuth 재설계(pending\_install + App URL HMAC 흐름)의 핵심 로직은 전반적으로 spec에 부합하며, HMAC timing-safe 비교·timestamp 재전송 방어·콜백 후 `installToken` null 처리 등 보안 요소도 구현되어 있다. 그러나 **테스트 `mode` assertion이 `'reconnect'`로 잘못 기재**되어 있어 CI가 반드시 실패하는 상태이며, **`installToken` 컬럼이 migration 설명과 달리 실제 식별에 사용되지 않아** 명세·주석과 구현이 모순된다. 추가로 `pending_install` 잔존 행 정리 메커니즘 부재, "목록으로 이동" 버튼이 상세 페이지로 연결되는 레이블 오류, 공개 엔드포인트에 rate limiting 미적용이 운영 전 해소가 권장되는 문제다.

### 위험도

**HIGH** — 테스트 실패(즉각적)와 `installToken` 명세 불일치(운영 혼동)가 병존하며, `pending_install` 행 누적과 rate limiting 부재는 운영 안정성에 직접 영향을 미친다.