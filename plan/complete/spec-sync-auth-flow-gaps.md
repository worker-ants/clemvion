---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# auth-flow — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/10-auth-flow.md

## 미구현 항목
- [x] `POST /api/auth/resend-verification` 백엔드 핸들러 (auth.controller.ts 에 라우트 부재)
- [x] 이메일 인증 안내 화면(§2.5)의 "Resend Email" 버튼 + 60초 쿨다운 — verify-email-content.tsx 는 현재 "Back to login" 링크만 노출
- [x] 비밀번호 재설정 안내 화면(§4.2)의 "Resend Email" 버튼 — forgot-password-form.tsx 미배선
- [x] 회원가입 Email blur 시 `POST /api/auth/check-email` 중복 확인 배선(§2.2) — 백엔드 엔드포인트와 `authApi.checkEmail` 클라이언트는 존재하나 register-form.tsx 가 호출하지 않음

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 의 auth-flow 섹션 참조.
- 강도바 단계수(§2.3 3→5단계)·OAuth providers Cache-Control(public→private)·라우트 `/auth` 접두사 제거는 spec 본문을 코드 현실에 맞춰 이미 정정 완료(구현 갭 아님).

## 구현 상태 (branch claude/spec-sync-impl-644d19, 2026-06-03)
- 미구현 항목 **코드 구현 완료** — commit 27b6c362. ai-review(13 reviewer)+resolution-applier 처리, build/lint/unit/e2e green. (resend-verification + cooldown + onBlur; +SEC-CRITICAL emailVerifyToken 해시 7fc682c3)
- **미해결 follow-up**: spec marker flip / 본문 보강(planner) → `plan/in-progress/spec-fix-impl-marker-flips.md`. 그 완료 시 본 ticket 을 `complete/` 이동 (plan-lifecycle §2).
