# 변경 범위(Scope) Review

## 발견사항

- **[CRITICAL]** diff 가 무관한 두 개 완결 작업(EIA §R17 secret masking 하드닝 / error-codes-catalog-sot)을 통째로 되돌린다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts`, `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`, `codebase/backend/src/shared/utils/sanitize-error-message.ts`(+spec), `codebase/backend/test/external-interaction.e2e-spec.ts`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/3-error-handling.md`, `plan/complete/eia-secret-masking-residuals.md`(삭제), `plan/in-progress/error-codes-catalog-sot.md`(삭제)
  - 상세: 이번 세션의 의도(CHANGELOG 신규 항목·`plan/in-progress/ai-usage-attribution-hardening.md`)는 "AI Agent 자동 메모리 롤링 요약 압축 chat 의 `llm_usage_log` attribution 배선"(B1 타입 주석 + C1 메모리 압축 배선) 하나뿐이다. 그런데 diff 는 이와 전혀 무관한 아래 두 세트를 **제거**한다.
    1. `interaction.service.ts` — `getStatus` 의 terminal `result`(COMPLETED)/`error`(FAILED) 에 적용되던 `deepRedactSecrets` 마스킹을 제거하고 `execution.outputData` 를 다시 무가공 노출로 되돌린다. `interaction.service.spec.ts` 의 대응 unit test, `external-interaction.e2e-spec.ts` 의 e2e `I`/`J`(secret 마스킹 wire 검증) 도 함께 삭제된다. 이는 **보안 마스킹 기능 자체를 되돌리는 회귀**다.
    2. `sanitize-error-message.ts` — `deepRedactSecrets` 의 `DEEP_REDACT_CACHE`(WeakMap depth-0 캐시)와 `deepRedactObject` 분리 리팩터를 제거하고 인라인 버전으로 되돌린다. 대응 unit test 도 삭제.
    3. `spec/5-system/14-external-interaction-api.md` §R17 — terminal `result`/`error` 마스킹 서술을 제거.
    4. `spec/5-system/3-error-handling.md` — WebAuthn/2FA(§1.2.1)·KB/Graph RAG(§1.8) 도메인 에러코드 카탈로그 등재 섹션 전체와 Overview/Rationale 상응 문구를 제거.
    5. `plan/complete/eia-secret-masking-residuals.md`(완료 plan) 및 `plan/in-progress/error-codes-catalog-sot.md`(진행 plan) 파일 자체를 삭제.
  - `review/consistency/2026/07/10/08_34_08/_retry_state.json` 내부 절대경로가 `.../worktrees/conversation-thread-secret-hardening-6477bb/...` 를 가리키는 것으로 볼 때, 이 삭제되는 파일들은 **다른 worktree/브랜치("conversation-thread-secret-hardening-6477bb")에서 이미 완료·리뷰까지 끝낸 별개 작업**이다. 즉 이번 PR 이 의도적으로 작성한 내용이 아니라, 이 worktree/브랜치가 그 작업이 origin/main 에 머지되기 **이전 시점**에서 분기된 채 rebase 되지 않아, "PR diff = 최신 main 대비 부족분"이 삭제로 나타나는 stale-base 증상으로 보인다(`MEMORY: ensure-worktree stale base` 사례와 동일 패턴).
  - 영향: 이 상태 그대로 PR 을 올리면 **이미 머지·완료된 보안 하드닝 PR(EIA secret masking)과 spec 카탈로그 완결성 PR(error-codes-catalog-sot)을 silent revert** 하게 된다. 특히 secret 마스킹 제거는 보안 회귀로 이어질 수 있어 리스크가 매우 크다.
  - 제안: PR 생성 전 `git fetch && git rebase origin/main`(또는 동등한 최신화)으로 base 를 갱신하고, 재차 `git diff origin/main...HEAD` 로 diff 를 확인해 위 무관 파일들이 diff 에서 완전히 사라지는지 검증한다. rebase 후 diff 에는 아래 "의도된 변경" 목록만 남아야 한다.

- **[CRITICAL]** `spec/` 쓰기 — 프로젝트 규약(`developer` 는 `spec/` read-only) 위반 형태로 diff 에 포함
  - 위치: `spec/5-system/14-external-interaction-api.md`, `spec/5-system/3-error-handling.md`
  - 상세: 위 CRITICAL 항목과 동일 원인(stale base)이지만, 별도로 짚을 필요가 있다. `CLAUDE.md` 규약상 `developer` 역할은 `spec/` 을 read-only 로 다뤄야 하는데 diff 에 두 spec 파일의 실질 되돌림(§1.2.1·§1.8 섹션 삭제, §R17 문구 삭제)이 포함돼 있다. rebase 로 stale-base 를 해소하면 자연히 사라질 항목이지만, 만약 이것이 stale-base 가 아니라 실제 로컬 커밋이라면 규약 위반이므로 반드시 원인을 먼저 확인해야 한다.

- **[WARNING]** review 산출물(다른 세션분) 대량 삭제가 diff 에 포함
  - 위치: `review/code/2026/07/10/08_13_00/*`(RESOLUTION.md·SUMMARY.md·security-reviewer.md·side-effect-reviewer.md·testing-reviewer.md), `review/code/2026/07/10/08_56_55/*`, `review/consistency/2026/07/10/08_34_08/*`, `review/consistency/2026/07/10/08_45_21/*`
  - 상세: 위 CRITICAL 항목(stale-base)과 동일 원인으로 추정되나, 별도 리스크로 기록한다. 이 파일들은 "EIA §R17 잔여 하드닝" 리뷰의 산출물(SUMMARY/RESOLUTION/reviewer 보고서)로, 현재 작업(AI usage attribution hardening)과 무관한 다른 세션의 리뷰 기록이다. 삭제가 그대로 반영되면 해당 작업의 리뷰 이력이 사라진다.
  - 제안: 위 rebase 로 해소되는지 확인. 해소 안 되면 별도 원인(예: `review/**` 디렉토리 오조작) 조사 필요.

- **[INFO]** 의도된 변경 자체는 범위가 잘 통제되어 있음
  - 위치: `CHANGELOG.md`, `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts`, `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`, `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`, `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts`, `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`, `plan/in-progress/ai-usage-attribution-hardening.md`(신규), `plan/in-progress/resume-llm-usage-attribution.md`(체크리스트 갱신)
  - 상세: 이 9개 파일만 놓고 보면 스코프 준수가 우수하다. `ai-turn-executor.ts` 의 `LlmService, LlmCallContext` import 추가 및 `const llmContext: LlmCallContext = {...}` 명시 타입 주석은 plan 의 B1 항목과 정확히 일치하고, `ai-memory-manager.ts`/`agent-memory-injection.ts` 의 `llmContext?`/`workflowId?`/`nodeExecutionId?` 필드 추가와 caller 배선은 C1 항목과 일치한다. 주석은 모두 `[Spec 7-llm-usage §1.3]` 태그로 근거를 명시하고 있고 포매팅·불필요 리팩터·미사용 import 등은 관찰되지 않는다. `plan/in-progress/resume-llm-usage-attribution.md` 변경도 선행 plan 의 INFO 항목 처리 상태를 후속 plan 으로 cross-ref 하는 것으로, 관련성 있는 최소 수정이다.

## 요약

핵심 의도(AI Agent 자동 메모리 요약 압축 chat 의 `llm_usage_log` attribution 배선, B1+C1)에 해당하는 9개 파일 변경은 스코프가 매우 정확하고 불필요한 리팩터·포맷팅·주석 잡음이 없다. 그러나 diff 전체(39개 파일)에는 이와 전혀 무관한 다른 두 작업 — EIA §R17 secret masking 하드닝(보안 마스킹 로직·캐시·테스트·spec 서술)과 error-codes-catalog-sot(WebAuthn/2FA·KB 도메인 에러코드 spec 카탈로그) — 을 **삭제(revert)** 하는 변경이 섞여 있다. `review/consistency/.../_retry_state.json` 의 절대경로가 다른 worktree(`conversation-thread-secret-hardening-6477bb`)를 가리키는 것으로 볼 때 이는 이번 세션이 의도적으로 작성한 내용이 아니라, 이 브랜치가 그 두 작업이 origin/main 에 머지된 시점 **이전**에서 분기돼 rebase 되지 않은 stale-base 증상으로 강하게 추정된다. 이 상태로 PR 이 merge 되면 이미 완료·리뷰된 보안 하드닝 PR 과 spec 완결성 PR 을 silent revert 하게 되어 실질적 보안 회귀를 유발할 수 있다. PR 생성 전 반드시 `git fetch` + rebase 로 base 를 최신 origin/main 으로 갱신하고, diff 를 재확인해 무관 파일 전량이 사라지는지 검증해야 한다.

## 위험도

CRITICAL
