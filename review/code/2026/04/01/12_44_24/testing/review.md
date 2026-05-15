### 발견사항

- **[WARNING]** `vi` 전역 변수 미임포트
  - 위치: `client.test.ts:1`
  - 상세: `vi.resetModules()`를 사용하지만 `vi`를 `vitest`에서 임포트하지 않음. `vitest` globals 설정이 없으면 런타임 에러 발생
  - 제안: `import { describe, it, expect, beforeEach, vi } from "vitest";`로 변경

- **[WARNING]** `AuthProvider` 변경사항에 대한 테스트 완전 누락
  - 위치: `auth-provider.tsx` 전체 변경 로직
  - 상세: stored token 우선 복원 경로(`storedToken` 존재 시 `usersApi.getMe()` 호출 후 세션 복원), fallback refresh 경로, `getAccessToken() ?? storedToken` 표현식의 동작이 전혀 테스트되지 않음
  - 제안: `AuthProvider` 단위 테스트 파일 생성 — `restoreSession` 분기별(stored token 유효/만료/없음) 시나리오 테스트 필요

- **[WARNING]** 401 interceptor 후 token 갱신 경로 테스트 누락
  - 위치: `client.ts` response interceptor
  - 상세: sessionStorage 기반으로 변경되었으나 401 auto-refresh 후 `setAccessToken(newToken)` 호출 시 sessionStorage에 올바르게 저장되는지 테스트 없음
  - 제안: interceptor 동작 테스트 추가 (`setAccessToken(null)` 시 sessionStorage 정리 후 redirect 검증 포함)

- **[INFO]** `beforeEach`에서 `vi.resetModules()` 후 이전 참조 무효화 문제
  - 위치: `client.test.ts:10-15`
  - 상세: `beforeEach`에서 `vi.resetModules()` 후 새 모듈을 `setAccessToken`/`getAccessToken` 변수에 할당하지만, 이후 `it` 블록은 새로 임포트된 함수를 사용함. 단, `it("falls back to sessionStorage...")` 테스트에서 `beforeEach`의 `vi.resetModules()` 이후 또 `vi.resetModules()`를 호출해 순서 의존성이 생김
  - 제안: 해당 테스트는 `beforeEach` 흐름과 독립적으로 모듈 상태를 제어하므로, `describe` 분리 또는 명시적 순서 문서화 권장

- **[INFO]** SSR 환경(`typeof window === "undefined"`) 분기 테스트 없음
  - 위치: `client.ts:22-29`, `client.ts:32-35`
  - 상세: `window` 미존재 환경에서 sessionStorage 접근이 skip되는 경로가 테스트되지 않음. Node 환경 테스트 시 예외 없이 동작하는지 확인 불가
  - 제안: `window` undefined 환경을 모킹한 테스트 케이스 추가

- **[INFO]** `setAuthenticated(getAccessToken() ?? storedToken, user)` 의도 불명확
  - 위치: `auth-provider.tsx:35`
  - 상세: interceptor가 token을 갱신했을 경우 최신 token을 사용하는 의도이나, 이 시나리오(interceptor가 token을 교체한 경우)에 대한 테스트가 없어 실제로 동작하는지 검증 불가
  - 제안: `usersApi.getMe()` 호출 중 interceptor가 token을 교체하는 시나리오 통합 테스트 추가

---

### 요약

`client.ts`의 token 관리 로직은 핵심 케이스(저장/조회/삭제/fallback)에 대한 단위 테스트가 적절히 작성되어 있으나, `vi` 미임포트라는 명백한 버그가 존재한다. 더 큰 문제는 이번 변경의 핵심 로직인 `AuthProvider`의 stored token 우선 복원 분기가 전혀 테스트되지 않는다는 점이다. 세션 복원 실패 시 redirect, interceptor에 의한 token 자동 갱신 후 sessionStorage 동기화, SSR 환경 처리 등 보안·인증에 직결되는 경로들이 미검증 상태로 남아 있어 회귀 위험이 높다.

### 위험도

**MEDIUM**