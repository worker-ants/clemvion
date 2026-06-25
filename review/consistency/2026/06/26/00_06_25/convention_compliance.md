# 정식 규약 준수 검토 — refactor 03 m-1 (console.* → NestJS Logger)

검토 모드: --impl-done (구현 완료 후)
diff-base: origin/main

---

## 발견사항

### [WARNING] 모듈-레벨 Logger 인스턴스 컨텍스트 이름이 기존 codebase 패턴과 불일치
- **target 위치**: `telegram-message.renderer.ts:18` — `new Logger('ChatChannel.Telegram')`, `language-hint-defaults.ts:4` — `new Logger('ChatChannel.LanguageHint')`
- **위반 규약**: 정식 `spec/conventions/` 에 Logger 컨텍스트 이름 형식 규약이 명시된 문서는 없다. 단 codebase 전체 기존 모듈-레벨(non-class) Logger 인스턴스들이 PascalCase 단일어·합성어를 사용한다 (`'ChatChannelFailureClassifier'`, `'DatabaseQueryHandler'`, `'AiMemoryManager'`, `'RenderToolProvider'`, `'TableHandler'`, `'IntegrationHandlerBase'`, `'AiAgentHandler'`, `'McpToolProvider'`). dot-notation(`'ChatChannel.Telegram'`) 패턴은 `'HTTP'` 정도 외에 없어 이질적이다.
- **상세**: 규약 문서 미정의 영역이므로 CRITICAL 위반이 아니나, 미래 일관성 검토에서 반복 지적될 수 있는 패턴이다. `spec/conventions/` 에 Logger 이름 형식 규약이 없는 상태에서 dot-notation 을 사용한 근거가 코드 주석·plan 어디에도 명시되지 않았다.
- **제안**: (a) 컨텍스트 이름을 `'ChatChannelTelegram'` / `'ChatChannelLanguageHint'` 로 변경해 기존 codebase 패턴에 맞추거나, (b) `spec/conventions/` 에 Logger 컨텍스트 이름 형식(class provider: `ClassName.name`, module-level: PascalCase 합성 식별자)을 규정하는 logging conventions 문서를 신설하고 dot-notation 을 명시 허용하거나 금지. (b) 는 m-1 범위 외이므로 planner 위임이 적합.

---

### [INFO] `NodeHandlerRegistry` warn 메시지 prefix 제거로 인한 테스트 검증 문자열 변경
- **target 위치**: `node-handler.registry.spec.ts:271-273` — 이전 `expect.stringContaining('NodeHandlerRegistry')` → 이후 `expect.stringContaining('executionMetadata')`
- **위반 규약**: 정식 conventions 에 warn 메시지 내용 규칙 없음.
- **상세**: 이전 `console.warn('[NodeHandlerRegistry] (non-production) ...')` 에서 클래스명 prefix 가 메시지 body 에 있었으나, NestJS Logger 전환 후 클래스명은 Logger 의 context 인자로 자동 출력되어 메시지 body 에서 제거된 것이 올바른 처리다. 테스트 변경도 이를 정확히 반영한다. 규약상 문제 없음.
- **제안**: 현 상태 유지.

---

### [INFO] eslint.config.mjs 주석 형식이 기존 주석 패턴과 경미한 이질감
- **target 위치**: `codebase/backend/eslint.config.mjs:41-43`
- **위반 규약**: 정식 conventions 에 eslint 주석 형식 규칙 없음.
- **상세**: 기존 주석이 `// (ai-review INFO#5; ...)` 형태인 반면 이번 추가 주석은 `// 03 m-1 —` 워크플로우 ID prefix 를 사용. 내용과 근거는 명확하며 기능상 문제 없음. 미래 eslint 주석 형식 통일 시 함께 정리 대상.
- **제안**: 현 상태 유지. 필요 시 향후 eslint 주석 형식 conventions 정의 시 통일.

---

### [INFO] `spec/conventions/` 에 NestJS Logger 사용 규약 문서 부재
- **target 위치**: `spec/conventions/` 전체 (신설 필요 여부)
- **위반 규약**: `spec/5-system/3-error-handling.md §6.2` 는 로그 JSON 형식만 정의. NestJS Logger 선택 의무·인스턴스화 패턴·컨텍스트 이름 형식 규약이 `spec/conventions/` 에 없다.
- **상세**: 이번 변경으로 eslint `no-console: error` 가 backend src 에 강제 적용돼 NestJS Logger 사용이 사실상 lint 수준 의무화됐으나 규약 문서 대응이 없다. 차후 신규 파일 작성 시 Logger 인스턴스화 방법(class member vs module-level), 컨텍스트 이름 형식에 대한 질문이 반복될 수 있다.
- **제안**: `spec/conventions/logging.md` 또는 기존 `spec/5-system/3-error-handling.md §6` 확장으로 NestJS Logger 컨텍스트 이름 형식·인스턴스화 패턴·면제 범위(scripts/·instrumentation.ts·테스트)를 정의. 현 m-1 범위 밖이므로 planner 위임.

---

## 요약

정식 규약 준수 관점에서 이번 refactor 03 m-1 구현(console.* → NestJS Logger 전환 + eslint no-console 가드)은 `spec/conventions/` 에 명시된 어떤 규약도 직접 위반하지 않는다. `spec/5-system/3-error-handling.md §6.2` 로그 정책 및 `spec/conventions/chat-channel-adapter.md:84` "swallow (logger.warn)" 규약과 정렬됐으며, `spec/conventions/error-codes.md`·`audit-actions.md`·`swagger.md` 등 관련 conventions 에 저촉하지 않는다. WARNING 1건은 모듈-레벨 Logger 컨텍스트 이름의 dot-notation(`'ChatChannel.Telegram'`, `'ChatChannel.LanguageHint'`)이 기존 codebase 전체 패턴(PascalCase 합성어)과 이질적이라는 것으로, `spec/conventions/` 에 Logger 이름 규약이 부재하므로 이름 통일 또는 conventions 갱신 중 하나의 후속 조치가 권장된다. INFO 2건은 사소한 형식 일관성 제안이다.

## 위험도

LOW
