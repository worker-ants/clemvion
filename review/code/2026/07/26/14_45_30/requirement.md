# 요구사항(Requirement) 리뷰 — review/code/2026/07/26/14_45_30 (4R)

## 사전 확인 — 프롬프트 번들 구성 (메타 관찰, 판정에는 영향 없음)

`_prompts/requirement.md` 에 첨부된 "변경된 코드" 11개 파일은 전부 `review/code/2026/07/26/13_47_42/*.md`
(직전 라운드 review 산출물 자신)이고, 이번 라운드가 실제로 검증해야 할 코드 수정 커밋
(`2ca6ada66` "fix(engine): SUMMARY W14-W18 …")의 `codebase/**` diff 는 프롬프트 번들에
포함되어 있지 않다(`git log` 확인: `615b43430`(3R SUMMARY 문서 커밋) → `2ca6ada66`(W14-W18
코드 fix) → `06eba6334`(3R RESOLUTION 문서 커밋) 순서인데, 프롬프트는 `615b43430` 한 건의
diff만 담고 있다 — diff-base 계산이 한 커밋 앞선 것으로 보인다). 이는 이전에 기록된 "리뷰
diff base 가 stale 하면 라우터가 거짓 PASS" 패턴과 같은 계열의 harness 증상이나, 본 라운드의
실제 검증 대상(W17 해소 여부·W15 재throw와 retry 상호작용)은 코드 자체를 직접 열어야만
판단 가능한 사안이라 `git show 2ca6ada66` + 관련 소스 파일을 `Read`로 직접 대조해 검증을
완료했다. 아래 위치 인용은 모두 워크트리의 실제 파일 줄 번호(Read 결과 그대로)다.

---

## 최우선 검증 ①: W17(스로틀 회귀 테스트 wall-clock flaky) 해소 여부

**결론: 해소 확인.**

`codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 의
`'짧은 간격 내 아이템 경계 반복은 실제 DB 조회를 1회로 스로틀한다 (W10)'` 테스트(커밋
`2ca6ada66` diff 상 `@@ -10217,11 +10301,22 @@` 위치)가 이제 다음과 같이 시간을 고정한다:

```ts
const simulatedNow = Date.now();
const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => simulatedNow);
```

- `Date.now()` 가 테스트 실행 내내 상수 하나만 반환하도록 스텁되어, 아이템 10개가 실제
  경과 시간과 무관하게 항상 250ms 스로틀 창 안에 있는 것으로 관측된다 — 자매 테스트(C3)가
  쓰던 `jest.spyOn(Date, 'now')` 패턴과 동형이며, C3 가 "창을 넘긴다"는 목적으로 시각을
  전진시키는 것과 달리 이 테스트는 "창을 항상 유지"하는 목적이므로 값을 고정만 하는 것이
  올바른 구현이다.
- 테스트 종료 시 `nowSpy.mockRestore()` 로 정리(다음 테스트로 스텁이 누출되지 않음).
- 직전 라운드가 지적한 근본 원인(`Date.now()` 무통제 → 시스템 부하 시 아이템 간 실제 간격이
  250ms 를 초과해 `findOne` 이 11회 호출되며 `toBeLessThan(itemCount)` 단언이 실패)이 이제
  구조적으로 발생할 수 없다 — 시각이 실행 환경 속도와 완전히 분리됐다.
- 커밋 메시지도 "mutation 3/3 회 안정적으로 RED 확인"을 주장한다. 직접 mutation 재현은
  하지 않았으나(직전 라운드에서 이미 40회 반복 재현으로 결함을 실측했으므로 재현 부담이
  비대칭적으로 크다), 수정 방향(시간 고정)은 flaky 의 근본 원인을 논리적으로 완전히 제거하는
  방식이라 재발 여지가 없다고 판단한다.

W17 은 재차 WARNING 으로 내지 않는다.

---

## 최우선 검증 ②: W15 재throw가 `executeNode` 기존 errorPolicy 처리(error 포트 라우팅·retry)와 충돌하는지

**결론: 기본(비-retry) 경로는 충돌 없이 정확히 동작. 다만 `errorPolicy: 'retry'` 조합에서
재throw 가 우회되는 미검증 gap 을 새로 발견했다 (아래 발견사항 WARNING).**

### 정상 동작 확인 (default/`stop_workflow` 등 대부분의 정책)

`execution-engine.service.ts` `executeNode` 의 catch 블록(5758행 시작) 순서:

```
5765: if (isAbortError(err)) { ... throw err; }          // §5.1 AbortError → cancelled
5801: if (err instanceof ParkReleaseSignal) { throw err; } // park 신호
5812: if (err instanceof ExecutionCancelledError) { throw err; } // ← 신규 W15 가드
5817: const errorPolicyConfig = this.getErrorPolicyConfig(node);
5818: const result = this.errorPolicyHandler.handleError(...);
      switch (result.action) { case 'skip': ... }
```

- `ExecutionCancelledError` 의 `name` 은 `'ExecutionCancelledError'`(`workflow-errors.ts:329`)이고
  `isAbortError`(`execution-engine.service.ts:469-482`)는 `name === 'AbortError'` 만 매치하므로,
  두 분기는 서로 겹치지 않는다 — W15 가드가 §5.1 AbortError 분류를 가로채거나 오분류할 위험 없음.
- W15 가드는 `errorPolicyHandler.handleError`(5818) **이전**에 위치해 `skip`/`use_default_output`/
  `route_to_error_port` 등 어떤 errorPolicy 로도 흡수되지 않고 항상 우회 재throw 된다.
- `isErrorPortRouted`(5688, 성공 경로 전용 분기)와도 교차하지 않는다 — `ExecutionCancelledError` 는
  항상 throw 경로이므로애초에 그 성공-경로 분기에 도달하지 않는다.
- 검증 테스트: `execution-engine.service.spec.ts:5745-5790` (`Sub-Workflow(workflow) 노드에서
  ExecutionCancelledError 가 발생하면 FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지 않는다
  (W15)`) — `node.config = {}`(errorHandling 미설정 → 기본 `stop_workflow`)로 `handler.execute`
  가 1회만 호출됨(재시도 없음)과 `NodeExecution.status !== FAILED`, `NODE_FAILED` 미emit,
  `execution.cancelled` emit 을 모두 단언 — 코드와 정확히 일치.

### 신규 발견 — `errorPolicy: 'retry'` 조합에서 W15 가드가 우회된다

아래 발견사항 참조.

---

## 발견사항

- **[WARNING]** `errorHandling.policy === 'retry'` 가 설정된 Sub-Workflow(`workflow`) 노드에서
  취소(`ExecutionCancelledError`)가 재시도 대상으로 오분류되어, W15 가 막으려던 것과 같은
  클래스의 부수효과(취소 후 추가 dispatch + 지연)가 retry 경로를 통해 재도입된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6142-6161`
    (`executeWithRetry` 의 재시도 루프), 특히 `:6149-6152`
    (`// abort 는 재시도 대상이 아님 — cancellation 은 terminal 이므로 즉시 전파.` 주석과
    `if (isAbortError(lastError)) { throw lastError; }` — `ExecutionCancelledError` 는
    체크되지 않음). 대조: `:469-482`(`isAbortError` 정의, `name === 'AbortError'` 만 매치) ·
    `codebase/backend/src/modules/execution-engine/workflow-errors.ts:320-331`
    (`ExecutionCancelledError` 생성자가 `this.name = 'ExecutionCancelledError'` 로 설정,
    `'AbortError'` 와 다른 이름) · `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:195-197`
    (sync 모드 `execute()` 가 `executeInline` 에서 받은 `ExecutionCancelledError` 를 삼키지 않고
    그대로 재throw — C1 fix).
  - 상세:
    - `executeNode` 는 `executeWithRetry`(`:6115-6164`)를 호출해 노드를 실행한다(`:5638-5645`).
      `errorPolicyConfig.policy !== 'retry'` 인 경우(기본값 `stop_workflow` 포함 대다수)는
      `handler.execute(...)` 를 그대로 반환하므로(`:6131-6133`), 그 안에서 던져진
      `ExecutionCancelledError` 는 `executeWithRetry` 를 그대로 통과해 `executeNode` 의 catch(`:5758`)
      까지 곧장 전달되고, 거기서 이번에 추가된 W15 가드(`:5812-5814`)가 정확히 잡아 재throw한다 —
      이 경로는 위 "정상 동작 확인"에서 검증됨.
    - 그러나 `policy === 'retry'` 면 `handler.execute(...)` 호출이 `try { ... } catch (err) { ... }`
      루프(`:6143-6160`) 안에서 이뤄진다. Sub-Workflow(`workflow`) 노드 타입의 `handler.execute`
      (`workflow.handler.ts:58-200`)는 sync 모드에서 `executeInline` 이 §2.3 노드-경계 취소 가드
      (`assertExecutionNotCancelled`)로 관측한 `ExecutionCancelledError` 를 자기 catch(`:178-199`)
      에서 **그대로 재throw** 한다(`:195-197`, C1 fix — error 포트로 흡수하지 않음). 이 재throw 된
      에러가 바로 `executeWithRetry` 의 재시도 루프 catch(`:6145`)로 떨어진다.
    - 루프의 유일한 "재시도 제외" 판정은 `isAbortError(lastError)`(`:6150`)뿐이고,
      `ExecutionCancelledError` 는 `name` 이 다르므로 이 조건에 걸리지 않는다. 결과적으로
      `attempt < retryConfig.maxRetries` 이면(`:6154`) `await this.sleep(delay)` 후 루프를 이어가
      **취소된 서브워크플로우를 다시 실행**한다 — 기본값 기준(`maxRetries=3`,
      `retryInterval=1000`, `backoffMultiplier=2`) 최대 3회 추가 `executeInline` 호출 +
      `1000+2000+4000=7000ms` 의 누적 백오프 지연이 발생한 뒤에야(`:6163`) 최종적으로
      `lastError`(여전히 `ExecutionCancelledError`)가 `executeNode` catch 로 전달되어 W15
      가드가 올바르게 재throw 한다 — **최종 상태는 결국 `cancelled` 로 수렴**하지만, 그 사이
      취소 후 재시도(추가 dispatch)와 수 초 단위 관측 지연이 재도입된다.
    - `executeWithRetry` 의 재시도-제외 주석 자체("cancellation 은 terminal 이므로 즉시 전파")가
      이 동작을 명시적으로 금지하고 있음에도, 실제 조건식은 `isAbortError` 하나만 검사해
      §2.3 계열 취소(`ExecutionCancelledError`)를 놓친다 — 코드 자신의 의도와 구현이 어긋난
      사례(선언한 의도 vs 실제 조건식의 괴리).
    - 재현 가능성: `errorHandling.policy: 'retry'` 는 노드 공통 설정(`node-common.md §2.4`)이라
      Sub-Workflow 노드 타입에 대한 별도 제외가 코드(`workflow.schema.ts`) 나 프론트엔드 설정
      패널(`node-settings-panel.tsx:213` — `policy === 'retry'` 분기에 노드 타입 조건 없음)
      어디에도 없어, 실사용자가 UI 에서 그대로 구성 가능한 조합이다.
    - 이번 라운드가 "W15 는 W9(runContainer)와 동형 결함 해소"로 정리했지만, W9 쪽(컨테이너
      경로)은 이 retry 루프를 거치지 않는 별도 dispatch 경로라 이 gap 이 없다 — Sub-Workflow
      노드에서만 성립하는 잔여 비대칭.
    - 테스트 커버리지: `execution-engine.service.spec.ts:5679-5733` 의 W3 테스트가
      "retry policy + `AbortError`" 조합만 `handler.execute` 1회 호출로 고정하고, 같은 줄
      바로 아래 W15 테스트(`:5745-5790`)는 `node.config = {}`(비-retry, 기본 정책)로만 검증한다
      — "retry policy + `ExecutionCancelledError`" 조합은 어느 테스트도 다루지 않는다(회귀
      커버리지 0).
  - 제안: `executeWithRetry` 의 재시도 루프(`:6150` 부근)에 `isAbortError` 와 대칭으로
    `if (err instanceof ExecutionCancelledError) throw lastError;` (또는 두 조건을 OR로 묶어
    "취소류는 재시도 제외") 를 추가한다. 이미 같은 파일에 `ExecutionCancelledError` 가 import
    되어 있어(`:28`) 추가 비용이 낮다. 회귀 테스트는 W3 패턴을 그대로 복제해 `workflow` 노드
    타입 + `errorHandling.policy: 'retry'` + `ExecutionCancelledError` throw 조합에서
    `handler.execute` 가 1회만 호출되는지 단언하면 된다.

- **[INFO]** 이번 커밋(`2ca6ada66`)이 3R `documentation.md` WARNING("plan 문서의 best-effort
  인용이 §5 대신 §2.2 를 가리켜야 함")과 INFO("CHANGELOG/테스트 주석의 '200~300ms' 표기가
  실채택 250ms 를 명시하지 않음")를 이미 함께 해소했다 — 확인만, 새 결함 아님.
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md:177`
    (`§5(AbortError 분류)` → `§2.2(CPU 바운드 / 즉시 완료 노드)` 로 정정된 diff 확인),
    `CHANGELOG.md:14`(`"200~300ms"` → `"200~300ms 권장 범위, 실채택 250ms"`).
  - 상세: `git show 2ca6ada66 -- plan/... CHANGELOG.md` 로 직접 diff 대조해 확인. 커밋 메시지의
    "INFO: plan 의 'best-effort' 인용을 §5 → §2.2 로 정정, CHANGELOG·테스트 주석에 실채택
    250ms 를 명시" 주장과 실제 diff 가 문자 그대로 일치한다.
  - 제안: 없음(참고 기록).

## 참고 (검증했으나 새 결함 없음 — W14/W16/W18)

- **W14(background Map 누수)** — `execution-engine.service.ts:6941-6951`
  (`executeBackgroundSubgraph` finally)에 `this.containerCancelCheckedAtMs.delete(job.executionId)`
  가 추가됐다. `job.executionId` 가 부모 세그먼트와 공유하는 실제 Map 키와 동일함을
  확인(`:6890-6897` 의 `executeInline` 호출도 같은 `job.executionId` 사용). 3R `concurrency.md`
  가 제안한 수정 위치·키와 정확히 일치. 회귀 테스트
  `execution-engine.service.spec.ts` `'cleans up containerCancelCheckedAtMs ... (W14 background
  leak regression)'` 이 Map 을 미리 `set()` 해 두고 `executeBackgroundSubgraph` 실행 후
  `has(executionId) === false` 를 직접 단언 — 커버리지 확보.
- **W16(retry-turn error 노출)** — `retry-turn.service.ts:642-653` 에서 `isCancelled` 판정을
  한 번만 평가해 재사용하고 `if (!isCancelled) { execution.error = ... }` 로 가드했다.
  `retry-turn.service.spec.ts` 가 취소 케이스(`execution.error` 를 `toBeUndefined()`)와 일반
  실패 케이스(`execution.error` 를 `toEqual({message:'boom'})`) 양쪽을 대조군으로 단언 —
  회귀 방지 확실.
- **W18(스로틀 Map 정리 커버리지)** — 정상 종결 경로(`실행이 정상 종결되면
  containerCancelCheckedAtMs 에서 executionId 키가 제거된다`)와 LoopExecutor 대칭 취소
  테스트가 추가됐다. `loop-executor.ts` 자체 코드 변경은 없음(3R 분석대로 "코드 변경 불요"가
  맞았고 이번엔 그 주장을 고정하는 테스트만 추가) — `loop-executor.ts` diff 없음을
  `git show --stat 2ca6ada66` 로 확인.
- **TODO/FIXME/HACK/XXX** — `git show 2ca6ada66` 전체 diff 에 신규 마커 없음(grep 확인).
- **spec/ 변경 여부** — 이번 커밋은 `spec/**` 를 건드리지 않는다(diff stat 확인) — developer
  쓰기 권한 범위 준수.

## 요약

W17(스로틀 회귀 테스트의 wall-clock 의존 flakiness)은 `jest.spyOn(Date, 'now')` 로 시각을
완전히 고정하는 방식으로 근본 원인을 제거해 해소를 확인했다. W15 재throw
(`if (err instanceof ExecutionCancelledError) throw err;`, `executeNode` catch)는 기본
`stop_workflow` 등 대다수 errorPolicy 조합에서 `errorPolicyHandler.handleError`·error 포트
라우팅과 충돌 없이 정확히 우회 재throw 하며 전용 회귀 테스트로 고정돼 있다. 다만 이번 검증
중 새로 발견한 사항으로, `errorHandling.policy: 'retry'` 가 설정된 Sub-Workflow 노드에서는
그 재throw 지점(`executeNode` catch) 에 도달하기 **전에** `executeWithRetry` 의 재시도 루프가
`ExecutionCancelledError` 를 일반 실패로 오인해 최대 3회까지 재시도(+누적 최대 7초 백오프)한
뒤에야 최종적으로 `cancelled` 로 수렴한다 — `executeWithRetry` 자신의 "cancellation 은 terminal"
주석과 실제 조건식(`isAbortError` 전용)이 어긋나는 gap 이며, W9/W15 가 막던 "취소 후 추가
dispatch" 부수효과가 이 특정 조합(재시도 정책 + Sub-Workflow)에서 축소된 형태로 재도입된다.
UI/스키마 어디에도 이 조합을 막는 장치가 없어 실사용자가 구성 가능하고 회귀 테스트도 없다.
그 외 W14(background Map 누수)·W16(retry-turn error 노출)·W18(정리 회귀 커버리지)은 모두
코드·테스트가 SUMMARY 의 권장 조치와 정확히 일치하게 구현됐고 새로운 결함을 만들지 않았다.
TODO/FIXME 류 미완성 마커 신규 추가 없음, spec/ 본문 미변경.

## 위험도

MEDIUM
