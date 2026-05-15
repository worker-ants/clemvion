## 발견사항

### **[WARNING]** `runProviderTool` — 에러 복구 동작이 기존 동작을 변경함
- **위치**: `ai-agent.handler.ts` — `runProviderTool` private method (catch 블록)
- **상세**: 이전에는 `provider.execute()` throw가 상위로 전파되어 해당 turn 전체를 실패시켰음. 이번 변경으로 throw를 catch해 LLM에 error content를 주입하고 turn을 계속 진행시키는 동작이 추가됨. 이는 단순 텔레메트리 추가가 아니라 **기존 실패 처리 동작의 변경**. 스펙 문서에서 이 복구 동작을 명시적으로 요구했는지 확인 필요.
- **제안**: 의도된 변경이라면 commit message / spec에 "provider.execute 예외 시 turn 계속 진행" 동작을 명기할 것. 아니라면 별도 PR로 분리.

---

### **[INFO]** `kb-tool-provider.ts` search_failed 응답에 `message` 필드 추가
- **위치**: `kb-tool-provider.ts` diff +3번째 덩어리 (`message: msg` 라인)
- **상세**: `status`/`error` 필드 추가와 함께 `content` JSON에 `message: msg`도 추가됨. LLM에 전달되는 tool_result content가 바뀌는 변경으로, 텔레메트리 목적의 필드 추가 범위를 초과.
- **제안**: `message` 필드 추가가 LLM 응답 품질 개선 의도라면 별도 커밋으로 분리해 추적 가능하게 할 것.

---

### **[INFO]** `tryParseJson` 함수 중복 정의
- **위치**: `use-execution-events.ts:11-16` 및 `conversation-utils.ts` (기능적으로 동일)
- **상세**: 동일한 JSON 파싱 유틸이 두 파일에 각각 로컬로 정의됨. 범위 위반은 아니나 향후 유지보수 부담.
- **제안**: `conversation-utils.ts`에서 export하거나 공통 util 모듈로 추출.

---

### **[INFO]** `ai_message` 핸들러 동작 변경 — append → replace
- **위치**: `use-execution-events.ts` `handleAiMessage` callback
- **상세**: 기존에는 개별 assistant 메시지를 `addConversationMessage`로 누적했으나, 이제 `setConversationMessages`로 전체 교체. 기능상 올바른 변경이지만 기존 동작의 변경이므로 regression 가능성 주의. 테스트에서 "legacy fallback" 케이스가 별도 커버되어 있어 검증은 충분함.

---

## 요약

전반적으로 변경 범위는 "AI Agent tool 호출/응답을 디버깅 타임라인에 가시화"라는 의도에 잘 부합한다. 백엔드의 `TOOL_CALL_STARTED/COMPLETED` 이벤트 추가, `ToolCallTrace` 기록, 프론트엔드의 store 액션·WS 핸들러·UI 렌더링까지 일관된 흐름으로 연결되어 있으며 무관한 파일 수정이나 불필요한 포맷팅 변경은 발견되지 않았다. 다만 `runProviderTool`의 에러 복구 동작이 단순 텔레메트리 추가를 넘어 기존 실패 처리 방식을 변경하는 부분은 의도성을 명확히 문서화하거나 별도 PR로 분리하는 것을 권장한다.

## 위험도

**LOW**