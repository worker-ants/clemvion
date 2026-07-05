# 부작용(Side Effect) Review — register-form redirect effect (has_session cookie)

## 리뷰 범위

`codebase/frontend/src/components/auth/register-form.tsx` 신규 `useEffect`(L104-124) — 이미 로그인한 사용자가 초대 링크로 register 폼에 진입 시 `document.cookie` 의 `has_session` 힌트로 세션을 감지해 `/invitations/accept?token=` 로 `router.replace`.

## 발견사항

- **[INFO]** 쿠키는 읽기 전용 — 새 쓰기 부작용 없음
  - 위치: `register-form.tsx` L115-119 `document.cookie.split("; ").includes("has_session=1")`
  - 상세: 코드베이스 전체에서 `has_session` 을 grep 한 결과, 쓰기(set/clear)는 `lib/stores/auth-store.ts` L36(`login` 성공 시 set)·L45(`logout` 시 clear) 두 곳뿐이며 이번 diff 로 변경되지 않았다. `proxy.ts` L35 는 서버 미들웨어에서 동일 쿠키를 `request.cookies.get`으로 읽어 라우팅에 쓰는 기존 신호이고, 이번 신규 effect 는 그 클라이언트 측 대응(read-only)이다. 새로운 전역 상태 변경, 새 전역 변수, 새 쿠키 키 도입은 없다.

- **[INFO]** SSR 안전성 확인 — `typeof document !== "undefined"` 가드 적절
  - 위치: L117
  - 상세: 이 코드는 `useEffect` 내부이므로 클라이언트 마운트 후에만 실행되어 이 가드 자체는 실질적으로 항상 true 다(Next.js 는 effect 를 서버에서 실행하지 않음). 다만 방어적 가드로서 무해하며, 프로젝트의 다른 `document.cookie` 사용처(`auth-store.ts`, `proxy.ts` 는 서버 `request.cookies` 사용)와 비교해도 안전한 패턴 — hydration mismatch 나 SSR 크래시를 유발하지 않는다.

- **[INFO]** deps 배열 — `[invitationToken, router]` 정확
  - 위치: L124
  - 상세: effect 본문이 참조하는 자유 변수는 `invitationToken`(prop)과 `router`(`useRouter()`) 뿐이며 둘 다 deps 에 포함되어 있어 exhaustive-deps 위반이 없다. `router` 는 Next.js App Router 에서 안정적 참조(재렌더 시 동일 identity)이므로 매 렌더 재실행 루프 위험 없음. `document` 는 전역 브라우저 객체라 deps 대상이 아니다. 이 effect 는 상태를 setState 하지 않고 `router.replace` 호출뿐이라, 반복 트리거되어도 동일 URL 로의 `replace` 재호출 이상의 부작용은 없다(멱등).

- **[INFO]** `router.replace` 호출은 새로운 네비게이션 부작용이지만 범위 내 의도된 것
  - 위치: L120-122
  - 상세: `router.push` 가 아닌 `router.replace` 를 사용해 브라우저 히스토리에 register 페이지 항목을 남기지 않는다 — 뒤로가기 시 register 폼으로 되돌아가는 혼란을 방지하는 적절한 선택. 외부 서비스 호출이나 서버 API 콜은 이 effect 에 없음(순수 클라이언트 라우팅). 리다이렉트 대상(`/invitations/accept`)의 `AuthProvider` 가 세션 재검증을 수행하므로(주석에 명시), stale 쿠키로 인한 오탐(실제 미로그인인데 이 effect 가 오판)이 있어도 최종 인가는 안전하게 재확인된다.

- **[INFO]** 언마운트 후 setState 없음 — cleanup 불필요
  - 위치: L104-124 전체
  - 상세: 동일 컴포넌트의 바로 아래 있는 토큰 메타 조회 effect(L126-149)는 비동기 fetch 후 `setInvitationState` 를 호출하므로 `cancelled` 플래그+cleanup 이 필요하지만, 이번 신규 effect 는 동기 쿠키 읽기 + `router.replace` 호출뿐이라 비동기 갭이 없어 unmount 후 setState 경합이 원천적으로 발생하지 않는다. RESOLUTION.md 에 기록된 이전 WARNING(accept page 쪽 메타 effect cleanup 부재)은 별개 파일(`accept-invitation-content.tsx`)의 이슈이며 이번 register-form effect 에는 해당하지 않는다.

- **[INFO]** 테스트 커버리지로 회귀 방지 확인
  - 위치: `register-form.test.tsx` L92-93(쿠키 정리) L104-121(신규 케이스), `beforeEach` 에 `document.cookie = "has_session=; max-age=0; path=/"` 추가로 테스트 간 쿠키 상태 누수 방지.
  - 상세: `mockReplace` mock 을 새로 도입(`useRouter` mock 확장)해 `router.replace` 가 올바른 URL 로 호출되는지 검증한다. 테스트 자체가 `document.cookie` 를 직접 조작하는 것은 jsdom 테스트 환경 내에서의 격리 조치이며 프로덕션 부작용과 무관하다.

## 요약

신규 effect 는 `document.cookie` 를 읽기만 하고 쓰지 않으며, 쓰기는 기존 `auth-store.ts` login/logout 경로에만 존재해 이번 변경으로 새로운 쓰기 부작용이 도입되지 않았다. deps 배열(`[invitationToken, router]`)은 effect 가 참조하는 모든 자유 변수를 정확히 포함하고, `router` 의 안정적 참조 덕분에 재실행 루프 위험도 없다. `typeof document !== "undefined"` 가드는 SSR 크래시를 예방하는 안전한 방어 코드이며, effect 자체가 클라이언트 전용 `useEffect` 안에 있어 SSR 시점에는 어차피 실행되지 않는다. 비동기 갭이 없어 unmount 후 setState 경합도 없고, 함수/컴포넌트 시그니처·공개 API·환경 변수·네트워크 호출에 대한 변경도 없다(순수 클라이언트 라우팅 리다이렉트). 테스트가 쿠키 상태를 매 케이스마다 격리해 회귀도 잘 방지되어 있다. 부작용 관점에서 실질적 리스크는 발견되지 않았다.

## 위험도

NONE
