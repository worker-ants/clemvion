# 테스트(Testing) 리뷰 — update-returning-rows tuple shape 수정

## 개요

TypeORM `UPDATE`/`DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플을 돌려주는데 7곳(이후 auth-oauth
포함 8곳)이 행 배열로 오인했던 결함을 `updateReturningRows()` 헬퍼로 통일한 변경. 신규 유닛
테스트(`update-returning-rows.spec.ts`), 실측 shape 회귀 테스트(admission·auth-oauth·KB 일부),
구조적 grep 가드가 함께 추가됐다. 아래는 실제 저장소 상태를 `Read`/`grep`/`jest` 로 직접 검증한 결과다
(`npx jest update-returning-rows.spec.ts assert-row-array.spec.ts auth-oauth.service.spec.ts` → 35
passed, `knowledge-base.service.spec.ts` → 53 passed, `execution-engine.service.spec.ts` → 446 passed,
모두 확인).

## 발견사항

- **[CRITICAL]** 이 PR/plan 의 핵심 대상인 `updateExecutionStatus` 의 `persisted` 계산에 대해 **실제
  드라이버 tuple shape(`[[{id}],1]`/`[[],0]`) 를 쓰는 회귀 테스트가 단 하나도 없다** — 되돌려도(=
  `updateReturningRows(...)` 를 걷어내고 `updated.length > 0` 로 복귀해도) 어떤 테스트도 RED 가
  되지 않는다.
  - 위치: 부재(신규 테스트 필요) — `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    `updateExecutionStatus 누적 (RUNNING 진입/이탈)` describe 블록(약 5299행 부근). 대응 소스는
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8549-8553`
    (`const persisted = updateReturningRows<{ id: string }>(updated, ...).length > 0;` — `Read` 로
    직접 확인. 이 리뷰 diff 의 게이트로는 8549 부근).
  - 상세: `execution-engine.service.spec.ts` 전체에서 실제 tuple shape(`[[{`)을 mock 하는 곳은
    딱 2곳뿐이며(diff 게이트 4410, 4431), 둘 다 이번에 새로 추가된 `admitExecutionOrDefer`(admission
    gate) 테스트다. `updateExecutionStatus` 의 guarded UPDATE 를 소비하는 모든 기존/신규 테스트
    (`mockExecutionRepo.query` 의 기본 mock `jest.fn().mockResolvedValue([{ id: executionId }])`
    — line 331 부근, 그리고 5365/5389/5437/5458/5474/5498 등의 `mockResolvedValueOnce([{id}])`/`([])`)
    는 전부 **행 배열 직접(INSERT 형) shape** 을 쓴다. `updateReturningRows` 는 이 shape 을 fallback
    분기로 그대로 통과시키므로(`result[0]` 이 배열이 아니라서), 헬퍼 적용 전(`updated.length > 0`)과
    적용 후(`updateReturningRows(updated).length > 0`) 결과가 **완전히 동일**하다 — 즉 이 지점의
    수정은 기존 스위트로 전혀 판별되지 않는다. `it('updateExecutionStatus: guarded UPDATE 가
    배열이 아니면 던진다...')`(diff 게이트 4590 부근)도 "배열 자체가 아님" 만 검증할 뿐 "배열이지만
    튜플" 케이스는 다루지 않는다.
    같은 세션의 `review/code/2026/08/13/20_36_35/RESOLUTION.md` WARNING #1 조치란은 "engine
    `updateExecutionStatus` 는 이미 기존 스위트가 real-shape mock 으로 덮는다" 라고 명시했는데,
    `grep -n '\[\[{' execution-engine.service.spec.ts` 로 직접 재확인한 결과 이 주장은 **사실이 아니다**
    (admission 테스트 2건 외에는 tuple mock 이 전무). 이 지점은 바로 이 PR 이 계기가 된
    `plan/in-progress/ie-resume-turn-boundary-cancel.md` 의 6~8차 라운드가 "닫혔다" 고 잘못 종결한
    바로 그 변수(`persisted`)이고, plan 문서 자체가 "생존 뮤턴트를 테스트 위생 문제로 오진했다" 고
    소급 정정까지 한 자리다. 같은 세션에서 admission 쪽엔 실측 shape 테스트 2건을 정확히 대칭으로
    붙였으면서, 더 큰 사고를 낸 `updateExecutionStatus` 쪽엔 붙이지 않은 것은 비대칭적 커버리지
    갭이며, 향후 리팩터링이 이 줄을 실수로 되돌려도(예: `updateReturningRows` 호출을 인라인
    `Array.isArray` 체크로 "정리"하는 식의 변경) 어떤 자동 테스트도 잡지 못한다 — 이번에 4개월
    걸려 발견한 것과 같은 클래스의 무음 회귀가 재발할 수 있다.
  - 제안: `updateExecutionStatus 누적` describe 블록에 `mockExecutionRepo.query.mockResolvedValueOnce([[{ id: executionId }], 1])`(성공, `persisted===true`)와
    `mockResolvedValueOnce([[], 0])`(0행 — 예: 동시 cancel 이 이미 terminal 로 옮긴 경우,
    `persisted===false`+`emitTerminalExecutionMetrics` 미호출 또는 false 인자 확인) 두 실측 shape
    테스트를 추가한다. 추가 후 `updateReturningRows(updated, ...)` 를 `updated` 로 되돌려 실제로
    RED 가 되는지 뮤테이션으로 확인할 것. `RESOLUTION.md` 의 해당 조치 항목 서술도 함께 정정 필요.

- **[WARNING]** `knowledge-base.service.spec.ts` 의 신규 실측 shape 테스트 docstring 이 "아래 두
  테스트" 라고 명시하지만 실제로는 **1건만** 존재 — 문서가 주장하는 커버리지와 실제 테스트 수가
  불일치하고, 5개 수정 지점 중 4곳(reExtractAll CAS 락·embedding 재큐·graph 재큐·reset)이 실측
  shape 테스트 없이 남아 있다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts:788-790`
    (docstring "아래 두 테스트는 `updateReturningRows` 를 되돌리면 **각각 RED** 가 된다: 0행 튜플
    …/ 1행 튜플 …", diff 게이트로 확인) — 그런데 그 뒤에는 `it('실측 shape: 0행 튜플…')`
    (게이트 792) **1건만** 추가됐다. `grep -n "1행 튜플\|실측 shape" knowledge-base.service.spec.ts`
    로 재확인해도 "1행 튜플" 성공 경로 테스트는 파일 어디에도 없다.
  - 상세: `reEmbedAll` 의 기존 테스트(`should immediately reset to idle for empty KB`,
    knowledge-base.service.spec.ts:763, 이 diff 밖)는 CAS 락을 `[{ id: 'kb-1' }]`(행 배열 직접)로
    mock 하는데, 이 shape 은 `updateReturningRows` 의 fallback 분기를 그대로 통과하므로 헬퍼
    적용 전/후 결과가 같다 — 즉 "1행 튜플 성공 경로 + 이어지는 reset 까지 튜플로 정확히 처리되는지"
    를 실제로 판별하는 테스트가 없다. 나머지 4개 수정 지점(`reExtractAll` CAS 락 —
    knowledge-base.service.ts:336, `retryFailedDocuments`/embedding 재큐 —
    knowledge-base.service.ts:541 인근, graph 재큐 — :572 인근, reset — :740)도 `grep`으로 확인한
    결과 이 diff 로 추가된 실측 shape mock 이 전혀 없다(`reExtractAll` 관련 기존 테스트도 전부
    `[{id:'kb-1'}]`/`[]` 형 mock). 즉 5곳 중 1곳(20%)만 회귀 방지 실측 테스트가 있고, 나머지는
    구조적 grep 가드(`update-returning-rows.spec.ts`, 호출 존재 여부만 카운트)에만 의존한다 —
    requirement.md(20_36_35) WARNING 이 지적한 것과 동일 갭이며, 그 리뷰 이후에도 KB 쪽 실측
    shape 테스트는 1건만 유지된 채 이번 라운드까지 왔다.
  - 제안: docstring 을 실제 테스트 수(1건)에 맞게 정정하거나, 언급된 "1행 튜플"
    (`[[{id:'kb-1'}], 1]`) 성공 경로 테스트를 실제로 추가한다. 최소한 `reExtractAll` CAS 락 1건이라도
    실측 shape(성공/0행) 테스트를 추가해 5곳 중 1곳뿐인 실제 커버리지를 넓힐 것을 권고.

- **[INFO]** (긍정) 신규 헬퍼·테스트의 테스트 용이성·격리·가독성은 우수하다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts`,
    `codebase/backend/src/common/utils/update-returning-rows.spec.ts`
  - 상세: `updateReturningRows(result: unknown, detail?: string)` 는 shape 해석을 한 곳에 모아
    순수 함수로 격리했고(`update-returning-rows.spec.ts` 가 driver/서비스 의존 없이 11개 케이스로
    독립 검증), 호출부는 `unknown` 타입으로 받아 실제 shape 을 주장하지 않는다 — 테스트 용이성
    관점에서 바람직한 리팩터링이다. 각 서비스 spec 의 신규 테스트(`admitExecutionOrDefer` 2건,
    `auth-oauth` 2건)는 `try/finally { spy.mockRestore() }`, `mockResolvedValueOnce` 스코핑 등
    기존 파일 관례를 그대로 따라 테스트 간 격리가 유지된다. JSDoc/테스트 주석이 "왜 이 mock 값이
    실제 드라이버 shape 인지", "되돌리면 무엇이 RED 가 되는지"를 구체적으로 서술해 의도가 코드만으로
    잘 읽힌다.

- **[INFO]** `update-returning-rows.spec.ts` 의 `it.each` 비-배열 케이스(`undefined`/`null`/`{rowCount:1}`)는
  적절한 엣지 케이스 선정이나, `updateReturningRows` 가 `Array.isArray(result[0])` 로 tuple 여부를
  판정하는 로직의 역설적 엣지(예: `result[0]` 자체가 실제 행 배열의 첫 원소이면서 우연히 배열인 극단
  케이스, 예: `rowMode: 'array'` 로 얻은 SELECT 결과)는 다루지 않는다. 이 저장소의 현재 8개 소비
  지점 모두 표준 객체 행이라 실질 위험은 낮지만, 헬퍼 JSDoc 에 이 판정 방식의 전제(첫 원소가 배열이면
  무조건 tuple 로 간주)를 한 줄 명시해 두면 향후 `rowMode` 등 다른 드라이버 옵션을 쓰는 신규 지점이
  이 헬퍼를 재사용할 때 오판을 피하는 데 도움이 된다. 조치 불요, 참고용.

## 요약

핵심 헬퍼(`updateReturningRows`)와 그 유닛 테스트, 구조적 grep 회귀 가드, admission gate·auth-oauth
콜백에 대한 실측 driver-shape 테스트는 꼼꼼하고 검증도 잘 됐다(직접 `jest` 실행으로 확인).
하지만 테스트 커버리지를 "지점 수" 관점에서 대조하면 뚜렷한 비대칭이 있다 — 이 사고 전체의 발단이자
가장 파급력이 큰 `updateExecutionStatus`(`persisted`, 종결 이벤트 emit 분기를 가르는 값)에는 실측
tuple shape 테스트가 **전혀 없고**, 이는 같은 세션의 RESOLUTION.md 가 "이미 덮는다" 고 명시적으로
잘못 주장한 지점이기도 하다. `knowledge-base.service.ts` 도 5개 수정 지점 중 1곳만 실측 커버리지가
있고, 그 1곳조차 자기 docstring 이 주장하는 "두 테스트" 중 한 건이 빠져 있다. 이 두 갭은 "GREEN 이
증거가 아니다" — mock 이 실제 드라이버 현실을 인코딩하지 않으면 회귀가 조용히 재발한다 — 는, 이번
PR 자신이 근본 원인으로 짚은 바로 그 패턴이 새 코드에도 부분적으로 남아 있다는 뜻이다.

## 위험도

HIGH — diff 가 고친 로직 자체는 정확하나(직접 재현·검증 완료), 이 사고의 핵심 지점(`updateExecutionStatus`)에
대한 회귀 테스트가 전무하고 그 부재가 상위 문서(RESOLUTION.md)의 명시적 허위 주장으로 가려져 있어,
다음 리팩터링에서 동일 클래스의 무음 회귀가 재발해도 CI 가 잡지 못할 위험이 실재한다.
