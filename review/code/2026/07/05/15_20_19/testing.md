# 테스트(Testing) 리뷰 — invite-accept-confirm-ui (§1.5.3 초대 수락 확인 UI)

## 발견사항

- **[WARNING]** `handleAccept` 실패(수락 API 자체 reject) 경로 무테스트
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx:96-106` (`handleAccept` catch 분기), 대응 테스트 `__tests__/accept-invitation-content.test.tsx`
  - 상세: 새 컴포넌트는 `handleAccept`(버튼 클릭 후 `workspacesApi.acceptInvitation` 호출)와 마운트 시 메타 조회(`invitationsApi.getByToken`) 두 개의 분리된 에러 경로를 갖는다. 테스트는 "shows error on expired/invalid token (410)" 하나만 있는데, 이는 `getByToken` 실패 케이스만 커버한다. 리팩터로 새로 도입된 `handleAccept` 내부의 `workspacesApi.acceptInvitation` reject(예: 만료된 초대를 버튼 클릭 시점에 재검증해 실패, 네트워크 오류 등) 경로는 어떤 테스트도 커버하지 않는다. 이 분기가 실패하면 `status` 가 "error" 로 전이되고 `errorMessage` 가 세팅되는데 리팩터 전/후 동일한 상태를 공유하므로 회귀 시 조용히 깨질 수 있다.
  - 제안: `mockAccept.mockRejectedValue(...)` 로 accept 클릭 후 에러 상태(`errorMessage` 표시 + "이동" 버튼)까지 확인하는 케이스 추가.

- **[WARNING]** `handleLogout` 의 `authApi.logout()` 실패(catch 로 swallow) 경로 무테스트
  - 위치: `accept-invitation-content.tsx:98-104` (`try { await authApi.logout(); } catch { /* 로그아웃 요청이 실패해도... */ }`)
  - 상세: 주석으로 "로그아웃 요청이 실패해도 클라이언트 세션은 정리하고 로그인으로 보낸다" 는 의도된 동작을 명시했지만, 현재 4번째 테스트("logout clears session and routes to /login")는 `mockLogout.mockResolvedValue(undefined)` 성공 케이스만 검증한다. 이 catch 분기(로그아웃 API 실패 시에도 `setAccessToken(null)` + `setUser(null)` + `/login` 이동은 그대로 진행)는 주석에 명시된 핵심 동작임에도 실패 시나리오로 직접 검증되지 않는다.
  - 제안: `mockLogout.mockRejectedValue(new Error("network"))` 케이스를 추가해 catch 이후에도 `setUserMock`/`mockPush` 호출이 그대로 일어나는지 확인.

- **[WARNING]** 익명(미로그인) 사용자가 수락 페이지에 직접 진입하는 케이스 무테스트
  - 위치: `accept-invitation-content.tsx:57-61` (`const userEmail = useAuthStore.getState().user?.email; setStatus(userEmail && userEmail === m.email ? "ready" : "mismatch")`)
  - 상세: `beforeEach` 의 기본값이 `mockUser = null` 이므로, "mismatch" 테스트("shows mismatch notice + logout when logged-in email differs")는 실제로는 `mockUser = { email: "other@example.com" }`로 재설정한 뒤 실행되어 "다른 계정 로그인" 케이스만 검증한다. `useAuthStore.getState().user` 가 `null`(완전 비로그인) 인 채로 접속하는 경우 — 즉 `userEmail` 이 `undefined` 가 되어 `mismatch` 로 분기되는 경로 — 는 별도 테스트로 명시 검증되지 않는다. §1.5.3 spec 상 "이미 가입한 사용자" 흐름을 전제하지만, 미로그인 사용자가 이 URL 로 직접 진입할 가능성(즉 route guard 부재)에 대한 UI 동작을 테스트로 문서화해두면 회귀 방지에 유리하다.
  - 제안: `mockUser = null` 을 유지한 채(비로그인) 렌더해 mismatch UI(로그아웃 버튼 포함) 가 노출되는지, 혹은 별도의 "로그인 필요" 안내가 필요한지 spec 재확인 후 테스트로 고정.

- **[INFO]** `translate` 목이 파라미터 보간을 검증하지 않음 (mismatchHint `{{email}}`, message `{{workspace}}`)
  - 위치: `accept-invitation-content.test.tsx:79-82` (`vi.mock("@/lib/i18n", () => ({ useT: () => (k) => k, translate: (_l, k) => k }))`)
  - 상세: 컴포넌트는 `translate(locale, "invitations.accept.mismatchHint", { email: meta.email })` 처럼 파라미터를 넘기지만, 목은 이를 무시하고 key 문자열만 반환한다. 따라서 "mismatch" 테스트가 실제로 검증하는 것은 `screen.getByText("invitations.accept.logoutAndSwitch")`(단순 `t()` 키)뿐이며, `mismatchHint` 안내문에 `meta.email` 값이 실제로 삽입되는지는 이 스위트에서 전혀 검증되지 않는다(동일하게 `message` 의 `workspace` 보간도 미검증). i18n 코어의 보간 로직 자체는 별도 유닛에서 커버될 수 있으나, 이 컴포넌트가 올바른 키·파라미터 쌍을 넘기는지(예: `email` 대신 `workspace` 를 잘못 넘기는 버그)는 이 mock 구조로는 검출되지 않는다.
  - 제안: 최소 1개 테스트에서 `translate` mock 을 실제 보간 흉내(예: `(_l, k, p) => p ? \`${k}:${JSON.stringify(p)}\` : k`)로 바꿔 `meta.email`/`meta.workspaceName` 이 올바르게 전달되는지 확인, 혹은 실제 `translate` 구현을 사용(unmock)하는 별도 케이스 추가.

- **[INFO]** register-form 신규 리다이렉트 테스트가 "폼 비노출/비활성화"까지는 확인하지 않음
  - 위치: `codebase/frontend/src/components/auth/__tests__/register-form.test.tsx:983-1001` (새 테스트 "redirects an already-logged-in user...")
  - 상세: `router.replace` 호출만 assert 하고, redirect 가 트리거된 후에도 회원가입 폼(제출 버튼 등)이 여전히 렌더되어 사용자가 실수로 상호작용할 수 있는지는 검증하지 않는다. 실제 라우팅은 Next.js 레이어에서 페이지 전환을 수행하므로 컴포넌트 자체가 렌더를 멈출 필요는 없을 수 있지만(구현도 그렇게 되어있지 않음 — effect 만 실행하고 return 없이 정상 렌더 계속), 이 부분이 의도적 설계인지 테스트로 명시해두지 않으면 이후 "redirect 중에는 폼 숨김" 요구사항이 추가될 때 회귀 판단 기준이 없다.
  - 제안: 필수는 아니나, 현재 동작(리다이렉트 트리거 후에도 폼이 그대로 노출됨)이 의도라면 주석 또는 테스트로 명시. 화면 깜빡임(redirect 전 폼 노출) 이 UX 이슈라면 별도 이슈로 분리 고려.

- **[INFO]** `encodeURIComponent` 적용된 토큰 값에 대한 엣지케이스 테스트 부재
  - 위치: `register-form.tsx:109-113` (`router.replace(\`/invitations/accept?token=${encodeURIComponent(invitationToken)}\`)`), 대응 테스트는 `"tok-9"` 처럼 인코딩이 필요 없는 단순 문자열만 사용
  - 상세: 토큰에 `+`, `/`, `=` 등 URL-unsafe 문자가 포함될 수 있는 base64/JWT 형태라면 `encodeURIComponent` 처리 결과가 테스트 기대값과 달라질 수 있다. 현재 테스트는 인코딩이 항등(identity)인 값만 사용해 인코딩 로직 자체는 사실상 미검증 상태다.
  - 제안: 인코딩이 실제로 값을 바꾸는 토큰(예: `"tok+9/x"`) 으로 한 번 더 검증해 `%2B`, `%2F` 등이 정확히 반영되는지 확인.

- **[INFO]** `fetchedRef` 재진입 가드(React StrictMode 이중 마운트) 테스트 부재
  - 위치: `accept-invitation-content.tsx:53-55` (`if (!token || fetchedRef.current) return; fetchedRef.current = true;`)
  - 상세: 이 가드는 개발 모드 StrictMode 의 effect 이중 실행이나 `token` 이 동일한 채 리렌더될 때 `getByToken` 이 중복 호출되지 않도록 막기 위한 것으로 보이는데(구 코드의 `calledRef` 패턴 계승), 리렌더를 유발해 `mockGetByToken` 이 정확히 1회만 호출됨을 확인하는 테스트가 없다. 로직상 위험도는 낮지만(가드 자체가 단순), 회귀 시(예: 가드 제거) 조용히 중복 API 호출이 발생할 수 있다.
  - 제안: 우선순위 낮음. 필요 시 `rerender()` 후 `mockGetByToken` 호출 횟수가 여전히 1인지 확인하는 테스트 추가.

- **[INFO]** 테스트 격리는 양호하나 `useAuthStore`/`useLocaleStore` 실제 스토어 공유에 대한 주의
  - 위치: `register-form.test.tsx:821-830` (`beforeEach` 에서 `useLocaleStore.setState(...)`, `useAuthStore.setState(...)` 로 실제 zustand 스토어 상태를 리셋)
  - 상세: `register-form.test.tsx` 는 `useAuthStore`/`useLocaleStore` 를 mock 하지 않고 실제 zustand 싱글턴을 사용한다(반면 `accept-invitation-content.test.tsx` 는 전체 mock). 이는 실제 동작에 더 가깝다는 점에서 긍정적이지만, 다른 테스트 파일이 동일 프로세스(vitest worker) 내에서 같은 싱글턴 스토어를 건드리는 경우 격리가 깨질 잠재적 위험이 있다(현재는 `beforeEach` 리셋이 있어 안전). 두 파일이 스토어를 다루는 방식(mock vs 실스토어)이 일관되지 않다는 점만 참고로 남긴다 — 결함은 아니며, 두 접근 모두 각자 맥락에서 합리적이다.
  - 제안: 조치 불필요. 향후 auth-store 관련 테스트를 추가할 때 이 파일이 실스토어를 건드린다는 점을 인지하고 `afterEach` 리셋 여부를 확인할 것(현재는 각 테스트 앞에 `beforeEach` 리셋이 있어 순서 의존성 없음).

- **[INFO]** "success" 상태(수락 성공 후 토스트 + 1.5초 뒤 리다이렉트) 최종 UI 텍스트 미검증
  - 위치: `accept-invitation-content.tsx:88-91` (`setStatus("success"); toast.success(...); setTimeout(() => router.push("/dashboard"), 1500);`), 대응 테스트 "accepts only after the button is clicked"
  - 상세: 해당 테스트는 `mockAccept` 가 호출됨만 확인하고 종료한다. `status === "success"` 렌더 결과("redirectingDashboard" 문구)나 `toast.success` 호출, 1.5초 뒤 `router.push("/dashboard")` 트리거는 검증하지 않는다(이 로직 자체는 리팩터 전부터 있던 기존 코드이므로 회귀 위험은 낮지만, 새 버튼 클릭 플로우와 결합된 이후 이 종단 동작이 계속 유효한지 명시적으로 고정해두면 좋다).
  - 제안: `vi.useFakeTimers()` 로 1500ms 를 진행시켜 최종 `mockPush("/dashboard")` 호출까지 확인하는 케이스를 추가(선택적, 우선순위 낮음).

## 요약

이번 변경은 §1.5.3 초대 수락 확인 UI 재작성(자동수락 → 이메일 일치 시 버튼 클릭 수락 / 불일치 시 안내+로그아웃)과 그 진입 경로(로그인 상태의 사용자가 `/auth/register?invitationToken=` 로 들어왔을 때 `/invitations/accept` 로 redirect)를 다루며, 두 컴포넌트 모두에 대해 새 브랜치(정상 매치·불일치·로그아웃·만료/무효 토큰·토큰 부재·redirect)를 고르게 커버하는 신규/추가 테스트가 동반되었다. 전반적으로 mock 구조가 명확하고 각 `it` 이 하나의 시나리오에 집중해 가독성이 좋으며, `beforeEach` 리셋으로 테스트 간 격리도 잘 되어 있다. 다만 새로 도입된 두 번째 에러 경로(버튼 클릭 후 `handleAccept` 실패)와 `handleLogout` 의 로그아웃 API 실패(catch swallow) 경로처럼, 리팩터가 실제로 추가한 분기 중 일부가 테스트로 고정되지 않았고, `translate` mock 이 파라미터 보간을 완전히 우회해 `{{email}}`/`{{workspace}}` 삽입 오류를 검출하지 못하는 구조적 갭이 있다. 이들은 대부분 WARNING/INFO 수준으로, 현재 기능 자체를 막을 정도는 아니지만 회귀 방지 관점에서 보완 가치가 있다.

## 위험도

LOW
