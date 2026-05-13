---
worktree: cafe24-integration-a3f5e2
started: 2026-05-14
owner: developer
spec_refs:
  - spec/4-nodes/4-integration/4-cafe24.md
  - spec/conventions/cafe24-api-metadata.md
  - spec/5-system/11-mcp-client.md (§2.3 Internal Bridge)
  - spec/2-navigation/4-integration.md (§3.2 / §5.8 / §10 / §14)
  - spec/4-nodes/3-ai/{1-ai-agent,0-common}.md (mcpServers 화이트리스트)
  - spec/3-workflow-editor/4-ai-assistant.md (§4.3.1)
predecessor_plan: plan/complete/cafe24-integration.md
---

# Cafe24 Admin API 통합 — Implementation

> 본 plan 은 `plan/complete/cafe24-integration.md` (spec 작업 완료) 의 후속이다. 동일 worktree·동일 branch (`claude/cafe24-integration-a3f5e2`) 에서 진행하여 spec+impl 단일 PR 로 머지한다.

## 작업 범위 (spec 의 single source of truth)

본 implementation 은 새로 작성된 spec 들의 모든 결정사항을 코드로 반영한다.

- **Option A**: 같은 Integration(`service_type='cafe24'`) 1개가 워크플로 `cafe24` 노드 + AI Agent `mcpServers` 양쪽에서 사용.
- **In-process `Cafe24McpBridge`** 가 `IMcpClient` 를 구현. 외부 MCP 서버 미사용.
- **public + private 앱** 두 가지 발급 흐름 지원.
- **18 카테고리** 메타데이터 기반 단일 노드.
- **Cafe24 leaky bucket** rate-limit-aware wrapper. 노드/MCP 호출 공유.

## Phase 0. 컨텍스트 로드 & 환경 확인

- [ ] worktree 확인 (`cafe24-integration-a3f5e2`) 및 branch (`claude/cafe24-integration-a3f5e2`) 일치 확인
- [ ] 새 spec 11~12개 파일 모두 읽기
- [ ] 기존 backend 의 참조 구조 파악:
  - `backend/src/nodes/integration/http-request/` — Integration 노드 핸들러 패턴
  - `backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` — MCP provider 패턴 (있다면)
  - `backend/src/integrations/` — OAuth provider 구조 (Google/GitHub)
  - `backend/src/integrations/integrations.service.ts` (또는 동등) — `getForExecution`, credentials 해석
  - `IntegrationsController` — `/api/integrations/oauth/begin` 핸들러
- [ ] 기존 frontend 의 참조 구조 파악:
  - `frontend/src/app/integrations/` — 모달, Step 폼, 상세 페이지
  - `frontend/src/components/integration-selector/` — `serviceTypes` prop
  - `frontend/src/components/nodes/integration/http-request/` — 노드 설정 패널
  - AI Agent mcpServers UI
- [ ] `Node.type` DB 컬럼 타입 확인 (PostgreSQL enum 인지 String 인지 — 마이그레이션 필요 판단)

## Phase 1. consistency-check --impl-prep (의무 호출)

- [x] `/consistency-check --impl-prep spec/4-nodes/4-integration/` 호출 — `review/consistency/2026-05-14_00-12-59/`
- [x] Critical 1건 발견(send_email 포트명 불일치) — **cafe24 작업과 무관**. 별도 spec 정정 노트 `plan/in-progress/spec-update-send-email-port.md` 생성. cafe24 spec 은 이미 `'success'` 사용 일관이므로 본 작업 진행에 영향 없음
- [x] Warning 5건 / Info 8건 확인:
  - W2 (node-output-redesign Integration 완료 여부 불명) — Phase 2 컨텍스트에서 점검
  - W3 (ai-agent-tool-connection-rewrite Phase 10 순서) — Phase 10 진입 전 재확인. 본 작업 mcpServers UI 가 먼저 머지됨을 양 plan 에 인지
  - W4 (`config.fields` cafe24 vs form 명명 충돌) — Phase 9 frontend 구현 시 `nodeType` 분기 명시
  - W5 (`application` 명명 혼동) — Phase 2 메타데이터에 JSDoc 경고 주석 추가
  - I3 (`meta.callUsage` 단위 미검증) — 실 호출 응답 받은 후 spec 보정 필요 시 별도 노트

## Phase 2. Backend — 메타데이터 모듈 (18 카테고리)

`spec/conventions/cafe24-api-metadata.md` 의 형식대로.

- [x] `types.ts` (`Cafe24OperationMetadata` 타입 + `CAFE24_RESOURCES` enum) + `index.ts` 종합 export
- [x] 18개 resource 파일 (`store.ts`, `product.ts`, `order.ts`, `customer.ts`, `community.ts`, `design.ts`, `promotion.ts`, `application.ts` (JSDoc 경고), `category.ts`, `collection.ts`, `supply.ts`, `shipping.ts`, `salesreport.ts`, `personal.ts`, `privacy.ts`, `mileage.ts`, `notification.ts`, `translation.ts`)
- [x] **현실적 우선순위 적용**: Product (CRUD + variants 2), Order (list/get/items/shipments/buyer/memos), Customer (list/get/update/group/memos), Category (CRUD + products), Promotion (CRUD + issue) 핵심 채우고, 나머지 13 카테고리는 list/get/typical actions 패턴
- [x] 메타데이터 유효성 단위 테스트 (16 tests pass): id unique / path placeholder ↔ fields / requiredFields subset / enum type 검증 / 핵심 카테고리 CRUD 커버리지 / scope 매핑

## Phase 3. Backend — OAuth provider for Cafe24

- [x] **In-place 확장 전략 채택**: 별도 `Cafe24OAuthService` 신설 대신 기존 `IntegrationOAuthService` 에 cafe24 분기 추가 — 코드 중복 최소화, controller 분기 불필요
- [x] V041 마이그레이션 — `integration_oauth_state.provider_meta JSONB?` 컬럼 추가
- [x] `IntegrationOAuthState` entity 갱신 — `providerMeta: Record<string, unknown> | null`
- [x] `OAuthBeginDto` 확장 — `mallId`, `appType`, `clientId`, `clientSecret` (cafe24 한정 optional 필드)
- [x] `service-registry` 의 `oauthProvider` 타입 `'google' | 'github' | 'cafe24'` 확장 + Cafe24 ServiceDefinition (`CAFE24_OAUTH_FIELDS` + `CAFE24_SCOPES` 18 카테고리)
- [x] `IntegrationOAuthService.begin()` cafe24 분기 — mall_id validation `/^[a-z0-9-]{3,50}$/`, app_type 검증, private 앱 시 client_id/secret 필수, public 앱은 env, state.providerMeta 에 저장, authorize URL mall_id 의존
- [x] `IntegrationOAuthService.handleCallback()` 갱신 — exchangeCodeForToken 에 state.providerMeta 전달, cafe24 callback 시 credentials 에 mall_id/app_type/(private 한정 client_id/secret) 자동 포함
- [x] `exchangeCodeForToken()` cafe24 분기 — token URL mall_id 의존, client_id/secret 우선순위 (private→state, public→env), Basic auth 헤더 (Cafe24 권장)
- [x] `normalizeTokenResponse()` cafe24 분기 — `data.user_id` → `cafe24_operator_id` 매핑 (User.id 와 명명 충돌 회피), data.mall_id sanity check
- [x] `stubTokenResult()` cafe24 분기 — TTL 2시간 (Cafe24 access_token 유효 기간)
- [x] `IntegrationsController.oauthBegin` — body 의 cafe24 한정 필드를 providerMeta 로 전달
- [x] 단위 테스트 10건 통과 (`integration-oauth.service.cafe24.spec.ts`): mall_id validation 4건 / app_type 검증 / private 필수 / public env 미설정 / happy path (public·private) / handleCallback 의 preview credentials 포함 검증 (public·private)
- [x] 회귀: 기존 OAuth 18 tests 통과, 전체 integrations module 121/121 tests 통과
- [ ] Refresh 흐름 — Phase 4 의 `Cafe24ApiClient` 에서 호출 직전 만료 검사 + refresh 처리 (단일 wrapper 통과 원칙)

## Phase 4. Backend — Cafe24ApiClient (rate-limit-aware wrapper)

- [ ] `backend/src/integrations/cafe24/cafe24-api.client.ts`
- [ ] `Authorization: Bearer {access_token}` 자동 부여
- [ ] X-Cafe24-Call-Remain / X-Cafe24-Call-Usage / X-Api-Call-Limit 헤더 파싱
- [ ] 429 시 `max(callRemain, timeRemain)` 만큼 sleep + 최대 2회 재시도
- [ ] 동일 프로세스 인스턴스 내 Integration ID 별 in-memory mutex
- [ ] 401/403 시 Integration.status = error(auth_failed) 로 atomic 전이
- [ ] 단위 테스트 (mocked fetch, rate-limit 시나리오)

## Phase 5. Backend — `cafe24` 노드 핸들러 (TDD)

- [ ] `backend/src/nodes/integration/cafe24/cafe24.schema.ts` (`cafe24NodeConfigSchema`, `cafe24NodeMetadata`)
- [ ] `backend/src/nodes/integration/cafe24/cafe24.handler.ts` — spec §4 의 12 단계 흐름
- [ ] CONVENTIONS Principle 0~11 준수 (5필드 invariant, config echo, output.error envelope)
- [ ] Pre-flight throw 모든 케이스 (§5.8): `CAFE24_UNKNOWN_OPERATION`, `CAFE24_MISSING_FIELDS`, `CAFE24_INVALID_MALL_ID`, `INTEGRATION_*`
- [ ] Runtime 에러 코드 (§6): `CAFE24_4XX/404/422/AUTH_FAILED/RATE_LIMITED/5XX/TRANSPORT_FAILED`
- [ ] IntegrationUsageLog 기록
- [ ] 단위 테스트 (메타데이터 검증, fields → path/query/body 분배, 에러 분기)
- [ ] 핸들러 등록 (node registry)

## Phase 6. Backend — `Cafe24McpBridge` (Internal Bridge)

- [ ] `backend/src/integrations/cafe24/cafe24-mcp.bridge.ts` — `IMcpClient` 구현
- [ ] `listTools()` — 메타데이터 → MCP `tools/list` 응답 (bare id, prefix 는 MCP Client 레이어)
- [ ] `callTool(name, args)` — `Cafe24ApiClient` 로 위임 (노드 핸들러와 동일 경로)
- [ ] `initialize` / connect / close = no-op
- [ ] capability: `tools` 만 보고, resources/prompts 미보고
- [ ] McpToolProvider 가 `service_type='cafe24'` 도 lazy connect 하도록 확장
- [ ] 단위 테스트 (메타데이터 → MCP tool 변환, allowlist filter)

## Phase 7. Backend — IntegrationsService 확장

- [ ] `IntegrationsService.getForExecution` 의 service_type 화이트리스트에 `cafe24` 추가
- [ ] `Integration.service_type` enum / String 타입 확인 후 필요 시 마이그레이션
- [ ] `Node.type` enum / String 타입 확인 후 필요 시 ALTER TYPE 마이그레이션 (`cafe24` 추가)
- [ ] AI Agent mcpServers candidate 쿼리 (collectPendingUserConfig) — `integrationServiceType` hint 의 `string | string[]` 다중값 지원

## Phase 8. Frontend — Add Integration 모달 + Step 2 폼

- [x] 모달 카드에 Cafe24 자동 노출 — backend `/api/integrations/services` 에서 cafe24 ServiceDefinition (Phase 3 등록) 가 그대로 흘러나옴
- [x] `service-icons.tsx` 에 `cafe24: ShoppingBag` 추가
- [x] `/integrations/new?service=cafe24&step=auth` Step 2 폼:
  - [x] `Cafe24ExtraFields` 컴포넌트 신설 — mall_id (pattern validation) + app_type radio (public/private) + private 시 client_id/client_secret 추가 노출
  - [x] page-level `validate()` 가 cafe24 한정 검증 (mall_id 패턴 / app_type / private 시 creds 필수)
  - [x] `oauthBeginMutation` 이 service==='cafe24' 시 mallId/appType/clientId?/clientSecret? 를 함께 전달
  - [x] OAuth begin/callback (postMessage) 흐름 그대로 활용
- [x] `integrationsApi.oauthBegin` 의 body 타입에 cafe24 한정 optional 필드 추가
- [x] 인증 유형 라벨 `Cafe24` 는 backend §2.2 패치(Phase 3) 가 그대로 처리

## Phase 9. Frontend — `cafe24` 노드 설정 패널

- [x] `integration-configs.tsx` 에 `Cafe24Config` 컴포넌트 신설 + `override-registry.ts` 에 `cafe24: Cafe24Config` 등록
- [x] `IntegrationSelector` 의 `serviceTypes=['cafe24']` 필터
- [x] Resource 드롭다운 (18 카테고리 하드코드 — 메타데이터 미러)
- [x] Operation `ExpressionInput` (현 단계는 자유 입력 + 메타 컨벤션 hint; 향후 backend metadata endpoint 가 도입되면 동적 select 로 승격)
- [x] Fields KeyValueEditor (expression 지원) — backend 가 `Record<string, unknown>` 로 받음
- [x] Pagination NumberField (Limit / Offset)
- [x] Resource 변경 시 operation 자동 리셋 (이전 opId 가 새 resource 와 mismatch 방지)

## Phase 10. Frontend — AI Agent mcpServers grouping

- [x] `McpServerSelector` 의 `integrationsApi.list` 가 `serviceType: ['mcp', 'cafe24']` 모두 fetch
- [x] picker 본문에 두 그룹 시각 분리 (🌐 Generic MCP (HTTP) servers / 🛒 Cafe24 stores (Internal Bridge))
- [x] 등록된 항목 row 는 status 배지 유지, group heading 으로 type 식별
- [x] 회귀: 전체 frontend 1280/1280 vitest 통과, frontend typecheck pass

## Phase 11. 테스트

- [ ] Backend unit 테스트 (각 모듈) — TDD 로 Phase 2~7 와 함께 진행
- [ ] Backend integration 테스트 — IntegrationsController OAuth begin/callback, 노드 핸들러 end-to-end (mocked Cafe24)
- [ ] e2e 테스트 (`make e2e-test`) — Integration 등록 → 노드 호출 → MCP 도구 호출 시나리오 (Cafe24 sandbox 없으므로 fixture 응답 서버)
- [ ] 회귀 테스트 — 기존 MCP integration / 기타 노드 동작 무변경

## Phase 12. 빌드·타입체크·lint

- [ ] `npm run typecheck` (backend + frontend)
- [ ] `npm run lint`
- [ ] `npm run build`

## Phase 13. ai-review

- [ ] `/ai-review` 실행 (Security / Architecture / Side Effect / API Contract / Concurrency / Database 중심)
- [ ] Critical 해소, Warning 검토 후 `review/<timestamp>/RESOLUTION.md` 작성

## Phase 14. 정리

- [ ] 모든 Phase 체크박스 [x]
- [ ] 본 plan `plan/complete/` 이동
- [ ] 사용자에게 PR 생성 안내 (spec + impl 단일 PR)

## 의존성·리스크

- **외부 sandbox 부재**: Cafe24 가 공개 sandbox 를 제공하지 않으므로 mocked HTTP 응답 fixture 또는 사용자 본인 mall 의 private app 활용 필요. e2e 는 fixture 기반.
- **DB 컬럼 enum 가능성**: `Node.type` / `Integration.service_type` 컬럼이 PostgreSQL enum 이면 ALTER TYPE ADD VALUE 마이그레이션 필요. 컬럼이 varchar 면 무영향.
- **process-level mutex 한계**: 멀티 인스턴스 배포에서는 인스턴스 간 직렬화 없음 — spec §4.1 에 명시된 trade-off 그대로 수용 (Cafe24 leaky bucket 의 429 가 자체 backoff 신호).
- **AI Agent `mcpServers` 확장 영향**: `ai-agent-tool-connection-rewrite` plan 과 같은 파일(1-ai-agent.md, 0-common.md) 의 다른 구역을 편집하지만 spec 단계에서 충돌 확인 완료 (consistency-check Plan Coherence W8).
