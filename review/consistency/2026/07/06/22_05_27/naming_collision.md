### 발견사항

- **[WARNING]** `mcpDiagnostics` 식별자가 계층에 따라 서로 다른 shape 로 재사용됨 (provider ctx 슬롯 vs meta 최종 출력)
  - target 신규 식별자: `meta.mcpDiagnostics`(신규 구조화 객체 `McpDiagnostics` — `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries[]`/`errors[]`)
  - 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts:69` 의 `ProviderBuildCtx.mcpDiagnostics?: McpServerSummary[]` (provider 가 push 하는 입력 슬롯, 단순 배열)
  - 상세: 동일 이름 `mcpDiagnostics` 가 (a) provider→handler 방향의 입력 슬롯(`McpServerSummary[]`, 배열)과 (b) handler→meta 방향의 최종 출력(`McpDiagnostics`, 구조화 객체)이라는 서로 다른 두 타입으로 코드 전역에서 동시에 존재한다. 이번 PR 이전에는 두 계층 모두 `McpServerSummary[]` 로 shape 가 동일했기 때문에 이름 재사용의 위험이 낮았으나, 이번 변경으로 meta 쪽이 구조화 객체로 승격되면서 "같은 이름, 다른 shape" 간극이 벌어졌다. 코드 주석(`agent-tool-provider.interface.ts:64-67`)이 관계를 명확히 설명하고 있어 즉각적 오용 가능성은 낮지만, 신규 기여자가 `ctx.mcpDiagnostics.push(...)` 와 `meta.mcpDiagnostics.serverSummaries` 를 동일시하여 잘못된 타입을 가정할 여지가 있다.
  - 제안: `ProviderBuildCtx` 의 provider-입력 슬롯을 `mcpServerSummaries?: McpServerSummary[]` 등으로 개명해 emit 되는 `meta.mcpDiagnostics`(구조화 객체)와 시각적으로 구분하거나, 최소한 spec §6.2 에 "코드 레벨 `ProviderBuildCtx.mcpDiagnostics` 는 push 전용 sub-slice 이며 emit 형태(`meta.mcpDiagnostics`)와 shape 가 다르다"는 한 줄 각주를 추가해 명명 유래를 명시.

- **[INFO]** 구 필드명 `mcpServerSummaries`(meta 최상위 키) 는 완전히 제거·rename 확인됨
  - target 신규 식별자: `meta.mcpDiagnostics` (구 `meta.mcpServerSummaries` 대체)
  - 기존 사용처: 없음 — 전체 리포지토리(`codebase/`, `spec/`) 검색 결과 구 이름 잔존 0건
  - 상세: diff 가 `ai-turn-executor.ts` 의 모든 `mcpServerSummaries` 참조(단언문·타입·메타 emit 4곳)를 `mcpDiagnostics` 로 정확히 치환했고, frontend 쪽에도 이 필드를 소비하는 코드가 없어 rename 누락 위험은 없음.
  - 제안: 없음 (확인 완료, 조치 불요).

- **[INFO]** `TimeoutError` 신규 클래스는 기존 `SubWorkflowTimeoutError` 와 이름은 다르지만 개념적으로 유사한 "타임아웃 에러 클래스"가 이미 존재
  - target 신규 식별자: `codebase/backend/src/common/utils/with-timeout.ts` 의 `export class TimeoutError extends Error`
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:62` 의 `export class SubWorkflowTimeoutError extends Error`
  - 상세: 두 클래스는 이름이 겹치지 않고(`TimeoutError` vs `SubWorkflowTimeoutError`) 각자 다른 서브시스템(공용 `withTimeout` 유틸 vs sub-workflow 실행 엔진)에 속해 실질적 충돌은 없다. 다만 프로젝트에 "타임아웃 전용 Error subclass" 네이밍 패턴이 두 곳에서 독립적으로 생겨나는 중이므로, 향후 세 번째 타임아웃 클래스가 추가될 때 관례 통일(`XxxTimeoutError` 접미사) 여부를 점검할 필요가 있다. 또한 `TimeoutError` 는 Node.js/브라우저 표준 전역(`DOMException` 계열, 일부 런타임의 전역 `TimeoutError`)과 이름이 같아, 향후 다른 모듈에서 `import { TimeoutError } from 'node:...'` 류를 함께 쓸 경우 로컬 재정의와 그림자(shadowing) 혼동 여지가 있다.
  - 제안: 즉각 조치 불요 — 현재 import 경로가 명시적(`from '../../../../common/utils/with-timeout'`)이라 혼동 가능성은 낮음. 향후 서로 다른 타임아웃 에러 클래스가 더 늘어나면 `spec/conventions/` 에 명명 규칙을 성문화하는 것을 고려.

- **[INFO]** 신규 API 표면(`McpDiagnostics`/`McpDiagnosticsAccumulator`/`McpDiagnosticError`/`McpErrorPhase`/`classifyMcpCall`/`createMcpDiagnosticsAccumulator`/`finalizeMcpDiagnostics`/`pushMcpDiagnosticError`/`mcpDiagnosticErrors`)는 전역 검색상 다른 의미로 선재 사용된 곳 없음
  - target 신규 식별자: 위 나열된 전체
  - 기존 사용처: 없음 (grep 결과 전부 `mcp-diagnostics.ts`/`ai-turn-executor.ts`/`agent-tool-provider.interface.ts`/`mcp-tool-provider.ts` 및 대응 `.spec.ts` 내부로 국한)
  - 상세: `MCP_ERROR_CODES`(`codebase/backend/src/modules/mcp/mcp-error-codes.ts`)의 `CONNECT_FAILED`/`LIST_FAILED`/`TIMEOUT` 값도 spec §8.2 vocabulary 및 이번 신규 `McpErrorPhase`/`McpDiagnosticError.code` 사용과 값 수준에서 일치, 별도 vocabulary 충돌 없음. Cafe24/Makeshop MCP provider 는 신규 `mcpDiagnosticErrors` 슬롯을 아직 push 하지 않으나, 이는 spec §6.2 가 "`errors[]` 는 외부 `McpToolProvider` 의 build 단계만 다룬다"고 명시적으로 범위를 좁혀 놓았으므로 명명 충돌이 아니라 의도된 범위 제한이다.
  - 제안: 없음 (확인 완료, 조치 불요).

### 요약

target(`spec/5-system/11-mcp-client.md`) 및 대응 구현 diff 가 도입하는 신규 식별자(`TimeoutError`, `McpDiagnostics`, `McpDiagnosticsAccumulator`, `McpDiagnosticError`, `McpErrorPhase`, `mcpDiagnosticErrors`, `classifyMcpCall` 등)는 전체 코드베이스·spec 검색 결과 기존 사용처와 실질적으로 충돌하지 않는다. 구 필드명 `mcpServerSummaries` → `mcpDiagnostics` rename 은 전 사용처에서 누락 없이 완료됐고, `MCP_ERROR_CODES` vocabulary 도 spec §8.2 와 정확히 일치한다. 유일하게 주목할 지점은 `ProviderBuildCtx.mcpDiagnostics`(provider 입력 슬롯, `McpServerSummary[]`)와 `meta.mcpDiagnostics`(최종 출력, 신규 구조화 객체 `McpDiagnostics`)가 **동일 식별자를 다른 shape 로 재사용**하고 있다는 점인데, 코드 주석으로 관계가 설명되어 있어 CRITICAL 로 볼 근거는 부족하고 명명 명확화 권고 수준의 WARNING 이다. `TimeoutError` 클래스명도 기존 `SubWorkflowTimeoutError` 와 직접 충돌은 없으나 프로젝트 내 타임아웃 에러 명명 관례가 아직 성문화되지 않은 점은 INFO 로 남긴다.

### 위험도

LOW
