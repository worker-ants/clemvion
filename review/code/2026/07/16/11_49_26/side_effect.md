# 부작용(Side Effect) Review — 항목 B: AI Agent LLM chat 호출 app-level 타임아웃 배선

> 검토 방법: `git diff origin/main HEAD` 로 실제 변경분만 확인 (review/** 문서·item A 파일은 배경 확인용으로만 참조). 특히 `llm-call-timeout.ts`(신규), `ai-turn-executor.ts`(4개 chat 호출 opts 배선 + 캐스트 복원), `node-handler.interface.ts`(`ResumableMessageOptions.signal?`)에 집중. 실제 타임아웃이 배선되는 `LlmService.chat`(`modules/llm/llm.service.ts`)과 `withTimeout`(`modules/llm/utils/with-timeout.util.ts`)도 이번 diff 밖이지만 새 동작을 이해하는 데 load-bearing 이라 함께 열람했다.

## 발견사항

- **[WARNING]** 신규 app-level 타임아웃 기본값(600000ms)이 기존 무제한 대기 동작을 대체하는 실질적 behavior change
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.ts` (`aiAgentLlmCallTimeoutMs`, default `600000`), 적용 지점 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1685-1689`(single-turn 첫 호출)·`:1816-1821`(single-turn tool-loop)·`:2773-2779`(resume 첫 호출)·`:2919-2923`(resume tool-loop)
  - 상세: diff 이전에는 이 4개 `llmService.chat(...)` 호출 모두 `opts.timeoutMs` 를 전달하지 않았다(`{ signal: context.abortSignal }` 만). `LlmService.chat`(`modules/llm/llm.service.ts:172-180`)은 `opts?.timeoutMs && opts.timeoutMs > 0` 일 때만 `withTimeout` 을 적용하므로, 이전에는 이 4곳 모두 앱 레벨 타임아웃이 전혀 없었다(provider SDK 자체 타임아웃에만 의존). 본 diff 는 이 4곳 모두에 `aiAgentLlmCallTimeoutMs()` 를 기본 600000ms(env 미설정 시)로 무조건 배선한다 — 즉 기존에 "정상적으로 10분을 넘겨 완료되던" 호출(대형 output·extended thinking·provider 큐잉 지연 등)이 있었다면 이제는 explicit timeout error 로 실패하는 새 실패 모드가 production 트래픽에 즉시 적용된다. spec §12.16·CHANGELOG 가 "정상 turn 은 10분을 넘기 어렵다"는 근거로 이를 의도적 설계로 명시하고는 있으나, 실측 근거(자사 트래픽의 p99 turn duration) 없이 "provider SDK 기본값과 정합"이라는 정성적 근거만으로 즉시 default-on 되는 점은 배포 후 관측이 필요하다.
  - 추가 결합 리스크: `executeSingleTurn` 의 두 chat 호출은 try/catch 로 감싸여 있지 않다(기존에 다른 리뷰 라운드에서 이미 P0/CRITICAL 로 추적 중인 별도 gap, `plan/in-progress/node-output-redesign/ai-agent.md`). 따라서 single-turn 모드에서 타임아웃이 발화하면 `port:"error"` 계약이 아니라 엔진 레벨 무분류 `FAILED` 로 그대로 전파된다 — 이번 diff 가 이 gap 을 만들지는 않았지만(spec §12.16 도 "신규로 만들지도 해소하지도 않는다"고 명시), 이 diff 로 인해 "이전에는 발생하지 않던" 타임아웃 이벤트가 이 미해소 라우팅 gap 을 실제로 트리거하는 빈도가 0→양수로 바뀐다는 점은 side-effect 관점에서 주목할 가치가 있다.
  - 확인된 안전장치: `LlmService.withRetry` 는 rate-limit 메시지만 재시도하므로(`isLlmRateLimit`) 타임아웃 에러("Request timed out after Nms")는 내부 재시도를 유발하지 않는다 — retry storm(타임아웃 반복으로 실질 대기시간이 N배로 늘어나는 것) 위험은 없음을 코드로 확인했다.
  - 제안: 기본값을 즉시 강제 적용하기보다, 최초 릴리즈는 로그/메트릭만 남기고(soft rollout) 실제 p99 duration 분포를 관측한 뒤 강제하거나, 최소한 배포 노트에 "장시간 정상 생성 workflow 운영자는 `AI_AGENT_LLM_CALL_TIMEOUT_MS` 조정 필요할 수 있음"을 명시적으로 안내할 것을 권장.

- **[WARNING]** `withTimeout` 이 생성하는 `AbortController.signal` 이 실제 HTTP 호출에 배선되지 않아 "타임아웃 시 소켓 취소"가 실질적으로 동작하지 않음 (diff 밖 파일이지만 이 diff 가 최초로 활성화)
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:172-180` (`chat()` 내부 `run` 클로저), `codebase/backend/src/modules/llm/utils/with-timeout.util.ts` — 둘 다 이번 diff 의 변경 파일 목록에는 없음(마지막 수정 커밋 #720/#714, 이번 PR 무관)이지만, 이번 diff 의 4개 `ai-turn-executor.ts` 호출 지점이 **처음으로** `opts.timeoutMs > 0` 을 참으로 만들어 이 코드 경로를 실제로 활성화시킨다(이전에는 ai-agent chat 호출에서 이 분기가 항상 dead code 였다).
  - 상세: `withTimeout(run, ms)` 의 시그니처는 `run: (signal: AbortSignal) => Promise<T>` 이고, 내부에서 `new AbortController()` 를 만들어 `run(controller.signal)` 로 호출하며 타임아웃 시 `controller.abort()` 로 "내부 HTTP 요청을 취소해 소켓이 백그라운드에 남지 않도록" 한다고 JSDoc 에 명시돼 있다. 그러나 `LlmService.chat()` 의 호출부는 `withTimeout(() => client.chat(sanitized, opts?.signal), opts.timeoutMs)` 로, `withTimeout` 이 넘겨주는 `signal` 인자를 **받지도 사용하지도 않는** 0-인자 화살표 함수를 전달한다. `client.chat` 에는 오직 caller 가 넘긴 원본 `opts?.signal`(ai-agent 기준 `context.abortSignal` 또는 `options?.signal`, resume 경로는 대개 `undefined`)만 전달된다. 결과적으로 앱 레벨 타임아웃이 발화해 `controller.abort()` 가 호출돼도 실제 provider HTTP 요청은 그 abort 신호를 구독하고 있지 않으므로 취소되지 않고, `inner.catch(() => undefined)` 로 조용히 결과가 버려질 뿐 백그라운드에서 계속 실행된다 — provider 요청 quota/비용을 계속 소모하고 소켓을 예정보다 오래 점유한다. §12.16 spec 문구("`withTimeout`(자체 `AbortController`)이 race 로 throw")도 "cancel" 을 명시적으로 재주장하지 않아 spec 자체가 틀린 진술을 하는 건 아니지만, `with-timeout.util.ts` 의 JSDoc 이 약속하는 "소켓 미잔류" 보장은 ai-agent 의 신규 호출 경로에서 지켜지지 않는다.
  - (사용자 명시 cancel 은 별개로 정상 동작함을 확인: `context.abortSignal`/`options?.signal` 이 직접 `client.chat` 에 전달되므로, 노드 cancel 요청은 여전히 실제 HTTP 요청까지 전파된다. 깨져 있는 것은 "타임아웃이 스스로 만든" abort 경로뿐이다.)
  - 제안: `modules/llm/llm.service.ts` 의 `run` 클로저가 `withTimeout` 이 주입하는 `signal` 을 실제로 `client.chat` 에 전달하도록 수정(예: 원본 `opts?.signal` 과 `AbortSignal.any([...])` 로 병합하거나, `opts?.signal` 부재 시 주입된 signal 을 그대로 사용). 이 diff 범위 밖 파일이므로 즉시 수정이 이번 PR 의 의무는 아니지만, item B 의 "defense-in-depth" 목표(무기한 hang 백스톱)가 "호출자 관점의 타임아웃"만 달성하고 "provider 리소스 정리"는 달성하지 못한다는 점을 후속 이슈로 반드시 추적할 것을 권장.

- **[INFO]** `ResumableMessageOptions.signal?` 옵셔널 필드 추가 — `information_extractor` 구현체에 안전
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`ResumableMessageOptions`), 사용처 `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:856`
  - 상세: `optional` 필드 추가는 구조적 타이핑상 기존 구현체를 깨지 않는다. 실제로 `InformationExtractorHandler.processMultiTurnMessage` 는 파라미터를 `_options?: ResumableMessageOptions` 로 받아 명시적으로 미사용 처리하는 주석("information_extractor 는 render_form 을 발행하지 않으므로 source 신호를 사용하지 않는다")을 이미 갖고 있어, `signal` 필드를 읽지 않으므로 아무 영향이 없다. 유일한 실사용처(`ai-turn-orchestrator.service.ts:596` `handler.processMultiTurnMessage(message, resumeState, { source })`)도 `signal` 을 아직 채우지 않아(주석상 "resume 경로엔 abort 소스가 없음" 자체 인지) `options?.signal` 은 항상 `undefined` 로 유입 — 새 필드가 실질적 동작을 바꾸지 않는 순수 plumbing 준비 단계임을 코드로 확인했다.

- **[INFO]** 타임아웃 배선 스코프가 ai_agent 전용으로 격리됨 — 의도된 비대칭, 우발적 확산 아님
  - 위치: `nodes/ai/ai-agent/ai-turn-executor.ts` 만 신규 import(`llm-call-timeout`)를 추가. `nodes/ai/text-classifier/text-classifier.handler.ts`, `nodes/ai/information-extractor/information-extractor.handler.ts` 도 동일한 `LlmService.chat()` 을 호출하지만 이번 diff 에서 손대지 않아 여전히 앱 레벨 타임아웃이 없다.
  - 상세: spec §12.16 마지막 항목이 "다른 AI 노드로의 동일 defense-in-depth 확대는 후속"이라고 명시적으로 스코프를 한정해 두었으므로 우연한 누락이 아니라 의도된 범위다. side-effect 관점에서는 "예상 외 확산 없음"이 확인된 긍정적 포인트.

- **[INFO]** `errorPayload?.details` 캐스트 복원 — 순수 컴파일 타임 수정, 런타임 무영향
  - 위치: `ai-turn-executor.ts:3277-3290` 부근 `retryDetails` 캐스트 + `eslint-disable-next-line`
  - 상세: 타입 단언(`as`) 추가/제거는 런타임 동작에 영향이 없다. 이후 `retryDetails?.retryable === true` 로 옵셔널 체이닝을 사용하므로 `details` 가 예상 밖 shape 이어도 크래시하지 않는다. 다른 캐스트 제거(`result.toolCalls as ...`, `state as Record<string, unknown>`, `source.model as string | undefined`)도 동일하게 컴파일 타임 전용 변경이라 부작용 없음을 확인.

## 요약

핵심 변경(item B)은 AI Agent 의 4개 LLM `chat` 호출에 기본 600000ms 의 app-level 타임아웃을 새로 강제하는 behavior change 이며, 스코프(ai_agent 전용)·재시도 폭증 방지(rate-limit 메시지만 내부 재시도)·인터페이스 확장 안전성(`ResumableMessageOptions.signal?` 이 IE 에 무영향) 은 모두 코드로 직접 확인해 문제가 없음을 검증했다. 다만 두 가지 실질적 부작용을 발견했다: (1) 기존에 무제한 대기하던 정상 장기 호출이 이제 10분 뒤 명시적으로 실패하는 새 실패 모드가 즉시 default-on 되며, single-turn 은 이 실패가 `port:"error"` 계약이 아닌 엔진 FAILED 로 귀결되는 기존 미해소 gap 과 결합해 노출 빈도가 늘어난다(이미 spec/plan 에 disclosure 는 있음). (2) 더 근본적으로, 타임아웃이 실제로 provider 쪽 HTTP 요청을 취소하지 못하는 latent 버그(`LlmService.chat` 내부의 `withTimeout` 호출이 주입된 `AbortController.signal` 을 실제 client 호출에 전달하지 않음)가 이번 diff 가 처음으로 활성화하는 코드 경로에 존재해, "무기한 hang 을 막는다"는 defense-in-depth 목표 중 "provider 리소스 정리" 측면은 실제로 달성되지 않는다. 두 항목 모두 코드베이스를 즉시 깨뜨리는 CRITICAL 은 아니나(엔진 관점에서는 정상적으로 timeout error 가 throw 되어 흐름은 진행됨), 운영 비용·리소스 누수·관측되지 않은 regression 리스크가 있어 WARNING 으로 보고한다.

## 위험도

MEDIUM
