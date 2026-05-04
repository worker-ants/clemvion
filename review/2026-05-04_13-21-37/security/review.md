## 발견사항

---

### **[CRITICAL] SSRF(Server-Side Request Forgery) 방어 미구현**

- **위치**: `mcp-client.service.ts:requireHttpsUrl()` (L156–165)
- **상세**: `requireHttpsUrl()`은 `https://` scheme만 강제하고 호스트 제한이 없다. 공격자가 workspace에 MCP Integration을 등록하면서 `https://169.254.169.254/` (AWS IMDSv1), `https://metadata.google.internal/`, `https://10.x.x.x/`, `https://192.168.x.x/` 등 내부 자원을 가리키는 URL을 지정할 수 있다. 백엔드가 해당 URL로 `StreamableHTTPClientTransport`를 생성해 직접 연결하므로 클라우드 메타데이터, 내부 서비스가 노출된다.  
  spec 문서(§3.2)는 `"사내 IP / localhost 차단 정책은 [Spec API §SSRF 가이드]와 동일하게 적용한다"`고 명시하지만 구현 코드에 해당 가드가 **전혀 없다**.
- **제안**:
  ```typescript
  private requireHttpsUrl(raw: string): URL {
    const parsed = ...; // 기존 HTTPS 검사 유지
    
    // RFC 1918, loopback, link-local, metadata endpoint 차단
    const host = parsed.hostname;
    if (
      /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host) ||
      host === 'localhost' ||
      host === '169.254.169.254' ||
      host === 'metadata.google.internal'
    ) {
      throw new McpHttpsRequiredError(raw);
    }
    // DNS rebinding 방어: connect 직전 resolved IP를 추가 검증하는 레이어 권장
    return parsed;
  }
  ```
  DNS rebinding까지 방어하려면 connect 직전에 resolved IP를 재검증하는 별도 미들웨어가 필요하다.

---

### **[WARNING] `defaultHeaders` 헤더 인젝션 — 입력 검증 부재**

- **위치**: `mcp-client.service.ts:buildHeaders()` (L168), `service-registry.ts` — `default_headers` field definition
- **상세**: `credentials.default_headers`(사용자 입력)를 `headers` 객체에 직접 spread한다.
  ```typescript
  const headers: Record<string, string> = { ...(params.defaultHeaders ?? {}) };
  ```
  헤더 이름이나 값에 CRLF(`\r\n`) 시퀀스가 포함된 경우 HTTP response splitting 또는 request smuggling이 가능하다. 또한 `Host`, `Content-Length` 같은 시스템 예약 헤더를 사용자가 자유롭게 덮어쓸 수 있다. `service-registry.ts`의 `default_headers` 필드는 `required: false`만 선언하고 값 형식 검증이 없다.
- **제안**: 헤더 이름/값의 CRLF 제거, 허용 가능한 헤더 이름 패턴 제한, `Host`·`Content-Length`·`Transfer-Encoding` 등 예약 헤더 차단 로직 추가.

---

### **[WARNING] MCP 서버 응답 크기 제한 미구현**

- **위치**: `mcp-client.service.ts:SessionImpl` 전체, `mcp-test-connection.service.ts`
- **상세**: spec §8.1에 `>100KB text` 또는 `>1MB binary` 초과 시 truncate 처리를 명시하나, `callTool` / `readResource` / `getPrompt` 응답에 크기 검사가 없다. 악성 MCP 서버가 수백 MB 응답을 반환하면 Node.js 프로세스의 메모리가 고갈될 수 있다.
- **제안**: `execute` 결과를 반환하기 전에 JSON 직렬화 크기를 측정해 상한 초과 시 truncate하고 `MCP_RESPONSE_TOO_LARGE` 마커를 추가한다.

---

### **[WARNING] SDK 원시 에러 메시지를 API 응답에 그대로 노출**

- **위치**: `mcp-test-connection.service.ts:classifyConnectError()`, `integrations.service.ts:adaptMcpTestResult()`
- **상세**:
  ```typescript
  // mcp-test-connection.service.ts
  return { success: false, code: 'MCP_CONNECT_FAILED', message: err.message };

  // integrations.service.ts
  return { success: false, message: `[${code}] ${result.message}` };
  ```
  SDK 예외 메시지에는 내부 IP, 경로, 서비스 버전 등 인프라 정보가 포함될 수 있다. 특히 `MCP_CONNECT_FAILED`의 `err.message`는 fetch 실패 상세(`ECONNREFUSED 10.0.0.1:8080` 등)를 그대로 클라이언트로 전달한다.
- **제안**: `classifyConnectError`에서 에러 코드와 generic 사용자 메시지만 반환하고 상세 원인은 서버 로그로만 기록한다.

---

### **[WARNING] `McpConnectParams` 타입에서 `token`/`value`/`headerName` 이 optional**

- **위치**: `mcp-client.service.ts:McpConnectParams` 타입 정의 (L13–28)
- **상세**: `bearer_token` variant에서 `token?: string`, `api_key` variant에서 `headerName?: string`, `value?: string`이 optional로 선언되어 있다. TypeScript 타입 레벨에서는 누락이 허용되므로 `buildHeaders()`에서의 런타임 null-guard가 타입 계약과 일치하지 않는다. 이는 후속 구현자가 타입을 보고 `token`이 없어도 된다고 오해하는 방어적 코딩 오류를 유발한다.
- **제안**: `token: string` (required)으로 변경하거나, 타입 내 `never` 분기로 런타임 불가 케이스를 배제한다.

---

### **[WARNING] `uglify-js`가 `devDependencies`에서 `dependencies`로 이동**

- **위치**: `package-lock.json` — `node_modules/uglify-js`의 `"dev": true` 제거
- **상세**: `uglify-js`는 빌드 도구이므로 프로덕션 번들에 포함될 이유가 없다. MCP SDK의 전이 의존성으로 끌려온 것으로 보이나, 불필요한 프로덕션 attack surface를 늘린다(특히 `optional: true`임에도 프로덕션 표시).
- **제안**: `package.json`의 `overrides` 또는 `bundleDependencies` 설정으로 불필요 패키지를 제거하거나 `devDependencies`로 유지한다.

---

### **[INFO] `previewTest` 엔드포인트에 레이어별 rate limit 부재**

- **위치**: `mcp-test-connection.service.ts`, `integrations.service.ts:dispatchTest()`
- **상세**: MCP 연결 테스트는 외부 URL에 실시간 TCP 연결을 여는 고비용 작업이다. `McpTestConnectionService` 레이어에 호출 빈도 제한이 없으므로, 공격자가 다수의 MCP Integration 등록 시도 → 테스트를 통해 내부 네트워크 스캐닝에 악용할 수 있다(SSRF와 결합 시 심각도 상승). NestJS Throttler가 컨트롤러 레벨에서 적용되는지 확인이 필요하다.
- **제안**: Integration preview-test 엔드포인트에 per-user rate limit(예: 분당 10회) 적용.

---

### **[INFO] `cross-spawn` — stdio MCP 미지원임에도 전이 의존성으로 포함**

- **위치**: `package-lock.json` — `@modelcontextprotocol/sdk` 의존성 트리
- **상세**: `@modelcontextprotocol/sdk`가 `cross-spawn`을 의존하는 것은 stdio transport 지원 때문이다. 본 구현은 stdio를 명시적으로 미지원하나 패키지가 번들에 포함되어 있어 미래 코드에서 stdio MCP를 우발적으로 사용할 수 있는 여지가 생긴다.
- **제안**: 별도 조치는 불필요하나, CI에서 stdio 관련 심볼(`StdioClientTransport`, `spawn`) import를 금지하는 lint 규칙 추가 권장.

---

## 요약

이번 변경에서 가장 심각한 보안 취약점은 **SSRF 방어 부재**다. `McpClientService.requireHttpsUrl()`이 `https://` scheme만 강제하고 private IP / cloud metadata endpoint를 차단하지 않아, MCP Integration 등록 권한을 가진 workspace 멤버가 내부 네트워크를 프록시로 탐색할 수 있다. spec이 명시한 SSRF 가이드를 코드 레벨에서 실제로 이행해야 한다. 그 외에 `defaultHeaders` 헤더 인젝션, 원시 SDK 에러 메시지 노출, 응답 크기 제한 미구현이 보완이 필요한 경계선 방어 문제다. 인증/인가, 암호화, SQL 인젝션 등의 측면은 기존 NestJS 프레임워크와 encrypted credentials JSONB 패턴을 올바르게 계승하고 있어 별도 지적 사항 없다.

## 위험도

**HIGH** — SSRF Critical + 복수 WARNING 항목 미조치 시