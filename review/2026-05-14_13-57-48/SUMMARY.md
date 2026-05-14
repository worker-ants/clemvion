# Code Review 통합 보고서

## 전체 위험도
**HIGH** — CI를 즉시 깨뜨리는 테스트 버그, 핵심 상태 전이 테스트 공백, O(n) 전수 스캔 + `install_token` 미활용이라는 설계 미완성이 동시에 존재한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Correctness | **테스트 `mode` 값 불일치 — CI 즉시 실패** · 구현은 `mode: 'reauthorize'`로 OAuthState를 저장하지만 테스트는 `'reconnect'`을 단언. 현재 코드 기준 테스트 스위트가 반드시 실패한다. | `integration-oauth.service.ts:handleInstall()` vs `integration-oauth.service.cafe24.spec.ts` | 테스트 단언을 `'reauthorize'`로 수정. 또는 구현이 `'reconnect'`를 의도한다면 서비스 코드와 callback 분기 조건을 함께 변경. |
| 2 | Performance | **`handleInstall` — 전체 `pending_install` 행 메모리 적재 후 O(n) HMAC 검증** · `mall_id` 필터 없이 `.getMany()`로 전체 행을 가져온 뒤 credentials를 복호화하며 순회. 행 수에 비례해 복호화 + 해싱 비용이 증가하며 상한이 없다. | `integration-oauth.service.ts:handleInstall()` | `install_token`을 App URL 파라미터로 전달해 단일 인덱스 조회로 전환하거나, `mall_id` 기반 DB 필터를 추가. `.take(100)` limit 최소 방어 처리. |
| 3 | Testing | **`handleCallback` — `pending_install` 분기 테스트 전무** · callback 흐름에 `integration.status === 'pending_install'` 조건이 추가되었으나 해당 경로에 대한 테스트가 없음. `installToken = null` 초기화도 미검증. | `integration-oauth.service.ts:393–413` + spec 파일 | `state.mode='reauthorize'` + `integration.status='pending_install'` 픽스처로 콜백 테스트 추가, `installToken`이 `null`로 저장되는지 검증. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Design / Dead Code | **`install_token` 컬럼 — 생성·저장·소거되지만 식별에 미사용** · 마이그레이션 주석은 "HMAC 검증 보조용, pending Integration 특정에 사용"이라 설명하나 `handleInstall` 쿼리는 이 컬럼을 전혀 읽지 않음. 설계 의도의 절반이 구현되지 않은 상태. | `V042` migration + `createPrivatePendingIntegration` + `handleInstall` | (a) `install_token`을 App URL 쿼리 파라미터로 포함시켜 단일 행 lookup에 활용하거나 (b) 컬럼·관련 코드 전체 제거. |
| 2 | Security | **`client_secret`이 `OAuthState.providerMeta`에 저장 — 암호화 여부 미확인** · `handleInstall`에서 `providerMeta: { client_id, client_secret, ... }`를 state row에 저장. `integration.credentials`는 암호화되지만 `oauth_state.provider_meta`가 동일 transformer를 적용하지 않으면 평문 저장됨. | `integration-oauth.service.ts:handleInstall()` stateRecord 생성부 | `IntegrationOAuthState.providerMeta`에 `encryptedJsonTransformer` 적용 여부 확인. 또는 callback에서 `integrationId`로 credentials를 직접 조회해 `client_secret`을 providerMeta에서 제거. |
| 3 | Side Effect | **`reauthorize`/`requestScopes` — Private 앱에서 기존 Integration 대신 새 `pending_install` 중복 생성** · `begin()`이 `app_type === 'private'`이면 mode에 무관하게 즉시 `createPrivatePendingIntegration()`으로 early-return. 이미 `connected`인 Private 앱을 재인증하면 새 pending_install 행이 생성되고 기존 Integration은 그대로 남음. | `integration-oauth.service.ts:begin()` 분기 | `mode === 'new'`일 때만 `createPrivatePendingIntegration()`을 호출하도록 조건 추가. `reauthorize`/`requestScopes` 경로의 Private 앱 처리 전략을 명시적으로 정의. |
| 4 | API Contract | **프론트엔드 `reauthorize()` 반환 타입 불일치** · 백엔드 `reauthorize` 반환 타입이 `BeginResult` Union으로 변경됐으나 프론트엔드 클라이언트는 여전히 `Promise<{ authUrl: string; state: string }>`로 고정. Private 앱 재인증 시 `cafe24_private_pending` shape이 반환되면 `authUrl`을 읽으려다 조용히 실패. | `frontend/src/lib/api/integrations.ts:reauthorize()` | `oauthBegin`과 동일한 Union 타입으로 반환 타입 수정, 호출부 UI에서 `mode === 'cafe24_private_pending'` 분기 처리. |
| 5 | Security / Availability | **공개 엔드포인트 `/oauth/install/cafe24`에 rate limiting 없음** · `@Public()`으로 인증 없이 접근 가능하며 요청마다 전체 `pending_install` 행 조회. 다른 OAuth 엔드포인트와 달리 `@Throttle` 미적용. | `integrations.controller.ts:cafe24Install` | `@Throttle({ default: { limit: 30, ttl: 60_000 } })` 추가. |
| 6 | Design | **`pending_install` 만료/정리 메커니즘 부재** · "테스트 실행"을 완료하지 않으면 행이 영구 잔류. 동일 `mall_id`로 `begin()`을 반복 호출하면 pending_install이 누적되어 HMAC 순회 비용도 증가. | 전반 설계, migration | 24~48h TTL 기준 스캐너(`@Cron`) 추가 또는 `createPrivatePendingIntegration` 시 동일 `workspaceId + mall_id`의 기존 pending_install 행 선삭제. |
| 7 | Performance | **`verifyHmac` — 후보마다 `rawQuery` 재파싱** · 요청당 고정값인 `rawQuery`를 후보 n명마다 `new URLSearchParams()` → sort → serialize → HMAC 계산 반복. | `integration-oauth.service.ts:handleInstall()` 내 루프 + `verifyHmac()` | 루프 진입 전 message 문자열을 한 번만 구성. HMAC secret만 후보별로 교체. |
| 8 | Concurrency | **`handleInstall` TOCTOU — OAuthState 중복 생성 가능** · pending_install 조회 → HMAC 검증 → OAuthState 저장까지 트랜잭션/잠금 없음. Cafe24가 재시도 또는 중복 호출 시 동일 Integration에 state 행 2개 생성 가능. | `integration-oauth.service.ts:handleInstall()` | `handleInstall` 전체를 `dataSource.transaction()`으로 감싸고 `findOne({ lock: { mode: 'pessimistic_write' } })`로 타깃 잠금. |
| 9 | API Contract | **`BeginResult` 유니온에 일관된 discriminant 없음** · 표준 OAuth 결과 측에 `kind` 같은 discriminant가 없어 call-site에서 `"mode" in result`·`"authUrl" in result` 혼용. 향후 variant 추가 시 exhaustive check 불가. | `integration-oauth.service.ts:74–83`, `new/page.tsx:162–170` | `{ kind: 'oauth'; authUrl; state }` \| `{ kind: 'cafe24_private_pending'; ... }` 형태로 `kind` 필드 추가. |
| 10 | Testing | **`handleCallback` 외 컨트롤러·프론트엔드 테스트 공백** · `cafe24Install` 컨트롤러 핸들러(파라미터 누락, rawQuery 추출, 에러 코드 매핑) 및 `Cafe24PrivatePendingStep`, `needsAttention` 변경에 대한 테스트 없음. | `integrations.controller.ts:cafe24Install`, `status-badge.tsx`, `new/page.tsx` | 컨트롤러 단위 테스트(req.url 목업, 파라미터 누락→400), `needsAttention('pending_install')→false` 단위 테스트 추가. |
| 11 | Documentation | **Spec API 표 에러 코드와 구현 불일치** · spec에 `CAFE24_INSTALL_NO_PENDING`(404)가 별도 에러로 등록되나 구현은 pending 미발견 시 `CAFE24_INSTALL_INVALID_HMAC`(403)으로 통합 처리. | `spec/2-navigation/4-integration.md` §9.2 | spec 해당 셀을 `CAFE24_INSTALL_INVALID_HMAC(403)`으로 수정하고 "(pending 미발견 포함 — 정보 노출 방지)" 추가. |
| 12 | API Contract | **`reauthorize`/`requestScopes` 반환 타입이 실제 범위보다 넓음** · 두 메서드가 `Promise<BeginResult>` 반환 선언이나 이 경로에서 `cafe24_private_pending`은 절대 반환되지 않음. 호출자에 불필요한 타입 좁히기 부담. | `integrations.service.ts:666, 738` | 반환 타입을 `Promise<Extract<BeginResult, { kind: 'oauth' }>>` 또는 별도 alias로 좁혀 선언. |
| 13 | UX | **버튼 레이블과 라우트 불일치** · i18n 키 `cafe24PrivatePendingViewList`가 "통합 목록으로 이동"으로 정의되나 실제 라우트는 `/integrations/${integrationId}` (개별 상세 페이지). | `frontend/src/app/(main)/integrations/new/page.tsx`, i18n dict | (a) 라우트를 `/integrations`(목록)로 변경하거나 (b) i18n 텍스트를 "통합 상세 보기"로 수정. |
| 14 | API Contract | **`cafe24Install` 에러 응답 형식 — 글로벌 필터 우회** · 다른 엔드포인트는 NestJS 예외 필터로 `{ statusCode, message, error }` 반환하지만 이 핸들러는 직접 `{ code, message }`를 조립. 에러 파싱 로직 공유 시 파싱 실패. | `integrations.controller.ts:209–248` | `extractHttpError(err)` 유틸 함수로 에러 분해 로직 추출해 `oauthCallback`과 공유. |
| 15 | API Contract | **Swagger 응답 스펙 부정확** · `cafe24Install`이 실제로 302 redirect를 반환하나 `@ApiOkResponse`(200)으로 선언. `OAuthBeginResultDto`에 `cafe24_private_pending` shape 미반영. | `integrations.controller.ts:192` | `@ApiResponse({ status: 302 })` 적용, `OAuthBeginResultDto`에 Union 형태 추가. |
| 16 | Database | **마이그레이션 `ACCESS EXCLUSIVE` 락 — 점검 필요** · CHECK constraint DROP+ADD가 각각 ACCESS EXCLUSIVE 락 획득, 기존 전체 행 즉시 검증. 운영 환경에서 트래픽 차단 발생 가능. | `V042__cafe24_private_app_pending_install.sql:20–25` | 메인터넌스 윈도우에 실행하거나 `ADD CONSTRAINT ... NOT VALID` + 별도 `VALIDATE CONSTRAINT`로 분리. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Spec | **`active` 오기 — 유효 status는 `connected`** · spec changelog와 상태 전이 다이어그램 주석에 `pending_install → active`로 기재. | `spec/4-nodes/4-integration/4-cafe24.md`, `spec/2-navigation/4-integration.md` | `active` → `connected`로 수정. |
| 2 | Documentation | **`APP_URL` 환경변수 문서 누락** · 코드에서 `process.env.APP_URL`을 사용하지만 영문·한국어 문서의 환경변수 표에 미기재. | `cafe24.en.mdx`, `cafe24.mdx` 환경변수 표 | `APP_URL \| App URL base (기본값: http://localhost:3011)` 행 추가. |
| 3 | API Contract | **`ListStatusFilter`에 `pending_install` 미포함** · `IntegrationStatus`에 `pending_install`이 추가됐으나 목록 필터 타입에서 누락. | `frontend/src/lib/api/integrations.ts:ListStatusFilter` | 지원 여부 명시적 결정 후 필요시 추가. |
| 4 | Database | **TypeORM QueryBuilder에 snake_case 컬럼명 직접 사용** · `"i.service_type = 'cafe24'"` 처럼 원시 SQL 문자열 사용. 컬럼명 변경 시 런타임에서야 오류 발생. 보안 취약점은 없으나 관행 불일치. | `integration-oauth.service.ts:handleInstall()` QueryBuilder | `.where('i.serviceType = :type', { type: 'cafe24' })` 파라미터 바인딩으로 변경. |
| 5 | Database | **`(service_type, status)` 복합 인덱스 부재** · `pending_install` 행이 소수인 현재는 영향 미미하나 테이블 규모 증가 시 전체 스캔. | `V042` migration | `CREATE INDEX idx_integration_service_status ON integration(service_type, status);` 추가 고려. |
| 6 | Maintainability | **`verifyHmac` HMAC 로직이 테스트 헬퍼에 중복 구현** · 프로덕션 함수와 `computeTestHmac`이 동일 알고리즘을 각각 독립 구현. 알고리즘 변경 시 두 곳 수정 필요. | `integration-oauth.service.ts` + spec 파일 | `verifyHmac`을 export하거나 유틸 모듈로 분리해 테스트가 동일 함수를 직접 호출하도록 변경. |
| 7 | Maintainability | **`APP_URL` 폴백 문자열 두 곳 중복** · `process.env.APP_URL \|\| 'http://localhost:3011'`이 `createPrivatePendingIntegration`과 `handleInstall`에 각각 존재. | `integration-oauth.service.ts` | 클래스 상수로 추출. `process.env.APP_URL`이 production에서 누락 시 경고/예외 발생 권장. |
| 8 | UX | **`pending_install` 안내 화면 — 페이지 이탈 시 소실** · App URL / Redirect URI 안내가 React 로컬 state로만 존재. 이탈 후 재확인 불가. | `new/page.tsx:Cafe24PrivatePendingStep` | Integration 상세 페이지에서도 `pending_install` 상태일 때 동일 URL 표시. |
| 9 | Maintainability | **`stateRecord.mode = 'reauthorize'` 의미론적 혼동** · `pending_install → connected` 최초 설치이나 `'reauthorize'` mode 재사용. 신규 개발자에게 혼란 유발. | `integration-oauth.service.ts:handleInstall()` | `'install'` mode 별도 추가 또는 의도를 설명하는 인라인 주석 추가. |
| 10 | Documentation | **`handleInstall` JSDoc — `CAFE24_INSTALL_NO_PENDING` 처리 미기술** · JSDoc에 두 에러 코드만 열거되고 pending 미발견 시 403 통합 처리 이유 미기재. | `integration-oauth.service.ts:648–653` | JSDoc에 "no_pending은 INVALID_HMAC(403)으로 통합 처리 — 정보 노출 방지" 한 줄 추가. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Performance | HIGH | `handleInstall` O(n) 전수 스캔, `verifyHmac` 중복 파싱, `install_token` 미활용 |
| Testing | HIGH | `mode` 불일치로 CI 즉시 실패, `handleCallback` pending_install 분기 테스트 전무 |
| API Contract | HIGH | `BeginResult` discriminant 불일치, `client_secret` 평문 저장 위험, Swagger 스펙 오류 |
| Requirement | HIGH | 테스트 mode 불일치, `installToken` 명세-구현 모순, rate limiting 부재, 버튼 라우트 오류 |
| Side Effect | HIGH | Private 앱 재인증 시 pending_install 중복 생성, 프론트엔드 반환 타입 불일치 |
| Architecture | MEDIUM | `install_token` dead code, `pending_install` TTL 미구현, `BeginResult` discriminant |
| Scope | MEDIUM | `mode` 불일치, `install_token` dead code, `active` 오기 |
| Security | MEDIUM | `client_secret` 평문 저장 가능성, rate limiting 부재, 에러 메시지 내부 노출 |
| Concurrency | LOW | TOCTOU race in `handleInstall`, 중복 click 방어 |
| Database | LOW | ACCESS EXCLUSIVE 락, 인덱스 부재, TypeORM 컬럼명 |
| Documentation | LOW | Spec API 표 에러 코드 불일치, `APP_URL` 환경변수 누락 |
| Maintainability | LOW | HMAC 로직 중복, `APP_URL` 폴백 중복, `BeginResult` 타입 비대칭 |
| Dependency | NONE | 신규 외부 패키지 없음, 내부 타입 공유 단방향 |

---

## 발견 없는 에이전트

- **Dependency** — 신규 외부 패키지 없음. 기존 `crypto`, `@nestjs/common`, `lucide-react`에서 심볼 추가만 있으며 순환 의존 없음.

---

## 권장 조치사항

1. **[즉시]** 테스트 `mode` 단언 수정 — `'reconnect'` → `'reauthorize'` (또는 구현 정렬). CI 복구가 최우선.
2. **[즉시]** `handleCallback` — `pending_install` 분기 테스트 추가 및 `installToken = null` 검증.
3. **[높음]** `install_token` 설계 결정 — (a) App URL에 포함해 단일 인덱스 lookup으로 O(n) 스캔 제거 또는 (b) 완전 제거. 현재 dead code 상태 해소.
4. **[높음]** `reauthorize`/`requestScopes`에서 Private 앱 호출 시 `pending_install` 중복 생성 버그 수정 — `begin()` early-return을 `mode === 'new'` 조건으로 한정.
5. **[높음]** `OAuthState.providerMeta` 암호화 여부 확인 — `encryptedJsonTransformer` 미적용 시 `client_secret` 평문 저장 차단.
6. **[높음]** 프론트엔드 `reauthorize()` 반환 타입 `BeginResult` Union으로 동기화 + UI 분기 처리.
7. **[중간]** `/oauth/install/cafe24`에 `@Throttle()` 추가.
8. **[중간]** `pending_install` TTL 스캐너 구현 — 24h 초과 미완료 행 정리.
9. **[중간]** Spec API 표 에러 코드 수정 (`CAFE24_INSTALL_NO_PENDING` 404 → 실제 동작인 403으로).
10. **[낮음]** `active` 오기(`connected`)·`APP_URL` 문서 누락·버튼 라우트 레이블 일괄 수정.