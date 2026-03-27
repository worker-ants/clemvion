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
