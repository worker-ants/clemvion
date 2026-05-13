# Code Review 통합 보고서

## 전체 위험도
**HIGH** — SSRF 방어 누락(mallId @Matches 미적용), 레이어 역전(IntegrationsModule→nodes), client_secret 평문 저장, integrationLocks 메모리 누수 등 즉시 조치가 필요한 Critical/High 항목 다수 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `mallId` SSRF 방어 regex 미적용 — 주석에 `@Matches(/^[a-z0-9-]{3,50}$/)` SSRF 방어 명시했으나 실제 데코레이터 없음. `mall_id`가 URL에 직접 삽입(`https://{mall_id}.cafe24api.com`)되므로 임의 문자열로 외부 서버 요청 유발 가능 | `integration.dto.ts` — `mallId` 필드 | `@Matches(/^[a-z0-9-]{3,50}$/)` + `@MinLength(3)` 데코레이터 즉시 추가 |
| 2 | Architecture | `IntegrationsModule`이 `nodes/` 레이어를 직접 import/export — 기존 `nodes → modules` 단방향 의존이 양방향으로 역전됨. `ExecutionEngineService`까지 이어지는 전체 DI 경로가 이 레이어 위반 위에 구축됨 | `integrations.module.ts:22,47-48` | `Cafe24ApiClient`를 `Cafe24Module` 또는 `NodesModule`로 이동, `ExecutionEngineModule`이 직접 import |
| 3 | Architecture | `ExecutionEngineService` 핵심 오케스트레이터가 특정 벤더 구체 클래스(`Cafe24ApiClient`)를 생성자 주입받음 — 다음 통합마다 수정 필요한 OCP 위반 | `execution-engine.service.ts:78,421,600-601` | `ApiClientRegistry` 맵 기반 레지스트리로 교체하거나, `Cafe24Handler`가 NestJS DI로 직접 주입받도록 재설계 |
| 4 | Security / DB | Private 앱 `client_secret` 평문 JSONB 저장 — OAuth state row에 최대 10분간 평문 보관. DB 덤프·슬로우 쿼리 로그·복제 스트림에서 노출 가능 | `V041__integration_oauth_state_provider_meta.sql`, `integration-oauth-state.entity.ts` | AES-GCM 애플리케이션 레벨 암호화 적용 또는 Redis TTL 10min 캐시로 대체 |
| 5 | Side Effect | `integrationLocks` Map unbounded — 토큰 refresh Promise 완료·오류 후 entry 미삭제로 장기 운영 시 삭제된 integration ID 누적 | `cafe24-api.client.ts` — 모듈 레벨 Map | `.finally(() => integrationLocks.delete(integrationId))` 패턴으로 반드시 정리 |
| 6 | Side Effect | `cleanup({ executionId: undefined })` 시 모든 진행 중 execution 상태 전체 삭제 — 다른 사용자의 AI Agent 세션이 `CAFE24_MCP_NO_SESSION`으로 실패 | `cafe24-mcp-tool-provider.ts` — `cleanup()` | `executionId === undefined` guard 추가하여 throw 또는 no-op 처리; 테스트 전용 초기화는 `__resetForTesting`으로 분리 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency / DB | 토큰 갱신 트랜잭션에 행 잠금(`SELECT FOR UPDATE`) 누락 — 멀티 인스턴스 환경에서 두 요청이 동시에 stale 토큰 읽기 후 Cafe24 refresh 경쟁 시, 일회성 refresh token 소진으로 `auth_failed` 전이 가능 | `cafe24-api.client.ts` — `ensureFreshToken()` | `findOne`에 `lock: { mode: 'pessimistic_write' }` 추가 또는 단일 인스턴스 전제임을 아키텍처 문서에 명시 |
| 2 | Performance / Requirement | `Cafe24Config` fields 상태 타입 불일치 — 읽을 때 `Array<{key,value}>`로 캐스팅하지만 `onChange`에서 `Record<string,string>` 객체로 저장. 첫 편집 후 `fields.map is not a function` 런타임 TypeError 발생 | `integration-configs.tsx:248,262` | 읽기 시 `Array.isArray(config.fields) ? config.fields : Object.entries(config.fields ?? {}).map(...)` 정규화 추가 |
| 3 | Concurrency | 429 재시도 thundering herd — 여러 동시 요청이 동일 슬립 시간 후 동시 재시도 시 다시 429 유발 | `cafe24-api.client.spec.ts:224-240` | `Math.random() * 500` jitter 추가 |
| 4 | Architecture / Maintainability | "MCP-capable" 서비스 타입 4개 이상 파일에 하드코딩 분산 — 다음 통합 추가 시 누락 위험 | `candidate-lookup.service.ts:163`, `detect-pending-user-config.ts:61`, `mcp-server-selector.tsx:70`, `ai-agent.component.ts:27-34` | `MCP_CAPABLE_SERVICE_TYPES = ['mcp', 'cafe24'] as const` 단일 상수 파일에 정의 후 전체 참조 |
| 5 | Architecture | Tool provider 등록 순서가 주석에만 의존 — `Cafe24McpToolProvider`가 `McpToolProvider` 앞에 등록되어야 하는 제약이 코드로 보장되지 않음 | `ai-agent.component.ts:27-34` | `AgentToolProvider.priority?: number` 필드 추가 후 `AiAgentHandler`가 정렬 기반 매칭 수행 |
| 6 | Architecture / Maintainability | `OAuthBeginDto`에 Cafe24 전용 필드 혼재 — provider 추가마다 DTO·컨트롤러 양쪽 수정 필요한 SRP/OCP 위반 | `integration.dto.ts:235-285`, `integrations.controller.ts:161-179` | `providerMeta: Record<string, unknown>` 단일 필드로 통합, provider별 검증은 서비스 레이어에서 수행 |
| 7 | Dependency | `__resetCafe24LocksForTesting` 프로덕션 모듈에서 export — 테스트 전용 인터페이스가 프로덕션 번들에 포함되어 외부에서 내부 상태 조작 가능 | `cafe24-api.client.ts` | 테스트 전용 파일(`cafe24-api.client.test-utils.ts`)로 분리 또는 `process.env.NODE_ENV === 'test'` guard |
| 8 | Security | `clientId` / `clientSecret` DTO 포맷 검증 부재 — 제어 문자·줄바꿈 포함 시 Basic Auth 헤더 인젝션 가능 | `integration.dto.ts` — `clientId`, `clientSecret` 필드 | `@Matches(/^[\x20-\x7E]{1,256}$/)` 등 허용 문자셋 패턴 추가 |
| 9 | Security | 테스트에서 `client_secret`이 authUrl에 포함되지 않음을 검증하지 않음 | `integration-oauth.service.cafe24.spec.ts` — private app 테스트 | `expect(result.authUrl).not.toContain('client_secret')` 단언 추가 |
| 10 | Side Effect / Concurrency | `Cafe24McpToolProvider.ownedSids` stale entry — `cleanup()` 누락 시 동일 SID를 가진 신규 execution이 dead context로 라우팅됨 | `cafe24-mcp-tool-provider.ts` | `buildTools()` 진입 시 동일 SID 기존 entry 경고 후 제거; SID→executionId 역매핑 Map으로 orphan 검출 |
| 11 | Maintainability / Dependency | `HandlerDependencies`에 Cafe24 전용 optional 필드 추가 — 전역 의존성 객체가 provider별 선택적 필드로 오염 패턴화 | `node-component.interface.ts:272-274` | `Cafe24HandlerDependencies extends HandlerDependencies` 별도 타입 사용 |
| 12 | Architecture | `cafe24.component.ts`에서 `cafe24ApiClient` undefined 시 런타임 오류 지연 — `ai-agent.component.ts`는 `if (deps.cafe24ApiClient)` 가드를 두지만 `cafe24.component.ts`는 undefined를 그대로 전달 | `cafe24.component.ts:16` | `createHandler`에서 `if (!deps.cafe24ApiClient) throw new Error(...)` early-fail 추가 |
| 13 | Testing | OAuth state row 삭제(DELETE-RETURNING) 검증 없음 — spec 주석에 명시되어 있으나 실제 assert 없음 | `integration-oauth.service.cafe24.spec.ts` | `dataSource.query` 호출 여부 + DELETE 인수 검증 assert 추가 |
| 14 | Testing | `null providerMeta` 역방향 호환성 테스트 없음 — 마이그레이션 전 생성된 row나 google/github 흐름에서 `handleCallback` 동작 미검증 | `integration-oauth.service.cafe24.spec.ts` | `providerMeta: null` 케이스 테스트 추가 |
| 15 | Testing | 컨트롤러 `providerMeta` 조립 로직 테스트 없음 — `mallId` undefined 시 `mall_id: undefined` 포함된 채 전달되는 엣지 케이스 미검증 | `integrations.controller.ts:158-180` | 컨트롤러 spec에 public/private 앱 + non-cafe24 service 케이스 추가 |
| 16 | Testing | 동시 토큰 리프레시 lock 동작 테스트 없음 — `__resetCafe24LocksForTesting`로 lock 구현 추정되나 검증 부재 | `cafe24-api.client.spec.ts` | `Promise.all`로 동시 호출 시 refresh API 1회만 호출됨을 검증하는 테스트 추가 |
| 17 | Testing | AI Agent provider 등록 순서 테스트 없음 — 순서 역전 시 테스트가 잡지 못함 | `ai-agent.component.ts` | `createHandler`에 mock deps 주입 후 provider 배열 구성·순서 검증 테스트 추가 |
| 18 | Maintainability | Frontend-Backend `CAFE24_RESOURCES` 목록 중복 — 18개 리소스가 양쪽에 독립 하드코딩 | `integration-configs.tsx:248-267` vs `metadata/types.ts` | API 엔드포인트(`GET /integrations/services/cafe24/resources`) 또는 공유 패키지로 단일화; 단기적으로는 동기화 주석 추가 |
| 19 | Dependency | `Cafe24ApiClient`가 `DataSource`를 직접 주입받아 DB 레이어와 직접 결합 — 노드 클라이언트의 책임 범위 초과 | `cafe24-api.client.ts` | 토큰 갱신 콜백을 `(integration, newTokens) => Promise<void>` 주입형 함수로 추상화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `listAllCafe24Operations()` 매 호출마다 정적 데이터 재할당 — AI Agent 실행 단위마다 heap 할당 + GC 압력 | `metadata/index.ts` | 모듈 최상위 IIFE로 lazy-init 상수화 |
| 2 | Performance | `findCafe24Operation()` 매 tool 실행마다 선형 탐색 O(M) | `metadata/index.ts` | `Map<string, Cafe24OperationMetadata>` (`${resource}:${id}` 키)로 O(1) 조회 구조 사전 구축 |
| 3 | Performance | `mcp-server-selector.tsx` 매 렌더마다 `available.filter()` 2회 실행 | `mcp-server-selector.tsx:186` | `useMemo`로 그룹핑 결과 메모화 |
| 4 | Documentation | 신규 환경변수 `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `OAUTH_STUB_MODE` 문서화 누락 | `.env.example`, README | `.env.example`에 세 변수 추가 및 Cafe24 설정 가이드 작성 |
| 5 | Documentation | `spec/conventions/cafe24-api-metadata.md` 참조 파일 존재 여부 미확인 — 여러 파일에서 참조되지만 diff에 생성 없음 | `metadata/application.ts` JSDoc 외 다수 | 파일 존재 확인 후 없으면 생성 |
| 6 | Maintainability | `providerMeta: Record<string, unknown>` 타입이 지나치게 느슨 — 접근 시마다 타입 캐스팅 필요 | `integration-oauth-state.entity.ts:79` | `Cafe24ProviderMeta` discriminated union 정의 후 서비스 레이어 경계에서 narrowing 함수 사용 |
| 7 | UI / i18n | 그룹 헤딩에 이모지 하드코딩, i18n 미적용 — 다른 UI 텍스트는 `useT()` 훅 사용 | `mcp-server-selector.tsx:195,200` | 번역 키 추가 또는 `t()` 래핑으로 일관성 유지 |
| 8 | Documentation | `mall_id` regex `/^[a-z0-9-]{3,50}$/` 프론트엔드·백엔드 독립 관리 — 규칙 변경 시 두 곳 동시 수정 필요 | `new/page.tsx:232`, `integration.dto.ts` | 공유 validation 상수 파일로 추출 또는 OpenAPI 기반 자동 생성 |
| 9 | DB | `provider_meta` 컬럼 코멘트에 `client_id?`, `client_secret?` 민감 필드명 열거 | `V041__integration_oauth_state_provider_meta.sql` | 코멘트를 `optional private-app credentials` 수준으로 추상화 |
| 10 | Testing | 크로스 리소스 operation ID 전역 중복 검사 부재 — `mcp_<sid>__<op_id>` 툴 이름 충돌 가능성 | `metadata.spec.ts` | `listAllCafe24Operations()` 결과 전체에서 `op.id` 전역 중복 검사 테스트 추가 |
| 11 | Testing | `detect-pending-user-config.ts`에 `cafe24` 추가에 대한 테스트 없음 | `detect-pending-user-config.ts:58` | `serviceType: 'cafe24'` 케이스 테스트 추가 |
| 12 | Dependency | `process.env` 직접 조작으로 테스트 격리 위협 — Jest 병렬 실행 시 worker 간 환경변수 오염 가능 | `integration-oauth.service.cafe24.spec.ts:44-61` | `ConfigService` 모킹으로 환경변수 의존성 제거 |
| 13 | API Contract | React Query 캐시 키 변경 — `["integrations", "mcp"]` → `["integrations", "mcp-capable"]` 로 기존 invalidateQueries 코드 영향 | `mcp-server-selector.tsx:64` | 기존 `["integrations", "mcp"]` 참조 전체 grep 후 일괄 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **HIGH** | mallId SSRF @Matches 누락, client_secret 평문 저장 |
| Architecture | **HIGH** | IntegrationsModule→nodes 레이어 역전, ExecutionEngineService OCP 위반, DTO 오염 |
| Side Effect | **MEDIUM** | integrationLocks 메모리 누수, cleanup(undefined) 전체 삭제, client_secret 평문 저장 |
| Performance | **MEDIUM** | Cafe24Config fields 타입 불일치 런타임 크래시, static data 반복 재할당 |
| Concurrency | **MEDIUM** | 토큰 갱신 행 잠금 누락, 429 재시도 thundering herd |
| Database | **MEDIUM** | client_secret 평문 저장, 토큰 갱신 락 부재 |
| Maintainability | **MEDIUM** | DTO 오염 패턴, 프론트-백 리소스 목록 중복, HandlerDependencies 오염 |
| API Contract | **MEDIUM** | mallId @Matches 누락, providerMeta 타입 느슨 |
| Dependency | **MEDIUM** | 레이어 역전, 테스트 전용 함수 production export, Cafe24ApiClient DB 직결합 |
| Testing | **MEDIUM** | state 삭제 미검증, null providerMeta 호환성 미검증, 동시성 lock 미검증 |
| Requirement | **MEDIUM** | mallId regex 미적용, Cafe24Config fields 런타임 크래시 |
| Documentation | **LOW** | 환경변수 문서 누락, JSDoc-데코레이터 불일치 |
| Scope | **LOW** | mcp-server-selector UI 재구성 범위 초과, queryKey 변경 |

---

## 발견 없는 에이전트

없음 — 모든 13개 에이전트가 최소 1개 이상의 발견사항을 보고했습니다.

---

## 권장 조치사항

1. **[즉시] SSRF 방어 복구** — `integration.dto.ts`의 `mallId`에 `@Matches(/^[a-z0-9-]{3,50}$/)` + `@MinLength(3)` 추가. 보안 방어선이 주석에만 존재하는 현재 상태 즉시 해소.

2. **[즉시] `Cafe24Config` fields 런타임 크래시 수정** — `integration-configs.tsx` 읽기 경로에 `Array.isArray` 분기 추가. 사용자가 필드를 한 번 편집하는 순간 에디터 패널이 망가지는 가시적 버그.

3. **[단기] `integrationLocks` Map 메모리 누수 수정** — `cafe24-api.client.ts`의 refresh Promise `.finally()` 블록에 `integrationLocks.delete(integrationId)` 추가.

4. **[단기] `cleanup(undefined)` 전체 삭제 방지** — `Cafe24McpToolProvider.cleanup()`에 `executionId === undefined` guard 추가.

5. **[단기] `client_secret` 저장 보호** — Redis TTL 캐시로 이전하거나 AES-GCM 암호화 적용. 최소한 컬럼 코멘트에서 필드명 제거.

6. **[단기] 레이어 의존 역전 해소** — `Cafe24ApiClient`를 `IntegrationsModule`에서 제거하고 전용 모듈로 이전. `ExecutionEngineService`의 벤더 직접 주입을 레지스트리 패턴으로 교체.

7. **[중기] `OAuthBeginDto` provider 필드 분리** — `providerMeta: Record<string, unknown>` 단일 필드로 교체하고 컨트롤러 인라인 분기 제거.

8. **[중기] MCP-capable 타입 상수화** — 4개 파일에 분산된 `['mcp', 'cafe24']` 배열을 단일 상수 파일로 통합.

9. **[중기] 토큰 갱신 행 잠금 추가** — 멀티 인스턴스 배포를 위해 `findOne`에 `pessimistic_write` lock 적용.

10. **[중기] 핵심 테스트 갭 보완** — state row 삭제 검증, null providerMeta 호환성, 동시 refresh lock, provider 순서 검증 테스트 추가.