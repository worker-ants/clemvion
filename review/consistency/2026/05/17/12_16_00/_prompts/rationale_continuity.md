# Rationale 연속성 Check Payload

본 파일은 orchestrator 가 Rationale 연속성 checker 용으로 작성한 입력입니다. target 문서가 기존 spec 의 `## Rationale` 에서 이미 기각·폐기된 결정을 다시 도입하거나 합의 원칙을 무시하지 않는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Rationale 연속성)

1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙을 따르지 않고 있는가
3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가
4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 들어와 있는가

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

## 관련 Rationale 발췌

### Rationale 발췌

#### `spec/1-data-model.md` 의 Rationale

## Rationale

### Execution.execution_path → ExecutionNodeLog (V035 → V036)

옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.

이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.

- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.

설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.

### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)

옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).

#### `spec/3-workflow-editor/4-ai-assistant.md` 의 Rationale

## Rationale

본 spec 결정 사항의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며, 폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 를 참조.

_원본 메모: memory/workflow-ai-assistant-decisions.md_

### Workflow AI Assistant — 기획 결정 메모

Workflow AI Assistant(에디터 내 채팅형 AI) 스펙 작성 시 사용자와 합의한 결정 사항을 구현자가 재참조할 수 있도록 정리한다.

#### 확정된 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 제품 명칭 | **Workflow AI Assistant** / 워크플로우 AI 어시스턴트 | PRD/Spec/i18n 전 영역에서 통일 사용. "Copilot", "AI Workflow Builder" 후보는 기각 |
| PRD 배치 | `prd/2-workflow-editor.md` §10, 요구사항 ID 접두사 `ED-AI-*` | 에디터 내부 UI/UX가 주 영역이므로 에디터 문서에 포함. PRD 6에서는 cross-ref만 |
| 채팅 세션 영속화 | **서버 저장** (신규 엔티티 `AssistantSession`, `AssistantMessage`) | 페이지 새로고침·재접속 시 이어서 대화 지원. 관련: `spec/1-data-model.md` §2.20~2.21 |
| 변경 적용 방식 | 즉시 반영 + Undo (`editor-store` 재사용) | 기존 자동 저장/Ctrl+S 흐름과 일관. DB 영구 기록은 사용자의 Save를 통해서만 |
| 스트리밍 | SSE + `LLMClient.stream()` 신규 메서드 | 관련: `spec/5-system/7-llm-client.md` §8 |
| 스트리밍 v1 지원 provider | OpenAI, Anthropic만 | Google/Azure는 Tool-use 포맷 차이로 후속. 미지원 provider 선택 시 `ASSISTANT_STREAMING_UNSUPPORTED` 에러 |
| NodeSettings Panel과 동시 오픈 | **상호 배타** (Assistant 열면 Settings 닫힘) | MVP 단순화. 사용자 피드백에 따라 후속 버전에서 나란히 배치 가능 |
| Assistant의 편집 권한 | `editor` 역할 이상 | 기존 RBAC 규약 재사용 |

#### 구현 시 유의 사항 (승인된 기술 플랜 `~/.claude/plans/ui-partitioned-porcupine.md` 대비 변경점)

원래 기술 플랜에는 "채팅 히스토리는 in-memory only (MVP)"로 명시되어 있었으나, **기획 단계에서 서버 영속화로 변경**되었다. 따라서 다음 작업이 추가된다:

1. **DB 엔티티 2개 신규**: `AssistantSession`, `AssistantMessage` (Flyway 마이그레이션 필요)
2. **REST API 5개 신규**: `GET/POST/PATCH/DELETE /workflow-assistant/sessions`, `GET /workflow-assistant/sessions/:id`. SSE 엔드포인트는 `POST /workflow-assistant/sessions/:id/messages`로 경로 변경 (기존 플랜의 `/workflow-assistant/message`가 아님).
3. **백엔드 Service**: 세션/메시지 CRUD + 대화 컨텍스트 조립(최근 30턴 프롬프트 주입 룰).
4. **프론트엔드 스토어**: `assistant-store.ts`가 서버 세션 id를 들고 있어야 하며, 패널 오픈 시 `GET /sessions?workflowId=...`로 기존 세션을 로드.
5. **Cascade 삭제**: `Workspace` 삭제 → `Workflow` 삭제 → `AssistantSession` 삭제 → `AssistantMessage` 삭제. Flyway 마이그레이션에서 ON DELETE CASCADE FK 설정.

#### 미결 UX (발견 시 확인 필요)

- 세션 보관 기간/자동 archive 정책 — 현재 Spec은 "수동 삭제까지 영속". 향후 워크스페이스별 용량 제한과 연계 가능.
- 세션 공유/내보내기 — v1 스코프 밖 명시. 팀 워크스페이스 RBAC 선행 필요.
- Plan 카드의 step을 사용자가 직접 편집/체크 가능한지 — 현재 Spec은 "사용자 조작 불가, 진행도 표시 전용"(§3.3). 필요해지면 별도 RFC.

_원본 메모: memory/workflow-assistant-prompt-restructure.md_

### Workflow AI Assistant 시스템 프롬프트 재구조 (2026-04-22)

`backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 를 5블록 구조로 재편한 작업의 핵심 결정 사항과 향후 주의점을 정리한다.

#### 왜 바꿨나

##### 이전 구조의 문제

1. **규칙 중복.** "plan-only vs execution turn" 분기가 5군데(L84/L85/L129/L138–153/L251)에 흩어져 LLM이 매 턴 파싱해야 했다. `planStepId` 태깅 규칙도 4군데, `get_node_schema` 선행 규칙도 4군데 반복.
2. **토큰/캐시 비효율.** 매 턴 변하는 `workflow snapshot JSON`(L121)과 `activePlanSection`(L87 근처)이 프롬프트 상단에 있어 provider prefix cache가 사실상 매 턴 무효화.
3. **시각적 우선순위 부재.** 섹션이 전부 `##` 동일 레벨, MUST/SHOULD 계층 구분 없음. 서술형 문장 안에 분기 로직이 숨어 있었음.
4. **부정문 지배.** DO NOT / NEVER / MUST NOT 위주. 긍정형 격언이 드물었다.
5. **예시 중복.** 6개 예시 중 3개가 사실상 같은 교훈(trigger 연결 + dynamic-ports + label/id) 반복.

#### 새 구조 (5블록)

1. **ROLE & TURN-OP PROTOCOL** — 역할 1문장 + 툴 호출 규약 + **turn 결정표** (Markdown table: `Turn type | Emit prose? | finish call? | Further tools | When it applies`)
2. **CONTRACTS (MUST)** — Node output contract (CONVENTIONS 0/1.1/2/8), Label vs identifier, Entry-point connectivity, Dynamic-ports (schema-first + stable ids), Plan gating (openQuestions / planStepId / completeness)
3. **EDIT PLAYBOOK** — Closing the turn, pendingUserConfig, Editing existing node's config, Layout guidance, Error handling, Examples (3개)
4. **REFERENCE** — Node catalog, Expression language
5. **DYNAMIC STATE** — Active plan context + Current workflow snapshot JSON (**반드시 프롬프트 끝에 위치**)

##### 주요 효과

- **Prefix cache 친화.** 정적 콘텐츠가 앞, 동적 상태가 뒤로 이동해 prefix-cache hit rate가 크게 개선될 것으로 기대.
- **규칙 단일 소스.** "Call `finish` immediately after `propose_plan`" 문구가 **딱 한 곳(turn 결정표)** 에만 존재. 다른 섹션에서는 "the decision table above" 로만 참조.
- **Expression reference 캐시.** `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 변수로 한 번만 문자열화. 이전엔 매 턴 `getAllFunctionNames().sort().join()` 을 재실행.
- **예시 3개로 축소** — Ex1 단순 edit / Ex2 dynamic-ports+pendingUserConfig (label/id 동시 커버) / Ex3 openQuestions 포함 복잡 요청.

#### 새 구조를 고정하는 테스트

`system-prompt.spec.ts` 에 `5-block structural layout (cache-friendly ordering)` describe 블록 추가. 향후 변경 시 다음이 깨지면 안 된다:

- `## Expression language` 이후에 workflow snapshot JSON(`"nodes":[`) 이 위치.
- `## Expression language` 이후에 `## Active plan context` 위치.
- `Label vs identifier` (CONTRACTS) 는 `## Expression language` (REFERENCE) 보다 앞.
- Turn 결정표 헤더 `| Turn ... | ... prose ... | ... finish ...` 형태가 존재하고 `plan-only` / `execution` 두 턴 종류가 본문에 등장.
- `Call finish immediately after propose_plan` 정규식 매치가 **1회 이하** (중복 금지).

#### 보존한 계약 (기존 테스트가 보장하는 것)

다음은 절대 문구를 깨면 안 된다 (regex 매칭됨):

- `[dynamic-ports]` 카탈로그 마커
- P0 guard rail: `manual_trigger` entry-point / `openQuestions` finish 금지 / `get_node_schema` MANDATORY
- Label vs identifier 예시: `btn_approve`, `승인`, `interaction.data.buttonId`, `interaction.data.email`, `data["승인"]` 금지 사례
- `## Closing the turn ... execution turn` 헤더 (동일 라인에 두 문구)
- `pendingUserConfig`, 4종 selector: `integration-selector`, `llm-config-selector`, `kb-selector`, `workflow-selector`
- `TODO|placeholder` 금지 가드
- `## Expression language`, `validate()`, `INVALID_EXPRESSION`, `Optional chaining`, `` `??` ``, `Arrow`, `Template literal`
- `Editing an existing node's config`, `shallow-merged`, `[REDACTED]`, `minimum patch`, "keep .* id"
- Active plan rendering: `[x] s1 · add_node` / `[ ] s2 · add_edge` / `• [note] ...` / `awaiting approval` / XML fence `<user-request>...</user-request>`

#### 이번 작업에서 발견한 pre-existing 이슈

TEST WORKFLOW 중 다음 테스트가 **main 브랜치에서도 실패** 함을 확인 (git stash 로 재현):

- `backend/src/modules/workflow-assistant/tools/validate-expressions.spec.ts` — "accepts optional chaining" 케이스
- `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts` — "accepts add_node with optional chaining (supported syntax)"

원인은 `@workflow/expression-engine` 패키지의 optional chaining 파서가 한글 키 인덱싱(`$node["1depth 음식 종류"]?.output?.interaction?.data.field`)을 거부하는 것으로 보인다. 최근 커밋 `6f6cfe1 표현식에 ? 지원` 에서 도입하려던 수정이 불완전한 듯하다.

**이번 프롬프트 재구조 작업 범위 밖**이므로 별도 이슈로 처리해야 한다. 프롬프트 재구조는 이 실패들과 독립적으로 완결.

#### 유지보수 시 체크

- 섹션을 추가할 때 **블록 경계를 넘지 말 것.** 정적 내용은 BLOCK 1~4, 동적 내용은 BLOCK 5. 이 규율이 캐시 효과의 근간.
- `STATIC_BLOCK_1_*`, `STATIC_BLOCK_2_*`, `STATIC_BLOCK_3_*` 모듈 스코프 상수로 빌드 타임에 1회만 문자열화됨. 동적 값이 필요하면 이 상수에 넣지 말고 `buildSystemPrompt` 본체에서 조립.
- 새 규칙을 추가하기 전, **기존 섹션에 흡수 가능한지 먼저 검토.** 규칙을 여러 곳에 반복 넣으면 이번 리팩토링이 무효화된다.
- Harmony control token 경고(`<|channel|>` 등) 는 OpenAI gpt-oss 계열 대비 유산. 현 provider (OpenAI/Anthropic/Google) 모두에서 발생하지 않는다는 것이 확인되면 제거 가능.

_원본 메모: memory/workflow-assistant-self-review-and-error-hints.md_

### Workflow Assistant — 자체 점검 + 에러 풍부화 (2026-04-23)

Assistant 가 복합 워크플로우 (예: 설문조사) 를 만들 때 실패 tool call 이 연쇄적으로 발생하던 문제와, 완료 후 자체 점검이 없던 문제를 해결한다. 본 메모는 향후 유지보수 시 놓치면 안 되는 결정·제약을 정리한다.

#### Part A — Tool-call 오류 감소

##### 에러 풍부화 (ShadowResult 확장)

`ShadowResult` 에 optional 필드 추가:
- `knownTypes: string[]` (정렬, 최대 `KNOWN_TYPES_MAX=40`) — `UNKNOWN_NODE_TYPE`
- `suggestedType: string` — alias 맵 hit (`NODE_TYPE_ALIASES`) 우선, 없으면 Levenshtein ≤ 3
- `repeatCount: number` — 같은 label LABEL_CONFLICT 가 `LABEL_CONFLICT_REPEAT_THRESHOLD(=2)` 이상 반복 시
- `hint: string` — 복구 지침 한 문장. 세 케이스에서 set 될 수 있다 (JSDoc 에 명시):
  - UNKNOWN_NODE_TYPE (alias / Levenshtein / 후보 없음 별로 문구 다름)
  - LABEL_CONFLICT (repeatCount ≥ 2)
  - NODE_NOT_FOUND on add_edge (recentFailedAddNodeLabels 가 있을 때 cascading 힌트)

##### alias 별칭 정책

`NODE_TYPE_ALIASES` 는 `error_message | error | alert | notification | message | text → template`.
기준: LLM 이 "UI 메세지용 전용 노드" 가 있다고 가정해 만들어내는 타입명을 `template` 으로 라우팅.
반드시 `this.knownNodeTypes.has(aliasHit)` 를 확인한 뒤에만 suggestedType 으로 싣는다 (registry 변화 대응).

##### LABEL_CONFLICT ≠ 실패한 노드 생성

**규약**: `addNode()` 의 LABEL_CONFLICT 분기에서는 `recordFailedAddNode` 를 호출하지 않는다. 이유: LABEL_CONFLICT 는 "이름만 겹쳤을 뿐 타입·config 자체는 타당" 한 상태이므로, 이후 `add_edge` 가 NODE_NOT_FOUND 로 떨어졌을 때 cascading 힌트에 섞이면 "앞서 노드 생성이 실패했다" 는 잘못된 진단을 LLM 에 준다. 테스트: `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint".

##### LLM 제공 문자열 embedding 규약

LLM 이 자유 텍스트로 채우는 값(label, attemptedType) 을 힌트/에러 메세지에 embed 할 때는 **반드시** `sanitizeLlmProvidedString(value, maxLen)` 경유. 이 헬퍼가 제어 문자·개행 제거, 백틱·꺾쇠 중화, 길이 절단을 일관 처리한다. 이유: LLM 출력이 `\n## HACK` 같은 마크다운 헤더/인젝션을 품은 채 힌트로 재주입되면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다.

길이 상수:
- `ATTEMPTED_TYPE_MAX_LEN = 64` — node type 후보 embed
- `LABEL_HINT_MAX_LEN = 80` — NODE_NOT_FOUND 힌트 label 목록

##### schemaCache 정책

`workflow-assistant-stream.service.ts` 의 턴 스코프 `schemaCache: Map<string, { result, hits }>`.

카운트 규칙: **hits 값은 호출 순번 그 자체**. 첫 호출 후 1, 두 번째 2, 세 번째 3...
- hits=1 (첫 호출): 정상 실행, cache set
- hits=2 (두 번째): cached + `warning: 'REDUNDANT_SCHEMA_LOOKUP'` + `cached: true`
- hits ≥ 3 (`SCHEMA_LOOKUP_HARD_STOP`): `ok: false, error: 'REDUNDANT_SCHEMA_LOOKUP'` (hard stop)

이 상수를 변경할 때는 서비스 L137–142 주석 + L459–462 inline 주석 + 테스트 3회차 기대값을 모두 동시에 고친다.

#### Part B — 2-stage finish (self-review)

##### 흐름

LLM 이 `finish` 를 호출하면 서버는 아래 순서로 판정:

1. `evaluateFinishGuard` → `PLAN_NOT_COMPLETE` 면 block (기존 동작, 변경 없음).
2. 통과하면 `evaluateReviewGuard` → `WORKFLOW_REVIEW_REQUIRED` 면 block.
3. 둘 다 통과하면 `{ ok: true }` 로 finish 성공.

Review 는 **한 턴에 한 번만** 발동 (`state.reviewCompleted`, `state.reviewRoundCount < 2`). 두 번째 `finish` 는 review 를 건너뛰고 통과해, LLM 이 사용자에게 다음 턴에서 후속 지시를 받을 기회를 보장.

##### review skip 조건 (`shouldSkipReview`)

다음 중 하나라도 참이면 review 는 발동하지 않는다. **시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지** (프롬프트·구현 drift 가 곧 LLM 혼란으로 이어짐):

- `state.reviewCompleted`
- `state.reviewRoundCount >= 2`
- `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복
- `state.planClearedThisTurn`
- 이번 턴 성공 edit 이 0 — 실행 턴 아님
- non-trigger 노드 ≤ 1 — trivial 편집 (plan 유무 무관)

##### 체크리스트 항목 (`review-workflow.ts`)

Blocking:
- **UNRESOLVED_FAILED_CALLS** — `kind === 'edit'` 실패 중 같은 label(add_node) / id(update/remove) / source+target+port 튜플(add_edge, camelCase 도 포함) 로 성공 흔적이 없는 것. **`finish` / `explore` 계열은 제외** (review-guard feedback 이나 `REDUNDANT_SCHEMA_LOOKUP` 은 실패 의미가 아님).
- **`PORT_NOT_FOUND` (2026-04-23 추가, add_edge 단계에서 즉시 반환)** — UNRESOLVED_FAILED_CALLS 과는 다른 class. `ShadowWorkflow.addEdge` 가 `portResolver` (stream.service 에서 `resolveEffectiveOutputPorts` 기반 주입) 로 source/target 포트 존재성을 검사, 없는 포트면 즉시 `PORT_NOT_FOUND` + `portInfo.knownPorts` 로 reject. 사용자가 config update 실패로 생성되지 못한 동적 포트 (carousel 버튼 / switch case 등) 에 edge 를 붙이려는 실수를 첫 시도에서 catch. 컨테이너 loopback `emit` 포트는 여전히 허용 (spec §4.4).
- **ORPHAN_NODES** — trigger category 에서 BFS 도달 불가 + container emit loopback 조상도 미reachable. `byId` Map 은 `collectOrphans` 에서 1회 생성 후 인자로 주입 (O(N²) → O(N+E)).
- **DANGLING_OUTPUT_PORTS** (2026-04-23 추가) — `resolveEffectiveOutputPorts` 가 돌려주는 `isUserConfigured=true` 포트 중 outgoing edge 없는 것. "ORPHAN_NODES 는 입력 방향 reachability, 이 검사는 출력 방향 connectivity" 의 대칭 쌍. weak 포트 (`error`/`default`/`fallback`/`continue`/단일 static `out`) 는 제외 — terminal 노드는 정상 케이스. `nodeDefs` 가 `BuildReviewChecklistInput` 으로 주입되어야 작동; 빈 배열이면 no-op. 상한 `MAX_DANGLING_PORTS=20`.
- **FAKE_STEP_COMPLETION** — `planStepId` 또는 `planStepIds` 가 붙은 호출들이 step 에 연결되어 있으나 모두 `ok: false`.
- **PENDING_USER_CONFIG_UNMENTIONED** — pendingUserConfig 있는 노드의 label 이 assistantText 에 포함되지 않음.

Non-blocking:
- **REQUEST_COVERAGE_LOW** — originalRequest 의미 토큰과 노드 label 겹침 비율 < 30%. 경고만.

##### Port 해석 (resolve-dynamic-ports.ts)

`frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 로직을 backend 로 포팅한 `tools/resolve-dynamic-ports.ts` 가 SSOT. 6 종 `DynamicPortsSpec` (switch-cases, classifier-categories, ai-agent-conditional, info-extractor-mode, presentation-buttons, parallel-branches) 를 전부 지원. 반환 구조에 `isUserConfigured: boolean` 추가 — strong (user-authored) vs weak (framework-synthesized) 구분이 DANGLING_OUTPUT_PORTS 의 핵심 필터. Frontend 사본과 드리프트하지 않도록 `resolve-dynamic-ports.spec.ts` 에 kind 별 시나리오 미러 (16 테스트).

##### 프롬프트 인젝션 방어

`WORKFLOW_REVIEW_REQUIRED` payload 의 `originalRequest` 필드는 `truncateReviewOriginalRequest()` 로 `REVIEW_ORIGINAL_REQUEST_MAX_LEN=200` 자로 잘라 싣는다. 전체 원문은 system prompt 의 Active plan context 에 XML fence 로 이미 중화되어 주입되므로 review 쪽에는 요약만.

##### 프론트엔드 영향

`tool-call-badge.tsx` 는 `kind === 'edit' | 'explore'` 만 SSE 로 구독하므로 `finish` tool_result (`ok: false, error: 'WORKFLOW_REVIEW_REQUIRED'`) 는 UI 빨간 배지로 누출되지 않는다. 사용자는 review 라운드 중 LLM 이 추가로 부른 `get_current_workflow` / 수정 edit 배지 + Korean "검토 완료" 문장만 본다.

#### 유지보수 체크리스트

- `SCHEMA_LOOKUP_HARD_STOP` 변경 시: 상수 정의부 + 인라인 주석 + 테스트 기대값 3곳 동시 수정.
- `ShadowResult` 필드 추가/제거 시: JSDoc 블록 + 테스트 fixture + 후속 `detectPendingUserConfig` / `toChatMessages` rehydration 경로 확인.
- Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화 (테스트 `system-prompt.spec.ts` "teaches the 2-stage finish self-review routine..." 가 고정).
- `NODE_TYPE_ALIASES` 변경 시: alias 가 registry 에 존재하지 않으면 Levenshtein fallthrough 로 빠지는지 회귀 확인 (`shadow-workflow.spec.ts` "falls through to Levenshtein when alias exists but not in knownTypes").
- `resolveEffectiveOutputPorts` 변경 시: **frontend `resolveDynamicPorts` 와 동일 동작** 을 유지하는지 확인. 두 파일이 각자의 spec 을 가지므로 어느 한쪽만 업데이트하면 review false positive/negative 가 생긴다. 새로운 `DynamicPortsSpec.kind` 추가 시 양쪽에 동시에 branch 추가.
- DANGLING_OUTPUT_PORTS 의 weak/strong 경계 변경 시: `resolve-dynamic-ports.spec.ts` 의 `isUserConfigured` 단언 + `review-workflow.spec.ts` "does NOT flag weak ports" 케이스 모두 업데이트.

#### Follow-up (스코프 밖, 별도 이슈)

- `ShadowResult` discriminated union 전환
- `ShadowWorkflow` SRP 분리 (`ShadowWorkflowErrorAdvisor`)
- `schemaCache` 응답 명시 구조 래핑 (`{ ok, data, cached, warning }`)
- CHANGELOG 정책 수립 후 본 변경 소급 반영

_원본 메모: memory/workflow-assistant-provider-quirks-and-review-always.md_

### Workflow Assistant — 프로바이더 이상동작 대응 + review 항상 발동 (2026-04-23)

초기 self-review + 에러 풍부화 배포 후 다양한 LLM 프로바이더에서 관찰된 이슈에 대한 2차 대응을 정리.

#### 1. 프로토콜 이상: tool_call + finishReason=stop (gpt-oss-120b)

##### 증상
gpt-oss-120b 같은 오픈소스 서빙이 edit tool 호출 후에도 `finish` tool 을 부르지 않고 `finishReason: 'stop'` 으로 round 를 종료. LLM text 채널에는 "다음 단계 진행 중" 같은 내레이션을 남겨 사용자는 "멈춤" 으로 체감.

##### 대응
`stream.service.ts` 루프 종료 조건 확장:
```ts
const hadSuccessfulEditThisRound = pendingResultsForLlm.some(...)
const shouldContinueLoop =
  pendingResultsForLlm.length > 0 &&
  (finishReason === 'tool_calls' ||
   (!finishResolved && hadSuccessfulEditThisRound));
```

**edit 가 실제로 성공한 round 에서만** round-trip. propose_plan / explore 만 있는 plan-only round 는 기존처럼 stop 으로 종료 (추가 round 의 ROI 없음).

##### 프롬프트 강화
`STATIC_BLOCK_3_EDIT_PLAYBOOK` Closing the turn 섹션:
- **Past tense only** — "진행 중", "차례대로", "다음 단계", "이어서 진행하겠습니다" 등 미래형 내레이션 금지 (포착된 실제 leak 패턴).
- **finish 필수** — tool 호출 후 반드시 `finish` 를 명시 호출해야 함을 강조. 서버의 round-trip 은 fallback 이며 의존 금지.

#### 2. Harmony control token 누수 (gpt-oss)

##### 증상
gpt-oss-120b 가 `<|channel|>final<|message|>...` 같은 내부 제어 토큰을 응답에 노출. OpenAI SDK 의 SSE 파서가 이를 파싱하다 "Failed to parse input at pos 0: ..." 로 throw → 사용자에게 raw `LLM_CONNECTION_ERROR` 노출.

##### 대응 (2계층)
`openai.client.ts`:
1. **Streaming stripping** — `delta.content` / tool_call arguments 에서 harmony 제어 토큰 제거. 패턴 2개 사용:
   - `HARMONY_CHANNEL_PREAMBLE_REGEX = /<\|channel\|>[\s\S]*?<\|message\|>/g` — preamble 전체 (channel 이름 포함) 한 번에.
   - `HARMONY_STANDALONE_TOKEN_REGEX = /<\|(channel|start|end|message|return|constrain|...)\|>/g` — 잔여 단독 토큰.
2. **Parse error 분류** — catch 블록에서 에러 메세지가 harmony 패턴 매치면 `LLM_OUTPUT_MALFORMED` 로 분류하고 사용자 친화적 한국어 안내문으로 치환. Raw 메세지는 UI 에 노출하지 않음 (로그에만).

#### 3. 에러 UI 시안성 개선

##### 증상
어시스턴트 패널 error box 가 `text-red-800/200` 탁한 shade 사용 → 배경과 대비 부족, 특히 11px 소형 텍스트에서 가독성 낮음.

##### 대응
`assistant-message.tsx` 의 error box 를 systemHint 패턴과 동기화:
- 본문 텍스트: `text-red-950 dark:text-red-50` + `font-medium` — "가장 짙은 shade / 가장 옅은 shade" 대비 극대화.
- 에러 코드 pill: 별도 shade 배경 (red-200 light / red-800 dark) + border 로 명확히 구분.
- 본문 글자 크기 `10px → 11px` 로 상향 (message.error 타이틀과 동일 레벨).
- 긴 영문 에러 메세지 대비 `break-all` 추가.

#### 4. Gemini-3-flash 존재하지 않는 노드 타입 발명

##### 증상
Gemini-3-flash 이 `음식 종류 선택` 같은 label 로 add_node 시도 — catalog 에 없는 type 을 기본 시나리오 표현으로 발명. 첫 `UNKNOWN_NODE_TYPE` 응답의 `suggestedType` / `knownTypes` 힌트도 무시하고 반복 재시도.

##### 대응
1. **`NODE_TYPE_ALIASES` 확장** — LLM 이 빈번히 발명하는 패턴을 실제 존재 타입으로 매핑 추가:
   - `user_input / input / question / prompt / survey / text_input` → `form`
   - `choice / choices / options / selection / selector / button_group / category / buttons` → `carousel`
   - `router / route / branch / conditional` → `switch` (boolean 은 `if_else`)
   - `email / send_mail / mail` → `send_email`
   - `display / show / render / result / output` → `template`

2. **프롬프트 강화** — `STATIC_BLOCK_3_EDIT_PLAYBOOK` Common pitfalls:
   - "Node types are a fixed catalog — do NOT invent new types based on your task wording." 추가.
   - 각 카테고리별 "흔한 오발명 → 실제 타입" 표 내장 (message/input/choice/branching/email 5계열).

3. **UNKNOWN_NODE_TYPE 시 suggestedType 을 알려주는 것에 더해 alias 매핑이 광범위해 대부분의 발명 패턴을 한 번에 교정**.

#### 5. Review guard 항상 발동 (사용자 요구 반영)

##### 증상
`finishBlockCount > 0` skip 조건 때문에 PLAN_NOT_COMPLETE 가 fire 한 다음에는 review 가 발동하지 않음. 사용자 보고: 복잡한 워크플로우에서 plan 가드를 통과한 뒤에도 orphan / pendingUserConfig 미안내 이슈가 여전히 발생.

##### 대응
`evaluateReviewGuard` 의 `shouldSkipReview` 에서 `finishBlockCount > 0` 체크 **제거**. 두 가드는 독립 계층으로 운영:
- PLAN_NOT_COMPLETE — plan 체크박스 충족성 (step ↔ tool call 매핑)
- WORKFLOW_REVIEW_REQUIRED — 워크플로우 품질 (orphan / 실패 미해결 / pendingUserConfig 안내 / fake step 완료)

Plan 가드가 fire 했다는 것은 LLM 이 한 번 보정 했을 뿐, 결과 워크플로우의 품질을 보장하지 않음. 두 가드 모두 fire 하는 3~4 round 시나리오가 현실적 정상 경로.

##### 남은 skip 조건 (최소 안전망)
- `reviewCompleted` / `reviewRoundCount >= 2` — 같은 턴 review 1회 상한
- `planClearedThisTurn` — 화제 전환
- 성공 edit 0 — 실행 턴 아님
- non-trigger 노드 ≤ 1 — trivial 편집 (ROI 낮음)

##### PENDING_USER_CONFIG_UNMENTIONED 상세화
details 문자열에 구체적 노드 label + 빠진 selector 목록을 인라인으로 실어, LLM 이 다음 라운드 한국어 마무리 메세지 작성 시 즉시 참조할 수 있게 함. 예:
> "SendEmail (Integration); AIAgent (LLM Config). In the next round, emit a Korean summary that names each listed node label verbatim..."

> **2026-04-24 업데이트 — 본 가드는 이제 "candidate 0 인 항목" 에만 발동한다.**
> spec ED-AI-39 로 in-message candidate picker 가 도입되어, 워크스페이스에
> 후보가 1건 이상 있으면 프런트 picker 가 UX 를 완결한다. LLM 의 한국어
> mention 은 후보 목록이 비어있어 **사용자가 직접 Integration/LLM/KB/워크플로
> 를 등록해야 하는 경우에만** 필요하다. 상세는
> *workflow-assistant-candidate-picker.md (본 Rationale 섹션 내)*.

#### 6. Plan-only 턴의 핑퐁 루프 차단 (gemini-3-flash-preview)

##### 증상
사용자 보고 (2026-04-23): 복합 설문조사 워크플로우 요청 → gemini-3-flash-preview 가
`propose_plan` 직후 `finish` 를 호출하지 않고 같은 턴에 수십 개의 edit 을 연쇄 발사.
프로바이더가 `finishReason: 'tool_calls'` 로 종료 → 서버가 round-trip → LLM 이
`PLAN_AWAITING_APPROVAL` 피드백을 보고도 또 edit 재시도 → `MAX_TOOL_LOOP_ROUNDS (50)`
도달 → 사용자 UI 에 "진행이 중단됐어요" + 수십 개의 빨간 배지.

##### 대응 (서버 강제)
`stream.service.ts` 의 `shouldContinueLoop` 판정 앞에 단락 가드 추가:
```ts
const planProposedPendingApproval = !!planForTurn && !planForTurn.approvedAt;
if (planProposedPendingApproval) finishReason = 'stop';
const shouldContinueLoop = !planProposedPendingApproval && ...;
```

- Plan 을 제안했는데 아직 미승인 → 이번 턴 내 round-trip 금지 (1 라운드 종료).
- `finishReason` 을 `'stop'` 으로 덮어써 클라이언트가 "승인 대기" UI 로 전환.
- 시스템 프롬프트의 "Plan-only turn | Call finish immediately after propose_plan"
  규칙을 서버가 실제로 enforce. LLM 이 규칙 준수하지 않아도 핑퐁 루프는 발생 안 함.

##### 호환성
- 정상 경로 (`propose_plan` → `finish` 한 라운드 내): `finishResolved=true`,
  `finishReason='stop'` 이 이미 내려가 있어 기존 `shouldContinueLoop=false` 로 자연 종료.
  가드는 중복 발동해도 동일한 최종 결과.
- `clear_plan` 이후 새 plan 없이 edit 만 하는 턴: `planForTurn=null` 이라 가드 미발동.
- History 에서 load 된 approved plan 실행 턴: `planForTurn=null`, 가드 미발동.

##### 회귀 테스트
`stream.service.spec.ts` — "does NOT round-trip when a plan was proposed and is
pending approval, even if the provider reports finishReason=tool_calls
(Gemini-3-flash pattern)". `chatStream` 호출 횟수 1 + `finishReason=stop` + error
이벤트 없음을 동시에 고정.

#### 7. Stall 자동 복구 (gpt-oss-120b 임의 중단)

##### 증상
gpt-oss-120b 가 pending step 이 남은 plan 실행 턴에서 tool call 을 하지 않고
텍스트만 뱉고 `finishReason: 'stop'` 으로 종료. 기존 "edit 성공 round 에만 round-trip"
가드로는 cover 되지 않아 턴이 조용히 끝남. frontend 는 `turnStalledHint` 로
"이어서 진행해줘" 안내를 띄우지만 사용자가 수동으로 follow-up 을 입력해야 했다.

##### 대응 (서버 자동 복구)
`stream.service.ts` 의 기존 `shouldContinueLoop` 뒤에 **stall 복구 블록** 추가:

```ts
const hasPendingActionableSteps = (() => {
  if (planPending || finishResolved) return false;
  if (pendingResultsForLlm.length > 0) return false;  // 이미 위 경로가 cover
  const ctx = findActivePlanContext(...);
  if (!ctx || ctx.status !== 'active') return false;
  return ctx.plan.steps
    .filter(s => s.action !== 'note')
    .some(s => !ctx.completedStepIds.has(s.id));
})();
if (hasPendingActionableSteps && consecutiveStallRounds < MAX_STALL_ROUNDS) {
  consecutiveStallRounds++;
  messages.push({ role: 'assistant', content: roundText });
  messages.push({ role: 'user', content: '이어서 진행해줘.' });
  continue;
}
```

- Text-only stall + pending plan → 서버가 user 역할의 nudge "이어서 진행해줘." 를
  messages 배열에 주입하고 루프 계속. LLM 은 다음 라운드에서 system prompt 의
  Active plan context + user nudge 를 보고 `[ ]` pending step 부터 resume.
- `MAX_STALL_ROUNDS = 2` 로 runaway 방지 — 2 번 연속 stall 하면 실제 막힌 상태로
  간주해 턴 종료 (MAX_TOOL_LOOP_ROUNDS=50 전에 탈출).
- 진척이 있는 라운드는 `consecutiveStallRounds = 0` 으로 리셋.
- 이 값 조정 시 `stream.service.spec.ts` "gives up after MAX_STALL_ROUNDS..." 고정
  테스트도 동시에 업데이트.

##### 호환성
- Plan-only 턴 (미승인): `planPending` 단락으로 stall 가드도 건너뜀 — 사용자 approve
  대기가 올바른 상태.
- 이미 finish 성공: `finishResolved=true` 로 제외.
- Pending step 없음: plan 완료 상태면 nudge 의미 없음 → 가드 비발동.
- `pendingResultsForLlm.length > 0` 인 경우: 기존 shouldContinueLoop 가 이미 cover.

##### 회귀 테스트
`stream.service.spec.ts` "auto-continue on stall with pending plan" describe:
- "auto-nudges LLM when a round ends text-only + stop + plan has pending steps"
- "gives up after MAX_STALL_ROUNDS (2) consecutive text-only stalls to prevent runaway loops"
- "does NOT auto-continue when plan has no pending actionable steps"

#### 8. UX: plan-only 자동 안내 hint 제거 (2026-04-23)

##### 증상
plan-only 턴에서 plan card 와 함께 "계획대로 진행해 주세요." systemHint 가 동시에
노출 → plan card 의 "계획대로 진행" 버튼 + 동일 문구의 info 박스가 중복 메시지로
인식. 사용자 피드백: 버튼이 이미 있으므로 hint 는 불필요.

##### 대응
`frontend/src/lib/stores/assistant-store.ts` 의 done 이벤트 systemHint 분기에서
`planApproveConfirm` 주입 조건을 제거. `turnStalledHint` / `turnCompletedHint` 만
유지. i18n 문자열 자체는 `approveActivePlan` 이 user 메시지로 전송할 때 사용하므로
유지.

#### 9. UX: 에러 버블에 "이어서 진행" 버튼 추가 (2026-04-23)

##### 증상
`ASSISTANT_TOO_MANY_TOOL_CALLS` 에러 발생 시 사용자가 입력창에 "이어서 진행해줘"
를 직접 타이핑해야 복구 가능.

##### 대응
- `continueAfterBudget` action 을 `assistant-store.ts` 에 추가 — `sendMessage`
  래퍼로 locale-aware 메시지 전송.
- `assistant-message.tsx` 에 `RESUMABLE_ERROR_CODES` 집합 (현재 `ASSISTANT_TOO_MANY_TOOL_CALLS`
  1 개) 을 정의, 에러 버블 아래에 "이어서 진행" 버튼 노출. `NO_LLM_CONFIG` /
  `STREAM_FAILED` 는 resume 불가이므로 버튼 없음.
- `assistant-panel.tsx` 가 `onContinueAfterBudget` 콜백을 `AssistantMessageView`
  로 주입해 snapshot 결합 유지 (plan approve 버튼과 동일 패턴).

#### 11. NODE_NOT_FOUND label-lookalike hint (2026-04-24)

##### 증상
LLM 이 `update_node` / `remove_node` / `add_edge` 의 `id` / `source_id` / `target_id`
자리에 사용자에게 보이는 **label** (예: `"SendEmail"`) 을 실수로 넣어
`NODE_NOT_FOUND` 가 연쇄 발생. 이로 인해 config patch 도 전혀 반영 안 되는
2차 증상까지 번짐.

##### 대응 (2-layer)
1. **시스템 프롬프트 강화** (`system-prompt.ts`):
   - Contracts 블록 "Label vs identifier" 섹션에 "Tool arguments: always
     reference a node by its UUID, never by its label" 하위 문단 추가.
     UUID 의 유일한 출처 2가지 (`result.id` / `currentWorkflow.nodes[*].id`)
     명시 + 위반 예 (`update_node({id: "SendEmail"})`) 포함.
   - "Labels are globally unique" 문장에 "유일성은 add_node 충돌 감지용 —
     UUID 대체 근거 아님" 단서 병기.

2. **서버 label-lookalike hint** (`shadow-workflow.ts`):
   - `buildLabelAsIdHint(value)`: shadow 에 `node.label === value` 인 노드가
     있으면 `[hint] Value "<label>" matches the label of an existing node
     (id: <uuid>). ... [/hint]` 형태의 복구 문자열 반환. `findByLabel` 위임으로
     순회 로직 중복 제거. `sanitizeLlmProvidedString` 으로 label 을
     C0+C1+Bidi+zero-width 까지 중화 + `JSON.stringify` 로 escape.
   - `updateNode` / `removeNode`: `NODE_NOT_FOUND` 분기에 바로 hint 부착.
   - `addEdge`: **cascading failed-add_node FIFO 가 먼저**. 비었을 때만
     source 우선 label-lookalike fallback (target 은 source 매치 없을 때만).
     두 힌트가 섞이지 않도록 단일 hint.

##### 호환성·주의
- `ShadowResult.hint` 는 기존부터 optional 필드. 기존 `NODE_NOT_FOUND` 소비자는
  hint 없이도 동일 동작.
- `value.length > LABEL_HINT_MAX_LEN * 4` 는 label 후보에서 제외 (Levenshtein
  유사 방어).
- `[hint] … [/hint]` 마커는 이번부터 label-lookalike 계열에만 적용. 기존
  cascading 힌트 등은 기존 형식 유지.

##### 관련 spec
- `spec/3-workflow-editor/4-ai-assistant.md` §4.4.1 "NODE_NOT_FOUND hint 규칙"
  에 cascading / label-lookalike 의 발동 조건·우선순위·보안 정책 정리.
- §8 "워크플로우 조립 규칙" 행에 "tool argument id 자리 UUID 전용" 한 문장
  추가.

##### 회귀 테스트
`shadow-workflow.spec.ts` → `NODE_NOT_FOUND label-lookalike hint` describe:
- update/remove/add_edge source/target 별 hint 부착
- 양측 label → source 단일 hint
- 공백 전용 id → hint 없음
- cascading FIFO 비어있을 때 label-lookalike fallback 반례
- cascading 우선순위 (FIFO 있으면 cascading hint)
- label sanitisation (newline, `<script>`)

`system-prompt.spec.ts` → "teaches that tool-argument id slots need UUIDs,
never node labels" 로 슬로건 고정 + `result.id` / `nodes[*].id` / "matches the
label of" 매칭.

관련 리뷰: `review/2026-04-24_18-27-09/`.

#### 10. Stall 자동 복구 UX — 메시지 박스 분리 + `auto_resume` SSE 이벤트 (2026-04-24)

##### 배경
§7 의 stall 복구가 발동하면 같은 `assistantText` 에 여러 라운드 텍스트가 누적되어
단일 `WorkflowAssistantMessage` row 로 저장된다. gpt-oss-120b 는 라운드 종료 직전
"계속 진행해도 될까요?" 같은 confirmation 문구를 반복적으로 뱉는 quirk 가 있어,
stall 전·후 라운드의 같은 문구가 한 버블 안에서 2~3번 겹쳐 UX 가 지저분해진다.

##### 대응
**구조적 해결** — 서버가 stall 복구로 추가 라운드를 시작하는 순간, 누적된 텍스트를
별도 row 로 먼저 persist 하고 커서를 리셋한다. 이후 라운드는 새 row 에 누적된다.
프론트에게는 `event: auto_resume` 을 발행해 "새 버블로 분리해 달라" 는 신호를 준다.

**엔티티 변경** — `WorkflowAssistantMessage` 에 3개 필드 추가:
- `autoResumed: boolean` — 이 row 가 복구로 인해 새로 시작된 row 이면 true
- `autoResumeReason: string | null` — 현재 `'stall_pending_steps'` 한 종류
- `autoResumeAttempt: number | null` — 1..MAX_STALL_ROUNDS

마이그레이션 `V020__assistant_message_auto_resume.sql` 로 기본값 false / null 로
기존 row 호환.

**stream.service 변경** — stall 복구 블록 (§7) 에서:
```ts
// 1) 현재까지의 assistant 텍스트를 "중간 row" 로 먼저 persist
await this.persistAssistantTurn(sessionId, assistantText, pendingToolCalls,
  planPersisted ? null : planForTurn, null, 'auto_resume_pending',
  /* resumeMeta */ { autoResumed: false, ... });
if (planForTurn) planPersisted = true;
// 2) 누적 커서 리셋 — 다음 라운드는 새 row
assistantText = ''; pendingToolCalls = [];
// 3) SSE 로 프론트에 신호
yield { event: 'auto_resume', data: { reason, attempt, max } };
// 4) 기존 nudge 주입 + continue
```

턴 종료 시점의 최종 persist 에는 `autoResumed: consecutiveStallRounds > 0` 를 전달.

**`persistAssistantTurn` 시그니처 확장** — 마지막 파라미터로 `resumeMeta` 를 받고
기본값으로 `{autoResumed: false, autoResumeReason: null, autoResumeAttempt: null}`
를 쓴다. 기존 호출부 변경 최소.

**Plan 중복 방지** — 같은 턴 안에 plan 이 최초로 emit 되는 row 에만 plan 을 싣고,
그 뒤로 분리된 row 는 `plan=null` 로 persist. 로컬 `planPersisted` 플래그로 관리.

##### 프론트 변경
- `AssistantSseEvent` union 에 `auto_resume` 추가 (api/assistant.ts)
- `AssistantDisplayMessage` 에 `autoResume?: {reason, attempt, max}` 추가
- `handleSseEvent` 는 그대로 유지하고, `sendMessage` 의 onEvent 콜백에서
  `auto_resume` 이벤트를 가로채 현재 `currentAssistantId` 를 새 UUID 로 갱신하면서
  새 assistant row 를 push.
- `hydrateMessage` 에서 서버의 `autoResumed=true` row 를 `autoResume` 메타로 복원.
- `assistant-message.tsx` 에서 `message.autoResume` 이 있으면 버블 위에 divider
  렌더 ("🔄 자동으로 이어서 진행했어요 (N/M)"). i18n `assistant.autoResumedHint`.

##### 호환성
- 기존 row (autoResumed=false) 는 divider 가 표시되지 않음 → 기존 세션 그대로.
- 정상 턴 (stall 없음): `persistAssistantTurn` 이 한 번만 호출되어 row 1개.
- stall 1회 복구: row 2개 (`auto_resume_pending` + 최종). 최종 row 에만 autoResumed=true.
- stall 2회: row 3개. 최종 row 에 autoResumedAttempt=2.
- `MAX_STALL_ROUNDS` 상한에 걸려 포기하는 경우: 마지막 row 도 autoResumed=true 로
  persist (포기 직전 "이어서 진행해줘" 가 주입되지 않았지만 텍스트가 새 버블로
  분리되는 것은 동일하게 유지 — 서버가 분리 persist 를 이미 수행했음).

##### 회귀 테스트
`stream.service.spec.ts` "auto-continue on stall with pending plan" describe 의
기존 3개 테스트에 다음 어서션 추가:
- `appendMessage` 호출 횟수가 (stall N회) + 1 개 (최종) 임을 확인.
- N+1 개 row 중 중간 row 들은 `finishReason='auto_resume_pending'`, `autoResumed=false`.
- 최종 row 는 `autoResumed=true`, `autoResumeReason='stall_pending_steps'`,
  `autoResumeAttempt=N`.
- SSE 이벤트 스트림에 `event: 'auto_resume'` 이 N회 포함, attempt 가 1..N 순증.
- plan 은 최초 emit 된 row 에만 실리고 이후 row 들의 plan=null.

`assistant-store.test.ts` — `auto_resume` 이벤트 수신 시 messages 배열에 새 row 가
추가되고 `streamingMessageId` 가 갱신되며, `autoResume` 메타가 세팅되는지 검증.

#### 유지보수 체크리스트

- `stripHarmonyTokens` 추가 제어 토큰 관찰 시 `HARMONY_STANDALONE_TOKEN_REGEX` 유니온에 추가.
- `NODE_TYPE_ALIASES` 에 새 alias 추가 시 `shadow-workflow.spec.ts` it.each 케이스에도 추가.
- Review skip 조건 변경 시 `system-prompt.ts` Self-review 섹션 문구 동기화.
- Error UI 스타일 변경 시 systemHint 와 스타일 일관성 유지 (dark/light 모두 950/50 대비 규약).
- Plan-only 가드 (`planProposedPendingApproval`) 의 단락 조건 변경 시 위 "호환성" 3개 시나리오
  모두 회귀 테스트로 고정되어 있는지 확인. `stream.service.spec.ts` 에서 `finishReason=stop`
- `MAX_STALL_ROUNDS` / stall 가드 조건 변경 시: "auto-continue on stall with pending plan"
  describe 의 3 테스트 (auto-nudge / max-stall / no-pending-steps) 동시 업데이트 +
  §10 의 row 분리 / auto_resume 이벤트 어서션도 같이 업데이트.
- `auto_resume` SSE event schema 변경 시: backend `AssistantStreamEvent` union,
  frontend `AssistantSseEvent` union, controller 가 단순 JSON.stringify 하므로
  별도 DTO 없음. `assistant.autoResumedHint` i18n 포맷 (`{{attempt}}/{{max}}`) 도
  페이로드 shape 에 묶여있으니 payload key 이름 변경 시 placeholder 동시 업데이트.
- `WorkflowAssistantMessage` 에 신규 필드 추가 시: migration SQL 과 entity 의
  nullable/default 가 일치해야 한다 (autoResumed default false, 나머지 null).
  `appendMessage` 의 `Partial<WorkflowAssistantMessage>` 수용 패턴 덕분에 서비스
  계층 호출부 변경은 불필요.
- `RESUMABLE_ERROR_CODES` 에 새 에러 코드 추가 시: (1) backend 가 실제로 해당 코드 발행하는지
  확인, (2) "이어서 진행해줘" follow-up 이 의미있는 복구인지 재검토, (3) `continueAfterBudget`
  대신 별도 resume 액션이 필요한지 판단.
  을 기대하는 기존 플래닝 관련 테스트들이 이 가드에 의해 영향받지 않아야 한다.

_원본 메모: memory/workflow-assistant-candidate-picker.md_

### Workflow Assistant — Candidate Picker 정책 결정 (2026-04-24)

#### 배경

2026-04-24 사용자 피드백: "메일전송 노드에 SMTP integration 을 설정해야 하는데, 설정된 항목이 있음에도 스스로 하지를 못해". 기존 정책은 시스템 프롬프트로 `integration-selector` 등 user-action widget 의 id 주입을 **명시적으로 금지** 했고, `PENDING_USER_CONFIG_UNMENTIONED` 리뷰 가드가 "마무리 메시지에 사용자 설정 안내" 를 강제하는 구조였다. 결과적으로 Assistant 는 워크스페이스에 단일 SMTP integration 이 있어도 자동 연결하지 않고 사용자에게 수동 설정을 미뤘다.

#### 최종 정책 (ED-AI-39)

**"설정 가능한 항목이 존재하면 사용자에게 명시적 확인 후 주입, 없으면 기존 안내 유지"** — 방향 B 채택:

- 백엔드 `add_node` / `update_node` 성공 응답의 `pendingUserConfig[i]` 에 **워크스페이스 후보 목록 (`candidates: CandidateEntry[]`)** 을 실어 프런트에 전달.
- 프런트는 해당 edit 버블 아래에 드롭다운 picker 렌더. 사용자 Confirm 클릭 시 `editor-store.updateNode` 로 즉시 반영 (LLM 경유 없음).
- 후보 0개: amber 안내 박스 + Settings 딥링크. 기존 수동 설정 경로 유지.
- 후보 1개도 자동 선택 금지 — 단일 option 드롭다운으로 사용자 확인 필수.
- 적용 scope: 4종 widget 전체 (`integration-selector` · `llm-config-selector` · `kb-selector` · `workflow-selector`).

#### 문서 변경 지도

| 문서 | 섹션 | 변경 요점 |
|------|------|-----------|
| `prd/2-workflow-editor.md` | §10.4 | `ED-AI-39` 신규 — 명시적 확인 + picker UX 의무. |
| `spec/3-workflow-editor/4-ai-assistant.md` | §3.2 | "Candidate picker" 행 추가. |
| | §3.3 | picker 접근성(aria, 키보드) 규정. |
| | §4.3 | 편집 도구 반환 shape 에 `pendingUserConfig?` 명시. |
| | §4.3.1 (신규) | `PendingUserConfigField` / `CandidateEntry` 타입, widget별 조회 범위·상한(20), 프런트 동작, LLM 계약. |
| | §5.3.1 | tool_call.data.result 설명에 `pendingUserConfig` 언급. |
| | §6.0 | rehydrate 시 canvas 현재 값 vs picker 상태 판정 규칙. |
| | §8 | "Selector 필드 정책" 행 추가 — LLM 은 id 빈 값 제출, closing mention 은 candidate 0 case 에만. |
| | §10 | `WORKFLOW_REVIEW_REQUIRED` 행에 `PENDING_USER_CONFIG_UNMENTIONED` 는 candidate 0 에만 발동함을 명시. |
| | §13 | `candidatePicker*` i18n 5키 추가. |
| | §14 | ED-AI-39 매핑. |

#### 구현자가 기억해야 할 계약 (요약)

1. **서버**: `collectPendingUserConfig` 는 기존처럼 schema 를 훑어 비어있는 selector 필드를 수집하되, 추가로 widget 별 저장소(integrationRepo / llmConfigRepo / kbRepo / workflowRepo) 를 워크스페이스 스코프로 쿼리해 `candidates` 를 채운다. 상한 20, connected/최근 등 정렬 규칙은 §4.3.1 표 그대로.
2. **LLM 프롬프트**: §8 "Selector 필드 정책" 행을 `STATIC_BLOCK_3_EDIT_PLAYBOOK` 에 투영. 기존 "You must NOT fill ... surface them in the closing message" 를 "Leave ids empty; server attaches candidates; mention only when candidates list is empty" 로 교체.
3. **Review guard**: `collectUnmentionedPendingUserConfig` 는 `candidates?.length === 0` 인 항목에 대해서만 missingFields 로 카운트. 후보가 1+ 인 항목은 guard 에서 제외.
4. **프런트 렌더**: `AssistantMessageView` 의 tool_call badge 그룹 아래, error bubble 이나 systemHint 보다 **위**에 picker 블록 배치. Confirm 시 `editor-store.updateNode(nodeId, { config: { [field]: selectedId } })` 호출. 이후 picker 는 "✓ 설정됨" 으로 고정 (Undo 로도 picker 상태를 되돌리지 않는다 — UX 복잡도 대비 실익 낮음).
5. **Rehydrate**: `hydrateMessage` 에서 `tool_calls[*].result.pendingUserConfig` 를 읽고, 해당 노드의 현재 canvas 값이 채워져 있으면 "✓ 설정됨", 비어있으면 interactive picker 로 복원. 판정은 editor-store 의 현재 노드 config 에서 `field` 경로를 dot-path 로 읽어 비교.

#### Out of scope (후속)

- Plan 카드 안 picker 통합 UI (현재는 edit 버블 전용).
- Picker 에서 "후보 인라인 등록 (Integration 등록 폼 임베드)" — 현재는 Settings 딥링크.
- Tool-area 노드의 `toolOwnerId` — user-action widget 이 아니라 이번 정책 대상이 아님.
- UI 컴포넌트 테스트 (RTL 환경 미도입).

#### 관련 메모

- *workflow-assistant-provider-quirks-and-review-always.md (본 Rationale 섹션 내)* — 기존 `PENDING_USER_CONFIG_UNMENTIONED` 동작 원본. 본 정책으로 "candidate 0 only" 로 축소됨을 인지.
- *workflow-ai-assistant-decisions.md (본 Rationale 섹션 내)* — Assistant 초기 설계 결정.

#### 실행 계획 (Spec 밖, 구현용)

구현은 `developer` skill 에서 수행. PRD/Spec 업데이트 완료했으므로 다음 단계:

1. Backend: `detect-pending-user-config.ts` 에 widget → repo 매핑 추가. `explore-tools.service` 의 로직 재사용 또는 새 `CandidateLookupService` 를 경유해 per-widget 조회.
2. Backend: `system-prompt.ts` 의 `STATIC_BLOCK_3_EDIT_PLAYBOOK` Selector 정책 블록 교체.
3. Backend: `review-workflow.ts` 의 `collectUnmentionedPendingUserConfig` 를 candidate 0 조건으로 좁힘.
4. Frontend: `assistant-store.ts` 에 picker state / confirm action / rehydrate 판정 추가. `assistant-message.tsx` 에 picker 컴포넌트 삽입.
5. i18n ko/en 사전 5키 추가.
6. 테스트: stream.service.spec 의 pendingUserConfig 기존 케이스를 candidates 포함으로 확장 + 새 review guard 완화 케이스 + frontend store 의 picker 상태 전이 테스트.

_원본 메모: memory/workflow-assistant-execution-tools-decisions.md_

### Workflow AI Assistant — 실행 조회 도구(get_workflow_executions / get_execution_details) 기획 결정 메모

사용자가 어시스턴트의 실행 결과 조회 기능 추가를 요청(2026-04-24)해 project-planner 역할에서 스펙을 확정했다. 배경은 어시스턴트가 자동 생성한 표현식이 분기 `null`로 터졌던 이슈에서 출발 — 어시스턴트가 실행 결과를 읽고 원인을 진단·수정할 수 있어야 유사 실수의 셀프 복구가 가능하다는 사용자 의도.

#### 확정된 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 도구 수 | 2종 (`get_workflow_executions`, `get_execution_details`) | 기존 탐색 도구 6종과 동일 패턴. list→detail 2-step 으로 토큰 경제성 확보 |
| 스코프 | 현재 세션 워크플로의 실행 + 그 실행 트리의 **직계 자식 실행(depth 1)** | 유저의 "sub-workflow node에서 실행된건 1이야 2야?" 질문에 대한 답 — 실행 트리 관점으로 해석. 2 단계 이상 중첩은 별도 호출로 분리해 응답 부피 제어 |
| 민감 필드 마스킹 | `maskSensitiveFields` 공통 유틸 재귀 적용 (apiKey/token/password/secret/authorization/...). 원본은 DB 에 그대로 남김 | 채팅 창에 그대로 렌더되므로 최소 안전 기본값 필수. 기존 유틸 재사용 |
| 페이로드 크기 제한 | **없음** (마스킹만) | 사용자 명시 선택. 대신 2-step 패턴(list → 특정 id detail) 을 프롬프트가 강제 |
| Running/waiting 실행 조회 | 허용 — 현재까지 기록된 부분 타임라인 반환 | §12.2의 "실행 중 편집 도구 거부" 는 read 에 적용하지 않음. 실시간 디버깅 UX |
| 세션 스코프 키 | `session.workflow_id` 에서 자동 유도 — 인자로 `workflowId` 받지 않음 | scope 경계 명확화, LLM 의 잘못된 workflowId 추정 방지 |
| 도구 kind | `'explore'` (read-only) — plan-only 턴에서도 사용 가능, 실행 중 거부 규약 미적용 | 일관성 |

#### 응답 envelope (spec §4.1.1 참조)

```
ExecutionDetailsResponse {
  ok: true,
  execution: { id, workflowId, workflowName, status, startedAt, finishedAt, durationMs,
               inputData(masked), outputData(masked), error(masked),
               parentExecutionId, recursionDepth },
  timeline: [{ nodeExecutionId, nodeId, nodeLabel, nodeType, status,
               startedAt, finishedAt, durationMs,
               inputData(masked), outputData(masked), error(masked),
               retryCount, parentNodeExecutionId }],
  subExecutions: [{ execution, timeline }],   // depth 1
  subExecutionsTruncatedDepth?: number        // 추가 depth 생략 신호
}
```

에러 코드:
- `EXECUTION_NOT_FOUND` — id 없음 or workspace 밖
- `EXECUTION_NOT_IN_SCOPE` — id 는 있지만 현재 세션 워크플로의 실행/직계 자식이 아님

#### 구현 단계에서 유의 사항 (실제 구현 반영)

1. **Repository 직접 주입으로 전환.** 기획 단계에서는 `executions.service.ts` 의 `findById` / `findByWorkflow` 를 어댑터로 감쌀 계획이었으나, 구현 시 다음 이유로 Repository 를 직접 주입했다: (a) `ExecutionsService.findById` 는 `NotFoundException` (Nest HTTP exception) 을 던져 tool-result envelope `{ok: false, error}` 와 맞지 않음. (b) `findByWorkflow` 는 컨트롤러용 DTO 래퍼(`PaginatedResponseDto`) 를 반환해 LLM 응답에는 오버스펙. (c) 기존 `listWorkflows`/`listIntegrations` 도 동일한 Repository 직접 주입 패턴. 향후 `ExecutionsService` 에 RBAC 같은 cross-cutting 규칙이 들어가면 그때 서비스 주입으로 전환한다 — `explore-tools.service.ts` 클래스 상단 주석에 이 trade-off 명시.
2. **스코프 검증.** `get_execution_details` 는 다음 순서로 허용 여부 판정:
   a. `executions.findById(id)` — 없으면 `EXECUTION_NOT_FOUND`.
   b. `execution.workflowId === session.workflowId` 면 통과.
   c. 그렇지 않으면 `execution.parentExecutionId` 가 가리키는 부모를 한 번 조회해 `parent.workflowId === session.workflowId` 면 통과.
   d. 둘 다 아니면 `EXECUTION_NOT_IN_SCOPE`. (workspace 경계 체크는 `execution.workflow.workspaceId === session.workspaceId` 로 별도 수행 → 없으면 `EXECUTION_NOT_FOUND` 와 동일 취급으로 information leak 방지.)
3. **sub-workflow 확장.** 통과한 `execution` 에 대해 `executions.repo.find({ where: { parentExecutionId: execution.id } })` 로 직계 자식 목록을 조회, 각각에 대해 `findById` 를 불러 `subExecutions` 채움. 2-depth 이상은 자식 실행의 `subExecutions` 를 채우지 않고 `subExecutionsTruncatedDepth: 1` 를 세팅. 자식 실행의 `nodeExecutions.length > 0` 이면 이미 내부에 sub-workflow 가 존재한다는 힌트 — `subExecutionsTruncatedDepth` 는 자식 한 건이라도 2-depth 자손이 있으면 발행.
4. **마스킹 구현.** `backend/src/common/utils/mask-sensitive-fields.util.ts` 재사용. 응답 직렬화 직전에 `inputData`/`outputData`/`error` 필드를 각각 한 번씩 통과시킴. 원본 DB row 는 건드리지 않음.
5. **tool kind 분류.** `tool-definitions.ts:15-30` 의 `TOOL_KIND_BY_NAME` 에 두 이름을 `'explore'` 로 추가.
6. **dispatch 추가.** `workflow-assistant-stream.service.ts` 의 `handleExploreCall()` switch 에 두 case 추가.
7. **시스템 프롬프트 갱신.** `system-prompt.ts` 에 "실

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
