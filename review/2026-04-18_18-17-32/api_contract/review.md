### 발견사항

- **[INFO]** `user.locale` 필드에 대한 API 계약 가정
  - 위치: `locale-sync.tsx:16` (`user?.locale`), `locale-store.ts` (간접적)
  - 상세: `LocaleSync`가 `useAuthStore`에서 `user.locale`을 읽어 로케일을 동기화합니다. 이는 `GET /users/me` 응답 스키마에 `locale` 필드가 포함되어 있다는 가정에 의존합니다. `isLocale(user.locale)` 타입 가드로 방어적으로 처리되어, API가 알 수 없는 값이나 `undefined`를 반환해도 기본값(`"ko"`)으로 안전하게 폴백합니다.
  - 제안: 프론트엔드 타입(`User` 인터페이스)에 `locale?: Locale`이 선언되어 있는지 확인하세요. 백엔드 응답 스키마와의 일치 여부를 Swagger 문서에서 검증하는 것을 권장합니다.

- **[INFO]** `core.ts` 분리로 서버/클라이언트 API 경계가 개선됨 (긍정적 발견)
  - 위치: `core.ts`, `index.ts`
  - 상세: `translate()` 순수 함수가 `"use client"` 없는 `core.ts`로 분리되어 Server Component에서도 사용 가능합니다. 이는 서버 사이드 API 응답 가공이나 메타데이터 생성에 번역 함수를 활용할 수 있는 기반을 제공합니다.

---

### 요약

이번 변경사항은 전적으로 프론트엔드 i18n 인프라 구성으로, 백엔드 API 엔드포인트·요청·응답 스키마에 직접적인 변경이 없습니다. API 계약 관점의 유일한 고려사항은 `GET /users/me`가 `locale` 필드를 반환한다는 가정이며, `isLocale()` 가드로 안전하게 방어되고 있습니다. 기존 클라이언트와의 하위 호환성은 유지되며, `core.ts` 분리로 향후 SSR 컨텍스트에서의 API 응답 번역 처리도 가능한 구조가 되었습니다.

### 위험도
**LOW**