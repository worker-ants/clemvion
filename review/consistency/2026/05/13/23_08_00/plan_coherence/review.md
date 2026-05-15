모든 주요 plan 파일을 확인했습니다. 분석을 완료하겠습니다.

---

## 발견사항

### [WARNING] `spec/4-nodes/3-ai/1-ai-agent.md` 동시 편집 예고
- **target 위치**: spec draft §8 — `mcpServers` 필드 설명 1줄 변경 (현재 → `service_type ∈ ('mcp', 'cafe24')` 명시)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` Phase 3 Spec 작성 — 동일 파일 §1의 config 스키마를 타겟으로 명시 (`toolNodeIds`/`toolOverrides` 재정의, "재작성 예정" 박스 제거)
- **상세**: 두 작업이 같은 파일의 §1을 수정한다. 단, 변경 영역이 분리돼 있음 — cafe24 spec draft는 `mcpServers` 행 설명 수정(1줄), 재작성 plan은 `toolNodeIds`/Tool Area 블록 신설. 현재 rewrite plan에는 worktree frontmatter가 없어 아직 착수 전이며, cafe24 plan 자체도 "MCP 경로만 사용 → 무관"으로 명시.
- **제안**: 충돌 예방을 위해 cafe24 spec이 main에 merge된 이후 rewrite plan 착수 시 `mcpServers` 확장 내용을 인지한 상태로 §1을 편집할 것을 rewrite plan에 메모로 추가 권장. 단, **현재 시점에서는 두 worktree가 동시에 활성화되지 않으므로 실제 경합 없음**.

---

### [WARNING] 부모 plan Phase 1 체크박스 미완료 표기
- **target 위치**: spec draft 존재 자체 (현재 `plan/in-progress/spec-draft-cafe24-integration.md` 파일이 실재)
- **관련 plan**: `plan/in-progress/cafe24-integration.md` Phase 1 — `[ ] plan/in-progress/spec-draft-cafe24-integration.md 작성` 가 아직 미체크
- **상세**: draft 문서가 이미 존재하므로 Phase 1 작업은 사실상 완료됐으나 plan에 반영되지 않았음. consistency-checker가 이 plan을 읽을 때 "Phase 1 미완료"로 오인할 수 있음.
- **제안**: spec write 진행 전, `cafe24-integration.md` 의 Phase 1 체크박스를 `[x]`로 갱신할 것.

---

### [INFO] `spec/4-nodes/3-ai/0-common.md` §3 McpServerRef — rewrite plan 미언급 파일
- **target 위치**: spec draft §9 — `McpServerRef.integrationId` 타입을 `service_type ∈ ('mcp', 'cafe24')`로 확장, `enabledTools`·`includeResources`·`includePrompts` 필드 상세 추가
- **관련 plan**: `ai-agent-tool-connection-rewrite.md` Phase 3 Spec 작성 — 이 파일(`0-common.md`)을 명시적으로 열거하지 않음 (언급된 파일은 `1-ai-agent.md`, `0-canvas.md`, `4-ai-assistant.md` 셋뿐)
- **상세**: 충돌이 아니라 "rewrite plan이 나중에 이 파일을 건드릴 가능성"의 추적 메모. Cafe24 spec이 먼저 merge되면 rewrite plan 작업자가 이미 확장된 McpServerRef를 발견하고 혼동할 수 있음.
- **제안**: 추가 조치 불필요. spec §9의 변경 사유 인라인 설명("MCP-capable Integration 범주 확장")이 충분히 명시돼 있으므로 후속 작업자가 컨텍스트를 이해할 수 있음.

---

### [INFO] `node-output-redesign` plan — cafe24 노드 신규 파일 미포함
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` — 27개 기존 노드 전수 진단 중. `spec/4-nodes/4-integration/4-cafe24.md`는 신규 파일이므로 목록에 없음
- **상세**: 충돌 없음. cafe24 spec draft §9.5에서 Principle 0~11 준수를 명시 선언했고, 실제 출력 구조도 5필드 invariant + `output.error.{code,message,details?}` + Principle 7 config echo를 정확히 따르고 있어 node-output-redesign의 기준과 정합.
- **제안**: 추후 node-output-redesign plan 완료 시 cafe24 노드를 검토 대상에 포함할지 여부를 그 시점에 결정하면 충분.

---

## 요약

진행 중인 9개 in-progress plan 중 **Critical 위배는 0건**. cafe24 spec draft는 MCP 경로(`mcpServers` / `McpServerRef`)만 확장하고 general tool 재작성 영역(`toolNodeIds`, Tool Area)은 완전히 분리되어 있어, 유일하게 동일 파일을 타겟으로 하는 `ai-agent-tool-connection-rewrite.md`와도 편집 구역이 겹치지 않는다. 단, 부모 plan의 Phase 1 체크박스가 미완료 상태로 남아 있으므로 **spec write 직전에 `cafe24-integration.md`의 Phase 1을 `[x]`로 갱신**한 뒤 진행할 것을 권장한다.

## 위험도

**LOW** — spec write 진행 가능. Critical 0건, Warning 2건 중 실질 충돌은 없음.