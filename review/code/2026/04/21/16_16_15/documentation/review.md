## 발견사항

### **[INFO]** `LLMClient.stream()` 인터페이스 문서화 — 일부 미흡
- **위치**: `llm-client.interface.ts` — `stream?()` 메서드 JSDoc
- **상세**: `throw LLM_STREAMING_UNSUPPORTED` 조건을 "synchronously" 라고 명시했으나, `async generator`는 동기 throw가 불가능하고 실제로 `llm.service.ts`에서 `.stream` 존재 여부를 선 검사(`if (!client.stream)`)하는 방식으로 처리됨. 문서와 구현 의도가 미묘하게 불일치.
- **제안**: "Providers without streaming support should leave this field undefined. The service layer guards against absent implementations before calling." 으로 수정.

---

### **[INFO]** `workflow-assistant-stream.service.ts` 파일 전체 누락
- **위치**: 파일 18 — diff가 "omitted due to prompt size limit"으로 표시됨
- **상세**: 스트리밍 로직의 핵심 서비스인데 리뷰 대상에 포함되지 않아 문서화 품질 확인 불가. 이 서비스가 `chatStream`, `ExploreToolsService`, `ShadowWorkflow`를 어떻게 오케스트레이션하는지, SSE 이벤트 포맷 등 문서화가 가장 집중되어야 할 지점임.
- **제안**: 해당 파일의 클래스 레벨 JSDoc 및 `streamMessage()` 메서드에 파라미터·반환 이벤트 형태 문서 추가 필요성 별도 확인 필요.

---

### **[INFO]** `WorkflowAssistantSessionService.appendMessage()` — 비원자적 업데이트 주석이 불완전
- **위치**: `workflow-assistant-session.service.ts:160` 인근 주석
- **상세**: "트랜잭션 없이도 안전하도록 세션의 비정규화 필드는 동일 save 단위로 함께 갱신한다"라고 했으나 실제 구현을 보면 `messageRepo.save()` → `sessionRepo.update()` → `sessionRepo.increment()` 3번의 별개 쿼리로 분리되어 있음. 주석이 의도를 설명하려 했으나 구현 현실과 맞지 않아 독자를 혼란시킬 수 있음.
- **제안**: "Non-transactional: three separate writes. Acceptable because `message_count` and `last_interaction_at` are display-only denormalized fields — a partial write results in a stale counter, not data loss." 로 정확히 기술.

---

### **[INFO]** `buildSystemPrompt()` 내 한국어 주석 부재
- **위치**: `system-prompt.ts` — JSDoc
- **상세**: 파일 헤드의 JSDoc은 구성 단계를 번호로 잘 정리했으나, `catalog` 및 `current` 변환 로직 안에 인라인 설명이 없어 포트 추출 로직(`Array.isArray(d.ports?.outputs)` 분기)의 의도가 불명확함. 포트 배열이 `string | {id: string}` 유니온인 이유가 문서화되지 않음.
- **제안**: `// ports array may contain string shorthand or {id, ...} objects — normalize to id string` 수준의 짧은 주석 추가.

---

### **[INFO]** `ShadowWorkflow` — `resolveCategory()` 폴백 문서화 미흡
- **위치**: `shadow-workflow.ts:resolveCategory()`
- **상세**: 알 수 없는 타입에 대해 `'logic'`으로 폴백하는 이유가 설명되지 않음. 외부 호출자(시스템 프롬프트, ExploreToolsService)와의 계약이 불명확.
- **제안**: `// Unknown types default to 'logic'; the LLM is responsible for providing a known type — this is a safe-fallback, not a canonical assignment.` 추가.

---

### **[INFO]** `handleSseEvent()` — 사이드 이펙트 문서화 필요
- **위치**: `assistant-store.ts:handleSseEvent()`
- **상세**: 함수 시그니처 위 JSDoc이 "Also calls into `applyAssistantOperation`"을 언급하지만, `import('@/lib/stores/editor-store')` lazy import를 통한 모듈 사이클 회피 이유가 설명되지 않음. 이 패턴은 코드를 처음 보는 개발자에게 비직관적.
- **제안**: `// Dynamic import avoids circular dependency: assistant-store ↔ editor-store` 주석 추가.

---

### **[INFO]** `assistantApi.streamMessage()` — fetch 사용 이유 문서화 양호, SSE 파싱 로직은 미흡
- **위치**: `assistant.ts:parseSseRecord()`
- **상세**: `streamMessage()` 상단 주석에서 "EventSource can only GET" 이유를 잘 설명. 하지만 `parseSseRecord()`는 주석 없이 구현만 존재. 특히 multi-line `data:` 필드 누적 처리(`data +=`) 동작이 표준 SSE 스펙에서의 의미를 모르는 독자에게 불명확.
- **제안**: `// SSE spec: multiple data: lines within one record are concatenated with LF` 주석 추가.

---

### **[INFO]** `AssistantWorkflowNodeDto` — `@ApiProperty` 데코레이터 누락
- **위치**: `assistant-message-request.dto.ts` — `AssistantWorkflowNodeDto` 내 필드들
- **상세**: `AssistantMessageRequestDto`의 `content`, `currentWorkflow`, `llmConfigId`에는 `@ApiProperty`가 붙어 있으나, 중첩 DTO인 `AssistantWorkflowNodeDto`와 `AssistantWorkflowEdgeDto` 필드에는 `@ApiProperty` 데코레이터가 전혀 없어 Swagger 문서에서 스키마가 불완전하게 렌더링됨.
- **제안**: `AssistantWorkflowNodeDto`·`AssistantWorkflowEdgeDto` 각 필드에 `@ApiProperty`/`@ApiPropertyOptional` 추가.

---

### **[INFO]** SQL 마이그레이션 파일 — `tool_calls` JSONB 스키마 버전 관리 없음
- **위치**: `V019__workflow_assistant.sql` — `tool_calls` 컬럼 주석
- **상세**: `tool_calls` 컬럼의 JSON shape를 인라인 주석으로 잘 설명했으나, 이 shape가 변경될 경우 기존 데이터와의 호환성 처리 방법이 문서화되지 않음. spec 참조(`spec/3-workflow-editor/4-ai-assistant.md`)는 있어 추적은 가능.
- **제안**: `-- Shape version: v1. Bump in a later migration + write a backfill if shape changes.` 수준의 주석으로 진화 가능성을 명시하는 것이 좋음. (권고 수준)

---

### **[INFO]** `applyAssistantOperation` — JSDoc과 실제 구현 간 undo 동작 불일치 가능성
- **위치**: `editor-store.ts:applyAssistantOperation` JSDoc
- **상세**: JSDoc에 "Pushes undo so the user can rollback"이라고 명시했으나, 실제 구현에서 `add_node`는 `s.addNode()`를 호출(내부적으로 undo push 여부 불명확), `remove_edge`만 명시적으로 `s.pushUndo()`를 호출함. `update_node`의 `updateNodeConfig`와 `set()`은 undo를 push하지 않음. 문서가 구현보다 과장된 보장을 제공.
- **제안**: "Undo support depends on the underlying mutator; `remove_edge` explicitly calls `pushUndo()`. Other operations rely on the mutator's built-in undo." 로 정확하게 수정.

---

### **[INFO]** `tool-call-badge.tsx` — JSDoc 유일, 나머지 컴포넌트들은 없음
- **위치**: `tool-call-badge.tsx:1–6`
- **상세**: `ToolCallBadge`에만 컴포넌트 레벨 주석이 있고, `AssistantPanel`, `AssistantMessageView`, `PlanCard`, `MessageInput`에는 없음. 단, CLAUDE.md에 따르면 이 프로젝트는 "주석은 WHY가 non-obvious할 때만 작성" 원칙을 따르므로 UI 컴포넌트 주석 부재는 정책에 부합함.
- **제안**: 현 상태 유지 (정책 적합).

---

## 요약

전반적으로 문서화 품질은 **양호한 수준**이다. SQL 마이그레이션 파일의 인라인 주석, `ShadowWorkflow`의 클래스 레벨 JSDoc, 시스템 프롬프트 구조 설명, SSE 스트리밍 사유 설명 등 핵심 복잡도 지점에서 문서화가 잘 이루어져 있다. 주요 개선 지점은 두 가지다: (1) `AssistantWorkflowNodeDto` 중첩 필드에 `@ApiProperty` 미적용으로 Swagger 문서가 불완전하고, (2) `applyAssistantOperation` JSDoc이 undo 동작을 과장 보증하여 실제 구현과 불일치한다. 나머지는 정보성 수준의 개선 사항이며 기능적 위험을 수반하지 않는다.

## 위험도

**LOW**