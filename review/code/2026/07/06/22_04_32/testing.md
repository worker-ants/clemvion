# 테스트(Testing) 리뷰 결과

## 발견사항

- **[WARNING]** `with-timeout.ts` 의 신규 `TimeoutError` 클래스에 직접 단위 테스트 없음 — `withTimeout()` 이 실제로 타임아웃을 발생시켜 `TimeoutError` 인스턴스/메시지 포맷을 검증하는 spec 파일 자체가 없다 (`with-timeout.spec.ts` 부재). 현재 유일한 검증은 `mcp-tool-provider.spec.ts` 에서 `new TimeoutError(...)` 를 **직접 construct 해 mock reject 값으로 주입**하는 간접 방식뿐 — `withTimeout()` 함수 자체가 `setTimeout` 경과 시 실제로 `TimeoutError` 를 reject 하는지, `clearTimeout` 이 정상 케이스에서 호출되는지는 어떤 테스트도 실행 경로로 확인하지 않는다.
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`, 대응 spec 부재
  - 상세: 이 유틸은 `McpClientService`(§6.2 진단에 아직 미소비)와 `McpToolProvider` 양쪽에서 쓰이는 공용 유틸이라고 문서화되어 있음에도 unit spec 이 없다. 리팩터(익명 `Error` → `TimeoutError` 서브클래스) 자체는 회귀 테스트로 보호되지 않는 상태.
  - 제안: `with-timeout.spec.ts` 신설 — (1) 정상 resolve 시 `clearTimeout` 호출·값 그대로 전달, (2) 타임아웃 경과 시 `TimeoutError` 인스턴스 reject + 메시지 포맷(`${label} timed out after ${ms}ms`), (3) promise 가 거부(non-timeout)될 때 `Error` 아닌 값도 `Error` 로 래핑되는지(L38 `err instanceof Error ? err : new Error(String(err))`) 커버.

- **[WARNING]** `executeMultiTurn` 경로에 대해 신규 `mcpDiagnostics` 구조화 객체·카운터 emit 테스트가 없음 — `ai-turn-executor.spec.ts` 에 추가된 두 테스트(`emits structured meta.mcpDiagnostics`, `omits meta.mcpDiagnostics`)는 모두 `executeSingleTurn` describe 블록 안에만 있다. 그러나 코드 diff 상 `mcpDiagnosticsAcc`/`buildMcpDiagnosticsMeta` 변경은 single-turn과 multi-turn 양쪽 output builder(`toolCalls`/`ragSources`/`mcpDiagnostics` 필드가 있는 두 지점, `ai-turn-executor.ts` diff L2811·L3250 부근)에 동일하게 적용되었다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` (L304 `describe('executeMultiTurn (first-turn park)'`) — 해당 블록에 mcpDiagnostics 관련 케이스 없음
  - 상세: multi-turn 은 매 turn 마다 `createMcpDiagnosticsAccumulator()` 를 새로 생성하고(diff L2500 부근) `TurnOutputAccumulators` 를 통해 `executeProviderToolBatch` 로 전달하는 구조가 single-turn 과 다른 生成 시점을 가진다. 회귀 시 이 경로만 깨져도 single-turn 테스트만으로는 감지되지 않는다.
  - 제안: multi-turn 에서도 최소 1개 tool-call 턴을 거쳐 `meta.mcpDiagnostics` 가 채워지는 케이스, 그리고 미사용 시 omit 되는 케이스를 추가.

- **[INFO]** `McpBuildPhaseError` 의 방어적(defensive) 분기가 테스트되지 않음 — `mcp-tool-provider.ts` L745 `if (err instanceof McpBuildPhaseError) throw err;` (tools/list catch 블록, 주석에 "이미 McpBuildPhaseError 면(방어적)"이라 명시)은 현재 코드 경로 상 `tools/list` try 블록 내부에서 `McpBuildPhaseError` 가 애초에 throw 될 수 없어(오직 connect 단계에서만 wrap) 실질적으로 도달 불가능한 dead defensive 코드로 보인다. 테스트가 없다는 것 자체보다, 향후 리팩터로 이 불변식이 깨지면(예: 다른 helper 가 tools/list 안에서 McpBuildPhaseError 를 throw 하도록 변경) 조용히 잘못된 phase 로 재분류될 위험을 감지할 회귀 테스트가 없다는 점을 기록.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L744-751
  - 제안: 필수는 아니나, 코드 커버리지 도구에서 미도달 분기로 잡힐 가능성이 있으므로 `/* istanbul ignore next -- defensive, currently unreachable */` 주석 또는 최소 방어 목적을 밝히는 테스트(강제로 McpBuildPhaseError 를 내부에서 다시 던지게 만드는 화이트박스 테스트) 검토.

- **[INFO]** `classifyMcpCall` 의 `mcp_` prefix + `__` 미포함(no double-underscore) 케이스 미검증 — 예: `mcp_abcd1234` (구분자 `__` 자체가 없는 이름)이 들어오면 `idx = -1` → `identifier = ''` → `'tool'` 로 분류된다. 실제 tool 이름 생성기(`mcpToolName`)가 항상 `__` 를 포함시키므로 실무상 발생 안 하지만, 함수가 방어적으로 처리하는 이 엣지는 테스트로 명시되지 않았다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` `classifyMcpCall` / `mcp-diagnostics.spec.ts`
  - 제안: `classifyMcpCall('mcp_onlyprefix')` → `'tool'`(현재 동작) 케이스를 명시적 회귀 테스트로 고정해두면 향후 파싱 로직 변경 시 의도치 않은 회귀를 방지.

- **[INFO]** `finalizeMcpDiagnostics` 의 `serverCount` 계산이 "connected 여러 건 + skipped 여러 건" 혼합 케이스로는 검증되지 않음 — 기존 테스트(`connected + skipped 요약과 counters·errors 를 전체 구조로 emit`)는 connected 1건 + skipped 1건 조합만 다룬다. `serverCount: acc.serverSummaries.filter(s => s.status === 'connected').length` 로직 자체는 단순하나, connected 2건 이상 + skipped 혼재 시에도 올바르게 합산되는지의 boundary 케이스가 없다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.spec.ts` `describe('finalizeMcpDiagnostics'` 블록
  - 제안: 낮은 우선순위 — 로직이 단순한 `filter().length` 이므로 리스크는 낮으나, spec 문서(§6.2)가 다중 서버 시나리오를 명시적으로 다룬다면 최소 1개 다중-connected 케이스 추가 권장.

- **[INFO]** Mock 적절성은 전반적으로 양호 — `mcp-tool-provider.spec.ts` 의 신규 5개 테스트는 실제 provider 내부 흐름(`mcpClient.connect` reject/resolve, `session.listTools` reject, `integrations.getForExecution` status override)을 그대로 이용해 `openServer` 의 실제 catch 체인을 타게 하므로 mock 과 실제 동작의 괴리가 적다. `session.close` 가 실제로 호출됐는지(`expect(session.close).toHaveBeenCalled()`)까지 검증한 점은 리소스 누수 회귀에 대한 좋은 안전장치.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` L642-744
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** 테스트 가독성 — `ai-turn-executor.spec.ts` 신규 테스트의 `mcpProvider` fake 가 4종 tool call(`do`/`read_resource`/`get_prompt`/`list_resources`)을 한 번에 발생시켜 `toolCalls: 1, resourceReads: 1, promptGets: 1` 분류 결과를 한 assertion 으로 검증하는 구성은 응집도 높고 의도가 주석(`do → tool, read_resource → resource, ...`)으로 잘 설명되어 있어 가독성이 좋다. `mcp-diagnostics.spec.ts` 의 한국어 `it()` 설명들도 spec §번호를 인용해 추적 가능성이 높다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` L83-163
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** 테스트 격리 — 신규 테스트 전부 `mockLlmService`/`mcpClient`/`integrations` 를 `beforeEach` 또는 로컬 변수로 매 케이스 재생성하며 전역 상태 공유가 없어 독립 실행 가능. `jest.fn().mockRejectedValueOnce`/`mockResolvedValueOnce` 사용으로 케이스 간 leakage 위험도 낮음.
  - 위치: 전체 신규 테스트
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** 회귀 테스트 — 기존 `pushMcpServerSummary` 테스트(변경 없음)와 `mcpToolName`/`parseMcpToolName` 테스트는 새 시그니처(`ProviderBuildCtx.mcpDiagnosticErrors` 추가)에 영향받지 않고 그대로 유효함을 실행으로 확인(`npx jest ... mcp-tool-provider.spec.ts mcp-diagnostics.spec.ts ai-turn-executor.spec.ts` → 86 passed).
  - 위치: 3개 spec 파일, 실행 결과 86/86 통과
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** 테스트 용이성 — `ProviderBuildCtx.mcpDiagnostics`/`mcpDiagnosticErrors` 를 옵셔널 슬롯으로 provider 에 주입하는 설계(핸들러가 배열 소유, provider 는 push 만)는 provider 단위 테스트에서 plain array 를 넘기는 것만으로 충분히 관찰 가능해 테스트 용이성이 높다. `executor` 의 `buildExecutor(opts)` 헬퍼로 tool provider 를 자유롭게 fake 주입할 수 있는 구조도 DI 친화적.
  - 위치: `agent-tool-provider.interface.ts`, `ai-turn-executor.spec.ts` `buildExecutor`
  - 제안: 없음 (긍정적 관찰).

## 요약

이번 변경(`mcpDiagnostics` 구조화 승격 + build-phase granular error codes)은 신규 로직의 핵심 경로 — `classifyMcpCall` 분류, `finalizeMcpDiagnostics` 의 lean-omit/attempted 판정, `pushMcpDiagnosticError`, `McpToolProvider.openServer` 의 4가지 실패 분류(non-timeout connect / timeout connect / non-timeout list / timeout list / status precheck) — 를 각각 명확한 의도를 가진 단위 테스트로 촘촘히 커버하고 있으며 mock 도 실제 provider 내부 흐름을 그대로 타게 해 실동작과의 괴리가 적다. 다만 두 가지 실질적 갭이 있다: (1) 리팩터된 `TimeoutError`/`withTimeout` 자체에 대한 전용 단위 테스트가 전혀 없어 타임아웃 발생 시의 실제 reject 동작이 어떤 spec 으로도 직접 실행 검증되지 않고, (2) 신규 `mcpDiagnostics` emit 로직이 single-turn 만 테스트되고 동일 코드가 적용된 multi-turn 경로(`executeMultiTurn`)는 테스트되지 않아 회귀 감지 사각지대가 남는다. 나머지는 낮은 우선순위의 엣지 케이스(다중 connected 서버, `__` 미포함 tool 이름) 보강 정도이며 이미 실행된 86개 테스트는 전부 통과해 기존 회귀는 없다.

## 위험도
LOW
