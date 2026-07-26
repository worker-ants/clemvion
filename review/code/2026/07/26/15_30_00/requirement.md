# 요구사항(Requirement) Review — 5R: W20 해소 검증 + W19 조치의 executeNode 계약 충돌 여부

## 스코프에 대한 사전 확인

이번 라운드(15_30_00)의 자동 조립 diff 프롬프트(`_prompts/requirement.md`)는 review/ 산출물
파일(13_47_42·14_45_30 라운드의 `*.md`/`meta.json`/`_routing_decision.json`)만 나열하고,
실제 수정 커밋 `0f4047426`("fix(engine): 4R W19·W20 …")의 소스 diff
(`execution-engine.service.ts`/`.spec.ts` 등)는 포함하지 않았다 — diff base 계산이 직전 리뷰
라운드에서 이미 훑은 소스를 changeset 에서 제외하는 것으로 보인다(과거 세션 교훈:
"리뷰 diff base 가 직전 검토 코드 제외"). 위치 표기 규약 상 게이트 숫자를 인용할 수 없는
상황이라, 지시받은 중점(W20 해소 검증 + W19/executeNode 계약 충돌 여부)을 확인하기 위해
`git show 0f4047426`로 실제 커밋 diff를 직접 열고, `Read`로 `execution-engine.service.ts`의
현재 상태(committed, working tree clean)를 대조했다. 아래 위치는 모두 그 파일의 **실제 줄
번호**(Read 결과 기준)다.

## 검증 방법

1. `git show 0f4047426`로 실제 소스 diff 확인.
2. `execution-engine.service.ts`의 `executeNode`(catch 블록, 5761~5952행)와
   `executeWithRetry`(6146~6201행) 전체를 Read로 직접 대조.
3. **Mutation 검증 재실측** — 커밋 메시지가 주장하는 RED/GREEN을 직접 재현했다(신뢰하지 않고
   실행):
   - W20 뮤턴트: `isAbortError(lastError) || err instanceof ExecutionCancelledError` →
     `isAbortError(lastError)`로 되돌림 → `errorPolicy:retry 노드에서도 ExecutionCancelledError
     는 재시도하지 않고 즉시 전파한다 (4R)` 테스트가 `Expected: 1, Received: 4`로 **RED** 확인.
   - W19 뮤턴트: `ExecutionCancelledError` 분기 본문(CANCELLED 마킹+emit 8줄)을 `throw err;`만
     남기고 제거 → `Sub-Workflow(workflow) 노드에서 ExecutionCancelledError 가 발생하면 FAILED
     로 오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W15)` 테스트가 `Expected: "cancelled",
     Received: "running"`으로 **RED** 확인.
   - 두 뮤턴트 모두 `cp` 백업 후 원본으로 복원, `git status --short`로 clean 확인, 전체
     `execution-engine.service.spec.ts` 재실행(420/420 GREEN) 완료.
4. `npx tsc --noEmit`·`npx eslint`로 해당 파일 타입/린트 오류 없음 확인.

## W20 재검증 — 해소 확인

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6180-6189`
  (`executeWithRetry` catch 내부, retry 제외 판정)
- 이전 라운드(W20)가 지적한 결함 — `executeWithRetry`의 재시도 제외 판정이
  `isAbortError(lastError)` 뿐이라 `ExecutionCancelledError`(`name`이 `'AbortError'`가 아님,
  `isAbortError`는 `err.name === 'AbortError'`로만 판정 — `:469-482`)가 걸리지 않아
  `errorHandling.policy:'retry'` 노드에서 취소가 최대 3회 재호출 + 백오프(최대 7초)를 거친
  뒤에야 수렴하던 문제 — 는 `if (isAbortError(lastError) || err instanceof
  ExecutionCancelledError) { throw lastError; }`(:6187-6189) 추가로 **완전히 해소**됐다.
- 타입 정합성도 맞다: `lastError`는 `Error | undefined` 선언이라 `instanceof` 좌변에 쓰면
  TS2358이 나므로 원본 `err`(unknown)로 판정한 것이 올바르다. `ExecutionCancelledError extends
  Error`(`workflow-errors.ts:320`)이므로 `err instanceof Error`가 참인 이 케이스에서는
  `lastError === err`(같은 참조)라, `throw lastError`가 실제로는 원본
  `ExecutionCancelledError` 인스턴스를 그대로 던진다 — 상위 `executeNode` catch의 `err
  instanceof ExecutionCancelledError`(:5822) 판정이 정확히 동작한다(레퍼런스가 보존되므로
  `instanceof`가 깨지지 않음). 위 뮤턴트 재실측으로 실제 방어선임을 확인했다(vacuous 아님).

## W19 조치 — `executeNode`의 기존 계약과 충돌 없음 (확인)

위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5822-5845`
(`executeNode` catch, `ExecutionCancelledError` 분기)

세 가지 기존 계약을 항목별로 대조했다.

1. **errorPolicy 라우팅과 충돌 없음** — `ExecutionCancelledError` 분기(:5822-5845)는
   `const errorPolicyConfig = this.getErrorPolicyConfig(node);` / `this.errorPolicyHandler
   .handleError(...)`(:5848-5853, skip/use_default/route_error/stop 4갈래)에 도달하기 **전에**
   무조건 `throw err`로 빠진다. 이는 바로 위 `isAbortError`(:5768-5796)·`ParkReleaseSignal`
   (:5804-5806) 두 형제 분기와 동일한 우회 패턴이고, spec `node-cancellation.md` §5.2("노드
   상태가 cancelled 여도 dispatch 루프 진행은 노드의 errorPolicy 가 결정한다")가 전제하는
   "cancelled 는 errorPolicy 분류 대상이 아니다"라는 원칙과도 일치한다. `errorHandling.policy:
   'skip'|'use_default'|'route_error'`가 걸린 Sub-Workflow 노드라도 취소는 그 정책을 우회해
   즉시 `cancelled`로 확정되고 상위로 전파된다 — 의도된 동작이다.

2. **`retryCount`와 충돌 없음(단, 부수효과 1건은 W19 신규가 아니라 기존 패턴의 연장)** —
   `ExecutionCancelledError`가 `executeWithRetry` 루프 내부(:6172-6189)에서 발생한 경우,
   `nodeExecution.retryCount = attempt + 1;`(:6178)가 재시도 제외 판정보다 **먼저** 실행되므로,
   실제로는 재시도를 한 번도 안 했어도 저장되는 `retryCount`가 1 이상으로 찍힌다. 다만 이는
   `isAbortError`가 이미 같은 위치·같은 순서로 오래전부터 갖고 있던 특성이고(W20 fix는 그
   조건식에 `||`로 새 분기를 추가했을 뿐 순서를 바꾸지 않았다), `executeNode`의 catch가 이
   `retryCount`를 `errorPolicyHandler.handleError`에 넘기는 지점(:5852)은 cancelled 분기가
   먼저 throw 해 도달하지 않으므로 라우팅 결정에는 전혀 영향을 주지 않는다 — 저장된 DB
   컬럼값의 근소한 부정확성(사소, 기존 특성의 연장)일 뿐 새로운 계약 위반이 아니다.

3. **in-flight 등록/해제와 충돌 없음** — `shutdownState.registerInFlight`(:5552, try 최상단)와
   `unregisterInFlight`(:5951, `finally`)는 catch 블록의 어느 분기가 실행되든(그리고 그 분기
   내부에서 `await`가 여러 번 끼어들든) 예외 처리 흐름상 `finally`가 예외 전파 직전에 반드시
   실행되므로, `ExecutionCancelledError` 분기가 `save`+`emitNode`를 `await`한 뒤 `throw err`
   해도 unregister 는 정상적으로 수행된다. mutation 재실측에서도 unregister 누락으로 인한
   부작용(예: 이후 테스트의 shutdown-state 관련 단언 실패)은 관찰되지 않았다(전체 스위트
   420/420 GREEN).

## 추가 확인 — 회귀 범위

- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 전체
  스위트(420 tests) 정상 상태에서 GREEN, 뮤턴트 상태에서 대상 테스트만 개별 RED — 다른
  테스트가 이 두 분기의 부작용으로 깨지지 않음을 확인했다(교차 오염 없음).
- `npx tsc --noEmit`·`npx eslint … --quiet` 모두 해당 파일에 대해 무오류.
- CHANGELOG.md 항목 8("재시도 정책 노드에서 취소가 재시도되던 결함 수정(ai-review 4R)")이
  W20 수정 내용과 문자 그대로 일치, 항목 7이 W19(터미널 이벤트 보장) 내용을 포함하나 인용은
  "(ai-review W15)"만 달려 있다 — RESOLUTION.md 표는 "W15/W19"로 함께 표기했으므로 의도된
  묶음 서술로 보이며, 기능적 결함이 아니라 인용 정밀도 문제라 documentation 리뷰어 영역으로
  판단해 본 리뷰에서는 결함으로 등록하지 않는다(제 소관 축인 요구사항 충족과 무관).

## 발견사항

새로 보고할 CRITICAL/WARNING 없음. 지시받은 두 질문 모두 검증 결과가 명확했다:

- **W20**: 완전히 해소됨. 코드·mutation 재실측 모두 부합.
- **W19 조치**: `executeNode`의 errorPolicy 라우팅·in-flight 등록/해제 계약과 충돌 없음.
  `retryCount`에 사소한 부수효과가 있으나 이는 `isAbortError`가 이미 갖고 있던 기존 패턴의
  대칭 확장일 뿐 이번 조치가 새로 만든 결함이 아니며, 실질적 라우팅/상태 결정에 영향을 주지
  않는다.

- **[INFO]** `ExecutionCancelledError`로 취소된 `errorHandling.policy:'retry'` 노드는 실제
  재시도를 한 번도 수행하지 않아도 `nodeExecution.retryCount`가 1 이상으로 저장된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6178`
    (`nodeExecution.retryCount = attempt + 1;`)과 `:6187-6189`(재시도 제외 판정)의 순서
  - 상세: `retryCount` 증가가 제외 판정보다 먼저 실행되는 순서는 `isAbortError` 케이스부터
    있던 기존 특성이고, W20 fix는 그 판정 조건에 `ExecutionCancelledError`를 `||`로 추가했을
    뿐 순서를 바꾸지 않았다 — 새로 만든 결함이 아니라 기존 패턴의 대칭 확장이다. 이
    `retryCount` 값은 `errorPolicyHandler.handleError`(라우팅 결정)에 도달하지 않으므로
    기능적 영향은 없고, DB에 저장되는 감사값이 "실제 재시도 0회"인데도 1을 보인다는
    프레젠테이션 상의 근소한 부정확성만 남는다.
  - 제안: 필수 아님. 굳이 정밀화하려면 `nodeExecution.retryCount = attempt + 1;`을
    `isAbortError`/`ExecutionCancelledError` 판정 **이후**로 옮기면 되나, 기존 `isAbortError`
    케이스도 동일하게 고쳐야 일관되므로 이번 diff 단독 범위를 넘는 별도 작업으로 분리하는 편이
    적절하다.

## 요약

지시받은 두 질문(W20 해소 여부, W19의 `executeNode` 기존 계약 충돌 여부)을 코드 직접 대조 +
mutation 재실측(양방향 RED/GREEN 재현)으로 검증했다. W20은 `executeWithRetry`의 재시도 제외
판정에 `err instanceof ExecutionCancelledError`가 정확히 추가되어 완전히 해소됐고, 참조 보존
방식(`lastError === err`)까지 타입 안전하게 처리돼 있다. W19의 CANCELLED 마킹 분기는
`isAbortError`/`ParkReleaseSignal` 두 형제 분기와 동일한 위치·패턴으로 errorPolicy 라우팅을
우회하고, `finally`의 in-flight 해제도 예외 전파 전에 항상 실행되어 기존 계약과 충돌하지
않는다. `retryCount`의 근소한 부수효과 1건(INFO)을 제외하면 새로 보고할 결함이 없다 — 5라운드
누적 검증 결과 이 초점 영역은 안정 상태로 판단한다.

## 위험도

NONE
