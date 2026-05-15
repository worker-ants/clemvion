## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING]** `sessionStorage`를 통한 토큰 영속성 — 보안/책임 경계 혼재
- 위치: `client.ts` — `setAccessToken`, `getAccessToken`
- 상세: 원래 설계 의도("Access token stored in memory (not localStorage for security)")를 역행함. `sessionStorage`는 동일 origin의 JS에서 접근 가능하므로 XSS 공격 시 토큰 탈취 위험이 존재함. 또한 `client.ts`(API 레이어)가 스토리지 정책까지 결정하고 있어 단일 책임 원칙(SRP) 위반 — API 클라이언트는 요청/응답 처리만 담당해야 함.
- 제안: 토큰 스토리지 전략을 별도 `TokenStorage` 추상화(`interface + impl`)로 분리하거나, 쿠키 기반 리프레시 + 메모리 in-memory 패턴을 유지하고 페이지 새로고침 시 `authApi.refresh()`로 재발급받는 원래 흐름을 보존할 것. sessionStorage 사용이 불가피하다면 주석에 명시적인 보안 트레이드오프를 기술해야 함.

---

**[WARNING]** `AuthProvider`에서 `getAccessToken()` 직접 호출 — 레이어 경계 위반
- 위치: `auth-provider.tsx` L34 — `setAuthenticated(getAccessToken() ?? storedToken, user)`
- 상세: 프레젠테이션 레이어(`AuthProvider`)가 API 클라이언트의 내부 상태 함수(`getAccessToken`)를 직접 참조함. 이는 UI → API 인프라 레이어로의 직접 의존성으로, 레이어 책임 분리 원칙에 위배됨. `setAuthenticated`를 호출하는 시점에 이미 `usersApi.getMe()`가 성공했다면 토큰은 인터셉터가 처리한 상태이므로 `getAccessToken()` 재호출이 불필요하게 간접적임.
- 제안: `storedToken`만 사용하거나, `restoreSession` 함수 내에서 `currentToken` 변수로 관리. `AuthProvider`가 `getAccessToken`을 import할 필요가 없도록 세션 복원 로직을 `authApi` 또는 별도 `sessionService`로 위임할 것.

---

**[WARNING]** 토큰 검증과 API 호출의 순서 불일치 — 암묵적 사이드 이펙트 의존
- 위치: `auth-provider.tsx` L27–35
- 상세: `getAccessToken()`으로 토큰 존재 여부를 확인한 후 `usersApi.getMe()`를 호출하는데, 이 API 호출 중 401이 발생하면 `client.ts`의 응답 인터셉터가 `authApi.refresh()`를 자동 호출하여 토큰을 교체함. 이후 `getAccessToken() ?? storedToken`으로 토큰을 다시 읽는 것은 인터셉터의 사이드 이펙트에 의존하는 암묵적 흐름임. 이 인터셉터 동작이 변경될 경우 `AuthProvider`의 동작도 묵시적으로 깨짐.
- 제안: 세션 복원 흐름을 단일 함수(`sessionService.restore()`)로 캡슐화하고, 그 함수가 최종 토큰과 유저를 명시적으로 반환하도록 설계. 인터셉터 의존성을 문서화하거나 제거할 것.

---

**[INFO]** 테스트에서 `vi` 전역 미임포트
- 위치: `client.test.ts` L12, L16 — `vi.resetModules()`
- 상세: `vi`가 `vitest`에서 import되지 않음. Vitest의 글로벌 설정(`globals: true`)에 의존하는 경우 명시적 import 없이 동작하지만, 설정 변경 시 깨짐. 테스트 코드의 이식성과 명확성 저하.
- 제안: `import { describe, it, expect, beforeEach, vi } from "vitest";`로 명시적 import 추가.

---

**[INFO]** `client.ts`에서 `"use client"` 지시어 — SSR 안전성
- 위치: `client.ts` L1
- 상세: `"use client"` 지시어가 있어 Next.js SSR 환경에서 서버 측 실행을 막지만, `typeof window !== "undefined"` 가드가 중복으로 존재함. 지시어만으로는 서버 컴포넌트에서 import 시 안전하지 않으므로 가드는 유지가 맞으나, 아키텍처 레벨에서 API 클라이언트가 클라이언트 전용임을 명시하는 방식의 일관성 필요.
- 제안: 서버/클라이언트 API 클라이언트를 분리(`client.server.ts` / `client.browser.ts`)하거나, 현재 방식을 팀 컨벤션으로 명시적으로 문서화할 것.

---

### 요약

이번 변경의 핵심 의도(페이지 새로고침 시 세션 유지)는 타당하나, `sessionStorage` 도입이 기존 "메모리 내 토큰으로 XSS 방어" 원칙과 충돌하며 보안 트레이드오프가 명확하게 처리되지 않았음. 더 근본적인 문제는 API 인프라 레이어(`client.ts`)가 스토리지 정책을 직접 결정하고, 프레젠테이션 레이어(`AuthProvider`)가 API 클라이언트 내부 함수와 인터셉터의 사이드 이펙트에 암묵적으로 의존하는 레이어 책임 혼재임. 세션 복원 로직을 `sessionService`로 추상화하고, 토큰 스토리지 전략을 별도 모듈로 분리하면 확장성과 테스트 가능성이 크게 향상될 것.

### 위험도

**MEDIUM**