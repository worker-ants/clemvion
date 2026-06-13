---
worktree: refactor-04-followups2-1de843
started: 2026-06-12
owner: project-planner
---

# Spec draft — user-auth 감사 이벤트 workspace 귀속 + 1b IP 신뢰 by-design

refactor 04 후속. spec 결정 2건 (코드 변경 없음 — audit 구현은 본 결정 확정 후 별도 developer 작업).

## 결정 1 — `user.*` 감사 이벤트의 workspace 귀속

**문제**: `1-auth §4.1` Planned 액션 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 는 "워크스페이스 컨텍스트" 로 분류돼 `audit_log`(workspaceId **non-nullable**)에 기록 예정이나, 어느 workspace 에 귀속할지 미정의.

**결정 (옵션 a — 액터 세션 workspace, schema 변경 없음)**: 이 세 액션은 **모두 인증된 세션에서만 발생**한다:
- `user.password_changed` → `POST /users/me/change-password` (인증 필요, `users.controller.ts`).
- `user.2fa_enabled` / `user.2fa_disabled` → TOTP `verifyAndEnable`/`disable`, WebAuthn 등록/삭제 (모두 인증 필요).

따라서 **액터의 현재 세션 `workspaceId`**(인증 요청 JWT 의 workspace 컨텍스트)에 귀속한다 — `audit_log.workspaceId` 는 non-nullable 그대로, schema·쿼리·인덱스 무변경. `AuditLogsService.record({ workspaceId: <session ws>, userId, action, resourceType: 'user', resourceId: userId })`.

**엣지 — 무인증 password-reset**: `POST /auth/reset-password`(토큰 기반, 세션·workspace 없음)는 §4.1 L379 의 기존 규칙("워크스페이스 컨텍스트 없는 인증 이벤트 → LoginHistory")을 따라 **`audit_log` 가 아니라 `login_history`** 에 기록한다(또는 미기록). 즉 `user.password_changed` audit 은 인증된 change-password 경로 전용이고, reset 경로는 workspace-audit 대상이 아니다.

**기각된 대안**:
- (b) `audit_log.workspaceId` nullable 허용 → user-level 이벤트 null: schema 마이그레이션 + 모든 workspace-필터 쿼리/인덱스/조회 UI 가 null 처리 필요(blast radius 큼). 본 결정은 인증 이벤트가 항상 세션 workspace 를 가지므로 nullable 불필요.
- (c) 별도 personal/user scope 신설: audit_log 는 본질적으로 workspace-scoped 팀 기능이고 user-단위 이벤트는 이미 `login_history` 가 담당 — 이중화 불필요.

**반영 위치**: `1-auth §4.1`(귀속 규칙 명확화) + 새 Rationale `4.1.B` + `data-flow/1-audit.md §1.1`(Planned user.* 행에 귀속 = 세션 workspace, reset → login_history 주석).

## 결정 2 — ip_whitelist/rate-limit IP 추출 헤더 기반은 by-design (1b)

코드 리뷰가 "`hooks` 의 `extractClientIp` 가 XFF 첫 IP 만 쓰고 `req.ip`(trust-proxy) 폴백·우선이 없다" 를 반복 플래깅. **그러나 이는 의도된 결정**:
- m-3(`§Rationale 2.3.B`)이 이미 IP 신뢰 정책을 확정: CF-Connecting-IP 는 opt-in, 그 외 XFF 신뢰는 **인프라/`trust proxy` 책임**, rate-limit 은 best-effort.
- CF Tunnel 배포에선 `trust proxy 1` 의 `req.ip` 가 cloudflared/CF edge IP(실 클라이언트 아님)라 **`req.ip` 우선화는 ip_whitelist 를 오히려 깨뜨린다**.

**반영 위치**: `§Rationale 2.3.B` 에 1~2줄 — "ip_whitelist/rate-limit 의 헤더 기반(CF-gated→XFF) IP 추출은 의도된 결정이며 `req.ip` 우선화는 CF Tunnel 토폴로지에서 부정확하므로 채택하지 않는다." 코드 변경 없음.

## Rationale 연속성
- 결정 1 은 §4.1 L369/L379 의 기존 "워크스페이스 컨텍스트 vs LoginHistory" 분류를 **구체화**하는 것이지 번복이 아니다. login/logout/login_failed → LoginHistory 규칙 불변.
- 결정 2 는 m-3 결정의 **재확인**(scope 확장: ip_whitelist·rate-limit 도 동일 원칙)으로, 기각 대안(req.ip 우선)에 토폴로지 근거를 추가.
