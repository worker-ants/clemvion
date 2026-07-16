# 동시성(Concurrency) Review — CRITICAL Fix 검증

> 대상: 직전 라운드 CRITICAL(`LlmService.chat` 의 `withTimeout` 이 내부 timeout signal 을 버려
> provider HTTP 요청이 취소되지 않고 leak) 에 대한 fix 커밋 `204b9aed6` (`fix(llm): withTimeout
> 이 실제 요청을 취소하도록 chat signal 배선 (ai-review CRITICAL)`).
> 검증 파일: `codebase/backend/src/modules/llm/llm.service.ts`,
> `codebase/backend/src/modules/llm/clients/google.client.ts`,
> `codebase/backend/src/modules/llm/llm.service.spec.ts`,
> `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts`,
> `spec/4-nodes/3-ai/1-ai-agent.md` §12.16.
> 검증 방법: 코드 정독 + `AbortSignal.any`/`withTimeout` 의미론 추적 + 실제 `npx jest --detectOpenHandles` 재현.

## 결론 (先)

**원래 CRITICAL 은 해소됨.** `withTimeout` 콜백이 이제 내부 `timeoutSignal` 인자를 실제로 사용하고,
`opts?.signal` 과 `AbortSignal.any([opts.signal, timeoutSignal])` 로 병합해 SDK 로 전달한다.
Google 클라이언트도 `chat(params, signal?)` 로 signal 을 받아 `generateContent` 의
`config.abortSignal` 로 정확히 배선했다. 다만 이 fix 가 추가한 **회귀 테스트 자체가 새로운
리소스 누수(real timer open handle)** 를 도입했음을 실측으로 확인했다 — WARNING 으로 보고한다.

## 발견사항

- **[INFO]** (검증 완료, 문제 없음) 원 CRITICAL 정정 확인 — `chat()` 경로가 이제 실제로 요청을 취소한다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:172-191`
  - 상세: `withTimeout((timeoutSignal) => client.chat(sanitized, opts?.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal), opts.timeoutMs)`. 과거엔 콜백이 0-arity(`() => client.chat(sanitized, opts?.signal)`)라 `withTimeout` 내부 `AbortController`(`with-timeout.util.ts:14`)가 만든 signal 이 SDK 호출에 전혀 도달하지 않아, `controller.abort()`(타이머 발화 시)가 아무 것도 취소하지 못했다. 수정 후에는 `timeoutSignal` 인자를 실제로 소비하므로, 타이머가 발화해 `controller.abort()`가 호출되면 그 abort 가 (병합 signal 을 통해) 실제 provider HTTP 요청까지 전파된다.
  - **경합 정합성 확인**: `AbortSignal.any` 는 소스 중 하나라도 abort 되면 즉시 합성 signal 을 abort 시키는 표준 의미론이라, "abort 가 먼저"(execution cancel) 든 "timeout 이 먼저"(내부 타이머) 든 어느 쪽이든 대칭적으로 SDK 요청을 취소한다 — `run` 콜백/`Promise.race`/`finally` 의 clearTimeout 로직 자체는 이번 diff 로 변경되지 않았고 그 경합 처리(원 CRITICAL 리뷰가 이미 검증)는 그대로 보존된다.
  - **Node 버전 정합성**: `backend/package.json` `engines.node: ">=24"`, `Dockerfile FROM node:24-alpine` — `AbortSignal.any` 는 Node 20.3+ 표준/안정 API 라 호환성 문제 없음.
  - **Google client**: `chat(params: ChatParams, signal?: AbortSignal)` → `buildGenerationConfig(..., signal)` → `{ ...(signal ? { abortSignal: signal } : {}) }` (`google.client.ts:213-244`). 과거엔 `chat()` 시그니처 자체가 signal 을 받지 않아 Google provider 경로는 애초에 취소 불가였다(원 리뷰 지적). 이제 OpenAI/Anthropic/Google 3개 클라이언트 모두 `chat(params, signal?)` 를 동일하게 지원해 provider 간 비대칭이 해소됐다.
  - **listModels 패턴과의 정합**: 기존에 유일하게 올바르게 콜백 인자를 forward 하던 `listModels(...)`(`llm.service.ts:366-368`, `withTimeout((signal) => client.listModels(signal), ...)`) 와 이제 `chat()` 이 동일 패턴을 따른다 — 확인.

- **[WARNING]** 신규 회귀 테스트가 real timer 를 정리하지 않아 open handle 을 남김 (실측 재현)
  - 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` — `'merges opts.signal with the timeout signal (execution abort propagates too)'` (chat 스펙, `timeoutMs: 60000`)
  - 상세: 이 테스트는 `mockClient.chat` 을 signal 만 캡처하고 **영원히 resolve/reject 하지 않는 hang Promise** 로 mock 한 뒤(`new Promise<never>(() => {})`), `controller.abort()` 로 `opts.signal` 만 발화시켜 병합 signal 이 abort 상태가 됐는지 확인하고, 반환된 `call` promise 는 `void call.catch(() => undefined)` 로 **의도적으로 버린다**("hang promise 정리를 위해 timeout race 를 강제 종료하지 않고 call 을 버린다"는 주석 포함). 그러나 `opts.signal.abort()` 는 병합된 signal 을 abort 상태로 만들 뿐 — mock 이 그 signal 을 실제로 listen 해서 자기 자신을 reject 하지 않으므로 — `withTimeout` 내부의 `Promise.race([inner, timeoutPromise])`(`with-timeout.util.ts:19-27`)의 `inner` 는 여전히 pending 이고, `timeoutPromise` 의 실제 `setTimeout(..., 60000)` 도 여전히 살아있다. 즉 테스트가 끝난 뒤에도 실제 60초짜리 Node 타이머 핸들이 남는다.
  - **실측**: `npx jest src/modules/llm/llm.service.spec.ts -t "merges opts.signal" --detectOpenHandles` 실행 결과, Jest 가 정확히 이 지점을 open handle 로 지목함:
    ```
    Jest has detected the following 1 open handle potentially keeping Jest from exiting:
      ●  Timeout
        22 |         timer = setTimeout(() => {
        at with-timeout.util.ts:22:17
        at run (llm.service.ts:181:22)
        at LlmService.chat (llm.service.ts:193:9)
        at llm.service.spec.ts:179:28 (해당 신규 테스트)
    ```
    전체 파일(`llm.service.spec.ts`, 55 tests)을 `npx jest` 로 그냥 실행하면 테스트 자체는 3.4초에 통과하지만("Jest did not exit one second after the test run has completed" 경고 출력), 실제 프로세스 종료까지 **wall-clock 60.69초**가 걸림을 `time` 으로 실측 확인(`1:00.69 total`).
  - **왜 이게 문제인가**: `codebase/backend/jest.config.ts` 는 `forceExit` 를 명시적으로 쓰지 않으며, 그 이유를 상세 주석으로 남겨뒀다 — "the unit suite exits on its own... `npm test -- --detectOpenHandles` reports zero handles. If a future change reintroduces a leak, that flag is the diagnostic; close the resource in afterAll rather than re-adding forceExit." 이번 신규 테스트가 정확히 그 "future change reintroduces a leak" 케이스에 해당한다 — 프로젝트가 명시적으로 지켜온 "zero open handle" 불변식을 이 fix 커밋의 회귀 테스트가 깨뜨렸다. `forceExit` 가 없으므로 CI 의 backend 단위 테스트 프로세스는 (다른 handle 이 이미 없다는 전제 하에) 이 handle 하나 때문에 최대 60초 추가 대기 후에야 종료된다 — 매 CI 실행마다 반복되는 실질적 시간 낭비이자, "타임아웃이 실제 요청을 취소하지 못해 leak" 이라는 이번 fix 의 주제와 아이러니하게 동일한 범주(취소되지 않은 async 작업의 leak)의 결함이 테스트 하네스에 재도입된 것.
  - **왜 프로덕션 코드는 안전한가 (대조)**: 실제 provider 클라이언트(OpenAI/Anthropic/Google)는 SDK 가 signal 을 실제로 listen 해서 abort 시 즉시 reject 하므로, `withTimeout` 의 `inner` 가 타이머보다 먼저 settle 되고 `finally` 의 `clearTimeout(timer)` 가 정상적으로 실행돼 handle 이 남지 않는다. 이번 테스트의 mock 만 "signal 을 캡처는 하지만 반응은 하지 않는" 비현실적 구현이라 leak 이 발생한 것 — 프로덕션 동작 자체는 안전하다.
  - 제안: mock 을 signal 에 반응하도록 고쳐 실제 client 동작을 흉내낸다 — 예:
    ```ts
    mockClient.chat.mockImplementation((_p, signal) => {
      captured = signal;
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
      });
    });
    ```
    이렇게 하면 `controller.abort()` 호출 시 `inner` 가 실제로 reject 되어 `withTimeout` 의 `Promise.race` 가 즉시 settle → `finally` 가 60000ms 타이머를 `clearTimeout` 하므로 handle 이 남지 않는다. 테스트도 `await expect(call).rejects.toThrow()` 형태로 명시적으로 결과를 소비할 수 있어 "call 을 버린다"는 임시방편 주석도 제거 가능. 대안으로 해당 테스트만 `jest.useFakeTimers()`(파일 내 686/864번 라인에 이미 쓰이는 패턴) 로 전환해 `jest.advanceTimersByTimeAsync` 로 강제 settle 시키는 방법도 있다.

- **[INFO]** 새 테스트 2건이 서로 다른 half 만 검증 — "병합 후 timeout 쪽이 발화" 조합은 미검증
  - 위치: `llm.service.spec.ts` 신규 2건 (`'aborts the signal...timeoutMs fires'`, `'merges opts.signal with the timeout signal...'`)
  - 상세: 첫 번째 테스트는 `opts.signal` **없이** timeout 만으로 `timeoutSignal` 이 그대로 전달돼 abort 되는지 확인하고, 두 번째는 `opts.signal` **있음** + timeout 발화 전에 `opts.signal` 을 수동 abort 해 병합이 되는지만 확인한다. "`opts.signal` 이 있는 상태에서 timeout 이 실제로 자연 발화해 병합 signal 이 timeoutSignal 쪽에서 abort 되는지"(가장 실제 §12.16 defense-in-depth 시나리오에 가까운 조합)는 별도로 고정돼 있지 않다. `AbortSignal.any` 의 대칭적 의미론상 코드 정합성 문제로 이어지진 않으나, 회귀 커버리지 관점에서는 한 조각이 비어 있다.
  - 제안: 우선순위 낮음(현재 커버리지로도 원 CRITICAL 재발은 방지됨). 여력이 있으면 세 번째 조합 테스트를 추가하거나, 위 WARNING 항목 수정 시 mock 을 abort-reactive 로 바꾸면서 자연스럽게 같이 검증되도록 구성할 것을 권장.

- **[INFO]** `embed()` 경로는 동일 패턴 버그가 여전히 남아 있고, "비활성" 서술이 다소 낙관적 — 이미 활성 호출자 존재
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:286-288` (`withTimeout(() => client.embed(batch, model, inputType), opts.timeoutMs)` — 여전히 0-arity 콜백, 인자로 받는 내부 timeout signal 미사용)
  - 상세: 커밋 메시지는 "embed() 는 동일 withTimeout 패턴이나 항목 B 미활성 + client.embed 가 signal 미지원이라 별도 후속"이라 명시했고 이는 대체로 정확하다 — `LLMClient.embed()` 인터페이스 자체가 `signal` 파라미터를 받지 않으므로(`chat()` 과 달리 3개 client 구현 전부 대상 시그니처 확장이 필요) `chat()` 과 동일한 저비용 fix 가 불가능해 스코프를 줄인 판단은 합리적이다. 다만 "항목 B 미활성"이라는 문구가 "이 경로 자체가 지금 죽은 코드"라는 인상을 줄 수 있는데, 실제로는 `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts:244` 가 `{ timeoutMs: EMBED_TIMEOUT_MS(=60_000), disableInnerRetry: true }` 로 이미 상시 이 `withTimeout` 분기를 태우고 있다(KB 문서 임베딩 배치마다). 즉 "항목 B(AI Agent 앱레벨 타임아웃)에는 미노출"은 맞지만, "이 leak 자체가 현재 비활성"은 아니다 — knowledge-base embedding 경로는 이 PR 이전부터 이미 동일 leak 을 안고 상시 운영 중이다(이 fix 가 새로 만든 문제는 아님, 원 CRITICAL 리뷰도 embed 를 "diff 밖 사전 존재"로 분류했었음).
  - 제안: 기능 차단 아님(이번 fix 스코프 밖 판단 자체는 타당). 다만 후속 티켓/plan 에 "embed() 도 chat() 과 동일 leak — `LLMClient.embed()` 인터페이스에 `signal?: AbortSignal` 추가 + 3 client 구현 + `llm.service.ts` embed() 콜백 배선" 을 **"이미 활성 경로"** 로 명시해두면 우선순위 판단에 도움이 된다(현재 커밋/spec §12.16 서술은 "비활성"으로만 읽혀 후속 우선순위가 낮게 매겨질 위험).

## 요약

원래 CRITICAL(`LlmService.chat` 의 `withTimeout` 이 내부 timeout signal 을 버려 타임아웃 발화 시 provider 요청이 취소되지 않고 leak)은 이번 fix 로 실질적으로 해소됐다 — `withTimeout` 콜백이 이제 인자로 받는 `timeoutSignal` 을 실제로 사용하고 `opts?.signal`(execution abort)과 `AbortSignal.any` 로 병합해 SDK 에 전달하며, Google 클라이언트도 `chat(params, signal?)` 시그니처를 새로 받아 `generateContent` 의 `abortSignal` 로 정확히 배선했다. `AbortSignal.any` 의 표준 의미론상 abort-먼저/timeout-먼저 두 경합 모두 대칭적으로 처리되고, provider 3사(OpenAI/Anthropic/Google) 클라이언트 간 signal 지원이 이제 일관된다. 다만 검증 과정에서 이 fix 가 추가한 회귀 테스트 하나(`llm.service.spec.ts` `'merges opts.signal...'`)가 mock 을 abort-비반응형으로 구현해 **실제 60초짜리 Node 타이머 핸들을 leak** 시키는 것을 `--detectOpenHandles` 로 직접 재현·확인했다 — `jest.config.ts` 가 문서화한 "zero open handle / no forceExit" 프로젝트 불변식을 위반하며, CI 의 해당 스펙 실행마다 최대 60초의 불필요한 프로세스 종료 지연을 유발한다(실측: 테스트 자체는 3.4초에 통과하나 프로세스 종료까지 60.69초). 프로덕션 코드 경로 자체는 실 provider 클라이언트가 signal 에 실제로 반응해 `Promise.race`+`finally clearTimeout` 이 정상 동작하므로 안전하며, 이 leak 은 테스트 mock 의 비현실성에서만 기인한다. `embed()` 경로의 동일 패턴 버그는 의도적으로 스코프 밖에 남겨졌고 그 판단 자체는 합리적이나, "미활성"이라는 서술과 달리 knowledge-base embedding 경로(`EMBED_TIMEOUT_MS=60000`)가 이미 상시 이 leak 을 안고 운영 중임을 후속 우선순위 판단을 위해 남긴다.

## 위험도

LOW
