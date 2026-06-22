# Rationale 연속성 검토 결과

검토 모드: --impl-done (구현 완료 후)
검토 범위: `spec/3-workflow-editor` (0-canvas, 1-node-common, 2-edge, 3-execution, 4-ai-assistant)
구현 대상: M-3 1단계 — `AssistantToolRouter` 추출 (`tools/assistant-tool-router.service.ts`)

---

### 발견사항

**[INFO]** `AssistantToolRouter` 추출이 spec §4.4 (WebsocketService canonical sink) 와의 관계를 명시하지 않음

- target 위치: `plan/in-progress/refactor/02-architecture.md` M-3 항목 ("spec 갱신: 불요")
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §4.4 Rationale` — "실행 엔진의 외부 이벤트 발행 sink 는 WebsocketService 가 canonical 이며 별도 추상화(IExecutionEventEmitter 같은 인터페이스 / Nest EventEmitter2)를 도입하지 않는다"
- 상세: `AssistantToolRouter` 는 `ExploreToolsService` 주입 후 SSE 이벤트 발행 없이 tool dispatch 결과를 반환값으로만 전달한다. 이벤트 발행은 여전히 `streamMessage` 루프(즉 `WorkflowAssistantStreamService`)에 잔류한다. 따라서 §4.4 의 단일 sink 정책을 위반하지 않는다. 단, M-3 2단계(`AssistantFinishGuard`) 나 3단계(`AssistantTurnPersistenceService`)에서도 SSE 이벤트 발행이 호출자 루프 바깥으로 이동하지 않는지 confirm 이 필요하다. 현 1단계 구현은 문제 없다.
- 제안: M-3 항목에 "분리된 협력 객체(Guard/Persistence)에서 직접 SSE 발행 금지 — SSE 조립은 streamMessage 루프에 잔류 (§4.4 단일 sink)" 를 명시적으로 기록해 2·3단계 구현자에게 invariant 를 전달하는 것이 바람직하다. 현재는 암묵적으로 안전하나 문서 상 사각이다.

---

**[INFO]** `schemaCache` 상수(`SCHEMA_LOOKUP_HARD_STOP = 3`)의 SoT 이동 — spec Rationale 와 일치하나 새 소유 위치 미명시

- target 위치: `tools/assistant-tool-router.service.ts` 줄 11~15 (상수 정의 + JSDoc)
- 과거 결정 출처: `spec/3-workflow-editor/4-ai-assistant.md` Rationale "schemaCache 정책" — "이 상수를 변경할 때는 서비스 L137–142 주석 + L459–462 inline 주석 + 테스트 3회차 기대값을 모두 동시에 고친다"
- 상세: `SCHEMA_LOOKUP_HARD_STOP` 상수가 `workflow-assistant-stream.service.ts`(구 소유)에서 `assistant-tool-router.service.ts`(신 소유)로 이동했다. 상수 관리 규칙에서 인용된 구 줄 번호(`L137–142`, `L459–462`)는 리팩터링 후 더 이상 정확하지 않다. spec 의 유지보수 체크리스트는 구 파일 라인을 가리키고 있어 다음 유지보수자가 혼란을 겪을 수 있다.
- 제안: `spec/3-workflow-editor/4-ai-assistant.md` Rationale "schemaCache 정책" 의 "서비스 L137–142 주석 + L459–462 inline 주석" 라인 참조를 "`assistant-tool-router.service.ts` 의 `SCHEMA_LOOKUP_HARD_STOP` 상수 정의부 + 관련 inline 주석 + 테스트 3회차 기대값"으로 교체하면 spec Rationale 가 구현 현실과 정합된다.

---

**[INFO]** `verify_workflow` 의 `kind='explore'` 분류 — spec 과 구현이 일치, Rationale 추적성 확인

- target 위치: `tools/tool-definitions.ts` 줄 28~31 (`verify_workflow: 'explore'` + inline comment)
- 과거 결정 출처: `spec/3-workflow-editor/4-ai-assistant.md §4.1` 표 및 §5.4 "SSE 도구 kind 분류" 표 — "`verify_workflow` ... shadow 만 읽고 외부 자원 접근이 없는 read-only 도구라 `kind='explore'` 로 발행된다"
- 상세: 구현이 spec Rationale 의 `kind='explore'` 결정을 준수하며, `ok:true` 시 `reviewCompleted=true` 를 반환해 호출부가 `guardState.reviewCompleted` 를 set 하는 흐름도 spec §10 "Phase 3" 설명과 일치한다. 충돌 없음. 단, spec 의 §4.1 표에 `verify_workflow` 가 명시됐으나 `tool-definitions.ts` 의 `TOOL_KIND_BY_NAME` 주석이 spec 절 번호를 참조하지 않아 spec↔코드 추적성이 다소 낮다.
- 제안: `TOOL_KIND_BY_NAME` 의 `verify_workflow` 항목 주석에 "spec §4.1 / §10 Phase 3" 참조를 추가하면 추적성이 향상된다.

---

**[INFO]** Canvas §12 (AI Agent Tool Area) 의 비활성 섹션 — 구현이 Rationale 의 "재작성 예정" 결정을 올바르게 준수

- target 위치: `spec/3-workflow-editor/0-canvas.md §12`, `spec/4-nodes/3-ai/1-ai-agent.md` §1 박스
- 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md §12` 경고 박스 — "Tool Area 시각·인터랙션은 현재 비활성이며, AI Agent의 도구 연결 config 필드(`toolNodeIds` / `toolOverrides`)도 스키마에서 제거됐다"
- 상세: 현 구현에는 `toolNodeIds` / `toolOverrides` / Tool Area drag-drop 에 대한 코드가 없고, 새 `AssistantToolRouter` 는 Tool Area 연동과 무관한 별도 책임(assistant stream의 explore dispatch)을 담당한다. spec §12 가 "재작성 예정" 상태임을 유지하면서 현 구현이 해당 비활성 영역을 재도입하지 않고 있다. 충돌 없음.

---

### 요약

M-3 1단계 `AssistantToolRouter` 추출은 `spec/3-workflow-editor/4-ai-assistant.md` 의 Rationale 에 기록된 모든 합의 원칙 — `TOOL_KIND_BY_NAME` 단일 소비점, `schemaCache` 정책, `verify_workflow` 의 `kind='explore'` 분류, Phase 3 `reviewCompleted` 신호 — 을 정확히 준수하고 있다. 기각된 대안(Canvas Tool Area drag-drop, `toolNodeIds`/`toolOverrides` 재도입)도 발견되지 않았다. 지적 사항은 모두 INFO 등급으로, ① `SCHEMA_LOOKUP_HARD_STOP` 상수 이동에 따른 spec 유지보수 체크리스트의 줄 번호 stale, ② M-3 후속 단계를 위한 §4.4 WebsocketService 단일 sink 정책 주의사항의 plan 명시화, ③ `TOOL_KIND_BY_NAME` 의 spec 절 참조 보강이다. Rationale 번복 또는 기각된 대안의 재도입은 없다.

### 위험도

LOW

---

STATUS: SUCCESS
