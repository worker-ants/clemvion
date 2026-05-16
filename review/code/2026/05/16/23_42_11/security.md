# 보안(Security) 코드 리뷰

## 발견사항

### 긍정적 변경 (보안 강화)

아래 항목들은 이번 커밋에서 보안이 실질적으로 개선된 부분이다.

- **HMAC 알고리즘 허용 목록(W-2)**: `HMAC_ALLOWED_ALGORITHMS = new Set(['sha256', 'sha512'])` 신설 후 외부 입력 `hmacAlgorithm` 값을 화이트리스트로 필터링. md5 등 취약 알고리즘 우회 차단.
- **rawBody 활성화(C-11)**: `NestFactory.create(AppModule, { rawBody: true })` 적용으로 HMAC 서명 검증 경로가 실제 동작하게 됨. 미설정 시 `req.rawBody`가 undefined여서 모든 HMAC 검증이 무조건 401을 반환하거나 우회될 수 있었던 결함 해소.
- **ORDER BY 인젝션 1차 차단(W-46)**: `PaginationQueryDto.sort`에 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 적용. DTO 레벨에서 식별자 외 문자를 사전 차단.
- **CVE 패키지 업그레이드(C-13)**: `protobufjs ^7.5.8`, `fast-uri ^3.1.2` 오버라이드로 npm audit 지적 CVE 해소.
- **WebSocket 구독 한도 race condition 수정(W-68)**: `await authorize()` 이후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사 추가. 동시 subscribe 요청이 한도 검사를 interleave하는 TOCTOU 취약점 해소.
- **console 대신 NestJS Logger 사용(W-31)**: 운영 환경에서 민감 정보가 구조화되지 않은 stdout에 출력되던 문제 개선.
- **e2e 테스트 경로 엔트로피 강화(W-41)**: `Date.now()` → `crypto.randomBytes(8).toString('hex')`로 교체. 타이밍 기반 경로 예측 가능성 제거.

---

### 발견사항

- **[WARNING]** HMAC 에러 메시지에 알고리즘 명칭 노출
  - 위치: `backend/src/modules/hooks/hooks.service.ts` 라인 ~210
  - 상세: 허용 목록 외 알고리즘이 입력될 때 던지는 `UnauthorizedException`의 message 필드에 `"Unsupported HMAC algorithm: ${algorithm}"`이 포함되어 있다. `algorithm` 값은 외부 입력(트리거 설정)에서 오는 값이므로, 공격자가 임의 문자열을 주입했을 때 그 값이 오류 응답 본문에 반사될 수 있다. NestJS의 기본 exception filter가 이 message를 JSON 응답으로 직렬화하면 정보가 클라이언트에 노출된다.
  - 제안: message를 고정 문자열(`"Authentication failed"`)로 통일하고, 알고리즘 명칭은 서버 로그에만 기록한다. 예: `logger.warn(`Unsupported HMAC algorithm requested: ${algorithm}`)` 후 `throw new UnauthorizedException({ code: 'AUTH_FAILED' })`.

- **[WARNING]** `sanitizePayloadForWs` 원본 참조 반환 시 프로토타입 오염 위험 미점검
  - 위치: `backend/src/modules/websocket/websocket.service.ts` 라인 ~1706
  - 상세: 이번 변경에서 `sanitizePayloadForWs`는 자식 mutation이 없을 경우 원본 객체 참조(`value`)를 그대로 반환한다. 해당 값이 외부 webhook 페이로드 등 신뢰할 수 없는 소스에서 온 경우, 원본 참조가 WebSocket 브로드캐스트 경로에 전달될 수 있다. `__proto__`, `constructor`, `prototype` 키를 포함하는 객체가 sanitize 대상 없이 통과할 가능성이 있다 (CREDENTIAL_KEY_PATTERN이 이 키들을 포함하는지 diff에서 확인 불가).
  - 제안: `sanitizePayloadForWs` 진입부에서 `__proto__`, `constructor.prototype`, `prototype` 키 존재 여부를 추가로 체크하거나, JSON.parse(JSON.stringify(...)) 등 직렬화 라운드트립으로 프로토타입 체인 단절 처리를 고려한다.

- **[WARNING]** `TableHandler.safeEvaluate` 에러 로그에 ctx.$sourceItem 전체 직렬화
  - 위치: `backend/src/nodes/presentation/table/table.handler.ts` 라인 ~787
  - 상세: 에러 발생 시 `ctx.$sourceItem`과 `ctx.$var` 전체를 `JSON.stringify`하여 로그에 기록한다. `$sourceItem`은 워크플로우 실행 중 사용자 데이터나 외부 API 응답이 담기는 컨텍스트로, PII, OAuth 토큰, API 키 등 민감 데이터가 포함될 가능성이 있다. NestJS Logger로 교체했지만 직렬화 범위는 축소되지 않았다.
  - 제안: 로그 출력 시 `$sourceItem`을 키 목록만 출력하거나(예: `Object.keys(ctx.$sourceItem)`), 미리 정의된 안전 필드만 추출하여 로깅한다. 전체 직렬화는 디버그 빌드에서만 허용하고 운영 환경에서는 제한한다.

- **[INFO]** e2e 테스트 파일 내 평문 시크릿 리터럴
  - 위치: `backend/test/webhook-trigger.e2e-spec.ts` 라인 ~873 (`secret: 'super-secret-hmac-key'`), 라인 ~1068 (`bearerToken: 'sekret-token-1234'`), 라인 ~1017 (`hmacSecret = 'webhook-secret'`)
  - 상세: 테스트 전용 목(mock) 시크릿이 소스에 평문으로 하드코딩되어 있다. 테스트 데이터이므로 실제 운영 시크릿이 아니지만, 코드 리포지토리 히스토리에 영구 기록된다. 개발자가 실수로 동일 값을 운영 환경에 복사할 위험이 있다.
  - 제안: 테스트 내 시크릿 리터럴에 `// test-only, not a real secret` 주석을 명시하거나, 테스트 픽스처 파일(`.env.test`)에서 환경변수로 읽는 패턴을 검토한다. 최소한 명백히 무작위적인 값(예: `test-hmac-secret-do-not-use-in-prod`)으로 명명한다.

- **[INFO]** 의사결정 보류 항목 C-10: `AuthConfig.config` 평문 저장 미해소
  - 위치: `plan/in-progress/20260516-full-review/RESOLUTION.md` "의사결정 보류" 절
  - 상세: C-10 항목(`AuthConfig.config` 평문 → encryptedJsonTransformer + 평문 행 마이그레이션 스크립트)이 이번 커밋 범위에서 처리되지 않았다. 이는 인증 설정 값이 데이터베이스에 평문으로 저장될 가능성을 의미하며, 데이터베이스 유출 시 직접적인 인증 정보 노출로 이어진다.
  - 제안: 별도 plan 항목으로 우선순위 상향 처리를 권장한다. `credentials-transformer.ts`의 AES-256-GCM 패턴을 `AuthConfig.config`에도 동일하게 적용한다.

- **[INFO]** `credentials-transformer.ts` 모듈 수준 Logger 인스턴스 재사용 범위
  - 위치: `backend/src/modules/integrations/services/credentials-transformer.ts` 라인 ~18
  - 상세: `const logger = new Logger('IntegrationCredentialsTransformer')`가 모듈 최상단에 선언되어 있다. 이 파일에서 발생하는 `warnedMissingKey` / `warnedUnreadable` 원샷 경고가 이제 NestJS Logger로 라우팅되는 것은 긍정적이다. 다만 `INTEGRATION_ENCRYPTION_KEY`가 미설정된 경우 경고가 한 번만 출력된다는 `warnedMissingKey` 가드의 동작은 분산 인스턴스 재시작 시 경고가 누락될 수 있다.
  - 제안: 운영 환경 시작 시 `INTEGRATION_ENCRYPTION_KEY` 누락을 애플리케이션 부트업(`onModuleInit` 또는 ConfigService validation)에서 에러로 차단하는 방어선을 추가한다. 경고만으로는 운영 배포에서 놓칠 가능성이 있다.

---

## 요약

이번 커밋은 이전 full-review에서 지적된 보안 관련 Critical/Warning 항목 중 상당 부분을 실질적으로 해소했다. 특히 HMAC 서명 검증의 실제 활성화(rawBody:true), 알고리즘 허용 목록 도입, CVE 패키지 업그레이드, ORDER BY 인젝션 1차 차단, WebSocket 구독 한도의 TOCTOU 수정은 모두 보안을 직접 강화하는 변경이다. 남은 우려사항으로는 HMAC 에러 응답에서의 알고리즘 명칭 반사, 에러 로그의 ctx 전체 직렬화로 인한 PII 유출 가능성, 그리고 의사결정 보류 중인 `AuthConfig.config` 평문 저장 문제가 있다. 전체적으로 이번 변경은 보안을 유의미하게 개선하였으며, 잔여 이슈는 경미하거나 후속 작업으로 추적 중인 항목이다.

---

## 위험도

LOW
