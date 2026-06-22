# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**검토 범위**: `spec/3-workflow-editor` (0-canvas.md · 1-node-common.md · 2-edge.md · 3-execution.md · 4-ai-assistant.md)
**검토 일시**: 2026-06-23

---

## 발견사항

### [INFO] Tool Area 제거 섹션과 `spec/1-data-model.md` Node 엔티티의 `tool_owner_id` 불일치
- **target 위치**: `spec/3-workflow-editor/0-canvas.md §12` (AI Agent Tool Area — "재작성 예정 (현재 제거됨)" 박스), `spec/3-workflow-editor/4-ai-assistant.md §5.2` (요청 본문 `toolOwnerId?` 필드)
- **충돌 대상**: `spec/1-data-model.md §2.6 Node` — `tool_owner_id UUID? FK → Node` 필드가 현재 활성 엔티티 정의에 포함되어 있음
- **상세**: canvas §12는 Tool Area 및 `tool_owner_id`/`toolOverrides` config 필드가 스키마에서 제거됐다고 명시한다. 그러나 data model §2.6은 `tool_owner_id`를 여전히 Node 엔티티 필드로 열거하고 있으며, ai-assistant §5.2의 `currentWorkflow` 요청 body 구조에도 `toolOwnerId?`가 선택 필드로 남아있다. 세 문서가 같은 필드의 제거 여부에 대해 일관된 상태를 취하지 않는다. `spec/1-data-model.md`는 현재 DB 스키마를 반영하므로 해당 컬럼이 DB에 실존한다면 "스키마에서 제거"라는 canvas 표현이 오해를 낳는다 (config JSON의 `toolNodeIds`/`toolOverrides`가 제거된 것이지 DB 컬럼이 제거된 것은 아닐 수 있음).
- **제안**: `spec/3-workflow-editor/0-canvas.md §12` 박스의 "제거됨" 범위를 "AI Agent config JSON의 `toolNodeIds`·`toolOverrides` 필드와 캔버스 UX 비활성"으로 명확히 서술하고, Node DB 컬럼(`tool_owner_id`)의 현황은 `spec/1-data-model.md`의 서술과 맞춰 명시한다.

---

### [INFO] `spec/3-workflow-editor/3-execution.md §8.1` WebSocket 이벤트 이름 표기와 `spec/5-system/6-websocket-protocol.md` 명명 규약의 스타일 차이
- **target 위치**: `spec/3-workflow-editor/3-execution.md §8.1` — 타임라인의 이벤트 이름으로 `NODE_STARTED`, `NODE_COMPLETED`, `NODE_SKIPPED`, `NODE_FAILED`, `EXECUTION_WAITING_FOR_INPUT`(대문자 스네이크케이스) 사용
- **충돌 대상**: 동일 §8.1 상단의 WebSocket 이벤트 표 — `execution.node.started`, `execution.node.completed`(점 구분 소문자) 를 정식 이벤트명으로 사용
- **상세**: §8.1의 이벤트 표는 점 구분 소문자(`execution.started`, `execution.node.completed` 등)를 정식 이벤트명으로 정의하는데, §10.5 타임라인 리스트 설명 내 "WebSocket 이벤트 변경" 단락은 같은 이벤트를 대문자 스네이크케이스(`NODE_STARTED`, `NODE_COMPLETED`, `EXECUTION_WAITING_FOR_INPUT`)로 표기한다. 두 표기가 동일한 WS 이벤트를 가리키는 것인지 별개의 이름인지 독자 혼란을 유발한다.
- **제안**: §10.5의 대문자 표기를 §8.1 표의 정식 이벤트명(`execution.node.started` 등)으로 통일하거나, 두 표기가 동의어임을 주석으로 명확히 한다.

---

### [INFO] `spec/3-workflow-editor/4-ai-assistant.md §12.2`의 "실행 중 편집 거부 미구현" 표시와 `spec/3-workflow-editor/0-canvas.md §3.3` 노드 조작 테이블의 "워크플로우 실행 중" 항목
- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md §12.2` — "실행 중 편집 도구를 `ASSISTANT_WORKFLOW_RUNNING` 에러로 거부하는 가드는 아직 미구현"
- **충돌 대상**: `spec/3-workflow-editor/0-canvas.md §5.4.2` — 삭제 버튼 표시 조건 표의 "워크플로우 실행 중: 숨김 (실행 중 편집 차단)" 항목
- **상세**: canvas §5.4.2는 실행 중 노드 삭제 버튼을 숨기는 것을 "실행 중 편집 차단"의 일환으로 기술한다. 반면 ai-assistant §12.2는 동일 실행 중 상태에서의 Assistant 편집 도구 거부가 아직 미구현임을 명시한다. 이 두 문서는 "실행 중 편집 차단"이라는 같은 정책을 서로 다른 구현 상태로 기술하고 있어, 캔버스 UI 수준과 Assistant 도구 수준에서 정책 집행의 일관성이 보장되는지 독자 입장에서 불명확하다.
- **제안**: `spec/3-workflow-editor/0-canvas.md §5.4.2`와 `spec/3-workflow-editor/4-ai-assistant.md §12.2`가 동일한 "실행 중 편집 차단" 정책임을 상호 참조로 연결하고, ai-assistant 측의 미구현 계획이 캔버스 편집 차단과 동일한 정책 범위임을 명시한다.

---

### [INFO] `spec/3-workflow-editor/1-node-common.md §2.6.3` auto-form 이행 목록과 `spec/4-nodes` 노드별 spec의 트랙 배정 동기화 필요
- **target 위치**: `spec/3-workflow-editor/1-node-common.md §2.6.3` — `text_classifier` · `information_extractor` · `ai_agent` · `split` · `map` · `foreach` · `merge` · `carousel`을 auto-form 이행 완료로 열거
- **충돌 대상**: `spec/4-nodes/3-ai/` 하위 개별 노드 spec — 각 AI 노드 spec이 자체 UI 설정 섹션에서 어떤 트랙을 쓰는지 별도 기술할 수 있음
- **상세**: 트랙 배정 현황의 SoT가 `1-node-common.md §2.6.3`으로 선언됐으나(R-2 Rationale), 개별 노드 spec이 프런트엔드 설정 UI 매핑을 자체 서술하는 경우 내용이 엇갈릴 수 있다. 현재 target 범위에서는 모순이 확인되지 않으나, 구현 착수 전 `spec/4-nodes/3-ai/1-ai-agent.md`·`spec/4-nodes/3-ai/2-text-classifier.md`·`spec/4-nodes/3-ai/3-information-extractor.md`의 UI 배정 서술이 §2.6.3과 정합한지 확인을 권장한다.
- **제안**: 각 AI 노드 spec에서 UI 설정 트랙(override/auto-form)에 대한 기술이 있다면 "SoT는 `spec/3-workflow-editor/1-node-common.md §2.6.3` 참조" 단일 참조 문구로 대체하여 중복 서술을 제거한다.

---

### [INFO] `spec/3-workflow-editor/2-edge.md §7` Tool Area 연결 규칙이 Tool Area 비활성 상태를 반영하지 않음
- **target 위치**: `spec/3-workflow-editor/2-edge.md §7` — "Tool Area 연결 규칙" 섹션이 Tool Area의 엣지 없음·공간적 연관·실행 방식을 현재형으로 서술
- **충돌 대상**: `spec/3-workflow-editor/0-canvas.md §12` — Tool Area가 현재 비활성이며 재작성 예정임을 명시
- **상세**: canvas §12가 Tool Area를 "현재 제거됨 / 재작성 예정"으로 표시한 반면, edge §7은 Tool Area 연결 규칙을 여전히 현재형으로 기술하고 있다. 이 섹션에 canvas §12와 동일한 미구현 표시나 비활성 안내가 없어 edge spec 독자가 현재도 이 규칙이 유효하다고 오해할 수 있다.
- **제안**: `spec/3-workflow-editor/2-edge.md §7` 상단에 `spec/3-workflow-editor/0-canvas.md §12`와 동일하게 "현재 비활성 — Tool Area 재작성 시 갱신" 박스를 추가한다.

---

## 요약

`spec/3-workflow-editor` 영역(0-canvas · 1-node-common · 2-edge · 3-execution · 4-ai-assistant) 5개 문서는 전체적으로 상호 참조가 충실하고 주요 API 계약·데이터 모델·상태 전이·RBAC 규칙에서 다른 spec 영역과 직접 모순되는 Critical 또는 Warning 수준의 충돌은 발견되지 않았다. 다만 Tool Area 기능의 부분적 제거 상태가 canvas·edge·data-model 세 문서에 각각 다른 수준으로만 반영되어 있고, WebSocket 이벤트 이름 표기 스타일이 같은 문서 내에서 혼용되며, 실행 중 편집 차단 정책의 구현 상태 서술이 canvas와 ai-assistant 사이에 미묘하게 어긋나는 Info 수준 항목이 4건 확인됐다. 이 항목들은 구현 착수 전 spec 작성자가 정리하면 향후 구현자의 혼란을 줄일 수 있으나, 어느 것도 두 영역 중 하나를 작동 불가로 만드는 논리적 모순은 아니다.

---

## 위험도

LOW

---

STATUS: OK
