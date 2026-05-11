# LLM Provider 확장 후속

> 작성일: 2026-05-11
> 완료일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §C

## 배경

`spec/5-system/7-llm-client.md` §Provider 표 / `spec/3-workflow-editor/4-ai-assistant.md` §27 호환성 표 (작업 전 기준):

| Provider | 스트리밍 | 비고 |
|----------|----------|------|
| OpenAI | ✅ | |
| Anthropic | ✅ | embedding 미지원 |
| Google AI (Gemini) | ✅ | |
| **Azure OpenAI** | 🚧 | v1 스코프 밖. OpenAI 호환 엔드포인트의 스트리밍 검증 범위 밖 — 후속 작업 |
| **Local (Ollama / vLLM)** | 🚧 | OpenAI 호환 API 사용 시 자동 지원 가능, MVP 검증 범위 밖 |

LLM Config 등록·연결 테스트는 모든 provider 에서 ✅. 스트리밍 (Workflow AI Assistant·AI Agent multi-turn 의 토큰 단위 응답) 만 v1 범위 밖이었음.

**완료 결과 (2026-05-11)**: Azure / Local 모두 `OpenAIClient` 의 `stream()` 을 상속하여 자동 지원 — 코드 변경 없이 검증·문서화로 마감.

## 관련 문서

- `spec/5-system/7-llm-client.md` §Provider 표 / §8.2 스트리밍 (✅ 갱신 완료)
- `spec/3-workflow-editor/4-ai-assistant.md` §11 v1 스트리밍 호환성 (✅ 갱신 완료) + §1.2 범위밖 / §13 에러 코드 / §15 후속 로드맵 정합화
- `prd/0-overview.md` §6.1 `AI 플랫폼` 행 (5 provider 스트리밍 ✅ 명시)
- `frontend/src/content/docs/06-integrations-and-config/llm-config.mdx` (한·영) — "스트리밍 지원" 섹션 신설
- `frontend/src/content/docs/03-workflow-editor/overview.mdx` (한·영) — "v1 한계" 표에서 "Azure 스트리밍 미지원" 행 제거
- 코드: `backend/src/modules/llm/clients/openai.client.ts` (`stream()`), `backend/src/modules/llm/clients/azure-openai.client.ts` (상속), `backend/src/modules/llm/clients/local.client.ts` (상속), `backend/src/modules/llm/llm.service.ts` (`chatStream`), `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts`

## 작업 단위

### 1. Azure OpenAI 스트리밍 활성화 ✅

Azure OpenAI 는 OpenAI 호환 API 이므로 endpoint URL 만 다르고 인증 방식은 API Key. 스트리밍 SSE 포맷도 동일.

- [x] LLM Config 의 `provider = 'azure_openai'` 케이스에서 base URL / API version / deployment name 처리 확인 — `AzureOpenAIClient` 가 `OpenAIClient` 를 상속하면서 `api-key` 헤더 + `api-version=2024-10-21` 쿼리만 덮어씀
- [x] `LLMClient` 의 스트리밍 코드 경로에서 Azure 분기 추가 (또는 OpenAI 경로 재사용 검증) — 상속으로 자동 재사용
- [x] 단위 테스트 — Azure 응답 스트림을 OpenAI 호환 SSE 로 처리 (`backend/src/modules/llm/clients/openai.client.spec.ts` 의 stream 케이스가 Azure 도 커버)
- [x] 통합 테스트 — Azure 실 endpoint 또는 mock server 로 스트리밍 응답 처리 (사용자 검증 완료)
- [x] `spec/5-system/7-llm-client.md` §8.2 Provider 표에서 Azure 스트리밍 ✅ 로 갱신
- [x] `spec/3-workflow-editor/4-ai-assistant.md` §11 호환성 표 갱신 + §1.2 "Azure 스트리밍 범위 밖" 행 제거 + §13 `ASSISTANT_STREAMING_UNSUPPORTED` 코멘트 정합화 + §15 후속 로드맵에서 "Azure 스트리밍 지원" 항목 제거

### 2. Local LLM (Ollama / vLLM) 스트리밍 검증 ✅

OpenAI 호환 API 모드를 켠 Ollama/vLLM 이면 자동 지원 가능. v1 에서는 검증 범위 밖이었음.

- [x] **결정**: 본 plan에서 검증·문서화까지 완료. `LocalClient extends OpenAIClient` 로 동일 코드 경로 사용 → Ollama 11434 / vLLM `--api-server` OpenAI-compat 모드에서 스트리밍 검증 완료
- [x] Ollama 11434 / vLLM OpenAI 호환 endpoint 로 통합 테스트 — 모델 list, chat completion (non-stream), chat completion stream (사용자 검증 완료)
- [x] LLM Config UI 의 "Local (OpenAI 호환)" preset 검증·정리 — `frontend/src/components/llm-config` 의 provider 드롭다운에서 Local 선택 시 baseUrl 필드 노출 정상
- [x] 사용자 매뉴얼 (`frontend/src/content/docs/06-integrations-and-config/llm-config.mdx` 한·영) 에 Ollama/vLLM 연결 가이드 + "스트리밍 지원" 섹션 추가
- [x] spec / PRD 갱신 (§1 의 spec 갱신 항목과 통합)

### 3. 스트리밍 미지원 provider 안내 강화 ✅ (N/A — 모든 v1 provider 가 ✅)

ED-AI-09 의 "v1 스트리밍 지원: OpenAI, Anthropic, Google. 미지원 provider 선택 시 명시적 에러" 는 Azure/Local 활성화로 사실상 무효화됨.

- [x] Azure / Local 활성화 후에도 미지원 provider (있다면) 에 대한 에러 메시지가 정확한지 확인 — `LLM_STREAMING_UNSUPPORTED` 는 향후 추가될 provider 가 `stream()` 미구현일 때만 발화. 문구는 4-ai-assistant.md §13 에서 "스트리밍 지원 provider 를 선택해 주세요" 로 일반화
- [x] frontend AI Assistant 패널의 LLM Config 선택 시 — 스트리밍 미지원 provider 라면 disabled 또는 안내 툴팁: v1 5개 provider 가 모두 ✅ 이므로 disabled 처리 코드 경로 자체가 비활성

### 4. PRD 0 갱신 ✅

- [x] `prd/0-overview.md` §6.1 `AI 플랫폼` 행에 "v1 의 5개 provider OpenAI/Anthropic/Google/Azure OpenAI/Local Ollama·vLLM 모두 스트리밍 ✅" 명시

### 5. REVIEW ✅

- [x] `ai-review` 실행 — 문서/plan 정합화만 수행하여 코드 변경 없음. spec/PRD/매뉴얼/플랜 4계층 모두 ✅ 동기화. 사용자 검증으로 마감.

## 수용 기준 ✅

- [x] Azure OpenAI 스트리밍이 코드(`AzureOpenAIClient` 상속)·spec·매뉴얼로 회귀 잠금
- [x] Local LLM (Ollama/vLLM) 의 스트리밍이 검증·문서화 (Ollama 11434 / vLLM OpenAI-compat 모드)
- [x] spec `7-llm-client.md` / `4-ai-assistant.md` 의 🚧·❌ 표기 제거
- [x] ai-review Critical/Warning 0 (코드 변경 없음 — N/A)

## 의존성·리스크

- **의존**: 없음. AI Assistant 본체와 LLM Client 가 ✅
- **잔존 리스크**:
  - Azure 의 deployment name 모델 매핑 — LLM Config UI 에서 사용자가 deployment 별로 등록 가능 (`base_url` + deployment name 을 model ID 로 입력하는 기존 패턴 유지)
  - Ollama 의 `GET /api/tags` 모델 list 응답이 OpenAI 와 다름 — `LocalClient.listModels()` 가 OpenAI 호환 `GET /v1/models` 경로를 사용하면 정상 동작. Ollama legacy 모드 호환이 필요해지면 별도 어댑터 신설 plan 으로 분리
