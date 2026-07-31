# 테스트(Testing) 리뷰 — 워크플로우 duplicate 캔버스 복제 (RESOLUTION 반영 후 재검토)

대상: `codebase/backend/src/modules/workflows/workflows.controller.ts`(Swagger 설명만 변경) ·
`workflows.service.ts`(`duplicate()`) · `workflows.service.spec.ts`(unit) ·
`codebase/backend/test/workflow-crud.e2e-spec.ts`(e2e C 케이스) — 이번 changeset 전체(4개 코드 파일 +
CHANGELOG/ui-tour/plan/spec 문서 + 직전 라운드(`17_54_27`) 리뷰·consistency-check 산출물)를 검토했다.
직전 라운드 testing.md(`review/code/2026/07/30/17_54_27/testing.md`)가 지적한 WARNING 2건(mock 오염 누수,
OR 가드 mutation 사각지대)은 실제 커밋(`0cb0ac86d`, `e782bb829`)과 현재 파일 상태를 직접 읽고
`npx jest workflows.service.spec.ts` 재실행(77/77 통과)으로 **정상적으로 해소됐음을 확인**했다. 아래는
이번 라운드에 새로 발견했거나, 여전히 남아 있는 항목이다.

## 발견사항

- **[WARNING]** RESOLUTION.md 의 자체 검증 TEST 결과가 unit 테스트 개수를 실제보다 60건 과다 기재
  - 위치: `review/code/2026/07/30/17_54_27/RESOLUTION.md:74-76` ("`workflows.service.spec.ts` 단독 137/137")
  - 상세: 직접 `npx jest workflows.service.spec.ts --silent` 를 실행한 결과 실제로는 **77/77** 통과한다
    (`grep -c "  it("` 로도 77건 확인). RESOLUTION 자신이 인용하는 이전 수치("76/76, WARNING #5 fixture
    포함 전")에 이번 라운드에 추가된 fixture 테스트 1건을 더하면 76+1=77 이 산술적으로 맞고, "137"은 그
    수치와도 맞지 않는다(약 60건 과다계상 — 어디서 온 숫자인지 diff 상 근거를 찾지 못했다). 다만 바로
    옆에 인용된 "backend 412 suites" 는 `npx jest --listTests | wc -l` 로 직접 대조한 결과 정확히
    일치했다 — 이 섹션 전체가 신뢰할 수 없다는 뜻은 아니고, 이 한 수치가 국소적으로 틀렸다는 뜻이다.
    실제 코드/테스트 자체의 결함은 아니지만, RESOLUTION.md 는 "무엇을 검증했는지"의 감사 기록(audit
    trail)이 존재 목적이므로 검증 가능한 수치가 틀리면 그 문서의 신뢰도 자체를 깎아먹는다.
  - 제안: "137/137" → "77/77" 로 정정. 재검증 없이 e2e(260/260)·playwright(51/51) 등 나머지 수치도
    그대로 신뢰하기보다, 이번 기회에 한 번 더 대조해 두는 것을 권장한다.

- **[INFO]** `duplicate()` 의 핵심 수정(REPEATABLE READ isolation)을 고정하는 회귀 테스트가 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` `describe('duplicate', ...)`
    (387-714행) 전체 — `mockDataSource.transaction` 에 대한 단언은 362행(`saveCanvas` 몫,
    `toHaveBeenCalled()`)과 712행(404 케이스, `not.toHaveBeenCalled()`)뿐이고, 11개 `duplicate` 테스트
    어디에도 `toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function))` 형태의 단언이 없다.
  - 상세: 이번 changeset 의 concurrency 수정(`a7ab2750a`, WARNING #1)의 핵심 가치는 정확히 이
    isolation-level 인자다. 그런데 `mockDataSource.transaction` 어댑터(`workflows.service.spec.ts:94-99`,
    `args.find(a => typeof a === 'function')`)는 콜백을 인자 위치와 무관하게 찾아 실행하도록 만들어져,
    향후 누군가 `this.dataSource.transaction(async (manager) => {...})` 로 isolation 인자를 실수로
    제거해도(read skew 방어가 조용히 원상복구돼도) 11개 테스트 중 어느 것도 실패하지 않는다. 다만 이는
    이 diff 만의 문제는 아니다 — 같은 어댑터 패턴을 쓰는 선례
    `codebase/backend/src/modules/executions/executions.service.spec.ts:111-128` 도 동일하게 isolation
    문자열을 검증하는 단언이 없다(전수 grep 확인, `.transaction` 관련 `toHaveBeenCalledWith` 0건).
  - 제안: `expect(mockDataSource.transaction).toHaveBeenCalledWith('REPEATABLE READ',
    expect.any(Function))` 한 줄을 `duplicate` describe 아무 테스트에나(또는 전용 테스트로) 추가. 저비용
    대비 "막 고친 결함이 조용히 재발"을 잡아내는 효과가 크다. `executions.service.spec.ts` 쪽도 동일하게
    보강할 여지가 있음(이번 diff 범위 밖이라 별도 처리 권장).

- **[INFO]** `duplicate()` 컨트롤러 레벨 wiring 테스트 부재 — 직전 라운드의 "기존 관례와 일관" 판단을 정정
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` (해당 테스트 없음, 전체
    grep 결과 `duplicate` 0건) / 대응 프로덕션 코드
    `codebase/backend/src/modules/workflows/workflows.controller.ts:224-230`
    (`@CurrentUser() user: JwtPayload` → `user.sub` 를 추출해 `service.duplicate(id, workspaceId,
    user.sub)` 로 위임)
  - 상세: 직전 라운드 testing.md(`review/code/2026/07/30/17_54_27/testing.md` "확인했으나 문제 없음"
    항목)는 "컨트롤러의 duplicate 엔드포인트도 위임만 하는 얇은 메서드라 기존 관례와 일관된다"고
    판단했으나, 실측 결과 이 판단은 정확하지 않다 — 같은 파일에 정확히 같은 모양(데코레이터로 추출한
    여러 string 인자를 그대로 서비스에 위임)의 `saveCanvas`/`restoreVersion` 에는 전용 pass-through
    unit 테스트가 이미 있다(`workflows.controller.spec.ts:521` `passes user.sub and dto into
    saveCanvas`, `:536` `forwards version + workflow ids into restoreVersion`). `duplicate()` 만 이
    관례에서 빠져 있다. 다만 실제 위험은 낮다 — `user`(객체) 를 통째로 넘기는 실수는
    `WorkflowsService.duplicate(id: string, workspaceId: string, userId: string)` 시그니처가 TypeScript
    컴파일 타임에 바로 잡고, `id`/`workspaceId` 인자 순서 뒤바뀜은 e2e 케이스 C 가 간접적으로 잡는다
    (뒤바뀌면 `findById` 조회가 실패해 `expect(dup.status).toBe(201)` 이 404 로 깨짐).
  - 제안: 필수는 아니지만, `workflows.controller.spec.ts` 의 "canvas + version endpoints" describe 에
    `duplicate` 용 3줄짜리 pass-through 테스트(`controller.duplicate('wf-1', 'ws-1', user)` →
    `toHaveBeenCalledWith('wf-1', 'ws-1', 'user-42')`)를 추가하면 관례가 회복되고, 향후 실제 회귀 시
    실패 지점이 controller/service 중 어디인지 더 정확히 짚어준다.

- **[INFO]** (이월, 미해결 재확인) `nodeRows.length > 0 && edgeRows.length === 0` 조합 미검증
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:303`(Node insert 게이트),
    `:327`(Edge insert 게이트) — 독립된 두 개의 `if (...length > 0)` / 대응 테스트는
    `workflows.service.spec.ts` `duplicate` describe 에 없음(직접 재확인)
  - 상세: `RESOLUTION.md:88-91`(INFO#9 "엣지 0건 케이스 전용 단언 부재")에서 이미 "요청 범위 밖"으로
    명시 보류된 항목 — 현재도 그대로 미해결임을 재확인했다. `importWorkflow` 에는 이 조합의 전용 단언이
    있어(`Node 로 정확히 1회만 호출되고 Edge 로는 호출되지 않음`) `duplicate` 쪽과 비대칭.
  - 제안: 우선순위 낮음(이미 검토·보류 결정됨). 원본 엣지가 0건인 fixture 를 추가해
    `manager.insert` 가 `Node` 로만 호출되고 `Edge` 로는 호출되지 않음을 단언하면 닫힌다.

- **[INFO]** (이월, 미해결 재확인) `node.config`/`edge.condition` 참조 격리 미검증 + 공유 mock 객체의
  구조적 재대입 취약성
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:297`(`config: {
    ...node.config }`), `:323`(`condition: edge.condition`, 얕은 복사조차 없음) — 대응 테스트는
    `toEqual`(값 비교)만 하고 `not.toBe`(참조 비교)가 없음(`RESOLUTION.md:90-92` INFO#6/#10 에서 이미
    "의도된 동작"으로 보류 확정, 재확인 결과 여전히 동일).
  - 참고로 이번 라운드에 고친 mock 오염(WARNING #2)은 `saveCanvas` describe 자신의
    `beforeEach`(`workflows.service.spec.ts:729-736`)에 명시적 리셋을 추가하는 **국소적** 해법이었다.
    실제 오염 사례는 해소됐지만, 원 리뷰가 제안한 "근본적" 해법(최상위 `beforeEach`에서
    `mockTransactionManager` 를 pristine 기본값으로 매번 재조립)은 채택되지 않아, 향후 `duplicate` 와
    `saveCanvas` 사이에 새 describe 가 끼어들며 자신의 리셋을 빠뜨리면 같은 클래스의 오염이 재발할 수
    있는 여지 자체는 구조적으로 남아 있다. 덧붙여 `tsc --noEmit -p tsconfig.json` 을 직접 돌려보면 이
    공유 객체(`mockTransactionManager`, `:78-88` 원 리터럴에 `insert`/`update` 필드 없음)에 대한
    `.insert =`/`.update =` 재대입 라인들(신규 498/501행 포함)에서 TS2339 를 보고한다 — 다만
    `git show origin/main`으로 대조한 결과 이 패턴은 이번 diff 이전부터 있었고(`importWorkflow` 쪽
    기존 재대입) `npx jest`(ts-jest)는 77/77 통과로 이를 막지 않으므로, 이번 diff 가 새로 만든 결함은
    아니다.
  - 제안: 둘 다 우선순위 낮음(이미 보류 결정됨). 다음에 이 영역을 손댈 기회가 있으면 (1) 참조 독립성이
    실제 불변식이면 `edge.condition` 도 얕은 복사 + 회귀 테스트 추가, (2) `mockTransactionManager` 를
    명시적 타입(예: 전체 메서드를 처음부터 선언하거나 `jest.Mocked<...>`)으로 바꿔 정적 타입 안전성을
    확보하고 최상위 리셋 헬퍼를 두는 두 가지를 함께 고려.

## 확인했으나 문제 없음 (참고 — 직전 라운드 WARNING 재검증)

- **WARNING #2 (mock 오염 누수) 해소 확인**: `saveCanvas` describe 의 `beforeEach`(`workflows.service.spec.ts:717-737`)에 `mockTransactionManager.find`/`.save` 명시적 재설정이 추가돼 있고, 그 근거 주석(722-728행)이 실측 계측 결과("5회 오염 확인")까지 정확히 남겨 향후 재발 시 진단을 돕는다.
- **WARNING #5 (OR 가드 mutation 사각지대) 해소 확인**: "노드가 사라져 엣지의 source 를 못 찾는 경우도 skip 한다"(683-704행)가 기존 target-missing 테스트(662-681행)와 정확히 대칭 — 노드 집합을 `[loop, agent]`(trig 제외)로 바꿔 `!sourceNodeId` 단독으로도 필터링됨을 별도로 검증한다. 두 테스트가 서로 다른 엣지(e-1 vs e-2)를 살아남긴 채 반대쪽만 스킵시키는 구성이라 실제로 mutation(`!sourceNodeId` 제거)을 잡아낼 수 있는 형태임을 코드 추적으로 확인했다.
- e2e 헬퍼 추출(`buildFiveNodeGraphPayload()`, `test/workflow-crud.e2e-spec.ts:36-106`)은 매 호출마다 새 `randomUUID()`를 발급하는 순수 함수라 테스트 간 상태 공유·오염 위험이 없다. 유일한 호출부(226행 `it('C. ...')`)에서 사용 방식도 이전과 동일 — 추출로 인한 의미 변화 없음.
- `mockDataSource.transaction` 어댑터(콜백을 인자 위치와 무관하게 탐색)는 `executions.service.spec.ts` 의 기존 패턴을 그대로 재사용한 것으로, 신규 도입 mock 이 아니라 이미 검증된 컨벤션이다.

## 요약

직전 라운드가 지적한 두 WARNING(테스트 격리 오염, OR 가드 mutation 사각지대)은 코드·테스트 파일을 직접
읽고 `npx jest` 재실행(77/77 통과)으로 실제로 해소됐음을 확인했다. 이번 라운드에서 새로 발견한 것은
`RESOLUTION.md` 자신의 TEST 결과 수치 오기재(137/137 vs 실측 77/77, WARNING) 하나이며, 이는 코드 결함이
아니라 감사 문서의 신뢰도 문제다. 그 외에는 모두 INFO 수준이다 — `duplicate()` 의 핵심 수정(REPEATABLE
READ)을 잠그는 회귀 단언 부재, 컨트롤러 wiring 테스트가 형제 엔드포인트(saveCanvas/restoreVersion)
대비 비대칭으로 빠져 있다는 점(직전 라운드의 "관례와 일치" 판단은 부정확했음), 그리고 이미
RESOLUTION.md 에서 명시적으로 보류를 확정한 이월 항목(엣지 0건 조합, config/condition 참조 격리) 들이다.
전체적으로 `duplicate()` 의 unit/e2e 테스트 설계는 UUID 재매핑·두 참조 축 분리·원본 불변·import 게이트
미적용·고아 엣지 스킵 등 핵심 계약을 폭넓게 커버하고, 지적된 항목에 대해 실측(console.log 계측,
mutation RED/GREEN 확인)까지 거쳐 성실하게 대응한 이력이 확인된다. 발견사항 중 병합을 막을 사안은 없다.

## 위험도

LOW
