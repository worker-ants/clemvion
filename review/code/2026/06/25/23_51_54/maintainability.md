# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[INFO]** `eslint.config.mjs` — 인용부호 스타일 일관성 혼입
  - 위치: `codebase/backend/eslint.config.mjs` diff 라인 64
  - 상세: 기존 코드의 `"prettier/prettier": ["error", ...]` 가 `'prettier/prettier': ['error', ...]` 로 변경됨. 기능적으로 동일하나, 이 변경은 리팩터 범위(console→Logger)와 무관한 코드 스타일 수정이 혼입된 것임. 실질적 문제는 아니나 변경 의도 추적 시 노이즈가 됨.
  - 제안: 이미 커밋된 상태이므로 지적만. 이후 PR 에서는 범위 외 diff 를 최소화할 것.

- **[INFO]** `telegram-message.renderer.ts` / `language-hint-defaults.ts` — 모듈 레벨 logger 컨텍스트 하드코딩
  - 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` line 547, `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` line 1799
  - 상세: `new Logger('ChatChannel.Telegram')`, `new Logger('ChatChannel.LanguageHint')` 는 파일 스코프에서 하드코딩 문자열로 생성됨. 클래스 기반 파일의 `ClassName.name` 과 달리 모듈 명칭 변경 시 자동 추적이 되지 않음. 그러나 두 파일이 순수 함수 모듈이라 클래스 없이 사용하는 것은 구조상 불가피하며, 맥락 문자열(`ChatChannel.*`)이 명확히 설명적임.
  - 제안: 현재 구조상 허용 범위 내. 향후 모듈을 클래스로 리팩터링할 경우 `ClassName.name` 패턴으로 전환 권장.

- **[INFO]** `node-handler.registry.ts` — 로그 메시지 prefix 제거로 일관성 향상
  - 위치: `codebase/backend/src/nodes/core/node-handler.registry.ts` line 517, 테스트 `node-handler.registry.spec.ts` line 2353
  - 상세: 변경 전 `console.warn('[NodeHandlerRegistry] (non-production) ...')` 의 `[NodeHandlerRegistry]` prefix 가 제거되어 `this.logger.warn('(non-production) ...')` 가 됨. NestJS Logger 가 클래스명을 자동 prefix 로 붙이므로 수동 prefix 제거는 올바름. 이에 맞춰 테스트 assertion 도 `'NodeHandlerRegistry'` → `'executionMetadata'` 로 정확히 갱신되어 일관성 확보됨.
  - 제안: 이 변경은 올바른 유지보수성 향상임.

- **[INFO]** `code.handler.ts` — 동일 면제 이유 inline disable 주석 반복
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` lines 2634, 2641, 2713 (전체 파일 기준)
  - 상세: 동일한 면제 이유(`pre-bootstrap env 설정 검증 (NestJS Logger 컨텍스트 이전 module-load 경로)`)가 세 곳에 inline disable 주석으로 반복됨. 기능상 문제는 없으나 동일 설명이 3회 중복 등장.
  - 제안: `/* eslint-disable no-console */` block-level disable 로 해당 함수/블록을 감싸면 주석을 3→1회로 줄일 수 있음. 단, inline disable 이 지점마다 의도를 명시하는 장점도 있어 현 방식 유지도 수용 가능. 심각한 문제 아님.

- **[INFO]** `mcp-test-connection.service.ts` — 수동 prefix 이중화
  - 위치: `codebase/backend/src/modules/mcp/mcp-test-connection.service.ts` logInternal 메서드
  - 상세: `this.logger.warn('[mcp:test] ${code}: ${detail}')` — NestJS Logger 가 클래스명(`McpTestConnectionService`)을 자동 prefix 로 붙이므로 출력이 `[McpTestConnectionService] [mcp:test] MCP_CONNECT_FAILED: ...` 형태가 됨. `[mcp:test]` 수동 prefix 는 맥락 보강 역할이 있으나, 프로젝트 내 다른 Logger 사용 파일과 비교해 prefix 관례가 통일되지 않을 수 있음.
  - 제안: 현재 패턴 유지 허용. 프로젝트 전체 Logger prefix 컨벤션 확립 시 `this.logger.warn(\`${code}: ${detail}\`)` 로 단순화 고려.

## 요약

이번 리팩터(m-1)는 서비스 코드의 `console.*` 를 NestJS Logger 로 일괄 전환하고 `no-console: error` ESLint 규칙을 추가해 재발을 방지하는 유지보수성 향상 작업이다. 변경 범위와 목적이 명확하고, 면제 대상(pre-bootstrap IIFE, CLI 스크립트, 테스트)의 근거가 주석과 ESLint override 로 적절히 문서화되어 있다. 클래스 기반 파일은 `private readonly logger = new Logger(ClassName.name)` 패턴을 사용하고, 순수 함수 모듈은 파일 스코프 `const logger = new Logger('Context')` 로 일관되게 적용되었다. 테스트 spy 도 `console.warn` → `Logger.prototype.warn` 으로 정확히 갱신되었다. 발견된 사항들은 모두 INFO 수준이며 기능 영향이 없다.

## 위험도

NONE
