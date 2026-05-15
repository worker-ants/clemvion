# Code Review 조치 내역 (2026-05-07_14-36-25)

대상 PR: `feat(workflow-assistant): MCP 서버 picker 추가 + KB·MCP 다중 선택 지원`
(commit `b69b72a3`)

리뷰 결과(`./SUMMARY.md`) 의 Critical 1 / Warning 10 / INFO 12 항목에 대해 다음과 같이
조치했다.

## Critical

| # | 항목 | 조치 |
|---|------|------|
| C-1 | `assistant-message.test.ts` 의 `buildPickerSubmissionValue` 무테스트 | `frontend/src/components/editor/assistant-panel/assistant-message.test.ts` 에 4 케이스 (single / kb-multi / mcp-multi / scalar-multi fallback) 추가. MCP_SERVER_REF_DEFAULTS 가 동일 출처임을 함께 assert. |

## Warnings

| # | 항목 | 조치 |
|---|------|------|
| W-1 | MCP ServerRef 기본값 단일 출처 부재 | `MCP_SERVER_REF_DEFAULTS` 를 `frontend/src/components/integrations/mcp-server-selector.tsx` 에서 export. `assistant-message.tsx` 의 `buildPickerSubmissionValue` 와 settings panel 의 `add()` 가 둘 다 같은 상수를 참조한다. |
| W-2 | mcp-server-selector rehydrate 테스트 누락 | `candidate-picker.test.tsx` 에 `currentValue=[{integrationId:..., includeResources:true}]` 으로 status 박스의 라벨이 콤마 결합되는 케이스 추가. |
| W-3 | 체크박스 전체 해제 시 disabled 복귀 미검증 | `candidate-picker.test.tsx` multi describe 에 토글 → 활성 → 다시 토글 → 비활성 + Confirm 클릭해도 onConfirm 미호출 케이스 추가. |
| W-4 | `buildPickerSubmissionValue` fallback 분기 미테스트 | C-1 의 4 케이스 중 "scalar widget + multi" 케이스로 커버. |
| W-5 | `extractSelectedIds` 가 MCP 도메인 지식 포함 | `candidate-picker.tsx` 에서 `extractMcpRefIds` 를 분리하고 `extractSelectedIds(widget, value)` 가 widget 별 unpacker 를 위임하도록 layering. |
| W-6 | 반환 타입 `unknown` 너무 넓음 | `buildPickerSubmissionValue` 반환 타입을 `string \| string[] \| McpServerRef[]` 로 좁힘. |
| W-7 | plan TODO 미갱신 | `plan/in-progress/ai-assistant-pending-config-mcp-multi.md` 의 모든 완료 항목을 `[x]` 로 갱신, plan/complete 이동 항목만 `[ ]` 유지. |
| W-8 | `candidate-lookup.service.spec.ts` 모듈 주석 "4 widget" 불일치 | "5 widget (integration / llm-config / kb / workflow / mcp-server)" 로 정정. |
| W-9 | `onConfirm` breaking change JSDoc 누락 | `candidate-picker.tsx` 컴포넌트 docstring 에 "Breaking change history (2026-05)" 섹션 추가. |
| W-10 | plan 문서 로컬 경로 참조 (`~/.claude/plans/...`) | 해당 라인 제거 — 본 plan 문서가 자체 SSOT 가 되도록 핵심 컨텍스트 인라인화 완료. |

## INFO (반영한 항목)

| # | 항목 | 조치 |
|---|------|------|
| I-4 | `UserActionWidget` 양단 동기화 미문서화 | `frontend/src/lib/api/assistant.ts` 의 `UserActionWidget` JSDoc 에 "양단 동기화 필수" + 갱신해야 할 5곳 명시. |
| I-7 | `SUPPORTED_INTEGRATION_SERVICE_TYPES` 의 `mcp` 의도적 제외 미문서화 | `detect-pending-user-config.ts` 화이트리스트 docstring 에 "MCP 는 별도 widget·lookup 경로 사용" 주석 추가. |
| I-10 | Undo 시 selectedIds 미초기화 UX 불일치 | **보류** — 시도 시 `react-hooks/set-state-in-effect` 룰에 위배. 실제 시나리오 (user 가 미확정 상태로 토글 → Undo) 는 흐름상 거의 발생하지 않으므로 INFO 레벨 그대로 유지. |
| I-12 | fallback 주석에 "동시 갱신 필수" 언급 누락 | `buildPickerSubmissionValue` fallback 주석 + 함수 docstring 에 "backend MULTI_SELECT_WIDGETS 와 동시 갱신 필수" 명시. |

## INFO (보류 항목)

| # | 항목 | 사유 |
|---|------|------|
| I-1 | `lookupMcpServers` 의 이중 slice (DB limit + `.slice`) | 기존 `lookupIntegrations` / `lookupLlmConfigs` 와 일관된 방어 패턴. 관행 일관성을 깨뜨리는 단독 변경은 회피. |
| I-2 | `(workspace_id, status, service_type)` 복합 인덱스 확인 | DB 마이그레이션 영역 — 본 PR 변경과 무관한 사전 인프라이며, 별도 이슈로 분리해 운영 모니터링 후 결정. |
| I-3 | `selectedIds.includes` O(n) — 후보 상한 20 에서 무영향 | 상한이 늘어나면 그때 `Set` 캐싱 검토. 현 시점에서는 premature. |
| I-5 | `CandidatePickerSubmission` 을 `assistant.ts` 로 이동 | UI 콜백 계약은 컴포넌트 파일에 두는 편이 import 그래프상 자연스럽다. SSOT 이동은 별도 결정 사안. |
| I-6 | `workspaceId` 권한 재확인 | NestJS Guard 가 컨트롤러 레벨에서 `workspaceId` 를 인증 컨텍스트로 주입 — 본 PR 은 신규 endpoint 가 아니라 기존 `fillCandidates` 분기 추가. 회귀 위험 없음. |
| I-8 | `extractSelectedIds` UUID 검증 | id 는 서버가 내려준 후보 목록에서만 매칭 — 사용자 입력 경로가 아니므로 zod validation 불필요. |
| I-9 | Widget descriptor registry 패턴 | 5 개 widget 에서는 OCP 확장 비용보다 직접 분기 가독성이 우월. |
| I-11 | error degradation 에 `mcp-server-selector` 명시 케이스 | 공유 try-catch 경로 — 코드가 곧 widget-agnostic 이라 명시적 케이스 1건은 의미가 적다. 회귀 위험 시 추가 검토. |

## 검증

조치 후 재실행 결과 (TEST WORKFLOW):
- backend lint / 2738 unit tests / build → 통과
- frontend lint / 1217 unit tests (이전 1211 + 새 6) / build → 통과 후 commit 시점에 재확인
