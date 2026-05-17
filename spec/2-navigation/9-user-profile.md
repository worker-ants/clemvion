# Spec: 사용자 프로필/설정 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#311-user-profile-사용자-프로필) · [Spec 레이아웃](./_layout.md) · [Spec 인증/인가](../5-system/1-auth.md) · [데이터 모델 - User](../1-data-model.md#21-user) · [데이터 모델 - Workspace](../1-data-model.md#22-workspace)

---

## 1. 사이드바 사용자 영역

### 1.1 표시 요소
- 사용자 아바타 (이미지 또는 이름 이니셜)
- 사용자 이름
- 현재 워크스페이스 이름 (작은 텍스트)

### 1.2 클릭 시 팝업

```
┌──────────────────────────┐
│  Gehrig Kim               │
│  gehrig@example.com       │
│  ─────────────────────── │
│  📋 내 프로필             │
│  ─────────────────────── │
│  Workspace                │
│    ● Personal (현재)      │
│    ○ Team Alpha           │
│    ○ Team Beta            │
│    + 새 워크스페이스       │
│  ─────────────────────── │
│  ⚙ 워크스페이스 관리      │
│  🔔 알림 설정             │
│  🌗 다크 모드             │
│  ─────────────────────── │
│  🚪 로그아웃              │
└──────────────────────────┘
```

---

## 2. 내 프로필 화면

`/profile` 은 디폴트 **readonly 표시 화면**이다. 사용자 정보·환경설정·비밀번호·보안(2FA/세션) 을 한 페이지에서 조회하되, 편집은 각 항목의 위험 수준에 비례한 별개 인터랙션으로 분리한다. 단일 [Save] 버튼이 이질적 변경(개인정보·자격증명·환경설정) 을 한 번에 커밋하는 패턴은 사용하지 않는다.

```
/profile  (디폴트 readonly)
┌──────────────────────────────────────────────────────────────┐
│  내 프로필                                                    │
│                                                              │
│  ┌──────┐  사용자 정보                          [편집]        │
│  │Avatar│    Name:   Gehrig Kim                              │
│  └──────┘    Email:  gehrig@example.com  (변경 불가, 별도)    │
│                                                              │
│  ── 비밀번호 ──                                               │
│    현재 비밀번호 확인이 필요합니다           [변경하기 →]     │
│                                                              │
│  ── 환경설정 ──                                 [편집]        │
│    Language: Korean        Theme: Light                      │
│                                                              │
│  ── 보안 ──                                                   │
│    [ 2FA 설정 →   ]   [ 활성 세션·로그인 이력 → ]            │
└──────────────────────────────────────────────────────────────┘
```

### 2.0 편집 흐름

| 편집 방식 | 사용 항목 | 동작 |
|-----------|-----------|------|
| **인라인 토글** | 사용자 정보(아바타·이름), 환경설정(언어·테마) | 카드 우상단 [편집] → 해당 카드만 input 활성 + [취소]/[저장]. 저장 클릭 시 **변경 전·후 diff 확인 모달**("이전: A → 새: B") 한 단계를 거친 뒤 PATCH 실행. 다른 카드는 readonly 유지. 환경설정의 테마 라이브 프리뷰는 **편집 모드 동안 로컬 임시 state** 로 격리되어 [취소] / 모달 닫힘 시 항상 원복된다 |
| **전용 페이지(sub-route)** | 비밀번호 | `/profile/change-password` 로 이동. 페이지 진입 자체가 "지금 비밀번호를 변경하려는 의도" 의 표명 역할. 자세한 폼은 §2.2 참조 |
| **별도 프로세스** | 이메일 | 본 화면에서는 readonly 표시만. 변경은 확인 메일 발송 플로우로 분리 (현 단계 미구현) |
| **별도 sub-route** | 2FA, 활성 세션·로그인 이력 | 보안 카드의 Link 로 `/profile/security`, `/profile/sessions` 진입 |

```
/profile/change-password
┌──────────────────────────────────────────────────────────────┐
│  비밀번호 변경                                                │
│  현재 비밀번호 확인 후 새 비밀번호를 설정합니다              │
│                                                              │
│    Current password:  [_______________]                      │
│    New password:      [_______________]                      │
│    Confirm password:  [_______________]                      │
│                                                              │
│                           [취소]   [변경]                    │
└──────────────────────────────────────────────────────────────┘
```

비밀번호 변경 페이지는 diff 미리보기 모달을 생략한다(마스킹된 값이라 무의미). currentPassword 가 1차 인증 역할을 한다. 성공 시 `/profile` 로 리다이렉트 + 성공 토스트.

### 2.1 프로필 필드

| 필드 | 편집 가능 | 편집 방식 | 설명 |
|------|-----------|-----------|------|
| 아바타 | O | 인라인 토글 | 이미지 업로드 또는 제거 |
| 이름 | O | 인라인 토글 | 표시 이름 |
| 이메일 | X (별도 변경) | 별도 프로세스 | 이메일 변경 시 확인 메일 발송 플로우 |
| 언어 | O | 인라인 토글 | UI 언어 (ko, en) |
| 테마 | O | 인라인 토글 (라이브 프리뷰는 임시 state 로 격리) | Light / Dark / System |
| 비밀번호 | O | 전용 페이지 `/profile/change-password` | 현재 비밀번호 확인 → 새 비밀번호 입력 |

### 2.2 보안 설정

| 항목 | 설명 |
|------|------|
| 비밀번호 변경 | 전용 페이지 `/profile/change-password` — 현재 비밀번호 확인 → 새 비밀번호 입력. `/profile` 본문의 비밀번호 카드에서 [변경하기 →] 링크로 진입. 페이지 진입 자체가 의도 표명 역할 |
| 2FA 설정 | TOTP 기반. `/profile/security` 페이지. QR 코드 표시 → 인증 앱으로 스캔 → 확인 코드 입력 |
| 활성 세션 | `/profile/sessions` 페이지. 현재 로그인된 기기/브라우저 목록(family 단위), "현재" 세션 배지 표시. 다른 세션 개별 종료 또는 일괄 종료 (비밀번호 재확인 필수). 상세: [인증 spec §2.3](../5-system/1-auth.md#23-세션-정책) |
| 로그인 이력 | `/profile/sessions` 페이지의 이력 탭. 성공·실패·강제 종료 등 이벤트를 시간순으로 표시 (본인만 조회). 보존 180일. 상세: [인증 spec §4.3](../5-system/1-auth.md#43-로그인-이력-loginhistory) |

---

## 3. 워크스페이스 전환

- 팝업 메뉴에서 워크스페이스 선택 시 즉시 전환
- 전환 시 URL 경로에 워크스페이스 슬러그 반영 (예: `/w/team-alpha/workflows`)
- 선택된 워크스페이스에 따라 사이드바 메뉴의 데이터 범위 변경

---

## 4. 워크스페이스 관리 화면 (멤버 공통 · 권한에 따라 탭·액션 제한)

`/workspace/settings` 한 페이지가 세 개의 탭(개요 · 멤버 · 위험 영역)으로 구성된다. 페이지 헤더에는 현재 워크스페이스의 타입 아이콘(개인=👤, 팀=👥)과 이름, 한 줄 설명이 표시되어 "지금 무엇을 관리하는지"를 즉시 알 수 있다.

```
┌──────────────────────────────────────────────────────────────┐
│  👥 Team Alpha                                               │
│  멤버와 함께 협업하는 공간이에요                              │
│                                                              │
│  [개요]  [멤버]  [위험 영역]                                 │
│  ────────────────────────────────────────────────────────── │
│                                                              │
│  ── 개요 탭 ──                                                │
│  Name:  [Team Alpha_______]          (Admin+: 편집 가능)     │
│  Slug:  team-alpha                   (읽기 전용)             │
│  Type:  [팀 워크스페이스]            Role:  [Owner]           │
│                                                              │
│  ── 멤버 탭 (팀 워크스페이스 전용) ──                         │
│  🟣 Owner 모든 권한 · 🔵 Admin 멤버 관리                     │
│  🟢 Editor 워크플로 편집 · ⚪ Viewer 읽기만                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 멤버 초대하기: [email@...] [Role ▼] [초대]              ││
│  │ 대기 중인 초대: new@... (Editor, 만료 2026-05-01)  [취소]││
│  │ 현재 멤버:                                              ││
│  │ Gehrig  gehrig@...  Owner                               ││
│  │ Jane    jane@...    [Admin ▼]                  [🗑]    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ── 위험 영역 탭 ──                                           │
│  [워크스페이스 나가기]   (owner가 아닌 모든 멤버)             │
│  [Owner 이양]            (owner만, 새 owner 이메일 재입력 확인) │
│  [워크스페이스 삭제]     (owner만, 이름 재입력 확인 필수)     │
└──────────────────────────────────────────────────────────────┘
```

### 4.1 멤버 관리

| 액션 | 권한 | 설명 |
|------|------|------|
| 초대 | Admin+ | 이메일로 초대 토큰 발송. 수신자는 수락 페이지에서 합류. 토큰·만료·이메일 일치 정책은 §4.1.1 참고 |
| 초대 재발송 | Admin+ | 대기 중 초대의 토큰을 새로 발급(기존 토큰 invalidate)하고 이메일 재전송. 만료 시계도 재발급 시점부터 다시 7일 |
| 초대 취소 | Admin+ | 대기 중인 초대 토큰 폐기 (`acceptedAt IS NULL` 인 row 만) |
| 역할 변경 | Admin+ (Owner 역할 부여/박탈은 별도 양도 흐름) | 드롭다운으로 역할 변경 |
| 제거 | Admin+ | 멤버 제거 (확인 다이얼로그) |
| 나가기 | 본인 | 자가 탈퇴. 유일한 owner는 차단 — 먼저 다른 owner를 지정하거나 삭제로 이동 |
| 워크스페이스 삭제 | Owner | 이름 재입력 확인 → 멤버·초대·워크스페이스 순으로 트랜잭션 삭제 |
| Owner 이양 | Owner | 같은 워크스페이스의 비-owner 멤버 중 한 명을 선택. 새 owner 의 이메일을 재입력 확인 → 트랜잭션 내에서 두 멤버 role 동시 swap (대상 → owner, 기존 owner → admin) + `workspace.ownerId` 동기화 |

#### 4.1.1 초대 토큰 정책

| 항목 | 값 |
|------|-----|
| 토큰 길이 | 64자 url-safe random (`crypto.randomBytes(48)` base64url 인코딩) |
| 만료 | 발급 시점부터 **7일** |
| 사용 횟수 | **1회 사용** — accept 또는 재발송 시 즉시 invalidate |
| 이메일 일치 검증 | accept 시 **로그인 사용자 이메일 = 토큰의 초대 이메일** 강제. 불일치 시 400 (`invitation_email_mismatch`) |
| 가입 흐름 | 미가입자는 `?invitationToken=...` 쿼리로 회원가입 페이지 진입. 이메일이 prefill + readOnly 로 고정되어 다른 이메일로 가입 자체가 불가. 가입 성공 트랜잭션 내에서 자동 accept |
| 발송 채널 | 시스템 SMTP (`codebase/backend/src/modules/mail/`). 워크스페이스 SMTP Integration 은 사용하지 않음 |
| 대기 중 초대 UI | 만료일 표시 + [재발송] / [취소] 액션. 대기 중 한 이메일에 대해 다중 초대 누적 금지 — 같은 이메일로 다시 초대 시 기존 토큰을 무효화하고 신규 발급 |

상세 흐름·API 는 [Spec 인증/인가 §1.5](../5-system/1-auth.md#15-초대-토큰-흐름) 참고.

### 4.2 역할 권한 매트릭스

| 기능 | Owner | Admin | Editor | Viewer |
|------|-------|-------|--------|--------|
| 워크플로우 생성/수정/삭제 | ✅ | ✅ | ✅ | ❌ |
| 워크플로우 조회 | ✅ | ✅ | ✅ | ✅ |
| 워크플로우 실행 | ✅ | ✅ | ✅ | ❌ |
| Integration 생성 (Org) | ✅ | ✅ | ❌ | ❌ |
| 멤버 관리 | ✅ | ✅ | ❌ | ❌ |
| 워크스페이스 설정 | ✅ | ✅ | ❌ | ❌ |
| Admin 역할 부여 | ✅ | ❌ | ❌ | ❌ |
| 워크스페이스 삭제 | ✅ | ❌ | ❌ | ❌ |

---

## 5. 알림 설정

### 5.1 알림 유형별 채널

| 항목 | 기본 채널 | 사용자 변경 가능 |
|------|-----------|-----------------|
| 워크플로우 실행 실패 | 인앱 + 이메일 | O (채널별 on/off) |
| 스케줄 실행 실패 | 인앱 + 이메일 | O |
| Integration 만료 | 인앱 + 이메일 | O |
| 마켓플레이스 업데이트 | 인앱 | O |
| 팀 초대 | 인앱 + 이메일 | X (항상 발송) |

### 5.2 알림 센터 (벨 아이콘 클릭 시)

```
┌──────────────────────────────┐
│  Notifications          Mark all read │
│  ─────────────────────────── │
│  🔴 Workflow "Order Bot" failed       │
│     2 minutes ago                      │
│  ─────────────────────────── │
│  🟡 Google integration expired        │
│     1 hour ago                         │
│  ─────────────────────────── │
│  🔵 Team Alpha invited you            │
│     3 hours ago                        │
│  ─────────────────────────── │
│  View all notifications →            │
└──────────────────────────────┘
```

| 기능 | 설명 |
|------|------|
| 미읽은 알림 수 | 벨 아이콘에 뱃지로 표시 (최대 99+) |
| 알림 클릭 | 관련 리소스로 이동 (워크플로우, Integration 등) |
| 전체 읽음 | "Mark all read" 버튼 |
| 알림 목록 | 최근 알림 드롭다운 (최대 10개) + "View all" 링크 |
| 전체 알림 페이지 | 필터(유형, 읽음/미읽음), 페이지네이션 |

### 5.3 이메일 알림

| 항목 | 설명 |
|------|------|
| 즉시 발송 | 실행 실패, Integration 만료, 팀 초대 |
| 일일 요약 | 하루 동안의 실패 요약 (설정 가능) |
| 수신 거부 | 이메일 하단 unsubscribe 링크 |

---

## 6. API

### 6.1 사용자/워크스페이스 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/users/me | 내 프로필 조회 |
| PATCH | /api/users/me | 프로필 수정 |
| POST | /api/users/me/avatar | 아바타 업로드 |
| POST | /api/users/me/change-password | 비밀번호 변경 |
| POST | /api/users/me/enable-2fa | 2FA 활성화 시작 |
| POST | /api/users/me/confirm-2fa | 2FA 확인 코드 검증 |
| GET | /api/users/me/sessions | 활성 세션 목록 (family 단위, isCurrent 플래그 포함) |
| DELETE | /api/users/me/sessions/:familyId | 단일 세션 강제 종료 (family 전체 revoke, 비밀번호/TOTP 재인증) |
| POST | /api/users/me/sessions/revoke-others | 현재 세션 제외 일괄 종료 (비밀번호/TOTP 재인증) |
| GET | /api/users/me/login-history | 본인 로그인 이력 (커서 페이징, 180일 보존) |
| GET | /api/workspaces | 내 워크스페이스 목록 |
| POST | /api/workspaces | 팀 워크스페이스 생성 (요청자가 owner) |
| PATCH | /api/workspaces/:id | 워크스페이스 이름 변경 (Admin+) |
| DELETE | /api/workspaces/:id | 워크스페이스 삭제 (Owner, team 전용, 트랜잭션) |
| POST | /api/workspaces/:id/leave | 자가 탈퇴 (본인, 유일한 owner는 차단) |
| POST | /api/workspaces/:id/transfer-ownership | Owner 이양 (현재 owner 만, 대상은 비-owner 멤버, 트랜잭션 내 role swap + ownerId 동기화) |
| GET | /api/workspaces/:id/members | 멤버 목록 |
| POST | /api/workspaces/:id/members | 이메일로 기존 가입자 즉시 추가 (Admin+) |
| PATCH | /api/workspaces/:id/members/:memberId | 역할 변경 (Admin+) |
| DELETE | /api/workspaces/:id/members/:memberId | 멤버 제거 (Admin+ / 자가 탈퇴 시 leave로 위임) |
| GET | /api/workspaces/:id/invitations | 대기 중인 초대 목록 (Admin+) |
| POST | /api/workspaces/:id/invitations | 미가입자 초대 토큰 발송 (Admin+). 같은 이메일에 대기 중 초대가 있으면 기존 토큰 invalidate 후 신규 발급 |
| POST | /api/workspaces/:id/invitations/:invitationId/resend | 초대 재발송 (Admin+). 기존 토큰 invalidate + 신규 토큰 발급 + 만료 시계 재시작 |
| DELETE | /api/workspaces/:id/invitations/:invitationId | 초대 취소 (Admin+, `acceptedAt IS NULL` 만 허용) |
| GET | /api/invitations/:token | 초대 토큰 메타 조회 (인증 불요, 가입 페이지 prefill 용). 워크스페이스 이름·초대자 이름·이메일·만료 응답. 만료·invalidated 토큰은 410 |
| POST | /api/workspaces/invitations/accept | 초대 수락 (로그인 필수, 본인 이메일 = 토큰 이메일 강제) |

### 6.2 알림 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/notifications | 알림 목록 (쿼리: type, is_read, page, limit) |
| GET | /api/notifications/unread-count | 미읽은 알림 수 |
| PATCH | /api/notifications/:id/read | 알림 읽음 처리 |
| POST | /api/notifications/mark-all-read | 전체 읽음 처리 |
| GET | /api/notifications/settings | 알림 설정 조회 |
| PATCH | /api/notifications/settings | 알림 설정 수정 |

---

## Rationale

### `/profile` 편집 인터랙션의 분리 (§2)

초기 와이어프레임은 사용자 정보·환경설정·비밀번호 변경을 한 페이지의 폼으로 묶고 하단 단일 `[Save Changes]` 버튼으로 모두 커밋하는 형태였다. 다음과 같은 footgun 이 식별되어 현재의 하이브리드 편집 패턴(인라인 토글 + sub-route + diff 확인 모달) 으로 개정했다.

- **이질적 변경의 의도 충돌** — 자격증명(비밀번호)·개인정보(이름·아바타)·환경설정(언어·테마) 은 위험 수준이 서로 다른데도 한 번의 클릭이 모두를 동시에 PATCH 하는 구조였다. 사용자 의도와 실제 결과가 어긋날 가능성이 컸다.
- **무방비 편집 활성화** — 모든 input 이 디폴트로 활성화되어 있어 단순 탐색 중에도 실수 입력이 그대로 저장 대상이 되었다.
- **세션 강제 종료 패턴과의 톤 불일치** — `/profile/sessions` 의 강제 종료는 이미 `RevokeConfirmDialog`(password/TOTP 재인증) 로 명시적 의도를 분리해 안전하게 운영 중인데, 같은 영역의 다른 민감 동작은 그 톤을 따르지 못하고 있었다.

해법으로 (a) `/profile` 을 디폴트 readonly 로 두고 카드 단위 [편집] 토글로 의도를 분리, (b) 저위험 항목(이름·환경설정) 도 저장 직전 변경 전·후 diff 확인 모달을 한 단계 거치게 해 실수 방지, (c) 고위험 항목(비밀번호) 은 별도 sub-route 진입 자체가 의도 표명 역할을 하도록 채택했다. 이메일은 기존 결정대로 "별도 변경 (확인 메일)" 으로 본 화면에서 분리한 상태를 유지한다.

폐기된 대안:

- **모달 일원화** — 모든 편집을 모달로 처리(인라인 토글 없음). 환경설정처럼 자주 만지는 항목까지 매번 모달이 떠야 해 마찰이 과도하다고 판단.
- **전 항목 sub-route** — 환경설정·이름까지 모두 별도 라우트로 분리. 라우팅·뒤로가기 비용이 가치 대비 과도. 위험 수준에 비례한 마찰이 더 합리적.
- **단일 페이지 + 섹션별 Save 버튼** — 폼은 그대로 두고 Save 만 섹션 단위로 쪼개기. "폼이 디폴트로 노출되어 무방비" 라는 핵심 문제를 해결하지 못함.
