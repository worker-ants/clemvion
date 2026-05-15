## 발견사항

### [WARNING] MCP tool result의 `isError` 필드 미처리
- **위치**: `mcp-tool-provider.ts` `execute()` → `successResult()` 경로
- **상세**: MCP 프로토콜은 `callTool` 응답에 `{ isError: true, content: [...] }` 형태로 도구 수준 오류를 전달할 수 있습니다. 현재 구현은 `isError: true`인 응답도 `successResult()`로 그대로 LLM에 전달합니다. LLM이 이를 성공으로 오해할 수 있으며, 오류 전파 방식이 일반 `callTool` 실패(catch 경로)와 다르게 처리됩니다.
- **제안**: `result.isError === true` 여부를 체크해 `MCP_TOOL_ERROR` 코드로 구분하거나, 최소한 content 앞에 오류 신호를 포함시켜 LLM이 오류임을 인지할 수 있도록 처리.

---

### [WARNING] `sanitizeToolName` 충돌 시 무음 덮어쓰기
- **위치**: `mcp-tool-provider.ts` `openServer()` 내 `toolNameMap` 구성 (약 L375–382)
- **상세**: 한 서버에 `foo.bar`와 `foo_bar` 두 도구가 있을 경우, 둘 다 `foo_bar`로 sanitize되어 `toolNameMap.set`이 두 번 호출됩니다. 두 번째 도구가 첫 번째를 덮어쓰며, 첫 번째 도구는 LLM에게는 노출되지만(ToolDef는 모두 출력) `execute` 시에는 실제로 두 번째 도구가 호출됩니다. 경고 로그도 없습니다.
- **제안**: `toolNameMap.has(sanitizedName)` 충돌 감지 시 `warn` 로그 출력하고, 접미사(`_2` 등)로 disambiguate하거나 해당 도구를 건너뜀.

---

### [WARNING] `toConnectParams`에서 알 수 없는 `authType` 무음 처리
- **위치**: `mcp-tool-provider.ts` `toConnectParams()` (약 L430–445)
- **상세**: `bearer_token`, `api_key` 이외의 authType(예: `oauth2`, `basic`)은 `else` 분기로 `authType: 'none'`이 반환됩니다. 인증 없이 요청이 전송되어 MCP 서버에서 401이 반환되지만, 오류 메시지에 authType 불일치에 대한 힌트가 없어 진단이 어렵습니다.
- **제안**: 지원하지 않는 `authType`에 대해 명시적 예외를 던지거나 경고 로그 포함.

---

### [WARNING] 프론트엔드 MCP 서버 선택기에 API 오류 상태 미처리
- **위치**: `mcp-server-selector.tsx` (약 L42)
- **상세**: `useQuery`의 `isError` 상태가 확인되지 않습니다. `integrationsApi.list` 실패 시 `data?.data ?? []`가 빈 배열로 폴백되어 "No MCP server registered" 메시지가 표시됩니다. 사용자는 서버 목록 로드 실패와 서버 미등록을 구별할 수 없습니다.
- **제안**: `isError` 상태 체크 추가 및 오류 메시지 표시.

---

### [WARNING] `concurrentbuildTools` 동일 `executionId`에서 세션 이중 생성 가능
- **위치**: `mcp-tool-provider.ts` `materializeServer()` (약 L340–350)
- **상세**: `sessions.get(ref.integrationId)` → `undefined` → `openServer()` → `sessions.set()` 사이에 같은 `executionId`로 동시 `buildTools` 호출이 들어오면, 양쪽 모두 `undefined`를 보고 두 개의 세션을 생성합니다. 두 번째 `set`이 첫 번째를 덮어써 첫 번째 세션은 누수됩니다. 단일 노드 실행에서 `buildTools`가 두 번 병렬 호출되는 경우는 현재 드물지만, 미래의 병렬 실행 경로에서 문제가 됩니다.
- **제안**: 현재 low-risk이지만, `openServer` 호출을 Promise로 캐싱하는 패턴(double-check with pending map)으로 방어적 처리 가능.

---

### [INFO] `mcpServers` config에서 `enabledTools` 설정 불가 (UI 미노출)
- **위치**: `mcp-server-selector.tsx`
- **상세**: 스키마(`ai-agent.schema.ts`)는 `enabledTools` allowlist와 `toolOverrides`를 지원하지만, UI 컴포넌트는 `includeResources`와 `includePrompts` 토글만 노출합니다. 사용자가 JSON 직접 편집으로 `enabledTools`를 설정해도 UI에서는 불투명하게 처리됩니다. 컴포넌트 주석에 "advanced surfaces tracked separately"로 명시되어 있으나, 노출 여부를 확인할 방법이 없어 LLM에 불필요한 도구가 모두 노출될 수 있습니다.
- **제안**: 현재 스코프에서는 허용 가능. 단, `enabledTools`가 이미 설정된 경우 UI에서 "X tools filtered" 같은 읽기 전용 표시 정도는 추가하는 것을 권장.

---

### [INFO] `execution-engine.service.spec.ts` Mock 불완전
- **위치**: `execution-engine.service.spec.ts` (약 L259–264)
- **상세**: `McpClientService` mock이 `{ connect: jest.fn() }`만 제공합니다. `McpClientService`에 다른 메서드가 있거나 향후 추가되면, 해당 메서드를 통해 서비스를 테스트하는 케이스가 없을 때 런타임 오류(`TypeError: xxx is not a function`)가 발생합니다.
- **제안**: `McpClientService`의 실제 인터페이스를 반영하는 mock 사용 또는 `jest.createMockFromModule` 활용.

---

### [INFO] 멀티턴 매 턴마다 MCP 세션 재연결
- **위치**: `ai-agent.handler.ts` `execute()` finally 블록
- **상세**: finally에서 `cleanupProviders`가 호출되므로, `waiting_for_input` 상태로 중단되는 매 턴마다 MCP 세션이 닫힙니다. 다음 턴의 `buildTools`에서 새 세션을 생성합니다. 이는 의도적 설계(코멘트: "next turn rebuilds them deterministically")이지만, 연결 지연이 있는 MCP 서버의 경우 멀티턴 대화의 응답 시간이 누적적으로 증가합니다.
- **제안**: 현재는 명세 의도에 부합. 지연이 문제가 되면 persistent session 전략을 고려할 수 있으나 현재 스코프 밖.

---

### [INFO] `integrationId` 빈 문자열 스키마 통과
- **위치**: `ai-agent.schema.ts` `mcpServerRefSchema`
- **상세**: `integrationId: z.string()`에 `.min(1)` 검증이 없어 빈 문자열이 스키마를 통과합니다. `integrationsService.getForExecution('', workspaceId)`로 이어져 DB 오류가 발생하지만, 오류 메시지가 스키마 레벨이 아닌 런타임에서만 나타납니다.
- **제안**: `z.string().min(1)` 또는 UUID 포맷 검증 추가.

---

## 요약

MCP 통합 구현은 핵심 요구사항(세션 라이프사이클 관리, 멀티턴 상태 지속, 에러 격리, tool/resource/prompt 노출)을 대체로 충실히 반영하고 있습니다. `cleanupProviders`의 finally 패턴과 `Promise.allSettled`를 통한 서버별 에러 격리, `executionId` 기반 세션 캐싱 전략은 스펙과 잘 일치합니다. 다만 MCP 프로토콜 수준의 `isError` 처리 누락, sanitizedName 충돌 시 무음 덮어쓰기, 알 수 없는 authType의 silent fallback이 실제 운영 환경에서 디버깅을 어렵게 만드는 요인이며, 프론트엔드의 API 오류 미처리와 `enabledTools` 불투명 처리는 UX 관점의 요구사항 미비입니다.

## 위험도
**MEDIUM**