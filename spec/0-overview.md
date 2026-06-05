# Spec: 시스템 아키텍처 개요

> 관련 문서: [데이터 모델](./1-data-model.md) · [브랜드 가이드](./6-brand.md) · [노드 Output 규약](./conventions/node-output.md)

---

## Overview (제품 정의)

### 1. 제품 비전

**"흐름은 설계하는 것이 아니라, 자라나야 한다."**

Clemvion은 AI 에이전트와 노코드 워크플로우 빌더를 통합한 실행 플랫폼이다. 시각적 캔버스에서 노드를 연결해 복잡한 비즈니스 자동화를 구현하되, 워크플로우 안에 AI 에이전트 노드를 삽입함으로써 각 단계가 단순 실행이 아닌 **판단과 적응**을 수행하게 한다. 개발자에게는 고급 설정과 코드 편집 옵션을, 비개발자에게는 직관적인 드래그 앤 드롭 인터페이스와 AI 어시스턴트와의 대화형 편집을 제공한다.

브랜드 스토리·정체성은 [`brand.md`](./6-brand.md)를 참조한다.

---

### 2. 목표

| 구분 | 목표 |
|------|------|
| **사용자 가치** | 반복 업무를 자동화하여 생산성 향상. AI Agent를 활용한 지능형 워크플로우 구축 |
| **비즈니스 가치** | SaaS와 셀프 호스팅 양립으로 다양한 고객층 확보. 마켓플레이스를 통한 생태계 구축 |
| **기술 목표** | 확장 가능한 노드 시스템, 안정적 워크플로우 실행 엔진, 실시간 디버깅 지원 |

---

### 3. 타겟 사용자

#### 3.1 비개발자
- 마케팅, 운영, CS 등 비즈니스 부서 담당자
- 반복 업무 자동화 필요성을 느끼는 사용자
- 직관적 UI를 통해 워크플로우를 구성

#### 3.2 개발자
- 빠른 프로토타이핑 및 자동화 파이프라인 구축
- 코드 편집, 커스텀 노드 개발, API 직접 호출 등 고급 기능 활용
- 셀프 호스팅 환경 운영

#### 3.3 팀/조직
- 워크플로우 공유 및 협업
- 역할/권한 기반 접근 관리
- 조직 단위 통합(Integration) 설정 공유

---

### 4. 사용 단위

- **개인**: 개인 워크스페이스에서 독립적으로 워크플로우 생성/관리
- **팀/조직**: 팀 워크스페이스를 통해 워크플로우 공유, 역할/권한 관리, 공통 Integration 설정 관리

---

### 5. 배포 방식

| 방식 | 설명 |
|------|------|
| **SaaS** | 클라우드 호스팅, 멀티 테넌트 환경, 구독 기반 과금 |
| **셀프 호스팅** | 온프레미스 또는 프라이빗 클라우드 배포, 단일/멀티 테넌트 선택 가능 |

두 배포 방식 모두 동일한 기능을 제공하며, 환경 독립적 설계를 통해 설정만으로 배포 방식을 전환할 수 있어야 한다.

---

### 6. 현재 구현 상태 및 남은 로드맵

#### 6.1 구현 완료 (✅)

| 영역 | 기능 |
|------|-----------|
| **내비게이션** | 대시보드, 워크플로우 목록, 트리거 목록, 스케줄, 통합, Knowledge Base, LLM 설정, 인증 설정, 통계, 시스템 상태(/system-status), 사용자 매뉴얼(/docs), 사용자 프로필 |
| **워크플로우 에디터** | 캔버스 기반 노드 편집, 엣지 연결, 실행·디버깅, 버전 히스토리 |
| **노드 시스템** | Trigger(Manual), Logic(If/Else·Switch·Loop·ForEach·Map·Filter·Split·Merge·Parallel·Background·Variable Decl/Mod), Flow(Workflow), AI(AI Agent·Text Classifier·Information Extractor), Integration(HTTP·Database·Send Email), Data(Transform·Code), Presentation(Carousel·Chart·Form·Table·Template) |
| **AI 플랫폼** | LLM Config(프로바이더·모델·API Key — v1 의 5개 provider OpenAI/Anthropic/Google/Azure OpenAI/Local Ollama·vLLM 모두 스트리밍 ✅), Knowledge Base(문서 업로드·임베딩·RAG 검색), **Graph RAG**(KB 모드 선택 + entity/relation 자동 추출 + Hybrid 검색 + Entity/Relation 목록·삭제 + 3D 그래프 시각화 — 상세: [PRD 9](./5-system/10-graph-rag.md)), **Rerank**(KB 단위 검색 후처리 — cross-encoder / cross-encoder+LLM grading, RerankConfig 프로바이더 tei/cohere — 상세: [Spec RAG 검색 §3.3](./5-system/9-rag-search.md#33-검색-후처리--리랭킹-선택적)) |
| **Workflow AI Assistant** | 에디터 내 채팅형 AI로 자연어 요청 → 노드·엣지 자동 구성. Clarify → Plan → Execute 3단계 대화 루프, SSE 스트리밍, 세션 영속. 상세: [PRD 2 §10](./3-workflow-editor/_product-overview.md#10-ai-assistant-ed-ai-), [PRD 6 §3.6](./4-nodes/3-ai/_product-overview.md#36-workflow-ai-assistant). |
| **팀 워크스페이스·RBAC** | 데이터 모델(`Workspace.type = personal \| team`, `WorkspaceMember.role`) + 백엔드 모듈(`codebase/backend/src/modules/workspaces`) + 프런트엔드 UI(워크스페이스 전환, 멤버 초대·역할·소유권 이전). 회원가입 시 개인 워크스페이스가 자동 생성되고 `X-Workspace-Id`는 서버가 자동 매핑한다. |
| **워크스페이스 단위 Integration 공유·RBAC** | Integration 은 워크스페이스 단위로 격리되어 팀 멤버 간 공유되며, 모든 엔드포인트가 `@WorkspaceId()` 로 스코프되고 작성/수정/삭제(create·update·delete·rotate)는 `@Roles('editor')` 가드로 Editor+ 로 제한된다 (`codebase/backend/src/modules/integrations/integrations.controller.ts`). **이 `editor` 는 라우트 가드 floor 이며, Personal vs Organization-scope 별 세부 RBAC(Organization-scope 의 생성·수정·전환은 Admin+)는 [Spec Integration §8](./2-navigation/4-integration.md#8-권한-규칙) + [Spec 사용자/워크스페이스 §4.2](./2-navigation/9-user-profile.md#42-역할-권한-매트릭스) 가 SoT — 본 행과 상보 관계(모순 아님).** navigation NAV-IN-07 ✅ 와 일치. 여러 워크스페이스를 가로지르는 조직(상위) 레벨 공유는 §6.3 참조. |
| **Cafe24 통합** | 워크플로 `cafe24` 단일 노드 (18 카테고리 메타데이터 기반 Resource × Operation) + AI Agent Internal MCP Bridge 양방향 노출 + Public/Private 앱 OAuth + Cafe24 Developers "테스트 실행" / "앱으로 가기" App URL 흐름 + leaky-bucket rate limit + BullMQ 기반 cross-pod refresh 직렬화 + 7일 임계 + 6h cron 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신) — 모두 구현 완료. spec: [Cafe24 노드](./4-nodes/4-integration/4-cafe24.md), [통합 §5.8](./2-navigation/4-integration.md#58-cafe24). 다른 first-party 이커머스(Shopify·Naver Smartstore)로의 Internal MCP Bridge 패턴 확장은 §6.3 참조. |
| **MakeShop 통합** | 워크플로 `makeshop` 단일 노드 (7 섹션 메타데이터 기반 Resource × Operation, 161 REST operation) + AI Agent Internal MCP Bridge 양방향 노출 (`MakeshopMcpToolProvider`) + OAuth 2.1 auth-code+PKCE OAuth (`auth.makeshop.com`, refresh token rotation) + ShopStore 설치 HMAC + 전용 `makeshop-token-refresh` BullMQ 큐 cross-pod 직렬화 + frontend + e2e — 모두 구현 완료. Cafe24 와 동형 설계 (단일 호스트 `connect.makeshop.co.kr` + `shop_uid` path segment, flat JSON body). spec: [MakeShop 노드](./4-nodes/4-integration/5-makeshop.md), [통합 §5.9](./2-navigation/4-integration.md#59-makeshop), [API Catalog](./conventions/makeshop-api-catalog/_overview.md). CPIK webhook(이벤트 수신) 및 Shopify·Naver Smartstore 확장은 §6.3 참조. |
| **시스템** | 인증/인가(개인·팀 워크스페이스), REST API, 에러 처리, 표현식 엔진(`{{ }}`), 실행 엔진(Redis 큐 + 워커 풀, BullMQ 영속 `execution-continuation` 큐 기반 분산 continuation + §7.5 rehydration), WebSocket 실시간 상태, Webhook 수신, 실행 이력 |

#### 6.2 백엔드만 존재 / 부분 구현 (🚧)

| 영역 | 상태 |
|------|------|
| **Parallel 노드 (P1+P2)** | `ParallelExecutor`가 `p-limit` + `Promise.allSettled`로 분기를 동시 실행한다 (default ON — `PARALLEL_ENGINE=v1` 가 기본값. `PARALLEL_ENGINE=off` 로 rollback). branchCount(2~16), maxConcurrency(0=무제한, 1~16) 지원. 분기 내 블로킹 노드·back-edge 금지. 중첩 Parallel 은 깊이 ≤ 2 허용 + 외부 × 내부 concurrency 곱셈 cap = 32 silent clamp (P2, 2026-05-30 결정 #3). Merge `wait_all` 조합으로 결과 합산 가능. `waitAll=false` 는 spec out — fire-and-forget 의미는 Background 노드 사용 권고. |
| **임베드형 웹채팅 위젯 + SDK** | 외부 사이트에 삽입하는 iframe 격리형 웹채팅 위젯 SPA(`codebase/channel-web-chat`, Next.js CSR) + 개발자 SDK(스니펫 로더 / npm, `codebase/packages/web-chat-sdk`) + 샘플이 구현됐다. [External Interaction API](./5-system/14-external-interaction-api.md) 의 client-side consumer. 영역 spec 은 `status: partial` (인증/세션·보안 후속 항목 잔존). spec: [Channel Web Chat](./7-channel-web-chat/_product-overview.md). |

#### 6.3 로드맵 / 미구현 (❌)

| 영역 | 내용 |
|------|------|
| **Graph RAG 후속 (P2+)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override. P0~P2 본체는 §6.1 에서 ✅. 상세: [PRD 9 §8](./5-system/10-graph-rag.md#8-미결--후속-검토). |
| **조직(상위) 레벨 Integration 공유** | 워크스페이스 단위 Integration 공유·RBAC 는 §6.1 에서 ✅ (NAV-IN-07 ✅). 미구현 잔여는 **여러 워크스페이스를 가로지르는** 조직(상위) 단위 공유 — 후속 단계에서 도입 예정. |
| **마켓플레이스** | 워크플로우 템플릿·AI Agent 프리셋·Integration 플러그인·커스텀 노드 게시 기능. |
| **배포 자동화 확장** | 공식 Docker/Kubernetes 배포 가이드, 셀프 호스팅 번들. |
| **확장 SDK** | 노드 플러그인 SDK, 외부 커스텀 노드 개발/게시. |
| **Internal MCP Bridge 패턴 확장** | Cafe24·MakeShop (둘 다 구현 완료, §6.1) 이후 추가 first-party 이커머스 통합을 같은 [Spec MCP Client §2.3](./5-system/11-mcp-client.md#23-internal-bridge-in-process) 패턴으로 확장. Shopify·Naver Smartstore 등 추가 예정. |

---

### 7. 용어 정의

| 용어 | 정의 |
|------|------|
| **Workflow** | 노드와 엣지로 구성된 자동화 프로세스의 단위. 특정 트리거에 의해 실행되거나 수동으로 실행 가능 |
| **Node** | 워크플로우 내에서 하나의 작업 단위를 나타내는 구성 요소. 입력을 받아 처리하고 출력을 생성 |
| **Edge** | 두 노드 간의 연결. 데이터 흐름의 방향과 경로를 정의 |
| **Port** | 노드의 입출력 연결 지점. 입력 포트(Input Port)와 출력 포트(Output Port)로 구분 |
| **Trigger** | 워크플로우의 실행을 시작하는 이벤트. Webhook, 스케줄(Cron), 수동 실행 등의 유형 존재 |
| **Canvas** | 워크플로우를 시각적으로 편집하는 작업 공간 |
| **Integration** | 외부 서비스(Google, GitHub 등)와의 연동 설정 |
| **Knowledge Base** | AI Agent의 RAG(Retrieval-Augmented Generation)를 위한 지식 저장소. KB 단위로 `vector` / `graph` 검색 모드를 선택할 수 있다 |
| **Graph RAG** | 문서에서 추출한 entity / relation 으로 구성된 지식 그래프를 RAG 검색에 활용하는 방식. 본 제품에서는 vector seed → 그래프 확장 → rerank 의 Hybrid 흐름으로 동작한다 ([PRD 9](./5-system/10-graph-rag.md)) |
| **Entity / Relation** | Graph RAG 의 구성 요소. Entity 는 문서 chunk 에서 추출한 의미 단위(인물·조직·개념·위치·이벤트). Relation 은 두 entity 사이의 방향성 있는 관계 (head, predicate, tail) |
| **Execution** | 워크플로우의 한 번의 실행 인스턴스. 실행 상태, 각 노드별 입출력 데이터, 로그를 포함 |
| **Workspace** | 사용자 또는 팀이 워크플로우, Integration, 설정 등을 관리하는 독립된 공간 |
| **Marketplace** | Agent 설정, 워크플로우 템플릿, Integration 플러그인을 공유/설치하는 공간 |
| **Schedule** | 워크플로우를 주기적으로 실행하기 위한 Cron Job 규칙 |
| **LLM** | Large Language Model. AI Agent 노드에서 사용하는 언어 모델 |
| **RAG** | Retrieval-Augmented Generation. Knowledge Base에서 관련 정보를 검색하여 AI 응답 품질을 향상시키는 기법 |

---

### 8. 문서 맵

본 spec/ 트리는 **제품의 단일 진실(single source of truth)** 이다.

| 영역 | 위치 | 진입 문서 |
| --- | --- | --- |
| 제품 개요 + 시스템 아키텍처 | `spec/0-overview.md` | 본 문서 |
| 데이터 모델 | `spec/1-data-model.md` | 핵심 엔티티 정의 |
| 브랜드 가이드 | `spec/6-brand.md` | — |
| 정식 규약 | `spec/conventions/` | 노드 Output 규약, Swagger 패턴 등 |
| 내비게이션 화면 | `spec/2-navigation/` | `_product-overview.md` + 화면별 문서 |
| 워크플로우 에디터 | `spec/3-workflow-editor/` | `_product-overview.md` + 캔버스·노드 공통·엣지·실행·AI Assistant·버전 이력 |
| 노드 시스템 | `spec/4-nodes/` | `_product-overview.md` + `0-overview.md` + 카테고리별 폴더 (`1-logic/` ~ `7-trigger/`) |
| 시스템 공통 | `spec/5-system/` | `_product-overview.md` + 영역별 spec (인증·API 규칙·실행 엔진·LLM Client·임베딩·RAG·Graph RAG·MCP·Webhook·Agent Memory 등) |
| 채널 웹채팅 위젯 | `spec/7-channel-web-chat/` | `_product-overview.md` + 아키텍처·위젯 SPA·SDK·인증/세션·보안 |
| 데이터 흐름 | `spec/data-flow/` | `0-overview.md` + 도메인별 흐름·schema 매핑 (`1-audit` ~ `12-workspace`, 알파벳 순 숫자 prefix) |

문서 컨벤션:
- **`spec/0-overview.md` / `spec/1-data-model.md` / `spec/6-brand.md` (루트 레벨)** — `spec/` 루트에 위치하는 cross-cutting 진입 문서. `0-`/`1-`/`6-` 등 정수 prefix 로 정렬하며 영역 폴더 위에서 직접 참조한다. 본 패턴은 영역 폴더 안의 `0-overview.md` 와 prefix 형태는 같지만 위치(루트 vs 영역) 가 다르다. 본문 끝에 `## Rationale` 섹션을 둘 수 있다.
- **`_product-overview.md`** — 다중 spec 파일을 가진 영역의 제품 정의. 영역의 사용자 가치·요구사항·요구사항 ID.
- **`_layout.md`** — 영역 공통 레이아웃 (현재는 `2-navigation/` 만 사용).
- **`0-overview.md` / `0-common.md`** — 영역·카테고리 내부의 기술 아키텍처·공통 규약.
- **`N-name.md`** — 정렬된 상세 spec. 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline. 단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다.

> 구체 파일 목록은 본 문서가 박제하지 않는다. 폴더 구조는 `ls spec/` 또는 IDE 트리에서 확인한다.

---

## 1. 시스템 구성 개요

```
┌─────────────────────────────────────────────────────────┐
│                      Client (SPA)                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │Navigation│  │Workflow Editor│  │  Settings/Config  │  │
│  │  Views   │  │   (Canvas)    │  │     Views         │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API / WebSocket
┌───────────────────────┴─────────────────────────────────┐
│                    API Gateway                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Auth · Rate Limiting · Request Routing          │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
  ┌─────────────────────┼─────────────────────┐
  │                     │                     │
  ▼                     ▼                     ▼
┌──────────┐   ┌───────────────┐   ┌──────────────────┐
│ Core API │   │  Execution    │   │  Integration     │
│ Service  │   │  Engine       │   │  Service         │
│          │   │               │   │                  │
│ - CRUD   │   │ - Scheduler   │   │ - OAuth Manager  │
│ - Search │   │ - Worker Pool │   │ - Connector Pool │
│ - Version│   │ - State Mgmt  │   │ - Webhook Mgr    │
└────┬─────┘   └──┬─────┬──────┘   └────────┬─────────┘
     │            │     │                    │
     │            ▼     │                    │
     │   ┌─────────────┐│                    │
     │   │ Message     ││                    │
     │   │ Queue       ││                    │
     │   │ (Redis BQ)  ││                    │
     │   └──────┬──────┘│                    │
     │          ▼       │                    │
     │   ┌─────────────┐│                    │
     │   │  Workers    ││                    │
     │   │ (N 인스턴스)││                    │
     │   └─────────────┘│                    │
     │                   │                    │
     ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │
│  │PostgreSQL│  │   Redis   │  │  Vector  │  │ Object │ │
│  │(Primary) │  │(Cache/Pub)│  │   DB     │  │Storage │ │
│  └──────────┘  └───────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 주요 컴포넌트

### 2.1 Client (SPA)
- **기술**: React 기반 SPA
- **역할**: 내비게이션 화면, 워크플로우 에디터(캔버스), 설정 화면 렌더링
- **통신**: REST API(CRUD), WebSocket(실시간 실행 상태, 협업)

### 2.2 API Gateway
- 인증/인가 검증
- Rate Limiting
- 요청 라우팅
- CORS 관리

### 2.3 Core API Service
- 워크플로우, 노드, 트리거, 스케줄 등의 CRUD
- 검색 및 목록 조회
- 버전 관리
- 팀/워크스페이스 관리

### 2.4 Execution Engine
- 워크플로우 실행 오케스트레이션
- 노드 그래프 순회 및 실행
- 스케줄러 (Cron Job 기반 트리거)
- **Execution intake 큐** (Redis/BullMQ `execution-run`) — `execute()` 가 실행 시작을 큐에 발행(work-stealing/backpressure). 워커는 실행 1건(active 세그먼트: 시작→첫 BLOCK/완료)을 통째로 처리하고, 세그먼트 내부 노드는 in-process dispatch (per-node task queue 없음). 재개 세그먼트는 `execution-continuation` 큐, `waiting_for_input` 은 큐 없는 durable DB park ([실행엔진 §4](./5-system/4-execution-engine.md#4-worker-모델))
- **Worker Pool** (N개 인스턴스, 수평 확장) — `execution-run`/`execution-continuation` 큐를 work-stealing 으로 소비
- 실행 상태 관리 및 장애 시 복구 (active 세그먼트 stalled-job 재배달; `waiting_for_input` 은 무기한 보존)
- 단일 Execution **active-running 누적 타임아웃** (기본 30분, `EXECUTION_MAX_ACTIVE_RUNNING_MS`; `waiting_for_input` park 시간 제외 — [실행엔진 §8](./5-system/4-execution-engine.md#8-동시-실행-제한))

### 2.5 Integration Service
- OAuth 인증 플로우 관리
- Third-party API 커넥터 풀
- Webhook 수신/발신 관리
- 연동 상태 모니터링

### 2.6 Data Layer
- **PostgreSQL**: 주 데이터베이스 (워크플로우, 사용자, 설정 등)
- **Redis**: 캐시, BullMQ 큐 백엔드 (`execution-run` intake / `execution-continuation` / `background-execution`), 운영 lock (`exec:recover:lock`), KB 채널 등, 세션 관리
- **Vector DB**: Knowledge Base 임베딩 저장/검색
- **Object Storage**: S3 호환 스토리지 (AWS S3 / MinIO). 파일 업로드, Knowledge Base 원본 문서 등 저장

### 2.7 Object Storage (S3 호환)

| 항목 | 설명 |
|------|------|
| 호환성 | AWS S3 API 호환 (AWS S3, MinIO 등) |
| SaaS | AWS S3 사용 |
| 셀프 호스팅 | MinIO 기본 제공 (Docker Compose에 포함) |

**버킷 구조:**

```
{bucket}/
  kb/                              # Knowledge Base 원본 문서 (구현됨)
    {kbId}/
      {documentId}/
        {sanitizedFilename}
  {workspaceId}/                   # Form/Avatar 영역 (계획)
    forms/                         # Form 노드 파일 업로드
      {executionId}/
        {fileId}_{originalName}
    avatars/                       # 프로필 이미지
      {userId}.{ext}
```

| 영역 | 키 패턴 | 상태 | 코드 |
|------|---------|------|------|
| Knowledge Base 원본 문서 | `kb/{kbId}/{documentId}/{sanitizedFilename}` | 구현됨 | `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:723` |
| Form 노드 업로드 / Avatar | `{workspaceId}/forms/...`, `{workspaceId}/avatars/...` | 계획 (코드 미구현) | — |

> KB 원본 키는 `workspaceId` 를 prefix 로 두지 않는다 (`kb/...` 로 시작). 버킷 이름은 `S3_BUCKET` 환경변수 (기본 `workflow-storage`, `codebase/backend/.env.example:102`) 로 지정한다. 키 설계 근거·기각된 대안은 [Rationale § S3 객체 키 prefix 설계](#s3-객체-키-prefix-설계--kb-원본-키에서-workspaceid-제외-27) 참조.

### 2.8 DB 마이그레이션 (Flyway)

| 항목 | 설명 |
|------|------|
| 도구 | **Flyway** |
| 버전 관리 | SQL 기반 마이그레이션 파일, `V{version}__{description}.sql` 네이밍 |
| 롤백 정책 | **forward-only**. 별도 undo 스크립트(`U{version}__...sql`)는 두지 않는다. 운영 사고 대비 롤백 SQL 은 각 마이그레이션 파일 하단에 `-- DOWN:` 주석으로 보존한다 ([migrations/README.md §2](../codebase/backend/migrations/README.md)) |
| CI/CD 연동 | 배포 파이프라인에서 `flyway migrate` 자동 실행. 마이그레이션 실패 시 배포 중단 |
| 실행 방식 | 전용 Flyway Docker 이미지(`migrations/Dockerfile`, `flyway/flyway:10-alpine`)에 `V*.sql` + per-migration `V*.conf` 를 COPY 하고 DB 접속 정보는 CLI 인자(`-url` / `-user` / `-password`)로 주입한다. 환경별 `flyway-{env}.conf` 분리 파일은 쓰지 않는다 |
| 기준선 | 최초 배포 시 `flyway baseline`으로 기준점 설정 |

---

## 3. 공통 UI 패턴

### 3.1 레이아웃
- 좌측 고정 사이드바 + 우측 메인 컨텐츠 영역
- 에디터 화면은 사이드바를 축소하거나 숨길 수 있음

### 3.2 목록 화면 패턴
- 상단: 검색바 + 필터 + 생성 버튼
- 중앙: 테이블/카드 형태 목록
- 하단: 페이지네이션 또는 무한 스크롤
- 각 항목: 우클릭 또는 더보기(...) 메뉴로 액션 (편집, 복제, 삭제)

### 3.3 상세/설정 패널 패턴
- 우측 슬라이드 패널 또는 모달
- 변경사항 자동 저장 (에디터) 또는 저장/취소 버튼 (설정)
- 유효성 검증 즉시 피드백

### 3.4 상태 표시 패턴
- **Badge/Tag**: 리소스의 **상태** 를 한 단어로 표시. Active(초록), Inactive(회색), Error(빨강), Processing(파랑 스피너). 색은 리소스 상태 의미용 — 아래 Inline Alert 의 톤(긴급도) 과는 직교한다 (같은 파랑이라도 Badge 의 Processing 과 Alert 의 info 는 의미가 다름).
- **Toast**: 성공/실패/정보 알림. 도착 신호용 — 사용자가 다음 화면으로 넘어가도 무방한 **단발성** 메시지. Inline Alert 와 함께 쓸 때는 "응답이 왔다" 만 알리는 보조 역할 (본문은 Alert) 이며, standalone toast (mutate 단발 결과 통지) 와는 역할이 다르다.
- **Inline Alert**: 페이지 안에 영구 표시되는 안내 블록. 사용자가 **외부 작업**(예: Cafe24 Developers 콘솔에서 권한 활성화, 본사 승인 신청, 외부 시스템 키 회전, 이메일 인증)을 진행하는 동안 안내를 계속 참조해야 할 때 사용. modal/dialog 와의 차이는 "닫혀도 사라지지 않는다" — 사용자가 화면을 떠나지 않고 외부 작업과 안내를 병행할 수 있다.
  - **톤 매핑**: info(파랑) · warning(amber) · error(red) 3단계. **긴급도** 의미로 사용 — Badge 의 색(리소스 상태) 과 직교한다. 의미가 다른 두 alert 가 한 화면에 공존하면 톤으로 즉시 구분된다. 단순 상태 표시는 Badge 의 영역이며, Inline Alert 는 "사용자가 다음에 무엇을 해야 하는가" 가 본문일 때 쓴다.
  - **Toast 와의 역할 분리**: alert = 안내 본문, toast = 도착 신호. 응답이 왔다는 사실은 toast 가 1회 알리고, "무엇을 해야 하는가" 는 alert 가 계속 표시한다. 둘은 보완적이며 서로를 대체하지 않는다 — 외부 작업 안내를 toast 만으로 처리하면 사용자가 다른 화면으로 넘어간 순간 사라져 컨텍스트가 끊긴다.
  - **생존 주기**: 다음 관련 mutate 가 시작되기 **직전** (`useMutation` 의 `onMutate`) 에 비워, 옛 안내가 새 요청과 섞이지 않게 한다. 사용자가 명시적으로 닫는 X 버튼은 두지 않는다 — 외부 작업이 끝나 자동 갱신되거나, 다음 시도가 시작될 때 reset 된다. 사용자 dismiss 가 안전한 케이스(예: 단순 정보 안내, mutate 와 연결되지 않은 경고)에 한해 X 버튼을 허용한다.
  - **위치**: 영역별 `_layout.md` 가 아닌 `0-overview.md` 의 cross-cutting 자리에 둔다. 근거·기각된 대안은 [Rationale § Inline Alert 의 위치](#inline-alert-의-위치를-0-overviewmd-cross-cutting-자리로-34) 참조.
  - **현재 사용처**: Cafe24 Public 신규 등록 폼의 별도 승인 필요 권한 경고 (warning, 영구 — [§3.2 of 4-integration](./2-navigation/4-integration.md#32-step-2-인증-정보-입력) · [cafe24-restricted-scopes §4.2](./conventions/cafe24-restricted-scopes.md#42-차단-정책)), Scope & Permissions 탭의 Cafe24 Private 권한 추가 응답 안내 (warning — [§4.4 of 4-integration](./2-navigation/4-integration.md#44-scope--permissions-탭-oauth-한정)).
- **Skeleton**: 로딩 중 UI 플레이스홀더
- **에러 페이지·빈 상태**: 본 카탈로그의 대상은 in-page 신호(Badge/Toast/Alert/Skeleton). page-level 의 에러 페이지·빈 상태 패턴은 [`spec/2-navigation/11-error-empty-states.md`](./2-navigation/11-error-empty-states.md) 의 canonical 정의를 따른다.

### 3.5 반응형 및 테마
- 최소 해상도: 1280x720 — 에디터·대시보드 등 *작업형* 페이지의 권장 기준
- 라이트/다크 테마 지원
- 에디터는 데스크탑 전용 (모바일에서는 뷰어 모드만 제공)
- 사용자 가이드 (`/docs`) 같은 *열람형* 페이지는 1024px (lg) 미만에서도 모바일 진입(`SlideDrawer`)으로 최소 열람 기능을 제공한다. 상세는 [`./2-navigation/13-user-guide.md` §10](./2-navigation/13-user-guide.md#10-접근표시) 참조.

---

## 4. 영역별 진입 문서

요구사항 식별자(예: `NAV-WF-*`, `ED-AI-*`, `ND-IF~ND-BG`) 는 각 영역의 `_product-overview.md` 안에서 사용되고, 상세 spec 은 동일 폴더의 번호 매겨진 문서로 분배된다.

| 영역 | 제품 정의 | 상세 spec |
|------|-------------------|-----------|
| 내비게이션 | [`./2-navigation/_product-overview.md`](./2-navigation/_product-overview.md) | [`./2-navigation/`](./2-navigation/) 의 화면별 문서 |
| 워크플로우 에디터 | [`./3-workflow-editor/_product-overview.md`](./3-workflow-editor/_product-overview.md) | [`0-canvas`](./3-workflow-editor/0-canvas.md) · [`1-node-common`](./3-workflow-editor/1-node-common.md) · [`2-edge`](./3-workflow-editor/2-edge.md) · [`3-execution`](./3-workflow-editor/3-execution.md) · [`4-ai-assistant`](./3-workflow-editor/4-ai-assistant.md) · [`5-version-history`](./3-workflow-editor/5-version-history.md) |
| 노드 시스템 | [`./4-nodes/_product-overview.md`](./4-nodes/_product-overview.md) | [`./4-nodes/0-overview.md`](./4-nodes/0-overview.md) + 카테고리별 폴더 |
| AI 플랫폼 (LLM/KB/Assistant) | [`./4-nodes/3-ai/_product-overview.md`](./4-nodes/3-ai/_product-overview.md) | [`./4-nodes/3-ai/`](./4-nodes/3-ai/) · [`./5-system/7-llm-client.md`](./5-system/7-llm-client.md) |
| 통합·KB·마켓플레이스 | [`./4-nodes/4-integration/_product-overview.md`](./4-nodes/4-integration/_product-overview.md) | [`./4-nodes/4-integration/`](./4-nodes/4-integration/) · [`./2-navigation/4-integration.md`](./2-navigation/4-integration.md) · [`./2-navigation/5-knowledge-base.md`](./2-navigation/5-knowledge-base.md) · [`./2-navigation/8-marketplace.md`](./2-navigation/8-marketplace.md) |
| 비기능 요구사항 | [`./5-system/_product-overview.md`](./5-system/_product-overview.md) | [`./5-system/`](./5-system/) 의 영역별 문서 |
| 실행 이력 | (Overview 섹션 통합) | [`./2-navigation/14-execution-history.md`](./2-navigation/14-execution-history.md) |
| Webhook | (Overview 섹션 통합) | [`./5-system/12-webhook.md`](./5-system/12-webhook.md) |
| Graph RAG | (Overview 섹션 통합) | [`./5-system/10-graph-rag.md`](./5-system/10-graph-rag.md) |
| 브랜드 가이드 | — | [`./6-brand.md`](./6-brand.md) |
| 노드 Output 규약 | — | [`./conventions/node-output.md`](./conventions/node-output.md) |
| ExecutionContext 설계 규약 | — | [`./conventions/execution-context.md`](./conventions/execution-context.md) |
| 에러 코드 명명 규약 | — | [`./conventions/error-codes.md`](./conventions/error-codes.md) |

---

## 5. 배포 환경 분리

| 항목 | SaaS | 셀프 호스팅 |
|------|------|-------------|
| 인증 | 자체 인증 + OAuth 소셜 로그인 | 자체 인증 + LDAP/SAML 옵션 |
| 데이터 격리 | 멀티 테넌트 (논리적 격리) | 단일 테넌트 (물리적 격리) |
| 스케일링 | 자동 수평 확장 | 수동 구성 (Docker Compose / K8s) |
| 업데이트 | 자동 롤링 업데이트 | 수동 버전 업그레이드 |
| 마켓플레이스 | 중앙 마켓플레이스 접근 | 프록시 또는 오프라인 패키지 |
| 모니터링 | 내장 대시보드 + 관리형 알림 | Prometheus/Grafana 연동 가이드 |

---

## Rationale

본 절은 본문에 inline 으로 산재된 결정 근거를 한 곳에 모은다. 본문은 latest-only 사실을 기술하고, "왜 이 선택인가 / 어떤 대안을 기각했는가" 는 본 절을 참조한다. 새로 본 문서를 읽는 사람이 "현재 어떻게 동작하는가" 와 "왜 그렇게 결정됐는가" 를 섞지 않도록 분리한다.

### S3 객체 키 prefix 설계 — KB 원본 키에서 workspaceId 제외 (§2.7)

- **배경**: 멀티 테넌트 환경에서 S3 키를 `{workspaceId}/...` 로 prefix 하는 것이 일반적 패턴이다 (논리적 격리 + bucket policy 단위 권한 제어). Form/Avatar 영역은 §2.7 의 키 구조와 같이 이 패턴을 따른다.
- **채택**: Knowledge Base 원본 문서 키만 `kb/{kbId}/{documentId}/...` 로 두고 workspaceId 를 prefix 에서 제외한다. (`{workspaceId}/kb/...` 패턴은 키 길이가 늘어나고 KB list/delete 시 prefix scan 비용이 증가.)
- **trade-off**: `kbId` 자체가 KB 메타데이터의 FK 로 workspace 에 종속되므로 워크스페이스 격리는 application layer 에서 보장 (`kbId → workspaceId` 조회 후 권한 체크). 키 공간이 겹칠 위험은 없지만, 만약 향후 bucket policy 만으로 workspace 격리를 강제해야 하는 요구가 생기면 prefix 재설계 비용이 발생한다. 현 시점에서 그 요구는 없다.

### DB 마이그레이션 도구로 Flyway 채택 (§2.8)

- **배경**: Backend 가 NestJS + Prisma 를 사용하므로 `prisma migrate` 를 그대로 쓰는 것이 가장 자연스러운 선택지였다.
- **채택**: SQL 기반 Flyway (`V<NNN>__<descriptor>.sql`) 를 별도 도구로 도입. `prisma migrate` 대신 SQL 기반을 쓰는 이유: (a) 운영 DB 에 적용되는 SQL 을 PR 에서 그대로 리뷰 가능, (b) `ALTER` 의 락 거동·트랜잭션 모드 세밀 제어, (c) extension·partial index·CHECK 제약·`NOT VALID` 등 Postgres 고유 기능 표현.
- **trade-off**: Prisma client 의 schema 와 Flyway SQL 의 schema 가 이중으로 존재 — drift 위험. `codebase/backend/src/migrations.spec.ts` 가 CI 마다 schema_history vs 파일 정합성을 검증해 silent skip 을 차단하지만, schema 정의 자체의 이중 source 는 받아들인 비용이다. 상세 운영 규약: [Flyway 마이그레이션 운영 규약](./conventions/migrations.md).
- **forward-only 채택 (§2.8 롤백 정책)**: 별도 undo 스크립트(`U{version}__...sql`)는 두지 않는다. 운영 사고 시 빠른 복구는 각 마이그레이션 파일 하단의 `-- DOWN:` 주석(migrations/README.md §2)으로 충분하고, 자동 undo 체인을 유지하는 비용·리스크(부분 적용 상태에서의 down 실패) 대비 이득이 낮다고 판단했다. (구 초안의 `U{version}` undo 스크립트 전제는 폐기.)
- **CLI 인자 주입 채택 (§2.8 실행 방식)**: 환경별 `flyway-{env}.conf` 분리 파일 대신, 전용 Flyway Docker 이미지에 DB 접속 정보를 CLI 인자(`-url`/`-user`/`-password`)로 주입한다. 컨테이너 오케스트레이션(시크릿 주입)과 자연스럽게 맞고, 환경별 conf 파일을 레포에 두지 않아 시크릿 노출면을 줄인다. (구 초안의 환경별 conf 전제는 폐기.)

### 실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)

- **배경**: 워크플로우 실행은 (a) 노드별 외부 API 호출로 인한 가변적 latency, (b) Background / Parallel 등 동시 실행, (c) Form 등 사람-개입 노드의 장기 대기, (d) 셀프 호스팅 단일 노드부터 SaaS 멀티 노드까지 수평 확장이 동시에 필요하다.
- **채택**: Redis 기반 BullMQ 큐 + N 개 워커 인스턴스. **작업 단위는 execution-level active 세그먼트** — 워커가 실행 1건을 통째로(시작/재개→다음 BLOCK/완료) 처리하고, 세그먼트 내부 노드는 in-process dispatch (per-node task queue 아님). `execution-run`(intake) / `execution-continuation`(재개) / `background-execution`(Background/sub-workflow) 세 큐로 분리. per-node task queue 를 채택하지 않은 근거는 [실행엔진 §Rationale "per-node → execution-level intake 큐"](./5-system/4-execution-engine.md#rationale). (in-process 단일 프로세스는 SaaS 수평 확장 불가·장기 대기 점유 문제, Postgres `LISTEN/NOTIFY` 자체 큐는 retry/DLQ/rate limit/cross-pod 직렬화를 재구현해야 함.)
- **trade-off**: Redis 가 추가 의존성이 되어 셀프 호스팅 설치 부담이 늘었지만 (Docker Compose 에 포함), BullMQ `execution-continuation` ([Spec 실행 엔진 §7.4 / §7.5](./5-system/4-execution-engine.md#74-분산-실행-multi-instance)) · `background-execution` · BullMQ 기반 cron · Cafe24 cross-pod refresh 직렬화 등 다른 시스템도 같은 Redis 를 재사용해 net 부담이 낮다. 큐 작업 직렬화의 trade-off (snapshot 격리 등) 는 [Spec 실행 엔진 §3](./5-system/4-execution-engine.md) 와 [Conversation Thread §3.2](./conventions/conversation-thread.md#32-background-격리-근거) 참조.

### Inline Alert 의 위치를 `0-overview.md` cross-cutting 자리로 (§3.4)

- **배경**: navigation 영역 (Integration·Knowledge Base 등) 에서 Inline Alert 패턴이 처음 도입됐다. 영역별 `_layout.md` 에 적기 자연스러워 보였다.
- **채택**: 영역별 layout 대신 본 `0-overview.md §3.4` 의 cross-cutting 자리에 둔다.
- **trade-off**: cross-cutting 자리로 옮기면서 첫 사용처와의 물리적 거리가 멀어졌지만, 향후 webhook signing key 회전·notification preference 변경 등 navigation 외부로 사용처가 확장될 가능성을 고려할 때 영역 종속이 더 큰 비용으로 판단됐다.

### Cafe24·MakeShop 통합을 §6.1 (완료) 분류로 (§6)

- **배경**: Cafe24·MakeShop 통합은 노드·OAuth·rate limit·token 갱신(cafe24 cron / makeshop 큐)까지 모두 구현 완료됐으므로 §6.1 (구현 완료 ✅) 로 분류한다.
- **미래 확장**: Internal MCP Bridge 패턴을 Shopify·Naver Smartstore 등으로 확장하는 것은 §6.3 의 별도 행으로 유지.
- **trade-off**: §6 의 분류는 "구현 상태" 와 "확장 계획" 두 축이 섞이기 쉽다. 같은 영역이 §6.1 (완료) 과 §6.3 (확장 로드맵) 에 동시 등장하는 패턴을 명시적으로 허용해 두 축을 분리한다.

