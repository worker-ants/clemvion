# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md (--impl-done)

## 발견사항

- **[INFO]** `nodeExecutionId`/`workflowId` 재유도 경로가 Rationale 문구("`node.config` 에서 재유도")와 문자적으로 어긋남
  - target 위치: 코드 `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (`CREDENTIAL_CONTEXT_FIELDS`, `resumeStateSchema.nodeExecutionId`), `execution-engine.service.ts buildRetryReentryState` 의 신규 `workflowId: execution.workflowId` / `nodeExecutionId: opts?.nodeExecutionId` 주입부
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존 (옛 "WARN #6 미영속" 번복)" 항, "credential / context-binding 필드(`llmConfigId`/`workspaceId`/`presentationTools`/`conditions`/`maxTurns` 등)는 동일하게 미동봉하고 **재개 시 `node.config` 에서 재유도한다**"는 문장
  - 상세: 이번 diff 는 `nodeExecutionId` 를 새로 `CREDENTIAL_CONTEXT_FIELDS`(persist 금지 목록)에 추가하고, resume/retry 시 이를 `node.config` 재평가가 아니라 **호출측이 알고 있는 살아있는 NodeExecution row id**(`retry-turn.service.ts` 의 `spawnedRow.id`, `ai-turn-orchestrator.service.ts` 의 `ctx.nodeExec?.id`)로 opts 주입한다. `nodeExecutionId` 는 애초에 `node.config` 에 존재할 수 없는 런타임 식별자이므로 Rationale 이 명시한 "config 재유도" 메커니즘과 다른 경로를 탄다. 다만 이 divergence 는 신규가 아니다 — 같은 목록의 `workflowId` 도 diff 이전부터 이미 존재했고 실제로는 `execution.workflowId`(config 아님)로 채워지므로, 동일한 문구상 부정확성이 이미 있었다. 즉 이번 변경은 기존에 이미 있던 패턴을 한 필드 더 확장한 것이지 새 모순을 만든 것은 아니다. 같은 Rationale 항 말미의 "신규 핸들러는 자기 runtime state 를 allow-list 에 등록해야 지원된다(원칙 번복이 아니라 점진 확장)" 문구가 이런 확장을 명시적으로 예견·허용하고 있다.
  - 제안: Rationale 문구를 "credential/context-binding 필드는 (a) 노드 config 재평가로 재유도되는 조작 필드(`llmConfigId`/`maxTurns`/`conditions`/`presentationTools` 등)와 (b) 살아있는 execution/NodeExecution row 에서 직접 참조되는 식별 필드(`workflowId`/`nodeExecutionId`)로 나뉜다" 정도로 갱신해 두 재유도 채널을 명시하면 향후 유사 필드 추가 시 판단 기준이 명확해진다.

- **[INFO]** resume 턴 provider-tool usage-log attribution 신규 불변식이 spec 본문(§1.3/§10)에 미기재
  - target 위치: `spec/5-system/4-execution-engine.md` §1.3 (재개 state 직렬화 필드), §10.1/§10.3 (`logUsage`, "엔진이 주입")
  - 과거 결정 출처: 동일 spec §10.3 "`context.nodeExecutionId`는 각 노드 호출 직전 새로 배정되므로 순차 실행 모델에서 안전하다" — 이 문장은 **최초 진입 시점**의 단일 배정만 다루고 있어, AI multi-turn resume/retry(별도 진입 경로 — `AiTurnOrchestrator`/`RetryTurnService`, engine.runNode 를 재통과하지 않음)에서 동일 값이 유지되어야 한다는 요구는 spec 문면에 없었다.
  - 상세: 이번 회귀 수정(#501, `plan/in-progress/fix-resume-turn-usage-log-attribution.md`)은 "멀티턴 2번째 이후 턴에서 cafe24/makeshop/mcp provider-tool 호출의 `logUsage` 게이트(`if (ctx.nodeExecutionId && ctx.workflowId)`)가 조용히 false 가 되어 활동 로그가 누락"되는 버그를 고쳤다. 고쳐진 동작은 §10.3 이 원래 의도한 "매 노드 호출마다 nodeExecutionId 가 살아있어야 logUsage 가 정상 동작한다"는 불변식을 multi-turn resume 경로까지 확장 적용한 것으로, 기존 원칙을 뒤집는 것이 아니라 원래 원칙이 커버하지 못했던 사각지대를 메운 것이다. plan frontmatter 는 `spec_impact: none` 으로 선언했고, 본 검토도 이에 동의한다(설계 결정 신설이 아니라 버그 수정). 다만 이 불변식(resume/retry 턴에서 provider-tool 호출이 정상 기록되려면 resumeState 가 `nodeExecutionId`/`workflowId` 를 운반해야 한다)은 회귀 테스트로만 강제되고 spec 본문에는 등장하지 않아, 향후 관련 필드를 checkpoint allow-list 에서 무심코 제외하면(예: 리팩터링 중 `CREDENTIAL_CONTEXT_FIELDS` 정리) 같은 버그가 재발해도 spec 검토만으로는 감지되지 않는다.
  - 제안: §1.3 checkpoint 서술 또는 §10.3 근처에 "multi-turn resume/retry 턴의 provider-tool `logUsage` 정합성은 `nodeExecutionId`/`workflowId` 가 resumeState 를 통해 재유도되어야 성립한다"는 1줄 크로스 레퍼런스를 추가하거나, 위 Rationale 항에 짧은 addendum(#501 회귀 배경)을 붙여 두면 발견성이 높아진다. 필수 차단 사유는 아님.

- 검토했으나 문제 없음(참고): `engine-driver.interface.ts` 의 `ReentryStateDriver.buildRetryReentryState` opts 타입에 `nodeExecutionId?: string` 을 추가한 것은 "C-1 god-class strangler-fig 분할" Rationale 이 정의한 12-멤버 `EngineDriver`/ISP 계층 경계를 건드리지 않는 단순 optional 필드 추가로, 해당 Rationale 과 충돌하지 않는다. 또한 신규 `nodeExecutionId` 는 DB 영속 대상(`resumeCheckpointSchema`/`retryStateSchema` 의 `credentialStripSubsetShape`)에는 포함되지 않고 in-memory `resumeStateSchema` + 제외 목록(`CREDENTIAL_CONTEXT_FIELDS`)에만 추가되어, "checkpoint 는 credential-free 부분집합만 영속" 원칙(§1.3, R1 Rationale)을 위반하지 않는다.

## 요약

이번 변경(#501 회귀 수정)은 멀티턴 AI 노드의 resume/retry 턴에서 provider-tool(cafe24/makeshop/mcp) 사용 로그가 누락되던 버그를 `buildRetryReentryState` 재구성기에 `workflowId`/`nodeExecutionId` 재주입을 추가해 고친 것으로, execution-engine spec 의 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 지점은 발견되지 않았다. `nodeExecutionId` 를 checkpoint 영속 제외 목록(`CREDENTIAL_CONTEXT_FIELDS`)에 추가하고 in-memory resumeState 에만 태우는 방식은 "credential/context-binding 필드는 DB 미영속 + 재개 시 재유도" 원칙(및 "신규 필드 등록은 원칙 번복이 아닌 점진 확장" 이라는 동일 Rationale 항의 명시적 선례)과 부합한다. 다만 (1) 재유도 메커니즘이 Rationale 문구가 명시한 "`node.config` 재평가" 와 다르게(caller 가 살아있는 row id 를 opts 로 직접 주입) 동작하는 부분과 (2) resume 턴의 usage-log 정합성이 resumeState 의 두 필드에 의존한다는 신규 불변식이 spec 본문에 명시되지 않은 부분은 향후 발견성을 위해 Rationale/본문에 짧게 반영해 둘 가치가 있다. 두 건 모두 차단 사유가 되는 모순은 아니다.

## 위험도

LOW
