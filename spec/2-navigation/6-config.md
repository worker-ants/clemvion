---
id: config
status: implemented
code:
  - codebase/frontend/src/app/(main)/authentication/**
  - codebase/frontend/src/app/(main)/models/page.tsx
  - codebase/frontend/src/components/models/model-config-manager.tsx
  - codebase/frontend/src/lib/api/model-configs.ts
  - codebase/backend/src/modules/auth-configs/**
  - codebase/backend/src/modules/model-config/**
  - codebase/backend/src/modules/llm/llm-preview.service.ts
---

# Spec: 설정 (인증, Models) 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#36-authentication-인증-설정) · [PRD 내비게이션](./_product-overview.md#37-config--models-모델-설정) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - AuthConfig](../1-data-model.md#217-authconfig) · [데이터 모델 - ModelConfig](../1-data-model.md#216-modelconfig)

---

## Overview (제품 정의)

워크스페이스 단위의 공용 연결 설정을 관리하는 화면 묶음이다 — 외부 시스템이 본 제품을 호출할 때의 인증 방식(Part A: AuthConfig)과, 워크플로·KB 가 사용할 AI 모델 연결(Part B: Models — Chat/Embedding/Rerank 를 `kind` 로 구분하는 단일 ModelConfig). 워크플로 편집 중 매번 자격증명을 입력하는 대신 여기서 한 번 등록한 config 를 노드·KB 가 참조한다.

---

## Part A: Authentication (인증 설정)

외부 시스템이 본 제품의 트리거/API를 호출할 때 사용하는 인증 방식을 관리한다.

### A.1 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Config > Authentication              [+ Add Auth Method]    │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🔑 Production API Key       API Key     Active       ⋮  ││
│  │    Last used: 2 hours ago                                ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ 🔑 Staging Token            Bearer      Active       ⋮  ││
│  │    Last used: 1 day ago                                  ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ 🔑 Legacy Basic Auth        Basic Auth  Inactive     ⋮  ││
│  │    Last used: 30 days ago                                ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### A.2 인증 방식별 설정

type 별 `config` 스키마·자동 발급 규칙의 단일 진실은 [Spec 데이터 모델 §2.17.1](../1-data-model.md#2171-config-의-jsonb-스키마). IP Whitelist 는 모든 type 공통 (선택) 필드다.

> **구현 현황**: 백엔드 DTO (`auth-configs/dto/create-auth-config.dto.ts`, `update-auth-config.dto.ts`) 는 `ipWhitelist` 와 api_key `headerName` 을 지원하며, 생성 폼 (`authentication/page.tsx`) 도 **IP Whitelist 입력 UI**(모든 type 공통, 한 줄에 IP/CIDR 하나)와 **API Key Header 이름 입력 필드**(api_key, default `X-API-Key`)를 노출한다 (✅ 구현). hmac (header/algorithm) · basic_auth (username/password) 추가 입력도 함께 노출한다. **편집 폼**(✅ 구현): 동일 화면에서 행별 편집 버튼 → `PATCH /auth-configs/:id` 로 name · IP Whitelist · 비-비밀 config(api_key `headerName`, hmac `header`/`algorithm`, basic_auth `username`)를 수정한다. type 과 비밀값은 편집 불가 — 비밀 변경은 재생성(§A.4 regenerate) 경로로 일원화하며, 편집 PATCH 는 config 를 shallow-merge 해 암호화 비밀값을 보존한다 (R-2 참조).

#### API Key

| 필드 | 설명 |
|------|------|
| 이름 | 인증 설정 이름 |
| API Key | 자동 생성 (`wfk_<hex24>`, 표시: 마스킹). 복사 버튼은 **마스킹 문자열** 복사 — 평문 복사는 생성 직후 1회 또는 Reveal 흐름 (§A.4) |
| Header 이름 | 검증에 사용할 헤더명 (default `X-API-Key`) |
| Key 재생성 | 기존 키 폐기 후 새 키 생성 (확인 필요) |
| IP Whitelist | 허용 IP 목록 (선택) |

#### Bearer Token

| 필드 | 설명 |
|------|------|
| 이름 | 인증 설정 이름 |
| Token | 자동 생성 (`wft_<hex32>`, 표시: 마스킹). 사용자 입력은 받지 않음 (Rationale) |
| Token 재생성 | 기존 토큰 폐기 후 새 토큰 생성 (확인 필요) |
| IP Whitelist | 허용 IP 목록 (선택) |

#### Basic Auth

| 필드 | 설명 |
|------|------|
| 이름 | 인증 설정 이름 |
| Username | 사용자 이름 (사용자 입력, 응답에 평문 노출 — 식별 보조) |
| Password | 비밀번호 (사용자 입력, masked input). 저장 후 응답에는 `***<last4>` 마스킹 — 평문 재확인은 Reveal 흐름 (§A.4) |
| IP Whitelist | 허용 IP 목록 (선택) |

#### HMAC

| 필드 | 설명 |
|------|------|
| 이름 | 인증 설정 이름 |
| Secret | 자동 생성 (`whs_<hex32>`, 표시: 마스킹, 재생성 가능) |
| Header | 서명을 담는 헤더명 (default `X-Hub-Signature-256`). 외부 provider 와 맞춤 (GitHub `X-Hub-Signature-256`, Stripe `Stripe-Signature` 등) |
| Algorithm | select: `sha256` / `sha512`. 다른 값은 보안상 미지원 |
| IP Whitelist | 허용 IP 목록 (선택) |

### A.3 인증 사용량/이력

| 항목 | 설명 | 구현 |
|------|------|------|
| 최근 호출 시각 | 마지막 사용 시각 (`last_used_at`, webhook 인증 성공 시 갱신) | ✅ `lastUsedAt` |
| 총 호출 수 | 해당 인증에 연결된 트리거의 누적 실행 수 (`totalCalls`) | ✅ |
| 기간별 호출 수 | 롤링 윈도(최근 24h / 7d / 30d) 기준 호출 횟수 | ✅ `periodCounts { last24h, last7d, last30d }`. `Execution.started_at` 을 단일 쿼리에서 조건부 집계(`COUNT(*) FILTER`)한다. UI 는 막대 차트(recharts BarChart)로 표시. 캘린더 버킷(일/주/월 경계)이 아닌 호출 시점 기준 롤링 윈도 (R-6) |
| 호출 이력 테이블 | 대상 트리거명, 상태, **소스 IP**, **응답 코드**, 시각 (최근 20건) | ✅ `recentCalls` 가 `triggerName` / `status` / `sourceIp` / `responseCode` / `startedAt` 반환. **소스 IP**(`Execution.source_ip`): webhook/chat-channel 발화 시 `extractClientIp` 결과를 영속, 캡처 안 된 호출(비-HTTP 트리거)은 null → UI 는 `—`. **응답 코드**(`Execution.response_code`): webhook 은 실제 HTTP 코드(성공 = `202`), 비-HTTP 트리거는 저장된 코드가 없어 워크플로 `status` enum 으로 폴백 표시 (R-6, WH-MG-05) |

### A.4 마스킹과 Reveal 흐름

#### 마스킹 표시 규칙

응답에서 `config.key` / `token` / `secret` / `password` 는 항상 `***<last4>` (예: `wft_***c8a1`). `headerName` / `header` / `algorithm` / `username` 은 평문. 규칙의 단일 진실은 [Spec 데이터 모델 §2.17.2](../1-data-model.md#2172-마스킹노출-정책).

#### Reveal 흐름

```
1. 카드 ⋮ 메뉴 → "Reveal" 클릭 (Admin+ 만 노출).
2. 현재 로그인 비밀번호 재확인 다이얼로그.
3. POST /api/auth-configs/:id/reveal { password }
   - 통과: 200 + config 평문 전체 (1회).
   - 실패: 401 (잘못된 password) / 403 (Editor·Viewer).
4. UI: 평문 표시 + "Copy" 버튼 + 30초 후 자동 hide.
5. audit_log 에 action='auth_config.reveal' 기록.
```

> 평문 자동 hide 정책은 create / regenerate 의 1회 노출에도 동일 적용된다 — 생성·재생성 직후 표시된 평문 키도 **30초 후 자동으로 비워**(언마운트 시 타이머 정리) 화면 방치 시 노출 시간을 제한한다.

#### 권한

목록의 **모든 변경 액션 버튼 — Add Config(헤더) · 활성 토글(Activate/Deactivate) · Reveal · Edit · Regenerate · Delete — 은 Admin+ 에만 UI 노출**된다. Editor / Viewer 는 마스킹된 목록 · 상세 · 사용량(읽기)만 보며, 변경 액션 버튼은 미노출 + API 직접 호출 시 403 `FORBIDDEN`. 목록 행 클릭(사용량 드로어 = 읽기)은 전 역할 허용이라 가드하지 않는다. 근거: [Spec 인증 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스) (Auth Config: Owner/Admin = CRUD, Editor/Viewer = R). UI 가드는 일관성·403 혼란 방지용이며 실제 인가는 백엔드 `@Roles('admin')` 가 fail-closed 로 강제한다(이중 방어). `useHasRole("admin")` 는 `ROLE_LEVEL` ≥ 비교라 Owner(상위 레벨)도 포함한다.

---

## Part B: Models (모델 설정)

워크스페이스가 사용하는 모든 AI 모델 — **Chat**(AI 노드 LLM), **Embedding**(KB 임베딩), **Rerank**(KB 검색 후처리) — 을 **단일 화면의 탭**으로 통합 관리한다. 셋은 모두 `kind` 로 구분되는 ModelConfig 리소스이며([데이터 모델 §2.16](../1-data-model.md#216-modelconfig)), provider 자격증명·API Key 마스킹·SSRF 가드를 공유한다. (구 분리 화면 `LLM`/`Rerank` + KB 상세 내 임베딩 선택을 본 화면으로 통합 — [Rationale R-3](#r-3-번복--modelconfig-단일-화면-통합).)

### B.1 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Config > Models       [Chat] [Embedding] [Rerank]           │
│                                          [+ Add Model]       │
│  (선택된 탭의 kind 목록을 카드로 표시. ⭐ = 해당 kind 기본)  │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ⭐ OpenAI                         Connected          ⋮  ││
│  │    Default: gpt-4o · Temperature: 0.7                    ││
│  ├──────────────────────────────────────────────────────────┤│
│  │    Anthropic                       Connected          ⋮  ││
│  │    Default: claude-sonnet-4-6 · Temperature: 0.5       ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

탭 전환 시 해당 `kind` 의 ModelConfig 목록을 보여주고, `[+ Add Model]` 은 현재 탭의 kind 로 생성한다. `⭐` 기본 지정은 **`(workspace, kind)` 당 1개**.

### B.2 Chat 탭 — 프로바이더 추가/수정

| 필드 | 설명 |
|------|------|
| 프로바이더 유형 | 드롭다운: OpenAI, Anthropic, Google AI, Azure OpenAI, Local(Ollama/vLLM 등) |
| 이름 | 사용자 지정 별칭 |
| API Key | 프로바이더별 API 키 (마스킹 입력) |
| Base URL | 커스텀 엔드포인트 (로컬 모델, Azure 등) |
| 기본 모델 | "모델 불러오기" 버튼으로 프로바이더 모델 조회 API 를 실시간 호출한 뒤, 응답 목록에서 select 로 선택. 자유 텍스트 입력은 허용하지 않는다 |
| 기본 파라미터 | Temperature, Max Tokens, Top-P 등 |
| 기본 프로바이더 설정 | ⭐ 아이콘으로 표시. AI 노드 생성 시 기본 선택 |

#### 기본 모델 선택 UX

- **생성 플로우**: 프로바이더·API Key(로컬은 선택)·Base URL(Azure/Local 필수)을 입력한 뒤 "모델 불러오기" 버튼을 누르면 프로바이더 API(`listModels`)로 실시간 조회해 select 옵션으로 노출한다. API Key는 저장되지 않으며 요청 범위에서만 사용된다. 모델을 한 번도 불러오지 않은 상태에서는 select 가 비활성이고, 저장 버튼은 사용자가 옵션을 선택해야 활성화된다.
- **수정 플로우**: API Key를 비워둔 경우 DB에 저장된 암호화 키로 기존 `/api/model-configs/:id/models`를 호출하고, API Key를 재입력한 경우 미리보기 엔드포인트를 사용한다. 기존에 저장된 모델 ID 가 새로 불러온 목록에 없을 경우 "현재 저장값: <id>" 형태로 placeholder option 을 함께 노출해 사용자가 변경 의사 없이 다른 필드만 수정할 수 있도록 보존한다.
- **목록 필터**: 응답 중 `type === 'chat'` 모델만 노출한다 (임베딩 모델은 제외).
- **프로바이더별 구현**: OpenAI·Anthropic·Google·Azure·Local 모두 프로바이더 공식 모델 조회 API를 실시간 호출한다 (preview·신모델을 포함한 최신 목록 제공).
- **조회 실패**: select 는 비활성으로 두고 에러 메시지(프로바이더 에러 sanitize 결과)만 표시한다. 자유 입력 fallback 은 제공하지 않는다 — 잘못된 모델 ID 가 그대로 저장되어 런타임 호출 실패로 이어지는 사례를 차단하기 위함. 사용자는 자격증명·Base URL 을 재확인한 뒤 다시 "모델 불러오기" 를 시도한다.

### B.3 프로바이더 연결 테스트

- "**Test Connection**" 버튼 (chat·embedding 탭. rerank 미제공 — §B.6.2)
- **chat**: 간단한 API 호출(모델 목록 조회 등)로 연결 확인
- **embedding**: 실제 probe embed(`client.embed(['connection test'], defaultModel)`)로 연결·모델 유효성을 동시 검증하고, 반환 벡터 길이를 `dimension` 으로 감지한다 ([LLM Client §8.3](../5-system/7-llm-client.md#83-서비스-레이어))
- 성공: "Connected" 표시 (embedding 은 감지 차원도 함께 안내)
- 실패: 에러 메시지 표시 (인증 실패, 네트워크 오류 등)

**Embedding 차원 자동 감지·저장** — embedding 연결 테스트가 차원을 감지하면, 그 값을 `PATCH /api/model-configs/:id { dimension }` 로 즉시 자동 저장한다(기존 `ModelConfig.dimension` 과 다를 때만). 자동 저장이 실패(권한 등)해도 연결 성공 표시는 유지한다(best-effort). 저장 대상은 **`ModelConfig.dimension`(모델 출력 차원 SoT)** 이며, KB 의 `KnowledgeBase.embedding_dimension`(파생 캐시)에는 쓰지 않는다 — 후자는 실제 적재 경로가 채우고 KB 폼의 "임베딩 테스트"는 read-only 다([지식 저장소 생성 폼](./5-knowledge-base.md#22-컬렉션-생성), [RAG 검색 §5](../5-system/9-rag-search.md#5-임베딩-모델-일관성)). 두 probe 는 대상 필드가 달라 상보 관계다. 서버는 `ModelConfigService.findEntity`(kind 무관)로 설정을 조회한다(구 chat 고정 경로 대체 — embedding 설정 연결 테스트 회귀 해소).

### B.4 모델 파라미터 기본값

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| temperature | 응답 창의성/무작위성 | 0.7 |
| max_tokens | 최대 출력 토큰 수 | 4096 |
| top_p | 누적 확률 기반 샘플링 | 1.0 |
| frequency_penalty | 반복 토큰 억제 | 0.0 |
| presence_penalty | 새 토큰 유도 | 0.0 |

> **참고**: AI 노드에서 개별적으로 오버라이드 가능. 여기서 설정하는 값은 기본값.

### B.5 Embedding 탭 — 임베딩 모델 추가/수정

KB 임베딩에 사용할 임베딩 모델(`kind=embedding`)을 관리한다. KB 생성/수정 폼의 "Embedding model" select 가 이 목록에서 선택한다 ([Spec Knowledge Base §2.2](./5-knowledge-base.md#22-컬렉션-생성), [Spec 임베딩 파이프라인](../5-system/8-embedding-pipeline.md)).

| 필드 | 설명 |
|------|------|
| 프로바이더 유형 | 드롭다운: OpenAI, Azure OpenAI, Google AI, Local(Ollama/vLLM/TEI 등). **Anthropic 미지원**(embedding 부재) |
| 이름 | 사용자 지정 별칭 |
| API Key | provider 별 API 키 (마스킹 입력). 자가호스팅(local) 은 선택 |
| Base URL | 커스텀 endpoint (Azure/Local 필수, SSRF 가드) |
| 기본 모델 | "모델 불러오기" 로 provider 모델 조회 후 select. **`type === 'embedding'` 모델만 노출** (chat 모델 제외 — Chat 탭의 역필터) |
| 차원(dimension) | 임베딩 모델의 벡터 차원 (예: 1536/3072). **연결 테스트(probe embed)로 자동 감지·저장**된다(§B.3). 저장된 값이 있으면 폼에서 read-only 로 표시하고, 아직 감지 전(신규 생성·미테스트)에는 수동 입력 폴백을 허용한다(코드 SoT: read-only ⇔ `editConfig.dimension != null`). **ModelConfig.dimension = SoT** — KB 가 이 모델로 임베딩하면 `KnowledgeBase.embedding_dimension`(파생 캐시)에 고정된다 |
| 기본 임베딩 설정 | ⭐ 표시. KB `embedding_model_config_id` 미지정 시 기본 선택 |

- **차원 변경 가드**: 이미 벡터가 적재된 KB 가 참조하는 embedding 모델의 차원은 사후 변경 불가(pgvector 컬럼 차원 결합). 임베딩 설정 변경 시 `embedding_dimension` 이 NULL 로 초기화되고, 상세 화면의 검색 불가 배너 + "지금 재임베딩" CTA([지식 저장소 §2.4.1·R-3](./5-knowledge-base.md#r-3-상세-상단에-검색-불가-배너--지금-재임베딩-cta-를-둔-이유))로 재임베딩을 유도한다(근본원인 후속 [`kb-model-change-reembed-followup`](../../plan/complete/kb-model-change-reembed-followup.md) 의 옵션 ③ 채택).
- **모델 선택 UX**: Chat 탭과 동일한 select-only 정책(자유 입력 fallback 없음, [Rationale R-1](#r-1-기본-모델-선택을-select-only-로-한정)).

### B.6 Rerank 탭 — 리랭커 추가/수정

KB 검색 후처리(리랭킹)에 사용할 리랭커 provider 와 모델(`kind=rerank`)을 관리한다. KB 폼의 "Reranker" select 가 이 목록에서 선택한다 ([Spec Knowledge Base §2.2](./5-knowledge-base.md#22-컬렉션-생성), [Spec RAG 검색 §3.3](../5-system/9-rag-search.md#33-검색-후처리--리랭킹-선택적)). 엔티티: [데이터 모델 §2.16](../1-data-model.md#216-modelconfig).

#### B.6.1 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Config > Models > Rerank 탭            [+ Add Model]        │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ⭐ Self-hosted TEI                  Connected         ⋮  ││
│  │    Default: dragonkue/bge-reranker-v2-m3-ko             ││
│  │    http://tei:8080                                       ││
│  ├──────────────────────────────────────────────────────────┤│
│  │    Cohere                           Connected         ⋮  ││
│  │    Default: rerank-3.5                                   ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

#### B.6.2 리랭커 추가/수정

| 필드 | 설명 |
|------|------|
| 프로바이더 유형 | 드롭다운: `tei` (자가호스팅 HF Text-Embeddings-Inference), `cohere` (외부 API) |
| 이름 | 사용자 지정 별칭 |
| API Key | provider 별 API 키 (마스킹 입력). **`cohere` 등 외부 provider 필수**, `tei` 는 선택 |
| Base URL | 자가호스팅 endpoint. **`tei` 필수** — 단 강제 지점은 폼 검증 + rerank client 사용 시점이며 생성 API(POST) 시점에는 검증하지 않는다. `cohere` 는 UI 폼에서 미노출, API 레벨에서는 optional override 허용 (미지정 시 provider 공식 endpoint — R-4). `tei` 외 provider 의 사설망/loopback baseUrl 은 SSRF 가드로 400 `RERANK_CONFIG_INVALID` ([LLM Client §5.5](../5-system/7-llm-client.md)) |
| 기본 모델 | 기본 리랭커 모델 ID 자유 입력 (예: `dragonkue/bge-reranker-v2-m3-ko`, `bge-reranker-v2-m3`, `rerank-3.5`). 리랭커 provider 는 표준 model-list API 가 없어 Chat/Embedding 탭과 달리 자유 입력 |
| 기본 리랭커 설정 | ⭐ 아이콘으로 표시. KB `rerank_config_id` 미지정 시 기본 선택 |

- **provider 별 필수 필드**: `tei` 는 자가호스팅이므로 Base URL 이 필수이고 API Key 는 선택이다. `cohere` 는 외부 API 이므로 API Key 가 필수이며, Base URL 은 UI 폼에서 노출하지 않되 API 레벨에서는 optional override 를 허용한다 (미지정 시 provider 공식 endpoint — R-4). `tei` 의 Base URL 필수는 frontend 폼 검증과 rerank client 사용 시점에 강제되며, 생성 API 자체는 이를 검증하지 않는다.
- **마스킹**: 저장 후 응답에서 `api_key` 는 항상 마스킹된다 (Chat/Embedding 탭과 동일 정책 — kind 무관 공유 인프라).
- **연결 테스트 미제공**: 리랭커는 표준 model-list/test API 가 없어 Chat/Embedding 탭과 달리 연결 테스트를 제공하지 않는다 ([Rationale R-3](#r-3-번복--modelconfig-단일-화면-통합)).

#### B.6.3 기본 리랭커 설정 (set-default)

⭐ 아이콘으로 워크스페이스 기본 리랭커를 지정한다. KB 가 `rerank_mode ≠ off` 이면서 `rerank_config_id` 를 지정하지 않은 경우 이 기본 리랭커가 사용되며, 기본 리랭커도 없으면 해당 KB 검색은 `off` 로 안전 강등된다 ([Spec RAG 검색 §6](../5-system/9-rag-search.md#6-에러-처리)).

---

## 3. API

### Authentication API

mutation (POST / PATCH / DELETE / regenerate / reveal) 은 **Admin+**, 조회 (GET 목록·상세·usage) 는 Viewer 이상 ([Spec 인증 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스); Auth Config = Owner/Admin CRUD, Editor/Viewer R). UI 도 변경 액션 버튼을 Admin+ 에만 노출한다 (§A.4 권한).

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/auth-configs | 인증 설정 목록 (쿼리: page, limit, sort, order, search). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/auth-configs | 인증 설정 생성 **(Admin+)** |
| GET | /api/auth-configs/:id | 상세 조회 |
| PATCH | /api/auth-configs/:id | 수정 (name·IP·비-비밀 config·활성 토글) **(Admin+)** |
| POST | /api/auth-configs/:id/regenerate | 키/토큰 재생성 (신규 값 1회 평문 응답) **(Admin+)** |
| POST | /api/auth-configs/:id/reveal | 평문 config 1회 노출. `:id` (UUID). body `{ password }`. **Admin+**. audit_log 기록 (§A.4) |
| DELETE | /api/auth-configs/:id | 삭제 **(Admin+)** |
| GET | /api/auth-configs/:id/usage | 사용량/이력 조회. 응답 `data`: `{ totalCalls, lastUsedAt, periodCounts: { last24h, last7d, last30d }, recentCalls: [{ id, triggerName, status, sourceIp, responseCode, startedAt }] }` (최근 20건). 집계 경로는 [데이터 모델 §2.13 AuthConfig 호출 집계](../1-data-model.md#213-execution) 참조 |

### Model Config API

chat / embedding / rerank 를 단일 엔드포인트에서 `kind` 로 구분 관리한다. mutation (POST / PATCH / DELETE) 은 Editor+ ([Spec 인증 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스)). 조회는 Viewer 이상.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/model-configs?kind=chat\|embedding\|rerank | 모델 목록 (쿼리: kind, page, limit, sort, order, search). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/model-configs | 모델 추가 (body 에 `kind`) |
| GET | /api/model-configs/:id | 상세 조회 |
| PATCH | /api/model-configs/:id | 수정 |
| PATCH | /api/model-configs/:id/set-default | kind 별 기본 설정. **동일 `(workspace_id, kind)` 내 기존 `is_default` 를 false 로 초기화 후 대상만 true** (kind 범위 한정) |
| POST | /api/model-configs/:id/test | 연결 테스트 (chat/embedding 만 — rerank 미제공). 응답 `data`: chat `{ success }`, embedding `{ success, dimension? }`(probe embed 감지 차원). 설정 조회는 kind 무관(`ModelConfigService.findEntity`) |
| POST | /api/model-configs/preview-models | 저장 전 폼 자격증명으로 모델 목록 미리보기 (chat/embedding) |
| GET | /api/model-configs/:id/models | 사용 가능한 모델 목록 조회 (chat/embedding) |
| DELETE | /api/model-configs/:id | 삭제 |

> **구 alias 제거 완료 (PR4)**: 종전 `/api/llm-configs`·`/api/rerank-configs` (및 서브경로 `:id/test`·`preview-models`·`:id/models`·`:id/set-default`) 한시 alias 와 프론트 redirect 라우트 `/llm-configs`·`/rerank-configs` 는 [`unified-model-management`](../../plan/complete/unified-model-management.md) **PR4 에서 제거**됐다. 모든 chat/embedding/rerank 설정은 위 `/api/model-configs` 단일 표면으로만 접근한다.

---

## Rationale

### R-1. 기본 모델 선택을 select-only 로 한정

잘못된 모델 ID (오타·프로바이더 측 deprecation 으로 사라진 ID) 가 저장되면 실제 호출 시점에 `LLM_MODEL_NOT_FOUND` 로 실패한다. 저장 시점에 자격증명·Base URL 로 실 호출이 가능한 모델만 선택할 수 있도록 강제하면 이 회귀가 구조적으로 차단된다.

- **동작**: §B.2 "기본 모델 선택 UX" 는 자유 입력 fallback 없이 `<select>` 만 제공한다. 모델 미로드 시 select 비활성. 조회 실패 시 자유 입력 없이 에러 메시지만 표시 (사용자는 자격증명 재확인 후 다시 시도).
- **편집 흐름 호환**: 기존에 저장된 모델 ID 가 새로 불러온 목록에 없을 경우 "현재 저장값: <id>" placeholder option 을 노출해, 사용자가 모델을 굳이 다시 선택하지 않아도 다른 필드(temperature 등) 만 수정 가능. 사용자가 명시적으로 다른 option 을 선택해야 모델이 바뀐다.
- **범위 한정**: 본 변경은 Config > Models (Chat 탭)의 `defaultModel` 필드에만 적용된다. AI 노드 (`spec/4-nodes/3-ai/1-ai-agent.md`) 설정 패널의 `model` 필드는 Expression (`{{ vars.model }}`) 허용이 그대로 유지된다 — 노드 model 은 동적 평가가 정상 흐름이며, defaultModel 이 가리키는 정합 검증이 별개 책임.
- **연관 spec**: `spec/5-system/7-llm-client.md §5.5 preview-models 엔드포인트` — preview 결과 빈/실패 응답 처리는 본 절의 select-only 정책을 따른다 (graceful degrade 미적용). `spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델` — 동일 결정을 임베딩 모델 선택에도 적용.

### R-2. AuthConfig 도메인 — Webhook 인증 wiring

`/authentication` (AuthConfig) 자격증명은 Webhook 수신 인증에 wiring 된다. 상세 근거는 [Spec Webhook Rationale "inline auth path 폐지"](../5-system/12-webhook.md#rationale) + [Spec 데이터 모델 §2.17.3](../1-data-model.md#2173-rationale-authconfig-도메인).

- **HMAC type**: API Key / Bearer / Basic Auth 에 더해 `hmac` 지원. Webhook HMAC 서명 검증을 trigger inline `config.secret` 대신 AuthConfig 로 흡수.
- **bearer_token 자동 발급 강제**: 사용자 입력 없이 자동 발급(`wft_<hex32>`)만 허용. 외부 호출자 발급 토큰은 제품이 충분한 엔트로피로 생성하는 게 일관적이며, 사용자 입력 토큰의 형식·엔트로피 검증 부담을 없앤다.
- **Bearer Token 만료 시간 필드 v1 제외**: 토큰 만료·자동 회전을 다루지 않는다 — JSONB 스키마 `{ token }` 와 정합. 만료/회전이 필요해지면 후속 결정으로 재도입.
- **항상 마스킹 + Reveal 엔드포인트** (§A.4): API 응답에서 secret 류는 항상 `***<last4>`. 평문은 create / regenerate / reveal 3 경로만. Reveal 은 Admin+ · 비밀번호 재확인 · audit 기록.
- **평문 30초 자동 hide 를 reveal 외 create/regenerate 1회 노출에도 동일 적용** (§A.4): 평문이 노출되는 3 경로(create·regenerate·reveal)는 동일한 보안 자산이므로 노출 시간 제한 정책을 단일화한다 — reveal 만 자동 hide 하고 create/regenerate 표시는 사용자가 닫을 때까지 무기한 남던 비대칭을 제거. 화면 방치 시 어깨너머·세션 탈취로 인한 평문 노출 창을 30초로 제한한다. 클라이언트 타이머는 `useEffect` cleanup 으로 언마운트·재노출 시 정리해 누수·stale clear 를 막는다.
- **편집 폼은 자동 발급·마스킹 정책을 동일 적용**: §A.2 편집(`PATCH`)은 name·IP·비-비밀 config 만 변경하고 비밀값 재입력은 받지 않는다 — 비밀 변경은 regenerate 단일 경로로 일원화. 백엔드 `update` 는 `config` 를 통째 대체하지 않고 shallow-merge 하며, 마스킹된 비밀값(`***<last4>`)이 역류해도 무시해 실 비밀이 파손되지 않게 한다. type 변경도 편집 폼에서 차단(타입 전환은 비밀 재발급을 수반 → 삭제 후 재생성).
- **변경 액션 버튼 전체를 Admin+ UI 가드로 통일** (§A.4 권한): Reveal 만 Admin+ 로 가드하던 비대칭을 제거하고 Add Config·활성 토글·Edit·Regenerate·Delete 까지 모든 mutation 버튼을 Admin+ 에만 노출한다. 인증 §3.2 매트릭스가 Auth Config 를 Owner/Admin = CRUD, Editor/Viewer = **R**(읽기전용)로 못박으므로 **활성(isActive) 토글도 Update 에 해당해 Admin+** 다 — "활성/비활성 전환은 단순 상태라 Editor 도 가능" 으로 새지 않도록 명시한다. 실제 인가는 백엔드 `@Roles('admin')` 가 fail-closed 로 강제(UI 가드는 권한상승 방지가 아니라 비-admin 에게 호출 시 403 이 날 버튼을 감춰 혼란을 없애는 일관성 장치)하며, `useHasRole("admin")` 의 `ROLE_LEVEL` ≥ 비교로 Owner 도 자동 포함된다.

### R-3 (번복) — ModelConfig 단일 화면 통합

**이전 결정(폐기)**: 리랭커는 전용 `/rerank` 엔드포인트로 chat/embedding 과 API shape 가 달라 LLMConfig 와 분리된 sibling 리소스(`RerankConfig`)로 두었다. 임베딩은 KB 가 chat용 LLMConfig 를 빌려 쓰는 piggyback 이었다.

**번복 결정**: chat/embedding/rerank 를 단일 `ModelConfig`(kind 판별) + 단일 `/models` 화면(탭)으로 통합한다.

- **번복 근거**: sibling 분리의 명분이던 인프라(API Key 마스킹·SSRF 가드·secret-store transformer)는 처음부터 공유됐고, API shape 차이는 **실행 레이어 팩토리**(`RerankClientFactory`)에 이미 격리돼 있었다. 설정 테이블을 쪼갠 결과는 CRUD·DTO·컨트롤러·프론트 페이지·i18n 의 통째 중복과 **설정 화면 3곳 분산**(LLM/Rerank + KB 내 임베딩) 뿐이었다. `kind` 판별자로 shape 차이를 흡수하면 관리 포인트(테이블 2+piggyback→1, 화면 3→1)가 실제로 제거된다. 엔티티 통합 근거의 단일 진실은 [데이터 모델 §2.16 Rationale](../1-data-model.md#216-modelconfig).
- **임베딩 1급화**: embedding 은 `dimension`(pgvector 차원 결합) 이라는 고유 불변속성을 가지므로 chat row piggyback 이 아니라 `kind=embedding` 1급 row 가 소유한다. provider 클라이언트는 기존 embed 경로(openai/azure/google/local) 재사용 — 신규 provider 추가 아님.
- **유지되는 것**: rerank 호출 계약(전용 `/rerank`, [Spec LLM Client §4](../5-system/7-llm-client.md))·연결 테스트 미제공(표준 model-list API 부재)·provider 1차 tei/cohere 는 그대로다. 통합된 것은 **설정 테이블·화면**이지 실행 레이어가 아니다.
- **API 응답 schema**: `/api/model-configs` 응답 shape 은 kind 무관 동형(마스킹된 `apiKey` 포함).

### R-4. cohere Base URL — UI 미노출 + API optional override

§B.6.2(구 §C.2) 의 종전 서술("`cohere` 는 Base URL 을 받지 않는다 — 공식 endpoint 고정")은 UI 폼 기준으로만 맞고 API 계약과 불일치했다. 실제 생성/수정 API 는 `baseUrl` 을 provider 무관 optional 로 받으며(미지정 시 공식 endpoint), cohere-호환 게이트웨이/프록시 경유 같은 운영 시나리오를 허용한다. 단 외부 provider 의 `baseUrl` 로는 복호화된 Bearer 키가 전송되므로 사설망/loopback 주소는 SSRF 가드로 차단한다 (400 `RERANK_CONFIG_INVALID`; `tei`/local 만 예외 — [LLM Client §5.5](../5-system/7-llm-client.md) 가드 재사용). UI 폼은 일반 사용자의 혼란을 줄이기 위해 `cohere` 선택 시 Base URL 입력을 노출하지 않는다. 같은 맥락에서 `tei` 의 "Base URL 필수" 도 생성 API 의 DTO 검증이 아니라 frontend 폼 검증 + rerank client 사용 시점에 강제된다 — API 단독 호출로 Base URL 없는 tei config 를 만들 수 있으나 사용 시점에 실패한다.

### R-5. max_tokens 기본값 4096 (구 spec 의 2048 정정)

§B.4 의 `max_tokens` 기본값을 2048 에서 4096 으로 정정한다. 구 spec 표기(2048)는 **구현에 한 번도 적용된 적이 없다** — PR3 이전의 구 `/llm-configs` 폼과 통합 `/models` 폼(`ModelConfigManager`) 모두 일관되게 4096 을 기본값으로 사용해 왔다. 즉 코드가 먼저 4096 으로 정착하고 spec 표기만 낡아 있던 SPEC-DRIFT 사례다. 현대 LLM 은 4096 출력 토큰을 안전하게 지원하므로 잘림(truncation) 체감이 적고 UX 상 더 실용적이다. 본 정정은 spec 을 실제 동작에 맞추며, AI Agent 노드 설정 패널 예시(`spec/4-nodes/3-ai/1-ai-agent.md`)의 `maxTokens` 예시값도 동일하게 4096 으로 동반 갱신해 spec 내부 정합을 유지한다 (노드 `maxTokens` 의 기본값은 "ModelConfig 기본값"이므로 §B.4 를 따른다).

### R-6. §A.3 호출 이력 — 소스 IP·응답 코드·기간별 호출 수 스키마 결정

§A.3 의 종전 "소스 IP·응답 코드 컬럼 미구현 / 기간별 호출 수 미구현(Planned)" 항목을 다음 결정으로 구현 승격한다.

- **저장 위치 = `Execution` 행에 컬럼 추가 (V096), 전용 call-log 엔티티 미도입.** AuthConfig 사용 집계는 이미 `Execution.trigger_id → Trigger.auth_config_id` 조인으로 `totalCalls`/`recentCalls` 를 산출한다 ([데이터 모델 §2.13](../1-data-model.md#213-execution)). 같은 행에 `source_ip VARCHAR(45)`·`response_code VARCHAR(10)`(둘 다 nullable) 를 추가하면 조인 1회로 끝나 가장 단순하다. Integration 이 전용 `IntegrationUsageLog` 를 두는 것과 달리 AuthConfig 는 호출 = 워크플로 실행이라 `Execution` 을 SoT 로 재사용한다(별도 로그의 이중기록·정합 부담 회피).
- **응답 코드 = "둘 다".** webhook(및 chat-channel inbound)은 호출이 받는 **실제 HTTP 코드**를 저장한다 — execution 생성에 성공한 경로는 항상 `202 Accepted`(인증 401·검증 400·비활성 410 은 execute 전에 throw 되어 Execution row 자체가 안 생긴다). schedule 등 비-HTTP 트리거는 HTTP 코드가 없어 `response_code` 가 NULL 이며, `getUsage` 가 워크플로 `status` enum 으로 폴백 표시한다. 이로써 [WH-MG-05](../5-system/12-webhook.md) "응답 코드 확인 필수" 를 이행한다.
- **기간별 호출 수 = 롤링 윈도(24h/7d/30d), 막대 차트.** 캘린더 버킷(일/주/월 경계) 대신 현재 시점 기준 롤링 윈도를 택했다 — "최근 활동량" 파악이 사용 내역 화면의 목적이고, 경계 정렬(타임존·주 시작 요일) 모호성을 피한다. `Execution.started_at` 을 단일 쿼리에서 조건부 집계(`COUNT(*) FILTER (WHERE started_at >= now()-window)`)해 round-trip 1회로 3종을 구한다. UI 는 recharts BarChart.
- **소스 IP 캡처 경로**: `hooks.service` 가 webhook 진입 시 `extractClientIp`(CF-Connecting-IP 신뢰 시 → X-Forwarded-For 첫 IP) 결과를 인증 IP whitelist 검증과 호출 이력 영속에 공용으로 쓴다. 추출 불가 시 NULL.
