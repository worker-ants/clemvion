# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `accept-invitation-content.tsx` 의 axios 에러 메시지 추출 로직이 같은 PR 의 `register-form.tsx` 헬퍼와 중복·불일치
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx:65-73`(메타 조회 `useEffect` catch), `:92-99`(`handleAccept` catch) — `error.response?.data?.message ?? translate(currentLocale, "invitations.accept.acceptFailedDefault")` 패턴이 파일 내부에서 2회 반복. 대조: `codebase/frontend/src/components/auth/register-form.tsx:48-56` `extractApiCode`/`extractApiMessage` 헬퍼가 이미 동일 문제를 해결.
  - 상세: 같은 세션·같은 기능(§1.5.3 초대 흐름)을 다루는 두 파일이 에러 메시지 추출 방식에서 갈린다. `register-form.tsx` 는 `{error, error.error}` 양쪽 shape 을 모두 살피는 `extractApiMessage` 를 쓰지만 `accept-invitation-content.tsx` 는 `error.response?.data?.message` 만 본다 — 백엔드가 `{error:{code,message}}` wrap 형태로 응답하는 케이스(register-form 상단 주석에 명시된 `GlobalExceptionFilter` 동작)에서 이 파일만 메시지를 놓칠 수 있어 단순 스타일 차이를 넘어 잠재적 버그 소지가 있다.
  - 제안: `lib/api` 또는 공용 유틸에 `extractApiMessage(err, fallback)` 을 추출해 두 파일이 공유하도록 통일. 최소한 `accept-invitation-content.tsx` 도 `error.error?.message` fallback 을 추가해 register-form 과 동일한 방어 범위를 갖추는 것을 권장.

- **[INFO]** `Status` 유니온 확장(4→7종)에 따라 JSX 조건 분기가 두 곳(CardDescription/CardContent)에 병렬로 나열되어 응집도 저하
  - 위치: `accept-invitation-content.tsx:27-34`(Status 타입 정의), `:118-130`(CardDescription 내 7개 `status === "..."` 분기), `:132-183`(CardContent 내 6개 블록 분기)
  - 상세: 상태별 텍스트(description)와 본문(body)이 물리적으로 떨어진 두 JSX 블록에 나뉘어 있어, 향후 상태를 추가/삭제할 때 두 곳을 함께 수정하지 않으면 불일치가 생기기 쉽다. 현재 7개 상태·각 블록 3~5줄 수준이라 당장 심각하진 않으나, 이번 diff 로 상태가 3종(`loading`/`ready`/`mismatch`) 늘며 분기 나열이 더 길어졌다.
  - 제안: 필수는 아니나 상태가 더 늘어날 경우 `Record<Status, { description: ReactNode; body: ReactNode }>` 맵으로 옮겨 상태별 정의를 한곳에 모으는 리팩터를 고려.

- **[INFO]** 테스트 파일 간 `vi.mock` 보일러플레이트 반복
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/__tests__/accept-invitation-content.test.tsx:6-82`(next/navigation·invitations/workspaces/auth api·auth/workspace/locale store mock 전부 인라인), `codebase/frontend/src/components/auth/__tests__/register-form.test.tsx`(유사한 store/router mock 세팅 반복)
  - 상세: 두 테스트 파일이 `useRouter`(push/replace), `useAuthStore`, `useLocaleStore` 등에 대해 유사하지만 완전히 독립적인 mock 을 각자 정의한다. 현재 2개 파일 수준에서는 문제 아니나, 같은 패턴의 컴포넌트 테스트가 늘어나면 mock 정의 변경(예: `useAuthStore` shape 변경) 시 여러 파일을 동시에 고쳐야 하는 부담이 생긴다.
  - 제안: 필수 조치 아님. 유사 mock 세팅이 3개 이상 파일로 늘어나면 `test-utils/mocks/` 류 공용 factory 추출을 고려.

- **[INFO]** `register-form.tsx` 신규 리다이렉트 `useEffect` 는 기존 관례와 일관되게 작성됨 (양호 사례로 기록)
  - 위치: `register-form.tsx:105-114`
  - 상세: `useAuthStore.getState().isAuthenticated` 를 effect 본문에서 직접 읽고 deps 에는 넣지 않는 패턴이, 바로 아래(:116-139) 기존 토큰 메타 조회 effect 의 `locale` 배제 관례와 일관되며 의도를 설명하는 주석(§1.5.3, V-09 참조)도 갖춰져 있다. 가독성·일관성 문제 없음.

- **[INFO]** `accept-invitation-content.tsx` 메타 조회 `useEffect` 의 unmount cleanup(`cancelled` 플래그)이 `register-form.tsx` 토큰 조회 effect(:116-139)와 동일 패턴으로 잘 정렬됨 (양호 사례)
  - 위치: `accept-invitation-content.tsx:52-78`
  - 상세: 이전 리뷰 라운드(15_20_19)에서 지적됐던 cleanup 부재가 이번 changeset 에서 이미 보정되어, 두 파일의 "토큰/메타 조회 → cancelled 가드" 구조가 동일한 스타일을 공유한다. 함수 길이·중첩 깊이도 적절한 범위(최대 2단계 중첩) 내에 있다.

## 요약
이번 변경은 §1.5.3 초대 수락 흐름을 상태 나열형 컴포넌트로 재구성(자동수락 제거 → 명시적 확인/불일치 안내)하고, 로그인 사용자의 초대 가입 링크 진입 시 수락 페이지로 리다이렉트하는 진입 경로를 추가한다. 함수 길이·중첩 깊이·네이밍은 기존 파일의 관례(useRef 1회성 가드, cancelled cleanup, locale 을 deps 에서 의도적으로 배제하고 주석으로 근거 명시)를 그대로 따르고 있어 전반적으로 가독성이 양호하다. 다만 같은 PR 내에서 `register-form.tsx` 는 이미 `extractApiCode`/`extractApiMessage` 공용 헬퍼로 에러 처리를 통일했음에도 `accept-invitation-content.tsx` 는 더 좁은 범위의 인라인 추출 로직을 그대로 반복하고 있어, 코드 중복을 넘어 백엔드 wrap 응답(`{error:{message}}`) 케이스를 놓칠 수 있는 잠재적 불일치가 있다. `Status` 유니온이 7종으로 늘며 JSX 조건 나열이 두 군데로 파편화되는 경향도 향후 확장 시 주의가 필요하나 현재 규모에서는 경미하다. 나머지는 모두 INFO 수준의 개선 여지이며 구조적 결함은 없다.

## 위험도
LOW
