### 발견사항

**[WARNING] `installToken`이 URL path segment에 평문 노출**
- 위치: `integrations.controller.ts` — `@Get('oauth/install/cafe24/:installToken')`, `integration-oauth.service.ts` — `appUrl` 생성
- 상세: 256-bit random hex 토큰이 URL path에 포함되어 nginx/CDN access log, 브라우저 history, Referer 헤더에 평문 기록됩니다. 토큰이 콜백 성공 후 NULL로 교체되어도 기록된 로그는 잔존합니다. 컨트롤러 주석과 plan W6에 인지된 항목으로 명시되었으나 현재 미적용 상태입니다.
- 제안: 단기 — nginx에서 해당 path segment 마스킹 (`/oauth/install/cafe24/[REDACTED]`). 중기 — 콜백 성공 시점과 무관하게 install endpoint 진입 직후 즉시 토큰을 NULL로 교체해 재사용 window 최소화 (현재는 callback 성공 후에만 NULL화).

**[WARNING] `installToken` 입력 형식·길이 검증 누락**
- 위치: `integrations.controller.ts:216` `@Param('installToken') installToken: string`, `integration-oauth.service.ts:857-862`
- 상세: path parameter에 최대 길이 및 16진수 형식 검증이 없습니다. 유효한 토큰은 정확히 64자 hex여야 하지만 임의 길이 문자열이 DB 쿼리로 전달됩니다. TypeORM parameterized query로 SQL Injection은 차단되나, 비정상 문자열로 인한 불필요한 인덱스 스캔이 반복될 수 있습니다.
- 제안: service 레이어에서 `if (!/^[a-f0-9]{64}$/.test(installToken)) throw NotFoundException(...)` 조기 반환 추가. NestJS `@IsHexadecimal()` + `@Length(64, 64)` 데코레이터 적용도 가능.

**[WARNING] TOCTOU 레이스 — `pending_install` 중복 방지 로직**
- 위치: `integration-oauth.service.ts` — `begin()` 내 `existing` 조회 후 `save()` 사이
- 상세: 동일 workspace·mall_id 요청이 동시 진입하면 두 요청이 모두 `alreadyConnected` 검사를 통과해 각각 새 row를 생성할 수 있습니다. plan에 "advisory lock 또는 partial UNIQUE 인덱스" 항목이 명시되어 있으나 현재 미구현입니다. V043 migration은 `install_token`에만 UNIQUE 제약을 적용합니다.
- 제안: `pg_advisory_xact_lock(hashtext(workspace_id || mall_id))` 트랜잭션 잠금 적용. mall_id가 암호화 저장되므로 DB 레벨 partial UNIQUE는 불가 — advisory lock이 현실적 대안입니다.

**[INFO] `INVALID_TOKEN(404)` vs `INVALID_HMAC(403)` 에러 코드 분리**
- 위치: `integration-oauth.service.ts:869-899`
- 상세: 토큰 미존재(404)와 HMAC 실패(403)를 다른 HTTP 코드로 반환해 토큰 존재 여부를 확인하는 oracle이 될 수 있습니다. 단, 256-bit 토큰과 rate limit(30req/60s)이 결합되어 실질적 열거 공격 가능성은 무시할 수 있는 수준입니다.
- 제안: 현행 유지 가능. 운영 디버깅 편의성이 우선이며 위험 수용 가능. 보다 엄격한 은닉이 필요하면 두 경우 모두 403으로 통일.

**[INFO] `verifyHmacWithMessage` timing-safe 구현 확인**
- 위치: `integration-oauth.service.ts:909` — `verifyHmacWithMessage` 호출부 (구현 diff에 미포함)
- 상세: HMAC 검증 함수가 `crypto.timingSafeEqual`을 사용하는지 이 diff에서 확인 불가합니다. 문자열 `===` 비교일 경우 timing side-channel에 노출됩니다.
- 제안: 구현 확인 필요. `crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))` 패턴인지 검증.

**[INFO] `lastError.message` 길이 제한 미구현**
- 위치: plan `(Info 1-2)` 항목 — 현재 미체크
- 상세: 프론트엔드에서 `lastError.message`를 직접 렌더링합니다. React JSX가 기본 escape를 보장하므로 XSS는 안전하나, 서버 측에서 외부 provider 에러 메시지의 200자 제한 + 민감 패턴 필터링이 아직 미적용 상태입니다. Cafe24 오류 응답이 민감한 내부 정보(예: DB connection string 등)를 포함할 경우 그대로 사용자에게 노출됩니다.
- 제안: `markIntegrationCallbackError` 내 메시지 저장 시점에 `message.slice(0, 200)`과 민감 패턴(`password`, `secret`, `token` 등) 마스킹 적용.

---

### 요약

이번 변경은 Cafe24 Private 앱 install 흐름의 O(N) in-memory 스캔을 단일 row 인덱스 조회로 교체하고 중복 방지·TTL 정리를 추가한 보안 개선 방향의 변경입니다. 핵심 설계(256-bit install_token, partial UNIQUE 인덱스 V043, rate limit, HMAC 검증 순서 — ①timestamp ②token lookup ③HMAC)는 견고하며, 레거시 410 처리와 `meta.appType` 추상화를 통한 credentials 직접 노출 방지도 올바릅니다. 주요 잔존 위험은 `install_token` URL path 로그 노출(W6 — plan 인지 후 미완), 입력 형식 검증 누락, TOCTOU 레이스(advisory lock 미적용) 세 가지로 모두 plan에 인지된 후속 항목입니다. 현재 공격면은 rate limit과 256-bit 엔트로피로 충분히 제한되나, 프로덕션 배포 전 특히 W6(로그 마스킹)와 installToken 형식 검증 완결을 권장합니다.

### 위험도
**LOW** (plan에 인지된 미완 항목 3건이 해소되면 NONE 수준)