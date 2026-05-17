# 신규 식별자 충돌 Check Payload

본 파일은 orchestrator 가 신규 식별자 충돌 checker 용으로 작성한 입력입니다. target 문서가 도입하는 새 식별자가 기존 사용처와 충돌하지 않는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (신규 식별자 충돌)

1. **요구사항 ID 충돌** — target 이 새로 부여하는 ID 가 기존에 다른 의미로 이미 사용되고 있는가
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 명이 기존 영역에서 다른 의미로 사용 중인가
3. **API endpoint 충돌** — 새 endpoint(method + path)가 기존 spec 에 이미 정의되어 있는가
4. **이벤트/메시지명 충돌** — webhook·queue·sse 이벤트 이름 충돌
5. **환경변수·설정키 충돌** — 새 ENV var, config key 가 기존 사용처와 겹치는가
6. **파일 경로 충돌** — 새 spec 파일 경로/이름이 기존 명명 컨벤션을 깨거나 기존 파일과 겹치는가

## 검토 모드
구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation/)

## Target 문서
경로: `spec/2-navigation/`

```
### 구현 대상 영역: `spec/2-navigation/`

#### `spec/2-navigation/0-dashboard.md`
```
# Spec: 대시보드

> 관련 문서: [Spec 레이아웃](./_layout.md) · [Spec 인증 플로우](./10-auth-flow.md) · [PRD 내비게이션](./_product-overview.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행 내역](./14-execution-history.md)

---

## 1. 개요

대시보드(`/dashboard`)는 로그인 후 최초 랜딩 화면이다. 워크플로우 상태와 최근 실행 이력을 한눈에 파악하고, 빠른 액션을 수행할 수 있다.

---

## 2. 화면 구성

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                  [+ New Workflow]   │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Total WF │ │ Runs(7d) │ │ Success  │ │ Avg Time │         │
│  │   12     │ │    87    │ │  94.2%   │ │   4.3s   │         │
│  │ 10A / 2I │ │          │ │          │ │          │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  ┌─────────────────────────────┐ ┌──────────────────────────┐ │
│  │ Recent Workflows            │ │ Recent Executions        │ │
│  │ ─────────────────────────── │ │ ──────────────────────── │ │
│  │ 1. Data Sync       2m ago  │ │ Data Sync  ✅ 3.2s  14:02│ │
│  │ 2. Email Campaign  1h ago  │ │ Report Gen ❌ 1.0s  14:01│ │
│  │ 3. Report Gen      3h ago  │ │ Email Camp ✅ 5.1s  13:58│ │
│  │ 4. Email Notify    1d ago  │ │ Email Ntfy ✅ 0.8s  13:55│ │
│  │ 5. DB Backup       2d ago  │ │ ...                      │ │
│  │                             │ │                          │ │
│  │ [View All →]                │ │                          │ │
│  └─────────────────────────────┘ └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. 요약 카드

상단에 4개의 요약 카드를 가로 배치한다.

| 카드 | 표시 내용 | 설명 |
|------|-----------|------|
| Total Workflows | 총 워크플로우 수 + Active/Inactive 구분 | Active: 트리거가 활성화된 워크플로우, Inactive: 비활성 |
| Runs (7d) | 최근 7일 실행 횟수 | 전주 대비 증감 표시 (선택) |
| Success Rate | 최근 7일 성공률 (%) | `completed / (completed + failed) × 100` |
| Avg Time | 최근 7일 평균 실행 시간 | 단위: 초(s) 또는 분(m) 자동 전환 |

---

## 4. 최근 워크플로우

최근 수정 또는 실행 기준으로 상위 5개 워크플로우를 표시한다.

| 항목 | 설명 |
|------|------|
| 정렬 기준 | `max(updatedAt, lastExecutedAt)` 내림차순 |
| 표시 필드 | 워크플로우 이름, 마지막 활동 시간 (상대 시간) |
| 클릭 동작 | 워크플로우 에디터(`/workflows/:id`)로 이동 |
| "View All" 링크 | `/workflows` (워크플로우 목록)로 이동 |
| 빈 상태 | "No workflows yet. Create your first workflow!" + [+ New Workflow] 버튼 |

---

## 5. 최근 실행 이력

최근 실행 완료/실패 기준 10건을 표시한다.

| 열 | 설명 |
|----|------|
| 상태 | ✅ completed / ❌ failed / ⏳ running |
| 워크플로우 이름 | 실행된 워크플로우 이름 |
| 트리거 | 실행 출처(`subworkflow`/`manual`/`schedule`/`webhook`/`unknown`) 아이콘 + 라벨. 분류 규칙·보조 라벨 정책은 [실행 내역 spec §2.4 Trigger 출처 분류](./14-execution-history.md#trigger-출처-분류) 참조 |
| 소요 시간 | 실행 소요 시간 (초/분) |
| 시각 | 실행 완료 시각 (상대 시간 또는 HH:mm) |

| 동작 | 설명 |
|------|------|
| 행 클릭 | 해당 실행의 상세 페이지(`/workflows/:workflowId/executions/:executionId`)로 이동. 상세 스펙은 [Spec 실행 내역](./14-execution-history.md) 참조 |
| 빈 상태 | "No executions yet. Run a workflow to see results here." |

---

## 6. 빠른 액션

| 액션 | 위치 | 동작 |
|------|------|------|
| + New Workflow | 페이지 헤더 우측 | 새 워크플로우 생성 → 에디터로 이동 |

---

## 7. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/dashboard/summary | 요약 카드 데이터 (워크플로우 수, 실행 횟수, 성공률, 평균 시간) |
| GET | /api/dashboard/recent-workflows | 최근 워크플로우 5건 |
| GET | /api/dashboard/recent-executions | 최근 실행 이력 10건 |

**응답 예시 — `/api/dashboard/summary`**:

```json
{
  "totalWorkflows": 12,
  "activeWorkflows": 10,
  "inactiveWorkflows": 2,
  "runs7d": 87,
  "successRate": 94.2,
  "avgExecutionTime": 4.3
}
```

---

## 8. 반응형

| 브레이크포인트 | 레이아웃 |
|----------------|----------|
| ≥ 1280px | 요약 카드 4열, 최근 워크플로우·실행 이력 2열 |
| 768px ~ 1279px | 요약 카드 2열, 최근 워크플로우·실행 이력 1열 (세로 스택) |
| < 768px | 요약 카드 1열, 최근 워크플로우·실행 이력 1열 |

```

#### `spec/2-navigation/1-workflow-list.md`
```
# Spec: 워크플로우 목록 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#31-workflow-list-워크플로우-목록) · [Spec 레이아웃](./_layout.md) · [Spec 캔버스](../3-workflow-editor/0-canvas.md) · [데이터 모델 - Workflow](../1-data-model.md#24-workflow)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Workflows                         [+ New Workflow]     │
│                                                         │
│  ┌──────────────────┐  ┌──────┐  ┌─────────────────┐   │
│  │ 🔍 Search...     │  │Filter│  │ Sort: Updated ▼ │   │
│  └──────────────────┘  └──────┘  └─────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ● My Workflow 1            Active    2 min ago      │ │
│  │   3 nodes · webhook trigger            ⋮           │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ○ Data Pipeline            Inactive  1 hour ago     │ │
│  │   12 nodes · schedule trigger          ⋮           │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ● Shared: Team Bot        Active    5 min ago       │ │
│  │   8 nodes · webhook trigger   👥 Team  ⋮           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│                    1  2  3  ... 10  →                    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 워크플로우 목록 테이블

| 컬럼 | 내용 |
|------|------|
| 상태 표시 | Active(●초록) / Inactive(○회색) 아이콘 |
| 이름 | 워크플로우 이름. 클릭 시 에디터로 진입 |
| 트리거 요약 | 연결된 트리거 유형 및 개수 |
| 노드 수 | 워크플로우에 포함된 노드 수 |
| 마지막 실행 | 마지막 실행 시각 (상대 시간 표시) |
| 공유 표시 | 팀 워크스페이스에 속한 모든 워크플로우에 팀 뱃지(👥 Team) 표시. 개인 워크스페이스에서는 표시하지 않는다. ([Rationale §1](#rationale)) |
| 더보기 메뉴(⋮) | 편집, 복제, 활성/비활성 토글, 내보내기, 삭제 |

### 2.2 검색

- 워크플로우 이름 기준 실시간 검색 (debounce 300ms)
- 검색 결과가 없을 경우 "검색 결과가 없습니다" 메시지 표시

### 2.3 필터

| 필터 항목 | 옵션 | 비고 |
|-----------|------|------|
| 상태 | 전체 / Active / Inactive | 상시 노출 |
| 소유 | 내 워크플로우 / 공유된 워크플로우 / 전체 | **팀 워크스페이스 활성 시에만 노출**. "공유된 워크플로우" = `createdBy ≠ 현재 사용자`. 개인 워크스페이스에서는 필터 자체가 사라진다. UI 의 세 옵션은 서버 `GET /api/workflows?ownership=` 의 `mine` / `shared` / `all` 에 1:1 매핑된다 — 개인 워크스페이스 컨텍스트에서는 클라이언트가 파라미터를 보내지 않고, 받더라도 서버는 무시한다 |
| 태그 | 태그 멀티 선택 | 상시 노출 |
| 폴더 | 폴더 선택 (있을 경우) | 상시 노출 |

> 팀 뱃지(§2.1 공유 표시)는 워크스페이스 단위의 "공유" 정의를 따르고, 소유 필터는 그 안에서 내 것/남의 것을 다시 구분하는 보조 도구다. 두 정의가 어긋나지 않는 이유는 [Rationale §1](#rationale) 참고.

### 2.4 정렬

| 정렬 기준 | 방향 |
|-----------|------|
| 최근 수정순 (기본) | 내림차순 |
| 이름순 | 오름차순/내림차순 |
| 생성일순 | 내림차순 |
| 마지막 실행순 | 내림차순 |

### 2.5 새 워크플로우 생성

- "**+ New Workflow**" 버튼 클릭
- 워크플로우 이름 입력 다이얼로그 표시 (기본값: "Untitled Workflow")
- 생성 후 즉시 에디터로 진입

### 2.6 더보기 메뉴 액션

| 액션 | 동작 |
|------|------|
| 편집 | 에디터로 진입 |
| 복제 | 워크플로우 복사본 생성 (이름에 "(Copy)" 추가) |
| 활성/비활성 | 상태 토글. 비활성 시 트리거/스케줄 중지 |
| 내보내기 | JSON 파일로 다운로드 |
| 삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거/스케줄도 함께 비활성화 |

### 2.7 빈 상태

- 워크플로우가 없을 때: 일러스트 + "첫 번째 워크플로우를 만들어 보세요" 메시지 + 생성 버튼
- 마켓플레이스 템플릿 추천 링크

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/workflows | 목록 조회 (쿼리: search, status, tag, sort, order, page, limit, ownership). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. `ownership` 은 팀 워크스페이스 컨텍스트에서만 의미가 있으며 (`mine` / `shared` / `all`, default `all`), 개인 워크스페이스에서는 서버가 무시한다 (= `all` 처럼 동작) |
| POST | /api/workflows | 새 워크플로우 생성 |
| PATCH | /api/workflows/:id | 워크플로우 수정 (이름, 상태 등) |
| POST | /api/workflows/:id/duplicate | 워크플로우 복제 |
| DELETE | /api/workflows/:id | 워크플로우 삭제 |
| GET | /api/workflows/:id/export | JSON 내보내기 |
| POST | /api/workflows/import | JSON 가져오기 |

---

## Rationale

### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체

NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:

- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)

(a) 를 채택한 이유:

- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.

결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.

```

#### `spec/2-navigation/10-auth-flow.md`
```
# Spec: 인증 UI 플로우

> 관련 문서: [PRD 비기능 요구사항 §2](../5-system/_product-overview.md#2-보안) · [Spec 인증/인가](../5-system/1-auth.md) · [Spec 사용자 프로필](./9-user-profile.md) · [데이터 모델 - User](../1-data-model.md#21-user)

---

## 1. 화면 구성 개요

인증 화면은 사이드바가 없는 **전체 화면 레이아웃**을 사용한다.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│              ┌────────────────────────┐                      │
│              │        [Logo]          │                      │
│              │                        │                      │
│              │    (인증 폼 영역)       │                      │
│              │                        │                      │
│              └────────────────────────┘                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- 중앙 정렬 카드 형태 (최대 너비 400px)
- 배경: 제품 브랜드 색상 또는 그래디언트
- 카드 상단의 `[Logo]` 자리에는 **Full logo** 변종을 사용 (변종 매트릭스: [`spec/6-brand.md` §8.4.1](../6-brand.md#841-변종-매트릭스))
- 반응형: 모바일에서 카드가 전체 너비 확장

---

## 2. 회원가입 (Register)

### 2.1 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Create your account           │
│                                  │
│    Name:     [______________]    │
│    Email:    [______________]    │
│    Password: [______________]    │
│              (패스워드 강도 바)    │
│                                  │
│    □ I agree to Terms of Service │
│                                  │
│    [      Create Account      ]  │
│                                  │
│    ─── or continue with ───      │
│                                  │
│    [🔵 Google] [⚫ GitHub]       │
│                                  │
│    Already have an account?      │
│    → Sign in                     │
└──────────────────────────────────┘
```

### 2.2 필드 검증

| 필드 | 검증 규칙 | 실시간 피드백 |
|------|-----------|--------------|
| Name | 필수, 2~50자 | 입력 즉시 |
| Email | 필수, 이메일 형식 | blur 시 형식 검증 + 중복 확인 API 호출 |
| Password | 필수, 최소 8자, 대소문자+숫자+특수문자 중 3가지 이상 | 입력 중 강도 바 표시 (약함/보통/강함) |
| Terms | 필수 체크 | 미체크 시 버튼 비활성화 |

### 2.3 비밀번호 강도 바

| 강도 | 조건 | 색상 |
|------|------|------|
| 약함 | 8자 미만 또는 1가지 문자 유형 | 빨강 |
| 보통 | 8자 이상 + 2가지 문자 유형 | 주황 |
| 강함 | 8자 이상 + 3가지 이상 문자 유형 | 초록 |

### 2.4 처리 플로우

```
1. 입력 검증 (클라이언트)
2. POST /api/auth/register { name, email, password, invitationToken? }
3. 성공 → 이메일 인증 안내 화면으로 이동 (단, invitationToken 흐름은 §2.6 분기 참고)
4. 실패 → 인라인 에러 표시 (이메일 중복, 토큰 만료/이메일 불일치 등)
```

### 2.6 초대 토큰을 통한 가입 (`?invitationToken=…`)

미가입자가 메일 링크를 클릭하면 회원가입 페이지는 `?invitationToken=…` 쿼리를 받아 다음 처리를 수행한다:

| 단계 | 처리 |
|------|------|
| 1. 토큰 메타 prefetch | `GET /api/invitations/:token` 로 워크스페이스 이름·초대자·이메일·만료 조회. 401/410 등 실패 → 에러 화면으로 라우팅 |
| 2. 이메일 prefill + readOnly | 응답의 `email` 을 입력란에 채우고 readOnly 로 고정. 다른 이메일로 가입 자체 차단 |
| 3. 헤더 안내 | "**{workspace}** 에 초대받으셨어요" + 초대자 이름 노출 |
| 4. 가입 제출 | `POST /api/auth/register { name, password, invitationToken }` — 이메일은 토큰에서 서버가 신뢰 |
| 5. 트랜잭션 처리 | 서버에서 [Spec 인증/인가 §1.5.2](../5-system/1-auth.md#152-흐름-미가입자-가입-경로) 의 단일 트랜잭션 (User 생성 + WorkspaceMember 추가 + invitation.acceptedAt) 수행. 실패 시 전체 롤백 |
| 6. 가입 성공 후 | 이메일 인증 안내 화면 대신 **초대된 워크스페이스로 컨텍스트 진입** (§6.1 의 개인 워크스페이스 자동 생성은 발화하지 않음) |
| 7. 에러 분기 | `invitation_email_mismatch` (서버가 거의 차단하지만 안전망), `invitation_expired`, `invitation_already_used` → "이 초대는 더 이상 유효하지 않아요. 워크스페이스 관리자에게 재발송을 요청하세요" 안내 |

### 2.5 이메일 인증 안내 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    📧 Verify your email          │
│                                  │
│    We sent a verification link   │
│    to gehrig@example.com         │
│                                  │
│    [   Resend Email   ]          │
│                                  │
│    Didn't receive?               │
│    Check spam folder or          │
│    → use a different email       │
└──────────────────────────────────┘
```

- 이메일 인증 링크 클릭 → `GET /api/auth/verify-email?token={token}`
- 인증 성공 → 자동 로그인 + 개인 워크스페이스 생성 + 대시보드(`/dashboard`)로 리다이렉트
- 인증 토큰 유효기간: 24시간
- 재발송: 60초 쿨다운

---

## 3. 로그인 (Sign In)

### 3.1 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Sign in to your account       │
│                                  │
│    Email:    [______________]    │
│    Password: [______________]    │
│                                  │
│    □ Remember me                 │
│    → Forgot password?            │
│                                  │
│    [        Sign In          ]   │
│                                  │
│    ─── or continue with ───      │
│                                  │
│    [🔵 Google] [⚫ GitHub]       │
│                                  │
│    Don't have an account?        │
│    → Create account              │
└──────────────────────────────────┘
```

### 3.2 처리 플로우

```
1. 입력 검증 (이메일 형식, 비밀번호 비어있지 않음)
2. POST /api/auth/login { email, password }
3. 2FA 미설정 → JWT 발급 → 대시보드(`/dashboard`)로 리다이렉트
4. 2FA 설정됨 → 2FA 입력 화면으로 이동 (임시 토큰 포함)
5. 로그인 실패 → "Invalid email or password" 에러 (구체적 이유 미노출)
6. 5회 실패 → 계정 10분 잠금 + "Account locked. Try again in 10 minutes."
```

### 3.3 "Remember me" 동작

| 체크 | Refresh Token 유효기간 |
|------|----------------------|
| 미체크 | 7일 (기본) |
| 체크 | 30일 |

### 3.4 2FA 입력 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Two-factor authentication     │
│                                  │
│    Enter the 6-digit code from   │
│    your authenticator app        │
│                                  │
│    [  _  _  _  _  _  _  ]       │
│                                  │
│    → Use a recovery code         │
│                                  │
│    [       Verify            ]   │
│    [       ← Back            ]   │
└──────────────────────────────────┘
```

- 6자리 숫자 자동 포커스 이동
- `POST /api/auth/verify-2fa { tempToken, code }`
- 성공 → JWT 발급 → 리다이렉트
- 실패 → "Invalid code. Please try again."
- 복구 코드 입력 모드 전환 시 단일 입력 필드로 변경

---

## 4. 비밀번호 재설정 (Forgot Password)

### 4.1 Step 1: 이메일 입력

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Reset your password           │
│                                  │
│    Enter the email associated    │
│    with your account             │
│                                  │
│    Email: [______________]       │
│                                  │
│    [    Send Reset Link     ]    │
│    [    ← Back to Sign In   ]   │
└──────────────────────────────────┘
```

- `POST /api/auth/forgot-password { email }`
- **성공/실패 모두 동일 안내 화면** 표시 (이메일 존재 여부 노출 방지)

### 4.2 Step 2: 안내 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    📧 Check your email           │
│                                  │
│    If an account exists for      │
│    gehrig@example.com,           │
│    we sent a password reset      │
│    link.                         │
│                                  │
│    [   Resend Email   ]          │
│    [   ← Back to Sign In   ]    │
└──────────────────────────────────┘
```

### 4.3 Step 3: 새 비밀번호 입력

이메일의 재설정 링크 클릭 시 표시:

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Set new password              │
│                                  │
│    New Password:                 │
│    [______________]              │
│    (패스워드 강도 바)              │
│                                  │
│    Confirm Password:             │
│    [______________]              │
│                                  │
│    [    Reset Password     ]     │
└──────────────────────────────────┘
```

- `POST /api/auth/reset-password { token, newPassword }`
- 성공 → "Password updated. Sign in with your new password." + 로그인 화면으로 이동
- 토큰 만료/무효 → "This link has expired. Request a new one." + 재요청 링크
- 재설정 토큰 유효기간: 30분
- 사용 후 토큰 즉시 무효화

---

## 5. OAuth 소셜 로그인

### 5.0 활성화된 Provider 노출

회원가입·로그인 화면 진입 시 서버에서 `GET /api/auth/oauth/providers` 를 호출하여 현재 자격증명이 설정된 provider 목록을 받는다.

| 응답 | UI 동작 |
|------|---------|
| `{ data: { providers: ["google", "github"] } }` | "Or continue with" 구분선과 두 버튼 모두 표시 |
| 일부만 포함 (예: `["google"]`) | 해당 버튼만 단일 컬럼으로 표시 |
| 빈 배열 `[]` | 구분선과 버튼 모두 비표시 (이메일/비밀번호 폼만 노출) |

- Provider 활성화 기준: `OAUTH_STUB_MODE=true` (개발) 또는 `{PROVIDER}_CLIENT_ID` 환경변수가 설정된 경우
- 응답은 `Cache-Control: public, max-age=300` 으로 5분 캐싱 (Next.js Server Component `fetch` 의 `revalidate: 300` 와 정합)
- 이 API 호출이 실패하면 안전 기본값으로 빈 배열 처리하여 SSO UI 비표시 (이메일/비밀번호 로그인은 정상 동작)

### 5.1 플로우

```
┌─────────┐     ┌─────────────┐     ┌────────────┐     ┌──────────┐
│ 클라이언트│────→│ 서버         │────→│ OAuth 제공자│────→│ 콜백 처리 │
│ (버튼)   │     │ /auth/oauth/ │     │ (Google 등)│     │          │
│          │     │ :provider   │     │            │     │          │
└─────────┘     └─────────────┘     └────────────┘     └──────────┘
     │                                                        │
     │              5. JWT 발급 + 리다이렉트                    │
     │←──────────────────────────────────────────────────────│
```

### 5.2 상세 단계

| 단계 | 동작 |
|------|------|
| 1 | 사용자가 "Continue with Google/GitHub" 버튼 클릭 |
| 2 | `GET /api/auth/oauth/:provider` → 서버가 OAuth URL 생성 (`state` 파라미터 포함) |
| 3 | 브라우저를 OAuth 제공자의 인증 페이지로 리다이렉트 (또는 팝업) |
| 4 | 사용자가 OAuth 제공자에서 인증 승인 |
| 5 | OAuth 제공자가 `GET /api/auth/oauth/:provider/callback?code=...&state=...`로 리다이렉트 |
| 6 | 서버가 `code`로 토큰 교환 → 프로필 조회 → 사용자 조회/생성 |
| 7 | JWT 발급 → 프론트엔드 리다이렉트 URL로 이동 (토큰은 HttpOnly Cookie) |

### 5.3 OAuth 콜백 처리 상세 (`/api/auth/oauth/:provider/callback`)

| 단계 | 처리 |
|------|------|
| state 검증 | 서버가 생성한 state 값과 일치하는지 확인 (CSRF 방지) |
| 코드 교환 | `code` → OAuth 제공자 토큰 엔드포인트에서 `access_token` 교환 |
| 프로필 조회 | `access_token`으로 사용자 프로필(이메일, 이름, 아바타) 조회 |
| 사용자 매칭 | 이메일로 기존 사용자 검색 |
| 기존 사용자 | OAuth 프로바이더 정보 연결 → 로그인 처리 |
| 신규 사용자 | 자동 회원가입 → 개인 워크스페이스 생성 → 로그인 처리 |
| JWT 발급 | Access Token + Refresh Token 발급 |
| 리다이렉트 | `{frontend_url}/callback?success=true&token={accessToken}` (Refresh Token은 httpOnly Cookie로 설정, Access Token은 짧게 URL 파라미터로 전달되며 클라이언트가 즉시 메모리에 저장 후 URL 정리) |

### 5.4 OAuth 에러 처리

| 에러 | 처리 |
|------|------|
| state 불일치 | `{frontend_url}/callback?error=invalid_state` |
| 코드 교환 실패 | `{frontend_url}/callback?error=token_exchange_failed` |
| 이메일 미제공 | `{frontend_url}/callback?error=email_required` (GitHub private email 등) |
| 서버 오류 | `{frontend_url}/callback?error=server_error` |

프론트엔드의 `/callback` 페이지:
- `success=true` + `token` → `setAccessToken(token)` 후 대시보드(`/dashboard`)로 리다이렉트
- `error=*` → 에러 메시지 표시 + "다시 시도" 버튼 + 로그인 화면 링크

---

## 6. 첫 워크스페이스 자동 생성

### 6.1 트리거 조건

아래 경우에 개인 워크스페이스가 자동 생성된다:

| 경로 | 조건 |
|------|------|
| 이메일 회원가입 | 이메일 인증 완료 시 **(단, `invitationToken` 으로 가입한 경우 제외 — 초대된 워크스페이스로 진입)** |
| OAuth 소셜 로그인 (최초) | 신규 사용자 자동 가입 시 |

> 초대 토큰으로 가입한 사용자는 초대된 팀 워크스페이스에 곧바로 멤버로 추가되므로 별도의 개인 워크스페이스를 자동 생성하지 않는다. 이후 사용자가 개인 워크스페이스를 원하면 워크스페이스 관리 화면에서 직접 만들 수 있다.

### 6.2 생성 규칙

| 항목 | 값 |
|------|-----|
| Workspace.name | "{사용자 이름}'s Workspace" |
| Workspace.slug | 사용자 이메일 로컬 파트 + 랜덤 4자리 (예: `gehrig-a1b2`) |
| Workspace.type | `personal` |
| WorkspaceMember.role | `owner` |
| Workspace.timezone | 브라우저 타임존 (Accept-Language 헤더에서 추론) 또는 `UTC` |

---

## 7. 인증 상태 관리

### 7.1 라우트 가드

| 라우트 | 인증 필요 | 미인증 시 |
|--------|-----------|-----------|
| `/auth/*` (로그인, 가입 등) | X | — |
| `/auth/callback` | X | — |
| 그 외 모든 라우트 | O | `/auth/login`으로 리다이렉트 (원래 URL을 `redirect` 파라미터에 보존) |

### 7.2 로그인 후 리다이렉트

- 로그인 성공 시 `redirect` 파라미터가 있으면 해당 URL로 이동
- 없으면 기본: `/dashboard` (대시보드)

### 7.3 로그아웃

1. `POST /api/auth/logout` 호출 (Refresh Token 무효화)
2. 클라이언트: Access Token 메모리에서 제거, Cookie 삭제
3. `/auth/login`으로 리다이렉트

---

## 8. API 엔드포인트

기존 [Spec 인증/인가](../5-system/1-auth.md#5-api-엔드포인트) 엔드포인트에 추가:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/register | 회원가입 (본문에 `invitationToken?` 동봉 시 [§2.6](#26-초대-토큰을-통한-가입-invitationtoken) 흐름) |
| GET | /api/invitations/:token | 초대 토큰 메타 조회 (가입 페이지 prefill 용, 인증 불요) |
| POST | /api/auth/verify-email | 이메일 인증 확인 (쿼리: token) |
| POST | /api/auth/resend-verification | 인증 이메일 재발송 |
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/verify-2fa | 2FA 코드 검증 |
| POST | /api/auth/logout | 로그아웃 |
| POST | /api/auth/refresh | 토큰 갱신 |
| POST | /api/auth/forgot-password | 비밀번호 재설정 요청 |
| POST | /api/auth/reset-password | 비밀번호 재설정 |
| GET | /api/auth/oauth/providers | 활성화된 OAuth provider 목록 (UI 노출 제어용, 5분 캐싱) |
| GET | /api/auth/oauth/:provider | OAuth 시작 (리다이렉트) |
| GET | /api/auth/oauth/:provider/callback | OAuth 콜백 |
| POST | /api/auth/check-email | 이메일 중복 확인 (가입 폼 실시간 검증용) |

---

## Rationale

### R-1. 인증 화면 배경 — 그라데이션 복원 (2026-05-15 롤백)

§1 배경 기술을 *"제품 브랜드 색상 또는 그래디언트"* (main 표현) 로 **복원**. 이전 Stage 1 (commit `b6267429`) 에서 *"`soil-50` 단색, 그라데이션 금지"* 로 구체화했으나, 동일자 §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 `soil-50` 토큰이 §8.2 와 함께 폐기되어 본 표현도 함께 복원했다.

코드 상태: `frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `#111e14` 라운드 컨테이너 안에 별도 배치 (그라데이션 위 dark surface 로 시인성 확보).

### R-2. `[Logo]` 자리 변종 명시 (2026-05-15 정정)

§1 의 `[Logo]` 플레이스홀더에 *"Full logo 변종 사용"* 명시. 이전 Stage 1 에서는 *"Full logo (light)"* 로 라이트 한정했으나, §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 라이트/다크 자산 선택을 노출 자리의 surface 톤에 위임하는 형태로 바뀌어 본 행에서도 라이트 한정을 제거.

본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종·라이트/다크 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (R-9 — 브랜드 spec 의 라우트 spec 우선권).

근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`, `R-13`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/` (Stage 1), `review/consistency/2026/05/15/23_45_11/` (롤백).

```

#### `spec/2-navigation/11-error-empty-states.md`
```
# Spec: 에러 페이지 / 빈 상태 UI

> 관련 문서: [Spec 레이아웃](./_layout.md) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](../5-system/3-error-handling.md)

---

## 1. 에러 페이지

시스템 수준의 에러가 발생하면 전체 화면을 에러 페이지로 교체한다. 모든 에러 페이지는 **아이콘/일러스트 + 제목 + 설명 + CTA 버튼** 구조를 따른다.

### 1.1 공통 레이아웃

```
┌──────────────────────────────────────┐
│                                      │
│           (아이콘/일러스트)           │
│                                      │
│              제목 (H1)               │
│         설명 텍스트 (Body)           │
│                                      │
│           [ CTA 버튼 ]              │
│                                      │
└──────────────────────────────────────┘
```

- 화면 중앙 정렬
- 사이드바는 에러 유형에 따라 표시/숨김 (인증 관련 에러는 숨김)
- 다크/라이트 테마 모두 지원

### 1.2 에러 페이지 정의 (5종)

| 에러 | HTTP 코드 | 아이콘 | 제목 | 설명 | CTA |
|------|-----------|--------|------|------|-----|
| 세션 만료 | 401 | 🔒 자물쇠 | 세션이 만료되었습니다 | 보안을 위해 자동 로그아웃 되었습니다. 다시 로그인해주세요. | **다시 로그인** → 로그인 페이지 |
| 권한 없음 | 403 | 🚫 차단 | 접근 권한이 없습니다 | 이 페이지에 접근할 권한이 없습니다. 워크스페이스 관리자에게 문의하세요. | **워크스페이스 목록으로** → 워크스페이스 선택 화면 |
| 페이지 없음 | 404 | 🔍 돋보기 | 페이지를 찾을 수 없습니다 | 요청하신 페이지가 존재하지 않거나 이동되었습니다. | **대시보드로 이동** → 대시보드 |
| 서버 에러 | 500 | ⚠️ 경고 | 문제가 발생했습니다 | 서버에서 예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | **다시 시도** → 현재 페이지 새로고침, **대시보드로 이동** → 대시보드 |
| 네트워크 오류 | — | 📡 연결 끊김 | 네트워크에 연결할 수 없습니다 | 인터넷 연결을 확인하고 다시 시도해주세요. | **다시 시도** → 현재 페이지 새로고침 |

### 1.3 에러 페이지 동작 규칙

| 규칙 | 설명 |
|------|------|
| 401 감지 | API 응답 401 수신 시 현재 페이지를 세션 만료 에러 페이지로 교체. 로그인 후 원래 URL로 리디렉트 |
| 403 감지 | API 응답 403 수신 시 권한 없음 에러 페이지 표시 |
| 404 감지 | 존재하지 않는 라우트 접근 또는 API 404 응답 시 표시 |
| 500 감지 | API 응답 5xx 수신 시 서버 에러 페이지 표시 |
| 네트워크 오류 | API 호출 실패 (네트워크 타임아웃, DNS 실패 등) 시 표시 |
| 사이드바 표시 | 401: 숨김, 403/404/500/네트워크: 표시 (로그인 상태 유지 중이므로) |

---

## 2. 빈 상태 (Empty State)

데이터가 없는 화면에서 사용자에게 안내 문구와 행동 유도 버튼을 표시한다.

### 2.1 공통 패턴

```
┌──────────────────────────────────────┐
│                                      │
│              (아이콘)                │
│                                      │
│           안내 문구 (Body)           │
│                                      │
│           [ CTA 버튼 ]              │
│                                      │
└──────────────────────────────────────┘
```

- 목록 영역 중앙에 표시
- 상단의 검색/필터 바는 유지
- 아이콘은 해당 리소스를 상징하는 라인 아이콘

### 2.2 화면별 빈 상태 정의

| 화면 | 아이콘 | 안내 문구 | CTA |
|------|--------|-----------|-----|
| Dashboard — 최근 워크플로우 | 워크플로우 아이콘 | 아직 워크플로우가 없습니다. 첫 워크플로우를 만들어보세요. | **워크플로우 만들기** → 워크플로우 생성 |
| Dashboard — 최근 실행 | 실행 아이콘 | 아직 실행 기록이 없습니다. 워크플로우를 실행하면 여기에 표시됩니다. | — (CTA 없음) |
| Workflows 목록 | 워크플로우 아이콘 | 워크플로우가 없습니다. 자동화를 시작하려면 새 워크플로우를 만들어보세요. | **새 워크플로우** → 워크플로우 생성 |
| Triggers 목록 | 트리거 아이콘 | 트리거가 없습니다. 워크플로우를 자동으로 시작하려면 트리거를 추가하세요. | **트리거 추가** → 트리거 생성 |
| Schedule 목록 | 달력 아이콘 | 스케줄이 없습니다. 워크플로우를 정기적으로 실행하려면 스케줄을 추가하세요. | **스케줄 추가** → 스케줄 생성 |
| Integration 목록 | 연결 아이콘 | 연동된 서비스가 없습니다. 외부 서비스를 연결하여 워크플로우에서 활용하세요. | **서비스 연결** → 연동 추가 |
| Executions 목록 | 실행 아이콘 | 실행 기록이 없습니다. 워크플로우를 실행하면 여기에서 결과를 확인할 수 있습니다. | **워크플로우 목록** → 워크플로우 목록 이동 |

### 2.3 검색 결과 없음

검색 또는 필터 적용 결과가 0건인 경우, 일반 빈 상태와 다른 메시지를 표시한다.

```
┌──────────────────────────────────────┐
│                                      │
│              🔍 아이콘               │
│                                      │
│   검색 결과가 없습니다.             │
│   다른 키워드로 검색하거나           │
│   필터를 변경해보세요.               │
│                                      │
│         [ 필터 초기화 ]             │
│                                      │
└──────────────────────────────────────┘
```

| 항목 | 설명 |
|------|------|
| 아이콘 | 돋보기 아이콘 |
| 안내 문구 | "검색 결과가 없습니다. 다른 키워드로 검색하거나 필터를 변경해보세요." |
| CTA | **필터 초기화** → 검색어 및 필터를 모두 초기화하여 전체 목록 표시 |
| 적용 범위 | 검색바 또는 필터가 존재하는 모든 목록 화면 공통 |

```

#### `spec/2-navigation/12-workflow-version-history.md`
```
# Spec: 워크플로우 버전 이력

> 관련 문서: [Spec 워크플로우 편집기](../3-workflow-editor/) · [데이터 모델 - WorkflowVersion](../1-data-model.md)

---

## 1. 개요

워크플로우 편집기 내부에서 캔버스의 변경 이력을 버전 단위로 추적·복원할 수 있다.

- **자동 스냅샷**: 사용자가 캔버스를 저장(`POST /workflows/:id/save`)할 때마다 서버는 동일 트랜잭션 직후 `workflow_version` 레코드를 자동으로 생성한다.
- **불변 스냅샷**: 각 버전은 저장 시점의 노드/엣지 전체 상태를 `jsonb` snapshot 으로 보관한다. 이후 캔버스가 바뀌어도 과거 버전은 변하지 않는다.
- **복원 가능**: 임의의 과거 버전을 현재 상태로 덮어쓸 수 있고, 복원 동작 자체가 새로운 버전으로 기록되어 “Restored from vN” 로 표기된다.

---

## 2. 진입점

워크플로우 편집기 우측 “⋯ (More)” 드롭다운 → **Version History** 항목을 클릭하면 우측에 사이드 패널이 열린다.

```
┌──── Editor Toolbar ────────────────────────── [Save] [Run▾] [⋯] ─┐
│ ...                                                              │
├────────────┬────────────────────────────┬────────────────────────┤
│  Palette   │   Canvas                   │   Version History 패널 │
│            │                            │   ─────────────────── │
│            │                            │   ☐ Compare versions  │
│            │                            │   v3 · 2026-04-14 ... │
│            │                            │   v2 · ...            │
│            │                            │   v1 · ...            │
└────────────┴────────────────────────────┴────────────────────────┘
```

---

## 3. 사이드 패널 동작

| 영역 | 동작 |
|------|------|
| 헤더 | 닫기(X) 버튼 |
| Compare 토글 | 활성 시 버전 항목에 체크박스 노출. 두 개 선택 후 "Diff" 버튼 클릭 → Diff 다이얼로그 열림 |
| 버전 항목 (목록 모드) | 버전 번호 / 작성자 / 생성 시각 / 변경 요약 + `상세(Eye)` · `복원(↺)` 액션 버튼 |
| 빈 상태 | "No versions yet. Save the canvas to create the first version." |
| 에러 상태 | "Failed to load versions" |

목록은 `version DESC` (최신 위) 정렬.

---

## 4. 상세 다이얼로그

선택한 버전의 snapshot 을 단일 다이얼로그에서 읽기 전용으로 표시한다.

- 워크플로우 메타 (이름, 설명)
- 노드 목록 (label / type / 좌표 / disabled 여부)
- 엣지 목록 (`source:port → target:port`)

---

## 5. Diff 다이얼로그

두 개의 버전을 동시에 fetch 하여 클라이언트 사이드로 비교한다. 낮은 버전이 “before”, 높은 버전이 “after”.

- **Name 변경**: before/after 강조
- **Added nodes / Removed nodes**: id 기준 비교
- **Modified nodes**: 동일 id 의 `label, type, category, positionX, positionY, config, isDisabled, description, containerId, toolOwnerId` 중 달라진 필드명 출력
- **Added edges / Removed edges**: `source:port → target:port` key 기준

---

## 6. 복원 다이얼로그

“복원” 액션 클릭 시 확인 다이얼로그 노출:

> The current canvas will be replaced with the snapshot from vN. The replacement is itself recorded as a new version, so you can always restore back.

확인 시 `POST /workflows/:id/versions/:versionId/restore` 호출. 성공하면 `workflow-versions` 쿼리 캐시 무효화 + **페이지 리로드**(편집기 in-memory 상태와 서버 상태가 완전히 교체되므로).

---

## 7. API 스펙

### 7.1 버전 목록

`GET /workflows/:wfId/versions`

응답: `WorkflowVersion[]` (version DESC). `creator` relation 포함.

### 7.2 버전 상세

`GET /workflows/:wfId/versions/:versionId`

응답: `WorkflowVersion` 단건 + `snapshot` 포함.

스냅샷 스키마:
```ts
interface VersionSnapshot {
  name: string;
  description: string | null;
  nodes: Array<{
    id: string;
    type: string;
    category: string;
    label: string;
    positionX: number;
    positionY: number;
    config: Record<string, unknown>;
    isDisabled: boolean;
    description: string | null;
    containerId: string | null;
    toolOwnerId: string | null;
  }>;
  edges: Array<{
    id: string;
    sourceNodeId: string;
    sourcePort: string;
    targetNodeId: string;
    targetPort: string;
    type: string;
    condition: Record<string, unknown> | null;
  }>;
}
```

### 7.3 복원

`POST /workflows/:id/versions/:versionId/restore`

응답: `{ workflow, nodes, edges }` (saveCanvas 와 동일).

### 7.4 캔버스 저장

`POST /workflows/:id/save` body 에 `changeSummary?: string` 필드 추가됨. 버전 이력에 그대로 표기된다.

---

## 8. 데이터 모델

`workflow_version` 테이블 (기존 정의):

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid (PK) | |
| workflow_id | uuid (FK→workflow, ON DELETE CASCADE) | |
| version | int | `(workflow_id, version)` UNIQUE |
| snapshot | jsonb | 위 스키마 |
| change_summary | text NULL | |
| created_by | uuid (FK→user) | |
| created_at | timestamptz | |

---

## 9. 동작 보장

- 캔버스 저장과 버전 생성은 동일 사용자 관점에서 **원자적으로 보여야** 한다. 캔버스 트랜잭션 커밋 직후 버전이 생성되며, 버전 생성 실패 시 (드물지만) 이미 캔버스는 저장된 상태이므로 다음 저장에서 자동으로 따라잡힌다.
- 워크플로우 삭제 시 `ON DELETE CASCADE` 로 모든 버전이 함께 삭제된다.
- 복원으로 생성되는 새 버전의 `change_summary` 는 항상 `Restored from vN` 형식.

```

#### `spec/2-navigation/13-user-guide.md`
```
# Spec: User Guide (`/docs`)

> 관련 문서: [PRD 내비게이션](./_product-overview.md) · [Spec 레이아웃](./_layout.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 캔버스](../3-workflow-editor/0-canvas.md)

---

## 1. 목적

제품의 UI만으로는 파악이 어려운 개념(워크플로우 구조, 노드 종류, 표현식 언어, 실행/디버깅, 연동/설정)을 **제품 내부에서** 한글로 안내한다. 별도 외부 문서 사이트 대신 `/docs` 경로로 제공하여 에디터 작업 중 즉시 접근 가능하게 한다.

## 2. 정보 구조 (IA)

```
/docs
├── 01-getting-started/
│   ├── what-is-this       # 제품 소개
│   ├── ui-tour            # 화면 구성
│   └── first-workflow     # 첫 워크플로우 만들기
├── 02-nodes/
│   ├── overview           # 노드 개념
│   ├── triggers           # Trigger 노드
│   ├── logic              # Logic 노드
│   ├── flow               # Flow 노드
│   ├── data               # Data 노드
│   ├── ai                 # AI 노드
│   ├── integrations       # Integration 노드
│   └── presentation       # Presentation 노드
├── 03-workflow-editor/
│   ├── overview           # AI 어시스턴트 개요 (UI · 대화 루프 · 도구 · 세션 · v1 한계 · 오류)
│   └── walkthrough        # AI 어시스턴트 직접 써 보기 (자연어 → 4-노드 워크플로우)
├── 04-expression-language/
│   ├── basics             # 표현식 기본
│   ├── variables-and-context  # 변수·컨텍스트
│   └── cheatsheet         # 요약 치트시트
├── 05-run-and-debug/
│   ├── running-a-workflow # 실행 방법
│   ├── run-results        # 실행 이력 조회
│   ├── error-handling     # 에러 정책
│   └── version-history    # 버전 히스토리
├── 06-integrations-and-config/
│   ├── integration-management  # 통합 관리
│   ├── llm-config             # LLM 설정
│   ├── knowledge-base         # 지식 저장소
│   └── mcp-servers            # MCP 서버 통합 (AI Agent 도구 호출용)
├── 07-workspace-and-team/
│   └── workspaces-and-members  # 개인·팀 워크스페이스, 멤버 초대, 공유 표시
└── 99-faq/                     # 항상 사이드바 맨 아래 (§5 규칙)
    └── faq
```

## 3. 라우트

| 경로 | 동작 |
| --- | --- |
| `/docs` | 허브 페이지 — `/docs/01-getting-started/what-is-this`로 리다이렉트 (또는 섹션 카드 노출) |
| `/docs/[...slug]` | 동적 MDX 렌더링. 슬러그는 파일 경로와 1:1 (예: `/docs/02-nodes/ai` → `content/docs/02-nodes/ai.mdx`) |
| 존재하지 않는 슬러그 | `notFound()` 호출 → 표준 404 |

## 4. 프론트매터 스키마

모든 MDX 파일 상단에 아래 YAML 프론트매터를 둔다.

| 키 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `title` | 필수 | string | 페이지 제목. 사이드바와 본문 H1에 사용 |
| `section` | 필수 | string | 섹션 키 (예: `02-nodes`) — 디렉터리명과 일치 |
| `order` | 필수 | number | 섹션 내 정렬 기준 |
| `summary` | 필수 | string | 사이드바 미리보기 및 OG 설명 |
| `spec` | 선택 | string[] | 1차 소스 spec 파일 경로 |
| `code` | 선택 | string[] | 검증에 사용할 코드 경로(glob 허용) |
| `draft` | 선택 | boolean | true면 production 빌드에서 제외 |

예시:

```yaml
---
title: "AI 노드"
section: "02-nodes"
order: 6
summary: "자연어 처리·분류·추출 노드의 사용법을 알아봐요."
spec: ["spec/4-nodes/3-ai/0-common.md", "spec/5-system/7-llm-client.md"]
code: ["backend/src/nodes/ai/**", "frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"]
---
```

## 5. 섹션 순서

섹션 디렉터리명의 숫자 프리픽스(`01-`, `02-` ...)가 사이드바 표시 순서를 결정한다. 페이지 내 순서는 `order`로 결정한다.

**FAQ 섹션은 항상 사이드바 맨 아래에 위치한다.** 신규 섹션이 자유롭게 `08-`, `09-` ... 로 늘어나더라도 FAQ 가 아래로 밀려나도록, FAQ 디렉터리는 `99-faq` 와 같이 충분히 큰 숫자 프리픽스를 사용한다. `registry.ts` 의 `SECTION_LABELS` 도 `99-faq` 키로 라벨을 등록한다.

## 6. 딥링크 규약

- 사이드바 네비·Empty State·FieldHelp·다른 매뉴얼 페이지 간 링크 모두 `/docs/<dir>/<slug>` 형태를 따른다.
- 페이지 내 앵커는 `rehype-slug`가 헤딩 텍스트를 슬러그화한 값으로 자동 생성한다(예: `/docs/02-nodes/ai#fallback`).
- 에디터에서 매뉴얼로 이동하는 링크는 새 탭(`target="_blank"`)으로 열어 작업 맥락을 보존한다.
- 매뉴얼 간 링크는 기본 탭 전환(`<Link>`)을 사용한다.

## 7. 작성 정책

| 항목 | 규칙 |
| --- | --- |
| 독자 | 비기술자 + 개발자 모두. 각 페이지 "랜딩 → 상세 → 팁/참고" 3층 구조 |
| 문체 | 정중한 해요체. 세부 원칙은 [`_glossary.md`](../../frontend/src/content/docs/_glossary.md) |
| 소스 | `spec/*.md` 를 1차 소스로 재작성. `backend/src/nodes/**` 스키마와 `frontend/src/components/editor/settings-panel/node-configs/*` 로 필드명 검증 |
| 이미지 | 텍스트·ASCII·코드 예시 우선. 스크린샷은 후속 작업 |
| 예제 표현식 | `{{ ... }}` 문법. `@workflow/expression-engine`이 파싱 가능한 문법이어야 함 |

## 8. 공용 MDX 컴포넌트

| 컴포넌트 | 용도 |
| --- | --- |
| `<Steps>` | 순서형 가이드. 자식은 `<li>` |
| `<FieldTable>` | 필드 표. 컬럼: 이름·필수·타입·설명·기본값 |
| `<Callout type="note\|tip\|warn">` | 강조 박스 |
| `<Example>` | 코드/표현식 예제. 언어 태그 필수 |

## 9. 네비게이션 생성

빌드타임에 `frontend/src/lib/docs/registry.ts`가 `frontend/src/content/docs/**/*.mdx`를 스캔해 섹션 트리를 만든다.

- 프론트매터 `draft: true`인 파일은 production에서 제외
- `_`로 시작하는 파일·디렉터리는 스캔에서 제외(예: `_glossary.md`)
- 섹션 디렉터리에 `index.mdx`가 있으면 해당 섹션의 랜딩 페이지

## 10. 접근·표시

| 항목 | 규칙 |
| --- | --- |
| 사이드바 표시 | 모든 로그인 사용자 (권한 제한 없음) |
| 비로그인 표시 | 현재는 로그인 필수(`(main)` 그룹이 보호됨). 차후 공개 경로로 분리 가능 |
| 검색 | 현재는 미포함. 콘텐츠 증가 시 별도 추가 |
| 인쇄용 CSS | 미포함 |

## 11. 성능

| 항목 | 기준 |
| --- | --- |
| 렌더 방식 | 서버 컴포넌트에서 MDX 정적 import — 빌드 시 HTML 사전 생성 |
| 클라이언트 번들 누수 방지 | MDX 컴파일러·`fs` 접근은 서버 전용. `'use client'` 파일에서 `@/content/**` import 금지 |
| 빌드 시 검증 | `registry.ts` 단위 테스트에서 모든 `spec:`/`code:` 경로 존재 확인 |

## 12. 품질 체크 (배포 전)

- 모든 MDX 프론트매터의 `spec:`/`code:` 경로 실존
- 용어 사전 준수(금지어 검사)
- 모든 내부 `/docs/...` 링크가 실존 slug
- `FieldHelp` 딥링크 앵커가 실존
- 페이지별 3층 구조 준수
- 해요체 일관성

```

#### `spec/2-navigation/14-execution-history.md`
```
# Spec: 워크플로우 실행 내역

> 관련 문서: [PRD 실행 내역](./14-execution-history.md) · [Spec 대시보드](./0-dashboard.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

---

## Overview (제품 정의)

> 출처: `prd/7-execution-history.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

---

### 1. 개요

워크플로우 실행 내역 기능은 사용자가 특정 워크플로우의 모든 실행 이력을 조회하고, 개별 실행의 노드별 상세 결과를 확인할 수 있는 기능이다. 대시보드, 워크플로우 목록, 에디터 등 다양한 진입점에서 접근할 수 있다.

#### 1.1 배경

현재 실행 결과는 워크플로우 에디터 내부에서만 확인할 수 있어, 과거 실행 이력을 돌아보거나 특정 워크플로우의 실행 패턴을 파악하기 어렵다. 대시보드의 Recent Executions에서 워크플로우를 클릭해도 아무 동작이 없으며, 실행 이력을 체계적으로 탐색할 수 있는 별도의 화면이 필요하다.

#### 1.2 목표

- 워크플로우별 실행 이력을 한눈에 파악
- 개별 실행의 노드별 상세 결과 확인 (I/O 데이터, 에러, 타임라인)
- 실패한 실행의 원인을 빠르게 진단
- 기존 화면(대시보드, 워크플로우 목록, 에디터)과 자연스러운 네비게이션

---

### 2. 페이지 구조

2단계 구조로 구성한다:

```
/workflows/:id/executions              → 워크플로우별 실행 내역 목록
/workflows/:id/executions/:executionId → 개별 실행 상세
```

---

### 3. 요구사항

#### 3.1 실행 내역 목록 페이지

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-LIST-01 | 해당 워크플로우의 전체 실행 이력을 테이블 형태로 표시 | 필수 | ✅ |
| EH-LIST-02 | 각 행에 상태, 시작 시간, 소요 시간, 트리거 유형 표시 | 필수 | ✅ |
| EH-LIST-03 | 상태별 필터링 (All, Completed, Failed, Running, Cancelled, Waiting for Input) | 필수 | ✅ |
| EH-LIST-04 | 정렬 지원 (시작 시간, 소요 시간, 상태) | 필수 | ✅ |
| EH-LIST-05 | 페이지네이션 (페이지당 20건) | 필수 | ✅ |
| EH-LIST-06 | 행 클릭 시 실행 상세 페이지로 이동 | 필수 | ✅ |
| EH-LIST-07 | 헤더에 워크플로우 이름, 에디터로 이동 링크 표시 | 필수 | ✅ |
| EH-LIST-08 | 실행 이력이 없을 때 빈 상태 안내 표시 | 필수 | ✅ |

#### 3.2 실행 상세 페이지

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-DETAIL-01 | 실행 요약 정보 표시 (상태, 시작/종료 시간, 소요 시간, 노드 실행 현황) | 필수 | ✅ |
| EH-DETAIL-02 | 노드 결과 패널: 좌측 노드 목록 + 우측 노드 상세 (2분할 레이아웃) | 필수 | ✅ |
| EH-DETAIL-03 | 노드 상세 서브 탭: Preview / Input / Output / Config / Error. AI 노드는 LLM Usage 탭 추가. AI Multi Turn 타임라인에서 assistant 메시지 선택 시 Preview / Response / Request / LLM Usage 구성으로 전환 | 필수 | ✅ |
| EH-DETAIL-04 | 실패한 노드 하이라이트 및 에러 메시지 표시 | 필수 | ✅ |
| EH-DETAIL-05 | Skipped 상태 노드는 목록에서 제외 | 필수 | ✅ |
| EH-DETAIL-06 | Preview 탭: Presentation 노드는 시각적 프리뷰, AI Agent 노드는 대화 내역 + 메시지별 상세, 일반 노드는 상태 요약 | 필수 | ✅ |
| EH-DETAIL-07 | Preview 탭: 버튼이 있는 노드는 모든 버튼 표시 + 선택된 버튼 하이라이트 | 필수 | ✅ |
| EH-DETAIL-08 | 실행 목록으로 돌아가기 네비게이션 | 필수 | ✅ |
| EH-DETAIL-09 | 이전/다음 실행으로 이동 | 권장 | ✅ |
| EH-DETAIL-10 | 실행 상세 헤더에 "Re-run" 버튼 + 입력 미리보기·편집 모달. dry-run 토글 포함. 권한·dry-run 미지원 시 disabled + tooltip. 모달 명세는 [Spec Re-run §10.2](../5-system/13-replay-rerun.md#102-re-run-모달) | 필수 | 🚧 명세 ✅ / 구현 PR2 |
| EH-DETAIL-11 | Re-run chain 표시 — `re_run_of != null` 인 실행은 chain badge ("#N-th re-run · dry-run · 원본: <ID>") + "View chain" 드롭다운. 모델은 [Spec Re-run §RR-PL-05](../5-system/13-replay-rerun.md#rr-pl-05--chain-추적-모델-e3) | 필수 | 🚧 명세 ✅ / 구현 PR2 |

#### 3.3 진입점

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-NAV-01 | Dashboard의 Recent Executions 행 클릭 시 해당 실행의 상세 페이지로 이동 | 필수 | ✅ |
| EH-NAV-02 | Workflow List 페이지에서 각 워크플로우의 실행 내역 링크 제공 | 필수 | ✅ |
| EH-NAV-03 | 워크플로우 에디터에서 과거 실행 내역 페이지로 이동 링크 제공 | 필수 | ✅ |
| EH-NAV-04 | 에디터의 AI Assistant 가 read-only 도구로 현재 워크플로의 실행 목록/상세 조회 가능 (상세: [Spec 3-workflow-editor §10.9 ED-AI-35~38](../3-workflow-editor/_product-overview.md#109-실행-결과-조회-진단수정)) | 필수 | ✅ (`get_workflow_executions` / `get_execution_details` 도구 — `workflow-assistant/tools/explore-tools.service.ts`. 직계 자식 1 depth 포함 + `subExecutionsTruncatedDepth` 힌트, `maskSensitiveFields` 자동 마스킹, running / waiting_for_input 부분 타임라인 허용) |

---

## 1. 개요

워크플로우 실행 내역은 두 개의 페이지로 구성된다:

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 실행 내역 목록 | `/workflows/:id/executions` | 특정 워크플로우의 모든 실행 이력 |
| 실행 상세 | `/workflows/:id/executions/:executionId` | 개별 실행의 노드별 상세 결과 |

두 페이지 모두 `(main)` 레이아웃 그룹에 속한다 (사이드바 포함).

---

## 2. 실행 내역 목록 페이지

### 2.1 화면 구성

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Back    Data Sync Workflow — Executions    [Open in Editor →]  │
│  ──────────────────────────────────────────────────────────────── │
│                                                                    │
│  [All] [Completed] [Failed] [Running] [Cancelled] [Waiting]       │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Status   │ Started At          │ Duration │ Nodes          │   │
│  │──────────│─────────────────────│──────────│────────────────│   │
│  │ ✅ Done  │ 2024-01-15 14:02:30 │ 3.2s     │ 5/5            │   │
│  │ ❌ Fail  │ 2024-01-15 13:55:10 │ 1.0s     │ 2/5 (1 failed) │   │
│  │ ✅ Done  │ 2024-01-15 12:30:00 │ 5.1s     │ 3/3            │   │
│  │ ✅ Done  │ 2024-01-14 18:00:00 │ 2.8s     │ 4/4            │   │
│  │ ⏳ Run   │ 2024-01-14 17:55:00 │ —        │ 1/5            │   │
│  │ ...      │                     │          │                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ← 1  2  3  ...  10 →                                            │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 헤더

| 요소 | 설명 |
|------|------|
| Back 링크 | 이전 페이지로 돌아가기 (`router.back()`) |
| 워크플로우 이름 | 해당 워크플로우의 이름 표시 |
| "Open in Editor" 링크 | `/workflows/:id` (에디터)로 이동 |

### 2.3 필터

상태 필터 버튼을 가로로 배치한다. 선택된 필터는 활성 스타일(`variant="default"`)로, 나머지는 비활성 스타일(`variant="outline"`)로 표시한다.

| 필터 | 값 | 설명 |
|------|----|------|
| All | (필터 없음) | 모든 실행 표시 (기본값) |
| Completed | `completed` | 완료된 실행만 |
| Failed | `failed` | 실패한 실행만 |
| Running | `running` | 실행 중인 것만 |
| Cancelled | `cancelled` | 취소된 실행만 |
| Waiting | `waiting_for_input` | 입력 대기 중인 것만 |

### 2.4 테이블

| 열 | 설명 | 정렬 |
|----|------|------|
| Status | 상태 아이콘 + 텍스트 (`✅ Completed`, `❌ Failed`, `⏳ Running`, `⛔ Cancelled`, `🙋 Waiting`) | 가능 |
| Trigger | 실행 출처(어디서 트리거 되었는지) — 아이콘 + 출처 라벨 + 보조 라벨 (트리거명/실행자/부모 워크플로명) | — |
| Started At | 실행 시작 시각 (`YYYY-MM-DD HH:mm:ss`) | 가능 (기본: 내림차순) |
| Duration | 실행 소요 시간 (초/분 자동 전환). 실행 중이면 `—` 표시 | 가능 |
| Nodes | 노드 실행 현황 (`완료 수/전체 수`, 실패 시 `(N failed)` 추가) | — |

#### Trigger 출처 분류

`Execution.trigger_id`, `Execution.executed_by`, `Execution.parent_execution_id` 와 `Trigger.type` 으로 다음 5가지 출처(`triggerSource`) 중 하나로 정규화한다. 판정 우선순위는 표 위에서 아래 순서.

| source | 판정 규칙 | 아이콘 | 라벨 (출처) | 보조 라벨 |
|--------|-----------|--------|-------------|------------|
| `subworkflow` | `parent_execution_id != null` | GitBranch | 서브 워크플로우 | 부모 실행의 `workflow.name` |
| `manual` | 위에 해당 없음 + `executed_by != null` | User | 수동 실행 | 실행자 `User.name` (없으면 `email`) |
| `schedule` | 위에 해당 없음 + `trigger_id != null` && `Trigger.type === 'schedule'` | Clock | 스케줄 | `Trigger.name` |
| `webhook` | 위에 해당 없음 + `trigger_id != null` && `Trigger.type === 'webhook'` | Webhook | Webhook | `Trigger.name` |
| `unknown` | 그 외 (구 데이터 fallback) | HelpCircle | — | — |

응답 DTO 는 위 분류 결과를 `triggerSource` (enum) 와 `triggerLabel` (보조 라벨, 없으면 null) 로 노출한다.

| 동작 | 설명 |
|------|------|
| 행 클릭 | `/workflows/:id/executions/:executionId`로 이동 |
| 행 호버 | `hover:bg-[hsl(var(--muted))/0.5]` 배경 |

### 2.5 정렬

- 테이블 헤더 클릭으로 정렬 토글 (오름차순 ↔ 내림차순)
- 현재 정렬 열에 화살표 아이콘 표시
- 기본 정렬: `started_at` 내림차순

### 2.6 페이지네이션

- 페이지당 20건
- 이전/다음 버튼 + 페이지 번호 버튼
- 기존 워크플로우 목록 페이지와 동일한 패턴 사용
- 필터 변경 시 1페이지로 리셋

### 2.7 빈 상태

실행 이력이 없을 때:

```
┌────────────────────────────────────┐
│         (Activity 아이콘)           │
│                                    │
│   No executions yet               │
│   Run this workflow to see         │
│   execution history here.          │
│                                    │
│   [Open in Editor →]              │
└────────────────────────────────────┘
```

### 2.8 로딩 상태

- 테이블 영역에 스켈레톤 로더 표시 (`animate-pulse`)
- 5행의 스켈레톤 행 표시

---

## 3. 실행 상세 페이지

### 3.1 화면 구성

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Executions                              [← Prev] [Next →]     │
│  ──────────────────────────────────────────────────────────────── │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ ✅ Completed                                                  │ │
│  │ Started: 2024-01-15 14:02:30  Finished: 14:02:33  Dur: 3.2s │ │
│  │ Nodes: 10/10 completed                                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────┬──────────────────────────────────┐     │
│  │ Nodes                │ Carousel                  carousel│     │
│  │ ──────────────────── │                                  │     │
│  │ ✅ Manual Trigger    │ [Preview]  Input  Output         │     │
│  │ ✅ Carousel     ←    │ ──────────────────────────────── │     │
│  │ ✅ Template          │ Preview                          │     │
│  │ ✅ AI Agent          │ ┌────────────────────────────┐   │     │
│  │ ✅ Template          │ │ (Carousel 시각적 프리뷰)    │   │     │
│  │                      │ └────────────────────────────┘   │     │
│  │                      │ [버튼1] [▉ 선택된 버튼] [버튼3]  │     │
│  └──────────────────────┴──────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 실행 요약 카드

| 필드 | 설명 |
|------|------|
| 상태 | 아이콘 + 텍스트 (배지 스타일) |
| 시작 시간 | `YYYY-MM-DD HH:mm:ss` |
| 종료 시간 | `HH:mm:ss` (같은 날이면 시간만) 또는 `—` (미완료) |
| 소요 시간 | 초/분 자동 전환 |
| 노드 실행 현황 | `완료 수 / 전체 수 completed` (실패 시 `N failed` 추가) |

실패 상태일 때 요약 카드에 에러 메시지를 추가 표시:

```
┌──────────────────────────────────────────────────────────────┐
│ ❌ Failed                                                     │
│ Started: 2024-01-15 13:55:10  Finished: 13:55:11  Dur: 1.0s │
│ Nodes: 3/10 completed, 1 failed                              │
│                                                               │
│ Error: Connection timeout on "API Call" node                  │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 노드 결과 패널

요약 카드 하단에 좌우 2분할 레이아웃으로 노드 목록과 상세 정보를 표시한다.
Skipped 상태의 노드는 목록에서 제외한다.

**좌측 패널 (노드 목록)**:
- 실행된 노드만 상태 아이콘과 함께 목록으로 표시 (skipped 제외)
- 선택된 노드 하이라이트

**우측 패널 (노드 상세)**:
- 노드 이름, 타입 배지, 상태, 소요 시간
- 서브 탭(노드 레벨): **Preview** / Input / Output / **LLM Usage** (AI 노드에서만) / Config / Error (에러가 있을 때만)
- AI Multi Turn 타임라인에서 assistant 메시지를 선택하면 탭이 메시지 레벨로 전환: **Preview** / **Response** / **Request** / **LLM Usage**
- 기본 선택 탭: 에러면 Error, outputData가 있으면 Preview, 그 외 Output

### 3.4 Preview 탭

노드 유형에 따라 다른 방식으로 시각적 프리뷰를 제공한다. Output Data JSON은 별도 Output 탭에서 확인한다.

#### Presentation 노드 (table, carousel, chart, template, form)

에디터 실행 시와 동일한 시각적 렌더링을 제공한다:
- **Table**: 테이블 형태로 rows/columns 표시
- **Carousel**: 카드 슬라이드 또는 rendered HTML
- **Chart**: SVG/rendered HTML 차트
- **Template**: 포맷(html/markdown/text)에 따른 프리뷰
- **Form**: 제출된 form 데이터 표시

#### 버튼이 있는 노드

- 노드의 `buttonConfig.buttons`에서 전체 버튼 목록을 표시
- 실행 완료 후 선택된 버튼(`buttonId` 매칭)은 primary 색상으로 하이라이트
- 미선택 버튼은 outline 스타일로 비활성 표시

#### AI Agent / Information Extractor (multi-turn) 노드

완료된 대화를 채팅 스레드 형태로 표시한다:
- 턴 카운터, 종료 사유 표시
- User/Assistant 메시지를 버블 형태로 나열
- Tool Call 배지 (접기/펼치기)
- **메시지 클릭**: 개별 메시지 상세 content만 inline 표시. assistant 메시지의 원문 요청/응답/사용량은 상세 패널의 **Response / Request / LLM Usage** 탭으로 노출 (Preview 탭은 대화 스레드에 집중)
  - Assistant 메시지: 본문 + tool call 배지만 표시
  - User 메시지: 메시지 내용 + 타임스탬프
  - Tool 메시지: 인자 + 결과
- **"← Back to conversation"** 버튼으로 스레드 뷰 복귀

#### 일반 노드

- 상태 (Status), 소요 시간 (Duration) 표시
- 에러가 있으면 에러 메시지 표시

### 3.4.1 Output 탭 — AI 노드 확장

AI 노드(AI Agent, Information Extractor, Text Classifier)의 Output 탭은 일반 JSON 덤프에 더해 다음 요소를 상단에 표시한다:
- **AI Metadata Grid** — Model, Total/Request/Response/Thinking Tokens, Turn Count(멀티턴), Tool Calls(AI Agent)
- **Extracted Fields Card** (Info Extractor 전용) — 수집된 각 필드를 라벨-값 테이블로 표시. 미수집 필드는 dim "—" 로 placeholder. waiting 상태에서는 재수집 횟수(`재수집 n/m`)도 상단에 표시

### 3.4.2 LLM Usage / Response / Request 탭

AI 노드(AI Agent, Information Extractor, Text Classifier) 에서만 표시되는 최상위 탭 집합. 이전에는 단일 `LLM Information` 탭 아래 `Response / Request / Usage` 하위 탭 구조였으나, 메시지를 선택할 때의 두 번 클릭 불편을 없애기 위해 평탄화되었다.

**노드 레벨 (타임라인에서 메시지 미선택)**:
- `LLM Usage` 탭 하나만 노출. 노드 전체 집계(Model / Total / Request / Response / Thinking Tokens / Turn Count / Tool Calls / LLM Calls)
- 백엔드 핸들러가 per-call trace(`_llmCalls` 또는 `_turnDebugHistory`)를 persist 하지 않은 실행(이전 버전 기록 포함)은 "정보 없음" placeholder

**메시지 레벨 (AI Agent · Information Extractor Multi Turn 에서 assistant 메시지 선택)**:
- **Response** — 해당 턴 LLM 호출의 `responsePayload` 전체 JSON
- **Request** — 해당 턴 LLM 호출의 `requestPayload` 전체 JSON (model, messages, tools, responseFormat 등)
- **LLM Usage** — 선택한 call의 Model, Input/Output/Total/Thinking Tokens, Latency
- **Call selector**: 동일 턴에 LLM 호출이 2개 이상일 때(tool-call 루프, Info Extractor 재수집 iteration) 각 탭 상단에 드롭다운. 선택은 Response ↔ Request ↔ LLM Usage 탭 전환 사이에도 유지됨. 호출이 1개뿐이면 드롭다운은 숨김

### 3.5 에러 및 상태 처리

| 상태 | 표시 |
|------|------|
| Loading | 스켈레톤 로더 (3개 블록) |
| API Error | "Failed to load execution. Please try again." + Back 버튼 |
| Not Found | "Execution not found." + Back 버튼 |

### 3.6 이전/다음 실행 네비게이션

- 실행 상세 페이지 헤더 우측에 `← Prev` / `Next →` 버튼
- 같은 워크플로우의 시간 순서 기준으로 이전/다음 실행으로 이동
- 첫 번째/마지막 실행에서는 해당 버튼 비활성화

### 3.7 Re-run 액션

실행 요약 카드 우측 헤더에 "Re-run" 버튼을 표시한다. 클릭 시 입력 데이터 미리보기·편집 모달이 열리며, dry-run 토글로 외부 호출을 skip 한 흐름 검증도 가능하다.

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Executions       [⟳ Re-run]   [← Prev] [Next →]                │
│ ──────────────────────────────────────────────────────────────── │
│  ✅ Completed                                                     │
│  Started: 2026-05-13 09:14:02   Duration: 3.2s                   │
│  Nodes: 10/10 completed                                          │
│  ─                                                                │
│  📎 #3-th re-run · dry-run · 원본: #1234   [View chain (4) ▼]   │
└──────────────────────────────────────────────────────────────────┘
```

| 요소 | 표시 조건 | 동작 |
| --- | --- | --- |
| `[⟳ Re-run]` 버튼 | 항상 표시 | 권한 미충족 시 disabled + tooltip `history.rerun.permissionDenied` (정책 [RR-PL-06](../5-system/13-replay-rerun.md#rr-pl-06--권한-f)). 클릭 시 [Spec Re-run §10.2 모달](../5-system/13-replay-rerun.md#102-re-run-모달) |
| Chain badge | `execution.reRunOf != null` | "#N-th re-run · 원본: <ID>". dry-run 이면 "· dry-run" 부착. 원본 ID 클릭 시 새 탭으로 원본 상세 |
| `[View chain (N) ▼]` 드롭다운 | chain 의 실행이 2개 이상 | 클릭 시 `GET /api/v1/executions/:id/chain` 응답을 펼침. 각 항목은 ID, 시작 시각, 최종 상태, dry-run 여부 |

모달이 "재실행" 버튼을 누르면 `POST /api/v1/executions/:executionId/re-run` 응답의 새 Execution ID 로 같은 워크스페이스 라우터에서 `/workflows/:workflowId/executions/:newId` 로 이동한다.

i18n 키와 에러 매핑은 [Spec Re-run §10.4 i18n 키](../5-system/13-replay-rerun.md#104-i18n-키) 참조.

---

## 4. 진입점

### 4.1 Dashboard — Recent Executions

| 변경 사항 | 설명 |
|-----------|------|
| 행 클릭 핸들러 | 클릭 시 `/workflows/:workflowId/executions/:executionId`로 이동 (개별 실행 상세) |
| 커서 스타일 | `cursor-pointer` 추가 |

### 4.2 Workflow List

| 변경 사항 | 설명 |
|-----------|------|
| 실행 내역 링크 | 각 워크플로우 행의 컨텍스트 메뉴(⋯)에 "Execution History" 항목 추가 |
| 클릭 동작 | `/workflows/:id/executions`로 이동 |

### 4.3 Workflow Editor

| 변경 사항 | 설명 |
|-----------|------|
| 실행 내역 링크 | 실행 결과 영역(Run Results)에 "View All Executions" 링크 추가 |
| 클릭 동작 | `/workflows/:id/executions`로 이동 |

---

## 5. API 엔드포인트

모든 API는 이미 구현되어 있으며, 추가 백엔드 작업은 불필요하다.

| 메서드 | 경로 | 설명 | 비고 |
|--------|------|------|------|
| GET | `/api/executions/workflow/:workflowId` | 워크플로우별 실행 목록 | 페이지네이션, 상태 필터, 정렬 지원. 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| GET | `/api/executions/:id` | 실행 상세 (노드 실행 포함) | nodeExecutions 배열 포함 |
| POST | `/api/v1/executions/:executionId/re-run` | 원본 실행 기반 새 Execution 시작 | EH-DETAIL-10. 명세는 [Spec Re-run §8.1](../5-system/13-replay-rerun.md#81-post-apiv1executionsexecutionidre-run). 구현은 PR2 |
| GET | `/api/v1/executions/:executionId/chain` | 같은 chain 의 모든 실행을 시간 순으로 반환 | EH-DETAIL-11. 명세는 [Spec Re-run §8.2](../5-system/13-replay-rerun.md#82-get-apiv1executionsexecutionidchain). 구현은 PR2 |

**목록 API 쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | number | 1 | 페이지 번호 |
| `limit` | number | 20 | 페이지당 건수 (max: 100) |
| `sort` | string | `started_at` | 정렬 기준 (`started_at`, `finished_at`, `status`, `duration_ms`) |
| `order` | string | `desc` | 정렬 순서 (`asc`, `desc`) |
| `status` | string | — | 상태 필터 |

**목록 API 응답 형식:**

```json
{
  "data": [
    {
      "id": "uuid",
      "workflowId": "uuid",
      "status": "completed",
      "startedAt": "2024-01-15T14:02:30Z",
      "finishedAt": "2024-01-15T14:02:33Z",
      "durationMs": 3200,
      "inputData": {},
      "outputData": {},
      "error": null,
      "triggerSource": "schedule",
      "triggerLabel": "매일 오전 9시 보고서",
      "triggerId": "uuid",
      "executedBy": null,
      "parentExecutionId": null,
      "nodeExecutions": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 87,
    "totalPages": 5
  }
}
```

**상세 API 응답 — nodeExecutions:**

```json
{
  "id": "uuid",
  "executionId": "uuid",
  "nodeId": "node-1",
  "status": "completed",
  "startedAt": "2024-01-15T14:02:30Z",
  "finishedAt": "2024-01-15T14:02:31Z",
  "durationMs": 800,
  "inputData": { "key": "value" },
  "outputData": { "result": "..." },
  "error": null,
  "retryCount": 0,
  "node": {
    "id": "node-1",
    "type": "transform",
    "label": "Data Transform"
  }
}
```

---

## 6. 반응형

| 브레이크포인트 | 레이아웃 |
|----------------|----------|
| ≥ 1280px | 기본 레이아웃 |
| 768px ~ 1279px | Node Results 2분할 → 세로 스택 |
| < 768px | 전체 세로 스택, 테이블 → 카드형 목록 |

---

## 7. 라우팅

```
frontend/src/app/(main)/workflows/[id]/executions/
├── page.tsx                    # 실행 내역 목록 페이지
└── [executionId]/
    └── page.tsx                # 실행 상세 페이지
```

```

#### `spec/2-navigation/2-trigger-list.md`
```
# Spec: 트리거 목록 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#32-trigger-list-트리거-목록) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - Trigger](../1-data-model.md#28-trigger)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Triggers                                               │
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────┐       │
│  │ 🔍 Search...     │  │ Type: All ▼           │       │
│  └──────────────────┘  └────────────────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ● order-webhook          Webhook    Active          │ │
│  │   → Order Processing     POST /hooks/order  📋  ⋮  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ● daily-report  [Schedule] Schedule   Active          │ │
│  │   → Daily Report Gen     0 9 * * *  Next: 09:00 ⋮  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ○ manual-test            Manual     Inactive        │ │
│  │   → Test Workflow                             ⋮     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 트리거 목록 항목

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | Active(●) / Inactive(○) |
| 트리거 이름 | 사용자가 지정한 트리거 이름 |
| 유형 뱃지 | Webhook / Schedule / Manual |
| 연결된 워크플로우 | "→ 워크플로우 이름" 형태로 표시. 클릭 시 해당 에디터로 이동 |
| 상세 정보 | Webhook: HTTP 메서드 + 경로, Schedule: Cron 표현식 |
| Schedule 태그 | Schedule 유형 트리거에 `[Schedule]` 태그 표시 + Cron 표현식 + 다음 실행 시각 |
| URL 복사 버튼(📋) | Webhook 트리거에만 표시. 전체 URL을 클립보드에 복사 |
| 더보기(⋮) | 수정, 활성/비활성 토글, 호출 이력, 삭제 |

### 2.2 필터

| 필터 | 옵션 |
|------|------|
| 유형 | 전체 / Webhook / Schedule / Manual |
| 상태 | 전체 / Active / Inactive |

### 2.3 트리거 상세 패널 (항목 클릭 시)

우측 슬라이드 패널로 상세 정보를 표시한다.

| 섹션 | 내용 |
|------|------|
| 기본 정보 | 이름, 유형, 상태, 연결된 워크플로우 |
| Webhook 상세 | 전체 URL, HTTP 메서드, 인증 방식, Content-Type |
| Schedule 상세 | Cron 표현식 (읽기 전용), 타임존, 다음 실행 예정 시각. "스케줄 관리에서 편집" 링크 → Schedule 화면으로 이동 |
| 최근 호출 이력 | 최근 10건의 호출 시각, 상태(성공/실패), 응답 코드 |
| 인증 설정 | 연결된 AuthConfig 정보 |

### 2.4 Webhook URL 형식

```
{base_url}/hooks/{endpoint_path}
```

- `base_url`: SaaS의 경우 서비스 도메인, 셀프 호스팅의 경우 설정된 도메인
- `endpoint_path`: Trigger.endpoint_path 값

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/triggers | 목록 조회 (쿼리: type, status, search, page, limit, sort, order). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| GET | /api/triggers/:id | 트리거 상세 조회 |
| PATCH | /api/triggers/:id | 트리거 수정 |
| PATCH | /api/triggers/:id/toggle | 활성/비활성 토글 |
| GET | /api/triggers/:id/history | 호출 이력 조회 |
| DELETE | /api/triggers/:id | 트리거 삭제 |

> **참고**: 트리거 생성은 워크플로우 에디터에서 수행. 트리거 목록 화면에서는 관리(조회/수정/삭제)만 담당.
> **참고**: Schedule 유형 트리거는 Trigger 화면에서 직접 생성할 수 없다. Schedule 화면에서만 생성 가능하며, 생성 시 자동으로 Trigger가 등록된다. ([스케줄 관리](./3-schedule.md#3-trigger-자동-생성-규칙) 참조)

```

#### `spec/2-navigation/3-schedule.md`
```
# Spec: 스케줄 관리 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#33-schedule-스케줄) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - Schedule](../1-data-model.md#29-schedule)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Schedule                           [+ Add Schedule]    │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ 🔍 Search...     │  │ View: List ▼    │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ● Daily Report                                      │ │
│  │   0 9 * * *  →  "매일 오전 9:00"                    │ │
│  │   → Daily Report Gen    Next: 2026-03-27 09:00  ⋮  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ● Weekly Sync                                       │ │
│  │   0 0 * * 1  →  "매주 월요일 자정"                  │ │
│  │   → Data Sync           Next: 2026-03-30 00:00  ⋮  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 스케줄 목록 항목

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | Active(●) / Inactive(○) |
| 스케줄 이름 | 사용자 지정 이름 |
| Cron 표현식 | 원본 Cron 표현식 |
| 사람이 읽을 수 있는 설명 | Cron 표현식을 자연어로 변환한 설명 |
| 연결된 워크플로우 | "→ 워크플로우 이름". 클릭 시 에디터로 이동 |
| 다음 실행 시각 | 다음 예정된 실행 시각 (절대 시간) |
| 더보기(⋮) | 수정, 활성/비활성, 즉시 실행, 실행 이력, **트리거에서 보기** (→ Trigger 목록에서 해당 트리거로 이동), 삭제 |

### 2.2 스케줄 생성/수정 다이얼로그

| 필드 | 설명 |
|------|------|
| 이름 | 스케줄 이름 (필수) |
| 워크플로우 | 연결할 워크플로우 선택 (드롭다운) |
| Cron 표현식 | 직접 입력 또는 시각적 편집기 (탭으로 전환). 두 모드는 단일 cron 값을 공유하며 양방향 자동 변환 (§2.2.1). |
| 시각적 편집기 | 빈도(분/시/일/주/월) 선택 → 세부 시간 설정 UI |
| 안내 메시지 | "스케줄을 생성하면 트리거 목록에 자동 등록됩니다" 인포 텍스트 |
| 사람이 읽을 수 있는 미리보기 | Cron 변환 결과 실시간 표시 |
| 다음 5회 실행 시각 | 설정된 Cron에 따른 예정 실행 시각 미리보기 |
| 타임존 | IANA 타임존 선택 (기본: 워크스페이스 설정) |

#### 2.2.1 표현식 ↔ 시각 편집 자동 변환

두 탭 사이를 전환해도 사용자의 설정값이 손실되지 않는다. 변환 가능 패턴은 시각 편집기가 produce 할 수 있는 5개 단순 형태에 한정한다.

| 변환 방향 | 동작 |
|-----------|------|
| Visual 컨트롤 변경 | `buildCronFromVisual(state)` 로 cron 을 즉시 재생성하여 표현식과 시각 state 가 동기화된다. |
| 표현식 입력 | 입력값을 `parseCronToVisualOrNull(cron)` 으로 분해한다. 매칭되면 시각 state 도 갱신; 매칭되지 않으면 시각 state 는 직전 값을 그대로 둔다. |
| 빈 cron 에서 시각 탭 진입 | 디폴트 시각 state(`daily 09:00`) 의 cron 을 즉시 적용해 사용자가 추가 행동 없이도 저장 가능. |

**시각 편집기가 표현 가능한 cron 패턴**

| 패턴 | 의미 |
|------|------|
| `* * * * *` | 매 분 |
| `M * * * *` | 매 시간, M 분 |
| `M H * * *` | 매일 H:M |
| `M H * * D[,D...]` | 매주 선택된 요일 (D ∈ 0..6) H:M |
| `M H D * *` | 매월 D일 H:M |

**표현 불가 cron** (step `*/N`, range `H-H`, list-with-range, month 지정 등) 은 시각 탭에서 안내 메시지를 표시하며, 사용자가 시각 컨트롤을 변경할 때까지 표현식은 보존된다.

> 변환 유틸: `frontend/src/lib/utils/cron-to-visual.ts` 의 `parseCronToVisualOrNull` / `buildCronFromVisual`. 시각 편집기 컴포넌트는 controlled 패턴으로 부모(다이얼로그)에 시각 state 를 lift 한다.

### 2.3 캘린더 뷰 (선택적)

- 뷰 전환 토글: List / Calendar
- 월간 캘린더에 예정된 실행을 점/이벤트로 표시
- 날짜 클릭 시 해당 일의 스케줄 상세 표시

---

## 3. Trigger 자동 생성 규칙

Schedule은 [Trigger의 서브타입](../1-data-model.md#291-trigger--schedule-동기화-규칙)이다. 라이프사이클 전반에서 동기화된다.

| 이벤트 | 동작 |
|--------|------|
| Schedule 생성 | 동일 이름/워크플로우/활성 상태의 Trigger(type=schedule)를 자동 생성 |
| Schedule 이름 수정 | 연결된 Trigger 이름 동기화 |
| Schedule 활성/비활성 | 연결된 Trigger is_active 동기화 (역방향도 동일) |
| Schedule 삭제 | 연결된 Trigger cascade 삭제 (확인 다이얼로그에 "연결된 트리거도 함께 삭제됩니다" 안내) |

**제약:**
- Schedule 유형 트리거는 Trigger 화면에서 직접 생성 불가 — 반드시 Schedule 화면에서 생성
- Schedule 화면에서 삭제 시 Trigger도 함께 삭제됨 (역방향: Trigger 삭제 시 Schedule도 삭제)

---

## 4. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/schedules | 목록 조회 (쿼리: page, limit, sort, order, search). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/schedules | 스케줄 생성 |
| GET | /api/schedules/:id | 상세 조회 |
| PATCH | /api/schedules/:id | 수정 |
| PATCH | /api/schedules/:id/toggle | 활성/비활성 토글 |
| POST | /api/schedules/:id/run-now | 즉시 실행 (manual 라벨로 기록) |
| DELETE | /api/schedules/:id | 삭제 |
| GET | /api/schedules/:id/preview | 다음 N회 실행 시각 미리보기 |

---

## 5. 실행 출처 기록 규약

| 발화 경로 | Execution 행에 채우는 값 | 트리거 출처 분류 결과 |
|-----------|--------------------------|------------------------|
| Cron 자동 발화 (`ScheduleRunnerService.process`) | `trigger_id = schedule.triggerId` | `schedule` ([실행 내역 §2.4](./14-execution-history.md#24-테이블)) |
| "지금 실행" 버튼 (`SchedulesService.runNow`) | `executed_by = userId` | `manual` |

상세 시그니처는 [Spec 실행 엔진 §6.1.1](../5-system/4-execution-engine.md#611-트리거-입력-파라미터-seeding) 참조. cron 자동 발화 시 `trigger_id` 가 비어 있으면 "최근 실행" 화면이 출처를 unknown 으로 분류하므로 반드시 채워야 한다.

```

#### `spec/2-navigation/4-integration.md`
```
# Spec: 통합 관리 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#34-integration-통합) · [PRD 통합/연동](../4-nodes/4-integration/_product-overview.md) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - Integration](../1-data-model.md#210-integration) · [데이터 모델 - IntegrationUsageLog](../1-data-model.md#2101-integrationusagelog) · [PRD 노드 시스템 §Integration 노드](../4-nodes/_product-overview.md#7-integration-노드-3종)

---

## 1. 라우트 구성

| 경로 | 설명 |
|------|------|
| `/integrations` | 연동 목록 (기본 진입점) |
| `/integrations/new?service=<type>&step=auth` | 연동 추가 위저드 — Step 1(서비스 선택)은 목록 모달에서 처리, Step 2(인증)부터 이 페이지로 진입 |
| `/integrations/[id]` | 상세 페이지 |

**설계 배경**: 서비스 선택 같은 가벼운 단계는 목록의 모달로 진입 비용을 낮추고, OAuth 팝업 복귀·딥링크가 필요한 인증 단계부터는 독립 라우트에서 상태를 복원한다.

---

## 2. 목록 페이지 (`/integrations`)

### 2.1 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Integrations                    [+ Add Integration]    │
│                                                         │
│  ⚠ 3 integrations need attention                        │
│     Expired 1 · Expiring 1 · Error 1 · Click to filter  │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ 🔍 Search...     │  │ Scope: All ▼     │             │
│  └──────────────────┘  └──────────────────┘             │
│  [All] [Google] [GitHub] [HTTP] [DB] [Email] [Webhook]
│  [All] [Attention] [Connected] [Expiring] [Expired] [Error] │
│                                                         │
│  Organization                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🟢 Google - Team Account      OAuth2   Connected      ⋮ │ │
│  │ 🟡 Google - Drive        OAuth2   Expires in 2d  ⋮ │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  Personal                                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🔴 GitHub - My Account   OAuth2   Auth failed    ⋮ │ │
│  │ 🟢 HTTP - Internal API   API Key  Connected      ⋮ │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2.2 항목 요소

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | 🟢 connected / 🟡 expiring(7일 이내)·expired / 🔴 error(reason) / ⏳ pending_install |
| 서비스 아이콘 | 서비스 유형별 로고 |
| 별칭 | 사용자가 지정한 이름 (`Integration.name`) |
| 인증 유형 | auth_type을 대문자/공백 정리하여 표시 (`OAuth2`, `API Key`, `Bearer Token`, `Basic`, `Connection String`, `SMTP`, `Webhook Outbound`). `service_type='mcp'` 인 경우 `MCP Server`, `service_type='cafe24'` 인 경우 `Cafe24` 로 별도 라벨 |
| 상태 텍스트 | `Connected` / `Expires in Nd` / `Expired` / `Error: <reason>` / `Pending install` (보조 문구: "Complete Cafe24 Test Run to activate". `status_reason`/`last_error` 가 채워지면 카드 하단에 진단 단서 표시 — 예: `Last error: OAUTH_TOKEN_EXCHANGE_FAILED — Failed to exchange authorization code`) |
| Scope 섹션 | Organization / Personal 2개 섹션. 각 섹션 내 최신 생성순 정렬 |
| 더보기(⋮) | 상세 열기, 연결 테스트(연결됨에 한함), 재인증(OAuth · **비활성 조건**: §4.2 Reauthorize 행 참조 — 요약: `status='pending_install'`, `service_type='cafe24' AND credentials.app_type='private'` 전체 케이스, `expired AND status_reason='install_timeout'`), 삭제(차단 시 비활성). `pending_install` 의 ⋮ 메뉴는 **상세 열기 + 삭제만 활성** — 재인증은 cafe24 측 "테스트 실행" 재호출이 정식이며, 연결 테스트는 토큰이 없어 의미가 없다 |

### 2.3 검색·필터

| 컨트롤 | 동작 |
|--------|------|
| 검색 입력 | 별칭(`name`) ILIKE 부분 일치 |
| Scope 셀렉트 | `All` / `Personal` / `Organization` |
| 서비스 유형 칩 | 다중 선택 가능. 선택 없음 = 전체 |
| 상태 칩 | `All` / `Attention` / `Connected` / `Expiring` (7일 이내) / `Expired` / `Error`. 단일 선택 |

`Attention` 은 §2.4 배너와 동일한 합집합 — `Expired ∪ Expiring ∪ Error` — 을 단일 칩으로 노출한다. 한 칩만 누르면 "지금 손봐야 하는 통합" 을 모두 보여주는 게 사용자 멘탈 모델에 맞고, 단일 선택 칩 모델을 깨지 않으면서 합집합을 제공할 수 있는 유일한 표현이다 (Rationale "Attention 가상 필터값" 항 참고).

※ `expiring` 과 `attention` 두 값은 DB `Integration.status` Enum 에는 존재하지 않는 **가상 필터값(virtual filter)** 이다 — 백엔드 쿼리 빌더가 §9.1 의 `status` 파라미터를 받아 합집합 WHERE 절로 변환한다. DB Enum (`connected`/`expired`/`error`/`pending_install`) 자체를 확장하지 않는 것은 영속화되는 상태와 화면 필터링용 술어를 분리하기 위함이다.

※ 상태 칩에 `pending_install` 은 포함하지 않는다 — 외부 흐름(Cafe24 Developers "테스트 실행") 진행 중 정상 전환 상태이며, 사용자가 명시적으로 필터링할 수요가 낮다. 별도 수요 발생 시 후속 plan 으로 재검토 (Rationale 참고).

모든 필터는 URL 쿼리 파라미터(`q`, `scope`, `serviceType`, `status`)로 동기화되어 공유/새로고침 시 복원된다.

### 2.4 "Need attention" 배너

- **포함 조건**: `status IN (expired, error)` OR `(status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')`. `pending_install` 은 사용자가 외부(Cafe24 Developers)에서 흐름을 진행 중인 정상 상태로 보고 배너에서 제외 — `status_reason` 이 채워진 케이스도 동일. `install_timeout` 사유로 `expired` 가 된 Cafe24 Private 행은 attention 에 포함된다 (사용자 조치(삭제 후 재등록)가 필요한 정상 운영 신호).
- **표시 내용 (분해 카운트)**: 한 줄 요약 (`"통합 N건이 주의가 필요해요"`) + 그 아래에 분해 카운트 (`"만료 X · 만료 임박 Y · 오류 Z"`). 카운트가 0 인 카테고리는 표시하지 않는다.
- **톤 강조**: 기본 톤은 amber (warning). 분해 카운트의 `error ≥ 1` 이면 좌측 dot / border 색을 red 로 강조해 가장 시급한 사유를 시각적으로 알린다 — 텍스트는 동일.
- **클릭 동작**:
  - 합계 ≥ 2 → `?status=attention` 으로 URL 갱신 (§9.1 가상 필터값) → 같은 페이지에 합집합 결과 표시.
  - 합계 = 1 → 그 한 건의 detail 페이지(`/integrations/<id>`) 로 직접 이동. 필터링 단계는 우회한다 (UX 단축 — 1건이면 사용자가 어차피 그 건으로 갈 것).
- **0건이면 비표시**.
- URL 직접 진입 (`/integrations?status=attention`) 도 동일 합집합 결과를 보여준다 (`Attention` 칩이 활성화된 상태).
- **집계 범위 — 현재 페이지 한정**: 배너의 합계·분해 카운트·단일 건 점프 판정은 **현재 페이지의 rows 만** 보고 계산한다 (별도 카운트 API 를 호출하지 않음). 첫 페이지 30건을 채우는 attention 행이 더 있어도 배너에는 "30건" 까지만 표시된다. 사용자가 배너를 눌러 `?status=attention` 필터에 들어가면 그 다음부터는 페이지네이션을 따라 전체를 탐색한다. "총 attention 건수" 를 더 정확히 보고 싶을 때를 위한 별도 카운트 API 는 spec §11.4 사이드바 배지 카운트가 담당한다.

### 2.5 Add Integration 모달 (Step 1)

```
┌─────────────────────────────────────────┐
│  Add Integration — Select a service     │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Google  │ │ GitHub  │ │ Cafe24  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  HTTP   │ │Database │ │  Email  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐                │
│  │ Webhook │ │   MCP   │                │
│  └─────────┘ └─────────┘                │
└─────────────────────────────────────────┘
```

> 정렬: first-party 서비스(Google/GitHub/Cafe24) → 범용(HTTP/Database/Email/Webhook) → 도구 확장(MCP).

- 카드 클릭 시 `/integrations/new?service=<type>&step=auth` 로 라우팅. 모달은 자동 닫힘.
- 모달은 목록 페이지 상단에서만 열림 (키보드 `N` 단축키 허용).

---

## 3. 추가 페이지 (`/integrations/new`)

### 3.1 상태 기계

쿼리 파라미터 `step` 값으로 단계를 제어한다.

```
Step 2 auth     ──submit──▶ Step 3 test
  (폼 채움)                    (자동 실행)
     ▲                            │
     │                         success
     │                            ▼
     └───── edit/retry ──── Step 4 save
                              │
                           saved → /integrations/[id]
```

### 3.2 Step 2: 인증 정보 입력

좌측 헤더에 `← Back to list` / 서비스 로고·이름 / Step 진행 표시(`2 / 3`)를 배치한다. 입력 폼은 §5 서비스별 스키마를 따른다.

**공통 필드**
| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | ✓ | 별칭. 워크스페이스 내 유일 |
| `scope` | ✓ | Personal / Organization (팀 워크스페이스일 때). Admin이 아니면 Organization 비활성 |

**OAuth2 흐름 (Google/GitHub)**
1. 사용자가 scope 체크박스로 권한 범위 선택 (§5 참조)
2. `[Connect with <Service>]` 클릭 → 백엔드 `POST /api/integrations/oauth/begin`으로 state 발급
3. 신규 팝업(600×700)으로 OAuth authorize URL 오픈
4. 팝업 콜백 페이지(`/api/3rd-party/:provider/callback`)가 토큰을 저장 후 `postMessage`로 부모창 알림
5. 부모창은 Step 3로 자동 전이

**OAuth2 흐름 (Cafe24 — Public 앱)** — `mall_id` 가 base URL 의 일부이고 authorize URL 도 mall 별로 다르므로 폼 흐름이 Google/GitHub 와 다르다. Public 앱은 Cafe24 앱스토어에 등록(또는 심사 대기)된 앱으로 서버 env 의 `CAFE24_CLIENT_ID`/`CAFE24_CLIENT_SECRET` 을 사용한다.

1. **사전 입력** (OAuth 버튼 누르기 전 필수):
   - `Mall ID` (예: `myshop` — `https://myshop.cafe24api.com` 의 hostname prefix). 형식: `/^[a-z0-9-]{3,50}$/` ([§5.8 credentials JSONB](#58-cafe24) validation rule).
   - `App type` 라디오: **Public** 선택.
2. **Scope 카테고리 프리셋** (체크박스, 카테고리 단위): Product (R/W), Order (R/W), Customer (R/W), Category (R/W), Promotion (R/W), Mileage (R/W), Shipping (R/W), Salesreport (R), Translation (R/W), Notification (R/W), 기타 카테고리는 "고급" 토글 아래. 각 체크박스가 Cafe24 scope (`mall.read_<category>` / `mall.write_<category>`) 와 매핑.
3. **[Connect with Cafe24]** 클릭 → 백엔드 `POST /api/integrations/oauth/begin` 호출. body:
   ```jsonc
   {
     "service": "cafe24",
     "mode": "new",
     "mall_id": "myshop",
     "app_type": "public",
     "scopes": ["mall.read_product", "mall.write_order", "..."]
   }
   ```
   응답으로 mall 별 authorize URL (`authUrl`) 수신.
4. 신규 팝업(600×700)으로 `https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?...` 오픈.
   - **scope 인코딩** — Cafe24 는 RFC 6749 §3.3 의 공백 구분이 아닌 **콤마 구분**(`mall.read_product,mall.write_order`) scope 를 요구한다. 공백/`+` 으로 보내면 단일 scope 라도 `invalid_scope` 로 거부된다 (Cafe24 의 자체 규약 — `developers.cafe24.com` 공식 example 과 `cafe24-app/cafe24_app_sample` 의 `StoreToken.java#getCodeRedirectUrl` 가 모두 콤마 구분). 다른 OAuth provider (google, github) 는 공백 구분 유지.
5. 팝업 콜백 페이지(`/api/3rd-party/cafe24/callback`)가 토큰 저장 후 `postMessage` 로 부모창 알림.
6. 부모창은 Step 3 로 자동 전이.

**OAuth2 흐름 (Cafe24 — Private 앱)** — Cafe24 Developers 에서 생성한 **미심사(비공개) 앱**. Private 앱의 OAuth 흐름은 우리 서비스가 시작할 수 없고, **Cafe24 Developers 의 "테스트 실행"이 흐름을 시작**한다. Cafe24 는 우리 App URL 을 먼저 호출하며, 이후 동의 → callback 순으로 진행한다.

1. **사전 등록** (Cafe24 에서 테스트 실행하기 전 필수):
   - `Mall ID`, `App type = Private`, `Client ID`, `Client Secret`, scope 입력.
   - **[저장 및 설정 안내 받기]** 클릭 → `POST /api/integrations/oauth/begin` 호출. body:
     ```jsonc
     {
       "service": "cafe24",
       "mode": "new",
       "mall_id": "myshop",
       "app_type": "private",
       "client_id": "...",
       "client_secret": "...",
       "scopes": ["mall.read_product", "..."]
     }
     ```
   - 응답: `{ "mode": "cafe24_private_pending", "integrationId": "...", "appUrl": "https://<host>/api/3rd-party/cafe24/install/:installToken", "callbackUrl": "https://<host>/api/3rd-party/cafe24/callback" }`. `appUrl` 의 마지막 path segment 가 `install_token` (16바이트 base64url, 22자) 이며, Cafe24 Developers 의 "앱 URL" 에 그대로 등록한다. **Cafe24 App URL 입력 필드 100자 한도** 충족을 위해 경로·토큰 모두 단축됨 — Rationale "Cafe24 App URL 100자 한도 대응" 항 참조.
   - Integration 이 `status=pending_install` 상태로 즉시 생성된다 (토큰 없음).
2. **설정 안내 화면** 표시 (팝업 없음):
   - `App URL` 복사 버튼 — Cafe24 Developers 앱의 **앱 URL** 에 등록.
   - `Redirect URI` 복사 버튼 — Cafe24 Developers 앱의 **Redirect URI** 에 등록.
   - 안내: "① 위 URL 을 Cafe24 Developers → 내 앱 → 개발 정보에 등록하세요. ② 사용 권한(Scope) 이 요청한 scope 와 일치하는지 확인하세요. ③ 테스트 실행 버튼을 클릭하고 mall_id 를 입력하세요."
3. **Cafe24 "테스트 실행"** — Cafe24 가 App URL(`GET /api/3rd-party/cafe24/install/:installToken`) 를 호출. 쿼리 파라미터: `mall_id`, `shop_no`, `user_id`, `user_name`, `user_type`, `lang`, `nation`, `timestamp`, `hmac` (HmacSHA256 서명, §9.5 참조).
4. **App URL 처리** — 백엔드가 path 의 `install_token` 으로 단일 Integration 을 조회하고, 그 row 의 `client_secret` 으로 HMAC 을 1회 검증한다 (현행 in-memory 100건 스캔 대체). 검증 통과 후 row 의 status 에 따라 분기:
   - `pending_install` — OAuthState 생성 후 `https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?...` 로 302 (초기 install 흐름).
   - `connected` / `error(*)` / `expired` — `${FRONTEND_URL}/integrations/<id>` 로 302 (**post-install navigation 흐름** — 카페24 쇼핑몰 관리자 화면의 "앱으로 가기" 버튼이 같은 App URL 을 사용하므로 이 분기가 필수. 자세한 근거는 Rationale "Cafe24 App URL 재호출 흐름" 항).
5. 쇼핑몰 관리자 **동의 화면** → 동의. (post-install navigation 분기는 동의 화면 없이 4번에서 바로 우리 화면으로 진입)
6. Cafe24 가 callback(`/api/3rd-party/cafe24/callback`)으로 code+state 전달 → 토큰 교환 → Integration `status: pending_install → connected`. `install_token` 은 **보존** (post-install navigation 의 식별 키로 계속 사용).
7. 사용자는 통합 목록에서 상태를 확인한다 (새로고침 또는 연결 상태 배지).

> **mall_id** 는 base URL 의 일부이며 authorize URL 도 mall 별로 달라, OAuth begin 단계에서 사용자가 선행 입력해야 한다 (Public/Private 모두 동일).

**비OAuth 흐름**
- 모든 필드를 폼에 입력 후 `[Continue]`로 Step 3로 전이

### 3.3 Step 3: 연결 테스트

- 자동으로 `POST /api/integrations/preview-test`를 호출 (DB 저장 없이 메모리상 자격 증명으로 검증)
- OAuth의 경우 팝업에서 이미 토큰 교환이 완료되었으므로 실제 API 핑(`/me` 또는 서비스별 동등 엔드포인트)
- 성공 시 `[Save integration]` 버튼 활성화
- 실패 시 에러 메시지 표시 + `[Back to auth]` 버튼으로 Step 2 복귀, 입력값은 유지

### 3.4 Step 4: 저장

- `POST /api/integrations`로 생성 요청 (OAuth는 토큰이 이미 서버 측 임시 저장소에 있고, `preview_token`만 전달)
- 성공 시 `/integrations/[id]`로 리다이렉트 + 토스트 `Integration created`
- 실패 시 폼은 Step 3 상태 유지

### 3.5 OAuth 팝업 복귀 처리

- 부모창이 `window.addEventListener('message', ...)`로 `oauth_callback` 이벤트 수신
- `integrationPreviewId`(DB 저장 전 임시 식별자)를 받아 Step 3 자동 진입
- 팝업이 5분 내 복귀하지 않으면 타임아웃 에러 표시, 사용자는 재시도 가능

### 3.6 이탈·복원

- 페이지 새로고침 시 쿼리 파라미터에서 `service`, `step`을 복원. 입력한 자격 증명은 보안상 복원하지 않고 Step 2로 리셋.
- `beforeunload`에서 입력 중인 자격 증명이 있으면 경고.

---

## 4. 상세 페이지 (`/integrations/[id]`)

### 4.1 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to integrations                                       │
│                                                              │
│ 🟢 Google - Team Account                                          │
│ OAuth2 · Organization · Connected · Last used 2m ago         │
│ Created by @alice, 2026-03-01                                │
│ ───────────────────────────────────────────────────────────  │
│                                                              │
│ [Overview] [Security] [Scope & Permissions] [Usage] [Activity] [Danger zone]
│                                                              │
│ (선택 탭 내용)                                                │
└──────────────────────────────────────────────────────────────┘
```

헤더 아래 탭(앵커 기반 `#security`, `#usage`, …)으로 섹션을 스위치한다.

### 4.2 Overview 탭

| 요소 | 설명 |
|------|------|
| 기본 정보 | 서비스, 별칭, 생성자, 생성·수정일, 마지막 사용 시각, 마지막 회전 시각, 토큰 만료 시각 |
| Quick actions | `Test connection` (connected 한정), `Reauthorize`(OAuth · `pending_install` 또는 cafe24 private 에서 비활성 — §4.3 Reauthorize 상세 조건 참조), `Rotate credentials`(비OAuth), `Edit alias` |
| 상태 배지 | 현재 상태 + reason (`error(insufficient_scope)` 등) |
| 별칭 편집 | 인라인 편집, `PATCH /api/integrations/:id` |
| App URL 카드 (Cafe24 Private 한정) | `service_type='cafe24' AND credentials.app_type='private'` 일 때만 표시. **App URL** (`${APP_URL}/api/3rd-party/cafe24/install/:installToken`) 과 **Redirect URI** (`${APP_URL}/api/3rd-party/cafe24/callback`) 를 복사 버튼과 함께 노출한다. Cafe24 Developers Console 의 "앱 URL" 갱신용 — App URL HMAC 검증 실패 에러 페이지가 안내하는 비교 대상이 본 카드다. 신규 등록 흐름의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴 (라벨 + 모노스페이스 URL + 복사 버튼 + 1줄 안내) 재사용. 결정 근거는 Rationale "Cafe24 App URL 상세 페이지 표시" 항. |

### 4.3 Security 탭

| 블록 | 설명 |
|------|------|
| Authentication | `auth_type` 표시 + 현재 보유 자격 증명 메타 (예: `Token preview: xoxb-****4f2a`) — 원본 값은 복호화해 보여주지 않음 |
| Reauthorize (OAuth) | `[Reauthorize]` 버튼 → `POST /api/integrations/:id/reauthorize`에서 authUrl 수신 → 팝업 OAuth → 성공 시 상태 `connected` 복귀. **비활성 조건**: `status='pending_install'` (cafe24 Private 초기 install — "테스트 실행" 재호출이 정식); `status='expired' AND status_reason='install_timeout'` (Private install TTL 만료 — 삭제 후 재등록 권장); `service_type='cafe24' AND credentials.app_type='private'` 인 모든 케이스 (Private 앱은 우리 서버가 OAuth 를 시작할 수 없음) |
| Rotate credentials (비OAuth) | 인플레이스 폼. 기존 값은 마스킹, 토글로 교체 폼 오픈 → 새 값 입력 → `POST /api/integrations/:id/rotate` (내부적으로 연결 테스트 → 성공 시에만 commit). 실패 시 기존 자격 증명 유지 |
| Last rotated | `last_rotated_at` 상대 시간 + 절대 시간 |

비OAuth rotate 폼의 필드는 §5 서비스 스키마와 동일. 서버는 테스트 성공 전까지 기존 credentials JSON을 건드리지 않는다.

### 4.4 Scope & Permissions 탭 (OAuth 한정)

| 요소 | 설명 |
|------|------|
| 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
| 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
| 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
| `[Request scopes]` 버튼 | 체크된 추가 scope 와 함께 `POST /api/integrations/:id/request-scopes` 호출. 응답 분기는 아래 두 가지 — provider 분기는 backend 가 응답 shape 으로 결정하므로 frontend 는 응답 shape 만 보고 UI 를 분기한다. 응답 필드 전체 정의는 §9.2 참조. |

**분기 ① — 일반 OAuth provider (Google / GitHub / Cafe24 Public)**

- 응답: `authUrl` 포함 (기타 필드는 §9.2 참조).
- UI: 새 창으로 OAuth 팝업 열고 성공 토스트 ("Scope request window opened" / "권한 요청 창을 열었어요"). 팝업 닫힘 시 success 면 부모 페이지가 `credentials.scopes` 병합 결과를 refetch.

**분기 ② — Cafe24 Private**

- 응답: `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: string[] }`.
- 사유: Private 앱은 우리 서버가 OAuth 를 시작할 수 없어 popup 진입점이 없다. Cafe24 Developers 의 앱 권한 설정에서 사용자가 직접 scope 활성화 후 "테스트 실행" 으로 재인증해야 한다 (Rationale "Cafe24 Private request-scopes 흐름" 항).
- UI:
  - **inline alert (영구 표시, amber 톤)** — Scope 카드 안에 다음 안내를 고정 표시한다. modal 이 아니라 inline 인 이유는 사용자가 Cafe24 측 작업을 진행하는 동안 안내를 계속 참조하기 때문이다.
    - Title: "Cafe24 Developers 에서 권한을 추가해 주세요" / "Grant the additional scopes in Cafe24 Developers"
    - Description: "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다. (Private 앱은 외부에서 OAuth 화면을 띄울 수 없어 Cafe24 측 작업이 필요해요.)" / "Enable the additional scopes in your Cafe24 Developers app permission settings, then click 'Test run' again to refresh the token with the new scopes. (Private apps cannot initiate the OAuth flow externally, so the action must happen on Cafe24.)"
    - `scopesAdded` 가 비어 있지 않으면 그 목록을 작은 칩으로 alert 안에 나열 ("Scopes added: [scope_a] [scope_b]"). 빈 배열이면 칩 영역을 표시하지 않는다.
  - **즉시 토스트 (info 레벨)** — alert 표시와 동시에 한 번 띄워 응답이 왔음을 알린다. alert 가 안내 본문, 토스트는 도착 신호.
  - **다음 mutate 시 reset** — 새 요청 시작 직전에 alert 를 비워 옛 안내가 잔류하지 않게 한다.
  - **refetch 미실행** — Cafe24 측 후속 작업 완료까지 token 변화가 없으므로 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다. token 갱신은 "테스트 실행" callback handler 가 별도 경로로 처리.

비OAuth 연동에서는 이 탭이 숨겨진다.

### 4.5 Usage 탭

```
Used by 3 nodes across 2 workflows

┌────────────────────────────────────────────────────────────┐
│ Workflow A (Active)                                        │
│  └─ Send Email message  (node id: abc)  [Open in editor →] │
│  └─ Lookup Google user   (node id: def)  [Open in editor →] │
│                                                            │
│ Workflow B (Inactive)                                      │
│  └─ Notify on failure   (node id: ghi)  [Open in editor →] │
└────────────────────────────────────────────────────────────┘
```

- 데이터 출처: `GET /api/int

... (truncated due to size limit) ...
```

## 검색 대상 코퍼스 (spec/, plan/in-progress/, conventions/)

### 관련 spec 본문

#### `spec/0-overview.md`
```
# Spec: 시스템 아키텍처 개요

> 관련 문서: [데이터 모델](./1-data-model.md) · [브랜드 가이드](./6-brand.md) · [노드 Output 규약](./conventions/node-output.md)

---

## Overview (제품 정의)

> 출처: `prd/0-overview.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

---

### 1. 제품 비전

**"흐름은 설계하는 것이 아니라, 자라나야 한다."**

Clemvion은 AI 에이전트와 노코드 워크플로우 빌더를 통합한 실행 플랫폼이다. 시각적 캔버스에서 노드를 연결해 복잡한 비즈니스 자동화를 구현하되, 워크플로우 안에 AI 에이전트 노드를 삽입함으로써 각 단계가 단순 실행이 아닌 **판단과 적응**을 수행하게 한다. 개발자에게는 고급 설정과 코드 편집 옵션을, 비개발자에게는 직관적인 드래그 앤 드롭 인터페이스와 AI 어시스턴트와의 대화형 편집을 제공한다.

브랜드 스토리·정체성은 [`brand.md`](./6-brand.md)를 참조한다.

---

### 2. 목표

| 구분 | 목표 |
|------|------|
| **사용자 가치** | 반복 업무를 자동화하여 생산성 향상. AI Agent를 활용한 지능형 워크플로우 구축 |
| **비즈니스 가치** | SaaS와 셀프 호스팅 양립으로 다양한 고객층 확보. 마켓플레이스를 통한 생태계 구축 |
| **기술 목표** | 확장 가능한 노드 시스템, 안정적 워크플로우 실행 엔진, 실시간 디버깅 지원 |

---

### 3. 타겟 사용자

#### 3.1 비개발자
- 마케팅, 운영, CS 등 비즈니스 부서 담당자
- 반복 업무 자동화 필요성을 느끼는 사용자
- 직관적 UI를 통해 워크플로우를 구성

#### 3.2 개발자
- 빠른 프로토타이핑 및 자동화 파이프라인 구축
- 코드 편집, 커스텀 노드 개발, API 직접 호출 등 고급 기능 활용
- 셀프 호스팅 환경 운영

#### 3.3 팀/조직
- 워크플로우 공유 및 협업
- 역할/권한 기반 접근 관리
- 조직 단위 통합(Integration) 설정 공유

---

### 4. 사용 단위

- **개인**: 개인 워크스페이스에서 독립적으로 워크플로우 생성/관리
- **팀/조직**: 팀 워크스페이스를 통해 워크플로우 공유, 역할/권한 관리, 공통 Integration 설정 관리

---

### 5. 배포 방식

| 방식 | 설명 |
|------|------|
| **SaaS** | 클라우드 호스팅, 멀티 테넌트 환경, 구독 기반 과금 |
| **셀프 호스팅** | 온프레미스 또는 프라이빗 클라우드 배포, 단일/멀티 테넌트 선택 가능 |

두 배포 방식 모두 동일한 기능을 제공하며, 환경 독립적 설계를 통해 설정만으로 배포 방식을 전환할 수 있어야 한다.

---

### 6. 현재 구현 상태 및 남은 로드맵

#### 6.1 구현 완료 (✅)

| 영역 | 기능 |
|------|-----------|
| **내비게이션** | 대시보드, 워크플로우 목록, 트리거 목록, 스케줄, 통합, Knowledge Base, LLM 설정, 인증 설정, 통계, 사용자 매뉴얼(/docs), 사용자 프로필 |
| **워크플로우 에디터** | 캔버스 기반 노드 편집, 엣지 연결, 실행·디버깅, 버전 히스토리 |
| **노드 시스템** | Trigger(Manual), Logic(If/Else·Switch·Loop·ForEach·Map·Filter·Split·Merge·Parallel·Background·Variable Decl/Mod), Flow(Workflow), AI(AI Agent·Text Classifier·Information Extractor), Integration(HTTP·Database·Send Email), Data(Transform·Code), Presentation(Carousel·Chart·Form·Table·Template) |
| **AI 플랫폼** | LLM Config(프로바이더·모델·API Key — v1 의 5개 provider OpenAI/Anthropic/Google/Azure OpenAI/Local Ollama·vLLM 모두 스트리밍 ✅), Knowledge Base(문서 업로드·임베딩·RAG 검색), **Graph RAG**(KB 모드 선택 + entity/relation 자동 추출 + Hybrid 검색 + Entity/Relation 목록·삭제 + 3D 그래프 시각화 — 상세: [PRD 9](./5-system/10-graph-rag.md)) |
| **Workflow AI Assistant** | 에디터 내 채팅형 AI로 자연어 요청 → 노드·엣지 자동 구성. Clarify → Plan → Execute 3단계 대화 루프, SSE 스트리밍, 세션 영속. 상세: [PRD 2 §10](./3-workflow-editor/_product-overview.md#10-ai-assistant-ed-ai-), [PRD 6 §3.6](./4-nodes/3-ai/_product-overview.md#36-workflow-ai-assistant). |
| **팀 워크스페이스·RBAC** | 데이터 모델(`Workspace.type = personal \| team`, `WorkspaceMember.role`) + 백엔드 모듈(`backend/src/modules/workspaces`) + 프런트엔드 UI(워크스페이스 전환, 멤버 초대·역할·소유권 이전). 회원가입 시 개인 워크스페이스가 자동 생성되고 `X-Workspace-Id`는 서버가 자동 매핑한다. |
| **시스템** | 인증/인가(개인·팀 워크스페이스), REST API, 에러 처리, 표현식 엔진(`{{ }}`), 실행 엔진(Redis 큐 + 워커 풀, 분산 continuation bus), WebSocket 실시간 상태, Webhook 수신, 실행 이력 |

#### 6.2 백엔드만 존재 / 부분 구현 (🚧)

| 영역 | 상태 |
|------|------|
| **Parallel 노드 (P1)** | `PARALLEL_ENGINE=v1` 환경변수로 활성화하면 `ParallelExecutor`가 `p-limit` + `Promise.allSettled`로 분기를 동시 실행한다(off 시 기존 순차 동작). branchCount(2~16), maxConcurrency(0=무제한, 1~16) 지원. 분기 내 블로킹 노드·back-edge·중첩 Parallel은 금지. Merge `wait_all` 조합으로 결과 합산 가능. P2에서 중첩 Parallel과 waitAll=false를 추가할 예정이다. |
| **조직 레벨 Integration 공유** | 팀 워크스페이스 단위 Integration 공유는 후속 단계에서 도입 예정이다. |
| **Cafe24 통합** | 워크플로 `cafe24` 단일 노드 (18 카테고리 메타데이터 기반 Resource × Operation) + AI Agent Internal MCP Bridge 양방향 노출 + Public/Private 앱 OAuth + Cafe24 Developers "테스트 실행" / "앱으로 가기" App URL 흐름 + leaky-bucket rate limit + BullMQ 기반 cross-pod refresh 직렬화 + 10일 임계 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신) — 모두 구현 완료 (PR #20-#67). spec: [Cafe24 노드](./4-nodes/4-integration/4-cafe24.md), [통합 §5.8](./2-navigation/4-integration.md#58-cafe24). 남은 작업: Internal MCP Bridge 패턴을 Shopify·Naver Smartstore 등 first-party 이커머스로 확장 (§6.3). |

#### 6.3 로드맵 / 미구현 (❌)

| 영역 | 내용 |
|------|------|
| **Graph RAG 후속 (P2+)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override. P0~P2 본체는 §6.1 에서 ✅. 상세: [PRD 9 §8](./5-system/10-graph-rag.md#8-미결--후속-검토). |
| **Logic 확장 노드** | Parallel P2(중첩 Parallel, waitAll=false). |
| **마켓플레이스** | 워크플로우 템플릿·AI Agent 프리셋·Integration 플러그인·커스텀 노드 게시 기능. |
| **배포 자동화 확장** | 공식 Docker/Kubernetes 배포 가이드, 셀프 호스팅 번들. |
| **확장 SDK** | 노드 플러그인 SDK, 외부 커스텀 노드 개발/게시. |
| **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.2) 이후 Shopify·Naver Smartstore 등 first-party 이커머스 통합을 같은 [Spec MCP Client §2.3](./5-system/11-mcp-client.md#23-internal-bridge-in-process) 패턴으로 추가. |

---

### 7. 용어 정의

| 용어 | 정의 |
|------|------|
| **Workflow** | 노드와 엣지로 구성된 자동화 프로세스의 단위. 특정 트리거에 의해 실행되거나 수동으로 실행 가능 |
| **Node** | 워크플로우 내에서 하나의 작업 단위를 나타내는 구성 요소. 입력을 받아 처리하고 출력을 생성 |
| **Edge** | 두 노드 간의 연결. 데이터 흐름의 방향과 경로를 정의 |
| **Port** | 노드의 입출력 연결 지점. 입력 포트(Input Port)와 출력 포트(Output Port)로 구분 |
| **Trigger** | 워크플로우의 실행을 시작하는 이벤트. Webhook, 스케줄(Cron), 수동 실행 등의 유형 존재 |
| **Canvas** | 워크플로우를 시각적으로 편집하는 작업 공간 |
| **Integration** | 외부 서비스(Google, GitHub 등)와의 연동 설정 |
| **Knowledge Base** | AI Agent의 RAG(Retrieval-Augmented Generation)를 위한 지식 저장소. KB 단위로 `vector` / `graph` 검색 모드를 선택할 수 있다 |
| **Graph RAG** | 문서에서 추출한 entity / relation 으로 구성된 지식 그래프를 RAG 검색에 활용하는 방식. 본 제품에서는 vector seed → 그래프 확장 → rerank 의 Hybrid 흐름으로 동작한다 ([PRD 9](./5-system/10-graph-rag.md)) |
| **Entity / Relation** | Graph RAG 의 구성 요소. Entity 는 문서 chunk 에서 추출한 의미 단위(인물·조직·개념·위치·이벤트). Relation 은 두 entity 사이의 방향성 있는 관계 (head, predicate, tail) |
| **Execution** | 워크플로우의 한 번의 실행 인스턴스. 실행 상태, 각 노드별 입출력 데이터, 로그를 포함 |
| **Workspace** | 사용자 또는 팀이 워크플로우, Integration, 설정 등을 관리하는 독립된 공간 |
| **Marketplace** | Agent 설정, 워크플로우 템플릿, Integration 플러그인을 공유/설치하는 공간 |
| **Schedule** | 워크플로우를 주기적으로 실행하기 위한 Cron Job 규칙 |
| **LLM** | Large Language Model. AI Agent 노드에서 사용하는 언어 모델 |
| **RAG** | Retrieval-Augmented Generation. Knowledge Base에서 관련 정보를 검색하여 AI 응답 품질을 향상시키는 기법 |

---

### 8. 문서 맵

본 spec/ 트리는 docs-consolidation(2026-05-12)으로 옛 `prd/`·`memory/`·`user_memo/` 를 흡수해 **제품의 단일 진실(single source of truth)** 로 통합되었다.

| 영역 | 위치 | 진입 문서 |
| --- | --- | --- |
| 제품 개요 + 시스템 아키텍처 | `spec/0-overview.md` | 본 문서 |
| 데이터 모델 | `spec/1-data-model.md` | 핵심 엔티티 정의 |
| 브랜드 가이드 | `spec/6-brand.md` | — |
| 정식 규약 | `spec/conventions/` | 노드 Output 규약, Swagger 패턴 등 |
| 내비게이션 화면 | `spec/2-navigation/` | `_product-overview.md` + 화면별 문서 |
| 워크플로우 에디터 | `spec/3-workflow-editor/` | `_product-overview.md` + 캔버스·노드 공통·엣지·실행·AI Assistant |
| 노드 시스템 | `spec/4-nodes/` | `_product-overview.md` + `0-overview.md` + 카테고리별 폴더 (`1-logic/` ~ `7-trigger/`) |
| 시스템 공통 | `spec/5-system/` | `_product-overview.md` + 영역별 spec (인증·API 규칙·실행 엔진·LLM Client·임베딩·RAG·Graph RAG·MCP·Webhook 등) |
| 데이터 흐름 | `spec/data-flow/` | `0-overview.md` + 도메인별 흐름·schema 매핑 (`1-audit` ~ `12-workspace`, 알파벳 순 숫자 prefix) |

문서 컨벤션:
- **`_product-overview.md`** — 다중 spec 파일을 가진 영역의 제품 정의(옛 PRD). 영역의 사용자 가치·요구사항·요구사항 ID.
- **`_layout.md`** — 영역 공통 레이아웃 (현재는 `2-navigation/` 만 사용).
- **`0-overview.md` / `0-common.md`** — 영역·카테고리 내부의 기술 아키텍처·공통 규약.
- **`N-name.md`** — 정렬된 상세 spec. 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline. 단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다.

별도 보관소:
- `plan/in-progress/` · `plan/complete/` — 작업 추적 라이프사이클
- `plan/complete/archive/from-memory/` — 옛 `memory/` 의 1회성 분석·진행 로그
- `plan/complete/archive/from-user-memo/` — 옛 `user_memo/` 의 초기 기획·노드 개선안

> 구체 파일 목록은 본 문서가 박제하지 않는다. 폴더 구조는 `ls spec/` 또는 IDE 트리에서 확인한다.

---

## 1. 시스템 구성 개요

```
┌─────────────────────────────────────────────────────────┐
│                      Client (SPA)                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │Navigation│  │Workflow Editor│  │  Settings/Config  │  │
│  │  Views   │  │   (Canvas)    │  │     Views         │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API / WebSocket
┌───────────────────────┴─────────────────────────────────┐
│                    API Gateway                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Auth · Rate Limiting · Request Routing          │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
  ┌─────────────────────┼─────────────────────┐
  │                     │                     │
  ▼                     ▼                     ▼
┌──────────┐   ┌───────────────┐   ┌──────────────────┐
│ Core API │   │  Execution    │   │  Integration     │
│ Service  │   │  Engine       │   │  Service         │
│          │   │               │   │                  │
│ - CRUD   │   │ - Scheduler   │   │ - OAuth Manager  │
│ - Search │   │ - Worker Pool │   │ - Connector Pool │
│ - Version│   │ - State Mgmt  │   │ - Webhook Mgr    │
└────┬─────┘   └──┬─────┬──────┘   └────────┬─────────┘
     │            │     │                    │
     │            ▼     │                    │
     │   ┌─────────────┐│                    │
     │   │ Message     ││                    │
     │   │ Queue       ││                    │
     │   │ (Redis BQ)  ││                    │
     │   └──────┬──────┘│                    │
     │          ▼       │                    │
     │   ┌─────────────┐│                    │
     │   │  Workers    ││                    │
     │   │ (N 인스턴스)││                    │
     │   └─────────────┘│                    │
     │                   │                    │
     ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │
│  │PostgreSQL│  │   Redis   │  │  Vector  │  │ Object │ │
│  │(Primary) │  │(Cache/Pub)│  │   DB     │  │Storage │ │
│  └──────────┘  └───────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 주요 컴포넌트

### 2.1 Client (SPA)
- **기술**: React 기반 SPA
- **역할**: 내비게이션 화면, 워크플로우 에디터(캔버스), 설정 화면 렌더링
- **통신**: REST API(CRUD), WebSocket(실시간 실행 상태, 협업)

### 2.2 API Gateway
- 인증/인가 검증
- Rate Limiting
- 요청 라우팅
- CORS 관리

### 2.3 Core API Service
- 워크플로우, 노드, 트리거, 스케줄 등의 CRUD
- 검색 및 목록 조회
- 버전 관리
- 팀/워크스페이스 관리

### 2.4 Execution Engine
- 워크플로우 실행 오케스트레이션
- 노드 그래프 순회 및 실행
- 스케줄러 (Cron Job 기반 트리거)
- **Message Queue** (Redis 기반) — 실행 태스크를 큐에 발행
- **Worker Pool** (N개 인스턴스, 수평 확장) — 큐에서 태스크를 소비하여 노드 실행
- 실행 상태 관리 및 장애 시 복구

### 2.5 Integration Service
- OAuth 인증 플로우 관리
- Third-party API 커넥터 풀
- Webhook 수신/발신 관리
- 연동 상태 모니터링

### 2.6 Data Layer
- **PostgreSQL**: 주 데이터베이스 (워크플로우, 사용자, 설정 등)
- **Redis**: 캐시, 실행 상태 Pub/Sub, 세션 관리
- **Vector DB**: Knowledge Base 임베딩 저장/검색
- **Object Storage**: S3 호환 스토리지 (AWS S3 / MinIO). 파일 업로드, Knowledge Base 원본 문서 등 저장

### 2.7 Object Storage (S3 호환)

| 항목 | 설명 |
|------|------|
| 호환성 | AWS S3 API 호환 (AWS S3, MinIO 등) |
| SaaS | AWS S3 사용 |
| 셀프 호스팅 | MinIO 기본 제공 (Docker Compose에 포함) |

**버킷 구조:**

```
{bucket}/
  kb/                              # Knowledge Base 원본 문서 (구현됨)
    {kbId}/
      {documentId}/
        {sanitizedFilename}
  {workspaceId}/                   # Form/Avatar 영역 (계획)
    forms/                         # Form 노드 파일 업로드
      {executionId}/
        {fileId}_{originalName}
    avatars/                       # 프로필 이미지
      {userId}.{ext}
```

| 영역 | 키 패턴 | 상태 | 코드 |
|------|---------|------|------|
| Knowledge Base 원본 문서 | `kb/{kbId}/{documentId}/{sanitizedFilename}` | 구현됨 | `backend/src/modules/knowledge-base/knowledge-base.service.ts:723` |
| Form 노드 업로드 / Avatar | `{workspaceId}/forms/...`, `{workspaceId}/avatars/...` | 계획 (코드 미구현) | — |

> KB 원본 키는 `workspaceId` 를 prefix 로 두지 않는다. `kbId` 자체가 workspace 에 종속되므로 (KB 메타데이터의 FK) 키 공간이 겹치지 않으며, 키 길이가 짧아 S3 list/delete 비용이 낮다. 버킷 이름은 `S3_BUCKET` 환경변수 (기본 `workflow-storage`, `backend/.env.example:55`) 로 지정한다.

### 2.8 DB 마이그레이션 (Flyway)

| 항목 | 설명 |
|------|------|
| 도구 | **Flyway** |
| 버전 관리 | SQL 기반 마이그레이션 파일, `V{version}__{description}.sql` 네이밍 |
| 롤백 지원 | 각 마이그레이션에 대응하는 undo 스크립트 작성 (`U{version}__{description}.sql`) |
| CI/CD 연동 | 배포 파이프라인에서 `flyway migrate` 자동 실행. 마이그레이션 실패 시 배포 중단 |
| 환경 분리 | dev/staging/production 환경별 설정 파일 분리 (`flyway-{env}.conf`) |
| 기준선 | 최초 배포 시 `flyway baseline`으로 기준점 설정 |

---

## 3. 공통 UI 패턴

### 3.1 레이아웃
- 좌측 고정 사이드바 + 우측 메인 컨텐츠 영역
- 에디터 화면은 사이드바를 축소하거나 숨길 수 있음

### 3.2 목록 화면 패턴
- 상단: 검색바 + 필터 + 생성 버튼
- 중앙: 테이블/카드 형태 목록
- 하단: 페이지네이션 또는 무한 스크롤
- 각 항목: 우클릭 또는 더보기(...) 메뉴로 액션 (편집, 복제, 삭제)

### 3.3 상세/설정 패널 패턴
- 우측 슬라이드 패널 또는 모달
- 변경사항 자동 저장 (에디터) 또는 저장/취소 버튼 (설정)
- 유효성 검증 즉시 피드백

### 3.4 상태 표시 패턴
- **Badge/Tag**: Active(초록), Inactive(회색), Error(빨강), Processing(파랑 스피너)
- **Toast**: 성공/실패/정보 알림
- **Skeleton**: 로딩 중 UI 플레이스홀더

### 3.5 반응형 및 테마
- 최소 해상도: 1280x720
- 라이트/다크 테마 지원
- 에디터는 데스크탑 전용 (모바일에서는 뷰어 모드만 제공)

---

## 4. 영역별 진입 문서

docs-consolidation(2026-05-12) 으로 PRD/Spec 가 통합되었다. 옛 PRD 의 식별자(예: `NAV-WF-*`, `ED-AI-*`, `ND-IF~ND-BG`) 는 각 영역의 `_product-overview.md` 안에서 그대로 사용되고, 상세 spec 은 동일 폴더의 번호 매겨진 문서로 분배된다.

| 영역 | 제품 정의 (전 PRD) | 상세 spec |
|------|-------------------|-----------|
| 내비게이션 | [`./2-navigation/_product-overview.md`](./2-navigation/_product-overview.md) | [`./2-navigation/`](./2-navigation/) 의 화면별 문서 |
| 워크플로우 에디터 | [`./3-workflow-editor/_product-overview.md`](./3-workflow-editor/_product-overview.md) | [`0-canvas`](./3-workflow-editor/0-canvas.md) · [`1-node-common`](./3-workflow-editor/1-node-common.md) · [`2-edge`](./3-workflow-editor/2-edge.md) · [`3-execution`](./3-workflow-editor/3-execution.md) · [`4-ai-assistant`](./3-workflow-editor/4-ai-assistant.md) |
| 노드 시스템 | [`./4-nodes/_product-overview.md`](./4-nodes/_product-overview.md) | [`./4-nodes/0-overview.md`](./4-nodes/0-overview.md) + 카테고리별 폴더 |
| AI 플랫폼 (LLM/KB/Assistant) | [`./4-nodes/3-ai/_product-overview.md`](./4-nodes/3-ai/_product-overview.md) | [`./4-nodes/3-ai/`](./4-nodes/3-ai/) · [`./5-system/7-llm-client.md`](./5-system/7-llm-client.md) |
| 통합·KB·마켓플레이스 | [`./4-nodes/4-integration/_product-overview.md`](./4-nodes/4-integration/_product-overview.md) | [`./4-nodes/4-integration/`](./4-nodes/4-integration/) · [`./2-navigation/4-integration.md`](./2-navigation/4-integration.md) · [`./2-navigation/5-knowledge-base.md`](./2-navigation/5-knowledge-base.md) · [`./2-navigation/8-marketplace.md`](./2-navigation/8-marketplace.md) |
| 비기능 요구사항 | [`./5-system/_product-overview.md`](./5-system/_product-overview.md) | [`./5-system/`](./5-system/) 의 영역별 문서 |
| 실행 이력 | (Overview 섹션 통합) | [`./2-navigation/14-execution-history.md`](./2-navigation/14-execution-history.md) |
| Webhook | (Overview 섹션 통합) | [`./5-system/12-webhook.md`](./5-system/12-webhook.md) |
| Graph RAG | (Overview 섹션 통합) | [`./5-system/10-graph-rag.md`](./5-system/10-graph-rag.md) |
| 브랜드 가이드 | — | [`./6-brand.md`](./6-brand.md) |
| 노드 Output 규약 | — | [`./conventions/node-output.md`](./conventions/node-output.md) |

---

## 5. 배포 환경 분리

| 항목 | SaaS | 셀프 호스팅 |
|------|------|-------------|
| 인증 | 자체 인증 + OAuth 소셜 로그인 | 자체 인증 + LDAP/SAML 옵션 |
| 데이터 격리 | 멀티 테넌트 (논리적 격리) | 단일 테넌트 (물리적 격리) |
| 스케일링 | 자동 수평 확장 | 수동 구성 (Docker Compose / K8s) |
| 업데이트 | 자동 롤링 업데이트 | 수동 버전 업그레이드 |
| 마켓플레이스 | 중앙 마켓플레이스 접근 | 프록시 또는 오프라인 패키지 |
| 모니터링 | 내장 대시보드 + 관리형 알림 | Prometheus/Grafana 연동 가이드 |

```

#### `spec/1-data-model.md`
```
# Spec: 데이터 모델

> 관련 문서: [Spec 아키텍처 개요](./0-overview.md) · [PRD 개요](./0-overview.md) · [PRD 노드 시스템](./4-nodes/_product-overview.md)

---

## 1. 엔티티 관계 개요

```
User ──┬── Workspace (1:N)
       │       │
       │       ├── Folder (1:N, 자기참조 parent_id)
       │       ├── Workflow (1:N)
       │       │       ├── Node (1:N)
       │       │       ├── Edge (1:N)
       │       │       ├── WorkflowVersion (1:N)
       │       │       └── Execution (1:N)
       │       │               └── NodeExecution (1:N)
       │       │
       │       ├── Integration (1:N)
       │       └── IntegrationUsageLog (1:N)
       │       ├── Schedule (1:N)
       │       ├── Trigger (1:N)
       │       ├── KnowledgeBase (1:N)
       │       │       └── Document (1:N)
       │       │
       │       ├── LLMConfig (1:N)
       │       ├── AuthConfig (1:N)
       │       ├── AuditLog (1:N)
       │       ├── Notification (1:N)
       │       └── AssistantSession (1:N)
       │               └── AssistantMessage (1:N)
       │
       └── WorkspaceMember (N:M via join)
```

---

## 2. 핵심 엔티티

### 2.1 User

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| email | String | 고유, 로그인 식별자 |
| password_hash | String | 비밀번호 해시 (bcrypt) |
| name | String | 표시 이름 |
| avatar_url | String? | 프로필 이미지 URL |
| locale | String | 언어 설정 (기본: "ko") |
| theme | Enum | light / dark |
| two_factor_enabled | Boolean | 2FA 활성 여부 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.2 Workspace

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| name | String | 워크스페이스 이름 |
| type | Enum | personal / team |
| owner_id | UUID | FK → User |
| slug | String | URL 슬러그 |
| settings | JSONB | 워크스페이스 설정 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.3 WorkspaceMember

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User |
| role | Enum | owner / admin / editor / viewer |
| invited_at | Timestamp | 초대 시각 |
| joined_at | Timestamp? | 합류 시각 |

### 2.4 Workflow

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 워크플로우 이름 |
| description | String? | 설명 |
| is_active | Boolean | 활성 상태 |
| tags | String[] | 태그 목록 |
| folder_id | UUID? | FK → Folder (정리용) |
| settings | JSONB | 워크플로우 레벨 설정 |
| current_version | Integer | 현재 버전 번호 |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.5 Folder

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 폴더 이름 |
| parent_id | UUID? | FK → Folder (중첩 폴더 지원) |
| sort_order | Integer | 정렬 순서 (기본: 0) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약 조건:**
- `(workspace_id, parent_id, name)` UNIQUE — 같은 위치에 동일 이름 불가
- 중첩 깊이 제한: 최대 5단계

### 2.6 Node

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| type | Enum | 노드 유형 (if_else, switch, loop, ..., ai_agent, text_classifier, information_extractor, http_request, ..., transform, code, carousel, table, chart, form, template) |
| category | Enum | logic / flow / ai / integration / data / presentation |
| label | String | 사용자 지정 노드 이름 |
| position_x | Float | 캔버스 X 좌표 |
| position_y | Float | 캔버스 Y 좌표 |
| config | JSONB | 노드별 설정 값 |
| is_disabled | Boolean | 비활성 여부 |
| description | String? | 메모/설명 |
| container_id | UUID? | FK → Node. 컨테이너 노드(Loop/ForEach/Map) 내부에 배치된 경우. 엣지 연결/삭제로 자동 동기화(§11.2.1 canvas 스펙 참조). Background 는 컨테이너 멤버십을 사용하지 않고 `background` 포트 엣지로 본문을 식별한다 ([PRD 3 §4.11 ND-BG-05 대안 구현](./4-nodes/_product-overview.md#411-background) / [Spec 실행 엔진 §3.3](./5-system/4-execution-engine.md#33-background-실행)) |
| tool_owner_id | UUID? | FK → Node. AI Agent의 Tool Area에 등록된 경우 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약 조건:**
- `container_id`와 `tool_owner_id`는 동시에 값을 가질 수 없음 (CHECK 제약)
- `container_id`가 참조하는 노드의 type은 `loop`, `foreach`, `map` 중 하나여야 함 (Background는 도입 시 추가)
- `container_id` 체인은 순환하지 않아야 함 — 실행 시 `CONTAINER_CYCLE` 에러로 거부
- 트리거 카테고리 노드(`manual_trigger` 등)는 `container_id`를 가질 수 없음 — 실행 시 `CONTAINER_INVALID_CHILD` 에러로 거부
- `tool_owner_id`가 참조하는 노드의 type은 `ai_agent`여야 함

**Node.type 전체 목록:**

| category | type | 설명 |
|----------|------|------|
| logic | if_else | 조건 분기 |
| logic | switch | 다중 분기 |
| logic | loop | 반복 |
| logic | variable_declaration | 변수 선언 |
| logic | variable_modification | 변수 수정 |
| logic | split | 배열 분리 |
| logic | map | 배열 변환 |
| logic | foreach | 순차 반복 |
| logic | parallel | 병렬 실행 |
| logic | merge | 데이터 합산 |
| logic | background | 백그라운드 실행 |
| flow | workflow | 서브 워크플로우 호출 |
| ai | ai_agent | AI Agent 실행 |
| ai | text_classifier | 텍스트 분류 |
| ai | information_extractor | 정보 추출 |
| integration | http_request | 범용 HTTP 요청 |
| integration | database_query | 데이터베이스 쿼리 |
| integration | send_email | 이메일 발송 (SMTP) |
| integration | cafe24 | Cafe24 Admin API (Resource × Operation 동적 폼). 같은 Integration 이 AI Agent MCP 도구로도 사용 ([Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md)) |
| data | transform | 데이터 변환 (연산 체인) |
| data | code | JavaScript 코드 실행 |
| presentation | carousel | 캐러셀(슬라이드) 시각화 |
| presentation | table | 테이블 시각화 |
| presentation | chart | 차트 시각화 |
| presentation | form | 사용자 입력 폼 (Human-in-the-loop) |
| presentation | template | 템플릿 기반 콘텐츠 생성 |

### 2.7 Edge

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| source_node_id | UUID | FK → Node (출력 노드) |
| source_port | String | 출력 포트 식별자 (예: "true", "false", "default", "out_0") |
| target_node_id | UUID | FK → Node (입력 노드) |
| target_port | String | 입력 포트 식별자 (기본: "in") |
| type | Enum | 엣지 유형: `data` (기본) / `error` (에러 포트 엣지) |
| condition | JSONB? | 엣지 조건 (조건부 라우팅용) |
| created_at | Timestamp | 생성 시각 |

**제약 조건:**
- `(source_node_id, source_port, target_node_id, target_port)` UNIQUE — 동일 연결 중복 방지
- 자기 자신으로의 연결 불가 (`source_node_id != target_node_id`)
- source_node와 target_node는 같은 workflow_id에 속해야 함

### 2.8 Trigger

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| workflow_id | UUID | FK → Workflow |
| type | Enum | webhook / schedule / manual |
| name | String | 트리거 이름 |
| is_active | Boolean | 활성 상태 |
| config | JSONB | 트리거별 설정 |
| endpoint_path | String? | Webhook URL 경로 (type=webhook) |
| auth_config_id | UUID? | FK → AuthConfig (Webhook 인증) |
| last_triggered_at | Timestamp? | 마지막 실행 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.9 Schedule

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| trigger_id | UUID | FK → Trigger |
| cron_expression | String | Cron 표현식 |
| timezone | String | 타임존 (IANA) |
| is_active | Boolean | 활성 상태 |
| next_run_at | Timestamp | 다음 실행 예정 시각 |
| last_run_at | Timestamp? | 마지막 실행 시각 |
| parameter_values | JSONB | 워크플로우 Manual Trigger 노드 스키마에 대응하는 파라미터 값 맵. 값 문자열에 `{{ $now }}`, `{{ $schedule.* }}` 등 제한 표현식 사용 가능. 기본값 `{}`. |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.9.1 Trigger ↔ Schedule 동기화 규칙

Schedule은 Trigger의 서브타입이다. 양쪽의 라이프사이클과 상태는 동기화된다.

| 이벤트 | 동작 |
|--------|------|
| Schedule 생성 | Trigger 자동 생성 (type=`schedule`, 동일 이름, 동일 워크플로우, is_active 동기화) |
| Schedule 이름 변경 | 연결된 Trigger 이름도 동기화 |
| Schedule is_active 변경 | 연결된 Trigger is_active도 동기화 (역방향도 동일) |
| Schedule 삭제 | 연결된 Trigger cascade 삭제 |
| Trigger(type=schedule) 삭제 | 연결된 Schedule cascade 삭제 |
| Trigger(type=schedule) 직접 생성 | 금지 — Schedule 화면에서만 생성 가능 |

**제약 조건:**
- Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑
- Trigger(type=schedule)는 반드시 1개의 Schedule을 가짐

---

### 2.10 Integration

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| service_type | String | 서비스 유형 (google, github, http, database, email, webhook, mcp, cafe24). `mcp` 의 사용처·credentials 스키마는 [Spec MCP Client](./5-system/11-mcp-client.md) · [Spec 통합 §5.6](./2-navigation/4-integration.md#56-mcp-server). `cafe24` 는 [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md) — 같은 Integration 이 워크플로 노드와 AI Agent MCP Bridge 양쪽에서 사용된다 ([Spec MCP Client §2.3 Internal Bridge](./5-system/11-mcp-client.md#23-internal-bridge-in-process)) |
| name | String | 사용자 지정 별칭 |
| auth_type | Enum | oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none. `none` 은 인증이 없는 공용 MCP 서버 등에 사용 |
| credentials | JSONB (encrypted) | 인증 정보 (암호화 저장). OAuth의 경우 `scopes: string[]` 포함 |
| scope | Enum | personal / organization |
| status | Enum | connected / expired / error / pending_install |
| install_token | String? | Cafe24 Private 앱 설치 흐름 식별 키. `oauth/begin (app_type=private)` 시 **16바이트를 `base64url` (no padding, 22자) 인코딩**해 발급. 통합 lifetime 동안 **보존** (post-install navigation 의 식별 키) — callback 성공 시 보존, `pending_install → expired (install_timeout)` 24h TTL 만료 또는 통합 삭제 시에만 NULL/소거. Cafe24 private 전용 — 다른 service_type 에서는 항상 NULL. **형식 변경 (2026-05-15)**: 옛 32바이트 hex (64자) 는 Cafe24 App URL 100자 한도 초과로 폐기 — 본 문서 Rationale 의 "install_token 형식" 항 참조. 정식 라이프사이클은 [Spec 통합 화면 §6 상태 전이](./2-navigation/4-integration.md#6-상태-전이) 와 [§9.2 API](./2-navigation/4-integration.md#92-인증--회전--scope) 및 Rationale "install_token TTL 24h" |
| install_token_issued_at | Timestamp? | Cafe24 Private `install_token` 발급 시각. TTL 스캐너 (`pending-install-ttl` job) 가 `now - 24h` 와 비교해 만료 판단 — 초과 시 `status='expired', status_reason='install_timeout', install_token=NULL` 로 전이. 재사용/새 발급 시 갱신, **callback 성공 시 보존** (`install_token` 과 동행 — `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 참조). TTL 만료 / 통합 삭제 경로에서만 NULL 처리. 옛 (V044 이전) 행은 NULL → 스캐너가 `created_at` 으로 fallback 하여 동일 24h TTL 적용 (배포 직후 일괄 expired 처리 없음 — `created_at` 이 이미 24h 이상 지난 행만 자연스럽게 expired 됨). V044 추가 |
| mall_id | String? | Cafe24 `mall_id` 의 plain projection — `credentials.mall_id` 와 동일 값을 plain 컬럼으로 복제. `(workspace_id, mall_id)` 부분 UNIQUE 인덱스가 SQL 레벨에서 중복 cafe24 통합을 거부하고, decrypt 없이 O(1) lookup 가능. cafe24 외 service_type 에서는 항상 NULL. 옛 (V045 이전) 행은 NULL — 다음 ORM save (callback / reauth) 시 backfill. **비즈니스 규칙**: 같은 workspace 내 같은 `mall_id` 의 cafe24 통합은 `app_type` 무관 최대 1행 — 한 mall 에 public·private 을 동시에 보유하면 토큰·webhook 처리 주체가 분기되어 사용자 혼란과 회계 충돌을 유발하므로 spec 차원에서 금지. Public App 지원 시 재검토 대상. V045 추가 |
| status_reason | String? | 상태별 사유 코드 (모두 `snake_case`). `error` → `insufficient_scope` / `auth_failed` / `network` / `unknown` (현행) — `credentials_unreadable` 은 기존 분기로 정합성 유지. **(2026-05-16 갱신)** `auth_failed` 는 401/403 외에 refresh `invalid_grant` 도 포함 (옛 `expired(refresh_failed)` 가 본 사유로 이행 — REQ HIGH-2). `network` 는 transport 3회 연속 실패 카운터 (`consecutive_network_failures` 컬럼) 가 3 도달 시 전이. `expired` → `token_expired` (refresh_token 없는 provider 의 token_expires_at 만료) / `install_timeout` (Cafe24 Private 24h TTL). **`refresh_failed` 는 제거 — `error(auth_failed)` 로 이행 (REQ HIGH-2).** `pending_install` → callback 실패 분기 코드 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`). `resource_not_found` 는 row 가 사라진 케이스라 DB 갱신 불가 → 후보값 제외 ([Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑)). `connected` → NULL. ※ DB 저장값은 `snake_case`, 동일 의미의 API 에러 코드는 `OAUTH_*` `UPPER_SNAKE_CASE` (의도적 분리) |
| consecutive_network_failures | int | 노드 실행 / 토큰 갱신 중 transport 실패 카운터. 성공 시 0 으로 리셋, 3 도달 시 `status='error', status_reason='network'` 로 전이 + 카운터 0 리셋. spec §6 `connected → error(network)` 전이의 구현 기반. V049 추가 (PR #67 REQ-C2). NOT NULL DEFAULT 0 — 기존 행은 0 으로 backfill |
| token_expires_at | Timestamp? | 토큰 만료 시각 (OAuth) |
| last_used_at | Timestamp? | 마지막 노드 실행에서 사용된 시각 (캐시) |
| last_rotated_at | Timestamp? | 자격 증명 마지막 회전 시각 (OAuth 재인증 또는 비OAuth 교체) |
| last_error | JSONB? | 최근 호출 실패의 요약 `{ code, message, at }` |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약조건**: `UNIQUE(workspace_id, name)` — 워크스페이스 내 별칭 유일성

### 2.10.1 IntegrationUsageLog

> 관련 문서: [Spec 통합 화면 §Recent activity](./2-navigation/4-integration.md)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| integration_id | UUID | FK → Integration (CASCADE) |
| node_execution_id | UUID | FK → NodeExecution |
| workflow_id | UUID | FK → Workflow (비정규화, 조회 최적화) |
| status | Enum | success / failed |
| error | JSONB? | 실패 시 에러 요약 `{ code, message }` |
| duration_ms | Integer | 호출 소요 시간 |
| at | Timestamp | 호출 시각 |

**보존 기간**: 90일. 일일 배치로 기한 초과 레코드 정리.

**인덱스**: `(integration_id, at DESC)` — 상세 페이지 최근 활동 조회용

### 2.11 KnowledgeBase

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 컬렉션 이름 |
| description | String? | 설명 |
| embedding_model | String | 임베딩 모델 식별자 (default: text-embedding-3-small) |
| embedding_dimension | Integer? | 저장된 청크들의 벡터 차원. 첫 임베딩 후 자동으로 채워지고, KB 재임베딩 시 NULL 로 reset |
| chunk_size | Integer | 청크 크기 (기본: 1000) |
| chunk_overlap | Integer | 청크 오버랩 (기본: 200) |
| document_count | Integer | 문서 수 (캐시) |
| reembed_status | Enum | KB 전체 재임베딩 잠금 상태: `idle` / `in_progress` (default: idle). 진입 시 atomic compare-and-swap |
| rag_mode | Enum | 검색 모드: `vector` (default) / `graph`. **생성 시에만 결정, 사후 변경 불가** ([Spec Graph RAG](./5-system/10-graph-rag.md)) |
| extraction_llm_config_id | UUID? | `rag_mode = 'graph'` 일 때 그래프 추출에 사용할 LLMConfig (chat 모델). NULL 이면 워크스페이스 default LLMConfig |
| max_hops | Integer | graph 검색 시 그래프 확장 깊이 (1 또는 2, default 1). `vector` 모드에서는 무시 |
| vector_seed_top_k | Integer | graph 검색 시 vector seed 개수 (default 5). `vector` 모드에서는 무시 |
| expanded_chunk_limit | Integer | graph expansion 후 회수할 청크 상한 (default 15). `vector` 모드에서는 무시 |
| entity_count | Integer | KB 의 entity 총 수 (캐시). `vector` 모드는 항상 0 |
| relation_count | Integer | KB 의 relation 총 수 (캐시). `vector` 모드는 항상 0 |
| reextract_status | Enum | KB 전체 그래프 재추출 잠금: `idle` / `in_progress` (default: idle). `vector` 모드에서는 사용 안 함 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.12 Document

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase |
| name | String | 문서 이름 |
| file_type | Enum | txt / md / pdf / csv |
| file_url | String | 원본 파일 저장 경로 |
| file_size | Integer | 파일 크기 (bytes) |
| embedding_status | Enum | `pending` / `processing` / `completed` / `error` / `failed`. `error` = in-flight 재시도 중 일시 오류, `failed` = 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패 |
| embedding_retry_count | Integer | 임베딩 재시도 누적 횟수. 성공 시 0 으로 리셋 |
| embedding_last_attempted_at | Timestamp? | 마지막 임베딩 시도 시각. stuck 회수 임계 비교에 사용 |
| embedding_error_message | Text? | 마지막 임베딩 오류 메시지 (sanitize 거친 사용자 노출용). 성공 시 NULL |
| graph_extraction_status | Enum? | `pending` / `processing` / `completed` / `error` / `failed`. `vector` 모드 문서는 NULL. 의미는 `embedding_status` 와 동일 |
| graph_retry_count | Integer | 그래프 추출 재시도 누적 횟수. 성공 시 0 |
| graph_last_attempted_at | Timestamp? | 마지막 그래프 추출 시도 시각 |
| graph_error_message | Text? | 마지막 그래프 추출 오류 메시지 |
| chunk_count | Integer | 생성된 청크 수 |
| tags | String[] | 태그 |
| metadata | JSONB | 메타데이터 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.12.1 DocumentChunk

> 관련 문서: [Spec 임베딩 파이프라인](./5-system/8-embedding-pipeline.md)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| document_id | UUID | FK → Document (CASCADE) |
| chunk_index | Integer | 청크 순서 (0-based) |
| content | Text | 청크 텍스트 원본 |
| embedding | Vector | 벡터 임베딩 (pgvector) |
| token_count | Integer | 청크의 토큰 수 |
| metadata | JSONB | `{ page?: number, section?: string }` |

**제약조건**: `UNIQUE(document_id, chunk_index)`

**인덱스**: 차원별 partial HNSW (V022 `vector` + V023 `halfvec` + V030–V032 후속 정비) — 유사도 검색 성능. 마이그레이션 상세는 [`spec/data-flow/6-knowledge-base.md §2.3`](./data-flow/6-knowledge-base.md) 및 `backend/migrations/V022_*.sql`, `V023_*.sql`, `V030_*.sql`–`V032_*.sql` 참조.

### 2.12.2 Entity

> 관련 문서: [Spec Graph RAG](./5-system/10-graph-rag.md). `rag_mode = 'graph'` 인 KB 에서만 사용된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| name | String | 정규화된 entity 이름 (소문자·trim) |
| display_name | String | 사용자 표시용 원형 |
| type | Enum | `person` / `organization` / `concept` / `location` / `event` / `other` |
| description | Text? | LLM 추출 짧은 설명 |
| mention_count | Integer | KB 내 청크에서 언급된 횟수 (캐시) |
| last_seen_chunk_id | UUID? | 마지막 등장 청크 (FK → DocumentChunk) |
| created_at | Timestamp | 첫 추출 시각 |
| updated_at | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, name, type)`

**인덱스**: `(knowledge_base_id, type)`, `(knowledge_base_id, mention_count DESC)`

### 2.12.3 Relation

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| head_entity_id | UUID | FK → Entity |
| tail_entity_id | UUID | FK → Entity |
| predicate | String | 관계 서술어 (예: `founded`, `employs`). P0 free-form, snake_case 권장 |
| evidence_chunk_id | UUID? | 추출 근거 청크 (FK → DocumentChunk) |
| weight | Integer | 동일 (head, predicate, tail) 가 여러 chunk 에서 발견된 누적 횟수 |
| created_at | Timestamp | 첫 추출 시각 |
| updated_at | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)`

**인덱스**: `(knowledge_base_id, head_entity_id)`, `(knowledge_base_id, tail_entity_id)`

### 2.12.4 ChunkEntity

| 필드 | 타입 | 설명 |
|------|------|------|
| chunk_id | UUID | FK → DocumentChunk (CASCADE) |
| entity_id | UUID | FK → Entity (CASCADE) |
| mention_text | String? | 청크에서 등장한 원형 표기 (정규화 전) |

**제약조건**: `PRIMARY KEY (chunk_id, entity_id)`

**인덱스**: `(entity_id)` — entity → chunk 역방향 회수 (검색 expansion 단계)

### 2.13 Execution

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| trigger_id | UUID? | FK → Trigger (트리거에 의한 실행 시) |
| status | Enum | pending / running / completed / failed / cancelled / waiting_for_input |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 실행 소요 시간 |
| input_data | JSONB? | 실행 입력 데이터 |
| output_data | JSONB? | 실행 최종 출력 데이터 |
| error | JSONB? | 에러 정보. 최초 failed NodeExecution의 에러를 참조/복사 (아래 참조) |
| executed_by | UUID? | FK → User (수동 실행 시) |
| parent_execution_id | UUID? | FK → Execution (서브 워크플로우 실행 시 부모 실행) |
| recursion_depth | Integer | 서브 워크플로우 호출 깊이 (root = 0) |

> 실행된 노드의 순서(옛 `execution_path UUID[]` 컬럼)는 별도 append-only 테이블 **ExecutionNodeLog** (§2.13.1) 가 보관한다. 다중 인스턴스에서 동시 INSERT 시 절대 순서를 보장하지 못하던 array 컬럼 모델은 V036 에서 DROP 되었고, V035 에서 도입된 `execution_node_log` 가 대체한다.

### 2.13.1 ExecutionNodeLog

`(execution_id, id)` 정렬이 곧 노드 실행 순서. BIGSERIAL `id` 는 PostgreSQL sequence 가 부여하므로 다중 backend 인스턴스에서도 concurrency-safe 하다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL | PK. sequence 부여 순서가 곧 실행 순서 |
| execution_id | UUID | FK → Execution (ON DELETE CASCADE) |
| node_id | UUID | 실행된 노드 ID |
| created_at | TimestampTZ | append 시각 (기본 `NOW()`) |

**인덱스**: `(execution_id, id)` — 단일 execution 의 노드 순서 조회 (`findById` 가 `executionPath: string[]` 응답을 본 테이블의 정렬 쿼리로 채움).

### 2.14 NodeExecution

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| execution_id | UUID | FK → Execution |
| node_id | UUID | FK → Node |
| status | Enum | pending / running / completed / failed / skipped / waiting_for_input |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 소요 시간 |
| input_data | JSONB | 노드 입력 데이터 |
| output_data | JSONB? | 노드 출력 데이터 |
| error | JSONB? | 에러 정보 `{ code, message, stack? }` |
| retry_count | Integer | 재시도 횟수 |
| interaction_data | JSONB? | 사용자 인터랙션 기록 — Form 제출 또는 버튼 클릭 정보. `{ interactionType: "form_submitted" \| "button_click" \| "button_continue", buttonId?, buttonLabel?, clickedAt, clickedBy }`. 본 필드 + `output_data.messages` (AI 노드) 가 [ConversationThread](./conventions/conversation-thread.md) 의 분산 SoT — 실행 후 timeline UI 가 reconstruct |

**Execution.error ↔ NodeExecution.error 관계:**

| 항목 | 설명 |
|------|------|
| 원본 | NodeExecution.error — 개별 노드 실행 실패 시 기록 |
| 복사 | Execution.error — 워크플로우 실행이 `failed` 상태로 전이될 때, **최초 failed NodeExecution**의 에러 정보를 복사 |
| 구조 | `{ nodeId: "uuid", code: "ERROR_CODE", message: "에러 설명" }` |
| 용도 | 실행 목록에서 Execution 단위로 에러 원인을 즉시 파악 가능 (NodeExecution 조회 없이) |

### 2.15 WorkflowVersion

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| version | Integer | 버전 번호 |
| snapshot | JSONB | 워크플로우 전체 스냅샷 (nodes, edges, settings) |
| change_summary | String? | 변경 사항 요약 |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |

### 2.16 LLMConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| provider | String | 프로바이더 (openai, anthropic, local 등) |
| name | String | 사용자 지정 이름 |
| api_key | String (encrypted) | API Key (암호화 저장) |
| base_url | String? | 커스텀 엔드포인트 URL (로컬 모델용) |
| default_model | String | 기본 모델 ID |
| default_params | JSONB | 기본 파라미터 (temperature, max_tokens 등) |
| is_default | Boolean | 기본 프로바이더 여부 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.17 AuthConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 인증 설정 이름 |
| type | Enum | api_key / bearer_token / basic_auth |
| config | JSONB (encrypted) | 인증 설정 상세 (암호화) |
| ip_whitelist | String[]? | 허용 IP 목록 |
| is_active | Boolean | 활성 상태 |
| last_used_at | Timestamp? | 마지막 사용 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.18 AuditLog

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User |
| action | String | 수행 액션 (workflow.create, trigger.update 등) |
| resource_type | String | 대상 리소스 유형 |
| resource_id | UUID | 대상 리소스 ID |
| details | JSONB | 변경 상세 |
| ip_address | String | 요청 IP |
| created_at | Timestamp | 발생 시각 |

> AuditLog는 워크스페이스 단위 리소스 변경을 기록한다. 워크스페이스 컨텍스트가 없는 인증 이벤트(로그인 성공/실패, 세션 강제 종료 등)는 별도의 **LoginHistory** 테이블에 보관한다.

### 2.18.1 RefreshToken

세션 단위는 `family_id` 다. refresh 회전 시 row가 새로 발급되지만 동일 family는 하나의 "디바이스 세션"으로 간주한다. 사용자에게 노출되는 "활성 세션" 은 `is_revoked = false` 인 같은 family의 가장 최신 row 메타데이터를 보여준다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → User (cascade) |
| token_hash | String | SHA-256(refresh_token), UNIQUE |
| family_id | UUID | 세션 식별자 (회전 시에도 유지) |
| is_revoked | Boolean | 강제/자연 만료 여부 |
| expires_at | Timestamp | 만료 시각 (7일 기본, rememberMe 시 30일) |
| device_label | String? | UA에서 파생된 표시 라벨 ("Chrome on macOS") |
| user_agent | String? | 발급 시점 raw UA |
| ip_address | String? | 발급 시점 클라이언트 IP (CF-Connecting-IP 우선) |
| last_used_at | Timestamp? | refresh 호출마다 갱신 |
| last_used_ip | String? | 마지막 활동 IP |
| created_at | Timestamp | 발급 시각 |

### 2.18.2 LoginHistory

인증 이벤트(로그인 성공·실패, TOTP 실패, 로그아웃, 세션 강제 종료, refresh token 재사용 감지)를 사용자 단위로 시간순 기록한다. 사용자가 직접 본인 이력을 조회한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID? | FK → User (cascade). 실패한 로그인에서 매칭 사용자가 없는 경우 NULL 가능 |
| email | String | 시도된 이메일 (enumeration 추적용) |
| event | Enum | login_success / login_failed / totp_failed / logout / session_revoked / token_reuse_detected |
| ip_address | String? | 클라이언트 IP |
| user_agent | String? | raw UA |
| device_label | String? | UA에서 파생된 표시 라벨 |
| family_id | UUID? | 관련 세션의 family_id (해당 시) |
| failure_reason | String? | INVALID_PASSWORD / ACCOUNT_LOCKED / TOTP_INVALID 등 |
| created_at | Timestamp | 발생 시각 |

보존 정책: 180일 경과 row는 일일 배치로 자동 삭제.

### 2.19 Notification

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User (수신자) |
| type | Enum | execution_failed / background_failed / schedule_failed / integration_expired / **integration_action_required** / marketplace_update / team_invite. **분리 원칙 (2026-05-16 A-1 결정)**: `integration_expired` 는 **수동성** — `token_expires_at` 만료 임계 (`status_reason='token_expired'`) 임박/도래를 알리는 passive notice. 사용자가 통합을 다시 쓰려 할 때만 행동 필요. `integration_action_required` 는 **능동성** — `error(auth_failed)` / `error(network)` / `error(insufficient_scope)` 같은 운영 중 발생한 장애로, 사용자가 즉시 손봐야 서비스가 복구되는 active alert. `install_timeout` (사용자가 외부 install 흐름 진행 중인 명시적 상태) 은 여전히 알림 미발사 (UI 배지만) — 사용자가 외부 흐름을 알고 있는 상태이므로 push 불필요. 자세한 임계·메시지는 [Spec 통합 §11.2](./2-navigation/4-integration.md#112-알림-생성) 참고. |
| title | String | 알림 제목 |
| message | String | 알림 내용 |
| resource_type | String? | 관련 리소스 유형 (workflow, integration 등) |
| resource_id | UUID? | 관련 리소스 ID |
| is_read | Boolean | 읽음 여부 (기본: false) |
| channel | Enum | in_app / email / both |
| email_sent_at | Timestamp? | 이메일 발송 시각 |
| created_at | Timestamp | 생성 시각 |

### 2.20 AssistantSession

Workflow AI Assistant의 채팅 세션. 단일 워크플로우 단위로 존재하며, 페이지 새로고침/재접속 시에도 이어서 대화할 수 있다. 상세: [Spec 3-workflow-editor/4: AI Assistant](./3-workflow-editor/4-ai-assistant.md).

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (cascade 삭제) |
| workflow_id | UUID | FK → Workflow (cascade 삭제) — 세션은 단일 워크플로우에 종속 |
| user_id | UUID | FK → User — 세션 생성자 |
| title | String? | 세션 제목 (첫 메시지 요약 또는 사용자 편집) |
| llm_config_id | UUID? | FK → LLMConfig — 지정 없으면 workspace default 사용 |
| status | Enum | active / archived — archived는 UI 상에서 숨김 |
| message_count | Int | 메시지 수 캐시 (비정규화) |
| last_interaction_at | Timestamp | 마지막 메시지/도구 호출 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.21 AssistantMessage

AssistantSession에 속하는 개별 메시지. 사용자 입력, assistant 응답, 도구 호출 결과를 시간 순서대로 기록한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| session_id | UUID | FK → AssistantSession (cascade 삭제) |
| role | Enum | user / assistant / tool / system — 시스템 메시지는 감사/디버그용, 일반적으로 프롬프트 빌더가 매 요청마다 동적으로 조립하므로 저장되지 않음 |
| content | Text? | 사용자/어시스턴트 텍스트 본문. role=tool인 경우 null 가능 |
| tool_calls | JSONB? | role=assistant에서 함께 발행된 tool_call 목록. 각 항목: `{id, name, arguments, kind: 'explore'\|'plan'\|'edit', result, planStepId?}` |
| tool_call_id | String? | role=tool에서 어떤 tool_call의 결과인지 참조 |
| plan | JSONB? | `propose_plan` tool-call 발행 시 스냅샷. `{title, summary, steps[], openQuestions[], approvedAt?}` |
| usage | JSONB? | `{inputTokens, outputTokens, totalTokens, thinkingTokens?, model}` — role=assistant의 턴 종료 시점에만 채움 |
| finish_reason | String? | `stop` / `tool_calls` / `length` / `content_filter` / `aborted` — role=assistant에만 |
| created_at | Timestamp | 생성 시각 |

> `tool_calls[].result` 는 Shadow 검증 결과 또는 탐색 결과의 축약본을 담아 사용자가 히스토리에서 맥락을 재현할 수 있도록 한다. 단, 대용량 원본(예: 50MB 워크플로우)은 요약 형태로만 기록한다(§9.1).

---

## 3. 인덱스 전략

| 테이블 | 인덱스 | 목적 |
|--------|--------|------|
| Workflow | (workspace_id, is_active) | 워크스페이스별 활성 워크플로우 조회 |
| Workflow | (workspace_id, name) | 이름 검색 |
| Node | (workflow_id) | 워크플로우별 노드 조회 |
| Node | (container_id) | 컨테이너별 자식 노드 조회 |
| Node | (tool_owner_id) | AI Agent별 Tool Area 노드 조회 |
| Edge | (workflow_id) | 워크플로우별 엣지 조회 |
| Edge | (workflow_id, type) | 워크플로우별 엣지 유형 조회 |
| Edge | (source_node_id) | 노드별 아웃바운드 엣지 |
| Execution | (workflow_id, started_at DESC) | 워크플로우별 실행 이력 |
| Execution | (status) | 상태별 실행 조회 |
| NodeExecution | (execution_id) | 실행별 노드 실행 조회 |
| ExecutionNodeLog | (execution_id, id) | 단일 실행의 노드 진행 순서 조회 |
| Trigger | (workspace_id, type) | 유형별 트리거 조회 |
| Trigger | (workspace_id, endpoint_path) UNIQUE | Webhook URL 라우팅 (워크스페이스 단위 유니크) |
| Schedule | (next_run_at, is_active) | 스케줄러 다음 실행 대상 조회 |
| AuditLog | (workspace_id, created_at DESC) | 감사 로그 조회 |
| RefreshToken | (user_id, family_id) WHERE is_revoked = false | 사용자별 활성 세션 그룹 조회 |
| LoginHistory | (user_id, created_at DESC) | 사용자별 로그인 이력 조회 |
| LoginHistory | (email, created_at DESC) | 미가입 이메일 시도 추적 |
| Integration | (workspace_id, service_type) | 서비스별 연동 조회 |
| Integration | (workspace_id, name) UNIQUE | 워크스페이스 내 별칭 유일성 |
| AssistantSession | (workflow_id, status, last_interaction_at DESC) | 워크플로우별 최근 활성 세션 조회 |
| AssistantSession | (workspace_id, user_id, updated_at DESC) | 사용자별 세션 목록 |
| AssistantMessage | (session_id, created_at ASC) | 세션 내 메시지 시간순 페이징 |
| Integration | (workspace_id, status) | 만료/에러 상태 배지 카운트 + `pending_install` TTL 스캐너 조회 + 중복 방지 lookup 겸용 ([Spec 통합 화면 §6](./2-navigation/4-integration.md#6-상태-전이)) |
| Integration | (install_token) WHERE install_token IS NOT NULL | Cafe24 Private App URL (`/3rd-party/cafe24/install/:installToken`) 의 단일 row 식별. NULL 비저장 부분 인덱스로 인덱스 크기 최소화. V043 |
| Integration | (workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL UNIQUE | Cafe24 통합 중복 방지 SQL 강제 + workspace 별 mall lookup O(1). 한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 (public 과 private 동시 보유 불가). V046 (V045 컬럼 추가와 분리 — CONCURRENTLY 와 ALTER 가 한 마이그레이션에 공존 불가) |
| Integration | (token_expires_at) | 만료 스캐너 배치 조회 |
| IntegrationUsageLog | (integration_id, at DESC) | 연동별 최근 호출 이력 |
| IntegrationUsageLog | (at) | 보존기간 초과 레코드 정리 배치 |
| Folder | (workspace_id, parent_id) | 워크스페이스별 폴더 조회 |
| Notification | (user_id, is_read, created_at DESC) | 사용자별 미읽은 알림 조회 |
| Notification | (workspace_id, created_at DESC) | 워크스페이스별 알림 조회 |

## Rationale

### Execution.execution_path → ExecutionNodeLog (V035 → V036)

옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.

이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.

- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.

설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.

### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)

옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).

```

#### `spec/3-workflow-editor/0-canvas.md`
```
# Spec: 캔버스 인터랙션 상세

> 관련 문서: [PRD 워크플로우 에디터](./_product-overview.md) · [Spec 노드 공통](./1-node-common.md) · [Spec 엣지](./2-edge.md) · [Spec 실행/디버깅](./3-execution.md) · [Spec AI Assistant](./4-ai-assistant.md)

---

## 1. 에디터 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  ← Workflows / My Workflow       [🤖] [Save] [▶ Run] [⋮]    │
│  ┌─────┬─────────────────────────────────────────┬────────┐ │
│  │Node │                                         │Setting │ │
│  │Palet│         Canvas                          │ Panel  │ │
│  │te   │                                         │   or   │ │
│  │     │    ┌──────┐    ┌──────┐                 │   AI   │ │
│  │Logic│    │Node A│───→│Node B│                 │Assist. │ │
│  │ if  │    └──────┘    └──┬───┘                 │ Panel  │ │
│  │ sw  │                   │                     │ (상호  │ │
│  │ lp  │              ┌────▼───┐                 │ 배타)  │ │
│  │ ... │              │Node C  │                 │        │ │
│  │     │              └────────┘                 │        │ │
│  │     │                                         │        │ │
│  │Flow │                                         │        │ │
│  │ wf  │                                         │        │ │
│  │     │                                         │        │ │
│  │AI   │                                         │        │ │
│  │ ag  │    ┌──────────────────────┐             │        │ │
│  │ tc  │    │     Minimap          │             │        │ │
│  │ ie  │    └──────────────────────┘             │        │ │
│  ├─────┴─────────────────────────────────────────┴────────┤ │
│  │  Run Results (실행 시)                        [−] [✕]  │ │
│  │  [📋 Table] [📊 Chart] [📄 Template] ...                │ │
│  │  (렌더링된 Presentation 노드 결과)                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  [Zoom -] ━━━━●━━━━ [Zoom +]  [Fit]  [Undo] [Redo]         │
└──────────────────────────────────────────────────────────────┘

> Run Results 드로어는 워크플로우 실행 시에만 표시된다. 상세는 [실행/디버깅 §10. Run Results Drawer](./3-execution.md#10-run-results-drawer) 참조.
> 헤더의 🤖 버튼은 AI Assistant 패널 토글이다. 우측 사이드바는 Node Settings Panel과 상호 배타적으로 표시된다. 상세는 [AI Assistant §3.1](./4-ai-assistant.md#31-패널-위치크기) 참조.
```

---

## 2. 에디터 헤더

| 요소 | 설명 |
|------|------|
| 뒤로가기(←) | 워크플로우 목록으로 이동 (변경사항 있으면 저장 확인) |
| 브레드크럼 | "Workflows / {워크플로우 이름}" |
| 워크플로우 이름 | 인라인 편집 가능 (클릭 시 텍스트 필드 전환) |
| AI Assistant 버튼 (🤖) | 우측 AI Assistant 패널 토글. 활성 상태 시 강조. 상세: [AI Assistant Spec](./4-ai-assistant.md) |
| Save 버튼 | 수동 저장 (Ctrl+S). 변경사항 없으면 비활성 |
| Run 버튼 | 워크플로우 실행. 드롭다운으로 실행 옵션 제공 |
| 더보기(⋮) | 설정, 버전 히스토리, 내보내기, 가져오기, 삭제 |

### 2.1 Run 버튼 드롭다운

| 옵션 | 설명 |
|------|------|
| Run | 전체 워크플로우 실행 |
| Run with Input | 테스트 입력 데이터 설정 후 실행 |
| Run from Selected | 선택된 노드부터 실행 |

---

## 3. 캔버스 인터랙션

### 3.1 뷰포트 제어

| 인터랙션 | 동작 |
|----------|------|
| 마우스 드래그 (빈 영역) | 캔버스 패닝 |
| 마우스 휠 | 줌 인/아웃 (줌 센터: 커서 위치) |
| Ctrl + 휠 | 줌 인/아웃 (대안) |
| 핀치 (트랙패드) | 줌 인/아웃 |
| 줌 슬라이더 | 하단 바의 슬라이더로 줌 레벨 조정 |
| Fit 버튼 | 모든 노드가 보이도록 뷰포트 자동 조정 |
| 줌 범위 | 최소 25% ~ 최대 200% |
| 더블클릭 (빈 영역) | 노드 추가 검색 팝업 열기 |

### 3.2 선택

| 인터랙션 | 동작 |
|----------|------|
| 노드 클릭 | 해당 노드 선택. 이전 선택 해제 |
| Shift + 클릭 | 기존 선택에 노드 추가/제거 (토글) |
| 빈 영역 드래그 | 선택 영역(Lasso) 생성 → 포함된 노드 모두 선택 |
| Ctrl + A | 모든 노드 선택 |
| Escape | 선택 해제 |
| 빈 영역 클릭 | 선택 해제, 설정 패널 닫기 |

### 3.3 노드 조작

| 인터랙션 | 동작 |
|----------|------|
| 팔레트에서 드래그 | 캔버스에 새 노드 추가 (드롭 위치에 배치) |
| 노드 드래그 | 노드 이동 (그리드 스냅 적용) |
| 다중 선택 후 드래그 | 선택된 모든 노드 동시 이동 |
| Ctrl + C | 선택된 노드(+연결된 엣지) 복사 |
| Ctrl + V | 복사된 노드 붙여넣기 (원본 옆에 오프셋 배치) |
| Ctrl + D | 선택된 노드 즉시 복제 |
| Delete / Backspace | 선택된 노드 삭제 (연결된 엣지도 함께 삭제) |
| 노드 더블클릭 | 설정 패널 열기 (또는 단일 클릭으로) |
| 우클릭 | 컨텍스트 메뉴 |
| 컨테이너 멤버십 | **엣지 기반** — body/emit/chain 엣지로 자동 지정/해제. 드래그-드롭으로 컨테이너 안에 넣는 UX는 없음. 자세한 규칙은 §11.2.1 참조 |
| Tool Area에 드래그 _(제거됨)_ | 노드를 AI Agent의 Tool Area에 드롭 → Tool 등록 (tool_owner_id 설정). 기존 데이터 흐름 엣지 자동 제거. 현재 비활성 — §12 박스 참조 |

### 3.4 노드 컨텍스트 메뉴 (우클릭)

| 항목 | 단축키 | 설명 |
|------|--------|------|
| 설정 열기 | Enter | 노드 설정 패널 |
| 실행 | — | 이 노드만 테스트 실행 |
| 여기서부터 실행 | — | 이 노드부터 워크플로우 실행 |
| 복제 | Ctrl+D | 노드 복제 |
| 비활성화/활성화 | — | 노드 토글 |
| 삭제 | Delete | 노드 삭제 |

### 3.5 캔버스 컨텍스트 메뉴 (빈 영역 우클릭)

| 항목 | 설명 |
|------|------|
| 노드 추가 | 노드 검색 팝업 (클릭 위치에 노드 배치) |
| 붙여넣기 | 클립보드의 노드 붙여넣기 |
| 전체 선택 | 모든 노드 선택 |
| 맞춤 보기 | Fit to View |

### 3.6 빈 캔버스 Empty State

새 워크플로우는 백엔드가 기본 트리거 노드를 1개 자동 주입하므로 "완전 빈 상태"는 거의 발생하지 않는다. 따라서 **트리거 카테고리 노드 외에 다른 노드가 없는 상태**를 "빈 워크플로우"로 간주해 캔버스 우측 상단에 "시작하기" 안내 카드를 표시한다. 사용자는 트리거 다음 단계를 바로 알 수 있다.

| 요소 | 내용 |
|------|------|
| 제목 | "워크플로우를 이어서 완성해봐요" |
| 소제목 | "트리거 다음에 이어 붙일 노드를 추가하면 워크플로우가 완성돼요." |
| 체크리스트 | 3단계: (1) 팔레트에서 다음 노드를 드래그 (2) 트리거 출력 포트에 연결 (3) 실행해서 결과 확인. 각 항목 우측에 "자세히" 링크 → 관련 매뉴얼 섹션 딥링크 |
| CTA | "시작 가이드 열기" → `/docs/01-getting-started/first-workflow` 새 탭. 노드 추가는 팔레트 드래그 앤 드롭으로 수행하므로 카드 내부에 별도 버튼을 두지 않음 |
| 표시 조건 | (완전 빈 상태) 또는 (트리거 카테고리 노드만 존재) 일 때 표시. 첫 비트리거 노드가 추가되면 300ms 페이드 아웃 |
| 위치·크기 | `top-right` Panel, 너비 340px. 트리거 노드와 겹치지 않도록 우측에 고정 |
| 접근성 | `role="region"` + `aria-label="시작하기"`. 숨김 상태에서는 `aria-hidden="true"`와 `tabIndex={-1}`로 포커스에서 제외 |
| 링크 동작 | 매뉴얼 딥링크는 새 탭으로 열어 작업 맥락을 보존 |

> 상세 스펙: [User Guide Spec](../2-navigation/13-user-guide.md)

---

## 4. 노드 팔레트 (좌측 패널)

### 4.1 구조

```
┌──────────────────┐
│ 🔍 Search nodes  │
├──────────────────┤
│ ⏱ Recent         │
│   If/Else        │
│   AI Agent       │
├──────────────────┤
│ ▼ Trigger        │
│   Manual Trigger │
├──────────────────┤
│ ▼ Logic          │
│   If/Else        │
│   Switch         │
│   Loop           │
│   Variable Decl  │
│   Variable Mod   │
│   Split          │
│   Map            │
│   ForEach        │
│   Parallel       │
│   Merge          │
│   Background     │
├──────────────────┤
│ ▼ Flow           │
│   Workflow       │
├──────────────────┤
│ ▼ AI             │
│   AI Agent       │
│   Text Classifier│
│   Info Extractor │
├──────────────────┤
│ ▼ Integration    │
│   HTTP Request   │
│   Database Query │
│   Send Email     │
├──────────────────┤
│ ▼ Data           │
│   Transform      │
│   Code           │
├──────────────────┤
│ ▼ Presentation   │
│   Carousel       │
│   Table          │
│   Chart          │
│   Form           │
│   Template       │
├──────────────────┤
│ ▼ Installed      │
│   (마켓플레이스   │
│    노드 표시)    │
└──────────────────┘
```

### 4.2 동작

| 동작 | 설명 |
|------|------|
| 검색 | 노드 이름 실시간 필터링 |
| 카테고리 접기/펼치기 | 섹션 헤더 클릭 |
| 드래그 | 캔버스로 드래그하여 노드 추가 |
| 클릭 | 캔버스 중앙(또는 빈 영역)에 노드 추가 |
| 패널 접기 | 토글 버튼으로 팔레트 숨기기/표시 |

### 4.3 빠른 노드 추가 팝업

캔버스 빈 영역 더블클릭 시 검색 팝업 표시:

```
┌────────────────────────┐
│ 🔍 Add node...         │
│ ┌────────────────────┐ │
│ │ If/Else (Logic)    │ │
│ │ AI Agent (AI)      │ │
│ │ Switch (Logic)     │ │
│ │ ...                │ │
│ └────────────────────┘ │
└────────────────────────┘
```

- 타이핑 즉시 필터링
- Enter로 선택, 커서/클릭 위치에 노드 배치
- Escape로 취소

---

## 5. 노드 시각적 표현

### 5.1 노드 외형

```
     ┌──────────────────────────┐
  ●──│  🔀 If/Else              │──● (True)
     │  "Check user role"       │──● (False)
     └──────────────────────────┘
  입력     노드 본체           출력 포트
  포트
```

| 요소 | 설명 |
|------|------|
| 입력 포트(●) | 좌측. 회색. 연결 가능 시 하이라이트 |
| 출력 포트(●) | 우측. 유형에 따라 복수 개 (라벨 표시). 색상은 포트 유형별로 구분: 데이터 포트=초록, 시스템 포트=파랑, 에러 포트=빨강 |
| 카테고리 색상 | 상단 바 또는 좌측 바. Logic=파랑, Flow=보라, AI=초록 |
| 아이콘 | 노드 유형별 고유 아이콘 |
| 이름 | 첫 줄: 노드 유형명 |
| 레이블 | 둘째 줄: 사용자 지정 이름 (있을 경우) |

### 5.2 노드 상태 표시

| 상태 | 시각 효과 |
|------|-----------|
| 기본 | 일반 표시 |
| 선택됨 | 두꺼운 테두리 + 그림자 |
| 비활성(Disabled) | 반투명 + 사선(대각선) 패턴 오버레이 |
| 실행 대기 | — (변화 없음) |
| 실행 중 | 테두리 펄스 애니메이션 (파랑) |
| 성공 | 하단 초록 체크 아이콘 (일정 시간 후 페이드) |
| 실패 | 빨강 테두리 + 에러 아이콘. 클릭 시 에러 상세 |
| 건너뜀 | 회색 처리 |
| Presentation 완료 | 노드 우하단에 👁 아이콘 배지. 클릭 시 Run Results 드로어 열기 + 해당 탭 선택 |

### 5.3 노드 설정 요약 (Configuration Summary)

노드 본체에 3번째 줄로 설정 요약 텍스트를 표시한다. 설정 패널을 열지 않고도 노드의 핵심 설정을 캔버스에서 파악할 수 있다.

#### 5.3.1 시각적 표현

```
     ┌──────────────────────────────────┐
  ●──│  🌐 HTTP Request                 │──● (Success)
     │  "Fetch user"                    │──● (Error)
     │  GET https://api.example.c...    │  ← 설정 요약 (3번째 줄)
     └──────────────────────────────────┘

     ┌──────────────────────────────────┐
  ●──│  🤖 AI Agent                     │──●
     │  "Customer Bot"                  │
     │  gpt-4o · 2 tools · 1 KB        │
     └──────────────────────────────────┘

     ┌──────────────────────────────────┐
  ●──│  📧 Send Email                   │──●
     │                                  │
     │  ⚠ Not configured               │  ← 미설정 경고 (앰버색)
     └──────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| 위치 | 노드 본체의 3번째 줄 (아이콘+유형명, 사용자 레이블 아래) |
| 폰트 | 기본 텍스트보다 작은 크기, 뮤트(muted) 색상 |
| 최대 길이 | 40자. 초과 시 `text-overflow: ellipsis` |
| 툴팁 | 요약 텍스트가 잘린 경우 호버 시 전체 텍스트 툴팁 표시 |
| 줌 의존성 | 줌 50% 미만에서는 요약 줄 숨김 (아이콘+유형명+레이블만 표시) |
| 인터랙션 | 표시 전용. 클릭 시 기존과 동일하게 설정 패널 열기 |
| 업데이트 | config 변경 시 실시간 업데이트 (자동 저장 디바운스와 동일, 2초) |

#### 5.3.2 미설정 상태

필수 설정이 완료되지 않은 노드:

| 항목 | 설명 |
|------|------|
| 표시 | 헤더 우측에 `AlertTriangle` 아이콘(`text-white/70`, hover 시 `text-white` 전환) + hover 시 툴팁으로 **구체적 누락 항목** 표시. **모든 노드 유형(일반/컨테이너) 동일하게 헤더 아이콘으로 통일**. 접근성을 위해 아이콘은 `aria-label="warning"` |
| 조건 | 노드의 필수 config 필드가 하나 이상 비어 있을 때 |
| 예외 | Manual Trigger — config 없으므로 아이콘 표시 안 함 |
| 선택적 필드만 | 모든 필드가 선택적이면 정상 summary(일반 노드는 body, 컨테이너는 헤더 텍스트) 표시 |

##### 노드별 미설정 경고 메시지

각 노드 유형은 어떤 필수 항목이 누락되었는지를 구체적으로 안내한다:

| 노드 | 경고 메시지 | 누락 조건 |
|------|-------------|-----------|
| If/Else | `⚠ Condition not set` | conditions 미설정 |
| Switch | `⚠ Switch value not set` | switchValue 미설정 |
| Loop | `⚠ Count not set` | count 미설정 |
| Variable Declaration | `⚠ No variables defined` | variables 미설정 |
| Variable Modification | `⚠ Variable not selected` | modifications 미설정 |
| Split | `⚠ Field path not set` | fieldPath 미설정 |
| Map | `⚠ Input field not set` | inputField 미설정 |
| ForEach | `⚠ Array field not set` | arrayField 미설정 |
| Merge | `⚠ Input count and strategy not set` / `⚠ Strategy not set` / `⚠ Input count not set` | 각 필드 누락 조합별 |
| Filter | `⚠ Input field not set` | inputField 미설정 |
| Workflow | `⚠ Workflow not selected` | workflowId 미설정 |
| HTTP Request | `⚠ URL not set` | url 미설정 |
| Database Query | `⚠ Query not set` | query 미설정 |
| Send Email | `⚠ Recipient not set` | to 미설정 |
| Transform | `⚠ No operations defined` | operations 미설정 |
| Code | `⚠ Code not written` | code 미설정 |
| Table | `⚠ Columns not defined` | columns 미설정 |
| Chart | `⚠ Chart type not selected` / `⚠ Axis fields not set` | chartType 또는 axis 누락 |
| Form | `⚠ No fields defined` | fields 미설정 |
| Template | `⚠ Template not set` | template 미설정 |
| AI Agent | `⚠ Model not selected` / `⚠ Default provider not configured` | model 및 llmConfigId 미설정 시 "Model not selected". "Default provider" 선택(`llmConfigId=""`) 시 LLM Config에서 실제 default 존재 여부를 확인하여 없으면 "Default provider not configured" 표시 |
| Text Classifier | `⚠ Model not selected` / `⚠ Default provider not configured` / `⚠ Categories not defined` | AI Agent와 동일한 LLM provider 규칙 적용 + categories 누락 시 별도 경고 |
| Info Extractor | `⚠ Model not selected` / `⚠ Default provider not configured` / `⚠ Output schema not defined` | AI Agent와 동일한 LLM provider 규칙 적용 + outputSchema 누락 시 별도 경고 |

#### 5.3.3 컨테이너 노드 요약

컨테이너 노드(Loop, ForEach, Map)는 헤더 바의 사용자 레이블 우측에 요약을 표시한다. Background 는 컨테이너 박스 없이 평면으로 렌더링되므로 일반 노드 본체의 요약 영역(§5.3.1)을 사용한다.

```
┌─────────────────────────────────────────────────┐
│ 🔄 Loop "Process Items"  10x · break   [−] ▼ ⋮ │
│ ──────────────────────────────────────── │
│   ...child nodes...                             │
└─────────────────────────────────────────────────┘
```

#### 5.3.4 노드별 요약 포맷

각 노드 유형의 요약 포맷은 해당 노드 스펙 문서에 "캔버스 요약" 항목으로 정의된다. 전체 목록은 [노드 개요 §1.2 summaryTemplate](../4-nodes/0-overview.md#12-노드-정의definition-속성) 참조.

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Manual Trigger | (표시 안 함) | — |
| If/Else | `{조건식}` (첫 번째 조건) | `role == "admin"` |
| Switch | `{값} → {N} cases` | `$input.type → 3 cases` |
| Loop | `{count}x` + break 표시 | `10x · break condition` |
| Variable Declaration | 변수명 나열 (최대 3개, 초과 시 `+N`) | `counter, total, +1` |
| Variable Modification | `{변수} {연산}` | `counter increment` |
| Split | `{필드경로}` | `$input.items` |
| Map | `{inputField}` | `$input.items` |
| ForEach | `{배열필드}` + 에러정책 | `$input.items · skip errors` |
| Parallel | `{N} branches` | `3 branches` |
| Merge | `{N} inputs · {전략}` | `3 inputs · wait_all` |
| Background | 알림 채널 | `notify: in_app, email` |
| Workflow | `{워크플로우 이름} · {모드}` | `Data Pipeline · sync` |
| AI Agent | `{모델} · {N} tools · {N} KB` | `gpt-4o · 2 tools · 1 KB` |
| Text Classifier | `{모델} · {N} categories` | `gpt-4o-mini · 3 categories` |
| Info Extractor | `{모델} · {N} fields` | `claude-sonnet · 4 fields` |
| HTTP Request | `{METHOD} {url}` | `GET https://api.exam...` |
| Database Query | `{queryType} · {쿼리 첫줄}` | `SELECT · SELECT * FROM us...` |
| Send Email | `to: {수신자}` | `to: user@exam..., +2` |
| Transform | `{N} operations` | `3 operations` |
| Code | `{language} · {N} lines` | `JavaScript · 12 lines` |
| Carousel | `{layout} · {titleField}` | `card · name` |
| Table | `{N} columns` + pagination 표시 | `3 columns · pagination` |
| Chart | `{chartType} · {x}/{y}` | `bar · month / revenue` |
| Form | `{N} fields · "{title}"` | `3 fields · "Approval"` |
| Template | `{format} · {N} lines` | `html · 9 lines` |

#### 5.3.5 엣지 케이스

| 케이스 | 동작 |
|--------|------|
| 표현식 사용 | 표현식 텍스트 그대로 표시: `{{ $input.role }}` (잘림 적용) |
| 삭제된 Integration 참조 | `⚠ Missing integration` (앰버색) |
| 삭제된 Workflow 참조 | `⚠ Missing workflow` (앰버색) |
| 커스텀/마켓플레이스 노드 | configSchema의 첫 2개 필드를 `key: value` 형태로 표시 |
| 사용자 레이블 미설정 | 2번째 줄(레이블)이 없으면 요약이 2번째 줄로 올라감 |

### 5.4 노드 삭제 버튼

노드에 시각적 삭제 버튼을 제공하여 우클릭 메뉴나 키보드 단축키 없이도 직관적으로 노드를 삭제할 수 있다.

#### 5.4.1 시각적 표현

노드 우상단 외곽에 20×20px 원형 버튼(✕ 아이콘)을 표시한다. 기본 배경은 뉴트럴 그레이, 호버 시 빨간색으로 변경된다.

```
                                    ╭───╮
     ┌──────────────────────────────┤ ✕ ├
  ●──│  🔀 If/Else                  ╰───╯──● (True)
     │  "Check user role"               │──● (False)
     │  role == "admin"                  │
     └──────────────────────────────────┘
```

#### 5.4.2 표시 조건

| 조건 | 삭제 버튼 |
|------|-----------|
| 마우스 호버 시 | fade in (200ms 트랜지션) |
| 마우스 호버 해제 | fade out (200ms). 단, 노드가 선택 상태이면 유지 |
| 노드 선택 상태 | 항상 표시 (호버 없이도) |
| Manual Trigger 노드 | **표시 안 함** (삭제 불가 제약, §9.2) |
| 워크플로우 실행 중 | **숨김** (실행 중 편집 차단) |
| 비활성(Disabled) 노드 | 표시 (삭제 허용) |
| 다중 선택 상태 | 각 노드에 개별 표시. 클릭 시 해당 노드만 삭제 (전체 선택 삭제는 Delete 키 사용) |
| 터치 디바이스 | 탭(선택) 시 표시, 다른 노드 탭 또는 캔버스 탭 시 숨김 |

#### 5.4.3 동작

| 항목 | 설명 |
|------|------|
| 클릭 | 노드 즉시 삭제 (Delete 키와 동일 동작: 연결된 엣지도 함께 삭제) |
| Undo | Ctrl+Z로 복원 가능 (기존 Undo 메커니즘과 동일) |
| 우클릭 메뉴 | 기존 "삭제" 항목 유지 (삭제 버튼은 추가 어포던스) |

---

## 6. 하단 툴바

```
[−] ━━━━━●━━━━━ [+]  100%  │  [Fit]  │  [↩ Undo] [↪ Redo]
```

| 요소 | 설명 |
|------|------|
| 줌 슬라이더 | 25% ~ 200% |
| 줌 퍼센트 | 현재 줌 레벨 표시 |
| Fit 버튼 | 전체 맞춤 보기 |
| Undo (Ctrl+Z) | 실행 취소 |
| Redo (Ctrl+Y) | 다시 실행 |

---

## 7. 미니맵

- 캔버스 우하단에 작은 오버레이로 표시
- 전체 워크플로우의 조감도
- 현재 뷰포트 영역을 사각형으로 표시
- 미니맵 내 클릭/드래그로 뷰포트 이동
- 토글 버튼으로 표시/숨김

---

## 8. 자동 저장

| 항목 | 설명 |
|------|------|
| 트리거 | 노드 추가/삭제/이동, 엣지 변경, 설정 변경 후 디바운스 (2초) |
| 저장 표시 | 헤더에 "Saving..." → "Saved" 상태 텍스트 |
| 충돌 처리 | 동시 편집 시 마지막 저장 우선. 충돌 감지 시 알림 |
| 오프라인 | 로컬 스토리지에 임시 저장. 온라인 복구 시 서버 동기화 |

### 8.1 자동 저장과 버전의 관계

자동 저장과 버전 스냅샷은 별도의 메커니즘이다. 자동 저장은 작업 유실 방지를 위한 것이며, 버전은 의미 있는 시점의 스냅샷이다.

| 동작 | 자동 저장 | 버전 생성 |
|------|-----------|-----------|
| 노드/엣지/설정 변경 | O (2초 디바운스) | X |
| 수동 저장 (Ctrl+S) | O (즉시) | O — 변경사항이 있을 경우에만 |
| 워크플로우 실행 | O (실행 전 저장) | O — 실행 직전 스냅샷 |
| 버전 복원 | O (복원 내용 저장) | O — 복원 시점 기록 |

- 자동 저장은 Workflow 테이블의 현재 상태를 직접 업데이트 (WorkflowVersion 생성 안 함)
- 수동 저장/실행 시에만 WorkflowVersion 레코드 생성
- 버전에는 자동 생성된 `change_summary` 포함 (예: "노드 3개 추가, 엣지 2개 수정")

---

## 9. 시작 노드 (Manual Trigger)

### 9.1 자동 생성

| 항목 | 설명 |
|------|------|
| 생성 시점 | 새 워크플로우 생성 시 서버에서 자동 생성 |
| 기본 위치 | positionX: 250, positionY: 300 |
| 노드 타입 | `manual_trigger` (카테고리: trigger) |
| 포트 | 입력 포트 없음, 출력 포트 1개 (Output) |

### 9.2 제약

| 항목 | 설명 |
|------|------|
| 삭제 불가 | 사용자가 Manual Trigger 노드를 삭제할 수 없음 |
| 중복 불가 | 워크플로우당 1개만 존재. 팔레트에서 추가 드래그 시 무시 |
| 실행 시 역할 | 워크플로우 입력 데이터를 그대로 출력 포트로 전달 (pass-through) |

---

## 10. 키보드 단축키 요약

| 단축키 | 동작 |
|--------|------|
| Ctrl + S | 저장 |
| Ctrl + Z | Undo |
| Ctrl + Y / Ctrl + Shift + Z | Redo |
| Ctrl + C | 복사 |
| Ctrl + V | 붙여넣기 |
| Ctrl + D | 복제 |
| Ctrl + A | 전체 선택 |
| Delete / Backspace | 선택 항목 삭제 |
| Escape | 선택 해제 |
| Space + 드래그 | 캔버스 패닝 (대안) |
| Ctrl + + / - | 줌 인/아웃 |
| Ctrl + 0 | 줌 100% |
| Ctrl + 1 | Fit to View |
| Ctrl + Shift + R | Run Results 드로어 토글 |
| Ctrl + / | AI Assistant 패널 토글 (상세: [AI Assistant §3.5](./4-ai-assistant.md#35-키보드-단축키)) |

---

## 11. 컨테이너 노드

Loop, ForEach, Map 노드는 **컨테이너**로 렌더링된다. 내부에 자식 노드를 배치할 수 있는 그룹이며 body/emit/done 포트 모델 + emit 기반 결과 수집을 공유한다. Background 는 PRD 3 §4.11 ND-BG-05 의 대안 구현 결정에 따라 컨테이너 박스를 사용하지 않고 일반 다중 출력 포트 노드로 평면 렌더링한다 — 본문은 `background` 포트 엣지로 시각적으로 분기가 드러나며, 메인과 같은 캔버스 그래프 안에 평면적으로 존재한다.

### 11.1 시각적 표현

```
┌─────────────────────────────────────────┐
│ 🔄 Loop "Process Items"    [−] ▼ ⋮     │  ← 헤더 바 (카테고리 색상)
│ ─────────────────────────────────────── │
│                                         │
│   ┌──────────┐    ┌──────────┐          │
│   │ Transform│───→│ HTTP Req │          │  ← 내부 자식 노드
│   └──────────┘    └──────────┘          │
│                                         │
└─────────────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| 헤더 바 | 노드 아이콘 + 유형명 + 사용자 레이블. 카테고리 색상 배경 |
| 바디 영역 | 확장 가능한 사각형. 내부 노드를 자유롭게 배치 |
| 최소 크기 | 400×300px |
| 자동 확장 | 내부 노드 배치에 맞춰 자동 확장 (여백: 40px) |
| 입출력 포트 | 컨테이너 좌측(입력)과 우측(출력)에 표시. 일반 노드와 동일 |

### 11.2 인터랙션

| 인터랙션 | 동작 |
|----------|------|
| 헤더 드래그 | 컨테이너 노드 단독 이동 (자식과는 시각적으로 분리되어 있음) |
| 더블클릭 (헤더) | 컨테이너 설정 패널 열기 |

> **시각 containment 미사용**: 컨테이너는 기존 일반 노드와 동일한 크기로 렌더된다. 자식 노드는 캔버스 어디에든 자유롭게 배치할 수 있고, 컨테이너 멤버십은 데이터 모델(`containerId`)로만 표현된다. 노드 헤더 아래에 `in <Container Label>` 배지가 표시되어 어떤 컨테이너의 멤버인지 한눈에 확인 가능.

### 11.2.1 자동 containerId 동기화 (edge-driven)

`containerId`는 현재 엣지의 **순수 함수**로 매 변경 시 자동 재계산된다. 설정 패널에 수동 지정 UI는 없고, 모든 멤버십은 엣지로 표현된다.

**전파 규칙** (`onConnect` 및 workflow 로드 시 fixed-point 반복):

1. **Body 포트 (강제)**: `Container.body → X` 연결 시 X의 `containerId`를 컨테이너로 **강제 set**. X가 이미 **다른** 컨테이너에 속해 있으면 **엣지 생성 거부 + 토스트 경고** (예: `Cannot connect: "Code" is already a body child of "Loop". Detach it from "Loop" first.`).
2. **Emit 포트 (강제)**: `Y → Container.emit` 연결도 같은 규칙. Y가 다른 컨테이너면 거부 + 경고.
3. **Chain 전파**: 컨테이너 child인 A에서 `A → B` 연결 시 B의 `containerId`가 비어 있으면 동일 컨테이너로 전파. 양 끝이 서로 다른 컨테이너면 조용히 변경 없음 (충돌 회피).

**삭제 시 자동 unset**:

- `Container.body → X` 엣지를 삭제하면 X의 `containerId`가 자동으로 null이 된다 (단, X → `Container.emit` 엣지가 남아 있거나 chain 중간이라면 그쪽 규칙으로 유지).
- 컨테이너 노드 삭제, 자식 노드 삭제, chain 내 중간 엣지 삭제 모두 동일하게 **전체 재계산**되어 dangling containerId가 남지 않는다.

**Workflow load 시 자동 복구**: 저장된 데이터에 edge 없이 containerId만 남아 있어도 로드 시 재계산이 실행되어 정합성이 보장된다. 복구가 실제로 발생하면 `isDirty=true`로 표시되어 사용자가 저장해 고정할 수 있다.

### 11.2.2 제약

| 제약 | 동작 |
|------|------|
| 트리거 노드 child 금지 | trigger 카테고리 노드는 컨테이너 child가 될 수 없음. 엣지 자동 전파가 거부하고, 실행 시에도 백엔드가 `CONTAINER_INVALID_CHILD` 에러로 실패 |
| 자기 자신 child 금지 | 컨테이너는 자기 자신을 `containerId`로 가질 수 없음 |
| 자손 컨테이너 child 금지 | A의 자손 컨테이너 B를 다시 A의 부모로 지정하면 cycle. 실행 시 `CONTAINER_CYCLE` 에러로 거부 |
| Emit 필수 | 컨테이너 실행 시 `emit` 포트에 정확히 1개의 child 노드가 연결되어야 함 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`). emit 엣지는 있으나 source가 child가 아닌 경우 오류 메시지에 해당 노드 이름 + 해결 안내 포함 |
| Body 내부 제약 | back-edge(순환), blocking 노드(form/buttons/ai_conversation)는 컨테이너 body 내부에서 사용 불가 |

### 11.3 컨테이너 삭제

자식 노드가 있는 컨테이너 노드를 삭제할 때 확인 다이얼로그를 표시한다.

#### 11.3.1 확인 다이얼로그

```
┌──────────────────────────────────────┐
│  Delete Container                    │
│  ──────────────────────────────────  │
│  "Process Items" (Loop) contains     │
│  3 child nodes.                      │
│                                      │
│  ○ Delete container and all children │
│  ● Ungroup: keep children, remove   │
│    container only                    │
│                                      │
│  [Cancel]              [Delete]      │
└──────────────────────────────────────┘
```

#### 11.3.2 삭제 옵션

| 옵션 | 동작 |
|------|------|
| **Delete container and all children** | 컨테이너 노드 + 모든 자식 노드(container_id가 해당 컨테이너를 가리키는 노드) + 관련 엣지 모두 삭제 |
| **Ungroup** (기본 선택) | 컨테이너 노드만 제거. 자식 노드는 top-level로 승격 (`container_id = null`). 자식 노드 간 내부 엣지는 유지. 컨테이너의 `body`/`background` 포트에서 자식으로의 엣지만 제거 |
| **Cancel** | 취소 |

#### 11.3.3 빈 컨테이너

자식 노드가 없는 컨테이너는 확인 다이얼로그 없이 즉시 삭제한다.

#### 11.3.4 삭제 버튼 위치

컨테이너 노드의 삭제 버튼(✕)은 헤더 바 우상단 외곽에 표시된다:

```
                                                     ╭───╮
┌────────────────────────────────────────────────────┤ ✕ ├
│ 🔄 Loop "Process Items"  10x · break   [−] ▼ ⋮    ╰───╯
│ ─────────────────────────────────────────────── │
│   ...child nodes...                             │
└─────────────────────────────────────────────────┘
```

### 11.4 중첩

| 항목 | 설명 |
|------|------|
| 중첩 허용 | 컨테이너 안에 다른 컨테이너 배치 가능 |
| 최대 중첩 깊이 | 3단계 |
| 레벨별 시각 구분 | 중첩 레벨마다 배경 틴트 변경 (L1: 5% 불투명도, L2: 10%, L3: 15%) |
| 초과 시 | 3단계 초과 중첩 시도 → "최대 중첩 깊이(3)를 초과할 수 없습니다" 토스트 |

---

## 12. AI Agent Tool Area

> ⚠ **재작성 예정 (현재 제거됨)** — 본 섹션의 Tool Area 시각·인터랙션은 현재 비활성이며, AI Agent 의 도구 연결 config 필드(`toolNodeIds` / `toolOverrides`)도 스키마에서 제거됐다. 캔버스에서 AI Agent 노드 우측 점선 영역 및 드래그/드롭 인터랙션을 노출하지 않는다. 새 도구 연결 디자인이 결정될 때 갱신한다. 자세한 사유와 백엔드 영향은 `spec/4-nodes/3-ai/1-ai-agent.md` §1 박스 + 이전 제거 작업의 history (`plan/complete/ai-agent-tool-connection-rewrite.md`) 참조. **재작성 작업은 [`plan/in-progress/ai-agent-tool-connection-rewrite.md`](../../plan/in-progress/ai-agent-tool-connection-rewrite.md) 에서 추적**.

AI Agent 노드에 연결된 도구 노드를 시각적으로 관리하는 전용 영역.

### 12.1 시각적 표현

```
                          ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
┌──────────────────┐      ╎ Tools            [−]  ╎
│  🤖 AI Agent     │      ╎                       ╎
│  "Customer Bot"  │──────╎  ┌─────────────────┐  ╎
│                  │      ╎  │ 🌐 HTTP Request │  ╎
└──────────────────┘      ╎  │ "Ticket API"    │  ╎
                          ╎  ├─────────────────┤  ╎
                          ╎  │ 🗄️ DB Query     │  ╎
                          ╎  │ "Search DB"     │  ╎
                          ╎  └─────────────────┘  ╎
                          └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
```

| 요소 | 설명 |
|------|------|
| 위치 | AI Agent 노드 우측에 자동 배치 |
| 테두리 | 점선 테두리 (AI 카테고리 색상) |
| 타이틀 | "Tools" 헤더 |
| 도구 카드 | 등록된 노드를 컴팩트 카드(아이콘 + 이름)로 표시 |

### 12.2 인터랙션

| 인터랙션 | 동작 |
|----------|------|
| 노드 드래그 인 | 캔버스의 노드를 Tool Area에 드롭 → 도구로 등록. 기존 데이터 흐름 엣지 자동 제거 |
| 도구 드래그 아웃 | Tool Area에서 캔버스로 드래그 → 도구 등록 해제, 일반 노드로 복원 |
| 도구 카드 클릭 | 해당 노드의 설정 패널 열기 |
| 도구 카드 우클릭 | 컨텍스트 메뉴: 설정 열기, 등록 해제, 삭제 |
| 접기/펼치기 [−] | 접힌 상태: "Tools (N)" 배지만 표시 |

### 12.3 AI Agent 삭제 시 도구 처리

AI Agent 노드를 삭제할 때 Tool Area에 등록된 도구 노드가 있으면 확인 다이얼로그를 표시한다:

```
┌──────────────────────────────────────┐
│  Delete AI Agent                     │
│  ──────────────────────────────────  │
│  "Customer Bot" has 2 registered     │
│  tools in its Tool Area.             │
│                                      │
│  Tools will be unregistered and      │
│  converted back to regular nodes.    │
│                                      │
│  [Cancel]              [Delete]      │
└──────────────────────────────────────┘
```

| 항목 | 설명 |
|------|------|
| Delete 확인 | AI Agent 노드 삭제 + Tool Area 제거. 등록된 도구 노드는 등록 해제 (`tool_owner_id = null`)되어 일반 노드로 캔버스에 복원 |
| 도구 없는 경우 | 확인 다이얼로그 없이 즉시 삭제 |

### 12.4 제약

| 항목 | 설명 |
|------|------|
| 데이터 흐름 참여 | Tool Area 노드는 데이터 흐름 그래프에 참여하지 않음 (엣지 연결 불가) |
| 실행 방식 | AI Agent의 LLM이 도구 호출 시 on-demand로 실행 |
| 소속 | 하나의 노드는 하나의 AI Agent Tool Area에만 등록 가능 |
| 컨테이너 겸용 불가 | 컨테이너 내부 노드(container_id가 설정된 노드)는 Tool Area에 등록 불가 (역방향도 동일) |

```

#### `spec/3-workflow-editor/1-node-common.md`
```
# Spec: 노드 공통 스펙

> 관련 문서: [PRD 워크플로우 에디터](./_product-overview.md#5-노드-설정-패널) · [PRD 노드 시스템](../4-nodes/_product-overview.md#2-노드-공통-요구사항) · [Spec 캔버스](./0-canvas.md) · [Spec 노드 개요](../4-nodes/0-overview.md)

---

## 1. 포트 시스템

### 1.1 입력 포트 (Input Port)

| 속성 | 설명 |
|------|------|
| 위치 | 노드 좌측 |
| 기본 개수 | 1개 (일부 노드는 복수: Merge) |
| 식별자 | `in` (기본), 복수 입력 시 `in_0`, `in_1`, ... |
| 다중 연결 | 하나의 입력 포트에 여러 엣지 연결 가능 (Merge 역할) |

### 1.2 출력 포트 (Output Port)

| 속성 | 설명 |
|------|------|
| 위치 | 노드 우측 |
| 기본 개수 | 1개 (분기 노드는 복수) |
| 식별자 | 노드 유형에 따라 다름 (아래 표) |
| 다중 연결 | 하나의 출력 포트에서 여러 엣지 연결 가능 (데이터 복제 전달) |
| 라벨 | 포트별 이름 표시 (예: "True", "False", "Case 1") |
| **error 포트** | 에러 처리 정책이 "Route to Error Port"인 경우 동적 생성. 빨간 원(●) 아이콘, 노드 우하단 위치 |
| **포트 색상** | 데이터 포트=초록(●), 시스템 포트=파랑(●), 에러 포트=빨강(●), **컨테이너 `emit` 포트=보라(●)**(Loop/ForEach/Map의 body 결과 수집 입력, 헤드 라벨도 보라색). 시스템 포트는 노드가 사전 정의하는 고정 출력(예: AI Agent의 `user_ended`, `max_turns`, `out`). 사용자 조건 포트와 시스템 포트 사이에는 점선 구분자를 표시. 입력 포트가 여러 개(예: 컨테이너의 `Input`·`Emit`)일 때는 핸들 옆에 라벨 텍스트가 함께 표시되어 구분 |

### 1.3 노드별 포트 구성

| 노드 유형 | 입력 | 출력 | 출력 포트 식별자 |
|-----------|------|------|-----------------|
| Manual Trigger | 0 | 1 | `out` — 워크플로우 시작점. 입력 포트 없음. 워크플로우 실행 입력 데이터를 패스스루 |
| If/Else | 1 | 2 | `true`, `false` |
| Switch | 1 | N (동적) | `case_0`, `case_1`, ..., `default` |
| Loop (**컨테이너**) | 2 | 2 (+error) | 입력: `in`, `emit`(보라색, body 결과 수집). 출력: `body` (반복 진입점), `done` (수집된 배열) |
| Variable Declaration | 1 | 1 | `out` |
| Variable Modification | 1 | 1 | `out` |
| Split | 1 | 1 | `out` (분리된 항목을 `[{index, value}]` 배열로 일괄 출력) |
| Map (**컨테이너**) | 2 | 2 (+error) | 입력: `in`, `emit`(보라색, body 결과 수집). 출력: `body` (각 항목 진입점), `done` (변환된 배열) |
| ForEach (**컨테이너**) | 2 | 2 (+error) | 입력: `in`, `emit`(보라색, body 결과 수집). 출력: `body` (각 항목 진입점), `done` (수집된 배열) |
| Parallel | 1 | N (동적) | `branch_0`, `branch_1`, ... |
| Merge | N (동적) | 1 | `out` |
| Background | 1 | 2 (+error) | `main` (즉시 진행), `background` (백그라운드 본문 진입점 — 컨테이너 박스 없이 평면으로 렌더링. PRD 3 §4.11 ND-BG-05 대안 구현) |
| Workflow | 1 | 1 | `out` |
| AI Agent | 1 | 1 | `out` |
| Text Classifier | 1 | N (동적) | `class_0`, `class_1`, ..., (카테고리별) |
| Information Extractor | 1 | 1 | `out` |
| HTTP Request | 1 | 2 | `success`, `error` |
| Database Query | 1 | 1 | `out` |
| Send Email | 1 | 1 | `out` |
| Transform | 1 | 1 | `out` |
| Code | 1 | 1 | `out` |
| Carousel | 1 | 1 또는 N (동적) | `out` (기본). 버튼 설정 시 `out` 제거 → port 버튼별 동적 포트 (`{button.id}`) + link 전용 시 `continue` 자동 생성 |
| Table | 1 | 1 또는 N (동적) | Carousel과 동일 |
| Chart | 1 | 1 또는 N (동적) | Carousel과 동일 |
| Form | 1 | 1 | `out` |
| Template | 1 | 1 또는 N (동적) | Carousel과 동일 |
| **(조건부) error** | — | +1 | `error` — 에러 처리 정책이 "Route to Error Port"인 노드에 동적 추가. 빨간 원, 노드 우하단 |

### 1.4 포트 인터랙션

| 인터랙션 | 설명 |
|----------|------|
| 호버 | 포트 확대 + 연결 가능 표시 |
| 드래그 시작 | 출력 포트에서 드래그 시작 → 임시 엣지 렌더링 |
| 드래그 중 | 유효한 입력 포트 위에서 하이라이트 (초록) |
| 드래그 중 (무효) | 유효하지 않은 대상 위에서 차단 표시 (빨강) |
| 드롭 | 유효한 입력 포트에 드롭 → 엣지 생성 |
| 드롭 (빈 영역) | 노드 추가 검색 팝업 표시 → 선택 시 노드 생성 + 엣지 연결 |

### 1.5 동적 포트 ID 규칙

동적 포트(Switch 케이스, Parallel 분기, Merge 입력, Text Classifier 카테고리 등)의 ID는 다음 규칙을 따른다:

| 규칙 | 설명 |
|------|------|
| ID 생성 | 동적 포트 추가 시 **UUID v4**를 할당한다 |
| ID 불변 | 포트 이름 변경, 순서 재정렬, 다른 포트 삭제 등 편집 작업에도 기존 포트 ID는 변경되지 않는다 |
| 엣지 유지 | 포트 ID가 불변이므로, 포트에 연결된 엣지는 편집 이후에도 자동으로 유지된다 |
| 포트 삭제 | 동적 포트를 삭제하면 해당 포트에 연결된 엣지도 함께 삭제된다 |

> 상세: [노드 개요 §1.3 PortDef](../4-nodes/0-overview.md#13-포트-정의-portdef)

---

## 2. 노드 설정 패널

### 2.1 패널 구조

```
┌──────────────────────────────┐
│  ✕  If/Else Settings         │
│  ─────────────────────────── │
│  Name: [Check user role___]  │
│  ─────────────────────────── │
│                              │
│  [Settings] [Code] [Info]    │
│                              │
│  ┌──────────────────────────┐│
│  │                          ││
│  │  (노드별 고유 설정 폼)   ││
│  │                          ││
│  └──────────────────────────┘│
│                              │
│  ─────────────────────────── │
│  Error Handling: [Stop ▼]    │
│  □ Disable this node         │
│  ─────────────────────────── │
│  Notes: [________________]   │
└──────────────────────────────┘
```

### 2.2 공통 탭

| 탭 | 내용 |
|----|------|
| **Settings** | 노드 유형별 고유 설정 폼 (기본 탭) |
| **Code** | JSON 형태로 노드 설정 직접 편집 (개발자용) |
| **Info** | 노드 유형 설명, 사용법 가이드, 최근 실행 결과 요약 |

### 2.3 공통 설정 필드

| 필드 | 설명 |
|------|------|
| Name | 노드 레이블 (캔버스에 표시) |
| Error Handling | 에러 발생 시 정책 (아래 참조) |
| Disable | 노드 비활성화 체크박스 |
| Notes | 메모/설명 텍스트 (마크다운 지원) |

### 2.3.1 필드 도움말 (FieldHelp)

노드 설정 폼의 각 필드는 라벨 우측에 도움말 아이콘(`?`)을 둘 수 있다. 사용자가 UI만으로 필드 의미를 파악하기 어려운 경우에 한해 제공한다.

| 규칙 | 설명 |
|------|------|
| 트리거 | 클릭 시 Popover 노출. 호버는 보조 수단이며 단독 사용은 금지(모바일 접근성) |
| 본문 | 한두 문장 설명 + 필요 시 매뉴얼 딥링크("자세히 보기 →") |
| 딥링크 | `/docs/<section>/<slug>#<anchor>` 형태. 반드시 새 탭(`target="_blank"`, `rel="noopener"`) |
| 접근성 | 트리거 버튼 `aria-label="도움말"` |
| 점진 채택 | 기존 필드의 `hint`(항상 노출 캡션)와 공존 가능. 복잡한 필드부터 순차 적용 |
| 대상 | 조건식, 표현식, Tool 설정, Fallback 정책, Cron 표현식, 인증 헤더 등 개념 설명이 필요한 필드 |

> 상세 스펙: [User Guide Spec](../2-navigation/13-user-guide.md) · [FieldHelp 컴포넌트](../2-navigation/13-user-guide.md#8-공용-mdx-컴포넌트)

### 2.4 에러 처리 정책

| 옵션 | 동작 |
|------|------|
| **Stop Workflow** (기본) | 에러 발생 시 워크플로우 실행 중단. 상태: failed |
| **Skip Node** | 에러 발생 시 이 노드를 건너뛰고 다음 노드로 진행. 출력: null |
| **Use Default Output** | 에러 발생 시 미리 설정한 기본 출력 값 사용. 아래 §2.5 참조 |
| **Retry** | 재시도 (최대 재시도 횟수, 재시도 간격 설정) |
| **Route to Error Port** | 에러 발생 시 에러 데이터를 `error` 포트로 전달. 선택 시 노드에 error 포트가 동적 생성됨. error 포트에 연결된 노드가 없으면 Stop Workflow 폴백. ([에러 처리 상세](../5-system/3-error-handling.md#32-route-to-error-port-상세) 참조) |

### 2.5 Use Default Output — 기본 출력값 정의

"Use Default Output" 정책 선택 시, 에러가 발생하면 사용자가 미리 설정한 기본 출력값을 대신 출력 포트로 전달한다.

#### 2.5.1 기본값 설정 UI

"Use Default Output" 선택 시 설정 패널에 기본값 입력 폼이 추가로 표시된다:

```
┌──────────────────────────────────┐
│  Error Handling: [Use Default ▼] │
│                                  │
│  ▼ Default Output Value          │
│  ┌──────────────────────────────┐│
│  │ {                            ││
│  │   "result": null,            ││
│  │   "status": "fallback"       ││
│  │ }                            ││
│  └──────────────────────────────┘│
│  [Reset to Type Default]         │
└──────────────────────────────────┘
```

- JSON 에디터로 기본 출력값을 직접 편집
- 구문 강조 및 JSON 유효성 실시간 검증
- "Reset to Type Default" 버튼: 타입별 기본값으로 초기화

#### 2.5.2 타입별 기본값 (사용자가 미지정 시)

사용자가 기본값을 직접 설정하지 않은 경우, 노드 출력 타입에 따라 아래 값이 자동 적용된다:

| 출력 타입 | 기본값 | 설명 |
|-----------|--------|------|
| Object | `{}` | 빈 객체 |
| Array | `[]` | 빈 배열 |
| String | `""` | 빈 문자열 |
| Number | `0` | 영 |
| Boolean | `false` | 거짓 |
| Null/Unknown | `null` | null |

> **타입 추론**: 노드의 마지막 정상 실행 출력에서 타입을 추론한다. 실행 이력이 없으면 `Object`(`{}`)를 기본 타입으로 사용한다.

#### 2.5.3 실행 시 동작

```
1. 노드 실행 중 에러 발생
2. 에러 처리 정책이 "Use Default Output"인지 확인
3. 사용자가 설정한 기본값이 있으면 → 해당 값을 출력으로 사용
4. 사용자 설정이 없으면 → 타입별 기본값 적용 (§2.5.2)
5. 기본값을 출력 포트로 전달 → 다음 노드 정상 실행
6. NodeExecution 상태: "completed" (에러 없이 성공 처리됨)
   - 단, node_execution.error 필드에 원래 에러 정보를 기록 (디버깅용)
   - 캔버스에서 해당 노드에 ⚠️ 아이콘 표시 (성공했지만 기본값이 사용되었음을 표시)
```

---

## 3. 표현식 시스템

노드 설정에서 이전 노드의 출력 데이터를 참조할 때 사용하는 표현식 문법.

> **상세 사양**: 문법 BNF, 지원 함수 전체 목록, 타입 시스템, 에러 처리 등은 [표현식 언어 상세 스펙](../5-system/5-expression-language.md) 참조.

### 3.1 표현식 문법

```
{{ expression }}
```

### 3.2 사용 가능한 참조

| 참조 | 예시 | 설명 |
|------|------|------|
| 이전 노드 출력 | `{{ $node["Node A"].output.field }}` | 특정 노드의 출력 필드 (expression **평가 결과**) |
| 이전 노드 설정 | `{{ $node["Node A"].config.field }}` | 특정 노드의 설정 필드 (expression **원본**, 미평가 형태) |
| 직전 노드 출력 | `{{ $input.field }}` | 바로 이전 연결 노드의 출력 |
| 변수 | `{{ $var.myVariable }}` | 선언된 변수 참조 |
| 실행 컨텍스트 | `{{ $execution.id }}` | 현재 실행 ID |
| 현재 시간 | `{{ $now }}` | 현재 타임스탬프 |
| 환경 변수 | `{{ $env.MY_VAR }}` | 환경 변수 (셀프 호스팅) |
| Loop 인덱스 | `{{ $loop.index }}` | 현재 반복 인덱스 |
| ForEach 항목 | `{{ $item }}` | ForEach의 현재 항목 |
| JSON Path | `{{ $input.data[0].name }}` | 중첩 객체/배열 접근 |

> **`.config.*` vs `.output.*`** — 노드의 설정 필드 중 expression(`{{ ... }}`)이 포함된 것 (예: Send Email 의 `subject`, `body`) 은 두 영역에 서로 다른 값을 노출한다. `.config.subject` 는 작성된 **원본 템플릿** (예: `"Hello {{ name }}"`), `.output.subject` 는 **평가 결과** (예: `"Hello Alice"`) 다. expression 미사용 필드 (예: `mode`, `chartType`) 는 두 값이 동일하므로 `.config.*` 만 사용해도 충분하다. 상세는 [실행 엔진 §5.1](../5-system/4-execution-engine.md#51-nodehandler-인터페이스), [CONVENTIONS Principle 7](../conventions/node-output.md) 참조.

### 3.3 표현식 에디터

| 기능 | 설명 |
|------|------|
| 자동완성 | `{{` 입력 시 사용 가능한 참조 목록 팝업. 현재 노드에서 접근 가능한 조상 노드·변수만 표시 (토폴로지 기반) |
| 컨테이너 스코프 | 루프/ForEach 안에서만 `$loop` / `$item` / `$itemIndex` 제안. `parallel` 컨테이너는 바깥 스코프를 차단 |
| 노드 출력 스키마 | 이전 노드의 출력 구조를 트리 형태로 탐색/선택 |
| 실시간 검증 | 문법 오류는 빨간색, 접근 불가 노드·스코프 밖 변수 참조는 주황색 경고 |
| 미리보기 | 마지막 실행 데이터 기준으로 표현식 결과 미리보기 |
| 모드 전환 

... (truncated due to size limit) ...

### plan/in-progress 진행 중 문서

#### `plan/in-progress/0-unimplemented-overview.md`
```
# 미구현 항목 오버뷰 (PRD/Spec 기준)

> 작성일: 2026-05-11
> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것

본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.

---

## 작업 흐름 권장 순서

다음 순서로 plan을 소화하면 의존성 충돌이 적다.

1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
3. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
4. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
5. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
6. **`2fa-webauthn.md`** — WebAuthn 2FA.
7. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
8. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
9. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).

> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.

### 최근 완료

- ✅ **`prd-spec-sync.md`** (2026-05-11, `plan/complete/prd-spec-sync.md`) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 (knowledge-base.mdx 한·영) 정합화.
- ✅ **`logic-node-followups.md`** (2026-05-11, `plan/complete/logic-node-followups.md`) — D1 If/Else `is_type`/`regex` evaluator 통합 ✅, D2 Loop breakCondition + meta.exitReason ✅, D3 Merge P2 → 별도 plan (`merge-p2-async-fanin.md`) 분리 ✅, D4 Switch `meta.value` alias 제거 + 마이그레이션 ✅, D5 Variable Modification recordValues opt-in + 마스킹 유틸 ✅, D6 보류 ✅, D7 case id reserved word 검증 ✅. spec/4-nodes/1-logic 의 P0/P1 미구현 표기 모두 정리 (Merge dormant 표기는 별도 plan 분리에 따른 의도적 잔존).
- ✅ **`llm-provider-followups.md`** (2026-05-11, `plan/complete/llm-provider-followups.md`) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅. `AzureOpenAIClient`·`LocalClient` 가 `OpenAIClient.stream()` 을 상속하여 자동 지원. spec 2종(7-llm-client.md §8.2, 4-ai-assistant.md §1.2/§11/§13/§15) 🚧·❌→✅, PRD 0 §6.1, 매뉴얼 4종(llm-config.mdx 한·영 + overview.mdx 한·영) 정합화.

---

## 카테고리별 미구현 항목 매핑

### A. 제품 기능 (사용자 가치 큰 기능)

| PRD/Spec 항목 | 상태 | 처리 plan |
|---------------|------|-----------|
| **PRD 1 §3.9 NAV-MP-01~07 Marketplace** | ❌ 전체 미구현 (i18n 사전에만 등장) | `marketplace-and-plugin-sdk.md` |
| **PRD 4 §4 MP-CT/CS/PB-***| ❌ 전체 미구현 | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §10 ND-EX-01~03 노드 확장성 SDK** | ❌ 우선순위 3 | `marketplace-and-plugin-sdk.md` |
| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ | `marketplace-and-plugin-sdk.md` |
| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §6.1 ND-AG-06/10/21 AI Agent 도구 연결** | 🚧 의도적 제거, 재작성 예정 | `ai-agent-tool-connection-rewrite.md` |
| **PRD 3 §4.9 ND-PL-03 Parallel 결과 합산 / 중첩 Parallel / waitAll=false** | 🚧 P2 예정 | `parallel-p2.md` |
| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | ✅ 활성화 (D2, meta.exitReason 추가) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | ✅ 구현 (D1, evaluator 통합) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | ✅ 핸들러 구현 + spec 정합 (PR-1) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod meta** | ✅ 핸들러 구현 + recordValues opt-in (D5) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
| **Spec 4-nodes/1-logic/12-background 모니터링 API** | ❌ 미구현 (`meta.backgroundRunId` 키만 발급) | `background-monitoring-api.md` |
| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 미구현 (future PRD) | `replay-rerun.md` |
| **PRD 1 §3.11 NAV-UP-05 미가입자 초대 토큰** | 🚧 후속 (가입 사용자 추가만 ✅) | `team-workspace-followups.md` |
| **PRD 1 §3.1 NAV-WF-07 공유 워크플로우 표시** | 🚧 백엔드만 존재, UI 미노출 | `team-workspace-followups.md` |
| **PRD 5 NF-SC-10 2FA WebAuthn** | 🚧 TOTP만 ✅, WebAuthn 후속 | `2fa-webauthn.md` |

### B. 인프라/배포 (셀프 호스팅)

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |

### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:

| Spec 항목 | 처리 결과 |
|-----------|-----------|
| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |

### D. 접근성

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |

### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:

| 항목 | 처리 결과 |
|------|-----------|
| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
| **사용자 매뉴얼** | `frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |

---

## plan 문서 목록

```
plan/in-progress/
├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
├── merge-p2-async-fanin.md            ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
├── replay-rerun.md                    ← Re-run 재실행 기능 도입
├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK

plan/complete/
├── prd-spec-sync.md                   ← §E "PRD/Spec ↔ 코드 정합성 정리" 완료 (2026-05-11)
├── llm-provider-followups.md          ← §C "LLM Provider 확장" 완료 (2026-05-11)
└── logic-node-followups.md            ← Logic 노드 잔여 P0/P1 (D1·D2·D4·D5·D7) 완료, D3 → merge-p2-async-fanin.md 분리 (2026-05-11)
```

각 plan 문서는 다음 구조를 따른다:

- **배경** — PRD/Spec의 어떤 항목이 미구현인지, 현 코드 상태
- **관련 문서** — PRD·Spec·메모리·기존 plan 링크
- **작업 단위** — 체크박스 todo 목록 (SDD: spec → 테스트 → 구현 순서)
- **수용 기준** — Definition of Done
- **의존성·리스크** — 다른 plan, 외부 시스템 영향

---

## 참고: 이미 완료되어 본 plan에 포함되지 않은 영역

- `plan/complete/feature-roadmap/stages.md` Stage 1~11 (LLM 토큰 추적 / Parallel P1 / Background 평면 구현 / 팀 워크스페이스 UI / RBAC / 2FA TOTP / 조직 Integration 공유 / OTel 트레이싱 / 알림 룰 CRUD / 접근성 자동화 / 매뉴얼 검색)
- `plan/complete/node-architecture/*` (handler colocation, schema audit, sub-workflow execution 등)
- `plan/complete/workflow-assistant/*` (Workflow AI Assistant 본체)
- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG PRD 단계 — 코드 구현은 ✅, PRD 표기 갱신은 본 plan의 `prd-spec-sync.md`에서 처리)

```

#### `plan/in-progress/20260516-full-review/RESOLUTION.md`
```
---
worktree: full-review-fixes-a1b2c3
started: 2026-05-16
owner: developer
---

# Full-Review Resolution — 2026-05-16

> 기준 보고서: `plan/in-progress/20260516-full-review/SUMMARY.md`
> 작업 worktree: `.claude/worktrees/full-review-fixes-a1b2c3` / branch `claude/full-review-fixes-a1b2c3`
> 사용자 요청: "우선순위가 높은 순서대로 의사결정이 필요 없는 부분을 순차적으로 경고 단계까지 모두 처리해줘"
> 검증: 백엔드 단위 테스트 3,762/3,762 통과, `tsc --noEmit -p tsconfig.build.json` 통과

본 문서는 위 SUMMARY 의 발견사항 중 "의사결정 불필요 + 위험도 Critical~Warning" 항목을 1회 작업으로 일괄 처리한 결과를 기록한다. 후속 의사결정이 필요한 항목과 deferred 항목은 마지막 두 절에서 명시한다.

---

## 처리 완료 (Critical)

| # | 위치 | 변경 |
|---|------|------|
| C-5 | `backend/src/modules/execution-engine/execution-engine.service.ts:3637,3679,3735` | `planContainerBody` 안의 `allNodes.find()` 를 함수 도입부에서 1회 생성한 `nodeMap` 의 `nodeMap.get()` 호출로 전환. 동일 `nodeMap` 을 반환 plan 에 재사용해 중복 Map 생성 제거 |
| C-7 | spec/*.md 11곳 | `11-mcp-client.md#23-internal-bridge` 깨진 앵커를 실제 헤딩(`### 2.3 Internal Bridge (in-process)`) 의 GFM slug `#23-internal-bridge-in-process` 로 일괄 치환 |
| C-9 | `backend/migrations/V052__notification_type_integration_action_required.sql` (신규) | `notification.type` CHECK 제약에 `integration_action_required` 추가. `IntegrationActionRequiredNotifierService` INSERT 가 check_violation 으로 실패하던 결함 해소 |
| C-11 (부분) | `backend/src/main.ts`, `backend/src/modules/hooks/hooks.service.spec.ts` | `NestFactory.create(AppModule, { rawBody: true })` 적용 (HMAC 서명 검증 활성화). HMAC + bearer 경로 단위 테스트 9건 추가 (length mismatch / equal-length mismatch / valid match / missing signature / missing rawBody / signature mismatch / valid sha256 / unsupported algorithm 등) |
| C-13 | `backend/package.json` | `overrides` 에 `protobufjs ^7.5.6`, `fast-uri ^3.1.2` 추가. `npm audit` 결과 fast-uri/protobufjs 다중 CVE 해소 (잔여: hono via @modelcontextprotocol/sdk W-57, OTel breaking W-54/W-56 — deferred) |
| C-14 | `spec/conventions/conversation-thread.md:3` | `[Spec AI 공통 §11](.../0-common.md#11-conversation-context)` → `[Spec AI 공통 §10](.../0-common.md#10-conversation-context-자동-컨텍스트-주입)`. 실제 헤딩 번호 10 과 동기화 |
| C-15 | `spec/2-navigation/4-integration.md:951` | `[Spec Cafe24 API 메타데이터 §6](.../cafe24-api-metadata.md#6-allowlist-와의-관계)` → `§7` / `#7-allowlist-와의-관계`. 실제 헤딩 번호 7 과 동기화 |

W-60 (V049 파일-디렉토리 충돌) 은 현 base 커밋(`3f5457aa`) 에 빈 V049 디렉토리가 존재하지 않아 별도 조치 없이 already-resolved 로 분류한다.

---

## 처리 완료 (Warning)

| # | 위치 | 변경 |
|---|------|------|
| W-2 | `backend/src/modules/hooks/hooks.service.ts:18,159` | HMAC 알고리즘 허용 목록 `Set(['sha256','sha512'])` 신설. `verifyAuth` 안에서 외부 입력 algorithm 을 허용 목록 외 값일 때 `UnauthorizedException`. 단위 테스트 1건 추가 |
| W-15 | `spec/5-system/10-graph-rag.md:236` | `graph_extraction_status` Enum 값에 `failed` 추가 + 부연 설명. §7/§3.2 의 영구 실패 분기와 자체 모순 해소 |
| W-21 | `backend/src/modules/statistics/statistics.service.ts:80` | `getSummary` 의 unconditional 워크스페이스 집계 쿼리 + workflowId 별 재집계 패턴을 단일 QueryBuilder 로 통합. workflowId 가 있을 때만 `andWhere` 추가, 첫 쿼리 결과 폐기 제거 |
| W-22 | `backend/src/modules/executions/executions.service.ts:20,127` | `executionPath` 조회에 `MAX_EXECUTION_PATH_ROWS=10000` 상한 (`take`). 대규모 ForEach 로그 행 메모리 적재량 안전망. 관련 spec 테스트 갱신 |
| W-25 | `backend/src/modules/websocket/websocket.service.ts:92` | `sanitizePayloadForWs` 가 자식 mutation 없는 경우 원본 참조를 반환하도록 변경. GC pressure 감소 + emit hot path 의 객체 할당 제거 |
| W-31 (5건) | `backend/src/modules/integrations/services/credentials-transformer.ts`, `backend/src/modules/integrations/integrations.service.ts:702`, `backend/src/modules/integrations/integration-oauth.service.ts:282,307`, `backend/src/nodes/presentation/table/table.handler.ts:264` | `console.warn` / `console.error` 5곳을 NestJS `Logger` 인스턴스로 교체. 모듈 수준 인스턴스가 필요한 곳은 `new Logger('<name>')` 로 import |
| W-37 | `backend/src/modules/hooks/hooks.service.spec.ts` | `constantTimeEquals` 분기 (length mismatch / equal-length / 성공) 단위 테스트가 bearer + HMAC 시나리오로 9건 추가 (C-11 와 합쳐 한 번에 작성) |
| W-41 | `backend/test/webhook-trigger.e2e-spec.ts:74,95,112,134` | `e2e-X-${Date.now()}` 4곳을 `crypto.randomBytes(8).toString('hex')` 기반으로 전환. 동시 e2e 실행 시 endpointPath 충돌 방지 |
| W-46 | `backend/src/common/dto/pagination.dto.ts:11,53` | `PaginationQueryDto.sort` 에 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 적용. 서비스별 `getSortColumn()` 화이트리스트를 보조하는 DTO 레벨 1차 차단 |
| W-55 | `backend/package.json` | C-13 와 함께 `fast-uri` overrides 추가. `npm audit` GHSA-q3j6-qgpj-74h6 / GHSA-v39h-62p7-jpjc 해소 |
| W-63 | `backend/migrations/V053__notification_workspace_type_resource_idx.{sql,conf}` (신규) | `notification(workspace_id, type, resource_id, created_at DESC)` 복합 인덱스를 `CONCURRENTLY` 로 추가. `NotificationsService.hasRecentByResource` idempotency 쿼리 hot path 인덱스 보강 |
| W-68 | `backend/src/modules/websocket/websocket.gateway.ts:217` | `authorize()` await 경계 이후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사 추가. 동시 subscribe 가 한도 검사를 interleave 하는 race 해소 |
| W-69 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | `pagination` 필드의 `cursor?: string` 제거 + 사유 문구 추가. §3, §4.2 의 cursor 언급 동시 삭제 |
| W-77 | `frontend/README.md:7` | `yarn dev` / `pnpm dev` / `bun dev` 명령 제거. 루트 CLAUDE.md "패키지 매니저" 규약(npm 전용) 과 정합 |
| W-79 | `packages/expression-engine/README.md`, `packages/node-summary/README.md` (신규) | 두 패키지의 목적·빌드·사용·boundary 를 정리한 최소 README 작성 |
| W-80 | `README.md:333` | h1 `# integration (SSO)` 을 h2 로 강등. 직속 자식 `## Google OAuth 연동 설정` 도 h3 로 동시 강등 |

> 자료의 단일 진실 원칙 상, 본 표의 변경은 모두 동일 branch (`claude/full-review-fixes-a1b2c3`) 의 단일 작업 단위로 묶여 있다.

---

## 의사결정 보류 (사용자/스펙 합의 필요)

| # | 사유 |
|---|------|
| C-1 / C-2 | Re-run 기능 백엔드·프론트엔드 완전 미구현. 신규 worktree 에서 `replay-rerun.md` PR2 단위로 별도 진행 필요 |
| C-3 | AI Agent 일반 도구 연결 모델 결정 — 사용자 합의 필요 |
| C-4 | `sanitizePayloadForWs` 설정 레이어 이동 — emit hot path 의 trust boundary 재설계 필요 (allowlist 정의가 의사결정 사안) |
| C-6 | `ExecutionEngineService` God-Object 분해 — 4단계 분리안 (`AiConversationOrchestrator` 등) 별도 plan 으로 진행 |
| C-8 | README 포트 혼재 — 환경별(host dev=3000 vs docker fullstack=3012) 매핑 정확도 확인이 필요 |
| C-10 | `AuthConfig.config` 평문 → encryptedJsonTransformer + 평문 행 마이그레이션 스크립트 — 데이터 마이그레이션 절차 사용자 합의 필요 |
| C-12 | Cafe24 OAuth callback/refresh e2e — HTTP stub 컨테이너 추가가 e2e 인프라 변경 사안 |
| W-1 | WebSocket CORS `*` → frontendUrl 화이트리스트 — 환경 분기(`NODE_ENV==='production'`) 외의 조건 결정 필요 |
| W-3 | DOMPurify `ALLOWED_ATTR` 의 `style` 제거 — CSS 정책 결정 필요 |
| W-4 / W-5 | DNS rebinding / DB 호스트 SSRF — 보안 정책 결정 필요 |
| W-6 | sub-workflow workspace 격리 — 엔진 invariant 변경, 별도 plan 권장 |
| W-7~W-14 | 요구사항 항목 (`errorPolicy`, marketplace SDK, integration_action_required UI 등) — 각각 별도 plan |
| W-16 | API 경로 prefix `/api/v1/` vs `/api/` — 정책 확정 필요 |
| W-18 | spec §2.2 API 직호출 대비 — 별도 spec 보강 |
| W-19 | i18n parity main 병합 여부 확인 (다른 worktree 상태 검증) |
| W-23 | `deriveContainerAssignments` 16 패스 — 자료구조 재설계 필요 |
| W-24 | `appendExecutionPath` 배치 INSERT 전환 — 별도 PR 권장 |
| W-26 / W-27 | expression-resolver/ws snapshot 캐시 — 별도 PR 권장 |
| W-28 / W-29 / W-30 / W-33~W-36 | 대형 파일 분해·헬퍼 단일화 리팩토링 — 영역별 별도 PR |
| W-44 / W-47 / W-48 | API 계약 변경 (controller 단 IDOR 보강, throttle, PATCH 패턴) — 호환성·spec 동시 갱신 필요 |
| W-49~W-53 | 아키텍처 디커플링 (DI 토큰, 순환 의존 해소, common/shared 경계, Cafe24ApiClient 분해) — 별도 plan |
| W-54 / W-56 | OpenTelemetry 0.76.0 업데이트 — breaking change, 호환성 검증 필요 |
| W-57 | `@modelcontextprotocol/sdk` 최신화 → hono 취약점 해소 — SDK breaking 확인 필요 |
| W-58 / W-59 | Playwright/MinIO 이미지 버전 정렬 — 사용자 환경 검증 |
| W-61 / W-62 / W-64 | DB·entity·service 변경 — 호출자 영향 확인 필요 |
| W-65 / W-66 / W-67 | 동시성 (boot race, schedule runner, foreach context clone) — invariant 변경, 별도 PR |
| W-70 / W-71 | 커밋 원자성 원칙 수립 — 프로세스 차원의 합의 |
| W-72 / W-73 / W-74 / W-75 | 부작용 (redis config 확장, OnModuleDestroy, OAUTH_STUB_MODE 가드 통합, mock 보강) — 영향 범위 확인 필요 |
| W-76 | `INTEGRATION_ENCRYPTION_KEY` README 보강 — C-8 README 포트 결정과 함께 처리 권장 |
| W-78 | spec Rationale 56개 보강 — 우선순위별 별도 plan |

---

## 검증

```bash
cd backend
npx tsc --noEmit -p tsconfig.build.json   # exit 0 (src 빌드 그래프 클린)
npx jest --no-coverage --silent           # 210 suites / 3,762 tests / all passed
npm audit                                 # fast-uri / protobufjs CVE 해소 (잔여: hono via mcp/sdk W-57, OTel W-54/W-56)
```

후속 작업으로 commit + PR 작성은 사용자 confirm 후 진행한다.

---

## 후속 조치 (`/ai-review` 통합 후 처리)

PR #126 commit `13d21fcd` 에 대한 `/ai-review` (router 11/13 선별, Critical 0 / Warning 15 / Info 27) 결과 발견된 Warning 항목을 추가 처리했다. 검증: tsc clean, 211 suites / 3,772 tests 통과.

| # | 영역 | 위치 | 변경 |
|---|------|------|------|
| F-A | 부작용/DB | `backend/migrations/V052__*.{sql,conf}` | `ALTER TABLE ADD CONSTRAINT NOT VALID` + `VALIDATE CONSTRAINT` 2단계 + 화이트리스트 외 행 pre-flight 검사 (`RAISE EXCEPTION`). `executeInTransaction=false` 로 짧은 ACCESS EXCLUSIVE lock 만 사용 |
| F-B | 동시성 | `backend/src/modules/websocket/websocket.gateway.ts` | `authorize()` 후 한도 검사·`Set.add`·tentative-add 롤백 패턴으로 묶음. 단위 테스트: deferred authorize 동시 2건에서 정확히 1건만 성공하는지 검증 |
| F-C | 보안 | `backend/src/modules/hooks/hooks.service.ts` | 미허용 HMAC 알고리즘 응답에서 알고리즘 명 제거 (`"Authentication failed"` 고정). 진단은 `this.logger.warn` 으로만. 단위 테스트로 응답에 `md5` 노출 안 됨 검증 |
| F-D | 보안 | `backend/src/modules/websocket/websocket.service.ts` | `sanitizePayloadForWs` 가 `depth > MAX_SANITIZE_DEPTH` 도달 시 원본 대신 `'[REDACTED_DEPTH]'` 반환. 단위 테스트로 깊이 12 페이로드에서 평문 secret 직렬화 미노출 검증 |
| F-E | 요구사항/문서 | `backend/src/modules/executions/executions.service.ts`, `executions.service.spec.ts` | `MAX_EXECUTION_PATH_ROWS` export + 응답에 `executionPathTruncated: boolean` 노출. 테스트에서 10,000 행 case 추가 |
| F-F | 테스트 | `websocket.service.spec.ts`, `websocket.gateway.spec.ts`, `hooks.service.spec.ts`, `pagination.dto.spec.ts` (신규) | 참조 동일성 / depth-redact / sha512 성공 / HMAC 응답 비누출 / WS race / pagination 식별자 패턴 양·음성 케이스 추가 (+10 testcase) |
| F-G | 문서 | `spec/5-system/12-webhook.md` §4.2, `backend/src/common/dto/pagination.dto.ts` | HMAC 알고리즘 허용 목록·information leakage 차단·rawBody 요구를 spec 에 명시. `@ApiPropertyOptional` 에 `pattern`/`maxLength` 메타데이터 추가 |
| F-INFO | 유지보수성 | `backend/src/modules/integrations/integration-oauth.service.ts` | 모듈 수준 logger 변수명 `moduleLogger` → `logger` (다른 파일과 일관성) |
| F-호환성 | 프론트엔드 | grep 결과 | `frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx:152` 의 `sort: "started_at"` 가 신규 `@Matches` 패턴에 적합. 기존 클라이언트 호환성 영향 없음 |

여전히 보류되는 deferred 항목은 위 §의사결정 보류 표 그대로 유지된다.

```

#### `plan/in-progress/20260516-full-review/SUMMARY.md`
```
# Code Review 통합 보고서

> 기준 커밋: `bbd838ef` (main)
> 검토 일시: 2026-05-16
> 범위: spec/, backend/, frontend/, packages/ 전체
> 리뷰 세션: `plan/in-progress/20260516-full-review/`
> 세션 메타: 13/13 reviewer 성공, 총 154 issue

---

## 세션 개요

본 세션은 표준 `review/code/<...>` 경로가 아닌 `plan/in-progress/20260516-full-review/`에서 실행된 전체 코드베이스 audit 세션이다. 사용자 강조 관점은 **일관성**, **스펙 준수**, **보안**, **리팩토링** 4개 축이다.

---

## 전체 위험도

**HIGH** — Critical 보안/데이터 결함 9건, 구현 미완성(Re-run) 3건, 테스트 커버리지 공백 2건 포함. 즉각 조치가 필요한 CRITICAL 항목이 다수 존재하며, 특히 AuthConfig 평문 저장과 HMAC 웹훅 인증 무동작은 운영 환경 보안에 직결된다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C-1 | 요구사항/스펙 | Re-run 기능 백엔드·프론트엔드 완전 미구현. `POST /executions/:id/re-run`, chain API, 권한 가드, rate limit, audit log, 프론트 UI 모두 없음 | `executions.controller.ts` 전체; `spec/5-system/13-replay-rerun.md`; `plan/in-progress/replay-rerun.md` §3/4/5 전체 미체크 | 새 worktree에서 `replay-rerun.md` PR2 착수. DB 마이그레이션(`re_run_of`, `chain_id` 컬럼) 선행 |
| C-2 | 요구사항/데이터모델 | `Execution` 엔티티에 Re-run 추적 컬럼(`re_run_of`, `chain_id`) 누락 — spec RR-PL-05 및 `spec/1-data-model.md §2.13` 정의 미반영 | `execution.entity.ts:21-81`; `spec/5-system/13-replay-rerun.md §9.1` | TypeORM migration으로 컬럼 추가 + `spec/1-data-model.md §2.13` 갱신 |
| C-3 | 요구사항/AI | AI Agent 일반 도구 연결(ND-AG-06/10/21) 의도적 제거 후 재설계 완전 미결 — 핵심 AI 기능 무기한 보류 | `plan/in-progress/ai-agent-tool-connection-rewrite.md §1`; `spec/4-nodes/3-ai/1-ai-agent.md` | 도구 연결 모델 결정을 위한 사용자 합의를 우선 진행 |
| C-4 | 성능 | `sanitizePayloadForWs`가 모든 WS emit 경로에서 재귀 순회 실행 — 대규모 ForEach(5000+ emit) 시 CPU 병목 | `backend/src/modules/websocket/websocket.service.ts:92-107` | 설정 레이어에서 한 번만 적용하고 WS emit 시 재검사 생략; `messages` 배열 등 신뢰된 필드는 allowlist 방식으로 skip |
| C-5 | 성능 | ForEach 내부 `allNodes.find()` O(N) 선형 탐색이 매 iteration 반복 — 1000회 ForEach × 500노드 시 500,000회 비교 발생 | `execution-engine.service.ts:3679`; `planContainerBody` 내 여러 곳 | `nodeMap.get(id)` O(1) 조회로 전환 (Map이 이미 존재함) |
| C-6 | 아키텍처 | `ExecutionEngineService` 4,733줄 God-Object — 그래프 순회·노드 dispatch·상태 머신·WS 이벤트·AI 대화·분산 continuation을 단일 파일에 집중 | `execution-engine.service.ts:377` 전체 | `AiConversationOrchestrator`, `UserInteractionService`, `GraphTraversalService`, `ExecutionEventEmitter`로 분리 |
| C-7 | 문서 | `spec/5-system/11-mcp-client.md` 헤딩 변경으로 앵커 링크 13건 전 코드베이스에서 파손 (`#23-internal-bridge` → `#23-internal-bridge-in-process`) | `spec/1-data-model.md:247`, `spec/0-overview.md:101`, `spec/4-nodes/4-integration/4-cafe24.md:3,11,337` 외 8개 파일 | 헤딩을 `### 2.3 Internal Bridge`로 단순화하거나 11개 참조 파일 앵커 일괄 수정 |
| C-8 | 문서/보안 | README `FRONTEND_URL` 포트 3000·3002·3012 세 가지 혼재 — OAuth redirect URI 오등록 위험 | `README.md:183, 217, 354-357`; `docker-compose.yml:176` | 환경별(host dev=3000, docker fullstack=3012) 명확히 구분해 기재 |
| C-9 | 데이터베이스/보안 | `integration_action_required` 알림 타입이 DB CHECK constraint에 없어 INSERT 시 `check_violation` 오류로 알림 발사 전체 실패 | `backend/migrations/V001__initial_schema.sql:338`; `integration-action-required-notifier.service.ts:76` | `V052__notification_type_integration_action_required.sql` 마이그레이션 즉시 추가 |
| C-10 | 데이터베이스/보안 | `AuthConfig.config` JSONB가 평문 저장 — spec은 `JSONB (encrypted)` 명시, Webhook Bearer Token/API Key 등 민감 인증 정보 노출 위험 | `auth-config.entity.ts:31`; `auth-configs.service.ts` | `Integration.credentials`와 동일한 `encryptedJsonTransformer` 적용 + 기존 평문 행 마이그레이션 스크립트 |
| C-11 | 테스트/보안 | `HooksService.verifyAuth` HMAC 분기 단위 테스트 전무 + `main.ts`에 `rawBody: true` 미설정으로 HMAC 인증이 운영에서 실제로 동작하지 않을 가능성 | `main.ts`; `hooks.service.spec.ts`; `webhook-trigger.e2e-spec.ts:133-167` | `NestFactory.create(AppModule, { rawBody: true })` 추가; HMAC 단위 테스트 5개 시나리오 추가 |
| C-12 | 테스트 | Cafe24 OAuth callback/BullMQ refresh e2e 미존재 — 핵심 토큰 획득·갱신 경로의 회귀 안전망 부재 | `backend/test/` (관련 파일 없음) | `docker-compose.e2e.yml`에 HTTP stub 컨테이너 추가 후 `integration-cafe24-callback.e2e-spec.ts` 작성 |
| C-13 | 의존성/보안 | `protobufjs <=7.5.5` 다중 CVE — 코드 인젝션, DoS, Prototype pollution 5건 이상 | `backend/package.json` 간접 dep (`@google/genai`, `@opentelemetry/*`) | `npm audit fix` 또는 `"overrides": { "protobufjs": "^7.5.6" }` 추가 |
| C-14 | 문서 | `spec/4-nodes/3-ai/0-common.md#11-conversation-context` 앵커 오기재(실제 섹션 번호 10) | `spec/conventions/conversation-thread.md:3` | 앵커를 `#10-conversation-context-자동-컨텍스트-주입`으로 수정 |
| C-15 | 문서 | `spec/conventions/cafe24-api-metadata.md#6-allowlist-와의-관계` 앵커 불일치(실제 섹션 번호 7) | `spec/2-navigation/4-integration.md:951` | 앵커를 `#7-allowlist-와의-관계`로 수정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 보안 | WebSocket 게이트웨이 CORS 와일드카드(`*`) | `websocket.gateway.ts:52` | `NODE_ENV=production`에서 `origin: configService.get('app.frontendUrl')`로 제한 |
| W-2 | 보안 | 웹훅 HMAC `hmacAlgorithm` 허용 목록 없음 | `hooks.service.ts:144`; `create-trigger.dto.ts:61` | `@IsIn(['sha256', 'sha512'])` 검증 추가 |
| W-3 | 보안 | DOMPurify `ALLOWED_ATTR`에 `style` 포함 — CSS 클릭재킹·데이터 유출 벡터 | `presentation-renderers.tsx:45` | `style` 속성 제거; 필요시 `afterSanitizeAttributes` hook으로 CSS 속성 단위 허용 |
| W-4 | 보안 | HTTP Request 노드 DNS rebinding 2차 공격 미차단 | `http-safety.ts:8-12` | `dns.lookup` 결과 IP 재검사 또는 egress 방화벽 보완 |
| W-5 | 보안 | Database Query 노드 사용자 제공 DB 호스트 SSRF 검증 없음 | `database-query.handler.ts:333` | `isPrivateHost`+`resolvesToPrivate` 검증 추가 |
| W-6 | 보안/아키텍처 | sub-workflow 실행 시 workspace 격리 검증 누락 — 교차 workspace 실행 가능 | `execution-engine.service.ts:1049-1054, 1155-1160, 718-725` | `executeSync/Async/Inline` 내부에서 대상 workflow의 `workspaceId` 비교 검증 |
| W-7 | 요구사항 | Parallel 노드 `errorPolicy` schema 미노출 — 항상 기본값 `stop` 동작 | `parallel.schema.ts`; `spec/4-nodes/1-logic/10-parallel.md §1` | `parallel-p2.md §1` 처리 — schema에 `errorPolicy` 노출 |
| W-8 | 요구사항 | Merge 노드 `timeout`/`partialOnTimeout` dormant — 설정해도 warn 로그만 | `merge.handler.ts:89-101` | 프론트엔드 설정 패널에 disabled + 툴팁; 또는 validate 경고 룰 추가 |
| W-9 | 요구사항 | 마켓플레이스·플러그인 SDK 전체 미구현 | `spec/2-navigation/8-marketplace.md`; `plan/in-progress/marketplace-and-plugin-sdk.md` | `0-unimplemented-overview.md` 권장 순서로 Phase A부터 진행 |
| W-10 | 요구사항 | `integration_action_required` 프론트엔드 type-specific 처리 미구현 | `frontend/src/components/` (notification 관련) | frontend notification 컴포넌트에 type-specific 분기 추가 |
| W-11 | 요구사항 | `0-unimplemented-overview.md` 인덱스가 실제 구현 현황과 불일치 | `plan/in-progress/0-unimplemented-overview.md:54, 108-120` | background 모니터링 API 항목 ✅ 갱신 + plan 목록 재동기 |
| W-12 | 보안 | install endpoint IP 기반 rate limiting 미구현 | `cafe24-backlog-residual.md §A-3` | nginx 또는 ThrottlerModule IP 기반 rate limit 추가 |
| W-13 | 요구사항 | Cafe24 BullMQ refresh 실패 시 Sentry/외부 오류 추적 미정의 | `cafe24-backlog-residual.md §D-2` | 에러 격리 정책 spec 명시 + 외부 오류 추적 결정 |
| W-14 | 테스트 | `exchangeCodeForToken`/`refreshAccessToken` fetch 단위 테스트 5개 시나리오 전체 미체크 | `cafe24-backlog-residual.md §B-5-8` | mock fetch + fixture 기반 단위 테스트 추가 |
| W-15 | 스펙 | `graph_extraction_status` Enum에 `failed` 누락(§2.2 vs §7·§3.2 자체 모순) | `spec/5-system/10-graph-rag.md §2.2` | `§2.2` Enum에 `failed` 추가; consistency-check C2 처리 |
| W-16 | 스펙 | API 경로 prefix 혼재 `/api/v1/` vs `/api/` | `spec/5-system/2-api-convention.md` | prefix 정책 확정 + 전체 spec 경로 통일 |
| W-17 | 유지보수성 | `workflow.handler.ts` 에러 분류 문자열 매칭 — 메시지 변경 시 silent regression | `workflow.handler.ts:216-220` | Typed error 계층 도입 후 `instanceof` 분기 전환 |
| W-18 | 스펙 | Cafe24 install endpoint `pending_install` 상태 보호 미명시 | `spec-update-cafe24-test-connection.md §9.1` | spec §2.2 API 직호출 대비 조항 추가 + 구현 확인 |
| W-19 | 요구사항 | i18n ko↔en dict parity 자동 가드 main 병합 여부 불명확 | `harness-i18n-userguide-gap.md`; `harness-review-router-c4f1a2` worktree | worktree 상태 확인 → main 병합 완료 여부 검증 |
| W-20 | 문서/API | Cafe24 신규 에러 코드 2종 Swagger `@ApiResponse` 미명시 | `cafe24-backlog-residual.md §D-1` | 관련 controller에 `@ApiResponse` 데코레이터 추가 |
| W-21 | 성능 | `getSummary`에서 `workflowId` 필터 시 동일 쿼리 두 번 실행 — 첫 번째 결과를 버림 | `statistics.service.ts:80-123` | 단일 쿼리로 통합 |
| W-22 | 성능 | `executionPath` 조회 — 수천 행 메모리 적재 후 `nodeId`만 추출 | `executions.service.ts:123-127` | `MAX_PATH_ROWS` 상한 + LIMIT SQL 절 추가 |
| W-23 | 성능 | `deriveContainerAssignments` 엣지 변경마다 최대 16 패스 × 전체 엣지 동기 순회 — 대형 워크플로 UI 렉 | `frontend/src/lib/stores/editor-store.ts:281-304` | containerId를 엣지에 embed하거나 증분 방식 전환; 단기: pass 상한 축소 |
| W-24 | 성능 | `appendExecutionPath` 노드 실행 시마다 개별 INSERT — 100노드 × 50 ForEach = 5000 INSERT | `execution-engine.service.ts:1554-1567` | 완료 시점에 배치 INSERT로 전환 |
| W-25 | 성능 | `sanitizePayloadForWs` 재귀 호출마다 빈 `result` 객체 새로 생성 — GC pressure | `websocket.service.ts:98` | 민감 키 없으면 원본 참조 반환 |
| W-26 | 성능 | `resolveString`에서 `FULL_EXPRESSION_PATTERN` 중복 정규식 매칭 | `expression-resolver.service.ts:239-245` | 단일 패스 처리 또는 `evaluate` 반환값에 플래그 포함 |
| W-27 | 성능 | `emitExecutionSnapshot` REPEATABLE READ + `findById` 전체 조회 — 동시 구독자 多일 때 반복 heavy 조회 | `websocket.gateway.ts:258-284` | 완료된 실행 snapshot Redis 캐시; 장기: snapshot 전용 경량 쿼리 |
| W-28 | 유지보수성 | `APP_URL` 폴백 리터럴 두 파일 6곳 분산 + `replace(/\/$/, '')` 체인 누락 | `integrations.service.ts:830,1076`; `integration-oauth.service.ts:490,968,1079,1359` | `getAppBaseUrl()` 단일 함수로 통합 |
| W-29 | 유지보수성 | 메시지 길이 상한 불일치 — `LAST_ERROR_MESSAGE_MAX_LEN=200` vs `MCP_ERROR_MESSAGE_MAX_LEN=2048`, 클램프 함수 이중 구현 | `integration-oauth.service.ts:193,220`; `mcp-error-codes.ts:35` | `integrations-error-utils.ts`로 통합 |
| W-30 | 유지보수성 | `extractSid`/`extractOperationId` 파싱 로직 두 provider에 별도 구현 | `cafe24-mcp-tool-provider.ts:454-468`; `mcp-tool-provider.ts:150-161` | `parseMcpToolName` 재사용으로 중복 제거 |
| W-31 | 유지보수성 | `console.warn`/`console.error`가 NestJS Logger 대신 사용된 위치 5곳 이상 | `integrations.service.ts:702`; `integration-oauth.service.ts:307`; `credentials-transformer.ts:45,58`; `table.handler.ts:264-269` | `this.logger.warn/error` 또는 `new Logger(...)` 교체 |
| W-32 | 유지보수성 | `EXPIRING_SOON_INTERVAL` SQL 내장 vs 프론트엔드 `EXPIRING_SOON_DAYS=7` 주석으로만 동기화 | `integrations.service.ts:250` | 공유 상수로 추출 |
| W-33 | 유지보수성 | `integration-oauth.service.ts`(1,818줄) 단일 클래스에 OAuth 흐름 전반과 Cafe24 특화 로직 혼재 | `integration-oauth.service.ts` 전체 | Cafe24 특화 로직을 `cafe24-oauth.service.ts`로 분리 |
| W-34 | 유지보수성 | `ai-agent.handler.ts`(2,099줄) 단일 파일에 AI 에이전트 거의 모든 책임 집중 | `ai-agent.handler.ts` 전체 | `RagAccumulator`, 렌더링 유틸, 멀티-턴 상태 관리 분리 |
| W-35 | 유지보수성 | `IntegrationOAuthService.begin()` Cafe24 private/public 3단 중첩 — 순환 복잡도 높음 | `integration-oauth.service.ts:364` | `beginCafe24(params, meta)`로 추출 + 얼리 리턴 패턴 |
| W-36 | 유지보수성 | `credentials-transformer.ts` 모듈 수준 전역 boolean 플래그 — 테스트 간 상태 오염 가능 | `credentials-transformer.ts:38-39` | `resetWarningFlags()` hook 제공 또는 Logger rate-limiter 활용 |
| W-37 | 테스트 | `HooksService.constantTimeEquals` 분기 미커버 | `hooks.service.ts:176-181` | 길이 불일치·성공 케이스 단위 테스트 추가 |
| W-38 | 테스트 | Cafe24 install e2e `mall_id 불일치 → 403` 케이스 명시됐으나 미구현 | `integration-cafe24-install.e2e-spec.ts:20` | `rejection paths` describe 블록에 케이스 추가 |
| W-39 | 테스트 | Nonce cache Redis 키 HMAC 앞 8자 prefix 충돌 위험 미테스트 | `cafe24-install-nonce-cache.service.ts:108` | 동일 prefix 두 HMAC 독립성 검증; 또는 전체 HMAC 해시로 키 설계 변경 검토 |
| W-40 | 테스트 | `cafe24-token-refresh.processor.spec.ts` `Date.now()` fake timer 없이 사용 | `cafe24-token-refresh.processor.spec.ts:32,48` | `jest.useFakeTimers()` + `jest.setSystemTime()` 사용 |
| W-41 | 테스트 | 웹훅 e2e `Date.now()` 기반 `endpointPath` 생성 — 병렬 실행 시 충돌 가능 | `webhook-trigger.e2e-spec.ts:74,95,112,134` | `randomBytes(8).toString('hex')` 사용 |
| W-42 | 테스트 | `integration-cafe24-install.e2e-spec.ts` credentials 암호화 transformer 우회 — production 경로 미커버 | `integration-cafe24-install.e2e-spec.ts:84-111` | `credentials-transformer.spec.ts`에 암호화/비암호화 경로 통합 추가 |
| W-43 | 테스트 | 웹훅 HMAC 양성 케이스가 `hooks.service.spec.ts`에 위임된다고 명시됐으나 실제로는 없음 — 참조 단절 | `webhook-trigger.e2e-spec.ts:155` | `hooks.service.spec.ts`에 올바른 rawBody+HMAC 서명 케이스 추가 |
| W-44 | API 계약 | `GET /executions/:id`, `GET /executions/workflow/:workflowId` workspaceId 소유권 미검증 IDOR | `executions.controller.ts:56-79` | `@WorkspaceId()` 파라미터 추가 + `verifyOwnership()` 호출 |
| W-45 | API 계약 | webhook spec(§5.2) 에러 응답 형식이 실제 GlobalExceptionFilter envelope과 불일치 | `spec/5-system/12-webhook.md:248-254`; `http-exception.filter.ts:63-72` | spec §5.2를 실제 envelope(`{ error: { code, message, details } }`)과 동기화 |
| W-46 | API 계약 | `PaginationQueryDto.sort` 허용 값 미검증 — 서비스별 `getSortColumn()` 누락 위험 | `pagination.dto.ts:46-51` | DTO 레벨에 `@IsIn([...])` 공통 허용 값 추가 |
| W-47 | API 계약/보안 | `POST /auth/login`/`POST /auth/register`에 개별 throttle 미적용 — spec 10 req/min 대신 100 req/min | `auth.controller.ts:165-200,104-135` | `@Throttle({ default: { ttl: 60_000, limit: 10 } })` 추가 |
| W-48 | API 계약 | `PATCH /notifications/:id/read` — spec §12.1 상태 토글 패턴 위반 | `notifications.controller.ts:73` | `PATCH /notifications/:id` + body `{ isRead: true }`로 변경 또는 spec 예외 명문화 |
| W-49 | 아키텍처 | `ExecutionEngineService` 생성자 16개 의존성 과부하 | `execution-engine.service.ts:421-457` | `HandlerDependenciesFactory` 분리 또는 `NodeRuntimeContext` 인터페이스 추상화 |
| W-50 | 아키텍처 | `ExecutionEngineModule`이 `Cafe24Module` 직접 import — OCP 위반 | `execution-engine.module.ts:25` | `CAFE24_API_CLIENT` DI 토큰 추상화, AppModule conditional provider 등록 |
| W-51 | 아키텍처 | `WebsocketModule` ↔ `ExecutionEngineModule` ↔ `KnowledgeBaseModule` 양방향 순환 의존성 | `execution-engine.module.ts:43`; `websocket.module.ts:22-26`; `knowledge-base.module.ts:38` | `EventEmitter2` 기반 이벤트 분리로 순환 해소 |
| W-52 | 아키텍처 | `backend/src/common` vs `backend/src/shared` 역할 경계 미명시 — `S3Service`가 `common/`에 위치 | `backend/src/common/`, `backend/src/shared/` | `common/` = HTTP/NestJS 레이어, `shared/` = 레이어 독립 타입으로 정의, `S3Service` 이동, ADR 명문화 |
| W-53 | 아키텍처 | `Cafe24ApiClient`(1,271줄) HTTP 요청, rate-limit, OAuth 토큰 갱신, 상태 전이 혼재 | `cafe24-api.client.ts` 전체 | `Cafe24HttpTransport`, `Cafe24TokenManager`, `Cafe24RateLimiter`로 분해 |
| W-54 | 의존성 | OTel 패키지 두 버전 공존(`sdk-node@0.205.0` + `0.57.2`) — trace context 전파 단절 위험 | `backend/package.json` | `@opentelemetry/auto-instrumentations-node`를 `^0.76.0`으로 업데이트 |
| W-55 | 의존성/보안 | `fast-uri` path traversal·host confusion 취약점(CVSS 7.5 HIGH) | `backend/package.json` 간접 dep | `"overrides": { "fast-uri": ">=3.2.0" }` 추가 |
| W-56 | 의존성/보안 | OTel Prometheus DoS 취약점(CVSS 7.5 HIGH) | `@opentelemetry/auto-instrumentations-node@0.55.3` | `^0.76.0`으로 업데이트 |
| W-57 | 의존성 | `hono` JWT 검증 오류·CSS 인젝션·cross-user 캐시 누수 | `backend/package.json` 간접 dep | `@modelcontextprotocol/sdk` 최신 버전으로 업데이트 |
| W-58 | 의존성/테스트 | Playwright docker 이미지(v1.47.0)와 devDependencies(`^1.59.1`) 12 minor 버전 불일치 | `docker-compose.e2e.yml:169`; `frontend/package.json` | docker 이미지를 lock 파일 기준 버전과 일치하도록 업데이트 |
| W-59 | 의존성 | `minio/minio:latest` 태그 미고정 | `docker-compose.yml`, `docker-compose.e2e.yml` | 특정 date-tagged release로 고정 |
| W-60 | 데이터베이스 | V049 마이그레이션 파일-디렉토리 명충돌 — Flyway Linux 환경 예측 불가 동작 | `backend/migrations/V049__integration_consecutive_network_failures.sql` | `git rm -r`로 빈 디렉토리 제거 |
| W-61 | 데이터베이스 | `NotificationsService.findByResource` workspaceId 격리 없음 — 향후 재사용 시 IDOR 위험 | `notifications.service.ts:22-30` | 선택적 `workspaceId` 파라미터 추가 |
| W-62 | 데이터베이스 | `install_token` 컬럼 `VARCHAR(64)` vs spec "길이 제약 없음" 서술 불일치 | `integration.entity.ts:62`; `V042__cafe24_private_app_pending_install.sql:13` | spec Rationale 수정 또는 마이그레이션으로 `TEXT` 변경 |
| W-63 | 데이터베이스 | `hasRecentByResource` 복합 조건 쿼리 인덱스 누락 — 알림 발사 시마다 seq scan | `notifications.service.ts:125-134` | `CREATE INDEX CONCURRENTLY idx_notification_workspace_type_resource` 추가 |
| W-64 | 데이터베이스 | `duplicate`(Workflow 복사) 시 Nodes/Edges 미복사 — 메서드명과 동작 불일치 가능 | `workflows.service.ts:171-188` | spec 의도 확인; 전체 복사라면 `dataSource.transaction` + Node/Edge 복사 |
| W-65 | 동시성 | `pendingContinuations` Map 핸들러 등록 타이밍 race — 부팅 직후 cancel 메시지 drop 가능 | `execution-engine.service.ts:459-526` | 메시지 버퍼 + handler 등록 시 flush 패턴; 또는 `OnApplicationBootstrap`으로 통일 |
| W-66 | 동시성 | `ScheduleRunnerService.onModuleInit` 다중 인스턴스 중복 upsert 동작 가정 미명시 | `schedule-runner.service.ts:107-126` | 동작 가정을 코드 주석에 명시 또는 lock 활용 |
| W-67 | 동시성 | `ForEachExecutor` context 직접 mutate — Parallel 조합 시 잠재 오염 위험 | `foreach-executor.ts:78-83` | `{ ...context, itemContext: { ... } }` shallow clone 전달 |
| W-68 | 동시성 | `handleSubscribe` async await 경계에서 MAX_SUBSCRIPTIONS 한도 재검사 누락 | `websocket.gateway.ts:64` | `authorizer.authorize` 완료 후 `clientSubs.size` 재검사 |
| W-69 | 변경 범위 | B-3-7 cursor 제거 후 `spec/4-nodes/4-integration/4-cafe24.md` §3/§4.2 미갱신 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | spec에서 `cursor` 언급 제거 + Rationale 결정 근거 명문화 |
| W-70 | 변경 범위 | `test(cafe24)` 커밋에 프로덕션 런타임 동작 변경(`logUsage` try/catch) 혼입 | `d6baf89a`; `integration-handler-base.ts` | fix/test 성격 분리 커밋 원칙 수립 |
| W-71 | 변경 범위 | refactor 커밋에 review 아카이브 파일 26개 혼입 — 코드 히스토리 가독성 저하 | `eacbd45e`, `bb038f90` | review 산출물은 별도 `chore(review):` 커밋으로 분리 |
| W-72 | 부작용 | `Cafe24InstallNonceCache` 독립 Redis 연결 생성 — `redis.config.ts`에 `password/tls` 키 미정의로 인증 Redis 도입 시 replay 방어 무음 비활성화 | `cafe24-install-nonce-cache.service.ts:43-65` | `redisConfig`에 `password/tls` 키 추가 또는 공유 ioredis 인스턴스 DI |
| W-73 | 부작용 | `Cafe24InstallNonceCache.close()` NestJS `OnModuleDestroy` 미등록 — 정상 종료 시 Redis 연결 누수 | `cafe24-install-nonce-cache.service.ts:115-121` | `implements OnModuleDestroy` + `async onModuleDestroy() { await this.close(); }` |
| W-74 | 부작용 | `OAUTH_STUB_MODE` 가드 로직이 세 곳에 서로 다른 허용 목록으로 중복 | `integration-oauth.service.ts:66-70`; `main.ts:27-35` | `isStubModeAllowed()` 공통 유틸로 추출 |
| W-75 | 부작용 | `NotificationsService.hasRecentByResource` 신규 공개 메서드가 기존 부분 mock 테스트에서 누락 시 런타임 오류 | `notifications.service.ts:117-138` | 기존 mock에 `hasRecentByResource: jest.fn()` 추가 |
| W-76 | 문서 | README `INTEGRATION_ENCRYPTION_KEY` 누락 — 신규 개발자가 설정 시 통합 자격증명 암호화 실패 | `README.md:155-196` | `backend/.env` 예시에 `INTEGRATION_ENCRYPTION_KEY=<32-byte-hex>` 추가 |
| W-77 | 문서 | `frontend/README.md` yarn/pnpm/bun 명령 나열 — 프로젝트 규약(npm 전용)과 충돌 | `frontend/README.md:10-14` | yarn/pnpm/bun 줄 제거, npm 단일 명령만 유지 |
| W-78 | 문서 | spec 파일 85개 중 56개(66%)에 `## Rationale` 섹션 부재 | `spec/4-nodes/1-logic/` 외 다수 | 비자명한 complex 노드와 핵심 시스템 스펙부터 우선 추가 |
| W-79 | 문서 | `packages/expression-engine`, `packages/node-summary` README 없음 | `packages/expression-engine/`, `packages/node-summary/` | 최소한의 README(목적, 빌드/사용법, export API) 추가 |
| W-80 | 문서 | `README.md:328` `# integration (SSO)` h1 헤딩 수준 오류 | `README.md:328` | `## integration (SSO)`로 변경 |

---

## 참고 (INFO)

개별 항목은 생략하고 카테고리별 건수를 집계한다. 대표 항목만 인용한다.

| 카테고리 | 건수 | 대표 항목 |
|----------|------|-----------|
| 요구사항 | 7 | ED-AI-39 legacy fallback 만료 기준 미명시(`review-workflow.ts:716`); `buildIntegrationMeta` provider 레지스트리 패턴 필요 시점 미명시 |
| 보안 | 5 | bcrypt 라운드 12 상수 여러 파일 분산; expression-engine AST 샌드박스 확인됨(긍정); `.env` git 추적 제외 확인됨(긍정) |
| 성능 | 4 | `TO_CHAR` GROUP BY 인덱스 미활용 (`statistics.service.ts:135-154`); `Evaluator` new 인스턴스 매 expression 생성; `sortByStartedAt` 매 WS 이벤트마다 전체 배열 정렬 |
| 유지보수성 | 5 | `sanitizeId`/`sanitizeToolName` 동일 정규식 중복; `Cafe24McpToolProvider.__resetForTesting()` public API 노출; `result-detail.tsx` 1,111줄 |
| 테스트 | 5 | 프론트엔드 Cafe24 Private App 설치 흐름 e2e 미커버; Zustand 전역 상태 초기화 패턴 누락; fix ↔ test 추적성(`// 회귀 안전망: <issue-ref>` 주석) 낮음 |
| API 계약 | 4 | `DELETE /workspaces/:id` 204 대신 200; OAuth 콜백 access_token URL 노출(`?token=...`); `GET /login-history` cursor DTO 미사용 |
| 아키텍처 | 3 | `nodes/core/node-component.interface.ts`가 `modules/` 구체 서비스 타입 import; frontend 컴포넌트 레이어 직접 API 호출; `packages/*` 경계 건전함(긍정) |
| 의존성 | 4 | `expression-engine` `dayjs` 버전 낮음; `react`/`react-dom` exact pin; `cron-parser` 중복 설치; `p-limit@7` ESM/CJS 혼용 |
| 데이터베이스 | 3 | `AuthConfig.type` CHECK constraint ORM 미반영; `LlmConfig.apiKey` VARCHAR(500) 암호화 후 근접 가능성; `findByResource` N+1 잠재 + 인덱스 누락 |
| 동시성 | 4 | `WebsocketGateway.subscriptions` async 핸들러 interleave; Nonce SETNX 원자성 확인됨(긍정); `ContinuationBusService` 분산 락 확인됨(긍정); `ParallelExecutor.nodeOutputCache` shallow copy invariant 런타임 검증 없음 |
| 변경 범위 | 3 | `pg-error.ts` 공통 헬퍼 신설 conventions 미언급; Phase 8 spec 동시 갱신 확인됨(긍정); plan/complete 이동 시 spec 링크 갱신 여부 미확인 |
| 부작용 | 2 | `logUsage` swallow 메트릭 연동 없음; `CAFE24_MALL_ID_PATTERN` 정규식 3중 중복 |
| 문서 | 6 | spec 내 `prd/` 경로 참조 역사 표기로 잔존; spec 내 `memory/` 경로 5곳 잔존; CHANGELOG 단일 "Unreleased" 섹션; `backend/README.md` 환경변수 불완전; backend 핵심 서비스 JSDoc 밀도 저조; `frontend/README.md` 보일러플레이트 잔존 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | Re-run 완전 미구현(C-1/C-2), AI Agent 도구 연결 무기한 보류(C-3), spec-코드-plan 3축 드리프트 |
| security | HIGH | Database Query 노드 SSRF 무방어(W-5), WebSocket CORS 와일드카드(W-1), protobufjs CVE 5건(C-13) |
| performance | HIGH | `sanitizePayloadForWs` CPU 병목(C-4), ForEach O(N) 선형 탐색(C-5), 프론트 16패스 동기 순회(W-23) |
| maintainability | MEDIUM | `APP_URL` 6곳 분산(W-28), 메시지 클램프 이중 구현(W-29), 대형 파일 2건(W-33/W-34) |
| testing | HIGH | HMAC 웹훅 운영 미동작 + 테스트 전무(C-11), Cafe24 OAuth callback e2e 부재(C-12) |
| documentation | HIGH | spec 앵커 링크 13건 파손(C-7/C-14/C-15), README 포트 혼재(C-8), `INTEGRATION_ENCRYPTION_KEY` 누락(W-76) |

... (truncated due to size limit) ...

### spec/conventions 정식 규약

#### `spec/conventions/cafe24-api-catalog/_overview.md`
```
# CONVENTION: Cafe24 API Catalog — Overview

> 관련 문서: [Spec Cafe24 노드](../../4-nodes/4-integration/4-cafe24.md) · [Cafe24 API Metadata 컨벤션](../cafe24-api-metadata.md) · [Cafe24 공식 Admin API 문서](https://developers.cafe24.com/docs/ko/api/admin/)

본 디렉토리(`spec/conventions/cafe24-api-catalog/`) 는 Cafe24 Admin API 의 **모든 endpoint** 를 18 resource 단위로 enumerate 한 단일 진실(single source of truth)이다. 노드 메타데이터(`backend/src/nodes/integration/cafe24/metadata/*.ts`) 가 어디까지 구현됐고 어디가 남았는지가 한 화면에서 보이도록 유지한다.

---

## 1. 디렉토리 구조

```
spec/conventions/cafe24-api-catalog/
  _overview.md        # 본 문서 — 인덱스 + 컬럼 정의 + 동기 정책 + coverage matrix
  store.md            # Store (상점) — 50+ sub-resource
  product.md          # Product (상품)
  order.md            # Order (주문)
  customer.md         # Customer (회원)
  community.md        # Community (게시판)
  design.md           # Design (디자인)
  promotion.md        # Promotion (프로모션)
  application.md      # Application (앱 관리)
  category.md         # Category (상품분류)
  collection.md       # Collection (판매분류)
  supply.md           # Supply (공급사)
  shipping.md         # Shipping (배송)
  salesreport.md      # Salesreport (매출통계)
  personal.md         # Personal (개인화)
  privacy.md          # Privacy (개인정보)
  mileage.md          # Mileage (적립금)
  notification.md     # Notification (알림)
  translation.md      # Translation (번역)
```

resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/metadata/types.ts`) 와 1:1 일치한다.

## 2. 표 컬럼 정의

각 resource 파일은 다음 컬럼의 표를 가진다.

| 컬럼 | 필수 | 설명 |
|------|------|------|
| `id` | ✓ | 노드 메타데이터의 operation id. `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` (예: `product_list`, `product_options_create`). 영문 snake_case, resource 내 unique |
| `라벨 (한)` | ✓ | UI 드롭다운에 노출되는 한국어 라벨 (예: "상품 목록 조회") |
| `English title` | ✓ | Cafe24 공식 docs 의 영문 제목 (예: "Retrieve a list of products") |
| `method` | supported 시 ✓ | `GET` / `POST` / `PUT` / `DELETE`. planned 시 `?` 허용 |
| `path` | supported 시 ✓ | path template (예: `products/{product_no}`). `/api/v2/admin/` 접두는 생략. planned 시 `?` 허용 |
| `scope` | supported 시 ✓ | `read` / `write`. `mall.<scope>_<resource>` 의 가운데 토큰. planned 시 `?` 허용 |
| `paginated` | — | `✓` 또는 빈 칸. `paginated: true` 인 operation 만 표시 |
| `status` | ✓ | §3 의 enum 중 하나 |
| `docs` | ✓ | Cafe24 공식 docs anchor URL — `https://developers.cafe24.com/docs/ko/api/admin/#<anchor>` |

## 3. status enum

| 값 | 의미 | 백엔드 메타데이터 |
|-----|------|------|
| `supported` | 노드/MCP Bridge 에서 호출 가능 | `CAFE24_OPERATIONS_BY_RESOURCE[resource]` 에 row 존재 |
| `planned` | 카탈로그에 등재만, 미구현. UI 의 Operation 드롭다운에 **disabled + "지원 예정" 배지** 로 노출 | row 없음 |
| `deprecated` | Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함 | row 없으면 정상. 있으면 마이그레이션 대상 |

`planned` 행의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다.

## 4. 동기 정책 (Sync Contract)

본 카탈로그는 `backend/src/nodes/integration/cafe24/metadata/*.ts` 와 **양방향 동기 테스트**로 보호된다.

**테스트 위치**: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`

**검증 규칙**:

1. **`supported` row → 메타데이터 존재**: 카탈로그에 `status: supported` 로 적힌 모든 `(resource, id)` 가 `findCafe24Operation(resource, id)` 로 조회되어야 한다. 누락 시 fail.
2. **메타데이터 → `supported` row 존재**: `CAFE24_OPERATIONS_BY_RESOURCE` 의 모든 operation 이 해당 resource 의 카탈로그에 `status: supported` 행으로 적혀 있어야 한다. 누락 시 fail.
3. **`paginated` 일치**: `supported` row 의 `paginated` 컬럼(`✓`/공백)이 메타데이터의 `paginated: boolean` 과 일치해야 한다.
4. **`method`/`path` 일치**: `supported` row 의 `method`·`path` 가 메타데이터와 일치.
5. **`scope` 일치**: `supported` row 의 `scope` 가 메타데이터 `scopeType` 과 일치.
6. **id 의 resource 내 unique**: 한 카탈로그 파일 안에 같은 `id` 가 두 번 나오면 fail.
7. **status 가 enum 중 하나**: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail.

테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차에 인용).

## 5. Coverage Matrix

2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.

| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
|----------|-----------|---------|---|
| [store](./store.md) | 8 | 50+ | 50+ |
| [product](./product.md) | 14 | 25+ | 28 |
| [order](./order.md) | 17 | 30+ | 47 |
| [customer](./customer.md) | 24 | 0 | 12 |
| [community](./community.md) | 24 | 0 | 9 |
| [design](./design.md) | 9 | 0 | 3 |
| [promotion](./promotion.md) | 35 | 0 | 10 |
| [application](./application.md) | 19 | 0 | 8 |
| [category](./category.md) | 19 | 0 | 5 |
| [collection](./collection.md) | 15 | 0 | 5 |
| [supply](./supply.md) | 20 | 0 | 6 |
| [shipping](./shipping.md) | 15 | 0 | 5 |
| [salesreport](./salesreport.md) | 5 | 0 | 5 |
| [personal](./personal.md) | 5 | 0 | 3 |
| [privacy](./privacy.md) | 6 | 0 | 2 |
| [mileage](./mileage.md) | 8 | 0 | 5 |
| [notification](./notification.md) | 12 | 0 | 7 |
| [translation](./translation.md) | 9 | 0 | 4 |
| **합계** | **264** | **~109** | **~250** |

> "Cafe24 docs sub-resource 수" 는 공식 docs 좌측 사이드바에서 본 resource 그룹 아래의 두 번째 레벨 항목 수다. 각 sub-resource 마다 통상 2~5 operation 이 존재하므로 endpoint 합계는 ~500.

## 6. 신규 endpoint 등재 절차

1. Cafe24 공식 문서에서 endpoint 확인.
2. 본 카탈로그 해당 resource 파일에 표 row 추가:
   - 처음 등재 시 `status: planned`, `method`/`path` 는 `?` 허용.
   - 구현 PR 에서 backend 메타데이터 row 1줄 추가 + 카탈로그 row 를 `planned → supported` 로 갱신 + `method`/`path`/`scope`/`paginated` 채움.
3. `_overview.md` §5 의 coverage matrix 카운트도 함께 갱신.
4. `npm test --workspace backend -- catalog-sync` 통과 확인.

> `spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-16 | 신규 컨벤션 — 18 resource 카탈로그 + 양방향 동기 테스트 도입. 사용자 결정(2026-05-16) "Cafe24 docs 전수 등재" 에 따라 supported 53 + planned ~300 으로 초기 채움. |
| 2026-05-16 (coverage Phase 5a) | Order resource — `order_count`, `order_status_update`, `order_status_update_multiple` 3건을 planned → supported 로 승격 (backend metadata + planned.ts mirror 동시 갱신). order supported 6 → 9, 합계 53 → 56. |
| 2026-05-16 (coverage Phase 5b) | Product resource — `product_count`, `product_options_list/create/update/delete`, `product_seo_get/update` 7건을 planned → supported 로 승격. product supported 7 → 14, 합계 56 → 63. |
| 2026-05-16 (coverage Phase 5c) | Customer resource — 회원 메모 CRUD 완성: `customer_memos_count/list/get/update/delete` 5건을 planned → supported 로 승격. customer supported 5 → 10, 합계 63 → 68. |
| 2026-05-16 (coverage Phase 5d) | Promotion resource — 쿠폰 보완: `coupon_count`, `coupon_issues_list`, `coupon_issuance_customers_list`, `customers_coupons_list`, `customers_coupons_count` 5건을 planned → supported 로 승격. promotion supported 5 → 10, 합계 68 → 73. |
| 2026-05-16 (coverage Phase 5e) | Salesreport resource 완성 — `salesreport_monthly`, `salesreport_hourly`, `salesreport_volume` 3건을 planned → supported 로 승격. salesreport supported 2 → 5, planned 3 → 0, 합계 73 → 76. salesreport resource 의 첫 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 5f) | Promotion resource — 시리얼쿠폰 5건 (`serialcoupons_list`, `serialcoupons_generate`, `serialcoupons_delete`, `serialcoupons_issues_get`, `serialcoupons_issues_register`) 를 planned → supported 로 승격. promotion supported 10 → 15, 합계 76 → 81. |
| 2026-05-16 (coverage Phase 6a) | Order resource — A/S 자동화 8건 (`refunds_list/get`, `cancellation_get/create_multiple`, `exchange_get/create_multiple`, `return_get/create_multiple`) 를 planned → supported 로 승격. order supported 9 → 17, 합계 81 → 89. |
| 2026-05-16 (coverage Phase 6b) | Store resource — 결제 설정 6건 (`paymentmethods_list`, `paymentmethods_paymentproviders_list`, `paymentgateway_paymentmethods_list`, `paymentgateway_create/update/delete`) 를 planned → supported 로 승격. store supported 2 → 8, 합계 89 → 95. |
| 2026-05-16 (coverage Phase 6c) | Promotion resource — 회원 혜택 CRUD 6건 + 회원 정보 이벤트 3건 + customers_coupons_delete 1건 = 10건. promotion supported 15 → 25, 합계 95 → 105. |
| 2026-05-16 (coverage Phase 6d) | Category/Collection/Supply/Shipping baseline 10건 — category(category_count/mains_list/autodisplay_list), collection(brands count/create/update/delete), supply(suppliers_count/get), shipping(carriers_get). 합계 105 → 115. |
| 2026-05-16 (coverage Phase 6e) | Mileage resource — 적립금 자동 만료 3건 (`points_autoexpiration_get/create/delete`) + 예치금 2건 (`credits_list`, `credits_report`) = 5건. mileage supported 2 → 7, 합계 115 → 120. |
| 2026-05-16 (coverage Phase 6f) | Notification resource — SMS 2건 (`sms_senders_list`, `sms_receivers_get`) + automails 2건 (`automails_get/update`) + recipientgroups 2건 (`recipientgroups_list/get`) = 6건. notification supported 2 → 8, 합계 120 → 126. |
| 2026-05-16 (coverage Phase 6g) | Translation resource — products_update + categories list/update + store list/update + themes list 6건. translation supported 1 → 7, 합계 126 → 132. 본 사이클 (Phase 6 a~g) 종료. |
| 2026-05-16 (coverage Phase 7a) | Promotion resource — discountcodes CRUD 5건 + commonevents CRUD 4건 = 9건. promotion supported 25 → 34, 합계 132 → 141. |
| 2026-05-16 (coverage Phase 7b) | Customer resource 완성 — 회원 14건 (paymentinfo 3 + properties 2 + customergroups 4 + delete + autoupdate + plusapp + social + social_list). customer supported 10 → 24, planned 14 → 0, 합계 141 → 155. customer 두 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7c) | Community resource — boards 설정 2건 + boards 글 CRUD 3건 + comments 3건 + commenttemplates 2건 = 10건. community supported 3 → 13, 합계 155 → 165. |
| 2026-05-16 (coverage Phase 7d) | Application resource — apps_update + scripttags CRUD 5건 + webhooks_update + webhooks_logs_list = 8건. application supported 3 → 11, 합계 165 → 173. |
| 2026-05-16 (coverage Phase 7e) | Shipping resource 완성 — carriers CRUD 3건 + regionalsurcharges 2건 + shipping_settings 2건 + shipping_additionalfees_countries + shippingorigins CRUD 5건 = 13건. shipping supported 2 → 15, planned 13 → 0, 합계 173 → 186. shipping 세 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7f) | Category resource 완성 — decorationimages 2건 (get/update) + seo 2건 (get/update) + mains 3건 (add/update/delete) + autodisplay 3건 (create/update/delete) = 10건. category supported 9 → 19, planned 10 → 0, 합계 186 → 196. category 네 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7g) | Supply resource 완성 — suppliers CUD 3건 + suppliers_users CRUD 6건 + suppliers_users regional shipping 5건 + shipping_suppliers 3건 = 17건. supply supported 3 → 20, planned 17 → 0, 합계 196 → 213. supply 다섯 번째 0-planned resource. 본 사이클 (Phase 7 a~g) 종료. |
| 2026-05-16 (coverage Phase 8a) | Mileage resource 완성 — `points_report` 1건. mileage supported 7 → 8, planned 1 → 0, 합계 213 → 214. mileage 여섯 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8b) | Promotion resource 완성 — `coupon_manage` 1건 (use_coupon T/F 토글). promotion supported 34 → 35, planned 1 → 0, 합계 214 → 215. promotion 일곱 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8c) | Translation resource 완성 — 테마 번역 단건 조회/수정 2건. translation supported 7 → 9, planned 2 → 0, 합계 215 → 217. translation 여덟 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8d) | Personal resource 완성 — `customers_wishlist_count` + `products_carts_count` + `products_carts_list` 3건. personal supported 2 → 5, planned 3 → 0, 합계 217 → 220. personal 아홉 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8e) | Notification resource 완성 — `customers_invitation_send` + recipientgroups CUD 3건 = 4건. notification supported 8 → 12, planned 4 → 0, 합계 220 → 224. notification 열 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8f) | Privacy resource 완성 — customers_privacy list/count/update 3건 + products_wishlist_customers list/count 2건 = 5건. privacy supported 1 → 6, planned 5 → 0, 합계 224 → 229. privacy 열한 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8g) | Application resource 완성 — appstore_orders get/create 2건 + appstore_payments list/count 2건 + databridge_logs_list + recipes list/create/delete 3건 = 8건. application supported 11 → 19, planned 8 → 0, 합계 229 → 237. application 열두 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8h) | Collection resource 완성 — manufacturers count/get/create/update 4건 + trends_count + classifications list/count 2건 + origin_list = 8건. collection supported 7 → 15, planned 8 → 0, 합계 237 → 245. collection 열세 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8i) | Design resource 완성 — themes count/get 2건 + theme_pages CRUD 4건 (get/create/update/delete) + icons_list + icons_update_settings = 8건. design supported 1 → 9, planned 8 → 0, 합계 245 → 253. design 열네 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8j) | Community resource 완성 — boards_comments_bulk + boards_seo get/update 2건 + commenttemplates get/update/delete 3건 + financials_monthlyreviews_count + urgentinquiry get/reply CRUD 4건 = 11건. community supported 13 → 24, planned 11 → 0, 합계 253 → 264. community 열다섯 번째 0-planned resource. 본 사이클 (Phase 8 a~j) 종료. |

```

#### `spec/conventions/cafe24-api-catalog/application.md`
```
# Cafe24 API Catalog — Application (앱 관리)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
> **주의**: 본 resource 는 Cafe24 앱 관리 API 다. 우리 서비스의 Integration `app_type` (Public/Private OAuth 앱 등록) 과 **무관** — naming collision 회피 참고.

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `applications_list` | 설치된 앱 목록 조회 | Retrieve an app information | GET | `applications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-app-information) |
| `scripttags_list` | 스크립트태그 목록 조회 | Retrieve a list of script tags | GET | `scripttags` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-script-tags) |
| `webhooks_list` | Webhook 설정 조회 | Retrieve webhook settings | GET | `webhooks` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-webhook-settings) |
| `apps_update` | 앱 정보 수정 | Update an app information | PUT | `apps` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | GET | `appstore/orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | POST | `appstore/orders` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | GET | `appstore/payments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | GET | `appstore/payments/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | GET | `databridge/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | GET | `recipes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
| `recipes_create` | 레시피 생성 | Create a recipe | POST | `recipes` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
| `recipes_delete` | 레시피 삭제 | Delete a recipe | DELETE | `recipes/{recipe_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
| `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | GET | `scripttags/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
| `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | GET | `scripttags/{tag_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
| `scripttags_create` | 스크립트태그 생성 | Create a script tag | POST | `scripttags` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |
| `scripttags_update` | 스크립트태그 수정 | Update a script tag | PUT | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag) |
| `scripttags_delete` | 스크립트태그 삭제 | Delete a script tag | DELETE | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag) |
| `webhooks_logs_list` | Webhook 로그 목록 | Retrieve a list of webhook logs | GET | `webhooks/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs) |
| `webhooks_update` | Webhook 설정 수정 | Edit webhook settings | PUT | `webhooks` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings) |

```

#### `spec/conventions/cafe24-api-catalog/category.md`
```
# Cafe24 API Catalog — Category (상품분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `category_list` | 카테고리 목록 조회 | Retrieve a list of product categories | GET | `categories` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-categories) |
| `category_get` | 카테고리 단건 조회 | Retrieve a product category | GET | `categories/{category_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-category) |
| `category_create` | 카테고리 생성 | Create a product category | POST | `categories` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-category) |
| `category_update` | 카테고리 수정 | Update a product category | PUT | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category) |
| `category_delete` | 카테고리 삭제 | Delete a product category | DELETE | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-category) |
| `category_products_list` | 카테고리별 상품 목록 조회 | Retrieve a list of products by category | GET | `categories/{category_no}/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-by-category) |
| `category_count` | 카테고리 개수 조회 | Retrieve a count of product categories | GET | `categories/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories) |
| `category_decorationimages_get` | 카테고리 꾸미기 이미지 조회 | Retrieve decoration image settings by category | GET | `categories/{category_no}/decorationimages` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category) |
| `category_decorationimages_update` | 카테고리 꾸미기 이미지 수정 | Update decoration images of a product category | PUT | `categories/{category_no}/decorationimages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category) |
| `category_seo_get` | 카테고리 SEO 조회 | Retrieve SEO settings by category | GET | `categories/{category_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category) |
| `category_seo_update` | 카테고리 SEO 수정 | Update a product category SEO | PUT | `categories/{category_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo) |
| `mains_list` | 메인 카테고리 목록 조회 | Retrieve a list of main categories | GET | `mains` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories) |
| `mains_add` | 메인 카테고리 추가 | Add main category | POST | `mains` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-main-category) |
| `mains_update` | 메인 카테고리 수정 | Update main category | PUT | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-main-category) |
| `mains_delete` | 메인 카테고리 삭제 | Delete main category | DELETE | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category) |
| `autodisplay_list` | 자동 진열 목록 조회 | Retrieve a list of auto layouts | GET | `autodisplay` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts) |
| `autodisplay_create` | 자동 진열 생성 | Create auto layout for selected product category | POST | `autodisplay` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category) |
| `autodisplay_update` | 자동 진열 수정 | Update auto layout for selected product category | PUT | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category) |
| `autodisplay_delete` | 자동 진열 삭제 | Delete auto layout for selected product category | DELETE | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category) |

```

#### `spec/conventions/cafe24-api-catalog/collection.md`
```
# Cafe24 API Catalog — Collection (판매분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `brands_list` | 브랜드 목록 조회 | Retrieve a list of brands | GET | `brands` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-brands) |
| `manufacturers_list` | 제조사 목록 조회 | Retrieve a list of manufacturers | GET | `manufacturers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-manufacturers) |
| `trends_list` | 트렌드 목록 조회 | Retrieve a list of trends | GET | `trends` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-trends) |
| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | GET | `brands/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
| `brands_create` | 브랜드 생성 | Create a brand | POST | `brands` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
| `brands_update` | 브랜드 수정 | Update a brand | PUT | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
| `brands_delete` | 브랜드 삭제 | Delete a brand | DELETE | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | GET | `manufacturers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | GET | `manufacturers/{manufacturer_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
| `manufacturers_create` | 제조사 생성 | Create a manufacturer | POST | `manufacturers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
| `manufacturers_update` | 제조사 수정 | Update a manufacturer | PUT | `manufacturers/{manufacturer_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | GET | `trends/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | GET | `classifications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | GET | `classifications/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | GET | `origin` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |

```

#### `spec/conventions/cafe24-api-catalog/community.md`
```
# Cafe24 API Catalog — Community (게시판)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `boards_list` | 게시판 목록 조회 | Retrieve a list of boards | GET | `boards` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-boards) |
| `board_articles_list` | 게시판 글 목록 조회 | Retrieve a list of posts for a board | GET | `boards/{board_no}/articles` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
| `board_article_get` | 게시판 글 단건 조회 | Retrieve a list of posts for a board (single) | GET | `boards/{board_no}/articles/{article_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
| `boards_settings_get` | 게시판 설정 조회 | Retrieve the board settings | GET | `boards/{board_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings) |
| `boards_settings_update` | 게시판 설정

... (truncated due to size limit) ...


---

## 변경 의도 (impl-prep — 곧 추가할 코드 변경, spec 본문은 변경 안 함)

### 본 PR 범위
1. 백엔드 `IntegrationDto` 에 `autoRefresh: boolean` 신규 필드 추가
   - `backend/src/modules/integrations/services/service-registry.ts` 의 `ServiceDefinition` 에 `supportsTokenAutoRefresh` 옵션 필드 추가
   - cafe24/google 의 정의에 true (둘 다 refresh_token 발급·갱신). github=false (spec §10.3 Refresh ✗).
   - `IntegrationsService.toPublic` 에서 매핑
2. 프론트엔드 `_shared/status-badge.tsx` 의 `computeStatus`
   - `expiresSoon` 분기를 `expiresSoon && !autoRefresh` 로 좁힘
   - `StatusView` 에 `subLabel` 옵셔널 필드 추가
   - autoRefresh 면 라벨 "Connected" 유지 + subLabel="Auto-renews" (i18n 키)
3. 프론트엔드 상세 페이지 `(main)/integrations/[id]/page.tsx`
   - 헤더 상태 배지에 subLabel 노출
   - Overview 탭 "Token Expires" 행을 autoRefresh 한정으로 친화 표기 (`in 1h 24m · auto-renews`)
   - `InfoRow` 에 optional `tooltip` prop 추가 (절대시각 강등)
4. i18n ko/en 양쪽 키 추가: `integrations.tokenAutoRenews`, `integrations.tokenExpiresInAuto` 등

### 본 PR 범위 밖 (별도 plan 으로 위임)
- §2.4 Need attention 배너 술어, §11.4 사이드바 카운트, §2.3 Expiring 칩, §9.1 `?status=expiring`/`?status=attention` 가상 필터 — autoRefresh 통합 제외 (spec 본문 변경 필요 → project-planner)
- backend `EXPIRING_SOON_INTERVAL` 쿼리, frontend `needsAttention()` 가드 변경 — 후속 PR

세부: `plan/in-progress/integration-token-ui-autorefresh.md` + `plan/in-progress/spec-update-integration-autorefresh.md`

### 점검 요청 포인트
- `autoRefresh` 식별자가 기존 식별자(요구사항 ID / 엔티티 / 환경변수)와 충돌하는지
- 본 변경이 spec §2.2 / §4.1 / §4.2 / §9.1 / §10.5 의 정의와 정합되는지
- 같은 worktree / 다른 in-progress plan 과의 충돌 (특히 cafe24-*, integration-* 계열)
- API DTO 필드 추가 시 swagger 컨벤션, i18n 키 ko/en parity 컨벤션 준수
