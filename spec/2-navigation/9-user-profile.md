# Spec: 사용자 프로필/설정 화면

> 관련 문서: [PRD 내비게이션](../../prd/1-navigation.md#310-user-profile) · [Spec 레이아웃](./0-layout.md) · [Spec 인증/인가](../5-system/1-auth.md) · [데이터 모델 - User](../1-data-model.md#21-user) · [데이터 모델 - Workspace](../1-data-model.md#22-workspace)

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
│  📋 프로필 편집           │
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

## 2. 프로필 편집 화면

```
┌──────────────────────────────────────────────────────────────┐
│  Profile Settings                                            │
│                                                              │
│  ┌──────┐                                                    │
│  │Avatar│  [Change Photo]                                    │
│  └──────┘                                                    │
│                                                              │
│  Name:     [____________]                                    │
│  Email:    gehrig@example.com (변경 불가, 별도 프로세스)      │
│  Language: [Korean ▼]                                        │
│  Theme:    [Light ▼]                                         │
│                                                              │
│  ── Security ──                                              │
│  Password:       [Change Password]                           │
│  2FA:            [Enable] / Enabled ✅                       │
│  Sessions:       [View Active Sessions]                      │
│                                                              │
│                              [Save Changes]                  │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 프로필 필드

| 필드 | 편집 가능 | 설명 |
|------|-----------|------|
| 아바타 | O | 이미지 업로드 또는 제거 |
| 이름 | O | 표시 이름 |
| 이메일 | X (별도 변경) | 이메일 변경 시 확인 메일 발송 플로우 |
| 언어 | O | UI 언어 (ko, en) |
| 테마 | O | Light / Dark / System |

### 2.2 보안 설정

| 항목 | 설명 |
|------|------|
| 비밀번호 변경 | 현재 비밀번호 확인 → 새 비밀번호 입력 |
| 2FA 설정 | TOTP 기반. QR 코드 표시 → 인증 앱으로 스캔 → 확인 코드 입력 |
| 활성 세션 | 현재 로그인된 기기/브라우저 목록. 타 세션 강제 종료 가능 |

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
│  [워크스페이스 삭제]     (owner만, 이름 재입력 확인 필수)     │
└──────────────────────────────────────────────────────────────┘
```

### 4.1 멤버 관리

| 액션 | 권한 | 설명 |
|------|------|------|
| 초대 | Admin+ | 이메일로 초대 토큰 발송. 수신자는 수락 페이지에서 합류 |
| 초대 취소 | Admin+ | 대기 중인 초대 토큰 폐기 |
| 역할 변경 | Admin+ (Owner 역할 부여/박탈은 별도 양도 흐름) | 드롭다운으로 역할 변경 |
| 제거 | Admin+ | 멤버 제거 (확인 다이얼로그) |
| 나가기 | 본인 | 자가 탈퇴. 유일한 owner는 차단 — 먼저 다른 owner를 지정하거나 삭제로 이동 |
| 워크스페이스 삭제 | Owner | 이름 재입력 확인 → 멤버·초대·워크스페이스 순으로 트랜잭션 삭제 |

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
| GET | /api/users/me/sessions | 활성 세션 목록 |
| DELETE | /api/users/me/sessions/:id | 세션 강제 종료 |
| GET | /api/workspaces | 내 워크스페이스 목록 |
| POST | /api/workspaces | 팀 워크스페이스 생성 (요청자가 owner) |
| PATCH | /api/workspaces/:id | 워크스페이스 이름 변경 (Admin+) |
| DELETE | /api/workspaces/:id | 워크스페이스 삭제 (Owner, team 전용, 트랜잭션) |
| POST | /api/workspaces/:id/leave | 자가 탈퇴 (본인, 유일한 owner는 차단) |
| GET | /api/workspaces/:id/members | 멤버 목록 |
| POST | /api/workspaces/:id/members | 이메일로 기존 가입자 즉시 추가 (Admin+) |
| PATCH | /api/workspaces/:id/members/:memberId | 역할 변경 (Admin+) |
| DELETE | /api/workspaces/:id/members/:memberId | 멤버 제거 (Admin+ / 자가 탈퇴 시 leave로 위임) |
| GET | /api/workspaces/:id/invitations | 대기 중인 초대 목록 (Admin+) |
| POST | /api/workspaces/:id/invitations | 미가입자 초대 토큰 발송 (Admin+) |
| DELETE | /api/workspaces/:id/invitations/:invitationId | 초대 취소 (Admin+) |
| POST | /api/workspaces/invitations/accept | 초대 수락 (본인 이메일과 매칭되는 토큰) |

### 6.2 알림 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/notifications | 알림 목록 (쿼리: type, is_read, page, limit) |
| GET | /api/notifications/unread-count | 미읽은 알림 수 |
| PATCH | /api/notifications/:id/read | 알림 읽음 처리 |
| POST | /api/notifications/mark-all-read | 전체 읽음 처리 |
| GET | /api/notifications/settings | 알림 설정 조회 |
| PATCH | /api/notifications/settings | 알림 설정 수정 |
