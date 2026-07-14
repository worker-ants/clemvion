# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 신규 하드 예산 도입으로 기존 운영 워크플로우의 런타임 동작이 조용히 바뀜(의도된 회귀 방지책이지만 배포 후 즉시 실패로 나타날 수 있음)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` (`enforceToolPayloadBudget`), `ai-turn-executor.ts:3499-3504` (`buildTools`)
  - 상세: `buildTools` 직후 `enforceToolPayloadBudget`가 호출되어, 도구 정의 직렬화 크기가 `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`(기본 256KB) 또는 `AI_AGENT_TOOL_COUNT_MAX`(기본 128)를 넘으면 `ToolDefinitionPayloadExceededError`를 throw 한다. 이전에는 이런 가드가 없어 LLM 호출까지 진행됐다(결과적으로 provider timeout으로 수 분 hang). 이번 변경으로 **기존에 이미 256KB/128개를 넘는 도구셋으로 설정된 워크스페이스는 배포 즉시 `error` 포트로 종결**되도록 동작이 바뀐다. 의도된 fail-fast 설계이고 기본값이 넉넉하게 잡혀 있어 위험은 낮지만, feature flag 없이 전역 적용되는 breaking behavior change이므로 배포 노트/모니터링에 명시할 필요가 있다.
  - 제안: 배포 시 기존 대형 MCP 카탈로그(예: Cafe24 allowlist 미설정) 워크스페이스에 대한 사전 스캔 또는 롤아웃 공지 권장. (plan 문서의 "즉시 완화(enabledTools allowlist)"가 이미 안내되어 있어 완전히 새로운 리스크는 아님.)

- **[INFO]** 도구 payload 예산 초과 시 `mcpDiagnosticsAcc`에 누적된 진단 데이터가 error 포트 출력에서 유실됨
  - 위치: `ai-turn-executor.ts:1519-1551` (신규 catch 블록), 비교 대상: `ai-turn-executor.ts:1805`(`buildMcpDiagnosticsMeta` 포함), `:2265`(`mcpDiagnostics: mcpDiagnosticsAcc` 포함)
  - 상세: `buildTools` 내부에서 provider(`McpToolProvider` 등)의 `buildTools()`가 먼저 실행되어 `mcpDiagnosticsAcc.serverSummaries`/`errors`를 **먼저 mutate**한 뒤(`ai-turn-executor.ts:3476-3494`), 그 다음에 `enforceToolPayloadBudget`이 throw 한다. 즉 예산 초과로 실패하는 시점에도 실제 MCP 연결·오퍼레이션 나열 등 side-effect(진단 누적)는 이미 일어난 상태다. 그런데 신규 single-turn 조기 반환 블록의 `meta`는 `model`/`durationMs`만 담고, 파일 내 다른 error/condition 경로들(`:1805`, `:2265`)이 관례적으로 포함하는 `mcpDiagnostics`를 담지 않는다. 버그는 아니지만(에러 메시지의 `details.culpritProvider`로 어느 정도 원인은 알 수 있음) 같은 파일 내 error-path 출력 shape 불일치이며, 어느 MCP 서버가 실제로 연결/응답했는지에 대한 관측 정보가 조용히 버려진다.
  - 제안: 필요시 `meta`에 `...(AiTurnExecutor.buildMcpDiagnosticsMeta(mcpDiagnosticsAcc) ?? {})`를 추가해 다른 error 경로와 shape 정합.

- **[INFO]** `buildTools`(private)의 암묵적 계약 변경 — 신규 예외 타입 throw
  - 위치: `ai-turn-executor.ts:3462-3505`
  - 상세: `buildTools`는 시그니처(파라미터/반환 타입)는 그대로지만 이제 `ToolDefinitionPayloadExceededError`를 throw할 수 있다는 새 계약이 추가됐다. 현재 호출자는 두 곳(`executeSingleTurn`은 특정 에러만 잡아 `error` 포트로 변환, `processMultiTurnMessage`는 그대로 propagate → 상위 `AiTurnOrchestrator.extractAiTurnErrorPayload`가 처리)뿐이며 둘 다 올바르게 처리함을 코드로 확인했다(`ai-turn-orchestrator.service.ts:1112-1114`의 `classifyLlmError`가 `explicitCode`를 그대로 pass-through). 다만 향후 `buildTools`를 호출하는 새 경로가 추가될 경우 이 throw 계약을 놓치면 unhandled rejection으로 이어질 수 있어 문서화된 계약으로 남겨둘 필요가 있다(이미 JSDoc으로 기술되어 있어 실질 위험은 낮음).
  - 제안: 현재 조치 불필요, 신규 호출자 추가 시 체크리스트로만 인지.

- **[INFO]** 신규 환경변수 3종 도입, 매 호출 시 `process.env` read (전역 캐시 없음)
  - 위치: `tool-payload-budget.ts:582-599` (`readByteBudget`, `toolPayloadSoftBytes`, `toolPayloadHardBytes`, `toolCountMax`)
  - 상세: `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`/`AI_AGENT_TOOL_COUNT_MAX`가 새로 도입되고, 매 `enforceToolPayloadBudget` 호출마다 `process.env`를 다시 읽는다(전역 상태·caching 없음, `mcp-tool-provider.ts`의 `MAX_RESPONSE_BYTES` 선례와 동형). 환경변수를 쓰지는 않으므로 읽기 전용 부작용만 있고 위험은 낮다. 테스트(`tool-payload-budget.spec.ts`, `ai-turn-executor.spec.ts`)는 `beforeEach`/`afterEach`로 원값을 저장·복원해 다른 테스트로의 오염을 차단하고 있어 테스트 격리도 적절하다.
  - 제안: 조치 불요 (정보성).

- **[INFO]** 신규 파일 생성은 모두 예상 범위 내 (코드/테스트/plan/spec) — 예상치 못한 FS 부작용 없음
  - 위치: `tool-payload-budget.ts`(신규 구현), `tool-payload-budget.spec.ts`(신규 테스트), `plan/in-progress/ai-agent-tool-payload-budget-{guardrail,followups}.md`(신규 plan), `review/consistency/2026/07/14/{08_49_37,09_04_19}/*`(consistency-check 산출물), `spec/**`(spec 갱신)
  - 상세: 코드 자체(런타임 실행 경로)는 파일시스템에 쓰기를 하지 않는다. diff에 포함된 파일 생성은 모두 이번 개발 워크플로우(spec 갱신 → plan 문서 → 구현 → consistency-check 산출물)의 산출물이며 프로젝트 컨벤션(`plan/in-progress/**`, `review/consistency/**`)에 부합한다. 의도치 않은 파일 생성으로 볼 근거 없음.
  - 제안: 조치 불요.

- **[INFO]** 인터페이스(공개 API) 변경 없음, 이벤트/콜백 변경 없음, 네트워크 호출 신규 없음
  - 상세: `estimateAgentToolPayload`/`enforceToolPayloadBudget`/`toolProviderGroupKey` 등은 모두 신규 export이며 기존 export를 변경하지 않는다. `AiTurnExecutor.executeSingleTurn`/`processMultiTurnMessage`의 외부 시그니처(파라미터)는 불변이고, 반환 shape도 기존 `NodeHandlerOutput` 계약 내에서 새 `error` 포트 케이스가 하나 추가된 것뿐이다(`ai-agent.handler.ts`는 결과를 그대로 pass-through 하므로 영향 없음). MCP/LLM 등 외부 서비스로의 신규 호출 경로는 없다(기존 `provider.buildTools()` 호출 순서·횟수 불변, 예산 판정은 그 결과에 대한 순수 계산).

## 요약
핵심 변경(`tool-payload-budget.ts` 신규 estimator/가드 + `ai-turn-executor.ts`의 `buildTools` 직후 fail-fast 삽입)은 순수 계산·읽기 전용 env 조회 위주로 부작용 표면이 작다. 전역 변수 신설이나 예기치 않은 파일시스템 변경, 신규 네트워크 호출은 없으며, 함수 시그니처도 외부 계약상 변경되지 않았다. 다만 (1) 기존에 예산을 초과하는 대형 도구셋으로 이미 설정된 운영 워크플로우는 배포 즉시 동작이 "hang 후 실패"에서 "즉시 error 포트 종결"로 바뀌는 의도된 breaking behavior change이고, (2) 새 single-turn 조기 반환 경로가 `mcpDiagnosticsAcc`의 이미 채워진 진단 데이터를 `meta`에 담지 않아 같은 파일 내 다른 error 경로와 output shape이 미묘하게 불일치한다. 둘 다 차단 사유는 아니며 전자는 이미 plan/spec에서 논의된 의도된 트레이드오프, 후자는 관측성 개선 여지 정도다.

## 위험도
LOW
