# 보안 코드 리뷰 — getStatus() 2단계 projection (fresh review)

- diff base: `origin/main...HEAD`
- 대상 커밋: `0e80bd4a1`(2단계 projection 도입) + `f2764f3a9`(Warning fix: 상수화 + 인가 경계 테스트)
- 핵심 파일: `codebase/backend/src/modules/external-interaction/interaction.service.ts`,
  `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
- 직전 리뷰 `review/code/2026/07/10/22_47_32/security.md` 의 발견사항(Warning: STATUS_PROJECTION_COLUMNS 매직 컬럼명·인가 경계 미검증)이 fix commit 에서 다뤄졌는지 재검증.

## 발견사항

- **[INFO]** egress 마스킹 배선(`redactThreadForPublic`) — 2단계 재조회 결과에 정상 적용됨, 회귀 없음
  - 위치: `interaction.service.ts:294-314`
  - 상세: 2단계에서 `threadRow = executionRepository.findOne({ where: { id: ctx.executionId }, select: ['id', 'conversationThread'] })` 로 재조회한 뒤, `threadRow?.conversationThread` 에 대해 `redactThreadForPublic(...)` 를 호출한다(line 312-314). 1단계 결과(`execution.conversationThread`, 이번 리팩터로 projection 에서 제외됨)를 마스킹 없이 직접 사용하는 경로는 없다 — `STATUS_PROJECTION_COLUMNS` 에 `conversationThread` 가 없으므로 `execution.conversationThread` 는 애초에 `undefined` 이고, 코드 어디에서도 `execution.conversationThread` 를 참조하지 않는다(grep 확인: 참조는 `threadRow.conversationThread` 뿐). EIA §R17 불변식(SSE·REST 공유 helper 로 egress 시 마스킹) 이 최종 코드에서 유지된다.
  - 근거: 신규 테스트 `'2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과 (secret egress 가드)'` (spec.ts:875-916) 가 `sk-live-STAGE2-LEAK` 라는 실제 secret-shape 문자열을 turn 텍스트에 심고, 1단계 mock 응답에는 thread 자체가 없도록(projection 배제 시뮬레이션) 구성한 뒤 응답에 원문이 없고 `***` 마스킹 마커가 있음을 assert. vacuous 하지 않음 — 실제 실행 결과 문자열을 검사.
  - 조치: 불필요(정상).

- **[INFO]** `deepRedactSecrets` — `nodeOutput` 및 terminal `outputData`(result/error) 적용 유지 확인
  - 위치: `interaction.service.ts:319`(nodeExec.outputData), `374-379`(COMPLETED → result), `380-386`(FAILED → error)
  - 상세: `STATUS_PROJECTION_COLUMNS` 에 `outputData` 가 포함되어 있어(line 66-73) 1단계에서 `execution.outputData` 가 정상적으로 로드되고, 이 값이 `deepRedactSecrets` 를 거쳐 `result`/`error` 로 반환된다. `nodeExec.outputData` (2단계 병렬 조회 결과) 도 line 319 에서 동일하게 마스킹된다. 컬럼 상수화로 인해 `outputData` 가 실수로 select 목록에서 빠지는 회귀는 발생하지 않았다 — `satisfies (keyof Execution)[]` 타입 강제 및 신규 테스트(`'1단계는 응답 조립에 쓰이는 컬럼만 select'`, spec.ts:800-810)가 정확한 컬럼 집합(`toEqual` sort 비교, superset/subset 모두 차단)을 고정.
  - 조치: 불필요(정상).

- **[INFO]** 인가 경계 — 1/2단계 execution 쿼리 및 nodeExecution 쿼리 모두 `ctx.executionId` 로 일관 스코프
  - 위치: `interaction.service.ts:270-273`(1단계 execution), `294-298`(2단계 threadRow), `299-306`(nodeExec)
  - 상세: 세 쿼리 모두 `where` 절이 `ctx.executionId` (또는 `executionId: ctx.executionId`) 로 하드 바인딩되어 있다. 2단계 두 조회는 `Promise.all` 로 병렬 실행되지만 독립적으로 각자 `ctx.executionId` 를 참조하므로 교차 실행 데이터 누출 경로가 없다.
  - 신규 테스트 검증: `'2단계 조회는 1단계와 동일한 executionId 로 스코프된다 (인가 경계)'` (spec.ts:729-745) 는 `repo.findOne.mock.calls[0][0]`/`[1][0]` 의 `where` 값을 직접 inspect 해 `{ id: IEXT_CTX.executionId }` 와 `toEqual` 로 정확 비교하고, `nodeRepo.findOne.mock.calls[0][0]` 의 `where` 를 `toMatchObject({ executionId: IEXT_CTX.executionId, status: 'waiting_for_input' })` 로 검증한다. 이는 **vacuous 하지 않다** — jest mock 이 캡처하는 것은 서비스 코드가 실제로 repository 에 전달한 인자 객체이며, mock 의 반환값(어떤 execution 을 "찾은 것으로" 흉내낼지)과 독립이다. 즉 구현이 `where.id` 를 빠뜨리거나 다른 필드/상수로 대체하면 이 테스트는 실패한다.
  - 한 가지 미세한 한계(정보 목적, 회귀 아님): `makeExecution()` 의 기본 `id` (`'exec-1'`)가 `IEXT_CTX.executionId`(`'exec-1'`)와 동일해서, "2단계가 `ctx.executionId` 대신 1단계 결과의 `execution.id` 를 재사용" 하는 (기능적으로 동등한) 변형까지는 구분하지 못한다. 그러나 이는 실제 DB 조회에서 `where: { id: ctx.executionId }` 로 찾은 row 라면 `execution.id === ctx.executionId` 가 항상 성립하므로 보안적으로 동등하며 실질적 위험이 아니다.
  - 조치: 불필요(정상). 테스트는 목적(교차 execution 스코프 이탈 방지)에 대해 실효성 있음.

- **[INFO]** `STATUS_PROJECTION_COLUMNS` 상수화가 만든 보안 회귀 없음 — `conversationThread` 1단계 select 미포함 확인
  - 위치: `interaction.service.ts:66-73`
  - 상세: 상수 배열은 `['id', 'status', 'workflowId', 'startedAt', 'finishedAt', 'outputData']` 이며 `conversationThread` 가 없다. `satisfies (keyof Execution)[]` 로 컴파일 타임에 실제 엔티티 컬럼명과 일치 강제(오타 시 컴파일 에러). 신규 테스트가 `expect(select).not.toContain('conversationThread')` 로 런타임까지 재확인(spec.ts:809).
  - 조치: 불필요(정상).

- **[INFO]** waiting_for_input 이외 상태에서 thread 노출 경로 없음
  - 위치: `interaction.service.ts:288`(`if (execution.status === ExecutionStatus.WAITING_FOR_INPUT)`)
  - 상세: 2단계 조회(threadRow + nodeExec) 전체가 이 단일 분기 안에서만 실행된다. 이 밖의 모든 상태(`running`/`pending`/`completed`/`failed`/`cancelled`)에서는 `context`/`currentNode` 가 `null` 로 유지되고 `conversationThread` 관련 코드 경로에 아예 도달하지 않는다. 신규 테스트 `'비-waiting 상태는 Execution 을 1회만 조회 (thread 재조회 없음)'`(spec.ts:812-826) 가 5개 non-waiting 상태 전부에 대해 `repo.findOne` 1회·`nodeRepo.findOne` 0회를 assert.
  - 조치: 불필요(정상).

- **[INFO]** 2단계 결과가 `null` 인 경우(park row 소멸/조회 간 레이스) `conversationThread` 키 자체 미동봉
  - 위치: `interaction.service.ts:312-314`, `344-348`
  - 상세: `threadRow?.conversationThread` 가 falsy 면 `conversationThread` 변수가 `undefined` 이고, `base` 객체 조립 시 spread 조건(`...(conversationThread ? { conversationThread } : {})`)으로 키 자체가 응답 JSON 에서 생략된다(값이 `null`/`undefined` 로 노출되는 것도 아님). 신규 테스트 `'2단계 재조회가 null(조회 간 row 소멸)이면 conversationThread 키 미동봉'`(spec.ts:919-935) 이 `not.toHaveProperty('conversationThread')` 로 검증.
  - 조치: 불필요(정상).

## 요약

`getStatus()` 를 1단계(얇은 status projection) + 2단계(`waiting_for_input` 조건부 `conversation_thread` 재조회)로 분리한 리팩터는 egress 마스킹 배선(`redactThreadForPublic` for thread, `deepRedactSecrets` for nodeOutput/terminal outputData)과 인가 스코프(`ctx.executionId`)를 최종 코드에서 정확히 보존하고 있으며, `STATUS_PROJECTION_COLUMNS` 상수화도 `conversationThread` 를 1단계 select 에서 의도대로 계속 배제한다. 직전 리뷰(22_47_32)에서 지적된 Warning(매직 컬럼 배열의 컴파일 타임 안전성 부재, 인가 경계 미검증)은 이번 fix commit(`f2764f3a9`)의 `satisfies (keyof Execution)[]` 타입 강제와 신규 인가 경계 테스트로 해소됐다. 신규 테스트들(특히 secret-shape 문자열을 직접 assert 하는 egress 가드 테스트와 mock 호출 인자를 직접 inspect 하는 인가 경계 테스트)은 vacuous 하지 않고 실제 리팩터 목적을 검증한다. non-waiting 상태에서 thread 가 노출되는 신규 경로는 없다. 이번 changeset 은 순수 조회 최적화이며 응답 wire 계약·보안 마스킹 배선에 변화가 없음을 확인했다.

## 위험도

NONE
