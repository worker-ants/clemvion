## 발견사항

### [CRITICAL] `OAuthBeginDto.mallId` — SSRF 방어 regex 미적용
- **위치**: `backend/src/modules/integrations/dto/integration.dto.ts` — `mallId` 필드
- **상세**: 주석에는 "Validation `/^[a-z0-9-]{3,50}$/` — SSRF 방어"라고 명시되어 있으나, 실제 클래스 데코레이터는 `@IsString()` + `@MaxLength(50)` 만 선언되어 있다. `@Matches(/^[a-z0-9-]{3,50}$/)` 데코레이터가 **빠져 있다**. `mall_id`는 `https://{mall_id}.cafe24api.com/...` 형태로 직접 URL에 삽입되므로, 입력값에 `attacker.com/x?y=` 같은 문자열이 들어오면 OAuth 토큰 교환 요청이 의도치 않은 외부 서버로 향할 수 있다.
- **제안**: 즉시 `@Matches(/^[a-z0-9-]{3,50}$/)` 데코레이터 추가. 서비스 레이어에 2차 검증이 있더라도 DTO가 첫 번째 방어선이어야 한다.

```typescript
// 현재 (취약)
@IsOptional()
@IsString()
@MaxLength(50)
mallId?: string;

// 수정 후
@IsOptional()
@IsString()
@Matches(/^[a-z0-9-]{3,50}$/, { message: 'mallId must be 3-50 lowercase letters, digits, or hyphens' })
@MaxLength(50)
mallId?: string;
```

---

### [WARNING] Private 앱 `client_secret` 평문 JSONB 저장
- **위치**: `V041__integration_oauth_state_provider_meta.sql` / `integration-oauth-state.entity.ts` — `provider_meta` 컬럼
- **상세**: private 앱의 `client_secret`이 OAuth state row의 JSONB 컬럼에 평문으로 기록된다. TTL이 10분이고 콜백 시 DELETE된다는 점은 인정하지만, DB 덤프·슬로우 쿼리 로그·복제 스트림에서 `client_secret`이 노출될 수 있다. 컬럼 코멘트 자체도 `client_secret?`를 열거해 스키마 탐색 시 힌트를 준다.
- **제안**: 저장 전 애플리케이션 수준 암호화(AES-GCM, KMS-managed key) 적용 또는 `client_secret`만 별도 암호화 컬럼에 보관. 최소한 컬럼 코멘트에서 필드 이름 제거.

---

### [WARNING] `clientId` / `clientSecret` DTO 포맷 검증 부재
- **위치**: `integration.dto.ts` — `clientId`, `clientSecret` 필드
- **상세**: 두 필드 모두 `@IsString()` + `@MaxLength()` 만 존재하며, 허용 문자셋 패턴이 없다. `clientSecret` 필드가 `@MaxLength(256)` 만으로 통과되면, 제어 문자나 줄바꿈이 포함된 값이 Basic Auth 헤더 등에 삽입될 가능성이 있다(Header Injection).
- **제안**: `@Matches(/^[\x20-\x7E]{1,256}$/)` 또는 Base64 패턴으로 허용 범위 제한.

---

### [WARNING] 테스트 코드에서 `client_secret`이 authUrl에 포함되지 않는지 검증하지 않음
- **위치**: `integration-oauth.service.cafe24.spec.ts` — `'private app — persists client_id/secret on provider_meta'`
- **상세**: 테스트가 `authUrl`에 `client_id=priv-client-id`가 포함됨을 확인하지만, `client_secret`이 URL에 **포함되지 않음**을 명시적으로 검증하는 단언이 없다. `client_secret`이 인가 URL에 노출되면 서버 로그·브라우저 히스토리·Referer 헤더로 유출된다.
- **제안**: `expect(result.authUrl).not.toContain('client_secret')` 단언 추가.

---

### [WARNING] 프론트엔드 유효성 검사에만 의존하는 구조
- **위치**: `frontend/src/app/(main)/integrations/new/page.tsx` — `validateStep` 내 cafe24 블록
- **상세**: `mall_id` regex 검사, `app_type` 값 검사, private 앱 필수 필드 검사가 **클라이언트 측에만** 존재한다. 위의 DTO `@Matches` 누락과 합쳐지면 직접 HTTP 호출로 검증을 우회할 수 있다.
- **제안**: 프론트엔드 검증은 UX 목적으로만 유지하고, 보안 효과는 전적으로 백엔드 DTO/서비스 레이어에 의존해야 한다. DTO 수정이 선행되어야 한다.

---

### [INFO] MCP 도구 이름 충돌 가능성 — `mcp_<sid>__` prefix 신뢰성
- **위치**: `cafe24-mcp-tool-provider.ts` / 테스트
- **상세**: `sid`는 Integration ID의 앞 8자를 사용한다. UUID v4 기준 충돌 확률은 낮지만, 향후 Integration ID 생성 방식이 바뀌면 두 통합이 같은 `sid`를 가질 가능성이 있다. 현재는 낮은 위험이나 명시적 충돌 검사가 없다.
- **제안**: `buildTools` 단계에서 이미 등록된 `sid`와 중복 시 경고 로그 또는 예외 처리.

---

### [INFO] DB 컬럼 코멘트에 민감 필드명 열거
- **위치**: `V041__integration_oauth_state_provider_meta.sql` — `COMMENT ON COLUMN`
- **상세**: 컬럼 코멘트가 `client_id?, client_secret?`를 명시적으로 언급해, DB 스키마를 열람할 수 있는 내부 공격자에게 찾아볼 필드를 안내하는 격이다.
- **제안**: 코멘트를 `Cafe24: { mall_id, app_type, optional private-app credentials }` 수준으로 추상화.

---

## 요약

이번 변경의 핵심 보안 위험은 두 가지다. 첫째, `OAuthBeginDto.mallId`에서 SSRF 방어용 regex(`@Matches`)가 주석에만 존재하고 실제 데코레이터로는 적용되지 않아, 악의적인 `mall_id` 값이 백엔드로부터 임의 서버로의 HTTP 요청을 유발할 수 있는 SSRF 취약점이 열려 있다. 둘째, private 앱의 `client_secret`이 OAuth state 테이블의 JSONB 컬럼에 평문으로 저장되어 DB 유출 시 자격증명이 노출된다. 나머지 항목들은 보완적 통제(테스트 단언 강화, 헤더 인젝션 방지 패턴 추가)에 해당하며 즉각적 위험은 낮다.

## 위험도

**HIGH** (SSRF 취약점이 수정되기 전까지)