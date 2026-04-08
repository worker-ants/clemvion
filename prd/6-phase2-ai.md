# PRD: Phase 2 — AI & 지식 저장소

> 관련 문서: [제품 개요](./0-overview.md#62-phase-2--ai--협업) · [노드 시스템](./3-node-system.md#5-ai-노드) · [통합/연동](./4-integration.md#3-knowledge-base) · [내비게이션](./1-navigation.md#37-config--llm) · [Spec AI 노드](../spec/4-nodes/3-ai-nodes.md) · [Spec Knowledge Base](../spec/2-navigation/5-knowledge-base.md) · [Spec LLM Config](../spec/2-navigation/6-config.md)

---

## 1. Phase 2 목표

Phase 1에서 구축한 워크플로우 엔진 위에 **AI 기능**을 추가하여, 사용자가 LLM 기반 지능형 워크플로우를 구축할 수 있도록 한다.

| 구분 | 목표 |
|------|------|
| **사용자 가치** | 프롬프트만으로 텍스트 분류, 정보 추출, 질의응답 등 AI 작업을 워크플로우에 통합 |
| **기술 목표** | 다중 LLM 프로바이더 지원, RAG 파이프라인, Tool Use 기반 에이전트 실행 |
| **제품 차별화** | Knowledge Base + AI Agent + Tool Area의 결합으로 코딩 없는 AI 에이전트 구축 |

---

## 2. 범위

### 2.1 Phase 2-A: AI 핵심 (본 문서의 범위)

| 영역 | 기능 |
|------|------|
| **LLM 설정** | 다중 프로바이더 관리 (OpenAI, Anthropic, Google, Azure, Local) |
| **AI 노드 3종** | AI Agent, Text Classifier, Information Extractor |
| **지식 저장소** | 컬렉션 관리, 문서 업로드, 벡터 임베딩, RAG 검색 |
| **AI Agent 고급** | Tool Area (도구 호출), Knowledge Base 연동 |

### 2.2 Phase 2-B: 협업 (별도 PRD)

팀 워크스페이스, RBAC, 2FA, 추가 Integration 노드 — 본 문서 범위 밖.

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

> 상세: [PRD 노드 시스템 §5.1](./3-node-system.md), [Spec AI 노드 §1](../spec/4-nodes/3-ai-nodes.md)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| ND-AG-01 | LLM 기반 AI Agent 실행 | 필수 |
| ND-AG-02 | System Prompt 설정 (마크다운, 표현식 지원) | 필수 |
| ND-AG-03 | LLM 모델 선택 (Config > LLM 연동) | 필수 |
| ND-AG-04 | 모델 파라미터 오버라이드 (temperature, max_tokens) | 필수 |
| ND-AG-05 | Knowledge Base 연결 (RAG) | 필수 |
| ND-AG-06 | Tool/Function Calling 지원 | 필수 |
| ND-AG-07 | 대화 이력 관리 (none / last_n / full) | 권장 |
| ND-AG-08 | 응답 형식 지정 (text / json + JSON Schema) | 필수 |
| ND-AG-09 | 스트리밍 응답 | 권장 |
| ND-AG-10 | Tool Area: 캔버스에서 드래그 앤 드롭으로 도구 등록 | 필수 |
| ND-AG-11 | 실행 모드 선택: Single Turn(단일 호출) / Multi Turn(대화형 블로킹) | 필수 |
| ND-AG-12 | Multi Turn 모드 시 워크플로우 실행 일시 정지 후 사용자와 대화형 인터랙션 | 필수 |
| ND-AG-13 | Multi Turn 종료 조건: 최대 턴 수, 타임아웃, 사용자 명시적 종료 | 필수 |
| ND-AG-14 | Multi Turn 대화 중 Tool Use 및 RAG 검색 지속 지원 | 필수 |

### 3.3 Text Classifier 노드

> 상세: [PRD 노드 시스템 §5.2](./3-node-system.md), [Spec AI 노드 §2](../spec/4-nodes/3-ai-nodes.md)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| ND-TC-01 | LLM 기반 텍스트 분류 | 필수 |
| ND-TC-02 | 카테고리 목록 정의 | 필수 |
| ND-TC-03 | 카테고리별 설명 및 예시 입력 | 필수 |
| ND-TC-04 | 카테고리별 출력 포트 분기 | 필수 |
| ND-TC-05 | 신뢰도(confidence) 점수 출력 | 권장 |
| ND-TC-06 | LLM 모델 선택 | 필수 |

### 3.4 Information Extractor 노드

> 상세: [PRD 노드 시스템 §5.3](./3-node-system.md), [Spec AI 노드 §3](../spec/4-nodes/3-ai-nodes.md)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| ND-IE-01 | LLM 기반 정보 추출 | 필수 |
| ND-IE-02 | 추출 필드 정의 (이름, 타입, 설명) | 필수 |
| ND-IE-03 | 출력 스키마 (JSON Schema) 정의 | 필수 |
| ND-IE-04 | 스키마 형식 출력 | 필수 |
| ND-IE-05 | LLM 모델 선택 | 필수 |
| ND-IE-06 | Few-shot 예시 입력 | 권장 |

### 3.5 Knowledge Base

> 상세: [PRD 통합/연동 §3](./4-integration.md), [Spec Knowledge Base](../spec/2-navigation/5-knowledge-base.md)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| KB-DC-01 | Knowledge Base 컬렉션 생성/관리 | 필수 |
| KB-DC-02 | 문서 업로드 (txt, md, pdf, csv) | 필수 |
| KB-DC-03 | 문서 검색 및 미리보기 | 필수 |
| KB-VE-01 | 문서 업로드 시 자동 벡터 임베딩 생성 | 필수 |
| KB-VE-02 | 임베딩 모델 선택 (LLM Config 연동) | 필수 |
| KB-VE-03 | 문서 수정 시 자동 재임베딩 | 필수 |
| KB-VE-04 | 임베딩 상태 표시 (pending/processing/completed/error) | 필수 |
| KB-VE-05 | 청크 분할 전략 설정 (크기, 오버랩) | 권장 |
| KB-AG-01 | AI Agent 노드에서 Knowledge Base 컬렉션 선택 | 필수 |
| KB-AG-02 | 유사도 임계값 설정 | 권장 |
| KB-AG-03 | Top-K 검색 결과 수 설정 | 권장 |

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
