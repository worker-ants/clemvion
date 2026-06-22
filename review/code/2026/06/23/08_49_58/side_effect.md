# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `triggersApi.delete` 추가 — 공개 API 확장, 기존 호출자 영향 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` L1016–1018
  - 상세: `delete(id: string): Promise<void>` 는 기존 `triggersApi` 객체에 새 키를 추가한다. 기존 `list`/`getById`/`create`/`update`/`rotate*`/`revoke*` 를 사용하는 모든 호출자는 영향을 받지 않는다. 순수 확장(additive).
  - 제안: 없음.

- **[INFO]** `triggersApi.getHistory` 추가 — 제네릭 타입 매개변수 `<T>` 도입
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` L1024–1032
  - 상세: 신규 공개 메서드. 기존 호출자에게 사이드 이펙트 없음. 제네릭 `<T>` 이 `unknown` 로 런타임 캐스트되므로 타입 안전성은 호출부 책임이나 이는 런타임 부작용과 무관.
  - 제안: 없음.

- **[INFO]** `trigger-delete-dialog.tsx` — `apiClient.delete` → `triggersApi.delete` 교체
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L147
  - 상세: 전송되는 HTTP 요청(`DELETE /triggers/${id}`)은 동일하다. `onSuccess`/`onError` 핸들러가 `queryClient.invalidateQueries(["triggers"])` 를 호출하는 캐시 무효화 동작은 변경 전과 동일하게 유지된다. Public props(`trigger`, `open`, `onClose`)는 무변.
  - 제안: 없음.

- **[INFO]** `trigger-history-dialog.tsx` — `apiClient.get(.../history)` → `triggersApi.getHistory` 교체
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/components/triggers/trigger-history-dialog.tsx` L394–396
  - 상세: 이전 코드에서 `res.data.data ?? res.data` 의 이중 언래핑과 `data.items ?? []` 폴백 로직이 컴포넌트 내부에 인라인으로 존재했다. 이 로직이 `triggersApi.getHistory` 내부로 이동되었으며 동일 알고리즘이 유지된다. `queryKey`, `enabled` 조건, `open`/`onClose`/`onOpenFullDetail` props 는 무변.
  - 제안: 없음.

- **[INFO]** 테스트 파일 — `deleteMock` 전역 변수 추가 + `vi.mock` 확장
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/__tests__/triggers.test.ts` L597–605
  - 상세: `vi.mock` 팩토리 안에 `delete` 핸들러가 추가됐다. `beforeEach(() => vi.clearAllMocks())` 가 이미 존재하므로 `deleteMock` 상태가 테스트 간에 누출되지 않는다. 테스트 모듈 범위 내 변수이며 전역(window/globalThis) 오염은 없다.
  - 제안: 없음.

- **[INFO]** `getHistory` 정규화 — `{ data: {} }` 케이스에서 `body?.data` 가 `{}` 이므로 `(body?.data ?? body)` 가 `{}` 를 반환
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` L1030–1031
  - 상세: `body.data` 가 truthy object `{}` 이므로 `??` 오른쪽이 선택되지 않는다. 이후 `Array.isArray({})` 는 `false`, `{}.items` 는 `undefined` 이므로 `[]` 반환. 테스트(`"returns [] when neither array nor items is present"`)가 이 경로를 명시적으로 검증한다. 의도된 동작이며 부작용 없음.
  - 제안: 없음.

## 요약

이 변경은 순수 리팩터링으로, `apiClient` 직접 호출을 `triggersApi` 중앙 카탈로그로 위임하는 것이 전부다. 두 컴포넌트의 public props/인터페이스는 무변이며, 전송되는 HTTP 동사·URL·파라미터도 이전과 동일하다. `triggersApi` 에 `delete`/`getHistory` 두 메서드가 추가됐지만 이는 순수 확장(additive)으로 기존 호출자에 미치는 영향이 없다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기, 이벤트·콜백 동작 변경, 네트워크 호출 추가는 모두 해당하지 않는다.

## 위험도

NONE
