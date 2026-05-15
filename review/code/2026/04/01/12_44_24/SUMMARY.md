# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — sessionStorage 도입으로 인한 보안 설계 원칙 위반, 테스트 누락, 동시성 취약점이 복합적으로 존재

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **보안** | Access Token을 `sessionStorage`에 저장하여 XSS 공격 시 토큰 탈취 가능. 기존 `in-memory only (not localStorage for security)` 원칙을 역행하며, 이미 HttpOnly 쿠키 기반 refresh 흐름이 존재하므로 실질적 이점 대비 보안 비용이 과도함 | `client.ts` — `setAccessToken`, `getAccessToken` | sessionStorage 제거 후 메모리 + cookie refresh 패턴 유지. 불가피하다면 CSP 헤더 강화 및 트레이드오프 명시적 문서화 |
| 2 | **테스팅** | `AuthProvider`의 저장 토큰 우선 복원 분기, fallback refresh 경로, `getAccessToken() ?? storedToken` 동작이 전혀 테스트되지 않음. 인증에 직결되는 핵심 경로가 미검증 상태 | `auth-provider.tsx` 전체 변경 로직 | `AuthProvider` 단위 테스트 파일 생성 — 분기별(stored token 유효/만료/없음) 시나리오 포함 |
| 3 | **테스팅** | `vi` 전역 변수가 import되지 않음. `vi.resetModules()` 사용 시 vitest globals 설정 부재 시 런타임 에러 발생 | `client.test.ts:1` | `import { describe, it, expect, beforeEach, vi } from "vitest";` 로 수정 |
| 4 | **동시성** | 병렬 API 요청이 모두 401을 받을 경우 각각 독립적으로 `/auth/refresh`를 호출. Refresh token이 단일 사용 방식이면 첫 번째 호출만 성공하고 나머지가 실패하여 의도치 않은 로그아웃 발생. `_retry` 플래그는 이를 방지하지 못함 | `client.ts` — response interceptor | 모듈 레벨 `refreshPromise` 변수로 진행 중인 refresh를 공유하여 중복 호출 방지 |
| 5 | **설계** | `getAccessToken()`이 getter임에도 전역 변수 `accessToken`을 변이시키는 side effect 내재. 함수 이름과 동작 불일치로 예측 불가능한 상태 변경 | `client.ts:27-31` | `initAccessTokenFromStorage()` 별도 함수로 초기화 책임 분리, 또는 명칭을 `getOrRestoreAccessToken()`으로 변경 |
| 6 | **성능** | 만료된 토큰 존재 시 `getMe() → 401 → refresh() → getMe() retry` 3회 왕복 발생. 기존(refresh → getMe, 2회)보다 오히려 느림 | `auth-provider.tsx:31-37` | JWT `exp` 클레임으로 클라이언트 사이드 만료 선검증 후 만료 토큰은 바로 refresh 경로로 분기 |
| 7 | **신뢰성** | `storedToken` 존재 + refresh cookie 모두 만료 시 인터셉터의 `window.location.href = "/login"` 호출과 `auth-provider`의 `router.replace` 간 중복 리다이렉트 발생 가능 | `auth-provider.tsx:30-47`, `client.ts` interceptor | 세션 복원 중임을 알리는 플래그 또는 인터셉터와 auth-provider 간 충돌 방지 로직 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **가독성** | `getAccessToken() ?? storedToken` 패턴이 불명확. `storedToken`이 이미 `getAccessToken()` 결과이며, 인터셉터 갱신 의도가 암묵적 | `auth-provider.tsx:37` | `const finalToken = getAccessToken() ?? storedToken;` 변수로 분리 후 주석 명시 |
| 2 | **유지보수** | `TOKEN_KEY` 상수가 export되지 않아 테스트에서 `"accessToken"` 문자열 하드코딩. 키 변경 시 테스트 깨짐 | `client.ts:18`, `client.test.ts:20` | `TOKEN_KEY`를 `export const`로 노출하여 테스트에서 import 사용 |
| 3 | **문서화** | `getAccessToken()`, `setAccessToken()` 함수에 JSDoc 없음. `null` 전달 시 sessionStorage 항목 제거, lazy 초기화 동작 등 side effect 불명확 | `client.ts` 함수 선언부 | 함수별 JSDoc 추가 (동작, 파라미터, side effect 설명) |
| 4 | **설계** | `restoreSession`이 토큰 확인·유저 조회·인증 상태 설정·리프레시 폴백·에러 리다이렉트 등 6가지 책임 집중 (35줄) | `auth-provider.tsx:26-60` | `tryRestoreFromToken()`, `tryRestoreFromCookie()` 등으로 분리 고려 |
| 5 | **성능** | `typeof window !== "undefined"` 체크가 매 API 요청마다 실행됨. `"use client"` 지시어가 있으므로 hydration 후 dead code | `client.ts` — `getAccessToken` | `const isBrowser = typeof window !== "undefined"` 모듈 레벨 상수로 한 번만 평가 |
| 6 | **테스팅** | 401 auto-refresh 후 `setAccessToken(newToken)` 호출 시 sessionStorage 올바르게 저장되는지 테스트 없음 | `client.ts` response interceptor | interceptor 동작 테스트 추가 (`setAccessToken(null)` 시 sessionStorage 정리 포함) |
| 7 | **테스팅** | SSR 환경(`typeof window === "undefined"`) 분기 테스트 없음 | `client.ts:22-29` | `window` undefined 모킹 테스트 케이스 추가 |
| 8 | **설계** | `AuthProvider`(프레젠테이션 레이어)가 API 클라이언트 내부 함수 `getAccessToken`을 직접 import — 레이어 경계 위반 | `auth-provider.tsx:7`, `L34` | 세션 복원 로직을 `sessionService` 또는 `authApi`로 위임하여 레이어 분리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | sessionStorage XSS 노출, Open Redirect 가능성 |
| api_contract | MEDIUM | 보안 설계 회귀, 토큰 동기화 불일치 |
| side_effect | MEDIUM | sessionStorage 보안 취약점, getter 함수의 상태 변이, `setLoading(false)` 누락 가능성 |
| testing | MEDIUM | AuthProvider 테스트 완전 누락, `vi` 미import |
| performance | MEDIUM | 만료 토큰 경로에서 네트워크 왕복 증가 |
| architecture | MEDIUM | 레이어 책임 혼재, 인터셉터 사이드 이펙트 암묵적 의존 |
| concurrency | MEDIUM | 동시 401 발생 시 중복 refresh 호출 |
| requirement | MEDIUM | 보안 원칙 위반, 이중 리다이렉트 충돌 가능성 |
| dependency | LOW | `vi` 미import |
| documentation | LOW | JSDoc 없음, `TOKEN_KEY` 미export |
| maintainability | LOW | `restoreSession` 책임 집중, 코드 중복 |
| scope | NONE | 스코프 이탈 없음 |
| database | NONE | 해당 없음 (프론트엔드 변경) |

---

## 발견 없는 에이전트
- **database** — 데이터베이스 관련 코드 없음 (프론트엔드 인증 변경)
- **scope** — 변경 범위 내 일관된 구현, 불필요한 추가 없음

---

## 권장 조치사항

1. **[보안 — 즉시]** `sessionStorage` 토큰 저장 재검토: 기존 HttpOnly 쿠키 refresh 흐름이 이미 페이지 새로고침 후 복원을 처리하므로, sessionStorage 도입 없이 메모리 + cookie refresh 패턴으로 복원. 불가피하게 유지한다면 CSP 헤더 강화 및 보안 트레이드오프 명시 문서화 필수.

2. **[테스팅 — 즉시]** `vi` import 추가: `client.test.ts` 1번 줄을 `import { describe, it, expect, beforeEach, vi } from "vitest";`로 수정.

3. **[테스팅 — 높음]** `AuthProvider` 테스트 파일 생성: stored token 유효/만료/없음 분기별 `restoreSession` 시나리오, 401 interceptor 토큰 갱신 후 sessionStorage 동기화 검증 테스트 추가.

4. **[동시성 — 높음]** 중복 refresh 방지: 모듈 레벨 `refreshPromise` 공유 변수로 동시 401 발생 시 단일 refresh 요청만 실행되도록 인터셉터 수정.

5. **[설계 — 중간]** `getAccessToken()` side effect 제거: `sessionStorage` 초기화를 별도 `initAccessTokenFromStorage()` 함수로 분리하여 getter 순수성 복원.

6. **[신뢰성 — 중간]** 이중 리다이렉트 충돌 방지: 인터셉터의 `window.location.href = "/login"`과 `auth-provider`의 `router.replace` 간 중복 실행 방지 플래그 추가.

7. **[가독성 — 낮음]** `finalToken` 변수 분리 및 `TOKEN_KEY` export: `getAccessToken() ?? storedToken` 패턴을 명명 변수로 분리하고, `TOKEN_KEY`를 export하여 테스트 하드코딩 제거.

8. **[성능 — 낮음]** JWT 만료 선검증 추가: `exp` 클레임 기반 클라이언트 사이드 만료 체크로 불필요한 `getMe()` 왕복 제거.