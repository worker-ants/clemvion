# AI 어시스턴트 Pending Config picker — MCP 누락 / 다중선택 미지원 개선

승인된 계획 원본: `~/.claude/plans/ai-sleepy-garden.md` (요약 사본)

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
  - `selectionMode: 'single' | 'multi'` 추가 + `MULTI_SELECT_WIDGETS` 헬퍼
  - 헤더 docstring 의 예시에 MCP 추가
- `backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts`
  - `mcp-server-selector` 분기 추가 — `IntegrationsService.findAll` 을
    `serviceType: ['mcp'], status: 'connected'` 로 호출 (별도 메서드 `lookupMcpServers`)
  - 클래스 docstring 갱신
- `backend/src/modules/workflow-assistant/tools/review-workflow.ts`
  - `PENDING_USER_CONFIG_UNMENTIONED` 의 주석에 MCP 서버 추가
- `backend/src/modules/workflow-assistant/prompts/system-prompt.ts`
  - selector 종류 열거 (line 273-276) 에 `mcp-server-selector` 추가
- `backend/src/nodes/core/node-component.interface.ts`
  - `UiHint.widget` union 에 `'mcp-server-selector'` 추가 (현재 누락)
- `backend/src/modules/workflow-assistant/tools/detect-pending-user-config.spec.ts`
  - mcp-server-selector pickup + selectionMode 케이스
- `backend/src/modules/workflow-assistant/tools/candidate-lookup.service.spec.ts`
  - mcp-server-selector lookup 케이스
- `backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts`
  - selector 열거에 mcp-server-selector 가 등장하는지 assert

### Frontend
- `frontend/src/lib/api/assistant.ts`
  - `UserActionWidget` 에 `'mcp-server-selector'` 추가
  - `PendingUserConfigField` 에 `selectionMode: 'single' | 'multi'` 추가
- `frontend/src/components/editor/assistant-panel/candidate-picker.tsx`
  - `selectionMode === 'multi'` 분기 → 체크박스 리스트 + Confirm
  - `onConfirm` 시그니처를 union 으로 확장
- `frontend/src/components/editor/assistant-panel/assistant-message.tsx`
  - `onConfirm` 콜백 분기:
    - single → 기존 `updateNodeConfigField(nodeId, field.field, id)`
    - multi + kb-selector → `updateNodeConfigField(nodeId, field.field, ids)` (string[])
    - multi + mcp-server-selector → `ids.map(id => ({ integrationId: id, includeResources: true, includePrompts: true }))`
  - 기존 `[selectedId]` 핫픽스 제거
- `frontend/src/components/editor/assistant-panel/candidate-picker.test.tsx`
  - multi 모드 다중 선택 / 0개 선택 시 disabled / rehydrate (배열 currentValue) 케이스
- `frontend/src/components/editor/assistant-panel/assistant-message.test.ts`
  - mcp-server-selector multi-confirm 시 McpServerRef 객체 배열로 매핑되는지

## TODO

- [x] in-progress plan 문서 생성
- [ ] 검증: `node-component.interface.ts` 의 widget union 에 mcp-server-selector 누락 확인
- [ ] backend 테스트 선작성
- [ ] backend 구현
- [ ] frontend 테스트 선작성
- [ ] frontend 구현
- [ ] TEST WORKFLOW (lint / unit / build) backend + frontend
- [ ] REVIEW WORKFLOW (ai-review + RESOLUTION.md)
- [ ] plan/complete 로 이동 (`git mv`)

## 주의

- spec §6 의 selector 정책 표(`spec/3-workflow-editor/4-ai-assistant.md` line 612) 는
  spec 변경 영역이라 **수정하지 않는다** (`project-planner` 영역). 본 변경 후 spec 정합성
  점검은 verification 마지막에 한 번 수행하고, 격차가 있으면 사용자에게 보고한다.
