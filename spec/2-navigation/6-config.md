# Spec: 설정 (인증, LLM) 화면

> 관련 문서: [PRD 내비게이션](../../prd/1-navigation.md#36-config--authentication) · [PRD 내비게이션](../../prd/1-navigation.md#37-config--llm) · [Spec 레이아웃](./0-layout.md) · [데이터 모델 - AuthConfig](../1-data-model.md#216-authconfig) · [데이터 모델 - LLMConfig](../1-data-model.md#215-llmconfig)

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

#### API Key

| 필드 | 설명 |
|------|------|
| 이름 | 인증 설정 이름 |
| API Key | 자동 생성 (표시: 마스킹, 복사 가능) |
| Key 재생성 | 기존 키 폐기 후 새 키 생성 (확인 필요) |
| IP Whitelist | 허용 IP 목록 (선택) |

#### Bearer Token

| 필드 | 설명 |
|------|------|
| 이름 | 인증 설정 이름 |
| Token | 자동 생성 또는 사용자 입력 |
| 만료 시간 | 토큰 유효 기간 설정 (선택) |

#### Basic Auth

| 필드 | 설명 |
|------|------|
| 이름 | 인증 설정 이름 |
| Username | 사용자 이름 |
| Password | 비밀번호 (마스킹 표시) |

### A.3 인증 사용량/이력

| 항목 | 설명 |
|------|------|
| 최근 호출 시각 | 마지막 사용 시각 |
| 기간별 호출 수 | 일/주/월 기준 호출 횟수 |
| 호출 이력 테이블 | 시각, 소스 IP, 대상 트리거, 응답 코드 |

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
| 기본 모델 | 이 프로바이더에서 기본으로 사용할 모델 ID |
| 기본 파라미터 | Temperature, Max Tokens, Top-P 등 |
| 기본 프로바이더 설정 | ⭐ 아이콘으로 표시. AI 노드 생성 시 기본 선택 |

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
| GET | /api/auth-configs | 인증 설정 목록 |
| POST | /api/auth-configs | 인증 설정 생성 |
| GET | /api/auth-configs/:id | 상세 조회 |
| PATCH | /api/auth-configs/:id | 수정 |
| POST | /api/auth-configs/:id/regenerate | 키/토큰 재생성 |
| DELETE | /api/auth-configs/:id | 삭제 |
| GET | /api/auth-configs/:id/usage | 사용량/이력 조회 |

### LLM Config API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/llm-configs | 프로바이더 목록 |
| POST | /api/llm-configs | 프로바이더 추가 |
| GET | /api/llm-configs/:id | 상세 조회 |
| PATCH | /api/llm-configs/:id | 수정 |
| POST | /api/llm-configs/:id/test | 연결 테스트 |
| PATCH | /api/llm-configs/:id/set-default | 기본 프로바이더 설정 |
| DELETE | /api/llm-configs/:id | 삭제 |
| GET | /api/llm-configs/:id/models | 사용 가능한 모델 목록 조회 |
