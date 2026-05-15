### 발견사항

---

**[WARNING]** OAuthBeginDto 유효성 검사 데코레이터 단위 테스트 누락
- 위치: `integration.dto.ts` — mallId `@Matches(/^[a-z0-9-]{3,50}$/)`, clientId/clientSecret `@Matches(/^[\x20-\x7E]+$/)`
- 상세: class-validator 데코레이터가 실제 NestJS 파이프라인에서 작동하는지를 검증하는 통합/e2e 테스트가 없음. 서비스 레이어 유닛 테스트는 DTO 파싱 이후만 커버하므로 컨트롤러 진입점에서의 400 반환 여부를 보장하지 못함.
- 제안: `POST /integrations/oauth/begin` e2e 테스트에 `mallId: 'BAD shop!'` 케이스 추가; 또는 `ValidationPipe`를 직접 인스턴스화하는 DTO 레벨 spec 파일 작성

---

**[WARNING]** 컨트롤러의 `providerMeta` 조립 분기 로직 미테스트
- 위치: `integrations.controller.ts:162–176`
- 상세: `cafe24` 서비스 여부, `appType === 'private'` 조건에 따라 `providerMeta` 객체 구조가 달라지는 분기 로직이 컨트롤러 spec에 존재하지 않음. `body.mallId`가 `undefined`인 경우 `{ mall_id: undefined, ... }` 형태가 서비스로 넘어가고, 서비스가 이를 방어하는지 유닛 테스트에서 검증되지 않음.
- 제안: `integrations.controller.spec.ts`에 cafe24 public/private 각각의 분기와 non-cafe24 서비스(providerMeta 생략) 케이스 추가

---

**[WARNING]** `encryptedJsonTransformer` 라운드트립 테스트 누락
- 위치: `integration-oauth-state.entity.ts` — `providerMeta` 컬럼, `V041__integration_oauth_state_provider_meta.sql`
- 상세: 유닛 테스트는 repo를 mock하므로 TypeORM 컬럼 트랜스포머가 실제로 암호화/복호화하는지 검증하지 못함. 마이그레이션 적용 후 `providerMeta`가 DB에 암호문으로 저장되고 callback 시 올바르게 복호화되는지를 보장하는 통합 경로가 없음.
- 제안: OAuth begin→callback 전체를 커버하는 e2e 테스트에서 DB row를 직접 조회해 암호문 여부 확인; 또는 `encryptedJsonTransformer` 자체에 대한 unit spec 추가

---

**[WARNING]** Access token 만료/refresh 경로 미테스트
- 위치: `cafe24-api.client.spec.ts` — 현재 모든 통합에 미래 시점의 `expires_at` 사용
- 상세: `credentials.expires_at`이 과거인 경우(만료 상태) `call()`이 자동 refresh를 시도하는지, 또는 즉시 `Cafe24AuthFailedError`를 던지는지 검증하는 테스트 케이스 없음. 실서비스에서 refresh 로직의 실패 경로가 Integration 상태를 올바르게 `error/auth_failed`로 전환하는지 불명확.
- 제안: `tokenExpiresAt`이 과거인 통합으로 `call()`을 호출하는 테스트와, refresh API 응답을 mocking하는 케이스 추가

---

**[WARNING]** 프론트엔드 Cafe24 전용 검증 로직 미테스트
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx:230–252` (`validateForm` 내 cafe24 분기)
- 상세: mall_id 정규식 검사, appType 유효성, private app 필수 필드 검사가 백엔드 로직을 수동으로 미러링하고 있으나, 이 분기를 커버하는 컴포넌트 테스트가 없음. 프론트엔드 정규식 `/^[a-z0-9-]{3,50}$/`와 백엔드 `CAFE24_MALL_ID_PATTERN`이 일치하는지 자동 검증되지 않음.
- 제안: `Cafe24ExtraFields` 렌더링 테스트 추가; 프론트엔드/백엔드 패턴을 공유 패키지 상수로 추출해 불일치 자체를 방지

---

**[WARNING]** `detect-pending-user-config.ts`의 'cafe24' 추가 미테스트
- 위치: `detect-pending-user-config.ts:62`
- 상세: `SUPPORTED_INTEGRATION_SERVICE_TYPES`에 `'cafe24'`를 추가했을 때 `detectPendingUserConfig`가 cafe24 서비스 타입의 pending config를 올바르게 감지하는지 검증하는 테스트 없음.
- 제안: cafe24 integration이 포함된 워크플로에서 pending config 감지 시나리오 추가

---

**[INFO]** `handleCallback` 스텁 모드 의존 — 실 HTTP 경로 미커버
- 위치: `integration-oauth.service.cafe24.spec.ts` — `process.env.OAUTH_STUB_MODE = 'true'`
- 상세: 모든 cafe24 spec 테스트가 STUB 모드로만 동작하여 실제 Cafe24 토큰 교환 HTTP 요청(`POST /api/v2/oauth/token`) 파싱 경로를 전혀 테스트하지 않음. 응답 필드명 오타(`user_id` vs `cafe24_operator_id` 매핑 등)가 단위 테스트에서 미검출될 수 있음.
- 제안: stub 비활성화 후 fetch를 직접 mock해 실제 토큰 교환 응답 파싱 케이스 최소 1개 추가

---

**[INFO]** 프로덕션 코드에 테스트 헬퍼 노출
- 위치: `cafe24-mcp-tool-provider.ts` — `__resetForTesting()` public 메서드; `cafe24-api.client.ts` — `__resetCafe24LocksForTesting` export
- 상세: 테스트 전용 메서드가 프로덕션 클래스에 직접 노출됨. 이중 언더스코어 컨벤션이 의도를 표시하나, 외부 코드에서 우발적 호출 가능성 존재.
- 제안: `if (process.env.NODE_ENV === 'test')` 가드 추가, 또는 테스트 서브클래스 분리

---

**[INFO]** `cafe24.handler.spec.ts` / `cafe24-api.client.spec.ts` 일부 내용 확인 불가
- 위치: 파일 22(handler spec), 20(api client — 378행에서 truncated)
- 상세: handler의 `success`/`error` 포트 분기, pagination 파라미터 전달, 필드 조립(`path`/`query`/`body` 위치 분류) 테스트 여부를 리뷰 내에서 확인 불가. API 클라이언트의 transport failure 케이스도 잘려 있음.

---

### 요약

전반적인 테스트 품질은 높다. `cafe24-api.client.spec.ts`(인증 실패·속도 제한·재시도), `cafe24-mcp-tool-provider.spec.ts`(buildTools·execute·cleanup 전 사이클), `integration-oauth.service.cafe24.spec.ts`(begin 유효성·happy path·callback), `metadata.spec.ts`(메타데이터 정합성)가 핵심 도메인 로직을 체계적으로 커버한다. 그러나 **DTO 유효성 검사 파이프라인**, **컨트롤러 providerMeta 분기**, **암호화 트랜스포머 라운드트립**, **프론트엔드 cafe24 전용 검증**, **토큰 만료/refresh 경로**에 대한 테스트 공백이 존재하며, 이 영역들이 실운영에서 예상치 못한 회귀를 놓칠 가능성이 있다.

### 위험도

**MEDIUM**