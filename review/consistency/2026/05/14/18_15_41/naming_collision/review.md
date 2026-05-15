검색 결과를 종합하여 명명 충돌 분석을 완료합니다.

---

## 발견사항

### [WARNING] `CAFE24_INSTALL_INVALID_HMAC` — 동일 코드의 의미 축소

- **target 신규 적용**: DRAFT 2E §9.2 — "HMAC 검증 실패만" 의미로 사용
- **기존 사용처**: `spec/2-navigation/4-integration.md:653` — `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함 — 정보 노출 방지)` / `spec/4-nodes/4-integration/4-cafe24.md:431` — "HMAC 미일치 → 403"
- **상세**: 코드 문자열 자체는 보존되나 의미가 변함 — "pending 미발견" 케이스가 신규 `CAFE24_INSTALL_INVALID_TOKEN(404)`로 분리됨. 현재 spec 두 곳 모두 이 코드가 "token not found" 케이스를 포함한다고 명시. draft는 Rationale I7에서 "내부 테스트는 404에 대응해야 한다"고만 언급하며, spec 본문 대체(replace) 패치를 통해 해소하려 함.
- **제안**: DRAFT 2E와 DRAFT 2J의 replace 패치가 spec 두 곳(`4-integration.md:653` + `4-cafe24.md:431`)을 모두 명시적으로 갱신하는지 확인. 특히 `4-cafe24.md:430-431`이 갱신 목록(§2J-2)에는 있으나 `4-integration.md:653` 원본 행 삭제가 DRAFT 2E replace 패치에 포함되어 있는지 재확인 필요.

---

### [WARNING] `oauth_token_exchange_failed` (DB status_reason) vs `token_exchange_failed` (auth URL param)

- **target 신규 식별자**: `status_reason='oauth_token_exchange_failed'` — DRAFT 1C, DRAFT 2D, DRAFT 3B
- **기존 사용처**: `backend/src/modules/auth/auth.controller.ts:543` — 소셜 로그인 OAuth 실패 시 URL 파라미터 `token_exchange_failed` 사용 (oauth_ prefix 없음). `spec/2-navigation/10-auth-flow.md:326` — `?error=token_exchange_failed`로 명시.
- **상세**: 의미 도메인이 다름(소셜 로그인 vs. 통합 OAuth callback)이지만 `oauth_token_exchange_failed`와 `token_exchange_failed`가 사실상 동일 에러를 가리키는 유사 이름으로 코드베이스에 공존. 추가로 `OAUTH_TOKEN_EXCHANGE_FAILED`(UPPER_SNAKE_CASE 에러 코드)는 `auth-oauth.service.ts`와 `integration-oauth.service.ts` 양쪽에서 이미 사용 중이므로 DB 저장값 식별자에 `oauth_` prefix를 붙여 구분하는 것이 의도라면 명시적 코멘트 권장.
- **제안**: spec Rationale에 "소셜 로그인 URL param `token_exchange_failed` (auth 도메인)과 통합 callback `status_reason='oauth_token_exchange_failed'` (integration 도메인)는 서로 다른 시스템의 동일 의미"라는 한 줄을 추가하면 충분. 이름 변경 불필요.

---

### [INFO] `OAUTH_TOKEN_EXCHANGE_FAILED` 에러 코드가 두 모듈에서 이미 사용 중

- **target 신규 식별자**: `status_reason='oauth_token_exchange_failed'` (snake_case DB 저장값)
- **기존 사용처**: `backend/src/modules/auth/auth-oauth.service.ts:197,204,214` + `backend/src/modules/integrations/integration-oauth.service.ts:607,621,785` — 동일한 에러 코드 문자열을 두 도메인에서 공유 사용
- **상세**: draft의 DB 저장값 `oauth_token_exchange_failed`는 기존 코드 에러 코드 `OAUTH_TOKEN_EXCHANGE_FAILED`를 snake_case로 표현한 것. 충돌 없음. 정보성 메모.

---

### [INFO] `statusReason: 'waiting'` — 미문서화 테스트 값

- **기존 사용처**: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts:449` — `statusReason: 'waiting'` 픽스처
- **상세**: 현재 spec도 draft도 `'waiting'`을 `status_reason` 유효값으로 정의하지 않음. draft DRAFT 1C / DRAFT 3B가 status_reason 후보값을 명시적으로 열거하면서 이 값이 잔존하면 정합성 불명확. 테스트 mock 픽스처에서 임의 문자열로 사용된 것으로 보이나, 구현자가 혼동할 수 있음.
- **제안**: draft 구현 착수 시 해당 테스트 픽스처를 `oauth_token_exchange_failed` 등 draft 정의 값으로 교체.

---

### [INFO] `install_token` 컬럼과 `pending_install` 상태는 이미 코드에 존재 — spec 추격 패치

- **기존 사용처**: `backend/migrations/V042__cafe24_private_app_pending_install.sql:13` — `ADD COLUMN install_token VARCHAR(64) NULL`. `backend/src/modules/integrations/entities/integration.entity.ts:20,58-59` — `'pending_install'` status union + `installToken` 필드
- **상세**: DRAFT 1A(status enum 행 갱신)·DRAFT 1B(`install_token` 컬럼 삽입)는 코드가 앞서 구현되어 있고 spec이 따라가는 catchup 패치. 신규 명명 도입이 아니므로 충돌 없음.

---

## 요약

도입 식별자 중 **충돌하는 이름은 없다.** 다만 `CAFE24_INSTALL_INVALID_HMAC`의 의미가 좁아지면서 현재 spec 두 곳의 문구를 모두 replace 해야 하므로, 해당 replace 패치가 두 파일(`4-integration.md`·`4-cafe24.md`) 모두를 명시적으로 커버하는지 검증이 필요하다. `oauth_token_exchange_failed`·`token_exchange_failed`의 이름 유사성은 도메인이 달라 기능 충돌은 없지만, spec Rationale에 한 줄 주석을 추가하면 충분히 해소된다.

## 위험도

**LOW**