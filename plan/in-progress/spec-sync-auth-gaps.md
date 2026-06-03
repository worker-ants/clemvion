---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# auth — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 유지하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/1-auth.md

## 미구현 항목
- [ ] §1.3 LDAP / Active Directory 연동 (셀프 호스팅 선택 기능) — 백엔드에 핸들러·passport strategy·의존성 부재
- [ ] §1.3 SAML 2.0 기업 SSO 연동 (셀프 호스팅 선택 기능) — 동일하게 미구현

## 비고
- §1 ~ §5 의 나머지 surface (이메일/비밀번호, OAuth, TOTP, WebAuthn, 세션, RBAC, Audit/LoginHistory, 초대 토큰, API 엔드포인트) 는 audit 재검증에서 모두 구현 확인됨.
- 본 spec 의 다른 미구현 갭(auth_config CRUD audit 기록 등)은 `plan/in-progress/auth-config-webhook-followups.md` 가 추적.
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__1-auth.md 참조.
