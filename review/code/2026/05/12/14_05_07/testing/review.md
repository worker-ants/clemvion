## 발견사항

---

### [WARNING] 빈 문자열 `invitationToken` 미처리 — `register/page.tsx`
- **위치**: `register/page.tsx` line 13
- **상세**: URL이 `/register?invitationToken=` (빈 쿼리스트링)일 경우 `params.invitationToken`은 `""`(빈 문자열)이 되고, 그대로 `RegisterForm`에 전달됩니다. `useEffect` 내 `if (!invitationToken) return` 가드는 빈 문자열을 truthy로 평가하지 않으므로 통과되지 않지만, 빈 문자열이 전달되면 `invitationsApi.getByToken("")` API 호출이 발생할 수 있습니다.
- **제안**: 서버 컴포넌트에서 빈 문자열을 `undefined`로 정규화하는 테스트 추가, 그리고 코드에 `invitationToken={params.invitationToken || undefined}` 처리 필요

---

### [WARNING] `InvitationState` 상태 머신 분기에 대한 단위 테스트 부재 — `register-form.tsx`
- **위치**: `register-form.tsx` lines 59–96 (useEffect), lines 218–248 (invitationBanner IIFE)
- **상세**: 4가지 상태(`none` / `loading` / `ready` / `error`)에 따라 배너 렌더링, `emailReadOnly`, OAuth 버튼 표시 여부, 폼 prefill 동작이 모두 달라집니다. 특히 아래 분기가 테스트되지 않으면 회귀에 취약합니다:
  - HTTP 410 → `invitationGone` 메시지
  - HTTP 404 → `invitationNotFound` 메시지
  - 기타 오류 → `response.data.message ?? invitationFetchFailed`
  - `ready` 상태에서 `setValue("email", ...)` 호출 여부 (두 번째 useEffect)
  - `cancelled = true` cleanup이 실제로 setState를 막는지
- **제안**: `invitationsApi.getByToken`을 mock하여 각 상태 전이별 렌더링 스냅샷 테스트 또는 RTL(React Testing Library) 단위 테스트 추가

---

### [WARNING] `onSubmit`의 `accessToken` 분기 테스트 누락 — `register-form.tsx`
- **위치**: `register-form.tsx` lines 175–195
- **상세**: 응답에 `accessToken`이 있으면 자동 로그인 후 `/dashboard`로 이동, 없으면 `/verify-email`로 이동하는 두 경로가 존재합니다. `setAccessToken` 호출 여부, `router.push` 목적지, toast 메시지 종류 모두 분기에 따라 달라지며, 이 흐름 전체가 테스트 사각입니다.
- **제안**: `authApi.register`를 mock하여 (a) `accessToken` 있음 / (b) `accessToken` 없음 / (c) `code === "invitation_email_mismatch"` 에러 세 케이스의 단위 테스트 추가

---

### [WARNING] `expired` 계산의 경계값 테스트 필요 — `workspace/settings/page.tsx`
- **위치**: `workspace/settings/page.tsx` line 479
- **상세**: 
  ```javascript
  const expired = new Date(inv.expiresAt).getTime() < invitationsQuery.dataUpdatedAt;
  ```
  `dataUpdatedAt`이 query fetch 시점이므로 동작은 의도적이나, 경계값(`expiresAt === dataUpdatedAt` 정각)은 `expired = false`로 처리됩니다. 또한 이 로직은 `invitationsQuery.data.map()` 안에 있으므로 data가 없을 때는 실행되지 않아 안전하지만, 다음을 테스트해야 합니다: 만료 1ms 전/후, 정각, `expiresAt`이 잘못된 날짜 형식일 때(NaN 반환 시 `NaN < number === false`).

---

### [WARNING] `invitationToken`이 loading 상태일 때 폼 제출 가능 — `register-form.tsx`
- **위치**: `register-form.tsx` line 285 (`Button type="submit"`)
- **상세**: 초대 메타가 fetch 중(`invitationState.kind === "loading"`)일 때 제출 버튼은 `isLoading`(API 호출 중)만 체크합니다. 사용자가 빠르게 빈 이메일로 제출하면 Zod 검증에서 막히지만, 의도된 UX가 아닙니다. 이 경우에 대한 테스트가 없습니다.
- **제안**: `invitationState.kind === "loading"` 동안 제출 버튼 비활성화 + 해당 케이스 테스트 추가

---

### [INFO] `resendMutation` 에러 핸들링 일관성 — `workspace/settings/page.tsx`
- **위치**: `workspace/settings/page.tsx` lines 337–344
- **상세**: `resendMutation`의 `onError`는 `err instanceof Error ? err.message : fallback` 패턴을 사용하나, `leaveMutation`·`deleteMutation`·`transferMutation`은 `parseApiError(err)` 로 Nest 에러 envelope를 파싱합니다. Axios 에러는 `Error` 인스턴스이므로 `err.message`는 `"Request failed with status code 400"` 같은 HTTP 레벨 메시지가 됩니다. `inviteMutation`, `revokeMutation`도 같은 패턴이므로 기존 일관성은 맞지만, 명시적 테스트로 "재발송 실패 시 사용자가 보는 메시지"를 고정해야 합니다.

---

### [INFO] `isTeamWorkspace` 초기값 false flash — `workflows/page.tsx`
- **위치**: `workflows/page.tsx` lines 49–53
- **상세**: 워크스페이스 스토어가 hydrate되기 전 `currentWorkspace`가 `undefined`이면 `isTeamWorkspace = false`로 시작했다가 hydrate 후 `true`로 바뀌어 배지가 뒤늦게 나타날 수 있습니다. 테스트에서 스토어 초기 상태(`workspaces: []`)일 때 배지가 숨겨지는지, hydrate 후 올바르게 표시되는지를 커버해야 합니다.

---

### [INFO] `invitationsApi.getByToken` 토큰 인코딩 테스트 — `workspaces.ts`
- **위치**: `workspaces.ts` line 131
- **상세**: `encodeURIComponent(token)` 처리가 있으나, base64url 토큰(`-`, `_` 포함)에 대한 API 함수 단위 테스트가 없습니다. `+`나 `/`가 포함된 일반 base64 토큰이 혼입될 경우 URL 오염이 발생할 수 있습니다.

---

### [INFO] i18n 키 동기화 검증 없음
- **위치**: `en.ts`, `ko.ts`
- **상세**: 9개의 새 키가 두 파일에 추가되었고 내용은 대응되지만, 두 locale 사이의 키 동기화를 자동으로 검증하는 테스트가 없습니다. 향후 한 쪽만 추가되면 런타임에 `undefined` 렌더링이 발생합니다.
- **제안**: `Object.keys(ko).deepEquals(Object.keys(en))` 형태의 정적 스키마 테스트 추가

---

## 요약

이번 변경의 백엔드 측은 3235개 테스트(만료/1회 사용/동시 accept 경쟁 포함)로 잘 방어되어 있으나, 프런트엔드 측은 복잡도에 비해 테스트 커버리지가 명시적으로 확인되지 않습니다. 특히 `register-form.tsx`의 `InvitationState` 4단계 상태 머신, `accessToken` 유무에 따른 이중 가입 경로, 빈 문자열 `invitationToken` 엣지 케이스가 테스트되지 않아 회귀 위험이 있습니다. `workspace/settings/page.tsx`의 `dataUpdatedAt` 기반 만료 판정 로직도 경계값 테스트가 없어 로직 변경 시 조용히 깨질 수 있습니다.

## 위험도

**MEDIUM**