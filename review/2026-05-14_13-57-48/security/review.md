## 발견사항

### **[WARNING]** `client_secret`이 OAuthState.providerMeta에 평문 저장 가능성
- **위치**: `integration-oauth.service.ts` — `handleInstall` 메서드, `stateRecord` 생성부
- **상세**: `providerMeta` 에 `client_secret` 을 포함시켜 `stateRepository.save()` 호출. `IntegrationOAuthState` 엔티티의 `providerMeta` 컬럼이 `encryptedJsonTransformer` 를 적용하지 않으면 `client_secret` 이 `oauth_state` 테이블에 평문 저장됨. `credentials` 컬럼과 달리 상태 테이블의 암호화 여부를 코드상에서 확인할 수 없음.
- **제안**: `IntegrationOAuthState` 엔티티에서 `providerMeta` 컬럼의 `transformer` 설정을 명시적으로 확인하고 `encryptedJsonTransformer` 적용 여부를 검증할 것. 또는 `handleCallback` 이 `pending_install` integration 의 credentials 에서 직접 `client_secret` 을 읽도록 설계를 변경해 상태 테이블에 secret 전파를 제거할 것.

---

### **[WARNING]** 공개 엔드포인트 `/oauth/install/cafe24` 에 속도 제한 없음
- **위치**: `integrations.controller.ts` — `cafe24Install` 핸들러 (no `@Throttle`)
- **상세**: `@Public()` 으로 인증 없이 접근 가능하며, 요청마다 전체 `pending_install` 상태의 Cafe24 integration 을 DB에서 조회함 (`getMany()`). 요청이 많아지면 DB 부하가 선형적으로 증가. 다른 OAuth 엔드포인트(`/oauth/begin`)와 달리 throttle 데코레이터가 없음.
- **제안**: `@Throttle({ default: { limit: 30, ttl: 60_000 } })` 수준의 속도 제한 추가. `mall_id` 또는 요청 IP 기준 슬라이딩 윈도우를 고려.

---

### **[WARNING]** 에러 핸들러에서 내부 예외 메시지 외부 노출
- **위치**: `integrations.controller.ts` — `cafe24Install` catch 블록 (line: `e.message ?? 'Install failed'`)
- **상세**: DB 연결 실패, 예외 스택 메시지 등 내부 오류의 `e.message` 가 여과 없이 응답 body 에 포함될 수 있음. 호출자가 Cafe24 이지만 응답 내용은 로그/모니터링에 기록되며 내부 인프라 정보를 노출할 수 있음.
- **제안**: 알려진 예외 코드(`CAFE24_INSTALL_*`)만 그대로 반환하고, 나머지는 `'Internal server error'` 처럼 제네릭 메시지로 대체. NestJS 표준 예외 필터를 활용하거나 catch 블록 내 `e instanceof HttpException` 분기로 제한할 것.

---

### **[INFO]** `installToken` 생성되지만 검증 로직에서 미사용 (dead code)
- **위치**: `integration-oauth.service.ts` — `createPrivatePendingIntegration` 및 `handleInstall`
- **상세**: DB 마이그레이션 주석과 엔티티 컬럼 설명은 `installToken` 이 "HMAC 검증 보조용"으로 `pending_install` Integration 을 특정하는 데 쓰인다고 명시. 실제로는 `handleInstall` 이 `installToken` 을 전혀 읽거나 비교하지 않고, HMAC 검증만으로 타깃을 식별함. 토큰은 생성·저장·삭제되지만 식별에 기여하지 않음.
- **제안**: `installToken` 컬럼과 관련 코드를 제거하거나, 실제로 사용하는 방향(예: Cafe24 가 App URL 에 token 을 포함해 전달하도록 요청 파라미터로 활용)으로 설계를 명확히 할 것. 미사용 엔트로피·컬럼·DB nulling 코드를 유지하는 것은 혼란 유발.

---

### **[INFO]** TypeORM QueryBuilder 에 하드코딩 문자열 리터럴 패턴
- **위치**: `integration-oauth.service.ts` — `handleInstall`, QueryBuilder `.where()`/`.andWhere()` 호출
- **상세**: `"i.service_type = 'cafe24'"` 와 `"i.status = 'pending_install'"` 가 SQL 인라인 리터럴로 전달됨. 현재는 상수이므로 SQL 인젝션 위험 없으나, 이 패턴을 복사한 코드에 사용자 입력이 들어가면 즉시 취약점이 됨.
- **제안**: 파라미터 바인딩 방식으로 변경:
  ```typescript
  .where('i.serviceType = :type', { type: 'cafe24' })
  .andWhere('i.status = :status', { status: 'pending_install' })
  ```

---

### **[INFO]** 테스트-구현 간 상태 모드 불일치 (`'reconnect'` vs `'reauthorize'`)
- **위치**: `integration-oauth.service.cafe24.spec.ts` — `expect(savedState.mode).toBe('reconnect')` / `integration-oauth.service.ts` — `mode: 'reauthorize'`
- **상세**: 테스트는 생성된 OAuthState 의 `mode` 필드를 `'reconnect'` 로 기대하지만 서비스 구현은 `'reauthorize'` 로 저장. `handleCallback` 은 `integration.status === 'pending_install'` OR 조건으로 동작하므로 기능상 차이는 없으나, 테스트가 실제 구현을 검증하지 못하고 있음.
- **제안**: 테스트 기대값을 `'reauthorize'` 로 수정하거나, 서비스 코드의 의도가 `'reconnect'` 라면 유효한 모드 타입에 추가하고 서비스를 수정할 것.

---

## 요약

전반적인 보안 구현 수준은 양호하다. HMAC 검증에 `timingSafeEqual` 을 사용하고, `randomBytes(32)` 로 토큰을 생성하며, 타임스탬프 재전송 공격 방어(±5분 윈도우), `client_secret` 의 authorize URL 미포함 검증 등 핵심 암호화 설계는 올바르게 구현되었다. 주요 우려사항은 OAuthState 의 `providerMeta` 암호화 여부 미확인(`client_secret` 평문 저장 가능성), 공개 엔드포인트의 rate limiting 부재, 그리고 `installToken` 의 미사용 dead code 세 가지이다. SQL 인젝션·XSS·경로 탐색 등 OWASP Top 10 의 직접적인 취약점은 발견되지 않았다.

## 위험도

**MEDIUM** — 암호화 로직 자체는 견고하나, OAuthState providerMeta 암호화 미확인과 rate limiting 부재가 운영 환경에서 실질적 위험으로 이어질 수 있음.