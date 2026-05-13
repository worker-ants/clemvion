---
worktree: cafe24-integration-a3f5e2
started: 2026-05-13
owner: project-planner
---

# Cafe24 Admin API 통합 — Spec 작업

> 본 plan 은 spec 작성·개정만 추적한다. 후속 구현(backend/frontend)은 별도 plan 으로 인계한다.

## 배경

`/integrations` 에 한국 이커머스 SaaS Cafe24 Admin API 를 연동하고, 워크플로 노드와 AI Agent 도구 양쪽에서 활용 가능하게 한다. 사용자와의 사전 합의는 다음과 같다 (대화 로그).

### 확정된 결정사항

1. **연동 방식 (옵션 A)** — Cafe24 Admin API 를 "Internal MCP Bridge" 패턴으로 wrapping. 같은 `Integration` 엔티티(`service_type='cafe24'`) 1개가 (a) 워크플로의 `cafe24` 단일 노드, (b) AI Agent 의 MCP 도구 양쪽에 동시 노출. 외부 MCP 서버 프로세스가 아니라 backend in-process bridge.
2. **앱 발급 방식** — Cafe24 앱스토어 공개 앱 + 사용자 자체 비공개 앱 둘 다 지원. Step 2 폼에 `app_type` 라디오.
3. **Phase 1 스코프** — Cafe24 Admin API 18개 카테고리 전부 커버. 단일 `cafe24` 노드 내 Resource × Operation × Fields 동적 폼.
4. **Rate Limit 정책** — Cafe24 Leaky Bucket. `X-Cafe24-Call-Remain` 헤더 기반 backoff. 429 시 헤더 값만큼 sleep 후 최대 2회 재시도. 노드 호출 / MCP Bridge 호출 모두 같은 wrapper 공유.

### Cafe24 API 특이점 (spec 반영 필수)

- `mall_id` 가 base URL 의 일부 (`https://{mall_id}.cafe24api.com/api/v2/admin/...`). authorize URL 도 mall 별로 다름 → OAuth Step 2 폼에서 OAuth 버튼 누르기 전에 mall_id 입력 선행 필수.
- scope 는 `mall.read_*` / `mall.write_*` 수십 개 → 카테고리 단위 프리셋 + 고급 옵션 2단 UI.
- Access Token 2h / Refresh Token 14d 자동 갱신 (기존 [§10.5 토큰 자동 갱신](../../spec/2-navigation/4-integration.md#105-토큰-자동-갱신) 흐름 활용).
- 18개 카테고리: Store, Product, Order, Customer, Community, Design, Promotion, Application, Category, Collection, Supply, Shipping, Salesreport, Personal, Privacy, Mileage, Notification, Translation.

### credentials JSONB 스키마

```jsonc
{
  "mall_id": "myshop",                   // 필수
  "app_type": "public" | "private",      // 필수
  "client_id":     "...",                // private 시에만
  "client_secret": "...",                // private 시에만 (🔒)
  "access_token":  "...",                // 🔒
  "refresh_token": "...",                // 🔒
  "scopes": ["mall.read_product", ...],
  "expires_at": "ISO8601",
  "user_id": "admin@..."
}
```

### AI Agent 노출 모델

- `Integration.service_type='cafe24'` 항목도 AI Agent 의 `mcpServers` 셀렉트에서 선택 가능.
- 도구 이름: `mcp_<int_id 8자>__<resource>_<operation>` (예: `mcp_abc12345__product_list`).
- allowlist: `mcpServers[].enabledTools` 그대로 사용. UI 는 Resource 단위로 grouping.
- 기존 MCP provider / handler **변경 없음** — `Cafe24McpBridge` 가 `IMcpClient` 인터페이스를 in-process 로 구현.

## 작업 phase (spec 갱신 = 정식 phase)

> 사용자 메모리 피드백: "구현 plan 은 spec 갱신까지 정식 phase 로 포함, '외부 위임' 한 줄로 묶지 말 것" — 본 plan 은 그 자체가 spec 작업이며, 각 spec 파일을 정식 작업 단위로 명시한다.

### Phase 0. 컨텍스트 로드 (완료)

- [x] 관련 spec 전체 선독: `spec/1-data-model.md` §2.10 / `spec/2-navigation/4-integration.md` / `spec/4-nodes/4-integration/**` / `spec/4-nodes/3-ai/{0-common,1-ai-agent}.md` / `spec/5-system/11-mcp-client.md` / `spec/conventions/node-output.md` / `spec/4-nodes/4-integration/1-http-request.md`
- [x] 충돌 가능 plan 검토: `plan/in-progress/ai-agent-tool-connection-rewrite.md` (일반 도구 `tool_*` 재작성 — 본 작업과 무관, MCP 경로만 사용하므로 충돌 없음)

### Phase 1. Draft 작성 (consistency-check 입력)

- [x] `plan/in-progress/spec-draft-cafe24-integration.md` 작성 — 11개 파일의 변경안을 한 문서에 정리 (2026-05-13 v1 → consistency-check 1차 BLOCK → v2 보강)

### Phase 2. consistency-check (의무 차단 지점)

- [x] **1차 호출** (`review/consistency/2026-05-13_23-08-00/`) — Critical 2건 + Warning 11건. BLOCK. draft v2 로 보강
- [x] **재호출** (`review/consistency/2026-05-13_23-22-19/`) — Critical 0건. BLOCK 해소. Warning 8 / Info 9 의 즉시반영 권장사항은 spec write 시 함께 처리
- [x] Warning 권장사항 spec write 시 반영 완료: W1 (Node.type 마이그레이션 전제 — implementation 단계 위임 명시), W2 (integrationServiceType 다중값), W3 (process-level → 동일 프로세스 인스턴스 내), W4 (Principle 3.3 cafe24), W5 (callTool bare name), W6 (cafe24_operator_id 개명), W7 (application 주석), I1 (0-overview §6.3), I2 (cached_capabilities 외부 HTTP 전용), I3 (IMcpClient backend 경로), I4 (mall_id validation rule), I7 (scopeType 개명), I8 (token_expires_at 원자 갱신)

### Phase 3. spec 반영 (총 12개 파일 — 1차 BLOCK 해소로 2개 + Warning 해소로 2개 추가)

- [x] **spec/1**: `spec/1-data-model.md` §2.10 — `service_type` 설명에 `cafe24` 추가, 진입점 링크
- [x] **spec/1b**: `spec/1-data-model.md` §2.6 — Node.type 전체 목록에 `cafe24` (category=integration) 추가
- [x] **spec/2**: `spec/2-navigation/4-integration.md` — §2.2 라벨 / §2.5 카드 / §3.2 Cafe24 OAuth 흐름 / §5.8 Cafe24 인증(신규) / §9.2 oauth/begin body / §10.1 callback provider / §10.3 provider 표 / §10.5 토큰 갱신 (+ 원자 갱신 명시) / §11 만료 스캐너 / §14.1 usage 기록 / §14.2 IntegrationSelector
- [x] **spec/3**: `spec/4-nodes/4-integration/_product-overview.md` §2.6 — INT-SV-05
- [x] **spec/4**: `spec/4-nodes/4-integration/0-common.md` — 도입부 scope note + 진입 링크 + §5 캔버스 요약 + §7 출력 색인 + CHANGELOG
- [x] **spec/5**: `spec/4-nodes/4-integration/4-cafe24.md` 신규 — `## Overview` 포함, Resource/Operation, 에러 코드, AI Agent 노출, Rationale (mutex 범위 §9.6 포함)
- [x] **spec/6**: `spec/conventions/cafe24-api-metadata.md` 신규 — `scopeType` 필드명, callTool bare id 경계 명시
- [x] **spec/7**: `spec/5-system/11-mcp-client.md` — §1 transport 서술 / §2.3 Internal Bridge 신설 / §3.1 화이트리스트 / §3.2 외부 한정 / §3.3 cached_capabilities 외부 전용 / §4 lifecycle bridge 분기 / §11 데이터 영향 / §12 확장 포인트
- [x] **spec/8**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 mcpServers + §2 UI 라벨·필터 정책
- [x] **spec/9**: `spec/4-nodes/3-ai/0-common.md` §3 McpServerRef + §8 캔버스 카운트 정책
- [x] **spec/10**: `spec/3-workflow-editor/4-ai-assistant.md` §4.3.1 — integrationServiceType hint 다중값 (string|string[]) 지원 명시
- [x] **spec/11 (W4)**: `spec/conventions/node-output.md` Principle 3.3 — 에러 포트 보유 노드 목록에 `cafe24` 추가
- [x] **spec/12 (I1)**: `spec/0-overview.md` §6.3 — 로드맵에 Cafe24 통합 + Internal Bridge 패턴 확장 항목

### Phase 4. 정리

- [x] 모든 체크박스 완료 확인 (Phase 0~3 모두 [x])
- [x] 사용자 검토 통과 (2026-05-14) — 본 plan 을 `plan/complete/` 로 이동
- [x] 후속 `cafe24-implementation` plan 작성 (동일 worktree `cafe24-integration-a3f5e2` 에서 계속 진행 — branch 일관성 유지하여 spec+impl 단일 PR 로 머지 예정)

## 영향 분석

### 영향받는 spec 파일 (9)

| # | 파일 | 변경 유형 | 사유 |
|---|---|---|---|
| 1 | `spec/1-data-model.md` | 개정 | `service_type` 컬럼 설명에 `cafe24` 추가 (String 컬럼이라 마이그레이션 불요) |
| 2 | `spec/2-navigation/4-integration.md` | 개정 (다수 절) | 통합 관리 화면의 Cafe24 흐름 — 카드·폼·인증 스키마·OAuth provider·UI selector |
| 3 | `spec/4-nodes/4-integration/_product-overview.md` | 개정 (§2.6) | PRD 지원 서비스 목록 |
| 4 | `spec/4-nodes/4-integration/0-common.md` | 개정 (§7) | 출력 구조 색인 |
| 5 | `spec/4-nodes/4-integration/4-cafe24.md` | 신규 | Cafe24 노드 자체 spec |
| 6 | `spec/conventions/cafe24-api-metadata.md` | 신규 | 메타데이터 컨벤션 (Resource/Operation/Field 형식) |
| 7 | `spec/5-system/11-mcp-client.md` | 개정 (다수 절) | Internal Bridge transport 도입, service_type 화이트리스트 |
| 8 | `spec/4-nodes/3-ai/1-ai-agent.md` | 개정 (§1) | `mcpServers` 화이트리스트 |
| 9 | `spec/4-nodes/3-ai/0-common.md` | 개정 (§3) | `McpServerRef` 화이트리스트 |

### 영향받지 않는 spec (확인됨)

- `spec/5-system/4-execution-engine.md` §10 Integration Handler 계약 — Cafe24 핸들러도 동일 계약(workspace 확인 / Integration 조회 / 타입 검증 / credential 충족 / 외부 호출 / Usage 로깅)을 따르므로 본문 변경 없음.
- `spec/conventions/node-output.md` — 5필드 invariant·Principle 1~11 그대로 적용. 변경 없음.
- `spec/2-navigation/4-integration.md` §11 만료 스캐너 — Cafe24 도 OAuth refresh 토큰 보유 → 기존 흐름 그대로 적용. `service_type='mcp'` 처럼 제외 안 함.

### 동시 작업 중인 plan 과의 충돌

| Plan | 충돌 가능성 | 조치 |
|---|---|---|
| `plan/in-progress/ai-agent-tool-connection-rewrite.md` | 일반 도구 `tool_*` 재작성 진행 중. 본 작업은 MCP 경로(`mcp_*`) 만 사용 → **무관** | 본 작업에서 `tool_*` 경로 건드리지 않음. AI Agent §1 의 "재작성 예정" 박스도 그대로 보존 |
| `plan/in-progress/marketplace-and-plugin-sdk.md` | Integration plugin 마켓플레이스 (`MP-CT-03`) 와 연관 가능 | 본 작업은 marketplace 외부에서 first-party Integration 으로 추가. plugin 형태로 분리하는 후속 작업 가능성만 Rationale 에 inline |
| `plan/in-progress/node-output-redesign` | node-output 컨벤션 변경 (Principle 0~11 정착 후속) | 본 작업의 `cafe24` 노드는 이미 5필드 invariant + `output.error.{code,message,details?}` + Principle 7 config echo 채택 → 충돌 없음 |

## 의존성·리스크

- **의존**: 기존 MCP Client spec(§5 도구 노출 모델) 의 `mcp_<sid>__<toolName>` 이름 규칙·allowlist UI 그대로 재사용 → AI Agent 측 코드 변경 최소화의 핵심 전제.
- **리스크 1 (메타데이터 폭증)**: 18 카테고리 × 평균 10 operation = ~180 도구. allowlist 미설정 시 LLM 컨텍스트가 비대해진다. → spec/2-navigation/4-integration.md 의 Cafe24 신규 등록 흐름에 "Resource 카테고리별 시작 프리셋" 권장 명시.
- **리스크 2 (rate-limit 공유)**: 노드 호출 + AI Agent MCP 호출이 같은 Integration credential 사용 → leaky bucket 공유. AI Agent 가 빠른 연속 호출 시 노드 호출이 지연될 수 있음. → 4-cafe24.md 에 "Integration 단위 rate-limit 공유" 명시.
- **리스크 3 (도구 메타데이터 동기화)**: Cafe24 가 API 를 추가/변경할 때 우리 메타데이터 테이블의 누락 위험. → conventions/cafe24-api-metadata.md 에 "endpoint 추가 절차" 표준화.

## 후속 인계 항목

본 spec 작업 완료 후 별도 worktree 에서 진행할 implementation plan 구성요소 (현 plan 의 범위 외):

1. Backend: Cafe24 OAuth provider 모듈, `Cafe24ApiClient` (rate-limit-aware wrapper), `Cafe24McpBridge` (in-process IMcpClient), `cafe24` 노드 핸들러, 메타데이터 테이블, 자동 토큰 갱신.
2. Frontend: 모달 카드, Step 2 폼(mall_id + app_type + scope 카테고리), 단일 노드 설정 패널(Resource/Operation/Fields 동적 폼), AI Agent mcpServers 셀렉트에 cafe24 표시, allowlist Resource grouping.
3. 테스트: Cafe24 sandbox/모킹 전략 정의, e2e 시나리오 (등록 → 호출 → 토큰 만료 → 재인증).

> 위 항목은 본 spec 이 완료된 후 별도 `plan/in-progress/cafe24-implementation.md` 로 분리한다. **현 plan 은 spec 완료 시점에 `plan/complete/` 로 이동한다.**
