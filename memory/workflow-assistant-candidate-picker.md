# Workflow Assistant — Candidate Picker 정책 결정 (2026-04-24)

## 배경

2026-04-24 사용자 피드백: "메일전송 노드에 SMTP integration 을 설정해야 하는데, 설정된 항목이 있음에도 스스로 하지를 못해". 기존 정책은 시스템 프롬프트로 `integration-selector` 등 user-action widget 의 id 주입을 **명시적으로 금지** 했고, `PENDING_USER_CONFIG_UNMENTIONED` 리뷰 가드가 "마무리 메시지에 사용자 설정 안내" 를 강제하는 구조였다. 결과적으로 Assistant 는 워크스페이스에 단일 SMTP integration 이 있어도 자동 연결하지 않고 사용자에게 수동 설정을 미뤘다.

## 최종 정책 (ED-AI-39)

**"설정 가능한 항목이 존재하면 사용자에게 명시적 확인 후 주입, 없으면 기존 안내 유지"** — 방향 B 채택:

- 백엔드 `add_node` / `update_node` 성공 응답의 `pendingUserConfig[i]` 에 **워크스페이스 후보 목록 (`candidates: CandidateEntry[]`)** 을 실어 프런트에 전달.
- 프런트는 해당 edit 버블 아래에 드롭다운 picker 렌더. 사용자 Confirm 클릭 시 `editor-store.updateNode` 로 즉시 반영 (LLM 경유 없음).
- 후보 0개: amber 안내 박스 + Settings 딥링크. 기존 수동 설정 경로 유지.
- 후보 1개도 자동 선택 금지 — 단일 option 드롭다운으로 사용자 확인 필수.
- 적용 scope: 4종 widget 전체 (`integration-selector` · `llm-config-selector` · `kb-selector` · `workflow-selector`).

## 문서 변경 지도

| 문서 | 섹션 | 변경 요점 |
|------|------|-----------|
| `prd/2-workflow-editor.md` | §10.4 | `ED-AI-39` 신규 — 명시적 확인 + picker UX 의무. |
| `spec/3-workflow-editor/4-ai-assistant.md` | §3.2 | "Candidate picker" 행 추가. |
| | §3.3 | picker 접근성(aria, 키보드) 규정. |
| | §4.3 | 편집 도구 반환 shape 에 `pendingUserConfig?` 명시. |
| | §4.3.1 (신규) | `PendingUserConfigField` / `CandidateEntry` 타입, widget별 조회 범위·상한(20), 프런트 동작, LLM 계약. |
| | §5.3.1 | tool_call.data.result 설명에 `pendingUserConfig` 언급. |
| | §6.0 | rehydrate 시 canvas 현재 값 vs picker 상태 판정 규칙. |
| | §8 | "Selector 필드 정책" 행 추가 — LLM 은 id 빈 값 제출, closing mention 은 candidate 0 case 에만. |
| | §10 | `WORKFLOW_REVIEW_REQUIRED` 행에 `PENDING_USER_CONFIG_UNMENTIONED` 는 candidate 0 에만 발동함을 명시. |
| | §13 | `candidatePicker*` i18n 5키 추가. |
| | §14 | ED-AI-39 매핑. |

## 구현자가 기억해야 할 계약 (요약)

1. **서버**: `collectPendingUserConfig` 는 기존처럼 schema 를 훑어 비어있는 selector 필드를 수집하되, 추가로 widget 별 저장소(integrationRepo / llmConfigRepo / kbRepo / workflowRepo) 를 워크스페이스 스코프로 쿼리해 `candidates` 를 채운다. 상한 20, connected/최근 등 정렬 규칙은 §4.3.1 표 그대로.
2. **LLM 프롬프트**: §8 "Selector 필드 정책" 행을 `STATIC_BLOCK_3_EDIT_PLAYBOOK` 에 투영. 기존 "You must NOT fill ... surface them in the closing message" 를 "Leave ids empty; server attaches candidates; mention only when candidates list is empty" 로 교체.
3. **Review guard**: `collectUnmentionedPendingUserConfig` 는 `candidates?.length === 0` 인 항목에 대해서만 missingFields 로 카운트. 후보가 1+ 인 항목은 guard 에서 제외.
4. **프런트 렌더**: `AssistantMessageView` 의 tool_call badge 그룹 아래, error bubble 이나 systemHint 보다 **위**에 picker 블록 배치. Confirm 시 `editor-store.updateNode(nodeId, { config: { [field]: selectedId } })` 호출. 이후 picker 는 "✓ 설정됨" 으로 고정 (Undo 로도 picker 상태를 되돌리지 않는다 — UX 복잡도 대비 실익 낮음).
5. **Rehydrate**: `hydrateMessage` 에서 `tool_calls[*].result.pendingUserConfig` 를 읽고, 해당 노드의 현재 canvas 값이 채워져 있으면 "✓ 설정됨", 비어있으면 interactive picker 로 복원. 판정은 editor-store 의 현재 노드 config 에서 `field` 경로를 dot-path 로 읽어 비교.

## Out of scope (후속)

- Plan 카드 안 picker 통합 UI (현재는 edit 버블 전용).
- Picker 에서 "후보 인라인 등록 (Integration 등록 폼 임베드)" — 현재는 Settings 딥링크.
- Tool-area 노드의 `toolOwnerId` — user-action widget 이 아니라 이번 정책 대상이 아님.
- UI 컴포넌트 테스트 (RTL 환경 미도입).

## 관련 메모

- [workflow-assistant-provider-quirks-and-review-always.md](./workflow-assistant-provider-quirks-and-review-always.md) — 기존 `PENDING_USER_CONFIG_UNMENTIONED` 동작 원본. 본 정책으로 "candidate 0 only" 로 축소됨을 인지.
- [workflow-ai-assistant-decisions.md](./workflow-ai-assistant-decisions.md) — Assistant 초기 설계 결정.

## 실행 계획 (Spec 밖, 구현용)

구현은 `developer` skill 에서 수행. PRD/Spec 업데이트 완료했으므로 다음 단계:

1. Backend: `detect-pending-user-config.ts` 에 widget → repo 매핑 추가. `explore-tools.service` 의 로직 재사용 또는 새 `CandidateLookupService` 를 경유해 per-widget 조회.
2. Backend: `system-prompt.ts` 의 `STATIC_BLOCK_3_EDIT_PLAYBOOK` Selector 정책 블록 교체.
3. Backend: `review-workflow.ts` 의 `collectUnmentionedPendingUserConfig` 를 candidate 0 조건으로 좁힘.
4. Frontend: `assistant-store.ts` 에 picker state / confirm action / rehydrate 판정 추가. `assistant-message.tsx` 에 picker 컴포넌트 삽입.
5. i18n ko/en 사전 5키 추가.
6. 테스트: stream.service.spec 의 pendingUserConfig 기존 케이스를 candidates 포함으로 확장 + 새 review guard 완화 케이스 + frontend store 의 picker 상태 전이 테스트.
