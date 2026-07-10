# 아키텍처(Architecture) Review — ai-usage-attribution-hardening-358929

리뷰 대상: `_prompts/architecture.md` (39개 변경 파일 diff, 브랜치 `claude/ai-usage-attribution-hardening-358929`)

## 발견사항

- **[CRITICAL]** diff payload 가 이미 origin/main 에 머지된 두 개의 무관한 PR(#881 EIA §R17 terminal outputData 마스킹, #882 에러코드 카탈로그 §1 완결)을 "삭제"로 되돌리는 형태로 포함되어 있다 — stale branch base
  - 위치: 파일 3(`interaction.service.ts` — `deepRedactSecrets` 적용 제거), 파일 9~11(`sanitize-error-message.ts`/spec — `DEEP_REDACT_CACHE` 제거 + 관련 unit/e2e 삭제), 파일 12(`plan/complete/eia-secret-masking-residuals.md` 삭제), 파일 14(`plan/in-progress/error-codes-catalog-sot.md` 삭제), 파일 38~39(`spec/5-system/14-external-interaction-api.md` §R17 축소, `spec/5-system/3-error-handling.md` §1.2.1/§1.8 도메인 카탈로그 삭제), 파일 16~37(선행 리뷰 세션 `review/code/2026/07/10/08_13_00`·`08_56_55`, `review/consistency/2026/07/10/08_34_08`·`08_45_21` 산출물 전체 삭제).
  - 상세: `git status -sb` 확인 결과 현재 브랜치는 `origin/main` 대비 `ahead 2, behind 2`이며 merge-base 는 `c417bd299`(#880)다. `origin/main` 은 그 뒤 `4086d84fa`(#881, EIA §R17 잔여 하드닝)·`01e68001c`(#882, 에러코드 카탈로그 §1 완결)를 이미 머지했다. 본 브랜치는 이 두 커밋을 rebase 로 흡수하지 않은 상태에서 diff 가 산출돼, "genuine 증분"(파일 1·4~8·13·15, AI Agent 메모리 압축 attribution 배선) 과 "브랜치가 아직 못 따라잡은 origin/main 전용 커밋의 역방향 diff"가 한 changeset 에 뒤섞여 있다. 이 상태로 머지되면 이미 승인·머지된 보안 하드닝(terminal `result`/`error` outputData secret 마스킹, `deepRedactSecrets` depth-0 캐시)과 spec 카탈로그 완결 작업이 **조용히 revert** 된다 — 프레젠테이션 레이어 경계(EIA REST 공개 표면)의 보안 책임을 되돌리는 구조적으로 심각한 결과다. 또한 changeset 경계 관점에서도 "AI usage attribution 배선"이라는 단일 관심사여야 할 diff 가 최소 3개의 무관한 concern(attribution 배선/EIA 마스킹 되돌림/에러코드 카탈로그 되돌림)을 한데 묶고 있어 리뷰·롤백 단위가 깨진다.
  - 제안: 머지/추가 리뷰 전에 `git fetch origin && git rebase origin/main` 으로 브랜치를 최신 main 위로 재배치하고, genuine 변경(파일 1·4~8·13·15 및 대응 spec-drift 항목)만 남는지 재확인 후 diff 를 재생성해 리뷰를 다시 스코프해야 한다. plan 파일(`plan/in-progress/ai-usage-attribution-hardening.md`)의 "본 diff 는 backend 4파일 전용" 서술과도 정면으로 어긋나므로, 실제 diff 스코프를 그 서술과 일치시키는 것이 우선이다.

- **[WARNING]** `AiMemoryManager.injectMemoryContext` 와 `buildSummaryBufferUpdate` 사이의 attribution 파라미터 형태 불일치 — 동일 개념이 인접 레이어에서 flat → nested 로 재조립됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:113-124`(신규 flat 필드 `workflowId?`/`nodeExecutionId?` 선언, 기존 `executionId: string` 과 병렬), `ai-memory-manager.ts:247-254`(`llmContext: { workflowId: args.workflowId, executionId: args.executionId || undefined, nodeExecutionId: args.nodeExecutionId }` 로 재조립해 `buildSummaryBufferUpdate` 에 전달), 대비 `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:279-284`(`BuildSummaryBufferArgs.llmContext?: LlmCallContext` — 이미 공용 타입을 그대로 필드 하나로 받음).
  - 상세: `LlmCallContext`(`modules/llm/llm.service.ts:41`)는 `workflowId`/`executionId`/`nodeExecutionId` 3필드를 묶은 공용 추상화다. `buildSummaryBufferUpdate` 는 이 추상화를 그대로 파라미터로 받아 caller 부담을 최소화하는데, 바로 위 caller 인 `injectMemoryContext` 는 그 3필드를 다시 개별 flat argument(+ 기존 목적이 다른 `executionId: string`)로 받아온 뒤, 내부에서 손으로 다시 `LlmCallContext` 리터럴을 조립해 전달한다. 이 "펼쳤다 다시 묶는" 왕복은 동일한 3필드 매핑을 두 곳(caller의 `injectMemoryContext` 호출부 3곳 + `injectMemoryContext` 내부의 재조립)에서 각각 손으로 나열하게 만들어, 이번 PR 이 고친 Critical#1(단일 필드 누락으로 NULL 적재)과 동일한 클래스의 회귀를 다시 유발할 표면을 넓힌다.
  - 제안: `injectMemoryContext` 의 시그니처를 `workflowId?`/`nodeExecutionId?` 개별 필드 대신 `llmContext?: LlmCallContext` 하나로 받도록 바꾸고(기존 `executionId: string` 은 attribution 외 다른 용도로도 쓰이므로 그대로 유지), 내부에서는 재조립 없이 `args.llmContext` 를 `buildSummaryBufferUpdate` 에 그대로 전달하도록 정리하면 두 레이어의 인터페이스 형태가 일치하고 3필드 열거가 한 곳으로 줄어든다.

- **[INFO]** attribution 소스 선택(`context.*` vs `state.*`) 로직이 `ai-turn-executor.ts` 3개 콜사이트에 반복 — 기존 패턴과 일관되나 향후 4번째 콜사이트 추가 시 회귀 위험 존재
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1162-1164`(single-turn, `context.*`), `:2293-2296`(multi-turn resume 메모리 압축, `state.*`), `:2606-2612`(multi-turn resume 메인 chat, 기존 `state.*`, 이번에 명시 타입만 추가).
  - 상세: single-turn 은 엔진이 노드 실행 직전 주입하는 `context.*` 를, multi-turn resume 은 `buildRetryReentryState` 로 재구성된 `state.*` 를 쓰는 비대칭 자체는 실행 모델의 구조적 차이(첫 실행 vs 재개)를 반영한 정당한 설계이고, 이번 diff 이전부터 메인 chat 콜사이트가 이미 이 패턴을 쓰고 있었다(대칭성 확보가 이번 변경의 목적). 다만 동일한 "모드에 따라 context 또는 state 에서 3필드를 뽑는다"는 로직이 손으로 3곳에 나열돼 있어, 이번 PR 자체가 고친 결함(단일 콜사이트 누락)이 향후 4번째 콜사이트에서 재발할 잠재 표면이 남는다.
  - 제안(저우선순위, 회귀 테스트로 이미 상당 부분 완화됨): `resolveLlmCallContext(mode, context, state)` 류의 작은 공용 헬퍼로 추출하면 신규 콜사이트 추가 시 자동으로 대칭이 보장된다. 현재는 콜사이트가 3곳뿐이고 각각 회귀 테스트(파일 4·7)로 고정돼 있어 즉시 조치는 불필요.

- **[INFO]** `BuildSummaryBufferArgs.llmContext` 를 optional 필드로 추가한 확장 방식은 개방-폐쇄 원칙을 잘 지킴
  - 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:279-284`, `:309-394`.
  - 상세: 기존 `buildSummaryBufferUpdate` 호출부를 깨지 않고 `llmContext?: LlmCallContext` 를 선택적으로만 추가했고, `llmService.chat(config, params, llmContext)` 의 3번째 인자도 `undefined` 시 하위호환 동작(파일 7 신규 테스트가 `llm.chat.mock.calls[0][2]` 가 `undefined` 임을 명시적으로 고정)을 명확히 검증한다. 노드 발 chat 이라는 개념 확장이 기존 계약을 변경하지 않고 이뤄진 좋은 사례다.

- **[INFO]** 레이어 의존 방향 일관성 확인 — 순환 의존 없음
  - 위치: `ai-memory-manager.ts`/`ai-turn-executor.ts`/`agent-memory-injection.ts`(nodes/ai, 오케스트레이션 레이어) → `modules/llm/llm.service.ts`(`LlmCallContext`/`LlmService`, 인프라 레이어)로만 import 가 이뤄진다.
  - 상세: `modules/llm` 쪽에서 `nodes/ai/*` 를 역참조하지 않으며, 이번 변경은 기존에 이미 확립된 단방향 의존을 그대로 확장한다(신규 의존 엣지 없음). `ai-turn-executor.ts` 의 `import { LlmService, LlmCallContext } from '../../../modules/llm/llm.service'` 추가도 named type import 로 순수 타입 계약만 가져오는 형태라 결합도 증가가 최소화돼 있다.

## 요약

핵심 기능 diff(AI Agent 자동 메모리 롤링 요약 압축 chat 의 `llm_usage_log` attribution 배선, 파일 1·4~8·13·15)는 SOLID·레이어링 관점에서 양호하다 — 기존 `LlmCallContext` 추상화를 재사용해 의존성 역전을 지켰고(모듈 경계 재확인, 순환 의존 없음), optional 필드 확장으로 개방-폐쇄 원칙을 지키며 하위호환 테스트로 고정했고, config 파생이라는 취약한 암묵적 결합을 명시적 파라미터 전달로 교정한 것은 리스코프/명시적 계약 관점에서 개선이다. `AiMemoryManager.injectMemoryContext` 와 `buildSummaryBufferUpdate` 사이에 동일한 attribution 개념이 flat/nested 두 형태로 반복 조립되는 인터페이스 불일치, 그리고 context/state 선택 로직이 3개 콜사이트에 손으로 반복되는 점은 이번 PR 이 고친 결함 클래스가 재발할 여지를 남기므로 경미하지만 실질적인 개선 여지다. 그러나 이 모든 것과 별개로, **전체 diff payload 자체는 신뢰할 수 없는 상태다** — 브랜치가 origin/main 에서 2커밋 뒤처져(`ahead 2, behind 2`) 이미 머지된 EIA §R17 secret 마스킹 하드닝(#881)과 에러코드 카탈로그 완결(#882)이 diff 상 "삭제"로 나타나며, 이는 changeset 경계가 무관한 concern 3개(attribution 배선/보안 마스킹 되돌림/spec 카탈로그 되돌림)로 뒤섞여 있음을 뜻한다. rebase 없이 이 상태로 머지하면 이미 승인된 보안 계층을 되돌리는 결과가 되므로, 아키텍처적으로 이 이슈가 전체 위험도를 좌우한다.

## 위험도

CRITICAL
