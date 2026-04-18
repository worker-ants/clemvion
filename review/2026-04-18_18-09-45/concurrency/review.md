### 발견사항

- **[INFO]** 비동기 함수 내 로케일 스냅샷 타이밍
  - 위치: `verify-email-content.tsx:34`, `editor-loader.tsx:27`, `accept-invitation-content.tsx:39`
  - 상세: `async function` 시작 시점에 `useLocaleStore.getState().locale`로 로케일을 캡처한 뒤, 여러 `await` 이후에 해당 값을 사용하여 `translate()`를 호출합니다. 비동기 요청이 처리되는 동안 사용자가 로케일을 변경하면 toast/error 메시지가 이전 로케일로 표시됩니다.
  - 제안: 대부분의 경우 허용 가능한 동작이나, 메시지를 표시하는 시점에 직접 `useLocaleStore.getState().locale`을 읽도록 수정하면 보다 일관된 UX를 제공할 수 있습니다.

- **[INFO]** `"use client"` 추가로 인한 서버 사이드 사용 불가
  - 위치: `date.ts:1`, `execution-status.ts:1`
  - 상세: 두 유틸리티 파일에 `"use client"` 지시어가 추가되었습니다. 이로 인해 기존에 서버 컴포넌트나 SSR 경로에서 이 함수들을 사용하고 있었다면 빌드 오류가 발생할 수 있습니다. `useLocaleStore.getState()`는 클라이언트 전용 Zustand 스토어에 의존하므로 불가피한 변경이지만, 함수 시그니처에 `locale?` 옵션 파라미터를 두는 방식은 서버에서 명시적 로케일을 주입 가능하게 설계한 것으로 올바른 접근입니다.
  - 제안: 현재 구조(옵셔널 `locale` 파라미터)는 적절합니다. 다만 스토어에 폴백하는 `currentLocale()` 헬퍼를 호출하는 코드 경로가 서버 사이드에서 실행되지 않도록 주의가 필요합니다.

- **[INFO]** `ForgotPasswordForm` 키 기반 강제 리마운트
  - 위치: `forgot-password-form.tsx` 하단 래퍼
  - 상세: `<ForgotPasswordFormInner key={locale} />`는 로케일 변경 시 폼 컴포넌트 전체를 언마운트/리마운트합니다. 비동기 제출(`onSubmit`)이 진행 중인 상태에서 로케일이 변경되면 진행 중인 요청이 완료되기 전에 컴포넌트가 해제되어, 완료 후 상태 업데이트(`setIsLoading`, `setIsSubmitted`)가 소멸된 컴포넌트에 적용됩니다. React 18의 Strict Mode에서는 경고로 나타나고, 실제 사용 환경에서는 실질적 에러 없이 무시됩니다.
  - 제안: `onSubmit` 내에 `let mounted = true`와 같은 취소 플래그를 두거나, `AbortController`를 통해 진행 중인 요청을 취소하는 방어 코드를 추가하는 것을 고려하세요.

---

### 요약

변경사항의 핵심은 i18n 문자열 치환으로, JavaScript의 단일 스레드 특성상 전통적인 의미의 동시성 위험은 없습니다. 주요 관심사는 비동기 함수 시작 시 로케일을 스냅샷으로 캡처하는 패턴으로, await 구간 사이에 사용자가 로케일을 변경하면 toast/에러 메시지가 이전 언어로 표시될 수 있는 경미한 UX 불일치입니다. 이는 실제 버그보다는 설계상 트레이드오프에 해당합니다. `"use client"` 추가와 키 기반 리마운트 패턴은 의도된 동작이나 각각의 제약을 인지하고 있어야 합니다.

### 위험도
**LOW**