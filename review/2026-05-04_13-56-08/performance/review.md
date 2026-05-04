## 발견사항

### [WARNING] `findEntryBySid` — `execute()` 호출마다 O(n) 선형 탐색 + 정규식 실행
- **위치**: `mcp-tool-provider.ts:findEntryBySid` (약 line 268-274)
- **상세**: `execute()`가 호출될 때마다 세션 맵 전체를 순회하면서 각 항목에 `shortIntegrationId(entry.integrationId)` — 내부적으로 `regex replace` — 를 반복 실행한다. 세션 수(n)가 적을 때는 체감이 작지만, 구조적으로 O(n) 탐색을 매 툴 호출마다 수행하는 것은 불필요하다. 세션 맵의 키가 `integrationId`(전체)인데 조회 키는 `sid`(8자 축약)여서 역방향 맵 없이는 직접 O(1) 조회가 불가능하다.
- **제안**: `ServerEntry`에 `sid` 필드를 추가하거나, `sessionsByExecution` 내부 맵의 키를 `sid`로 교체해 O(1) 직접 조회로 변경.

```typescript
// 현재
private readonly sessionsByExecution = new Map<string, Map<string, ServerEntry>>();
// sessions.set(ref.integrationId, entry);  ← 전체 id로 저장

// 개선
// sessions.set(shortIntegrationId(ref.integrationId), entry); ← sid로 저장
// execute()에서: sessions.get(parsed.sid) 직접 O(1) 조회 가능
```

---

### [WARNING] 멀티턴 매 턴마다 MCP 세션 전수 재연결 — 대화가 길수록 누적 I/O 급증
- **위치**: `ai-agent.handler.ts:execute()` — `finally { await this.cleanupProviders(context.executionId) }`
- **상세**: `waiting_for_input` 경로(다음 사용자 메시지 대기)를 포함해 `execute()` 반환 시마다 모든 MCP 세션을 닫고, 다음 턴에서 `buildTools`가 다시 connect → listTools → close를 수행한다. MCP 서버 2개 × 10턴 대화 = **60회 네트워크 왕복** (connect 20 + listTools 20 + close 20). `LIST_TIMEOUT_MS=10s`, `CALL_TIMEOUT_MS=30s`를 고려하면 단순 세션 생명주기만으로도 턴당 수백 ms 이상의 부가 지연이 발생할 수 있다.
- **제안**: 세션을 실행(executionId) 전체 수명 동안 유지하는 옵션 검토. 멀티턴에서는 `ended`/`error` 시에만 cleanup하고, `waiting_for_input`에서는 세션을 유지해 다음 턴이 캐시된 세션을 재사용하도록 설계. 결정론적 재빌드가 필요하다면 `buildTools` 호출 시 이미 캐시된 세션을 재사용하면 되므로 close/reconnect 없이도 동일한 보장이 가능하다.

---

### [WARNING] `successResult` — 크기 체크 전에 전체 페이로드를 문자열로 직렬화
- **위치**: `mcp-tool-provider.ts:successResult` (약 line 577-594)
- **상세**: `JSON.stringify(payload ?? null)`로 전체 응답을 한번에 메모리에 적재한 뒤 `json.length`를 체크한다. 응답이 `MAX_RESPONSE_BYTES`(기본 100KB)를 초과할 경우 전체 직렬화 문자열(수 MB 가능)을 할당한 후, 다시 `Buffer.from(json.slice(0, MAX_RESPONSE_BYTES))` + base64 인코딩으로 추가 할당이 발생한다. 대용량 MCP 응답 시 GC 부하가 늘어난다.
- **제안**: `JSON.stringify` 대신 응답을 청크 단위로 직렬화하거나, `replacer` + 길이 한도 체크로 조기 중단하는 방법 검토. 단기 해결책으로는 `json.length` 체크 후 slice만 하고 base64 preview는 생략하거나, `json.slice(0, MAX_RESPONSE_BYTES)`를 직접 content로 반환하는 것도 하나의 대안.

---

### [INFO] `withTimeout` — 타임아웃 후 원래 Promise가 계속 실행됨 (orphaned request)
- **위치**: `mcp-tool-provider.ts:withTimeout` (약 line 138-158)
- **상세**: 타임아웃이 발생해 wrapper Promise가 reject되어도 내부의 `p` (MCP HTTP 요청)는 취소되지 않고 계속 실행된다. 응답이 30초 지연되어 타임아웃 직후 도착하면 Promise 체인의 메모리와 MCP 서버 연결이 그 기간 동안 유지된다.
- **제안**: 하위 HTTP 클라이언트가 `AbortSignal`을 지원한다면 `AbortController`를 통한 실제 취소 전파를 고려. 지원하지 않는 경우 현 설계는 허용 가능하나, 타임아웃된 요청이 완료 후 로그에 noise를 남기지 않도록 `.catch(() => {})` 처리 추가 권장.

---

### [INFO] `mcpClient.connect()` 자체에는 타임아웃이 없음
- **위치**: `mcp-tool-provider.ts:openServer` — `const session = await this.mcpClient.connect(params);`
- **상세**: `listTools()` 호출은 `withTimeout`으로 감싸져 있지만, 그 이전의 `connect()` 호출은 타임아웃이 없다. TCP 수준에서 연결이 지연되거나 DNS 해석이 느릴 경우 `buildTools`가 무기한 대기할 수 있다.
- **제안**: `connect()` 호출도 `withTimeout(this.mcpClient.connect(params), CONNECT_TIMEOUT_MS, 'connect')` 형태로 감싸고, `MCP_CONNECT_TIMEOUT_MS` 환경변수로 조정 가능하게 구성.

---

### [INFO] 캐시된 세션에서도 `buildToolDefsForEntry` 매번 재실행
- **위치**: `mcp-tool-provider.ts:materializeServer` — `return this.buildToolDefsForEntry(ref, entry);`
- **상세**: 세션이 이미 캐시되어 있어도 `buildToolDefsForEntry`는 매 `buildTools()` 호출마다 ToolDef 배열과 Override Map을 새로 생성한다. 단일 실행 내 `buildTools`가 여러 번 호출되는 경우(현재 설계상 매 턴) 불필요한 객체 할당이 반복된다.
- **제안**: `ServerEntry`에 `toolDefs: ToolDef[]` 캐시 필드를 추가하고, ref의 `enabledTools`/`toolOverrides` 설정이 동일할 경우 재사용. 단, 현재 멀티턴마다 세션 자체를 재생성하는 구조에서는 효과가 없으므로 WARNING#2 개선과 함께 검토 필요.

---

## 요약

이번 변경의 핵심 구현체인 `McpToolProvider`는 `Promise.allSettled` 병렬 연결, executionId 기반 세션 격리, 오류 격리 등 설계 방향이 올바르나, **멀티턴 대화마다 세션을 전량 재연결하는 패턴**(WARNING#2)이 긴 대화에서 누적 I/O 지연을 유발하는 주요 병목이다. `findEntryBySid`의 O(n) 선형 탐색(WARNING#1)과 대형 응답의 전체 직렬화 후 크기 체크(WARNING#3)도 추가적인 개선 포인트다. 프론트엔드(`mcp-server-selector.tsx`)는 `staleTime`·`Set` 활용 등 전반적으로 문제없다.

## 위험도

**MEDIUM**