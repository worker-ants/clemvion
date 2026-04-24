# Workflow Assistant — Candidate Picker (in-bubble selection) 기획

## 배경

현재 시스템 프롬프트(spec §8)는 "사용자가 직접 선택해야 하는 selector 필드(`integration-selector`·`llm-config-selector`·`kb-selector`·`workflow-selector`) 는 Assistant 가 `id` 를 채우지 말 것" 으로 못박아 둔다. 이로 인해 SMTP integration 이 이미 워크스페이스에 등록되어 있는 상황에서도 `send_email` 노드의 `integrationId` 가 비어 생성되고, 사용자는 Settings Panel 을 열어 수동으로 선택해야 한다. Assistant 는 **보여줄 수 있는 후보가 있음을 알고도 제시하지 않는다.**

## 사용자 결정

- 설정 가능한 후보가 존재하면 **사용자에게 명시적 확인을 받아** 주입.
- 후보가 없거나 사용자가 선택하지 않으면 기존처럼 비워 두고 Settings Panel 안내 유지.
- 방향 B: `add_node` / `update_node` 응답의 `pendingUserConfig` 에 candidate 목록을 실어, 프런트가 **해당 edit 버블 내부** 에 드롭다운 picker 를 렌더. 사용자가 선택하면 프런트가 즉시 editor-store 의 `update_node` 로 반영.
- 적용 scope: 4종 widget 모두 (`integration-selector` / `llm-config-selector` / `kb-selector` / `workflow-selector`).
- 후보 1개도 자동 선택 금지 — 단일 option 드롭다운으로 여전히 사용자가 확인.

## 영향 받는 문서

| 문서 | 변경 내용 |
| ---- | --------- |
| `prd/2-workflow-editor.md` §10.4 | 신규 요구사항 `ED-AI-39` 추가 — Assistant 는 selector 필드를 직접 채우지 않고, 서버가 실은 후보 목록을 in-message picker 로 제시해 사용자 확인을 받는다. |
| `spec/3-workflow-editor/4-ai-assistant.md` §3.2 | 메시지 리스트 구성요소에 "Candidate picker" 추가. |
| 〃 §3.3 | Picker 의 접근성 (role/aria) 규정. |
| 〃 §4.3 | 편집 도구 반환에 `pendingUserConfig[*].candidates` 필드 명시 (send_email/carousel/LLM/KB/workflow-selector 포함). |
| 〃 §4.4 | Shadow 검증 규칙은 영향 없으나 도구 반환에 picker payload 가 포함됨을 주석. |
| 〃 §5.3.1 | `tool_call.data.result` 가 `pendingUserConfig` 를 포함할 수 있음을 기술. |
| 〃 §6.0 | assistant message row 의 `tool_calls[*].result.pendingUserConfig` 가 rehydrate 시 picker 복원의 소스임을 명시. |
| 〃 §8 | "You must NOT fill" 규약을 "Leave ids empty; server attaches candidates for in-message picker" 로 조정. LLM 이 추측·발명하는 것은 여전히 금지. |
| 〃 §10 | `PENDING_USER_CONFIG_UNMENTIONED` 가드 완화 — candidate 가 0 인 경우에만 mention 강제. Candidate 가 1+ 이면 picker 가 UX 를 완결하므로 mention 필수 아님. |
| 〃 §13 | i18n 키 3~4개 추가 (`candidatePickerTitle`·`candidatePickerConfirm`·`candidatePickerEmpty`·`candidatePickerSelected`). |
| `memory/workflow-assistant-candidate-picker.md` | 이 결정의 근거와 최종 정책을 고정. |

## 핵심 스펙 요약 (구현자가 참조할 계약)

### 편집 도구 반환 (`add_node` / `update_node` 성공 시)

```typescript
type PendingUserConfigField = {
  field: string;                  // config 경로 (예: 'integrationId')
  label: string;                  // i18n label (예: 'Integration')
  widget:
    | 'integration-selector'
    | 'llm-config-selector'
    | 'kb-selector'
    | 'workflow-selector';
  candidates: CandidateEntry[];   // 워크스페이스에 존재하는 후보. 0개일 수 있음.
};

type CandidateEntry = {
  id: string;                     // 실제 id (integration.id / llm_config.id / kb.id / workflow.id)
  label: string;                  // 사용자 표시 이름
  sublabel?: string;              // 보조 텍스트 (예: serviceType='smtp', model='gpt-4o')
};
```

기존 반환 shape 유지 + `pendingUserConfig[i].candidates` 가 **신규 필드**. Candidate 가 0 인 경우 `candidates: []` 로 명시적으로 비어있음.

### 후보 조회 규칙

| widget | 후보 조회 범위 |
| ------ | -------------- |
| `integration-selector` | 워크스페이스의 `Integration`, `status='connected'`, 노드 스키마 meta 의 `integrationServiceType` 과 매칭되는 `service_type` 만. 매칭 힌트가 없으면 전체 connected integration. |
| `llm-config-selector` | 워크스페이스의 `LlmConfig` 전체 (최근 업데이트 순). |
| `kb-selector` | 워크스페이스의 `KnowledgeBase` 전체. |
| `workflow-selector` | 같은 워크스페이스 워크플로 + **현재 편집 중인 워크플로 제외**. |

**상한: 각 widget 당 20개**. 초과 시 상위 20개만 반환, 프런트 picker 에는 "Settings Panel 에서 더 많은 후보 보기" 링크 병기.

### 프런트 동작

- edit 버블(메시지 내 tool_call badge 영역) 아래에 picker 블록 렌더.
- 후보 2+ : 드롭다운 select + **Confirm** 버튼. Confirm 전에는 editor-store 업데이트 없음.
- 후보 1 : 단일 option 이 선택된 상태의 드롭다운 + Confirm 버튼 (사용자가 반드시 Confirm 을 눌러야 주입).
- 후보 0 : picker 를 렌더하지 않음. 대신 edit 버블 하단에 amber 안내 박스 ("해당 종류의 Integration 이 없어요. Settings 에서 등록 후 직접 선택해 주세요." + 설정 화면 링크).
- 사용자가 Confirm 하면 `editor-store.updateNode(nodeId, { config: { [field]: selectedId } })` 즉시 실행. 기존 Undo 스택·자동 저장에 그대로 편입.
- 사용자가 선택 완료 후에는 picker 영역이 "✓ {label}: {selected.label} 로 설정됨" 읽기 전용 상태로 전환. Undo 가 캔버스 상태를 되돌리면 picker 는 다시 pending 상태로 돌아가지 않는다 (UX 복잡도 대비 실익 낮음).
- Rehydrate: 세션 로드 시, 각 assistant row 의 `tool_calls[*].result.pendingUserConfig` 를 훑고 **해당 노드의 현재 canvas 값이 아직 비어있는 경우에만** picker 를 렌더. 이미 채워져 있으면 "✓ 설정됨" 상태로 바로 표시.

### LLM 프롬프트 변경

- "You must NOT fill these fields ... surface them in the closing message" → "Leave selector ids empty. The server will attach available candidates; the user picks one via an in-message dropdown. **Do NOT invent or guess ids.** In your closing message, mention the node only if the server returns `candidates: []` (no candidate available — the user needs to register one)."
- 즉 LLM 의 역할: (a) id 는 여전히 채우지 않음, (b) closing message 는 **candidate 0 case 에만** 해당 노드 label 을 언급.

### Review guard 완화

- `PENDING_USER_CONFIG_UNMENTIONED` 는 candidate 0 인 pending 항목에 대해서만 발동. Candidate 1+ 는 picker 가 UX 를 완결하므로 mention 미언급이어도 block 하지 않는다.
- 마이그레이션된 row (pendingUserConfig 에 candidates 필드 없음) 는 안전하게 "candidate 조회 안 된 상태" 로 취급 — 기존 동작(mention 강제) 유지.

## Out of scope

- **드롭다운 내 "후보 등록하기" 딥링크**: 이번 범위 포함 (amber 박스의 Settings 딥링크로 대체). 인라인 생성 UX 는 후속.
- **Tool-area node 의 toolOwnerId 선택**: 별도 widget 이 아니므로 이번 범위 밖.
- **플랜 카드 통합**: 이번엔 edit 버블에만. 추후 수요 있으면 plan 요약부에 "N 개 미설정" 인디케이터 추가 검토.
