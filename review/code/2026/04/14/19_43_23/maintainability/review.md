## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `buildSnapshot` 메서드가 `public`으로 노출되어 있음
- 위치: `workflows.service.ts` — `buildSnapshot` 메서드
- 상세: `buildSnapshot`은 서비스 내부 로직을 위한 헬퍼인데 `private` 없이 선언되어 있어 외부에서 접근 가능한 퍼블릭 API처럼 보임. 테스트에서 `saveCanvas` 호출 결과를 spy하는 방식으로 대체 가능.
- 제안: `private buildSnapshot(...)` 으로 변경. 테스트에서 직접 호출이 필요하다면 별도 유틸 함수로 분리

---

**[WARNING]** `restoreVersion`에서 `snapshot` 타입 캐스팅이 불안전함
- 위치: `workflows.service.ts` — `restoreVersion` 메서드
- 상세: `target.snapshot`을 `{ name?: string; nodes?: unknown[]; edges?: unknown[] }`로 인라인 타입 단언한 뒤 `as SaveCanvasDto['nodes']`로 강제 캐스팅. 런타임에 스냅샷 스키마가 어긋나도 타입 오류 없이 통과되고 `saveCanvas`에서 `validateManualTrigger`가 실패할 때까지 에러가 지연됨.
- 제안: `VersionSnapshot` 인터페이스(프론트엔드에 이미 정의됨)를 공유 타입으로 백엔드에도 정의하거나, 최소한 스냅샷 파싱 시 필수 필드 존재 여부를 검증하는 가드 함수 추출

---

**[WARNING]** `ALLOWED_NODE_TYPES` / `ALLOWED_CATEGORIES` 상수가 `import-workflow.dto.ts`에만 로컬로 정의됨
- 위치: `import-workflow.dto.ts` — 파일 상단 상수
- 상세: 노드 타입 목록은 `Node` 엔티티의 `type` 열거형과 중복 관리되는 관심사. DTO가 변경되면 엔티티와 불일치 발생 가능. `save-canvas.dto.ts`에도 유사한 `IsIn` 검증이 있을 가능성이 높음.
- 제안: 노드 타입/카테고리 enum을 `nodes` 모듈의 공통 상수 파일로 분리하고 양쪽 DTO에서 참조

---

**[WARNING]** `DiffSection` 컴포넌트의 빈 항목 감지 로직이 취약함
- 위치: `version-diff-dialog.tsx` — `DiffSection` 함수
- 상세: `children`을 `Array.isArray`로 분기한 뒤 `filter(Boolean)`로 빈 섹션을 걸러내는 방식은 `children`이 React 엘리먼트 배열일 때 항상 truthy라 실제로 의미 없음. `diff.nodes.added.length === 0`인 경우에도 `<li>` 배열이 빈 배열로 전달되므로 `items.filter(Boolean)`이 빈 배열을 반환해 `realItems.length === 0`이 되어 우연히 동작하지만, 의도가 불명확함.
- 제안: `count` prop을 직접 받거나 호출부에서 조건부 렌더링으로 처리: `{diff.nodes.added.length > 0 && <DiffSection ...>}`

---

**[INFO]** `folderId` 빈 문자열 → null 변환 로직이 세 DTO에 중복됨
- 위치: `create-workflow.dto.ts`, `update-workflow.dto.ts`, `query-workflow.dto.ts`
- 상세: `@Transform(({ value }) => (value === '' ? null : value))` 데코레이터가 동일하게 세 곳에 반복됨.
- 제안: `emptyStringToNull` Transform 팩토리 함수로 추출해 공통 유틸에 배치

---

**[INFO]** `version-history-panel.tsx`의 `formatTimestamp` / `creatorLabel`이 파일 내 인라인 유틸로만 존재
- 위치: `version-history-panel.tsx` — 파일 상단 함수
- 상세: 현재는 단일 파일에서만 사용되어 문제없으나, `version-detail-dialog`나 `restore-confirm-dialog`로 동일 포맷이 필요해지면 중복 발생 가능성 있음.
- 제안: 즉시 이동할 필요는 없으나 `version-history/utils.ts`로 관리하면 향후 확장 시 편리

---

**[INFO]** `WorkflowVersionsService.createVersion`에서 `changeSummary || undefined` 패턴 사용
- 위치: `workflow-versions.service.ts` — `createVersion` 메서드
- 상세: `changeSummary || undefined`는 빈 문자열(`''`)도 `undefined`로 처리함. 시그니처가 `changeSummary?: string`인데 빈 문자열을 허용할지 명시적으로 결정되지 않음.
- 제안: `changeSummary: changeSummary ?? undefined`로 변경하거나 DTO 레벨에서 `@IsNotEmpty()`로 빈 문자열을 차단

---

**[INFO]** `version-history-panel.tsx`에서 `diffMode` 상태와 `selectedForDiff` 상태가 함께 리셋되지 않는 케이스 존재
- 위치: `version-history-panel.tsx` — `toggleDiffSelect`
- 상세: `diffMode`를 false로 끄면 `setSelectedForDiff([])`로 리셋하지만, 패널을 닫았다가 다시 열 때(`setOpen(false)` → `setOpen(true)`) `diffMode`와 `selectedForDiff`는 로컬 state로 살아있어 이전 선택 상태가 유지됨.
- 제안: `open`이 false→true 전환될 때 로컬 상태를 초기화하거나 zustand 스토어 내에서 `versionHistoryOpen` setter에 초기화 로직 포함

---

### 요약

전반적으로 코드 구조는 명확하고 관심사 분리가 잘 되어 있다. 백엔드의 `buildSnapshot` 접근 제어 누락과 `restoreVersion`의 타입 캐스팅 불안전성이 가장 주의가 필요한 지점이며, `ALLOWED_NODE_TYPES` 상수의 중복 관리와 `folderId` Transform의 반복 패턴은 규모가 커질수록 불일치 위험을 높인다. 프론트엔드의 `DiffSection` 빈 상태 감지 방식은 현재는 우연히 동작하지만 의도가 불분명하여 향후 변경 시 오류 유발 가능성이 있다. 나머지는 낮은 우선순위의 개선 사항으로, 핵심 기능 구현 완성도 자체는 양호하다.

### 위험도

**MEDIUM**