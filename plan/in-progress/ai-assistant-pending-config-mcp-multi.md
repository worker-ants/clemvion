# AI 어시스턴트 Pending Config picker — MCP 누락 / 다중선택 미지원 개선

## Context

AI 어시스턴트 (workflow-assistant) 의 in-message candidate picker (spec ED-AI-39 §4.3.1) 는
다음 두 가지 결함이 있다.

1. **MCP 서버 누락** — `mcp-server-selector` widget 이 백엔드 화이트리스트(`USER_ACTION_WIDGETS`)
   에서 빠져 있어 `pendingUserConfig` 로 안내되지 않고, review guard
   (`PENDING_USER_CONFIG_UNMENTIONED`) 도 MCP 미안내를 잡지 못한다.
2. **다중 선택 불가** — `mcpServers` (`z.array(mcpServerRefSchema)`) 와 `knowledgeBases`
   (`z.array(z.string())`) 는 array 필드인데, picker UI 는 native `<select>` 단일 선택이고
   `assistant-message.tsx` 는 `[selectedId]` 로 1개만 강제 배열화한다.

## 변경 범위

### Backend
- `backend/src/modules/workflow-assistant/tools/detect-pending-user-config.ts`
  - `UserActionWidget` 에 `'mcp-server-selector'` 추가
  - `USER_ACTION_WIDGETS` Set 갱신
  - `selectionMode?: 'single' | 'multi'` 추가 + `MULTI_SELECT_WIDGETS` 헬퍼
  - 헤더 docstring 의 예시에 MCP 추가
- `backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts`
  - `mcp-server-selector` 분기 추가 — `IntegrationsService.findAll` 을
    `serviceType: ['mcp'], status: 'connected'` 로 호출 (별도 메서드 `lookupMcpServers`)
- `backend/src/modules/workflow-assistant/tools/review-workflow.ts`
  - `PENDING_USER_CONFIG_UNMENTIONED` 의 주석에 MCP 서버 추가
- `backend/src/modules/workflow-assistant/prompts/system-prompt.ts`
  - selector 종류 열거에 `mcp-server-selector` 추가
- `backend/src/nodes/core/node-component.interface.ts`
  - `UiHint.widget` union 에 `'mcp-server-selector'` 추가
- 관련 spec 파일 (`detect-pending-user-config.spec.ts`,
  `candidate-lookup.service.spec.ts`, `system-prompt.spec.ts`) 갱신

### Frontend
- `frontend/src/lib/api/assistant.ts`
  - `UserActionWidget` 에 `'mcp-server-selector'` 추가
  - `PendingUserConfigField.selectionMode` 옵셔널 필드 (legacy 'single' fallback)
- `frontend/src/components/editor/assistant-panel/candidate-picker.tsx`
  - `selectionMode === 'multi'` → 체크박스 리스트, 한 번의 Confirm 으로 ids[] 주입
  - `onConfirm` 시그니처: `(selection: CandidatePickerSubmission) => void` (union)
  - Undo 시 미확정 선택 상태도 함께 리셋
- `frontend/src/components/editor/assistant-panel/assistant-message.tsx`
  - `buildPickerSubmissionValue(widget, selection)` 헬퍼로 widget 별 페이로드 build
    - kb → string[], mcp → `McpServerRef[]` (MCP_SERVER_REF_DEFAULTS 공유)
- `frontend/src/components/integrations/mcp-server-selector.tsx`
  - `MCP_SERVER_REF_DEFAULTS` 공유 상수 추출 (settings panel 과 picker 의 단일 출처)
- 관련 spec 파일 (`candidate-picker.test.tsx`, `assistant-message.test.ts`) 갱신

## TODO

- [x] in-progress plan 문서 생성
- [x] `node-component.interface.ts` widget union 누락 확인 + 추가
- [x] backend 테스트 선작성
- [x] backend 구현
- [x] frontend 테스트 선작성
- [x] frontend 구현
- [x] TEST WORKFLOW (lint / unit / build) backend + frontend
- [x] REVIEW WORKFLOW (ai-review + RESOLUTION.md)
- [ ] plan/complete 로 이동 (`git mv`) — 모든 항목 완료 후

## 주의

- spec §6 의 selector 정책 표(`spec/3-workflow-editor/4-ai-assistant.md` line 612) 는
  spec 변경 영역이라 본 PR 에서 **수정하지 않는다** (`project-planner` 영역).
  마지막에 사용자에게 spec 갱신 필요 사실을 보고한다.
