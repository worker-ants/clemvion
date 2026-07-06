# 유지보수성(Maintainability) 리뷰

### 발견사항

- **[INFO]** `cafe24-mcp-tool-provider.ts` / `makeshop-mcp-tool-provider.ts` 의 `mcpErrorDelta` 구성 로직 중복
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:516-533,567-573`, `makeshop-mcp-tool-provider.ts:516-533,565-571`
  - 상세: 두 provider 모두 `status === 'error'` 분기에서 동일한 형태(`{ integrationId, phase: 'tools/call', code: this.codeForStatus(...), message: ... }`)의 `mcpErrorDelta` 객체를 생성하고, catch 블록에서도 동일한 패턴(`{ integrationId, phase: 'tools/call', code: errInfo.code, message: errInfo.message }`)을 반복한다. 이는 기존 `codeForStatus`/`classifyError` 중복 패턴을 그대로 답습한 것이라 새로 도입된 문제는 아니지만, 이번 변경으로 중복 표면이 한 겹 더 늘었다.
  - 제안: 두 provider 가 이미 구조적으로 거의 동일하므로(코드 스멜은 기존부터 존재), 공통 베이스 클래스나 `buildCallPhaseErrorDelta(integrationId, status, message)` 같은 공유 헬퍼로 추출하면 향후 세 번째 브릿지 provider 추가 시 세 번째 복사를 막을 수 있다. 이번 PR 범위를 벗어난다면 최소한 follow-up 이슈로 남기는 것을 권장.

- **[INFO]** `mcp-tool-provider.ts` `errorResult` 헬퍼의 위치 기반 파라미터 증가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:1096-1250` 부근 (`errorResult(toolCallId, code, message, extra?, errorDelta?)`)
  - 상세: `extra`, `errorDelta` 두 개의 옵셔널 위치 파라미터가 추가되어 호출부에서 `undefined` 를 명시적으로 채워 넣는 호출(`this.errorResult(call.id, code, msg, undefined, {...})`)이 등장한다. 파라미터가 4개를 넘어가고 순서 의존적인 optional 자리채움이 생기면 호출부 가독성이 떨어지고, 향후 다섯 번째 필드 추가 시 동일 패턴이 반복될 위험이 있다.
  - 제안: `errorResult(toolCallId, code, message, { extra, errorDelta }?)` 형태의 options 객체로 바꾸면 위치 의존성이 사라지고 호출부의 `undefined` 채움이 없어진다. 현재 diff 범위에서는 필수 수정 사항은 아님(기존 시그니처를 확장한 것이므로 일관성 유지 차원의 개선 제안).

- **[INFO]** `mcp-client.service.ts` 의 `timedOut` boolean 플래그와 클로저 의존
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.ts:269-297` (connect 메서드)
  - 상세: `let timedOut = false`를 setTimeout 콜백에서 set 하고, 이후 `catch` 블록에서 참조하는 방식은 의도(자체 데드라인 vs SDK/네트워크 abort 구분)를 정확히 구현하지만, 상태를 가변 클로저 변수로 흘리는 패턴이라 함수가 조금 더 커지면 추적이 어려워질 수 있다. 현재는 주석이 충실하고 범위가 좁아 문제되지 않는다.
  - 제안: 현재 규모에서는 그대로 유지해도 무방. 추가 타이머/플래그가 생기면 작은 상태 머신(enum) 또는 `AbortController` 서브클래스로 리팩터링 고려.

- **[INFO]** `mcp-error-codes.ts` `redactMcpSecrets` 의 다중 정규식 체인
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:456-480`
  - 상세: 4개의 순차 `.replace()` 체인으로 구성되어 있으나, 각 정규식 위 인라인 주석이 무엇을 매칭/치환하는지 명확히 설명하고 있어 가독성은 양호하다. 매직 넘버(`{8,}` 토큰 최소 길이)에 대한 근거는 주석에 없다.
  - 제안: `{8,}` 같은 임계값에 짧은 근거 주석(예: "8자 미만은 실제 토큰이 아닐 가능성이 높아 오탐 방지")을 추가하면 향후 유지보수자가 값 조정 시 판단 근거를 알 수 있다. 선택 사항.

- **[INFO]** `mcp-tool-provider.ts` `META_PHASE` 매핑 테이블 도입은 가독성 개선
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:43-56`
  - 상세: 메타도구 이름 → `McpErrorPhase` 매핑을 `if/else` 체인 대신 `Record` 테이블로 선언한 것은 이 코드베이스의 다른 lookup 테이블 패턴(`MCP_ERROR_CODES` 등)과 일관되고, 분기 복잡도를 낮추는 좋은 선택이다. 별도 조치 불필요.

- **[INFO]** 테스트 파일들의 서술적 한글 `it()` 설명과 spec 섹션 참조(`§8.1` 등) 병기
  - 위치: `mcp-error-codes.spec.ts`, `mcp-test-connection.service.spec.ts`, `ai-turn-executor.spec.ts`, `cafe24-mcp-tool-provider.spec.ts`, `makeshop-mcp-tool-provider.spec.ts`, `mcp-tool-provider.spec.ts` 전반
  - 상세: 테스트 명명이 "무엇을 검증하는지" + "spec 어느 절 근거인지"를 함께 담아 기존 코드베이스 컨벤션과 일관되며, 유지보수 시 spec 대조가 쉽다. 우수 사례로 특기할 만함.

### 요약
이번 변경은 MCP 커넥트 타임아웃 구분(`TimeoutError`), 에러 메시지 시크릿 리댁션(`redactMcpSecrets`), call-phase 진단 델타(`mcpErrorDelta`) 표면화라는 세 가지 관심사를 다루며, 각각 기존 코드베이스의 명명·문서화·테스트 관례(스펙 절 인용, 한글 서술 테스트명, JSDoc 근거 설명)를 충실히 따른다. 함수 길이와 중첩 깊이는 전반적으로 낮게 유지되고 있고, 매직 넘버는 대부분 명명된 상수(`MCP_REDACTED_PLACEHOLDER`, `GENERIC_TIMEOUT_MESSAGE`)로 감싸져 있다. 유일한 반복 개선 여지는 cafe24/makeshop 두 브릿지 provider 간 `mcpErrorDelta` 생성 로직 중복인데, 이는 이번 PR 이전부터 존재하던 provider 간 구조적 중복을 그대로 답습한 것이라 신규로 발생한 문제가 아니며, 즉각적인 리팩터링을 요구할 정도는 아니다. `errorResult` 헬퍼의 위치 파라미터 증가도 경미한 가독성 저하이나 차단 사유는 아니다.

### 위험도
LOW
