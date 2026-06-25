# Testing Review — refactor(backend): m-1 console.* → NestJS Logger

## 발견사항

### [WARNING] telegram-message.renderer.ts: logger.warn('photo') 경로 테스트 누락
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` 라인 957–961, `renderButtons()` 내 `if (visualNode === 'photo')` 분기
- 상세: `visualNode='photo'` 시 `logger.warn(...)` 을 호출하는 경로가 변경되었으나 `telegram-message.renderer.spec.ts` 에서 해당 경로를 테스트하는 케이스가 없다. `text_only` 케이스는 있으나 `photo` 케이스 자체(버튼만 반환 + warn 로그 발생 확인)는 없어 Logger.warn 호출 여부를 검증하지 못한다.
- 제안: `visualNode='photo'` 케이스를 테스트하는 케이스를 추가하고, `jest.spyOn(Logger.prototype, 'warn').mockImplementation(...)` 으로 warn 이 1회 호출됨을 검증한다. 기존 `text_only` 케이스와 유사한 구조로 작성 가능.

### [WARNING] mcp-test-connection.service.spec.ts: logInternal → Logger.warn 호출 검증 부재
- 위치: `codebase/backend/src/modules/mcp/mcp-test-connection.service.spec.ts`
- 상세: `MCP_CONNECT_FAILED` 및 `MCP_LIST_FAILED` 경로는 내부적으로 `this.logInternal()` → `this.logger.warn()` 을 호출한다. 기존 스펙은 응답 `code`/`message` 만 검증하고 Logger.warn 호출 자체를 검증하지 않는다. `console.warn` → `Logger` 전환 후에도 이 동작은 테스트되지 않아 실수로 logInternal 호출이 제거되어도 테스트가 통과한다.
- 제안: `MCP_CONNECT_FAILED` / `MCP_LIST_FAILED` 케이스에서 `jest.spyOn(Logger.prototype, 'warn')` 으로 spy 를 설정하고, 호출 인수가 `[mcp:test] MCP_CONNECT_FAILED:` 를 포함하는지 검증하는 assertion 을 추가한다.

### [INFO] node-handler.registry.spec.ts: Logger.prototype.warn spy — 스펙 변경 정합성 유지됨
- 위치: `codebase/backend/src/nodes/core/node-handler.registry.spec.ts` 라인 2346–2357
- 상세: `console.warn` spy → `Logger.prototype.warn` spy 전환과 함께 assert 문자열도 `'NodeHandlerRegistry'` → `'executionMetadata'` 로 변경되었다. 새 구현에서 warn 메시지는 `'(non-production) NodeHandlerRegistry.assertConsistency: ... executionMetadata ...'` 형태이므로 `'executionMetadata'` 는 포함되지만 `'NodeHandlerRegistry'` 도 여전히 포함된다. 전환 자체는 정확하나, 이전 assert(`'NodeHandlerRegistry'`)도 여전히 통과했을 것이므로 assert 변경이 필수는 아니었다. 기능상 무해하며 가독성은 동등.
- 제안: 현행 유지 허용. 단, 메시지 전체를 `stringContaining('assertConsistency')` 으로 고정하는 것이 리팩터링 내성에 더 강하다.

### [INFO] language-hint-defaults.spec.ts: Logger.prototype.warn spy — warnSpy.mock.calls 접근 패턴
- 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts` 라인 1679–1681
- 상세: `warnSpy.mock.calls[0]?.[0]` 접근 후 `typeof call === 'string' ? call : JSON.stringify(call)` 으로 직렬화한다. NestJS Logger.warn 의 첫 번째 인자는 문자열(JSON.stringify 결과)이므로 `call === 'string'` 분기가 항상 동작한다. 구현체가 인자를 객체로 변경하면 `JSON.stringify(call)` 경로가 활성화되어 테스트가 예기치 않게 통과할 수 있다. 현재는 안전하나 방어성이 낮다.
- 제안: `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('chat_channel_deprecated_execution_failed_hint'))` 단일 assertion 으로 단순화하면 방어성과 가독성이 모두 향상된다.

### [INFO] code.handler.ts: eslint-disable inline 면제 — console.warn 경로 테스트는 기존 유지
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` 라인 2634, 2642, 2713
- 상세: 모듈 로드 시점의 `resolveMemoryLimitMb()` 콘솔 경고는 이미 `code.handler.spec.ts` 에서 `console.warn` spy 로 검증하고 있다(커밋 메시지에 언급). 면제 이유(pre-bootstrap module-load)가 명확하고, 테스트 커버리지도 유지된다. 이번 변경에서 이 경로를 건드리지 않았으므로 회귀 없음.
- 제안: 현행 유지. 단, 향후 `resolveMemoryLimitMb` 테스트가 `console.warn` spy 를 사용하는 점을 코드 주석에 명시하면 혼동을 방지할 수 있다.

### [INFO] main.ts: bootstrap 로그 변환 — 테스트 불가 구조 (정상)
- 위치: `codebase/backend/src/main.ts` 라인 448–450
- 상세: `bootstrap()` 은 애플리케이션 진입점으로 단위 테스트 대상이 아니다. `console.log` → `logger.log` 전환은 기능 변경이 아니라 출력 채널 교체이며, 기존에도 이 경로의 단위 테스트는 없었다. 회귀 위험 없음.
- 제안: 현행 유지.

## 요약

이번 리팩터링은 전반적으로 테스트 갱신이 잘 수행되었다. `language-hint-defaults.spec.ts` 와 `node-handler.registry.spec.ts` 의 spy 교체는 올바르게 동작하며 회귀 없이 통과한다. 주요 커버리지 갭은 두 곳이다: (1) `telegram-message.renderer.ts` 의 `visualNode='photo'` → `logger.warn` 경로가 테스트되지 않아 해당 로그가 실제로 발행되는지 검증되지 않고, (2) `mcp-test-connection.service.spec.ts` 에서 `logInternal()` 호출 자체가 검증되지 않아 Logger.warn 에 대한 행동 계약이 느슨하다. 두 갭 모두 WARNING 수준이며 로직 정확성보다 로깅 계약 누락에 해당한다. `code.handler.ts` 의 inline `eslint-disable` 면제는 이유가 명확하고 기존 테스트 커버리지가 유지된다.

## 위험도

LOW
