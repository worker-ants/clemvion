### 발견사항

---

**[CRITICAL] History 모드에서 tool 메시지가 완전히 누락됨**
- 위치: `conversation-inspector.tsx` — `SummaryView` 내 `useMemo` (아래 블록)
- 상세: `isLive=false`일 때 `output.messages`를 순회해 `ConversationItem[]`를 재조립하는데, `role === "tool"` 케이스가 아예 없다. Live 모드에서는 `conversationMessages` 스토어 값을 그대로 사용하므로 tool 라인이 표시되지만, History 모드에서는 tool 아이템이 소리 없이 드롭된다. 새로 추가된 compact tool 라인 렌더링 전체가 History에서 동작하지 않는다.
  ```ts
  // msgs의 role === "tool" 분기가 없음
  for (const m of msgs) {
    if (m.role === "user") { ... }
    else if (m.role === "assistant") { ... }
    else if (m.role === "system" && isRagContextContent(m.content)) { ... }
    // ← tool role 없음
  }
  ```
- 제안: History 재조립 루프에 `else if (m.role === "tool")` 분기를 추가해 `toolCallId`, `toolStatus`, `toolResult`, `toolArgs`, `durationMs` 등을 매핑한다.

---

**[WARNING] `summarizeToolResult` 에서 문자열 값만 따옴표로 감싸 — 타입별 포맷 불일치**
- 위치: `conversation-inspector.tsx:summarizeToolResult` (객체 분기)
- 상세: 객체의 첫 번째 값이 문자열이면 `"value"` 형태로 감싸지만, 숫자·불리언은 그냥 `42`, `true`로 출력한다. 테스트 케이스 `{id: 42, +2}`는 숫자를 직접 표시하는 반면, 문자열 값이 있는 객체는 `{name: "Hong", +2}` 형태가 된다. UI에서 시각적으로 불일치하며 사용자가 값 타입을 혼동할 수 있다.
- 제안: 따옴표를 제거하고 일관되게 raw 값만 표시하거나, 반대로 모든 타입을 JSON 직렬화 형태로 통일한다.

---

**[WARNING] `pending` 상태 tool의 동작이 테스트되지 않음**
- 위치: `conversation-inspector.test.tsx`
- 상세: `toolStatus === "pending"` 케이스에서 `ToolStatusIcon`이 스피너를 렌더하고, `summarizeToolResult`가 빈 문자열을 반환(toolResult가 null)하는 경로가 테스트에 없다. 스트리밍 중 pending 상태는 live 대화에서 빈번히 발생하는 실제 경로다.
- 제안: pending 상태 아이템으로 렌더 테스트를 추가하고, summary span이 미노출되며 스피너가 표시되는지 검증한다.

---

**[WARNING] `baseProps`에 required prop `conversationMessages`가 누락**
- 위치: `conversation-inspector.test.tsx:29-38`
- 상세: `ConversationInspectorProps`에서 `conversationMessages: ConversationItem[]`는 optional이 아닌데, `baseProps` 객체에 포함되지 않았다. 각 테스트가 개별로 추가하므로 현재는 동작하지만, 이후 `conversationMessages`를 추가하지 않고 `{...baseProps}`만 사용하는 테스트가 작성될 경우 컴파일 에러나 런타임 오류로 이어진다.
- 제안: `baseProps`에 `conversationMessages: []`를 기본값으로 포함하거나, 각 테스트에서 명시적으로 요구하는 구조를 문서화한다.

---

**[WARNING] History 모드 tool 렌더링 테스트 없음**
- 위치: `conversation-inspector.test.tsx` — 모든 테스트가 `isLive: true`
- 상세: 7개 테스트 전부 `isLive: true`(baseProps 기본값)로 실행된다. History 모드(`isLive: false`) 에서의 tool 렌더링은 전혀 검증되지 않는다. CRITICAL 이슈(history 모드 재조립 누락)와 직접 연결된다.
- 제안: `isLive: false`이고 `result.outputData`에 tool role 메시지를 포함한 케이스를 추가한다.

---

**[INFO] `ToolStatusIcon` — undefined 처리 안전**
- 위치: `conversation-inspector.tsx:ToolStatusIcon`
- 상세: `status`가 `undefined`일 때 `return null`로 처리되어 렌더 에러가 없다. pending/success/error 이외 상태도 조용히 무시된다.

---

**[INFO] 문자열 truncate 테스트에서 regex 활용 정확**
- 위치: `conversation-inspector.test.tsx:113-121`
- 상세: 스팬의 실제 텍스트 콘텐츠는 `· aaa…(80개)…`이므로 `/a{80}…$/`가 정확히 매칭된다. 주석의 "prefix `· ` 포함된 한 텍스트 노드" 설명과 구현이 일치한다.

---

### 요약

신규 compact tool 시스템 라인 기능의 핵심 로직(`summarizeToolResult`, `ToolStatusIcon`, SummaryView 분기 렌더링)은 Live 모드에서 의도대로 구현되어 있으며 테스트도 충실하다. 그러나 **History 모드에서 `tool` role 메시지가 재조립 루프에서 완전히 누락**되어, 실행 이력을 조회할 때 tool 호출이 전혀 표시되지 않는 치명적 누락이 있다. 이는 신기능의 절반에 해당하는 케이스가 동작하지 않음을 의미하며, History 모드 테스트가 없어 CI에서도 걸러지지 않는다. 문자열 값 따옴표 처리의 포맷 불일치와 `baseProps` 불완전 구성은 중간 수준의 유지보수 위험이다.

### 위험도

**HIGH**