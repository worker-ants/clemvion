# 부작용(Side Effect) Review — invite-accept-confirm-ui (재검토, 15_33_01)

## 검증 대상

이전 라운드(15_20_19) side_effect WARNING#1 — `accept-invitation-content.tsx` 의 토큰 메타 조회
`useEffect` 에 unmount cleanup 부재 — 이 `cancelled` 플래그 + cleanup 으로 수정되었는지 검증.

## 검증 결과

`codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` L52-78 확인.

```tsx
useEffect(() => {
  if (!token || fetchedRef.current) return;
  fetchedRef.current = true;
  let cancelled = false;
  const currentLocale = useLocaleStore.getState().locale;
  (async () => {
    try {
      const m = await invitationsApi.getByToken(token);
      if (cancelled) return;
      setMeta(m);
      const userEmail = useAuthStore.getState().user?.email;
      setStatus(userEmail && userEmail === m.email ? "ready" : "mismatch");
    } catch (err) {
      if (cancelled) return;
      const error = err as AxiosError<{ message?: string }>;
      setErrorMessage(...);
      setStatus("error");
    }
  })();
  return () => {
    cancelled = true;
  };
}, [token]);
```

- 성공 경로(`setMeta`, `setStatus("ready"|"mismatch")`) 와 실패 경로(`setErrorMessage`, `setStatus("error")`) 모두
  await 직후 `if (cancelled) return;` 가드가 선행되어, unmount 후 컴포넌트 인스턴스에 대한 setState 는 발생하지 않는다.
- cleanup 함수(`return () => { cancelled = true; }`)가 정상 등록되어 있고, effect 의 유일한 async 진입점
  (`invitationsApi.getByToken`) 을 정확히 감싼다 — 부분 커버리지(예: 성공 분기만 가드) 문제 없음.
- `codebase/frontend/src/components/auth/register-form.tsx` L116-137 의 기존 meta 조회 effect 와 구조가
  동일(같은 `cancelled` 로컬 변수명, 같은 위치의 조기 return, 동일한 cleanup 반환 형태) — 커밋 코멘트가 주장하는
  "register-form 패턴과 동일" 이 실제로 일치함을 확인했다.
- `fetchedRef.current = true` 가 `cancelled` 선언보다 먼저 실행되므로, StrictMode 이중 마운트/재마운트 시에도
  중복 fetch 는 여전히 `fetchedRef` 로 차단되고, 남은 in-flight 요청은 `cancelled` 가드로 무해화된다 — 두 가드가
  서로 다른 문제(중복 호출 방지 vs unmount 후 setState 방지)를 각각 담당해 책임이 명확히 분리되어 있다.
- 신규 테스트(`accept-invitation-content.test.tsx`)에 unmount 자체를 직접 검증하는 케이스는 없으나, 이는
  WARNING 대상이 아니었던 로직(cleanup 자체는 React 표준 패턴이고 register-form 에서 이미 검증된 패턴 재사용)이므로
  크리티컬하지 않음. 필요 시 `render(...).unmount()` 후 pending promise resolve → `console.error`(setState on
  unmounted) 미발생을 assert 하는 회귀 테스트를 추가하면 향후 patch 안전성이 더 올라가지만, 현재도 실사용 경로에서
  문제를 일으키지 않는다.

이전 WARNING 은 완전히 해소된 것으로 판단한다.

## 추가 확인 (이번 라운드 diff 전체 부작용 관점)

- **[INFO]** `register-form.tsx` L105-113 신규 리다이렉트 effect 는 `router.replace(...)` 만 호출하는 동기 콜백이라
  async gap 이 없다. unmount 후 실행되어도 state 를 set 하지 않으므로 cleanup 이 불필요하며, 실제로 없다 — 문제 없음.
- **[INFO]** `handleAccept`/`handleLogout` 은 버튼 클릭으로 트리거되는 이벤트 핸들러이며 `useEffect` 가 아니다.
  React 는 언마운트된 컴포넌트에 대한 이벤트 핸들러발 setState 도 경고를 내지만, 이 흐름에서는 accept 성공 시
  `router.push`/`setTimeout` 으로 페이지 자체가 전환되는 시나리오이고 버튼 클릭 자체가 컴포넌트 존속을 전제하므로
  실무적 위험은 낮다. 기존 코드(변경 전 `accept()` 로직)에도 동일한 특성이 있었으므로 이번 diff 로 새로 도입된
  리스크는 아니다 — 회귀 아님.
- **[INFO]** `handleLogout` 의 서버 `authApi.logout()` 실패를 삼키고 클라이언트 세션(`setAccessToken(null)`,
  `useAuthStore.getState().setUser(null)`)만 정리하는 것은 직전 라운드 RESOLUTION 에서 "의도된 fallback"으로
  이미 판단됨. 전역 store(`useAuthStore`)를 직접 변경하는 부작용이지만 이는 로그아웃의 정상 목적이며 새로 도입된
  전역 변수는 아니다 — 조치 불요 판단 유지.
- **[INFO]** 두 effect(redirect effect·meta fetch effect)가 같은 `invitationToken`/`token` 변화에 각각 반응하며
  서로 다른 상태(`RegisterForm` unmount 유도 vs `AcceptInvitationContent` 내부 status)를 다루므로 상호 간섭 없음.
- 시그니처/공개 인터페이스 변경: `useSearchParams`/`useRouter` 기반 컴포넌트라 외부에서 호출하는 함수 시그니처
  변경은 없음. `AcceptInvitationContent`, `RegisterFormInner` 모두 props 변경 없음(내부 로직만 확장).
- 파일시스템·환경변수·네트워크 신규 호출: `invitationsApi.getByToken` 신규 호출은 §1.5.3 요구사항에 따른 의도된
  네트워크 호출이며, 기존 자동 `acceptInvitation` 호출을 사용자 클릭 트리거로 옮긴 것 — 부작용의 성격이 아니라
  타이밍 변경(의도된 사양 변경)이다.

## 요약

직전 라운드에서 지적된 unmount 후 setState WARNING 은 `cancelled` 플래그 + `useEffect` cleanup 반환으로 정확히
해소되었으며, 기존 `register-form.tsx` 의 동일 패턴과 구조적으로 일치한다. 성공/실패 두 분기 모두 가드가 적용되어
부분 누락도 없다. 이번 라운드에서 새로 도입된 코드(register-form 리다이렉트 effect, handleAccept, handleLogout)에는
신규 부작용 우려가 없으며, 로그아웃 실패 fallback 은 기존에 이미 검토·수용된 의도된 설계다. Critical/Warning 신규
발견 없음.

## 위험도

NONE
