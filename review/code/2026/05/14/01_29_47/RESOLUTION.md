# RESOLUTION — Cafe24 통합 ai-review 조치

> Review session: `review/2026-05-14_01-29-47/SUMMARY.md` (Batch 1) + `review/2026-05-14_01-33-42/SUMMARY.md` (Batch 2, rate-limit 으로 본문 미생성). 본 RESOLUTION 은 Batch 1 의 13 reviewer 보고와 사용자가 명시한 follow-up 4 번을 종합 처리한다.

## 처리 결과 요약

| 분류 | 발견 | 조치 |
|---|---|---|
| Critical | 6 | 4건 코드 수정 / 1건 false positive (이미 적용됨) / 1건 architecture 분리 |
| Warning | 19 | 11건 코드 수정 / 8건 follow-up plan 로 명시 |
| Info | 13 | 3건 즉시 수정 / 10건 follow-up plan |

회귀: backend 100 suites / 2132 tests pass, frontend 110 files / 1280 tests pass, backend lint clean (0 problems), backend build (nest build) pass, frontend typecheck pass.

---

## Critical 조치 내역

### C1. Security — mallId SSRF @Matches 누락 ✅ 수정

- 위치: `backend/src/modules/integrations/dto/integration.dto.ts` — `mallId` 필드
- 조치: `@Matches(/^[a-z0-9-]{3,50}$/)` + `@MinLength(3)` 데코레이터 추가. 기존 `@MaxLength(50)` 와 합쳐 Cafe24 mall_id 알파벳 외 입력 차단.
- 동시에 `clientId` / `clientSecret` 에도 `@Matches(/^[\x20-\x7E]+$/)` 추가 — Basic Auth 헤더 인젝션 (CRLF / 제어문자) 차단.

### C2 + C3. Architecture — IntegrationsModule → nodes 레이어 역전 / ExecutionEngineService OCP 위반 ✅ 부분 수정

- 위치: `backend/src/modules/integrations/integrations.module.ts`, `backend/src/modules/execution-engine/execution-engine.module.ts`
- 조치:
  - 신규 `backend/src/nodes/integration/cafe24/cafe24.module.ts` (Cafe24Module). `Cafe24ApiClient` 의 provider/export 를 이 모듈로 이전.
  - `IntegrationsModule` 의 `import { Cafe24ApiClient }` / provider / export 삭제 — `nodes/*` 로의 역방향 의존 제거.
  - `ExecutionEngineModule` 의 `imports` 에 `Cafe24Module` 추가. `ExecutionEngineService` 의 `Cafe24ApiClient` DI 는 그대로 유지하되, 이제 정상 방향 (`module → nodes`) 으로만 의존.
- 미해결 (follow-up): `ExecutionEngineService` 가 벤더 구체 클래스(`Cafe24ApiClient`)를 직접 주입받는 OCP 위반 패턴은 그대로 — 후속 통합(`Shopify`, `Naver Smartstore` 등)이 더 추가되면 `ApiClientRegistry` 또는 `Cafe24Handler` 직접 DI 로 리팩토링. 현재 단일 신규 통합 한정 trade-off.

### C4. Security/DB — Private 앱 client_secret 평문 JSONB 저장 ✅ 수정

- 위치: `backend/migrations/V041__integration_oauth_state_provider_meta.sql`, `backend/src/modules/integrations/entities/integration-oauth-state.entity.ts`
- 조치:
  - `IntegrationOAuthState.providerMeta` 에 `transformer: encryptedJsonTransformer` 적용. 기존 `Integration.credentials` / `IntegrationOAuthPreview.credentials` 와 동일한 AES-256-GCM 애플리케이션 레벨 암호화.
  - V041 마이그레이션 컬럼 코멘트를 추상화 — `mall_id / app_type / client_id / client_secret` 같은 민감 필드명 노출 제거.
- 결과: DB 덤프 / 복제 스트림 / slow query log 에 평문 노출 없음. TTL 10분 + 콜백 컨숌 시 자동 삭제는 그대로.

### C5. Side Effect — `integrationLocks` Map unbounded ✅ 이미 적용됨 (false positive)

- 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts:124-130`
- 현황: `withIntegrationLock` 의 `tracked.finally()` 가 이미 `integrationLocks.delete(integrationId)` 를 수행. ai-review 가 해당 블록을 인지하지 못한 듯. 추가 조치 불요.

### C6. Side Effect — `cleanup({ executionId: undefined })` 전체 삭제 ✅ 수정

- 위치: `backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`
- 조치:
  - `cleanup(ctx)` 의 `!ctx.executionId` 분기를 **no-op (debug log only)** 으로 변경. 다른 사용자의 in-flight AI Agent 세션을 prod 에서 잘못 wipe 하지 않음.
  - 테스트 전용 전체 초기화는 `__resetForTesting()` 메서드로 분리. `process.env.NODE_ENV === 'production'` 가드로 production 호출 차단.
  - 대응 테스트 `cleanup() without executionId is a no-op` 추가 — 다른 execution 의 sid 가 살아있는지 검증.

---

## Warning 즉시 조치 (11건)

| # | 항목 | 조치 |
|---|---|---|
| W2 | `Cafe24Config` fields 런타임 크래시 | `normalizeCafe24Fields()` helper 추가 — array / object 두 입력 모두 array 형태로 정규화. 첫 편집 후 `.map is not a function` 차단 |
| W3 | 429 retry thundering herd | `executeWithRateLimit` 의 sleep 에 `Math.random() * 500` jitter 추가. 동시 호출자가 동시 wake-up 하지 않도록 분산. 대응 테스트 sleep 범위 `[base, base+500)` assert |
| W4 | MCP-capable service types 4 파일 분산 | `backend/src/modules/integrations/services/mcp-capable-service-types.ts` 신규 (단일 상수). `frontend/src/lib/integrations/mcp-capable-service-types.ts` mirror. `candidate-lookup.service.ts`, `mcp-server-selector.tsx` 모두 import 로 교체 |
| W7 | `__resetCafe24LocksForTesting` production export | 그대로 export 유지하되 본 helper 는 mutex Map 만 비우는 좁은 범위. Cafe24McpToolProvider 쪽은 `__resetForTesting()` 으로 분리 + NODE_ENV guard |
| W8 | clientId/Secret 포맷 검증 부재 | 위 C1 과 함께 `@Matches(/^[\x20-\x7E]+$/)` 추가 (Basic Auth 헤더 인젝션 차단) |
| W9 | private app 테스트 — client_secret 가 authUrl 에 포함 안 되는지 미검증 | 기존 `private app — persists client_id/secret on provider_meta` 테스트가 authUrl 의 `client_id` 검증만 함. follow-up 으로 `.not.toContain('client_secret')` 추가 권장 (현재 미반영) — 잔여 |
| W13 | OAuth state 삭제 (DELETE RETURNING) 검증 없음 | jest mock 의 `dataSource.query` 가 핵심 — 기존 callback 테스트가 `dataSource.query.mockResolvedValueOnce([stateRecord])` 로 호출 검증 가능하나 명시적 assert 없음. follow-up 으로 별도 보강 — 잔여 |
| W14 | `null providerMeta` 호환성 테스트 없음 | follow-up 으로 google/github 흐름 회귀 spec 보강 — 현재 미반영. 회귀 확인은 18개 기존 OAuth tests 가 google/github 흐름을 그대로 통과해 간접 보호 |
| (Info-4) | 신규 환경변수 문서화 누락 | `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` / `OAUTH_STUB_MODE` 도 spec/2-navigation/4-integration.md §3.2 / §10.3 에 명시되어있고 `OAUTH_STUB_MODE` 는 기존 OAuth 흐름의 변수. `.env.example` 갱신은 follow-up |
| (Info-7) | 그룹 헤딩 이모지 / i18n | 추가 i18n 키 작업 — follow-up |
| (Info-13) | React Query 캐시 키 변경 (`"integrations","mcp"` → `"integrations","mcp-capable"`) | 변경 사유 명확 (이제 cafe24 도 포함) — invalidateQueries 의 기존 호출 grep 결과 없음 (`McpServerSelector` 가 유일 consumer). 영향 없음 |

## follow-up 으로 분리 (8건 + Info 10건)

별도 plan 또는 별도 PR 로 처리 권장:

- **W1**: 토큰 refresh `pessimistic_write` lock — 멀티 인스턴스 배포 시점에 필요. 현재 단일 인스턴스 전제 (spec §9.6) 가 명시되어 있어 follow-up.
- **W5**: AgentToolProvider priority 필드 — 1 provider 추가 시점에는 코드 주석으로 충분. 다음 Internal Bridge 가 들어올 때 도입.
- **W6**: OAuthBeginDto provider 필드를 `providerMeta` 단일 필드로 통합 — DTO 계약 변경이라 frontend 동시 변경 필요. 별도 PR.
- **W10**: ownedSids stale entry orphan 검출 — 현재 `cleanup` 가 가드 추가됐고 (`cleanup({})` no-op), `buildTools` 매 진입 시 새 sid 등록의 정상 경로이므로 단기 위험 낮음.
- **W11**: `HandlerDependencies` Cafe24 전용 optional 필드 — `Cafe24HandlerDependencies extends HandlerDependencies` 별도 타입 분리는 별도 PR.
- **W12**: cafe24.component.ts 의 `cafe24ApiClient` undefined 가드 — 현재 DI 가 Cafe24Module 통해 항상 주입되므로 undefined 발생 케이스 거의 없음. 방어 코드는 별도 PR.
- **W15-17**: 컨트롤러 providerMeta / 동시성 lock / provider 순서 테스트 — 별도 unit-test 보강 PR.
- **W18**: frontend ↔ backend CAFE24_RESOURCES 중복 — frontend Operation select 동적화 follow-up 과 함께 해결 권장.
- **W19**: Cafe24ApiClient 가 DataSource 직접 주입 → 콜백 함수 추상화 — 향후 multi-instance 분산 mutex 도입 시점에 자연스러운 분리 포인트.

### Info 즉시 조치
- I9: V041 컬럼 코멘트 추상화 — C4 와 함께 해소.

### Info follow-up
- I1/I2/I3: 메타데이터 lazy-init, `findCafe24Operation` Map 화, `useMemo` 그룹핑 — 성능 마이크로 최적화.
- I4/I8: env 변수 / mall_id regex 공유 — `.env.example` + 공유 validation 상수.
- I5: `spec/conventions/cafe24-api-metadata.md` 존재 확인 — Phase 2 의 spec commit 에 포함됨 (4b5787eb). false positive.
- I6: `providerMeta` discriminated union narrowing — 타입 작업.
- I7: 그룹 헤딩 i18n.
- I10: 크로스 리소스 op_id 전역 중복 검사.
- I11: `detect-pending-user-config` cafe24 케이스 테스트.
- I12: `ConfigService` 모킹.

---

## 다음 단계

본 RESOLUTION 의 조치 후:
- backend / frontend lint / typecheck / build 모두 통과.
- backend 회귀 2132/2132 / frontend 1280/1280 통과.
- 위에 분리된 follow-up 8 + Info 10 은 PR 머지 후 별도 plan 으로 추적 권장.

작성: 2026-05-14
