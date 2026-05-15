## 발견사항

---

### [CRITICAL] `handleInstall` 생성 state의 `mode` 값 — 테스트/구현 불일치

- **위치**: `integration-oauth.service.ts` (추가된 `handleInstall`) vs `integration-oauth.service.cafe24.spec.ts`
- **상세**: 구현은 `mode: 'reauthorize'`로 OAuthState를 생성하지만, 테스트는 `expect(savedState.mode).toBe('reconnect')`을 단언한다. 이 테스트는 반드시 실패한다. `'reconnect'`은 callback 핸들러의 분기조건(`record.mode === 'reauthorize'`)에도 일치하지 않으므로, 실제 런타임에서 callback이 Private 앱 흐름으로 진입할 경우 credentials이 replace가 아니라 merge되는 경로(`...integration.credentials, ...credentials`)를 타게 된다.
- **제안**: 테스트의 `'reconnect'`을 `'reauthorize'`로 수정하거나, 구현이 실제로 `'reconnect'` mode를 의도한 것이라면 callback 핸들러의 분기조건과 spec을 함께 수정해야 한다.

---

### [WARNING] `reauthorize` / `requestScopes` — Private Cafe24 앱에서 기존 Integration 대신 새 `pending_install` 생성

- **위치**: `integration-oauth.service.ts:begin()` 분기 + `integrations.service.ts`의 `reauthorize`, `requestScopes`
- **상세**: `begin()`에서 `app_type === 'private'`이면 mode에 무관하게 `createPrivatePendingIntegration()`으로 즉시 early-return한다. `reauthorize` 및 `requestScopes`는 기존 Integration의 `providerMeta`(app_type='private' 포함)를 그대로 넘기기 때문에, 이미 `connected` 상태인 Private 앱을 재인증하면 **새 `pending_install` Integration이 중복 생성**된다. 기존 Integration은 그대로 남는다.
- **제안**: `begin()` 분기에서 `mode === 'new'`일 때만 `createPrivatePendingIntegration()`을 호출하도록 조건을 추가하거나, `reauthorize`/`requestScopes` 경로에서 Private 앱의 별도 처리 전략을 명시적으로 정의해야 한다.

---

### [WARNING] 프론트엔드 `reauthorize()` API 클라이언트 — 반환 타입 불일치

- **위치**: `frontend/src/lib/api/integrations.ts:reauthorize()`
- **상세**: 백엔드 `reauthorize` 엔드포인트의 반환 타입은 이번 변경으로 `BeginResult`(Union)가 됐지만, 프론트엔드 클라이언트는 여전히 `Promise<{ authUrl: string; state: string }>`로 타입이 고정되어 있다. Expired 상태의 Private Cafe24 Integration에서 재인증을 시도하면 런타임에 `cafe24_private_pending` shape이 반환되지만 프론트엔드는 `authUrl`을 읽으려 해 팝업을 열지 못하고 조용히 실패한다.
- **제안**: `reauthorize`의 반환 타입을 `oauthBegin`과 동일한 Union 타입으로 수정하고, 호출 측 UI에서도 `mode === 'cafe24_private_pending'` 분기를 처리해야 한다.

---

### [WARNING] `handleInstall` — 전체 workspace의 `pending_install` Integration을 메모리에 적재 후 순차 HMAC 검증

- **위치**: `integration-oauth.service.ts:handleInstall()` (`.getMany()` + for 루프)
- **상세**: `pending_install` 상태인 모든 Cafe24 Integration을 `.getMany()`로 가져와 루프를 돌며 HMAC을 검증한다. `encryptedJsonTransformer`가 각 row의 credentials를 복호화하므로, pending_install 건이 많을수록 복호화 비용이 선형으로 증가한다. 또한 `mall_id`가 동일한 pending Integration이 여러 개 있을 경우 **첫 번째 HMAC 일치 항목만 선택**되어 후속 건들은 무시된다(버그 가능성보다는 한계 사항).
- **제안**: 쿼리에 `mall_id`(credentials JSONB 검색) 또는 `install_token` 사전 필터를 추가해 후보 수를 줄이는 것이 바람직하다. `install_token` 컬럼을 이미 추가했으므로, `begin()`에서 생성한 토큰을 URL에 포함시켜 `handleInstall`에서 직접 조회하는 방식이 더 효율적이다.

---

### [WARNING] `APP_URL` 환경변수 미설정 시 `localhost:3011` 폴백

- **위치**: `integration-oauth.service.ts:createPrivatePendingIntegration()` 및 `handleInstall()`
- **상세**: `process.env.APP_URL || 'http://localhost:3011'`이 두 곳에 사용된다. 프로덕션 환경에서 `APP_URL`이 누락되면, 사용자에게 표시되는 `appUrl`/`callbackUrl`이 `localhost`가 되고 Cafe24 "테스트 실행"도 `localhost`를 호출하여 흐름 전체가 작동하지 않는다. 이 오류는 런타임에 조용히 발생한다.
- **제안**: 서비스 기동 시(`onModuleInit` 또는 ConfigService)에 `APP_URL` 존재 여부를 검증하거나, `NODE_ENV === 'production'`일 때 fallback 사용 시 명시적 경고/예외를 발생시켜야 한다.

---

### [WARNING] 마이그레이션 — `DROP CONSTRAINT IF EXISTS` 와 `ADD CONSTRAINT` 사이 트랜잭션 의존성

- **위치**: `V042__cafe24_private_app_pending_install.sql`
- **상세**: Flyway는 PostgreSQL에서 DDL 트랜잭션을 지원하므로 일반적으로 안전하다. 그러나 Flyway 설정에서 `outOfOrder`, `mixed`, 또는 외부 migration runner를 사용한다면, CONSTRAINT DROP과 ADD 사이 윈도우에서 다른 INSERT가 임의의 status 값을 삽입할 수 있다. 별도 위험은 낮지만 명시적 주석 처리가 있어야 한다.
- **제안**: 마이그레이션 스크립트에 `BEGIN; ... COMMIT;` 블록을 명시적으로 추가하거나, Flyway 프로젝트 설정에서 transactional DDL이 활성화되어 있음을 확인해야 한다.

---

### [INFO] `ListStatusFilter` — `pending_install` 미포함

- **위치**: `frontend/src/lib/api/integrations.ts:ListStatusFilter`
- **상세**: `IntegrationStatus`에 `pending_install`이 추가됐지만 `ListStatusFilter`에는 포함되지 않아 UI에서 이 상태로 필터링할 수 없다. 현재는 의도적인 설계일 수 있지만, 향후 관리자 화면 등에서 pending_install 건을 일괄 확인해야 할 때 추가 작업이 필요하다.

---

### [INFO] `Cafe24PrivatePendingStep` — 페이지 이탈 시 안내 화면 소실

- **위치**: `frontend/src/app/(main)/integrations/new/page.tsx`
- **상세**: `privatePending` 상태는 React 로컬 state다. 사용자가 페이지를 이탈하면 App URL / Redirect URI 안내 화면이 사라진다. 해당 URL들은 `APP_URL` 기반으로 결정론적이지만, 사용자가 다시 이 정보를 찾으려면 Integration 상세 페이지에서는 볼 수 없고 통합 목록에서 `pending_install` 배지만 보인다.
- **제안**: Integration 상세 페이지(`/integrations/:id`)에서도 `pending_install` 상태일 때 App URL / Redirect URI를 표시해주면 UX가 개선된다.

---

### [INFO] `pending_install` Integration에 대한 만료/정리 메커니즘 부재

- **위치**: `integration-oauth.service.ts`, `V042` 마이그레이션
- **상세**: 사용자가 "테스트 실행"을 끝내 완료하지 않으면 `pending_install` Integration이 DB에 영구 잔류한다. `install_token`은 `OAuth callback 완료 후 NULL로 지워진다`는 주석이 있지만, callback이 오지 않으면 정리되지 않는다. 장기적으로 고아 Integration이 누적될 수 있다.
- **제안**: 유지보수 스캐너(기존 `cleanupExpiredStates` 패턴 참고)에 `pending_install` + 일정 기간(예: 24h) 초과 Integration 정리 로직을 추가하는 것을 고려한다.

---

## 요약

전체적으로 Cafe24 Private 앱 pending_install 흐름의 설계는 타당하고, SQL 마이그레이션과 HMAC 검증 알고리즘도 올바르게 구현되어 있다. 그러나 **테스트의 `mode: 'reconnect'` vs 구현의 `mode: 'reauthorize'` 불일치**는 현재 CI를 깨뜨리는 실제 버그이며, **기존 Private 앱 Integration의 `reauthorize` 시 중복 pending 생성 문제**는 `begin()` early-return 로직이 mode를 무시하는 데서 비롯된 설계 사이드 이펙트다. 프론트엔드의 `reauthorize()` 반환 타입 불일치도 Private 앱 재인증 UX를 조용히 깨뜨린다.

## 위험도

**HIGH** — 테스트 실패(즉각), Private 앱 재인증 경로 미동작(런타임), 프론트엔드 타입 불일치(런타임) 세 건이 동시에 존재한다.