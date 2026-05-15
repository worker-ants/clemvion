## 발견사항

### [WARNING] `UiHint.widget` JSDoc의 위젯 목록에 `mcp-server-selector` 누락
- **위치**: `backend/src/nodes/core/node-component.interface.ts`, `UiHint` interface의 JSDoc (~L174)
- **상세**: 해당 인터페이스에는 지원 위젯 목록을 나열하는 JSDoc이 있으나, 이번에 추가된 `mcp-server-selector`가 포함되어 있지 않음. 새 위젯을 추가하는 개발자가 이 목록을 신뢰할 경우 혼란을 야기할 수 있음.
- **제안**: `- mcp-server-selector — MCP 서버 selector (McpServerSelector 컴포넌트 래퍼)` 항목 추가

---

### [WARNING] 신규 환경변수 3종에 대한 외부 문서 없음
- **위치**: `backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`, L43-46
- **상세**: `MCP_MAX_RESPONSE_BYTES`, `MCP_CALL_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS` 세 개의 환경변수가 인라인 상수로 추가되었고 각각 fallback 값이 있지만, `.env.example`, README, 또는 별도 설정 문서에 등록되어 있지 않음. 운영 환경 튜닝이 필요한 경우 발견하기 어렵다.
- **제안**: `.env.example`에 세 변수를 기본값과 함께 추가하고 brief한 설명 주석을 달거나, `spec/5-system/11-mcp-client.md`에 "환경변수 설정" 섹션을 추가할 것.

---

### [WARNING] `widget-registry.ts` JSDoc이 새로운 동작과 불일치
- **위치**: `frontend/src/components/editor/settings-panel/auto-form/widget-registry.ts`, WIDGET_REGISTRY JSDoc
- **상세**: 기존 주석은 "Widgets requiring app-level selectors…are marked as **unsupported** in auto-form"이라고 명시하고 있으나, 이번 변경으로 `mcp-server-selector`는 app-level selector임에도 `UnsupportedWidget` 대신 실제 컴포넌트로 등록되었음. 주석이 현재 설계 의도를 잘못 전달하고 있다.
- **제안**: 주석을 "integration-selector, workflow-selector, condition-builder 는 unsupported — override registry 를 사용. mcp-server-selector, kb-selector, llm-config-selector 는 auto-form에서 직접 지원." 식으로 개정할 것.

---

### [INFO] `aiAgentNodeMetadata.description`이 MCP 기능을 반영하지 않음
- **위치**: `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`, `aiAgentNodeMetadata`
- **상세**: description이 여전히 `"Chat with LLM using RAG context"`로 되어 있으나, 이번 변경으로 MCP 서버 도구도 노출됨. 캔버스 팔레트에서 사용자가 보는 첫 번째 설명문이므로 기능 범위를 오해할 수 있다.
- **제안**: `"Chat with LLM using RAG and MCP tools"` 또는 `"Chat with LLM using KB search and MCP server tools"` 등으로 업데이트.

---

### [INFO] `toConnectParams` 메서드의 지원 인증 유형이 문서화되지 않음
- **위치**: `backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`, `toConnectParams` private method
- **상세**: `bearer_token`, `api_key`, `none` 세 가지 authType을 처리하는 분기가 있지만 메서드에 JSDoc이 없음. `IntegrationLike`의 credentials 구조체 필드(`url`, `token`, `header_name`, `value`, `default_headers`)가 묵시적 계약으로만 존재한다.
- **제안**: 지원하는 authType 목록과 각각에 필요한 credentials 키를 JSDoc으로 명시할 것.

---

### [INFO] `mcp-server-selector.tsx`의 spec 참조에 경로 없음
- **위치**: `frontend/src/components/integrations/mcp-server-selector.tsx`, `add` 함수 내 주석
- **상세**: `// matches spec §5.6 default_true semantics`라는 주석이 있으나 spec 문서 경로가 없음. 프론트엔드 개발자가 백엔드 spec 문서 경로(`spec/5-system/11-mcp-client.md`)를 모를 경우 추적이 어렵다.
- **제안**: `// spec/5-system/11-mcp-client.md §5.6 default_true semantics`로 경로 명시.

---

### [INFO] `execution-engine.service.spec.ts`의 McpClientService 목(mock) 범위
- **위치**: `backend/src/modules/execution-engine/execution-engine.service.spec.ts`, L258-263
- **상세**: 테스트 목이 `connect: jest.fn()`만 포함하고 있음. `McpClientService`에 추후 메서드가 추가될 때 테스트 파일 설명 없이 스텁이 깨질 수 있다. 현재는 서비스가 실제로 `connect`만 직접 호출하므로 기능 상 문제는 없으나, 목의 의도가 명확하지 않음.
- **제안**: 주석으로 "ExecutionEngine 자체는 McpClientService를 직접 호출하지 않고 McpModule을 통해 McpToolProvider에 위임한다 — connect 스텁만으로 충분"임을 명시할 것.

---

## 요약

전반적으로 이번 MCP 통합 코드의 문서화 품질은 우수하다. `McpToolProvider` 클래스, `AgentToolProvider` 인터페이스, `mcpServerRefSchema`의 UI 힌트, 핸들러 내 `finally` 블록 주석 등 WHY를 설명하는 인라인 주석이 충실히 작성되어 있으며, `spec/5-system/11-mcp-client.md` 스펙 문서 참조도 백엔드 전반에 걸쳐 일관되게 사용되고 있다. 다만 신규 환경변수 3종(`MCP_MAX_RESPONSE_BYTES` 등)에 대한 외부 운영 문서가 없고, `node-component.interface.ts`의 위젯 목록 및 `widget-registry.ts`의 JSDoc이 최신 상태를 반영하지 않는 점은 유지보수 과정에서 혼선을 줄 수 있어 수정이 권장된다.

## 위험도

**LOW**