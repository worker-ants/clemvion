# 부작용(Side Effect) 리뷰 — 항목 B CRITICAL fix 검증

검증 대상: `codebase/backend/src/modules/llm/llm.service.ts` `chat()` 의 signal 병합(`AbortSignal.any`) fix,
`codebase/backend/src/modules/llm/clients/google.client.ts` `chat()` 의 `signal?: AbortSignal` 파라미터 추가.
`git diff origin/main HEAD -- ':!review'` 로 실제 코드 변경분만 대상으로 확인.

## 발견사항

없음 (검증 항목 3건 모두 부작용 없음 확인).

### 검증 1 — no-timeout 분기(opts?.timeoutMs 미설정) 기존 동작 불변

`llm.service.ts` `chat()` 의 삼항식 마지막 분기는 변경되지 않았다.

```ts
const run = () =>
  opts?.timeoutMs && opts.timeoutMs > 0
    ? withTimeout(
        (timeoutSignal) =>
          client.chat(
            sanitized,
            opts?.signal
              ? AbortSignal.any([opts.signal, timeoutSignal])
              : timeoutSignal,
          ),
        opts.timeoutMs,
      )
    : client.chat(sanitized, opts?.signal);   // ← no-timeout 분기, 변경 없음
```

`timeoutMs` 가 없거나 0/음수이면 여전히 `opts?.signal` 이 그대로(병합 없이) `client.chat` 에 전달된다. 병합(`AbortSignal.any`)은 `withTimeout` 콜백 내부, 즉 timeoutMs 가 설정된 분기에만 존재한다. `llm.service.spec.ts` 기존 테스트(수정 전부터 있던 "passes signal through to client.chat" 계열, `expect(mockClient.chat).toHaveBeenCalledWith(params, controller.signal)`)가 그대로 유지·통과함을 실행 확인(`npx jest llm.service.spec.ts -t signal` → 3 passed, 기존 테스트 포함). no-timeout 분기의 호출자 관찰 가능한 동작 변경 없음.

### 검증 2 — `google.client.ts` `chat(params, signal?)` 신규 파라미터, 기존 호출자 영향

```ts
async chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResult> {
```

- `signal` 은 optional(`?`)이며 세 번째 인자가 아니라 기존 시그니처(`chat(params)`) 끝에 순수 추가된 optional 파라미터라 하위 호환. TS 구조적 타이핑상으로도, 런타임상으로도 인자를 생략한 기존 호출은 `signal === undefined` 로 이전과 동일하게 동작.
- `signal` 은 내부에서 `buildGenerationConfig(params, hasTools, systemInstruction, signal)` 로 전달되는데, `buildGenerationConfig` 는 diff 이전부터 이미 `signal?: AbortSignal` 4번째 파라미터를 갖고 있었고(`chatStream`/`listModels` 가 이미 사용) `cfg` 에 `...(signal ? { abortSignal: signal } : {})` 로 조건부 스프레드한다. 즉 `signal` 이 `undefined` 이면 `abortSignal` 키 자체가 생성되지 않아 이전 동작과 100% 동일. `signal` 이 주어진 경우에만 `GenerateContentConfig.abortSignal` 이 추가되는 순수 additive 변경.
- `LLMClient` 인터페이스(`interfaces/llm-client.interface.ts:126`)는 이미 `chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResult>` 로 선언돼 있었고, `openai.client.ts:77`·`anthropic.client.ts:49` 는 이미 이 시그니처를 구현하고 있었다 — 이번 변경은 `GoogleClient` 를 인터페이스/형제 구현체와 동일한 형태로 맞춘 것뿐, 신규 공개 API 표면이 아니다.
- `GoogleClient` 를 직접 소비하는 곳은 `llm-client.factory.ts` → `LLMClient` 인터페이스 통해 `llm.service.ts` 뿐(grep 확인, `google.client.spec.ts` 외 직접 인스턴스화/타 소비자 없음). 즉 이 시그니처 변경의 유일한 실질 호출자는 이번 diff 로 함께 수정된 `llm.service.ts` 이며, 그 외 프로덕션 호출자에 영향 없음.
- `google.client.spec.ts` 전체(43 tests) 실행 결과 전부 통과 — 기존 `chat()` 호출부(signal 미전달 케이스 포함)가 회귀 없음을 실측 확인.

### 검증 3 — embed 경로 미변경

`git diff` 상 `google.client.ts` 의 변경 hunk 는 `chat()` 메서드(원본 라인 319 부근) 단 하나뿐이며, `embed()`(`google.client.ts:549` 부근)·`chatStream()`·`listModels()` 는 diff 에 등장하지 않는다. `llm.service.ts` 의 `embed()` 메서드(`llm.service.ts:270` 부근, `client.embed(batch, model, inputType)` 호출부)도 이번 diff 범위 밖 — `LlmService.chat()` 과 `LlmService.embed()` 는 완전히 분리된 메서드이며 이번 fix 는 `embed` 시그니처·호출 경로를 전혀 건드리지 않았다.

### 참고 (스코프 밖, 참고용 관찰 — WARNING/CRITICAL 아님)

- `LlmService.chat(config, params, context?, opts?)` 의 공개 시그니처 자체는 변경되지 않았다 — 이번 fix 는 그 내부 구현(어떤 signal 을 `client.chat` 에 전달하는지)만 바꿨다. `agent-memory-injection.ts`/`text-classifier.handler.ts`/`ai-turn-executor.ts`/`information-extractor.handler.ts`/`graph-extraction.service.ts`/`rerank.service.ts`/`agent-memory-extraction.processor.ts` 등 모든 `LlmService.chat()` 호출자는 시그니처·호출 방식 변경 없이 그대로 동작.
- timeoutMs 분기에서 매 호출마다 `AbortSignal.any([...])` 로 새 combined signal 을 생성하는 것은 Node/WHATWG 표준 동작(내부적으로 소스 signal 에 `abort` 리스너를 걸고, combined signal 이 GC 되거나 abort 되면 자동 해제)이라 명시적 리스너 leak 은 아니나, `opts.signal` 로 전달되는 controller 가 실행(execution) 전체 수명 동안 매우 많은 `chat()` 호출에 재사용될 경우 순간적으로 다수의 `abort` 리스너가 동시에 걸려 있을 수 있다. 이번 fix 범위의 회귀는 아니며 별도 성능/리소스 이슈로 볼 사안은 아니라 판단.
- `withTimeout` (`modules/llm/utils/with-timeout.util.ts`) 자체는 diff 대상이 아니며, 이미 이전부터 `run: (signal: AbortSignal) => Promise<T>` 시그니처로 콜백에 `timeoutSignal` 을 넘기고 있었다. 버그의 본질은 `llm.service.ts` 호출부가 그 인자를 받는 0-arity 콜백을 썼던 것 — 이번 fix 는 `withTimeout` 유틸이 아니라 호출부만 수정했으므로 동일 유틸을 쓰는 다른 호출자(`llm-preview.service.ts`, `mcp-client.service.ts`, `stuck-document-recovery.service.ts` 등, 각기 다른 `withTimeout` 구현/용도)에는 영향이 없다(경로 미터치 확인).

## 요약

`llm.service.ts` 의 signal 병합 fix 는 `opts?.timeoutMs` 가 설정된 분기에만 국한되며, no-timeout 분기(`client.chat(sanitized, opts?.signal)`)는 문자 그대로 변경되지 않았고 관련 회귀 테스트도 그대로 통과한다. `google.client.ts` 의 `chat(params, signal?)` 파라미터 추가는 이미 `LLMClient` 인터페이스와 `openai.client.ts`/`anthropic.client.ts` 형제 구현체가 갖고 있던 시그니처에 `GoogleClient` 를 맞춘 순수 additive/optional 변경으로, 유일한 실질 호출자(`llm.service.ts`)를 제외하면 하위 호환이며 `google.client.spec.ts` 43개 테스트가 모두 통과해 회귀가 없음을 실측했다. `embed()`/`chatStream()`/`listModels()` 경로는 diff 에 전혀 등장하지 않아 미변경이 확인된다. 세 검증 항목 모두 side-effect 리스크 없음.

## 위험도

NONE
