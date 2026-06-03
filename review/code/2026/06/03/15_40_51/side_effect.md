# 부작용(Side Effect) 리뷰 결과

분석 대상: `PATCH/GET /api/workspaces/:id/settings` — `interactionAllowedOrigins` 편집 API + UI

---

## 발견사항

### [WARNING] `updateWorkspaceSettings`: `workspace.settings` 객체 직접 변형 — 얕은 머지로 기존 키 누락 가능
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateWorkspaceSettings()` (라인 302–305)
- 상세: `workspace.settings = { ...(workspace.settings ?? {}), interactionAllowedOrigins: normalized }` 패턴은 settings 가 JSONB 컬럼으로 DB에서 로드된 객체를 1단계 얕은 스프레드로 복사한다. 현재 저장되는 설정 키가 `interactionAllowedOrigins`, `timezone` 등 모두 평탄한(flat) JSONB 구조라면 문제없다. 그러나 향후 settings 에 중첩 객체(nested object) 키가 추가될 경우 이 얕은 머지는 중첩 키의 내부를 교체(덮어쓰기)하게 된다. 현재로서는 실제 부작용 없으나 설계 상 fragile 하다.
- 제안: 주석 또는 타입 수준에서 "settings JSONB는 flat 구조만 허용" 제약을 명시하거나, 향후 중첩 확장 시 deep merge 전략으로 교체 예정임을 문서화.

### [WARNING] `updateSettings` API 클라이언트 반환 타입이 `Promise<void>` — 응답 body `data`(workspace 전체)를 버림
- 위치: `codebase/frontend/src/lib/api/workspaces.ts` — `updateSettings()` (라인 29–33)
- 상세: 백엔드 `PATCH /:id/settings`는 `{ data: { id, name, type, slug, settings } }` 형태의 workspace 전체를 반환한다. 프론트엔드 API 클라이언트는 `await apiClient.patch(...)` 결과를 반환하지 않고 버린 채 `Promise<void>`로 선언했다. 이에 따라 `saveMutation.onSuccess` 콜백에서 응답으로 로컬 `origins` 상태를 갱신하지 않고, 대신 `queryClient.invalidateQueries(["workspace-settings", workspaceId])`로 리페치한다. 기능적으로는 동작하나, 저장 직후 서버가 정규화한 값(trailing slash 제거 등)을 즉시 반영하려면 응답 body를 활용해야 한다. 현재 구현은 invalidate → refetch 경로를 거치므로, 네트워크 순서에 따라 짧은 순간 stale 값이 표시될 수 있다.
- 제안: 반환 타입을 `Promise<{ interactionAllowedOrigins: string[] }>` 또는 workspace shape으로 변경하거나, 현재 void 방식이 의도적이라면 주석으로 명시.

### [INFO] `EmbedOriginsCard` — `key` remount 전략이 `queryClient.invalidateQueries` 와 이중 상태 갱신 발생 가능
- 위치: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` — `EmbedOriginsCard` (라인 581–596)
- 상세: `saveMutation.onSuccess`에서 `queryClient.invalidateQueries(["workspace-settings", workspaceId])`를 호출하면 `settingsQuery`가 재실행되고 `settingsQuery.isSuccess`가 `pending` → `loaded` 사이클을 거친다. `EmbedOriginsCard`의 `key`가 `${workspaceId}:${settingsQuery.isSuccess ? "loaded" : "pending"}`이므로, 저장 성공 후 query가 `loading` 상태를 경유하는 순간 key가 `"loaded"` → `"pending"` → `"loaded"` 로 두 번 변경돼 `EmbedOriginsEditor`가 두 번 remount될 수 있다. 저장 후 잠깐 빈 목록(initialOrigins=[])이 렌더될 수 있어 UX 깜박임이 발생할 가능성이 있다.
- 제안: `settingsQuery.isSuccess` 대신 `settingsQuery.data !== undefined` 또는 `settingsQuery.isFetchedAfterMount` 조건으로 key 계산을 안정화하거나, invalidate 대신 `queryClient.setQueryData`로 캐시를 직접 업데이트하는 방식 검토.

### [INFO] `EmbedOriginsEditor` — `origins` 로컬 상태가 `initialOrigins` prop 변경을 반영하지 않음
- 위치: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` — `EmbedOriginsEditor` (라인 604–742)
- 상세: `useState<string[]>(initialOrigins)`는 컴포넌트 마운트 시 한 번만 실행된다. 이 컴포넌트는 `EmbedOriginsCard`의 `key` 변경으로 remount되는 전략을 사용하고 있으며, 코드 주석도 이를 명시한다. 의도적 설계이므로 부작용은 아니나, `key` 기반 remount가 실패하거나 동일 key로 re-render되는 경우(가령 workspaceId가 동일하고 settingsQuery 상태가 변하지 않는 시나리오) `initialOrigins`가 바뀌어도 `origins` 상태는 갱신되지 않는다. 현재 코드에서 이 경로는 발생하지 않지만 취약점으로 기록.
- 제안: 현재 key remount 전략은 적절하나 주석에 "key 변경으로만 초기화됨 — prop 변경은 반영 안 됨" 위험을 명시해두면 향후 유지보수 시 실수를 방지.

### [INFO] 새 글로벌 모듈 변수 `ORIGIN_PATTERN` — 프론트엔드에 모듈 수준 상수 추가
- 위치: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` — 라인 567
- 상세: `const ORIGIN_PATTERN = /^https?:\/\/[^/\s?#]+$/i;` 가 모듈 수준에 추가된다. 파일 내부에서만 사용되는 지역 상수이며 전역 오염은 없다. 백엔드 DTO의 동일 패턴(`/^https?:\/\/[^/\s?#]+$/i`)과 동일하게 유지되어 있으므로 검증 로직 불일치 부작용 없음. INFO 수준으로 기록만 함.

### [INFO] `workspacesApi.updateSettings` — `void` 반환으로 인한 오류 처리 표면 제한
- 위치: `codebase/frontend/src/lib/api/workspaces.ts` — 라인 29–33
- 상세: `apiClient.patch(...)` 호출 자체는 비동기 네트워크 호출이므로 오류 발생 시 예외를 throw한다. `useMutation`의 `onError` 콜백에서 `parseApiError`로 처리하므로 오류 처리 누락은 없다. 단, 반환값이 `void`이므로 호출자가 응답 body를 사용하고 싶을 때 API 클라이언트를 수정해야 하는 인터페이스 제약이 생긴다.

---

## 요약

이 변경은 기존 workspaces 모듈에 두 개의 새 엔드포인트(`PATCH /:id/settings`, `GET /:id/settings`)와 그에 대응하는 프론트엔드 UI/API 클라이언트를 추가한다. 전역 변수 도입·파일시스템 부작용·예상 밖 네트워크 호출·이벤트/콜백 변경은 없다. 기존 함수 시그니처나 공개 API 계약에 대한 파괴적 변경도 없다. 주요 부작용 위험은 두 가지다: 첫째, `workspace.settings`에 대한 얕은 머지 패턴은 현재 flat JSONB 구조에서는 안전하나 향후 중첩 구조 도입 시 기존 키를 silently 덮어쓸 수 있다. 둘째, 프론트엔드 `updateSettings` API가 `void`를 반환해 저장 후 서버 정규화 값을 즉시 반영하지 않고 별도 refetch 경로를 거치며, key 기반 remount와 invalidate 조합에서 단기 깜박임 가능성이 있다. 이 외 부작용은 모두 INFO 수준으로, 기능적 회귀 위험은 낮다.

---

## 위험도

LOW
