---
worktree: competent-mirzakhani-34a96a
started: 2026-06-28
owner: developer
branch: claude/webhook-extractip-consolidation
---

# webhook 하드닝 후속 — 코드 정리 (A+B 묶음)

PR #763(W4·W2·W1) 머지 후, 그 fresh 리뷰(review/code/2026/06/28/17_16_16)의
비차단 INFO 중 코드 정리·테스트 격리 항목을 묶어 처리한다. **동작 보존**.

## 범위

### A. 코드 정리
- [x] **A-1** `hooks.service` 의 로컬 `extractClientIp` 래퍼 제거 → 호출부 2곳([:152](../../codebase/backend/src/modules/hooks/hooks.service.ts), [:260](../../codebase/backend/src/modules/hooks/hooks.service.ts))에서 `extractClientIpFromHeaders(...) ?? undefined` 직접 사용. guard(완료)·service 양쪽 단일 구현 통합 완성. req.ip 폴백 followup 주석은 호출부에 보존.
- [x] **A-2** `http-exception.filter` 기본 메시지 매직 문자열 2종을 named 상수화(`UNKNOWN_ERROR_MESSAGE`·`UNHANDLED_ERROR_MESSAGE`). **두 문자열은 의도적으로 다름**(비-Error throw fallback vs unhandled Error) — 병합 아님, 명명만.
- [x] **A-3** guard `canActivate` 의 `getRequest` 인라인 익명 타입 → named interface(`PublicWebhookReqShape`). 테스트가 import 해 필드 동기화 제거.

### B. 테스트 격리 (현재 green, 견고성)
- [x] **B-4** `client-ip.spec` 두 describe 블록 env 복원을 beforeEach 스냅샷/afterEach 복원으로 통일.
- [x] **B-5** `Logger.prototype` spy `mockRestore()` → `afterEach(jest.restoreAllMocks)`(filter.spec·guard.spec).
- [x] **B-6** 비-413 4xx 테스트에 `requestId` 단언 추가(413 케이스와 대칭).
- [x] **B-7** guard.spec env 복원 패턴을 beforeEach 스냅샷/afterEach 로 통일(CF 테스트 try/finally 제거).

## 워크플로
- [x] TEST WORKFLOW lint·unit·build·e2e(225) 통과
- [x] /ai-review (19_00_30, LOW/0-Critical/3-WARNING) → WARNING 전부 FIXED (RESOLUTION)
- [x] /consistency-check --impl-done (19_00_30, BLOCK:NO)
- [ ] fresh /ai-review --route=all (WARNING fix 커버 + security/architecture 재수집) + fresh impl-done(1-auth)
- [ ] push + PR

## 범위 밖 (별도)
- C(spec-only 단방향 포인터: 1-auth §2.3 / api-convention §5.3 / web-chat §4) — 별도 spec 묶음.
- D-12(IP 미식별 fail-open 우회) — `webhook-public-ip-failopen-hardening.md` plan 신설(보안 결정 필요).
