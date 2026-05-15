## 아키텍처 리뷰

### 발견사항

---

- **[WARNING]** `extractSelectedIds`가 도메인 내부 shape을 Presentation 레이어에 하드코딩
  - 위치: `candidate-picker.tsx` — `extractSelectedIds()` 함수
  - 상세: MCP 서버 ref 객체의 내부 필드명 `integrationId`를 picker 컴포넌트가 직접 알고 있음. 이 함수는 "rehydrate 시 현재 값 표시" 목적으로 KB는 `string[]`, MCP는 `{integrationId: string}[]` 두 shape을 모두 처리함. 향후 MCP 서버 ref 스키마가 변경되거나 같은 패턴의 새 widget이 추가될 경우 presentation 레이어를 수정해야 하는 결합 발생.
  - 제안: `extractSelectedIds`의 shape 분기 로직을 `buildPickerSubmissionValue`와 같은 레이어(`assistant-message.tsx` 또는 별도 `picker-utils.ts`)로 이동하고, picker에는 이미 정규화된 `string[]` 만 전달하는 방식으로 분리. 또는 `selectionMode === 'multi'` 인 경우 `currentValue`를 `string[]`으로 정규화하는 책임을 상위(store/API 레이어)에 두는 것도 방법.

---

- **[WARNING]** `widget`과 `selectionMode`가 프론트엔드에서 중복 역할 수행
  - 위치: `assistant-message.tsx` — `buildPickerSubmissionValue()`
  - 상세: picker UI는 `selectionMode`로 단일/다중 분기를 결정하지만, `buildPickerSubmissionValue`는 `selection.mode === 'multi'` 이후 다시 `widget`으로 KB와 MCP를 구분함. `selectionMode`와 `widget`이 부분적으로 겹치는 정보를 각각 다른 목적에 쓰는 구조여서, 새 multi-select widget을 추가할 때 "어떤 속성이 무엇을 결정하는가"의 경계가 흐릿해짐.
  - 제안: `selectionMode === 'multi'`인 경우의 값 변환 규칙을 `widget`별 mapper 레코드(`const MULTI_VALUE_MAPPERS: Record<...>`)로 선언적으로 표현하면, 추가 시 `buildPickerSubmissionValue` 본문에 `if`를 추가하는 방식보다 OCP에 가깝게 유지 가능.

---

- **[INFO]** `UserActionWidget` 타입이 백엔드/프론트엔드 경계에 이중 선언
  - 위치: `backend/.../detect-pending-user-config.ts` vs `frontend/src/lib/api/assistant.ts`
  - 상세: 두 파일에서 동일한 union type을 별도로 관리. 기존 문제이며 이번 변경으로 두 곳 모두 `mcp-server-selector`가 올바르게 추가되었으나, 컴파일 타임 동기화 보장이 없음. 한쪽 누락 시 런타임에서만 감지 가능.
  - 제안: 공유 패키지(`packages/shared-types` 등)로 이동하거나, 백엔드 OpenAPI 스펙 생성 후 프론트에서 auto-generate하는 방향 검토.

---

- **[INFO]** 새 widget 추가 시 필수 수정 지점이 6곳 이상 (OCP 한계)
  - 위치: 백엔드 `USER_ACTION_WIDGETS` Set, `MULTI_SELECT_WIDGETS` Set, switch case, 프론트엔드 `UserActionWidget`, `SETTINGS_HREF`, `buildPickerSubmissionValue`
  - 상세: 현재 widget 수(5개)에서는 허용 가능한 수준이지만, widget이 계속 늘어나면 누락 실수가 잦아질 수 있음. 이번 플랜 문서에서 이미 인식하고 있는 문제.
  - 제안: 단기적으로는 현 구조 유지. 장기적으로 widget descriptor 레코드(`{ widget, selectionMode, settingsHref, valueMapper }`)를 단일 위치에 선언하는 registry 패턴으로 전환하면 각 추가가 한 곳에만 집중됨.

---

### 요약

전반적인 아키텍처 결정은 타당하다. `selectionMode` 메타데이터 추가와 `CandidatePickerSubmission` discriminated union 도입은 단일/다중 선택의 경계를 타입 시스템으로 명확히 표현했고, `MULTI_SELECT_WIDGETS` Set은 백엔드 내부 중복을 제거했다. 주요 우려 지점은 두 가지다: (1) `extractSelectedIds`가 MCP 서버 ref의 내부 shape(`integrationId`)을 picker presentation 컴포넌트에서 직접 참조하는 점 — 이 지식이 `buildPickerSubmissionValue`와 나뉘어 있어 향후 유지보수 비용이 발생할 수 있다. (2) 새 widget 추가 시 6곳 이상을 수동으로 수정해야 하는 분산 구조는 현재 규모에선 감당 가능하지만 registry 패턴으로의 전환을 중기적으로 고려할 만하다.

### 위험도
**LOW**