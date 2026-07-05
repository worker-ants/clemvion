# 테스트(Testing) Review — invite-accept-confirm-ui (16_05_46)

FOCUS: accept 테스트 mock 이 `setUserMock` → `storeLogoutMock` 으로 전환됨(커밋
`05c589936`, "handleLogout 이 has_session 쿠키까지 정리"). 로그아웃 관련 두 테스트
("logout clears session and routes to /login", "clears the client session and
routes to /login even when server logout fails")가 이제 `store.logout()` 호출을
검증한다. 커버리지·assertion 적절성을 점검한다.

## 사전 확인 사항 (오케스트레이터 참고)

`_prompts/testing.md` 에는 이번 FOCUS 의 실제 대상 파일(`accept-invitation-content.test.tsx`,
`accept-invitation-content.tsx`)이 diff 로 실려 있지 않았다 — 프롬프트에 번들된 13개
파일은 전부 `review/consistency/**` 산출물과 `spec/2-navigation/10-auth-flow.md`,
`spec/5-system/1-auth.md` 뿐이며 `storeLogoutMock`/`setUserMock` 문자열이 전혀 등장하지
않는다(과거 memory 의 "리뷰 changeset이 직전 검토 코드 제외" 패턴과 동형). 이에 따라
워크트리 절대경로에서 실제 코드를 직접 읽어 분석했다:
- `codebase/frontend/src/app/(main)/invitations/accept/__tests__/accept-invitation-content.test.tsx`
- `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`
- `codebase/frontend/src/lib/stores/auth-store.ts`
- `git show 05c589936` (해당 diff)

## 발견사항

- **[INFO]** Mock 전환은 실제 프로덕션 코드 변경(`setUser(null)` → `useAuthStore.getState().logout()`)을 정확히 반영하며 적절함
  - 위치: `accept-invitation-content.test.tsx:32-37` (`storeLogoutMock` 정의 및 `useAuthStore.getState()` mock), 대응 구현: `accept-invitation-content.tsx:111` (`useAuthStore.getState().logout()`)
  - 상세: `useAuthStore` mock 이 `logout: storeLogoutMock` 형태로 실제 스토어 인터페이스(`auth-store.ts:21` `logout: () => void`)의 시그니처를 정확히 반영한다. 프로덕션에서 `store.logout()` 이 `setAccessToken(null)` + `has_session` 쿠키 clear + `isAuthenticated`/`user` 리셋을 한 번에 수행하므로(`auth-store.ts:41-48`), 테스트가 `storeLogoutMock` 이 호출됐는지만 확인하는 것은 "컴포넌트가 store 의 logout 액션을 호출했다"는 계약을 검증하는 정확한 단위 경계다. 실제 쿠키/토큰 정리 로직 자체는 `auth-store.ts` 의 책임이므로 accept 페이지 테스트에서 이를 재검증할 필요는 없다(단위 테스트 경계가 적절).
  - 제안: 없음 — Mock 적절성 관점에서 문제 없음.

- **[WARNING]** 두 로그아웃 테스트 모두 `expect(storeLogoutMock).toHaveBeenCalled()` 만 확인하고 호출 인자/횟수를 검증하지 않음 — 회귀 방지력이 약함
  - 위치: `accept-invitation-content.test.tsx:115`, `:127`
  - 상세: `logout()` 은 인자를 받지 않는 함수(`() => void`)이므로 인자 검증은 해당 없지만, `toHaveBeenCalled()` 는 1회 호출과 N회 중복 호출을 구분하지 못한다. 예컨대 향후 리팩터에서 `handleLogout` 이 실수로 `logout()` 을 두 번 호출하거나(예: effect cleanup 오류로 재실행) `authApi.logout()` 재시도 로직이 추가되면서 store logout 도 중복 트리거되는 회귀가 생겨도 이 테스트는 여전히 통과한다. `toHaveBeenCalledTimes(1)` 로 강화하면 이런 회귀를 잡을 수 있다.
  - 제안: `expect(storeLogoutMock).toHaveBeenCalledTimes(1)` 로 강화(적어도 로그아웃 성공 케이스에서는). 서버 실패 케이스는 `waitFor` 안에서 재시도될 수 있어 정확한 횟수 단언이 더 중요하다.

- **[WARNING]** "server logout fails" 테스트가 `mockLogout` 이 실제로 호출/거부되었는지 자체를 검증하지 않음 — 테스트 이름이 암시하는 시나리오의 핵심 전제가 미검증
  - 위치: `accept-invitation-content.test.tsx:119-129`
  - 상세: 이 테스트는 "clears the client session and routes to /login even when server logout fails" 라는 이름으로 서버 실패 시나리오를 표방하지만, `mockLogout.mockRejectedValue(...)` 로 설정만 해두고 `expect(mockLogout).toHaveBeenCalled()` 같은 단언이 없다. 만약 향후 리팩터로 `handleLogout` 이 `authApi.logout()` 호출 자체를 건너뛰는 버그가 생겨도(예: try 블록이 통째로 삭제됨) 이 테스트는 `storeLogoutMock`/`mockPush` 단언만으로 여전히 통과한다 — 즉 "서버 호출이 실제로 실패했고 그 실패를 catch 로 흡수했다"는 시나리오의 핵심을 증명하지 못한 채 이름만 그렇게 붙어 있다. 위의 성공 케이스(`:106-117`)도 `expect(mockLogout).toHaveBeenCalled()` 단언이 없어 대칭적으로 동일한 갭이 있다.
  - 제안: 두 테스트 모두 `expect(mockLogout).toHaveBeenCalled()` (또는 `toHaveBeenCalledTimes(1)`) 를 추가해 "서버 로그아웃 호출이 실제로 일어났다"는 전제를 명시적으로 검증한다. 특히 실패 케이스는 `try { await authApi.logout() } catch {}` 블록이 통째로 제거되는 회귀(즉 실패를 흡수하는 게 아니라 애초에 호출을 안 하는 경우)를 이 assertion 없이는 구분할 수 없다.

- **[INFO]** `console.error`/unhandled rejection 관련 노이즈 미검증 (엣지 케이스, 낮은 우선순위)
  - 위치: `accept-invitation-content.test.tsx:119-129`, 구현: `accept-invitation-content.tsx:101-106` (`try { await authApi.logout() } catch {}`)
  - 상세: 구현이 `catch {}` 로 에러를 완전히 swallow 하므로 테스트에서 별도로 `console.error` mock 이 필요하지는 않다(Vitest 기본 설정상 unhandled promise rejection 경고도 발생하지 않을 것으로 보임). 다만 이 부분은 test runner 설정에 따라 stderr 노이즈를 유발할 수 있어, CI 로그 가독성 차원에서만 참고.
  - 제안: 조치 불요 — 정보 제공 목적.

- **[INFO]** 회귀 테스트 관점: 기존 `setUser(null)` 검증에서 `logout()` 검증으로의 전환은 실제 구현 변경과 정합하며, 오래된 mock 을 남겨두는 실수는 없음
  - 위치: `accept-invitation-content.test.tsx` (커밋 `05c589936` diff 전체)
  - 상세: `git show 05c589936` 로 확인한 결과 `setUserMock` 참조가 테스트 파일 전체에서 완전히 제거되었고(잔존 참조 없음), mock 정의(`useAuthStore` factory)도 `setUser` 대신 `logout` 필드로 교체되어 실제 스토어 shape 과 일치한다. 이전 커밋(`b477913c2`)이 도입한 `setUserMock` 기반 테스트가 새 구현(`logout()` 호출)에서는 `useAuthStore.getState().setUser` 자체가 더 이상 호출되지 않으므로, 만약 mock 을 갱신하지 않았다면 해당 테스트는 실제로는 아무것도 검증하지 못한 채(setUserMock 이 never called 로 계속 실패하거나, 혹은 mock factory 에 `setUser` 필드가 없어 컴포넌트가 `undefined()` 호출로 런타임 에러) fail 했을 것이다 — 즉 이번 전환은 필수적이고 정확했다.
  - 제안: 없음.

- **[INFO]** 테스트 격리성 양호 — `beforeEach`의 `vi.clearAllMocks()` + `mockUser = null` 리셋이 `storeLogoutMock` 을 포함한 모든 mock 상태를 매 테스트마다 초기화
  - 위치: `accept-invitation-content.test.tsx:65-69`
  - 상세: `storeLogoutMock` 은 모듈 최상단에서 한 번만 생성되는 `vi.fn()` 이지만(`:32`), `vi.clearAllMocks()` 가 모든 vi.fn 의 호출 기록을 초기화하므로 테스트 간 오염 없이 독립 실행 가능하다. 순서 의존성 없음.
  - 제안: 없음.

## 요약

Mock 을 `setUserMock` 에서 `storeLogoutMock` 으로 전환한 것은 프로덕션 코드가 `setUser(null)` 대신 `useAuthStore.getState().logout()` 을 호출하도록 바뀐 것을 정확히 반영하며, mock 인터페이스도 실제 스토어 계약과 일치해 Mock 적절성 자체는 문제 없다. 다만 두 로그아웃 테스트 모두 `storeLogoutMock` 호출 여부만 확인하고 (a) 호출 횟수(`toHaveBeenCalledTimes`)와 (b) 서버측 `authApi.logout()`(`mockLogout`)이 실제로 호출되었는지에 대한 단언이 빠져 있어, 특히 "server logout fails" 테스트는 이름이 암시하는 핵심 전제(서버 호출이 실패했고 그 실패가 catch 로 흡수됐다)를 assertion 으로 증명하지 못한 채 통과할 수 있는 구조다. 이는 향후 `try/catch` 블록 삭제나 중복 호출 같은 회귀를 놓칠 수 있는 커버리지 갭이나, 기능적으로 CRITICAL 한 결함은 아니며 assertion 1~2줄 추가로 쉽게 보강 가능하다.

## 위험도

LOW
