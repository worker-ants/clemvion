# 부작용(Side Effect) 코드 리뷰 — workflow duplicate (nodes/edges 캔버스 복제)

대상: `codebase/backend/src/modules/workflows/workflows.service.ts` `duplicate()`(신규 구현) +
`workflows.controller.ts`(Swagger 설명 변경) + `workflows.service.spec.ts`/
`test/workflow-crud.e2e-spec.ts`(테스트). `plan/**`·`review/consistency/**`·`spec/**` 는 런타임 코드가
아니므로 부작용 관점 대상에서 제외(문서/오케스트레이터 산출물이며 프로젝트 관례상 정상 커밋 대상).

## 발견사항

- **[WARNING]** 신규 `duplicate` describe 의 `beforeEach` 가 파일 전역 공유 mock(`mockTransactionManager`)의
  `find`/`save`를 새 `jest.fn()` 으로 재대입하고, 뒤이어 실행되는 `saveCanvas` describe 의 앞쪽 12개
  테스트가 이를 리셋하지 않아 그 mock 오염을 그대로 물려받는다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:492`(`insert` 재대입),
    `:496-500`(`find` 재대입 — `entity === Node ? origNodes : origEdges` 로 고정),
    `:501-507`(`save` 재대입). 영향받는 곳: 같은 파일 `:687-693`(`describe('saveCanvas', ...)` 의
    자체 `beforeEach` — `mockRepository.findOne` 만 재설정하고 `mockTransactionManager.find`/`save` 는
    건드리지 않음) 이하 `:695`~`:1000` 구간의 최상위 `it()` 12건(첫 리셋은 중첩 `describe`
    내부 `:1005` 에서야 발생).
  - 상세: `mockTransactionManager` 는 파일 최상단(`:78-88`)에서 한 번만 선언되는, 모든 `describe`
    블록이 공유하는 단일 객체다. 파일 전역 `beforeEach`(`:118-146`)가 매 테스트 전 `jest.clearAllMocks()`
    를 호출하지만, 이 API 는 `mock.calls`/`mock.results` 만 지우고 `mockImplementation`/
    `mockResolvedValue` 로 설정된 구현 자체나 `obj.prop = jest.fn()` 형태의 프로퍼티 재대입은 되돌리지
    않는다(Jest 의 `mockReset`/`resetAllMocks` 와의 차이). 이 사실을 별도의 최소 재현 테스트로 직접
    검증했다 — 동일 패턴(외곽 `beforeEach`에서 `clearAllMocks`, describe-A 의 `beforeEach`가
    `shared.find = jest.fn().mockResolvedValue('POLLUTED')` 로 재대입, 뒤이은 describe-B 는 리셋 없이
    호출)을 별도 스펙 파일로 실행하면 describe-B 가 `'POLLUTED'` 값을 그대로 관측한다(`console.log`
    로 실측 확인).
    실제 파일에서 `duplicate` describe 는 파일 내에서 `.find`/`.save`/`.insert`/`.update` 를 재대입하는
    **유일한** 블록이며(diff 이전에는 `mockTransactionManager.find` 가 파일 전체에서 한 번도 재대입된
    적이 없었다 — `grep` 으로 확인), `duplicate` describe 의 마지막 테스트(`:677`
    "워크스페이스 밖 워크플로우는 404") 실행 후에도 `.find`/`.save` 는 그 describe 의
    `beforeEach`(`:496-507`)가 설정한 구현(원본 5노드/2엣지 fixture 반환)에 고정된 채로 남는다.
    바로 다음에 실행되는 `saveCanvas` describe(`:687`)는 자체 `beforeEach`(`:688-693`)에서
    `mockRepository.findOne` 만 재설정하고 `mockTransactionManager.find`/`save` 는 그대로 두므로,
    `syncNodes`/`syncEdges`(`manager.find(Node/Edge, ...)` 호출)가 의도한 기본값 `[]` 대신 `duplicate`
    describe 의 fixture(`origNodes`/`origEdges`, 5개/2개)를 "기존 노드/엣지" 로 받는다. 실제로
    `saveCanvas` 앞쪽 12개 테스트(`:695`~`:1000`) 는 이 오염된 `.find` 하에서 실행되며, 첫 리셋은
    중첩된 `describe('graphWarningRules backend enforcement', ...)` 내부(`:1005`)에서야 등장한다.
    현재는 이 12개 테스트의 단언이 `toHaveBeenCalled()`/`toBeDefined()`/`expect.any(Array)` 등
    느슨한 형태라 실패로 이어지지 않는다(실제로 `workflows.service.spec.ts` 76개 테스트 전체 실행 결과
    76 passed 로 확인) — 하지만 이 테스트들은 원래 의도(빈 캔버스에 순수 insert)와 다르게 "5개 기존
    행 삭제 + 신규 삽입" 경로를 조용히 타게 되어, 실제로 무엇을 검증하는지가 파일 순서에 암묵적으로
    의존하는 상태가 됐다. 특히 아이러니한 지점은, 같은 `beforeEach` 옆의 주석(`:493-494`)이 정확히
    이 클래스의 문제("다른 describe 의 beforeEach 가 얹어둔 잔여가 아니라 이 describe 소유의 spy 임을
    보장한다")를 언급하며 **`duplicate` 가 다른 describe 로부터 오염받는 방향**은 명시적으로 막아뒀지만,
    **`duplicate` 가 이후 describe(`saveCanvas`)를 오염시키는 반대 방향**은 막지 못했다는 점이다.
  - 제안: `saveCanvas` describe 의 `beforeEach` 에도
    `mockTransactionManager.find = jest.fn().mockResolvedValue([]);` (및 필요하면 `save`) 를 추가해
    자체 기본값을 명시적으로 복원하거나, 더 근본적으로는 `mockTransactionManager` 를 파일 최상단
    공유 객체 대신 매 테스트(`beforeEach`)마다 새로 생성하는 팩토리(`createMockTransactionManager()`)로
    바꿔 describe 경계를 넘는 상호 오염 가능성 자체를 구조적으로 제거할 것.

- **[INFO]** `duplicate()` 의 영속 부작용(persisted side effect) 확장은 의도된 변경이며 방어적으로
  잘 처리되어 있다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:236-312`(`duplicate()` 트랜잭션
    본문)
  - 상세: 이전에는 `workflow` 테이블에 대한 INSERT 1건뿐이었으나, 이제 `dataSource.transaction` 한
    범위 안에서 `workflow` INSERT 1건 + `node`/`edge` 배치 SELECT 2건 + 배치 INSERT 최대 2건으로 쓰기
    표면이 늘었다. 확인한 안전장치: (1) 전부 단일 트랜잭션 안에 있어 중간 실패 시 부분 사본이 남지
    않음, (2) `tags`/`settings` 를 `[...(original.tags ?? [])]` / `{ ...(original.settings ?? {}) }`
    로 얕은 복사해(`:243`, `:245`) 반환된 사본 엔티티가 원본과 배열/객체 참조를 공유하지 않도록
    막음(주석 `:241-242` 로 이유 명시), (3) `manager.update`/`manager.remove` 가 전혀 호출되지 않고
    원본 fixture 객체가 in-place 로 변이되지 않음을 전용 테스트(`workflows.service.spec.ts:638-646`
    "원본의 node · edge row 를 수정하지 않는다")가 고정, (4) `manager.insert` 가 `@BeforeInsert`
    훅·cascade 를 건너뛴다는 전제는 `importWorkflow` 와 공유하는 기존 가드 테스트(같은 파일 `W3c`,
    `:2222-2252`, 이번 diff 밖의 기존 코드)가 엔티티 단위로 이미 고정하고 있어 `duplicate()` 의 두
    번째 사용처도 자동으로 보호됨.

- **[INFO]** 시그니처/공개 인터페이스 안정성 확인.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:228-232`(`duplicate` 시그니처),
    `codebase/backend/src/modules/workflows/workflows.controller.ts:224-230`(유일한 호출부)
  - 상세: `duplicate(id, workspaceId, userId): Promise<Workflow>` 시그니처는 변경되지 않았고,
    저장소 전체에서 `grep` 한 결과 `WorkflowsController.duplicate` 가 유일한 내부 호출자다. Swagger
    `@ApiOperation.description`(`workflows.controller.ts:215`) 텍스트만 갱신됐고 응답 DTO
    (`@ApiCreatedWrappedResponse(WorkflowDto, ...)`, `:218-220`)는 그대로라 와이어 포맷을 소비하는
    기존 클라이언트를 깨지 않는다. 다만 같은 엔드포인트가 이제 훨씬 큰 DB 풋프린트(노드/엣지 실제
    생성)를 만들어내므로, 이 엔드포인트를 이미 호출 중인 소비자는 사본을 GET/export 했을 때 이전과
    다른(더 풍부한) 결과를 관측하게 된다 — 의도된 버그 수정이며 Swagger·spec 양쪽에 명시돼 있어
    "숨은" 부작용은 아니다.

- **[INFO]** 이벤트 중복 발화가 구조적으로 차단됨.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:228-313`(`duplicate()` 전체 —
    `Trigger` 관련 repository/엔티티를 어디서도 참조하지 않음)
  - 상세: 신규 Rationale(`spec/data-flow/11-workflow.md`, "복제가 버전 이력·트리거·데이터셋을
    승계하지 않는 이유")이 "`trigger`(webhook/schedule)는 승계 시 동일 이벤트가 두 워크플로우를
    동시에 발화시켜 사용자가 의도하지 않은 중복 실행을 만든다" 는 것을 명시적으로 근거로 든다.
    `WorkflowsService` 생성자(`:58-75`)에 `Trigger` repository 자체가 주입돼 있지 않아 `duplicate()`
    가 구조적으로 트리거 테이블을 건드릴 수 없다 — 문서상 결정과 코드가 일치하며, 잠재적인
    이벤트/콜백 중복 부작용을 처음부터 차단한다.

## 검증 방법

- `codebase/backend/src/modules/workflows/workflows.service.ts` 전체를 직접 읽고 `duplicate()` 를
  기존 `create()`/`importWorkflow()`/`saveCanvas()` 패턴과 대조.
- `grep` 으로 `.duplicate(` 의 전체 호출부(컨트롤러 1곳뿐)와 `mockTransactionManager.*=` 재대입
  전체 목록을 저장소 전역에서 확인.
- `npx jest src/modules/workflows/workflows.service.spec.ts` 실행 — 76 passed 확인(현재 오염이 실패로
  드러나지 않음을 실측).
  최소 재현 스펙(describe 경계를 넘는 mock 프로퍼티 재대입이 `jest.clearAllMocks()` 로 지워지지 않음)을
  별도로 작성해 실행, `console.log` 로 오염된 값이 실제로 다음 describe 에 전파됨을 확인.

## 요약

프로덕션 코드(`workflows.service.ts`/`workflows.controller.ts`) 관점에서는 문제가 없다 —
`duplicate()` 의 쓰기 표면이 `workflow` 단일 INSERT 에서 `workflow`+`node`+`edge` 트랜잭션 단위 복제로
의도적으로 확장됐고, 원본 non-mutation·참조 얕은 복사·트랜잭션 원자성·트리거 미승계(이벤트 중복 차단)가
모두 방어적으로 처리·테스트돼 있으며 공개 시그니처/응답 DTO 도 그대로다. 유일한 실질 발견은 테스트
코드에 한정된다: 신규 `duplicate` describe 의 `beforeEach` 가 파일 전역 공유 mock 객체의 프로퍼티를
재대입하면서 그 오염이 `jest.clearAllMocks()` 로 지워지지 않고 바로 다음에 실행되는 `saveCanvas`
describe 의 앞쪽 12개 테스트로 넘어간다 — 현재는 해당 테스트들의 단언이 느슨해 실패로 드러나지
않지만("전체 76 passed" 로 실측), 그 테스트들이 실제로는 의도와 다른 입력 상태(빈 캔버스가 아니라
"5개 기존 행 삭제 후 재삽입")로 실행되고 있어 커버리지가 조용히 왜곡돼 있고, 향후 더 엄격한 단언이
추가되거나 실행 순서가 바뀌면 원인을 특정하기 어려운 실패를 유발할 수 있는 잠재적 취약점이다.

## 위험도

LOW
