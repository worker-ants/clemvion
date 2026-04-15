# PRD: 제품 개요

> 관련 문서: [내비게이션](./1-navigation.md) · [워크플로우 에디터](./2-workflow-editor.md) · [노드 시스템](./3-node-system.md) · [통합/연동](./4-integration.md) · [비기능 요구사항](./5-non-functional.md) · [Spec 개요](../spec/0-overview.md) · [Spec Integration 노드](../spec/4-nodes/4-integration-nodes.md) · [Spec Data 노드](../spec/4-nodes/5-data-nodes.md) · [Spec Presentation 노드](../spec/4-nodes/6-presentation-nodes.md)

---

## 1. 제품 비전

**"누구나 자신만의 자동화 워크플로우를 만들고, AI와 함께 업무를 혁신한다."**

코딩 없이 시각적 캔버스에서 노드를 연결하여 복잡한 비즈니스 자동화를 구현하는 No-code Workflow Builder. 개발자에게는 고급 설정과 코드 편집 옵션을, 비개발자에게는 직관적인 드래그 앤 드롭 인터페이스를 제공한다.

---

## 2. 목표

| 구분 | 목표 |
|------|------|
| **사용자 가치** | 반복 업무를 자동화하여 생산성 향상. AI Agent를 활용한 지능형 워크플로우 구축 |
| **비즈니스 가치** | SaaS와 셀프 호스팅 양립으로 다양한 고객층 확보. 마켓플레이스를 통한 생태계 구축 |
| **기술 목표** | 확장 가능한 노드 시스템, 안정적 워크플로우 실행 엔진, 실시간 디버깅 지원 |

---

## 3. 타겟 사용자

### 3.1 비개발자
- 마케팅, 운영, CS 등 비즈니스 부서 담당자
- 반복 업무 자동화 필요성을 느끼는 사용자
- 직관적 UI를 통해 워크플로우를 구성

### 3.2 개발자
- 빠른 프로토타이핑 및 자동화 파이프라인 구축
- 코드 편집, 커스텀 노드 개발, API 직접 호출 등 고급 기능 활용
- 셀프 호스팅 환경 운영

### 3.3 팀/조직
- 워크플로우 공유 및 협업
- 역할/권한 기반 접근 관리
- 조직 단위 통합(Integration) 설정 공유

---

## 4. 사용 단위

- **개인**: 개인 워크스페이스에서 독립적으로 워크플로우 생성/관리
- **팀/조직**: 팀 워크스페이스를 통해 워크플로우 공유, 역할/권한 관리, 공통 Integration 설정 관리

---

## 5. 배포 방식

| 방식 | 설명 |
|------|------|
| **SaaS** | 클라우드 호스팅, 멀티 테넌트 환경, 구독 기반 과금 |
| **셀프 호스팅** | 온프레미스 또는 프라이빗 클라우드 배포, 단일/멀티 테넌트 선택 가능 |

두 배포 방식 모두 동일한 기능을 제공하며, 환경 독립적 설계를 통해 설정만으로 배포 방식을 전환할 수 있어야 한다.

---

## 6. 제품 범위 및 로드맵

제품은 3개 Phase로 나누어 점진적으로 출시한다.

### 6.1 Phase 1 — 핵심 자동화

**Phase 1 범위 원칙:**
- **워크스페이스**: Phase 1은 **개인 워크스페이스(personal)만** 지원한다. 팀 워크스페이스(team), RBAC 기반 멤버 관리, 조직 레벨 Integration 공유는 모두 **Phase 2** 범위이다.
- 데이터 모델에 `Workspace.type = personal | team`, `WorkspaceMember.role` 등 팀 관련 스키마가 포함되어 있으나, 이는 Phase 2 확장을 위한 사전 설계이며 **Phase 1에서는 개인 워크스페이스 고정**으로 동작한다.
- Phase 1에서 회원가입 시 개인 워크스페이스가 자동 생성되며, 워크스페이스 전환/생성 UI는 Phase 2에서 활성화한다.
- API의 `X-Workspace-Id` 헤더는 Phase 1에서도 사용하되, 사용자당 1개 워크스페이스만 존재하므로 서버가 자동 매핑한다.
- Phase 1에서 제공하지 않는 기능(Knowledge Base, Marketplace, Config > LLM)은 사이드바에서 숨긴다. Phase 2/3에서 해당 기능 구현 시 메뉴를 복원한다.

| 영역 | 핵심 기능 |
|------|-----------|
| **내비게이션** | 대시보드, 워크플로우 목록, 트리거 목록, 스케줄, 통합, 인증 설정, 통계, 사용자 프로필 |
| **워크플로우 에디터** | 캔버스 기반 노드 편집, 엣지 연결, 실행/디버깅 |
| **노드 시스템** | Logic 9종, Flow 1종, Integration 3종, Data 2종, Presentation 5종 (총 20종) |
| **통합/연동** | HTTP Request, Database, Send Email 연동 |
| **시스템** | 인증/인가(개인 워크스페이스), API, 에러 처리, 표현식 엔진, 실행 엔진 |

### 6.2 Phase 2 — AI & 협업

| 영역 | 핵심 기능 |
|------|-----------|
| **노드 시스템** | AI 노드 3종 (AI Agent, Text Classifier, Information Extractor), Logic 2종 (Parallel, Background) |
| **내비게이션** | 지식 저장소(Knowledge Base), 팀 관리 |
| **시스템** | RBAC, 2FA, 팀 워크스페이스 |

### 6.3 Phase 3 — 생태계

| 영역 | 핵심 기능 |
|------|-----------|
| **마켓플레이스** | 워크플로우 템플릿, AI Agent 프리셋, Integration 플러그인, 커스텀 노드 |
| **배포** | 셀프 호스팅 (Docker, Kubernetes) |
| **확장** | 노드 플러그인 SDK, 커스텀 노드 개발/게시 |

---

## 7. 용어 정의

| 용어 | 정의 |
|------|------|
| **Workflow** | 노드와 엣지로 구성된 자동화 프로세스의 단위. 특정 트리거에 의해 실행되거나 수동으로 실행 가능 |
| **Node** | 워크플로우 내에서 하나의 작업 단위를 나타내는 구성 요소. 입력을 받아 처리하고 출력을 생성 |
| **Edge** | 두 노드 간의 연결. 데이터 흐름의 방향과 경로를 정의 |
| **Port** | 노드의 입출력 연결 지점. 입력 포트(Input Port)와 출력 포트(Output Port)로 구분 |
| **Trigger** | 워크플로우의 실행을 시작하는 이벤트. Webhook, 스케줄(Cron), 수동 실행 등의 유형 존재 |
| **Canvas** | 워크플로우를 시각적으로 편집하는 작업 공간 |
| **Integration** | 외부 서비스(Google, GitHub 등)와의 연동 설정 |
| **Knowledge Base** | AI Agent의 RAG(Retrieval-Augmented Generation)를 위한 지식 저장소 |
| **Execution** | 워크플로우의 한 번의 실행 인스턴스. 실행 상태, 각 노드별 입출력 데이터, 로그를 포함 |
| **Workspace** | 사용자 또는 팀이 워크플로우, Integration, 설정 등을 관리하는 독립된 공간 |
| **Marketplace** | Agent 설정, 워크플로우 템플릿, Integration 플러그인을 공유/설치하는 공간 |
| **Schedule** | 워크플로우를 주기적으로 실행하기 위한 Cron Job 규칙 |
| **LLM** | Large Language Model. AI Agent 노드에서 사용하는 언어 모델 |
| **RAG** | Retrieval-Augmented Generation. Knowledge Base에서 관련 정보를 검색하여 AI 응답 품질을 향상시키는 기법 |

---

## 8. 문서 맵

```
prd/
├── 0-overview.md          ← 현재 문서
├── 1-navigation.md        — 내비게이션 구조 및 영역별 요구사항
├── 2-workflow-editor.md   — 워크플로우 에디터 핵심 요구사항
├── 3-node-system.md       — 노드 시스템 요구사항 (Logic/Flow/AI/Integration/Data/Presentation)
├── 4-integration.md       — 통합/연동, 마켓플레이스, Knowledge Base 요구사항
└── 5-non-functional.md    — 비기능 요구사항 (성능, 보안, 확장성)

spec/
├── 0-overview.md          — 시스템 아키텍처 개요, PRD↔Spec 매핑
├── 1-data-model.md        — 핵심 엔티티 정의
├── 2-navigation/          — 내비게이션 화면별 상세 스펙
│   └── 10-auth-flow.md    — 인증 UI 플로우 (로그인/가입/비밀번호 재설정)
├── 3-workflow-editor/     — 에디터 상세 스펙
├── 4-nodes/               — 노드별 상세 스펙
│   ├── 0-overview.md      — 노드 아키텍처/목록 개요
│   ├── 1-logic-nodes.md   — Logic 노드 상세
│   ├── 2-flow-nodes.md    — Flow 노드 상세
│   ├── 3-ai-nodes.md      — AI 노드 상세
│   ├── 4-integration-nodes.md — Integration 노드 상세
│   ├── 5-data-nodes.md    — Data 노드 상세
│   └── 6-presentation-nodes.md — Presentation 노드 상세
└── 5-system/              — 시스템 공통 스펙
    ├── 5-expression-language.md — 표현식 언어 문법/함수/타입
    └── 6-websocket-protocol.md  — WebSocket 채널/인증/재연결
```
