# Spec: 시스템 아키텍처 개요

> 관련 문서: [PRD 개요](../prd/0-overview.md) · [데이터 모델](./1-data-model.md)

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
  {workspaceId}/
    forms/          # Form 노드 파일 업로드
      {executionId}/
        {fileId}_{originalName}
    knowledge-base/ # Knowledge Base 원본 문서
      {kbId}/
        {documentId}_{originalName}
    avatars/        # 프로필 이미지
      {userId}.{ext}
```

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

## 4. PRD ↔ Spec 매핑

| PRD 섹션 | Spec 문서 |
|----------|-----------|
| [PRD 0: 제품 개요](../prd/0-overview.md) | [Spec 0: 아키텍처 개요](./0-overview.md) (본 문서) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-WF-* | [Spec 2-navigation/1: 워크플로우 목록](./2-navigation/1-workflow-list.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-TR-* | [Spec 2-navigation/2: 트리거 목록](./2-navigation/2-trigger-list.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-SC-* | [Spec 2-navigation/3: 스케줄](./2-navigation/3-schedule.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-IN-* | [Spec 2-navigation/4: 통합](./2-navigation/4-integration.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-KB-* | [Spec 2-navigation/5: 지식 저장소](./2-navigation/5-knowledge-base.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-CA-* | [Spec 2-navigation/6: 설정(인증)](./2-navigation/6-config.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-CL-* | [Spec 2-navigation/6: 설정(LLM)](./2-navigation/6-config.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-ST-* | [Spec 2-navigation/7: 통계](./2-navigation/7-statistics.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-MP-* | [Spec 2-navigation/8: 마켓플레이스](./2-navigation/8-marketplace.md) |
| [PRD 1: 내비게이션](../prd/1-navigation.md) NAV-UP-* | [Spec 2-navigation/9: 사용자 프로필](./2-navigation/9-user-profile.md) |
| [PRD 2: 에디터](../prd/2-workflow-editor.md) ED-CV-*, ED-ND-* | [Spec 3-workflow-editor/0: 캔버스](./3-workflow-editor/0-canvas.md) |
| [PRD 2: 에디터](../prd/2-workflow-editor.md) ED-EG-* | [Spec 3-workflow-editor/2: 엣지](./3-workflow-editor/2-edge.md) |
| [PRD 2: 에디터](../prd/2-workflow-editor.md) ED-SP-* | [Spec 3-workflow-editor/1: 노드 공통](./3-workflow-editor/1-node-common.md) |
| [PRD 2: 에디터](../prd/2-workflow-editor.md) ED-EX-*, ED-DB-* | [Spec 3-workflow-editor/3: 실행/디버깅](./3-workflow-editor/3-execution.md) |
| [PRD 2: 에디터](../prd/2-workflow-editor.md) ED-AI-* | [Spec 3-workflow-editor/4: AI Assistant](./3-workflow-editor/4-ai-assistant.md) |
| [PRD 6: AI 플랫폼](../prd/6-phase2-ai.md) §3.6 (Workflow AI Assistant) | [Spec 3-workflow-editor/4: AI Assistant](./3-workflow-editor/4-ai-assistant.md) + [Spec 5-system/7 §8: 스트리밍](./5-system/7-llm-client.md#8-스트리밍-streaming) |
| [PRD 3: 노드 시스템](../prd/3-node-system.md) ND-CM-* | [Spec 4-nodes/0: 노드 개요](./4-nodes/0-overview.md) |
| [PRD 3: 노드 시스템](../prd/3-node-system.md) ND-IF~ND-BG | [Spec 4-nodes/1-logic](./4-nodes/1-logic/0-common.md) |
| [PRD 3: 노드 시스템](../prd/3-node-system.md) ND-WF-* | [Spec 4-nodes/2-flow](./4-nodes/2-flow/1-workflow.md) |
| [PRD 3: 노드 시스템](../prd/3-node-system.md) ND-AG~ND-IE | [Spec 4-nodes/3-ai](./4-nodes/3-ai/0-common.md) |
| [PRD 3: 노드 시스템](../prd/3-node-system.md) ND-HR~ND-GD | [Spec 4-nodes/4-integration](./4-nodes/4-integration/0-common.md) |
| [PRD 3: 노드 시스템](../prd/3-node-system.md) ND-TF~ND-CD | [Spec 4-nodes/5-data](./4-nodes/5-data/0-common.md) |
| [PRD 3: 노드 시스템](../prd/3-node-system.md) ND-CL~ND-PD | [Spec 4-nodes/6-presentation](./4-nodes/6-presentation/0-common.md) |
| [PRD 4: 통합/연동](../prd/4-integration.md) INT-*, KB-*, MP-* | Spec 2-navigation 해당 화면 + [Spec 1: 데이터 모델](./1-data-model.md) |
| [PRD 5: 비기능](../prd/5-non-functional.md) NF-SC-* | [Spec 5-system/1: 인증/인가](./5-system/1-auth.md) |
| [PRD 5: 비기능](../prd/5-non-functional.md) NF-* | [Spec 5-system/2: API 규칙](./5-system/2-api-convention.md), [Spec 5-system/3: 에러 처리](./5-system/3-error-handling.md) |
| (아키텍처) 실행 엔진 상세 | [Spec 5-system/4: 실행 엔진](./5-system/4-execution-engine.md) |
| [PRD 2: 에디터](../prd/2-workflow-editor.md) ED-SP-03, ED-SP-04 (표현식) | [Spec 5-system/5: 표현식 언어](./5-system/5-expression-language.md) |
| [PRD 5: 비기능](../prd/5-non-functional.md) (실시간 통신) | [Spec 5-system/6: WebSocket 프로토콜](./5-system/6-websocket-protocol.md) |
| [PRD 5: 비기능](../prd/5-non-functional.md) NF-SC-01 (인증 UI) | [Spec 2-navigation/10: 인증 UI 플로우](./2-navigation/10-auth-flow.md) |
| (공통 UI) 에러 페이지 / 빈 상태 | [Spec 2-navigation/11: 에러/빈 상태 UI](./2-navigation/11-error-empty-states.md) |

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
