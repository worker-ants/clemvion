---
id: config
status: partial
pending_plans:
  - plan/in-progress/spec-sync-config-gaps.md
  - plan/in-progress/unified-model-management.md
code:
  - codebase/frontend/src/app/(main)/authentication/page.tsx
  - codebase/frontend/src/app/(main)/llm-configs/page.tsx
  - codebase/frontend/src/app/(main)/rerank-configs/page.tsx
  - codebase/frontend/src/components/llm-config/**
  - codebase/frontend/src/lib/api/rerank-configs.ts
  - codebase/frontend/src/lib/api/llm-configs.ts
  - codebase/backend/src/modules/auth-configs/**
  - codebase/backend/src/modules/llm-config/**
  - codebase/backend/src/modules/rerank-config/**
  - codebase/backend/src/modules/llm/llm-preview.service.ts
---

# Spec: 설정 (인증, Models) 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#36-authentication-인증-설정) · [PRD 내비게이션](./_product-overview.md#37-config--llm-llm-설정) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - AuthConfig](../1-data-model.md#217-authconfig) · [데이터 모델 - ModelConfig](../1-data-model.md#216-modelconfig)

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

> **구현 현황**: 백엔드 DTO (`auth-configs/dto/create-auth-config.dto.ts`, `update-auth-config.dto.ts`) 는 `ipWhitelist` 와 api_key `headerName` 을 지원하나, 프런트 폼 (`authentication/page.tsx`) 에는 **IP Whitelist 입력 UI** 와 **API Key Header 이름 입력 필드**가 아직 없다 (미구현 / Planned). 현재 생성 폼은 hmac (header/algorithm) · basic_auth (username/password) 추가 입력만 노출한다.

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
| 기간별 호출 수 | 일/주/월 기준 호출 횟수 | 🚧 미구현 (Planned). 현재 `getUsage` 는 누적 `totalCalls` 만 반환하고 기간 분해는 없다 |
| 호출 이력 테이블 | 대상 트리거명, 상태, 시각 (최근 20건) | ✅ (단, **소스 IP·응답 코드 컬럼은 미구현 / Planned**). 현재 `recentCalls` 는 `triggerName` / `status` / `startedAt` 만 반환하며, UI 테이블도 트리거 / 상태 / 시각 3컬럼만 노출한다 |

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

#### 권한

Owner / Admin → Reveal 버튼 노출 + 호출 가능. Editor / Viewer → 버튼 미노출, API 직접 호출 시 403 `FORBIDDEN`. ([Spec 인증 §3.2](../5-system/1-auth.md#3-인가-authorization).)

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

- "**Test Connection**" 버튼
- 간단한 API 호출 (예: 모델 목록 조회)로 연결 확인
- 성공: "Connected" 표시
- 실패: 에러 메시지 표시 (인증 실패, 네트워크 오류 등)

### B.4 모델 파라미터 기본값

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| temperature | 응답 창의성/무작위성 | 0.7 |
| max_tokens | 최대 출력 토큰 수 | 2048 |
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
| 차원(dimension) | 선택 모델의 벡터 차원 (예: 1536/3072). **ModelConfig.dimension = SoT** — KB 가 이 모델로 임베딩하면 `KnowledgeBase.embedding_dimension`(파생 캐시)에 고정된다 |
| 기본 임베딩 설정 | ⭐ 표시. KB `embedding_model_config_id` 미지정 시 기본 선택 |

- **차원 변경 가드**: 이미 벡터가 적재된 KB 가 참조하는 embedding 모델의 차원은 사후 변경 불가(pgvector 컬럼 차원 결합). 재임베딩 정책은 [`kb-model-change-reembed-followup`](../../plan/in-progress/kb-model-change-reembed-followup.md) 을 따른다.
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

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/auth-configs | 인증 설정 목록 (쿼리: page, limit, sort, order, search). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/auth-configs | 인증 설정 생성 |
| GET | /api/auth-configs/:id | 상세 조회 |
| PATCH | /api/auth-configs/:id | 수정 |
| POST | /api/auth-configs/:id/regenerate | 키/토큰 재생성 (신규 값 1회 평문 응답) |
| POST | /api/auth-configs/:id/reveal | 평문 config 1회 노출. `:id` (UUID). body `{ password }`. Admin+. audit_log 기록 (§A.4) |
| DELETE | /api/auth-configs/:id | 삭제 |
| GET | /api/auth-configs/:id/usage | 사용량/이력 조회 |

### Model Config API

chat / embedding / rerank 를 단일 엔드포인트에서 `kind` 로 구분 관리한다. mutation (POST / PATCH / DELETE) 은 Editor+ ([Spec 인증 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스)). 조회는 Viewer 이상.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/model-configs?kind=chat\|embedding\|rerank | 모델 목록 (쿼리: kind, page, limit, sort, order, search). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/model-configs | 모델 추가 (body 에 `kind`) |
| GET | /api/model-configs/:id | 상세 조회 |
| PATCH | /api/model-configs/:id | 수정 |
| PATCH | /api/model-configs/:id/set-default | kind 별 기본 설정. **동일 `(workspace_id, kind)` 내 기존 `is_default` 를 false 로 초기화 후 대상만 true** (kind 범위 한정) |
| POST | /api/model-configs/:id/test | 연결 테스트 (chat/embedding 만 — rerank 미제공) |
| POST | /api/model-configs/preview-models | 저장 전 폼 자격증명으로 모델 목록 미리보기 (chat/embedding) |
| GET | /api/model-configs/:id/models | 사용 가능한 모델 목록 조회 (chat/embedding) |
| DELETE | /api/model-configs/:id | 삭제 |

> **Deprecation**: 구 `/api/llm-configs`·`/api/rerank-configs` (및 서브경로 `:id/test`·`preview-models`·`:id/models`·`:id/set-default`) 는 한시적 alias 로 유지되며, [`unified-model-management`](../../plan/in-progress/unified-model-management.md) **PR4 에서 제거**한다. 프론트 라우트 `/llm-configs`·`/rerank-configs` 는 `/models` 로 redirect (북마크 보존).

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

### R-3 (번복) — ModelConfig 단일 화면 통합

**이전 결정(폐기)**: 리랭커는 전용 `/rerank` 엔드포인트로 chat/embedding 과 API shape 가 달라 LLMConfig 와 분리된 sibling 리소스(`RerankConfig`)로 두었다. 임베딩은 KB 가 chat용 LLMConfig 를 빌려 쓰는 piggyback 이었다.

**번복 결정**: chat/embedding/rerank 를 단일 `ModelConfig`(kind 판별) + 단일 `/models` 화면(탭)으로 통합한다.

- **번복 근거**: sibling 분리의 명분이던 인프라(API Key 마스킹·SSRF 가드·secret-store transformer)는 처음부터 공유됐고, API shape 차이는 **실행 레이어 팩토리**(`RerankClientFactory`)에 이미 격리돼 있었다. 설정 테이블을 쪼갠 결과는 CRUD·DTO·컨트롤러·프론트 페이지·i18n 의 통째 중복과 **설정 화면 3곳 분산**(LLM/Rerank + KB 내 임베딩) 뿐이었다. `kind` 판별자로 shape 차이를 흡수하면 관리 포인트(테이블 2+piggyback→1, 화면 3→1)가 실제로 제거된다. 엔티티 통합 근거의 단일 진실은 [데이터 모델 §2.16 Rationale](../1-data-model.md#216-modelconfig).
- **임베딩 1급화**: embedding 은 `dimension`(pgvector 차원 결합) 이라는 고유 불변속성을 가지므로 chat row piggyback 이 아니라 `kind=embedding` 1급 row 가 소유한다. provider 클라이언트는 기존 embed 경로(openai/azure/google/local) 재사용 — 신규 provider 추가 아님.
- **유지되는 것**: rerank 호출 계약(전용 `/rerank`, [Spec LLM Client §4](../5-system/7-llm-client.md))·연결 테스트 미제공(표준 model-list API 부재)·provider 1차 tei/cohere 는 그대로다. 통합된 것은 **설정 테이블·화면**이지 실행 레이어가 아니다.
- **API 응답 schema**: `/api/model-configs` 응답 shape 은 kind 무관 동형(마스킹된 `apiKey` 포함).

### R-4. cohere Base URL — UI 미노출 + API optional override

§C.2 의 종전 서술("`cohere` 는 Base URL 을 받지 않는다 — 공식 endpoint 고정")은 UI 폼 기준으로만 맞고 API 계약과 불일치했다. 실제 생성/수정 API 는 `baseUrl` 을 provider 무관 optional 로 받으며(미지정 시 공식 endpoint), cohere-호환 게이트웨이/프록시 경유 같은 운영 시나리오를 허용한다. 단 외부 provider 의 `baseUrl` 로는 복호화된 Bearer 키가 전송되므로 사설망/loopback 주소는 SSRF 가드로 차단한다 (400 `RERANK_CONFIG_INVALID`; `tei`/local 만 예외 — [LLM Client §5.5](../5-system/7-llm-client.md) 가드 재사용). UI 폼은 일반 사용자의 혼란을 줄이기 위해 `cohere` 선택 시 Base URL 입력을 노출하지 않는다. 같은 맥락에서 `tei` 의 "Base URL 필수" 도 생성 API 의 DTO 검증이 아니라 frontend 폼 검증 + rerank client 사용 시점에 강제된다 — API 단독 호출로 Base URL 없는 tei config 를 만들 수 있으나 사용 시점에 실패한다.
