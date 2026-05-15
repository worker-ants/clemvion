### 발견사항

- **[INFO]** `GET /users/me` 응답 이중 경로 처리
  - 위치: `profile/page.tsx` — `res.data.data ?? res.data`
  - 상세: API 응답이 `{ data: { ... } }` 형태와 `{ ... }` 형태를 모두 허용하는 fallback 처리가 있음. 이는 서버 응답 스키마가 불일치하거나 중간 어딘가에서 래핑 방식이 혼용되고 있음을 시사한다. 신규 코드가 만든 문제가 아니라 기존 패턴의 계승이지만, 계약으로서는 ambiguous.
  - 제안: 백엔드 응답 구조를 단일 형태로 확정하고 `apiClient` 인터셉터 레이어에서 정규화 처리.

- **[INFO]** `PATCH /users/me` — name 값 trim 미처리
  - 위치: `profile-info-card.tsx` — `mutation.mutateAsync({ name })`
  - 상세: `dirty` 판정은 `(name).trim() !== (user.name).trim()` 으로 trim 비교하지만, 실제 서버로 전송되는 값은 trim되지 않은 raw `name` state. 사용자가 `"Gehrig Kim "` (후행 공백 있음)을 입력하면 dirty 판정을 통과해 공백 포함 값이 PATCH 된다.
  - 제안: `mutation.mutateAsync({ name: name.trim() })`

- **[INFO]** `onSuccess` 에서의 truthy 검사
  - 위치: `profile-preferences-card.tsx` — `if (patch.theme) setThemeStore(patch.theme)`
  - 상세: `patch.theme` 가 `Partial<{ theme: ... }>` 이므로 `undefined` 체크 의도. 현재 타입(`"light" | "dark"`)에서는 문제없지만 `in` 연산자나 `!= null` 체크가 더 명시적이다. API 계약 관점에서는 무해.

- **[INFO]** 에러 응답 테스트 미존재
  - 위치: `__tests__/profile-info-card.test.tsx`, `__tests__/profile-preferences-card.test.tsx`
  - 상세: PATCH 성공 경로만 검증. `401 Unauthorized`, `422 Unprocessable Entity`, 네트워크 실패 시 `toast.error` 호출 여부를 검증하는 테스트 케이스 없음. `change-password.test.tsx`도 동일.
  - 제안: 실패 케이스 — `apiClient.patch.mockRejectedValue(...)` + `expect(toast.error).toHaveBeenCalled()` 추가.

---

### 요약

이번 변경은 `PATCH /users/me`와 `POST /users/me/change-password` 두 엔드포인트만 사용하며, 플랜 문서 명시대로 백엔드 계약은 무변경이다. 클라이언트 측 계약 준수는 전반적으로 적절하다 — 요청 바디 구조가 테스트에 명시되어 있고, `confirmPassword` 는 서버에 전송하지 않으며, preferences PATCH 는 변경된 필드만 전송하는 올바른 partial PATCH 의미론을 따른다. 주목할 만한 약점은 name 값의 trim-before-send 누락과 기존부터 존재하던 `res.data.data ?? res.data` 이중 응답 포맷 처리 두 가지로, 모두 저위험 수준이다.

### 위험도

**LOW**