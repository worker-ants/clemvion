# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[INFO]** `ProviderBuildCtx` 에 `mcpDiagnostics`/`mcpDiagnosticErrors` 두 개의 "핸들러 소유, provider 는 push-only" 슬롯이 병렬로 존재
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` L61-231
  - 상세: `ProviderBuildCtx` 는 이미 `mcpDiagnostics?: McpServerSummary[]` 를 갖고 있었고, 이번 변경으로 대칭 슬롯 `mcpDiagnosticErrors?: McpDiagnosticError[]` 를 추가했다. 두 배열 모두 "핸들러가 생성·소유하고 provider 는 push 만" 이라는 동일 계약을 가지므로 응집도 측면에서는 자연스러운 확장이지만, `ProviderBuildCtx` 인터페이스가 인터페이스 분리 원칙(ISP) 관점에서 서서히 넓어지고 있다 — 실제로 5개 provider 중 `McpToolProvider` 만 `mcpDiagnosticErrors` 를 채우고, `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` 는 `mcpDiagnostics`(serverSummaries) 만 쓰고 `mcpDiagnosticErrors` 는 쓰지 않는다(grep 확인: `pushMcpDiagnosticError` 호출은 `mcp-tool-provider.ts` 1곳뿐). 이는 의도된 단계적 롤아웃(plan 문서에 명시)이라 즉시 문제는 아니지만, provider 마다 optional 필드의 부분집합만 쓰는 패턴이 누적되면 `ProviderBuildCtx` 가 "모든 provider 의 union of needs" 로 비대해지는 방향으로 흐를 수 있다.
  - 제안: 현재는 조치 불필요. 다만 3번째 진단 슬롯이 추가되는 시점에는 `ProviderBuildCtx` 를 `{ diagnostics: McpDiagnosticsAccumulator }` 처럼 단일 sub-object 로 묶어 provider 시그니처가 늘어나지 않게 하는 리팩터를 고려할 만하다 (계획에도 이런 방향의 언급은 없으므로 향후 검토 항목으로 남김).

- **[INFO]** `TimeoutError` 도입이 두 개의 병렬 `withTimeout` 구현 중 하나에만 적용됨 (기존 구조적 이슈의 확장)
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts` vs `codebase/backend/src/modules/llm/utils/with-timeout.util.ts`
  - 상세: 코드베이스에는 이름이 같고 역할이 유사한 `withTimeout` 함수가 최소 2곳에 독립 구현되어 있다 (`common/utils/with-timeout.ts` — MCP 계열 3곳 소비, `modules/llm/utils/with-timeout.util.ts` — LLM 계열 소비). 이번 변경은 전자에만 `TimeoutError` 를 추가했다. 두 구현이 원래도 별도였던 사전 존재 이슈이므로 이번 PR 의 책임 범위는 아니지만, "타임아웃을 구분 가능한 클래스로 승격" 이라는 개선이 LLM 경로에는 적용되지 않아 크로스커팅 관심사(timeout 분류)의 일관성이 모듈별로 갈리는 결과를 낳는다. 같은 `common/utils/with-timeout.ts` 를 쓰는 `McpClientService`/`McpTestConnectionService` 도 아직 `TimeoutError` 를 소비하지 않는다 (plan 문서가 follow-up 으로 명시).
  - 제안: 조치 불필요(범위 밖, plan 추적 중). 장기적으로는 공용 timeout 유틸을 하나로 통합하거나, 최소한 두 구현이 동일한 에러 분류 계약(`TimeoutError extends Error`)을 공유하도록 정렬하는 것을 백로그에 남길 만하다.

- **[INFO]** `McpBuildPhaseError` 는 provider 내부(non-exported) private 에러 타입으로 잘 캡슐화됨 — 레이어 경계 준수
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L791-800
  - 상세: `openServer()` 내부에서만 쓰이는 `phase`+`code` 캐리어 에러(`McpBuildPhaseError`)를 도입해 connect/list 단계별 실패 분류를 표현했다. 이 타입은 export 되지 않고 파일 스코프에 국한되며, 바깥 계층(executor)에는 `McpDiagnosticError`(평면 데이터 구조)만 노출한다. "예외 타입으로 내부 상태 전이를 표현하고, 외부에는 순수 데이터로 변환해 넘긴다"는 계층 경계 원칙을 잘 지킨 설계다. `finalizeMcpDiagnostics`/`classifyMcpCall` 등 순수 함수(mcp-diagnostics.ts)와 부수효과가 있는 provider 코드(mcp-tool-provider.ts)의 책임 분리도 명확하다.
  - 제안: 없음 (모범적인 패턴).

- **[INFO]** `finalizeMcpDiagnostics` 의 "lean meta" 정책과 `McpDiagnosticsAccumulator` → `McpDiagnostics` 변환의 단일 진입점화
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` L591-614, `ai-turn-executor.ts` `buildMcpDiagnosticsMeta`
  - 상세: 누적(mutable `McpDiagnosticsAccumulator`)과 emit(immutable `McpDiagnostics`)을 별도 타입으로 분리하고, 그 사이의 변환 로직(`attempted` 파생, `serverCount` 필터링)을 `finalizeMcpDiagnostics` 단일 함수로 캡슐화했다. `executor.buildMcpDiagnosticsMeta` 는 이 함수를 호출하는 얇은 래퍼일 뿐이라, "언제 attempted 로 판정하는지" 로직이 여러 곳에 중복될 위험이 없다. Command(누적)/Query(파생) 책임 분리가 뚜렷하고, single-turn/multi-turn 두 실행 경로(executor 내 3개소)가 모두 이 동일 helper 를 재사용해 로직 drift 를 방지한다.
  - 제안: 없음.

- **[INFO]** `classifyMcpCall` 이 이름 문자열 파싱(`mcp_<sid>__<identifier>`)에 의존 — 암묵적 네이밍 컨벤션 결합
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` L556-581
  - 상세: 호출 카운터 분류가 tool name 문자열의 `mcp_` prefix 와 첫 `__` 구분자라는 컨벤션에 의존한다. 이 네이밍 규칙은 다른 곳(tool 등록 시 sanitize 로직)에서 생성되는 것으로 보이며, 두 코드가 암묵적 계약(문자열 포맷)으로만 연결되어 있어 향후 tool naming 스킴이 바뀌면 `classifyMcpCall` 이 조용히 오분류할 수 있다. 다만 이는 기존 코드(`matches: (n) => n.startsWith('mcp_')`)에 이미 존재하던 패턴을 재사용한 것이라 이번 PR 이 새로 도입한 결합이 아니다.
  - 제안: 즉시 조치 불필요. 다만 이런 name-encoding 계약이 늘어나면(`read_resource`/`get_prompt`/`list_resources`/`list_prompts` 4개 리터럴이 이미 하드코딩) 향후 tool naming 을 생성하는 쪽(McpToolProvider의 sanitize 로직)과 `classifyMcpCall` 을 같은 모듈에 모으거나 공유 상수로 묶어 두는 것을 고려할 만하다.

- **[INFO]** 순환 의존성 없음, 계층 방향 일관
  - 위치: `mcp-diagnostics.ts` ← `agent-tool-provider.interface.ts`, `mcp-tool-provider.ts`, `ai-turn-executor.ts` / `with-timeout.ts` ← `mcp-tool-provider.ts`, `mcp-test-connection.service.ts`
  - 상세: 신규/변경 타입은 모두 "leaf" 유틸 모듈(`mcp-diagnostics.ts`, `with-timeout.ts`)에서 정의되고, 상위 계층(provider → interface → executor)이 단방향으로 import 한다. `mcp-diagnostics.ts` 는 어떤 provider/executor 도 역참조하지 않으므로 순환 의존성 없음. `with-timeout.ts` 도 마찬가지로 순수 유틸로 유지된다.
  - 제안: 없음.

## 요약

이번 변경은 `mcpDiagnostics` 를 단일 배열에서 구조화 객체로 승격하는 작업으로, 기존에 확립된 패턴(핸들러 소유 accumulator + provider push-only, 순수 변환 함수와 부수효과 코드의 분리, 계층별 에러 타입 캡슐화)을 그대로 확장한 점이 인상적이다. `ProviderBuildCtx` 의 optional 필드가 하나 더 늘어난 것과, 이미 부분적으로 존재하던 `withTimeout` 이원화가 `TimeoutError` 도입으로 비대칭성이 한 단계 더 벌어진 점은 구조적 부채로 남지만 둘 다 이번 PR 이 새로 만든 문제가 아니라 plan 문서에 follow-up 으로 명시된 의도된 범위 축소다. SOLID·계층 분리·순환 의존성 관점에서 CRITICAL/WARNING 급 위반은 발견되지 않았고, 확장성(추가 provider 채택, call-phase errors 후속 확장)을 고려한 여지도 타입 설계에 남아있다.

## 위험도
LOW
