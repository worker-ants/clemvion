# Requirement Review — invite-accept-confirm-ui (round 3, 16_05_46)

FOCUS: 최신 fix 커밋(`05c589936`, "handleLogout 이 has_session 쿠키까지 정리")이
직전 fresh-review(15_51_50) WARNING — `accept-invitation-content.tsx` 의 `handleLogout`
이 store `logout()` 대신 `setAccessToken(null)+setUser(null)` 만 호출해 `has_session`
힌트 쿠키를 stale 로 남긴 문제 — 를 완전히 해소하는지, 그리고 새로운 회귀를 유입하지
않는지 검증.

## 발견사항

- **[INFO]** 직전 WARNING 완전 해소 확인 — `handleLogout` 이 canonical `useAuthStore.getState().logout()` 호출로 교체됨
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` L101-113 (`handleLogout`), 대조 `codebase/frontend/src/lib/stores/auth-store.ts` L41-48 (`logout()`)
  - 상세: 커밋 `05c589936` 는 기존 `setAccessToken(null); useAuthStore.getState().setUser(null);` 2줄을 `useAuthStore.getState().logout();` 단일 호출로 교체했다. `auth-store.ts` 의 `logout()` 구현을 직접 읽어 확인한 결과 — (1) `setAccessToken(null)` (access token 메모리 제거), (2) `document.cookie = "has_session=; path=/; max-age=0"` (힌트 쿠키 clear, `path=/` 로 `setAuthenticated()` 가 심을 때(`path=/`)와 동일 path — 브라우저가 다른 path 쿠키로 취급해 안 지워지는 흔한 함정을 피함), (3) `set({ user: null, isAuthenticated: false, isLoading: false })` 를 모두 원자적으로 수행한다. 이는 직전 WARNING 의 제안("`useAuthStore.getState().logout()` 을 호출... 내부적으로 `setAccessToken(null)` 도 수행하므로 별도 호출 제거 가능")과 정확히 일치하는 조치다.
  - 제안: 없음 — 완전 해소.

- **[INFO]** 미사용 `setAccessToken` import 제거 확인 — dead import 잔존 없음
  - 위치: `accept-invitation-content.tsx` diff (`import { setAccessToken } from "@/lib/api/client";` 라인 삭제)
  - 상세: `grep -n "setAccessToken" accept-invitation-content.tsx` 결과 0건. 파일 전체에서 다른 참조도 없어 lint(`no-unused-vars`) 위반 소지가 없다. 코드베이스 전체(`grep -rn "setAccessToken(null)"`)를 확인해도 `auth-store.ts` 자체(`logout()`/`setAuthenticated()` 내부) 외 직접 호출부가 남아있지 않아, 이 파일이 마지막으로 store 를 우회하던 지점이었음을 재확인했다.
  - 제안: 없음.

- **[INFO]** register-form.tsx 의 `has_session=1` 판정 로직과 cookie 속성(path) 정확히 대칭
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` L115-123 (`document.cookie.split("; ").includes("has_session=1")`) vs `auth-store.ts` L36 (`setAuthenticated`: `path=/`, `max-age=2592000`) / L45 (`logout`: `path=/`, `max-age=0`)
  - 상세: 이번 fix 가 해소 대상으로 삼은 "self-inflicted staleness"(mismatch-logout 후 stale `has_session=1` 쿠키가 남아 초대 링크 재진입 시 register-form 이 잘못 accept 페이지로 redirect) 시나리오를 코드 레벨에서 직접 재구성해 검증했다 — set/clear 양쪽 모두 동일 `path=/` 를 사용하므로 브라우저가 별개 쿠키로 인식할 여지가 없고, `logout()` 호출 즉시 `has_session=1` substring 이 `document.cookie` 에서 사라진다. 따라서 mismatch-logout 이후 같은 브라우저에서 초대 메일 링크를 다시 열어도 register-form 이 stale 쿠키로 오판해 accept 페이지로 튕기는 경로가 더는 발생하지 않는다.
  - 제안: 없음.

- **[INFO]** 테스트 갱신이 실제 동작을 정확히 반영 — 서버 logout 실패 시에도 클라이언트 정리 보장 유지
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/__tests__/accept-invitation-content.test.tsx` — mock 을 `setUserMock` → `storeLogoutMock` 으로 교체, 두 테스트("logout clears session and routes to /login", "clears the client session and routes to /login even when server logout fails") 모두 `expect(storeLogoutMock).toHaveBeenCalled()` 로 갱신
  - 상세: `handleLogout` 의 `try { await authApi.logout(); } catch { /* swallow */ }` 다음에 `useAuthStore.getState().logout()` 이 위치해, 서버측 로그아웃 API 가 실패(네트워크 에러 등)해도 클라이언트 세션 정리(store logout + `/login` 이동)는 항상 실행된다 — 이 fallback 보장은 기존 주석("로그아웃 요청이 실패해도 클라이언트 세션은 정리하고 로그인으로 보낸다")과 이번 fix 이후에도 그대로 유지된다. 두 테스트 모두 `mockLogout.mockResolvedValue`/`mockRejectedValue` 양쪽 경로를 커버해 회귀를 방지한다.
  - 제안: 없음.

- **[INFO]** 새로운 회귀·부작용 없음 (엣지 케이스 점검)
  - `isLoading: false` 부가 효과: `logout()` 이 `isLoading` 도 `false` 로 set 하지만, 이 페이지는 `isLoading` 을 구독하지 않고(`useAuthStore.getState()` 로 1회성 스냅샷만 읽음) 렌더 로직에 영향이 없다.
  - 서버 `authApi.logout()` 실패 swallow: 이번 fix 이전과 동일하게 유지 — 변경 범위 밖.
  - `router.push("/login")` 호출 순서: `logout()` 호출(동기, zustand `set` + 쿠키 write) 후 `router.push` 호출 — 순서상 쿠키가 지워진 뒤 네비게이션이 발생해 race 없음.
  - 다른 handleLogout 유사 호출부 존재 여부: `grep -rn "setAccessToken(null)"` 결과 `auth-store.ts` 내부(정의부) 외 없음 — 코드베이스 전체에서 이 gap 의 재발 지점이 남아있지 않다.

## 요약

최신 fix 커밋(`05c589936`)은 직전 fresh-review WARNING(핸들러가 store 의 canonical `logout()` 을 우회해 `has_session` 힌트 쿠키·`isAuthenticated` 플래그를 정리하지 않던 self-inflicted staleness)을 정확히 그 제안대로 — `handleLogout` 을 `useAuthStore.getState().logout()` 단일 호출로 교체 — 해소했다. `auth-store.ts` 의 `logout()` 구현을 직접 대조한 결과 access token·`has_session` 쿠키(동일 `path=/`)·`isAuthenticated`/`user` 플래그를 원자적으로 정리하며, register-form 의 쿠키 판정 로직과도 완전히 대칭이다. 미사용 import 제거, 테스트 mock 갱신(성공/서버실패 양쪽 경로 모두 `storeLogoutMock` 호출 검증) 모두 정확하고, 새로운 TODO/FIXME·엣지케이스 누락·회귀는 발견되지 않았다. spec(`1-auth.md` §1.5.3, `10-auth-flow.md` §2.6)은 이 클라이언트측 쿠키 정리 디테일을 규정하지 않는 회색지대이며 spec 위반도 아니다.

## 위험도

NONE
