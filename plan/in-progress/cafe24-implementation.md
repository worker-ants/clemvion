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

- [ ] `/consistency-check --impl-prep spec/4-nodes/4-integration/` 호출
- [ ] Critical 발견 시 작업 중단, planner 위임

## Phase 2. Backend — 메타데이터 모듈 (18 카테고리)

`spec/conventions/cafe24-api-metadata.md` 의 형식대로.

- [ ] `backend/src/nodes/integration/cafe24/metadata/index.ts` (종합 export + `Cafe24OperationMetadata` 타입)
- [ ] 18개 resource 파일 (`store.ts`, `product.ts`, `order.ts`, `customer.ts`, `community.ts`, `design.ts`, `promotion.ts`, `application.ts`, `category.ts`, `collection.ts`, `supply.ts`, `shipping.ts`, `salesreport.ts`, `personal.ts`, `privacy.ts`, `mileage.ts`, `notification.ts`, `translation.ts`)
- [ ] **현실적 우선순위**: Phase 1 출시 단계에서는 빈번히 사용되는 카테고리부터 — Product / Order / Customer / Category / Promotion 의 핵심 operation 셋부터 채우고, 나머지 카테고리는 list/get 의 기본 패턴만 등록. 신규 endpoint 추가는 컨벤션 §4 절차로 누구나 가능
- [ ] 메타데이터 유효성 단위 테스트: id unique / path placeholder ↔ fields / requiredFields subset

## Phase 3. Backend — OAuth provider for Cafe24

- [ ] `backend/src/integrations/cafe24/cafe24-oauth.provider.ts`
- [ ] `/api/integrations/oauth/begin` 의 `service='cafe24'` 분기 — body 의 `mall_id`/`app_type`/`client_id?`/`client_secret?` 검증, `oauth_preview` 저장
- [ ] `/api/integrations/oauth/callback/cafe24` — token 교환 (mall_id 의존 endpoint), `cafe24_operator_id` 매핑 (Cafe24 응답의 `user_id` 값)
- [ ] Refresh 흐름 — §10.5 의 원자 갱신 (access/refresh/expires_at/token_expires_at 한 트랜잭션)
- [ ] mall_id validation `/^[a-z0-9-]{3,50}$/`
- [ ] preview_token 흐름 (`mode='new'`) + reauthorize + request-scopes

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

- [ ] 모달 카드에 Cafe24 추가 (`/integrations`)
- [ ] `/integrations/new?service=cafe24&step=auth` Step 2 폼:
  - mall_id 입력 + validation
  - app_type 라디오 (public/private)
  - private 선택 시 client_id/client_secret 입력
  - scope 카테고리 체크박스 (R/W 두 컬럼) + 고급 토글
- [ ] OAuth begin/callback 흐름 클라이언트 (postMessage)
- [ ] 인증 유형 라벨 `Cafe24` 표시 (목록 카드)

## Phase 9. Frontend — `cafe24` 노드 설정 패널

- [ ] `IntegrationSelector` 의 `serviceTypes=['cafe24']` 필터
- [ ] Resource 드롭다운 (18 카테고리, 메타데이터 라벨)
- [ ] Operation 드롭다운 — Resource 변경 시 동적 갱신
- [ ] Fields 동적 폼 — Operation 메타데이터의 JSON Schema → 폼 렌더 (Required/Optional 분리, type별 input)
- [ ] Pagination 폼 (paginated operation 만)
- [ ] 표현식 `{{ }}` 지원
- [ ] 캔버스 요약 `{resource} · {operation}`

## Phase 10. Frontend — AI Agent mcpServers grouping

- [ ] `IntegrationSelector` 의 `serviceTypes=['mcp', 'cafe24']` 수용
- [ ] "Add MCP Server" 모달 — 두 그룹 시각 분리 (🌐 Generic MCP / 🛒 Cafe24 stores)
- [ ] 행 표시에 Bridge 아이콘 prefix
- [ ] Cafe24 의 allowlist UI — Resource 단위 grouping (read/write 전부 / 일부 선택)
- [ ] 캔버스 요약 `{N} MCP` 카운트에 cafe24 포함

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
