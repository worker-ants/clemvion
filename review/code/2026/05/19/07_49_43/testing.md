# Testing Review

## 발견사항

- **[INFO]** `buildSystemContextPrefixFromContext` 에서 `workspace.name` 이 context 에 없어 `workspace` 섹션이 항상 id-only 로 생성됨 — 테스트에 이 경로가 없음
  - 위치: `system-context-prefix.ts` L276-281, `system-context-prefix.spec.ts` `buildSystemContextPrefixFromContext` describe
  - 상세: `buildSystemContextPrefixFromContext` 는 `workspace.name` 을 전달하지 않는다 (`__workspaceName` 변수 없음). `systemContextSections: ['workspace']` 로 활성화하면 `(unnamed)` 가 출력되지만 이를 직접 검증하는 통합 테스트 케이스가 없다. 단위 테스트 `buildSystemContextPrefix` 레벨에서만 `name` 있는 경우를 검증한다.
  - 제안: `buildSystemContextPrefixFromContext` describe 에 `sections: ['workspace']` 를 활성화한 케이스를 추가해 `(unnamed)` 또는 `ws-1` 만 노출되는 실제 동작을 명시적으로 검증.

- **[INFO]** `ai-agent.handler.spec.ts` 의 System Context Prefix 테스트가 `now: new Date()` 로 실시간 시각을 사용 — 시각 고정 없음
  - 위치: `ai-agent.handler.spec.ts` L205-253 (새 describe 블록)
  - 상세: 핸들러 내부에서 `new Date()` 를 직접 생성하므로, 테스트는 현재 실시간 시각으로 실행된다. `Current time:` 포함 여부나 ISO 포맷 정확성을 검사하지 않고 `## System Context\n` header 패턴과 `Timezone: Asia/Seoul (UTC+9)` 존재만 확인하므로 대부분의 regression 은 잡힌다. 그러나 정확한 시각 포맷 검증은 단위 테스트(`system-context-prefix.spec.ts`)에만 위임되어 있다.
  - 제안: `now` 를 DI 또는 factory 로 주입할 수 있도록 리팩토링하거나, 핸들러 spec 에서도 시각 관련 줄의 패턴(`Current time:` + ISO 형식)을 최소한 정규식으로 확인. 현재 구조 하에서는 `system-context-prefix.spec.ts` 의 `fixedNow` 기반 테스트가 충분한 대체이므로 낮은 우선순위.

- **[INFO]** `text-classifier.handler.spec.ts` 와 `information-extractor.handler.spec.ts` 의 `skips the prefix when includeSystemContext: false` 케이스에서 `systemMsg.content` 가 정확히 원래 systemPrompt 와 일치하는지 검증하지 않음
  - 위치: `text-classifier.handler.spec.ts` L741-755, `information-extractor.handler.spec.ts` L538-553
  - 상세: `not.toContain('## System Context')` 만 확인한다. 반면 `ai-agent.handler.spec.ts` L249-252 에서는 `toBe('You are helpful')` 로 엄격하게 확인한다. 두 핸들러 spec 은 prefix 가 없을 때 시스템 프롬프트가 원형 그대로 전달되는지 보장하지 않는다.
  - 제안: `information-extractor` / `text-classifier` 의 `skips` 케이스에서도 `systemMsg.content` 에 prefix 없이 예상 내용만 있는지 `toBe` 또는 `toEqual` 로 검증 추가.

- **[INFO]** `execution-engine.service.spec.ts` 의 `findOne` mock 이 `workspace.settings: {}` 로 timezone 없는 경우를 fixture 로 사용 — timezone 있는 경우 테스트가 없음
  - 위치: `execution-engine.service.spec.ts` L136-140 (새 `findOne` mock)
  - 상세: `findOne` mock 은 `settings: {}` (timezone 없음) 만 반환한다. 엔진이 `workspaceTimezone` 을 `''` 로 설정해 `buildSystemContextPrefixFromContext` 가 UTC fallback 을 타는 경로만 커버된다. timezone 이 실제로 `'Asia/Seoul'` 로 설정된 경우 엔진이 올바르게 `__workspaceTimezone` 에 전달하는지 확인하는 엔진 레벨 통합 테스트가 없다.
  - 제안: `execution-engine.service.spec.ts` (또는 e2e) 에 `workspace.settings.timezone: 'Asia/Seoul'` 을 반환하는 mock 케이스를 추가해 `context.variables.__workspaceTimezone === 'Asia/Seoul'` 임을 assertions 로 확인. 현재 해당 검증 경로는 `system-context-prefix.spec.ts` 단위 테스트에서만 간접 커버.

- **[WARNING]** `cafe24-mcp-tool-provider.spec.ts` 의 KST suffix 테스트가 실제 MCP 도구 목록에 의존하여 `tools.length > 0` 만 전제 — 도구가 0개일 때 false positive
  - 위치: `cafe24-mcp-tool-provider.spec.ts` L436-457 (새 KST suffix describe it)
  - 상세: `expect(tools.length).toBeGreaterThan(0)` 후 `for (const t of tools)` 반복에서 검증하는 구조는, mock 설정 오류나 `buildTools` 내부 변경으로 도구가 0개 반환될 때 `for` 루프가 실행되지 않아 assertions 없이 테스트가 통과된다. 즉 실제로 suffix 가 추가되지 않아도 `tools.length === 0` 이면 green 이 된다.
  - 제안: `expect(tools.length).toBeGreaterThan(0)` assertion 을 `expect(tools).toHaveLength(최소 예상 도구 수)` 로 구체화하거나, 특정 도구 이름(`mcp_xxx__get_products` 등)을 `find` 로 찾아 직접 `description` 을 검증.

- **[INFO]** `metadata.spec.ts` 의 date/time 필드 description 검증 테스트가 `until` 필드의 description 부재를 허용
  - 위치: `metadata.spec.ts` L930 (`if (!desc) continue`)
  - 상세: `spec.description` 이 없으면 검사를 건너뛴다. `product.ts` 변경 전 `until` 필드는 `description` 이 없었는데, 이 경우 도구 레벨 suffix(`CAFE24_TIMEZONE_SUFFIX`)가 보완한다고 코멘트에 명시되어 있다. 정책이 올바르지만 "description 없음 → suffix 만으로 충분"하다는 전제를 검증하는 테스트는 없다.
  - 제안: description 없는 date/time 필드에 대해 `CAFE24_TIMEZONE_SUFFIX` 가 붙는지를 `cafe24-mcp-tool-provider.spec.ts` 의 기존 suffix 테스트가 암묵적으로 커버하고 있으므로 현재로서는 허용 가능. 명시적으로 커버하고 싶다면 `metadata.spec.ts` 에 별도 "description 없는 date field 도 suffix 로 보완된다" comment 추가 권장.

- **[INFO]** `ai-agent.thread.spec.ts` 에서 `includeSystemContext: false` 를 추가한 세 케이스가 테스트 의도를 주석으로만 설명 — 이 설정이 thread injection 결과에 영향을 주지 않음을 assert 하는 코드는 없음
  - 위치: `ai-agent.thread.spec.ts` L394-416
  - 상세: `includeSystemContext: false` 로 설정하고 thread injection 관련 assertions 만 실행한다. prefix 활성/비활성에 따라 system message 길이가 달라지므로, 향후 thread injection 이 system message 길이에 의존하는 로직이 추가된다면 테스트가 오탐할 수 있다.
  - 제안: 현재 구조상 문제없음. 코멘트가 충분히 의도를 표현하고 있으므로 현 상태 유지 가능.

- **[INFO]** `information-extractor.handler.spec.ts` 의 multi-turn System Context Prefix 경로 테스트 부재
  - 위치: `information-extractor.handler.spec.ts` (전체 diff)
  - 상세: `single_turn` 의 prefix prepend / skip 케이스는 추가되었으나, `multi_turn` 경로에서 `buildMultiTurnSystemPrompt` 결과에도 prefix 가 prepend 되는지 확인하는 테스트가 없다 (핸들러 코드 L613-623에 동일 로직 추가됨).
  - 제안: `information-extractor.handler.spec.ts` 에 `mode: 'multi_turn'` 으로 실행했을 때 system message에 `## System Context` prefix 가 붙는지 확인하는 케이스 추가. `ai-agent.handler.spec.ts` 의 single_turn / multi_turn 분리 패턴 참고.

## 요약

이번 변경은 3개 AI 핸들러(AI Agent, Text Classifier, Information Extractor)에 System Context Prefix 기능을 추가하고, Cafe24 MCP 도구 description 에 KST timezone suffix 를 자동 append 하는 것이 핵심이다. 테스트 관점에서 `system-context-prefix.spec.ts` 는 핵심 유틸리티(포맷 함수, fallback 체인, normalize, `buildSystemContextPrefixFromContext`) 를 `fixedNow` 기반으로 철저히 검증하며, 각 핸들러 spec 에도 default 활성/비활성 두 케이스가 균일하게 추가되어 기본 커버리지는 양호하다. 다만 몇 가지 커버리지 갭이 존재한다: (1) `cafe24-mcp-tool-provider.spec.ts` 의 KST suffix 테스트가 도구 0개 반환 시 false positive 가 될 수 있는 구조적 취약점이 있고, (2) `information-extractor` 의 multi_turn 경로가 prefix 테스트 없이 남아 있으며, (3) `execution-engine.service.spec.ts` 에서 workspace timezone 이 실제로 채워지는 경로를 엔진 레벨에서 검증하지 않는다. 핸들러 내부에서 `new Date()` 를 직접 생성해 시각 고정이 불가능한 구조는 통합 테스트 측면에서 약점이지만 단위 테스트 계층에서 충분히 보완되고 있다. 전체적으로 이번 테스트 추가는 spec §11 의 의도를 잘 표현하고 있으며, 경고 수준의 이슈는 1건으로 낮다.

## 위험도

LOW
