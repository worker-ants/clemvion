# 보안(Security) 리뷰

## 발견사항

- **[WARNING]** Cafe24/Makeshop provider 의 `mcpErrorDelta.message` 가 redaction 없이 `meta.mcpDiagnostics.errors[]` (사용자 노출 sink)로 전파됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:539` (`classifyError`), `:567-576` (catch 블록의 `mcpErrorDelta: { ..., message: errInfo.message }`); `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` 동일 패턴; 근본 원인은 `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1538-1541` (`extractErrorMessage` → `err.message`/`String(err)` 그대로 반환, sanitize 없음)
  - 상세: 이번 diff 의 핵심 보안 개선은 `mcp-error-codes.ts` 의 `sanitizeMcpErrorMessage`/`redactMcpSecrets` 신설(코드에서 다루는 `MCP_ERROR_CODES` 경로용)이다. 그러나 Cafe24/Makeshop 두 provider 의 `execute()` catch 블록은 `this.classifyError(err)` 가 반환한 **가공되지 않은** `errInfo.message` 를 그대로 `mcpErrorDelta.message` 에 담아 반환한다(신규 필드). 이 값은 `ai-turn-executor.ts` choke point 를 거쳐 `meta.mcpDiagnostics.errors[]` 에 누적되고, 이는 spec 리뷰(`review/code/.../api_contract.md`)가 스스로 "user-facing node meta"라고 명시한 필드다. `classifyError` 의 fallback 분기(`CAFE24_CALL_FAILED`)와 `Cafe24TransportFailedError`(네트워크/fetch 실패, `extractErrorMessage(cause)` 경유)는 원본 JS 에러 메시지를 가공 없이 캐리하며, 이는 내부 호스트/IP, 커넥션 정보, 혹은 (fetch 구현/프록시 계층에 따라) 요청 URL 일부를 포함할 수 있다 — 실제로 이번 PR 의 `mcp-client.service.spec.ts` 테스트가 `ECONNREFUSED 10.0.0.5` 같은 내부 IP 를 담은 원본 에러 메시지를 그대로 전파하는 것을 검증 케이스로 채택하고 있어(파일 1, connect 경로), 유사한 raw 메시지가 call-phase 에도 존재할 개연성을 보여준다. `Cafe24AuthFailedError` 의 `summarizeCafe24ErrorBody` 는 "Cafe24 응답에 토큰이 없다"는 가정 하에 안전하다고 문서화돼 있으나, 이는 Cafe24 API 자체의 계약에 의존하는 것이지 이 코드가 스스로 보증하는 것이 아니다. 요컨대 이번 변경으로 **동일한 raw 메시지가 기존 `error` 필드(LLM tool_result, 이미 노출됨)에 더해 새로운 sink(`mcpDiagnostics.errors[]`, 노드 meta에 영속/렌더)로 한 곳 더 복제**되었는데, 그 신규 sink 에는 `sanitizeMcpErrorMessage`/`redactMcpSecrets` 가 적용되지 않는다. 이번 PR 자체가 "redaction 강화"를 명시적 목적(task_fa96e218)으로 내걸고 `McpToolProvider`(외부 MCP 경로)에는 정확히 이 함수를 적용해 두었으면서, Internal Bridge(Cafe24/Makeshop) 경로만 빠져 있어 defense-in-depth 정책이 provider 간 비일관적으로 적용된 상태다.
  - 제안: `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` 의 `mcpErrorDelta.message`(및 가능하면 `error`/`errInfo.message` 자체)에도 `sanitizeMcpErrorMessage` (혹은 공용 `SECRET_LEAK_PATTERNS`)를 통과시켜 두 provider 군의 redaction 정책을 통일. 최소한 `mcpErrorDelta.message` 만이라도 sink 진입 직전에 redact 적용 권장.

- **[INFO]** `redactMcpSecrets` 의 URL-userinfo 정규식이 스킴 표기에 따라 우회 가능한 좁은 커버리지
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:47-49` (`MCP_EXTRA_SECRET_PATTERNS`)
  - 상세: `[/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1***@']` 는 `scheme://user:pass@host` 형태만 매칭한다. 에러 메시지가 스킴 없이 `user:pass@host/path` 만 echo 하거나, 스킴과 host 사이에 개행/제어문자가 아닌 다른 구분자가 낀 변형(`\b` 앞이 알파벳 시작을 요구하므로 스킴이 숫자로 시작하는 등 비표준 케이스는 미매칭)에서는 마스킹되지 않을 수 있다. 다만 `sanitizeMcpErrorMessage` 가 이 함수 이전에 개행/탭을 이미 공백으로 정규화하므로 개행 우회는 방지된다. 정규식 기반 redaction 의 본질적 한계(false negative)이며 CRITICAL 수준은 아니다.
  - 제안: 이미 `mcp-error-codes.spec.ts`(파일 3)에 여러 케이스가 커버되어 있음. 운영에서 미탐 사례가 관측되면 패턴을 점증적으로 보강.

- **[INFO]** `sanitizeMcpErrorMessage` 의 non-Error 입력 JSON 직렬화 결과는 redaction 적용 대상이지만, 필드명 자체(`password`, `client_secret` 등 key)만 있고 값이 별도 문자열/중첩 객체인 경우 정규식이 놓칠 가능성
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:84-105`
  - 상세: `raw` 가 `{ a: 1 }` 같은 임의 객체일 때 `JSON.stringify` 이후 `redactMcpSecrets` 를 적용하므로 `"password":"..."` 형태의 문자열 매칭 패턴(`SECRET_LEAK_PATTERNS`)은 대체로 커버되지만, 값이 숫자/중첩 객체인 극단적 케이스는 패턴 매칭에서 벗어날 수 있다. 테스트(`mcp-error-codes.spec.ts:256-259`)는 단순 케이스만 검증. 실무 영향은 낮음(에러 객체가 시크릿을 숫자/중첩으로 감싸는 경우는 드묾).
  - 제안: 조치 불요. 참고용.

- **[INFO]** `AbortController` 기반 connect 타임아웃(`mcp-client.service.ts`)이 SSRF/장기 연결 억제에 기여 — 긍정적 보안 속성 확인
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.ts:145-171`
  - 상세: 이번 변경은 타임아웃 발생 여부(`timedOut` 플래그)를 구분해 `TimeoutError` 로 분류하는 로직만 추가했고, 기존 HTTPS 강제(`McpHttpsRequiredError`, 별도 파일에서 확인 가능)나 abort 메커니즘 자체는 변경하지 않았다. 이 자체가 취약점은 아니며, 타임아웃 분류 세분화가 SSRF/자원 고갈 방어 수준에 영향을 주지 않음을 확인.
  - 제안: 해당 없음(확인용).

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화 알고리즘 사용, 신규 의존성 추가는 이번 diff 범위에서 발견되지 않았다. 변경은 기존 `@modelcontextprotocol/sdk` 임포트만 재사용하며 신규 패키지 추가 없음.

## 요약

이번 변경 세트의 핵심 의도 중 하나가 "에러 메시지에서 시크릿/자격증명을 redact 해 사용자 노출 sink 로 유출되지 않게 한다"(task_fa96e218)임에도, 실제 구현은 외부 MCP 서버 경로(`McpToolProvider`, `mcp-error-codes.ts`)에만 `sanitizeMcpErrorMessage`/`redactMcpSecrets` 를 적용했고, 신규로 추가된 `mcpErrorDelta` 필드가 Cafe24/Makeshop Internal Bridge provider 를 거쳐 동일한 사용자 노출 sink(`meta.mcpDiagnostics.errors[]`)에 도달하는 경로에는 동일한 redaction 이 적용되지 않았다. Cafe24 측 주석은 "Cafe24 에러 바디에 토큰이 없다"는 업스트림 계약을 근거로 안전하다고 주장하지만, 이는 이 코드 자체가 보증하지 않는 외부 의존적 가정이며, 네트워크/전송 실패 시(`Cafe24TransportFailedError`) 원본 JS 에러 메시지(내부 IP/커넥션 정보 등)가 그대로 노출될 개연성이 남아 있다. 그 외 인젝션·하드코딩 시크릿·인증 우회·암호화 문제는 발견되지 않았고, connect 타임아웃 분류·redaction 유틸 자체의 코드 품질(순서: redact 후 clamp)은 안전하게 설계되어 있다. 종합적으로 신규 CRITICAL 은 없으나, redaction 정책의 provider 간 불일치는 이번 PR 이 스스로 내건 보안 목표(defense-in-depth)를 부분적으로만 달성한 상태이므로 WARNING 으로 분류한다.

## 위험도

MEDIUM
