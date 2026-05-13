# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 실제 동시성 버그(`ownedSids` race condition), 암호화 Transformer 우회 가능성, 다수의 테스트 공백이 운영 환경에서 잠재적 장애로 이어질 수 있음

---

## Critical 발견사항

없음 — 단일 리뷰어가 CRITICAL로 분류한 항목은 없으나, 아래 W1·W2·W3은 실질적 운영 장애 위험으로 최우선 처리 권장

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | **데이터 무결성** | `handleCallback`이 DELETE-RETURNING raw SQL을 사용하면 `encryptedJsonTransformer`가 적용되지 않아 `providerMeta`가 암호화된 blob으로 반환됨 — Cafe24 OAuth 콜백 전체 실패 가능. 테스트 mock이 이를 은닉 | `integration-oauth.service.ts` (callback 처리부), `integration-oauth-state.entity.ts` | raw SQL 사용 시 수동 decrypt 추가, 또는 `stateRepo.findOne() → DELETE` 패턴으로 전환. e2e에서 실 DB 왕복 검증 필수 |
| W2 | **데이터 무결성** | `provider_meta`를 `JSONB` 타입으로 선언했으나 `encryptedJsonTransformer.to()`는 `"AES256GCM:iv:ciphertext"` 평문 문자열을 반환 — PostgreSQL JSONB 파서가 거부할 수 있음. 기존 `credentials` 컬럼의 실제 DB 타입(`text` 가능성)과 불일치 위험 | `V041__integration_oauth_state_provider_meta.sql:11`, `integration-oauth-state.entity.ts:81` | transformer의 `to()` 반환값이 유효한 JSON인지 확인; 아니라면 마이그레이션 컬럼 타입을 `text`로 변경 |
| W3 | **동시성** | `ownedSids`가 `Cafe24McpToolProvider` 인스턴스 전체에서 공유되는 `Set<string>`. 동일 Integration을 사용하는 두 AI Agent 실행이 동시에 진행될 때, 한쪽 `cleanup()`이 `ownedSids.delete(sid)` 호출 시 다른 실행의 `matches()`가 `false`를 반환해 tool call 오류 발생 | `cafe24-mcp-tool-provider.ts:47, 133, 362` | `Set<string>` → `Map<string, number>` reference-counting으로 교체. `buildTools`에서 증가, `cleanup`에서 감소, 0일 때만 삭제 |
| W4 | **보안** | `OAUTH_STUB_MODE` 환경변수가 프로덕션 코드에서 실제 Cafe24 토큰 교환을 우회. 배포 환경에 실수로 포함되면 인증 없이 stub 자격증명 발급 | `integration-oauth.service.ts` (STUB 분기), `integration-oauth.service.cafe24.spec.ts:47` | stub 로직을 테스트 전용 subclass 또는 DI injectable `OAuthTokenExchanger` 인터페이스로 분리해 프로덕션 코드에서 제거 |
| W5 | **보안** | `__resetForTesting()` (Cafe24McpToolProvider), `__resetCafe24LocksForTesting` (Cafe24ApiClient) — 테스트용 내부 상태 초기화 메서드가 프로덕션 클래스 public 인터페이스에 노출 | `cafe24-mcp-tool-provider.ts`, `cafe24-api.client.ts` | `protected`/`package-private`으로 격리하거나 테스트 팩토리 함수로 분리. `process.env.NODE_ENV === 'test'` 가드 추가 |
| W6 | **런타임 정확성** | `cafe24.component.ts`가 optional 타입인 `deps.cafe24ApiClient`를 null 체크 없이 `Cafe24Handler`에 전달. `Cafe24Module` import 누락 또는 DI 설정 오류 시 암묵적 `TypeError` 발생 | `cafe24.component.ts:15`, `node-component.interface.ts:273–275` | `if (!deps.cafe24ApiClient) throw new Error('Cafe24ApiClient not injected — check Cafe24Module import')` 가드 추가 |
| W7 | **런타임 정확성** | `CAFE24_OAUTH_FIELDS`에서 `access_token`, `refresh_token`, `cafe24_operator_id`가 `required: true`로 마킹됨. OAuth 콜백 이후 서버가 자동으로 채우는 필드인데, 소비처가 이 플래그로 OAuth 시작 전 폼 검증 시 사용자가 OAuth를 아예 시작할 수 없게 됨 | `service-registry.ts:92–105` | `required: false`로 변경하거나 `systemManaged: true` 플래그 도입 |
| W8 | **보안** | private 앱 `clientSecret`이 POST body로 전송. NestJS 미들웨어 로거나 APM 도구가 request body 전체를 기록할 경우 `clientSecret`이 평문으로 서버 로그에 노출 | `integrations.controller.ts:161–172`, `new/page.tsx:134–147` | body 로깅 미들웨어에 `clientSecret` 마스킹 대상 추가. Swagger `@ApiProperty({ writeOnly: true })` 적용 확인 |
| W9 | **아키텍처** | `CAFE24_RESOURCES` 18개 리소스 목록이 백엔드 `metadata/types.ts`와 프론트엔드 `integration-configs.tsx`에 각각 하드코딩됨. 리소스 추가 시 두 곳 수동 동기화 필요 — 강제 메커니즘 없음 | `metadata/types.ts:63–82`, `integration-configs.tsx:248–267` | `GET /integrations/meta/cafe24/resources` 엔드포인트로 동적 fetch, 또는 공유 패키지 추출. 단기: `integration-configs.tsx`에 동기화 필요 주석 명시 |
| W10 | **아키텍처** | `OAuthBeginDto`에 Cafe24 전용 필드(`mallId`, `appType`, `clientId`, `clientSecret`)가 범용 DTO에 평면적으로 추가됨. Shopify·Naver 추가 시 동일 패턴으로 DTO가 비대해짐. 컨트롤러의 `body.service === 'cafe24'` 조건 분기도 OCP 위반 | `integration.dto.ts:237–305`, `integrations.controller.ts:162–176` | `mallId`/`appType` 등에 `@ValidateIf(o => o.service === 'cafe24') + @IsNotEmpty()` 조합. 장기적으로 `providerMeta?: Record<string, unknown>` 단일 필드로 수렴 |
| W11 | **아키텍처** | `HandlerDependencies`에 `cafe24ApiClient?`가 추가되는 패턴이 반복되면 다음 통합(Shopify 등)마다 optional 필드가 선형 증가 | `node-component.interface.ts:273–275`, `execution-engine.service.ts:421, 601` | `integrationClients?: Map<string, unknown>` 또는 typed client registry 도입. 두 번째 provider 추가 전 전환 권장 |
| W12 | **아키텍처** | `Cafe24McpToolProvider`가 `McpToolProvider`보다 반드시 먼저 배열에 위치해야 하는 제약이 순서에만 의존. 컴파일 오류 없이 순서가 바뀌면 조용히 오동작 | `ai-agent.component.ts:25–38` | `AgentToolProvider`에 `readonly priority: number` 추가 후 정렬, 또는 순서 역전 감지 단위 테스트 추가 |
| W13 | **유지보수** | mall_id 정규식 `/^[a-z0-9-]{3,50}$/`가 DTO, 프론트엔드, 서비스 3곳에 각각 하드코딩 | `integration.dto.ts:264`, `new/page.tsx:232`, `integration-oauth.service.ts` | 공유 상수 `CAFE24_MALL_ID_PATTERN`으로 추출 후 전체에서 import |
| W14 | **테스트** | `encryptedJsonTransformer` 암호화/복호화 라운드트립을 검증하는 통합/e2e 테스트 없음. unit test는 repo를 mock하므로 실제 DB column transformer 동작 미검증 (W1과 연관) | `integration-oauth-state.entity.ts`, OAuth begin→callback e2e 경로 | e2e에서 실 DB row를 직접 조회해 암호문 여부 확인, 또는 transformer 단독 unit spec 추가 |
| W15 | **테스트** | 컨트롤러 `providerMeta` 조립 분기 (cafe24/non-cafe24, public/private) 미테스트. `body.mallId === undefined` 케이스 서비스 전달 여부 미검증 | `integrations.controller.ts:162–176` | `integrations.controller.spec.ts`에 cafe24 public/private 분기 및 non-cafe24 케이스 추가 |
| W16 | **테스트** | Access token 만료(`expires_at` 과거) 시 자동 refresh 여부, refresh 실패 시 Integration 상태 전환(`error/auth_failed`) 검증 없음 | `cafe24-api.client.spec.ts` | 만료된 token으로 `call()` 호출 케이스 및 refresh API mock 응답 케이스 추가 |
| W17 | **테스트** | `clientId`/`clientSecret`의 `@Matches(/^[\x20-\x7E]+$/)` 등 DTO 유효성 검사 데코레이터가 NestJS ValidationPipe에서 실제로 400을 반환하는지 검증하는 테스트 없음 | `integration.dto.ts` | `POST /integrations/oauth/begin` e2e에 invalid 입력 케이스 추가 |
| W18 | **유지보수** | `clientId`/`clientSecret`에 `@Matches(/^[\x20-\x7E]+$/)` 사용 — space 단독 문자열 통과. private 앱에서 `clientId = " "` 형태가 DTO를 통과 | `integration.dto.ts` | 공백 전용 문자열 차단 regex 강화 또는 서비스 레이어에서 `.trim().length > 0` 검증 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안 | `mallId` 정규식 `/^[a-z0-9-]{3,50}$/`이 선행/후행 하이픈 허용 (`-abc`, `abc-`). SSRF 위험은 없으나 DNS 실패로 이어지는 잘못된 입력이 통과 | `integration.dto.ts:264`, `new/page.tsx:232` | `/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/`로 강화 |
| I2 | 보안 | `mall.read_privacy` 스코프 오퍼레이션(`customers_privacy_get`) 선택 시 워크플로 에디터에 PII 접근 경고 없음 | `metadata/privacy.ts:9` | `Cafe24OperationMetadata`에 `sensitiveData: true` 플래그 추가 후 UI 경고 배지 렌더링 |
| I3 | API 계약 | `@MinLength(3)`/`@MaxLength(50)`과 `@Matches(/^[a-z0-9-]{3,50}$/)`이 중복 선언 — 오류 메시지 두 벌 발생 가능 | `integration.dto.ts:255–262` | `@MinLength`/`@MaxLength` 제거, `@Matches` 하나만 유지 |
| I4 | API 계약 | `CandidateEntry` 반환 객체에 `sublabel: i.serviceType` 추가됐으나 `CandidateEntry` 인터페이스 미갱신 | `candidate-lookup.service.ts:167` | 인터페이스에 `sublabel?: string` 명시적 추가 |
| I5 | 성능 | `listAllCafe24Operations()`가 AI Agent 실행 시마다 전체 operation 배열 새로 생성 (~100개 객체 할당) | `metadata/index.ts` | 모듈 레벨 `const ALL_CAFE24_OPERATIONS` 상수로 캐싱 |
| I6 | 성능 | `findCafe24Operation()`이 실행 hot path에서 선형 탐색. 향후 operation 수 증가 시 직접 비용 | `metadata/index.ts` | 모듈 초기화 시 `Map<string, Map<string, Cafe24OperationMetadata>>` 인덱스 구성으로 O(1) 조회 |
| I7 | 성능 | `lookupMcpServers`에서 `[...MCP_CAPABLE_SERVICE_TYPES]` 호출마다 새 배열 생성. `MCP_CAPABLE_SERVICE_TYPES_LIST`가 이미 이 용도로 존재 | `candidate-lookup.service.ts:165` | `serviceType: MCP_CAPABLE_SERVICE_TYPES_LIST`로 교체 |
| I8 | 성능 | `Cafe24ApiClient` 모듈 레벨 lock Map — Integration 삭제 후 lock 항목이 제거되지 않으면 장기 운영 시 메모리 누수 | `cafe24-api.client.ts` | Integration 삭제 이벤트 시 `releaseIntegrationLock(integrationId)` 연동 |
| I9 | 유지보수 | `MCP_CAPABLE_SERVICE_TYPES_LIST` mutable `string[]` export — readonly tuple에서 파생됐으나 import측에서 `.push()` 가능 | `mcp-capable-service-types.ts:18–20` | `readonly string[]`로 타입 좁히기, 또는 export 제거 후 호출 측에서 spread |
| I10 | 문서 | `CAFE24_CLIENT_ID`/`CAFE24_CLIENT_SECRET` 환경변수가 테스트 파일에만 등장 — `.env.example` 등재 여부 불확실 | `integration-oauth.service.cafe24.spec.ts:44–45` | `.env.example`에 `CAFE24_CLIENT_ID=`, `CAFE24_CLIENT_SECRET=` 추가 확인 |
| I11 | 테스트 | `handleCallback` 테스트 전체가 `OAUTH_STUB_MODE=true`로만 동작 — 실제 Cafe24 토큰 교환 HTTP 응답 파싱 경로 미커버 | `integration-oauth.service.cafe24.spec.ts` | stub 비활성화 후 fetch를 직접 mock해 토큰 교환 응답 파싱 케이스 최소 1개 추가 |
| I12 | 테스트 | 프론트엔드 Cafe24 전용 검증 로직(`validateForm` cafe24 분기) 컴포넌트 테스트 없음 | `new/page.tsx:230–252` | `Cafe24ExtraFields` 렌더링 및 유효성 검사 테스트 추가 |
| I13 | 테스트 | `detect-pending-user-config.ts`에 `cafe24` 추가 후 pending config 감지 시나리오 미테스트 | `detect-pending-user-config.ts:62` | cafe24 노드 포함 워크플로에서 pending config 감지 테스트 추가 |
| I14 | 동시성 | 수평 스케일링 시 두 인스턴스가 동시에 같은 Integration 토큰 만료 감지 → double-refresh race. spec §9.6에 known trade-off 명시 | `cafe24-api.client.ts:265–292` | 현재 단일 인스턴스라면 무시 가능. 수평 확장 시 DB advisory lock 또는 Redis 분산 mutex 도입 |
| I15 | 문서 | `Cafe24Config` Operation 필드가 자유 텍스트(`ExpressionInput`) — hint가 spec 참조만 제공해 오타 시 런타임까지 오류 미발견 | `integration-configs.tsx:318–323` | hint에 "invalid ids will fail at runtime" 명시, 또는 Resource 선택 기반 동적 드롭다운으로 개선 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Side Effect | **MEDIUM** (→HIGH 가능) | `providerMeta` 암호화 Transformer raw SQL 우회, `cafe24ApiClient` null 체크 누락 |
| Concurrency | **MEDIUM** | `ownedSids` Set race condition — 동시 AI 실행 시 실제 버그 |
| Testing | **MEDIUM** | Transformer 라운드트립, 컨트롤러 분기, 토큰 만료 등 핵심 경로 테스트 공백 |
| Requirement | **MEDIUM** | `access_token` `required: true`, `cafe24ApiClient` null 체크 누락, 공백 허용 regex |
| Maintainability | **MEDIUM** | Controller에 provider 변환 로직 혼입, regex·리소스 목록 중복 |
| Security | **LOW** | `OAUTH_STUB_MODE` 프로덕션 우회, 테스트 메서드 노출, `clientSecret` 로그 노출 위험 |
| Database | **LOW** | JSONB vs encrypted transformer 타입 호환성 확인 필요 |
| Architecture | **LOW** | OAuthBeginDto OCP 위반, HandlerDependencies 누적 패턴, 등록 순서 묵시적 의존 |
| API Contract | **LOW** | `CandidateEntry` 인터페이스 미갱신, 리소스 목록 이중 정의 |
| Dependency | **LOW** | 신규 외부 패키지 없음, 리소스 목록 중복만 주의 |
| Performance | **LOW** | `listAllCafe24Operations()` 반복 할당, `findCafe24Operation()` 선형 탐색 (현 규모 무해) |
| Documentation | **LOW** | 환경변수 `.env.example` 누락, 일부 주석 중복 |
| Scope | **LOW** | 변경 범위 잘 집중됨. 리소스 목록 이중화만 follow-up 필요 |

---

## 발견 없는 에이전트

없음 — 13개 에이전트 모두 최소 1건 이상 발견사항 보고

---

## 권장 조치사항

1. **[즉시]** `handleCallback`의 `providerMeta` 읽기 경로 확인 — raw SQL 사용 시 `encryptedJsonTransformer` 우회 여부 검증. 필요시 수동 decrypt 추가 또는 TypeORM entity 방식으로 전환 (W1, W2 연관)
2. **[즉시]** `Cafe24McpToolProvider.ownedSids`를 `Map<string, number>` reference-counting으로 교체 (W3)
3. **[즉시]** `V041` 마이그레이션 컬럼 타입 `JSONB` vs `encryptedJsonTransformer` 반환 형식 호환성 검증 — 불일치 시 `text`로 변경 (W2)
4. **[즉시]** `cafe24.component.ts`에 `cafe24ApiClient` null guard 추가 (W6)
5. **[단기]** `OAUTH_STUB_MODE` 분기를 DI injectable 또는 테스트 subclass로 분리, `__resetForTesting()` 메서드 프로덕션 클래스에서 제거 (W4, W5)
6. **[단기]** `service-registry.ts`의 `access_token`/`refresh_token` `required: true` → `false` 수정 (W7)
7. **[단기]** e2e 테스트에 OAuth begin→callback DB 왕복 검증 추가 (W14)
8. **[단기]** `clientSecret` 로깅 미들웨어 마스킹 확인 및 `.env.example`에 Cafe24 환경변수 추가 (W8, I10)
9. **[중기]** mall_id 정규식 공유 상수 추출, `CAFE24_RESOURCES` 백엔드 API 동적 fetch 또는 공유 패키지 전환 (W13, W9)
10. **[중기]** 컨트롤러 `providerMeta` 조립 로직을 서비스 레이어로 이동, `OAuthBeginDto`에 `@ValidateIf` 조건부 필수 검증 적용 (W10, W11)
11. **[중기]** `HandlerDependencies` → `integrationClients: Map` 패턴으로 전환 (두 번째 provider 추가 전) (W11)
12. **[장기]** `listAllCafe24Operations()` 모듈 레벨 캐싱, `findCafe24Operation()` Map 인덱스 구성 (I5, I6)