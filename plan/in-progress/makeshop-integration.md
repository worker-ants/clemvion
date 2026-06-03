---
name: makeshop-integration
worktree: makeshop-api-catalog-730deb
status: in-progress
created: 2026-06-03
owner: project-planner
---

# Plan: 메이크샵(MakeShop) 통합 spec 작성

cafe24 통합과 동일 구조로 메이크샵을 **워크플로 노드 + AI Agent Internal MCP Bridge** 양쪽에 추가한다. 사전 추출한 [`spec/conventions/makeshop-api-catalog/`](../../spec/conventions/makeshop-api-catalog/_overview.md) (161 REST + 11 webhook = 172 operation) 를 기반으로 한다.

## 확정된 결정 (사용자)

1. **인증 흐름 = Authorization-Code + refresh** (cafe24 동형). auth.makeshop.com authorize/token + refresh(30~90일) + ShopStore 설치 HMAC 검증. 기존 third-party-oauth 인프라 재사용.
2. **이번 범위 = REST 노드 + MCP 먼저**, cpik webhook(이벤트 11개)은 후속.
   - **단, webhook trigger 는 cafe24 에도 아직 없으므로** makeshop·cafe24 공통의 **통합 trigger 노드 후속 과제**로 분리 추적한다 (아래 §후속).

## 메이크샵 고유 분기 (cafe24 와 다른 점 — 노드 spec Rationale 에 명시)

| 항목 | cafe24 | makeshop |
|------|--------|----------|
| OAuth scope wire format | 콤마 구분 (RFC 6749 예외) | **공백 구분 (OAuth 2.1 표준)** — cafe24 콤마 quirk 없음 |
| base URL | `{mall_id}.cafe24api.com/api/v2/admin/` | `connect.makeshop.co.kr/api/v1/{shopId}/` (shopId = shop_uid) |
| authorize/token host | cafe24 OAuth | `auth.makeshop.com` (authorize·token), refresh 동일 host |
| 상점 식별자 | `mall_id` | `shop_uid` (data-model `mall_id` 컬럼 의미 재사용 또는 일반화) |
| POST/PUT request envelope | `{request:{...}}` 래핑 필수 | **flat JSON (래핑 불필요)** — ⚠ 구현 시 검증 |
| 별도 승인 scope (restricted) | 있음 (scope/operation 티어) | **없음** — 심사 시 일괄 검토만, per-scope 승인 티어 없음 → `makeshop-restricted-scopes.md` 미생성 |
| resource 축 | 18 카테고리 | **7 섹션** (shop/product/order/member/benefit/board/cpik) |
| timezone | KST 고정 | ⚠ 미확인 — 구현 시 makeshop 문서 검증 |
| data-call rate limit | leaky bucket 헤더 | ⚠ 미문서화 — 429 best-effort, 토큰발급만 5/min(client_credentials 한정) |

## 산출물

### 신규 파일
- [x] `spec/4-nodes/4-integration/5-makeshop.md` — 노드 spec (status: planned)
- [x] `spec/conventions/makeshop-api-metadata.md` — operation 메타데이터 형식 컨벤션
- [x] `spec/conventions/makeshop-api-catalog/**` — (이미 생성됨, 선행 커밋 888a670b)

### 등록(registration) 편집
- [x] `spec/4-nodes/4-integration/_product-overview.md` — §2.6 INT-SV-09 (MakeShop) + §2.4 INT-US-05 logging 표 row + Internal Bridge 실행경로 note
- [x] `spec/0-overview.md` §6.3 — 구현 상태(Planned) + spec 링크
- [x] `spec/1-data-model.md` §2.6 Node.type + §2.10 service_type/mall_id/autoRefresh/index + §2.10.1 api_label
- [x] `spec/4-nodes/0-overview.md` §2.4 — integration 노드 표에 MakeShop row
- [x] `spec/4-nodes/4-integration/0-common.md` §5/§7 — 캔버스 요약 + summary index
- [x] `spec/2-navigation/4-integration.md` — §5.9 MakeShop 신규 + §9.2 IntegrationDto(C-6) + §9.3 catalog endpoint + §4.6 catalog label
- [x] `spec/5-system/11-mcp-client.md` §2.3 — Internal Bridge 두 번째 사례로 MakeShop 추가
- [x] `spec/conventions/makeshop-api-catalog/*.md` (7) — frontmatter(id/status:spec-only/code/pending_plans) 추가 (build gate)

### 게이트
- [x] `/consistency-check --spec` (2026-06-03, `review/consistency/2026/06/03/20_16_35/`) — **BLOCK: YES (Critical 1)** → 해소 후 통과. Critical(§3 포트 `dynamic` 컬럼 누락)·Warning 8(frontmatter enum·code 누락·Node.type 미등재·mall_id 표기·auth 호스트·0-common 4종) 모두 fix. 잔여 INFO 는 아래 "구현 승격 체크리스트" 로 이관.

### consistency-check 재실행 (2026-06-03, `review/consistency/2026/06/03/20_31_06/`)

재실행 BLOCK: YES 였으나 **Critical 1~4 + Warning 1,2,10 은 false positive** — checker 가 worktree HEAD 가 아니라 **origin/main 베이스라인과 비교**해 "main 미갱신 / dead link / plan 파일 미존재" 로 오판 (1차 실행은 working-tree 를 읽어 이 FP 없었음). git 으로 반증: 해당 파일들이 모두 본 브랜치에 커밋됨 (data-model makeshop 6곳, navigation 15곳 + §5.9 존재, plan 파일·C-6 TRIGGERED 존재). 이 cross-ref 들은 **같은 PR/브랜치에서 함께 merge** 되므로 정합.

재실행의 **진짜 actionable 항목 (해소 완료)**:
- `MAKESHOP_SERVICE_UNAVAILABLE` → **`INTEGRATION_SERVICE_UNAVAILABLE`** (cafe24 공유 코드 재사용, 동일 조건 이중 코드 방지) ✅
- §5.3 에러 JSON 예시 + 필드 표 인라인 (node-output Principle 11) ✅
- 3xx 라우팅 명확화 (§3·§4 step 12 — fetch 자동 추종, 잔여는 `MAKESHOP_4XX` fallback) ✅

**병렬 편집 주의 (Warning #11)**: `spec/4-nodes/0-overview.md` 가 active worktree `claude/spec-inprogress-groom-c7568b` 와 동시 편집 중 — merge 시 충돌 가능. 먼저 merge 되는 쪽 기준으로 rebase 조율 필요.

## 구현 승격(implemented) 시 체크리스트 (consistency-check 잔여 INFO)

spec-only → implemented 승격(노드 구현 PR) 시 함께 갱신:
- `spec/2-navigation/4-integration.md`: §2.3 서비스 칩 / §2.5 Add Integration 모달 / §10.3 provider OAuth endpoint 표 / §13 데이터모델 영향(MakeShop partial UNIQUE 인덱스 V05X) / §9.1 autoRefresh / §9.3 catalog non-empty 반환 대상에 makeshop 추가
- `spec/4-nodes/4-integration/0-common.md §5` 캔버스 요약 색인에 makeshop 행 (현재 추가됨, 구현 시 "Planned" 제거)
- `5-makeshop.md §5.3` 에러 JSON 예시 블록 인라인 (현재 cafe24 §5.3 참조) — node-output Principle 11
- DB Enum 마이그레이션 `V05X__node_type_makeshop` + `(workspace_id, mall_id) WHERE service_type='makeshop'` partial UNIQUE
- §9.7 open question 4건 확인 (OAuth 호스트·rate limit·timezone·envelope) — 확정 시 `5-makeshop.md` 본문 + `makeshop-api-metadata.md` 반영. **timezone 확정 시 `makeshop-api-metadata.md §4`/`5-makeshop.md §4.1` 동반 갱신**
- catalog-sync 테스트 도입 + catalog `status` 컬럼 추가 (현재 makeshop catalog 미보호)
- `makeshop-api-metadata.md` + `5-makeshop.md` 의 `pending_plans` 는 plan 이동(in-progress→complete) 시 양쪽 동기 갱신

## C-6 편입 — `buildIntegrationMeta` 레지스트리 전환 (cafe24 백로그)

[`cafe24-backlog-residual.md` C-6](./cafe24-backlog-residual.md) 는 "`buildIntegrationMeta` 가 cafe24 하드코딩이며 **두 번째 provider 추가 직전** `Map<serviceType, (entity) => IntegrationMeta>` 로 전환" 을 deferred 로 두었다. **메이크샵이 그 second provider** 이므로 본 작업에서 C-6 을 함께 해소한다.

**현재 cafe24 하드코딩이며 makeshop 추가 시 일반화 필요한 derived 필드** (`integrations.service.ts#buildIntegrationMeta` → `IntegrationDto`):

| derived 필드 | 현재(하드코딩) | makeshop 추가 후 |
|---|---|---|
| `autoRefresh` | `service_type ∈ {cafe24, google}` → true | **makeshop 추가** (auth-code + refresh → true). registry 의 `supportsTokenAutoRefresh` 로 파생 |
| `appUrl` | cafe24 Private (`app_type='private'`) 만 `${APP_URL}/api/3rd-party/cafe24/install/:installToken`, 그 외 null | makeshop ShopStore 설치도 App URL 보유 시 per-service 파생으로 일반화 (`.../makeshop/install/...`). cafe24 분기 하드코딩 → registry 함수 |
| `mall_id` 투영 | cafe24 `credentials.mall_id` → 평탄 컬럼 | makeshop `shop_uid` 동일 패턴 (data-model §2.10) |

**작업 분해**:
- (spec, 본 작업) `spec/2-navigation/4-integration.md` §IntegrationDto derived 필드 설명 — `appUrl`/`autoRefresh` 파생 규칙을 "cafe24 하드코딩" → "**service registry 기반 per-service 파생**" 으로 일반화하고 makeshop 추가.
- (spec, 본 작업) `spec/1-data-model.md §2.10` — `autoRefresh` 파생 집합에 makeshop 추가.
- (구현, 후속 developer) `buildIntegrationMeta` 를 `Map<serviceType, fn>` 레지스트리로 리팩토링 (cafe24 + makeshop 등록). C-6 의 코드 변경 본체.

> C-6 은 makeshop 구현 PR 에서 cafe24 하드코딩을 registry 로 전환하며 닫는다. 본 spec 작업은 그 전환이 만족해야 할 **derived-필드 규칙의 일반화**를 명세한다.

### consistency-check --impl-prep (2026-06-03, `review/consistency/2026/06/03/20_56_05/`)

**BLOCK: NO** — 구현 착수 가능. "Critical"(catalog status 컬럼 미정의)은 코드 모순 아닌 spec 보완으로 명시적 BLOCK: NO.

**해소 완료 (makeshop spec)**: C#1(_overview §6 status/scope/paginated 컬럼 정의)·W1(§4 step4 shop_uid 형식검증)·W2(0-common §4.2 D4 일반화)·W8(§5 Principle 11 주석)·W9(§8.1 sanitize 충돌 dedup 정책)·W11(§4 step6 전용 `makeshop-token-refresh` 큐 신설 결정)·INFO2(metadata POST only)·INFO8(§5.1 타입 컬럼)·INFO9(_overview title MakeShop)·INFO10(§4 step6 data-model 링크).

**미해소 — 처리 방침**:
- **W6·W7 (status: spec-only "비표준 enum")**: **false positive** — `spec-impl-evidence.md §3` 가 `spec-only` 를 정식 enum 으로 명시(backlog/spec-only/partial/implemented/archived). 이전 `--spec` 1차 run 은 오히려 `planned→spec-only` 로 고치라 했음(checker 간 모순). spec-only 유지.
- **W3·W4·W5·W10·INFO4·5·6·7·11 (타 spec 선재 이슈)**: send-email port `'out'` 표기·db-query/http `INTEGRATION_NOT_FOUND` surface·cafe24 B-3-7 rationale 누락·spec-sync-gaps 미결 3건·0-common Rationale 부재 등 — **makeshop 무관 기존 spec 이슈**. developer 범위 밖(spec = planner 영역) → 별도 planner follow-up 으로 분리(본 구현 PR 비포함).
- **INFO12 (stale worktree 6개)**: 운영 cleanup — `./cleanup-worktree-all.sh` 별도 처리.

## 구현 단계 (developer) — cafe24 구현 미러링

> 전제: cafe24 구현 지도 기준. `service_type`·node type 모두 string 컬럼(DB enum 아님) → enum 마이그레이션 불필요, partial UNIQUE 인덱스(V071)만. 최신 마이그레이션 = V070. 각 Phase = 독립 PR 지향(개별 `/ai-review` + `--impl-done`).

### Phase 0 — Foundation (metadata + 마이그레이션, 런타임 미배선)
- `nodes/integration/makeshop/metadata/types.ts` — `MakeshopResource`(7), `MAKESHOP_RESOURCES`, field/constraint 타입 (cafe24 types.ts 미러, **`restrictedApproval` 제거**, method 'GET'|'POST')
- `metadata/<shop|product|order|member|benefit|board|cpik>.ts` — **catalog `openapi/<section>.json` 에서 generator 로 161 op 생성** (id=operationId, scopeType=x-scope→read/write, method/path, requiredFields, fields{type,location})
- `metadata/index.ts` — `MAKESHOP_OPERATIONS_BY_RESOURCE`, `findMakeshopOperation`, `scopeForOperation`, `listAllMakeshopOperations`
- `metadata/constraint-validator.ts`, `metadata/public-meta.ts`(`buildMakeshopExtras`)
- `metadata/catalog-sync.spec.ts`(catalog md ↔ metadata 양방향) + `metadata.spec.ts` + catalog 에 `status` 컬럼 추가
- `migrations/V071__integration_makeshop_workspace_mall_idx.sql` — `(workspace_id, mall_id) WHERE service_type='makeshop'` partial UNIQUE
- 테스트: catalog-sync, metadata unit

### Phase 1 — C-6 registry + service-registry
- `modules/integrations/integrations.service.ts` `buildIntegrationMeta` → `Map<serviceType, fn>` 레지스트리 전환 (cafe24 + makeshop appUrl/autoRefresh/mall_id 파생) — **C-6 해소**
- `services/service-registry.ts` — `MAKESHOP_OAUTH_FIELDS`(shop_uid/client_id/client_secret/access_token/refresh_token), `MAKESHOP_SCOPES`(<x-scope>.read/.write 공백구분), SERVICE 엔트리(`type:'makeshop'`, `oauthProvider:'makeshop'`, `supportsTokenAutoRefresh:true`)
- 테스트: integrations.service(레지스트리), service-registry

### Phase 2 — API client + 노드
- `makeshop-api.client.ts` — `MakeshopApiClient` (Bearer, base `connect.makeshop.co.kr/api/v1/{shop_uid}/`, **flat body**, 401 refresh+1retry, 429 Retry-After best-effort, refresh via `auth.makeshop.com/oauth/token` rotation)
- `makeshop-token-refresh.processor.ts` + constants + BullMQ queue
- `makeshop.schema.ts`·`makeshop.handler.ts`·`makeshop.component.ts`·`makeshop.module.ts`·`index.ts`
- `nodes/index.ts` `ALL_NODE_COMPONENTS` 등록
- 테스트: handler·api.client·processor spec

### Phase 3 — OAuth + 설치
- `integration-oauth.service` makeshop auth-code (authorize/token `auth.makeshop.com`, **공백구분 scope**, PKCE S256)
- ShopStore 설치 HMAC 검증 endpoint (cafe24 install 미러 — ⚠ makeshop install URL·HMAC 메시지 구성 공식문서 확인 선행)
- `third-party-oauth.controller.ts` makeshop 라우트 + shop_uid precheck
- 테스트: oauth service spec

### Phase 4 — MCP tool provider
- `tool-providers/makeshop-mcp-tool-provider.ts` (cafe24 미러, **하이픈 operationId → `_` sanitize**), provider stack 등록
- 테스트: provider spec

### Phase 5 — Frontend
- `IntegrationSelector` serviceTypes makeshop, catalog i18n `dict/{ko,en}/makeshopCatalog.ts`, Add Integration 폼(shop_uid/client_id/secret/scope), allowlist editor, 상세 카드, shop_uid precheck
- user guide mdx (`user-guide-writer` 위임)
- 테스트: frontend specs

### Phase 6 — e2e + 마무리
- makeshop 노드 실행 + OAuth 흐름 e2e, catalog `status` sync 승격, §9.7 open question 확정 반영

## 후속 (별도 plan)

- **통합 공통 webhook/trigger 노드**: cafe24·makeshop 양쪽 모두 inbound webhook(이벤트 수신) trigger 가 아직 없다. makeshop cpik 11 webhook + cafe24 webhook 을 함께 다루는 trigger 노드 설계를 별 plan 으로 분리. makeshop 측 webhook 구독 등록 API 는 현재 미문서화(open question) — 구현 전 makeshop 파트너센터 확인 필요.
- **메이크샵 노드 구현**: 본 spec merge 후 `developer` 가 `/consistency-check --impl-prep` 부터 착수. backend 메타데이터 생성 + catalog-sync 테스트 도입(현재 makeshop catalog 은 sync test 미보호).
