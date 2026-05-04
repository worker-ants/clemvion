### 발견사항

---

**[WARNING] TOOL_CALL_COMPLETED 페이로드에 툴 실행 결과 원문 포함**
- 위치: `ai-agent.handler.ts` → `runProviderTool`, `content: result.content` 라인
- 상세: `TOOL_CALL_COMPLETED` WS 이벤트에 `content: result.content`가 그대로 포함됩니다. KB 검색 결과(문서 청크 원문), MCP 툴 실행 결과 등 민감 데이터가 `execution:{executionId}` 채널 구독자 전원에게 라이브로 전송됩니다. 정상 응답 경로(`AI_MESSAGE`)와 달리 이 경로는 별도 content 제한이 없어, 대용량 KB 문서가 청크 단위로 풀 내용 브로드캐스트될 수 있습니다.
- 제안: 완료 이벤트의 `content`를 제거하거나 preview 길이(예: 200자)로 잘라서 전송할 것. 전체 결과는 `AI_MESSAGE` 스냅샷 경로에서만 수신하도록 클라이언트를 설계할 것.

---

**[WARNING] 내부 예외 메시지가 WS 이벤트로 클라이언트에 노출**
- 위치: `ai-agent.handler.ts` `runProviderTool` catch 블록; `kb-tool-provider.ts` `error: msg`; `mcp-tool-provider.ts` `error: \`${code}: ${message}\``
- 상세: `e.message`를 그대로 `ToolCallTrace.error` → `TOOL_CALL_COMPLETED.error` → 프론트엔드 UI로 전달합니다. DB 접속 오류, 내부 서비스 URL, 스택 일부가 포함된 예외 메시지가 최종 사용자 화면(`conversation-inspector.tsx`의 에러 배지)에 노출될 수 있습니다.
- 제안: Provider 레이어에서 사용자 노출용 에러 메시지와 내부 로그용 상세 메시지를 분리할 것. `AgentToolResult.error`는 미리 정의된 안전한 메시지 상수(예: `'검색에 실패했습니다'`)로 채우고, 원래 예외는 서버 로그에만 기록할 것.

---

**[INFO] LLM 응답에서 온 `toolCallId` / `arguments` 무검증 브로드캐스트**
- 위치: `ai-agent.handler.ts` `runProviderTool`, `TOOL_CALL_STARTED` emit 블록
- 상세: `call.id`(LLM provider가 생성)와 `call.arguments`(LLM이 생성한 JSON 문자열)가 길이·형식 검증 없이 WS 이벤트 페이로드에 포함됩니다. 손상된 LLM 응답이나 프롬프트 인젝션을 통해 조작된 `toolCallId`/`arguments`가 채널 구독자에게 전달될 수 있습니다. 현재 프론트엔드는 React의 기본 이스케이프 덕분에 XSS 위험은 없으나, 과도하게 긴 문자열이 WS 메시지 크기를 부풀릴 수 있습니다.
- 제안: `call.id`에 최대 길이(예: 128자) 및 `[a-zA-Z0-9_\-]` 형식 검증을 추가할 것. `arguments`는 `TOOL_CALL_STARTED` 이벤트에서 제거하거나 최대 크기를 제한할 것.

---

**[INFO] WS 채널 구독 권한 검증이 핸들러 레이어에서 부재**
- 위치: `ai-agent.handler.ts` → `runProviderTool`, `websocketService.emitExecutionEvent(executionId, ...)`
- 상세: `executionId`가 현재 워크스페이스/사용자에 귀속되는지에 대한 검증이 핸들러 내에 없습니다. 기존 WS 이벤트(`AI_MESSAGE` 등)와 동일한 채널·권한 모델을 따르므로 게이트웨이 레이어에서 이미 처리되어 있을 가능성이 높으나, 변경된 코드만으로는 확인 불가합니다.
- 제안: `websocket.gateway.ts`에서 `execution:*` 채널 구독 시 executionId 소유권 검증이 이루어지는지 리뷰할 것.

---

**[INFO] `nodeId`(내부 그래프 UUID) WS 이벤트 경유 외부 노출**
- 위치: `ai-agent.handler.ts` `TOOL_CALL_STARTED` / `TOOL_CALL_COMPLETED` 페이로드
- 상세: `nodeId`는 내부 워크플로 그래프의 UUID입니다. WS 이벤트에 포함되어 클라이언트에 전달되면 공격자가 그래프 구조를 파악하는 데 활용될 수 있습니다. 현재 활용도는 디버깅 타임라인 렌더링에 한정되어 있어 실질적 위험은 낮습니다.
- 제안: `nodeId`는 디버그 전용 채널 또는 인증된 관리자 뷰에만 노출하는 방향을 고려할 것.

---

### 요약

이번 변경은 AI Agent 툴 호출 흐름에 WebSocket 텔레메트리를 추가하는 작업으로, 전반적인 구현 방향은 적절합니다. 가장 주목할 이슈는 `TOOL_CALL_COMPLETED` 이벤트에 **툴 실행 결과 원문(`content`)** 이 포함된다는 점으로, KB 검색 문서 내용이나 MCP 결과가 WS 채널로 추가 전송됩니다. 두 번째로, 내부 예외 메시지가 `error` 필드를 통해 사용자 UI까지 그대로 흐르는 구조가 있어, 인프라 정보 노출 위험이 있습니다. XSS 취약점은 React의 기본 이스케이프로 차단되어 있고, 인증/인가 모델은 기존 WS 채널 구조를 그대로 따르므로 추가 우려는 없습니다.

### 위험도

**MEDIUM**