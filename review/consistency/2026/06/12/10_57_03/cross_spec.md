# Cross-Spec 일관성 검토 결과

target: `spec/5-system/1-auth.md`

---

## 발견사항

### [INFO] RBAC 매트릭스 — Integration (Org) 생성 권한 표현 차이
- target 위치: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스
- 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2` 역할 권한 매트릭스, `spec/2-navigation/4-integration.md §8 권한 규칙`
- 상세: target(§3.2)은 `Integration (Org)` 에 대해 `Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R` 로 기술한다. `9-user-profile.md §4.2` 는 "Integration 생성 (Org): Owner✅ / Admin✅ / Editor❌ / Viewer❌" 이며, `4-integration.md §8` 은 Organization 스코프의 생성은 "Admin 이상" 으로 기술한다. target 의 `Integration (Org): Editor=R` 은 다른 두 문서와 일치하나, target 은 Organization-scope 내 "수정/삭제/회전/재인증" 도 모두 Admin+ 로 제한하는 `4-integration.md §8` 의 세부 규칙을 단일 행 `CRUD`/`R` 으로 단순화해 표현한다. 모순이라기보다 해상도 차이이지만, target 의 `Admin=CRUD` 가 Editor 의 Personal-scope 자기 소유 CRUD 를 Organization-scope Admin-only 제한과 혼동하게 할 우려가 있다. `spec/0-overview.md §6.1` 각주도 "Editor floor 이며 Organization-scope 의 생성·수정·전환은 Admin+" 라고 명시해 target 의 표현과 미묘한 해상도 차이가 있다.
- 제안: target §3.2 의 `Integration (Org)` 행 아래에 "Organization-scope 의 생성·수정·삭제·회전은 Admin+. Editor 는 읽기만" 주석 추가, 또는 행을 `Integration (Org) 생성/수정/삭제` 와 `Integration (Org) 조회` 로 분리. 기존 `4-integration.md §8` 과 `0-overview.md §6.1` 과의 동기화 명시.

---

### [INFO] RBAC 매트릭스 — `9-user-profile.md §4.2` 에 Marketplace·Statistics·Auth Config·Model Config 행 없음
- target 위치: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스
- 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2` 역할 권한 매트릭스
- 상세: target §3.2 는 Marketplace 설치, Statistics, System Status, Auth Config, Auth Config Reveal, Model Config, Audit Log, Knowledge Base 에 대한 역할별 권한을 열거한다. `9-user-profile.md §4.2` 는 이보다 좁은 7개 항목만 다루며 Marketplace 설치, Statistics, Auth Config, Model Config, Audit Log 는 언급하지 않는다. 두 문서가 같은 RBAC 매트릭스를 다루면서 서로 다른 항목 집합을 기술하고 있어 어느 쪽이 완전한 SoT 인지 불분명하다. 모순은 없으나 누락으로 인한 혼동 소지가 있다.
- 제안: `9-user-profile.md §4.2` 에 "> 전체 권한 매트릭스는 [Spec 인증/인가 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스) 가 SoT" 참조 주석을 추가하거나, target §3.2 를 단일 SoT 로 명시.

---

### [INFO] `resend-verification` 엔드포인트 — §1.1 와 §5 간 토큰 유효기간 명시 차이
- target 위치: `spec/5-system/1-auth.md §1.1` (인증 메일 재발송 행) vs `§5 API 엔드포인트` 표
- 충돌 대상: (target 내부 불일치)
- 상세: §1.1 의 인증 메일 재발송 행은 유효기간을 명시하지 않는다. §5 API 엔드포인트 표의 같은 경로는 "24h 유효" 로 기술한다. `spec/data-flow/2-auth.md §1.7` 도 "24h 유효" 로 일치한다. target 내부에서 §1.1 이 재발송 시 유효기간을 누락하고 있어 소비자가 §1.1 만 보면 불완전 정보를 얻는다.
- 제안: target §1.1 인증 메일 재발송 행에 "(재발급 토큰 유효기간 24h)" 를 추가해 §5 및 data-flow 와 일치시킨다.

---

### [INFO] `data-flow/2-auth.md §2.2 (Redis)` 초대 Rate Limit — target 과 data-flow 간 수치 동기 확인 필요
- target 위치: `spec/5-system/1-auth.md §1.5.1` 토큰 정책 Rate Limit 행
- 충돌 대상: `spec/data-flow/12-workspace.md §1.2` 초대 발급
- 상세: target §1.5.1 은 "Rate Limit: 분당 10건 (`INVITATION_THROTTLE`, `workspaces.controller.ts` — invite·resend 엔드포인트 공통)" 으로 기술하고, 그 옆에 "[data-flow §1.2](../data-flow/12-workspace.md) 와 동일 값" 이라고 교차 참조를 명시하고 있다. `data-flow/12-workspace.md §1.2` 도 "분당 10건(`workspaces.controller.ts` `INVITATION_THROTTLE`)" 으로 일치한다. 두 문서가 정확히 동일한 값을 명시하므로 실질 충돌 없음. 단, 공개 토큰 메타 조회(`GET /api/invitations/:token`)의 30건 한도는 target 에 언급이 없고 `data-flow/12-workspace.md §1.2` 에만 있다.
- 제안: target §1.5.1 또는 §5 API 엔드포인트 표의 `GET /api/invitations/:token` 행에 "throttle 30/min (공개 조회)" 주석 추가로 동기화.

---

### [INFO] `spec/2-navigation/9-user-profile.md §6.1` — TOTP 2FA endpoint alias 와 target canonical 경로
- target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트`
- 충돌 대상: `spec/2-navigation/9-user-profile.md §6.1 사용자/워크스페이스 API` 표
- 상세: `9-user-profile.md §6.1` 은 `POST /api/users/me/enable-2fa` 와 `POST /api/users/me/confirm-2fa` 를 "canonical: `POST /api/auth/2fa/setup` / `POST /api/auth/2fa/verify`" 로 alias 표시하며, 이 두 경로가 "canonical 정의는 [인증 spec §5](../5-system/1-auth.md#5-api-엔드포인트)" 라고 명시한다. 모순이 아니며, `9-user-profile.md` 가 target 을 SoT 로 인정하는 구조다. 단, target §5 는 `/api/users/me/enable-2fa`, `/api/users/me/confirm-2fa` alias 가 존재한다는 사실 자체를 언급하지 않아 두 명칭이 동일 엔드포인트를 가리킨다는 사실이 target 만 읽는 소비자에게 보이지 않는다.
- 제안: target §5 의 `POST /api/auth/2fa/setup` 및 `POST /api/auth/2fa/verify` 행에 "alias: `POST /api/users/me/enable-2fa` / `confirm-2fa`" 주석 추가(선택 사항).

---

### [INFO] `spec/data-flow/1-audit.md §1.1` — target §4.1 의 Auth Config 감사 action 목록과 일치
- target 위치: `spec/5-system/1-auth.md §4.1` 현재 구현된 액션 표
- 충돌 대상: `spec/data-flow/1-audit.md §1.1` Writer module 표
- 상세: target §4.1 은 `auth_config.create / update / delete / regenerate / reveal` 5개를 현재 구현 목록에 나열한다. `data-flow/1-audit.md §1.1` 도 `auth-configs/auth-configs.service.ts` 에서 동일 5개 action 을 기록하는 것으로 명시한다. 두 문서가 완전히 일치하며 충돌 없음.

---

### [INFO] `spec/data-flow/2-auth.md §2.2` — `forgot-password` Rate Limit IP 기준 5건/min 명시
- target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표 (forgot-password 행)
- 충돌 대상: `spec/data-flow/2-auth.md §2.2 Redis` throttle 표
- 상세: target §5 의 `POST /api/auth/forgot-password` 행은 throttle 언급이 없다. `data-flow/2-auth.md §2.2` 는 "forgot-password · resend-verification · check-email: IP 당 5 req/min" 으로 명시한다. target §1.7 data-flow 서술에는 "IP 당 5 req/min" 이 언급된다. 모순은 아니나, target §5 엔드포인트 표에서 throttle 이 누락되어 있어 §5 만 읽는 소비자는 이 제약을 놓칠 수 있다.
- 제안: target §5 의 forgot-password 행에 `throttle 5/min` 주석 추가. `resend-verification` 는 이미 표에 명시되어 있음.

---

## 요약

target `spec/5-system/1-auth.md` 는 다른 spec 영역과 **직접 모순되는 항목이 없다**. RBAC 매트릭스(§3.2)는 `9-user-profile.md §4.2` 및 `4-integration.md §8` 과 해상도 차이(Organization-scope CRUD 세부 분리 여부)는 있으나, 같은 `0-overview.md §6.1` 이 이미 "editor floor + org-scope Admin+" 로 보완 관계를 명시하고 있어 구조적으로 일관성이 유지된다. 나머지 발견사항은 모두 동기화 편의 개선(유효기간 누락·throttle 주석·alias 미언급·RBAC 항목 집합 차이)이며 실제 동작 불일치를 유발하지 않는다. `data-flow/1-audit.md`, `data-flow/2-auth.md`, `data-flow/12-workspace.md` 의 흐름 서술 및 수치 모두 target 과 일치한다.

---

## 위험도

LOW

---

*검토 대상 파일:*
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/5-system/1-auth.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/2-navigation/9-user-profile.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/2-navigation/4-integration.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/2-navigation/6-config.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/1-data-model.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/0-overview.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/data-flow/1-audit.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/data-flow/2-auth.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/spec-auth-hygiene/spec/data-flow/12-workspace.md`
