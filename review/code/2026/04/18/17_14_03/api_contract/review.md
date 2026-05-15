### 발견사항

- **[INFO]** `user.locale` 필드에 대한 API 계약 가정
  - 위치: `locale-sync.tsx:16`, `profile/page.tsx:63`
  - 상세: `LocaleSync` 컴포넌트가 `user.locale`을 읽고, `ProfilePage`가 `PATCH /users/me`에 `locale` 필드를 전송합니다. 백엔드 `GET /users/me` 응답 스키마에 `locale` 필드가 포함되어야 하며, `PATCH /users/me`도 해당 필드를 허용해야 합니다. `isLocale()` 가드로 방어적으로 처리하고 있어 API가 미지원 locale을 반환해도 안전합니다.
  - 제안: `GET /users/me` 응답 타입에 `locale?: Locale` 필드가 명시되어 있는지 확인하세요.

- **[INFO]** 에러 응답 패턴 (`error.response?.data?.message`) 일관성 유지
  - 위치: 전 파일에 걸쳐 반복
  - 상세: 모든 API 호출에서 서버 에러 메시지를 우선 사용하고 번역된 fallback 문자열로 대체하는 패턴이 일관되게 유지됩니다. 이는 기존 API 계약을 훼손하지 않습니다.

- **[INFO]** `Section` 컴포넌트에 `void t` 패턴
  - 위치: `integrations/page.tsx:370`, `void t;`
  - 상세: `t` prop이 선언되었으나 즉시 `void`로 버려집니다. 이는 i18n 미완성 상태를 나타내며, 해당 섹션 내부 텍스트가 아직 번역되지 않았음을 시사합니다. API 계약과 직접 관련은 없으나 dead prop입니다.
  - 제안: `Section` 컴포넌트 내에서 `t`를 실제로 사용하거나 prop을 제거하세요.

---

### 요약

이번 변경사항은 전적으로 프론트엔드 i18n 적용 작업으로, 백엔드 API 엔드포인트나 요청/응답 스키마를 직접 변경하지 않습니다. API 계약 관점의 유일한 주목 사항은 `/users/me` GET/PATCH 엔드포인트가 `locale` 필드를 지원한다는 가정이며, 방어적 `isLocale()` 가드로 안전하게 처리되고 있습니다. 기존 클라이언트와의 하위 호환성은 유지되며, 에러 응답 처리 패턴도 일관성이 있습니다.

### 위험도
**LOW**