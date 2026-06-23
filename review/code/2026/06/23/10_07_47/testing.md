# 테스트(Testing) 리뷰 결과

## 발견사항

### **[WARNING]** `web-chat-page.test.tsx`: `fireEvent` import 사용 안 됨 — 미사용 import
- 위치: `/codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx` line 57
- 상세: `fireEvent`가 import 목록에 있지만 테스트 본문에서 한 번도 사용되지 않는다. 인스턴스 선택 전환(다른 인스턴스 클릭 후 스니펫 변경), 웹채팅 만들기 다이얼로그 열기 버튼 클릭 등을 검증하기 위해 포함했다가 실제 케이스로 이어지지 않은 것으로 보인다.
- 제안: 사용하지 않는 `fireEvent` 를 제거하거나, 아래 "커버리지 갭"에서 언급한 인스턴스 전환 시나리오 테스트에 실제로 활용한다.

---

### **[WARNING]** `web-chat-page.test.tsx`: 인스턴스 전환(두 번째 인스턴스 클릭) 시 스니펫 변경 미검증
- 위치: `/codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx`
- 상세: 현재 테스트는 첫 번째 인스턴스가 자동 선택되어 스니펫에 `endpointPath`가 표시됨만 검증한다. `page.tsx`의 핵심 로직인 "다른 인스턴스 클릭 → `selectedId` 변경 → 스니펫 내 `endpointPath` 교체"는 테스트되지 않는다. `useAppearanceDraft` 의 `loadedId !== instanceId` 분기(인스턴스 전환 시 draft 리셋)도 이 경로로만 도달할 수 있어 함께 미커버된다.
- 제안: `fireEvent.click`으로 두 번째 인스턴스를 선택 후 스니펫이 해당 인스턴스의 `endpointPath`를 포함하는지 검증하는 케이스를 추가한다.

---

### **[WARNING]** `web-chat-page.test.tsx`: API 오류 상태(`isError`) 렌더링 미검증
- 위치: `/codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx`
- 상세: `page.tsx`에는 `{isError && <p ...>{t("webChat.list.loadError")}</p>}` 분기가 있으나 테스트에는 API 실패 케이스가 없다. `apiGetMock`이 `Promise.reject(...)` 를 반환하는 케이스가 없어 이 코드 경로는 전혀 실행되지 않는다.
- 제안: `apiGetMock.mockRejectedValue(new Error("network"))` 로 에러 케이스를 설정하고 `webChat.list.loadError` 텍스트가 화면에 나타나는지 검증하는 테스트 케이스를 추가한다.

---

### **[WARNING]** `web-chat-page.test.tsx`: 로딩 상태(`isLoading`) 중 렌더링 미검증
- 위치: `/codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx`
- 상세: 현재 테스트는 모두 `act(async () => render(...))` 로 API 응답 완료까지 기다린 뒤 상태를 검증한다. 쿼리 로딩 중 `EmptyState` 가 잘못 표시되지 않는지(`!isLoading && !isError && instances.length === 0` 조건이 loading 중에는 false 여야 함) 검증하는 케이스가 없다.
- 제안: `apiGetMock`으로 해결하지 않는 Promise를 반환하거나 `QueryClient`의 `staleTime` 조작을 활용해 로딩 중 상태를 확인한다. 혹은 이 분기가 이미 `retry: false` 설정 하에 React Query 동작으로 충분히 보장된다고 문서로 명시한다.

---

### **[INFO]** `snippet-input.test.ts`: `splitSuggestions` 직접 테스트 없이 `draftToBootInput` 통해서만 간접 검증
- 위치: `/codebase/frontend/src/components/web-chat/__tests__/snippet-input.test.ts`
- 상세: `splitSuggestions`는 `snippet-input.ts` 내 private 함수이므로 직접 테스트할 수 없다. 현재 테스트는 줄바꿈+공백+빈 줄 케이스를 `draftToBootInput`을 통해 검증한다. 그러나 Windows 라인엔딩(`\r\n`), 탭 문자, 제어 문자 등의 엣지 케이스는 누락되어 있다.
- 제안: `suggestions: "질문1\r\n질문2\n"` 형태의 CRLF 케이스를 추가한다(플랫폼 간 붙여넣기 시나리오).

---

### **[INFO]** `snippet.test.ts`: `buildBootConfig` — `appearance.position` undefined 시 `pruneObject` 동작 미검증
- 위치: `/codebase/frontend/src/lib/web-chat/__tests__/snippet.test.ts`
- 상세: `buildBootConfig`의 `pruneObject` 는 값이 `undefined`인 키만 제거한다. `appearance: { position: undefined, primaryColor: "" }` 입력에서 `pruneObject` 후 `appearance` 자체가 제거되는지 테스트가 없다. `cleanString("")` → `undefined` 이후 `{ primaryColor: undefined, position: undefined }` → `pruneObject` → `undefined` 경로의 커버리지가 공백 문자열 primary color에 대해 gap이 있다.
- 제안: `appearance: { primaryColor: "  ", position: undefined }` 케이스에서 `cfg.appearance`가 undefined/누락되는지 검증하는 케이스를 추가한다.

---

### **[INFO]** `use-appearance-draft.ts`: localStorage 관련 단위 테스트 부재
- 위치: `/codebase/frontend/src/components/web-chat/use-appearance-draft.ts`
- 상세: `useAppearanceDraft` 훅의 핵심 기능인 "인스턴스별 localStorage 보존/복원", "localStorage 파싱 오류 시 DEFAULT_DRAFT 폴백", "쿼터 초과 시 setDraft 예외 무시" 경로에 대한 전용 테스트가 없다. `snippet-input.test.ts`는 `DEFAULT_DRAFT`를 import해 사용하지만 훅 자체는 테스트하지 않는다.
- 제안: `renderHook`을 사용하고 `vi.stubGlobal("localStorage", ...)` 또는 `localStorage` 직접 조작으로 저장/복원 동작과 오류 경로를 테스트하는 케이스를 추가한다. 단, 증분 1의 localStorage 보존 자체가 "editor convenience" 기능으로 규정되어 있고 백엔드 미저장이라면 INFO 수준으로 판단했다.

---

### **[INFO]** `create-web-chat-dialog.tsx`: 테스트 없음
- 위치: `/codebase/frontend/src/components/web-chat/create-web-chat-dialog.tsx`
- 상세: `CreateWebChatDialog`는 워크플로우 드롭다운 선택, 이름 입력 유효성 검사(`canSubmit`), API 성공 시 `onCreated` 콜백 호출, API 오류 시 toast.error 표시, 워크플로우 없음(`noWorkflows`) 안내 등 여러 인터랙션 경로를 가진다. 현재 `web-chat-page.test.tsx`에서도 다이얼로그 내부 동작은 검증하지 않는다.
- 제안: 다이얼로그를 격리해 `render` 후 워크플로우 선택/이름 입력/제출 성공·실패 케이스를 검증하는 테스트를 추가한다. 우선순위는 `canSubmit` 조건과 `onCreated` 콜백 전달이다.

---

### **[INFO]** `appearance-builder.tsx`: 테스트 없음
- 위치: `/codebase/frontend/src/components/web-chat/appearance-builder.tsx`
- 상세: `AppearanceBuilder` 컴포넌트는 6개 필드(색상, 위치, 헤더, 환영 문구, 추천질문, 고지) 변경 이벤트를 `onChange` 콜백으로 위임한다. 현재 단위 테스트가 없다. 단순 프레젠테이션 컴포넌트에 가깝고 로직이 `snippet-input.ts` 쪽으로 분리되어 있어 위험도는 낮지만, `position` select onChange 시 `as WebChatDraft["position"]` 타입 캐스팅이 실제로 잘못된 값을 전달하지 않는지 smoke 테스트는 유용하다.
- 제안: 필드 변경 시 `onChange` 가 올바른 patch key로 호출되는지 검증하는 최소 smoke 테스트를 추가한다. 증분 1 범위에서는 INFO 수준.

---

### **[INFO]** `web-chat-page.test.tsx`: `admin` 역할 RBAC 미검증
- 위치: `/codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx`
- 상세: 현재 테스트는 `viewer`(버튼 숨김)와 `editor`(버튼 노출) 두 가지 역할만 검증한다. `RoleGate minRole="editor"` 기준에서 `admin` 역할도 editor 이상이므로 버튼이 보여야 하는데 이 케이스가 없다.
- 제안: `admin` 역할에서도 "New web chat" 버튼이 표시되는 케이스를 추가한다. 낮은 위험도이나 RBAC 경계값 완성도를 위해 권장한다.

---

### **[INFO]** `widget-base.test.ts`: `getWidgetBase` SSR 환경(`window` undefined) + CDN override 조합 누락
- 위치: `/codebase/frontend/src/lib/web-chat/__tests__/widget-base.test.ts`
- 상세: `getWidgetBase`는 `NEXT_PUBLIC_WIDGET_CDN_BASE` 설정 시 window 존재 여부와 무관하게 CDN URL을 반환한다. 이미 `isWidgetHostingConfigured` 테스트에서 이 조합을 부분적으로 다루지만, `getWidgetBase` 자체에서 SSR + CDN override 경로가 직접 테스트되지 않는다.
- 제안: `vi.stubGlobal("window", undefined)` + CDN env 설정 상태에서 `getWidgetBase()`가 CDN URL을 반환하는지 검증하는 케이스를 추가한다. `getWidgetLoaderUrl`/`getWidgetAppUrl` 에도 동일하게 적용한다.

---

## 요약

전반적으로 테스트 구조는 양호하다. 핵심 유틸리티(`snippet`, `widget-base`, `snippet-input`)에 대한 순수 함수 단위 테스트가 명확하게 구성되어 있고, 페이지 레벨에서 인스턴스 필터링·스니펫 포함·RBAC 핵심 경로를 커버한다. 가장 큰 갭은 `web-chat-page.test.tsx`에서 API 에러 상태(`isError` 분기)와 인스턴스 전환(두 번째 인스턴스 클릭) 동작이 미검증된 점이다. `CreateWebChatDialog`는 인터랙션이 있는 컴포넌트임에도 전용 테스트가 없고, `useAppearanceDraft`의 localStorage 동작도 테스트 공백으로 남아있다. `fireEvent` 미사용 import는 테스트 완성 여부의 신호로 해석할 수 있어 인스턴스 전환 케이스 추가가 권장된다.

## 위험도

MEDIUM
