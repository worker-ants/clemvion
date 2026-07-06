# 성능(Performance) 리뷰 결과

### 발견사항

- **[INFO]** `classifyMcpCall` 의 문자열 스캔 (`indexOf('__')`) 은 tool-call 배치당 O(k) (k = 배치 크기, `maxToolCalls` 로 상한)로 무시 가능한 수준
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` (`classifyMcpCall`), 호출부 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:941`
  - 상세: 실행된 도구 호출 결과 루프(`for (const { result, trace } of batchResults)`) 안에서 매 호출마다 `classifyMcpCall` 을 실행하지만, 이 루프는 이미 `toRun = calls.slice(0, safeBudget)` 로 예산 상한이 걸려 있고 실제 provider 실행 자체가 `Promise.all` 병렬 처리이므로, 문자열 prefix/indexOf 검사 자체는 이 병렬 I/O 대비 무시할 수준의 오버헤드다. 알고리즘적 문제 없음.
  - 제안: 변경 불필요.

- **[INFO]** `finalizeMcpDiagnostics` 의 `serverSummaries.filter(...).length` 계산은 실행당 1회(턴/노드 종료 시점)만 호출되어 O(서버 수) 이며 서버 수는 통상 한 자릿수
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` `finalizeMcpDiagnostics`, 호출부 `ai-turn-executor.ts:1753, 3132, 3308`
  - 상세: `buildMcpDiagnosticsMeta` → `finalizeMcpDiagnostics` 는 턴 종료 시 1회만 호출되며 루프 안에서 반복 호출되지 않는다. N+1 이나 반복 재계산 패턴 없음.
  - 제안: 변경 불필요.

- **[INFO]** 누적기(Accumulator) 는 턴/노드 실행 스코프의 작은 mutable object 이며, multi-turn 은 매 turn 마다 새로 생성(`createMcpDiagnosticsAccumulator()`) — 이전 turn 결과는 버려지고 재계산됨(주석에 의도적으로 명시: "buildTools 가 결정론적이므로 안전")
  - 위치: `ai-turn-executor.ts` 라인 ~1088, ~2504 부근 (`const mcpDiagnosticsAcc = createMcpDiagnosticsAccumulator();`)
  - 상세: 이는 성능 저하가 아니라 설계상 트레이드오프(캐싱 대신 재계산)다. `buildTools` 자체가 매 turn MCP 서버에 재연결/재조회(`tools/list`)를 수행하는지 여부가 실제 성능 이슈의 핵심인데, 이번 diff 범위에는 포함되지 않음(diagnostics 누적기 재생성 자체는 O(1) 객체 생성으로 무해).
  - 제안: `buildTools` 가 매 turn MCP 서버 재연결/재조회를 수행한다면(본 diff 범위 밖) 세션·catalog 캐싱을 고려할 가치가 있으나, 현재 diff 는 그 경로를 변경하지 않았으므로 범위 외.

- **[INFO]** `TimeoutError` 서브클래스 도입은 `Error` 생성 비용과 동일 — 성능 영향 없음
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`
  - 상세: 기존 `new Error(...)` 를 `new TimeoutError(label, ms)` 로 교체한 것뿐이며 호출 빈도(타임아웃 발생 시 1회)나 메모리 특성에 변화 없음.
  - 제안: 없음.

- **[INFO]** `as ResumeState`/`as Record<string, unknown>` 캐스트 제거(타입 좁히기로 대체)는 런타임 동작·성능에 영향 없음 (컴파일 타임 전용 변경)
  - 위치: `ai-turn-executor.ts` (`narrowResumeState`, `readExtractionWatermark` 호출부, `memoryState` 스프레드 등)
  - 상세: 순수 타입 레벨 변경이며 런타임 오버헤드나 추가 객체 생성 없음.
  - 제안: 없음.

- **[INFO]** 테스트 파일(`ai-turn-executor.spec.ts`, `mcp-diagnostics.spec.ts`) 추가분은 실행 시간에 큰 영향 없는 소규모 유닛 테스트 — mock 기반, 실제 I/O 없음
  - 위치: 두 spec 파일
  - 상세: 성능 리뷰 대상 아님.

### 요약
이번 변경은 MCP 진단 정보를 `serverSummaries[]` 단일 배열에서 구조화 객체(`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries`/`errors`)로 확장하고, `withTimeout` 에 전용 `TimeoutError` 클래스를 도입하며, 일부 불필요한 타입 캐스트를 제거한 리팩터링 성격의 diff다. 새로 추가된 카운터 집계(`classifyMcpCall`)는 이미 예산 상한(`maxToolCalls`)이 걸린 병렬 실행 배치 루프 안에서 O(1) 문자열 검사만 수행하며, 최종 환원(`finalizeMcpDiagnostics`)도 턴/노드 종료 시 1회만 호출되는 O(작은 배열 크기) 연산이라 알고리즘 복잡도, N+1 호출, 메모리 할당, 블로킹 I/O 등 어떤 측면에서도 성능 저하 요인이 발견되지 않았다. 전반적으로 성능에 중립적인 안전한 변경이다.

### 위험도
NONE
