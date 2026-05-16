# Spec: 시스템 아키텍처 개요

> 관련 문서: [데이터 모델](./1-data-model.md) · [브랜드 가이드](./6-brand.md) · [노드 Output 규약](./conventions/node-output.md)

---

## Overview (제품 정의)

> 출처: `prd/0-overview.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

---

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
| **내비게이션** | 대시보드, 워크플로우 목록, 트리거 목록, 스케줄, 통합, Knowledge Base, LLM 설정, 인증 설정, 통계, 사용자 매뉴얼(/docs), 사용자 프로필 |
| **워크플로우 에디터** | 캔버스 기반 노드 편집, 엣지 연결, 실행·디버깅, 버전 히스토리 |
| **노드 시스템** | Trigger(Manual), Logic(If/Else·Switch·Loop·ForEach·Map·Filter·Split·Merge·Parallel·Background·Variable Decl/Mod), Flow(Workflow), AI(AI Agent·Text Classifier·Information Extractor), Integration(HTTP·Database·Send Email), Data(Transform·Code), Presentation(Carousel·Chart·Form·Table·Template) |
| **AI 플랫폼** | LLM Config(프로바이더·모델·API Key — v1 의 5개 provider OpenAI/Anthropic/Google/Azure OpenAI/Local Ollama·vLLM 모두 스트리밍 ✅), Knowledge Base(문서 업로드·임베딩·RAG 검색), **Graph RAG**(KB 모드 선택 + entity/relation 자동 추출 + Hybrid 검색 + Entity/Relation 목록·삭제 + 3D 그래프 시각화 — 상세: [PRD 9](./5-system/10-graph-rag.md)) |
| **Workflow AI Assistant** | 에디터 내 채팅형 AI로 자연어 요청 → 노드·엣지 자동 구성. Clarify → Plan → Execute 3단계 대화 루프, SSE 스트리밍, 세션 영속. 상세: [PRD 2 §10](./3-workflow-editor/_product-overview.md#10-ai-assistant-ed-ai-), [PRD 6 §3.6](./4-nodes/3-ai/_product-overview.md#36-workflow-ai-assistant). |
| **팀 워크스페이스·RBAC** | 데이터 모델(`Workspace.type = personal \| team`, `WorkspaceMember.role`) + 백엔드 모듈(`backend/src/modules/workspaces`) + 프런트엔드 UI(워크스페이스 전환, 멤버 초대·역할·소유권 이전). 회원가입 시 개인 워크스페이스가 자동 생성되고 `X-Workspace-Id`는 서버가 자동 매핑한다. |
| **시스템** | 인증/인가(개인·팀 워크스페이스), REST API, 에러 처리, 표현식 엔진(`{{ }}`), 실행 엔진(Redis 큐 + 워커 풀, 분산 continuation bus), WebSocket 실시간 상태, Webhook 수신, 실행 이력 |

#### 6.2 백엔드만 존재 / 부분 구현 (🚧)

| 영역 | 상태 |
|------|------|
| **Parallel 노드 (P1)** | `PARALLEL_ENGINE=v1` 환경변수로 활성화하면 `ParallelExecutor`가 `p-limit` + `Promise.allSettled`로 분기를 동시 실행한다(off 시 기존 순차 동작). branchCount(2~16), maxConcurrency(0=무제한, 1~16) 지원. 분기 내 블로킹 노드·back-edge·중첩 Parallel은 금지. Merge `wait_all` 조합으로 결과 합산 가능. P2에서 중첩 Parallel과 waitAll=false를 추가할 예정이다. |
| **조직 레벨 Integration 공유** | 팀 워크스페이스 단위 Integration 공유는 후속 단계에서 도입 예정이다. |
| **Cafe24 통합** | 워크플로 `cafe24` 단일 노드 (18 카테고리 메타데이터 기반 Resource × Operation) + AI Agent Internal MCP Bridge 양방향 노출 + Public/Private 앱 OAuth + Cafe24 Developers "테스트 실행" / "앱으로 가기" App URL 흐름 + leaky-bucket rate limit + BullMQ 기반 cross-pod refresh 직렬화 + 10일 임계 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신) — 모두 구현 완료 (PR #20-#67). spec: [Cafe24 노드](./4-nodes/4-integration/4-cafe24.md), [통합 §5.8](./2-navigation/4-integration.md#58-cafe24). 남은 작업: Internal MCP Bridge 패턴을 Shopify·Naver Smartstore 등 first-party 이커머스로 확장 (§6.3). |

#### 6.3 로드맵 / 미구현 (❌)

| 영역 | 내용 |
|------|------|
| **Graph RAG 후속 (P2+)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override. P0~P2 본체는 §6.1 에서 ✅. 상세: [PRD 9 §8](./5-system/10-graph-rag.md#8-미결--후속-검토). |
| **Logic 확장 노드** | Parallel P2(중첩 Parallel, waitAll=false). |
| **마켓플레이스** | 워크플로우 템플릿·AI Agent 프리셋·Integration 플러그인·커스텀 노드 게시 기능. |
| **배포 자동화 확장** | 공식 Docker/Kubernetes 배포 가이드, 셀프 호스팅 번들. |
| **확장 SDK** | 노드 플러그인 SDK, 외부 커스텀 노드 개발/게시. |
| **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.2) 이후 Shopify·Naver Smartstore 등 first-party 이커머스 통합을 같은 [Spec MCP Client §2.3](./5-system/11-mcp-client.md#23-internal-bridge) 패턴으로 추가. |

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

본 spec/ 트리는 docs-consolidation(2026-05-12)으로 옛 `prd/`·`memory/`·`user_memo/` 를 흡수해 **제품의 단일 진실(single source of truth)** 로 통합되었다.

| 영역 | 위치 | 진입 문서 |
| --- | --- | --- |
| 제품 개요 + 시스템 아키텍처 | `spec/0-overview.md` | 본 문서 |
| 데이터 모델 | `spec/1-data-model.md` | 핵심 엔티티 정의 |
| 브랜드 가이드 | `spec/6-brand.md` | — |
| 정식 규약 | `spec/conventions/` | 노드 Output 규약, Swagger 패턴 등 |
| 내비게이션 화면 | `spec/2-navigation/` | `_product-overview.md` + 화면별 문서 |
| 워크플로우 에디터 | `spec/3-workflow-editor/` | `_product-overview.md` + 캔버스·노드 공통·엣지·실행·AI Assistant |
| 노드 시스템 | `spec/4-nodes/` | `_product-overview.md` + `0-overview.md` + 카테고리별 폴더 (`1-logic/` ~ `7-trigger/`) |
| 시스템 공통 | `spec/5-system/` | `_product-overview.md` + 영역별 spec (인증·API 규칙·실행 엔진·LLM Client·임베딩·RAG·Graph RAG·MCP·Webhook 등) |
| 데이터 흐름 | `spec/data-flow/` | `0-overview.md` + 도메인별 흐름·schema 매핑 (`1-audit` ~ `12-workspace`, 알파벳 순 숫자 prefix) |

문서 컨벤션:
- **`_product-overview.md`** — 다중 spec 파일을 가진 영역의 제품 정의(옛 PRD). 영역의 사용자 가치·요구사항·요구사항 ID.
- **`_layout.md`** — 영역 공통 레이아웃 (현재는 `2-navigation/` 만 사용).
- **`0-overview.md` / `0-common.md`** — 영역·카테고리 내부의 기술 아키텍처·공통 규약.
- **`N-name.md`** — 정렬된 상세 spec. 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline. 단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다.

별도 보관소:
- `plan/in-progress/` · `plan/complete/` — 작업 추적 라이프사이클
- `plan/complete/archive/from-memory/` — 옛 `memory/` 의 1회성 분석·진행 로그
- `plan/complete/archive/from-user-memo/` — 옛 `user_memo/` 의 초기 기획·노드 개선안

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
- **Message Queue** (Redis 기반) — 실행 태스크를 큐에 발행
- **Worker Pool** (N개 인스턴스, 수평 확장) — 큐에서 태스크를 소비하여 노드 실행
- 실행 상태 관리 및 장애 시 복구

### 2.5 Integration Service
- OAuth 인증 플로우 관리
- Third-party API 커넥터 풀
- Webhook 수신/발신 관리
- 연동 상태 모니터링

### 2.6 Data Layer
- **PostgreSQL**: 주 데이터베이스 (워크플로우, 사용자, 설정 등)
- **Redis**: 캐시, 실행 상태 Pub/Sub, 세션 관리
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
| Knowledge Base 원본 문서 | `kb/{kbId}/{documentId}/{sanitizedFilename}` | 구현됨 | `backend/src/modules/knowledge-base/knowledge-base.service.ts:723` |
| Form 노드 업로드 / Avatar | `{workspaceId}/forms/...`, `{workspaceId}/avatars/...` | 계획 (코드 미구현) | — |

> KB 원본 키는 `workspaceId` 를 prefix 로 두지 않는다. `kbId` 자체가 workspace 에 종속되므로 (KB 메타데이터의 FK) 키 공간이 겹치지 않으며, 키 길이가 짧아 S3 list/delete 비용이 낮다. 버킷 이름은 `S3_BUCKET` 환경변수 (기본 `workflow-storage`, `backend/.env.example:55`) 로 지정한다.

### 2.8 DB 마이그레이션 (Flyway)

| 항목 | 설명 |
|------|------|
| 도구 | **Flyway** |
| 버전 관리 | SQL 기반 마이그레이션 파일, `V{version}__{description}.sql` 네이밍 |
| 롤백 지원 | 각 마이그레이션에 대응하는 undo 스크립트 작성 (`U{version}__{description}.sql`) |
| CI/CD 연동 | 배포 파이프라인에서 `flyway migrate` 자동 실행. 마이그레이션 실패 시 배포 중단 |
| 환경 분리 | dev/staging/production 환경별 설정 파일 분리 (`flyway-{env}.conf`) |
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
- **Badge/Tag**: Active(초록), Inactive(회색), Error(빨강), Processing(파랑 스피너)
- **Toast**: 성공/실패/정보 알림
- **Skeleton**: 로딩 중 UI 플레이스홀더

### 3.5 반응형 및 테마
- 최소 해상도: 1280x720
- 라이트/다크 테마 지원
- 에디터는 데스크탑 전용 (모바일에서는 뷰어 모드만 제공)

---

## 4. 영역별 진입 문서

docs-consolidation(2026-05-12) 으로 PRD/Spec 가 통합되었다. 옛 PRD 의 식별자(예: `NAV-WF-*`, `ED-AI-*`, `ND-IF~ND-BG`) 는 각 영역의 `_product-overview.md` 안에서 그대로 사용되고, 상세 spec 은 동일 폴더의 번호 매겨진 문서로 분배된다.

| 영역 | 제품 정의 (전 PRD) | 상세 spec |
|------|-------------------|-----------|
| 내비게이션 | [`./2-navigation/_product-overview.md`](./2-navigation/_product-overview.md) | [`./2-navigation/`](./2-navigation/) 의 화면별 문서 |
| 워크플로우 에디터 | [`./3-workflow-editor/_product-overview.md`](./3-workflow-editor/_product-overview.md) | [`0-canvas`](./3-workflow-editor/0-canvas.md) · [`1-node-common`](./3-workflow-editor/1-node-common.md) · [`2-edge`](./3-workflow-editor/2-edge.md) · [`3-execution`](./3-workflow-editor/3-execution.md) · [`4-ai-assistant`](./3-workflow-editor/4-ai-assistant.md) |
| 노드 시스템 | [`./4-nodes/_product-overview.md`](./4-nodes/_product-overview.md) | [`./4-nodes/0-overview.md`](./4-nodes/0-overview.md) + 카테고리별 폴더 |
| AI 플랫폼 (LLM/KB/Assistant) | [`./4-nodes/3-ai/_product-overview.md`](./4-nodes/3-ai/_product-overview.md) | [`./4-nodes/3-ai/`](./4-nodes/3-ai/) · [`./5-system/7-llm-client.md`](./5-system/7-llm-client.md) |
| 통합·KB·마켓플레이스 | [`./4-nodes/4-integration/_product-overview.md`](./4-nodes/4-integration/_product-overview.md) | [`./4-nodes/4-integration/`](./4-nodes/4-integration/) · [`./2-navigation/4-integration.md`](./2-navigation/4-integration.md) · [`./2-navigation/5-knowledge-base.md`](./2-navigation/5-knowledge-base.md) · [`./2-navigation/8-marketplace.md`](./2-navigation/8-marketplace.md) |
| 비기능 요구사항 | [`./5-system/_product-overview.md`](./5-system/_product-overview.md) | [`./5-system/`](./5-system/) 의 영역별 문서 |
| 실행 이력 | (Overview 섹션 통합) | [`./2-navigation/14-execution-history.md`](./2-navigation/14-execution-history.md) |
| Webhook | (Overview 섹션 통합) | [`./5-system/12-webhook.md`](./5-system/12-webhook.md) |
| Graph RAG | (Overview 섹션 통합) | [`./5-system/10-graph-rag.md`](./5-system/10-graph-rag.md) |
| 브랜드 가이드 | — | [`./6-brand.md`](./6-brand.md) |
| 노드 Output 규약 | — | [`./conventions/node-output.md`](./conventions/node-output.md) |

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
