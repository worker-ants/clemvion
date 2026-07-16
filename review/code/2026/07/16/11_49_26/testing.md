# 테스트(Testing) 리뷰 — 항목 B: AI Agent LLM chat 호출 app-level 타임아웃 (§12.16)

> 범위: router 가 오판(docs-heavy)해 스킵된 code reviewer 보완 호출. `git diff origin/main HEAD`(review/** 제외) 기준
> 핵심 대상: `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.ts` (+ `.spec.ts` 신규),
> `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 의 4개 `chat()` 호출부 배선(+ `.spec.ts` 신규 3케이스).
> 항목 A(도구 payload 예산 저장 경고: `tool-payload-save-warning.*`, `workflows.service.*`, `tool-payload-budget.*`, e2e)는 이 리뷰의 범위 밖(별도 reviewer 담당 가정)이라 평가하지 않음.

## 발견사항

- **[WARNING]** `AI_AGENT_LLM_CALL_TIMEOUT_MS=0`("비활성") 값이 `AiTurnExecutor` → `LlmService.chat` 경로까지 실제로 전파되는지 검증하는 테스트가 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` L90-131, L490-509
  - 상세: `llm-call-timeout.spec.ts` 는 env parser 단위(`aiAgentLlmCallTimeoutMs()`)에서 `0` 이 fallback 되지 않고 그대로 반환됨을 정확히 고정한다(`'treats 0 as a valid disabled value'`). 그러나 `ai-turn-executor.spec.ts` 에 추가된 3개 테스트는 **env 미설정(default 600000)** 과 **양수 override(30000)** 두 케이스만 검증하고, `0`(비활성) 케이스는 executor 통합 레벨에서 한 번도 검증하지 않는다. 이 값은 코드 주석·spec §12.16·docstring 모두에서 "payload 예산 env 와 다른 **핵심 차이**"로 강조된 값인데(운영자가 명시적으로 백스톱을 끄는 유일한 경로), 정작 executor→`chat()` opts 로 실제 전달되는지는 미검증이다. `LlmService.chat` 의 `opts?.timeoutMs && opts.timeoutMs > 0` 판정(`llm.service.ts:173`)은 `0` 을 falsy 로 취급해 `withTimeout` 을 건너뛰므로 의미상 맞지만, 그 판정 자체도 `chat()` 전용 단위 테스트가 프로젝트 전체에 없다(`llm.service.spec.ts` 에는 `embed()` 의 `timeoutMs` 테스트만 존재, L331-357). 즉 "0 → 비활성" 이라는 이 기능의 핵심 계약이 **파서 계층에서만** 잠겨 있고, 그 값이 실제 `chat()` 호출까지 무손상으로 도달하는지를 보증하는 안전망이 어디에도 없다.
  - 제안: `ai-turn-executor.spec.ts` 에 `process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS = '0'` 설정 후 `mockLlmService.chat.mock.calls[0][3].timeoutMs` 가 정확히 `0` 인지(그리고 `600000` 이 아닌지) 확인하는 케이스를 1개 추가. 여유가 있다면 `llm.service.spec.ts` 의 `chat` describe 블록에도 `opts.timeoutMs=0` → `client.chat` 이 `withTimeout` 없이 직접 호출됨을 고정하는 테스트를 추가(현재 `embed` 에만 대칭 테스트 존재).

- **[WARNING]** `signal` 전파 검증이 `'signal' in opts` 라는 사실상 tautological assertion 에 그침
  - 위치: `ai-turn-executor.spec.ts` L104-107(single-turn), L502-505(resume)
  - 상세: 두 신규 테스트 모두 `{ signal: context.abortSignal, timeoutMs: ... }` / `{ signal: options?.signal, timeoutMs: ... }` 형태의 **객체 리터럴**을 대상으로 `'signal' in opts).toBe(true)` 를 검증한다. 그러나 `signal:` 키를 포함한 객체 리터럴은 값이 `undefined` 이어도 `in` 연산자에서 항상 `true` 다 — 즉 이 assertion 은 실제 구현이 `context.abortSignal`/`options?.signal` 을 올바르게 읽어오는지와 무관하게 항상 통과하는 근사 tautology 다. `baseContext`(`makeExecutionContext` 기본값)는 애초에 `abortSignal` 을 설정하지 않아(`abortSignal` 필드 자체가 override 안 됨) 값은 항상 `undefined` 이므로, `context.abortSignal` 을 그대로 전달하는 코드든 실수로 `signal: undefined` 를 하드코딩한 코드든 이 테스트를 똑같이 통과한다. 주석("signal 은 context.abortSignal 전파")이 주장하는 바를 실제로는 검증하지 않는다.
  - 제안: single-turn 테스트는 `baseContext` 대신 실제 `AbortController().signal` 을 주입한 컨텍스트로 `opts.signal === thatSignal` 을 `toBe()` 로 직접 비교. resume 테스트는 `expect(opts.signal).toBeUndefined()` 로 명시해 "소스 없음 = undefined" 의도를 실제로 고정(현재는 코멘트로만 서술).

- **[WARNING]** 4개 `chat()` 호출부 중 tool-loop 재진입 2곳의 타임아웃/signal 배선이 테스트되지 않음
  - 위치: `ai-turn-executor.ts` L1689(단일턴 1차)·L1820(단일턴 tool-loop 재호출)·L2779(resume 1차)·L2923(resume tool-loop 재호출); 대응 테스트는 `ai-turn-executor.spec.ts` L90-131, L490-509
  - 상세: spec §12.16 자체가 "single-turn `executeSingleTurn` **2곳** · multi-turn `processMultiTurnMessage` resume **2곳**"이라고 4개 호출부를 명시하고, diff 도 정확히 그 4곳을 수정했다. 그러나 신규 테스트 3개는 모두 `mockLlmService.chat.mock.calls[0]` (첫 호출)만 검사하며, 사용된 mock 응답(`content` 만 있고 `toolCalls` 없음)은 tool-loop 을 트리거하지 않아 L1820/L2923 이 한 번도 실행되지 않는다. 이 파일에는 이미 tool-loop 을 2회 호출로 유도하는 기존 테스트가 있는데(L221-252 단일턴, L558-593 resume — `mock.calls[1][2]` 로 context 만 확인), 그 어느 것도 `mock.calls[1][3]`(opts)의 `timeoutMs`/`signal` 은 확인하지 않는다. 두 호출부가 동일한 `aiAgentLlmCallTimeoutMs()` 함수를 재사용하므로 실제 리스크는 낮지만, 4곳 중 2곳(정확히 절반)이 회귀 보호막 밖에 있다.
  - 제안: 기존 tool-loop 테스트(L221-252, L558-593) 중 하나에 `mock.calls[1][3]` 의 `timeoutMs`/`signal` assertion 을 추가하거나, 신규 테스트를 tool-loop 유도형으로 확장.

- **[INFO]** 단일턴 `chat()` throw(타임아웃 포함) 가 uncaught 되어 엔진 `FAILED` 로 귀결되는, spec/CHANGELOG 에 명시된 "기존 gap" 동작에 대한 회귀 테스트가 전무
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 첫 번째 하위 불릿, `CHANGELOG.md` "Unreleased — AI Agent LLM chat 호출 app-level 타임아웃" 1번 항목; 테스트 부재는 `ai-turn-executor.spec.ts` 전체(`mockRejectedValue`/`.chat.mockImplementation` 류 패턴이 파일 전체에 0건, grep 확인)
  - 상세: 이 PR 은 "single-turn 은 일반 `chat` try/catch 부재로 timeout throw 가 엔진 레벨 무분류 `FAILED` 로 귀결된다"는 것을 스코프 밖의 **기존 gap**으로 명시적으로 문서화한다(동일 diff 내 `ai-turn-executor.ts` 에 이미 별도로 남겨진 eslint-disable 코멘트가 "landmine 을 확인해 명시"한 사례처럼, 이 파일이 이런 종류의 암묵적 계약에 취약함을 보여준다). 그런데 executor 단 어떤 테스트도 `chat()` 이 reject 하는 경로 자체를 시뮬레이션하지 않아, "single-turn 은 여전히 throw 가 caller 로 그대로 전파된다"(= `error` 포트로 잘못 흡수되지 않는다)는 문서화된 동작이 코드로 고정돼 있지 않다. 이 PR 이 timeout 이라는 새로운 흔한 실패 모드를 이 정확한 gap 경로에 새로 연결하는 만큼, 최소 회귀 테스트로 "의도된 현재 동작"을 잠가 두는 편이 향후 무심코 절반만 고치는 회귀를 막는다.
  - 제안: `executeSingleTurn` 테스트에 `mockLlmService.chat.mockRejectedValueOnce(new Error('Request timed out after 600000ms'))` 후 `executor.executeSingleTurn(...)` 이 `error` 포트로 정상 종결되지 **않고** reject 로 전파됨(`await expect(...).rejects.toThrow(...)`)을 고정하는 케이스 1개 추가. (multi-turn resume 쪽은 기존 `ai-turn-orchestrator.service.spec.ts` 의 범용 timeout 분류 테스트로 이미 간접 커버됨 — 별도 조치 불요.)

- **[INFO]** `llm-call-timeout.spec.ts` 의 env parser 경계값 커버리지는 촘촘하나 사소한 형식 케이스 일부 미검증
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.spec.ts`
  - 상세: default/empty-whitespace/양수 override/`0`/음수·비수치·`NaN`·`Infinity`/재읽기(no reload) 매트릭스는 명확하고 의도가 잘 드러난다(주석에 payload 예산 env 와의 차이를 명시). 다만 소수점 문자열(`'5000.5'`), 앞뒤 공백을 포함한 유효 숫자(`' 5000 '`), 매우 큰 값(`Number.MAX_SAFE_INTEGER` 초과) 같은 형식적 edge case 는 다루지 않는다. `Number.isFinite` 특성상 `'5000.5'` 는 그대로 `5000.5`(비정수 ms)를 반환하는데 이것이 의도인지 문서에 명시돼 있지 않다.
  - 제안: 우선순위 낮음. 실사용 시 정수 문자열만 설정되므로 즉각 리스크는 없다. 필요시 `Number.isInteger` 가드 추가 여부를 판단하고 그에 맞는 테스트를 보강.

## 강점 (참고)

- `llm-call-timeout.spec.ts`: `beforeEach`/`afterEach` 로 env 저장·복원, 독립적으로 실행 가능(테스트 격리 양호). `ai-turn-executor.spec.ts` 신규 케이스들도 `try/finally` 로 env 를 원복해 실패 시에도 오염이 남지 않음.
- 신규 테스트 모두 spec 섹션(§12.16) 을 주석으로 인용하고, "무엇을, 왜" 검증하는지 명확히 서술 — 가독성 우수.
- `withTimeout`(`codebase/backend/src/modules/llm/utils/with-timeout.util.ts`)은 기존에 이미 검증된 프리미티브를 재사용하는 구조라 새 타임아웃 메커니즘을 직접 구현하지 않음 — 테스트 대상 표면을 최소화한 설계.
- 기존 회귀 테스트(LLM attribution/context 전달, tool-loop 2회 호출, resume 상태 전이 등)는 이번 opts 4번째 인자 추가로 인한 인자 위치 변경에도 깨지지 않음(diff 로 확인, 기존 `mock.calls[0][2]` 류 assertion 은 그대로 유효).

## 요약

env 파서(`aiAgentLlmCallTimeoutMs`)의 단위 테스트는 default/override/`0`-비활성/음수·비수치 fallback 을 촘촘히 고정해 우수하다. 반면 `AiTurnExecutor` 통합 레벨 테스트는 default 값과 양수 override 두 경로만 검증하고, 이 기능의 존재 이유인 "`0`=명시적 비활성"이 실제 `chat()` 호출까지 전파되는지, tool-loop 재진입 2개 호출부(4곳 중 절반)에서도 동일하게 동작하는지, `signal` 이 실제 컨텍스트 값으로 정확히 threading 되는지는 검증하지 않는다(`'signal' in opts` 는 사실상 tautology). 이 gap 들은 대부분 공유 함수 재사용 덕분에 실제 버그로 이어질 확률은 낮지만, 하필 이 PR 이 "payload 예산 env 와 달리 `0` 은 유효한 값"이라고 스스로 강조하는 바로 그 계약이 통합 레벨에서 안전망 밖에 있다는 점, 그리고 single-turn 의 uncaught throw(기존 gap, spec 에 명시)가 timeout 이라는 새 흔한 실패 모드로 연결되는데도 회귀 테스트가 없다는 점은 명시적으로 보강할 가치가 있다.

## 위험도

MEDIUM
