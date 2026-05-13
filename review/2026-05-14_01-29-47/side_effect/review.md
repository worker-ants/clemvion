분석이 완료되었습니다. 전체 리뷰 결과를 정리합니다.

---

## Side Effect Code Review — Cafe24 Integration

### 발견사항

---

#### **[CRITICAL] Private-app client_secret 가 평문으로 DB에 저장됨**
- **위치**: `integration-oauth.service.ts` — `begin()` → `stateRepo.save()`, `integration-oauth-state.entity.ts` `providerMeta` 컬럼
- **상세**: private 앱의 `client_secret`이 `IntegrationOAuthState.providerMeta` JSONB 컬럼에 평문으로 최대 10분간 저장됩니다. `integration_oauth_state` 테이블에 SELECT 권한을 가진 모든 DB 사용자(읽기 전용 replica 포함)에게 노출됩니다. `integration.credentials`는 암호화되어 있지만 state 행은 그렇지 않습니다.
- **제안**: `providerMeta.client_secret`을 저장 전 AES-GCM 또는 application-level 암호화로 래핑하거나, state row가 아닌 short-lived server-side cache(Redis TTL 10min)에 보관

---

#### **[CRITICAL] `integrationLocks` Map이 unbounded — 메모리 누수 가능**
- **위치**: `cafe24-api.client.ts` — 모듈 레벨 `Map<string, Promise<unknown>>`
- **상세**: integration이 삭제되거나 에러로 Promise chain이 비정상 종료되면 해당 entry가 Map에서 자동 제거되지 않습니다. 장기 운영 프로세스에서 삭제된 integration ID가 Map에 누적되며, 이 Map은 `__resetCafe24LocksForTesting`로만 초기화됩니다(테스트 전용).
- **제안**: `WeakMap` 사용은 불가(key가 string)하므로, `.finally()` 블록에서 반드시 `integrationLocks.delete(integrationId)` 실행 보장; 또는 별도 eviction 로직 추가

---

#### **[WARNING] `Cafe24McpToolProvider.ownedSids`의 stale entry — 잘못된 tool 라우팅**
- **위치**: `cafe24-mcp-tool-provider.ts` — `private ownedSids = new Set<string>()`
- **상세**: `cleanup()` 호출이 누락되거나(예: execution 중 panic) `executionId`가 undefined로 전달되면 `ownedSids`에 stale SID가 남습니다. 이후 동일 SID를 가진 새 execution이 시작될 때 `matches()`가 true를 반환하여 dead integration context에 tool call을 라우팅합니다 — `CAFE24_MCP_NO_SESSION` 에러로 이어집니다.
- **제안**: `buildTools()` 진입 시 이전 execution에서 동일 SID가 남아있으면 경고 로그 출력 후 제거; 또는 SID → executionId 역매핑 Map 유지로 orphan 검출

---

#### **[WARNING] `cleanup({ executionId: undefined })` 호출 시 모든 execution state 전체 삭제**
- **위치**: `cafe24-mcp-tool-provider.ts` — `cleanup()` 메서드
- **상세**: `executionId`가 undefined인 경우 `executionState.clear()`와 `ownedSids.clear()`가 실행되어 **현재 진행 중인 모든 execution의 tool 세션이 삭제**됩니다. 이 경로가 production에서 의도치 않게 호출되면 다른 사용자의 AI Agent execution이 `CAFE24_MCP_NO_SESSION`으로 실패합니다.
- **제안**: `executionId === undefined` 케이스를 명시적으로 guard하여 throw 또는 no-op 처리; 테스트 전용 초기화는 `__resetForTesting` 함수로 분리

---

#### **[WARNING] token refresh 후 `integration` entity 직접 변이 (in-place mutation)**
- **위치**: `cafe24-api.client.ts` — `ensureFreshToken()` 종료 후 `integration.credentials`, `integration.tokenExpiresAt` 갱신
- **상세**: DB에는 원자적 트랜잭션으로 저장되지만 호출자가 보유한 `integration` 참조도 직접 변경됩니다. 같은 integration 객체를 공유하는 다른 코드 경로(예: `cafe24.handler.ts`에서 응답 직전 credentials 로깅)가 refresh 전/후 중간 상태를 볼 수 있습니다.
- **제안**: mutation 대신 refreshed credentials를 반환하거나, mutation 전후를 명시하는 주석 추가; 현재 구조에서는 큰 실용적 위험은 없으나 리더에게 혼란 유발

---

#### **[WARNING] `OAuthBeginDto`에 `mallId` validation regex 미적용 — DTO layer SSRF 방어 불완전**
- **위치**: `integration.dto.ts` — `mallId` 필드 (파일 3)
- **상세**: `@ApiPropertyOptional`의 `pattern` 필드는 Swagger UI 표시용일 뿐 실제 validation을 수행하지 않습니다. `@Matches(/^[a-z0-9-]{3,50}$/)` 데코레이터가 없어 DTO layer에서는 임의 문자열이 통과하고 SSRF 방어가 service layer에만 의존합니다.
- **제안**: `@IsString()`, `@MaxLength(50)` 이외에 `@Matches(/^[a-z0-9-]{3,50}$/)` 데코레이터 추가

---

#### **[WARNING] `CandidateLookupService` — `sublabel` 필드 추가로 기존 `CandidateEntry` 인터페이스 변경**
- **위치**: `candidate-lookup.service.ts` — `lookupMcpServers()` 반환값
- **상세**: 기존 `{ id, label }` 형태에 `sublabel` 필드가 추가되었습니다. 이 데이터를 소비하는 프론트엔드나 다른 서비스가 `sublabel`을 예상하지 않을 경우, undefined 접근 또는 렌더링 이슈가 발생할 수 있습니다. 특히 `mcp-server-selector.tsx`는 `sublabel`을 표시하지 않으므로 UI단에서 미사용 필드가 됩니다.
- **제안**: `CandidateEntry` 인터페이스에 `sublabel?: string` 명시적으로 추가 (optional); 소비자 코드 확인

---

#### **[WARNING] `McpServerSelector` queryKey 변경 — 기존 캐시 무효화**
- **위치**: `mcp-server-selector.tsx` — `queryKey: ["integrations", "mcp"]` → `["integrations", "mcp-capable"]`
- **상세**: React Query의 queryKey가 변경되어 기존 브라우저 캐시는 즉시 stale 처리됩니다. 배포 직후 모든 AI Agent 편집 패널이 강제 재요청을 수행합니다. 의도된 변경이지만 기존 캐시된 데이터(mcp only)와 신규 요청(mcp + cafe24)의 응답 shape가 달라지므로 점진적 배포 시 잠시 혼재될 수 있습니다.
- **제안**: 의도된 변경이므로 허용; 단 queryKey 변경이 맞는지 명시적 주석 또는 캐시 invalidation 전략 문서화 권장

---

#### **[INFO] `ExecutionEngineService` — `Cafe24ApiClient` 의존성 주입 추가**
- **위치**: `execution-engine.service.ts` — 생성자 시그니처 변경
- **상세**: NestJS DI 컨테이너가 `Cafe24ApiClient`를 자동 주입하므로 기존 코드에는 직접 영향 없음. 단, `ExecutionEngineModule`의 provider list에 `Cafe24ApiClient` 등록 확인이 필요합니다 — `integrations.module.ts`에서 `exports`에 추가했으나 `ExecutionEngineModule`이 `IntegrationsModule`을 `imports`하는지 확인 필요.
- **제안**: `execution-engine.module.ts`에서 `IntegrationsModule` import 여부 확인; 미등록 시 NestJS 시작 시점에 의존성 해결 실패 발생

---

#### **[INFO] `detect-pending-user-config.ts` — `SUPPORTED_INTEGRATION_SERVICE_TYPES` 배열에 `cafe24` 추가**
- **위치**: `detect-pending-user-config.ts:61`
- **상세**: `as const` 타입 추론 기반으로 작동하므로 TypeScript 컴파일 타임에 안전하게 확장됩니다. 이 배열을 exhaustive switch로 처리하는 코드가 있다면 `cafe24` 케이스 누락으로 컴파일 에러가 발생할 수 있으나, 이는 의도된 컴파일 타임 안전망입니다.
- **제안**: `switch(serviceType)` 패턴의 exhaustive 처리 코드가 있다면 `cafe24` 케이스 추가 확인

---

#### **[INFO] `V041` 마이그레이션 — nullable JSONB 컬럼 추가**
- **위치**: `V041__integration_oauth_state_provider_meta.sql`
- **상세**: `NULL` default이므로 기존 행에 영향 없음. `ALTER TABLE ... ADD COLUMN` + `COMMENT ON COLUMN`은 PostgreSQL에서 테이블 재작성 없이 즉시 완료됩니다. 기존 google/github OAuth 흐름은 영향 없습니다.
- **제안**: 이상 없음

---

#### **[INFO] `aiAgentNodeComponent.createHandler` 시그니처 변경**
- **위치**: `ai-agent.component.ts`
- **상세**: `cafe24ApiClient`가 optional이므로 (`deps.cafe24ApiClient`), 해당 client가 주입되지 않은 환경(테스트, staging)에서도 AI Agent가 정상 작동합니다. Cafe24 provider만 비활성화됩니다. 안전한 degradation입니다.
- **제안**: 이상 없음

---

### 요약

전반적으로 Cafe24 integration의 설계는 기존 OAuth 흐름(google/github)에 대한 backward compatibility를 잘 유지하고 있으며(nullable 컬럼, optional DI, feature-flag형 provider 등록), 기존 코드에 대한 의도치 않은 부작용은 제한적입니다. 그러나 **private 앱 `client_secret`의 평문 DB 저장**(state TTL 10분)과 **process-level `integrationLocks` Map의 unbounded growth** 두 가지는 보안/운영 관점에서 반드시 검토가 필요한 실질적 위험입니다. 추가로 `Cafe24McpToolProvider`의 프로세스 공유 상태(`ownedSids`, `executionState`)는 concurrent execution 환경에서 cleanup 누락 시 stale 라우팅을 유발할 수 있어, cleanup 경로의 방어 코드가 강화되어야 합니다.

---

### 위험도

**MEDIUM** — 보안 관련 1건(client_secret 평문 저장), 운영 관련 2건(메모리 누수, stale 라우팅)이 존재하나, 모두 happy path에서는 발생하지 않으며 특정 조건(private 앱 사용, 대규모 장기 운영, cleanup 누락)에서만 표면화됩니다.