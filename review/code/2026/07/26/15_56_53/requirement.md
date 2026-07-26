# 요구사항(Requirement) 리뷰 — `markNodeCancelled` 헬퍼 추출 (6R)

## 대상

커밋 `410d913fe` (`refactor(engine): 5R W25 — 노드 취소 종결 중복을 markNodeCancelled 로 추출`).
프롬프트 diff-list 에는 이번 라운드의 실제 소스 diff 가 라우팅되지 않았고(직전 라운드까지의
review 산출물 md/json 만 포함 — harness diff-base 스코프 갭, 4R/5R 에서도 동일 현상 기록됨),
오케스트레이터가 직접 지시한 점검 대상(`markNodeCancelled` 추출)은 `git show 410d913fe` 와
현재 워크트리 소스(`git show HEAD` 스냅샷과 `git status --short` 로 대조)를 직접 열어 검증했다.

## 최우선 검증: 헬퍼 추출이 두 호출부의 계약을 보존하는가

**결론: 보존됨.**

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `executeNode` 의
catch 블록 두 분기가 각각 다음과 같이 `markNodeCancelled(nodeExecution, node, context,
executionId, errorEnvelope?)` 로 위임한다 (헬퍼 정의 `:4586`-`:4615`):

- **`isAbortError(err)` 분기** (`:5814`-`:5828`): `{ code: 'AbortError', message: err.message }`
  를 `errorEnvelope` 로 전달. 헬퍼 내부에서 `if (errorEnvelope) nodeExecution.error =
  errorEnvelope;` 로 대입되고, `emitNode` payload 에도 `...(errorEnvelope ? { error:
  errorEnvelope } : {})` 조건부 spread 로 포함된다 — 추출 전 무조건 대입/포함되던 것과 값·키
  모두 동일(참인 경우이므로 조건부와 무조건이 동치).
  - **spec 정합**: `spec/conventions/node-cancellation.md` §5.1 "`output.error` 는 표준
    봉투(`code: 'AbortError'`)로 기록"과 line-level 로 일치. `NodeExecution.error` 필드가
    `{code, message}` 형태로 기록되는 것도 [데이터 모델 §2.14](../../../../spec/1-data-model.md)
    (`error | JSONB? | {code, message, stack?}`)와 일치.
  - 회귀 테스트 `execution-engine.service.spec.ts:5532`-`:5584`
    (`'classifies a handler-thrown AbortError as CANCELLED ... (node-cancellation §5.1)'`)가
    `ne.error`·WS payload 의 `error` 필드를 각각
    `expect.objectContaining({code:'AbortError', message:'aborted'})` 로 직접 단언 — 추출
    전후 값이 1:1 대응함을 실측으로 확인.
- **`err instanceof ExecutionCancelledError` 분기** (`:5854`-`:5860`): `errorEnvelope` 인자를
  생략(undefined) → 헬퍼 내부 `if (errorEnvelope)` 가 스킵돼 `nodeExecution.error` 를 건드리지
  않고(추출 전에도 이 분기는 `error` 필드를 전혀 설정하지 않았음 — 동일), `emitNode` payload
  에도 `error` 키 자체가 생기지 않는다. sentinel 메시지(executionId 포함, W15/W19 취지)가
  client 로 노출되지 않는 계약이 그대로 유지된다.
  - 회귀 테스트 `execution-engine.service.spec.ts:5745`-`:5798`
    (`'Sub-Workflow(workflow) 노드에서 ExecutionCancelledError 가 발생하면 FAILED 로
    오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W15)'`)가 `ne.status === CANCELLED`,
    `finishedAt` 존재, WS payload 에 `'cancelled externally'` 문자열이 없음을 직접 단언.
- 두 호출부 모두 헬퍼 시그니처 `(nodeExecution, node, context, executionId, errorEnvelope?)`
  순서와 인자 순서가 일치 — `npx tsc --noEmit` 재실행 결과 `execution-engine.service.ts`
  (비-테스트) 관련 타입 에러 0건.
- `throw` 는 헬퍼 밖, 각 분기 호출부에 남아 있다(`await this.markNodeCancelled(...); throw
  err;` 양쪽 동일 패턴) — §5.2 "워크플로 흐름은 노드의 `errorPolicy` 가 결정" 분류 로직에
  영향 없음(원본 에러가 그대로 전파되므로 `ParallelExecutor`/`ForEachExecutor` 등 상위
  소비자의 `instanceof` 분기도 그대로 동작).

**결론: 요청된 "동작 보존" 주장은 코드·spec·회귀 테스트 세 축 모두에서 사실로 확인된다.**

## 신규 발견사항

- **[WARNING]** 헬퍼 삽입 위치가 기존 `finalizeCancelledExecution` 의 JSDoc 을 그 함수에서
  분리시켜 "고아(orphaned)" 주석으로 만들었다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4551`-
    `:4570` (`finalizeCancelledExecution` 을 설명하던 원래 JSDoc, W12 때부터 존재),
    `:4571`-`:4585` (신규 `markNodeCancelled` JSDoc), `:4586`-`:4615` (`markNodeCancelled`
    본문), `:4617` (`finalizeCancelledExecution` 실제 선언 — 이제 바로 위에 JSDoc 없음)
  - 상세: 이번 커밋은 `markNodeCancelled` 의 JSDoc+본문을, 기존 `finalizeCancelledExecution`
    JSDoc(`@param logContext` 로 끝남, `:4570`)과 그 함수 선언(원래 바로 다음 줄이었음) **사이에**
    삽입했다. 결과적으로 위→아래 순서가 "`finalizeCancelledExecution` JSDoc" →
    "`markNodeCancelled` JSDoc" → "`markNodeCancelled` 본문" → "`finalizeCancelledExecution`
    선언" 이 됐다. TSDoc/JSDoc 관례상 도구·에디터는 선언 바로 위 주석만 그 선언에 귀속시키므로,
    앞쪽 블록(`:4551`-`:4570`)은 어떤 선언과도 인접하지 않는 고아 주석이 되고,
    `finalizeCancelledExecution`(`:4617`) 은 사실상 문서를 잃었다. 특히 고아가 된 블록의 마지막
    줄이 `@param logContext ...` 인데, 이는 바로 아래(`:4571`)에 시작하는 `markNodeCancelled`
    JSDoc — 그 함수엔 `logContext` 파라미터가 없다 — 바로 위에 붙어 있어, 향후 유지보수자가
    상단부터 읽으면 두 블록을 하나로 착각하거나 어느 함수의 설명인지 혼동할 위험이 크다.
    `finalizeCancelledExecution` 은 "`stop()` 이 이미 guarded UPDATE 로 `finishedAt`/
    `durationMs` 를 커밋했을 수 있어 무조건 `save()` 하면 안 된다", "emit 은 반환값과 무관하게
    항상 발행" 같은 비자명한 계약을 설명하던 함수였는데, 그 문서가 실질적으로 소실됐다.
    기능적 영향은 없다(주석 이동은 런타임에 무관) — 코드 리뷰 관점의 "함수명·주석과 실제 구현의
    일치" 결함이다. ESLint 에 `jsdoc` 플러그인이 설정돼 있지 않아 CI 가 이 종류의 drift 를
    잡지 못한다.
  - 제안: `markNodeCancelled` 의 JSDoc+본문 블록을 `finalizeCancelledExecution` 의 기존
    JSDoc(`:4551`-`:4570`) **앞**으로 옮기거나, `finalizeCancelledExecution` 정의(`:4617`~)
    **뒤**로 옮겨 각 JSDoc 이 자신이 설명하는 함수와 다시 인접하도록 정리 권장. 기능 변경은
    불필요 — 순수 위치 이동. (참고: 같은 라운드의 `maintainability.md` 리뷰도 독립적으로 동일
    결함을 WARNING 으로 지목했다 — 서로 다른 관점 두 곳에서 수렴한 것으로, 오탐 가능성은
    낮다고 판단한다.)

## 검증했으나 새 결함 아님

- **워크스페이스(미커밋) 일시 상태**: 검증 도중 `execution-engine.service.ts` 의
  `emitNode` payload 가 `...(errorEnvelope ? { error: errorEnvelope } : {})` 대신
  `error: errorEnvelope` (무조건 대입)로 보이는 순간이 있었다(`git diff HEAD` 로 확인). 이
  형태라면 `ExecutionCancelledError` 분기(`errorEnvelope === undefined`)에서 payload 에
  `error: undefined` 키가 남아, 순수 JSON 직렬화 관찰로는 차이가 없지만 `'error' in payload`
  류의 검사에서는 차이가 생길 수 있는 잠재 결함이다. 그러나 `git show HEAD`로 확정한 committed
  스냅샷은 조건부 spread 로 정확했다 — 동일 워크트리에서 진행 중인 별도 mutation 검증
  프로세스가 남긴 일시적 파일 상태로 판단한다(`review/code/2026/07/26/13_47_42/documentation.md`
  가 이미 기록한 것과 같은 클래스의 현상 — `simulatedNow += 300;` 사례). **커밋된 코드에는
  결함 없음**, 새 발견사항으로 세지 않는다.
- **TODO/FIXME/HACK/XXX**: 추출된 코드(`markNodeCancelled` 및 두 호출부)에 신규 마커 없음
  (grep 확인).
- **CHANGELOG 미갱신**: `CHANGELOG.md` 에 이번 순수 리팩터(W25)에 대한 항목이 없다. 로직
  변경이 없는 내부 리팩터라 필수는 아니라고 판단해 requirement 관점에서는 차단 사유로
  올리지 않는다(문서화 리뷰어 스코프로 남겨둠).

## spec fidelity

`spec/conventions/node-cancellation.md` §5.1(NodeExecution 상태 `cancelled`, `output.error`
표준 봉투, `execution.node.cancelled` WS 이벤트 발행) 과 line-level 로 대조했다 — 두 호출부
모두 이 봉투/이벤트 계약을 그대로 만족한다(`NodeEventType.NODE_CANCELLED =
'execution.node.cancelled'`, `websocket.service.ts:176` 확인). §5.2(워크플로 흐름은
`errorPolicy` 결정) 도 `throw` 를 호출부에 남겨 영향 없음. spec 본문 자체는 이번 diff 로
변경되지 않았다(순수 리팩터).

## 요약

`markNodeCancelled` 추출은 두 호출부(`isAbortError`/`ExecutionCancelledError`)의 계약을
정확히 보존한다 — §5.1 `output.error` 봉투는 `isAbortError` 경로에서 조건부 spread 로
문자 그대로 유지되고, `ExecutionCancelledError` 경로의 sentinel 메시지 비노출 계약도
그대로 유지되며, 두 축 모두 기존 회귀 테스트가 직접 단언한다. `throw` 를 호출부 책임으로
남긴 설계도 §5.2 흐름 분류에 영향을 주지 않는다. 다만 이번 추출이 코드 삽입 위치를 잘못
잡아 기존 `finalizeCancelledExecution` 의 JSDoc 을 그 함수에서 분리시키는 새 결함(고아
주석)을 만들었다 — 기능 영향은 없으나 문서 신뢰도를 해치므로 WARNING 으로 기록한다(같은
라운드 maintainability 리뷰와 독립적으로 수렴). 검증 중 관찰된 워크스페이스의 일시적
`error: errorEnvelope` 형태는 committed 상태(`git show HEAD`)에서는 재현되지 않아 결함으로
세지 않았다. C1~C5·W1~W25 는 지시에 따라 재검토하지 않았다.

## 위험도

LOW
