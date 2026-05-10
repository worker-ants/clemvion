# LLM Provider 확장 후속

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §C

## 배경

`spec/5-system/7-llm-client.md` §Provider 표 / `spec/3-workflow-editor/4-ai-assistant.md` §27 호환성 표:

| Provider | 스트리밍 | 비고 |
|----------|----------|------|
| OpenAI | ✅ | |
| Anthropic | ✅ | embedding 미지원 |
| Google AI (Gemini) | ✅ | |
| **Azure OpenAI** | 🚧 | v1 스코프 밖. OpenAI 호환 엔드포인트의 스트리밍 검증 범위 밖 — 후속 작업 |
| **Local (Ollama / vLLM)** | 🚧 | OpenAI 호환 API 사용 시 자동 지원 가능, MVP 검증 범위 밖 |

LLM Config 등록·연결 테스트는 모든 provider 에서 ✅. 스트리밍 (Workflow AI Assistant·AI Agent multi-turn 의 토큰 단위 응답) 만 v1 범위 밖.

## 관련 문서

- `spec/5-system/7-llm-client.md` §Provider 표 / §스트리밍
- `spec/3-workflow-editor/4-ai-assistant.md` §27 v1 스트리밍 호환성
- `prd/6-phase2-ai.md` §3.1 LLM-01~07
- 코드: `backend/src/modules/llm/` (provider별 client), `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts`

## 작업 단위

### 1. Azure OpenAI 스트리밍 활성화

Azure OpenAI 는 OpenAI 호환 API 이므로 endpoint URL 만 다르고 인증 방식은 API Key. 스트리밍 SSE 포맷도 동일.

- [ ] LLM Config 의 `provider = 'azure_openai'` 케이스에서 base URL / API version / deployment name 처리 확인
- [ ] `LLMClient` 의 스트리밍 코드 경로에서 Azure 분기 추가 (또는 OpenAI 경로 재사용 검증)
- [ ] 단위 테스트 — Azure 응답 스트림을 OpenAI 호환 SSE 로 처리
- [ ] 통합 테스트 — Azure 실 endpoint 또는 mock server 로 스트리밍 응답 처리
- [ ] `spec/5-system/7-llm-client.md` §Provider 표에서 Azure 스트리밍 ✅ 로 갱신
- [ ] `spec/3-workflow-editor/4-ai-assistant.md` §27 / ED-AI-09 호환성 표 갱신

### 2. Local LLM (Ollama / vLLM) 스트리밍 검증

OpenAI 호환 API 모드를 켠 Ollama/vLLM 이면 자동 지원 가능. v1 에서는 검증 범위 밖이었음.

- [ ] **결정**: 본 plan에서 검증·문서화까지 완료 vs. provider preset 만 추가하고 사용자 검증 책임으로 이관
- [ ] (검증 결정 시) Ollama 11434 / vLLM OpenAI 호환 endpoint 로 통합 테스트 — 모델 list, chat completion (non-stream), chat completion stream
- [ ] LLM Config UI 에 "Local (OpenAI 호환)" preset 추가 (이미 있으면 검증·정리)
- [ ] 사용자 매뉴얼 (`frontend/src/content/docs/`) 에 Ollama/vLLM 연결 가이드 추가
- [ ] spec / PRD 갱신

### 3. 스트리밍 미지원 provider 안내 강화

ED-AI-09: "v1 스트리밍 지원: OpenAI, Anthropic, Google. 미지원 provider 선택 시 명시적 에러"

- [ ] Azure / Local 활성화 후에도 미지원 provider (있다면) 에 대한 에러 메시지가 정확한지 확인
- [ ] frontend AI Assistant 패널의 LLM Config 선택 시 — 스트리밍 미지원 provider 라면 disabled 또는 안내 툴팁

### 4. PRD 0 갱신

- [ ] `prd/0-overview.md` §6.2 / §6.3 LLM provider 부분에 Azure / Local 상태 반영 (현재는 PRD 0 에 명시되지 않았으므로 새 행 추가는 필수 아님)

### 5. REVIEW

- [ ] `ai-review` 실행 → API Contract / Side Effect 중심

## 수용 기준

- Azure OpenAI 스트리밍이 코드·테스트로 회귀 잠금
- Local LLM (Ollama/vLLM) 의 스트리밍이 검증·문서화되거나 사용자 검증 가이드 제공
- spec `7-llm-client.md` 의 🚧 표기 제거
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: 없음. AI Assistant 본체와 LLM Client 가 ✅
- **리스크**:
  - Azure 의 deployment name 모델 매핑 — LLM Config UI 에서 사용자가 deployment 별로 등록 가능해야 함
  - Ollama 의 모델 list 응답이 OpenAI 와 다름 — 모델 자동 발견 (LLM-07) 은 별도 어댑터 필요
