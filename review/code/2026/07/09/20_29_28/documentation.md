# 문서화(Documentation) Review — fix-resume-turn-usage-log-attribution (#501 회귀 수정)

## 발견사항

- **[INFO]** CHANGELOG.md 미갱신 (선택적)
  - 위치: `CHANGELOG.md` (루트)
  - 상세: 이번 변경은 멀티턴 AI 노드의 resume 턴에서 cafe24/makeshop/mcp provider-tool 호출이 `integration_usage_log` 에 기록되지 않던 회귀(#501)를 고친다. 사용자 관점에서는 Integration 상세 페이지 §4.6 "Recent activity 탭"(`spec/2-navigation/4-integration.md §4.6`)에 2번째 이후 턴의 활동 로그가 누락되는 관측 가능한 증상이다. `plan/in-progress/fix-resume-turn-usage-log-attribution.md` 는 `spec_impact: none` 으로 표시했는데, 이는 spec 자체가 이미 이 동작을 규정하고 있어(§1.3 context-binding 필드 재유도) spec 문서 수정은 불필요하다는 판단으로 타당하다. 다만 기존 CHANGELOG.md 에는 유사하게 관측 가능한 회귀 수정("Manual Trigger `defaultValue` 파라미터가 실행에서 무시되던 버그 수정")도 항목으로 등재되어 있어, 일관성 차원에서 CHANGELOG 엔트리 추가를 고려할 만하다.
  - 제안: 필요 시 CHANGELOG.md 에 "AI 멀티턴 대화 resume 턴에서 cafe24/makeshop/mcp 사용 로그가 누락되던 버그 수정" 항목을 짧게 추가. spec 변경이 없으므로 "SoT: spec/2-navigation/4-integration.md §4.6" 형태로 참조만 남기면 됨. 필수는 아님(팀 컨벤션상 순수 내부 버그 수정은 생략 가능).

- **[INFO]** `ReentryStateDriver.buildRetryReentryState` 인터페이스 JSDoc 이 신규 `opts.nodeExecutionId` 파라미터 의도를 설명하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:1396-1411` (`ReentryStateDriver` 인터페이스)
  - 상세: `opts?: { resumeMode?: boolean; nodeExecutionId?: string }` 로 시그니처는 갱신됐지만, 인터페이스 docstring("AI resume(§7.5) ↔ retry-last-turn 재진입이 공유하는 `_resumeState` 재구성기...")은 `nodeExecutionId` 가 왜 필요한지(§4.6 활동 탭 attribution 목적) 언급하지 않는다. 구현체(`execution-engine.service.ts`)와 두 호출부(`ai-turn-orchestrator.service.ts`, `retry-turn.service.ts`)에는 각각 상세한 인라인 주석이 있어 실질적으로 정보가 유실되지는 않지만, `ENGINE_DRIVER` 토큰 계약만 보고 판단해야 하는 신규 소비자 입장에서는 인터페이스 docstring만으로는 이 필드의 목적을 알 수 없다. (참고로 기존 `resumeMode` 필드도 동일하게 개별 설명이 없어 기존 패턴과 일관되긴 하다.)
  - 제안: 여유가 있다면 `@param opts.nodeExecutionId` 한 줄 정도를 인터페이스 docstring 에 추가해 "resume-state 재구성 시 usage-log attribution 용으로 재주입" 이라는 의도를 명시. Blocking 아님.

- **[INFO]** plan 문서의 파일:라인 참조는 향후 stale 될 수 있음
  - 위치: `plan/in-progress/fix-resume-turn-usage-log-attribution.md` (root cause 섹션, `ai-turn-executor.ts:2684-2685`, `cafe24-mcp-tool-provider.ts:500`, `execution-engine.service.ts:4845` 등)
  - 상세: root cause 서술에 구체적 파일:라인 번호를 인용했다. 문제 진단 시점 스냅샷으로는 유용하지만, 코드가 진화하면 (특히 이 plan 이 `plan/complete/` 로 이관된 뒤) 라인 번호가 실제 위치와 어긋날 수 있다. 다만 이는 `plan/` 문서의 일반적 관행(역사적 스냅샷)이며 SoT 는 스펙 문서이므로 심각한 문제는 아니다.
  - 제안: 별도 조치 불필요. 향후 유사 plan 작성 시 파일명만으로 충분한 경우 라인 번호는 생략하는 것도 고려 가능.

## 관찰 — 긍정적 사항 (참고)

- `#501` 태그가 5개 코드 위치(ai-turn-orchestrator.service.ts, retry-turn.service.ts, execution-engine.service.ts, resume-state.schema.ts ×2)에 일관되게 붙어 회귀 추적이 쉽다.
- resume 경로(`handleAiResumeTurn`)와 retry 경로(`applyRetryLastTurn`) 양쪽 호출부의 주석이 "대기 NodeExecution" vs "spawn 된 RUNNING NodeExecution" 으로 대칭적으로 정확히 구분되어 있어 두 경로의 차이를 정확히 설명한다.
- `execution-engine.service.ts` 의 `buildRetryReentryState` 인라인 주석이 root cause(왜 필드가 빠지면 안 되는지, 어느 게이트가 실패하는지, `§4.6 활동 탭` 스펙 섹션과의 연결)를 매우 명확하게 서술한다 — 실제로 `spec/2-navigation/4-integration.md §4.6`(Recent activity 탭)·§9.3(`integration_usage_log.node_execution_id`) 존재를 확인해 인용이 정확함을 검증했다.
- `resume-state.schema.ts` 의 `nodeExecutionId` 필드 주석("persist 금지" + "재개 시 재유도")과 `CREDENTIAL_CONTEXT_FIELDS` 배열 갱신이 짝을 이뤄 allow-list drift 방지 취지가 코드 차원에서 자기 일관적이다.
- 신규 회귀 테스트(`execution-engine.service.spec.ts`, "buildRetryReentryState re-injects workflowId (execution) + nodeExecutionId (opts)...")의 주석이 실패 시나리오(cafe24/makeshop/mcp logUsage 게이트)를 정확히 재서술해 테스트 의도가 코드만 봐도 이해된다.
- `plan/in-progress/fix-resume-turn-usage-log-attribution.md` 가 root cause·회귀 커밋(#501/`5e0c5e449`)·수정 파일별 체크리스트·부수 발견(선행 결함 `service`→`svcMetrics`)까지 프로젝트 관행(plan-lifecycle)에 맞게 잘 기록되어 있다.
- 인터페이스 표면 분리(`CoreEngineDriver`/`InteractionEngineDriver`/`ReentryStateDriver`/`AiTurnEngineDriver`/`RetryEngineDriver`)에 대한 상위 docstring 이 ISP 설계 의도를 잘 설명하고 있어, 이번 opts 필드 확장이 그 설계를 침해하지 않음을 확인할 수 있었다.

## 요약

이번 변경은 매우 좁은 범위(5개 소스 파일 + 1개 신규 plan 문서)의 회귀 버그 수정이며, 문서화 품질이 전반적으로 높다. 모든 변경 지점에 `#501` 태그가 달린 일관된 인라인 주석이 있고, 근본 원인·영향(스펙 §4.6 활동 탭)·수정 방식이 정확히 서술되어 있으며 스펙 인용도 실제 문서 내용과 부합함을 확인했다. `plan/in-progress/*.md` 도 프로젝트 컨벤션에 맞게 root cause와 체크리스트를 담고 있다. 발견된 사항은 모두 INFO 수준— CHANGELOG.md 갱신 여부(선택적, 일관성 참고용), 인터페이스 docstring 의 신규 파라미터 설명 누락(구현부·호출부 주석으로 사실상 상쇄됨), plan 문서의 라인번호 참조의 잠재적 staleness뿐이며 어느 것도 병합을 막을 사유는 아니다.

## 위험도

LOW
