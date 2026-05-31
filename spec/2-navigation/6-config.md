---
id: config
status: implemented
code:
  - codebase/frontend/src/app/(main)/authentication/page.tsx
  - codebase/frontend/src/app/(main)/llm-configs/page.tsx
  - codebase/frontend/src/components/llm-config/model-combobox.tsx
---

# Spec: 설정 (인증, LLM) 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#36-authentication-인증-설정) · [PRD 내비게이션](./_product-overview.md#37-config--llm-llm-설정) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - AuthConfig](../1-data-model.md#217-authconfig) · [데이터 모델 - LLMConfig](../1-data-model.md#216-llmconfig)

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

type 별 `config` 스키마·자동 발급 규칙의 단일 진실은 [Spec 데이터 모델 §2.17.1](../../1-data-model.md#2171-config-의-jsonb-스키마). IP Whitelist 는 모든 type 공통 (선택) 필드다.

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

| 항목 | 설명 |
|------|------|
| 최근 호출 시각 | 마지막 사용 시각 (`last_used_at`, webhook 인증 성공 시 갱신) |
| 기간별 호출 수 | 일/주/월 기준 호출 횟수 |
| 호출 이력 테이블 | 시각, 소스 IP, 대상 트리거, 응답 코드 |

### A.4 마스킹과 Reveal 흐름

#### 마스킹 표시 규칙

응답에서 `config.key` / `token` / `secret` / `password` 는 항상 `***<last4>` (예: `wft_***c8a1`). `headerName` / `header` / `algorithm` / `username` 은 평문. 규칙의 단일 진실은 [Spec 데이터 모델 §2.17.2](../../1-data-model.md#2172-마스킹노출-정책).

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

## Part B: LLM (LLM 설정)

AI 노드에서 사용할 LLM 프로바이더와 모델을 관리한다.

### B.1 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Config > LLM                          [+ Add Provider]      │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ⭐ OpenAI                         Connected          ⋮  ││
│  │    Default: gpt-4o · Temperature: 0.7                    ││
│  ├──────────────────────────────────────────────────────────┤│
│  │    Anthropic                       Connected          ⋮  ││
│  │    Default: claude-sonnet-4-6 · Temperature: 0.5       ││
│  ├──────────────────────────────────────────────────────────┤│
│  │    Local (Ollama)                  Connected          ⋮  ││
│  │    Default: llama3 · http://localhost:11434              ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### B.2 프로바이더 추가/수정

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
- **수정 플로우**: API Key를 비워둔 경우 DB에 저장된 암호화 키로 기존 `/llm-configs/:id/models`를 호출하고, API Key를 재입력한 경우 미리보기 엔드포인트를 사용한다. 기존에 저장된 모델 ID 가 새로 불러온 목록에 없을 경우 "현재 저장값: <id>" 형태로 placeholder option 을 함께 노출해 사용자가 변경 의사 없이 다른 필드만 수정할 수 있도록 보존한다.
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

### LLM Config API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/llm-configs | 프로바이더 목록 (쿼리: page, limit, sort, order, search). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/llm-configs | 프로바이더 추가 |
| GET | /api/llm-configs/:id | 상세 조회 |
| PATCH | /api/llm-configs/:id | 수정 |
| POST | /api/llm-configs/:id/test | 연결 테스트 |
| POST | /api/llm-configs/preview-models | 저장 전 폼 자격증명으로 모델 목록 미리보기 |
| PATCH | /api/llm-configs/:id/set-default | 기본 프로바이더 설정 |
| DELETE | /api/llm-configs/:id | 삭제 |
| GET | /api/llm-configs/:id/models | 사용 가능한 모델 목록 조회 |

---

## Rationale

### R-1. 기본 모델 선택을 select-only 로 한정

잘못된 모델 ID (오타·프로바이더 측 deprecation 으로 사라진 ID) 가 저장되면 실제 호출 시점에 `LLM_MODEL_NOT_FOUND` 로 실패한다. 저장 시점에 자격증명·Base URL 로 실 호출이 가능한 모델만 선택할 수 있도록 강제하면 이 회귀가 구조적으로 차단된다.

- **동작**: §B.2 "기본 모델 선택 UX" 는 자유 입력 fallback 없이 `<select>` 만 제공한다. 모델 미로드 시 select 비활성. 조회 실패 시 자유 입력 없이 에러 메시지만 표시 (사용자는 자격증명 재확인 후 다시 시도).
- **편집 흐름 호환**: 기존에 저장된 모델 ID 가 새로 불러온 목록에 없을 경우 "현재 저장값: <id>" placeholder option 을 노출해, 사용자가 모델을 굳이 다시 선택하지 않아도 다른 필드(temperature 등) 만 수정 가능. 사용자가 명시적으로 다른 option 을 선택해야 모델이 바뀐다.
- **범위 한정**: 본 변경은 `/llm-configs` 화면의 `defaultModel` 필드에만 적용된다. AI 노드 (`spec/4-nodes/3-ai/1-ai-agent.md`) 설정 패널의 `model` 필드는 Expression (`{{ vars.model }}`) 허용이 그대로 유지된다 — 노드 model 은 동적 평가가 정상 흐름이며, defaultModel 이 가리키는 정합 검증이 별개 책임.
- **연관 spec**: `spec/5-system/7-llm-client.md §5.5 preview-models 엔드포인트` — preview 결과 빈/실패 응답 처리는 본 절의 select-only 정책을 따른다 (graceful degrade 미적용). `spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델` — 동일 결정을 임베딩 모델 선택에도 적용.

### R-2. AuthConfig 도메인 — Webhook 인증 wiring

`/authentication` (AuthConfig) 자격증명은 Webhook 수신 인증에 wiring 된다. 상세 근거는 [Spec Webhook Rationale "inline auth path 폐지"](../5-system/12-webhook.md#rationale) + [Spec 데이터 모델 §2.17.3](../1-data-model.md#2173-rationale-authconfig-도메인).

- **HMAC type**: API Key / Bearer / Basic Auth 에 더해 `hmac` 지원. Webhook HMAC 서명 검증을 trigger inline `config.secret` 대신 AuthConfig 로 흡수.
- **bearer_token 자동 발급 강제**: 사용자 입력 없이 자동 발급(`wft_<hex32>`)만 허용. 외부 호출자 발급 토큰은 제품이 충분한 엔트로피로 생성하는 게 일관적이며, 사용자 입력 토큰의 형식·엔트로피 검증 부담을 없앤다.
- **Bearer Token 만료 시간 필드 v1 제외**: 토큰 만료·자동 회전을 다루지 않는다 — JSONB 스키마 `{ token }` 와 정합. 만료/회전이 필요해지면 후속 결정으로 재도입.
- **항상 마스킹 + Reveal 엔드포인트** (§A.4): API 응답에서 secret 류는 항상 `***<last4>`. 평문은 create / regenerate / reveal 3 경로만. Reveal 은 Admin+ · 비밀번호 재확인 · audit 기록.
