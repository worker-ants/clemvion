# 보안(Security) 리뷰

## 발견사항

- **[INFO]** MCP 진단 `errors[].message` 가 원본 에러 메시지를 그대로(제어문자 제거 + 2048자 clamp만) `meta.mcpDiagnostics` 로 emit 되어 프런트엔드/실행 로그 UI 에 표면화됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `openServer()` catch 블록 (`pushMcpDiagnosticError(ctx.mcpDiagnosticErrors, { ..., message: sanitizeMcpErrorMessage(err) })`), `codebase/backend/src/modules/mcp/mcp-error-codes.ts` `sanitizeMcpErrorMessage`
  - 상세: 이번 diff 의 핵심 변경은 기존에 로거(`logger.warn`)와 DB(`Integration.last_error`)로만 향하던 원시 에러 메시지를, 새 `mcpDiagnostics.errors[]` 경로를 통해 실행 결과 meta(사용자가 보는 화면)로도 노출 범위를 넓힌 것이다. `sanitizeMcpErrorMessage` 는 개행/탭 제거와 길이 clamp 만 수행하며 시크릿 마스킹은 하지 않는다. connect 실패 메시지에 외부 MCP 서버가 URL, 인증 헤더 이름, 내부 호스트명, 스택 일부 등을 포함해 응답할 경우(특히 SDK/네트워크 계층의 raw 에러) 사용자에게 그대로 노출될 수 있다. 다만 `credentials.token`/`value` 자체가 로그·에러 메시지에 직접 포함되는 코드 경로는 없어(연결 파라미터 구성과 에러 throw 지점이 분리) 즉각적인 자격증명 유출 사례는 발견되지 않았다.
  - 제안: `sanitizeMcpErrorMessage` 를 diff 범위 밖이라도 후속 검토 대상으로 등록하고, MCP 서버가 반환하는 자유 형식 메시지에 대해 URL/토큰 패턴 redaction 을 추가하는 것을 고려. 최소한 이 필드가 최종 사용자(워크스페이스 멤버)에게까지 노출되는지, 아니면 워크스페이스 관리자 전용인지 노출 범위(권한 경계)를 spec 에 명시했는지 확인 필요.

- **[INFO]** `TimeoutError` 도입은 순수 리팩터(에러 분류 개선)이며 신규 보안 이슈 없음
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`
  - 상세: 메시지 포맷(`${label} timed out after ${ms}ms`)이 기존과 동일하게 유지되고, `label` 값이 `connect ${integration.name}` 형태로 호출되므로 integration 이름이 타임아웃 에러 메시지에 포함된다. `integration.name` 은 사용자가 자신의 워크스페이스에서 설정한 값이라 워크스페이스 경계를 넘는 정보 노출은 아니다.
  - 제안: 없음(정보성).

- **[INFO]** MCP 진단 카운터(`toolCalls`/`resourceReads`/`promptGets`)는 순수 집계 로직으로 인젝션·인가 관련 위험 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts`, `ai-turn-executor.ts` (`classifyMcpCall`, `finalizeMcpDiagnostics`)
  - 상세: `classifyMcpCall` 은 LLM 이 호출한 tool name 문자열을 파싱해 분류만 하며 실행 경로에 영향 없음(집계용 read-only 분류). 인젝션 벡터 아님.
  - 제안: 없음.

- **[INFO]** 인증/authType 검증 로직(`toConnectParams`)은 diff 범위 밖(기존 코드)이나 검토 중 확인한 바 화이트리스트 방식(`SUPPORTED_AUTH_TYPES`)으로 안전하게 구현되어 있음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `toConnectParams`
  - 상세: 이번 PR 에서 수정되지 않았으나, `openServer` 의 에러 처리 흐름과 연관되어 확인함. 알 수 없는 `authType` 은 명시적으로 throw 되어 인증 우회(예: `none` 으로의 silent fallback) 가능성 없음. 문제 없음.

- **[INFO]** 테스트 코드(spec 파일들)에 하드코딩된 credential-like 값 발견되었으나 모두 테스트 fixture 이며 실제 시크릿 아님
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` (`credentials: { url: 'https://mcp.example.com', token: 'tok' }`)
  - 상세: 테스트 전용 mock 값. 실제 배포 환경에 영향 없음.
  - 제안: 없음.

## 요약

이번 diff 는 MCP 진단 정보(`meta.mcpDiagnostics`)를 단일 `serverSummaries[]` 배열에서 `attempted`/`serverCount`/호출 카운터/`errors[]` 를 포함한 구조화 객체로 확장하고, `TimeoutError` 전용 클래스를 도입해 타임아웃과 다른 실패를 명확히 구분하는 리팩터/기능 확장이다. 인젝션, 인증 우회, 하드코딩 시크릿 등 직접적인 취약점은 발견되지 않았다. 유일하게 주목할 점은 새로 추가된 `mcpDiagnostics.errors[].message` 필드가 기존에는 서버 로그와 DB 에만 갔던 원시 에러 문자열의 노출 범위를 사용자 대면 meta 로 넓혔다는 것인데, 현재 sanitize 로직은 제어문자 제거와 길이 제한만 수행하고 시크릿/URL redaction 은 하지 않는다. 이 필드가 실제로 credential 유출로 이어지는 코드 경로는 확인되지 않았지만(파라미터 구성과 에러 throw 가 분리되어 있음), 외부 MCP 서버가 응답하는 자유 형식 에러 문자열을 신뢰 경계 없이 그대로 최종 사용자에게 전달한다는 점에서 정보 노출 관점의 잠재적 리스크로 기록해 둔다.

## 위험도

LOW
