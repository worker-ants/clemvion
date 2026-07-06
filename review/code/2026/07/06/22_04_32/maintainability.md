# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[INFO]** `openServer()` 함수가 3중 중첩 try/catch + 여러 책임(precheck/connect/list/에러 재분류/summary·error push)을 한 함수에 담고 있어 길이·복잡도가 높음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `openServer()` (약 L631-778, 148줄)
  - 상세: outer try (status precheck) → inner try (connect) → inner try (tools/list) → outer catch (summary+error push) 구조로 3단 중첩이다. 이번 변경은 기존 2단 중첩에 `McpBuildPhaseError` 재포장 로직을 위한 중첩 catch 를 추가로 얹었다. 각 단계(precheck/connect/list)의 "실패 시 phase+code 결정" 로직이 문자 그대로 유사한 3-way 분기(`err instanceof TimeoutError ? TIMEOUT : ...`)로 반복돼 있어, phase 가 하나 더 늘어나면(§8.1 vocabulary 의 `initialize`, call-phase 등) 동일 패턴이 또 복제될 가능성이 높다.
  - 제안: `err` 를 phase 별 code 로 매핑하는 헬퍼(예: `classifyBuildPhaseError(err, phase, fallbackCode)`)를 추출해 connect/list 두 catch 블록의 중복 3항 연산을 통일하면, 향후 `initialize` phase 분리나 call-phase 확장 시 한 곳만 수정하면 된다. 다만 이번 PR 범위(§6.2 build-phase 3종)에서는 중복이 2회뿐이라 즉시 리팩터링을 강제할 정도는 아님 — LOW 심각도.

- **[INFO]** `McpBuildPhaseError` 와 `McpDiagnosticError`/`McpErrorPhase` 사이의 관계가 파일을 넘나들어(mcp-tool-provider.ts ↔ mcp-diagnostics.ts) 한눈에 파악하기 어려움
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L791-800 (`McpBuildPhaseError` 정의), `mcp-diagnostics.ts` L453-474 (`McpErrorPhase`/`McpDiagnosticError`)
  - 상세: `McpBuildPhaseError` 는 내부 제어 흐름 전용 예외 클래스이고, `McpDiagnosticError` 는 emit 되는 데이터 shape 이다. 이름이 유사(`McpBuildPhaseError` vs `McpDiagnosticError`)해 처음 읽는 사람이 두 타입의 역할(제어흐름 vs 데이터) 차이를 오인하기 쉽다. JSDoc 에는 관계가 명시돼 있어(L784-790) 문서화 자체는 양호하다.
  - 제안: 필수는 아니나, `McpBuildPhaseError` 를 `mcp-diagnostics.ts` 로 옮기거나 이름을 `McpBuildPhaseException` 등으로 더 구분되게 하면 관계가 더 명확해질 수 있음. 현재도 JSDoc 교차 참조가 있어 심각한 문제는 아님.

- **[INFO]** `finalizeMcpDiagnostics` 의 `attempted` 판정이 4개 조건 OR 로 나열되어 있어 신규 필드 추가 시 누락 위험
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` L595-601
  - 상세: `attempted = serverSummaries.length>0 || errors.length>0 || toolCalls>0 || resourceReads>0 || promptGets>0` 형태로, `McpDiagnosticsAccumulator` 에 필드가 추가될 때마다 이 조건도 함께 갱신해야 하는 암묵적 결합이 있다. 현재는 5개 필드 전부가 accumulator 필드 수와 일치하므로 문제없음.
  - 제안: 별도 조치 불필요 — 필드 수가 적고 테스트(`mcp-diagnostics.spec.ts`)가 각 케이스(`summary 없이 카운터만`, `아무것도 없으면 undefined`)를 커버하고 있어 회귀 시 즉시 드러남.

- **[INFO]** `classifyMcpCall` 의 이름 규칙 파싱(`indexOf('__')` + slice)이 매직 스트링 상수 없이 문자열 리터럴로 분기
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` L569-581
  - 상세: `'read_resource'`, `'get_prompt'`, `'list_resources'`, `'list_prompts'` 4개 식별자가 함수 본문에 리터럴로 하드코딩되어 있다. 이 값들이 MCP 메타도구 명명 규약(스펙 §5.2)에서 유래한 고정 상수라 매직 넘버 성격의 위험은 낮지만, 같은 값을 사용하는 다른 위치(예: 메타도구 생성부)가 코드베이스에 있다면 상수화가 중복 방지에 도움이 될 수 있음.
  - 제안: 조치 불필요(LOW) — 함수가 짧고(13줄) 테스트가 각 분기를 전부 커버하며, JSDoc 이 각 분기의 근거를 설명하고 있어 가독성은 충분히 확보됨.

- **[INFO]** `ai-turn-executor.ts` 의 `mcpServerSummaries` → `mcpDiagnostics` 필드명 변경이 4곳(빌더 2곳, meta 타입 2곳)에 동일 패턴으로 반복 적용됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L1356, L2213, L3133-3134, L3309-3310 부근
  - 상세: single-turn/multi-turn 두 실행 경로가 거의 동일한 accumulator 생성·전달·emit 패턴(`createMcpDiagnosticsAccumulator()` → `buildMcpDiagnosticsMeta()`)을 반복한다. 이는 기존 코드베이스에도 있던 구조적 중복(RAG accumulator 등도 동일 패턴)이며 이번 diff 가 새로 만든 문제는 아니라 기존 관례를 따른 일관된 변경으로 판단됨.
  - 제안: 조치 불필요 — 기존 아키텍처 패턴과의 일관성을 우선한 것으로 타당함.

## 요약

이번 변경은 `mcpDiagnostics` 를 단일 배열에서 구조화 객체로 승격하는 작업으로, 신규 타입(`McpDiagnostics`, `McpDiagnosticError`, `McpDiagnosticsAccumulator`)과 헬퍼(`classifyMcpCall`, `finalizeMcpDiagnostics`, `createMcpDiagnosticsAccumulator`, `pushMcpDiagnosticError`)가 모두 명확한 이름과 상세한 JSDoc(스펙 섹션 인용 포함)을 갖추고 있어 가독성과 네이밍 일관성이 높다. 각 헬퍼 함수는 짧고 단일 책임이며, 테스트(`mcp-diagnostics.spec.ts`)가 분기별로 촘촘히 커버해 회귀 안전망도 충분하다. 유일하게 언급할 만한 지점은 `McpToolProvider.openServer()` 가 이번 변경으로 3단 중첩 try/catch 를 갖게 되었고 phase-별 에러 코드 분류 로직(`TimeoutError` 여부에 따른 3항 연산)이 connect/tools-list 두 곳에 유사하게 반복된다는 점인데, 반복 횟수가 적고 각 분기 의도가 인라인 주석으로 명확히 설명되어 있어 즉각적인 리팩터링을 요구할 수준은 아니다. 전반적으로 기존 코드베이스의 accumulator/헬퍼 패턴을 그대로 따르는 일관된 확장으로 평가된다.

## 위험도
LOW
