# Scope Review — feat(web-chat): 운영 콘솔 관리 기능 통합

## 발견사항

### 파일 1: `codebase/frontend/src/app/(main)/web-chat/page.tsx`

- **[INFO]** `gap-0.5` 클래스 추가 (`"flex w-full flex-col gap-0.5 rounded-md …"`)
  - 위치: 목록 행 button className (diff +110)
  - 상세: 기존 `flex-col` 에 `gap-0.5` 가 추가됐다. 새로 추가되는 `lastTriggeredAt` 행 사이 간격을 맞추기 위한 변경으로, 관련 기능(P1 목록 행 메타)의 직접적 부산물이다.
  - 제안: 별도 스타일 PR 로 분리할 필요 없음. 기능 범위 내 허용.

전체적으로 파일 1의 변경은 커밋 메시지에 명시된 P0~P2 전체 범위(삭제·이름수정·활성토글·호출이력·목록 메타·이탈경고·온보딩)에 정확히 대응한다. 불필요한 추가 리팩토링이나 무관 영역 수정은 없다.

---

### 파일 2: `codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx`

- **[INFO]** 기존 `renderDialog` 시그니처 확장 (`onDeleted?: () => void` 파라미터 추가)
  - 위치: 라인 718, `function renderDialog(…, onDeleted?: () => void)`
  - 상세: 기존 테스트 케이스는 `onDeleted` 미전달 시 동작이 보존(기본값 `undefined`)된다. 기존 동작 변경 없음.
  - 제안: 이상 없음.

신규 3개 테스트 케이스(`onDeleted` 호출 여부: 성공·404·5xx)는 `TriggerDeleteDialog` 에 추가된 `onDeleted` prop 의 동작을 커버하며, 범위 내 필수 검증이다.

---

### 파일 3: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx`

- **[INFO]** JSDoc 주석 교체 — "재사용 시 리팩터링을 고려한다" → "onDeleted 콜백에서 추가 무효화·리셋"
  - 위치: `TriggerDeleteDialog` 함수 JSDoc (diff -3/+3 라인)
  - 상세: 이전 JSDoc 은 "`onDeleted` 콜백으로 리팩터링할 것"이라는 TODO 성격이었다. 이번 변경으로 해당 TODO 가 이행됐으므로, JSDoc 을 현재 상태로 갱신하는 것은 범위 내 올바른 수정이다.
  - 제안: 이상 없음.

`onDeleted?: () => void` prop 추가 및 `onSuccess`/404 분기 양쪽에 `onDeleted?.()` 호출 추가는 기능 범위 내 최소 변경이다.

---

### 파일 4: `codebase/frontend/src/components/web-chat/__tests__/use-web-chat.test.ts`

범위 내: `useUpdateWebChatMeta` 신규 hook 의 단위 테스트 추가. 기존 `useUpdateWebChatAppearance` 테스트는 변경 없고, 새 `describe` 블록만 추가됐다. 불필요한 변경 없음.

---

### 파일 5: `codebase/frontend/src/components/web-chat/__tests__/web-chat-rename-dialog.test.tsx`

신규 파일. `WebChatRenameDialog` 컴포넌트 테스트 전용. 범위 내.

---

### 파일 6: `codebase/frontend/src/components/web-chat/use-web-chat.ts`

- **[INFO]** `lastTriggeredAt` 필드 추가 (`WebChatInstance` 인터페이스 + mapping)
  - 상세: P1 목록 행 메타(마지막 호출 시각) 기능의 필수 데이터 흐름이다. 범위 내.

- **[INFO]** `useUpdateWebChatMeta` 신규 hook 추가
  - 상세: P0 이름변경·활성토글을 위한 전용 PATCH mutation. 기존 `useUpdateWebChatAppearance` 와 분리 설계(interaction 미포함)는 JSDoc 에 명시된 의도(`silent mutation` 방지)에 부합한다.

기존 hook 코드(`useWebChatInstances`, `useCreateWebChat`, `useUpdateWebChatAppearance`)는 전혀 변경되지 않았다. 불필요한 리팩토링 없음.

---

### 파일 7: `codebase/frontend/src/components/web-chat/web-chat-rename-dialog.tsx`

신규 파일. 커밋 메시지의 "WebChatRenameDialog 신규(경량)" 에 직접 대응. 범위 내.

---

### 파일 8–9: `lib/i18n/dict/en/webChat.ts`, `lib/i18n/dict/ko/webChat.ts`

신규 i18n 키 추가(`list.inactive`, `list.lastTriggered`, `list.neverTriggered`, `manage.*`, `onboarding.*`). 모두 변경된 UI 컴포넌트에서 실제 사용되는 키이며, KO/EN parity 유지. 범위 내.

---

### 파일 10: `codebase/frontend/src/lib/types/trigger.ts`

- **[INFO]** `TriggerListItem` 에 `lastTriggeredAt?: string` 추가
  - 상세: 기존에 타입 미선언 상태였던 백엔드 응답 필드를 공유 타입에 등록. P1 기능 범위 내 필수 타입 갱신이다.

기존 `TriggerListItem` 의 다른 필드나 관련 인터페이스(`TriggerConfig`, `TriggerInteractionConfig` 등)는 전혀 수정되지 않았다. 불필요한 타입 정리 없음.

---

### 파일 11: `plan/in-progress/web-chat-console-management.md`

신규 plan 파일. 본 PR 의 실행 계획 추적. 범위 내(spec_impact 명기 포함).

---

### 파일 12: `spec/7-channel-web-chat/5-admin-console.md`

- **[INFO]** §1 화면 구조 ASCII 다이어그램 갱신 (목록 행 메타·헤더 관리 버튼 반영)
  - 상세: 구현된 UI 를 spec 다이어그램에 반영하는 것은 plan 에 명시된 "spec 갱신" 단계의 일부. 범위 내.

- **[INFO]** §2.1 신규 섹션 추가 (인스턴스 관리 상세)
  - 상세: P0~P1 기능(이름·활성·삭제·호출이력)의 스펙화. 범위 내.

- **[INFO]** §7 권한 표 갱신 (호출이력 viewer+ 명기, 이름/활성/삭제 editor+ 갱신)
  - 상세: 구현 반영 갱신. 범위 내.

기존 §3~§6, §R1~§R6 Rationale 섹션은 전혀 수정되지 않았다.

---

## 요약

이번 커밋은 커밋 메시지에 명시된 P0(삭제·이름수정·활성토글)·P1(목록 메타·호출이력)·P2(이탈경고·온보딩) 전체 범위에 정확히 대응하는 12개 파일 변경으로 구성된다. 각 파일의 변경은 해당 기능의 직접적 구현(신규 컴포넌트·hook·i18n 키·공유 타입)이거나 plan/spec 동기화로, 무관한 리팩토링·포맷팅·설정 파일 변경은 발견되지 않았다. 기존 `TriggerDeleteDialog`·`TriggerHistoryDialog` 를 재사용하면서 최소 변경(옵셔널 `onDeleted` prop)만 가했고, 기존 hook/타입 코드에 불필요한 정리가 섞이지 않았다.

## 위험도

NONE
