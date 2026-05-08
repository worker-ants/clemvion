# PRD: AI & 지식 저장소

> 관련 문서: [제품 개요](./0-overview.md) · [워크플로우 에디터 §10](./2-workflow-editor.md#10-ai-assistant-ed-ai-) · [노드 시스템](./3-node-system.md#5-ai-노드) · [통합/연동](./4-integration.md#3-knowledge-base) · [내비게이션](./1-navigation.md#37-config--llm) · [Spec AI 노드](../spec/4-nodes/3-ai/0-common.md) · [Spec Knowledge Base](../spec/2-navigation/5-knowledge-base.md) · [Spec LLM Config](../spec/2-navigation/6-config.md) · [Spec AI Assistant](../spec/3-workflow-editor/4-ai-assistant.md)

> **구현 상태**: 3.1~3.5의 AI 기능은 모두 **구현 완료(✅)**다. 3.6 **Workflow AI Assistant**는 로드맵(❌)이며, 상세 요구사항은 [PRD 2 §10](./2-workflow-editor.md#10-ai-assistant-ed-ai-)에 정의되어 있다. 팀 워크스페이스·RBAC·2FA는 별도 로드맵 항목으로 현재 백엔드 모듈만 존재한다.

---

## 1. 목표

워크플로우 엔진 위에 **AI 기능**을 더해, 사용자가 LLM 기반 지능형 워크플로우를 구축할 수 있도록 한다.

| 구분 | 목표 |
|------|------|
| **사용자 가치** | 프롬프트만으로 텍스트 분류, 정보 추출, 질의응답 등 AI 작업을 워크플로우에 통합 |
| **기술 목표** | 다중 LLM 프로바이더 지원, RAG 파이프라인, Tool Use 기반 에이전트 실행 |
| **제품 차별화** | Knowledge Base + AI Agent + Tool Area의 결합으로 코딩 없는 AI 에이전트 구축 |

---

## 2. 범위

### 2.1 본 문서 범위

| 영역 | 상태 | 기능 |
|------|------|------|
| **LLM 설정** | ✅ | 다중 프로바이더 관리 (OpenAI, Anthropic, Google, Azure, Local) |
| **AI 노드 3종** | ✅ | AI Agent, Text Classifier, Information Extractor |
| **지식 저장소** | ✅ | 컬렉션 관리, 문서 업로드, 벡터 임베딩, RAG 검색 |
| **AI Agent 고급** | ✅ | Tool Area (도구 호출), Knowledge Base 연동 |
| **Workflow AI Assistant (§3.6)** | ❌ 로드맵 | 에디터 내 채팅형 AI로 워크플로우 자동 구성/수정 |

### 2.2 본 문서 범위 밖

팀 워크스페이스, RBAC, 2FA, 추가 Integration 노드. 현재 상태는 [제품 개요 §6.2](./0-overview.md) 참조.

---

## 3. 요구사항

### 3.1 LLM 프로바이더 관리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| LLM-01 | 다중 LLM 프로바이더 등록 (OpenAI, Anthropic, Google AI, Azure OpenAI, Local) | 필수 |
| LLM-02 | 프로바이더별 API Key 입력 및 암호화 저장 | 필수 |
| LLM-03 | 커스텀 엔드포인트 URL 설정 (로컬 모델, Azure 등) | 필수 |
| LLM-04 | 기본 모델 및 파라미터(temperature, max_tokens 등) 설정 | 필수 |
| LLM-05 | 기본 프로바이더 지정 (AI 노드 생성 시 자동 선택) | 필수 |
| LLM-06 | 연결 테스트 (Test Connection) | 필수 |
| LLM-07 | 사용 가능한 모델 목록 조회 (프로바이더 API 연동) | 권장 |

### 3.2 AI Agent 노드

> 상세: [PRD 노드 시스템 §5.1](./3-node-system.md), [Spec AI Agent](../spec/4-nodes/3-ai/1-ai-agent.md)

> ⚠ **재작성 예정 (현재 제거됨)** — `ND-AG-06`, `ND-AG-10`, `ND-AG-21` 의 도구 연결 입력 경로(`toolNodeIds` / `toolOverrides`)는 config 스키마에서 **제거**됐다. 새 도구 연결 디자인이 결정될 때까지 비활성. 조건(`cond_*`) / KB(`kb_*`) / MCP(`mcp_*`) 도구 호출은 정상 동작. 자세한 사유·복원 절차: `plan/complete/ai-agent-tool-connection-rewrite.md`.

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| ND-AG-01 | LLM 기반 AI Agent 실행 | 필수 |
| ND-AG-02 | System Prompt 설정 (마크다운, 표현식 지원) | 필수 |
| ND-AG-03 | LLM 모델 선택 (Config > LLM 연동) | 필수 |
| ND-AG-04 | 모델 파라미터 오버라이드 (temperature, max_tokens) | 필수 |
| ND-AG-05 | Knowledge Base 연결 (RAG) | 필수 |
| ND-AG-06 | Tool/Function Calling 지원 _(제거됨 — 재작성 예정)_ | 필수 |
| ND-AG-07 | 대화 이력 관리 (none / last_n / full) | 권장 |
| ND-AG-08 | 응답 형식 지정 (text / json + JSON Schema) | 필수 |
| ND-AG-09 | 스트리밍 응답 | 권장 |
| ND-AG-10 | Tool Area: 캔버스에서 드래그 앤 드롭으로 도구 등록 _(제거됨 — 재작성 예정)_ | 필수 |
| ND-AG-11 | 실행 모드 선택: Single Turn(단일 호출) / Multi Turn(대화형 블로킹) | 필수 |
| ND-AG-12 | Multi Turn 모드 시 워크플로우 실행 일시 정지 후 사용자와 대화형 인터랙션 | 필수 |
| ND-AG-13 | Multi Turn 종료 조건: 최대 턴 수, 타임아웃(→ error 포트로 통합), 사용자 명시적 종료 | 필수 |
| ND-AG-14 | Multi Turn 대화 중 Tool Use 및 RAG 검색 지속 지원 | 필수 |
| ND-AG-15 | Condition(조건) 설정: 라벨(label)과 프롬프트(prompt) 쌍으로 구성된 조건 목록을 정의할 수 있다 | 필수 |
| ND-AG-16 | 조건별 동적 출력 포트 생성 — 각 조건마다 독립적인 출력 포트를 자동 생성하여 후속 워크플로우 분기를 지원한다 | 필수 |
| ND-AG-17 | 조건을 LLM 도구(tool)로 자동 등록 — 각 조건의 프롬프트를 도구 설명으로 사용하여 LLM이 상황 판단 시 해당 도구를 호출하도록 유도한다. 도구 이름은 `cond_` 접두사 + 정제된 UUID로 자동 지정하고, 일반 도구는 `tool_` 접두사를 사용하여 충돌 및 LLM 오작동을 방지한다 | 필수 |
| ND-AG-18 | 조건 도구 호출 시 종료 및 라우팅 — LLM이 조건 도구만 호출하면 AI Agent를 completed 상태로 전환하고 해당 조건의 출력 포트로 라우팅한다. 일반 도구와 함께 호출된 경우에는 일반 도구를 먼저 실행하고 LLM 재평가 후 최종 결정한다 | 필수 |
| ND-AG-19 | 종료 사유별 기본 출력 포트 — 사용자 종료, LLM 오류는 각각 전용 기본 포트로 출력하며, Multi Turn 모드에서는 `max_turns` 포트도 추가로 제공한다. timeout 및 rate limit는 `error` 포트로 통합 | 필수 |
| ND-AG-20 | 조건 동적 추가/제거 — 사용자가 설정 패널에서 조건을 자유롭게 추가/삭제하며, 포트 ID는 생성 시 UUID v4로 할당되어 불변 유지된다 | 필수 |
| ND-AG-21 | 조건과 일반 도구 동시 호출 시 일반 도구 우선 실행 — LLM이 하나의 응답에서 조건 도구와 일반 도구를 함께 호출한 경우, 일반 도구를 먼저 실행하고 결과를 LLM에 전달하여 재평가한다 (조건은 재평가 후 최종 결정) _(제거됨 — 일반 도구 입력 경로 부재로 시나리오 미발생)_ | 필수 |
| ND-AG-22 | 복수 조건 동시 호출 시 첫 번째 우선 — LLM이 여러 조건 도구를 동시에 호출한 경우, 조건 목록에서 먼저 정의된 조건을 선택한다 | 필수 |
| ND-AG-23 | Single Turn 모드의 포트 구조 — 조건 포트 + 기본 `out` 포트 + `error` 포트. 조건 0개 시 `out` + `error` | 필수 |
| ND-AG-24 | Multi Turn 모드의 포트 구조 — 조건 포트 + `user_ended` + `max_turns` + `error` (`out` 없음). 조건 0개 시 `out` + `error` 제공 (하위 호환). 상세: [Spec AI Agent 포트](../spec/4-nodes/3-ai/1-ai-agent.md#3-포트) | 필수 |

### 3.3 Text Classifier 노드

> 상세: [PRD 노드 시스템 §5.2](./3-node-system.md), [Spec Text Classifier](../spec/4-nodes/3-ai/2-text-classifier.md)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| ND-TC-01 | LLM 기반 텍스트 분류 | 필수 |
| ND-TC-02 | 카테고리 목록 정의 | 필수 |
| ND-TC-03 | 카테고리별 설명 및 예시 입력 | 필수 |
| ND-TC-04 | 카테고리별 출력 포트 분기 | 필수 |
| ND-TC-05 | 신뢰도(confidence) 점수 출력 | 권장 |
| ND-TC-06 | LLM 모델 선택 | 필수 |

### 3.4 Information Extractor 노드

> 상세: [PRD 노드 시스템 §5.3](./3-node-system.md), [Spec Information Extractor](../spec/4-nodes/3-ai/3-information-extractor.md)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| ND-IE-01 | LLM 기반 정보 추출 | 필수 |
| ND-IE-02 | 추출 필드 정의 (이름, 타입, 설명) | 필수 |
| ND-IE-03 | 출력 스키마 (JSON Schema) 정의 | 필수 |
| ND-IE-04 | 스키마 형식 출력 | 필수 |
| ND-IE-05 | LLM 모델 선택 | 필수 |
| ND-IE-06 | Few-shot 예시 입력 | 권장 |

### 3.5 Knowledge Base

> 상세: [PRD 통합/연동 §3](./4-integration.md), [Spec Knowledge Base](../spec/2-navigation/5-knowledge-base.md). Graph RAG 검색 모드는 [PRD 9 Graph RAG](./9-graph-rag.md) 에 별도 정의.

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| KB-DC-01 | Knowledge Base 컬렉션 생성/관리 | 필수 |
| KB-DC-02 | 문서 업로드 (txt, md, pdf, csv) | 필수 |
| KB-DC-03 | 문서 검색 및 미리보기 | 필수 |
| KB-MD-01 | 검색 모드 (`vector` / `graph`) 선택 — 생성 시에만 결정 (불변). graph 상세: [PRD 9](./9-graph-rag.md) | 필수 |
| KB-VE-01 | 문서 업로드 시 자동 벡터 임베딩 생성 | 필수 |
| KB-VE-02 | 임베딩 모델 선택 (LLM Config 연동) | 필수 |
| KB-VE-03 | 문서 수정 시 자동 재임베딩 | 필수 |
| KB-VE-04 | 임베딩 상태 표시 (pending/processing/completed/error) | 필수 |
| KB-VE-05 | 청크 분할 전략 설정 (크기, 오버랩) | 권장 |
| KB-AG-01 | AI Agent 노드에서 Knowledge Base 컬렉션 선택 | 필수 |
| KB-AG-02 | 유사도 임계값 설정 | 권장 |
| KB-AG-03 | Top-K 검색 결과 수 설정 | 권장 |

### 3.6 Workflow AI Assistant

> **구현 상태**: ❌ 로드맵 · 상세 요구사항: [PRD 2 §10](./2-workflow-editor.md#10-ai-assistant-ed-ai-) (`ED-AI-*`) · 상세 스펙: [Spec 3-workflow-editor/4](../spec/3-workflow-editor/4-ai-assistant.md)

워크플로우 에디터에 내장된 채팅형 AI 에이전트로, 사용자의 자연어 요청을 받아 노드·엣지를 자동 구성·수정한다. 단순 지시뿐 아니라 "주문 취소 프로세스 추가" 같은 모호한 요구를 **Clarify → Plan → Execute** 대화 루프로 구체화한다. 실행(`Run`) 은 사용자가 수행하되, Assistant 는 실행 결과(노드별 입출력·에러·타임라인) 를 읽기 전용 탐색 도구로 조회해 실패 원인을 진단하고 해당 노드 수정을 제안한다 ([PRD 2 §10.9](./2-workflow-editor.md#109-실행-결과-조회-진단수정)).

| 목표 | 설명 |
|------|------|
| 사용자 가치 | 비개발자도 자연어 한 줄로 초기 워크플로우 초안을 얻고, 실행 후 실패·오동작을 대화로 진단·수정 |
| 제품 차별화 | Planner-first UX (질문·계획 제안 후 실행)로 LLM의 섣부른 편집 방지 |
| 기존 자산 재사용 | LLM Config (§3.1), [LLM Client 스트리밍](../spec/5-system/7-llm-client.md#8-스트리밍-streaming), editor-store Undo 스택, [실행 내역 REST API](./7-execution-history.md) |

상세 요구사항은 [PRD 2 §10.1~§10.9](./2-workflow-editor.md#10-ai-assistant-ed-ai-) 참조.

---

## 4. 기술 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 벡터 DB | **pgvector** (PostgreSQL 확장) | 기존 PostgreSQL 인프라 활용, 별도 서비스 불필요 |
| 임베딩 처리 | **In-process 비동기** | 초기 단순화. 추후 BullMQ 전환 가능 |
| 파일 저장소 | **S3-compatible** (AWS S3 / MinIO) | 기존 MinIO 인프라 활용 |
| PDF 파싱 | **pdf-parse** | 가벼운 라이브러리, 텍스트 추출 충분 |
| API 키 암호화 | **AES-256-GCM** | 기존 encrypt/decrypt 유틸리티 재사용 |

---

## 5. 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|----------|------|
| NF-AI-01 | LLM API 호출 타임아웃 | 120초 (스트리밍 제외) |
| NF-AI-02 | 임베딩 처리 속도 | 100 청크/분 이상 |
| NF-AI-03 | RAG 검색 응답 시간 | < 500ms (1만 청크 기준) |
| NF-AI-04 | API 키 저장 시 암호화 필수 | AES-256-GCM |
| NF-AI-05 | 문서 업로드 크기 제한 | 50MB/파일 |
| NF-AI-06 | 동시 임베딩 처리 | 최소 3건 병렬 |
