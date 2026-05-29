---
title: resolveTokenExpiry JWT exp 우선순위 추가 (TZ 버그 방어)
worktree: resolve-token-expiry-jwt-exp-284f57
branch: claude/resolve-token-expiry-jwt-exp-284f57
---

## 문제

구 코드(pre-2026-05-18)가 Cafe24 `expires_at` TZ-less ISO 문자열을 UTC 서버에서
KST로 해석 → `tokenExpiresAt` / `credentials.expires_at`에 실제 만료보다 +9h
값 기록. 이 값이 DB에 잔존하는 integration은 다음 복합 장애를 겪는다:

1. 엔티티의 `tokenExpiresAt`가 만료로 보여 `ensureFreshToken` 발동  
2. BullMQ worker가 DB를 재읽으면 +9h 미래로 보여 short-circuit → 갱신 없이 완료  
3. reactive_401 job이 해당 completed job으로 dedup → reactive short-circuit 우회 
   로직(`source='reactive_401'` 무력화)  
4. 두 번의 API 호출 모두 만료된 access_token → 401

## 해결책

`resolveTokenExpiry`에 JWT `exp` claim을 **최우선** 소스로 추가. Cafe24 API
서버가 실제로 검증하는 값이 JWT `exp`이므로 TZ-bugged 저장값을 무력화한다.

### 변경 파일

- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
  - `resolveTokenExpiry` 함수: JWT exp → tokenExpiresAt → credentials.expires_at 순
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts`
  - JWT exp 우선 동작 회귀 테스트 추가
- `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts`
  - TZ-bug 시나리오에서 short-circuit이 발동하지 않음을 검증하는 테스트 추가

## 체크리스트

- [ ] resolveTokenExpiry 구현 변경
- [ ] 테스트 작성 (client spec + processor spec)
- [ ] lint/unit/build/e2e 통과
- [ ] /ai-review 완료
