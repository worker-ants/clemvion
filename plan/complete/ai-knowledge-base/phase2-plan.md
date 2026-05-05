# Phase 2-A: AI & 지식 저장소 — 구현 계획

> 관련 문서: [PRD Phase 2](../prd/6-phase2-ai.md) · [Spec AI 노드](../spec/4-nodes/3-ai-nodes.md) · [Spec Knowledge Base](../spec/2-navigation/5-knowledge-base.md) · [Spec LLM 클라이언트](../spec/5-system/7-llm-client.md) · [Spec 임베딩 파이프라인](../spec/5-system/8-embedding-pipeline.md) · [Spec RAG 검색](../spec/5-system/9-rag-search.md)

---

## 구현 순서 (의존관계 기반)

```
Stage 1: LLM Config ─────────────────────── 기반 인프라
Stage 2: AI Agent 노드 (기본) ────────────── LLM 호출
Stage 3: Text Classifier / Info Extractor ── AI 노드 확장
Stage 4: Knowledge Base 인프라 ──────────── 문서 관리
Stage 5: 벡터 임베딩 파이프라인 ─────────── 임베딩 생성
Stage 6: RAG 검색 & AI Agent 연동 ────────── KB → AI Agent
Stage 7: Tool Area (도구 호출) ──────────── 고급 기능
```

---

## Stage 1: LLM Config (프로바이더 관리)

### 목표
AI 노드의 기반. LLM 프로바이더의 API 키, 기본 모델, 파라미터를 관리한다.

### Backend

**새 모듈**: `backend/src/modules/llm-configs/`

| 파일 | 역할 |
|------|------|
| `llm-configs.module.ts` | 모듈 정의 |
| `llm-configs.controller.ts` | REST API 8개 엔드포인트 |
| `llm-configs.service.ts` | CRUD, 기본 설정 관리, 연결 테스트 |
| `entities/llm-config.entity.ts` | LLMConfig 엔티티 (spec §2.16) |
| `dto/create-llm-config.dto.ts` | 생성 DTO |
| `dto/update-llm-config.dto.ts` | 수정 DTO |

**LLM 클라이언트 추상화**: `backend/src/modules/llm-configs/llm-client/`

| 파일 | 역할 |
|------|------|
| `llm-client.interface.ts` | LLMClient, ChatParams, EmbedParams 등 인터페이스 |
| `llm-client.factory.ts` | provider별 클라이언트 생성 팩토리 |
| `openai.client.ts` | OpenAI API 구현 |
| `anthropic.client.ts` | Anthropic Messages API 구현 |
| `local.client.ts` | Ollama/vLLM (OpenAI-compatible) 구현 |

**API 엔드포인트**:
- `GET /api/llm-configs` — 목록
- `POST /api/llm-configs` — 생성
- `GET /api/llm-configs/:id` — 상세
- `PATCH /api/llm-configs/:id` — 수정
- `DELETE /api/llm-configs/:id` — 삭제
- `POST /api/llm-configs/:id/test` — 연결 테스트
- `PATCH /api/llm-configs/:id/set-default` — 기본 설정
- `GET /api/llm-configs/:id/models` — 모델 목록

**DB 마이그레이션**: `llm_config` 테이블 생성

### Frontend

**새 페이지**: `frontend/src/app/(workspace)/llm-configs/page.tsx`

- 프로바이더 리스트 (이름, 기본 모델, 상태, ⭐ 기본 설정)
- 추가/수정 다이얼로그
- Test Connection 버튼
- 사이드바 메뉴 복원 (Config > LLM)

### 검증
- [ ] LLM 프로바이더 CRUD API 동작
- [ ] API 키 암호화 저장 확인
- [ ] Test Connection 성공/실패 시나리오
- [ ] 기본 프로바이더 설정 (하나만 기본)
- [ ] 프론트엔드 UI 동작

---

## Stage 2: AI Agent 노드 (기본)

### 목표
LLM 호출 기능만 구현. RAG와 Tool Area는 후속 Stage.

### Backend

**새 핸들러**: `backend/src/modules/execution-engine/handlers/ai/`

| 파일 | 역할 |
|------|------|
| `ai-agent.handler.ts` | AI Agent NodeHandler 구현 |
| `ai.service.ts` | LLMConfig 조회 + LLMClient 호출 위임 |

**핸들러 등록**: `execution-engine.service.ts`의 `registerHandlers()`에 `['ai_agent', handler]` 추가

**설정 (config)**:
- `llmConfigId`: UUID — 사용할 LLM 프로바이더
- `model`: String — 모델 ID
- `systemPrompt`: String — 시스템 프롬프트 (표현식 지원)
- `userPrompt`: Expression — 사용자 프롬프트
- `temperature`: Float? — 오버라이드
- `maxTokens`: Integer? — 오버라이드
- `responseFormat`: `text` | `json`
- `jsonSchema`: JSONSchema? — json 형식 시 스키마

**출력 구조**:
```json
{
  "response": "AI 응답 텍스트 또는 JSON",
  "metadata": { "model": "gpt-4o", "inputTokens": 1250, "outputTokens": 350, "totalTokens": 1600 }
}
```

### Frontend

**설정 패널**: `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx`

- `AiAgentConfig`: LLM Provider, Model, System/User Prompt, Parameters, Response Format

**노드 등록**: `frontend/src/lib/node-definitions.ts`에 `ai_agent` 추가 (category: 'ai', color: #10B981)

### 검증
- [ ] AI Agent 노드 캔버스에 추가 가능
- [ ] LLM Provider/Model 선택 UI 동작
- [ ] 워크플로우 실행 시 LLM 호출 성공
- [ ] 응답 텍스트/JSON 형식 출력

---

## Stage 3: Text Classifier & Information Extractor

### 목표
Text Classifier: 텍스트를 카테고리로 분류 (포트 기반 분기)
Information Extractor: 비정형 텍스트에서 구조화 정보 추출

### Backend

**Text Classifier**: `handlers/ai/text-classifier.handler.ts`
- 카테고리 목록 + 설명/예시를 포함한 분류 프롬프트 자동 구성
- LLM 응답에서 카테고리 파싱
- **포트 기반 출력**: `{ port: categoryName, data: { category, confidence?, originalInput } }`
- 기존 `applyPortSelection` 패턴 활용

**Information Extractor**: `handlers/ai/info-extractor.handler.ts`
- outputSchema → JSON Schema 변환
- responseFormat: json 강제
- 스키마 검증 실패 시 최대 2회 재시도
- 출력: `{ extracted: { ... }, metadata: { model, tokens } }`

**핸들러 등록**: `['text_classifier', handler]`, `['info_extractor', handler]`

### Frontend

**설정 패널**: `ai-configs.tsx`에 추가
- `TextClassifierConfig`: LLM, Input, Categories 동적 리스트, Confidence 체크박스
- `InfoExtractorConfig`: LLM, Input, Output Schema 동적 필드, Examples

**노드 등록**: `text_classifier`, `info_extractor` 추가

### 검증
- [ ] Text Classifier 카테고리별 포트 분기 동작
- [ ] Information Extractor JSON 추출 동작
- [ ] 스키마 검증 실패 시 재시도 동작

---

## Stage 4: Knowledge Base 인프라

### 목표
컬렉션 관리, 문서 업로드, 파일 저장. (임베딩은 Stage 5)

### Backend

**새 모듈**: `backend/src/modules/knowledge-base/`

| 파일 | 역할 |
|------|------|
| `knowledge-base.module.ts` | 모듈 정의 |
| `knowledge-base.controller.ts` | 컬렉션 + 문서 REST API |
| `knowledge-base.service.ts` | 컬렉션 CRUD |
| `document.service.ts` | 문서 업로드, 삭제, 조회 |
| `entities/knowledge-base.entity.ts` | KnowledgeBase 엔티티 (spec §2.11) |
| `entities/document.entity.ts` | Document 엔티티 (spec §2.12) |
| `entities/document-chunk.entity.ts` | DocumentChunk 엔티티 (pgvector) |
| `chunking/chunker.interface.ts` | Chunker 인터페이스 |
| `chunking/text-chunker.ts` | txt/md 청킹 |
| `chunking/pdf-chunker.ts` | PDF 파싱 + 청킹 |
| `chunking/csv-chunker.ts` | CSV 행 기반 청킹 |
| `storage/file-storage.service.ts` | S3 파일 저장/조회/삭제 |

**API 엔드포인트**: spec `2-navigation/5-knowledge-base.md` §3 전체

**DB 마이그레이션**:
- `knowledge_base` 테이블
- `document` 테이블
- `document_chunk` 테이블 (pgvector 확장 포함)
- `CREATE EXTENSION IF NOT EXISTS vector;`

### Frontend

**새 페이지**:
- `frontend/src/app/(workspace)/knowledge-base/page.tsx` — 컬렉션 목록
- `frontend/src/app/(workspace)/knowledge-base/[id]/page.tsx` — 컬렉션 상세 (문서 관리)

**기능**:
- 컬렉션 CRUD
- 문서 업로드 (드래그 앤 드롭, 다중 파일)
- 문서 목록 (이름, 타입, 크기, 상태)
- 사이드바 메뉴 복원 (Knowledge Base)

### 검증
- [ ] 컬렉션 생성/수정/삭제
- [ ] 문서 업로드 → S3 저장 확인
- [ ] 문서 목록/삭제 동작
- [ ] pgvector 확장 설치 및 DocumentChunk 테이블 생성

---

## Stage 5: 벡터 임베딩 파이프라인

### 목표
문서 업로드 시 자동으로 청킹 → 임베딩 → 저장하는 비동기 파이프라인.

### Backend

**임베딩 서비스**: `backend/src/modules/knowledge-base/embedding/`

| 파일 | 역할 |
|------|------|
| `embedding.service.ts` | 파이프라인 오케스트레이터 |

**구현 사항**:
- Document 업로드 시 비동기 호출 (`this.embeddingService.processDocument(docId)`)
- In-process 비동기 처리 (큐 없음)
- 동시 처리 제한: 3건 (`p-limit`)
- 배치 임베딩: 20 청크 단위
- WebSocket 상태 알림: started/progress/completed/error
- 재임베딩: 기존 청크 삭제 후 재생성

### Frontend

- 문서 목록의 임베딩 상태 실시간 반영 (WebSocket 구독)
- 재임베딩 버튼 (문서 더보기 메뉴)
- 진행률 표시

### 검증
- [ ] 문서 업로드 → 자동 임베딩 시작
- [ ] 임베딩 상태 변화 확인 (pending → processing → completed)
- [ ] DocumentChunk에 벡터 저장 확인
- [ ] 실패 시 error 상태 전환
- [ ] 재임베딩 동작

---

## Stage 6: RAG 검색 & AI Agent 연동

### 목표
AI Agent에서 Knowledge Base를 연결하여 RAG 기반 응답 생성.

### Backend

**RAG 서비스**: `backend/src/modules/knowledge-base/rag/`

| 파일 | 역할 |
|------|------|
| `rag-search.service.ts` | 유사도 검색 (pgvector cosine) |

**AI Agent 핸들러 확장**:
- `config.knowledgeBases` (UUID[]) 처리
- userPrompt 임베딩 → KB 검색 → 컨텍스트 주입 → LLM 호출
- `metadata.ragSources` 출력

### Frontend

**AI Agent 설정 패널 확장**:
- Knowledge Base 섹션 추가
- KB 선택 드롭다운 (다중 선택, 기존 KB 목록 API 활용)
- Top-K / Threshold 파라미터

### 검증
- [ ] AI Agent에 KB 연결 → RAG 동작 확인
- [ ] 검색 결과가 LLM 컨텍스트에 주입됨
- [ ] metadata.ragSources에 출처 포함
- [ ] KB에 문서 없을 때 graceful degradation

---

## Stage 7: Tool Area (AI Agent 도구 호출)

### 목표
AI Agent가 워크플로우 내 다른 노드를 도구로 호출.

### Backend

**AI Agent 핸들러 확장**:
- `config.toolNodeIds` (UUID[]) 처리
- 도구 정의 생성: toolNodeIds의 노드 label/description → LLM ToolDef 변환
- Tool call 루프:
  1. LLM 호출 (tools 포함)
  2. LLM이 tool_calls 응답 → 해당 노드 독립 실행 (execution-engine 활용)
  3. 실행 결과 → tool result 메시지로 LLM에 전달
  4. maxToolCalls 초과 전까지 반복

**캔버스 Tool Area**: AI Agent 노드에 드롭 영역 추가

### Frontend

**캔버스 확장**:
- AI Agent 노드의 Tool Area 영역 렌더링
- 노드 드래그 → Tool Area 드롭 핸들러
- `toolOverrides`: 도구별 이름/설명 커스터마이징 UI

**설정 패널 확장**:
- 등록된 도구 목록 표시
- 도구별 이름/설명 오버라이드 입력

### 검증
- [ ] 캔버스에서 노드를 Tool Area로 드래그 앤 드롭
- [ ] AI Agent 실행 시 도구 호출 동작
- [ ] 도구 실행 결과가 LLM에 전달됨
- [ ] maxToolCalls 제한 동작
- [ ] toolOverrides 적용

---

## 기술 결정 요약

| 항목 | 결정 |
|------|------|
| 벡터 DB | pgvector (PostgreSQL 확장) |
| 임베딩 처리 | In-process 비동기 |
| 파일 저장소 | S3-compatible (MinIO) |
| PDF 파싱 | pdf-parse |
| API 키 암호화 | AES-256-GCM (기존 유틸리티) |

---

## 신규 의존성

### Backend
- `openai` — OpenAI API 클라이언트
- `@anthropic-ai/sdk` — Anthropic API 클라이언트
- `pdf-parse` — PDF 텍스트 추출
- `pgvector` — TypeORM pgvector 지원
- `p-limit` — 동시 처리 제한
- `@aws-sdk/client-s3` — S3 파일 저장소 (또는 기존 MinIO 클라이언트)

### Frontend
- 추가 의존성 없음 (기존 UI 컴포넌트 활용)
