---
worktree: goal-audit-08b253
started: 2026-05-30
owner: project-planner
---

# Plan — OAuth callback access token 전달 방식 재설계 (보안 결정 필요)

> 출처: `/goal` 감사 Step 4 ai-review (fe-app-lib, Warning, 적대적 검증 통과).
> **아키텍처/보안 결정이 필요해 자동 수정하지 않고 기록** — 토큰 전달 메커니즘 변경은
> backend redirect + frontend callback + 토큰 저장 + CSRF/SSR 쿠키 처리에 동시 영향.

## 문제

OAuth 콜백이 access token 을 **URL 쿼리 파라미터**로 프론트에 전달한다:
- `codebase/backend/src/modules/auth/auth.controller.ts:525` — `${frontendUrl}/callback?success=true&token=${encodeURIComponent(result.accessToken)}` 로 redirect.
- `codebase/frontend/src/app/(auth)/callback/page.tsx:14` — 쿼리에서 token 을 읽어 `setAccessToken(token)` (in-memory) 저장.

URL 내 토큰 노출 경로: 브라우저 history(뒤로/앞으로), Referer 헤더(외부 링크 이동 시), 프록시/CDN access log, history 접근 권한을 가진 확장프로그램, OS 레벨 history. access token 은 민감 자격증명이므로 위험.

> 검증 메모: severity 는 Critical → **Warning** 으로 하향(검증자). 토큰이 in-memory 저장(localStorage 아님)이고 단명(short-lived)이라 노출 창이 제한적이나, URL 경유 자체가 best-practice 위반.

## 결정이 필요한 선택지

- [ ] **옵션 A (권장): HttpOnly Secure 쿠키 전달** — backend 콜백이 token 을 URL 대신 `Set-Cookie: HttpOnly; Secure; SameSite` 로 내려주고, frontend 는 쿠키 기반 세션으로 동작. XSS 노출까지 차단되나, 기존 in-memory Bearer 흐름·WS 인증·CSRF 방어(double-submit/SameSite) 재설계 필요.
- [ ] **옵션 B: BFF 패턴** — frontend 가 자체 backend 콜백 엔드포인트를 호출해 토큰을 직접 받고 URL 노출 제거.
- [ ] **옵션 C: 단명 one-time code → 교환** — URL 에는 1회용 단명 code 만 싣고, frontend 가 즉시 POST 로 실 토큰 교환(code 는 즉시 소멸). 기존 Bearer/in-memory 구조 최대 보존.
- [ ] **옵션 D: 수용(accept) + history 정리** — 현 구조 유지하되 callback 도착 즉시 `history.replaceState` 로 URL 에서 token 제거 + Referrer-Policy 강화. 최소 변경, 위험 부분 완화(노출 창 최소화)이나 프록시/CDN 로그 노출은 잔존.

## 영향 범위 (결정 후 구현 시)

- backend: `auth.controller.ts` 콜백 redirect, 토큰 발급/쿠키 정책, CORS/CSRF.
- frontend: `(auth)/callback/page.tsx`, `lib/api/client.ts` (토큰 저장/첨부), WS 클라이언트 인증.
- spec: `spec/2-navigation/10-auth-flow.md` 인증 흐름 갱신.

## 비고

- 본 감사에서 token 은 in-memory(`setAccessToken`) 저장으로 확인 — localStorage 영속 아님(노출 영향 일부 제한).
- 동일 감사의 즉시 수정분(authz IDOR 7건, timing-safe, fetch timeout, redis leak, debug log, fe container/isDirty)은 별도 commit 으로 반영됨.
