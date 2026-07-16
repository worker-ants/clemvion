# 유지보수성(Maintainability) 리뷰 — AI Agent LLM chat 타임아웃 (항목 B) + 관련 파일

> router 가 diff 를 docs-heavy 로 오판했으나 `git diff origin/main HEAD --stat` 로 실측한 결과
> `codebase/backend/src/nodes/ai/ai-agent/{llm-call-timeout.ts,llm-call-timeout.spec.ts,
> ai-turn-executor.ts,ai-turn-executor.spec.ts,tool-payload-budget.ts,tool-payload-save-warning.ts,...}`
> 등 22개 코드 파일·1792줄 삽입이 실재한다. 지시대로 항목 B(`llm-call-timeout.ts`,
> `ai-turn-executor.ts` 4개 chat 호출, `errorPayload.details` eslint-disable)를 핵심으로
> 검증하고, 시간 예산 내에서 같은 diff 의 항목 A(`tool-payload-save-warning.ts`,
> `workflows.service.ts`)도 훑었다. `eslint --report-unused-disable-directives` 실측 +
> 캐스트를 임시 제거한 `tsc --noEmit` 실측으로 코드가 아니라 실제 툴 출력으로 검증했다.

## 발견사항

- **[WARNING]** `ai-turn-executor.ts` 의 4개 chat 호출 중 tool-loop 재호출 2곳은 `timeoutMs` 배선을 검증하는 회귀 테스트가 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1689`(single-turn 최초 호출) / `:1820`(single-turn tool-loop 재호출) / `:2779`(resume 최초 호출) / `:2923`(resume tool-loop 재호출)
  - 상세: 4곳 모두 `{ signal: ..., timeoutMs: aiAgentLlmCallTimeoutMs() }` 를 opts 로 넘기도록 배선돼 있고 코드 자체는 올바르다. 그런데 신규 테스트(`ai-turn-executor.spec.ts`)는 `mockLlmService.chat.mock.calls[0][3]` 만 단언한다 — 즉 **최초 호출**(L1689, L2779) 두 곳만 `timeoutMs`/`signal` 키 존재를 고정하고, **tool-loop 재호출**(L1820, L2923)의 opts 는 어떤 테스트도 인덱스 `[1][3]` 로 검사하지 않는다(같은 파일의 기존 테스트가 `mock.calls[1][2]` 로 3번째 인자(llmContext)는 검증하지만 4번째 인자(opts)는 검증하지 않음, L593 부근). tool-loop 재호출은 한 turn 안에서 여러 차례 LLM 을 다시 부르는 경로라 "무기한 hang" 리스크가 가장 높은 지점인데, 향후 리팩터링(예: 인자 순서 변경·옵션 객체 병합)이 이 두 사이트에서만 실수로 `timeoutMs` 를 누락시켜도 어떤 테스트도 실패하지 않는다.
  - 제안: `mockLlmService.chat.mock.calls[1][3]` 에 대해서도 `timeoutMs`/`signal` 키 존재를 고정하는 테스트를 (기존 "does not count condition tools..." 류 tool-loop 테스트에 이어 붙이거나 별도 `it` 로) 추가. 근본적으로는 아래 INFO 의 헬퍼 추출과 묶어 "모든 chat 호출이 공통 opts 빌더를 거친다"는 구조적 보장으로 대체하는 편이 더 견고하다.

- **[INFO]** 4개 chat 호출 사이트가 `{ signal, timeoutMs: aiAgentLlmCallTimeoutMs() }` 리터럴을 반복
  - 위치: 위와 동일 4개 라인(L1689/L1820/L2779/L2923)
  - 상세: 한 줄짜리 duplication 이라 즉각적인 가독성 문제는 아니지만, 각 사이트가 `context.abortSignal` 또는 `options?.signal` 로 signal 소스만 다르고 나머지는 완전히 동일한 패턴을 손으로 반복한다. 타입 시스템이 "새 chat 호출을 추가할 때 timeoutMs 를 잊지 말라"를 강제하지 않으므로, 위 WARNING 의 테스트 공백과 결합하면 실수 유입 경로가 된다. 각 사이트에 붙은 "§12.16 defense-in-depth" 주석도 문구만 살짝 다르게 4번 반복돼 있다.
  - 제안: `private llmCallOpts(signal?: AbortSignal) { return { signal, timeoutMs: aiAgentLlmCallTimeoutMs() }; }` 같은 사설 헬퍼로 추출하면 (a) 중복 제거, (b) 주석을 헬퍼 한 곳에만 남기면 되고, (c) 헬퍼 자체를 단위 테스트하면 4개 호출 사이트 전부가 자동으로 커버리지를 상속한다. 우선순위는 낮음(현재도 정확히 동작) — 위 WARNING 의 테스트 공백을 메우는 김에 함께 고려할 만하다.

- **[INFO]** `errorPayload.details` 캐스트의 `eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion` — 실측 검증 결과 타당함
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3288-3294`
  - 상세: 주석의 주장("캐스트 제거 시 tsc TS2339 로 빌드 실패")을 직접 재현해 확인했다 — 캐스트만 제거하고 `npx tsc --noEmit` 를 돌리면 정확히 `error TS2339: Property 'retryable' does not exist on type '{}'.` 가 발생한다(`errorPayload.details` 가 `unknown` 이고, `?? undefined` 후 TS 가 `NonNullable<unknown>` 을 `{}` 로 좁히기 때문). 반대로 disable 주석을 제거하고 캐스트만 남긴 채 `eslint --report-unused-disable-directives` 를 돌리면 `no-unnecessary-type-assertion` 경고가 실제로 발생한다 — eslint 의 타입 분석이 "모든 프로퍼티가 optional 인 타입은 `{}` 와 구조적으로 호환"이라는 assignability 규칙을 프로퍼티 접근 가능 여부와 혼동해 캐스트를 불필요로 오판하는, tsc 와 eslint 사이의 알려진 간극이다. 즉 disable 이 없으면 (a) lint 는 캐스트를 지우라 하고 (b) `eslint --fix` 가 실제로 지우면 (c) tsc 빌드가 깨지는 3단 함정이 실재하며, 주석이 이 함정을 정확히 서술하고 재발 방지(disable 로 고정)까지 해 두었다. 리뷰 대상 코드 중 가장 성숙한 방어적 문서화 사례.
  - 제안: 조치 불필요(검증 완료). 다만 향후 유사 `unknown` narrowing 이 반복된다면, 타입가드 함수(`function hasRetryableFlag(d: unknown): d is { retryable?: unknown }`)로 옮기면 이 tsc/eslint 간극 자체를 원천적으로 피할 여지가 있다 — 지금 당장 바꿀 실익은 낮음(우선순위 최하).

- **[INFO]** `llm-call-timeout.ts` 의 `0`-처리 차이 — 문서화·테스트 모두 명확함, 확인 완료
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.ts:16-37` vs `tool-payload-budget.ts:22-41`(`readEnvNumber`)
  - 상세: `readEnvNumber`(payload 예산 3개 env 공용)는 `n > 0` 만 허용해 `0`/음수를 모두 fallback 으로 되돌리는 반면, `aiAgentLlmCallTimeoutMs()` 는 `n >= 0` 을 허용해 `0` 을 "명시적 비활성"으로 존중한다 — 정반대 극성이다. 이 차이가 (1) `llm-call-timeout.ts` JSDoc 에 "payload 예산 env 와 다르다" 로 명시, (2) `llm-call-timeout.spec.ts` 에 전용 테스트(`'treats 0 as a valid "disabled" value (NOT a fallback)'`)로 고정, (3) 순수 whitespace(`'   '`) 입력이 `Number()` 변환 시 `0` 이 돼 의도치 않게 "비활성"으로 오인되는 것을 막기 위해 `raw.trim() === ''` 사전 체크까지 두고 별도 테스트로 커버돼 있다. 두 함수가 유사한 "env 숫자 파싱" 로직을 각자 손으로 구현(공용 유틸 미추출)하는 점은 중복이라면 중복이지만, 극성이 반대인 두 파서를 하나의 파라미터화된 함수로 합치면 오히려 가독성이 떨어질 수 있어(예: `allowZero` 플래그 하나로 두 정책을 감추는 것보다 지금처럼 파일 분리 + 명시적 JSDoc 대비가 더 명확) 현재 구조를 유지하는 편이 낫다고 판단.
  - 제안: 조치 불필요(확인 완료, 정보 제공 목적).

- **[INFO]** `ai-turn-executor.spec.ts` 신규 테스트 3건의 env save/restore 스타일이 같은 PR 의 다른 spec 파일과 다름
  - 위치: `ai-turn-executor.spec.ts` L88-133(2건), L487-511(1건) vs `llm-call-timeout.spec.ts` L10-17, `tool-payload-budget.spec.ts` `ENV_KEYS`+`beforeEach`/`afterEach` 패턴
  - 상세: 같은 PR 이 건드린 `llm-call-timeout.spec.ts`/`tool-payload-budget.spec.ts` 는 describe 블록 상단 `beforeEach`(저장)/`afterEach`(복원)로 env 격리를 중앙화한다. 반면 `ai-turn-executor.spec.ts` 에 새로 추가된 3개 테스트는 각 `it` 내부에서 `const prev = process.env[...]; try { ... } finally { ... }` 를 매번 손으로 반복한다(기존 파일에 전역 env 격리 패턴이 없어 로컬 관행을 새로 만든 것으로 보임). 기능적으로는 안전하지만, 같은 작업(§12.16)이 건드린 3개 spec 파일 사이에 env 격리 스타일이 통일돼 있지 않다.
  - 제안: 우선순위 낮음. `ai-turn-executor.spec.ts` 전체에 env 를 다루는 테스트가 이번이 처음이라 지금 당장 전역 패턴을 강제할 필요는 없으나, 이 파일에 env 관련 테스트가 더 늘어나면 사설 헬퍼(`withEnv(key, value, fn)`)나 sibling 파일과 동일한 `beforeEach`/`afterEach` 패턴으로 통일할 것을 권장.

## 요약

항목 B(`llm-call-timeout.ts` + `ai-turn-executor.ts` 4개 chat 호출 타임아웃 배선)는 전반적으로 유지보수성이 양호하다. 신규 env 파서는 기존 payload 예산 파서와의 `0`-처리 극성 차이를 JSDoc·전용 테스트 양쪽에서 명시적으로 고정해 향후 개발자가 두 함수를 혼동할 위험을 낮췄고, `errorPayload.details` 캐스트에 붙은 eslint-disable 은 "제거 시 tsc 빌드 실패·eslint --fix 가 실제로 이를 깬 landmine 확인"이라는 주장을 `eslint --report-unused-disable-directives` + `tsc --noEmit` 로 직접 재현해 검증한 결과 타당하며, 오히려 이 저장소에서 보기 드물게 성숙한 방어적 문서화 사례다. 유일하게 실질적인 개선 여지는 4개 chat 호출 사이트 중 tool-loop 재호출 2곳(가장 hang 위험이 높은 경로)이 `timeoutMs` 배선에 대한 회귀 테스트를 갖고 있지 않다는 점(WARNING)이며, 이는 4개 사이트의 반복 리터럴을 사설 헬퍼로 추출하면서 함께 해소할 수 있는 저비용 개선이다. 항목 A(`tool-payload-save-warning.ts`, `workflows.service.ts`) 쪽도 짧게 훑었는데 함수 분리·문서화·N+1 회피 등이 잘 돼 있어 이번 리뷰 범위(항목 B 핵심)에서는 추가 지적 사항을 찾지 못했다.

## 위험도

LOW
