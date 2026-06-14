# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `pushConnectedSummary` 메서드에 JSDoc 부재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L1700–1711
- 상세: 신규 추가된 `private pushConnectedSummary` 메서드에 단일 라인 `§6.2` 참조 주석만 있고, 파라미터(`ctx`, `entry`)와 사이드이펙트(mcpDiagnostics 배열 mutate) 설명이 없다. 클래스 내 다른 private 메서드(`materializeServer`, `openServer`, `buildToolDefsForEntry`, `fireUsageLog`)는 모두 JSDoc을 갖추고 있어 일관성이 깨진다.
- 제안: `/** 기존 ServerEntry 의 통계를 mcpDiagnostics 배열에 'connected' summary 로 push. ctx.mcpDiagnostics 가 undefined 이면 no-op (pushMcpServerSummary 내 guard). toolCount 는 allowlist 필터 이전의 catalog 도구 수를 반영한다. */` 수준의 JSDoc 추가.

### [INFO] `openServer` JSDoc의 `throw` 계약 설명이 구 코드 기준
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L1713–1723
- 상세: `openServer` 의 JSDoc 반환 계약 섹션에 "throw — connect/list/status 실패 등 진단 정보가 의미 있는 실패. `Promise.allSettled` 가 잡아 `meta.mcpDiagnostics.errors[]` 에 누적"이라고 쓰여 있다. 그런데 이번 변경으로 throw 이전에 `pushMcpServerSummary`로 `skipped(skipReason=error)` summary를 push하는 동작이 추가되었다. 즉, throw 전에 진단 push를 수행한다는 사실이 JSDoc에 반영되어 있지 않다. `errors[]` 누적도 현재 구현과 다르다(현재는 `serverSummaries[]`에 push하며 `errors[]`는 미구현).
- 제안: 다음과 같이 수정:
  ```
  * - `throw` — status/connect/list 실패. throw 이전에 `skipped(skipReason='error')` serverSummary 를
  *   mcpDiagnostics 에 먼저 push 하여 진단 표면에 노출한 뒤 re-throw 한다 (§6.2).
  *   `Promise.allSettled` 가 잡아 buildTools 의 warn log 에 흡수된다.
  ```

### [INFO] 인라인 주석과 spec 현황 간 경미한 불일치 — `materializeServer` 내 §6.2 주석
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L1694–1696
- 상세: `// §6.2 — 외부 MCP connect+list 성공 시 connected summary push (Cafe24 Internal Bridge 와 대칭 — 그간 외부 MCP 는 성공·실패 모두 진단에 미노출이었다).` 주석에 "그간 미노출이었다"는 과거형 서술이 있다. 이는 히스토리 설명이고 코드 동작 이해에는 도움이 되지만, 미래 유지보수자가 주석을 읽을 때 "현재도 미노출인지 기구현된건지" 혼동을 줄 수 있다. 구현 완료 후 주석이라 과거형이 맞지만, 주석의 용도(히스토리 vs 동작 설명)를 명확히 구분하면 더 명료하다.
- 제안: 주석을 "Cafe24 Internal Bridge 와 대칭하여 connected summary push" 정도로 단순화하거나, 히스토리 맥락을 별도 라인으로 분리.

### [INFO] 테스트 케이스 명칭이 §6.2 spec 참조에 의존 — 독립 가독성 제한
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` L271, L289
- 상세: `it('§6.2 connect+list 성공 → connected serverSummary push (toolCount)')`, `it('§6.2 connect 실패 → skipped serverSummary push (skipReason=error)')` 두 케이스 이름이 spec 절 번호를 앞에 붙인다. 이는 spec과 테스트 간 추적성에 도움이 되지만, spec을 모르는 독자가 테스트 이름만으로 컨텍스트를 파악하기 어렵다. 동일 파일 내 다른 테스트 케이스는 `§` 참조 없이 동작을 직접 서술한다.
- 제안: 필수 변경 사항은 아니나, 일관성을 위해 `'connect+list 성공 시 mcpDiagnostics 에 connected serverSummary(toolCount) push'` 방식으로 통일하거나, 파일 내 §-prefix 사용 정책을 문서화. 기존 `serviceType="cafe24"` 케이스처럼 spec 참조가 주석에만 있고 이름은 행위 위주인 패턴이 더 일관적이다.

### [INFO] plan 파일의 진척 노트 포맷 — 목록 이탈 구조
- 위치: `plan/in-progress/spec-sync-mcp-client-gaps.md` L11–18 (구현 진척 블록)
- 상세: `> **구현 진척 (2026-06-14, impl-mcp-client-gaps PR)**:` blockquote가 `## 미구현 항목` 헤딩 직후, 체크박스 목록 앞에 위치한다. 내용 자체는 명확하지만, 이 plan 파일 내 다른 blockquote 사용 패턴(비고란 참조용)과 구조적으로 다르다. 동일 프로젝트의 다른 plan 파일들이 진척 갱신을 어떻게 표현하는지 일관성 검토가 필요할 수 있다.
- 제안: 프로젝트 내 plan 파일 작성 규약이 `.claude/docs/plan-lifecycle.md`에 있으므로, 진척 주석 위치·포맷이 규약과 일치하는지 확인 필요. 규약 범위 내라면 현재 형식 유지 가능.

### [INFO] spec 현황 주석에 `skipReason vocabulary` 서술 불일치 (§6.2 table vs 구현 현황 설명)
- 위치: `spec/5-system/11-mcp-client.md` §6.2 (L2618) 및 skipReason vocabulary 표 (L2628)
- 상세: §6.2 마지막 문장에 "외부 MCP 의 connect/initialize/tools-list 실패는 종전대로 `errors[]` 에 누적되므로 별도 skipReason 값을 도입하지 않는다"고 쓰여 있다. 그러나 이번 구현에서 외부 MCP 실패 시 `skipReason='error'`를 `serverSummaries[]`에 push한다. `errors[]`가 미구현 상태임을 감안하면 "errors[]에 누적"이라는 서술은 현재 구현과 다르다. skipReason vocabulary 표 (`error` 행, L2628)에는 `cafe24 / mcp` 양쪽에 적용됨이 올바르게 기재되어 있어 표 자체는 정확하나, 바로 위 단락의 설명이 혼동을 줄 수 있다.
- 제안: §6.2 마지막 단락의 해당 문장을 다음 방향으로 수정:
  ```
  외부 MCP 의 connect/initialize/tools-list 실패는 `serverSummaries[]` 의 `skipped(skipReason='error')` 로 표면화된다.
  `errors[]` 가 도입되면 코드 granularity(MCP_CONNECT_FAILED/MCP_LIST_FAILED)를 함께 추가할 예정.
  ```

## 요약

이번 변경은 `McpToolProvider`에 §6.2 진단 push를 추가하고 spec(`11-mcp-client.md`)과 plan 파일을 동기화한 작업으로, 전반적인 문서화 품질은 양호하다. 신규 추가된 `pushConnectedSummary` 메서드에 JSDoc이 빠진 점과 `openServer` JSDoc의 throw 계약 설명이 구현 변경 내용을 완전히 반영하지 못한 점이 소소한 누락이다. spec §6.2 단락 내 `errors[]` 누적 서술이 현재 구현(`serverSummaries[]` push)과 약간 불일치하여 독자에게 혼선을 줄 수 있으나, vocabulary 표는 정확하게 업데이트되어 있다. 전체적으로 README/API 문서 레벨의 갱신 누락이나 환경변수 문서화 결함은 없으며, 발견사항은 모두 INFO 등급으로 차단 이슈는 없다.

## 위험도

LOW
