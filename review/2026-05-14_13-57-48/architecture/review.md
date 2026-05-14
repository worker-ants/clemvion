## 발견사항

---

### [WARNING] `install_token` 컬럼이 생성·소거되지만 실제 매칭/검증에 사용되지 않음
- **위치**: `V042 migration` (ADD COLUMN install_token), `integration-oauth.service.ts:createPrivatePendingIntegration` (installToken 생성), `handleCallback` (+integration.installToken = null)
- **상세**: `createPrivatePendingIntegration`에서 `randomBytes(32).toString('hex')`로 토큰을 생성하고 DB에 저장하지만, `handleInstall`에서 pending integration을 찾는 로직은 `install_token`을 전혀 조회하지 않는다. HMAC 검증 대상은 `client_secret`이고, 식별 전략은 "전체 pending 목록 로드 후 HMAC brute-force"다. 컬럼 코멘트도 "HMAC 검증 보조용"이라 하지만 실제 코드에서는 역할이 없다. 이전 설계 시안의 잔류물로 보인다.
- **제안**: `install_token` 컬럼과 `Integration.installToken` 필드를 제거하거나, 반대로 `handleInstall` 쿼리에서 `install_token`을 lookup key로 사용하는 방향으로 일원화. 후자라면 `appUrl`에 `?install_token=...`를 포함시켜 Cafe24 App URL로 전달해야 한다.

---

### [WARNING] HMAC 후보 탐색이 DB 레벨 필터 없이 전수 로드 + TypeORM 컬럼 이름 혼용
- **위치**: `integration-oauth.service.ts:handleInstall` (약 650행 부근)
- **상세**:
  ```typescript
  .where("i.service_type = 'cafe24'")   // 원시 SQL snake_case
  .andWhere("i.status = 'pending_install'")
  .getMany();
  ```
  두 가지 문제가 겹쳐 있다. ① TypeORM QueryBuilder에서 alias 기준 프로퍼티명은 엔티티의 camelCase여야 하는데(`i.serviceType`), 원시 컬럼명(`service_type`)을 직접 사용하고 있다. 컬럼명이 바뀌면 TypeORM 매핑을 우회해 조용히 깨진다. ② `mall_id`가 JSONB 안에 있어 DB 필터에 넣기 어렵더라도 최소한 `mall_id` 기준 메모리 필터는 먼저 수행해야 HMAC 검증(암호화 해제 + 해싱)을 최소화할 수 있다. 현재는 모든 pending integration의 credentials를 복호화한 뒤 HMAC를 시도한다.
- **제안**: `.where('i.serviceType = :st', { st: 'cafe24' }).andWhere('i.status = :s', { s: 'pending_install' })`로 수정. `mall_id` 필터를 `for` 루프 안에서 HMAC 이전에 먼저 처리하는 것은 현재도 되어 있으므로 기본 성능은 유지 가능하나, 스케일 아웃 시 `install_token` 기반 direct lookup이 유일한 O(1) 해법이다.

---

### [WARNING] `BeginResult` 유니온에 일관된 discriminant가 없어 call-site 타입 좁히기가 취약함
- **위치**: `integration-oauth.service.ts:74-83`, `new/page.tsx:162-170`, `integrations.ts:oauthBegin`
- **상세**: 표준 OAuth 결과 측에 `type` 같은 discriminant가 없어 좁히기가 구조적으로 불안정하다.
  ```typescript
  // 현재
  if ("mode" in result && result.mode === "cafe24_private_pending") ...
  if (!("authUrl" in result)) return;
  ```
  향후 제3의 BeginResult 변형(예: 다른 provider의 pending 상태)이 추가되면 모든 call-site를 수동으로 찾아서 고쳐야 한다. TypeScript exhaustive check도 불가능하다.
- **제안**:
  ```typescript
  type BeginResult =
    | { kind: 'oauth'; authUrl: string; state: string }
    | { kind: 'cafe24_private_pending'; integrationId: string; appUrl: string; callbackUrl: string };
  ```
  `kind` 필드를 추가하면 `switch (result.kind)` 패턴으로 exhaustive check가 가능하다. 백엔드 응답 직렬화와 프론트엔드 타입을 함께 변경해야 한다.

---

### [WARNING] `reauthorize()` / `requestScopes()` 반환 타입이 실제 범위보다 넓음
- **위치**: `integrations.service.ts:666`, `integrations.service.ts:738`
- **상세**: 두 메서드가 `Promise<BeginResult>`를 반환하도록 선언됐지만 이 경로에서는 `cafe24_private_pending`이 절대 반환되지 않는다. `begin()` 내부에서 `pending_install` 생성은 `mode === 'new'`이고 `app_type === 'private'`일 때만 실행되며, `reauthorize`/`requestScopes`는 별도 진입점이다. 반환 타입이 `{ authUrl: string; state: string }`보다 넓게 선언되어 call-site에서 불필요한 타입 좁히기가 요구된다.
- **제안**: 해당 메서드의 반환 타입을 `Promise<Extract<BeginResult, { kind: 'oauth' }>>` 또는 별도 타입 alias로 좁혀 선언한다.

---

### [WARNING] `pending_install` 정리(cleanup) 메커니즘 미구현
- **위치**: 설계 전반 (migration, service, spec `§6 상태 전이`)
- **상세**: Spec의 상태 전이 다이어그램에는 `pending_install → (삭제)` 경로가 명시되어 있고, "install timeout / manual delete"가 트리거라고 기술되어 있다. 그러나 어떤 코드도 이 정리를 구현하지 않는다. 사용자가 Cafe24 "테스트 실행"을 끝내지 않으면 `pending_install` 레코드가 영구적으로 잔류한다. `HMAC brute-force` 탐색 대상이 커지는 문제와 직결된다.
- **제안**: 생성 시각 기준 N시간(예: 24h) 이후의 `pending_install` 통합을 주기적으로 삭제하는 스케줄러(`@Cron`)나 만료 스캐너를 추가한다. `createdAt` + TTL 비교면 충분하며, `install_token`이 남는다면 TTL 컬럼으로 대체 가능하다.

---

### [WARNING] `cafe24Install` 컨트롤러에서 NestJS 예외 필터를 우회하는 수동 에러 처리
- **위치**: `integrations.controller.ts:cafe24Install` (약 220-240행)
- **상세**: `@Res()` 사용으로 NestJS가 응답을 가로채지 못하므로, `BadRequestException`·`ForbiddenException`이 `catch` 블록에서 수동으로 분해된다.
  ```typescript
  const status = e.status ?? 400;
  const code = e.response?.code ?? 'CAFE24_INSTALL_FAILED';
  ```
  이 패턴은 `oauthCallback`에도 이미 존재하며 이제 두 곳에 중복된다. 예외 구조가 바뀌면 두 곳을 동시에 수정해야 하고, 실수로 `ForbiddenException(403)`이 `400`으로 반환되는 regression이 쉽게 발생한다.
- **제안**: 에러 분해 로직을 `extractHttpError(err)` 유틸 함수로 추출하거나, 두 엔드포인트를 공통 base 메서드를 통해 처리하는 방향으로 리팩토링한다.

---

### [INFO] `handleInstall` 메서드가 5가지 책임을 단일 메서드에서 처리
- **위치**: `integration-oauth.service.ts:handleInstall`
- **상세**: ① 타임스탬프 검증, ② DB 조회, ③ HMAC 검증 루프, ④ OAuthState 생성, ⑤ 인증 URL 조합. 각각 private 메서드로 분리할 수 있으나, 현재 길이(약 80행)가 당장 가독성을 크게 해치지는 않는다.
- **제안**: 프로덕션 트래픽이 늘거나 다른 provider도 App URL 패턴을 도입할 경우 단계별 분리를 검토한다.

---

### [INFO] `stateRecord.mode = 'reauthorize'`의 의미론적 불일치
- **위치**: `integration-oauth.service.ts:handleInstall` (stateRecord 생성 부분)
- **상세**: `pending_install` → `connected` 전환은 최초 설치지만, OAuthState에 `mode: 'reauthorize'`를 설정한다. `handleCallback`에서 `reauthorize` 분기를 타게 하기 위한 의도적 선택으로, credentials를 교체하는 동작이 맞지만 신규 개발자에게 혼란을 줄 수 있다.
- **제안**: `mode` 값을 `'install'`로 추가하거나, 최소한 인라인 주석으로 의도를 설명한다.

---

## 요약

Cafe24 Private 앱 OAuth의 근본적인 외부 제약(우리 서비스가 팝업을 시작할 수 없고 Cafe24 "테스트 실행"이 흐름을 시작함)을 DB 상태(`pending_install`), 신규 엔드포인트(`GET /oauth/install/cafe24`), HMAC 검증, 프론트엔드 안내 화면의 조합으로 깔끔하게 해결한 설계다. 레이어 책임 분리(Controller → Service → Entity), 타이밍 공격 방어(`timingSafeEqual`), 테스트 커버리지도 양호하다. 다만 **`install_token` 컬럼이 완전한 dead code**로 스키마를 오염시키는 점, **pending 레코드 누적을 막을 TTL/cleanup 로직 부재**, **BeginResult 유니온의 discriminant 불일치**가 중간 위험도의 구조적 취약점으로 남는다. 이 세 가지를 보완하면 설계 완성도가 크게 올라간다.

## 위험도

**MEDIUM**