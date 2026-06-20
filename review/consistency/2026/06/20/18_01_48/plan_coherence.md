# Plan 정합성 검토 결과

검토 모드: `--impl-done`  
Target: `spec/5-system/1-auth.md`  
diff-base: `origin/main`

---

## 발견사항

### 발견사항 없음

분석 대상 구현 변경(git diff)은 두 가지다.

1. `sessions.service.ts` — `bcrypt.compare` → `comparePassword` (헬퍼 통일, 동작 동일)
2. `webauthn.controller.ts` + `.spec.ts` — `webauthnRegenerateRecovery` 의 raw bcrypt 블록 → `authService.verifyPasswordForUser` 위임 + 테스트 신설

이 변경은 `plan/in-progress/refactor-auth-reverify-unify.md` 의 설계 그대로다. 해당 plan 은 명시적으로 "behavior-preserving·spec 무변" 으로 범위를 설정했고, `spec/5-system/1-auth.md` 에 대한 내용 변경은 없다.

**미해결 결정과의 충돌 (관점 1)**  
`spec/5-system/1-auth.md` 에는 현재 두 개의 `pending_plans` 가 등재되어 있다 (`auth-config-webhook-followups.md`, `spec-sync-auth-gaps.md`). 두 plan 모두 이번 구현과 관련 없는 별개 영역(AuthConfig CRUD audit, §1.3 LDAP/SAML 미구현)을 추적한다. 이번 변경이 그 어느 미결 결정과도 충돌하지 않는다.

`plan/in-progress/refactor/02-architecture.md` C-3 항목은 "후속(통일 미완): webauthn.controller.ts · sessions.service.ts 의 raw bcrypt 도 같은 메서드로 통일(§3)" 을 명시하며 본 구현을 예고했다. 이번 diff 는 그 §3 후속의 완수다.

**선행 plan 미해소 (관점 2)**  
`refactor-auth-reverify-unify.md` 는 `refactor-c3-auth-bcrypt-service.md` 가 완료된 시점에서 파생된 후속 plan 으로, 선행 C-3 PR(`refactor-c3-auth-bcrypt-service.md`)의 체크리스트가 push+PR 만 미완이다. 그러나 이는 현재 worktree 의 구현 준비도 문제이지 plan 정합성 문제가 아니다 — 두 plan 이 같은 worktree 에서 순차 진행 중이고 `refactor-auth-reverify-unify.md` 의 구현·테스트는 이미 완료(lint·unit·build·e2e PASS)로 기록되어 있다.

**후속 항목 누락 (관점 3)**  
`refactor-auth-reverify-unify.md §범위 밖 / 후속` 은 "spec 문서(planner): data-flow/2-auth §1.2 verifyPasswordForUser 흐름 + error-codes 등재" 를 후속으로 명시했다. 이 항목은 plan 에 이미 추적되어 있으므로 누락이 아니다.  
`data-flow/2-auth.md §1.2` 의 시퀀스 다이어그램은 현재 `bcrypt.compare(password, password_hash)` 를 Svc participant 내부 단계로 표현하고 있다(`line 73`). `verifyPasswordForUser` 신설 이후 이 표현이 구현과 미세하게 드리프트되었으나, plan 이 이를 planner 후속으로 명시 추적하고 있어 spec 개정 누락에 해당하지 않는다.  
`http-ssrf-all-auth-followups.md` 등 다른 auth 인접 plan 들은 이번 변경의 영향을 받지 않는다.

---

## 요약

이번 구현 diff(webauthn.controller raw bcrypt → verifyPasswordForUser 위임, sessions.service bcrypt → comparePassword 헬퍼 통일)는 `plan/in-progress/refactor-auth-reverify-unify.md` 와 `refactor/02-architecture.md §C-3 후속(§3)` 이 사전 설계한 범위와 정확히 일치한다. `spec/5-system/1-auth.md` 의 내용은 변경되지 않았고(behavior-preserving), `pending_plans` 에 등재된 미결 사항과 충돌하지 않는다. 후속 spec 동기화(data-flow/2-auth §1.2 · error-codes.md)는 plan 에 이미 planner 위임으로 추적되어 있다. Plan 정합성 관점에서 차단 사유 없음.

---

## 위험도

NONE
