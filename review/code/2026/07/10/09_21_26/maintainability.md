# 유지보수성(Maintainability) Review

## 발견사항

- **[CRITICAL]** 리뷰 payload 의 diff 스코프가 stale base 로 오염 — 실제 변경(8파일)과 무관한 31개 파일이 "삭제/revert" 로 섞여 들어옴
  - 위치: 전체 `_prompts/maintainability.md` (39개 파일 중 31개), 특히 `codebase/backend/src/modules/external-interaction/interaction.service.ts`·`codebase/backend/src/shared/utils/sanitize-error-message.ts`·`codebase/backend/test/external-interaction.e2e-spec.ts`·`plan/complete/eia-secret-masking-residuals.md`·`plan/in-progress/error-codes-catalog-sot.md`·`spec/5-system/14-external-interaction-api.md`·`spec/5-system/3-error-handling.md` + `review/code/2026/07/10/{08_13_00,08_56_55}/**`·`review/consistency/2026/07/10/{08_34_08,08_45_21}/**` 전체
  - 상세: `git merge-base HEAD origin/main` = `c417bd299`, `git status` 는 "diverged, 2 and 2 commits". `origin/main` 은 이 branch 의 fork 지점 이후 `4086d84fa`(PR #881, EIA §R17 잔여 하드닝 — terminal outputData 마스킹 + `deepRedactSecrets` 캐시)와 `01e68001c`(PR #882, 에러코드 카탈로그 §1 완결)를 이미 머지했다. 이 두 PR 은 본 task(`ai-usage-attribution-hardening`)와 완전 무관한데, payload 의 diff 가 (아마도) two-dot `origin/main..HEAD` 방식으로 생성돼 "origin/main 에는 있지만 이 branch 에는 없는" 그 두 PR 의 전체 내용이 고스란히 "deleted"/"revert" 형태로 섞여 들어왔다. `git diff c417bd299...HEAD --stat`(three-dot, 진짜 이 branch 고유 변경)로 확인한 실제 스코프는 `CHANGELOG.md` + 5개 backend 소스/테스트 파일 + 2개 plan 파일, 총 8개뿐이다(plan 문서 자체도 "본 diff 는 backend 4파일 전용" 이라고 명시).
  - 영향: (1) 이 payload 로 리뷰가 진행되면 `deepRedactSecrets` 의 `DEEP_REDACT_CACHE` 제거·`getStatus` terminal `result`/`error` 마스킹 제거·관련 unit/e2e 테스트 삭제가 **이번 PR 이 실제로 저지른 회귀**인 것처럼 보고돼, 다른 관점(특히 security) 리뷰어가 이미 머지된 보안 하드닝을 롤백하는 코드로 오판할 위험이 크다. (2) 리뷰 신호 대 잡음비가 극단적으로 나빠져 진짜 변경(8파일)에 대한 리뷰 집중도가 떨어진다.
  - 제안: 리뷰용 diff 를 생성하는 orchestrator 스텝을 `git diff $(git merge-base origin/main HEAD)...HEAD` (three-dot, merge-base 기준) 로 교정하거나, 리뷰 전에 branch 를 최신 `origin/main` 으로 rebase 한 뒤 diff 를 재생성해야 한다. 아래 나머지 발견사항은 진짜 스코프인 8개 파일(`CHANGELOG.md`, `ai-agent.memory.spec.ts`, `ai-memory-manager.ts`, `ai-turn-executor.ts`, `agent-memory-injection.spec.ts`, `agent-memory-injection.ts`, `plan/in-progress/ai-usage-attribution-hardening.md`, `plan/in-progress/resume-llm-usage-attribution.md`)만을 대상으로 별도 확인했다.

- **[WARNING]** `AiMemoryManager.injectMemoryContext` 의 inline args 객체가 계속 커지는 "big parameter object" — attribution 필드 2개 추가로 더 악화
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:99-134` (`injectMemoryContext` 시그니처), 호출부 `ai-turn-executor.ts:1149-1167`·`2274-2299`
  - 상세: `injectMemoryContext` 의 인자는 named interface 가 아니라 인라인 object literal type 으로 이미 13개 필드(strategy/target/selfNodeId/config/messages/finalSystemPrompt/llmConfig/model/summaryModelConfigId/workspaceId/executionId/queryText/tailMode)였고, 이번 diff 가 `workflowId?`/`nodeExecutionId?` 2개를 더 추가해 15개가 됐다. 반면 이 값들이 최종적으로 도달하는 목적지(`buildSummaryBufferUpdate` 의 `llmContext?: LlmCallContext`)는 이미 `{ workflowId, executionId, nodeExecutionId }` 3필드를 묶은 named type 을 갖고 있다 — `injectMemoryContext` 쪽만 그 구조를 따르지 않고 top-level loose 필드로 흩어 놓았다.
  - 제안: `injectMemoryContext` 인자에 `llmContext?: LlmCallContext` 하나만 받도록(또는 최소한 `executionId`/`workflowId`/`nodeExecutionId` 를 하나의 named sub-object 로) 정리하면, 호출부가 3개 필드를 매번 개별 나열할 필요 없이 이미 갖고 있는 `LlmCallContext` 모양을 그대로 전달할 수 있고, 향후 필드 추가 시 시그니처가 계속 옆으로 늘어나는 걸 막는다. 이번 diff 범위에서 강제할 정도는 아니라 WARNING.

- **[INFO]** `{ workflowId, executionId, nodeExecutionId }` 를 `state`/`context` 에서 뽑아 만드는 리터럴이 3곳에 중복 — 이번 PR 이 고친 "필드 오탈자" 버그 클래스를 다시 만들 여지
  - 위치: `ai-turn-executor.ts:1162-1164`(single-turn, `context.*`), `ai-turn-executor.ts:2295-2296`(resume `injectMemoryContext` 호출, `state.*`), `ai-turn-executor.ts:2608-2612`(resume 메인 chat `llmContext`, `state.*` — 명시 `LlmCallContext` 타입 주석 존재)
  - 상세: 세 곳 모두 `workflowId: state.workflowId as string | undefined` / `nodeExecutionId: state.nodeExecutionId as string | undefined` 형태의 거의 동일한 3-필드 리터럴을 손으로 반복 작성한다. 이번 PR 의 핵심 fix(Critical#1)가 바로 "필드명을 잘못 짚어 attribution 이 NULL 로 새는" 클래스의 버그였는데, 이 패턴이 여전히 call-site 마다 손으로 복붙되는 구조라 다음 소비 사이트가 추가될 때 동일 클래스 오탈자가 재발할 여지가 남아있다. `ai-turn-executor.ts:2608` 한 곳만 명시 `LlmCallContext` 타입 주석(B1)을 달아 그 지점의 재발은 컴파일 타임에 막았지만, `injectMemoryContext` 호출부 2곳(1162, 2295)은 여전히 암묵적 구조 매칭(inline object literal, 타입 추론)에 의존한다.
  - 제안(선택): `state`(또는 `context`) 에서 `{ workflowId, executionId, nodeExecutionId }: LlmCallContext` 를 뽑아내는 작은 헬퍼(예: `pickLlmContext(source: Record<string, unknown>): LlmCallContext`)를 두면 3곳의 중복을 제거하고 상기 WARNING(injectMemoryContext 인자 정리)과도 자연스럽게 맞물린다. 우선순위 낮음 — 현재는 회귀 테스트(신규 `ai-agent.memory.spec.ts` 케이스)로 방어돼 있음.

- **[INFO]** 코드 주석이 휘발성 리뷰 아티팩트 식별자("ai-review Critical#1", "INFO#1")를 직접 인용 — 기존 컨벤션과는 일관되나 장기 가독성엔 약점
  - 위치: `ai-memory-manager.ts:117-122`, `agent-memory-injection.ts:283-287`, `ai-turn-executor.ts:2606-2607`, `ai-agent.memory.spec.ts:513-515`
  - 상세: 예) "명시 타입 주석 — 필드 오탈자를 TS excess-property check 로 컴파일 타임에 차단 (attribution 필드 오사입 회귀 방지, ai-review INFO#1)." 이런 리뷰-라운드 식별자(`Critical#1`, `INFO#1`)는 해당 리뷰 세션 문서(`review/code/...`)가 살아있는 동안만 의미가 있고, 그 문서가 나중에 archive/정리되면 미래 독자에게는 "무엇의 몇 번" 인지 추적 불가능한 opaque 참조가 된다. 다만 이 프로젝트는 이미 유사 패턴(`C-1 follow-up ③ / dev 1b` 등, `ai-turn-executor.ts:2597`)을 광범위하게 써왔으므로 이번 diff 가 새로 도입한 스타일은 아니고 기존 컨벤션과 일관적이다.
  - 제안(선택): 리뷰 라운드 번호보다 "무엇을(어떤 회귀를) 방지하는지"를 주석의 1차 정보로 두고 리뷰 식별자는 괄호 안 부가정보로만 남기는 것으로 이미 충분히 실천되고 있음 — 추가 조치 불요, 참고 기록.

## 요약

payload 로 전달된 diff 는 진짜 변경 8개 파일 대비 30여 개의 무관한 파일(이미 머지된 EIA §R17 하드닝 PR #881·에러코드 카탈로그 PR #882 의 되돌림처럼 보이는 삭제)이 섞여 있는데, 이는 branch 가 fork 이후 진행된 origin/main 커밋들을 반영하지 못한 stale base 상태에서 two-dot diff 를 생성했기 때문으로 판단된다(merge-base 기준 three-dot diff 로 검증). 이 오염은 리뷰 신뢰성에 CRITICAL 하므로 diff 재생성/rebase 후 재리뷰를 권고한다. 실제 스코프인 `llm_usage_log` attribution 배선 8개 파일 자체는 코드 품질이 양호하다 — single-turn(`context.*`)과 multi-turn resume(`state.*`) 경로를 대칭적으로 다루고, 스펙 근거(§1.3)를 명시한 한국어 doc 주석이 충실하며, 이전 리뷰가 지적한 "필드 오탈자로 NULL 적재" 버그 클래스를 명시 타입 주석(`LlmCallContext`)과 회귀 테스트로 방어했다. 다만 `injectMemoryContext` 의 인자 객체가 이번 변경으로 15필드까지 늘어난 점과, 동일한 3-필드(workflowId/executionId/nodeExecutionId) 추출 리터럴이 3개 call-site 에 중복된 점은 향후 동일 버그 클래스 재발을 완전히는 막지 못하는 구조적 잔여 리스크로, 다음 변경 때 소규모 리팩터(named sub-type 전달, 추출 헬퍼)를 권장한다.

## 위험도

CRITICAL
