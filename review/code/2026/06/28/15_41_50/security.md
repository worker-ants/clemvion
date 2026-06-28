# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `GlobalExceptionFilter` — 4xx http-error 의 `exception.message` 가 응답에 직접 노출됨
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts`, `mapHttpErrorLike` 메서드 내 `message: exception.message` 반환부
  - 상세: body-parser 의 `PayloadTooLargeError` 메시지("request entity too large")는 현재 무해하다. 그러나 이 분기는 `status/statusCode` duck-typing 으로 임의의 4xx http-errors 를 동일하게 처리하므로, 향후 신규 미들웨어가 이 경로를 통해 내부 경로·스택 힌트가 포함된 메시지를 throw 할 경우 클라이언트에 정보가 노출될 수 있다. 5xx 경로는 고정 문자열로 마스킹되는 것과 대비된다. OWASP A05(보안 오구성), CWE-209(Error Message Information Exposure).
  - 제안: `getCodeFromStatus` 결과에 대응하는 고정 메시지 맵을 두거나, 허용 목록에 등재된 에러 클래스(`PayloadTooLargeError` 등)에 한해서만 `exception.message` 를 채택하는 방식을 검토하라. 최소한 `this.logger.warn` 으로 원본 메시지를 로깅해 운영 가시성을 유지하라(RESOLUTION 이 이미 W5 로 `logger.warn` 추가를 완료한 것으로 기술하고 있으나, 현재 diff 상의 구현 코드에서는 해당 warn 호출이 `mapHttpErrorLike` 호출 후 호출부에서 이루어지므로 형태는 적절).

- **[INFO]** `HOOKS_MAX_BODY_BYTES` env override 상한 미검증 — 이전 리뷰에서 INFO 2,3 로 지적, RESOLUTION 에 FIXED(16MB ceiling) 기술
  - 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts`, `resolveHooksMaxBodyBytes`
  - 상세: diff 에 포함된 최종 코드에는 `HOOKS_MAX_BODY_BYTES_CEILING = 16 * 1024 * 1024` 상한 클램프가 구현되어 있다. 운영자가 실수로 극단적 값을 설정하면 메모리 OOM 표면을 넓힐 수 있으나, 16MB 상한 클램프와 경고 로그 출력으로 방어되어 있다. 현재 구현은 충분하다.
  - 제안: 추가 조치 불필요.

- **[INFO]** `PublicWebhookThrottleGuard` — DB 조회 실패 시 fail-open 정책
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`, catch 블록 `return true`
  - 상세: `triggerRepository.findOne` 이 예외를 던지면 Guard 가 즉시 `return true` 로 통과시킨다. DB 장애 시 공개 webhook 의 32KB body limit 과 IP rate-limit 보호가 일시 무효화된다. 이 시나리오에서 파서 레이어는 이미 1MB 한도로 본문을 메모리에 올린 상태에서 Guard 보호가 부재하므로, 장애 지속 시 부하 집중 가능성이 있다. 코드 주석이 "의도적 결정(HooksService 가 처리)"으로 명시하고 있어 설계 의도는 명확하나, 장기 fail-open 상태를 탐지할 수단이 없으면 운영 보안에 공백이 생긴다. OWASP A05(보안 오구성).
  - 제안: DB 오류 빈도를 모니터링 알람으로 연동하여 Guard 가 장기간 fail-open 상태로 운영되는 상황을 조기에 탐지하도록 보강하라.

- **[INFO]** `app.use(HOOKS_ROUTE_PREFIX, ...)` prefix 하위 모든 경로에 1MB 파서 일괄 적용
  - 위치: `codebase/backend/src/main.ts`, `app.use(HOOKS_ROUTE_PREFIX, ...createHooksBodyParsers())`
  - 상세: Express `use` 시맨틱상 `/api/hooks` 로 시작하는 모든 경로(예: `/api/hooks/:path/embed-config` GET 엔드포인트 포함)에 1MB 파서가 적용된다. embed-config 는 GET 이므로 body 파싱 실효성이 없어 현재 위험은 없다. 그러나 향후 `/api/hooks` prefix 하위에 webhook 수신 목적이 아닌 새로운 POST 엔드포인트를 추가할 때 의도치 않게 1MB 한도가 적용되어 해당 엔드포인트에 대한 과도한 body 허용 벡터가 생길 수 있다. OWASP A05.
  - 제안: 현재는 실질 위험이 없으나, 향후 `/api/hooks` prefix 하위에 새 POST 엔드포인트를 추가할 때 파서 스코핑을 별도로 검토하라. 전용 경로 매처(예: regex)로 webhook 수신 경로만 선별 적용하는 방식도 고려 가능.

- **[INFO]** 보안 버그 수정 확인 — `PublicWebhookThrottleGuard` partial projection 교정
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`, `select: { authConfigId: true }` 제거
  - 상세: TypeORM partial projection 이 `authConfigId` 를 `null` 대신 비-null 로 잘못 반환하여 모든 공개 webhook 을 인증 webhook 으로 오판하고, 32KB body limit 과 IP rate-limit 보호가 전량 우회되던 pre-existing 보안 버그가 full entity load 로 교정됐다. 이는 이번 변경의 핵심 보안 수정으로 올바른 방향이다. e2e L(공개 64KB → 413 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`)이 회귀 가드로 추가되어 있으며, 단위 테스트에서 `findOne` 호출 시 `select` 없이 호출됨을 단정하는 케이스도 추가되었다.
  - 제안: 추가 조치 불필요. 향후 성능 최적화로 partial select 를 재도입할 경우, TypeORM 의 NULL 컬럼 반환 동작을 명시 검증하는 단위 테스트를 선행하라.

- **[INFO]** 하드코딩된 시크릿 없음 확인
  - 위치: 전체 diff 대상 파일
  - 상세: API 키, 비밀번호, 토큰, 인증서, HMAC secret 등 하드코딩된 시크릿이 없다. e2e 테스트에서 사용하는 HMAC secret 은 `createAuthConfig('hmac')` 를 통해 동적으로 생성된다.
  - 제안: 추가 조치 불필요.

- **[INFO]** 인젝션 취약점 없음 확인
  - 위치: 전체 diff 대상 파일
  - 상세: SQL 인젝션 — TypeORM `findOne({ where: { endpointPath, type: 'webhook' } })` 는 파라미터 바인딩을 사용하며 raw query 없음. XSS — 에러 응답 직렬화는 `res.json()` 을 통해 Content-Type: application/json 으로 출력되어 HTML 컨텍스트 인젝션 경로 없음. 커맨드 인젝션 — 해당 없음.
  - 제안: 추가 조치 불필요.

- **[INFO]** `rawBody: true` 제거 후 HMAC 검증 경로의 타입 계약 모호성
  - 위치: `codebase/backend/src/main.ts`, `NestFactory.create(AppModule, { bodyParser: false })`
  - 상세: NestJS 공식 `rawBody: true` 옵션 제거로 `RawBodyRequest<T>` 타입 보장이 사라진다. `captureRawBody` verify 콜백이 동일 필드명(`req.rawBody`)을 채우므로 런타임 HMAC 검증은 유지되나, NestJS 타입 시스템 관점에서 계약이 깨진 상태다. e2e J(512KB HMAC 202)가 런타임 동작을 검증하지만, 향후 `RawBodyRequest` 타입을 신뢰하는 코드 추가 시 컴파일 타임 경고 없이 조용한 실패가 발생할 수 있다.
  - 제안: `main.ts` 주석에 rawBody 가 `captureRawBody` 로 채워진다는 점이 이미 명시되어 있어 현재 수준에서 허용 가능. `AuthConfigsService.verifyWebhookRequest` 등 소비 코드에서 타입을 로컬 확장(`Request & { rawBody?: Buffer }`)으로 명시 변경하면 타입 안전성이 강화된다.

## 요약

이번 변경의 핵심 보안 성과는 `PublicWebhookThrottleGuard` 의 TypeORM partial projection 버그를 full entity load 로 교정한 것이다. 이 버그는 모든 공개 webhook 의 32KB body limit 및 IP rate-limit 보호를 전량 우회하게 만들었으며, 수정 후 e2e 및 단위 테스트 회귀 가드까지 갖추어 올바른 처리가 이루어졌다. 추가적으로 인증 webhook 에 1MB 라우트 스코프 body-parser 를 적용하면서 non-webhook 라우트의 100KB 기본 방어선을 유지한 설계 역시 보안 방향성이 적절하다. `HOOKS_MAX_BODY_BYTES_CEILING` 클램프, `GlobalExceptionFilter` 의 5xx 마스킹 유지, SQL/XSS/커맨드 인젝션 취약점 부재, 하드코딩 시크릿 부재 등 OWASP Top 10 주요 항목에 해당하는 신규 취약점은 발견되지 않았다. 잔여 개선 포인트로는 4xx http-error 메시지 직접 노출 가능성(현재 무해하나 향후 미들웨어 추가 시 잠재 위험), DB fail-open 시 장기 모니터링 부재, `/api/hooks` prefix 하위 1MB 일괄 적용의 향후 확장 주의 필요 등이 있으나 모두 현재 범위에서는 위험도가 낮다.

## 위험도

LOW

STATUS: SUCCESS
