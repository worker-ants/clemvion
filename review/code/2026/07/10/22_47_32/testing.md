# 테스트 관점 코드 리뷰 — getStatus() 2단계 컬럼 projection

- 구현: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`
- 신규 유닛 테스트: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
  describe `'InteractionService.getStatus — 컬럼 projection (2단계 조회)'` (L744-889, 5건)
- e2e: `codebase/backend/test/external-interaction.e2e-spec.ts` (미변경, 테스트 I/J 가 getStatus wire 를 실 DB 로 커버)

## 발견사항

### WARNING — 기존 getStatus 테스트 4건이 리팩터 이후 "2단계 분리" 를 검증하지 못하는 vacuous 상태
- 위치: `interaction.service.spec.ts:564-586`(ai_conversation durable thread), `:588-610`(buttons durable
  thread), `:612-648`(secret 마스킹), `:723-742`(null thread)
- 상세: 이 4개 테스트는 모두 `repo.findOne.mockResolvedValue(makeExecution({...,
  conversationThread: X}))` 를 **1회만(mockResolvedValue, not Once)** 설정한다. jest 의
  `mockResolvedValue` 는 이후 발생하는 **모든** 호출에 동일 객체를 반환하므로, `getStatus()` 내부에서
  1단계(`select` 에 `conversationThread` 제외)와 2단계(`select: ['id','conversationThread']`)로 나눠
  호출해도 두 호출 모두 같은 `conversationThread` 필드가 실린 객체를 받는다. 이 diff 의 `git diff` 를
  보면 실제로 이 4개 테스트는 **리팩터 전(1회 조회, `execution.conversationThread` 직접 사용)** 구현을
  검증하기 위해 작성된 것으로, 리팩터 후에도 mock 이 우연히 두 단계 모두를 같은 객체로 채워주기 때문에
  green 을 유지한다. 즉 만약 구현이 2단계 분리를 되돌려 예전처럼 `execution.conversationThread` 를
  1단계 row 에서 직접 읽도록 회귀해도, **이 4개 테스트는 여전히 통과**해 회귀를 못 잡는다.
- 근거: `select` 인자를 검사하지 않고 반환 객체만 검사 — 어느 호출에서 값이 왔는지 무관.
- 제안: 이 갭은 새로 추가된 `'2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과'`
  (L808-846)·`'2단계 재조회가 null...'`(L848-865) 두 테스트가 `select` 분기 mock 으로 실질적으로
  메꾸고 있어 **현재 시점 회귀 위험은 낮음**. 다만 이 4개 구식 테스트가 "2단계 분리를 검증한다"는
  오인을 막기 위해, 최소 코드 코멘트로 "이 테스트들은 1단계/2단계 어느 쪽에서 값이 오는지 구분하지
  않는다 — 실제 2단계 분리 검증은 아래 projection describe 참조" 를 남기거나, 향후 이 신규 describe
  블록이 삭제/약화될 경우를 대비해 유지보수자가 인지하도록 표시할 것을 권장.

### WARNING — 신규 projection 테스트가 stage-2 쿼리의 `where` (executionId) 를 단언하지 않음 — 인가 경계 미검증
- 위치: `interaction.service.spec.ts:791-802`(`'waiting_for_input 일 때만 2단계로...'`),
  `:808-846`, `:848-865`
- 상세: 세 테스트 모두 `selectOf(...)` 로 `select` 배열만 검사하고, `where: { id: ctx.executionId }`
  가 stage-2 `executionRepository.findOne` 호출에 실제로 전달됐는지는 어느 테스트에서도 단언하지
  않는다. `nodeExecutionRepository.findOne` 호출의 `where.executionId` 도 마찬가지로 미검증(파일
  전체에서 `nodeRepo.findOne` 에 대한 `toHaveBeenCalledWith` 단언이 전무 — grep 결과 0건).
  EIA 는 토큰이 특정 executionId 로 scope 되는 모델(e2e 테스트 D `TOKEN_SCOPE_MISMATCH` 참고)이라,
  stage-2 쿼리가 실수로 다른 executionId(하드코딩값·변수 오배선 등)를 조회하면 다른 실행의
  `conversation_thread`/대기 노드 표면이 섞여 나갈 수 있는 카테고리의 버그인데, 현재 mock 은
  `where` 를 완전히 무시하므로 이런 회귀를 전혀 잡지 못한다.
- 근거: `interaction.service.ts:282-293` 의 두 쿼리 모두 `where: { id: ctx.executionId }` /
  `where: { executionId: ctx.executionId, ... } ` 를 사용하지만, 테스트는 이를 검증하지 않음.
- 제안: 예) `expect(repo.findOne.mock.calls[1][0]).toMatchObject({ where: { id: ctx.executionId }
  })`, `expect(nodeRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where:
  expect.objectContaining({ executionId: ctx.executionId }) }))` 를 최소 1개 테스트에 추가.

### INFO — `expect(select).toEqual(expect.arrayContaining(BASE_COLUMNS))` 는 초과 컬럼을 못 잡음
- 위치: `interaction.service.spec.ts:763-773` (`'1단계는 응답 조립에 쓰이는 컬럼만 select...'`)
- 상세: `arrayContaining` 은 `select` 가 `BASE_COLUMNS` 의 **상위집합**이기만 하면 통과한다.
  `conversationThread` 개별 컬럼은 별도 `not.toContain` 으로 명시적으로 막아뒀지만, 그 외의 임의의
  다른 컬럼(예: 향후 실수로 추가되는 다른 대형 jsonb 컬럼)이 select 에 섞여도 이 테스트는 감지하지
  못한다. 본 PR 의 목적 자체가 "응답 조립에 실제로 쓰이는 컬럼만 정확히 select" 이므로, 이 테스트가
  정확히 그 의도를 보증하지 못하는 것은 다소 아쉬운 지점.
- 제안: `expect(select.slice().sort()).toEqual(BASE_COLUMNS.slice().sort())` 로 정확히 일치시키거나,
  최소 `expect(select).toHaveLength(BASE_COLUMNS.length)` 를 `arrayContaining` 과 併用.

### INFO — `waiting_for_input` + 대기 NodeExecution 없음 + durable thread 있음 조합 미검증
- 위치: 없음 (커버리지 갭). 관련 코드: `interaction.service.ts:274-351`
- 상세: 코드 상 `waiting_for_input` 이면 `Promise.all` 로 thread 와 nodeExec 를 항상 함께 가져오지만,
  `context`/`conversationThread` 조립은 `if (nodeExec?.node) { ... }` 블록 **안에서만** 일어난다.
  즉 대기 중인 NodeExecution 을 못 찾은 race(`:527-536` 테스트가 이 case 커버)에서 durable thread
  가 실제로 존재해도 **fetch 는 했지만 응답에 전혀 실리지 않고 버려진다** — `context` 자체가
  `null` 이 되기 때문. 이 특정 조합(waiting + nodeExec null + thread 존재)을 명시적으로 검증하는
  테스트가 없어, 이 "계산은 했지만 폐기됨" 동작이 의도인지 우발적인지 회귀 시에도 드러나지 않는다.
  (`:527-536` 은 thread 를 세팅하지 않은 채 nodeExec null 만 테스트).
- 제안: 위 조합을 명시하는 테스트를 하나 추가해 현재 동작(“대기 노드가 없으면 thread 도 함께
  생략된다”)을 고정/문서화. 만약 이것이 의도치 않은 동작이라면 product 결정 필요(이번 PR 은 순수
  조회 최적화 스코프라 동작 변경은 범위 밖 — plan 문서에도 이 조합 언급 없음).

### INFO — `Promise.all` 병렬 디스패치 자체는 테스트되지 않음
- 위치: `interaction.service.ts:281-294`
- 상세: 신규 테스트들은 "결과가 올바른가" 만 검증하고, 두 쿼리가 실제로 **병렬** 로 디스패치되는지
  (즉 순차 `await` 로 회귀하지 않았는지) 는 검증하지 않는다. jest mock 이 즉시 resolve 되는 한
  순차 `await` 코드와 `Promise.all` 코드는 동일한 관찰 가능한 결과를 내므로, 현재 mock 설계로는
  구분이 어렵다.
- 제안: 우선순위 낮음 — 정확성엔 영향 없고 latency 특성만 달라지므로(계획서에도 "latency 상쇄" 목적
  으로 명시), 굳이 deferred-promise 로 dispatch 순서를 증명하는 테스트를 추가할 필요는 낮다.
  필요하다면 수동 resolve 가능한 promise 로 "두 mock 이 서로의 resolve 를 기다리지 않고 모두
  호출됐다" 를 증명하는 테스트를 고려.

### INFO — mock 은 TypeORM 의 실제 `select`(미선택 필드 undefined화) 동작을 시뮬레이션하지 않음 — e2e 도 필드값까지는 검증 안 함
- 위치: 유닛 전체 / e2e `external-interaction.e2e-spec.ts:344-409`(테스트 I), `:411-447`(테스트 J)
- 상세: `repo.findOne` mock 은 항상 (override 로) 완전한 객체를 반환하므로, 실제 프로덕션에서
  `select` 배열에 없는 필드를 코드가 읽으면 `undefined` 가 되는 것과 달리, 유닛 테스트에서는 항상
  값이 채워져 있다. 이 괴리는 원칙적으로 `'1단계는 ... select'` 테스트(L763-773)가 `select` 배열
  리터럴을 직접 문자열 비교하는 방식으로 상당 부분 상쇄한다(코드가 실제로 사용하는 필드명과
  BASE_COLUMNS 리스트가 어긋나면 즉시 fail). e2e 테스트 I/J 는 실 Postgres 로 2단계 경로를 태우지만,
  두 테스트 모두 secret 마스킹 문자열 포함 여부만 검사(`wire.toContain/not.toContain`)하고,
  `res.body.data.workflowId`/`id`/`updatedAt` 같은 프로젝션된 필드의 **실제 값 일치**는 단언하지
  않는다. 따라서 "select 배열의 프로퍼티명이 문법적으로는 맞지만 실제로는 엔티티 컬럼 매핑과 미묘하게
  어긋나 값이 조용히 비는" 유형의 버그(계획서 W2 가 우려한 카테고리)는, `select` 문자열 비교가
  이미 대부분 방어하고 있어 실질 위험은 낮지만, e2e 레벨에서 한 번 더 닫는 것도 안전.
- 제안: 우선순위 낮음. 테스트 I 또는 J 에 `expect(res.body.data.workflowId).toBe(workflowId)` 및
  `expect(res.body.data.updatedAt).toEqual(expect.any(String))`(가능하면 seed 한 `started_at`/
  `finished_at` 과 일치) 단언을 추가하면 select-array 리터럴과 실제 런타임 컬럼 매핑 사이의 마지막
  고리까지 닫을 수 있음.

### INFO — `'비-waiting 상태는 Execution 을 1회만 조회'` 루프 테스트는 격리가 잘 돼 있음 (참고용, 문제 아님)
- 위치: `interaction.service.spec.ts:775-789`
- 상세: 5개 status 를 순회하며 매 반복 `makeMocks()` 를 새로 생성해 mock 상태가 반복 간 오염되지
  않는다. `toHaveBeenCalledTimes(1)` 단언도 신선한 mock 기준이라 유효. 별도 조치 불필요 — 우려했던
  "루프 내 단언 상호 오염" 은 실제로는 없음.

## 요약

새로 추가된 5건의 projection 전용 테스트(`select` 리터럴 비교 + `select` 분기 mock)는 이 PR 의 핵심
회귀 위험(1단계에서 `conversationThread` 를 실수로 포함/누락, `updatedAt` fallback 침묵 회귀, 2단계에서
읽은 thread 가 마스킹을 우회)을 실질적으로 잡아내도록 잘 설계돼 있고, 특히 `'2단계 재조회 결과의
thread 도 redactThreadForPublic 를 통과'` 테스트는 select 인자로 stage 를 구분하는 mock 분기를 통해
"구현이 몰래 1단계 execution 객체에서 thread 를 읽는" 회귀를 정확히 잡는다. 다만 리팩터 이전부터
존재하던 4개의 waiting_for_input 테스트(L564-648, L723-742)는 `mockResolvedValue`(비-Once) 를 두 호출
모두에 재사용하는 구조상 "어느 단계 쿼리에서 값이 왔는지" 를 구분하지 못해, 만약 신규 projection
describe 블록이 향후 약화·삭제된다면 2단계 분리 자체의 회귀를 아무도 못 잡는 사각지대가 될 수 있다.
또한 stage-2 쿼리의 `where`(executionId) 인자를 단언하는 테스트가 전무해 "엉뚱한 execution 의 thread
를 조회"하는 유형의 인가 경계 버그는 현재 테스트 스위트로는 검출 불가능하다. e2e(I/J)는 실 DB 로 2단계
경로 자체를 태우고 secret 마스킹은 잘 검증하지만 필드 값 자체의 정합성은 검증하지 않는다. 전반적으로
설계는 견고하고 vacuous 위험은 신규 테스트로 대부분 상쇄돼 있어 CRITICAL 은 없으나, `where` 단언 부재와
구식 테스트의 실효성 문제는 WARNING 으로 기록해 둘 가치가 있다.

## 위험도

MEDIUM — 실제 코드에 버그가 있다는 근거는 없음(구현은 spec/decision memo 대로 정확히 동작). 다만
테스트 스위트만 놓고 볼 때, (a) stage-2 쿼리의 executionId 경계 미검증, (b) 구식 테스트 4건의
vacuous화 는 향후 리팩터/유지보수 과정에서 회귀를 놓칠 수 있는 실질적인 커버리지 갭이라 MEDIUM 으로
평가.
