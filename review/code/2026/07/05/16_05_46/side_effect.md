# 부작용(Side Effect) 리뷰 — handleLogout → store logout() 위임 (커밋 05c589936)

## 검토 대상

- 파일: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`
- 관련 커밋: `05c589936` ("refactor(invitations): V-09 round2 조치 — handleLogout 이 has_session 쿠키까지 정리")
- 대조 파일: `codebase/frontend/src/lib/stores/auth-store.ts` (L41-48, `logout()` 구현)
- 실제 diff(발췌):

```diff
-    setAccessToken(null);
-    useAuthStore.getState().setUser(null);
+    // store 의 logout() 은 access token·`has_session` 힌트 쿠키·인증 플래그를 한꺼번에
+    // 정리한다. setUser(null) 만 쓰면 has_session 쿠키가 남아, 이후 초대 링크 재진입 시
+    // register-form 이 stale 쿠키로 잘못 리다이렉트한다(§1.5.3 진입 경로가 has_session
+    // 을 load-bearing 으로 쓰므로 로그아웃도 이 쿠키를 반드시 지워야 한다).
+    useAuthStore.getState().logout();
     router.push("/login");
```

그리고 import 목록에서 `import { setAccessToken } from "@/lib/api/client";` 제거.

## 발견사항

- **[INFO]** `logout()` 이 이전 수동 조합을 완전히 포섭(superset)함 — 부작용 누락 없음
  - 위치: `codebase/frontend/src/lib/stores/auth-store.ts:41-48`
  - 상세: 이전 코드는 `setAccessToken(null)`(토큰 클리어) + `useAuthStore.getState().setUser(null)`(→ `set({ user: null })`, `isAuthenticated`/`isLoading` 은 불변으로 방치)의 2-스텝 수동 조합이었다. `logout()` 은 내부에서 (1) `setAccessToken(null)`, (2) `has_session` 쿠키 삭제(`document.cookie = "has_session=; ...max-age=0"`), (3) `set({ user: null, isAuthenticated: false, isLoading: false })` 를 원자적으로 수행한다. 즉 이전 조합이 수행하던 두 가지(토큰 클리어, user 널화)를 그대로 포함하면서, 이전 코드가 놓치고 있던 `isAuthenticated` 플래그·`has_session` 쿠키 정리까지 추가로 커버한다 — 기능 축소가 아니라 확장이며, 새로 도입되는 부작용(쿠키 삭제)도 register-form 의 진입 분기가 정확히 그 쿠키를 신호로 쓰기 때문에 이번 흐름에서 명시적으로 필요한 것이다(주석에 근거 기술됨, self-inflicted staleness 버그 수정).
  - 제안: 없음.

- **[INFO]** `setAccessToken` import 제거는 clean — 잔여 참조 없음
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` (import 목록)
  - 상세: `git grep -n "setAccessToken" codebase/frontend/src` 및 파일 내 재검색 결과, 해당 파일 안에는 더 이상 `setAccessToken` 사용처가 없다(HEAD 상태 파일 head 25줄 확인). `setAccessToken` 은 여전히 `auth-store.ts`(logout/setAuthenticated 내부), `login-form.tsx`, `register-form.tsx`, `verify-email-content.tsx`, `change-email/verify`, `change-password` 등 로그인/토큰-갱신 시나리오에서 정상적으로 직접 사용되며, 이번 변경은 그 소비자들에 영향을 주지 않는다(다른 파일 미변경, diff 범위 밖). 미사용 import 제거로 인한 빌드/린트 영향도 없음(오히려 lint unused-import 경고 해소 방향).
  - 제안: 없음.

- **[INFO]** 테스트 mock 이 새 API 표면(`logout`)으로 정확히 갱신됨 — stale mock 없음
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/__tests__/accept-invitation-content.test.tsx`
  - 상세: `useAuthStore` mock 이 `{ user, setUser: setUserMock }` → `{ user, logout: storeLogoutMock }` 로 갱신되고, assertion 도 `expect(setUserMock).toHaveBeenCalledWith(null)` → `expect(storeLogoutMock).toHaveBeenCalled()` 로 두 테스트 케이스(정상 로그아웃/서버 실패 시 로그아웃) 모두 갱신되었다. mock 표면이 실제 컴포넌트가 호출하는 메서드(`logout`)와 정확히 일치하므로, 만약 컴포넌트가 여전히 `setUser`를 호출했다면 테스트가 실패했을 것 — 이는 이 리팩터가 실제로 `logout()` 경로로 전환됐음을 교차 검증한다.
  - 제안: 없음.

- **[INFO]** `sidebar.tsx` 의 기존 `handleLogout` 과 패턴 일치 — 새 전역 부작용 도입 아님
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx:353-360`
  - 상세: 사이드바의 기존 로그아웃 핸들러도 동일하게 `authApi.logout()` 시도 후 실패를 swallow 하고 store 의 `logout()`(destructure 된 바인딩)을 호출하는 패턴이다. 이번 변경은 이 기존 관례를 accept 페이지에도 통일 적용한 것으로, 새로운 전역 상태 변경 경로나 새로운 부작용 유형을 도입하지 않는다. 두 컴포넌트가 같은 스토어 action 을 호출하므로 동작 일관성도 개선된다.
  - 제안: 없음.

- **[INFO]** 시그니처/공개 인터페이스 변경 없음
  - 상세: `handleLogout` 은 컴포넌트 로컬 함수이며 외부로 export 되지 않는다(내부 `onClick` 핸들러로만 사용). 파라미터·반환 타입 변경 없음. `auth-store.ts` 의 `logout()` 시그니처(`() => void`) 자체는 이번 diff 에서 변경되지 않았다(기존 액션을 새로 호출하는 곳이 하나 늘었을 뿐). 다른 호출자(`sidebar.tsx`)에 영향 없음.

## 요약

이번 변경은 accept 페이지의 `handleLogout` 이 수행하던 수동 2-스텝 정리(`setAccessToken(null)` + `setUser(null)`)를 스토어의 `logout()` 단일 액션 호출로 대체한 것이다. `auth-store.ts` L41-48 의 `logout()` 구현을 직접 대조한 결과, 이 액션은 이전 수동 조합이 수행하던 모든 부작용(토큰 클리어, user 널화)을 그대로 포함하면서 이전에 누락되어 있던 `isAuthenticated` 플래그·`has_session` 쿠키 정리까지 추가로 커버하는 strict superset이다 — 즉 "제거된 수동 cleanup"은 기능 손실 없이 `logout()`에 완전히 흡수되었다. `setAccessToken` import 제거도 해당 파일 내 잔여 참조가 없어 깨끗하며, 다른 소비자(로그인/토큰갱신 흐름)에도 영향이 없다. 테스트 mock 도 새 API 표면(`logout`)으로 정확히 갱신되어 있어 회귀 없이 검증되었다. 새로운 전역 변수·환경변수·네트워크 호출·시그니처/공개 API 변경은 없으며, 이번 리팩터는 기존 `sidebar.tsx` 패턴과의 일관성도 개선한다.

## 위험도

NONE
