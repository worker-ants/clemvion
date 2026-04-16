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

## 6. 현재 구현 상태 및 남은 로드맵

### 6.1 구현 완료 (✅)

| 영역 | 기능 |
|------|-----------|
| **내비게이션** | 대시보드, 워크플로우 목록, 트리거 목록, 스케줄, 통합, Knowledge Base, LLM 설정, 인증 설정, 통계, 사용자 매뉴얼(/docs), 사용자 프로필 |
| **워크플로우 에디터** | 캔버스 기반 노드 편집, 엣지 연결, 실행·디버깅, 버전 히스토리 |
| **노드 시스템** | Trigger(Manual), Logic(If/Else·Switch·Loop·ForEach·Map·Split·Merge·Parallel·Variable Decl/Mod), Flow(Workflow), AI(AI Agent·Text Classifier·Information Extractor), Integration(HTTP·Database·Send Email), Data(Transform·Code), Presentation(Carousel·Chart·Form·Table·Template) |
| **AI 플랫폼** | LLM Config(프로바이더·모델·API Key), Knowledge Base(문서 업로드·임베딩·RAG 검색) |
| **시스템** | 인증/인가(개인 워크스페이스), REST API, 에러 처리, 표현식 엔진(`{{ }}`), 실행 엔진(Redis 큐 + 워커 풀), WebSocket 실시간 상태, Webhook 수신, 실행 이력 |

### 6.2 백엔드만 존재 / 부분 구현 (🚧)

| 영역 | 상태 |
|------|------|
| **Parallel 노드 (P1)** | `PARALLEL_ENGINE=v1` 환경변수로 활성화하면 `ParallelExecutor`가 `p-limit` + `Promise.allSettled`로 분기를 동시 실행한다(off 시 기존 순차 동작). branchCount(2~16), maxConcurrency(0=무제한, 1~16) 지원. 분기 내 블로킹 노드·back-edge·중첩 Parallel은 금지. Merge `wait_all` 조합으로 결과 합산 가능. P2에서 중첩 Parallel과 waitAll=false를 추가할 예정이다. |
| **팀 워크스페이스·RBAC** | 데이터 모델(`Workspace.type = personal \| team`, `WorkspaceMember.role`)과 백엔드 모듈(`backend/src/modules/workspaces`)은 존재하지만, 프런트엔드 UI(전환·멤버 초대)는 아직 활성화되지 않았다. 회원가입 시 개인 워크스페이스가 자동 생성되고 `X-Workspace-Id`는 서버가 자동 매핑한다. |
| **조직 레벨 Integration 공유** | 팀 워크스페이스 UI와 함께 연계될 예정이다. |

### 6.3 로드맵 / 미구현 (❌)

| 영역 | 내용 |
|------|------|
| **Logic 확장 노드** | Parallel P2(중첩 Parallel, waitAll=false). Background 노드는 구현 완료. |
| **마켓플레이스** | 워크플로우 템플릿·AI Agent 프리셋·Integration 플러그인·커스텀 노드 게시 기능. |
| **배포 자동화 확장** | 공식 Docker/Kubernetes 배포 가이드, 셀프 호스팅 번들. |
| **확장 SDK** | 노드 플러그인 SDK, 외부 커스텀 노드 개발/게시. |
| **문서 내 검색** | `/docs`의 검색 UI. 콘텐츠 규모가 커지면 도입한다. |

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
