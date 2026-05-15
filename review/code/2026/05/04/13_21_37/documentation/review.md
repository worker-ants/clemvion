### 발견사항

---

- **[WARNING]** `spec/5-system/11-mcp-client.md §5.6` — `includeprompts` 오타
  - 위치: `spec/5-system/11-mcp-client.md` §5.6 도구 allowlist 절
  - 상세: `mcpServers[].includeResources: false` / `includeprompts: false` 라고 기술되어 있으나, `spec/4-nodes/3-ai-nodes.md` 의 McpServerRef 정의표에서는 `includePrompts`(camelCase) 로 정의됨. 두 spec 문서 간 필드명 불일치.
  - 제안: `includeprompts` → `includePrompts` 로 수정

---

- **[WARNING]** `mcp-test-connection.service.ts` — `McpFailureCode` 에 선언된 `'MCP_INITIALIZE_FAILED'` 미사용
  - 위치: `mcp-test-connection.service.ts:34`, `classifyConnectError()` 메서드
  - 상세: `McpFailureCode` 타입에 `'MCP_INITIALIZE_FAILED'` 가 포함되어 있고 `spec/5-system/11-mcp-client.md §8.2` 의 에러 vocabulary 에도 정의되어 있으나, 실제 구현의 `classifyConnectError`는 이 코드를 절대 생성하지 않는다(`MCP_CONNECT_FAILED`로 흡수됨). 타입 정의와 런타임 동작 간의 불일치가 미래 구현자에게 혼란을 줄 수 있다.
  - 제안: `classifyConnectError`에 "현재 initialize 실패는 connect 단계에서 `MCP_CONNECT_FAILED`로 통합됨"을 주석으로 명시하거나, 향후 `initialize` 단계 에러를 별도 분기할 때를 대비해 TODO 주석 추가

---

- **[WARNING]** 신규 환경변수 문서화 누락
  - 위치: `spec/5-system/11-mcp-client.md §4.3, §4.4`
  - 상세: spec에 `MCP_MAX_CONCURRENT_CONNECTIONS`(기본 20) 및 각 단계별 타임아웃 override 환경변수가 명세되어 있으나, `.env.example` 또는 README에 해당 변수 추가가 이번 diff에 포함되지 않았다. 운영자가 배포 시 설정 가능한 옵션임을 인지하지 못할 수 있다.
  - 제안: `.env.example`(또는 프로젝트의 설정 문서)에 `MCP_MAX_CONCURRENT_CONNECTIONS`, `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_CALL_TIMEOUT_MS` 항목 추가

---

- **[INFO]** `service-registry.ts` — `'none'` auth type 추가 컨텍스트 없음
  - 위치: `service-registry.ts` `AuthType` union 타입 확장
  - 상세: `'none'`이 MCP 전용 인증 없는 공개 서버용임을 코드상에서 알 수 없다. 향후 다른 서비스가 `'none'`을 오용할 가능성이 있다.
  - 제안: 타입 정의 위치 인근에 `// MCP no-auth variant용으로 추가` 수준의 짧은 주석 추가

---

- **[INFO]** `mcp-client.service.ts` — `McpConnectParams` 의 optional 필드와 런타임 required 간 불일치
  - 위치: `mcp-client.service.ts:14–28`
  - 상세: `bearer_token` 분기에서 `token?`(optional)으로 타입이 선언되어 있으나, `buildHeaders`에서 런타임에 falsy 체크 후 `McpAuthError`를 throw한다. Optional 표시는 상위에서 validated credentials가 넘어오지 않을 수 있는 경로를 허용하기 위한 의도인데, JSDoc이나 주석에 "runtime에서 required로 검증됨" 설명이 없어 타입만 보는 독자를 혼란스럽게 할 수 있다.
  - 제안: 해당 필드에 `// validated at runtime via McpAuthError` 수준 인라인 주석 추가

---

- **[INFO]** `integrations.service.ts` — 내부 용어 "Phase C" 미정의 주석
  - 위치: `integrations.service.ts`, `dispatchTest` 메서드 주석
  - 상세: "lands in Phase C alongside OAuth begin/preview-test" 라는 표현에서 "Phase C"가 무엇인지 코드베이스 어디에도 정의되어 있지 않다. 주석을 읽는 사람이 내부 개발 로드맵 용어임을 추론해야 한다.
  - 제안: "Phase C"를 "향후 transport 레벨 테스트 단계" 또는 spec 문서 링크로 교체하거나 삭제

---

- **[INFO]** `mcp.module.ts` — Stage 2 미래 경로 forward-reference
  - 위치: `mcp.module.ts` 모듈 JSDoc
  - 상세: "Stage 2 will add `McpToolProvider` (consumed by AI Agent's `AgentToolProvider` array). That provider lives in `nodes/ai/ai-agent/...`" — 아직 존재하지 않는 경로를 JSDoc에 명기. 경로가 변경되거나 구조가 달라질 경우 stale documentation이 된다.
  - 제안: 구체 경로 대신 "Stage 2: McpToolProvider — AI Agent 핸들러 모듈에 추가 예정" 수준의 추상적 표현으로 변경

---

### 요약

이번 변경은 MCP 클라이언트 통합이라는 신규 기능에 대해 spec 문서(`spec/5-system/11-mcp-client.md` 423줄), 코드 JSDoc, 테스트 주석 모두 충실하게 작성되어 있어 문서화 완성도가 전반적으로 높다. 그러나 `spec/5-system/11-mcp-client.md §5.6`의 `includeprompts` 오타와 `spec/4-nodes/3-ai-nodes.md`의 `includePrompts` 간 불일치, 타입 정의에만 존재하고 런타임에서 생성되지 않는 `MCP_INITIALIZE_FAILED` 코드, 그리고 신규 환경변수의 운영 문서 부재가 보완이 필요한 지점이다.

### 위험도
**LOW**