# Spec: 통합 관리 화면

> 관련 문서: [PRD 내비게이션](../../prd/1-navigation.md#34-integration) · [PRD 통합/연동](../../prd/4-integration.md) · [Spec 레이아웃](./0-layout.md) · [데이터 모델 - Integration](../1-data-model.md#29-integration)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Integrations                    [+ Add Integration]    │
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────┐       │
│  │ 🔍 Search...     │  │ Scope: All ▼          │       │
│  └──────────────────┘  └────────────────────────┘       │
│                                                         │
│  Organization                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🟢 Slack - Team Bot         OAuth2    Connected  ⋮ │ │
│  │ 🟢 Google - Company Drive   OAuth2    Connected  ⋮ │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  Personal                                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🟢 GitHub - My Account      OAuth2    Connected  ⋮ │ │
│  │ 🟡 Slack - Personal         OAuth2    Expired    ⋮ │ │
│  │ 🟢 HTTP - Custom API        API Key   Connected  ⋮ │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 연동 목록 항목

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | Connected(🟢) / Expired(🟡) / Error(🔴) |
| 서비스 아이콘 | 서비스 유형별 로고/아이콘 |
| 별칭 | 사용자가 지정한 연동 이름 |
| 인증 유형 | OAuth2 / API Key / Bearer Token |
| 상태 텍스트 | Connected / Expired / Error |
| 범위 구분 | Organization / Personal 섹션으로 분리 |
| 더보기(⋮) | 수정, 연결 테스트, 재인증, 삭제 |

### 2.2 연동 추가 플로우

**Step 1: 서비스 선택**
```
┌─────────────────────────────────────────┐
│  Add Integration                        │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Slack  │ │ Google  │ │ GitHub  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  HTTP   │ │Database │ │  Email  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐                            │
│  │ Webhook │                            │
│  └─────────┘                            │
└─────────────────────────────────────────┘
```

**Step 2: 인증 정보 입력**

서비스 유형에 따라 달라지는 입력 폼:

| 인증 유형 | 필드 |
|-----------|------|
| OAuth2 | "Authorize" 버튼 → OAuth 팝업 → 콜백으로 토큰 수신 |
| API Key | 별칭, API Key 입력, 엔드포인트 URL (선택) |
| Bearer Token | 별칭, Token 입력 |

**Step 3: 범위 선택 (팀 워크스페이스)**

| 옵션 | 설명 |
|------|------|
| Personal | 본인만 사용 |
| Organization | 워크스페이스 전체 공유 (Admin 이상) |

**Step 4: 연결 테스트**
- 설정 완료 전 연결 테스트 실행
- 성공 시 저장 활성화
- 실패 시 에러 메시지 표시

### 2.3 연동 수정

- 별칭 변경
- 인증 정보 재입력 (기존 값은 마스킹 표시)
- 범위 변경 (personal ↔ organization, Admin 권한 필요)

### 2.4 재인증 (OAuth)

- 토큰 만료 시 "재인증" 버튼 표시
- 클릭 시 OAuth 플로우 재실행

### 2.5 권한 규칙

| 액션 | Personal | Organization |
|------|----------|-------------|
| 생성 | 모든 멤버 | Admin 이상 |
| 조회 | 본인 것만 | 모든 멤버 |
| 수정 | 본인 것만 | Admin 이상 |
| 삭제 | 본인 것만 | Admin 이상 |
| 워크플로우에서 사용 | 본인 것만 | 모든 멤버 |

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/integrations | 목록 조회 (쿼리: scope, service_type, status) |
| POST | /api/integrations | 연동 생성 |
| GET | /api/integrations/:id | 상세 조회 |
| PATCH | /api/integrations/:id | 수정 |
| POST | /api/integrations/:id/test | 연결 테스트 |
| POST | /api/integrations/:id/reauthorize | OAuth 재인증 |
| DELETE | /api/integrations/:id | 삭제 |
| GET | /api/integrations/services | 지원 서비스 목록 |

---

## 4. OAuth 콜백 엔드포인트

Integration의 OAuth 인증 플로우(§2.2 Step 2)에서 외부 OAuth 제공자가 인증 완료 후 콜백하는 엔드포인트를 정의한다.

### 4.1 엔드포인트

```
GET /api/integrations/oauth/callback/:provider
```

| 파라미터 | 설명 |
|----------|------|
| `:provider` | OAuth 제공자 식별자 (`slack`, `google`, `github`) |
| `code` (쿼리) | OAuth Authorization Code |
| `state` (쿼리) | CSRF 방지용 state 토큰 |
| `error` (쿼리) | OAuth 에러 코드 (사용자가 거부한 경우 등) |

> **참고**: 이 엔드포인트는 **사용자 로그인용 OAuth** (`/api/auth/oauth/:provider/callback`)와 별개이다. Integration용 OAuth는 외부 서비스 연동 인증에 사용된다.

### 4.2 처리 플로우

```
1. state 검증
   - 서버가 생성한 state 값(세션/DB에 저장)과 일치하는지 확인
   - 불일치 → 팝업에 에러 표시 후 종료

2. error 파라미터 확인
   - error 존재 시 → 팝업에 "Authorization denied" 표시 후 종료

3. Authorization Code → Token 교환
   - provider별 토큰 엔드포인트에 code + client_secret 전송
   - access_token (+ refresh_token) 수신

4. 토큰 저장
   - Integration 엔티티의 config에 암호화하여 저장 (AES-256)
   - access_token, refresh_token, expires_at, scope 저장

5. 팝업 종료 + 부모 창 알림
   - 팝업에서 window.opener.postMessage로 결과 전달
   - 부모 창(Integration 화면)에서 연동 상태 갱신
```

### 4.3 팝업 → 부모 창 통신

```javascript
// 팝업 내 콜백 페이지
window.opener.postMessage({
  type: "oauth_callback",
  provider: "slack",
  status: "success",       // "success" | "error"
  integrationId: "uuid",
  error: null              // 에러 시 에러 메시지
}, window.location.origin);

window.close();
```

### 4.4 provider별 설정

| Provider | Token URL | Scope 예시 | Refresh 지원 |
|----------|-----------|-----------|-------------|
| Slack | `https://slack.com/api/oauth.v2.access` | `chat:write`, `channels:read` | ✓ |
| Google | `https://oauth2.googleapis.com/token` | `https://www.googleapis.com/auth/drive`, `spreadsheets` | ✓ |
| GitHub | `https://github.com/login/oauth/access_token` | `repo`, `read:org` | ✗ (토큰 만료 없음) |

### 4.5 토큰 자동 갱신

- Refresh Token이 있는 경우: access_token 만료 시 자동으로 갱신
- 갱신 실패 시: Integration 상태를 `expired`로 변경 + 사용자 알림
- 갱신 시도 주기: 노드 실행 시점에 만료 확인 → 만료됐으면 갱신 후 실행

### 4.6 에러 처리

| 에러 상황 | 처리 |
|-----------|------|
| state 불일치 | 팝업에 "Security validation failed. Please try again." |
| 사용자 거부 | 팝업에 "Authorization was denied. You can try again from the Integration page." |
| 코드 교환 실패 | 팝업에 "Failed to connect to {provider}. Please try again." + 서버 로그 기록 |
| 네트워크 오류 | 팝업에 "Connection error. Please check your network and try again." |
