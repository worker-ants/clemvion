# 아키텍처(Architecture) 리뷰 — AI Agent 도구 정의 payload 예산 가드레일

대상: `codebase/backend/src/nodes/ai/ai-agent/{ai-turn-executor.ts, ai-turn-executor.spec.ts, tool-payload-budget.ts, tool-payload-budget.spec.ts}` + 관련 spec/plan 문서

## 발견사항

- **[WARNING]** `AiTurnExecutor.executeSingleTurn` 이 이미 커진 "God Method" 인데, 이번 변경이 로직을 추가로 inline 하며 기존 추출 관례를 따르지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1401`~`1836` (약 435줄, 특히 신규 로직 `1498`~`1554`)
  - 상세: `executeSingleTurn` 은 이미 system prompt 조립·메시지 조립·메모리 주입·도구 빌드·LLM 호출·도구 루프·표현 도구 처리를 한 메서드가 오케스트레이션하는 대형 메서드다. 같은 클래스는 이미 `buildAgentSingleTurnSystemPrompt`, `buildSingleTurnMessages`, `applySingleTurnMemoryInjection` 처럼 논리 단계를 private 메서드로 추출하는 자체 관례를 갖고 있다. 이번 변경은 `singleTurnConfigEcho` 조립을 (기존에 반환 직전 한 곳에 있던 것을) 메서드 중간으로 끌어올리고, `buildTools` 호출을 새 `try/catch` + early-return `NodeHandlerOutput` 구성 블록으로 감쌌다 — 약 55줄의 새 분기가 기존 추출 관례를 따르지 않고 메서드 본문에 그대로 삽입됐다. `singleTurnConfigEcho` 재사용으로 config echo 중복은 제거했다는 점(DRY)은 긍정적이나, 에러 포트 output 조립 로직 자체는 별도 헬퍼(예: `buildToolPayloadExceededOutput(err, singleTurnConfigEcho, model, llmConfig, startedAt)`)로 뽑아낼 수 있었다.
  - 제안: 신규 `try/catch` → `NodeHandlerOutput` 조립 블록을 별도 private 메서드로 추출해 기존 로컬 관례(단계별 헬퍼 분리)와 정합시키고, `executeSingleTurn` 본문 증가를 억제.

- **[WARNING]** 동일 클래스(`AiTurnExecutor`) 안에서 동일 에러(`ToolDefinitionPayloadExceededError`)에 대해 두 공개 메서드가 서로 다른 실패 전파 계약을 가짐
  - 위치: `ai-turn-executor.ts:1519`~`1554` (`executeSingleTurn` — 로컬 `try/catch` 후 `error` 포트 `NodeHandlerOutput` 을 **return**) vs `ai-turn-executor.ts:2609`~`2614` (`processMultiTurnMessage` — `buildTools` throw 를 감싸지 않고 그대로 전파, 상위 `AiTurnOrchestrator.handleAiMessageTurn` 의 `try/catch` + `extractAiTurnErrorPayload` 에 위임). `ai-turn-executor.spec.ts:120`~`150` 신규 테스트가 이 비대칭을 명시적으로 고정(pin)한다.
  - 상세: 같은 클래스의 두 public 엔트리포인트가 같은 도메인 에러(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`)를 서로 다른 방식(값 반환 vs 예외 전파)으로 표면화한다. 이는 호출자가 "이 클래스에서 도구 payload 예산 에러가 어떻게 나오는가"를 메서드별로 따로 알아야 하는 암묵적 계약 불일치이며, 리뷰 대상 plan(`plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` Phase 2 항목 2)도 이를 `node-output-redesign/ai-agent.md` 의 미해결 CRITICAL(single-turn error 라우팅)에 대한 "선행 의존"으로 스스로 인정하고 있다. 즉 이번 PR 은 근본 비대칭을 해소하지 않고 그 위에 새 에러코드 하나를 각 경로별로 다르게 배선한 것 — 향후 유사 pre-flight 에러가 추가될 때마다 "single-turn 용 catch" 와 "multi-turn 용 throw-and-let-orchestrator-catch" 를 매번 따로 구현해야 하는 패턴이 굳어질 위험이 있다.
  - 제안: 장기적으로 `buildTools` 를 호출하는 두 지점 모두 동일한 계약(예: 둘 다 throw, 클래스 경계에서 공통 어댑터가 `NodeHandlerOutput`/orchestrator 예외로 변환)으로 통일하거나, 최소한 이 비대칭을 클래스 JSDoc 레벨에 공식 계약으로 문서화해 향후 신규 pre-flight 에러 추가 시 실수를 방지. (이미 plan 의 후속 항목으로 인지되어 있으므로, 이번 PR 범위 내 필수 수정은 아님 — 다만 이 비대칭을 "확장"하는 변경이므로 추적 유지 권고.)

- **[INFO]** `toolProviderGroupKey` 의 provider 그룹핑이 각 tool provider 의 명명 규칙에 문자열 prefix 로만 결합되어 있어, provider 측 명명 변경 시 컴파일타임 안전망 없이 진단 정확도가 조용히 저하될 수 있음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts:609`~`620` (`mcp_` / `kb_` / `render_` / `cond_` 하드코딩 prefix)
  - 상세: `estimateAgentToolPayload` 의 `perProvider`(및 예산 초과 에러의 `culpritProvider`)는 오직 도구 이름 문자열의 prefix 매칭으로 provider 를 역추정한다. 이 prefix 들과 실제 tool provider(`AgentToolProvider.key` 구현체들)가 도구 이름을 생성하는 코드 사이에는 공유 상수/타입 등 명시적 연결이 없다 — 새 provider 추가나 기존 provider 의 이름 규칙 변경이 있어도 이 함수는 아무 경고 없이 모든 해당 도구를 fallback `'tool'` 버킷으로 묶는다. 예산 판정 자체(bytes/count 비교)의 정확성에는 영향이 없고 "범인 provider 지목"이라는 진단/관측 편의 기능에만 영향을 주므로 severity 는 INFO 로 제한한다.
  - 제안: 각 tool provider 가 노출하는 이름 prefix 를 공유 상수(예: provider interface 에 `readonly namePrefix` 필드) 로 노출하고 `toolProviderGroupKey` 가 이를 참조하도록 하면, provider 추가/변경 시 그룹핑 로직이 자동으로 동기화된다. 현재 스코프(런타임 가드 우선, 후속 PR 로 config-time 재사용 예정)를 고려하면 지금 당장 강제할 사항은 아니며 후속 refactor 후보로 남겨도 무방.

- **[INFO]** `tool-payload-budget.ts` 신규 모듈은 순수 함수 + 구조적 타입(logger 덕타이핑)으로 설계되어 NestJS DI 없이도 독립 단위 테스트가 가능하고, `buildTools` 라는 단일 choke point 에서만 강제되어 single-turn·multi-turn 양쪽이 중복 없이 예산 로직을 공유함 (긍정적 설계)
  - 위치: `tool-payload-budget.ts` 전체, 호출부 `ai-turn-executor.ts:3499`~`3504`
  - 상세: estimator(`estimateAgentToolPayload`)와 정책 강제(`enforceToolPayloadBudget`)를 분리하고, 후자는 `logger?: { warn(message: string): void }` 구조적 타입만 요구해 구체 `Logger` 클래스에 의존하지 않는다(DIP 준수). 예산 강제가 `AiTurnExecutor.buildTools` 라는 이미 두 실행 경로(단일턴/멀티턴)가 공유하던 기존 choke point 안에 삽입되어, 예산 로직 자체는 정확히 한 곳에서만 실행된다 — 이는 plan 문서가 "estimator 단일 진실"로 명시한 목표와도 일치하고, 순환 의존성도 없음(`shared/agent-memory-injection.ts` 로의 단방향 참조만 존재).

## 요약

핵심 신규 모듈 `tool-payload-budget.ts` 는 순수 함수·구조적 타입·단일 choke-point 강제라는 좋은 아키텍처 선택을 보이며, SRP·DIP 관점에서 흠잡을 곳이 적다. 다만 이를 소비하는 `AiTurnExecutor.executeSingleTurn` 은 이미 435줄 안팎의 God Method 로, 이번 변경이 기존 로컬 추출 관례(단계별 private 헬퍼 분리)를 따르지 않고 새 try/catch 분기를 그대로 인라인 추가해 메서드 비대화를 더 키웠다. 더 근본적으로는, 동일 클래스의 두 공개 엔트리포인트(`executeSingleTurn` vs `processMultiTurnMessage`)가 같은 pre-flight 에러에 대해 서로 다른 전파 계약(return vs throw-and-external-catch)을 갖는 기존 비대칭을, 이번 PR 이 해소 없이 새 에러코드로 "확장"만 했다 — plan 문서 스스로도 이를 별도 미해결 CRITICAL 에 대한 선행 의존으로 인지하고 있어 즉시 차단 사유는 아니지만 추적이 필요하다. `toolProviderGroupKey` 의 문자열 prefix 결합은 진단 정확도에만 영향을 주는 경미한 결합도 이슈다. Consistency-check 산출물(SUMMARY 등)에서 이미 지적된 API 계약(PATCH vs saveCanvas)·cross-node-warning-rules 우회 문제는 최종 spec 파일(18~20)에는 이미 반영/정정된 상태로 확인되어 이번 아키텍처 리뷰의 코드 대상(1~4번 파일)에는 재차 지적할 CRITICAL 이 없다.

## 위험도

LOW
