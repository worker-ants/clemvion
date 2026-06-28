# 보안(Security) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[WARNING]** `GlobalExceptionFilter.mapHttpErrorLike` — 4xx http-error 메시지 클라이언트 직접 노출 가능성
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L113 — `message: exception.message`
- 상세: `mapHttpErrorLike`는 `errStatus >= 400 && errStatus < 500` 조건을 만족하는 모든 Error 객체의 `exception.message`를 응답에 그대로 실어 클라이언트에 반환한다. 현재 이 경로를 타는 오류는 body-parser의 `PayloadTooLargeError`("request entity too large") 하나뿐이고 해당 메시지는 무해하다. 그러나 이 분기 조건은 `status/statusCode`가 400~499인 임의의 Error를 수용하는 개방형 구조이므로, 향후 다른 http-errors 의존 미들웨어(예: `multer`, `connect-busboy`, `express-fileupload` 등)가 추가될 경우 내부 경로·파일 시스템 경로·스택 힌트가 포함된 메시지가 클라이언트에 노출될 수 있다. 5xx 경로는 제네릭 고정 문자열로 마스킹(`message = 'An unexpected error occurred'`)되는 것과 대비된다. CWE-209 (Information Exposure Through an Error Message), OWASP A05:2021(보안 오구성) 해당.
- 제안: `getCodeFromStatus`의 반환 코드에 대응하는 고정 메시지 맵을 두거나, 허용 목록 기반 클래스 검사(예: `exception.constructor.name === 'PayloadTooLargeError'`)를 통해 신뢰된 오류 클래스만 `exception.message`를 채택하는 방식으로 제한하라. 최소한 단기적으로는 현행 `this.logger.warn(...)` 로깅이 운영 가시성을 제공하고 있어 수용 가능하나, 미들웨어 추가 시 이 분기를 반드시 재검토해야 한다.

### **[WARNING]** `PublicWebhookThrottleGuard` — DB 장애 시 장기 fail-open 상태 탐지 수단 부재
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L75–81 — catch 블록 `return true`
- 상세: `triggerRepository.findOne`이 예외를 던지면 Guard가 즉시 `return true`로 통과시킨다. 이 시나리오에서는 (1) 공개 webhook의 32KB body 제한, (2) IP 단위 rate-limit 보호가 모두 무효화된다. 현재 `logger.warn`으로 개별 오류를 기록하나, DB 장애가 장시간 지속되는 경우 이 경고 로그 외에 Guard가 fail-open 상태임을 운영팀이 인지할 수단이 없다. 이 기간 동안 공개 webhook 엔드포인트는 사실상 body 크기·rate 제한 없이 노출된다(인증 게이트가 있는 일반 webhook과 달리 공개 webhook은 인증이 없으므로 이 보호 손실이 더 크다). OWASP A05:2021 해당.
- 제안: DB 오류 발생 시 별도 메트릭(카운터)을 증가시키거나, `logger.error`로 레벨을 올려 모니터링 알람 연동이 가능하게 하라. 또는 연속 실패 횟수에 따라 fail-close(보수적 차단)로 전환하는 회로 차단기(circuit breaker) 패턴 도입도 고려 가능하다.

### **[INFO]** `PublicWebhookThrottleGuard` — TypeORM partial projection 버그 수정 확인 (핵심 보안 수정)
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L72–74 — `select: { authConfigId: true }` 제거
- 상세: 이전 `select: { authConfigId: true }` partial projection이 TypeORM에서 `authConfigId`가 NULL인 컬럼을 비-NULL 값으로 잘못 반환해 모든 공개 webhook(`authConfigId IS NULL`)을 인증 webhook으로 오판하고, 32KB body 제한과 IP rate-limit 보호가 전량 우회되던 사전 존재(pre-existing) 보안 버그가 full entity 로드로 교정됐다. 수정 방향이 올바르고 e2e 케이스 L(공개 64KB → 413 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`)과 단위 테스트의 `select` 옵션 부재 단정이 회귀 가드로 추가되었다.
- 제안: 추가 조치 불필요. 향후 partial select 재도입 시 TypeORM NULL 컬럼 반환 동작을 검증하는 단위 테스트를 선행하라.

### **[INFO]** `hooks-body-parser.ts` — env override 상한 클램프로 OOM 벡터 방어
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L41–57 — `resolveHooksMaxBodyBytes`
- 상세: `HOOKS_MAX_BODY_BYTES` env 를 통해 운영자가 임계를 조정할 수 있으나, 0·음수·NaN·Infinity·비숫자 문자열은 기본값(`1MiB`)으로 폴백하고 `HOOKS_MAX_BODY_BYTES_CEILING`(16MiB)을 초과하면 상한으로 클램프한다. 클램프 발생 시 `logger.warn`으로 경고가 출력된다. 과도한 env 값으로 메모리 OOM 표면이 확대되는 공격 벡터를 방어하는 적절한 구현이다.
- 제안: 현행 유지.

### **[INFO]** SQL 인젝션 취약점 없음 확인
- 위치: `public-webhook-throttle.guard.ts` 및 `hooks.service.ts`의 TypeORM `findOne` 호출부
- 상세: `findOne({ where: { endpointPath, type: 'webhook' } })` 형태의 TypeORM 파라미터 바인딩을 사용하며, raw SQL query나 문자열 보간이 없다. SQL 인젝션 경로 없음.
- 제안: 추가 조치 불필요.

### **[INFO]** XSS 취약점 없음 확인
- 위치: `http-exception.filter.ts` — 에러 응답 직렬화
- 상세: 에러 응답은 `res.json(errorResponse)`로 직렬화되어 `Content-Type: application/json`으로 출력된다. HTML 컨텍스트 인젝션 경로가 없다.
- 제안: 추가 조치 불필요.

### **[INFO]** 하드코딩된 시크릿 없음 확인
- 위치: 전체 변경 대상 파일
- 상세: API 키, 비밀번호, 토큰, HMAC 시크릿 등 하드코딩된 자격 증명이 없다. e2e 테스트의 HMAC 시크릿은 `createAuthConfig('hmac')`을 통해 동적으로 생성된다.
- 제안: 추가 조치 불필요.

### **[INFO]** `app.use(HOOKS_ROUTE_PREFIX, ...)` — prefix 하위 모든 경로에 1MB 파서 일괄 적용
- 위치: `/codebase/backend/src/main.ts` L167 — `app.use(HOOKS_ROUTE_PREFIX, ...createHooksBodyParsers())`
- 상세: Express `use` 시맨틱상 `/api/hooks`로 시작하는 모든 경로(GET 엔드포인트 포함)에 1MB 파서가 적용된다. 현재 `/api/hooks` 하위에 GET 엔드포인트만 있어 실질 위험이 없다. 그러나 향후 webhook 수신 외 목적의 새로운 POST 엔드포인트가 `/api/hooks` 하위에 추가될 경우 의도치 않게 1MB 한도가 적용될 수 있다. OWASP A05:2021 잠재 해당.
- 제안: 현재는 실질 위험이 없다. 향후 `/api/hooks` 하위에 새 POST 엔드포인트 추가 시 파서 스코핑을 별도 검토하라.

### **[INFO]** `captureRawBody` — non-webhook 라우트에도 `req.rawBody` 설정
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` L109–113 — `createGlobalBodyParsers`에 `verify: captureRawBody` 포함
- 상세: 전역 파서(`createGlobalBodyParsers`)에도 `captureRawBody`가 적용되어 non-webhook 라우트(`/api/workflows`, `/api/workspaces` 등)의 모든 요청에서 `req.rawBody`가 채워진다. 이는 HMAC 검증 목적의 webhook 전용 필드가 의도치 않게 광범위하게 설정되는 상태 변경이다. 현재 non-webhook 경로에서 `req.rawBody`를 소비하는 코드가 없어 즉각적인 보안 문제는 없으나, 향후 `req.rawBody` 존재를 전제로 하는 코드가 비webhook 서비스에 추가될 경우 오작동 가능성이 있다.
- 제안: 중기적으로 `createGlobalBodyParsers`에서 `verify: captureRawBody`를 제거하고 hooks 경로에서만 rawBody를 캡처하도록 분리하는 것이 더 안전한 설계다. 단기적으로는 현행 유지가 수용 가능하다.

### **[INFO]** `rawBody: true` 제거 — NestJS `RawBodyRequest` 타입 계약 대체
- 위치: `/codebase/backend/src/main.ts` L160 — `NestFactory.create(AppModule, { bodyParser: false })`
- 상세: NestJS 공식 `rawBody: true` 옵션 제거로 `RawBodyRequest<T>` 타입 계약이 비공식 verify 콜백(`captureRawBody`)으로 대체됐다. 런타임에는 동일한 `req.rawBody` 필드를 채우므로 `AuthConfigsService.verifyWebhookRequest`와 Slack/Discord inbound 서명 검증은 정상 동작한다. 그러나 타입 시스템 관점에서는 계약이 암묵적이어서, `RawBodyRequest`를 전제로 하는 신규 코드가 추가될 때 컴파일 타임 보장 없이 조용한 실패가 발생할 수 있다.
- 제안: 현재 수준에서 허용 가능(`main.ts` 주석에 이미 명시됨). `AuthConfigsService.verifyWebhookRequest` 등 소비 코드에서 타입을 `Request & { rawBody?: Buffer }`로 명시하면 타입 안전성이 강화된다.

### **[INFO]** X-Forwarded-For IP 추출 — 헤더 스푸핑 위험 인지 및 방어
- 위치: `/codebase/backend/src/modules/auth/utils/client-ip.ts` L62–76 — `extractClientIpFromHeaders`
- 상세: XFF(X-Forwarded-For) 첫 번째 IP를 rate-limit 식별에 사용한다. XFF는 클라이언트가 임의 조작 가능한 헤더이므로, 공격자가 `X-Forwarded-For: victim-ip` 헤더를 삽입해 타인의 IP 쿼터를 소진(rate-limit 우회 또는 DoS)하거나 자신의 IP를 숨길 수 있다. 코드 주석("XFF 신뢰 관련(W1): 헤더 조작 방어는 인프라 레이어의 책임. rate-limit 은 best-effort defense-in-depth")이 이 한계를 인지하고 설계 결정으로 명시화하고 있어 의도가 명확하다. CF-Connecting-IP는 기본 off이며 명시적 opt-in(`TRUST_CF_CONNECTING_IP=true`)이 필요하다.
- 제안: 현행 유지. rate-limit은 추가 방어층이며 인증 게이트가 아님이 명시되어 있어 수용 가능하다.

---

## 요약

이번 변경의 핵심 보안 성과는 `PublicWebhookThrottleGuard`의 TypeORM partial projection 버그 교정이다. 이 버그는 모든 공개 webhook의 32KB body 제한 및 IP rate-limit 보호를 전량 우회하는 심각한 취약점이었으며, full entity 로드로 교정 후 e2e·단위 테스트 회귀 가드까지 갖췄다. 인증 webhook에 1MB 라우트 스코프 body-parser를 적용하면서 non-webhook 라우트의 100KB 방어선과 env override 상한 클램프(16MiB)를 함께 구현한 설계는 보안 관점에서 적절하다. SQL 인젝션·XSS·커맨드 인젝션·하드코딩 시크릿·LDAP 인젝션·경로 탐색 등 OWASP Top 10 주요 취약점은 발견되지 않았다. WARNING 두 건은 (1) `GlobalExceptionFilter.mapHttpErrorLike`의 4xx http-error 메시지 클라이언트 직접 노출 가능성(현재 무해하나 미들웨어 추가 시 잠재 위험), (2) DB 장애 시 Guard fail-open 상태의 장기 지속을 탐지할 수단 부재로, 모두 현재 범위에서는 실질 위험이 낮으나 향후 확장 시 주의가 필요하다.

---

## 위험도

LOW

STATUS: SUCCESS
