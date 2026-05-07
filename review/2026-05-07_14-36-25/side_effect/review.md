## 발견사항

### [WARNING] `onConfirm` prop 시그니처 변경 — Breaking API Change
- **위치**: `candidate-picker.tsx` (CandidatePickerProps interface), `candidate-picker.test.tsx`
- **상세**: `onConfirm: (selectedId: string) => void` → `onConfirm: (selection: CandidatePickerSubmission) => void`. `CandidatePicker`를 소비하는 모든 컴포넌트가 동시에 업데이트되어야 하는 breaking change. `assistant-message.tsx`는 갱신되었으나, 다른 소비자가 생기면 런타임 오류 없이 타입 불일치가 발생할 수 있다.
- **제안**: `CandidatePicker`가 exported되어 있으므로, 타입스크립트 컴파일 단계에서 잡힌다는 점에서 실질 위험은 낮음. 그러나 테스트에서 이 컴포넌트를 직접 사용하는 곳을 전수 확인 권장.

---

### [WARNING] MCP ServerRef 기본값 하드코딩 — 스키마 간 묵시적 결합
- **위치**: `assistant-message.tsx:buildPickerSubmissionValue` (mcp-server-selector 분기)
- **상세**: picker Confirm 시 `{ integrationId, includeResources: true, includePrompts: true }` 형태를 하드코딩해 주입한다. 이 shape이 `ai_agent` 노드의 `mcpServerRefSchema`와 정확히 일치해야 하는데, 스키마가 변경되거나 추가 필수 필드가 생길 경우 **런타임 에러 없이 조용히 잘못된 config**가 주입된다.
- **제안**: 백엔드 `mcpServerRefSchema`에서 default 값을 추출하는 API 엔드포인트를 통해 받거나, 적어도 스키마 파일에서 상수로 공유하는 방식으로 단일 출처를 확보할 것.

---

### [WARNING] 테스트 공유 픽스처 변경으로 인한 기존 테스트 의미 변화
- **위치**: `detect-pending-user-config.spec.ts:aiAgentSchema`
- **상세**: `aiAgentSchema` 픽스처에 `mcpServers` 필드가 추가됨으로써, 이 픽스처를 사용하는 기존 테스트("flags empty arrays as empty for kb-selector" 등)에서 config 입력에 `mcpServers` 값을 명시하지 않으면 의도치 않게 3개의 pending 필드가 반환된다. 해당 테스트들은 이미 `mcpServers: [{ integrationId: 'int-1' }]`를 추가해 대응했지만, 향후 이 픽스처를 재사용하는 새 테스트 작성자가 동일한 함정에 빠질 수 있다.
- **제안**: 각 테스트 케이스가 필요한 필드만 포함하는 인라인 스키마를 사용하거나, 픽스처 상단에 "selector 3종 포함" 주석 명시.

---

### [INFO] `detectPendingUserConfig` 반환값에 `selectionMode` 추가 — DB 저장 시 레거시 호환성
- **위치**: `detect-pending-user-config.ts`, `candidate-picker.tsx`
- **상세**: `PendingUserConfigField`에 `selectionMode?: 'single' | 'multi'`가 추가됨. 이 값이 DB에 `pendingUserConfig` JSON으로 저장되는 경우, 신규 필드가 포함된 row가 생성된다. frontend는 `undefined`를 `'single'`으로 fallback하므로 구 row 읽기는 안전하나, 반대로 신규 row를 구버전 클라이언트가 읽는 경우에 대한 고려가 필요하다 (이미 optional이라 크래시는 없음).
- **제안**: 현재 처리 방식으로 충분. 명시적으로 문서화된 레거시 처리 전략이 있으므로 INFO 수준.

---

### [INFO] `CandidatePicker` 내 `selectedId`/`selectedIds` 상태 미동기화
- **위치**: `candidate-picker.tsx:useState`
- **상세**: single 모드용 `selectedId`와 multi 모드용 `selectedIds`가 별도 state로 관리된다. `field.selectionMode`가 렌더 간 변경될 경우 이전 모드의 선택값이 잔류한다. 서버 데이터 기반의 정적 값이므로 실질적 발동 가능성은 낮지만, `useEffect`로 mode 변경 시 두 state를 모두 초기화하지 않는다.
- **제안**: 중요도 낮음. 필요하면 `useEffect(() => { setSelectedId(""); setSelectedIds([]); }, [field.selectionMode])` 추가.

---

## 요약

이번 변경은 `mcp-server-selector` 추가와 kb/mcp 다중 선택 지원이라는 기능 확장으로, 전반적으로 additive하고 레거시 호환성을 잘 고려했다. 가장 주목할 부작용은 두 가지다: `CandidatePicker.onConfirm` 시그니처 변경(타입 컴파일 타임 보호가 있어 실질 위험 낮음)과, MCP ServerRef 기본값(`includeResources: true, includePrompts: true`)이 `ai_agent` 노드 스키마에 하드코딩 의존한다는 점(스키마 드리프트 시 조용한 버그 발생 가능). 나머지는 의도된 변경 범위 내에 있다.

## 위험도

**LOW**