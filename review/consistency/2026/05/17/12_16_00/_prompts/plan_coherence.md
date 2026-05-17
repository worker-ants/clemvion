# Plan 정합성 Check Payload

본 파일은 orchestrator 가 Plan 정합성 checker 용으로 작성한 입력입니다. `plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Plan 정합성)

1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)

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

## 진행 중 plan 문서 모음 (plan/in-progress/)

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
