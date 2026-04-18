### 발견사항

- **[INFO]** 외부 i18n 라이브러리 미사용 — 완전 자체 구현
  - 위치: `frontend/src/lib/i18n/`
  - 상세: i18next, next-intl 등 외부 라이브러리 없이 Zustand + React 표준 훅(`useSyncExternalStore`)만으로 구현. 번들 크기 증가 없음.
  - 제안: 현 규모에서는 적절. 로케일 수가 많아질 경우 전문 라이브러리 도입 검토.

- **[INFO]** `useLocaleStore.getState()` 를 비훅 컨텍스트에서 직접 호출
  - 위치: `date.ts`, `execution-status.ts`, `verify-email-content.tsx`, `editor-loader.tsx`, `accept-invitation-content.tsx`
  - 상세: `useEffect` / 비동기 함수 내부에서 `useLocaleStore.getState().locale`를 직접 읽는 패턴 사용. 이는 React 렌더링 사이클 밖에서 스토어 스냅샷을 읽는 Zustand 공식 패턴으로, 올바른 사용.
  - 제안: 현재 패턴 유지. 다만 locale 변경 시 이미 실행 중인 비동기 toast 메시지는 이전 locale로 표시될 수 있으므로 문서화 권장.

- **[WARNING]** `date.ts`, `execution-status.ts` 에 `"use client"` 지시어 추가 및 Zustand 스토어 import
  - 위치: `frontend/src/lib/utils/date.ts:1`, `frontend/src/lib/utils/execution-status.ts:1`
  - 상세: 기존에 서버/클라이언트 무관하게 사용 가능한 순수 유틸이었는데, `useLocaleStore` 의존성 추가로 클라이언트 전용 모듈이 됨. 해당 유틸을 서버 컴포넌트나 서버사이드 로직에서 사용할 경우 빌드 오류 또는 런타임 에러 발생.
  - 제안: 두 함수 모두 `locale` 파라미터를 선택적으로 받는 구조이므로, 서버 환경에서는 반드시 명시적 locale을 전달하거나, 서버/클라이언트 버전을 분리하는 것을 권장.

- **[INFO]** `ForgotPasswordForm` 의 locale 변경 시 폼 재마운트 패턴 (`key={locale}`)
  - 위치: `frontend/src/components/auth/forgot-password-form.tsx:108-111`
  - 상세: locale 변경 시 Zod 스키마의 검증 메시지를 갱신하기 위해 `key={locale}`로 폼 컴포넌트를 강제 리마운트. `useMemo([t])`로 스키마를 재생성하나 `useForm`이 이미 초기화된 resolver를 유지하므로 리마운트가 필요한 올바른 설계.
  - 제안: 패턴 자체는 문제없으나 `login-form`, `register-form`, `reset-password-form` 등 동일 패턴이 적용되었는지 일관성 확인 필요.

- **[INFO]** 내부 모듈 의존 방향 — `utils` → `stores` 역전 가능성
  - 위치: `date.ts`, `execution-status.ts`
  - 상세: 일반적으로 `stores`가 `utils`에 의존하는 방향이 권장되나, 여기서는 `utils`가 `stores`에 의존. 순환 의존성은 현재 없으나 구조적으로 주의 필요.
  - 제안: 장기적으로는 locale을 항상 파라미터로 전달받는 순수 함수 형태를 유지하고, 스토어 접근 레이어를 상위에서 처리하는 구조가 더 견고함.

- **[INFO]** 테스트에서 `useLocaleStore.setState({ locale: "en" })` 전역 상태 리셋
  - 위치: 테스트 파일 다수 (`beforeEach` 블록)
  - 상세: 각 테스트 전 locale 상태를 명시적으로 초기화하는 올바른 패턴. 테스트 간 상태 오염 방지.
  - 제안: 현재 패턴 적절. 별도 test setup 파일에서 글로벌로 처리할 수도 있으나, 명시적 설정이 가독성면에서 더 낫다.

---

### 요약

이번 변경은 외부 i18n 라이브러리 도입 없이 Zustand와 React 표준 API만으로 다국어를 구현하였으며, 새로운 npm 패키지 의존성이 추가되지 않아 번들 크기와 공급망 리스크 측면에서 안전합니다. 주요 우려 사항은 기존의 순수 유틸리티(`date.ts`, `execution-status.ts`)가 클라이언트 전용 Zustand 스토어에 의존하게 되어 서버 컴포넌트에서의 사용이 불가해진 점으로, 이 파일들을 서버사이드에서 사용하는 코드가 있다면 확인이 필요합니다. 그 외 내부 의존성 구조는 전반적으로 적절합니다.

### 위험도

**LOW**