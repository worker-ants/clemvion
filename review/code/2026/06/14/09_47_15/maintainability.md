# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `AuthenticationPage` 컴포넌트 크기 및 다중 책임
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` 전체
- 상세: 파일 전체가 단일 컴포넌트 함수 `AuthenticationPage` 안에 약 550줄의 JSX + 로직이 집중되어 있다. 현재 이 컴포넌트는 5개 mutation(create/toggle/regenerate/delete/reveal), 2개 query, 11개 이상의 로컬 `useState`, 5개 모달 UI(Create Dialog, Regenerate Confirmation, Reveal Password, Revealed Secret, Delete Confirmation)를 모두 책임지고 있다. §A.2 폼 신규 추가(이번 PR)로 state가 2개 더 늘어 11개가 되었으며, 앞으로 §A.3 항목(소스 IP/응답코드/기간별 호출)이 추가될 경우 더 비대해진다. 각 모달을 독립 컴포넌트로 추출하면 추가·수정 범위가 좁아지고 테스트가 쉬워진다.
- 제안: `CreateAuthConfigDialog`, `RegenerateConfirmDialog`, `RevealDialog`, `DeleteConfirmDialog` 를 별도 컴포넌트로 분리. form state와 mutation 로직은 커스텀 훅 `useCreateAuthConfig()` / `useRevealAuthConfig()` 등으로 격리 권장.

---

### [WARNING] 중복 모달 패턴 — 인라인 overlay div 반복
- 위치: `page.tsx` 내 5개 `{/* ... */}` 섹션 (`showDialog`, `regenerateTarget`, `revealTarget`, `revealedSecret`, `deleteTarget`)
- 상세: 5개 모달이 각각 `<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">` + `<div className="w-full max-w-sm/md rounded-lg border ... p-6 shadow-lg">` 패턴을 반복하고 있다. 배경 색상(`bg-black/50`), z-index(`z-50`), 내부 카드 radius/shadow 값이 5곳에 동일하게 하드코딩되어 있어, 디자인 토큰 변경 시 5곳을 모두 수정해야 한다.
- 제안: 공통 `<Modal>` 또는 `<ConfirmDialog>` UI 컴포넌트를 `@/components/ui/` 에 추출하여 오버레이 레이어를 단일 진실로 관리.

---

### [WARNING] `formApiKeyHeader` 기본값 `"X-API-Key"` 하드코딩 2곳
- 위치: `page.tsx` line 438(useState 초기값), line 586(resetForm), line 703(Input placeholder), 그리고 `authentication-form.test.tsx` line 128(기댓값)
- 상세: `"X-API-Key"` 문자열이 소스 4곳에 분산되어 있다. 백엔드 기본값이 바뀔 경우 컴포넌트·리셋 함수·placeholder·테스트를 모두 수정해야 하며 누락 위험이 있다. `"X-Hub-Signature-256"` 도 3곳(line 430, 476, 703)에 동일하게 반복된다.
- 제안:
  ```ts
  const DEFAULTS = {
    apiKeyHeader: "X-API-Key",
    hmacHeader: "X-Hub-Signature-256",
    hmacAlgorithm: "sha256",
  } as const;
  ```
  와 같은 상수 모듈로 추출하여 단일 진실 확보. 테스트는 이 상수를 import.

---

### [WARNING] `textarea` 를 `Textarea` UI 컴포넌트 대신 HTML 요소 직접 사용
- 위치: `page.tsx` (IP whitelist textarea, 신규 추가 코드)
- 상세: 프로젝트 UI 키트(`@/components/ui/`)는 `Input`, `Button`, `Label`, `Badge`, `SlideDrawer` 등 공통 컴포넌트를 사용하는 패턴인데, IP Whitelist 입력에만 `<textarea>` HTML 요소를 직접 사용하고 클래스를 인라인으로 직접 정의(`flex min-h-[72px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]`)했다. 테마 변경 시 이 인라인 CSS만 누락될 위험이 있다.
- 제안: `@/components/ui/textarea` 컴포넌트가 이미 있다면 그것을 사용하고, 없다면 `Input`/`Button`과 같은 방식으로 `Textarea` 컴포넌트를 UI 키트에 추가한 뒤 사용.

---

### [INFO] `TYPE_LABEL_KEYS` 와 `AUTH_TYPES` — 동일 매핑 중복
- 위치: `page.tsx` lines 389-401
- 상세: `AUTH_TYPES` 배열(`value → labelKey` 쌍)과 `TYPE_LABEL_KEYS` 레코드(`value → labelKey` 룩업)이 완전히 동일한 정보를 두 가지 자료구조로 중복 보관한다. 새 type 추가 시 두 곳을 모두 수정해야 한다.
- 제안:
  ```ts
  const AUTH_TYPES = [...] as const;
  const TYPE_LABEL_KEYS = Object.fromEntries(AUTH_TYPES.map(({ value, labelKey }) => [value, labelKey]));
  ```
  또는 `AUTH_TYPES` 에서 직접 `find`로 룩업하여 단일 진실 유지.

---

### [INFO] `createMutation.mutationFn` 내 config 구성 로직 — 함수 분리 필요
- 위치: `page.tsx` lines 473-499 (`mutationFn` 내부)
- 상세: `mutationFn`이 type별 분기(`if formType === "hmac"` / `if formType === "api_key"` / `if formType === "basic_auth"`)와 ipWhitelist 파싱 + API 호출을 하나의 함수 안에 포함하고 있다. 분기가 추가될 때마다 이 함수가 길어지며, 단위 테스트가 `createMutation` 전체를 mock 없이 검증하기 어렵다. 현재 `authentication-form.test.tsx` 에서는 `postMock` 으로 API 레이어를 격리하는 방식으로 우회하고 있다.
- 제안: `buildAuthConfigPayload(formState)` 를 별도 순수 함수로 추출하면 mutation 내부 복잡도 감소 + payload 변환 로직만 독립 테스트 가능.

---

### [INFO] 테스트 내 `openDialogAsApiKey` 공통 설정 — `beforeEach` vs helper
- 위치: `authentication-form.test.tsx` lines 79-83
- 상세: `openDialogAsApiKey()`는 각 테스트 본문에서 명시적으로 호출되어 의도가 명확하고, 테스트 격리(각 테스트가 독립적으로 렌더 + 열기 흐름을 수행)도 올바르다. 다만 현재 2개 test case만 존재하여 helper의 유효성이 즉시 드러나는 상황이다. 테스트 케이스가 늘면 `openDialogAsApiKey`에서 "Type을 선택한 후 추가 필드가 나타나기까지 대기"하는 비동기 처리가 누락되어 불안정해질 수 있다. `userEvent.selectOptions` 후 나타나는 필드(Header name)를 바로 접근하는 흐름이 현재는 작동하나, 렌더 타이밍에 따라 flaky해질 여지가 있다.
- 제안: `openDialogAsApiKey()` 내에 `await waitFor(() => screen.getByLabelText("Header name"))` 대기 단계를 추가하여 type 선택 후 조건부 필드 렌더를 명시적으로 기다리도록 강화.

---

### [INFO] `ipWhitelist` 파싱 — 인라인 체이닝 vs 유틸 함수
- 위치: `page.tsx` lines 276-279 (`formIpWhitelist.split("\n").map(...).filter(...)`)
- 상세: IP 파싱 로직이 mutationFn 안에 인라인으로 삽입되어 있다. 현재 규모에선 허용 수준이나, 추후 CIDR 유효성 검사 등이 추가될 경우 inplace 확장이 어렵다.
- 제안: `parseIpWhitelist(raw: string): string[]` 유틸 함수로 추출하면 추후 validation 로직 추가가 용이하고, 테스트에서 페이로드 단위 검증을 별도로 작성할 수 있다.

---

## 요약

이번 변경(§A.2 IP Whitelist 폼 + API Key Header 필드)은 기존 패턴을 충실히 따르고 있으며, i18n 양쪽 언어 동시 반영, 테스트 파일 추가, spec 구현 현황 노트 갱신까지 완비되어 있다. 그러나 `AuthenticationPage` 가 이미 대규모 god-component 상태에서 state와 모달이 2개 더 추가되었고, `"X-API-Key"` 하드코딩 분산, `textarea` 직접 사용으로 인한 UI 컴포넌트 일관성 이탈, `AUTH_TYPES`·`TYPE_LABEL_KEYS` 중복 매핑 등 누적된 구조적 문제가 있다. 당장 기능 오동작을 유발하지는 않으나, §A.3 후속 구현 시 컴포넌트 분리 없이 계속 확장하면 유지보수 비용이 빠르게 증가할 것이다. 모달 컴포넌트 분리와 상수 추출을 이번 PR 또는 직후 후속 PR에서 처리하도록 권장한다.

## 위험도

MEDIUM
