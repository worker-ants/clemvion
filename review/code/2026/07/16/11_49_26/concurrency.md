# 동시성(Concurrency) Review — AI Agent LLM chat 타임아웃 배선 (항목 B)

> 대상: `git diff origin/main HEAD -- . ':!review'`. router 가 docs-heavy 로 오판해 스킵된 리뷰를 재수행. 핵심 변경은 `ai-turn-executor.ts` 의 4개 `llmService.chat(...)` 호출부에 `{ signal, timeoutMs: aiAgentLlmCallTimeoutMs() }` (기본 600000ms, on-by-default) 를 배선한 것이며, 그 실제 동작을 결정하는 `LlmService.chat`(`llm.service.ts`)·`withTimeout`(`with-timeout.util.ts`) 은 이번 diff 로 수정되지 않았지만(사전 존재 코드) 이번 PR 이 그 경로를 처음으로 AI Agent 의 모든 chat 호출에 상시 활성화하므로 리뷰 범위에 포함했다.

## 발견사항

- **[CRITICAL]** `withTimeout` 내부 `AbortController` 가 실제 SDK 요청에 배선되지 않아, 타임아웃 발화 시 provider HTTP 요청이 취소되지 않고 백그라운드에 leak
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:172-180` (`chat()` 메서드). 이 경로는 이번 diff 의 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1689, 1820, 2779, 2923` (`executeSingleTurn` 최초 호출·tool-loop 재호출, `processMultiTurnMessage` resume 최초 호출·tool-loop 재호출 — 4곳 전부) 에서 `timeoutMs: aiAgentLlmCallTimeoutMs()` 로 상시 활성화된다.
  - 상세: `withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number)` (`codebase/backend/src/modules/llm/utils/with-timeout.util.ts`) 는 `run(controller.signal)` 형태로 자신이 만든 `AbortController.signal` 을 콜백에 넘기고, 타이머 만료 시 `controller.abort()` 를 호출해 **그 signal 로 실제 요청을 취소**하는 것이 설계 의도다(파일 JSDoc: "타임아웃 시 AbortController 로 내부 HTTP 요청을 취소해 소켓이 백그라운드에 남지 않도록"). 그런데 `chat()` 의 호출부는
    ```ts
    withTimeout(() => client.chat(sanitized, opts?.signal), opts.timeoutMs)
    ```
    로, 콜백이 인자를 받지 않는 0-arity 화살표 함수다. JS 는 초과 인자를 무시하므로 `run(controller.signal)` 이 넘기는 `controller.signal` 은 그대로 버려지고, 클로저로 캡처한 `opts?.signal`(호출자의 execution abortSignal — `controller.signal` 과는 별개 객체이며, resume 경로에서는 대개 `undefined`)만 SDK 로 전달된다. 결과적으로 타임아웃 타이머가 만료돼 `controller.abort()` 가 호출돼도 그 signal 을 구독하는 대상이 코드 어디에도 없다 — **실제 provider HTTP 요청은 취소되지 않는다.**
    `Promise.race` 는 JS Promise 레벨에서 여전히 타임아웃 에러를 먼저 throw 해 `executeSingleTurn`/`processMultiTurnMessage` 호출자를 정상적으로 unblock 하므로(caller 관점의 "hang 해소"는 달성), 백그라운드의 실제 `inner`(`client.chat(...)`) 는 `inner.catch(() => undefined)` 로 조용히 결과가 버려진 채 계속 실행되며 소켓/커넥션을 점유한다. 이 PR 이 막으려는 "무기한 hang" 의 실제 리소스는 애플리케이션 레벨에서만 감춰질 뿐 provider 커넥션은 해소되지 않는다.
    대조: 같은 파일의 `listModels`(`llm.service.ts:355-358`, `withTimeout((signal) => client.listModels(signal), LIST_MODELS_TIMEOUT_MS)`)는 콜백이 전달받은 `signal` 인자를 올바르게 forward 해 취소가 실제로 동작한다 — `chat()`/`embed()`(`llm.service.ts:274-278`, 동일 패턴 버그)만 이 배선이 빠져 있다.
  - 리스크: `AI_AGENT_TOOL_BUDGET`류와 달리 `AI_AGENT_LLM_CALL_TIMEOUT_MS` 는 기본값이 `0`(비활성)이 아니라 `600000`(활성) 이라 지금부터 모든 AI Agent LLM 호출이 상시 이 경로를 탄다. 네트워크 지연·모델 stall 빈도가 높아질수록 leaked 커넥션이 누적돼 provider 커넥션 풀/이벤트 루프 타이머 리소스를 잠식할 수 있다(카테고리 8 리소스 풀링). 어떤 테스트도(`llm.service.spec.ts` — `signal` 단독 전달 테스트는 있으나 `timeoutMs` 와의 조합·실제 abort 여부 미검증, `ai-turn-executor.spec.ts` 신규 테스트 — opts 객체에 `timeoutMs`/`signal` 키가 "실려 있는지"만 확인, 타임아웃 발화 시 실제 `client.chat` 인자가 abort 상태인지는 미검증) 이 이 경로를 커버하지 않아 회귀 감지가 불가능하다.
  - 제안: `chat()`/`embed()` 의 timeout 분기에서 withTimeout 콜백이 실제로 전달받는 `signal` 매개변수를 사용하도록 수정한다. `opts?.signal`(execution abort) 과 withTimeout 내부 타임아웃 signal 을 모두 SDK 요청에 반영해야 하므로, 본 저장소 Node 요구버전(`>=24`, `AbortSignal.any` 지원)을 활용해 `withTimeout((signal) => client.chat(sanitized, opts?.signal ? AbortSignal.any([opts.signal, signal]) : signal), opts.timeoutMs)` 식으로 병합해 전달하는 것을 권장(`listModels` 가 이미 올바르게 콜백 인자를 쓰는 패턴과 정합). 최소한 "타임아웃 발화 시 `client.chat` 에 전달된 signal 이 abort 상태가 되는지"를 검증하는 회귀 테스트를 `llm.service.spec.ts` 에 추가할 것.

- **[WARNING]** provider SDK 자체 하드코드 타임아웃(120초)이 신규 앱 레벨 기본값(600초)보다 훨씬 짧아 정상 조건에서 새 백스톱이 사실상 도달 불가능하거나(4개 provider), 반대로 Google provider 는 `signal` 자체를 받지 않아 이번 방어가 전혀 미치지 못함
  - 위치: `codebase/backend/src/modules/llm/clients/{openai,anthropic,azure-openai}.client.ts` (생성자 `timeout: 120_000`, `local.client.ts` 는 `OpenAIClient` 상속이라 동일 적용), `codebase/backend/src/modules/llm/clients/google.client.ts:322` (`async chat(params: ChatParams): Promise<ChatResult>` — `signal` 매개변수 자체가 없음. 대비: 같은 파일의 `chatStream`/`listModels` 는 `signal` 지원). 신규: `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.ts` (`AI_AGENT_LLM_CALL_TIMEOUT_MS_DEFAULT = 600000`).
  - 상세: 이 부분은 diff 밖(사전 존재) 코드이지만, 이번 PR 이 "defense-in-depth 로 네트워크 지연·모델 stall 로 인한 무기한 hang 을 막는다"는 목표를 명시했으므로 실효성 관점에서 짚는다. OpenAI/Anthropic/Azure/Local(=`OpenAIClient` 상속) 4개 provider 는 SDK 클라이언트 생성 시 절대 타임아웃 120초가 이미 박혀 있어, 진짜 "hang" 상황이면 신규 앱 레벨 타임아웃(기본 10분)이 발화하기 훨씬 전에 SDK 자체가 먼저 에러를 던진다 — 기본값 기준으로 이 4개 provider 에 대해서는 신규 백스톱이 사실상 죽은 코드에 가깝다(운영자가 env 를 120초보다 짧게 낮춰야 실질적으로 관여). 반대로 hang 취약성이 가장 큰(무제한 self-host 포함 여지가 있는) Google 은 `chat()` 시그니처가 `signal` 을 아예 받지 않아, 위 CRITICAL 항목이 수정되더라도 Google provider 경로에는 여전히 실제 취소 수단이 없다(SDK 자체 내장 타임아웃 존재 여부는 코드상 확인 불가).
  - 제안: (a) 최소 Google `chat()` 에도 다른 provider 와 동일하게 `signal` 매개변수를 추가해 SDK 호출에 전달(`chatStream`/`listModels` 는 이미 지원해 패턴 존재), (b) provider SDK 자체 타임아웃과 앱 레벨 `AI_AGENT_LLM_CALL_TIMEOUT_MS` 의 관계(더 작은 쪽이 실질 적용됨)를 spec §12.16 이나 코드 주석에 명시해 향후 운영자가 오해하지 않도록 할 것.

- **[INFO]** resume 경로 `options.signal` 배선은 현재 항상 사실상 no-op — 문서화된 기지(既知) gap, 그 자체는 문제 아님
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:379-390` (`ResumableMessageOptions.signal`), `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2779, 2923` (`options?.signal`).
  - 상세: `processMultiTurnMessage` 의 `options.signal` 을 실제로 채우는 caller 가 아직 없음을 확인했다 — `ai-agent.handler.ts` 는 상위에서 받은 `options` 를 그대로 통과시킬 뿐이고, resume 트리거 경로 어디에서도 abort 소스가 생성되지 않는다(`node-cancellation.md` 가 명시하는 후속 과제). PR 이 주석·CHANGELOG 에서 "대개 undefined" 라고 정직하게 disclose 했고, `timeoutMs` 백스톱은 이 signal 과 무관하게 독립 동작하므로 현재 시점 기능 결함은 아니다.
  - 제안: 조치 불필요(현재 스코프). 다만 CRITICAL 항목을 고칠 때, 이후 이 signal 이 실제로 채워지는 후속 PR 에서도 "resume abort 와 timeout 이 동시에 경합"하는 케이스를 회귀 테스트에 포함하도록 미리 남겨 둘 것을 권장.

- 참고(비-항목화): 항목 A(config-time 저장 경고, `tool-payload-save-warning.ts`, `workflows.service.ts` 의 `evaluateToolPayloadWarnings`/`evaluateToolPayloadWarningsAndThrow`)는 통합 배치 로딩(`In()` 단일 쿼리) 후 노드별 순차 `await` 로 동기 재현하는 구조라 공유 가변 상태나 병렬 fan-out이 없고, `saveCanvas` 는 트랜잭션 매니저 스코프 repository 를 재사용해 추가 커넥션도 잡지 않는다. 동시성 관점에서 특이 사항 없음.

## 요약

이번 diff 의 핵심(항목 B, LLM chat 호출당 app-level 타임아웃)은 `ai-turn-executor.ts` 자체의 배선 코드로만 보면 단일/멀티턴 4개 호출부 모두 대칭적으로 `timeoutMs`+`signal` 을 전달하도록 잘 구성되어 있다. 그러나 그 타임아웃의 실질 동작을 결정하는 `LlmService.chat`(diff 밖, 사전 존재)의 `withTimeout` 사용이 콜백 인자로 전달되는 내부 `AbortController.signal` 을 사용하지 않고 캡처된 `opts?.signal` 을 대신 사용하는 배선 버그를 갖고 있어, 타임아웃이 발화해도 실제 provider HTTP 요청은 취소되지 않고 백그라운드에서 계속 실행된다(leak). 이 버그 자체는 이번 diff 가 만든 것은 아니지만, 이번 diff 가 그 경로를 기본값 활성 상태(`600000ms`)로 AI Agent 의 모든 LLM 호출에 상시 노출시키는 첫 변경이라는 점에서 실질적 영향 범위가 크게 확대됐고, 어떤 테스트도 이 시나리오(타임아웃 발화 시 실제 요청 취소 여부)를 검증하지 않는다. 부수적으로 provider 별 SDK 자체 타임아웃(120초, OpenAI 계열)이 신규 기본값(600초)보다 짧아 대부분의 provider 에선 새 백스톱이 사실상 도달 불가능하고, Google provider 는 `chat()` 이 `signal` 을 아예 받지 않아 취소 경로가 완전히 빠져 있다는 점도 defense-in-depth 목표의 실효성을 제한한다. resume 경로 signal 부재는 PR 이 스스로 disclose 한 기지 gap으로 별도 조치 불요.

## 위험도

CRITICAL
