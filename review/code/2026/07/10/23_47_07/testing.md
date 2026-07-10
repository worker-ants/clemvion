# 테스트(Testing) Review — fresh re-review (post-resolution, commit `bd15f63f6`)

## 검증 대상 및 방법

이번 리뷰는 `review/code/2026/07/10/23_20_30/RESOLUTION.md` §보류·후속 항목 2 의 **defer 근거를 독립 재검증**하는 것이
1차 목적이다. 해당 근거는: "`runTurnWithCollectionRetries` 가 루프 전체에서 `params.llmContext` 동일 참조
하나만 재대입 없이 넘기고 `traceChat` 도 가공 없이 전달한다 → 역방향 회귀(원래 `undefined`인데 재시도 시
값이 새어 들어감)는 발생 경로가 없다" 는 주장이다.

실제 워크트리(`llm-usage-attr-hardening-4648ca`, `bd15f63f6`)의 소스를 직접 읽어 확인했다 (정적 diff 만 본
것이 아니라 `git show`/`grep`/전체 함수 본문을 직접 열람):

1. `information-extractor.handler.ts:981-1146` (`runTurnWithCollectionRetries`, `for (;;)` 무한 루프):
   - 루프 내부 어디에도 `params.llmContext = ...` 또는 `params = ...` 형태의 재대입이 없다
     (`grep -n "params\.llmContext\s*=\|params\s*="` 결과 0건).
   - 유일한 소비 지점은 `:1037` `params.llmContext` — 매 반복 `traceChat` 호출의 4번째 인자로 **그대로**
     전달된다. 캡처된 참조는 함수 진입 시 `params` 인자 하나뿐이라 반복 간 값이 달라질 수 없다.
2. `information-extractor.handler.ts:1881-1899` (`traceChat`):
   - `llmContext` 파라미터를 `this.llmService.chat(llmConfig, params, llmContext, { signal })` 로 그대로
     전달할 뿐, 병합·기본값 대체·캐싱 등 어떤 변형도 하지 않는다.
3. `llm.service.ts:154-197` (`LlmService.chat`) 까지 한 단계 더 내려가 확인:
   - `context?.workflowId` / `context?.executionId` / `context?.nodeExecutionId` 를 **매 호출마다 인자로
     받은 값에서 직접 읽어** `usageLogService.record(...)` 에 넘긴다. 호출 간 공유 상태·배치·메모이제이션이
     없어 한 호출의 `context` 가 다른 호출로 새어 들어갈 메커니즘 자체가 없다.
4. 호출부 두 곳(`:789-793` `executeMultiTurn`, `:891-897` `processMultiTurnMessage`)도 확인 — `llmContext`
   는 `runTurnWithCollectionRetries` 호출 시점에 **한 번** 계산되어 `params` 로 전달될 뿐, 루프가 시작된
   이후에는 그 값을 바꿀 코드 경로가 없다. `retryState()` 기본값(override 없음)은 `executionId` 필드 자체가
   없으므로(`:970-992` 헬퍼 확인) `state.executionId` 가 `undefined` → `llmContext: undefined` 로 매 반복
   동일하게 전달된다.

**결론: 주장은 사실과 일치한다.** 코드베이스에 "처음엔 `undefined`, 재시도부터 값이 새어 들어간다" 는
실패 모드가 발생할 수 있는 경로가 실제로 존재하지 않는다 — `params.llmContext` 는 함수 진입 시 확정되는
불변 참조이고, 그 이후의 모든 소비 지점(`traceChat`→`LlmService.chat`)이 순수 read-through 이기 때문이다.
**따라서 INFO#3 defer 는 타당하며, 이번 재검증으로 Warning 을 새로 제기할 근거가 없다.**

## 이번 커밋(`bd15f63f6`)의 diff 자체에 대한 테스트 관점 검토

`git show bd15f63f6 -- codebase/` 로 재확인한 결과, 코드 diff는 `ai-turn-executor.ts:2599-2604` 의 **주석
문구만** 정정됐다 (실행문은 `const llmContext: LlmCallContext = {...}` 로 이전과 동일, 우변 값 표현식
무변경). `information-extractor.handler.spec.ts` 는 이번 커밋에서 **한 글자도 변경되지 않았다** — 이전
세션(`23_20_30`)에서 이미 리뷰한 신규 테스트(`passes the same llmContext attribution to the retried (2nd)
chat call`)가 그대로 유지된다.

## 발견사항

- **[INFO]** 회귀 defer 근거 독립 재검증 — 사실과 일치 확인 (본 리뷰의 핵심 산출물)
  - 위치: `information-extractor.handler.ts:1019-1145`(루프), `:1881-1899`(`traceChat`), `llm.service.ts:154-197`(`chat`)
  - 상세: 위 "검증 대상 및 방법" 절 참고. `params.llmContext` 는 함수 스코프 내 재대입 0건, 소비 체인
    전체(`traceChat` → `LlmService.chat` → `usageLogService.record`)가 매 호출 인자 값을 그대로 읽기만
    하고 어떤 반복 간 상태도 공유하지 않는다. 역방향 회귀는 코드 구조상 원천적으로 발생할 수 없다.
  - 제안: 없음 — defer 유지가 타당함을 확인. RESOLUTION §2 의 "재검토 조건"(루프 내부에서 `llmContext`
    재계산/변형이 도입되면 즉시 assertion 추가) 은 여전히 유효한 안전장치이므로 그대로 둔다.

- **[INFO]** 테스트 코드 변경 없음 확인 — 회귀 리스크 없음
  - 위치: `information-extractor.handler.spec.ts` (diff 0, `git show bd15f63f6` 로 확인)
  - 상세: 프롬프트가 명시한 대로 이번 resolution 커밋은 주석/문서만 변경했다. 이전 세션 `testing.md`
    (23_20_30)가 이 테스트 파일에 대해 내린 판단(가독성 우수·mock 격리 적절·mutation 검증으로 vacuous
    아님이 실증됨·유일한 갭은 INFO#3 대칭 커버리지)은 전부 여전히 유효하며 재작업 불필요.
  - 제안: 없음.

- **[INFO]** `ai-turn-executor.ts` 주석 정정이 테스트 서술과 상충하지 않음
  - 위치: `ai-turn-executor.ts:2599-2604`
  - 상세: 정정된 문구("object literal 이 타입이 알려진 대상(함수 인자 또는 주석 붙은 변수)에 직접
    assign 될 때만 걸린다")는 RESOLUTION.md 의 mutation 검증 결과(주석 있음 → `nodeExecutionID` 오탈자
    주입 시 `TS2561` 컴파일 차단, 주석 없음 → 무오류)와 정확히 부합한다. 실행문 자체는 무변경이라
    `ai-turn-executor.spec.ts` 의 기존 회귀 테스트(2회차 chat attribution 단언 포함)에 어떤 영향도 없다.
  - 제안: 없음.

## 회귀 테스트 유효성 재확인

- `information-extractor.handler.spec.ts` 신규 테스트는 diff 가 없으므로 이전 세션의 mutation 검증
  결과(루프를 "첫 반복만 llmContext 전달·재시도는 undefined" 로 변조 → 신규 테스트 단독 실패, 기존
  35건은 통과)가 그대로 유효하다. 이번 재검증으로 그 실패 모드가 **코드 구조상 유일하게 가능한 실패
  모드**(반대 방향은 경로 자체가 없음)임을 한 번 더 확인했다.
- `ai-turn-executor.ts` 의 주석 전용 변경은 `ai-turn-executor.spec.ts` 31개 테스트(RESOLUTION.md 기록)에
  영향을 줄 수 없는 순수 no-op — 별도 재실행 불필요.

## 요약

프롬프트가 요청한 핵심 검증 — "`runTurnWithCollectionRetries` 가 `params.llmContext` 동일 참조를 재대입
없이 넘기고 `traceChat` 이 가공 없이 전달한다" — 을 `information-extractor.handler.ts` 의 루프 본문·
`traceChat`·`LlmService.chat` 까지 직접 추적해 **독립적으로 사실로 확인**했다. 코드에 재대입 지점이 없고
소비 체인 전체가 호출별 인자 값을 그대로 읽기만 하므로, "원래 `undefined`인데 재시도 시 값이 새어
들어간다" 는 역방향 회귀는 발생 경로 자체가 없다 — INFO#3 의 defer 는 타당하며 Warning 으로 격상할
근거가 없다. 이번 resolution 커밋(`bd15f63f6`)은 테스트 코드를 전혀 건드리지 않았고(주석/문서만 변경),
이전 세션의 테스트 관점 판단(신규 회귀 테스트 1건 — 가독성 우수, mock 격리 적절, mutation 검증으로
vacuous 아님이 실증됨)은 모두 그대로 유효하다. Critical/Warning 없음.

## 위험도

NONE
