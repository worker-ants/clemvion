---
id: "CLE-AI-MODELS"
title: "모델 설정"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-MODELS-001", "REQ-MODELS-002", "REQ-MODELS-003", "REQ-MODELS-004", "REQ-MODELS-005", "REQ-MODELS-006", "REQ-MODELS-007", "REQ-MODELS-008", "REQ-MODELS-009", "REQ-MODELS-010", "REQ-MODELS-011", "REQ-MODELS-012", "REQ-MODELS-013", "REQ-MODELS-014", "REQ-MODELS-015", "REQ-MODELS-016", "REQ-MODELS-017", "REQ-MODELS-018", "REQ-MODELS-019", "REQ-MODELS-020", "REQ-MODELS-021", "REQ-MODELS-022", "REQ-MODELS-023", "REQ-MODELS-024", "REQ-MODELS-025", "REQ-MODELS-026", "REQ-MODELS-027", "REQ-MODELS-028", "REQ-MODELS-029", "REQ-MODELS-030", "REQ-MODELS-031", "REQ-MODELS-032", "REQ-MODELS-033", "REQ-MODELS-034", "REQ-MODELS-035", "REQ-MODELS-036", "REQ-MODELS-037", "REQ-MODELS-038"]
basis_superseded: false
parent: "CLE-AI"
ancestors: ["CLE-VISION", "CLE-AI"]
area: "CLE-AI"
content_hash: "2338bb0e3a94db332b2744bbcab5c4d4da5f33307771d796ccb3ca9361dd3a13"
read_as: "approved"
task: null
source_paths: ["spec/2-navigation/6-config.md", "spec/2-navigation/_product-overview.md", "spec/4-nodes/3-ai/_product-overview.md"]
mirror_sha256: "0364b7a2899f12f17274339186cf31c52a8596287c0493f3b8865e767d22bd6d"
etag: "sha256-54a5c8b284741a2524a8f57db6f47a6eb9cc471543af31fd82f8facb7482a3b4"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/6-config.md` (Part B, §3 API 의 모델 설정 표, R-1·R-3·R-4·R-5·R-7), `spec/2-navigation/_product-overview.md` (§3.7), `spec/4-nodes/3-ai/_product-overview.md` (§3.1, §4 API 키 암호화, §5 NF-AI-04) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

모델 설정(Model settings, `ModelConfig`) 화면은 워크스페이스가 쓰는 AI 모델 연결을 한곳에서 관리한다. 모델 종류(`ModelConfig.kind`)는 세 가지다. Chat 은 AI 노드가 부르는 LLM, Embedding 은 지식 저장소(Knowledge Base, `KnowledgeBase`) 임베딩, Rerank 는 지식 저장소 검색의 리랭킹에 쓴다. 화면은 이 세 종류를 탭으로 나누고, 셋 모두 `kind` 로 구분하는 한 가지 리소스다. 모델 프로바이더(model provider, `provider`) 자격 증명, API 키 마스킹, SSRF 가드를 종류와 상관없이 함께 쓴다.

워크플로우를 편집할 때마다 자격 증명을 입력하지 않도록, 여기서 한 번 등록한 모델 설정을 AI 노드와 지식 저장소가 참조한다. 화면은 사이드바 최상위 메뉴 "Models" 이고 경로는 `/w/<slug>/models` 다. 메뉴 배치는 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 에서 정한다.

범위 밖 문서는 다음과 같다.

- 외부 시스템이 트리거를 부를 때의 인증 설정(Part A): [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md)
- 모델 설정 엔티티의 컬럼·인덱스·암호화 위치: [LLM 사용량 기록](CLE-AI-USAGE.md)
- 연결 테스트·모델 목록 조회의 호출 계층, SSRF 가드 규칙, 에러 코드: [LLM 클라이언트](CLE-AI-LLM.md)
- 지식 저장소 폼의 임베딩 모델·리랭커 선택, 검색 불가 배너: [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md)
- 지식 저장소 임베딩 차원과 재임베딩: [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md)
- 리랭킹 동작과 강등 규칙: [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)

## 요구사항

- REQ-MODELS-001 WHEN 워크스페이스 멤버가 모델 설정 화면을 열면 THE SYSTEM SHALL AI 노드가 쓸 LLM 모델 설정을 Chat·Embedding·Rerank 탭별 목록으로 보여 준다. (원본: NAV-CL-01)
- REQ-MODELS-002 WHEN 편집자 이상이 Chat 모델 설정을 추가하면 THE SYSTEM SHALL OpenAI·Anthropic·Google AI·Azure OpenAI·Local 가운데 여러 프로바이더를 등록할 수 있게 한다. (원본: NAV-CL-02, LLM-01)
- REQ-MODELS-003 WHEN 편집자 이상이 프로바이더 API 키를 입력하면 THE SYSTEM SHALL 키를 AES-256-GCM 으로 암호화해 저장한다. (원본: NAV-CL-03, LLM-02, AI PRD NF-AI-04)
- REQ-MODELS-004 WHEN 모델 설정을 조회하면 THE SYSTEM SHALL 종류와 상관없이 API 키를 마스킹해 응답한다. (원본: NAV-CL-03)
- REQ-MODELS-005 WHEN 사용자가 Azure·Local 프로바이더를 고르면 THE SYSTEM SHALL 커스텀 엔드포인트(Base URL)를 필수로 받는다. (원본: LLM-03)
- REQ-MODELS-006 WHEN 편집자 이상이 Chat 모델 설정을 저장하면 THE SYSTEM SHALL 기본 모델과 기본 파라미터(temperature, max_tokens 등)를 함께 저장한다. (원본: NAV-CL-05, LLM-04)
- REQ-MODELS-007 WHEN 새 Chat 모델 설정 폼을 열면 THE SYSTEM SHALL 기본 파라미터 기본값(temperature 0.7, max_tokens 4096, top_p 1.0, frequency_penalty 0.0, presence_penalty 0.0)을 채운다. (원본: NAV-CL-05)
- REQ-MODELS-008 WHEN 편집자 이상이 카드의 ⭐ 로 기본 설정을 지정하면 THE SYSTEM SHALL 같은 워크스페이스·같은 종류의 기존 기본 설정을 해제하고 대상만 기본으로 둔다. (원본: NAV-CL-04, LLM-05)
- REQ-MODELS-009 WHEN AI 노드를 새로 만들면 THE SYSTEM SHALL Chat 종류의 워크스페이스 기본 설정을 기본 선택으로 쓴다. (원본: NAV-CL-04, LLM-05)
- REQ-MODELS-010 WHEN 편집자 이상이 Chat·Embedding 모델 설정에서 연결 테스트를 누르면 THE SYSTEM SHALL 저장된 자격 증명으로 프로바이더 접속을 확인하고 "Connected" 또는 에러 메시지를 표시한다. (원본: NAV-CL-06, LLM-06)
- REQ-MODELS-011 WHEN 사용자가 Chat·Embedding 폼에서 "모델 불러오기" 를 누르면 THE SYSTEM SHALL 프로바이더 모델 조회 API 를 실시간으로 불러 기본 모델 선택 목록을 채운다. (원본: LLM-07)
- REQ-MODELS-012 WHILE Chat·Embedding 폼에서 모델을 한 번도 불러오지 않은 동안 THE SYSTEM SHALL 기본 모델 선택 목록을 비활성으로 둔다.
- REQ-MODELS-013 WHILE 사용자가 기본 모델 옵션을 고르지 않은 동안 THE SYSTEM SHALL 저장 버튼을 비활성으로 둔다.
- REQ-MODELS-014 IF 모델 목록 조회가 실패하면 THE SYSTEM SHALL 선택 목록을 비활성으로 두고 sanitize 한 에러 메시지만 표시하며 자유 입력을 허용하지 않는다.
- REQ-MODELS-015 WHEN 수정 폼에서 API 키를 비워 두고 모델을 불러오면 THE SYSTEM SHALL 저장된 암호화 키로 `GET /api/model-configs/:id/models` 를 부른다.
- REQ-MODELS-016 WHEN 수정 폼에서 API 키를 다시 입력하고 모델을 불러오면 THE SYSTEM SHALL 미리보기 엔드포인트 `POST /api/model-configs/preview-models` 를 부른다.
- REQ-MODELS-017 IF 저장된 기본 모델 ID 가 새로 불러온 목록에 없으면 THE SYSTEM SHALL "현재 저장값: <id>" 옵션을 함께 보여 주어 다른 필드만 고칠 수 있게 한다.
- REQ-MODELS-018 WHILE Chat 탭 폼인 동안 THE SYSTEM SHALL 불러온 목록 가운데 `type === 'chat'` 모델만 보여 준다.
- REQ-MODELS-019 WHILE Embedding 탭 폼인 동안 THE SYSTEM SHALL 불러온 목록 가운데 `type === 'embedding'` 모델만 보여 준다.
- REQ-MODELS-020 WHEN 사용자가 Embedding 모델 설정의 프로바이더를 고르면 THE SYSTEM SHALL OpenAI·Azure OpenAI·Google AI·Local 만 보여 주고 Anthropic 은 빼 준다.
- REQ-MODELS-021 WHEN Embedding 연결 테스트가 벡터 차원을 감지하면 THE SYSTEM SHALL 저장된 `dimension` 과 다를 때만 `PATCH /api/model-configs/:id { dimension }` 로 자동 저장한다.
- REQ-MODELS-022 IF 차원 자동 저장이 실패하면 THE SYSTEM SHALL 연결 성공 표시를 그대로 둔다.
- REQ-MODELS-023 WHILE Embedding 모델 설정에 저장된 차원 값이 있는 동안 THE SYSTEM SHALL 폼의 차원 필드를 읽기 전용으로 보여 준다.
- REQ-MODELS-024 WHILE Embedding 모델 설정의 차원을 아직 감지하지 않은 동안 THE SYSTEM SHALL 차원 수동 입력을 허용한다.
- REQ-MODELS-025 WHEN 편집자 이상이 Rerank 모델 설정을 추가하면 THE SYSTEM SHALL 프로바이더 선택지를 `tei` 와 `cohere` 로 한정한다.
- REQ-MODELS-026 IF Rerank 프로바이더가 `cohere` 이면 THE SYSTEM SHALL API 키를 필수로 받고 폼에 Base URL 입력을 보여 주지 않는다.
- REQ-MODELS-027 IF Rerank 프로바이더가 `tei` 이면 THE SYSTEM SHALL 폼 검증과 리랭커 사용 시점에 Base URL 을 필수로 강제한다.
- REQ-MODELS-028 WHEN Rerank 폼에서 기본 모델을 입력하면 THE SYSTEM SHALL 모델 ID 자유 입력을 허용한다.
- REQ-MODELS-029 WHILE Rerank 탭인 동안 THE SYSTEM SHALL 연결 테스트를 제공하지 않는다.
- REQ-MODELS-030 IF 리랭킹을 켠 지식 저장소가 리랭커를 지정하지 않았으면 THE SYSTEM SHALL 워크스페이스 기본 리랭커를 쓴다.
- REQ-MODELS-031 IF 워크스페이스 기본 리랭커도 없으면 THE SYSTEM SHALL 그 지식 저장소 검색을 리랭킹 사용 안 함(`off`)으로 강등한다.
- REQ-MODELS-032 IF 자가호스팅 예외(`local`·`tei`) 밖 프로바이더의 Base URL 이 사설망·loopback 주소이면 THE SYSTEM SHALL 400 `MODEL_CONFIG_INVALID` 로 거부한다.
- REQ-MODELS-033 WHEN 뷰어 이상이 모델 설정 목록·상세·`:id/models` 를 조회하면 THE SYSTEM SHALL 조회를 허용한다.
- REQ-MODELS-034 IF 편집자 미만이 모델 설정 추가·수정·삭제·기본 지정을 호출하면 THE SYSTEM SHALL 403 으로 거부한다.
- REQ-MODELS-035 IF 편집자 미만이 `POST :id/test` 또는 `POST preview-models` 를 호출하면 THE SYSTEM SHALL 403 으로 거부한다.
- REQ-MODELS-036 IF `GET :id/models` 의 `type` 쿼리가 `chat`·`embedding` 밖의 값이면 THE SYSTEM SHALL 400 Bad Request 로 거부한다.
- REQ-MODELS-037 WHEN 프로바이더가 돌려준 모델 수가 500 을 넘으면 THE SYSTEM SHALL 앞 500개만 응답한다.
- REQ-MODELS-038 IF 이미 벡터를 적재한 지식 저장소가 참조하는 Embedding 모델 설정의 차원을 바꾸려 하면 THE SYSTEM SHALL 차원 변경을 막는다. (미구현)

## 화면 구조

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 탭 바 | 상단 | `[Chat]` `[Embedding]` `[Rerank]` | 탭을 바꾸면 그 종류의 모델 설정 목록을 보여 준다 |
| 추가 버튼 | 상단 오른쪽 | `[+ Add Model]` | 현재 탭의 종류로 모델 설정 추가 폼을 연다 |
| 카드 목록 | 본문 | 카드마다 ⭐(그 종류의 워크스페이스 기본 설정), 이름·프로바이더, 연결 상태("Connected"), 기본 모델과 대표 파라미터(예: `Default: gpt-4o · Temperature: 0.7`), ⋮ 메뉴 | ⭐ 로 기본 설정을 지정하고 ⋮ 로 수정·삭제한다 |
| Rerank 카드 | 본문(Rerank 탭) | 이름, 기본 모델(예: `dragonkue/bge-reranker-v2-m3-ko`), `tei` 는 Base URL(예: `http://tei:8080`) | ⭐ 로 기본 리랭커를 지정한다 |

워크스페이스 기본 설정(default config, `is_default`)은 `(workspace, kind)` 마다 하나다.

## Chat 탭

### 추가와 수정 폼

| 필드 | 설명 |
|------|------|
| 프로바이더 유형 | 드롭다운: OpenAI, Anthropic, Google AI, Azure OpenAI, Local(Ollama/vLLM 등) |
| 이름 | 사용자가 정하는 별칭 |
| API Key | 프로바이더 API 키(마스킹 입력). Local 은 선택 |
| Base URL | 커스텀 엔드포인트(로컬 모델, Azure 등). Azure·Local 은 필수 |
| 기본 모델 | "모델 불러오기" 버튼으로 프로바이더 모델 조회 API 를 실시간으로 부른 뒤 응답 목록에서 고른다. 자유 입력은 허용하지 않는다 |
| 기본 파라미터 | Temperature, Max Tokens, Top-P 등 |
| 기본 설정 | ⭐ 로 표시한다. AI 노드를 만들 때 기본으로 선택된다 |

### 기본 모델 선택

- **추가할 때**: 프로바이더·API 키(Local 은 선택)·Base URL(Azure·Local 필수)을 입력하고 "모델 불러오기" 를 누르면 프로바이더 API(`listModels`)로 실시간 조회해 선택 목록에 넣는다. 이때 API 키는 저장하지 않고 요청 범위에서만 쓴다. 모델을 한 번도 불러오지 않았으면 선택 목록이 비활성이고, 옵션을 골라야 저장 버튼이 활성화된다.
- **수정할 때**: API 키를 비워 두면 DB 에 저장된 암호화 키로 `GET /api/model-configs/:id/models` 를 부른다. API 키를 다시 입력하면 미리보기 엔드포인트를 쓴다. 저장된 모델 ID 가 새 목록에 없으면 "현재 저장값: <id>" 옵션을 함께 보여 준다. 사용자는 모델을 바꾸지 않고 다른 필드만 고칠 수 있다.
- **목록 필터**: 응답 가운데 `type === 'chat'` 모델만 보여 주고 임베딩 모델은 뺀다.
- **프로바이더별 구현**: OpenAI·Anthropic·Google·Azure·Local 모두 프로바이더 공식 모델 조회 API 를 실시간으로 부른다. 그래서 preview 모델과 새 모델까지 최신 목록이 나온다.
- **조회 실패**: 선택 목록은 비활성으로 두고 에러 메시지(프로바이더 에러를 sanitize 한 결과)만 표시한다. 자유 입력 대체 경로는 없다. 잘못된 모델 ID 가 저장돼 런타임 호출 실패로 이어지는 일을 막기 위해서다. 사용자는 자격 증명과 Base URL 을 다시 확인하고 "모델 불러오기" 를 다시 누른다.

### 기본 파라미터 기본값

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| temperature | 응답의 창의성·무작위성 | 0.7 |
| max_tokens | 최대 출력 토큰 수 | 4096 |
| top_p | 누적 확률 기반 샘플링 | 1.0 |
| frequency_penalty | 반복 토큰 억제 | 0.0 |
| presence_penalty | 새 토큰 유도 | 0.0 |

여기서 정하는 값은 기본값이다. AI 노드마다 따로 덮어쓸 수 있다. AI 노드의 `maxTokens` 기본값도 이 표를 따른다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)).

## 연결 테스트

- "Test Connection" 버튼은 Chat·Embedding 탭에 있다. Rerank 탭에는 없다.
- **Chat**: 모델 목록 조회 같은 가벼운 API 호출로 연결을 확인한다.
- **Embedding**: 실제 probe 임베딩(`client.embed(['connection test'], defaultModel)`)으로 연결과 모델 유효성을 함께 확인하고, 반환 벡터 길이를 `dimension` 으로 감지한다. 호출 방식은 [LLM 클라이언트](CLE-AI-LLM.md) 에서 정한다.
- 성공하면 "Connected" 를 표시한다. Embedding 은 감지한 차원도 함께 안내한다.
- 실패하면 에러 메시지(인증 실패, 네트워크 에러 등)를 표시한다.

### Embedding 차원 자동 감지와 저장

Embedding 연결 테스트가 차원을 감지하면 그 값을 `PATCH /api/model-configs/:id { dimension }` 로 바로 저장한다. 기존 `ModelConfig.dimension` 과 다를 때만 저장한다. 자동 저장이 권한 등으로 실패해도 연결 성공 표시는 유지한다(best-effort).

저장 대상은 모델 설정의 모델 출력 차원(`dimension`)이다. 지식 저장소의 저장 청크 차원(`embedding_dimension`)에는 쓰지 않는다. 저장 청크 차원은 실제 적재 경로가 채운다. 지식 저장소 폼의 "임베딩 테스트" 는 읽기 전용이다. 두 probe 는 대상 필드가 달라 서로 보완한다. 저장 청크 차원의 정의는 [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md), 채우는 경로는 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md), 폼은 [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) 에서 정한다. 두 값이 어긋날 때 무엇을 기준으로 할지는 [지식 저장소 데이터와 흐름의 미결 사항](../CLE-KB/CLE-KB-DATA.md#미결-사항) 참조. 서버는 `ModelConfigService.findEntity`(종류 무관)로 설정을 찾는다.

## Embedding 탭

지식 저장소 임베딩에 쓸 모델(`kind=embedding`)을 관리한다. 지식 저장소 추가·수정 폼의 "Embedding model" 선택 목록이 이 목록에서 고른다.

| 필드 | 설명 |
|------|------|
| 프로바이더 유형 | 드롭다운: OpenAI, Azure OpenAI, Google AI, Local(Ollama/vLLM/TEI 등). Anthropic 은 임베딩이 없어 지원하지 않는다 |
| 이름 | 사용자가 정하는 별칭 |
| API Key | 프로바이더 API 키(마스킹 입력). 자가호스팅(local)은 선택 |
| Base URL | 커스텀 엔드포인트. Azure·Local 은 필수이고 SSRF 가드를 거친다 |
| 기본 모델 | "모델 불러오기" 로 프로바이더 모델을 조회한 뒤 고른다. `type === 'embedding'` 모델만 보여 준다(Chat 탭과 반대 필터) |
| 차원(dimension) | 모델 출력 차원. 임베딩 모델이 내는 벡터 길이다(예: 1536/3072). 연결 테스트가 자동으로 감지해 저장한다. 저장된 값이 있으면 폼에서 읽기 전용으로 보이고, 감지 전(새로 만들었거나 테스트하지 않음)에는 수동 입력을 허용한다. 현재 구현은 `editConfig.dimension != null` 일 때 읽기 전용이다 |
| 기본 임베딩 설정 | ⭐ 로 표시한다. 지식 저장소가 `embedding_model_config_id` 를 지정하지 않으면 이것을 쓴다 |

- **차원 변경 가드**: 이미 벡터를 적재한 지식 저장소가 참조하는 Embedding 모델의 차원은 나중에 바꿀 수 없다(pgvector 컬럼 차원과 묶여 있다). 이 가드의 강제 지점은 정의가 갈린다. [미결 사항](#미결-사항) 참조.
- **지식 저장소의 임베딩 설정 변경**: 지식 저장소가 임베딩 설정을 바꾸면 저장 청크 차원(`embedding_dimension`)이 NULL 로 초기화되고, 상세 화면의 검색 불가 배너와 "지금 재임베딩" 버튼으로 재임베딩을 안내한다. 자세한 규칙은 [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) 에서 정한다.
- **모델 선택**: Chat 탭과 같은 선택 전용 정책이다. 자유 입력 대체 경로가 없다([Rationale](#기본-모델을-목록에서만-고르게-한-이유)).

## Rerank 탭

지식 저장소 검색의 리랭킹에 쓸 리랭커(reranker) 프로바이더와 모델(`kind=rerank`)을 관리한다. 지식 저장소 폼의 "Reranker" 선택 목록이 이 목록에서 고른다. 리랭킹 동작은 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 에서 정한다.

### 추가와 수정 폼

| 필드 | 설명 |
|------|------|
| 프로바이더 유형 | 드롭다운: `tei`(자가호스팅 HF Text-Embeddings-Inference), `cohere`(외부 API) |
| 이름 | 사용자가 정하는 별칭 |
| API Key | 프로바이더 API 키(마스킹 입력). `cohere` 같은 외부 프로바이더는 필수, `tei` 는 선택 |
| Base URL | 자가호스팅 엔드포인트. `tei` 는 필수다. 단 강제 지점은 폼 검증과 리랭커 사용 시점이고, 생성 API(POST)는 검증하지 않는다. `cohere` 는 폼에 보이지 않지만 API 에서는 선택적 override 를 받는다(비우면 프로바이더 공식 엔드포인트). `tei` 밖 프로바이더의 사설망·loopback Base URL 은 SSRF 가드가 400 `MODEL_CONFIG_INVALID` 로 막는다 |
| 기본 모델 | 기본 리랭커 모델 ID 를 자유 입력한다(예: `dragonkue/bge-reranker-v2-m3-ko`, `bge-reranker-v2-m3`, `rerank-3.5`). 리랭커 프로바이더에는 표준 모델 목록 API 가 없어 Chat·Embedding 탭과 달리 자유 입력이다 |
| 기본 리랭커 설정 | ⭐ 로 표시한다. 지식 저장소가 `rerank_config_id` 를 지정하지 않으면 이것을 쓴다 |

- **프로바이더별 필수 필드**: `tei` 는 자가호스팅이라 Base URL 이 필수이고 API 키는 선택이다. `cohere` 는 외부 API 라 API 키가 필수다. Base URL 은 폼에 보이지 않지만 API 에서는 선택적 override 를 허용한다([Rationale](#cohere-base-url-을-폼에서-감추고-api-에서는-받는-이유)). `tei` 의 Base URL 필수는 프런트엔드 폼 검증과 리랭커 사용 시점에 강제하고, 생성 API 자체는 검증하지 않는다.
- **마스킹**: 저장 뒤 응답의 `api_key` 는 늘 마스킹한다. Chat·Embedding 탭과 같은 정책이다.
- **연결 테스트 없음**: 리랭커에는 표준 모델 목록·테스트 API 가 없어 연결 테스트를 제공하지 않는다.

### 기본 리랭커

⭐ 로 워크스페이스 기본 리랭커를 지정한다. 지식 저장소가 리랭킹을 켜고(`rerank_mode ≠ off`) `rerank_config_id` 를 지정하지 않았으면 기본 리랭커를 쓴다. 기본 리랭커도 없으면 그 지식 저장소 검색은 `off` 로 안전하게 강등한다([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)).

## 권한

| 동작 | 최소 역할 |
|------|-----------|
| 목록·상세 조회, `GET :id/models` | 뷰어 이상 |
| 추가·수정·삭제·기본 지정 | 편집자 이상 |
| 연결 테스트(`POST :id/test`)·모델 목록 미리보기(`POST preview-models`) | 편집자 이상 |

연결 테스트와 미리보기는 데이터를 바꾸지 않는 동작 호출 POST 이지만 편집자 이상으로 막는다([Rationale](#연결-테스트와-미리보기를-편집자-이상으로-막는-이유)). 역할별 리소스 권한 매트릭스는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 에서 정한다.

## API

Chat·Embedding·Rerank 를 한 엔드포인트에서 `kind` 로 구분해 관리한다. 응답 모양은 종류와 상관없이 같다(마스킹한 `apiKey` 포함).

| 메서드 | 경로 | 설명 | 최소 역할 |
|--------|------|------|-----------|
| GET | `/api/model-configs?kind=chat\|embedding\|rerank` | 모델 설정 목록. 쿼리: `kind`, `page`, `limit`, `sort`, `order`, `search`. 목록 응답 형식은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 을 따른다 | 뷰어 |
| POST | `/api/model-configs` | 모델 설정 추가. 본문에 `kind` 를 싣는다 | 편집자 |
| GET | `/api/model-configs/:id` | 상세 조회 | 뷰어 |
| PATCH | `/api/model-configs/:id` | 수정 | 편집자 |
| PATCH | `/api/model-configs/:id/set-default` | 종류별 기본 지정. 같은 `(workspace_id, kind)` 의 기존 `is_default` 를 false 로 바꾼 뒤 대상만 true 로 둔다 | 편집자 |
| POST | `/api/model-configs/:id/test` | 연결 테스트(Chat·Embedding 만, Rerank 없음). 응답 `data`: Chat `{ success }`, Embedding `{ success, dimension? }`. 설정은 종류와 상관없이 찾는다(`ModelConfigService.findEntity`) | 편집자 |
| POST | `/api/model-configs/preview-models` | 저장 전 폼 자격 증명으로 모델 목록 미리보기(Chat·Embedding). 본문 `{ provider, apiKey, baseUrl? }`. 결과 수 상한 500 | 편집자 |
| GET | `/api/model-configs/:id/models` | 사용 가능한 모델 목록(Chat·Embedding). 쿼리 `?type=chat\|embedding`(선택)으로 거른다. 허용 값 밖의 `type` 은 400 Bad Request(컨트롤러 `ParseEnumPipe`). 결과 수 상한 500 | 뷰어 |
| DELETE | `/api/model-configs/:id` | 삭제 | 편집자 |

- 미리보기·연결 테스트·`:id/models` 세 probe 는 공통 컨트롤러 상수 `PROVIDER_PROBE_THROTTLE` 로 rate limit 을 건다. 수치와 정책은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 에서 정한다.
- 미리보기의 동작(임시 클라이언트, 캐시 없음, 30초 타임아웃, 결과 수 상한 500 의 절단 규칙, API 키 로깅 금지)과 에러 코드(`LLM_CREDENTIALS_REQUIRED`, `LLM_MODEL_LIST_FAILED`, `MODEL_CONFIG_INVALID`)는 [LLM 클라이언트](CLE-AI-LLM.md) 에서 정한다.
- 모든 Chat·Embedding·Rerank 설정은 `/api/model-configs` 한 표면으로만 다룬다. 옛 `/api/llm-configs`·`/api/rerank-configs` 경로는 없다.

## 미결 사항

- **Embedding 차원 변경 가드의 강제 지점**: Embedding 탭 규칙은 벡터를 적재한 지식 저장소가 참조하는 모델의 차원을 나중에 바꿀 수 없다고 적는다. 같은 문서의 연결 테스트 규칙은 감지한 차원이 저장값과 다르면 `PATCH` 로 자동 저장한다. 현재 구현은 모델 설정 수정(`ModelConfigService.update`)에 차원 변경을 막는 검사가 없고 Embedding 종류이면 `dimension` 을 그대로 바꾼다. 실제 보호가 지식 저장소 쪽 저장 청크 차원(`embedding_dimension`) 초기화와 검색 불가 처리([문서 임베딩](../CLE-KB/CLE-KB-EMBED.md))로 대신되는지, 모델 설정 층에 가드를 둘지 결정 필요. 저장 청크 차원의 정의([지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md#미결-사항))와 함께 정해야 한다([문서 임베딩](../CLE-KB/CLE-KB-EMBED.md#미결-사항)).

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/models/page.tsx`
- `codebase/frontend/src/components/models/model-config-manager.tsx`
- `codebase/frontend/src/lib/api/model-configs.ts`
- `codebase/backend/src/modules/model-config/**`
- `codebase/backend/src/modules/llm/llm-preview.service.ts`
- `codebase/backend/src/modules/llm/llm-model-config.controller.ts`

## Rationale

### 기본 모델을 목록에서만 고르게 한 이유

잘못된 모델 ID(오타, 프로바이더가 deprecate 해서 사라진 ID)가 저장되면 실제 호출 시점에 런타임 LLM 호출 에러로 실패한다. 클라이언트 계층의 에러 코드 매핑과 모델 없음 세분화(미구현)는 [LLM 클라이언트](CLE-AI-LLM.md) 에서 정한다. 저장 시점에 자격 증명과 Base URL 로 실제 호출할 수 있는 모델만 고르게 하면 이 회귀를 구조적으로 막는다.

- **동작**: 기본 모델 선택은 자유 입력 대체 경로 없이 `<select>` 만 제공한다. 모델을 불러오지 않았으면 선택 목록이 비활성이다. 조회에 실패하면 자유 입력 없이 에러 메시지만 표시하고, 사용자는 자격 증명을 다시 확인한 뒤 다시 시도한다.
- **수정 흐름 호환**: 저장된 모델 ID 가 새 목록에 없으면 "현재 저장값: <id>" 옵션을 보여 준다. 사용자가 모델을 다시 고르지 않아도 temperature 같은 다른 필드만 고칠 수 있다. 다른 옵션을 명시적으로 골라야 모델이 바뀐다.
- **적용 범위**: Chat 탭과 Embedding 탭의 `defaultModel`, 그리고 지식 저장소 폼의 임베딩 모델 선택([지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md))에 적용한다. Rerank 탭은 표준 모델 목록 API 가 없어 자유 입력이다. AI 노드 설정 패널의 `model` 필드는 표현식(`{{ vars.model }}`)을 그대로 허용한다. 노드 모델은 동적 평가가 정상 흐름이고, `defaultModel` 이 가리키는 값의 정합 검증은 별개 책임이다.
- **미리보기 결과 처리**: 미리보기 결과가 비었거나 실패하면 이 선택 전용 정책을 따른다. 다른 값으로 대신 채우지 않는다.

### Chat·Embedding·Rerank 를 한 화면으로 합친 이유

이전 결정은 리랭커를 전용 `/rerank` 엔드포인트 때문에 Chat 설정과 떼어 별도 리소스(`RerankConfig`)로 두는 것이었다. 임베딩은 지식 저장소가 Chat 용 설정을 빌려 쓰는 방식이었다. 이 결정을 뒤집어 Chat·Embedding·Rerank 를 한 가지 모델 설정(`kind` 판별)과 한 화면(`/models` 의 탭)으로 합쳤다.

- **뒤집은 근거**: 따로 둘 명분이던 인프라(API 키 마스킹, SSRF 가드, 시크릿 암호화)는 처음부터 함께 쓰였다. API 모양 차이는 실행 층 팩토리(`RerankClientFactory`)가 이미 흡수하고 있었다. 설정을 쪼갠 결과는 CRUD·DTO·컨트롤러·프런트 페이지·i18n 의 통째 중복과 설정 화면 세 곳(LLM, Rerank, 지식 저장소 안의 임베딩) 분산뿐이었다. 엔티티를 합친 근거는 [LLM 사용량 기록](CLE-AI-USAGE.md) 에서 정한다.
- **유지하는 것**: 리랭킹 호출 계약(전용 `/rerank`, [LLM 클라이언트](CLE-AI-LLM.md)), 연결 테스트 없음(표준 모델 목록 API 부재), 리랭커 프로바이더 `tei`·`cohere` 는 그대로다. 합친 것은 설정 테이블과 화면이고 실행 층은 합치지 않았다.
- **API 응답**: `/api/model-configs` 응답 모양은 종류와 상관없이 같다.
- **옛 경로**: 한때 두었던 `/api/llm-configs`·`/api/rerank-configs`(하위 경로 `:id/test`·`preview-models`·`:id/models`·`:id/set-default` 포함) 호환 경로와 프런트 redirect 라우트 `/llm-configs`·`/rerank-configs` 는 합침 작업의 마지막 단계에서 지웠다.

### cohere Base URL 을 폼에서 감추고 API 에서는 받는 이유

"`cohere` 는 Base URL 을 받지 않고 공식 엔드포인트로 고정한다" 는 서술은 폼에서만 맞고 API 계약과 달랐다. 실제 생성·수정 API 는 `baseUrl` 을 프로바이더와 상관없이 선택 값으로 받고, 비우면 공식 엔드포인트를 쓴다. cohere 호환 게이트웨이나 프록시를 거치는 운영 상황을 허용하기 위해서다.

외부 프로바이더의 `baseUrl` 로는 복호화한 Bearer 키가 전송되므로 사설망·loopback 주소는 SSRF 가드로 막는다(400 `MODEL_CONFIG_INVALID`). Rerank 에서 예외는 `tei` 뿐이고, 가드 규칙은 [LLM 클라이언트](CLE-AI-LLM.md) 에서 정한다. 일반 사용자가 헷갈리지 않도록 폼은 `cohere` 를 고르면 Base URL 입력을 보여 주지 않는다.

같은 맥락에서 `tei` 의 Base URL 필수도 생성 API 의 DTO 검증이 아니라 프런트엔드 폼 검증과 리랭커 사용 시점에 강제한다. API 만 불러 Base URL 없는 `tei` 설정을 만들 수는 있지만 사용 시점에 실패한다.

### API 키를 AES-256-GCM 으로 암호화하는 이유

모델 설정의 API 키는 저장할 때 AES-256-GCM 으로 암호화한다. 새 암호화 경로를 만들지 않고 기존 `encrypt`/`decrypt` 유틸리티를 재사용하려는 AI 제품 요구사항의 기술 결정이다. 비기능 요구 NF-AI-04 도 API 키 저장 시 암호화를 필수로 둔다. 암호화 키 환경 변수와 복호화 시점은 [LLM 클라이언트](CLE-AI-LLM.md) 와 [LLM 사용량 기록](CLE-AI-USAGE.md) 에서 정한다.

### max_tokens 기본값을 4096 으로 둔 이유

예전 스펙은 `max_tokens` 기본값을 2048 로 적었지만 구현에 적용된 적이 없다. 옛 `/llm-configs` 폼과 지금의 `/models` 폼(`ModelConfigManager`) 모두 처음부터 4096 을 기본값으로 썼다. 코드가 먼저 4096 으로 자리 잡고 스펙 표기만 낡아 있었으므로 스펙을 실제 동작에 맞췄다. 요즘 LLM 은 4096 출력 토큰을 안전하게 지원하므로 잘림을 덜 겪고 쓰기에 더 실용적이다. AI 에이전트 노드 설정 예시의 `maxTokens` 도 4096 으로 맞췄다. 노드 `maxTokens` 의 기본값은 모델 설정 기본값이므로 기본 파라미터 표를 따른다.

### 연결 테스트와 미리보기를 편집자 이상으로 막는 이유

`POST :id/test`·`POST preview-models` 는 HTTP POST 지만 DB 를 바꾸지 않는 동작 호출 POST 다. 권한 매트릭스의 모델 설정 행은 편집자=CRUD, 뷰어=R(읽기 전용)이다. 이 두 엔드포인트는 다음 이유로 읽기가 아니라 변경과 같은 급(편집자 이상)으로 본다.

- **과금 프로바이더 호출**: 두 엔드포인트 모두 외부 LLM·임베딩 프로바이더를 실제로 불러 비용과 rate limit 을 쓴다. `:id/test` 는 Embedding 차원을 감지하면 `ModelConfig.dimension` 을 자동 저장(PATCH)하는 부수 효과도 있다. 이 PATCH 가 편집자 이상 변경이므로 호출 진입도 편집자 이상으로 맞춘다.
- **미리보기와의 대칭**: `preview-models` 는 원래부터 `@Roles('editor')` 로 막혀 있었다. 같은 성격의 과금 동작 호출 POST 인 `:id/test` 만 막혀 있지 않던 인가 틈을 없앤다.
- **바뀐 동작의 범위**: 예전 `:id/test` 는 `@Roles` 가 없어 뷰어를 포함한 워크스페이스 멤버 모두가 부를 수 있었다. 이제 뷰어가 직접 부르면 403 이다. 연결 테스트 버튼은 모델 설정 추가·수정 폼(편집자 이상 화면) 안에 있어 뷰어가 UI 로 닿는 경로는 사실상 없다. 실제로 바뀐 것은 직접 API 호출 틈을 막은 것이다. 동작을 유지하는 모듈 정리 리팩터링에서는 일부러 빼고 후속 변경으로 따로 냈다.
- **`:id/models` 는 뷰어 이상 유지**: 모델 목록 조회(GET)는 읽기에 해당하므로 뷰어 이상을 그대로 둔다. 인가 매트릭스를 좁히지 않는다.
